import React, { useMemo, useState } from "react";
import { LP, lpBtn } from "./styles";

const PLANS_KEY = "ydp_plans_v1";
const ALLOC_KEY = "ws_daily_alloc_v1";
const CONFIRMED_KEY = "ws_confirmed_weeks_v1";

function loadLS(key) {
  try { return JSON.parse(localStorage.getItem(key)) || null; } catch { return null; }
}

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div style={{ background: LP.white, border: `1px solid ${LP.border}`, borderRadius: 12, padding: "16px 20px", borderTop: `4px solid ${color}` }}>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{icon} {value}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: LP.textDark, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: LP.textLight, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function MiniBar({ pct, color, height = 8 }) {
  return (
    <div style={{ height, background: LP.borderLight, borderRadius: 4, overflow: "hidden", flex: 1 }}>
      <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 4, transition: "width 0.4s" }} />
    </div>
  );
}

// Inline sparkline (SVG bars)
function Sparkline({ values, color = LP.light, height = 40 }) {
  const max = Math.max(...values, 1);
  const w = 6;
  const gap = 2;
  const totalW = values.length * (w + gap) - gap;
  return (
    <svg width={totalW} height={height} style={{ display: "block" }}>
      {values.map((v, i) => {
        const barH = max > 0 ? Math.max((v / max) * (height - 2), v > 0 ? 2 : 0) : 0;
        return (
          <rect key={i} x={i * (w + gap)} y={height - barH} width={w} height={barH}
            rx={2} fill={v > 0 ? color : LP.borderLight} />
        );
      })}
    </svg>
  );
}

// Static sample variance chart for the "Reports" section
function SampleVarianceChart() {
  const weeks = Array.from({ length: 12 }, (_, i) => i + 1);
  const planned = [120, 130, 140, 145, 150, 148, 155, 160, 158, 145, 130, 120];
  const actual  = [115, 128, 138, 150, 155, 140, 158, 162, 150, 148, 125, 118];
  const maxV = Math.max(...planned, ...actual);
  const W = 480, H = 160, PAD = 30;
  const xScale = (i) => PAD + (i / (weeks.length - 1)) * (W - 2 * PAD);
  const yScale = (v) => H - PAD - (v / maxV) * (H - 2 * PAD);
  const plannedPath = planned.map((v, i) => `${i === 0 ? "M" : "L"}${xScale(i)},${yScale(v)}`).join(" ");
  const actualPath  = actual.map((v, i) => `${i === 0 ? "M" : "L"}${xScale(i)},${yScale(v)}`).join(" ");
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", maxWidth: "100%" }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const y = H - PAD - t * (H - 2 * PAD);
        return <line key={t} x1={PAD} y1={y} x2={W - PAD} y2={y} stroke={LP.borderLight} strokeWidth={1} />;
      })}
      {/* Planned */}
      <path d={plannedPath} fill="none" stroke={LP.forest} strokeWidth={2} strokeDasharray="6,3" />
      {/* Actual */}
      <path d={actualPath} fill="none" stroke={LP.light} strokeWidth={2.5} />
      {/* Variance fill */}
      {weeks.map((_, i) => {
        if (i === weeks.length - 1) return null;
        const over = actual[i] > planned[i];
        return (
          <polygon key={i}
            points={`${xScale(i)},${yScale(planned[i])} ${xScale(i)},${yScale(actual[i])} ${xScale(i+1)},${yScale(actual[i+1])} ${xScale(i+1)},${yScale(planned[i+1])}`}
            fill={over ? "#d1fae5" : "#fee2e2"} opacity={0.5} />
        );
      })}
      {/* Week labels */}
      {weeks.map((w, i) => (i % 3 === 0 &&
        <text key={i} x={xScale(i)} y={H - 6} textAnchor="middle" fontSize={9} fill={LP.textLight}>W{w}</text>
      ))}
      {/* Legend */}
      <line x1={W-130} y1={12} x2={W-110} y2={12} stroke={LP.forest} strokeWidth={2} strokeDasharray="4,2"/>
      <text x={W-106} y={16} fontSize={9} fill={LP.forest}>Planned</text>
      <line x1={W-60} y1={12} x2={W-40} y2={12} stroke={LP.light} strokeWidth={2}/>
      <text x={W-36} y={16} fontSize={9} fill={LP.light}>Actual</text>
    </svg>
  );
}

