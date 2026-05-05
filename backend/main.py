from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import json
import os
from datetime import datetime, timezone, timedelta

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_FILE = "data.json"
ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
ADELAIDE_TZ = timezone(timedelta(hours=9, minutes=30))

def adelaide_now():
    return datetime.now(ADELAIDE_TZ).isoformat()

# ---------------------------------------------------------------------------
# Data load / save
# ---------------------------------------------------------------------------
def default_data():
    return {
        "staff": [],
        "greenhouses": [],
        "activities": [],
        "cropTypes": [],
        "clusters": [],
        "clusterTransitions": {},
        "demand": {},
        "absences": {},
        "schedule": None,
        "scheduleSummary": None,
        "settings": {"tolerance": 5},
        "cycles": [],
        "activeCycleId": None,
        "overtime": {},
        "quarantine": []
    }

def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            raw = json.load(f)
        defaults = default_data()
        for key, val in defaults.items():
            if key not in raw:
                raw[key] = val
        raw["staff"] = [migrate_staff(s) for s in raw.get("staff", [])]
        raw["greenhouses"] = [normalise_gh(g) for g in raw.get("greenhouses", [])]
        return raw
    return default_data()

def save_data(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)

# ---------------------------------------------------------------------------
# Migration: old flat staff model -> new activity-scoped model
# ---------------------------------------------------------------------------
def migrate_staff(s):
    acts = s.get("activities", [])
    if acts and isinstance(acts[0], dict):
        s = ensure_seven_days(s)
        s.setdefault("overtimeLimit", 30)
        return s
    old_ghs = s.get("greenhouses", [])
    old_crops = s.get("cropTypes", [])
    new_activities = []
    for act in acts:
        new_activities.append({
            "activity": act,
            "allGreenhouses": True,
            "greenhouses": list(old_ghs),
            "cropTypes": list(old_crops)
        })
    migrated = {
        "id": s.get("id", ""),
        "name": s.get("name", ""),
        "hoursPerDay": s.get("hoursPerDay", 7),
        "dayHours": s.get("dayHours", {}),
        "overtimeLimit": 30,
        "activities": new_activities,
        "versatility": s.get("versatility", 0)
    }
    return ensure_seven_days(migrated)

def ensure_seven_days(s):
    default_hrs = s.get("hoursPerDay", 7)
    dh = dict(s.get("dayHours", {}))
    for day in ALL_DAYS:
        if day not in dh:
            dh[day] = 0 if day in ("Saturday", "Sunday") else default_hrs
    s["dayHours"] = dh
    return s

# ---------------------------------------------------------------------------
# Normalise greenhouse
# ---------------------------------------------------------------------------
def normalise_gh(gh):
    if isinstance(gh, str):
        return {"id": gh, "name": gh, "cropTypes": []}
    return {
        "id": gh.get("id", gh.get("name", "")),
        "name": gh.get("name", gh.get("id", "")),
        "cropTypes": gh.get("cropTypes", [])
    }

# ---------------------------------------------------------------------------
# Versatility calculation
# ---------------------------------------------------------------------------
def calc_versatility_full(s, all_activities, gh_names, all_crops):
    if not all_activities or not gh_names:
        return 0
    staff_acts = s.get("activities", [])
    act_names = [a["activity"] for a in staff_acts if isinstance(a, dict)]
    a_score = len([x for x in act_names if x in all_activities]) / len(all_activities)
    if staff_acts:
        gh_scores = []
        for act_obj in staff_acts:
            if not isinstance(act_obj, dict):
                continue
            if act_obj.get("allGreenhouses"):
                gh_scores.append(1.0)
            else:
                accessible = [g for g in act_obj.get("greenhouses", []) if g in gh_names]
                gh_scores.append(len(accessible) / len(gh_names) if gh_names else 0)
        g_score = sum(gh_scores) / len(gh_scores) if gh_scores else 0
    else:
        g_score = 0
    all_staff_crops = set()
    for act_obj in staff_acts:
        if isinstance(act_obj, dict):
            for ct in act_obj.get("cropTypes", []):
                all_staff_crops.add(ct)
    c_score = len([x for x in all_staff_crops if x in all_crops]) / len(all_crops) if all_crops else 1.0
    return round((a_score + g_score + c_score) / 3 * 100)

