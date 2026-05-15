import React, { useState, useMemo } from "react";
import { LP, lpBtn, lpInp } from "./styles";

// ─── localStorage ──────────────────────────────────────────────────
const PLANS_KEY = "ydp_plans_v1";
function loadPlans() {
  try { return JSON.parse(localStorage.getItem(PLANS_KEY)) || []; }
  catch { return []; }
}
function savePlans(plans) {
  localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
}

// ─── Date helpers ──────────────────────────────────────────────────
function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(d, n) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function toInputDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function planEnd(plan) {
  return addDays(parseDate(plan.startDate), plan.cycleWeeks * 7);
}
function fmtDate(d) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}
function fmtDateShort(d) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
function fmtDateRange(plan) {
  return `${fmtDate(parseDate(plan.startDate))} → ${fmtDate(planEnd(plan))}`;
}
function planPosition(plan, today) {
  const s = parseDate(plan.startDate), e = planEnd(plan);
  if (e < today) return "past";
  if (s > today) return "future";
  return "current";
}

// ─── Grid builder ─────────────────────────────────────────────────
const SPECIAL_ACTS = ["Picking", "Pollination"];

function buildGrid(planData, { cropCycles, cropMasterData, greenhouses, pollinationData, pickingData, activities }) {
  const crop = cropCycles.find(c => c.id === planData.cropId);
  const masterData = cropMasterData.find(d => d.cropId === planData.cropId);
  const gh = (greenhouses || []).find(g => g && g.id === planData.ghId);
  const pollData = (pollinationData || []).find(d => d.ghId === planData.ghId);
  const pickData = (pickingData || []).find(d => d.cropId === planData.cropId);

  const masterDensity = parseFloat(masterData?.density) || 0;
  const rawSqm = parseFloat(
    planData.zone === "A" ? gh?.zoneA?.sqm :
    planData.zone === "B" ? gh?.zoneB?.sqm : gh?.sqm
  ) || 0;
  const sqm = (planData.sqmOverride != null && planData.sqmOverride !== "")
    ? (parseFloat(planData.sqmOverride) || rawSqm)
    : rawSqm;

  const N = planData.cycleWeeks;

  // Per-week density: read from Crop Master densityWeeks array
  const densityWeeks = Array.from({ length: N }, (_, i) => {
    const dw = masterData?.densityWeeks;
    if (dw && i < dw.length && dw[i] != null) return String(dw[i].value);
    return String(masterData?.density ?? "");
  });

  // Regular activity cells (excluding Picking and Pollination)
  const regularActs = (activities || []).filter(a => !SPECIAL_ACTS.includes(a));
  const activityGrid = {};

  for (const act of regularActs) {
    const actCell = masterData?.cells?.[act] ?? { h: "", t: "", weeks: null };
    const cells = Array.from({ length: N }, (_, wi) => {
      const ticked = !!(crop?.matrix?.[`${act}|||${wi}`]);
      if (!ticked) return { hours: null, ticked: false };

      const weekOverride = actCell.weeks?.[wi];
      const rawH = (weekOverride?.h != null && weekOverride.h !== "") ? weekOverride.h : actCell.h;
      const rawT = (weekOverride?.t != null && weekOverride.t !== "") ? weekOverride.t : actCell.t;
      const effH = parseFloat(rawH) || 0;
      const effT = parseFloat(rawT) || 0;

      const weekDensity = parseFloat(densityWeeks[wi]) || masterDensity;
      const densityRatio = masterDensity > 0 ? weekDensity / masterDensity : 1;
      const hours = (effH > 0 && effT > 0 && sqm > 0)
        ? effH * densityRatio * effT * sqm
        : null;

      return { hours, ticked: true };
    });
    activityGrid[act] = cells;
  }

  // Picking cells: vol / kgPerHour per week
  const pickingCells = Array.from({ length: N }, (_, i) => {
    const vols = pickData?.weeklyVolumes ?? [];
    const vol = parseFloat(i < vols.length ? (vols[i] ?? 0) : 0) || 0;
    const kgPerHour = parseFloat(pickData?.kgPerHour) || 0;
    const hours = (vol > 0 && kgPerHour > 0) ? vol / kgPerHour : null;
    return { hours };
  });

  // Pollination cells: constant per week from GH pollination master
  const pollHPR = parseFloat(pollData?.hoursPerRound) || 0;
  const pollRPW = parseFloat(pollData?.roundsPerWeek) || 0;
  const pollWkly = (pollHPR > 0 && pollRPW > 0) ? pollHPR * pollRPW : null;
  const pollinationCells = Array.from({ length: N }, () => ({ hours: pollWkly }));

  // Total hours per week (sum of all activities)
  const totalHrsPerWeek = Array.from({ length: N }, (_, wi) => {
    let total = 0;
    for (const act of regularActs) total += activityGrid[act]?.[wi]?.hours || 0;
    total += pickingCells[wi]?.hours || 0;
    total += pollinationCells[wi]?.hours || 0;
    return total;
  });

  return { densityWeeks, activities: activityGrid, pickingCells, pollinationCells, sqm: String(sqm), totalHrsPerWeek };
}

// ─── Plan status helpers ───────────────────────────────────────────
function getPlanStatus(plan, today) {
  const pos = planPosition(plan, today);
  if (pos === "past") return "past";
  return "draft";
}

function zoneStatus(ghId, zone, plans, today) {
  const zp = plans.filter(p => p.ghId === ghId && p.zone === zone);
  if (zp.length === 0) return "no-plan";
  const statuses = zp.map(p => getPlanStatus(p, today));
  if (statuses.includes("draft")) return "draft";
  return "past";
}

function ghOverallStatus(gh, plans, today) {
  if (gh.splitZones) {
    const a = zoneStatus(gh.id, "A", plans, today);
    const b = zoneStatus(gh.id, "B", plans, today);
    for (const s of ["active", "populated", "draft", "no-plan", "past"]) {
      if (a === s || b === s) return s;
    }
    return "no-plan";
  }
  return zoneStatus(gh.id, "full", plans, today);
}

