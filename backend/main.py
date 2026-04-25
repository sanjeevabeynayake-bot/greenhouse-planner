from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import json
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_FILE = "data.json"

def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            return json.load(f)
    return {
        "staff": [],
        "greenhouses": [],
        "activities": [],
        "cropTypes": [],
        "clusters": [],
        "demand": {},
        "absences": {},
        "schedule": None,
        "scheduleSummary": None,
        "settings": {"tolerance": 5}
    }

def save_data(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)

def normalise_gh(gh):
    """Always return a dict with id, name, cropTypes"""
    if isinstance(gh, str):
        return {"id": gh, "name": gh, "cropTypes": []}
    return {
        "id": gh.get("id", gh.get("name", "")),
        "name": gh.get("name", gh.get("id", "")),
        "cropTypes": gh.get("cropTypes", [])
    }

def get_gh_name(gh):
    if isinstance(gh, str):
        return gh
    return gh.get("name", gh.get("id", ""))

def calc_versatility(s, activities, gh_names, all_crops):
    if not activities or not gh_names:
        return 0
    a = len([x for x in s.get("activities", []) if x in activities]) / len(activities)
    g = len([x for x in s.get("greenhouses", []) if x in gh_names]) / len(gh_names)
    c = len([x for x in s.get("cropTypes", []) if x in all_crops]) / len(all_crops) if all_crops else 1.0
    return round((a + g + c) / 3 * 100)

def build_absence_map(absences, days):
    """Returns {staff_id: {day: hours_available}}
    0 = fully absent, positive number = partial hours"""
    absence_map = {}
    for day in days:
        entries = absences.get(day, [])
        if not isinstance(entries, list):
            continue
        for entry in entries:
            if isinstance(entry, str):
                if entry not in absence_map:
                    absence_map[entry] = {}
                absence_map[entry][day] = 0
            elif isinstance(entry, dict):
                sid = entry.get("id")
                hrs = entry.get("hours", 0)
                if sid:
                    if sid not in absence_map:
                        absence_map[sid] = {}
                    absence_map[sid][day] = hrs
    return absence_map

def build_staff_availability(staff, absences, days):
    absence_map = build_absence_map(absences, days)
    availability = {}
    for s in staff:
        sid = s["id"]
        availability[sid] = {}
        for day in days:
            day_hours = s.get("dayHours", {})
            normal = day_hours.get(day, s.get("hoursPerDay", 7))
            if sid in absence_map and day in absence_map[sid]:
                availability[sid][day] = absence_map[sid][day]
            else:
                availability[sid][day] = normal
    return availability