# ---------------------------------------------------------------------------
# Staff eligibility check
# ---------------------------------------------------------------------------
def staff_eligible_for_task(s, activity, gh_name, gh_crops):
    for act_obj in s.get("activities", []):
        if not isinstance(act_obj, dict):
            continue
        if act_obj.get("activity") != activity:
            continue
        if act_obj.get("allGreenhouses"):
            gh_ok = True
        else:
            gh_ok = gh_name in act_obj.get("greenhouses", [])
        if not gh_ok:
            continue
        if gh_crops:
            staff_crops = set(act_obj.get("cropTypes", []))
            if not any(ct in staff_crops for ct in gh_crops):
                continue
        return True
    return False

# ---------------------------------------------------------------------------
# Absence helpers
# ---------------------------------------------------------------------------
def build_absence_map(absences, days):
    absence_map = {}
    for day in days:
        entries = absences.get(day, [])
        if not isinstance(entries, list):
            continue
        for entry in entries:
            if isinstance(entry, str):
                absence_map.setdefault(entry, {})[day] = 0
            elif isinstance(entry, dict):
                sid = entry.get("id")
                hrs = entry.get("hours", 0)
                if sid:
                    absence_map.setdefault(sid, {})[day] = hrs
    return absence_map

def build_staff_availability(staff, absences, days):
    absence_map = build_absence_map(absences, days)
    availability = {}
    for s in staff:
        sid = s["id"]
        availability[sid] = {}
        for day in days:
            normal = s.get("dayHours", {}).get(day, s.get("hoursPerDay", 7))
            if sid in absence_map and day in absence_map[sid]:
                availability[sid][day] = absence_map[sid][day]
            else:
                availability[sid][day] = normal
    return availability

# ---------------------------------------------------------------------------
# Cluster / transition helpers
# ---------------------------------------------------------------------------
def build_cluster_map(clusters):
    cluster_map = {}
    clustered_ghs = set()
    for c in clusters:
        cname = c.get("name", "")
        cghs = c.get("greenhouses", [])
        cluster_map[cname] = cghs
        for gh in cghs:
            clustered_ghs.add(gh)
    return cluster_map, clustered_ghs

def get_gh_clusters(gh_name, cluster_map):
    return [cn for cn, cghs in cluster_map.items() if gh_name in cghs]

def transition_minutes(from_gh, to_gh, cluster_map, cluster_transitions):
    if from_gh is None or from_gh == to_gh:
        return 0
    from_clusters = set(get_gh_clusters(from_gh, cluster_map))
    to_clusters = set(get_gh_clusters(to_gh, cluster_map))
    if from_clusters & to_clusters:
        return 10
    for fc in from_clusters:
        for tc in to_clusters:
            for key in [f"{fc}->{tc}", f"{tc}->{fc}"]:
                if key in cluster_transitions:
                    return cluster_transitions[key]
    return 10

def can_move_cluster(from_gh, to_gh, tolerance, cluster_map):
    if tolerance == 0:
        return True
    if from_gh is None or from_gh == to_gh:
        return True
    from_clusters = set(get_gh_clusters(from_gh, cluster_map))
    to_clusters = set(get_gh_clusters(to_gh, cluster_map))
    if not from_clusters and not to_clusters:
        return False
    if not from_clusters or not to_clusters:
        return False
    return bool(from_clusters & to_clusters)

# ---------------------------------------------------------------------------
# Quarantine
# ---------------------------------------------------------------------------
def build_quarantine_map(quarantine, current_date_str):
    qmap = {}
    try:
        current = datetime.fromisoformat(current_date_str)
    except Exception:
        current = datetime.now(ADELAIDE_TZ)
    for event in quarantine:
        try:
            start = datetime.fromisoformat(event.get("startDate", current.isoformat()))
        except Exception:
            continue
        days_lock = event.get("daysLocked", 7)
        end = start + timedelta(days=days_lock)
        if not (start <= current.replace(tzinfo=None) if current.tzinfo else current <= end):
            pass
        allowed_ghs = event.get("allowedGreenhouses", [])
        for sid in event.get("staffIds", []):
            if sid not in qmap:
                qmap[sid] = set(allowed_ghs)
            else:
                qmap[sid] = qmap[sid] & set(allowed_ghs)
    return qmap

