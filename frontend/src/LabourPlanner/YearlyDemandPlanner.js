import React, { useState, useMemo } from "react";
import { LP, lpBtn } from "./styles";

// ─── localStorage ────────────────────────────────────────────────
const PLANS_KEY = "ydp_plans_v1";

function loadPlans() {
  try { return JSON.parse(localStorage.getItem(PLANS_KEY)) || []; }
  catch { return []; }
}
function savePlans(plans) {
  localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
}

// ─── Date helpers ─────────────────────────────────────────────────
function parseDate(str) {
  // returns a Date at midnight local time
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function planEnd(plan) {
  return addDays(parseDate(plan.startDate), plan.cycleWeeks * 7);
}

function fmtDate(d) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

function fmtDateRange(plan) {
  const s = parseDate(plan.startDate);
  const e = planEnd(plan);
  return `${fmtDate(s)} → ${fmtDate(e)}`;
}

// "past" | "current" | "future" relative to today
function planPosition(plan, today) {
  const s = parseDate(plan.startDate);
  const e = planEnd(plan);
  if (e < today) return "past";
  if (s > today) return "future";
  return "current";
}

// ─── Status logic ─────────────────────────────────────────────────
// For a specific zone ("full" | "A" | "B")
function zoneStatus(ghId, zone, plans, today) {
  const zp = plans.filter(p => p.ghId === ghId && p.zone === zone);
  if (zp.length === 0) return "no-plan";
  const current = zp.find(p => planPosition(p, today) === "current");
  if (current) return current.state === "populated" ? "populated" : "active";
  // has plans but none is current
  return "draft";
}

// Overall GH badge (worst-case across zones)
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

// ─── Small components ─────────────────────────────────────────────
const STATUS_CFG = {
  "no-plan":  { bg: "#D8DDD8", color: LP.textMid,  label: "No Plan"   },
  active:     { bg: LP.mint,   color: LP.forest,   label: "Active"    },
  draft:      { bg: "#E8F4FD", color: "#1565C0",   label: "Draft"     },
  populated:  { bg: LP.amberLight, color: LP.amber, label: "Populated" },
};

function StatusBadge({ status, small }) {
  const c = STATUS_CFG[status] || STATUS_CFG["no-plan"];
  return (
    <span style={{
      background: c.bg, color: c.color,
      fontSize: small ? 9 : 10, fontWeight: 700,
      padding: small ? "1px 6px" : "2px 8px",
      borderRadius: 10, letterSpacing: 0.3, whiteSpace: "nowrap",
      flexShrink: 0,
    }}>{c.label}</span>
  );
}

function PlanRow({ plan, cropCycles, today, isSelected, onClick }) {
  const pos = planPosition(plan, today);
  const crop = cropCycles.find(c => c.id === plan.cropId);
  const cropName = plan.cropName || crop?.name || "Unknown crop";

  const rowStyle = {
    display: "flex", alignItems: "center", gap: 6,
    padding: "7px 14px 7px 28px",
    cursor: "pointer",
    background: isSelected ? "rgba(82,183,136,0.18)" : "transparent",
    borderLeft: pos === "current"
      ? `3px solid ${LP.light}`
      : `3px solid transparent`,
    borderBottom: "1px solid rgba(255,255,255,0.04)",
    minHeight: 44,
    transition: "background 0.1s",
  };

  const nameStyle = {
    flex: 1, textAlign: "left",
    color: pos === "past"
      ? "rgba(255,255,255,0.35)"
      : pos === "future"
        ? "rgba(255,255,255,0.6)"
        : LP.white,
    fontSize: 11,
    fontWeight: pos === "current" ? 600 : 400,
    fontStyle: pos === "past" ? "italic" : "normal",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  };

  return (
    <button onClick={onClick} style={{ ...rowStyle, border: "none", width: "100%" }}>
      <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
        <div style={nameStyle}>{cropName}</div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>
          {fmtDateRange(plan)}
          {pos === "current" && " ← current"}
          {pos === "future" && " ← planned"}
        </div>
      </div>
      <StatusBadge status={plan.state === "populated" ? "populated" : pos === "current" ? "active" : "draft"} small />
    </button>
  );
}

function NewCycleButton({ onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "7px 14px 7px 28px",
      background: "transparent", border: "none",
      color: "rgba(255,255,255,0.45)", fontSize: 11,
      cursor: "pointer", width: "100%", textAlign: "left",
      minHeight: 40,
      transition: "color 0.1s",
    }}
      onMouseEnter={e => e.currentTarget.style.color = LP.light}
      onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.45)"}
    >
      <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
      <span>New Cycle</span>
    </button>
  );
}

