import React, { useState } from "react";
import { LP, lpBtn, lpInp } from "./styles";

export default function PollinationMaster({ pollinationData, setPollinationData, lpRole }) {
  const [isEditing, setIsEditing] = useState(false);
  const isGM = lpRole === "gm";

  const setField = (ghId, field, value) =>
    setPollinationData(prev => prev.map(d => d.ghId === ghId ? { ...d, [field]: value } : d));

  const weeklyHrs = (d) => {
    const h = parseFloat(d.hoursPerRound) || 0;
    const r = parseFloat(d.roundsPerWeek) || 0;
    return h > 0 && r > 0 ? (h * r).toFixed(2) : null;
  };

  const configured = pollinationData.filter(d => d.hoursPerRound !== "" && d.roundsPerWeek !== "").length;

  const thStyle = {
    background: LP.cream, color: LP.textMid, padding: "10px 16px",
    fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
    borderBottom: `2px solid ${LP.border}`, textAlign: "left",
  };

  return (
    <div style={{ borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 24px rgba(27,67,50,0.14)", border: `1px solid ${LP.border}` }}>
      <div style={{ padding: "16px 24px", background: LP.forest, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: LP.white, fontSize: 16, fontWeight: 700, fontFamily: "'Palatino Linotype', Georgia, serif" }}>Pollination Master</div>
          <div style={{ color: LP.mint, fontSize: 12, marginTop: 3 }}>{configured} of {pollinationData.length} greenhouses fully configured</div>
        </div>
        {isGM && (
          <button onClick={() => setIsEditing(v => !v)} style={{ ...lpBtn(isEditing, isEditing ? LP.amber : LP.light), padding: "9px 20px" }}>
            {isEditing ? "💾 Save" : "✏️ Edit All"}
          </button>
        )}
      </div>

      <div style={{ background: LP.white, padding: "10px 20px 8px", borderBottom: `1px solid ${LP.borderLight}` }}>
        <span style={{ fontSize: 12, color: LP.textLight, fontStyle: "italic" }}>
          Pollination hours are greenhouse-specific and not adjusted by crop density.
          Total hrs/week = hours per round × rounds per week.
        </span>
      </div>

      <div style={{ overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: "35%" }}>Greenhouse</th>
              <th style={{ ...thStyle, textAlign: "center", width: 160 }}>Hrs / round</th>
              <th style={{ ...thStyle, textAlign: "center", width: 160 }}>Rounds / week</th>
              <th style={{ ...thStyle, textAlign: "center", width: 160 }}>Total hrs / week</th>
              <th style={{ ...thStyle }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {pollinationData.map((d, i) => {
              const total = weeklyHrs(d);
              return (
                <tr key={d.ghId} style={{ background: i % 2 === 0 ? LP.white : LP.cream }}>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: LP.textDark, fontWeight: 500, borderBottom: `1px solid ${LP.borderLight}` }}>
                    {d.ghName}
                  </td>

                  {/* Hours per round */}
                  <td style={{ padding: "8px 16px", textAlign: "center", borderBottom: `1px solid ${LP.borderLight}` }}>
                    {isEditing
                      ? <input type="number" min="0" step="0.25" value={d.hoursPerRound ?? ""}
                          onChange={e => setField(d.ghId, "hoursPerRound", e.target.value)}
                          placeholder="0.00"
                          style={{ ...lpInp, width: 100, padding: "6px 8px", minHeight: 36, textAlign: "center" }} />
                      : <span style={{ fontWeight: d.hoursPerRound ? 700 : 400, color: d.hoursPerRound ? LP.textDark : LP.textLight }}>
                          {d.hoursPerRound ? `${d.hoursPerRound} hrs` : "–"}
                        </span>
                    }
                  </td>

                  {/* Rounds per week */}
                  <td style={{ padding: "8px 16px", textAlign: "center", borderBottom: `1px solid ${LP.borderLight}` }}>
                    {isEditing
                      ? <input type="number" min="0" step="1" value={d.roundsPerWeek ?? ""}
                          onChange={e => setField(d.ghId, "roundsPerWeek", e.target.value)}
                          placeholder="0"
                          style={{ ...lpInp, width: 80, padding: "6px 8px", minHeight: 36, textAlign: "center" }} />
                      : <span style={{ fontWeight: d.roundsPerWeek ? 700 : 400, color: d.roundsPerWeek ? LP.textDark : LP.textLight }}>
                          {d.roundsPerWeek ? `${d.roundsPerWeek}×` : "–"}
                        </span>
                    }
                  </td>

                  {/* Calculated total */}
                  <td style={{ padding: "8px 16px", textAlign: "center", borderBottom: `1px solid ${LP.borderLight}` }}>
                    {total
                      ? <span style={{ fontWeight: 800, fontSize: 15, color: LP.forest, background: LP.mint, padding: "4px 12px", borderRadius: 20, display: "inline-block" }}>
                          {total} hrs
                        </span>
                      : <span style={{ color: LP.textLight, fontSize: 12 }}>–</span>
                    }
                  </td>

                  <td style={{ padding: "12px 16px", fontSize: 12, borderBottom: `1px solid ${LP.borderLight}` }}>
                    {total
                      ? <span style={{ color: LP.mid, fontWeight: 600 }}>✓ {total} hrs/wk</span>
                      : d.hoursPerRound || d.roundsPerWeek
                        ? <span style={{ color: LP.amber, fontWeight: 500 }}>⚠ Incomplete</span>
                        : <span style={{ color: LP.textLight, fontStyle: "italic" }}>Not configured</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
          {pollinationData.some(d => weeklyHrs(d)) && (
            <tfoot>
              <tr style={{ background: LP.forest }}>
                <td colSpan={3} style={{ padding: "10px 16px", color: LP.white, fontWeight: 700, fontSize: 13 }}>Total pollination demand / week (all GHs)</td>
                <td style={{ padding: "10px 16px", textAlign: "center", color: LP.mint, fontWeight: 800, fontSize: 15 }}>
                  {pollinationData.reduce((s, d) => s + (parseFloat(weeklyHrs(d)) || 0), 0).toFixed(2)} hrs
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
        {pollinationData.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: LP.textLight, fontStyle: "italic" }}>
            No greenhouses configured — add greenhouses in Greenhouse Master first
          </div>
        )}
      </div>
    </div>
  );
}
