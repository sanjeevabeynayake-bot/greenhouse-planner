import React, { useState } from "react";
import { LP, lpBtn, lpInp } from "./styles";

// Inclusive bell curve: start and end weeks both get non-zero volume.
// Zero-crossing is shifted one step before start and one step after end.
function bellCurve(start, peakWeek, peakVol, end, totalWeeks) {
  const s = parseInt(start) - 1;
  const p = parseInt(peakWeek) - 1;
  const e = parseInt(end) - 1;
  const peak = parseFloat(peakVol);
  if ([s, p, e, peak].some(v => isNaN(v))) return null;
  if (s < 0 || e >= totalWeeks || s > p || p > e) return null;
  const vols = Array(totalWeeks).fill("0");
  for (let w = s; w <= e; w++) {
    let v;
    if (w <= p) {
      // zero-crossing at s-1, peak at p
      const t = (p === s) ? 1 : (w - s + 1) / (p - s + 1);
      v = peak * Math.pow(Math.sin((Math.PI / 2) * t), 2);
    } else {
      // peak at p, zero-crossing at e+1
      const t = (p === e) ? 0 : (w - p) / (e - p + 1);
      v = peak * Math.pow(Math.cos((Math.PI / 2) * t), 2);
    }
    vols[w] = String(Math.max(1, Math.round(v)));
  }
  return vols;
}