export default function LPDashboard({
  cropCycles, cropMasterData, greenhouses, pollinationData, pickingData, activities,
}) {
  const [varTab, setVarTab] = useState("table");

  const ydpPlans = useMemo(() => loadLS(PLANS_KEY) || [], []);
  const dailyAllocation = useMemo(() => loadLS(ALLOC_KEY) || {}, []);
  const confirmedWeeks = useMemo(() => loadLS(CONFIRMED_KEY) || {}, []);

  // ── Data completeness ──────────────────────────────────────────────
  const completeness = useMemo(() => cropCycles.map(cyc => {
    const masterRow = cropMasterData.find(d => d.cropId === cyc.id);
    const pickRow = pickingData.find(d => d.cropId === cyc.id);
    const hasDensity = !!(masterRow?.density);
    const hasActivities = activities.some(a => masterRow?.cells?.[a]?.h);
    const hasPicking = !!(pickRow?.kgPerHour && pickRow?.roundsPerWeek);
    const hasCycle = Object.keys(cyc.matrix || {}).length > 0;
    const score = [hasDensity, hasActivities, hasPicking, hasCycle].filter(Boolean).length;
    return { name: cyc.name, hasDensity, hasActivities, hasPicking, hasCycle, score, pct: Math.round(score / 4 * 100) };
  }), [cropCycles, cropMasterData, pickingData, activities]);

  // ── GH / plan counts ──────────────────────────────────────────────
  const activePlans = ydpPlans.filter(p => {
    const start = new Date(p.startDate);
    const end = new Date(start); end.setDate(end.getDate() + p.cycleWeeks * 7);
    const now = new Date();
    return start <= now && end >= now;
  });
  const futurePlans = ydpPlans.filter(p => new Date(p.startDate) > new Date());
  const totalConfirmedWeeks = Object.keys(confirmedWeeks).length;

  // ── Demand overview (total hrs/week across all active plans) ───────
  const demandByWeek = useMemo(() => {
    const map = {};
    ydpPlans.forEach(plan => {
      const N = plan.cycleWeeks || 0;
      for (let wi = 0; wi < N; wi++) {
        const hrs = plan.grid?.totalHrsPerWeek?.[wi] || 0;
        const key = `${plan.startDate}__${wi}`;
        map[key] = (map[key] || 0) + hrs;
      }
    });
    return Object.values(map).slice(0, 52);
  }, [ydpPlans]);

  // ── Variance analysis ──────────────────────────────────────────────
  const variances = useMemo(() => {
    return ydpPlans.map(plan => {
      const rows = [];
      for (let wi = 0; wi < (plan.cycleWeeks || 0); wi++) {
        const key = `${plan.id}__w${wi}`;
        const isConfirmed = !!confirmedWeeks[key];
        const planned = plan.grid?.totalHrsPerWeek?.[wi] || 0;
        const alloc = dailyAllocation[key] || {};
        const actual = Object.values(alloc).reduce((sum, dayMap) =>
          sum + (typeof dayMap === "object" ? Object.values(dayMap).reduce((s, h) => s + (parseFloat(h) || 0), 0) : 0), 0);
        if (planned > 0 || actual > 0) {
          rows.push({ wi, planned: Math.round(planned * 10) / 10, actual: Math.round(actual * 10) / 10, diff: Math.round((actual - planned) * 10) / 10, isConfirmed });
        }
      }
      return { plan, rows };
    }).filter(p => p.rows.length > 0);
  }, [ydpPlans, dailyAllocation, confirmedWeeks]);

  const totalPlanned = variances.reduce((s, v) => s + v.rows.reduce((rs, r) => rs + r.planned, 0), 0);
  const totalActual = variances.reduce((s, v) => s + v.rows.reduce((rs, r) => rs + r.actual, 0), 0);
  const totalDiff = totalActual - totalPlanned;
  const confirmedRows = variances.flatMap(v => v.rows.filter(r => r.isConfirmed));
  const avgAcc = confirmedRows.length > 0
    ? Math.round(confirmedRows.reduce((s, r) => s + (r.planned > 0 ? Math.min(r.actual / r.planned, 2) : 1), 0) / confirmedRows.length * 100)
    : null;

  // ── Pollination completeness per GH ───────────────────────────────
  const ghsWithPoll = greenhouses.filter(gh => {
    const row = pollinationData.find(d => d.ghId === gh.id);
    return row?.hoursPerRound && row?.roundsPerWeek;
  });

  return (
    <div style={{ padding: "0 0 24px" }}>

      {/* ── Header ── */}
      <div style={{ background: LP.forest, padding: "16px 24px", borderRadius: "0 0 12px 12px", marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: LP.white, fontFamily: "'Palatino Linotype', Georgia, serif" }}>
          Labour Planner — Dashboard
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>
          Overview of data completeness, active plans, and variance against YDP baseline
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 14, marginBottom: 20, padding: "0 4px" }}>
        <StatCard label="Crop Cycles" value={cropCycles.length} icon="🌱" color={LP.mid} sub={`${completeness.filter(c => c.pct === 100).length} fully configured`} />
        <StatCard label="Greenhouses" value={greenhouses.length} icon="🏗️" color={LP.forest} sub={`${ghsWithPoll.length} with pollination data`} />
        <StatCard label="Active Plans" value={activePlans.length} icon="📋" color="#0369a1" sub={`${futurePlans.length} upcoming`} />
        <StatCard label="Confirmed Weeks" value={totalConfirmedWeeks} icon="✅" color="#16a34a" sub="locked demand weeks" />
        {avgAcc !== null && <StatCard label="Planning Accuracy" value={`${avgAcc}%`} icon="🎯" color={avgAcc >= 90 ? LP.light : avgAcc >= 75 ? LP.amber : LP.red} sub="confirmed vs YDP plan" />}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20, padding: "0 4px" }}>

        {/* ── Data completeness ── */}
        <div style={{ background: LP.white, border: `1px solid ${LP.border}`, borderRadius: 12, padding: "16px 20px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: LP.forest, marginBottom: 12 }}>🔍 Crop Data Completeness</div>
          {completeness.length === 0 && <div style={{ color: LP.textLight, fontSize: 12, fontStyle: "italic" }}>No crop cycles configured yet.</div>}
          {completeness.map(c => (
            <div key={c.name} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: LP.textDark }}>{c.name}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: c.pct === 100 ? LP.light : c.pct >= 50 ? LP.amber : LP.red }}>{c.pct}%</span>
              </div>
              <MiniBar pct={c.pct} color={c.pct === 100 ? LP.light : c.pct >= 50 ? LP.amber : LP.red} />
              <div style={{ display: "flex", gap: 8, marginTop: 4, fontSize: 10, color: LP.textLight }}>
                {[["Density", c.hasDensity], ["Activities", c.hasActivities], ["Picking", c.hasPicking], ["Cycle", c.hasCycle]].map(([l, ok]) => (
                  <span key={l} style={{ color: ok ? LP.light : LP.red }}>{ok ? "✓" : "✗"} {l}</span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── Demand sparkline ── */}
        <div style={{ background: LP.white, border: `1px solid ${LP.border}`, borderRadius: 12, padding: "16px 20px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: LP.forest, marginBottom: 8 }}>📈 Weekly Demand Profile (All Plans)</div>
          {demandByWeek.length === 0
            ? <div style={{ color: LP.textLight, fontSize: 12, fontStyle: "italic" }}>No YDP data populated yet. Build plans in Yearly Demand Planner and click Populate.</div>
            : <>
              <Sparkline values={demandByWeek} color={LP.light} height={60} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: LP.textLight, marginTop: 4 }}>
                <span>Wk 1</span>
                <span>Total: <strong style={{ color: LP.forest }}>{Math.round(demandByWeek.reduce((s, v) => s + v, 0)).toLocaleString()} hrs</strong></span>
                <span>Wk {demandByWeek.length}</span>
              </div>
            </>
          }
          {/* Active plan list */}
          <div style={{ marginTop: 14, borderTop: `1px solid ${LP.borderLight}`, paddingTop: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: LP.textMid, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Active & Upcoming Plans</div>
            {[...activePlans, ...futurePlans].slice(0, 6).map(p => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: LP.textMid, padding: "3px 0", borderBottom: `1px solid ${LP.borderLight}` }}>
                <span style={{ fontWeight: 600, color: LP.textDark }}>{p.cropName}</span>
                <span>{fmtDate(p.startDate)} — {p.cycleWeeks}wk</span>
                <span style={{ background: activePlans.includes(p) ? "#d1fae5" : "#e0f2fe", color: activePlans.includes(p) ? "#065f46" : "#0369a1", padding: "1px 6px", borderRadius: 8, fontWeight: 700, fontSize: 10 }}>
                  {activePlans.includes(p) ? "ACTIVE" : "UPCOMING"}
                </span>
              </div>
            ))}
            {ydpPlans.length === 0 && <div style={{ color: LP.textLight, fontSize: 11, fontStyle: "italic" }}>No plans configured.</div>}
          </div>
        </div>
      </div>

      {/* ── Variance Analysis ── */}
      <div style={{ background: LP.white, border: `1px solid ${LP.border}`, borderRadius: 12, padding: "16px 20px", marginBottom: 20, padding: "0 4px" }}>
        <div style={{ padding: "16px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: LP.forest }}>📊 Variance Analysis — YDP Baseline vs Confirmed Demand</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[{id:"table",label:"Table"},{id:"reports",label:"📈 Reports (Sample)"}].map(t=>(
                <button key={t.id} onClick={()=>setVarTab(t.id)} style={{ ...lpBtn(varTab===t.id, LP.mid), padding: "5px 14px", fontSize: 12, minHeight: 32 }}>{t.label}</button>
              ))}
            </div>
          </div>

          {/* Summary row */}
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", padding: "10px 0 14px", borderBottom: `1px solid ${LP.borderLight}`, fontSize: 13 }}>
            <span>YDP Planned: <strong style={{ color: LP.forest }}>{Math.round(totalPlanned).toLocaleString()} hrs</strong></span>
            <span>Confirmed: <strong style={{ color: "#0369a1" }}>{Math.round(totalActual).toLocaleString()} hrs</strong></span>
            <span>Net variance: <strong style={{ color: totalDiff > 0 ? LP.amber : totalDiff < 0 ? LP.red : LP.light }}>{totalDiff > 0 ? "+" : ""}{Math.round(totalDiff).toLocaleString()} hrs</strong></span>
            {avgAcc !== null && <span>Accuracy: <strong style={{ color: avgAcc >= 90 ? LP.light : avgAcc >= 75 ? LP.amber : LP.red }}>{avgAcc}%</strong></span>}
          </div>
        </div>

        {varTab === "table" && (
          <div style={{ overflowX: "auto", padding: "0 20px 16px" }}>
            {variances.length === 0 && (
              <div style={{ padding: "20px 0", color: LP.textLight, fontStyle: "italic", fontSize: 13 }}>
                No variance data yet — populate plans from the Yearly Demand Planner and confirm weeks in the Demand tab.
              </div>
            )}
            {variances.map(({ plan, rows }) => (
              <div key={plan.id} style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: LP.forest, marginBottom: 6 }}>
                  {plan.cropName} — {fmtDate(plan.startDate)} ({plan.cycleWeeks} weeks)
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: LP.cream }}>
                      <th style={{ padding: "5px 10px", textAlign: "center", color: LP.textMid, borderBottom: `1px solid ${LP.border}` }}>Week</th>
                      <th style={{ padding: "5px 10px", textAlign: "right", color: LP.textMid, borderBottom: `1px solid ${LP.border}` }}>YDP Planned</th>
                      <th style={{ padding: "5px 10px", textAlign: "right", color: LP.textMid, borderBottom: `1px solid ${LP.border}` }}>Confirmed</th>
                      <th style={{ padding: "5px 10px", textAlign: "right", color: LP.textMid, borderBottom: `1px solid ${LP.border}` }}>Variance</th>
                      <th style={{ padding: "5px 10px", textAlign: "center", color: LP.textMid, borderBottom: `1px solid ${LP.border}` }}>Status</th>
                      <th style={{ padding: "5px 10px", textAlign: "left", color: LP.textMid, borderBottom: `1px solid ${LP.border}`, width: "30%" }}>Bar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => {
                      const pct = r.planned > 0 ? Math.round(r.actual / r.planned * 100) : null;
                      const diffColor = r.diff > 5 ? LP.amber : r.diff < -5 ? LP.red : LP.light;
                      return (
                        <tr key={r.wi} style={{ borderBottom: `1px solid ${LP.borderLight}`, background: r.isConfirmed ? "#f0fff4" : "white" }}>
                          <td style={{ padding: "5px 10px", textAlign: "center", fontWeight: 700, color: LP.forest }}>W{r.wi + 1}</td>
                          <td style={{ padding: "5px 10px", textAlign: "right", color: LP.textMid }}>{r.planned}h</td>
                          <td style={{ padding: "5px 10px", textAlign: "right", color: "#0369a1", fontWeight: r.isConfirmed ? 700 : 400 }}>{r.actual > 0 ? `${r.actual}h` : "—"}</td>
                          <td style={{ padding: "5px 10px", textAlign: "right", fontWeight: 700, color: diffColor }}>{r.diff !== 0 ? `${r.diff > 0 ? "+" : ""}${r.diff}h` : "—"}</td>
                          <td style={{ padding: "5px 10px", textAlign: "center" }}>
                            {r.isConfirmed
                              ? <span style={{ background: "#d1fae5", color: "#065f46", padding: "1px 7px", borderRadius: 8, fontSize: 10, fontWeight: 700 }}>Confirmed</span>
                              : <span style={{ background: LP.cream, color: LP.textLight, padding: "1px 7px", borderRadius: 8, fontSize: 10 }}>Unconfirmed</span>}
                          </td>
                          <td style={{ padding: "5px 10px" }}>
                            {r.planned > 0 && (
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <MiniBar pct={pct || 0} color={diffColor} height={6} />
                                {pct !== null && <span style={{ fontSize: 10, color: LP.textLight, whiteSpace: "nowrap" }}>{pct}%</span>}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {varTab === "reports" && (
          <div style={{ padding: "16px 20px" }}>
            <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8, padding: "8px 14px", marginBottom: 16, fontSize: 12, color: "#92400e" }}>
              ⚠️ <strong>SAMPLE — Static Example.</strong> Active AI-generated narrative reports require an ongoing LLM connection to this application. Contact your system administrator to enable this feature.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Weekly sample */}
              <div style={{ border: `1px solid ${LP.border}`, borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: LP.forest, marginBottom: 10 }}>📅 Weekly Variance Report — SAMPLE</div>
                <SampleVarianceChart />
                <div style={{ fontSize: 11, color: LP.textLight, marginTop: 8, lineHeight: 1.5 }}>
                  <span style={{ color: LP.forest, fontWeight: 700 }}>— — Planned</span> &nbsp;
                  <span style={{ color: LP.light, fontWeight: 700 }}>——&nbsp; Actual</span> &nbsp;
                  <span style={{ background: "#d1fae5", padding: "1px 6px", borderRadius: 4 }}>Green = over plan</span> &nbsp;
                  <span style={{ background: "#fee2e2", padding: "1px 6px", borderRadius: 4 }}>Red = under plan</span>
                </div>
              </div>

              {/* Monthly sample */}
              <div style={{ border: `1px solid ${LP.border}`, borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: LP.forest, marginBottom: 10 }}>📆 Monthly Summary — SAMPLE</div>
                {["Jan","Feb","Mar","Apr"].map((m,i) => {
                  const plan = [480,510,560,540][i];
                  const act  = [465,525,545,558][i];
                  const diff = act - plan;
                  return (
                    <div key={m} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                        <strong style={{ color: LP.textDark }}>{m}</strong>
                        <span style={{ color: diff >= 0 ? LP.amber : LP.red, fontWeight: 700 }}>{diff >= 0 ? "+" : ""}{diff}h</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <MiniBar pct={Math.round(act/plan*100)} color={Math.abs(diff)<20?LP.light:diff>0?LP.amber:LP.red} height={10} />
                        <span style={{ fontSize: 10, color: LP.textLight, whiteSpace: "nowrap" }}>{Math.round(act/plan*100)}%</span>
                      </div>
                      <div style={{ fontSize: 10, color: LP.textLight, marginTop: 1 }}>Planned {plan}h · Confirmed {act}h</div>
                    </div>
                  );
                })}
                <div style={{ marginTop: 12, padding: "8px 10px", background: LP.cream, borderRadius: 8, fontSize: 11, color: LP.textMid }}>
                  💡 <em>AI narrative: "February slightly over baseline (+15h) driven by additional picking rounds. March under target (−15h) likely due to 2 absence days. Recommend reviewing picking master frequency for Q2."</em>
                  <div style={{ marginTop: 4, color: LP.textLight, fontSize: 10 }}>— This section is generated by LLM when connected. Currently shown as static sample.</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Alerts ── */}
      {(completeness.filter(c => c.pct < 100).length > 0 || ghsWithPoll.length < greenhouses.length) && (
        <div style={{ background: LP.white, border: `1px solid ${LP.border}`, borderRadius: 12, padding: "14px 20px", margin: "0 4px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: LP.red, marginBottom: 8 }}>⚠️ Data Gaps</div>
          {completeness.filter(c => c.pct < 100).map(c => (
            <div key={c.name} style={{ fontSize: 12, color: LP.textMid, padding: "3px 0" }}>
              🌱 <strong>{c.name}</strong>: missing {[!c.hasDensity&&"density",!c.hasActivities&&"activity hours",!c.hasPicking&&"picking rate",!c.hasCycle&&"cycle matrix"].filter(Boolean).join(", ")}
            </div>
          ))}
          {greenhouses.filter(gh => !ghsWithPoll.find(g => g.id === gh.id)).map(gh => (
            <div key={gh.id} style={{ fontSize: 12, color: LP.textMid, padding: "3px 0" }}>
              🏗️ <strong>{gh.name}</strong>: pollination data not set
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
