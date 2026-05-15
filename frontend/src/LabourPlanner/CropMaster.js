import React, { useState } from "react";
import { LP, lpBtn, lpInp } from "./styles";

const HIDDEN_FROM_CROP_MASTER = ["Picking", "Pollination"];
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

// Forward-fill for the density row
function applyDensityFF(densityWeeks, numWeeks, idx, newValue) {
  const result = densityWeeks ? [...densityWeeks] : Array(numWeeks).fill(null);
  while (result.length < numWeeks) result.push(null);
  result[idx] = { value: newValue, manual: true };
  for (let i = idx + 1; i < numWeeks; i++) {
    if (result[i]?.manual) break;
    result[i] = { value: newValue, manual: false };
  }
  return result;
}

function getDensityForWeek(data, wi) {
  const dw = data.densityWeeks;
  if (dw && wi < dw.length && dw[wi] != null) {
    return { value: dw[wi].value, source: dw[wi].manual ? "manual" : "forward" };
  }
  return { value: data.density ?? "", source: "master" };
}

function cellStyle(source, isStandard) {
  if (source === "manual") return { background: LP.white, fontStyle: "normal", color: LP.textDark, fontWeight: 700 };
  if (source === "forward") return { background: LP.cellAutoFill, fontStyle: "italic", color: LP.textMid };
  if (isStandard) return { background: "#d8f3dc", fontStyle: "normal", color: LP.forest };
  return { background: "#f0f0f0", fontStyle: "normal", color: LP.textLight };
}