# ---------------------------------------------------------------------------
# Schedule summary
# ---------------------------------------------------------------------------
def calc_schedule_summary(schedule, total_capacity, total_demand):
    shortfalls = {}
    total_assigned = 0
    total_unassigned = 0
    for day_list in schedule.values():
        for a in day_list:
            if a.get("unassigned"):
                total_unassigned += a["hours"]
                key = f"{a['greenhouse']}|{a['activity']}"
                if key not in shortfalls:
                    shortfalls[key] = {"gh": a["greenhouse"], "activity": a["activity"], "hours": 0}
                shortfalls[key]["hours"] += a["hours"]
            else:
                total_assigned += a["hours"]
    return {
        "totalDemand": total_demand,
        "totalCapacity": total_capacity,
        "totalAssigned": total_assigned,
        "totalUnassigned": total_unassigned,
        "shortfallByActivity": list(shortfalls.values()),
        "surplusHours": max(0, total_capacity - total_demand),
        "shortfallHours": max(0, total_demand - total_capacity),
        "generatedAt": adelaide_now()
    }

# ---------------------------------------------------------------------------
# Core optimiser
# ---------------------------------------------------------------------------
def run_optimiser(staff, greenhouses, activities, demand, absences,
                  clusters, cluster_transitions, tolerance,
                  quarantine=None, current_date_str=None):

    ghs = [normalise_gh(g) for g in greenhouses]
    gh_names = [g["name"] for g in ghs]
    gh_lookup = {g["name"]: g for g in ghs}
    all_crops = list(set(ct for g in ghs for ct in g.get("cropTypes", [])))
    cluster_map, _ = build_cluster_map(clusters)

    days_with_staff = set()
    for s in staff:
        for day in ALL_DAYS:
            if s.get("dayHours", {}).get(day, 0) > 0:
                days_with_staff.add(day)
    active_days = [d for d in ALL_DAYS if d in days_with_staff]
    if not active_days:
        active_days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    n_days = len(active_days)

    qmap = {}
    if quarantine and current_date_str:
        qmap = build_quarantine_map(quarantine, current_date_str)

    for s in staff:
        s["_v"] = calc_versatility_full(s, activities, gh_names, all_crops)
    staff_sorted = sorted(staff, key=lambda s: s["_v"], reverse=True)
    availability = build_staff_availability(staff, absences, active_days)

    tasks = []
    for gh_name, acts in demand.items():
        if gh_name not in gh_lookup:
            continue
        gh_obj = gh_lookup[gh_name]
        gh_crops = gh_obj.get("cropTypes", [])
        for activity, hours in acts.items():
            h = int(hours) if hours else 0
            if h > 0:
                tasks.append({"gh": gh_name, "activity": activity, "weekly_hours": h, "gh_crops": gh_crops})

    hours_used = {s["id"]: {d: 0.0 for d in active_days} for s in staff}
    staff_day_gh = {s["id"]: {d: None for d in active_days} for s in staff}
    staff_day_trans = {s["id"]: {d: 0 for d in active_days} for s in staff}
    result = {day: [] for day in active_days}

    for task in tasks:
        gh = task["gh"]
        activity = task["activity"]
        weekly_hours = task["weekly_hours"]
        gh_crops = task["gh_crops"]

        base = weekly_hours // n_days
        remainder = weekly_hours % n_days
        hours_per_day = {day: base + (1 if i < remainder else 0) for i, day in enumerate(active_days)}

        for day in active_days:
            needed = hours_per_day[day]
            if needed <= 0:
                continue
            remaining = float(needed)

            def get_eligible(ignore_cluster=False):
                eligible = []
                for s in staff_sorted:
                    sid = s["id"]
                    avail = availability[sid][day]
                    if avail <= 0:
                        continue
                    trans_so_far = staff_day_trans[sid][day]
                    effective_avail = avail - (trans_so_far / 60.0)
                    used = hours_used[sid][day]
                    if used >= effective_avail:
                        continue
                    if not staff_eligible_for_task(s, activity, gh, gh_crops):
                        continue
                    if sid in qmap and gh not in qmap[sid]:
                        continue
                    if not ignore_cluster and tolerance > 0:
                        if not can_move_cluster(staff_day_gh[sid][day], gh, tolerance, cluster_map):
                            continue
                    eligible.append(s)
                return eligible

            eligible = get_eligible()
            if not eligible and tolerance > 0:
                eligible = get_eligible(ignore_cluster=True)

            for s in eligible:
                if remaining <= 0:
                    break
                sid = s["id"]
                avail = availability[sid][day]
                current_gh = staff_day_gh[sid][day]
                trans_cost = transition_minutes(current_gh, gh, cluster_map, cluster_transitions) if current_gh and current_gh != gh else 0
                effective_avail = avail - ((staff_day_trans[sid][day] + trans_cost) / 60.0)
                available_today = effective_avail - hours_used[sid][day]
                if available_today <= 0:
                    continue
                assign = round(min(remaining, available_today), 4)
                if assign <= 0:
                    continue
                hours_used[sid][day] += assign
                staff_day_trans[sid][day] += trans_cost
                if staff_day_gh[sid][day] is None:
                    staff_day_gh[sid][day] = gh
                result[day].append({
                    "staffId": sid, "staffName": s["name"],
                    "greenhouse": gh, "activity": activity,
                    "hours": assign, "transitionMins": trans_cost,
                    "unassigned": False, "reoptimised": False
                })
                remaining -= assign

            if remaining > 0.01:
                result[day].append({
                    "staffId": "UNASSIGNED",
                    "staffName": f"{round(remaining,2)}h unassigned - capacity exceeded",
                    "greenhouse": gh, "activity": activity,
                    "hours": round(remaining, 2), "transitionMins": 0,
                    "unassigned": True, "reoptimised": False
                })

    total_demand = sum(t["weekly_hours"] for t in tasks)
    total_capacity = sum(sum(availability[s["id"]][d] for d in active_days) for s in staff)
    summary = calc_schedule_summary(result, total_capacity, total_demand)
    return result, summary