def run_optimiser(staff, greenhouses, activities, demand, absences, clusters, tolerance):
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

    # Normalise all greenhouses to dicts
    ghs = [normalise_gh(g) for g in greenhouses]
    gh_names = [g["name"] for g in ghs]

    # Build greenhouse lookup by name
    gh_lookup = {g["name"]: g for g in ghs}

    # Build all crop types from greenhouses
    all_crops = list(set(ct for g in ghs for ct in g.get("cropTypes", [])))

    # Build cluster lookup
    cluster_map = {}  # cluster_name -> list of gh names
    clustered_ghs = set()
    for c in clusters:
        cname = c.get("name", "")
        cghs = c.get("greenhouses", [])
        cluster_map[cname] = cghs
        for gh in cghs:
            clustered_ghs.add(gh)

    def get_gh_clusters(gh_name):
        """Return list of cluster names this gh belongs to"""
        return [cn for cn, cghs in cluster_map.items() if gh_name in cghs]

    def can_move(staff_gh, new_gh):
        """Check if staff can move from staff_gh to new_gh based on clusters"""
        if tolerance == 0:
            return True  # Pure optimisation - no cluster constraints
        if staff_gh is None:
            return True  # First assignment of the day
        if staff_gh == new_gh:
            return True  # Same greenhouse
        
        staff_clusters = set(get_gh_clusters(staff_gh))
        new_clusters = set(get_gh_clusters(new_gh))
        
        # Both independent - cannot combine
        if not staff_clusters and not new_clusters:
            return False
        # One independent, one clustered - cannot combine
        if not staff_clusters or not new_clusters:
            return False
        # Check if they share any cluster (overlap)
        if staff_clusters & new_clusters:
            return True
        return False

    # Calculate versatility for each staff
    for s in staff:
        s["_v"] = calc_versatility(s, activities, gh_names, all_crops)

    # Sort by versatility descending
    staff_sorted = sorted(staff, key=lambda s: s["_v"], reverse=True)

    # Build staff availability
    availability = build_staff_availability(staff, absences, days)

    # Build demand tasks
    tasks = []
    for gh_name, acts in demand.items():
        if gh_name not in gh_lookup:
            continue
        gh_obj = gh_lookup[gh_name]
        gh_crops = gh_obj.get("cropTypes", [])
        for activity, hours in acts.items():
            h = int(hours) if hours else 0
            if h > 0:
                tasks.append({
                    "gh": gh_name,
                    "activity": activity,
                    "weekly_hours": h,
                    "gh_crops": gh_crops
                })

    # Track hours used and current greenhouse per staff per day
    hours_used = {s["id"]: {d: 0 for d in days} for s in staff}
    staff_day_gh = {s["id"]: {d: None for d in days} for s in staff}

    result = {day: [] for day in days}
    shortfalls = {}

    for task in tasks:
        gh = task["gh"]
        activity = task["activity"]
        weekly_hours = task["weekly_hours"]
        gh_crops = task["gh_crops"]

        # Distribute weekly hours across days evenly
        base = weekly_hours // 5
        remainder = weekly_hours % 5
        hours_per_day = {}
        for i, day in enumerate(days):
            hours_per_day[day] = base + (1 if i < remainder else 0)

        for day in days:
            needed = hours_per_day[day]
            if needed <= 0:
                continue

            remaining = needed

            # Find eligible staff - with cluster constraint
            def get_eligible(ignore_cluster=False):
                eligible = []
                for s in staff_sorted:
                    sid = s["id"]
                    avail = availability[sid][day]
                    if avail <= 0:
                        continue
                    used = hours_used[sid][day]
                    if used >= avail:
                        continue
                    # Activity check
                    if activity not in s.get("activities", []):
                        continue
                    # Greenhouse eligibility check
                    if gh not in s.get("greenhouses", []):
                        continue
                    # Crop type check
                    if gh_crops:
                        staff_crops = s.get("cropTypes", [])
                        if not any(ct in staff_crops for ct in gh_crops):
                            continue
                    # Cluster constraint
                    if not ignore_cluster and tolerance > 0:
                        current_gh = staff_day_gh[sid][day]
                        if not can_move(current_gh, gh):
                            continue
                    eligible.append(s)
                return eligible

            eligible = get_eligible(ignore_cluster=False)

            # If tolerance > 0 and no eligible found with cluster constraint,
            # check if releasing constraint improves coverage significantly
            if not eligible and tolerance > 0:
                eligible = get_eligible(ignore_cluster=True)

            # Assign hours
            for s in eligible:
                if remaining <= 0:
                    break
                sid = s["id"]
                avail = availability[sid][day]
                used = hours_used[sid][day]
                available_today = avail - used
                if available_today <= 0:
                    continue
                assign = min(remaining, available_today)
                hours_used[sid][day] += assign
                if staff_day_gh[sid][day] is None:
                    staff_day_gh[sid][day] = gh
                result[day].append({
                    "staffId": sid,
                    "staffName": s["name"],
                    "greenhouse": gh,
                    "activity": activity,
                    "hours": assign,
                    "unassigned": False,
                    "reoptimised": False
                })
                remaining -= assign

            if remaining > 0:
                key = f"{gh}|{activity}"
                if key not in shortfalls:
                    shortfalls[key] = {"gh": gh, "activity": activity, "hours": 0}
                shortfalls[key]["hours"] += remaining
                result[day].append({
                    "staffId": "UNASSIGNED",
                    "staffName": f"{remaining}h unassigned - capacity exceeded",
                    "greenhouse": gh,
                    "activity": activity,
                    "hours": remaining,
                    "unassigned": True,
                    "reoptimised": False
                })

    # Calculate summary
    total_demand = sum(t["weekly_hours"] for t in tasks)
    total_capacity = sum(
        sum(availability[s["id"]][d] for d in days)
        for s in staff
    )
    total_assigned = sum(
        a["hours"] for day_list in result.values()
        for a in day_list if not a["unassigned"]
    )
    total_unassigned = sum(
        a["hours"] for day_list in result.values()
        for a in day_list if a["unassigned"]
    )

    summary = {
        "totalDemand": total_demand,
        "totalCapacity": total_capacity,
        "totalAssigned": total_assigned,
        "totalUnassigned": total_unassigned,
        "shortfallByActivity": list(shortfalls.values()),
        "surplusHours": max(0, total_capacity - total_demand),
        "shortfallHours": max(0, total_demand - total_capacity)
    }

    return result, summary

@app.get("/")
def root():
    return {"message": "Greenhouse Planner API is running"}

@app.get("/data")
def get_data():
    return load_data()

@app.post("/data")
def post_data(payload: dict):
    # Normalise greenhouses before saving
    if "greenhouses" in payload:
        payload["greenhouses"] = [normalise_gh(g) for g in payload["greenhouses"]]
    save_data(payload)
    return {"message": "Data saved successfully"}

