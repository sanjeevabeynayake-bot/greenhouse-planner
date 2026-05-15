import React, { useState, useEffect } from "react";
import { SEED_CROPS, SEED_ACTIVITIES, SEED_GREENHOUSES } from "../data/masterSeeds";
import { LP, lpBtn } from "./styles";
import CropCycleMaster from "./CropCycleMaster";
import GreenhouseMaster from "./GreenhouseMaster";
import CropMaster from "./CropMaster";
import PollinationMaster from "./PollinationMaster";
import HarvestingMaster from "./HarvestingMaster";

const MASTER_TABS = [
  { id: "cropCycle",   label: "Crop Cycle Master",   icon: "🌱" },
  { id: "greenhouse",  label: "Greenhouse Master",    icon: "🏗️" },
  { id: "cropMaster",  label: "Crop Master",          icon: "📊" },
  { id: "pollination", label: "Pollination Master",   icon: "🌸" },
  { id: "harvesting",  label: "Harvesting Master",    icon: "🌾" },
];

const LS_KEY = "labourPlanner_v1";

function loadLS() {
  try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null; }
  catch { return null; }
}

function initCycles() {
  return SEED_CROPS.map((name, i) => ({
    id: `crop-seed-${i}`,
    name,
    weeks: 24,
    matrix: {},
  }));
}

function initGreenhouses() {
  return SEED_GREENHOUSES.map((name, i) => ({
    id: `gh-seed-${i}`,
    name,
    sqm: "",
    crops: [],
    splitZones: false,
    zoneA: { sqm: "", crops: [] },
    zoneB: { sqm: "", crops: [] },
    lastEdited: null,
  }));
}

export default function LabourPlanner({ role }) {
  const [activeTab, setActiveTab] = useState("cropCycle");
  // Grower view is read-only; GM view allows editing
  const [lpRole, setLpRole] = useState(role === "gm" ? "gm" : "grower");

  // ── Shared master data ──
  const [activities, setActivities] = useState(() => loadLS()?.activities ?? SEED_ACTIVITIES);
  const [cropCycles, setCropCycles] = useState(() => loadLS()?.cropCycles ?? initCycles());
  const [greenhouses, setGreenhouses] = useState(() => loadLS()?.greenhouses ?? initGreenhouses());
  const [cropMasterData, setCropMasterData] = useState(() => loadLS()?.cropMasterData ?? []);
  const [pollinationData, setPollinationData] = useState(() => loadLS()?.pollinationData ?? []);
  const [harvestingData, setHarvestingData] = useState(() => loadLS()?.harvestingData ?? []);

  // Keep cropMasterData rows in sync with cropCycles list
  useEffect(() => {
    setCropMasterData(prev => {
      const map = Object.fromEntries(prev.map(d => [d.cropId, d]));
      return cropCycles.map(c => map[c.id] ?? { cropId: c.id, density: "", cells: {} });
    });
    setHarvestingData(prev => {
      const map = Object.fromEntries(prev.map(d => [d.cropId, d]));
      return cropCycles.map(c => map[c.id] ?? {
        cropId: c.id, timePerKg: "",
        weeklyVolumes: Array(c.weeks).fill(""),
        curveParams: { start: "", peak: "", peakWeek: "", end: "" },
      });
    });
  }, [cropCycles]);

  // Keep pollinationData rows in sync with greenhouse list
  useEffect(() => {
    setPollinationData(prev => {
      const map = Object.fromEntries(prev.map(d => [d.ghId, d]));
      return greenhouses.map(gh => map[gh.id] ?? { ghId: gh.id, ghName: gh.name, hoursPerRound: "" });
    });
  }, [greenhouses]);

  // Persist all master state to localStorage
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({
      activities, cropCycles, greenhouses, cropMasterData, pollinationData, harvestingData,
    }));
  }, [activities, cropCycles, greenhouses, cropMasterData, pollinationData, harvestingData]);

  const sharedProps = {
    activities, setActivities,
    cropCycles, setCropCycles,
    greenhouses, setGreenhouses,
    cropMasterData, setCropMasterData,
    pollinationData, setPollinationData,
    harvestingData, setHarvestingData,
    lpRole, LP,
  };

  return (
    <div style={{
      fontFamily: "'Trebuchet MS', 'Gill Sans MT', 'Segoe UI', sans-serif",
      minHeight: "calc(100vh - 62px)",
      background: LP.cream,
    }}>
      {/* ── Labour Planner sub-navbar ── */}
      <div style={{
        background: LP.forest,
        padding: "0 20px",
        display: "flex", alignItems: "stretch",
        boxShadow: "0 2px 12px rgba(27,67,50,0.22)",
      }}>
        {/* Master section tabs */}
        <div style={{ display: "flex", flex: 1, overflowX: "auto" }}>
          {MASTER_TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              background: activeTab === t.id ? "rgba(255,255,255,0.14)" : "transparent",
              color: activeTab === t.id ? LP.white : "rgba(255,255,255,0.58)",
              border: "none",
              borderBottom: activeTab === t.id ? `3px solid ${LP.light}` : "3px solid transparent",
              padding: "13px 16px",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: activeTab === t.id ? 700 : 400,
              whiteSpace: "nowrap",
              transition: "all 0.12s",
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Role toggle */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "0 4px 0 16px",
          borderLeft: "1px solid rgba(255,255,255,0.14)",
          flexShrink: 0,
        }}>
          <span style={{ color: "rgba(255,255,255,0.42)", fontSize: 11, whiteSpace: "nowrap" }}>View:</span>
          {[
            { id: "gm", label: "👔 GM" },
            { id: "grower", label: "🌱 Grower" },
          ].map(r => (
            <button key={r.id} onClick={() => setLpRole(r.id)} style={{
              background: lpRole === r.id ? LP.mid : "transparent",
              color: lpRole === r.id ? LP.white : "rgba(255,255,255,0.5)",
              border: `1px solid ${lpRole === r.id ? LP.light : "rgba(255,255,255,0.18)"}`,
              borderRadius: 6, padding: "6px 12px",
              cursor: "pointer", fontSize: 12, fontWeight: 600,
              minHeight: 36, whiteSpace: "nowrap",
              transition: "all 0.12s",
            }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ padding: 20, maxWidth: 1600, margin: "0 auto" }}>
        {activeTab === "cropCycle"   && <CropCycleMaster {...sharedProps} />}
        {activeTab === "greenhouse"  && <GreenhouseMaster {...sharedProps} />}
        {activeTab === "cropMaster"  && <CropMaster {...sharedProps} />}
        {activeTab === "pollination" && <PollinationMaster {...sharedProps} />}
        {activeTab === "harvesting"  && <HarvestingMaster {...sharedProps} />}
      </div>
    </div>
  );
}
