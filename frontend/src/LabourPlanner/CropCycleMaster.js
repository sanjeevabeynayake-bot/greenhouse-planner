import React, { useState, useRef } from "react";
import { LP, lpBtn, lpInp } from "./styles";

export default function CropCycleMaster({ cropCycles, setCropCycles, activities, setActivities }) {
  const [selId, setSelId] = useState(() => cropCycles[0]?.id ?? null);
  const [editModes, setEditModes] = useState({});
  const [confirmDel, setConfirmDel] = useState(null);
  const [showAddCrop, setShowAddCrop] = useState(false);
  const [newCropName, setNewCropName] = useState("");
  const [showAddAct, setShowAddAct] = useState(false);
  const [newActName, setNewActName] = useState("");
  const gridRef = useRef();
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const crop = cropCycles.find(c => c.id === selId);
  const isEditing = !!editModes[selId];

  const k = (act, wi) => `${act}|||${wi}`;
  const isTicked = (act, wi) => !!(crop?.matrix?.[k(act, wi)]);

  const mutateCrop = (id, fn) =>
    setCropCycles(prev => prev.map(c => c.id === id ? fn(c) : c));

  const toggleCell = (act, wi) => {
    if (!isEditing) return;
    mutateCrop(selId, c => {
      const m = { ...c.matrix };
      if (m[k(act, wi)]) delete m[k(act, wi)]; else m[k(act, wi)] = true;
      return { ...c, matrix: m };
    });
  };

  // Click activity name → toggle all weeks for that activity
  const toggleRow = (act) => {
    if (!isEditing || !crop) return;
    mutateCrop(selId, c => {
      const m = { ...c.matrix };
      const allOn = Array.from({ length: c.weeks }, (_, wi) => !!m[k(act, wi)]).every(Boolean);
      Array.from({ length: c.weeks }, (_, wi) => {
        if (allOn) delete m[k(act, wi)]; else m[k(act, wi)] = true;
      });
      return { ...c, matrix: m };
    });
  };

  // Click week header → toggle all activities for that week
  const toggleCol = (wi) => {
    if (!isEditing || !crop) return;
    mutateCrop(selId, c => {
      const m = { ...c.matrix };
      const allOn = activities.every(act => !!m[k(act, wi)]);
      activities.forEach(act => {
        if (allOn) delete m[k(act, wi)]; else m[k(act, wi)] = true;
      });
      return { ...c, matrix: m };
    });
  };

  const addCrop = () => {
    if (!newCropName.trim()) return;
    const id = `crop-${Date.now()}`;
    setCropCycles(prev => [...prev, { id, name: newCropName.trim(), weeks: 24, matrix: {} }]);
    setSelId(id);
    setEditModes(prev => ({ ...prev, [id]: true }));
    setNewCropName("");
    setShowAddCrop(false);
  };

  const deleteCrop = (id) => {
    setCropCycles(prev => {
      const next = prev.filter(c => c.id !== id);
      if (selId === id) setSelId(next[0]?.id ?? null);
      return next;
    });
    setConfirmDel(null);
  };

  const addActivity = () => {
    const name = newActName.trim();
    if (!name || activities.includes(name)) return;
    setActivities(prev => [...prev, name]);
    setNewActName("");
    setShowAddAct(false);
  };

  const deleteActivity = (act) => {
    setActivities(prev => prev.filter(a => a !== act));
    setCropCycles(prev => prev.map(c => {
      const m = {};
      Object.entries(c.matrix).forEach(([key, v]) => {
        if (!key.startsWith(act + "|||")) m[key] = v;
      });
      return { ...c, matrix: m };
    }));
    setConfirmDel(null);
  };

  const tickedCount = crop
    ? activities.reduce((n, act) =>
        n + Array.from({ length: crop.weeks }, (_, wi) => isTicked(act, wi) ? 1 : 0)
              .reduce((a, b) => a + b, 0), 0)
    : 0;

  return (
    <div style={{
      display: "flex", gap: 0,
      height: "calc(100vh - 148px)",
      borderRadius: 12, overflow: "hidden",
      boxShadow: "0 4px 24px rgba(27,67,50,0.14)",
    }}>

      {/* ══ Left: crop list ══ */}
      <div style={{ width: 220, minWidth: 220, background: LP.forest, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 3 }}>
            Crop Types
          </div>
          <div style={{ color: LP.mint, fontSize: 12 }}>{cropCycles.length} configured</div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {cropCycles.map(c => (
            <button key={c.id} onClick={() => setSelId(c.id)} style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "11px 16px",
              background: selId === c.id ? "rgba(255,255,255,0.13)" : "transparent",
              borderLeft: `3px solid ${selId === c.id ? LP.light : "transparent"}`,
              border: "none",
              color: selId === c.id ? LP.white : "rgba(255,255,255,0.65)",
              cursor: "pointer", fontSize: 13,
              fontWeight: selId === c.id ? 600 : 400,
              transition: "all 0.12s", minHeight: 44,
            }}>
              <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.38)", marginTop: 2 }}>{c.weeks}-week cycle</div>
            </button>
          ))}
        </div>

        <div style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          {showAddCrop ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <input
                value={newCropName}
                onChange={e => setNewCropName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addCrop()}
                placeholder="Crop name…"
                autoFocus
                style={{
                  padding: "8px 10px", borderRadius: 6, border: "none",
                  background: "rgba(255,255,255,0.15)", color: LP.white,
                  fontSize: 13, outline: "none", fontFamily: "inherit",
                }}
              />
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={addCrop} style={{
                  flex: 1, background: LP.light, color: LP.forest, border: "none",
                  borderRadius: 6, padding: "8px 0", cursor: "pointer", fontSize: 12, fontWeight: 700,
                }}>Add</button>
                <button onClick={() => { setShowAddCrop(false); setNewCropName(""); }} style={{
                  flex: 1, background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)",
                  border: "none", borderRadius: 6, padding: "8px 0", cursor: "pointer", fontSize: 12,
                }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddCrop(true)} style={{
              width: "100%", background: "transparent", color: LP.mint,
              border: "1px dashed rgba(82,183,136,0.4)", borderRadius: 8,
              padding: "10px 0", cursor: "pointer", fontSize: 13, fontWeight: 600, minHeight: 44,
            }}>
              + Add Crop
            </button>
          )}
        </div>
      </div>

      {/* ══ Right: crop detail ══ */}
      {crop ? (
        <div style={{ flex: 1, background: LP.cream, display: "flex", flexDirection: "column", border: `1px solid ${LP.border}`, borderLeft: "none", overflow: "hidden" }}>

          {/* Header */}
          <div style={{ padding: "13px 20px", background: LP.white, borderBottom: `1px solid ${LP.border}`, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              {isEditing ? (
                <input
                  value={crop.name}
                  onChange={e => mutateCrop(crop.id, c => ({ ...c, name: e.target.value }))}
                  style={{
                    ...lpInp,
                    fontSize: 17, fontWeight: 700, color: LP.forest,
                    fontFamily: "'Palatino Linotype', 'Book Antiqua', Georgia, serif",
                    width: "100%", maxWidth: 360,
                  }}
                />
              ) : (
                <h2 style={{
                  margin: 0, fontSize: 19, color: LP.forest,
                  fontFamily: "'Palatino Linotype', 'Book Antiqua', Georgia, serif", fontWeight: 700,
                }}>{crop.name}</h2>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 13, color: LP.textMid, fontWeight: 500 }}>Weeks:</span>
              {isEditing ? (
                <input
                  type="number" min="1" max="52" value={crop.weeks}
                  onChange={e => mutateCrop(crop.id, c => ({
                    ...c, weeks: Math.max(1, Math.min(52, parseInt(e.target.value) || 24))
                  }))}
                  style={{ ...lpInp, width: 64, textAlign: "center", fontSize: 16, fontWeight: 700, color: LP.forest, padding: "6px 8px" }}
                />
              ) : (
                <span style={{ fontSize: 20, fontWeight: 800, color: LP.mid }}>{crop.weeks}</span>
              )}
            </div>

            <span style={{
              fontSize: 12, color: LP.mid, background: LP.mint,
              padding: "4px 12px", borderRadius: 20, fontWeight: 600, flexShrink: 0,
            }}>
              {tickedCount} ticked
            </span>

            <button
              onClick={() => setEditModes(prev => ({ ...prev, [crop.id]: !isEditing }))}
              style={{ ...lpBtn(isEditing, isEditing ? LP.amber : LP.mid), padding: "9px 20px" }}>
              {isEditing ? "💾 Save" : "✏️ Edit"}
            </button>
            <button
              onClick={() => setConfirmDel({ type: "crop", id: crop.id, name: crop.name })}
              style={{ ...lpBtn(false, LP.red), padding: "9px 12px" }}>
              🗑️
            </button>
          </div>

          {/* Legend bar */}
          <div style={{
            padding: "7px 20px", background: "#EDF4EE",
            borderBottom: `1px solid ${LP.borderLight}`,
            display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: LP.textMid, letterSpacing: 0.5, textTransform: "uppercase" }}>Legend:</span>
            {[
              { bg: LP.cellGreen, label: "Planned this week" },
              { bg: LP.cellGrey, label: "Not planned" },
            ].map(({ bg, label }) => (
              <span key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: LP.textMid }}>
                <span style={{ width: 18, height: 18, background: bg, borderRadius: 3, display: "inline-block", flexShrink: 0, border: "1px solid rgba(0,0,0,0.08)" }} />
                {label}
              </span>
            ))}
            {isEditing ? (
              <span style={{ fontSize: 11, color: LP.mid, fontStyle: "italic", marginLeft: "auto" }}>
                Drag ≡ to reorder · Click activity name to toggle row · Click week to toggle column
              </span>
            ) : (
              <span style={{ fontSize: 11, color: LP.amber, fontWeight: 600, marginLeft: "auto" }}>
                ▶ Click Edit to modify the grid
              </span>
            )}
          </div>

          {/* Activity × Week grid */}
          <div ref={gridRef} style={{ flex: 1, overflow: "auto" }}>
            <table style={{ borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: 195 }} />
                {Array.from({ length: crop.weeks }, (_, i) => (
                  <col key={i} style={{ width: 44, minWidth: 44 }} />
                ))}
                <col style={{ width: 44 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{
                    position: "sticky", left: 0, top: 0, zIndex: 4,
                    background: LP.forest, color: LP.white,
                    padding: "10px 14px", textAlign: "left",
                    fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
                    borderRight: `2px solid ${LP.mid}`,
                    borderBottom: `2px solid ${LP.mid}`,
                    whiteSpace: "nowrap",
                  }}>Activity</th>
                  {Array.from({ length: crop.weeks }, (_, i) => (
                    <th key={i} onClick={() => toggleCol(i)} title={isEditing ? `Toggle all week ${i + 1}` : undefined} style={{
                      position: "sticky", top: 0, zIndex: 2,
                      background: LP.forest, color: LP.white,
                      padding: "10px 2px", textAlign: "center",
                      fontSize: 10, fontWeight: 600,
                      borderLeft: "1px solid rgba(255,255,255,0.1)",
                      borderBottom: `2px solid ${LP.mid}`,
                      cursor: isEditing ? "pointer" : "default",
                      userSelect: "none",
                      whiteSpace: "nowrap",
                    }}>
                      {i + 1}
                    </th>
                  ))}
                  <th style={{
                    position: "sticky", top: 0, zIndex: 2,
                    background: LP.forest,
                    borderBottom: `2px solid ${LP.mid}`,
                    width: 44,
                  }} />
                </tr>
              </thead>
              <tbody>
                {activities.map((act, ai) => {
                  const rowBg = ai % 2 === 0 ? LP.white : "#F2F7F3";
                  return (
                    <tr key={act}
                      draggable={isEditing}
                      onDragStart={() => setDragIdx(ai)}
                      onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                      onDragOver={(e) => { e.preventDefault(); setDragOverIdx(ai); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragIdx === null || dragIdx === ai) { setDragIdx(null); setDragOverIdx(null); return; }
                        const next = [...activities];
                        const [rem] = next.splice(dragIdx, 1);
                        next.splice(ai, 0, rem);
                        setActivities(next);
                        setDragIdx(null); setDragOverIdx(null);
                      }}
                      style={{
                        opacity: dragIdx === ai ? 0.35 : 1,
                        boxShadow: dragOverIdx === ai && dragIdx !== null && dragIdx !== ai ? `inset 0 2px 0 ${LP.amber}` : "none",
                      }}
                    >
                      <td
                        onClick={() => toggleRow(act)}
                        title={isEditing ? `Toggle all weeks for ${act}` : undefined}
                        style={{
                          position: "sticky", left: 0, zIndex: 1,
                          background: rowBg,
                          padding: "0 12px", fontSize: 12, color: LP.textDark, fontWeight: 500,
                          borderRight: `2px solid ${LP.border}`,
                          borderBottom: `1px solid ${LP.borderLight}`,
                          height: 44, verticalAlign: "middle",
                          cursor: isEditing ? "grab" : "default",
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          maxWidth: 195,
                          boxShadow: "2px 0 4px rgba(0,0,0,0.05)",
                          userSelect: "none",
                        }}>
                        {isEditing && (
                          <span style={{ display: "inline-block", marginRight: 7, color: "rgba(0,0,0,0.22)", fontSize: 14, userSelect: "none", fontWeight: 700 }}>≡</span>
                        )}
                        {act}
                      </td>
                      {Array.from({ length: crop.weeks }, (_, wi) => {
                        const t = isTicked(act, wi);
                        return (
                          <td key={wi} onClick={() => toggleCell(act, wi)} style={{
                            width: 44, height: 44,
                            background: t ? LP.cellGreen : LP.cellGrey,
                            cursor: isEditing ? "pointer" : "default",
                            textAlign: "center", verticalAlign: "middle",
                            borderLeft: "1px solid rgba(255,255,255,0.5)",
                            borderBottom: `1px solid ${LP.borderLight}`,
                            transition: "background 0.1s",
                            userSelect: "none",
                          }}>
                            {t && (
                              <span style={{ color: "rgba(255,255,255,0.95)", fontSize: 14, lineHeight: 1, userSelect: "none" }}>
                                ✓
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td style={{
                        background: rowBg,
                        textAlign: "center", verticalAlign: "middle",
                        borderBottom: `1px solid ${LP.borderLight}`,
                        width: 44,
                      }}>
                        <button
                          onClick={() => setConfirmDel({ type: "activity", name: act })}
                          style={{
                            background: "none", border: "none", cursor: "pointer",
                            color: "rgba(183,28,28,0.45)", fontSize: 18,
                            padding: 4, minWidth: 36, minHeight: 36,
                            borderRadius: 4, lineHeight: 1, display: "inline-flex",
                            alignItems: "center", justifyContent: "center",
                            transition: "color 0.1s",
                          }}
                          onMouseEnter={e => e.currentTarget.style.color = LP.red}
                          onMouseLeave={e => e.currentTarget.style.color = "rgba(183,28,28,0.45)"}
                        >×</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Add activity */}
            <div style={{ padding: "12px 20px", borderTop: `1px solid ${LP.borderLight}`, background: LP.white }}>
              {showAddAct ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    value={newActName}
                    onChange={e => setNewActName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addActivity()}
                    placeholder="Activity name…"
                    autoFocus
                    style={{ ...lpInp, flex: 1, maxWidth: 320 }}
                  />
                  <button onClick={addActivity} style={{ ...lpBtn(true, LP.mid), padding: "9px 20px" }}>Add</button>
                  <button onClick={() => { setShowAddAct(false); setNewActName(""); }}
                    style={{ ...lpBtn(false, LP.textMid), padding: "9px 14px" }}>Cancel</button>
                </div>
              ) : (
                <button onClick={() => setShowAddAct(true)} style={{
                  background: "transparent", border: `1px dashed ${LP.mid}`, borderRadius: 8,
                  padding: "10px 20px", cursor: "pointer", color: LP.mid,
                  fontSize: 13, fontWeight: 600, minHeight: 44,
                }}>
                  + Add Activity
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          color: LP.textLight, fontSize: 15, background: LP.cream,
          fontStyle: "italic",
        }}>
          Select a crop from the left to view its cycle
        </div>
      )}

      {/* ══ Delete confirmation dialog ══ */}
      {confirmDel && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.52)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 9999,
        }}>
          <div style={{
            background: LP.white, borderRadius: 14, padding: 28,
            maxWidth: 380, width: "90%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }}>
            <h3 style={{
              color: LP.red, margin: "0 0 10px",
              fontFamily: "'Palatino Linotype', 'Book Antiqua', Georgia, serif",
              fontSize: 18,
            }}>Confirm Delete</h3>
            <p style={{ color: LP.textMid, margin: "0 0 22px", fontSize: 14, lineHeight: 1.55 }}>
              {confirmDel.type === "crop"
                ? `Remove crop "${confirmDel.name}" and all its cycle data? This cannot be undone.`
                : `Remove activity "${confirmDel.name}" from all crop cycles? This cannot be undone.`}
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => confirmDel.type === "crop" ? deleteCrop(confirmDel.id) : deleteActivity(confirmDel.name)}
                style={{ flex: 1, background: LP.red, color: LP.white, border: "none", borderRadius: 8, padding: "12px 0", cursor: "pointer", fontSize: 14, fontWeight: 700, minHeight: 44 }}>
                Delete
              </button>
              <button onClick={() => setConfirmDel(null)} style={{
                flex: 1, background: "#EEEEED", color: LP.textDark, border: "none",
                borderRadius: 8, padding: "12px 0", cursor: "pointer", fontSize: 14, minHeight: 44,
              }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
