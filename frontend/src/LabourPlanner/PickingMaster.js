import React, { useState } from "react";
import { LP, lpBtn, lpInp } from "./styles";

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
      const t = p === s ? 1 : (w - s) / (p - s);
      v = peak * Math.pow(Math.sin((Math.PI / 2) * t), 2);
    } else {
      const t = p === e ? 0 : (w - p) / (e - p);
      v = peak * Math.pow(Math.cos((Math.PI / 2) * t), 2);
    }
    vols[w] = String(Math.round(v));
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
  const totalHrs = data ? data.weeklyVolumes.reduce((s, v) => {
    return s + (parseFloat(v) || 0) * (parseFloat(data.timePerKg) || 0);
  }, 0) : 0;
  const maxVol = data ? Math.max(...data.weeklyVolumes.map(v => parseFloat(v) || 0), 1) : 1;

  const Sparkline = () => (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 64, padding: "4px 0 0" }}>
      {(data?.weeklyVolumes ?? []).map((v, i) => {
        const val = parseFloat(v) || 0;
        const h = maxVol > 0 ? Math.max(Math.round((val / maxVol) * 58), val > 0 ? 2 : 0) : 0;
        return (
          <div key={i} title={`Week ${i + 1}: ${val.toLocaleString()} kg`} style={{
            flex: 1, height: h, background: val > 0 ? (val >= maxVol * 0.85 ? LP.mid : LP.light) : LP.borderLight,
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
      {/* Left panel */}
      <div style={{ width: 220, minWidth: 220, background: LP.forest, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 3 }}>Crop Types</div>
          <div style={{ color: LP.mint, fontSize: 12 }}>{cropCycles.length} configured</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {cropCycles.map(c => {
            const d = pickingData.find(x => x.cropId === c.id);
            const vol = d ? d.weeklyVolumes.reduce((s, v) => s + (parseFloat(v) || 0), 0) : 0;
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
                  {d?.timePerKg ? `${d.timePerKg} hrs/kg` : "Rate not set"}
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
          {/* Header */}
          <div style={{ padding: "13px 20px", background: LP.white, borderBottom: `1px solid ${LP.border}`, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, flex: 1, fontSize: 19, color: LP.forest, fontFamily: "'Palatino Linotype', Georgia, serif", fontWeight: 700 }}>{crop.name}</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: LP.textMid }}>Hrs/kg:</span>
              {isEditing
                ? <input type="number" min="0" step="0.001" value={data.timePerKg}
                    onChange={e => mutate(d => ({ ...d, timePerKg: e.target.value }))}
                    placeholder="0.000"
                    style={{ ...lpInp, width: 100, padding: "6px 10px", minHeight: 36 }} />
                : <span style={{ fontWeight: 700, color: LP.mid, fontSize: 16 }}>
                    {data.timePerKg ? `${data.timePerKg} hrs/kg` : <em style={{ color: LP.textLight, fontSize: 13, fontWeight: 400 }}>Not set</em>}
                  </span>
              }
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
              <div style={{ fontSize: 11, fontWeight: 700, color: LP.textMid, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Bell Curve Generator</div>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                {[
                  { key: "start",   label: "Start week",    placeholder: `1–${crop.weeks}` },
                  { key: "peakWeek",label: "Peak week",     placeholder: `1–${crop.weeks}` },
                  { key: "peak",    label: "Peak vol (kg)", placeholder: "kg" },
                  { key: "end",     label: "End week",      placeholder: `1–${crop.weeks}` },
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
                Curve goes from 0 at start week → peak vol at peak week → 0 at end week. All other weeks stay 0. Edit individual weeks freely after generating.
              </div>
            </div>

            {/* Sparkline + summary */}
            <div style={{ background: LP.white, borderRadius: 10, padding: 18, border: `1px solid ${LP.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: LP.textMid, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Volume profile — {crop.weeks} weeks
                </div>
                <div style={{ display: "flex", gap: 24, fontSize: 13 }}>
                  <span style={{ color: LP.textMid }}>Total: <strong style={{ color: LP.forest }}>{totalVol.toLocaleString()} kg</strong></span>
                  {data.timePerKg && <span style={{ color: LP.textMid }}>Est. hrs: <strong style={{ color: LP.forest }}>{totalHrs.toFixed(1)}</strong></span>}
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
                Weekly volumes &amp; calculated hours
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)" }}>
                {data.weeklyVolumes.map((v, i) => {
                  const vol = parseFloat(v) || 0;
                  const hrs = vol * (parseFloat(data.timePerKg) || 0);
                  const isHigh = vol >= maxVol * 0.8 && vol > 0;
                  return (
                    <div key={i} style={{
                      padding: "10px 10px",
                      borderRight: (i + 1) % 6 !== 0 ? `1px solid ${LP.borderLight}` : "none",
                      borderBottom: `1px solid ${LP.borderLight}`,
                      background: vol > 0 ? (isHigh ? "#d8f3dc" : LP.white) : LP.cream,
                    }}>
                      <div style={{ fontSize: 10, color: LP.textLight, marginBottom: 4, fontWeight: 600 }}>Wk {i + 1}</div>
                      {isEditing ? (
                        <input type="number" min="0" value={v}
                          onChange={e => mutate(d => {
                            const vols = [...d.weeklyVolumes];
                            vols[i] = e.target.value;
                            return { ...d, weeklyVolumes: vols };
                          })}
                          style={{ ...lpInp, width: "100%", padding: "4px 6px", minHeight: 32, fontSize: 12, textAlign: "center" }} />
                      ) : (
                        <div style={{ fontSize: 13, fontWeight: vol > 0 ? 700 : 400, color: vol > 0 ? LP.textDark : LP.textLight }}>
                          {vol > 0 ? vol.toLocaleString() : "–"}
                          {vol > 0 && <span style={{ fontSize: 10, fontWeight: 400, color: LP.textLight }}> kg</span>}
                        </div>
                      )}
                      {/* Calculated hours row */}
                      {data.timePerKg && vol > 0 && (
                        <div style={{ marginTop: 4, padding: "3px 6px", background: LP.cellAutoFill, borderRadius: 4, fontSize: 10, color: LP.mid, fontWeight: 600 }}>
                          {hrs.toFixed(2)} hrs
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