# ---------------------------------------------------------------------------
# Reoptimise
# ---------------------------------------------------------------------------
def run_reoptimise(existing_schedule, affected_staff_id, affected_days,
                   staff, greenhouses, activities, demand, absences,
                   clusters, cluster_transitions, tolerance,
                   quarantine=None, current_date_str=None):

    ghs = [normalise_gh(g) for g in greenhouses]
    gh_names = [g["name"] for g in ghs]
    gh_lookup = {g["name"]: g for g in ghs}
    all_crops = list(set(ct for g in ghs for ct in g.get("cropTypes", [])))
    cluster_map, _ = build_cluster_map(clusters)
    active_days = list(existing_schedule.keys())
    qmap = build_quarantine_map(quarantine, current_date_str) if quarantine and current_date_str else {}

    for s in staff:
        s["_v"] = calc_versatility_full(s, activities, gh_names, all_crops)
    staff_sorted = sorted(staff, key=lambda s: s["_v"], reverse=True)
    availability = build_staff_availability(staff, absences, active_days)

    new_schedule = {}
    affected_tasks = []
    for day in active_days:
        day_assignments = existing_schedule.get(day, [])
        if day in affected_days:
            new_schedule[day] = [a for a in day_assignments if a.get("staffId") != affected_staff_id and not a.get("unassigned")]
            for a in day_assignments:
                if a.get("staffId") == affected_staff_id:
                    affected_tasks.append({**a, "day": day})
        else:
            new_schedule[day] = [a for a in day_assignments if not a.get("unassigned")]

    hours_used = {s["id"]: {d: 0.0 for d in active_days} for s in staff}
    staff_day_gh = {s["id"]: {d: None for d in active_days} for s in staff}
    staff_day_trans = {s["id"]: {d: 0 for d in active_days} for s in staff}

    for day in active_days:
        for a in new_schedule.get(day, []):
            sid = a.get("staffId")
            if sid and sid != "UNASSIGNED" and sid in hours_used:
                hours_used[sid][day] += a.get("hours", 0)
                if staff_day_gh[sid][day] is None:
                    staff_day_gh[sid][day] = a.get("greenhouse")

    for task in affected_tasks:
        day = task["day"]
        gh = task["greenhouse"]
        activity = task["activity"]
        gh_obj = gh_lookup.get(gh, {})
        gh_crops = gh_obj.get("cropTypes", [])
        remaining = float(task["hours"])

        eligible = [s for s in staff_sorted
                    if s["id"] != affected_staff_id
                    and availability[s["id"]][day] > hours_used[s["id"]][day]
                    and staff_eligible_for_task(s, activity, gh, gh_crops)
                    and (s["id"] not in qmap or gh in qmap[s["id"]])]

        for s in eligible:
            if remaining <= 0:
                break
            sid = s["id"]
            avail = availability[sid][day]
            current_gh = staff_day_gh[sid][day]
            trans_cost = transition_minutes(current_gh, gh, cluster_map, cluster_transitions) if current_gh and current_gh != gh else 0
            effective_avail = avail - ((staff_day_trans[sid][day] + trans_cost) / 60.0)
            available_today = effective_avail - hours_used[sid][day]
            if available_today <= 0:
                continue
            assign = round(min(remaining, available_today), 4)
            if assign <= 0:
                continue
            hours_used[sid][day] += assign
            staff_day_trans[sid][day] += trans_cost
            if staff_day_gh[sid][day] is None:
                staff_day_gh[sid][day] = gh
            new_schedule[day].append({
                "staffId": sid, "staffName": s["name"],
                "greenhouse": gh, "activity": activity,
                "hours": assign, "transitionMins": trans_cost,
                "unassigned": False, "reoptimised": True
            })
            remaining -= assign

        if remaining > 0.01:
            new_schedule[day].append({
                "staffId": "UNASSIGNED",
                "staffName": f"{round(remaining,2)}h unassigned - no replacement found",
                "greenhouse": gh, "activity": activity,
                "hours": round(remaining, 2), "transitionMins": 0,
                "unassigned": True, "reoptimised": True
            })

    total_demand = sum(int(h) for acts in demand.values() for h in acts.values() if h)
    total_capacity = sum(sum(availability[s["id"]][d] for d in active_days) for s in staff)
    summary = calc_schedule_summary(new_schedule, total_capacity, total_demand)
    return new_schedule, len(affected_tasks), summary

# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------
@app.get("/")
def root():
    return {"message": "Greenhouse Planner API is running", "time": adelaide_now()}

@app.get("/time")
def get_time():
    return {"adelaideTime": adelaide_now()}

@app.get("/data")
def get_data():
    return load_data()

@app.post("/data")
def post_data(payload: dict):
    if "greenhouses" in payload:
        payload["greenhouses"] = [normalise_gh(g) for g in payload["greenhouses"]]
    if "staff" in payload:
        payload["staff"] = [migrate_staff(s) for s in payload["staff"]]
    save_data(payload)
    return {"message": "Data saved successfully", "savedAt": adelaide_now()}

@app.post("/optimise")
def optimise(payload: dict):
    try:
        schedule, summary = run_optimiser(
            payload.get("staff", []), payload.get("greenhouses", []),
            payload.get("activities", []), payload.get("demand", {}),
            payload.get("absences", {}), payload.get("clusters", []),
            payload.get("clusterTransitions", {}), payload.get("tolerance", 5),
            payload.get("quarantine", []), payload.get("currentDate", adelaide_now())
        )
        return {"schedule": schedule, "summary": summary}
    except Exception as e:
        import traceback
        return {"error": str(e), "trace": traceback.format_exc(), "schedule": {}, "summary": {}}

@app.post("/reoptimise")
def reoptimise(payload: dict):
    try:
        new_schedule, affected_count, summary = run_reoptimise(
            payload.get("existingSchedule", {}), payload.get("affectedStaffId"),
            payload.get("affectedDays", []), payload.get("staff", []),
            payload.get("greenhouses", []), payload.get("activities", []),
            payload.get("demand", {}), payload.get("absences", {}),
            payload.get("clusters", []), payload.get("clusterTransitions", {}),
            payload.get("tolerance", 5), payload.get("quarantine", []),
            payload.get("currentDate", adelaide_now())
        )
        return {"schedule": new_schedule, "affectedTasks": affected_count, "summary": summary}
    except Exception as e:
        import traceback
        return {"error": str(e), "trace": traceback.format_exc()}

