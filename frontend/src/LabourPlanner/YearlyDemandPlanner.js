import React, { useState, useMemo } from "react";
import { LP, lpBtn } from "./styles";

const PICKING_ACT = "Picking";
const POLL_ACT = "Pollination";

function calcDemand({ cropCycles, greenhouses, cropMasterData, activities, pollinationData, pickingData }) {
  const numWeeks = Math.max(...cropCycles.map(c => c.weeks), 24);
  // demand[wi][act] = total hours
  const demand = Array.from({ length: numWeeks }, () => ({}));
  const warnings = [];

  greenhouses.forEach(gh => {
    const ghSqm = parseFloat(gh.sqm) || 0;
    if (!ghSqm) { warnings.push(`${gh.name}: no sqm set`); return; }

    const ghCrops = gh.splitZones
      ? [...new Set([...gh.zoneA.crops, ...gh.zoneB.crops])]
      : gh.crops;

    ghCrops.forEach(cropId => {
      const cycle = cropCycles.find(c => c.id === cropId);
      if (!cycle) return;
      const md = cropMasterData.find(d => d.cropId === cropId);
      if (!md) return;

      // Determine sqm for this crop in this GH
      let cropSqm = ghSqm;
      if (gh.splitZones) {
        const inA = gh.zoneA.crops.includes(cropId);
        const inB = gh.zoneB.crops.includes(cropId);
        if (inA && !inB) cropSqm = parseFloat(gh.zoneA.sqm) || 0;
        else if (!inA && inB) cropSqm = parseFloat(gh.zoneB.sqm) || 0;
        else if (inA && inB) cropSqm = (parseFloat(gh.zoneA.sqm) || 0) + (parseFloat(gh.zoneB.sqm) || 0);
      }
      if (!cropSqm) return;

      activities.forEach(act => {
        if (act === PICKING_ACT || act === POLL_ACT) return;
        const actCell = md.cells?.[act];
        if (!actCell?.h && !actCell?.t) return;

        for (let wi = 0; wi < cycle.weeks; wi++) {
          const isActive = !!(cycle.matrix?.[`${act}|||${wi}`]);
          if (!isActive) continue;

          // get effective h and t for this week
          const weekData = actCell.weeks?.[wi];
          const h = parseFloat(weekData?.h ?? actCell.h) || 0;
          const t = parseFloat(weekData?.t ?? actCell.t) || 0;
          if (!h || !t) continue;

          const hrs = cropSqm * h * t;
          demand[wi][act] = (demand[wi][act] || 0) + hrs;
        }
      });
    });

    // Pollination: from PollinationMaster per GH
    const pollRow = pollinationData.find(d => d.ghId === gh.id);
    const pollHrs = parseFloat(pollRow?.hoursPerRound) || 0;
    if (pollHrs > 0) {
      // Count weeks where Pollination is active (any crop in this GH)
      const pollActive = new Set();
      ghCrops.forEach(cropId => {
        const cycle = cropCycles.find(c => c.id === cropId);
        if (!cycle) return;
        for (let wi = 0; wi < cycle.weeks; wi++) {
          if (cycle.matrix?.[`${POLL_ACT}|||${wi}`]) pollActive.add(wi);
        }
      });
      pollActive.forEach(wi => {
        demand[wi][POLL_ACT] = (demand[wi][POLL_ACT] || 0) + pollHrs;
      });
    }
  });

  // Picking: from PickingMaster per crop (summed across all GHs that grow that crop)
  cropCycles.forEach(crop => {
    const pd = pickingData.find(d => d.cropId === crop.id);
    if (!pd?.timePerKg) return;
    const tpk = parseFloat(pd.timePerKg) || 0;
    if (!tpk) return;

    // Count how many sqm of this crop across all GHs
    let totalCropSqm = 0;
    greenhouses.forEach(gh => {
      const ghSqm = parseFloat(gh.sqm) || 0;
      const hasCrop = gh.splitZones
        ? gh.zoneA.crops.includes(crop.id) || gh.zoneB.crops.includes(crop.id)
        : gh.crops.includes(crop.id);
      if (hasCrop && ghSqm) totalCropSqm += ghSqm;
    });

    pd.weeklyVolumes.forEach((v, wi) => {
      const vol = parseFloat(v) || 0;
      if (!vol) return;
      // Scale by proportion of sqm if needed; for now use raw volume hours
      const hrs = vol * tpk;
      demand[wi][PICKING_ACT] = (demand[wi][PICKING_ACT] || 0) + hrs;
    });
  });

  return { demand, warnings, numWeeks };
}

