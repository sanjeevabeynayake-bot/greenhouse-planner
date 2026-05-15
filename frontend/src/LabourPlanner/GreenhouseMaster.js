import React, { useState } from "react";
import { LP, lpBtn, lpInp } from "./styles";

export default function GreenhouseMaster({ greenhouses, setGreenhouses, cropCycles, lpRole }) {
  const [selId, setSelId] = useState(() => greenhouses[0]?.id ?? null);
  const [editModes, setEditModes] = useState({});
  const [confirmDel, setConfirmDel] = useState(null);
  const [showAddGH, setShowAddGH] = useState(false);
  const [newGHName, setNewGHName] = useState("");

  const gh = greenhouses.find(g => g.id === selId);
  const isEditing = !!editModes[selId];
  const isGM = lpRole === "gm";

  const mutateGH = (id, fn) =>
    setGreenhouses(prev => prev.map(g => g.id === id ? fn(g) : g));

  const toggleCrop = (cropId, zone) => {
    if (!isEditing) return;
    mutateGH(selId, g => {
      if (!zone) {
        const crops = g.crops.includes(cropId)
          ? g.crops.filter(c => c !== cropId)
          : [...g.crops, cropId];
        return { ...g, crops };
      }
      const zd = { ...g[zone] };
      zd.crops = zd.crops.includes(cropId)
        ? zd.crops.filter(c => c !== cropId)
        : [...zd.crops, cropId];
      return { ...g, [zone]: zd };
    });
  };

  const sqmWarn = (g) => {
    if (!g?.splitZones) return null;
    const total = parseFloat(g.sqm) || 0;
    const a = parseFloat(g.zoneA?.sqm) || 0;
    const b = parseFloat(g.zoneB?.sqm) || 0;
    if (total > 0 && a + b > total)
      return `Zone A (${a}) + Zone B (${b}) = ${a + b} sqm exceeds total ${total} sqm`;
    return null;
  };

  const canSave = (g) => !sqmWarn(g);

  const saveGH = () => {
    if (!canSave(gh)) return;
    mutateGH(selId, g => ({ ...g, lastEdited: new Date().toISOString() }));
    setEditModes(prev => ({ ...prev, [selId]: false }));
  };

  const addGH = () => {
    if (!newGHName.trim()) return;
    const id = `gh-${Date.now()}`;
    setGreenhouses(prev => [...prev, {
      id, name: newGHName.trim(), sqm: "", crops: [],
      splitZones: false, zoneA: { sqm: "", crops: [] }, zoneB: { sqm: "", crops: [] }, lastEdited: null,
    }]);
    setSelId(id);
    setEditModes(prev => ({ ...prev, [id]: true }));
    setNewGHName(""); setShowAddGH(false);
  };

  const deleteGH = (id) => {
    setGreenhouses(prev => {
      const next = prev.filter(g => g.id !== id);
      if (selId === id) setSelId(next[0]?.id ?? null);
      return next;
    });
    setConfirmDel(null);
  };

  const cropLabel = (g) => {
    if (!g) return "–";
    if (g.splitZones) {
      return `Zone A: ${g.zoneA.crops.length} crop(s), Zone B: ${g.zoneB.crops.length} crop(s)`;
    }
    return g.crops.length ? `${g.crops.length} crop(s) assigned` : "No crops assigned";
  };

  const CropPills = ({ selectedIds, onChange, label }) => (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: LP.textMid, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {cropCycles.length === 0 && (
          <span style={{ fontSize: 12, color: LP.textLight, fontStyle: "italic" }}>No crops configured — add in Crop Cycle Master first</span>
        )}
        {cropCycles.map(c => {
          const checked = selectedIds.includes(c.id);
          return (
            <label key={c.id} onClick={() => isEditing && onChange(c.id)} style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "6px 14px",
              background: checked ? LP.mint : LP.white,
              border: `1.5px solid ${checked ? LP.mid : LP.border}`,
              borderRadius: 20, cursor: isEditing ? "pointer" : "default",
              fontSize: 13, color: checked ? LP.forest : LP.textMid,
              fontWeight: checked ? 600 : 400, userSelect: "none",
              transition: "all 0.12s",
            }}>
              {checked ? "✓ " : ""}{c.name}
            </label>
          );
        })}
      </div>
    </div>
  );

  const warn = gh ? sqmWarn(gh) : null;

  return (
    <div style={{
      display: "flex", gap: 0,
      height: "calc(100vh - 148px)",
      borderRadius: 12, overflow: "hidden",
      boxShadow: "0 4px 24px rgba(27,67,50,0.14)",
    }}>
      {/* Left: GH list */}
      <div style={{ width: 220, minWidth: 220, background: LP.forest, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 3 }}>Greenhouses</div>
          <div style={{ color: LP.mint, fontSize: 12 }}>{greenhouses.length} configured</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {greenhouses.map(g => (
            <button key={g.id} onClick={() => setSelId(g.id)} style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "11px 16px",
              background: selId === g.id ? "rgba(255,255,255,0.13)" : "transparent",
              borderLeft: `3px solid ${selId === g.id ? LP.light : "transparent"}`,
              border: "none", color: selId === g.id ? LP.white : "rgba(255,255,255,0.65)",
              cursor: "pointer", fontSize: 13, fontWeight: selId === g.id ? 600 : 400,
              transition: "all 0.12s", minHeight: 44,
            }}>
              <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.38)", marginTop: 2 }}>
                {g.sqm ? `${Number(g.sqm).toLocaleString()} m²` : "sqm not set"}
                {g.splitZones ? " · Split" : ""}
              </div>
            </button>
          ))}
        </div>
        {isGM && (
          <div style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            {showAddGH ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <input value={newGHName} onChange={e => setNewGHName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addGH()} placeholder="GH name…" autoFocus
                  style={{ padding: "8px 10px", borderRadius: 6, border: "none", background: "rgba(255,255,255,0.15)", color: LP.white, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={addGH} style={{ flex: 1, background: LP.light, color: LP.forest, border: "none", borderRadius: 6, padding: "8px 0", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Add</button>
                  <button onClick={() => { setShowAddGH(false); setNewGHName(""); }} style={{ flex: 1, background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", border: "none", borderRadius: 6, padding: "8px 0", cursor: "pointer", fontSize: 12 }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAddGH(true)} style={{
                width: "100%", background: "transparent", color: LP.mint,
                border: "1px dashed rgba(82,183,136,0.4)", borderRadius: 8,
                padding: "10px 0", cursor: "pointer", fontSize: 13, fontWeight: 600, minHeight: 44,
              }}>+ Add Greenhouse</button>
            )}
          </div>
        )}
      </div>

      {/* Right: detail */}
      {gh ? (
        <div style={{ flex: 1, background: LP.cream, display: "flex", flexDirection: "column", border: `1px solid ${LP.border}`, borderLeft: "none", overflow: "hidden" }}>
          {/* Header */}
          <div style={{ padding: "13px 20px", background: LP.white, borderBottom: `1px solid ${LP.border}`, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              {isEditing
                ? <input value={gh.name} onChange={e => mutateGH(gh.id, g => ({ ...g, name: e.target.value }))}
                    style={{ ...lpInp, fontSize: 17, fontWeight: 700, color: LP.forest, fontFamily: "'Palatino Linotype', Georgia, serif", width: "100%", maxWidth: 360 }} />
                : <h2 style={{ margin: 0, fontSize: 19, color: LP.forest, fontFamily: "'Palatino Linotype', Georgia, serif", fontWeight: 700 }}>{gh.name}</h2>
              }
            </div>
            <span style={{ fontSize: 12, color: LP.textMid, fontStyle: "italic" }}>{cropLabel(gh)}</span>
            {isGM && <>
              <button
                onClick={() => isEditing ? saveGH() : setEditModes(p => ({ ...p, [gh.id]: true }))}
                disabled={isEditing && !canSave(gh)}
                style={{ ...lpBtn(isEditing, isEditing ? LP.amber : LP.mid), padding: "9px 20px", opacity: isEditing && !canSave(gh) ? 0.45 : 1 }}>
                {isEditing ? "💾 Save" : "✏️ Edit"}
              </button>
              <button onClick={() => setConfirmDel({ id: gh.id, name: gh.name })} style={{ ...lpBtn(false, LP.red), padding: "9px 12px" }}>🗑️</button>
            </>}
          </div>

          {/* Warning bar */}
          {warn && (
            <div style={{ padding: "8px 20px", background: LP.amberLight, borderBottom: `1px solid ${LP.amber}`, fontSize: 12, color: LP.amber, fontWeight: 600 }}>
              ⚠️ {warn} — fix before saving
            </div>
          )}

          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Area */}
            <div style={{ background: LP.white, borderRadius: 10, padding: 20, border: `1px solid ${LP.border}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: LP.textMid, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Greenhouse Area</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <label style={{ fontSize: 13, color: LP.textDark, fontWeight: 500 }}>Total sqm:</label>
                {isEditing
                  ? <input type="number" min="0" value={gh.sqm} onChange={e => mutateGH(gh.id, g => ({ ...g, sqm: e.target.value }))} placeholder="e.g. 5000" style={{ ...lpInp, width: 140 }} />
                  : <span style={{ fontSize: 20, fontWeight: 800, color: LP.mid }}>{gh.sqm ? `${Number(gh.sqm).toLocaleString()} m²` : <em style={{ color: LP.textLight, fontSize: 14, fontWeight: 400 }}>Not set</em>}</span>
                }
              </div>
            </div>

            {/* Zone split */}
            <div style={{ background: LP.white, borderRadius: 10, padding: 20, border: `1px solid ${LP.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: gh.splitZones ? 20 : 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: LP.textMid, textTransform: "uppercase", letterSpacing: 0.5, flex: 1 }}>Zone Split</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}
                  onClick={() => isEditing && mutateGH(gh.id, g => ({ ...g, splitZones: !g.splitZones }))}>
                  <div style={{
                    width: 40, height: 22, borderRadius: 11,
                    background: gh.splitZones ? LP.mid : LP.border,
                    position: "relative", transition: "background 0.2s",
                    cursor: isEditing ? "pointer" : "default",
                  }}>
                    <div style={{
                      position: "absolute", top: 3, left: gh.splitZones ? 21 : 3,
                      width: 16, height: 16, borderRadius: "50%",
                      background: LP.white, transition: "left 0.2s",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    }} />
                  </div>
                  <span style={{ fontSize: 13, color: LP.textDark, cursor: isEditing ? "pointer" : "default", userSelect: "none" }}>
                    {gh.splitZones ? "Split into Zone A + Zone B" : "Single zone"}
                  </span>
                </div>
              </div>

              {gh.splitZones && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {["zoneA", "zoneB"].map(zone => (
                    <div key={zone} style={{ padding: 16, background: LP.cream, borderRadius: 8, border: `1px solid ${LP.borderLight}` }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: LP.forest, marginBottom: 12 }}>{zone === "zoneA" ? "Zone A" : "Zone B"}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                        <label style={{ fontSize: 12, color: LP.textDark }}>sqm:</label>
                        {isEditing
                          ? <input type="number" min="0" value={gh[zone].sqm}
                              onChange={e => mutateGH(gh.id, g => ({ ...g, [zone]: { ...g[zone], sqm: e.target.value } }))}
                              style={{ ...lpInp, width: 100, padding: "6px 10px", minHeight: 36 }} />
                          : <span style={{ fontWeight: 700, color: LP.mid }}>{gh[zone].sqm ? `${Number(gh[zone].sqm).toLocaleString()} m²` : "–"}</span>
                        }
                      </div>
                      <CropPills selectedIds={gh[zone].crops} onChange={id => toggleCrop(id, zone)} label="Crops in this zone" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Crops single zone */}
            {!gh.splitZones && (
              <div style={{ background: LP.white, borderRadius: 10, padding: 20, border: `1px solid ${LP.border}` }}>
                <CropPills selectedIds={gh.crops} onChange={id => toggleCrop(id, null)} label="Crops grown here" />
              </div>
            )}

            {gh.lastEdited && (
              <div style={{ fontSize: 11, color: LP.textLight, textAlign: "right" }}>
                Last saved: {new Date(gh.lastEdited).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: LP.textLight, fontSize: 15, background: LP.cream, fontStyle: "italic" }}>
          Select a greenhouse from the left
        </div>
      )}

      {confirmDel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.52)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: LP.white, borderRadius: 14, padding: 28, maxWidth: 380, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h3 style={{ color: LP.red, margin: "0 0 10px", fontFamily: "'Palatino Linotype', Georgia, serif", fontSize: 18 }}>Confirm Delete</h3>
            <p style={{ color: LP.textMid, margin: "0 0 22px", fontSize: 14, lineHeight: 1.55 }}>
              Remove greenhouse "{confirmDel.name}"? This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => deleteGH(confirmDel.id)} style={{ flex: 1, background: LP.red, color: LP.white, border: "none", borderRadius: 8, padding: "12px 0", cursor: "pointer", fontSize: 14, fontWeight: 700, minHeight: 44 }}>Delete</button>
              <button onClick={() => setConfirmDel(null)} style={{ flex: 1, background: "#EEEEED", color: LP.textDark, border: "none", borderRadius: 8, padding: "12px 0", cursor: "pointer", fontSize: 14, minHeight: 44 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
