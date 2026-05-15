import React, { useState } from "react";
import { LP, lpBtn, lpInp } from "./styles";

// Picking and Pollination are excluded from density cascade
const DENSITY_EXCLUDED = ["Picking", "Pollination"];

function isTicked(crop, act, wi) {
  return !!(crop?.matrix?.[`${act}|||${wi}`]);
}

function getCell(cells, act) {
  return cells?.[act] ?? { h: "", t: "", weeks: null };
}

function getEffective(actCell, wi) {
  const w = actCell.weeks?.[wi];
  if (w != null) return { h: w.h ?? actCell.h, t: w.t ?? actCell.t, source: w.manual ? "manual" : "forward" };
  return { h: actCell.h, t: actCell.t, source: "master" };
}

// forward-fill from week idx when user sets a value manually
function applyForwardFill(weeks, numWeeks, idx, newH, newT) {
  const result = weeks ? [...weeks] : Array(numWeeks).fill(null);
  while (result.length < numWeeks) result.push(null);
  result[idx] = { h: newH, t: newT, manual: true };
  for (let i = idx + 1; i < numWeeks; i++) {
    if (result[i]?.manual) break;
    result[i] = { h: newH, t: newT, manual: false };
  }
  return result;
}

function cellStyle(source, isStandard) {
  if (source === "manual") return { background: LP.white, fontStyle: "normal", color: LP.textDark };
  if (source === "forward") return { background: LP.cellAutoFill, fontStyle: "italic", color: LP.textMid };
  if (isStandard) return { background: "#d8f3dc", fontStyle: "normal", color: LP.forest };
  return { background: "#f0f0f0", fontStyle: "normal", color: LP.textLight };
}