# ---------------------------------------------------------------------------
# Cycles
# ---------------------------------------------------------------------------
@app.get("/cycles")
def get_cycles():
    data = load_data()
    return {"cycles": data.get("cycles", []), "activeCycleId": data.get("activeCycleId")}

@app.post("/cycles/create")
def create_cycle(payload: dict):
    data = load_data()
    cycle = {
        "id": f"cycle_{int(datetime.now().timestamp())}",
        "name": payload.get("name", "New Cycle"),
        "startDate": payload.get("startDate"),
        "endDate": payload.get("endDate"),
        "weeks": payload.get("weeks", []),
        "status": "draft",
        "createdAt": adelaide_now(),
        "activatedAt": None,
        "completedAt": None
    }
    data["cycles"].append(cycle)
    save_data(data)
    return {"cycle": cycle}

@app.post("/cycles/{cycle_id}/activate")
def activate_cycle(cycle_id: str):
    data = load_data()
    for c in data["cycles"]:
        if c["id"] == cycle_id:
            c["status"] = "active"
            c["activatedAt"] = adelaide_now()
            data["activeCycleId"] = cycle_id
    save_data(data)
    return {"message": "Cycle activated", "cycleId": cycle_id}

@app.post("/cycles/{cycle_id}/complete")
def complete_cycle(cycle_id: str):
    data = load_data()
    for c in data["cycles"]:
        if c["id"] == cycle_id:
            c["status"] = "completed"
            c["completedAt"] = adelaide_now()
    save_data(data)
    return {"message": "Cycle completed"}

@app.post("/cycles/{cycle_id}/carryforward")
def carry_forward_cycle(cycle_id: str):
    import copy
    data = load_data()
    source = next((c for c in data["cycles"] if c["id"] == cycle_id), None)
    if not source:
        return {"error": "Cycle not found"}
    new_cycle = copy.deepcopy(source)
    new_cycle["id"] = f"cycle_{int(datetime.now().timestamp())}"
    new_cycle["name"] = f"{source['name']} (Copy)"
    new_cycle["status"] = "draft"
    new_cycle["createdAt"] = adelaide_now()
    new_cycle["activatedAt"] = None
    new_cycle["completedAt"] = None
    for week in new_cycle.get("weeks", []):
        week["schedule"] = None
        week["summary"] = None
    data["cycles"].append(new_cycle)
    save_data(data)
    return {"cycle": new_cycle}

# ---------------------------------------------------------------------------
# Overtime
# ---------------------------------------------------------------------------
@app.get("/overtime/{cycle_id}/{week_index}")
def get_overtime(cycle_id: str, week_index: int):
    data = load_data()
    key = f"{cycle_id}|{week_index}"
    return {"overtime": data.get("overtime", {}).get(key, [])}

@app.post("/overtime/{cycle_id}/{week_index}")
def save_overtime(cycle_id: str, week_index: int, payload: dict):
    data = load_data()
    key = f"{cycle_id}|{week_index}"
    data.setdefault("overtime", {})[key] = payload.get("entries", [])
    save_data(data)
    return {"message": "Overtime saved", "savedAt": adelaide_now()}

