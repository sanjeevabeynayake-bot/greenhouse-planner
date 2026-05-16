import React, { useState, useEffect } from "react";
import { SEED_CROPS, SEED_ACTIVITIES, SEED_GREENHOUSES } from "../data/masterSeeds";
import { LP, lpBtn } from "./styles";
import LPDashboard from "./LPDashboard";
import CropCycleMaster from "./CropCycleMaster";
import GreenhouseMaster from "./GreenhouseMaster";
import CropMaster from "./CropMaster";
import PollinationMaster from "./PollinationMaster";
import PickingMaster from "./PickingMaster";
import YearlyDemandPlanner from "./YearlyDemandPlanner";

const MASTER_TABS = [
  { id: "dashboard",   label: "Dashboard",             icon: "🏠" },
  { id: "cropCycle",   label: "Crop Cycle Master",    icon: "🌱" },
  { id: "greenhouse",  label: "Greenhouse Master",     icon: "🏗️" },
  { id: "cropMaster",  label: "Crop Master",           icon: "📊" },
  { id: "pollination", label: "Pollination Master",    icon: "🌸" },
  { id: "picking",     label: "Picking Master",        icon: "🍅" },
  { id: "yearly",      label: "Yearly Demand Planner", icon: "📈" },
];

const LS_KEY = "labourPlanner_v1";

function loadLS() {
  try {
    const r = localStorage.getItem(LS_KEY);
    if (!r) return null;
    const parsed = JSON.parse(r);
    if (parsed.harvestingData && !parsed.pickingData) {
      parsed.pickingData = parsed.harvestingData;
    }
    return parsed;
  } catch { return null; }
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

const LP_EXPLAINER = {
  dashboard: {
    title: "Labour Planner — Dashboard",
    what: "A summary view of your entire labour planning setup. See at a glance how many greenhouses, crop cycles, and activities are configured, and whether your data is ready to generate demand.",
    steps: [
      "Review the summary cards to check what has been set up.",
      "If any section shows 0 or empty, navigate to that master tab to fill it in.",
      "Once all masters are complete, use the Yearly Demand Planner to generate weekly hour targets.",
    ],
  },
  cropCycle: {
    title: "Crop Cycle Master",
    what: "Define the weekly activity matrix for each crop — which activities happen in which week of the crop's life cycle and how many times per week. This is the foundation of all labour demand calculations.",
    steps: [
      "Select a crop from the list on the left.",
      "Set the total number of weeks in the crop cycle.",
      "For each activity row, enter how many times per week that activity occurs in each week column.",
      "Leave blank (or 0) for weeks where that activity does not occur.",
      "Repeat for every crop.",
    ],
  },
  greenhouse: {
    title: "Greenhouse Master",
    what: "Record each greenhouse's physical size and which crops it contains. Optionally split a greenhouse into Zone A and Zone B with different crops. This data drives area-based labour demand calculations.",
    steps: [
      "Click 'Add Greenhouse' to create a new greenhouse entry.",
      "Enter the name and total square metres.",
      "Assign one or more crops to the greenhouse.",
      "Toggle 'Split Zones' if the greenhouse has two distinct growing areas with different crops.",
      "Save each greenhouse before moving on.",
    ],
  },
  cropMaster: {
    title: "Crop Master",
    what: "Set planting density (plants per sqm) and optionally a density change schedule across the crop's weeks. Density combined with area and the crop cycle matrix produces your total weekly labour hours.",
    steps: [
      "Select a crop from the list.",
      "Enter the base planting density (plants/sqm).",
      "If density changes over the cycle (e.g. thinning), enter week-by-week density values in the grid.",
      "Leave weeks blank to use the base density.",
    ],
  },
  pollination: {
    title: "Pollination Master",
    what: "Record pollination labour requirements per greenhouse — how many hours each pollination round takes and how many rounds happen per week. This feeds directly into weekly demand totals.",
    steps: [
      "Each greenhouse appears as a row automatically.",
      "Enter 'Hours per round' — how long one full pollination pass takes.",
      "Enter 'Rounds per week' — how many times per week pollination occurs.",
      "Total weekly pollination hours are calculated automatically.",
    ],
  },
  picking: {
    title: "Picking Master",
    what: "Configure harvest (picking) labour parameters per crop — kg picked per hour, hours per sqm, rounds per week, and a weekly production volume curve. This determines picking labour demand across the season.",
    steps: [
      "Select a crop.",
      "Enter 'kg per hour' — your typical picking productivity.",
      "Enter 'Hours per sqm' — an alternative area-based rate if preferred.",
      "Enter rounds per week and the weekly volume curve (or use the curve parameters to auto-fill).",
      "The system will calculate picking hours for each week of the season.",
    ],
  },
  yearly: {
    title: "Yearly Demand Planner",
    what: "The master demand calendar. Combines all master data — crop cycles, greenhouse areas, densities, pollination, and picking — to calculate total labour hours needed for each week of the year. Feed these weekly totals into the Weekly Scheduler.",
    steps: [
      "Select or create a plan (top left).",
      "Set the plan start date — Week 1 begins on this date.",
      "Review the auto-calculated weekly hour totals per greenhouse and activity.",
      "Adjust any cell manually if your real-world situation differs from the calculated value.",
      "Confirmed plans sync to the Weekly Scheduler's Demand tab automatically.",
    ],
  },
};

function LPExplainerBtn({ tabKey }) {
  const c = LP_EXPLAINER[tabKey];
  const [open, setOpen] = React.useState(false);
  if (!c) return null;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "absolute", top: 14, right: 16,
          background: "rgba(27,67,50,0.08)", color: "#1b4332",
          border: "1px solid rgba(27,67,50,0.22)", borderRadius: 8,
          padding: "5px 13px", fontSize: 12, fontWeight: 600,
          cursor: "pointer", zIndex: 10,
        }}
      >? Help</button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 14, padding: 28,
              maxWidth: 520, width: "90%", boxShadow: "0 8px 40px rgba(0,0,0,0.22)",
              maxHeight: "80vh", overflowY: "auto",
            }}
          >
            <h3 style={{ margin: "0 0 10px", color: "#1b4332", fontSize: 17 }}>{c.title}</h3>
            <p style={{ margin: "0 0 14px", color: "#374151", fontSize: 13, lineHeight: 1.6 }}><strong>What this tab does:</strong><br />{c.what}</p>
            <p style={{ margin: "0 0 8px", color: "#374151", fontSize: 13, fontWeight: 700 }}>How to use it:</p>
            <ol style={{ margin: 0, paddingLeft: 20 }}>
              {c.steps.map((s, i) => (
                <li key={i} style={{ color: "#374151", fontSize: 13, lineHeight: 1.7 }}>{s}</li>
              ))}
            </ol>
            <button
              onClick={() => setOpen(false)}
              style={{
                marginTop: 20, background: "#1b4332", color: "#fff",
                border: "none", borderRadius: 8, padding: "8px 22px",
                cursor: "pointer", fontWeight: 600, fontSize: 13,
              }}
            >Close</button>
          </div>
        </div>
      )}
    </>
  );
}