export default function PickingMaster({ pickingData, setPickingData, cropCycles, lpRole }) {
  const [selId, setSelId] = useState(() => cropCycles[0]?.id ?? null);
  const [isEditing, setIsEditing] = useState(false);
  const isGM = lpRole === "gm";

  const crop = cropCycles.find(c => c.id === selId);
  const data = pickingData.find(d => d.cropId === selId);

  const mutate = (fn) =>
    setPickingData(prev => prev.map(d => d.cropId === selId ? fn(d) : d));

  const applyCurve = () => {
    if (!data || !crop) return;
    const { start, peakWeek, peak, end } = data.curveParams;
    const vols = bellCurve(start, peakWeek, peak, end, crop.weeks);
    if (vols) mutate(d => ({ ...d, weeklyVolumes: vols }));
    else alert(`Invalid weeks. Needs: start week ≤ peak week ≤ end week, all between 1 and ${crop.weeks}.`);
  };

  const totalVol = data ? data.weeklyVolumes.reduce((s, v) => s + (parseFloat(v) || 0), 0) : 0;
  const maxVol = data ? Math.max(...data.weeklyVolumes.map(v => parseFloat(v) || 0), 1) : 1;

  const kgPerHour = parseFloat(data?.kgPerHour) || 0;
  const totalHrs = kgPerHour > 0 ? totalVol / kgPerHour : null;

  const hrsPerSqm = parseFloat(data?.hrsPerSqm) || 0;
  const roundsPerWeek = parseFloat(data?.roundsPerWeek) || 0;
  const areaRate = hrsPerSqm > 0 && roundsPerWeek > 0 ? (hrsPerSqm * roundsPerWeek).toFixed(3) : null;

  const Sparkline = () => (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 64, padding: "4px 0 0" }}>
      {(data?.weeklyVolumes ?? []).map((v, i) => {
        const val = parseFloat(v) || 0;
        const h = maxVol > 0 ? Math.max(Math.round((val / maxVol) * 58), val > 0 ? 2 : 0) : 0;
        return (
          <div key={i} title={`Week ${i + 1}: ${val.toLocaleString()} kg`} style={{
            flex: 1, height: h,
            background: val > 0 ? (val >= maxVol * 0.85 ? LP.mid : LP.light) : LP.borderLight,
            borderRadius: "2px 2px 0 0", minWidth: 2, transition: "height 0.3s",
          }} />
        );
      })}
    </div>
  );

  return (
    <div style={{
      display: "flex", gap: 0,
      height: "calc(100vh - 148px)",
      borderRadius: 12, overflow: "hidden",
      boxShadow: "0 4px 24px rgba(27,67,50,0.14)",
    }}>
      {/* Left panel — crop list */}
      <div style={{ width: 220, minWidth: 220, background: LP.forest, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 3 }}>Crop Types</div>
          <div style={{ color: LP.mint, fontSize: 12 }}>{cropCycles.length} configured</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {cropCycles.map(c => {
            const d = pickingData.find(x => x.cropId === c.id);
            const vol = d ? d.weeklyVolumes.reduce((s, v) => s + (parseFloat(v) || 0), 0) : 0;
            const kph = parseFloat(d?.kgPerHour) || 0;
            return (
              <button key={c.id} onClick={() => { setSelId(c.id); setIsEditing(false); }} style={{
                display: "block", width: "100%", textAlign: "left", padding: "11px 16px",
                background: selId === c.id ? "rgba(255,255,255,0.13)" : "transparent",
                borderLeft: `3px solid ${selId === c.id ? LP.light : "transparent"}`,
                border: "none", color: selId === c.id ? LP.white : "rgba(255,255,255,0.65)",
                cursor: "pointer", fontSize: 13, fontWeight: selId === c.id ? 600 : 400,
                transition: "all 0.12s", minHeight: 44,
              }}>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.38)", marginTop: 2 }}>
                  {kph > 0 ? `${kph} kg/hr` : "Rate not set"}
                  {vol > 0 ? ` · ${vol.toLocaleString()} kg` : ""}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right panel */}
      {data && crop ? (
        <div style={{ flex: 1, background: LP.cream, display: "flex", flexDirection: "column", border: `1px solid ${LP.border}`, borderLeft: "none", overflow: "hidden" }}>

          {/* Header — rate fields */}
          <div style={{ padding: "13px 20px", background: LP.white, borderBottom: `1px solid ${LP.border}`, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, flex: 1, fontSize: 18, color: LP.forest, fontFamily: "'Palatino Linotype', Georgia, serif", fontWeight: 700 }}>{crop.name}</h2>

            {/* Option A — Volume-based (used for YDP) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 14px", background: "#d8f3dc", borderRadius: 8, border: `1px solid ${LP.light}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: LP.forest, textTransform: "uppercase", letterSpacing: 0.5 }}>Option A — Volume-based (used for hours)</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: LP.textMid, whiteSpace: "nowrap" }}>kg / hour:</span>
                {isEditing
                  ? <input type="number" min="0" step="1" value={data.kgPerHour ?? ""}
                      onChange={e => mutate(d => ({ ...d, kgPerHour: e.target.value }))}
                      placeholder="e.g. 80"
                      style={{ ...lpInp, width: 90, padding: "4px 8px", minHeight: 32 }} />
                  : <span style={{ fontWeight: 700, color: LP.mid, fontSize: 15 }}>
                      {data.kgPerHour ? `${data.kgPerHour} kg/hr` : <em style={{ color: LP.textLight, fontSize: 12, fontWeight: 400 }}>Not set</em>}
                    </span>
                }
                {totalHrs !== null && (
                  <span style={{ marginLeft: 6, background: LP.forest, color: LP.white, fontWeight: 800, fontSize: 13, padding: "4px 12px", borderRadius: 16 }}>
                    ≈ {totalHrs.toFixed(0)} hrs total
                  </span>
                )}
              </div>
            </div>

            {/* Option B — Area-based (entry only, for future daily plan) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 14px", background: "#fff9ee", borderRadius: 8, border: `1px solid ${LP.amber}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: LP.amber, textTransform: "uppercase", letterSpacing: 0.5 }}>Option B — Area-based (for daily planning)</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: LP.textMid, whiteSpace: "nowrap" }}>hrs/m²/round:</span>
                {isEditing
                  ? <input type="number" min="0" step="0.001" value={data.hrsPerSqm ?? ""}
                      onChange={e => mutate(d => ({ ...d, hrsPerSqm: e.target.value }))}
                      placeholder="0.000"
                      style={{ ...lpInp, width: 80, padding: "4px 8px", minHeight: 32 }} />
                  : <span style={{ fontWeight: 600, color: LP.textDark, fontSize: 13 }}>
                      {data.hrsPerSqm || <em style={{ color: LP.textLight, fontSize: 12, fontWeight: 400 }}>—</em>}
                    </span>
                }
                <span style={{ fontSize: 12, color: LP.textMid, whiteSpace: "nowrap" }}>rounds/wk:</span>
                {isEditing
                  ? <input type="number" min="0" step="1" value={data.roundsPerWeek ?? ""}
                      onChange={e => mutate(d => ({ ...d, roundsPerWeek: e.target.value }))}
                      placeholder="0"
                      style={{ ...lpInp, width: 60, padding: "4px 8px", minHeight: 32 }} />
                  : <span style={{ fontWeight: 600, color: LP.textDark, fontSize: 13 }}>
                      {data.roundsPerWeek ? `${data.roundsPerWeek}×` : <em style={{ color: LP.textLight, fontSize: 12, fontWeight: 400 }}>—</em>}
                    </span>
                }
                {areaRate && (
                  <span style={{ background: "#fff3cd", color: LP.amber, fontWeight: 700, fontSize: 12, padding: "3px 10px", borderRadius: 12 }}>
                    = {areaRate} hrs/m²/wk
                  </span>
                )}
              </div>
            </div>

            {isGM && (
              <button onClick={() => setIsEditing(v => !v)} style={{ ...lpBtn(isEditing, isEditing ? LP.amber : LP.mid), padding: "9px 20px" }}>
                {isEditing ? "💾 Save" : "✏️ Edit"}
              </button>
            )}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Bell curve generator */}
            <div style={{ background: LP.white, borderRadius: 10, padding: 18, border: `1px solid ${LP.border}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: LP.textMid, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Bell Curve Generator — Weekly Volumes (kg)</div>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                {[
                  { key: "start",    label: "Start week",    placeholder: `1–${crop.weeks}` },
                  { key: "peakWeek", label: "Peak week",     placeholder: `1–${crop.weeks}` },
                  { key: "peak",     label: "Peak vol (kg)", placeholder: "kg" },
                  { key: "end",      label: "End week",      placeholder: `1–${crop.weeks}` },
                ].map(({ key, label, placeholder }) => (
                  <div key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: 11, color: LP.textMid, fontWeight: 600 }}>{label}</label>
                    <input type="number" min="1" value={data.curveParams[key]}
                      onChange={e => mutate(d => ({ ...d, curveParams: { ...d.curveParams, [key]: e.target.value } }))}
                      placeholder={placeholder}
                      style={{ ...lpInp, width: 110, padding: "6px 10px", minHeight: 36 }} />
                  </div>
                ))}
                <button onClick={applyCurve} style={{ ...lpBtn(true, LP.mid), padding: "9px 20px", alignSelf: "flex-end" }}>
                  ↻ Generate
                </button>
              </div>
              <div style={{ fontSize: 11, color: LP.textLight, marginTop: 8, fontStyle: "italic" }}>
                Start and end weeks are inclusive — both will show non-zero volume. Peak vol appears at peak week. Edit individual weeks freely after generating.
              </div>
            </div>

            {/* Sparkline + summary */}
            <div style={{ background: LP.white, borderRadius: 10, padding: 18, border: `1px solid ${LP.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: LP.textMid, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Volume profile — {crop.weeks} weeks
                </div>
                <div style={{ display: "flex", gap: 20, fontSize: 13, alignItems: "center" }}>
                  <span style={{ color: LP.textMid }}>Total: <strong style={{ color: LP.forest }}>{totalVol.toLocaleString()} kg</strong></span>
                  {totalHrs !== null && (
                    <span style={{ color: LP.textMid }}>Est. picking hrs: <strong style={{ color: LP.forest }}>{totalHrs.toFixed(0)}</strong></span>
                  )}
                </div>
              </div>
              <Sparkline />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: LP.textLight, marginTop: 4 }}>
                <span>Wk 1</span><span>Wk {Math.ceil(crop.weeks / 2)}</span><span>Wk {crop.weeks}</span>
              </div>
            </div>

            {/* Weekly volume grid */}
            <div style={{ background: LP.white, borderRadius: 10, border: `1px solid ${LP.border}`, overflow: "hidden" }}>
              <div style={{ padding: "10px 18px", borderBottom: `1px solid ${LP.borderLight}`, fontSize: 11, fontWeight: 700, color: LP.textMid, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Weekly picking volumes (kg)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)" }}>
                {data.weeklyVolumes.map((v, i) => {
                  const vol = parseFloat(v) || 0;
                  const isHigh = vol >= maxVol * 0.8 && vol > 0;
                  return (
                    <div key={i} style={{
                      padding: "10px 10px 12px",
                      borderRight: (i + 1) % 6 !== 0 ? `1px solid ${LP.borderLight}` : "none",
                      borderBottom: `1px solid ${LP.borderLight}`,
                      background: vol > 0 ? (isHigh ? "#d8f3dc" : LP.white) : LP.cream,
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: LP.forest, marginBottom: 6, letterSpacing: 0.3 }}>
                        Week {i + 1}
                      </div>
                      {isEditing ? (
                        <input type="number" min="0" value={v}
                          onChange={e => mutate(d => {
                            const vols = [...d.weeklyVolumes];
                            vols[i] = e.target.value;
                            return { ...d, weeklyVolumes: vols };
                          })}
                          style={{ ...lpInp, width: "100%", padding: "4px 6px", minHeight: 32, fontSize: 13, textAlign: "center" }} />
                      ) : (
                        <div style={{ fontSize: 15, fontWeight: vol > 0 ? 700 : 400, color: vol > 0 ? LP.textDark : LP.textLight }}>
                          {vol > 0 ? vol.toLocaleString() : "–"}
                          {vol > 0 && <span style={{ fontSize: 11, fontWeight: 400, color: LP.textLight }}> kg</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: LP.textLight, fontSize: 15, background: LP.cream, fontStyle: "italic" }}>
          Select a crop to configure its picking profile
        </div>
      )}
    </div>
  );
}