@app.post("/optimise")
def optimise(payload: dict):
    try:
        staff = payload.get("staff", [])
        greenhouses = payload.get("greenhouses", [])
        activities = payload.get("activities", [])
        demand = payload.get("demand", {})
        absences = payload.get("absences", {})
        clusters = payload.get("clusters", [])
        tolerance = payload.get("tolerance", 5)

        schedule, summary = run_optimiser(
            staff, greenhouses, activities,
            demand, absences, clusters, tolerance
        )

        return {"schedule": schedule, "summary": summary}

    except Exception as e:
        import traceback
        return {
            "error": str(e),
            "trace": traceback.format_exc(),
            "schedule": {},
            "summary": {}
        }

@app.post("/reoptimise")
def reoptimise(payload: dict):
    try:
        existing_schedule = payload.get("existingSchedule", {})
        affected_staff_id = payload.get("affectedStaffId")
        affected_days = payload.get("affectedDays", [])
        staff = payload.get("staff", [])
        greenhouses = payload.get("greenhouses", [])
        activities = payload.get("activities", [])
        demand = payload.get("demand", {})
        absences = payload.get("absences", {})
        clusters = payload.get("clusters", [])
        tolerance = payload.get("tolerance", 5)

        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

        # Normalise greenhouses
        ghs = [normalise_gh(g) for g in greenhouses]
        gh_lookup = {g["name"]: g for g in ghs}
        gh_names = [g["name"] for g in ghs]
        all_crops = list(set(ct for g in ghs for ct in g.get("cropTypes", [])))

        # Calculate versatility
        for s in staff:
            s["_v"] = calc_versatility(s, activities, gh_names, all_crops)
        staff_sorted = sorted(staff, key=lambda s: s["_v"], reverse=True)

        # Build availability with new absences
        availability = build_staff_availability(staff, absences, days)

        # Separate affected from unaffected assignments
        new_schedule = {}
        affected_tasks = []

        for day in days:
            day_assignments = existing_schedule.get(day, [])
            if day in affected_days:
                unaffected = [a for a in day_assignments
                             if a.get("staffId") != affected_staff_id
                             and not a.get("unassigned")]
                affected = [a for a in day_assignments
                           if a.get("staffId") == affected_staff_id]
                new_schedule[day] = unaffected
                for a in affected:
                    affected_tasks.append({**a, "day": day})
            else:
                new_schedule[day] = [a for a in day_assignments
                                    if not a.get("unassigned")]

        # Build hours used from unaffected assignments
        hours_used = {s["id"]: {d: 0 for d in days} for s in staff}
        staff_day_gh = {s["id"]: {d: None for d in days} for s in staff}

        for day in days:
            for a in new_schedule.get(day, []):
                sid = a.get("staffId")
                if sid and sid != "UNASSIGNED" and sid in hours_used:
                    hours_used[sid][day] += a.get("hours", 0)
                    if staff_day_gh[sid][day] is None:
                        staff_day_gh[sid][day] = a.get("greenhouse")

        # Re-assign affected tasks
        for task in affected_tasks:
            day = task["day"]
            gh = task["greenhouse"]
            activity = task["activity"]
            hours_needed = task["hours"]
            gh_obj = gh_lookup.get(gh, {})
            gh_crops = gh_obj.get("cropTypes", [])
            remaining = hours_needed

            eligible = []
            for s in staff_sorted:
                sid = s["id"]
                if sid == affected_staff_id:
                    continue
                avail = availability[sid][day]
                used = hours_used[sid][day]
                if avail <= 0 or used >= avail:
                    continue
                if activity not in s.get("activities", []):
                    continue
                if gh not in s.get("greenhouses", []):
                    continue
                if gh_crops:
                    if not any(ct in s.get("cropTypes", []) for ct in gh_crops):
                        continue
                eligible.append(s)

            for s in eligible:
                if remaining <= 0:
                    break
                sid = s["id"]
                avail = availability[sid][day] - hours_used[sid][day]
                assign = min(remaining, avail)
                hours_used[sid][day] += assign
                if staff_day_gh[sid][day] is None:
                    staff_day_gh[sid][day] = gh
                new_schedule[day].append({
                    "staffId": sid,
                    "staffName": s["name"],
                    "greenhouse": gh,
                    "activity": activity,
                    "hours": assign,
                    "unassigned": False,
                    "reoptimised": True
                })
                remaining -= assign

            if remaining > 0:
                new_schedule[day].append({
                    "staffId": "UNASSIGNED",
                    "staffName": f"{remaining}h unassigned - no replacement found",
                    "greenhouse": gh,
                    "activity": activity,
                    "hours": remaining,
                    "unassigned": True,
                    "reoptimised": True
                })

        return {
            "schedule": new_schedule,
            "affectedTasks": len(affected_tasks)
        }

    except Exception as e:
        import traceback
        return {"error": str(e), "trace": traceback.format_exc()}