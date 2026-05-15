import React, { useState, useMemo } from "react";
import { LP, lpBtn, lpInp } from "./styles";

// ─── localStorage ─────────────────────────────────────────────────
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

// ─── Status logic ──────────────────────────────────────────────────
function zoneStatus(ghId, zone, plans, today) {
  const zp = plans.filter(p => p.ghId === ghId && p.zone === zone);
  if (zp.length === 0) return "no-plan";
  const current = zp.find(p => planPosition(p, today) === "current");
  if (current) return current.state === "populated" ? "populated" : "active";
  return "draft";
}
function ghOverallStatus(gh, plans, today) {
  if (gh.splitZones) {
    const a = zoneStatus(gh.id, "A", plans, today);
    const b = zoneStatus(gh.id, "B", plans, today);
    for (const s of ["active", "populated", "draft", "no-plan"]) {
      if (a === s || b === s) return s;
    }
  }
  return zoneStatus(gh.id, "full", plans, today);
}
function matchesFilter(filter, status) {
  if (filter === "All") return true;
  const map = { "No Plan": "no-plan", Active: "active", Draft: "draft", Populated: "populated" };
  return status === (map[filter] ?? filter);
}

// ─── Status badge ──────────────────────────────────────────────────
const STATUS_CFG = {
  "no-plan":  { bg: "#D8DDD8", color: LP.textMid,     label: "No Plan"    },
  active:     { bg: LP.mint,   color: LP.forest,       label: "Active"     },
  draft:      { bg: "#E8F4FD", color: "#1565C0",       label: "Draft"      },
  populated:  { bg: LP.amberLight, color: LP.amber,    label: "Populated"  },
  past:       { bg: "#EFEFEF", color: LP.textLight,    label: "Past"       },
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

// ─── Left panel pieces ─────────────────────────────────────────────
function PlanRow({ plan, cropCycles, today, isSelected, onClick }) {
  const pos = planPosition(plan, today);
  const rowStatus = pos === "past" ? "past"
    : plan.state === "populated" ? "populated"
    : pos === "current" ? "active" : "draft";
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
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "7px 14px 7px 28px", background: "transparent",
      border: "none", color: "rgba(255,255,255,0.4)", fontSize: 11,
      cursor: "pointer", width: "100%", textAlign: "left", minHeight: 40,
    }}
      onMouseEnter={e => e.currentTarget.style.color = LP.light}
      onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.4)"}
    >
      <span style={{ fontSize: 14 }}>+</span><span>New Cycle</span>
    </button>
  );
}

function ZoneBlock({ label, gh, zone, plans, cropCycles, today, selected, setSelected }) {
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
        <PlanRow key={p.id} plan={p} cropCycles={cropCycles} today={today}
          isSelected={selected?.planId === p.id}
          onClick={() => setSelected({ type: "plan", planId: p.id, ghId: gh.id, zone })} />
      ))}
      <NewCycleButton onClick={() => setSelected({ type: "new", ghId: gh.id, zone })} />
    </div>
  );
}