function matchesFilter(filter, status) {
  if (filter === "All") return true;
  const map = { "No Plan": "no-plan", Draft: "draft", Past: "past" };
  return status === (map[filter] ?? filter);
}

// ─── Status badge ──────────────────────────────────────────────────
const STATUS_CFG = {
  "no-plan": { bg: "#D8DDD8",  color: LP.textMid,   label: "No Plan" },
  draft:     { bg: "#E8F4FD",  color: "#1565C0",    label: "Draft"   },
  past:      { bg: "#EFEFEF",  color: LP.textLight, label: "Past"    },
};

function StatusBadge({ status, small }) {
  const c = STATUS_CFG[status] || STATUS_CFG["no-plan"];
  return (
    <span style={{
      background: c.bg, color: c.color,
      fontSize: small ? 9 : 10, fontWeight: 700,
      padding: small ? "1px 6px" : "2px 9px",
      borderRadius: 10, letterSpacing: 0.3, whiteSpace: "nowrap", flexShrink: 0,
    }}>{c.label}</span>
  );
}

// ─── Left panel pieces ────────────────────────────────────────────
function PlanRow({ plan, today, isSelected, onClick }) {
  const pos = planPosition(plan, today);
  const rowStatus = getPlanStatus(plan, today);
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "7px 14px 7px 28px", width: "100%",
      background: isSelected ? "rgba(82,183,136,0.18)" : "transparent",
      border: "none",
      borderLeft: pos === "current" ? `3px solid ${LP.light}` : "3px solid transparent",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
      cursor: "pointer", minHeight: 44, transition: "background 0.1s",
    }}>
      <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
        <div style={{
          color: pos === "past" ? "rgba(255,255,255,0.35)" : pos === "future" ? "rgba(255,255,255,0.65)" : LP.white,
          fontSize: 11, fontWeight: pos === "current" ? 600 : 400,
          fontStyle: pos === "past" ? "italic" : "normal",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{plan.cropName}</div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>
          {fmtDateRange(plan)}
          {pos === "current" && " ← current"}{pos === "future" && " ← planned"}
        </div>
      </div>
      <StatusBadge status={rowStatus} small />
    </button>
  );
}

function NewCycleButton({ onClick }) {
  return (
    <button onClick={onClick}
      onMouseEnter={e => e.currentTarget.style.color = LP.light}
      onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.4)"}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "7px 14px 7px 28px", background: "transparent",
        border: "none", color: "rgba(255,255,255,0.4)", fontSize: 11,
        cursor: "pointer", width: "100%", textAlign: "left", minHeight: 40,
      }}>
      <span style={{ fontSize: 14 }}>+</span><span>New Cycle</span>
    </button>
  );
}