export default function LabourPlanner({ lpRole: initRole }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [lpRole, setLpRole] = useState(initRole || "grower");

  const [activities, setActivities] = useState(() => loadLS()?.activities ?? SEED_ACTIVITIES);
  const [cropCycles, setCropCycles] = useState(() => loadLS()?.cropCycles ?? initCycles());
  const [greenhouses, setGreenhouses] = useState(() => loadLS()?.greenhouses ?? initGreenhouses());
  const [cropMasterData, setCropMasterData] = useState(() => loadLS()?.cropMasterData ?? []);
  const [pollinationData, setPollinationData] = useState(() => loadLS()?.pollinationData ?? []);
  const [pickingData, setPickingData] = useState(() => loadLS()?.pickingData ?? []);

  // When App's snapshot load writes labourPlanner_v1 to localStorage, re-read it here
  useEffect(() => {
    const handler = () => {
      const fresh = loadLS();
      if (!fresh) return;
      if (fresh.activities) setActivities(fresh.activities);
      if (fresh.cropCycles) setCropCycles(fresh.cropCycles);
      if (fresh.greenhouses) setGreenhouses(fresh.greenhouses);
      if (fresh.cropMasterData) setCropMasterData(fresh.cropMasterData);
      if (fresh.pollinationData) setPollinationData(fresh.pollinationData);
      if (fresh.pickingData) setPickingData(fresh.pickingData);
    };
    window.addEventListener("lp-snapshot-loaded", handler);
    return () => window.removeEventListener("lp-snapshot-loaded", handler);
  }, []);

  useEffect(() => {
    setCropMasterData(prev => {
      const map = Object.fromEntries(prev.map(d => [d.cropId, d]));
      return cropCycles.map(c => map[c.id] ?? { cropId: c.id, density: "", densityWeeks: null, cells: {} });
    });
    setPickingData(prev => {
      const map = Object.fromEntries(prev.map(d => [d.cropId, d]));
      return cropCycles.map(c => map[c.id] ?? {
        cropId: c.id,
        kgPerHour: "",
        hrsPerSqm: "",
        roundsPerWeek: "",
        weeklyVolumes: Array(c.weeks).fill(""),
        curveParams: { start: "", peak: "", peakWeek: "", end: "" },
      });
    });
  }, [cropCycles]);

  useEffect(() => {
    setPollinationData(prev => {
      const map = Object.fromEntries(prev.map(d => [d.ghId, d]));
      return greenhouses.map(gh => map[gh.id] ?? { ghId: gh.id, ghName: gh.name, hoursPerRound: "", roundsPerWeek: "" });
    });
  }, [greenhouses]);

  // Save to localStorage whenever any LP state changes
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({
      activities, cropCycles, greenhouses, cropMasterData, pollinationData, pickingData,
    }));
  }, [activities, cropCycles, greenhouses, cropMasterData, pollinationData, pickingData]);

  const sharedProps = {
    activities, setActivities,
    cropCycles, setCropCycles,
    greenhouses, setGreenhouses,
    cropMasterData, setCropMasterData,
    pollinationData, setPollinationData,
    pickingData, setPickingData,
    lpRole, LP,
  };

  return (
    <div style={{
      fontFamily: "'Trebuchet MS', 'Gill Sans MT', 'Segoe UI', sans-serif",
      minHeight: "calc(100vh - 62px)",
      background: LP.cream,
    }}>
      <div style={{
        background: LP.forest,
        padding: "0 20px",
        display: "flex", alignItems: "stretch",
        boxShadow: "0 2px 12px rgba(27,67,50,0.22)",
      }}>
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
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "0 4px 0 16px",
          borderLeft: "1px solid rgba(255,255,255,0.14)",
          flexShrink: 0,
        }}>
          <span style={{ color: "rgba(255,255,255,0.42)", fontSize: 11, whiteSpace: "nowrap" }}>View:</span>
          {[{ id: "gm", label: "👔 GM" }, { id: "grower", label: "🌱 Grower" }].map(r => (
            <button key={r.id} onClick={() => setLpRole(r.id)} style={{
              background: lpRole === r.id ? LP.mid : "transparent",
              color: lpRole === r.id ? LP.white : "rgba(255,255,255,0.5)",
              border: `1px solid ${lpRole === r.id ? LP.light : "rgba(255,255,255,0.18)"}`,
              borderRadius: 6, padding: "6px 12px",
              cursor: "pointer", fontSize: 12, fontWeight: 600,
              minHeight: 36, whiteSpace: "nowrap", transition: "all 0.12s",
            }}>{r.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: 20, maxWidth: 1600, margin: "0 auto" }}>
        {activeTab === "dashboard"   && (
          <div style={{ position: "relative" }}>
            <LPExplainerBtn tabKey="dashboard" />
            <LPDashboard
              cropCycles={cropCycles}
              cropMasterData={cropMasterData}
              greenhouses={greenhouses}
              pollinationData={pollinationData}
              pickingData={pickingData}
              activities={activities}
            />
          </div>
        )}
        {activeTab === "cropCycle"   && <div style={{ position: "relative" }}><LPExplainerBtn tabKey="cropCycle" /><CropCycleMaster {...sharedProps} /></div>}
        {activeTab === "greenhouse"  && <div style={{ position: "relative" }}><LPExplainerBtn tabKey="greenhouse" /><GreenhouseMaster {...sharedProps} /></div>}
        {activeTab === "cropMaster"  && <div style={{ position: "relative" }}><LPExplainerBtn tabKey="cropMaster" /><CropMaster {...sharedProps} /></div>}
        {activeTab === "pollination" && <div style={{ position: "relative" }}><LPExplainerBtn tabKey="pollination" /><PollinationMaster {...sharedProps} /></div>}
        {activeTab === "picking"     && <div style={{ position: "relative" }}><LPExplainerBtn tabKey="picking" /><PickingMaster {...sharedProps} /></div>}
        {activeTab === "yearly"      && <div style={{ position: "relative" }}><LPExplainerBtn tabKey="yearly" /><YearlyDemandPlanner {...sharedProps} /></div>}
      </div>
    </div>
  );
}