export default function YearlyDemandPlanner({
  cropCycles, greenhouses, cropMasterData, activities,
  pollinationData, pickingData,
}) {
  const [calculated, setCalculated] = useState(false);

  const { demand, warnings, numWeeks } = useMemo(() => {
    if (!calculated) return { demand: [], warnings: [], numWeeks: 0 };
    return calcDemand({ cropCycles, greenhouses, cropMasterData, activities, pollinationData, pickingData });
  }, [calculated, cropCycles, greenhouses, cropMasterData, activities, pollinationData, pickingData]);

  // Which activities have any demand?
  const activeActs = activities.filter(act => demand.some(wk => (wk[act] || 0) > 0));

  const weeklyTotal = demand.map(wk => Object.values(wk).reduce((s, v) => s + v, 0));
  const grandTotal = weeklyTotal.reduce((s, v) => s + v, 0);

  const maxWeekly = Math.max(...weeklyTotal, 1);

  const cellColor = (hrs) => {
    if (!hrs) return LP.cream;
    const intensity = hrs / maxWeekly;
    if (intensity > 0.7) return "#2D6A4F";
    if (intensity > 0.4) return "#52B788";
    if (intensity > 0.1) return "#95D5B2";
    return "#D8F3DC";
  };

  const dataReadiness = () => {
    const issues = [];
    const hasGHSqm = greenhouses.some(g => g.sqm);
    const hasGHCrops = greenhouses.some(g => g.crops.length > 0 || (g.zoneA?.crops?.length > 0) || (g.zoneB?.crops?.length > 0));
    const hasCCM = cropCycles.some(c => Object.keys(c.matrix).length > 0);
    const hasCropRates = cropMasterData.some(d => Object.values(d.cells || {}).some(c => c.h));
    if (!hasGHSqm) issues.push("Greenhouse sqm not set");
    if (!hasGHCrops) issues.push("No crops assigned to greenhouses");
    if (!hasCCM) issues.push("Crop Cycle Master has no ticked activities");
    if (!hasCropRates) issues.push("Crop Master has no activity rates");
    return issues;
  };

  const issues = dataReadiness();
  const ready = issues.length === 0;

  return (
    <div style={{ borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 24px rgba(27,67,50,0.14)", border: `1px solid ${LP.border}` }}>
      {/* Header */}
      <div style={{ padding: "16px 24px", background: LP.forest, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: LP.white, fontSize: 16, fontWeight: 700, fontFamily: "'Palatino Linotype', Georgia, serif" }}>Yearly Demand Planner</div>
          <div style={{ color: LP.mint, fontSize: 12, marginTop: 3 }}>
            {calculated
              ? `${numWeeks} weeks · ${activeActs.length} active activities · ${grandTotal.toFixed(0)} total hrs`
              : "Calculates weekly labour demand from all masters"}
          </div>
        </div>
        <button
          onClick={() => setCalculated(true)}
          style={{ ...lpBtn(true, calculated ? LP.amber : LP.light), padding: "9px 24px" }}>
          {calculated ? "↻ Recalculate" : "▶ Calculate Demand"}
        </button>
      </div>

      {/* Readiness panel */}
      {!calculated && (
        <div style={{ padding: 24, background: LP.white }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: LP.textDark, marginBottom: 16 }}>Data readiness check</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, maxWidth: 700 }}>
            {[
              { label: "Greenhouse sqm", ok: greenhouses.some(g => g.sqm) },
              { label: "Crops assigned to GHs", ok: greenhouses.some(g => g.crops.length > 0 || g.zoneA?.crops?.length > 0 || g.zoneB?.crops?.length > 0) },
              { label: "Crop Cycle Master", ok: cropCycles.some(c => Object.keys(c.matrix).length > 0) },
              { label: "Crop Master rates", ok: cropMasterData.some(d => Object.values(d.cells || {}).some(c => c.h)) },
              { label: "Pollination Master", ok: pollinationData.some(d => d.hoursPerRound) },
              { label: "Picking Master", ok: pickingData.some(d => d.timePerKg && d.weeklyVolumes.some(v => parseFloat(v) > 0)) },
            ].map(({ label, ok }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: ok ? "#d8f3dc" : "#fff3cd", borderRadius: 8, border: `1px solid ${ok ? "#52B788" : "#C8870A"}` }}>
                <span style={{ fontSize: 16 }}>{ok ? "✓" : "⚠"}</span>
                <span style={{ fontSize: 13, color: ok ? LP.forest : LP.amber, fontWeight: ok ? 600 : 400 }}>{label}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, fontSize: 12, color: LP.textLight, fontStyle: "italic" }}>
            You can calculate with partial data — missing entries will show as 0. Complete all masters for accurate results.
          </div>
        </div>
      )}

      {/* Results */}
      {calculated && (
        <>
          {warnings.length > 0 && (
            <div style={{ padding: "8px 20px", background: LP.amberLight, borderBottom: `1px solid ${LP.amber}`, fontSize: 12, color: LP.amber }}>
              ⚠️ {warnings.join(" · ")}
            </div>
          )}

          {activeActs.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: LP.textLight, fontStyle: "italic" }}>
              No demand calculated — check that masters are configured with activity rates.
            </div>
          ) : (
            <div style={{ overflow: "auto", maxHeight: "calc(100vh - 260px)" }}>
              <table style={{ borderCollapse: "collapse", fontSize: 11 }}>
                <colgroup>
                  <col style={{ width: 60 }} />
                  {activeActs.map(a => <col key={a} style={{ width: 80 }} />)}
                  <col style={{ width: 80 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ position: "sticky", top: 0, left: 0, zIndex: 4, background: LP.forest, color: LP.white, padding: "8px 10px", textAlign: "center", fontWeight: 700, borderBottom: `2px solid ${LP.mid}`, whiteSpace: "nowrap" }}>
                      Week
                    </th>
                    {activeActs.map(act => (
                      <th key={act} style={{ position: "sticky", top: 0, zIndex: 2, background: LP.forest, color: LP.white, padding: "8px 6px", textAlign: "center", fontWeight: 600, borderBottom: `2px solid ${LP.mid}`, borderLeft: "1px solid rgba(255,255,255,0.1)", whiteSpace: "nowrap", fontSize: 10 }}>
                        {act}
                      </th>
                    ))}
                    <th style={{ position: "sticky", top: 0, zIndex: 2, background: LP.mid, color: LP.white, padding: "8px 10px", textAlign: "center", fontWeight: 700, borderBottom: `2px solid ${LP.mid}`, borderLeft: `2px solid ${LP.light}` }}>
                      TOTAL
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: numWeeks }, (_, wi) => {
                    const wkTotal = weeklyTotal[wi] || 0;
                    const rowBg = wi % 2 === 0 ? LP.white : "#F5F8F5";
                    return (
                      <tr key={wi}>
                        <td style={{ position: "sticky", left: 0, zIndex: 1, background: LP.forest, color: LP.mint, padding: "6px 10px", textAlign: "center", fontWeight: 700, borderBottom: `1px solid rgba(255,255,255,0.1)`, borderRight: `2px solid ${LP.mid}` }}>
                          W{wi + 1}
                        </td>
                        {activeActs.map(act => {
                          const hrs = demand[wi]?.[act] || 0;
                          return (
                            <td key={act} style={{
                              padding: "6px 4px", textAlign: "center",
                              background: hrs > 0 ? cellColor(hrs) : rowBg,
                              color: hrs > 0 ? (hrs / maxWeekly > 0.4 ? LP.white : LP.forest) : LP.textLight,
                              borderBottom: `1px solid ${LP.borderLight}`,
                              borderLeft: "1px solid rgba(0,0,0,0.05)",
                              fontWeight: hrs > 0 ? 600 : 400,
                            }}>
                              {hrs > 0 ? hrs.toFixed(1) : "–"}
                            </td>
                          );
                        })}
                        <td style={{
                          padding: "6px 8px", textAlign: "center", fontWeight: 800,
                          background: wkTotal > 0 ? LP.mint : rowBg,
                          color: LP.forest,
                          borderBottom: `1px solid ${LP.borderLight}`,
                          borderLeft: `2px solid ${LP.light}`,
                        }}>
                          {wkTotal > 0 ? wkTotal.toFixed(1) : "–"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: LP.forest }}>
                    <td style={{ padding: "8px 10px", color: LP.white, fontWeight: 700, textAlign: "center" }}>Total</td>
                    {activeActs.map(act => {
                      const t = demand.reduce((s, wk) => s + (wk[act] || 0), 0);
                      return (
                        <td key={act} style={{ padding: "8px 4px", color: LP.mint, fontWeight: 700, textAlign: "center", borderLeft: "1px solid rgba(255,255,255,0.1)" }}>
                          {t > 0 ? t.toFixed(0) : "–"}
                        </td>
                      );
                    })}
                    <td style={{ padding: "8px 8px", color: LP.white, fontWeight: 800, textAlign: "center", borderLeft: `2px solid ${LP.light}`, fontSize: 13 }}>
                      {grandTotal.toFixed(0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