function ZoneBlock({ label, gh, zone, plans, today, selected, setSelected }) {
  const zonePlans = plans.filter(p => p.zone === zone)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  return (
    <div>
      <div style={{
        padding: "4px 14px 4px 28px", fontSize: 9, fontWeight: 700,
        letterSpacing: 1.5, color: "rgba(255,255,255,0.35)", textTransform: "uppercase",
        background: "rgba(0,0,0,0.1)", borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}>Zone {label}</div>
      {zonePlans.map(p => (
        <PlanRow key={p.id} plan={p} today={today}
          isSelected={selected?.planId === p.id}
          onClick={() => setSelected({ type: "plan", planId: p.id, ghId: gh.id, zone })} />
      ))}
      <NewCycleButton onClick={() => setSelected({ type: "new", ghId: gh.id, zone })} />
    </div>
  );
}

// ─── Create Plan Form ─────────────────────────────────────────────
function CreatePlanForm({ gh, zone, plans, cropCycles, onCreated, onCancel }) {
  const availableCropIds = zone === "A" ? (gh.zoneA?.crops || [])
    : zone === "B" ? (gh.zoneB?.crops || [])
    : (gh.crops || []);
  const availableCrops = cropCycles.filter(c => availableCropIds.includes(c.id));

  const zonePlans = plans.filter(p => p.ghId === gh.id && p.zone === zone)
    .sort((a, b) => planEnd(b) - planEnd(a));
  const prevPlan = zonePlans[0] || null;
  const prevEndDate = prevPlan ? planEnd(prevPlan) : null;
  const suggestedStart = prevEndDate ? addDays(prevEndDate, 1) : null;

  const [cropId, setCropId] = useState("");
  const [startDate, setStartDate] = useState(() =>
    suggestedStart ? toInputDate(suggestedStart) : toInputDate(new Date())
  );
  const [cycleWeeks, setCycleWeeks] = useState("");
  const [overrideWeeks, setOverrideWeeks] = useState(false);

  const selectedCrop = cropCycles.find(c => c.id === cropId);

  useMemo(() => {
    if (cropId && !overrideWeeks && selectedCrop) setCycleWeeks(String(selectedCrop.weeks));
    if (!cropId) setCycleWeeks("");
  }, [cropId, overrideWeeks, selectedCrop]);

  const endDate = startDate && cycleWeeks
    ? addDays(parseDate(startDate), parseInt(cycleWeeks) * 7) : null;

  const overlapPlan = startDate && cycleWeeks ? plans.find(p => {
    if (p.ghId !== gh.id || p.zone !== zone) return false;
    const ns = parseDate(startDate), ne = addDays(ns, parseInt(cycleWeeks) * 7);
    return ns < planEnd(p) && ne > parseDate(p.startDate);
  }) : null;

  const canCreate = !!(cropId && startDate);

  const handleCreate = () => {
    if (!canCreate) return;
    const weeks = parseInt(cycleWeeks) || selectedCrop?.weeks || 24;
    onCreated({
      id: `plan-${Date.now()}`,
      ghId: gh.id, zone, cropId,
      cropName: selectedCrop?.name || "",
      startDate, cycleWeeks: weeks,
      cycleWeeksOverride: overrideWeeks,
      sentToScheduler: false,
      grid: null,
      auditLog: [{ action: "created", at: new Date().toISOString() }],
    });
  };

  const zoneLbl = zone === "A" ? " — Zone A" : zone === "B" ? " — Zone B" : "";
  const sqm = zone === "A" ? gh.zoneA?.sqm : zone === "B" ? gh.zoneB?.sqm : gh.sqm;
  const fl = { display: "flex", flexDirection: "column", gap: 6 };
  const lbl = { fontSize: 12, fontWeight: 600, color: LP.textMid };
  const val = { fontSize: 14, fontWeight: 600, color: LP.textDark };

  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 24px", background: LP.white, borderBottom: `1px solid ${LP.border}`, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: LP.forest, fontFamily: "'Palatino Linotype', Georgia, serif" }}>New Plan{zoneLbl}</div>
          <div style={{ fontSize: 12, color: LP.textLight, marginTop: 2 }}>{gh.name}</div>
        </div>
        <button onClick={onCancel} style={{ background: "none", border: `1px solid ${LP.border}`, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, color: LP.textMid, fontFamily: "inherit", minHeight: 44 }}>Cancel</button>
      </div>

      <div style={{ padding: 28, maxWidth: 560, display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={fl}>
          <span style={lbl}>Greenhouse</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={val}>{gh.name}{zoneLbl}</span>
            {sqm && <span style={{ fontSize: 12, color: LP.textLight }}>{sqm} m²</span>}
          </div>
        </div>

        <div style={fl}>
          <label style={lbl} htmlFor="crop-sel">Crop</label>
          {availableCrops.length === 0 ? (
            <div style={{ fontSize: 13, color: LP.amber, padding: "10px 14px", background: LP.amberLight, borderRadius: 8, border: `1px solid ${LP.amber}` }}>
              ⚠ No crops assigned to this greenhouse{zone !== "full" ? ` Zone ${zone}` : ""} — configure in Greenhouse Master first.
            </div>
          ) : (
            <select id="crop-sel" value={cropId} onChange={e => setCropId(e.target.value)}
              style={{ ...lpInp, appearance: "auto", cursor: "pointer" }}>
              <option value="">Select a crop…</option>
              {availableCrops.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>

        <div style={fl}>
          <label style={lbl} htmlFor="start-date">Cycle start date</label>
          <input id="start-date" type="date" value={startDate}
            onChange={e => setStartDate(e.target.value)}
            style={{ ...lpInp, width: 200 }} />
          {prevPlan && prevEndDate && (
            <div style={{ fontSize: 12, color: LP.textMid, marginTop: 2, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span>Previous cycle ends <strong>{fmtDate(prevEndDate)}</strong>. Suggested: <strong>{fmtDate(suggestedStart)}</strong></span>
              {startDate !== toInputDate(suggestedStart) && (
                <button onClick={() => setStartDate(toInputDate(suggestedStart))}
                  style={{ background: "none", border: `1px solid ${LP.border}`, borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontSize: 11, color: LP.mid, fontFamily: "inherit" }}>
                  Use this date
                </button>
              )}
            </div>
          )}
          {overlapPlan && (
            <div style={{ marginTop: 6, padding: "8px 12px", background: LP.amberLight, border: `1px solid ${LP.amber}`, borderRadius: 8, fontSize: 12, color: LP.amber, fontWeight: 500 }}>
              ⚠ Overlaps with <strong>{overlapPlan.cropName}</strong> ({fmtDateRange(overlapPlan)}) — please check dates
            </div>
          )}
        </div>

        <div style={fl}>
          <span style={lbl}>Cycle length</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {overrideWeeks ? (
              <>
                <input type="number" min="1" max="104" value={cycleWeeks}
                  onChange={e => setCycleWeeks(e.target.value)}
                  style={{ ...lpInp, width: 100 }} />
                <span style={{ fontSize: 13, color: LP.textMid }}>weeks</span>
                <button onClick={() => { setOverrideWeeks(false); if (selectedCrop) setCycleWeeks(String(selectedCrop.weeks)); }}
                  style={{ background: "none", border: "none", color: LP.textLight, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
                  ↺ Reset to master
                </button>
              </>
            ) : (
              <>
                <span style={{ fontSize: 16, fontWeight: 600, color: LP.textDark }}>
                  {cycleWeeks ? `${cycleWeeks} weeks` : <em style={{ color: LP.textLight, fontWeight: 400, fontSize: 13 }}>Select a crop first</em>}
                </span>
                {cycleWeeks && (
                  <button onClick={() => setOverrideWeeks(true)}
                    style={{ background: "none", border: "none", color: LP.mid, cursor: "pointer", fontSize: 12, textDecoration: "underline", fontFamily: "inherit", padding: 0 }}>
                    Override
                  </button>
                )}
              </>
            )}
          </div>
          {selectedCrop && !overrideWeeks && (
            <div style={{ fontSize: 11, color: LP.textLight }}>From Crop Cycle Master — {selectedCrop.name}</div>
          )}
        </div>

        {endDate && (
          <div style={fl}>
            <span style={lbl}>Calculated end date</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: LP.forest, background: LP.mint, padding: "6px 16px", borderRadius: 8 }}>
                {fmtDate(endDate)}
              </span>
              <span style={{ fontSize: 12, color: LP.textLight }}>({cycleWeeks} wks from {fmtDate(parseDate(startDate))})</span>
            </div>
          </div>
        )}

        <div style={{ marginTop: 8 }}>
          <button onClick={handleCreate} disabled={!canCreate}
            style={{ ...lpBtn(canCreate, LP.forest), padding: "12px 32px", fontSize: 14, opacity: canCreate ? 1 : 0.45, cursor: canCreate ? "pointer" : "not-allowed" }}>
            Create Plan →
          </button>
          {!cropId && <div style={{ fontSize: 11, color: LP.textLight, marginTop: 8 }}>Select a crop to continue</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Plan View ────────────────────────────────────────────────────
function PlanView({ plan, gh, cropCycles, cropMasterData, activities, pollinationData, pickingData, setPlans, today }) {
  const masterData = cropMasterData.find(d => d.cropId === plan.cropId);
  const [contextMenu, setContextMenu] = useState(null);

  const sqmFromGH = plan.zone === "A" ? (gh?.zoneA?.sqm || "")
    : plan.zone === "B" ? (gh?.zoneB?.sqm || "")
    : (gh?.sqm || "");
  const effectiveSqm = (plan.sqmOverride != null && plan.sqmOverride !== "") ? String(plan.sqmOverride) : sqmFromGH;
  const zoneLbl = plan.zone === "A" ? " — Zone A" : plan.zone === "B" ? " — Zone B" : "";

  const crop = cropCycles.find(c => c.id === plan.cropId);
  const warnings = [];
  if (!effectiveSqm) warnings.push("Greenhouse sq metres not set — configure in Greenhouse Master");
  if (!masterData?.density) warnings.push(`${plan.cropName} density not set — configure in Crop Master`);
  if (crop && Object.keys(crop.matrix || {}).length === 0)
    warnings.push(`${plan.cropName} has no ticked activities in Crop Cycle Master`);

  const weekHeaders = Array.from({ length: plan.cycleWeeks }, (_, i) => ({
    label: `W${i + 1}`,
    date: addDays(parseDate(plan.startDate), i * 7),
  }));

  const masterDensityStr = masterData?.density || "";
  const densityVals = Array.from({ length: plan.cycleWeeks }, (_, i) => {
    if (plan.grid?.densityWeeks?.[i] != null) return plan.grid.densityWeeks[i];
    const dw = masterData?.densityWeeks;
    if (dw && i < dw.length && dw[i] != null) return String(dw[i].value);
    return masterDensityStr;
  });

  const regularActs = (activities || []).filter(a => !SPECIAL_ACTS.includes(a));

  // ── Handlers ──
  const handleCellEdit = (act, wi, val) => {
    setPlans(prev => prev.map(p => {
      if (p.id !== plan.id) return p;
      const acts = { ...(p.grid?.activities || {}) };
      const row = [...(acts[act] || [])];
      row[wi] = { ...(row[wi] || {}), manualHours: val, isManual: true };
      return { ...p, grid: { ...p.grid, activities: { ...acts, [act]: row } } };
    }));
  };

  const handleSqmEdit = (val) => {
    setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, sqmOverride: val } : p));
  };

  const handleResetCell = (act, wi) => {
    setContextMenu(null);
    setPlans(prev => prev.map(p => {
      if (p.id !== plan.id) return p;
      const acts = { ...(p.grid?.activities || {}) };
      const row = [...(acts[act] || [])];
      row[wi] = { ...(row[wi] || {}), manualHours: null, isManual: false };
      return { ...p, grid: { ...p.grid, activities: { ...acts, [act]: row } } };
    }));
  };

  const handleResetAll = () => {
    setPlans(prev => prev.map(p => {
      if (p.id !== plan.id) return p;
      const acts = {};
      for (const [act, cells] of Object.entries(p.grid?.activities || {})) {
        acts[act] = (cells || []).map(c => ({ ...c, manualHours: null, isManual: false }));
      }
      const pickingCells = (p.grid?.pickingCells || []).map(c => ({ ...c, manualHours: null, isManual: false }));
      const pollinationCells = (p.grid?.pollinationCells || []).map(c => ({ ...c, manualHours: null, isManual: false }));
      return { ...p, grid: { ...p.grid, activities: acts, pickingCells, pollinationCells }, sqmOverride: null };
    }));
  };

  const handlePickingEdit = (wi, val) => {
    setPlans(prev => prev.map(p => {
      if (p.id !== plan.id) return p;
      const pickingCells = [...(p.grid?.pickingCells || [])];
      pickingCells[wi] = { ...(pickingCells[wi] || {}), manualHours: val, isManual: true };
      return { ...p, grid: { ...p.grid, pickingCells } };
    }));
  };

  const handlePollinationEdit = (wi, val) => {
    setPlans(prev => prev.map(p => {
      if (p.id !== plan.id) return p;
      const pollinationCells = [...(p.grid?.pollinationCells || [])];
      pollinationCells[wi] = { ...(pollinationCells[wi] || {}), manualHours: val, isManual: true };
      return { ...p, grid: { ...p.grid, pollinationCells } };
    }));
  };

  const handleResetSpecialCell = (type, wi) => {
    setContextMenu(null);
    setPlans(prev => prev.map(p => {
      if (p.id !== plan.id) return p;
      const key = type === "picking" ? "pickingCells" : "pollinationCells";
      const cells = [...(p.grid?.[key] || [])];
      cells[wi] = { ...(cells[wi] || {}), manualHours: null, isManual: false };
      return { ...p, grid: { ...p.grid, [key]: cells } };
    }));
  };

  const doRecalculate = () => {
    const newGrid = buildGrid(plan, {
      cropCycles, cropMasterData,
      greenhouses: gh ? [gh] : [],
      pollinationData, pickingData, activities,
    });
    setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, grid: newGrid } : p));
  };

  const doPopulate = () => {
    const newGrid = buildGrid(plan, {
      cropCycles, cropMasterData,
      greenhouses: gh ? [gh] : [],
      pollinationData, pickingData, activities,
    });
    setPlans(prev => prev.map(p => p.id === plan.id ? {
      ...p, grid: newGrid, sentToScheduler: true,
      auditLog: [...(p.auditLog || []), { action: "populated", at: new Date().toISOString() }],
    } : p));
  };

  // Dynamic totals — respects manual overrides
  const getEffectiveHours = (act, wi) => {
    const cell = plan.grid?.activities?.[act]?.[wi];
    if (!cell?.ticked) return 0;
    if (cell?.isManual) return parseFloat(cell.manualHours) || 0;
    return cell?.hours || 0;
  };

  const getDynamicTotal = (wi) => {
    let total = 0;
    for (const act of regularActs) total += getEffectiveHours(act, wi);
    const pickCell = plan.grid?.pickingCells?.[wi];
    total += pickCell?.isManual ? (parseFloat(pickCell.manualHours) || 0) : (pickCell?.hours || 0);
    const pollCell = plan.grid?.pollinationCells?.[wi];
    total += pollCell?.isManual ? (parseFloat(pollCell.manualHours) || 0) : (pollCell?.hours || 0);
    return total;
  };

  // Shared style helpers
  const thBase = {
    background: LP.forest, color: LP.white,
    padding: "6px 3px", textAlign: "center",
    borderBottom: `2px solid ${LP.mid}`,
    borderLeft: "1px solid rgba(255,255,255,0.1)",
    position: "sticky", top: 0, zIndex: 2,
    userSelect: "none",
  };

  const stickyLbl = (bg, color, bb) => ({
    position: "sticky", left: 0, zIndex: 2,
    background: bg, color,
    fontSize: 11, fontWeight: 600,
    padding: "0 12px",
    borderRight: `2px solid ${LP.mid}`,
    borderBottom: bb || `1px solid ${LP.borderLight}`,
    height: 44, verticalAlign: "middle",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
    maxWidth: 180,
    boxShadow: "2px 0 6px rgba(0,0,0,0.12)",
  });

  const dataC = (bg, color, bb) => ({
    textAlign: "center", height: 44, verticalAlign: "middle",
    background: bg, color,
    borderLeft: "1px solid rgba(0,0,0,0.05)",
    borderBottom: bb || `1px solid ${LP.borderLight}`,
    fontSize: 11, padding: 0,
  });

  const inpStyle = {
    width: "100%", border: "none", background: "transparent",
    textAlign: "right", padding: "2px 6px",
    color: "inherit", fontFamily: "inherit", fontSize: "inherit",
    fontWeight: "inherit", outline: "none", cursor: "text",
    boxSizing: "border-box", display: "block",
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}
      onClick={() => contextMenu && setContextMenu(null)}>

      {/* Header */}
      <div style={{ padding: "13px 20px", background: LP.white, borderBottom: `1px solid ${LP.border}`, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: LP.forest, fontFamily: "'Palatino Linotype', Georgia, serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {gh?.name}{zoneLbl} — {plan.cropName}
          </div>
          <div style={{ fontSize: 11, color: LP.textLight, marginTop: 2 }}>
            {fmtDate(parseDate(plan.startDate))} → {fmtDate(planEnd(plan))} · {plan.cycleWeeks} weeks
          </div>
        </div>
        <button onClick={handleResetAll}
          style={{ ...lpBtn(false, LP.mid), padding: "8px 16px", minHeight: 44 }}>
          ↺ Reset all
        </button>
        <button onClick={doRecalculate}
          style={{ ...lpBtn(false, LP.mid), padding: "8px 16px", minHeight: 44 }}>
          ↻ Recalculate
        </button>
        <button disabled
          title="Coming soon — Weekly Scheduler not yet connected"
          style={{ ...lpBtn(false, LP.mid), padding: "8px 18px", minHeight: 44, opacity: 0.38, cursor: "not-allowed" }}>
          ▶ Populate to Scheduler
        </button>
      </div>

      {/* Warning banner */}
      {warnings.length > 0 && (
        <div style={{ padding: "9px 20px", background: LP.amberLight, borderBottom: `2px solid ${LP.amber}`, fontSize: 12, color: LP.amber, fontWeight: 500, lineHeight: 1.6 }}>
          ⚠ {warnings.join(" · ")}
        </div>
      )}

      {/* No grid info */}
      {!plan.grid && (
        <div style={{ padding: "8px 20px", background: "#E8F4FD", borderBottom: "1px solid #90CAF9", fontSize: 12, color: "#1565C0" }}>
          ℹ Grid not yet built — click <strong>Recalculate</strong> to generate the activity schedule.
        </div>
      )}

      {/* Grid */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <table style={{ borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 180 }} />
            {weekHeaders.map((_, i) => <col key={i} style={{ width: 62, minWidth: 62 }} />)}
          </colgroup>
          <thead>
            <tr>
              <th style={{ ...thBase, position: "sticky", left: 0, zIndex: 4, textAlign: "left", padding: "7px 12px", borderLeft: "none", fontSize: 10 }}>
                Activity / Week
              </th>
              {weekHeaders.map(({ label, date }) => (
                <th key={label} style={thBase}>
                  <div style={{ fontSize: 10, fontWeight: 700 }}>{label}</div>
                  <div style={{ fontSize: 9, color: LP.mint, fontWeight: 400, marginTop: 1 }}>{fmtDateShort(date)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>

            {/* Density row — read-only display */}
            <tr>
              <td style={stickyLbl("#fff8e7", LP.amber, `2px solid ${LP.amber}`)}>
                Density (pl/m²)
              </td>
              {densityVals.map((d, i) => (
                <td key={i} style={{ ...dataC("#fff8e7", LP.amber, `2px solid ${LP.amber}`), fontWeight: 600, padding: "0 6px" }}>
                  {d || "–"}
                </td>
              ))}
            </tr>

            {/* Sq metres row — editable, plan-level override */}
            <tr>
              <td style={stickyLbl("#F0F4F0", LP.textMid)}>
                Sq Metres (m²)
              </td>
              {Array.from({ length: plan.cycleWeeks }, (_, i) => {
                const isOverridden = plan.sqmOverride != null && plan.sqmOverride !== "";
                return (
                  <td key={i} style={dataC(isOverridden ? "#ffffff" : "#F0F4F0", LP.textMid)}>
                    <input type="number" min="0"
                      value={effectiveSqm}
                      onChange={e => handleSqmEdit(e.target.value)}
                      style={{ ...inpStyle, textAlign: "center", fontWeight: isOverridden ? 700 : 400 }}
                    />
                  </td>
                );
              })}
            </tr>

            {/* Regular activity rows — editable */}
            {regularActs.map((act, ai) => {
              const cells = plan.grid?.activities?.[act];
              const rowBg = ai % 2 === 0 ? LP.white : "#F5F8F5";
              return (
                <tr key={act}>
                  <td style={stickyLbl(rowBg, LP.textDark)}>
                    {act}
                  </td>
                  {Array.from({ length: plan.cycleWeeks }, (_, wi) => {
                    const cell = cells?.[wi];
                    const ticked = cell?.ticked ?? false;
                    const hours = cell?.hours;
                    const isManual = cell?.isManual ?? false;
                    const cellBg = !ticked ? "#f0f0f0"
                      : isManual ? "#ffffff"
                      : hours != null ? "#d8f3dc"
                      : LP.amberLight;
                    const color = !ticked ? LP.textLight
                      : isManual ? LP.forest
                      : hours != null ? LP.forest
                      : LP.amber;
                    return (
                      <td key={wi}
                        style={{ ...dataC(cellBg, color), position: "relative" }}
                        onContextMenu={isManual ? (e) => {
                          e.preventDefault();
                          setContextMenu({ type: "activity", act, wi, x: e.clientX, y: e.clientY });
                        } : undefined}
                      >
                        {ticked ? (
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <input
                              type="number" min="0"
                              value={isManual ? (cell.manualHours ?? "") : (hours != null ? hours.toFixed(1) : "")}
                              onChange={e => handleCellEdit(act, wi, e.target.value)}
                              style={{ ...inpStyle, fontWeight: isManual ? 700 : 400 }}
                            />
                            {isManual && hours != null && (
                              <div style={{ fontSize: 9, color: LP.textLight, textAlign: "right", paddingRight: 6, lineHeight: 1, marginTop: -1 }}>
                                {hours.toFixed(1)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ padding: "0 6px" }}>–</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* Picking row — editable */}
            <tr>
              <td style={{ ...stickyLbl(LP.amberLight, LP.amber, `2px solid ${LP.amber}`), borderLeft: `4px solid ${LP.amber}` }}>
                ★ Picking
              </td>
              {Array.from({ length: plan.cycleWeeks }, (_, wi) => {
                const cell = plan.grid?.pickingCells?.[wi];
                const hours = cell?.hours;
                const isManual = cell?.isManual ?? false;
                const cellBg = isManual ? "#ffffff" : (hours != null ? LP.amberLight : "#f0f0f0");
                const color = isManual ? LP.forest : (hours != null ? LP.amber : LP.textLight);
                return (
                  <td key={wi}
                    style={{ ...dataC(cellBg, color, `2px solid ${LP.amber}`), position: "relative" }}
                    onContextMenu={isManual ? (e) => {
                      e.preventDefault();
                      setContextMenu({ type: "picking", wi, x: e.clientX, y: e.clientY });
                    } : undefined}
                  >
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <input
                        type="number" min="0"
                        value={isManual ? (cell.manualHours ?? "") : (hours != null ? hours.toFixed(1) : "")}
                        onChange={e => handlePickingEdit(wi, e.target.value)}
                        style={{ ...inpStyle, fontWeight: isManual ? 700 : 400 }}
                      />
                      {isManual && hours != null && (
                        <div style={{ fontSize: 9, color: LP.textLight, textAlign: "right", paddingRight: 6, lineHeight: 1, marginTop: -1 }}>
                          {hours.toFixed(1)}
                        </div>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* Pollination row — editable */}
            <tr>
              <td style={{ ...stickyLbl(LP.amberLight, LP.amber, `2px solid ${LP.amber}`), borderLeft: `4px solid ${LP.amber}` }}>
                ★ Pollination
              </td>
              {Array.from({ length: plan.cycleWeeks }, (_, wi) => {
                const cell = plan.grid?.pollinationCells?.[wi];
                const hours = cell?.hours;
                const isManual = cell?.isManual ?? false;
                const cellBg = isManual ? "#ffffff" : (hours != null ? LP.amberLight : "#f0f0f0");
                const color = isManual ? LP.forest : (hours != null ? LP.amber : LP.textLight);
                return (
                  <td key={wi}
                    style={{ ...dataC(cellBg, color, `2px solid ${LP.amber}`), position: "relative" }}
                    onContextMenu={isManual ? (e) => {
                      e.preventDefault();
                      setContextMenu({ type: "pollination", wi, x: e.clientX, y: e.clientY });
                    } : undefined}
                  >
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <input
                        type="number" min="0"
                        value={isManual ? (cell.manualHours ?? "") : (hours != null ? hours.toFixed(1) : "")}
                        onChange={e => handlePollinationEdit(wi, e.target.value)}
                        style={{ ...inpStyle, fontWeight: isManual ? 700 : 400 }}
                      />
                      {isManual && hours != null && (
                        <div style={{ fontSize: 9, color: LP.textLight, textAlign: "right", paddingRight: 6, lineHeight: 1, marginTop: -1 }}>
                          {hours.toFixed(1)}
                        </div>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* Total row — dynamic sum of manual + auto values */}
            <tr>
              <td style={{ ...stickyLbl(LP.forest, LP.white, `2px solid ${LP.mid}`), fontWeight: 800, fontSize: 12 }}>
                Total hrs / week
              </td>
              {Array.from({ length: plan.cycleWeeks }, (_, wi) => {
                const hrs = getDynamicTotal(wi);
                return (
                  <td key={wi} style={{
                    ...dataC(LP.forest, hrs > 0 ? LP.mint : "rgba(255,255,255,0.3)", `2px solid ${LP.mid}`),
                    fontWeight: hrs > 0 ? 800 : 400, fontSize: 12, padding: "0 6px",
                  }}>
                    {hrs > 0 ? hrs.toFixed(1) : "–"}
                  </td>
                );
              })}
            </tr>

          </tbody>
        </table>
      </div>

      {/* Right-click context menu */}
      {contextMenu && (
        <div style={{
          position: "fixed", zIndex: 1000,
          left: contextMenu.x, top: contextMenu.y,
          background: LP.white, border: `1px solid ${LP.border}`,
          borderRadius: 6, boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          padding: "4px 0", minWidth: 130,
        }}
          onMouseLeave={() => setContextMenu(null)}>
          <button
            onClick={() => {
              if (contextMenu.type === "activity") handleResetCell(contextMenu.act, contextMenu.wi);
              else handleResetSpecialCell(contextMenu.type, contextMenu.wi);
            }}
            style={{ display: "block", width: "100%", padding: "9px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: 13, color: LP.textDark, fontFamily: "inherit" }}>
            ↺ Reset cell
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Summary View (Step 9) ────────────────────────────────────────
function SummaryView({ greenhouses, plans, today }) {
  const WEEKS = 26;
  const weekStarts = Array.from({ length: WEEKS }, (_, i) => addDays(today, i * 7));

  const rows = [];
  for (const gh of greenhouses) {
    if (gh.splitZones) {
      rows.push({ type: "gh-header", gh });
      rows.push({ type: "zone", gh, zone: "A" });
      rows.push({ type: "zone", gh, zone: "B" });
    } else {
      rows.push({ type: "full", gh });
    }
  }

  const getCellPlan = (ghId, zone, weekStart) =>
    plans.find(p => {
      if (p.ghId !== ghId || p.zone !== zone) return false;
      const s = parseDate(p.startDate), e = planEnd(p);
      return weekStart >= s && weekStart < e;
    });

  const thStyle = {
    background: LP.forest, color: LP.white,
    padding: "4px 2px", fontSize: 9, fontWeight: 700,
    textAlign: "center", whiteSpace: "nowrap",
    position: "sticky", top: 0, zIndex: 2,
    borderLeft: "1px solid rgba(255,255,255,0.1)",
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "13px 20px", background: LP.white, borderBottom: `1px solid ${LP.border}`, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: LP.forest, fontFamily: "'Palatino Linotype', Georgia, serif" }}>
            26-Week Demand Overview
          </div>
          <div style={{ fontSize: 11, color: LP.textLight, marginTop: 2 }}>
            {fmtDate(today)} → {fmtDate(addDays(today, WEEKS * 7))} · All greenhouses
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {Object.entries(STATUS_CFG).map(([k, v]) => (
            <span key={k} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: LP.textMid }}>
              <span style={{ width: 10, height: 10, background: v.bg, border: "1px solid rgba(0,0,0,0.1)", borderRadius: 2, display: "inline-block" }} />
              {v.label}
            </span>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        <table style={{ borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 200 }} />
            {weekStarts.map((_, i) => <col key={i} style={{ width: 68 }} />)}
          </colgroup>
          <thead>
            <tr>
              <th style={{ ...thStyle, position: "sticky", left: 0, zIndex: 4, textAlign: "left", padding: "6px 12px", borderLeft: "none" }}>
                Greenhouse / Zone
              </th>
              {weekStarts.map((ws, i) => (
                <th key={i} style={thStyle}>
                  <div>W{i+1}</div>
                  <div style={{ fontSize: 7.5, color: LP.mint }}>{fmtDateShort(ws)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              if (row.type === "gh-header") {
                return (
                  <tr key={`hdr-${row.gh.id}`}>
                    <td colSpan={WEEKS + 1} style={{
                      padding: "3px 12px", fontSize: 10, fontWeight: 700,
                      color: LP.textMid, background: LP.cream,
                      borderBottom: `1px solid ${LP.border}`,
                    }}>{row.gh.name}</td>
                  </tr>
                );
              }

              const zone = row.zone || "full";
              const ghId = row.gh.id;
              const rowLabel = row.type === "zone" ? `  Zone ${row.zone}` : row.gh.name;
              const rowBg = ri % 2 === 0 ? LP.white : LP.cream;

              return (
                <tr key={`${ghId}-${zone}`}>
                  <td style={{
                    position: "sticky", left: 0, zIndex: 1,
                    padding: "0 12px",
                    fontSize: row.type === "zone" ? 10 : 11,
                    color: row.type === "zone" ? LP.textLight : LP.textDark,
                    fontWeight: row.type === "zone" ? 400 : 500,
                    background: rowBg,
                    borderBottom: `1px solid ${LP.borderLight}`,
                    height: 34, verticalAlign: "middle", whiteSpace: "nowrap",
                    overflow: "hidden", textOverflow: "ellipsis",
                    borderRight: `2px solid ${LP.border}`,
                    boxShadow: "2px 0 4px rgba(0,0,0,0.08)",
                  }}>{rowLabel}</td>
                  {weekStarts.map((ws, wi) => {
                    const p = getCellPlan(ghId, zone, ws);
                    if (!p) return (
                      <td key={wi} style={{
                        height: 34, textAlign: "center", verticalAlign: "middle",
                        background: rowBg, fontSize: 9, color: LP.textLight,
                        borderLeft: "1px solid rgba(0,0,0,0.04)",
                        borderBottom: `1px solid ${LP.borderLight}`,
                      }}>–</td>
                    );
                    const st = getPlanStatus(p, today);
                    const cfg = STATUS_CFG[st] || STATUS_CFG.draft;
                    return (
                      <td key={wi} title={`${p.cropName} — ${cfg.label}`} style={{
                        height: 34, textAlign: "center", verticalAlign: "middle",
                        background: cfg.bg, color: cfg.color,
                        fontSize: 8, fontWeight: 600,
                        borderLeft: "1px solid rgba(0,0,0,0.04)",
                        borderBottom: `1px solid ${LP.borderLight}`,
                        overflow: "hidden", padding: "0 2px",
                      }}>
                        {p.cropName.length > 9 ? p.cropName.slice(0, 8) + "…" : p.cropName}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────
const FILTERS = ["All", "No Plan", "Draft", "Past"];

export default function YearlyDemandPlanner({
  greenhouses, cropCycles, cropMasterData, activities,
  pollinationData, pickingData, lpRole,
}) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

  const [plans, setPlansRaw] = useState(loadPlans);
  const setPlans = (fn) => {
    setPlansRaw(prev => {
      const next = typeof fn === "function" ? fn(prev) : fn;
      savePlans(next); return next;
    });
  };

  const [expandedGHs, setExpandedGHs] = useState(new Set());
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const [showSummary, setShowSummary] = useState(false);

  const ghStatuses = useMemo(() =>
    Object.fromEntries(greenhouses.map(gh => [gh.id, ghOverallStatus(gh, plans, today)])),
    [greenhouses, plans, today]
  );

  const filteredGHs = greenhouses.filter(gh => matchesFilter(filter, ghStatuses[gh.id]));

  const toggleExpand = (ghId) => {
    setExpandedGHs(prev => { const n = new Set(prev); n.has(ghId) ? n.delete(ghId) : n.add(ghId); return n; });
  };

  const handleCreated = (newPlan) => {
    const grid = buildGrid(newPlan, { cropCycles, cropMasterData, greenhouses, pollinationData, pickingData, activities });
    const planWithGrid = { ...newPlan, grid };
    setPlans(prev => [...prev, planWithGrid]);
    setExpandedGHs(prev => new Set([...prev, newPlan.ghId]));
    setSelected({ type: "plan", planId: newPlan.id, ghId: newPlan.ghId, zone: newPlan.zone });
  };

  const selectedPlan = selected?.planId ? plans.find(p => p.id === selected.planId) : null;
  const selectedGH = selected?.ghId ? greenhouses.find(g => g.id === selected.ghId) : null;

  return (
    <div style={{ display: "flex", height: "calc(100vh - 148px)", borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 24px rgba(27,67,50,0.14)", border: `1px solid ${LP.border}` }}>

      {/* ── LEFT PANEL ── */}
      <div style={{ width: 290, minWidth: 290, background: LP.forest, display: "flex", flexDirection: "column", borderRight: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ color: LP.white, fontSize: 15, fontWeight: 700, fontFamily: "'Palatino Linotype', Georgia, serif", flex: 1 }}>
              Greenhouse Plans
            </div>
            <button
              onClick={() => { setShowSummary(v => !v); if (!showSummary) setSelected(null); }}
              style={{
                background: showSummary ? "rgba(255,255,255,0.18)" : "transparent",
                color: showSummary ? LP.white : "rgba(255,255,255,0.55)",
                border: `1px solid ${showSummary ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.18)"}`,
                borderRadius: 6, padding: "3px 8px", cursor: "pointer",
                fontSize: 10, fontWeight: 600, fontFamily: "inherit",
                minHeight: 26, whiteSpace: "nowrap", transition: "all 0.1s",
              }}>📊 Overview</button>
          </div>
          <div style={{ color: LP.mint, fontSize: 11 }}>
            {greenhouses.length} greenhouses · {plans.length} cycle{plans.length !== 1 ? "s" : ""} planned
          </div>
        </div>

        <div style={{ padding: "8px 10px", gap: 4, display: "flex", flexWrap: "wrap", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              background: filter === f ? "rgba(255,255,255,0.18)" : "transparent",
              color: filter === f ? LP.white : "rgba(255,255,255,0.45)",
              border: `1px solid ${filter === f ? "rgba(255,255,255,0.35)" : "transparent"}`,
              borderRadius: 12, padding: "3px 9px", cursor: "pointer",
              fontSize: 10, fontWeight: filter === f ? 700 : 400,
              minHeight: 26, fontFamily: "inherit", transition: "all 0.1s",
            }}>{f}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {filteredGHs.length === 0 && (
            <div style={{ padding: "24px 16px", color: "rgba(255,255,255,0.3)", fontSize: 12, fontStyle: "italic", textAlign: "center" }}>
              No greenhouses match filter
            </div>
          )}
          {filteredGHs.map(gh => {
            const isExp = expandedGHs.has(gh.id);
            const ghPlans = plans.filter(p => p.ghId === gh.id)
              .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
            return (
              <div key={gh.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <button onClick={() => toggleExpand(gh.id)} style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                  padding: "10px 14px",
                  background: isExp ? "rgba(255,255,255,0.08)" : "transparent",
                  border: "none", cursor: "pointer", minHeight: 48, transition: "background 0.1s",
                }}>
                  <span style={{ color: isExp ? LP.light : "rgba(255,255,255,0.35)", fontSize: 10, width: 10, flexShrink: 0 }}>
                    {isExp ? "▾" : "▸"}
                  </span>
                  <span style={{ flex: 1, textAlign: "left", color: LP.white, fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {gh.name}
                  </span>
                  <StatusBadge status={ghStatuses[gh.id]} />
                </button>
                {isExp && (
                  <div style={{ background: "rgba(0,0,0,0.18)" }}>
                    {gh.splitZones ? (
                      <>
                        <ZoneBlock label="A" gh={gh} zone="A" plans={ghPlans} today={today}
                          selected={selected}
                          setSelected={s => { setShowSummary(false); setSelected(s); }} />
                        <ZoneBlock label="B" gh={gh} zone="B" plans={ghPlans} today={today}
                          selected={selected}
                          setSelected={s => { setShowSummary(false); setSelected(s); }} />
                      </>
                    ) : (
                      <>
                        {ghPlans.filter(p => p.zone === "full").map(p => (
                          <PlanRow key={p.id} plan={p} today={today}
                            isSelected={selected?.planId === p.id}
                            onClick={() => { setShowSummary(false); setSelected({ type: "plan", planId: p.id, ghId: gh.id, zone: "full" }); }} />
                        ))}
                        <NewCycleButton onClick={() => { setShowSummary(false); setSelected({ type: "new", ghId: gh.id, zone: "full" }); }} />
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={{ flex: 1, background: LP.cream, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {showSummary ? (
          <SummaryView greenhouses={greenhouses} plans={plans} today={today} />
        ) : selected == null ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <div style={{ fontSize: 36, opacity: 0.2 }}>🏭</div>
            <div style={{ color: LP.textLight, fontSize: 15, fontStyle: "italic" }}>Select a greenhouse to view or create plans</div>
            <div style={{ color: LP.textLight, fontSize: 12 }}>Click a greenhouse on the left to expand its cycle list</div>
          </div>
        ) : selected.type === "new" ? (
          <CreatePlanForm gh={selectedGH} zone={selected.zone} plans={plans}
            cropCycles={cropCycles} onCreated={handleCreated}
            onCancel={() => setSelected(null)} />
        ) : selectedPlan ? (
          <PlanView
            plan={selectedPlan} gh={selectedGH}
            cropCycles={cropCycles} cropMasterData={cropMasterData}
            activities={activities} pollinationData={pollinationData} pickingData={pickingData}
            setPlans={setPlans} today={today}
          />
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: LP.textLight, fontStyle: "italic" }}>
            Plan not found
          </div>
        )}
      </div>
    </div>
  );
}