export default function CropMaster({ cropCycles, activities, cropMasterData, setCropMasterData, lpRole }) {
  const [selId, setSelId] = useState(() => cropCycles[0]?.id ?? null);
  const [isEditing, setIsEditing] = useState(false);
  const [editCell, setEditCell] = useState(null); // { act, wi } — act can be "__density__"
  const isGM = lpRole === "gm";

  const crop = cropCycles.find(c => c.id === selId);
  const data = cropMasterData.find(d => d.cropId === selId)
    ?? { cropId: selId, density: "", densityWeeks: null, cells: {} };

  const mutate = (fn) => {
    setCropMasterData(prev => {
      const idx = prev.findIndex(d => d.cropId === selId);
      if (idx === -1) return [...prev, fn({ cropId: selId, density: "", densityWeeks: null, cells: {} })];
      const next = [...prev];
      next[idx] = fn(next[idx]);
      return next;
    });
  };

  const setMasterRate = (act, field, val) => {
    mutate(d => {
      const cell = { ...(d.cells[act] ?? { h: "", t: "", weeks: null }), [field]: val };
      if (!DENSITY_EXCLUDED.includes(act) && field === "h" && cell.weeks) {
        cell.weeks = cell.weeks.map(w => (w == null || !w.manual) ? null : w);
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

  const setDensityWeek = (wi, newValue) => {
    mutate(d => ({
      ...d,
      densityWeeks: applyDensityFF(d.densityWeeks, crop.weeks, wi, newValue),
    }));
  };

  const resetDensity = () => mutate(d => ({ ...d, densityWeeks: null }));

  const thS = {
    background: LP.forest, color: LP.white,
    padding: "9px 4px", fontSize: 10, fontWeight: 700,
    textAlign: "center", letterSpacing: 0.3,
    borderBottom: `2px solid ${LP.mid}`,
    borderLeft: "1px solid rgba(255,255,255,0.1)",
    position: "sticky", top: 0, zIndex: 2,
    userSelect: "none",
  };

  const visibleActivities = activities.filter(a => !HIDDEN_FROM_CROP_MASTER.includes(a));
  const configuredCount = visibleActivities.filter(a => {
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
                  {d?.density ? ` · ${d.density} pl/m²` : ""}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right panel */}
      {crop ? (
        <div style={{ flex: 1, background: LP.cream, display: "flex", flexDirection: "column", border: `1px solid ${LP.border}`, borderLeft: "none", overflow: "hidden" }}>

          {/* Header — no density field here anymore */}
          <div style={{ padding: "13px 20px", background: LP.white, borderBottom: `1px solid ${LP.border}`, display: "flex", alignItems: "center", gap: 12 }}>
            <h2 style={{ margin: 0, flex: 1, fontSize: 19, color: LP.forest, fontFamily: "'Palatino Linotype', Georgia, serif", fontWeight: 700 }}>{crop.name}</h2>
            <span style={{ fontSize: 12, color: LP.textLight }}>{configuredCount} of {visibleActivities.length} activities configured</span>
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
              { bg: "#d8f3dc", label: "Standard week (active in cycle)" },
              { bg: "#f0f0f0", label: "Non-standard week" },
              { bg: LP.cellAutoFill, label: "Auto-filled / forward-propagated", italic: true },
              { bg: LP.white, label: "Manually entered", bold: true, border: `1px solid ${LP.border}` },
            ].map(({ bg, label, italic, bold, border }) => (
              <span key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: LP.textMid }}>
                <span style={{ width: 14, height: 14, background: bg, border: border || "1px solid rgba(0,0,0,0.08)", borderRadius: 2, display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontStyle: italic ? "italic" : "normal", fontWeight: bold ? 700 : 400 }}>{label}</span>
              </span>
            ))}
            <span style={{ fontSize: 11, color: LP.amber }}>★ = follows own master, not density-adjusted</span>
          </div>

          {/* Grid */}
          <div style={{ flex: 1, overflow: "auto" }}>
            <table style={{ borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: 190 }} />
                <col style={{ width: 72 }} />
                <col style={{ width: 72 }} />
                {Array.from({ length: crop.weeks }, () => null).map((_, i) => (
                  <col key={i} style={{ width: 56, minWidth: 56 }} />
                ))}
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

                {/* ── DENSITY ROW (first) ── */}
                <tr>
                  <td style={{
                    position: "sticky", left: 0, zIndex: 1,
                    background: "#fff8e7",
                    padding: "0 10px", fontSize: 12,
                    color: LP.amber, fontWeight: 700,
                    borderRight: `2px solid ${LP.border}`,
                    borderBottom: `2px solid ${LP.amber}`,
                    height: 44, verticalAlign: "middle",
                    whiteSpace: "nowrap",
                    boxShadow: "2px 0 4px rgba(0,0,0,0.05)",
                  }}>
                    Density (pl/m²)
                  </td>

                  {/* Master density value */}
                  <td style={{ textAlign: "center", background: "#fff8e7", borderBottom: `2px solid ${LP.amber}`, padding: "4px" }}>
                    {isEditing
                      ? <input type="number" min="0" step="0.1"
                          value={data.density ?? ""}
                          onChange={e => mutate(d => ({ ...d, density: e.target.value }))}
                          style={{ width: 56, padding: "4px", border: `1px solid ${LP.amber}`, borderRadius: 4, fontSize: 11, textAlign: "center", fontFamily: "inherit" }} />
                      : <span style={{ fontSize: 12, fontWeight: data.density ? 700 : 400, color: data.density ? LP.amber : LP.textLight }}>
                          {data.density || "–"}
                        </span>
                    }
                  </td>

                  {/* Empty second master col */}
                  <td style={{ background: "#fff8e7", borderBottom: `2px solid ${LP.amber}` }} />

                  {/* Per-week density cells */}
                  {Array.from({ length: crop.weeks }, (_, wi) => {
                    const dv = getDensityForWeek(data, wi);
                    const bg = dv.source === "manual" ? LP.white : LP.cellAutoFill;
                    const isActive = editCell?.act === "__density__" && editCell?.wi === wi && isEditing;
                    return (
                      <td key={wi}
                        onClick={() => isEditing && setEditCell(isActive ? null : { act: "__density__", wi })}
                        style={{
                          width: 56, height: 44,
                          background: isActive ? LP.white : bg,
                          borderLeft: "1px solid rgba(0,0,0,0.06)",
                          borderBottom: `2px solid ${LP.amber}`,
                          cursor: isEditing ? "pointer" : "default",
                          verticalAlign: "middle", textAlign: "center",
                          outline: isActive ? `2px solid ${LP.amber}` : "none",
                        }}>
                        {isActive ? (
                          <input type="number" min="0" step="0.1"
                            autoFocus
                            defaultValue={dv.value}
                            onBlur={e => { setDensityWeek(wi, e.target.value); setEditCell(null); }}
                            style={{ width: "90%", padding: "3px 2px", border: `1px solid ${LP.amber}`, borderRadius: 3, fontSize: 11, textAlign: "center", fontFamily: "inherit" }} />
                        ) : (
                          <span style={{
                            fontSize: 11,
                            fontWeight: dv.source === "manual" ? 700 : 400,
                            color: dv.source === "manual" ? LP.amber : LP.textMid,
                            fontStyle: dv.source === "forward" ? "italic" : "normal",
                          }}>
                            {dv.value || "–"}
                          </span>
                        )}
                      </td>
                    );
                  })}

                  {/* Reset density */}
                  <td style={{ textAlign: "center", background: "#fff8e7", borderBottom: `2px solid ${LP.amber}`, padding: "4px" }}>
                    {isEditing && data.densityWeeks && (
                      <button onClick={resetDensity} title="Reset all weeks to master density"
                        style={{ background: "none", border: `1px solid ${LP.amber}`, borderRadius: 4, cursor: "pointer", color: LP.amber, fontSize: 10, padding: "3px 6px", fontFamily: "inherit" }}>
                        ↺ reset
                      </button>
                    )}
                  </td>
                </tr>

                {/* ── ACTIVITY ROWS ── */}
                {visibleActivities.map((act, ai) => {
                  const actCell = getCell(data.cells, act);
                  const excluded = DENSITY_EXCLUDED.includes(act);
                  const rowBg = ai % 2 === 0 ? LP.white : "#F5F8F5";
                  const masterDensity = parseFloat(data.density) || 0;

                  return (
                    <tr key={act}>
                      <td style={{
                        position: "sticky", left: 0, zIndex: 1,
                        background: rowBg, padding: "0 10px", fontSize: 12,
                        color: LP.textDark, fontWeight: 500,
                        borderRight: `2px solid ${LP.border}`,
                        borderBottom: `1px solid ${LP.borderLight}`,
                        borderLeft: excluded ? `3px solid ${LP.amber}` : "none",
                        height: 44, verticalAlign: "middle",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        maxWidth: 190, boxShadow: "2px 0 4px rgba(0,0,0,0.05)",
                      }}>
                        {excluded && (
                          <span title="Follows own master — not density-adjusted" style={{ color: LP.amber, fontSize: 9, marginRight: 4 }}>★</span>
                        )}
                        {act}
                      </td>

                      {/* Master hrs/m² */}
                      <td style={{ textAlign: "center", background: rowBg, borderBottom: `1px solid ${LP.borderLight}`, padding: "4px" }}>
                        {isEditing
                          ? <input type="number" min="0" step="0.01" value={actCell.h}
                              onChange={e => setMasterRate(act, "h", e.target.value)}
                              style={{ width: 56, padding: "4px", border: `1px solid ${LP.border}`, borderRadius: 4, fontSize: 11, textAlign: "center", fontFamily: "inherit" }} />
                          : <span style={{ fontSize: 12, fontWeight: actCell.h ? 700 : 400, color: actCell.h ? LP.textDark : LP.textLight }}>{actCell.h || "–"}</span>
                        }
                      </td>

                      {/* Master ×/wk */}
                      <td style={{ textAlign: "center", background: rowBg, borderBottom: `1px solid ${LP.borderLight}`, padding: "4px" }}>
                        {isEditing
                          ? <input type="number" min="0" step="1" value={actCell.t}
                              onChange={e => setMasterRate(act, "t", e.target.value)}
                              style={{ width: 48, padding: "4px", border: `1px solid ${LP.border}`, borderRadius: 4, fontSize: 11, textAlign: "center", fontFamily: "inherit" }} />
                          : <span style={{ fontSize: 12, fontWeight: actCell.t ? 700 : 400, color: actCell.t ? LP.textDark : LP.textLight }}>{actCell.t || "–"}</span>
                        }
                      </td>

                      {/* Week cells */}
                      {Array.from({ length: crop.weeks }, (_, wi) => {
                        const isStd = isTicked(crop, act, wi);
                        const eff = getEffective(actCell, wi);

                        // Density-adjusted display value (non-excluded, non-manual cells only)
                        let displayH = eff.h;
                        if (!excluded && eff.source !== "manual" && masterDensity > 0 && eff.h) {
                          const weekD = getDensityForWeek(data, wi);
                          const wkDensity = parseFloat(weekD.value) || masterDensity;
                          if (wkDensity !== masterDensity) {
                            displayH = (parseFloat(eff.h) * (wkDensity / masterDensity)).toFixed(3);
                          }
                        }

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
                                  style={{ width: "100%", padding: "2px", border: `1px solid ${LP.mid}`, borderRadius: 3, fontSize: 10, textAlign: "center", fontFamily: "inherit" }} />
                                <input type="number" min="0" step="1"
                                  defaultValue={eff.t}
                                  onBlur={e => setWeekCell(act, wi, eff.h, e.target.value)}
                                  style={{ width: "100%", padding: "2px", border: `1px solid ${LP.mid}`, borderRadius: 3, fontSize: 10, textAlign: "center", fontFamily: "inherit" }} />
                              </div>
                            ) : (() => {
                              const h = parseFloat(displayH);
                              const t = parseFloat(eff.t);
                              const product = h > 0 && t > 0 ? String(parseFloat((h * t).toFixed(5))) : null;
                              return (
                                <div style={{ fontSize: 10, lineHeight: 1.3 }}>
                                  <div style={{ color: cs.color, fontStyle: cs.fontStyle, fontWeight: eff.source === "manual" ? 700 : 400 }}>
                                    {product ?? (displayH || (isStd ? "·" : ""))}
                                  </div>
                                  {product
                                    ? <div style={{ color: LP.textLight, fontSize: 8 }}>h/m²/wk</div>
                                    : eff.t && <div style={{ color: LP.textLight, fontSize: 9, fontStyle: cs.fontStyle }}>×{eff.t}</div>
                                  }
                                </div>
                              );
                            })()}
                          </td>
                        );
                      })}

                      {/* Reset row */}
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
            {configuredCount} of {visibleActivities.length} activities configured · Click a week cell to edit that week and forward-fill
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