// ─── Create Plan Form ──────────────────────────────────────────────
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

  // Auto-fill weeks from Crop Cycle Master
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
      state: "draft",
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
                <button onClick={() => setStartDate(toInputDate(suggestedStart))} style={{ background: "none", border: `1px solid ${LP.border}`, borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontSize: 11, color: LP.mid, fontFamily: "inherit" }}>
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
          <button onClick={handleCreate} disabled={!canCreate} style={{ ...lpBtn(canCreate, LP.forest), padding: "12px 32px", fontSize: 14, opacity: canCreate ? 1 : 0.45, cursor: canCreate ? "pointer" : "not-allowed" }}>
            Create Plan →
          </button>
          {!cropId && <div style={{ fontSize: 11, color: LP.textLight, marginTop: 8 }}>Select a crop to continue</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Plan Grid (Step 4 scaffold + Steps 5–6 activity rows) ─────────
function PlanView({ plan, gh, cropCycles, cropMasterData, plans, setPlans, today }) {
  const pos = planPosition(plan, today);
  // Locked = active (running today) or past
  const isLocked = pos === "current" || pos === "past";

  const crop = cropCycles.find(c => c.id === plan.cropId);
  const masterData = cropMasterData.find(d => d.cropId === plan.cropId);
  const masterDensity = masterData?.density || "";

  const sqm = plan.zone === "A" ? (gh?.zoneA?.sqm || "")
    : plan.zone === "B" ? (gh?.zoneB?.sqm || "")
    : (gh?.sqm || "");

  const zoneLbl = plan.zone === "A" ? " — Zone A" : plan.zone === "B" ? " — Zone B" : "";

  const status = pos === "past" ? "past"
    : pos === "current" ? "active"
    : "draft";

  // Populate condition: within 28 days of plan start
  const startObj = parseDate(plan.startDate);
  const activationDate = addDays(startObj, -28);
  const canPopulate = !isLocked && today >= activationDate;
  const populateTooltip = !canPopulate && !isLocked
    ? `Available from ${fmtDate(activationDate)}` : "";

  // Warnings
  const warnings = [];
  if (!sqm) warnings.push("Greenhouse sq metres not set — configure in Greenhouse Master");
  if (!masterDensity) warnings.push(`${plan.cropName} density not set — configure in Crop Master`);
  if (crop && Object.keys(crop.matrix || {}).length === 0)
    warnings.push(`${plan.cropName} has no ticked activities in Crop Cycle Master`);

  // Week column headers with Monday dates
  const weekHeaders = Array.from({ length: plan.cycleWeeks }, (_, i) => ({
    label: `W${i + 1}`,
    date: addDays(parseDate(plan.startDate), i * 7),
  }));

  // Density values for each week (from grid or master)
  const densityVals = Array.from({ length: plan.cycleWeeks }, (_, i) =>
    plan.grid?.densityWeeks?.[i] ?? masterDensity
  );

  // Shared styles
  const thBase = {
    background: LP.forest, color: LP.white,
    padding: "6px 3px", textAlign: "center",
    borderBottom: `2px solid ${LP.mid}`,
    borderLeft: "1px solid rgba(255,255,255,0.1)",
    position: "sticky", top: 0, zIndex: 2,
    userSelect: "none",
  };
  const stickyLabel = (bg, color, borderBottom) => ({
    position: "sticky", left: 0, zIndex: 2,
    background: bg, color,
    fontSize: 11, fontWeight: 600,
    padding: "0 12px",
    borderRight: `2px solid ${LP.mid}`,
    borderBottom: borderBottom || `1px solid ${LP.borderLight}`,
    height: 44, verticalAlign: "middle",
    whiteSpace: "nowrap",
    boxShadow: "2px 0 6px rgba(0,0,0,0.12)",
  });
  const dataCell = (bg, color, borderBottom) => ({
    textAlign: "center", height: 44, verticalAlign: "middle",
    background: bg, color,
    borderLeft: "1px solid rgba(0,0,0,0.05)",
    borderBottom: borderBottom || `1px solid ${LP.borderLight}`,
    fontSize: 12,
  });

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Header bar ── */}
      <div style={{ padding: "13px 20px", background: LP.white, borderBottom: `1px solid ${LP.border}`, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: LP.forest, fontFamily: "'Palatino Linotype', Georgia, serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {gh?.name}{zoneLbl} — {plan.cropName}
          </div>
          <div style={{ fontSize: 11, color: LP.textLight, marginTop: 2 }}>
            {fmtDate(parseDate(plan.startDate))} → {fmtDate(planEnd(plan))} · {plan.cycleWeeks} weeks
          </div>
        </div>
        <StatusBadge status={status} />

        {!isLocked && (
          <>
            <button style={{ ...lpBtn(false, LP.mid), padding: "8px 16px", minHeight: 44 }}>
              ↻ Recalculate
            </button>
            <div style={{ position: "relative" }}>
              <button
                disabled={!canPopulate}
                title={populateTooltip}
                style={{ ...lpBtn(canPopulate, LP.light), padding: "8px 18px", minHeight: 44, opacity: canPopulate ? 1 : 0.5, cursor: canPopulate ? "pointer" : "not-allowed" }}>
                {canPopulate ? "▶ Populate to Scheduler" : "🔒 Populate to Scheduler"}
              </button>
              {!canPopulate && populateTooltip && (
                <div style={{ position: "absolute", bottom: "calc(100% + 6px)", right: 0, background: LP.textDark, color: LP.white, fontSize: 11, padding: "5px 10px", borderRadius: 6, whiteSpace: "nowrap", zIndex: 10 }}>
                  {populateTooltip}
                </div>
              )}
            </div>
          </>
        )}
        {isLocked && pos === "current" && (
          <div style={{ fontSize: 12, color: LP.textLight, display: "flex", alignItems: "center", gap: 6 }}>
            <span>🔒</span><span>Active plan — read only</span>
          </div>
        )}
        {pos === "past" && (
          <div style={{ fontSize: 12, color: LP.textLight, fontStyle: "italic" }}>Historical record</div>
        )}
      </div>

      {/* ── Warning banner ── */}
      {warnings.length > 0 && (
        <div style={{ padding: "9px 20px", background: LP.amberLight, borderBottom: `2px solid ${LP.amber}`, fontSize: 12, color: LP.amber, fontWeight: 500, lineHeight: 1.6 }}>
          ⚠ {warnings.join(" · ")}
        </div>
      )}

      {/* ── Grid ── */}
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
                <th key={label} style={{ ...thBase }}>
                  <div style={{ fontSize: 10, fontWeight: 700 }}>{label}</div>
                  <div style={{ fontSize: 9, color: LP.mint, fontWeight: 400, marginTop: 1 }}>
                    {fmtDateShort(date)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>

            {/* Density row */}
            <tr>
              <td style={stickyLabel("#fff8e7", LP.amber, `2px solid ${LP.amber}`)}>
                Density (pl/m²)
              </td>
              {densityVals.map((d, i) => (
                <td key={i} style={{
                  ...dataCell("#fff8e7", LP.amber, `2px solid ${LP.amber}`),
                  fontWeight: 600,
                }}>
                  {d || "–"}
                </td>
              ))}
            </tr>

            {/* Sq metres row — read-only, constant */}
            <tr>
              <td style={stickyLabel("#F0F4F0", LP.textMid)}>
                Sq Metres (m²)
              </td>
              {Array.from({ length: plan.cycleWeeks }, (_, i) => (
                <td key={i} style={dataCell("#F0F4F0", LP.textMid)}>
                  {sqm || "–"}
                </td>
              ))}
            </tr>

            {/* Activity rows placeholder */}
            <tr>
              <td colSpan={plan.cycleWeeks + 1} style={{
                padding: "28px 20px", textAlign: "center",
                color: LP.textLight, fontSize: 13, fontStyle: "italic",
                background: LP.cream, borderBottom: `1px solid ${LP.borderLight}`,
              }}>
                Activity rows load here — completing in Steps 5 &amp; 6
              </td>
            </tr>

          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────
const FILTERS = ["All", "No Plan", "Active", "Draft", "Populated"];

export default function YearlyDemandPlanner({
  greenhouses, cropCycles, cropMasterData, activities,
  pollinationData, pickingData, lpRole,
}) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

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

  const ghStatuses = useMemo(() =>
    Object.fromEntries(greenhouses.map(gh => [gh.id, ghOverallStatus(gh, plans, today)])),
    [greenhouses, plans, today]
  );

  const filteredGHs = greenhouses.filter(gh => matchesFilter(filter, ghStatuses[gh.id]));

  const toggleExpand = (ghId) => {
    setExpandedGHs(prev => { const n = new Set(prev); n.has(ghId) ? n.delete(ghId) : n.add(ghId); return n; });
  };

  const handleCreated = (newPlan) => {
    setPlans(prev => [...prev, newPlan]);
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
          <div style={{ color: LP.white, fontSize: 15, fontWeight: 700, fontFamily: "'Palatino Linotype', Georgia, serif", marginBottom: 2 }}>Greenhouse Plans</div>
          <div style={{ color: LP.mint, fontSize: 11 }}>{greenhouses.length} greenhouses · {plans.length} cycle{plans.length !== 1 ? "s" : ""} planned</div>
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
            <div style={{ padding: "24px 16px", color: "rgba(255,255,255,0.3)", fontSize: 12, fontStyle: "italic", textAlign: "center" }}>No greenhouses match filter</div>
          )}
          {filteredGHs.map(gh => {
            const isExp = expandedGHs.has(gh.id);
            const ghPlans = plans.filter(p => p.ghId === gh.id)
              .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
            return (
              <div key={gh.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <button onClick={() => toggleExpand(gh.id)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 14px", background: isExp ? "rgba(255,255,255,0.08)" : "transparent", border: "none", cursor: "pointer", minHeight: 48, transition: "background 0.1s" }}>
                  <span style={{ color: isExp ? LP.light : "rgba(255,255,255,0.35)", fontSize: 10, width: 10, flexShrink: 0 }}>{isExp ? "▾" : "▸"}</span>
                  <span style={{ flex: 1, textAlign: "left", color: LP.white, fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{gh.name}</span>
                  <StatusBadge status={ghStatuses[gh.id]} />
                </button>
                {isExp && (
                  <div style={{ background: "rgba(0,0,0,0.18)" }}>
                    {gh.splitZones ? (
                      <>
                        <ZoneBlock label="A" gh={gh} zone="A" plans={ghPlans} cropCycles={cropCycles} today={today} selected={selected} setSelected={setSelected} />
                        <ZoneBlock label="B" gh={gh} zone="B" plans={ghPlans} cropCycles={cropCycles} today={today} selected={selected} setSelected={setSelected} />
                      </>
                    ) : (
                      <>
                        {ghPlans.filter(p => p.zone === "full").map(p => (
                          <PlanRow key={p.id} plan={p} cropCycles={cropCycles} today={today}
                            isSelected={selected?.planId === p.id}
                            onClick={() => setSelected({ type: "plan", planId: p.id, ghId: gh.id, zone: "full" })} />
                        ))}
                        <NewCycleButton onClick={() => setSelected({ type: "new", ghId: gh.id, zone: "full" })} />
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
        {selected == null ? (
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
          <PlanView plan={selectedPlan} gh={selectedGH}
            cropCycles={cropCycles} cropMasterData={cropMasterData}
            plans={plans} setPlans={setPlans} today={today} />
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: LP.textLight, fontStyle: "italic" }}>Plan not found</div>
        )}
      </div>
    </div>
  );
}