function ZoneBlock({ label, gh, zone, plans, cropCycles, today, selected, setSelected }) {
  const zonePlans = plans.filter(p => p.zone === zone).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  return (
    <div>
      <div style={{
        padding: "4px 14px 4px 28px",
        fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
        color: "rgba(255,255,255,0.35)", textTransform: "uppercase",
        background: "rgba(0,0,0,0.1)", borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}>
        Zone {label}
      </div>
      {zonePlans.map(p => (
        <PlanRow key={p.id} plan={p} cropCycles={cropCycles} today={today}
          isSelected={selected?.planId === p.id}
          onClick={() => setSelected({ type: "plan", planId: p.id, ghId: gh.id, zone })} />
      ))}
      <NewCycleButton onClick={() => setSelected({ type: "new", ghId: gh.id, zone })} />
    </div>
  );
}

const FILTERS = ["All", "No Plan", "Active", "Draft", "Populated"];

// ─── Main component ───────────────────────────────────────────────
export default function YearlyDemandPlanner({
  greenhouses, cropCycles, cropMasterData, activities,
  pollinationData, pickingData, lpRole,
}) {
  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);

  const [plans, setPlansRaw] = useState(loadPlans);
  const setPlans = (fn) => {
    setPlansRaw(prev => {
      const next = typeof fn === "function" ? fn(prev) : fn;
      savePlans(next);
      return next;
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
    setExpandedGHs(prev => {
      const n = new Set(prev);
      n.has(ghId) ? n.delete(ghId) : n.add(ghId);
      return n;
    });
  };

  return (
    <div style={{
      display: "flex", height: "calc(100vh - 148px)",
      borderRadius: 12, overflow: "hidden",
      boxShadow: "0 4px 24px rgba(27,67,50,0.14)",
      border: `1px solid ${LP.border}`,
    }}>

      {/* ── LEFT PANEL ─────────────────────────────────────── */}
      <div style={{
        width: 290, minWidth: 290, background: LP.forest,
        display: "flex", flexDirection: "column",
        borderRight: "1px solid rgba(255,255,255,0.1)",
      }}>

        {/* Title */}
        <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{
            color: LP.white, fontSize: 15, fontWeight: 700,
            fontFamily: "'Palatino Linotype', Georgia, serif", marginBottom: 2,
          }}>Greenhouse Plans</div>
          <div style={{ color: LP.mint, fontSize: 11 }}>
            {greenhouses.length} greenhouses ·{" "}
            {plans.length} cycle{plans.length !== 1 ? "s" : ""} planned
          </div>
        </div>

        {/* Filter chips */}
        <div style={{
          padding: "8px 10px", gap: 4, display: "flex", flexWrap: "wrap",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              background: filter === f ? "rgba(255,255,255,0.18)" : "transparent",
              color: filter === f ? LP.white : "rgba(255,255,255,0.45)",
              border: `1px solid ${filter === f ? "rgba(255,255,255,0.35)" : "transparent"}`,
              borderRadius: 12, padding: "3px 9px",
              cursor: "pointer", fontSize: 10,
              fontWeight: filter === f ? 700 : 400,
              minHeight: 26, fontFamily: "inherit",
              transition: "all 0.1s",
            }}>{f}</button>
          ))}
        </div>

        {/* GH list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {filteredGHs.length === 0 && (
            <div style={{ padding: "24px 16px", color: "rgba(255,255,255,0.3)", fontSize: 12, fontStyle: "italic", textAlign: "center" }}>
              No greenhouses match filter
            </div>
          )}
          {filteredGHs.map(gh => {
            const isExp = expandedGHs.has(gh.id);
            const status = ghStatuses[gh.id];
            const ghPlans = plans
              .filter(p => p.ghId === gh.id)
              .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

            return (
              <div key={gh.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {/* GH header row */}
                <button
                  onClick={() => toggleExpand(gh.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    width: "100%", padding: "10px 14px",
                    background: isExp ? "rgba(255,255,255,0.08)" : "transparent",
                    border: "none", cursor: "pointer", minHeight: 48,
                    transition: "background 0.1s",
                  }}>
                  <span style={{ color: isExp ? LP.light : "rgba(255,255,255,0.35)", fontSize: 10, width: 10, flexShrink: 0 }}>
                    {isExp ? "▾" : "▸"}
                  </span>
                  <span style={{
                    flex: 1, textAlign: "left", color: LP.white,
                    fontSize: 12, fontWeight: 600,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {gh.name}
                  </span>
                  <StatusBadge status={status} />
                </button>

                {/* Expanded content */}
                {isExp && (
                  <div style={{ background: "rgba(0,0,0,0.18)" }}>
                    {gh.splitZones ? (
                      <>
                        <ZoneBlock label="A" gh={gh} zone="A"
                          plans={ghPlans} cropCycles={cropCycles} today={today}
                          selected={selected} setSelected={setSelected} />
                        <ZoneBlock label="B" gh={gh} zone="B"
                          plans={ghPlans} cropCycles={cropCycles} today={today}
                          selected={selected} setSelected={setSelected} />
                      </>
                    ) : (
                      <>
                        {ghPlans.filter(p => p.zone === "full").map(p => (
                          <PlanRow key={p.id} plan={p}
                            cropCycles={cropCycles} today={today}
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

      {/* ── RIGHT PANEL (placeholder — Steps 3–9) ─────────── */}
      <div style={{
        flex: 1, background: LP.cream,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {selected == null ? (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 12,
          }}>
            <div style={{ fontSize: 32, opacity: 0.3 }}>🏭</div>
            <div style={{ color: LP.textLight, fontSize: 15, fontStyle: "italic" }}>
              Select a greenhouse to view or create plans
            </div>
            <div style={{ color: LP.textLight, fontSize: 12 }}>
              Click a greenhouse name on the left to expand its cycle list
            </div>
          </div>
        ) : selected.type === "new" ? (
          <div style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            color: LP.textLight, fontSize: 14, fontStyle: "italic",
          }}>
            Create New Plan — coming in Step 3
          </div>
        ) : (
          <div style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            color: LP.textLight, fontSize: 14, fontStyle: "italic",
          }}>
            Plan grid — coming in Steps 4–7
          </div>
        )}
      </div>
    </div>
  );
}
