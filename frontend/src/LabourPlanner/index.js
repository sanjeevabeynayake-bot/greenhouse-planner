import React, { useState, useEffect, useRef } from "react";
import { SEED_CROPS, SEED_ACTIVITIES, SEED_GREENHOUSES } from "../data/masterSeeds";
import { LP, lpBtn } from "./styles";
import LPDashboard from "./LPDashboard";
import CropCycleMaster from "./CropCycleMaster";
import GreenhouseMaster from "./GreenhouseMaster";
import CropMaster from "./CropMaster";
import PollinationMaster from "./PollinationMaster";
import PickingMaster from "./PickingMaster";
import YearlyDemandPlanner from "./YearlyDemandPlanner";

const API = "https://greenhouse-planner-backend.onrender.com";

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

export default function LabourPlanner({ lpRole: initRole }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [lpRole, setLpRole] = useState(initRole || "grower");
  const [syncStatus, setSyncStatus] = useState("idle"); // "idle" | "pending" | "saving" | "error"

  const [activities, setActivities] = useState(() => loadLS()?.activities ?? SEED_ACTIVITIES);
  const [cropCycles, setCropCycles] = useState(() => loadLS()?.cropCycles ?? initCycles());
  const [greenhouses, setGreenhouses] = useState(() => loadLS()?.greenhouses ?? initGreenhouses());
  const [cropMasterData, setCropMasterData] = useState(() => loadLS()?.cropMasterData ?? []);
  const [pollinationData, setPollinationData] = useState(() => loadLS()?.pollinationData ?? []);
  const [pickingData, setPickingData] = useState(() => loadLS()?.pickingData ?? []);

  const cloudSaveTimer = useRef(null);
  const cloudLoaded = useRef(false);
  const [retryKey, setRetryKey] = useState(0);

  // ── Cloud load on mount: override local state if cloud has data ──────────
  useEffect(() => {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 55000);
    fetch(`${API}/lp-data`, { signal: ac.signal })
      .then(r => r.json())
      .then(data => {
        clearTimeout(timeout);
        const hasLPData = data && typeof data === "object" && (data.cropCycles?.length > 0 || data.greenhouses?.length > 0 || data.activities?.length > 0);
        if (hasLPData) {
          // Cloud has data — use it
          if (data.activities) setActivities(data.activities);
          if (data.cropCycles) setCropCycles(data.cropCycles);
          if (data.greenhouses) setGreenhouses(data.greenhouses);
          if (data.cropMasterData) setCropMasterData(data.cropMasterData);
          if (data.pollinationData) setPollinationData(data.pollinationData);
          if (data.pickingData) setPickingData(data.pickingData);
          setSyncStatus("idle");
        } else {
          // Cloud empty — seed from current localStorage state (happens once for the owner)
          const ls = loadLS();
          if (ls) {
            fetch(`${API}/lp-data`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(ls),
            }).catch(() => {});
          }
          setSyncStatus("idle");
        }
        cloudLoaded.current = true;
      })
      .catch(e => {
        clearTimeout(timeout);
        setSyncStatus("error");
        cloudLoaded.current = true;
      });
    return () => { clearTimeout(timeout); ac.abort(); };
  }, [retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived state syncs (unchanged) ─────────────────────────────────────
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

  // ── localStorage save (immediate) ───────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({
      activities, cropCycles, greenhouses, cropMasterData, pollinationData, pickingData,
    }));
  }, [activities, cropCycles, greenhouses, cropMasterData, pollinationData, pickingData]);

  // ── Debounced cloud save (3s after last change) ──────────────────────────
  useEffect(() => {
    if (!cloudLoaded.current) return; // don't save until initial cloud load resolves
    setSyncStatus("pending");
    if (cloudSaveTimer.current) clearTimeout(cloudSaveTimer.current);
    cloudSaveTimer.current = setTimeout(() => {
      setSyncStatus("saving");
      fetch(`${API}/lp-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activities, cropCycles, greenhouses, cropMasterData, pollinationData, pickingData }),
      })
        .then(() => setSyncStatus("idle"))
        .catch(() => setSyncStatus("error"));
    }, 3000);
    return () => clearTimeout(cloudSaveTimer.current);
  }, [activities, cropCycles, greenhouses, cropMasterData, pollinationData, pickingData]); // eslint-disable-line react-hooks/exhaustive-deps

  const sharedProps = {
    activities, setActivities,
    cropCycles, setCropCycles,
    greenhouses, setGreenhouses,
    cropMasterData, setCropMasterData,
    pollinationData, setPollinationData,
    pickingData, setPickingData,
    lpRole, LP,
  };

  const syncBadge = {
    idle:    { text: "☁ Synced",   color: "#52B788" },
    pending: { text: "● Unsaved",  color: "#f59e0b" },
    saving:  { text: "⟳ Saving…", color: "#60a5fa" },
    error:   { text: "⚠ No cloud", color: "#f87171" },
  }[syncStatus];

  const retryCloudSync = () => {
    cloudLoaded.current = false;
    setSyncStatus("saving");
    setRetryKey(k => k + 1);
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
          display: "flex", alignItems: "center", gap: 10,
          padding: "0 4px 0 16px",
          borderLeft: "1px solid rgba(255,255,255,0.14)",
          flexShrink: 0,
        }}>
          {/* Cloud sync badge */}
          <span style={{ fontSize: 11, color: syncBadge.color, whiteSpace: "nowrap", fontWeight: 600 }}>
            {syncBadge.text}
          </span>
          {syncStatus === "error" && (
            <button onClick={retryCloudSync} style={{ background: "#f87171", color: "white", border: "none", borderRadius: 5, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
              Retry
            </button>
          )}
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
          <LPDashboard
            cropCycles={cropCycles}
            cropMasterData={cropMasterData}
            greenhouses={greenhouses}
            pollinationData={pollinationData}
            pickingData={pickingData}
            activities={activities}
          />
        )}
        {activeTab === "cropCycle"   && <CropCycleMaster {...sharedProps} />}
        {activeTab === "greenhouse"  && <GreenhouseMaster {...sharedProps} />}
        {activeTab === "cropMaster"  && <CropMaster {...sharedProps} />}
        {activeTab === "pollination" && <PollinationMaster {...sharedProps} />}
        {activeTab === "picking"     && <PickingMaster {...sharedProps} />}
        {activeTab === "yearly"      && <YearlyDemandPlanner {...sharedProps} />}
      </div>
    </div>
  );
}