export default function CropMaster({ cropCycles, activities, cropMasterData, setCropMasterData, lpRole }) {
  const [selId, setSelId] = useState(() => cropCycles[0]?.id ?? null);
  const [isEditing, setIsEditing] = useState(false);
  const [editCell, setEditCell] = useState(null); // { act, wi }
  const isGM = lpRole === "gm";

  const crop = cropCycles.find(c => c.id === selId);
  const data = cropMasterData.find(d => d.cropId === selId) ?? { cropId: selId, density: "", cells: {} };

  const mutate = (fn) => {
    setCropMasterData(prev => {
      const idx = prev.findIndex(d => d.cropId === selId);
      if (idx === -1) return [...prev, fn({ cropId: selId, density: "", cells: {} })];
      const next = [...prev];
      next[idx] = fn(next[idx]);
      return next;
    });
  };

  const setMasterRate = (act, field, val) => {
    mutate(d => {
      const cell = { ...(d.cells[act] ?? { h: "", t: "", weeks: null }), [field]: val };
      // if not density-excluded, cascade master rate to all "master" sourced weeks
      if (!DENSITY_EXCLUDED.includes(act) && field === "h" && cell.weeks) {
        cell.weeks = cell.weeks.map(w => (w == null || (!w.manual && w.source !== "forward")) ? null : w);
      }
      return { ...d, cells: { ...d.cells, [act]: cell } };
    });
  };

  const setWeekCell = (act, wi, newH, newT) => {
    mutate(d => {
      const actCell = d.cells[act] ?? { h: "", t: "", weeks: null };
      const weeks = applyForwardFill(actCell.weeks, crop.weeks, wi, newH, newT);
      return { ...d, cells: { ...d.cells, [act]: { ...actCell, weeks } } };
    });
  };

  const resetToMaster = (act) => {
    mutate(d => {
      const actCell = d.cells[act] ?? { h: "", t: "", weeks: null };
      return { ...d, cells: { ...d.cells, [act]: { ...actCell, weeks: null } } };
    });
  };

  const thS = {
    background: LP.forest, color: LP.white,
    padding: "9px 4px", fontSize: 10, fontWeight: 700,
    textAlign: "center", letterSpacing: 0.3,
    borderBottom: `2px solid ${LP.mid}`,
    borderLeft: "1px solid rgba(255,255,255,0.1)",
    position: "sticky", top: 0, zIndex: 2,
    userSelect: "none",
  };

  const configuredCount = activities.filter(a => {
    const c = data.cells[a];
    return c?.h || c?.t;
  }).length;

  return (
    <div style={{
      display: "flex", gap: 0,
      height: "calc(100vh - 148px)",
      borderRadius: 12, overflow: "hidden",
      boxShadow: "0 4px 24px rgba(27,67,50,0.14)",
    }}>
      {/* Left panel */}
      <div style={{ width: 220, minWidth: 220, background: LP.forest, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 3 }}>Crop Types</div>
          <div style={{ color: LP.mint, fontSize: 12 }}>{cropCycles.length} configured</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {cropCycles.map(c => {
            const d = cropMasterData.find(x => x.cropId === c.id);
            const cnt = d ? Object.values(d.cells).filter(cell => cell.h || cell.t).length : 0;
            return (
              <button key={c.id} onClick={() => { setSelId(c.id); setIsEditing(false); setEditCell(null); }} style={{
                display: "block", width: "100%", textAlign: "left", padding: "11px 16px",
                background: selId === c.id ? "rgba(255,255,255,0.13)" : "transparent",
                borderLeft: `3px solid ${selId === c.id ? LP.light : "transparent"}`,
                border: "none", color: selId === c.id ? LP.white : "rgba(255,255,255,0.65)",
                cursor: "pointer", fontSize: 13, fontWeight: selId === c.id ? 600 : 400,
                transition: "all 0.12s", minHeight: 44,
              }}>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.38)", marginTop: 2 }}>
                  {cnt ? `${cnt} activities set` : "Not configured"}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right panel */}
      {crop ? (
        <div style={{ flex: 1, background: LP.cream, display: "flex", flexDirection: "column", border: `1px solid ${LP.border}`, borderLeft: "none", overflow: "hidden" }}>
          {/* Header */}
          <div style={{ padding: "13px 20px", background: LP.white, borderBottom: `1px solid ${LP.border}`, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, flex: 1, fontSize: 19, color: LP.forest, fontFamily: "'Palatino Linotype', Georgia, serif", fontWeight: 700 }}>{crop.name}</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: LP.textMid }}>Plant density:</span>
              {isEditing
                ? <input type="number" min="0" step="0.1" value={data.density}
                    onChange={e => mutate(d => ({ ...d, density: e.target.value }))}
                    placeholder="plants/m²"
                    style={{ ...lpInp, width: 120, padding: "6px 10px", minHeight: 36 }} />
                : <span style={{ fontWeight: 700, color: LP.mid, fontSize: 16 }}>
                    {data.density ? `${data.density} pl/m²` : <em style={{ color: LP.textLight, fontSize: 13, fontWeight: 400 }}>Not set</em>}
                  </span>
              }
            </div>
            {isGM && (
              <button onClick={() => { setIsEditing(v => !v); setEditCell(null); }}
                style={{ ...lpBtn(isEditing, isEditing ? LP.amber : LP.mid), padding: "9px 20px" }}>
                {isEditing ? "💾 Save" : "✏️ Edit"}
              </button>
            )}
          </div>

          {/* Legend */}
          <div style={{ padding: "7px 20px", background: "#EDF4EE", borderBottom: `1px solid ${LP.borderLight}`, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: LP.textMid, textTransform: "uppercase" }}>Cell states:</span>
            {[
              { bg: "#d8f3dc", label: "Standard week (active in cycle)", style: "normal" },
              { bg: "#f0f0f0", label: "Non-standard week", style: "normal" },
              { bg: LP.cellAutoFill, label: "Auto-filled (forward-propagated)", style: "italic" },
              { bg: LP.white, label: "Manually entered", style: "normal", border: `1px solid ${LP.border}` },
            ].map(({ bg, label, style, border }) => (
              <span key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: LP.textMid }}>
                <span style={{ width: 14, height: 14, background: bg, border: border || "1px solid rgba(0,0,0,0.08)", borderRadius: 2, display: "inline-block" }} />
                <em style={{ fontStyle: style }}>{label}</em>
              </span>
            ))}
          </div>

          {/* Grid */}
          <div style={{ flex: 1, overflow: "auto" }}>
            <table style={{ borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: 190 }} />
                <col style={{ width: 72 }} />
                <col style={{ width: 72 }} />
                {Array.from({ length: crop.weeks }, (_, i) => <col key={i} style={{ width: 56, minWidth: 56 }} />)}
                <col style={{ width: 80 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ ...thS, position: "sticky", left: 0, zIndex: 4, textAlign: "left", padding: "9px 12px", borderLeft: "none" }}>Activity</th>
                  <th style={{ ...thS, fontSize: 9 }}>Master<br />hrs/m²</th>
                  <th style={{ ...thS, fontSize: 9 }}>Master<br />×/wk</th>
                  {Array.from({ length: crop.weeks }, (_, i) => (
                    <th key={i} style={{ ...thS, fontSize: 10 }}>W{i + 1}</th>
                  ))}
                  <th style={{ ...thS, fontSize: 9 }}>Reset</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((act, ai) => {
                  const actCell = getCell(data.cells, act);
                  const excluded = DENSITY_EXCLUDED.includes(act);
                  const rowBg = ai % 2 === 0 ? LP.white : "#F5F8F5";
                  return (
                    <tr key={act}>
                      <td style={{
                        position: "sticky", left: 0, zIndex: 1,
                        background: rowBg, padding: "0 10px", fontSize: 12,
                        color: LP.textDark, fontWeight: 500,
                        borderRight: `2px solid ${LP.border}`,
                        borderBottom: `1px solid ${LP.borderLight}`,
                        height: 44, verticalAlign: "middle",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        maxWidth: 190, boxShadow: "2px 0 4px rgba(0,0,0,0.05)",
                      }}>
                        {excluded && <span title="Excluded from density cascade" style={{ color: LP.amber, fontSize: 9, marginRight: 4 }}>★</span>}
                        {act}
                      </td>
                      {/* Master rate inputs */}
                      <td style={{ textAlign: "center", background: rowBg, borderBottom: `1px solid ${LP.borderLight}`, padding: "4px 4px" }}>
                        {isEditing
                          ? <input type="number" min="0" step="0.01" value={actCell.h}
                              onChange={e => setMasterRate(act, "h", e.target.value)}
                              style={{ width: 56, padding: "4px 4px", border: `1px solid ${LP.border}`, borderRadius: 4, fontSize: 11, textAlign: "center", fontFamily: "inherit" }} />
                          : <span style={{ fontSize: 12, fontWeight: actCell.h ? 700 : 400, color: actCell.h ? LP.textDark : LP.textLight }}>{actCell.h || "–"}</span>
                        }
                      </td>
                      <td style={{ textAlign: "center", background: rowBg, borderBottom: `1px solid ${LP.borderLight}`, padding: "4px 4px" }}>
                        {isEditing
                          ? <input type="number" min="0" step="1" value={actCell.t}
                              onChange={e => setMasterRate(act, "t", e.target.value)}
                              style={{ width: 48, padding: "4px 4px", border: `1px solid ${LP.border}`, borderRadius: 4, fontSize: 11, textAlign: "center", fontFamily: "inherit" }} />
                          : <span style={{ fontSize: 12, fontWeight: actCell.t ? 700 : 400, color: actCell.t ? LP.textDark : LP.textLight }}>{actCell.t || "–"}</span>
                        }
                      </td>
                      {/* Week cells */}
                      {Array.from({ length: crop.weeks }, (_, wi) => {
                        const isStd = isTicked(crop, act, wi);
                        const eff = getEffective(actCell, wi);
                        const cs = cellStyle(eff.source, isStd);
                        const isActive = editCell?.act === act && editCell?.wi === wi && isEditing;
                        return (
                          <td key={wi}
                            onClick={() => isEditing && setEditCell(isActive ? null : { act, wi })}
                            style={{
                              width: 56, height: 44, background: cs.background,
                              borderLeft: "1px solid rgba(0,0,0,0.06)",
                              borderBottom: `1px solid ${LP.borderLight}`,
                              cursor: isEditing ? "pointer" : "default",
                              verticalAlign: "middle", textAlign: "center",
                              outline: isActive ? `2px solid ${LP.amber}` : "none",
                              transition: "background 0.1s",
                            }}>
                            {isActive ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: 2 }}>
                                <input type="number" min="0" step="0.01"
                                  autoFocus
                                  defaultValue={eff.h}
                                  onBlur={e => setWeekCell(act, wi, e.target.value, eff.t)}
                                  style={{ width: "100%", padding: "2px 2px", border: `1px solid ${LP.mid}`, borderRadius: 3, fontSize: 10, textAlign: "center", fontFamily: "inherit" }} />
                                <input type="number" min="0" step="1"
                                  defaultValue={eff.t}
                                  onBlur={e => setWeekCell(act, wi, eff.h, e.target.value)}
                                  style={{ width: "100%", padding: "2px 2px", border: `1px solid ${LP.mid}`, borderRadius: 3, fontSize: 10, textAlign: "center", fontFamily: "inherit" }} />
                              </div>
                            ) : (
                              <div style={{ fontSize: 10, lineHeight: 1.3 }}>
                                <div style={{ color: cs.color, fontStyle: cs.fontStyle, fontWeight: eff.source === "manual" ? 700 : 400 }}>
                                  {eff.h || (isStd ? "·" : "")}
                                </div>
                                {eff.t && <div style={{ color: LP.textLight, fontSize: 9, fontStyle: cs.fontStyle }}>×{eff.t}</div>}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      {/* Reset button */}
                      <td style={{ textAlign: "center", background: rowBg, borderBottom: `1px solid ${LP.borderLight}`, padding: "4px" }}>
                        {isEditing && actCell.weeks && (
                          <button onClick={() => resetToMaster(act)} title="Reset all week overrides to master"
                            style={{ background: "none", border: `1px solid ${LP.border}`, borderRadius: 4, cursor: "pointer", color: LP.textMid, fontSize: 10, padding: "3px 6px", fontFamily: "inherit" }}>
                            ↺ reset
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ padding: "8px 20px", background: LP.white, borderTop: `1px solid ${LP.borderLight}`, fontSize: 11, color: LP.textLight }}>
            ★ = Picking &amp; Pollination are excluded from density cascade · {configuredCount} of {activities.length} activities configured
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: LP.textLight, fontSize: 15, background: LP.cream, fontStyle: "italic" }}>
          Select a crop to configure activity rates
        </div>
      )}
    </div>
  );
}