@app.post("/overtime/calculate")
def calculate_overtime(payload: dict):
    try:
        staff = payload.get("staff", [])
        greenhouses = payload.get("greenhouses", [])
        activities = payload.get("activities", [])
        schedule = payload.get("schedule", {})
        absences = payload.get("absences", {})
        ghs = [normalise_gh(g) for g in greenhouses]
        gh_names = [g["name"] for g in ghs]
        gh_lookup = {g["name"]: g for g in ghs}
        all_crops = list(set(ct for g in ghs for ct in g.get("cropTypes", [])))
        active_days = list(schedule.keys()) if schedule else ["Monday","Tuesday","Wednesday","Thursday","Friday"]
        for s in staff:
            s["_v"] = calc_versatility_full(s, activities, gh_names, all_crops)
        availability = build_staff_availability(staff, absences, active_days)
        assigned_hours = {s["id"]: 0.0 for s in staff}
        for day, assignments in schedule.items():
            for a in assignments:
                sid = a.get("staffId")
                if sid and sid != "UNASSIGNED":
                    assigned_hours[sid] = assigned_hours.get(sid, 0) + a.get("hours", 0)
        unassigned_tasks = [
            {**a, "day": day}
            for day, assignments in schedule.items()
            for a in assignments if a.get("unassigned")
        ]
        if not unassigned_tasks:
            return {"entries": [], "message": "No unassigned hours — no overtime needed"}
        def sort_key(s):
            sid = s["id"]
            capacity = sum(availability[sid][d] for d in active_days)
            utilisation = assigned_hours.get(sid, 0) / capacity if capacity > 0 else 1
            return (utilisation, -s["_v"])
        staff_sorted = sorted(staff, key=sort_key)
        ot_hours_used = {s["id"]: 0.0 for s in staff}
        ot_entries = []
        for task in unassigned_tasks:
            gh = task["greenhouse"]
            activity = task["activity"]
            day = task["day"]
            hours_needed = task["hours"]
            gh_obj = gh_lookup.get(gh, {})
            gh_crops = gh_obj.get("cropTypes", [])
            remaining = hours_needed
            for s in staff_sorted:
                if remaining <= 0:
                    break
                sid = s["id"]
                ot_limit = s.get("overtimeLimit", 30)
                ot_used = ot_hours_used.get(sid, 0)
                if ot_used >= ot_limit:
                    continue
                if not staff_eligible_for_task(s, activity, gh, gh_crops):
                    continue
                can_assign = min(remaining, ot_limit - ot_used)
                if can_assign <= 0:
                    continue
                ot_hours_used[sid] += can_assign
                ot_entries.append({
                    "staffId": sid, "staffName": s["name"],
                    "greenhouse": gh, "activity": activity,
                    "day": day, "hours": round(can_assign, 2),
                    "ratePerHour": None, "estimatedCost": None,
                    "source": "system", "createdAt": adelaide_now()
                })
                remaining -= can_assign
        return {"entries": ot_entries}
    except Exception as e:
        import traceback
        return {"error": str(e), "trace": traceback.format_exc()}

# ---------------------------------------------------------------------------
# Quarantine routes
# ---------------------------------------------------------------------------
@app.get("/quarantine")
def get_quarantine():
    data = load_data()
    return {"quarantine": data.get("quarantine", [])}

@app.post("/quarantine")
def create_quarantine(payload: dict):
    data = load_data()
    event = {
        "id": f"quar_{int(datetime.now().timestamp())}",
        "greenhouseId": payload.get("greenhouseId"),
        "staffIds": payload.get("staffIds", []),
        "allowedGreenhouses": payload.get("allowedGreenhouses", []),
        "daysLocked": payload.get("daysLocked", 7),
        "startDate": payload.get("startDate", adelaide_now()),
        "reason": payload.get("reason", ""),
        "createdBy": payload.get("createdBy", "GM"),
        "createdAt": adelaide_now()
    }
    data.setdefault("quarantine", []).append(event)
    save_data(data)
    return {"event": event}

@app.delete("/quarantine/{event_id}")
def delete_quarantine(event_id: str):
    data = load_data()
    data["quarantine"] = [e for e in data.get("quarantine", []) if e["id"] != event_id]
    save_data(data)
    return {"message": "Quarantine event removed"}

@app.put("/quarantine/{event_id}")
def update_quarantine(event_id: str, payload: dict):
    data = load_data()
    for e in data.get("quarantine", []):
        if e["id"] == event_id:
            e.update(payload)
            e["updatedAt"] = adelaide_now()
    save_data(data)
    return {"message": "Quarantine event updated"}

# ---------------------------------------------------------------------------
# Migration endpoint
# ---------------------------------------------------------------------------
@app.post("/migrate")
def migrate_all():
    data = load_data()
    data["staff"] = [migrate_staff(s) for s in data.get("staff", [])]
    save_data(data)
    return {"message": f"Migrated {len(data['staff'])} staff members", "migratedAt": adelaide_now()}
