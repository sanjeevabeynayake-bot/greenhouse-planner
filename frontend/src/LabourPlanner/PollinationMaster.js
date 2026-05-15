import React, { useState } from "react";
import { LP, lpBtn, lpInp } from "./styles";

export default function PollinationMaster({ pollinationData, setPollinationData, lpRole }) {
  const [isEditing, setIsEditing] = useState(false);
  const isGM = lpRole === "gm";

  const setHours = (ghId, value) =>
    setPollinationData(prev => prev.map(d => d.ghId === ghId ? { ...d, hoursPerRound: value } : d));

  const configured = pollinationData.filter(d => d.hoursPerRound !== "").length;

  const thStyle = {
    background: LP.cream, color: LP.textMid, padding: "10px 20px",
    fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
    borderBottom: `2px solid ${LP.border}`, textAlign: "left",
  };

  return (
    <div style={{ borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 24px rgba(27,67,50,0.14)", border: `1px solid ${LP.border}` }}>
      <div style={{ padding: "16px 24px", background: LP.forest, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: LP.white, fontSize: 16, fontWeight: 700, fontFamily: "'Palatino Linotype', Georgia, serif" }}>Pollination Master</div>
          <div style={{ color: LP.mint, fontSize: 12, marginTop: 3 }}>{configured} of {pollinationData.length} greenhouses configured</div>
        </div>
        {isGM && (
          <button onClick={() => setIsEditing(v => !v)} style={{ ...lpBtn(isEditing, isEditing ? LP.amber : LP.light), padding: "9px 20px" }}>
            {isEditing ? "💾 Save" : "✏️ Edit All"}
          </button>
        )}
      </div>

      <div style={{ background: LP.white, padding: "10px 20px 6px", borderBottom: `1px solid ${LP.borderLight}` }}>
        <span style={{ fontSize: 12, color: LP.textLight, fontStyle: "italic" }}>
          Hours per pollination round — greenhouse-specific, not adjusted by crop density
        </span>
      </div>

      <div style={{ overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: "45%" }}>Greenhouse</th>
              <th style={{ ...thStyle, textAlign: "center", width: 200 }}>Hours per round</th>
              <th style={{ ...thStyle }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {pollinationData.map((d, i) => (
              <tr key={d.ghId} style={{ background: i % 2 === 0 ? LP.white : LP.cream }}>
                <td style={{ padding: "12px 20px", fontSize: 13, color: LP.textDark, fontWeight: 500, borderBottom: `1px solid ${LP.borderLight}` }}>
                  {d.ghName}
                </td>
                <td style={{ padding: "8px 20px", textAlign: "center", borderBottom: `1px solid ${LP.borderLight}` }}>
                  {isEditing
                    ? <input type="number" min="0" step="0.25" value={d.hoursPerRound}
                        onChange={e => setHours(d.ghId, e.target.value)}
                        placeholder="0.00"
                        style={{ ...lpInp, width: 120, padding: "6px 10px", minHeight: 36, textAlign: "center" }} />
                    : <span style={{ fontWeight: d.hoursPerRound ? 700 : 400, color: d.hoursPerRound ? LP.forest : LP.textLight, fontSize: d.hoursPerRound ? 15 : 13 }}>
                        {d.hoursPerRound ? `${d.hoursPerRound} hrs` : "–"}
                      </span>
                  }
                </td>
                <td style={{ padding: "12px 20px", fontSize: 12, borderBottom: `1px solid ${LP.borderLight}` }}>
                  {d.hoursPerRound
                    ? <span style={{ color: LP.mid, fontWeight: 600 }}>✓ Configured</span>
                    : <span style={{ color: LP.textLight, fontStyle: "italic" }}>Not yet set</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
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
