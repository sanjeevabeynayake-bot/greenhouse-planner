import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import LabourPlanner from './LabourPlanner';

const API = "https://greenhouse-planner-backend.onrender.com";
const ALL_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const DEFAULT_ACTIVITIES = ["Planting","Watering & Irrigation","Fertilizing","De-leafing & Pruning","Harvesting","Pest & Disease Control","Soil & Media Preparation","Transplanting","Trellising & Training","Climate Control","Quality Inspection","Packaging & Grading","Cleaning & Sanitation","Equipment Maintenance","Crop Monitoring"];
const DEFAULT_GHS = Array.from({length:30},(_,i)=>({id:`GH-${String(i+1).padStart(2,"0")}`,name:`GH-${String(i+1).padStart(2,"0")}`,cropTypes:[]}));
const DEFAULT_CROPS = ["Tomato Standard","Tomato Cherry","Cucumber Standard","Cucumber Mini","Other"];
const DAY_SHORT = {"Monday":"Mon","Tuesday":"Tue","Wednesday":"Wed","Thursday":"Thu","Friday":"Fri","Saturday":"Sat","Sunday":"Sun"};
const C = {
  navy:"#1a3a5c",teal:"#0d7377",green:"#2ecc71",orange:"#e67e22",
  red:"#e74c3c",purple:"#8e44ad",blue:"#2980b9",gold:"#f39c12",
  bg:"#f0f4f8",white:"#ffffff",light:"#f8f9fa",border:"#dee2e6",
  textDark:"#1a3a5c",textMid:"#555",textLight:"#888"
};

const fmtDate=(iso)=>{if(!iso)return"";const d=new Date(iso);return d.toLocaleDateString("en-AU",{weekday:"short",day:"2-digit",month:"short",year:"numeric"});};
const fmtDateShort=(iso)=>{if(!iso)return"";const d=new Date(iso);return d.toLocaleDateString("en-AU",{day:"2-digit",month:"short"});};
const addDays=(iso,n)=>{const d=new Date(iso);d.setDate(d.getDate()+n);return d.toISOString().split("T")[0];};
const todayISO=()=>new Date().toISOString().split("T")[0];
const fmtISOReadable=(iso)=>{if(!iso)return"";try{return new Date(iso).toLocaleString("en-AU",{timeZone:"Australia/Adelaide",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:true});}catch{return iso;}};
const buildWeekDates=(startDate)=>{if(!startDate)return{};const map={};ALL_DAYS.forEach((day,i)=>{map[day]=addDays(startDate,i);});return map;};

// ─── JSON Export helper ───────────────────────────────────────────────────────
const downloadJSON=(data,filename)=>{
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=filename;a.click();
  URL.revokeObjectURL(url);
};

export default function App() {
  const [role,setRole]=useState(null);
  const [page,setPage]=useState("dashboard");
  const [staff,setStaff]=useState([]);
  const [greenhouses,setGreenhouses]=useState(DEFAULT_GHS);
  const [activities,setActivities]=useState(DEFAULT_ACTIVITIES);
  const [cropTypes,setCropTypes]=useState(DEFAULT_CROPS);
  const [demand,setDemand]=useState({});
  const [schedule,setSchedule]=useState(null);
  const [scheduleSummary,setScheduleSummary]=useState(null);
  const [absences,setAbsences]=useState({});
  const [clusters,setClusters]=useState([]);
  const [clusterTransitions,setClusterTransitions]=useState({});
  const [selectedStaff,setSelectedStaff]=useState(null);
  const [masterDefaults,setMasterDefaults]=useState({hoursPerDay:7,overtimeLimit:30});
  const [saved,setSaved]=useState(false);
  const [loading,setLoading]=useState(true);
  const [generating,setGenerating]=useState(false);
  const [tolerance,setTolerance]=useState(5);
  const [scheduleStale,setScheduleStale]=useState(false);
  const [adelaideTime,setAdelaideTime]=useState("");
  const [quarantine,setQuarantine]=useState([]);
  const [quarantineHistory,setQuarantineHistory]=useState([]);
  const [auditLog,setAuditLog]=useState(()=>{try{return JSON.parse(localStorage.getItem("ws_audit_log_v1"))||[];}catch{return [];}});
  const [showAudit,setShowAudit]=useState(false);
  const [auditFilter,setAuditFilter]=useState("all");
  const [cycles,setCycles]=useState([]);
  const [activeCycleId,setActiveCycleId]=useState(null);
  const [activeWeekIndex,setActiveWeekIndex]=useState(0);
  const [overtimeEntries,setOvertimeEntries]=useState([]);
  const [backupReminder,setBackupReminder]=useState(false);
  const [efficiencyScore,setEfficiencyScore]=useState(null);
  // Import state
  const [importMode,setImportMode]=useState(null); // null | 'json' | 'csv'
  const [importPreview,setImportPreview]=useState(null);
  const [importData,setImportData]=useState(null);
  const [importMergeMode,setImportMergeMode]=useState("replace");
  const [mainSection,setMainSection]=useState(null);
  const [lpRole,setLpRole]=useState(null);
  const [wsHolidays,setWsHolidays]=useState(()=>{try{return JSON.parse(localStorage.getItem("ws_holidays_v1"))||[];}catch{return [];}});
  const [dailyAllocation,setDailyAllocation]=useState(()=>{try{return JSON.parse(localStorage.getItem("ws_daily_alloc_v1"))||{};}catch{return {};}});
  const [confirmedWeeks,setConfirmedWeeks]=useState(()=>{try{return JSON.parse(localStorage.getItem("ws_confirmed_weeks_v1"))||{};}catch{return {};}});
  const [scheduleData,setScheduleData]=useState(()=>{try{return JSON.parse(localStorage.getItem("ws_schedule_v1"))||{};}catch{return {};}});
  const [carStandards,setCarStandards]=useState(()=>{try{return JSON.parse(localStorage.getItem("ws_car_standards_v1"))||{};}catch{return {};}});
  const [demandVersion,setDemandVersion]=useState(0);

  useEffect(()=>{
    const tick=()=>setAdelaideTime(new Date().toLocaleString("en-AU",{timeZone:"Australia/Adelaide",weekday:"short",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:true}));
    tick();const t=setInterval(tick,1000);return()=>clearInterval(t);
  },[]);

  useEffect(()=>{
    axios.get(`${API}/data`).then(res=>{
      const d=res.data;
      if(d.staff?.length>0)setStaff(d.staff.map(normaliseStaff));
      if(d.greenhouses?.length>0)setGreenhouses(d.greenhouses);
      if(d.activities?.length>0)setActivities(d.activities);
      if(d.cropTypes?.length>0)setCropTypes(d.cropTypes);
      if(d.clusters)setClusters(d.clusters);
      if(d.clusterTransitions)setClusterTransitions(d.clusterTransitions);
      if(d.demand)setDemand(d.demand);
      if(d.absences)setAbsences(d.absences);
      if(d.schedule)setSchedule(d.schedule);
      if(d.scheduleSummary){setScheduleSummary(d.scheduleSummary);if(d.scheduleSummary.efficiencyScore!=null)setEfficiencyScore(d.scheduleSummary.efficiencyScore);}
      if(d.settings)setTolerance(d.settings.tolerance||5);
      if(d.quarantine)setQuarantine(d.quarantine);
      if(d.quarantineHistory)setQuarantineHistory(d.quarantineHistory);
      if(d.cycles?.length>0){setCycles(d.cycles);setActiveCycleId(d.activeCycleId||d.cycles[0]?.id);}
    }).catch(()=>{}).finally(()=>setLoading(false));
  },[]);

  useEffect(()=>{localStorage.setItem("ws_holidays_v1",JSON.stringify(wsHolidays));},[wsHolidays]);
  useEffect(()=>{localStorage.setItem("ws_daily_alloc_v1",JSON.stringify(dailyAllocation));},[dailyAllocation]);
  useEffect(()=>{localStorage.setItem("ws_confirmed_weeks_v1",JSON.stringify(confirmedWeeks));},[confirmedWeeks]);
  useEffect(()=>{localStorage.setItem("ws_schedule_v1",JSON.stringify(scheduleData));},[scheduleData]);
  useEffect(()=>{localStorage.setItem("ws_car_standards_v1",JSON.stringify(carStandards));},[carStandards]);
  useEffect(()=>{localStorage.setItem("ws_audit_log_v1",JSON.stringify(auditLog));},[auditLog]);

  const addAuditEntry=React.useCallback((type,label,meta={})=>{
    const entry={id:`audit_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,ts:new Date().toISOString(),type,label,...meta};
    setAuditLog(prev=>[entry,...prev].slice(0,200));
  },[]);

  const normaliseGH=(gh)=>{if(typeof gh==="string")return{id:gh,name:gh,cropTypes:[]};return{id:gh.id||gh.name||"",name:gh.name||gh.id||"",cropTypes:gh.cropTypes||[]};};
  const normaliseStaff=(s)=>({cropTypes:s.cropTypes!==undefined?s.cropTypes:[],cropActivities:s.cropActivities!==undefined?s.cropActivities:{},...s});
  const ghList=greenhouses.map(normaliseGH);
  const ghNames=ghList.map(g=>g.name);

  const calcVersatility=(s)=>{
    if(!activities.length)return 0;
    const sa=s.activities||[];
    const hasNewModel=s.cropTypes!==undefined||s.cropActivities!==undefined;
    if(hasNewModel){
      const sCrops=s.cropTypes||[];
      const cActs=s.cropActivities||{};
      const effectiveCrops=sCrops.length===0?cropTypes:sCrops;
      const actSet=new Set();
      effectiveCrops.forEach(crop=>{const a=cActs[crop];(a==null?activities:(a.length?a:activities)).forEach(x=>actSet.add(x));});
      const actScore=activities.length?actSet.size/activities.length:1;
      const cropScore=cropTypes.length?effectiveCrops.length/cropTypes.length:1;
      return Math.round((actScore*0.6+cropScore*0.4)*100);
    }
    if(!ghNames.length)return 0;
    if(sa.length&&typeof sa[0]==="string"){const a=sa.filter(x=>activities.includes(x)).length/activities.length;const g=(s.greenhouses||[]).filter(x=>ghNames.includes(x)).length/ghNames.length;return Math.round((a+g)/2*100);}
    const actNames=sa.map(a=>a.activity);
    const a=actNames.filter(x=>activities.includes(x)).length/activities.length;
    const ghScores=sa.map(ao=>ao.allGreenhouses?1:(ao.greenhouses||[]).filter(x=>ghNames.includes(x)).length/(ghNames.length||1));
    const g=ghScores.length?ghScores.reduce((s,v)=>s+v,0)/ghScores.length:0;
    const allCrops=[...new Set(ghList.flatMap(g=>g.cropTypes||[]))];
    const staffCrops=new Set(sa.flatMap(ao=>ao.cropTypes||[]));
    const c=allCrops.length?[...staffCrops].filter(x=>allCrops.includes(x)).length/allCrops.length:1;
    return Math.round((a+g+c)/3*100);
  };

  const activeDays=ALL_DAYS.filter(day=>staff.some(s=>(s.dayHours?.[day]??(["Saturday","Sunday"].includes(day)?0:s.hoursPerDay??7))>0));
  const displayDays=activeDays.length>0?activeDays:["Monday","Tuesday","Wednesday","Thursday","Friday"];
  const totalCapacity=staff.reduce((sum,s)=>sum+ALL_DAYS.reduce((ds,day)=>ds+(s.dayHours?.[day]??(["Saturday","Sunday"].includes(day)?0:s.hoursPerDay??7)),0),0);
  const totalDemand=Object.values(demand).reduce((sum,acts)=>sum+Object.values(acts||{}).reduce((s,v)=>s+(parseInt(v)||0),0),0);

  const activeCycle=cycles.find(c=>c.id===activeCycleId)||cycles[0]||null;
  const activeWeek=activeCycle?.weeks?.[activeWeekIndex]||null;
  const activeWeekDates=activeWeek?buildWeekDates(activeWeek.startDate):{};

  const saveData=async()=>{
    await axios.post(`${API}/data`,{staff,greenhouses:ghList,activities,cropTypes,clusters,clusterTransitions,demand,absences,schedule,scheduleSummary,quarantine,quarantineHistory,cycles,activeCycleId,settings:{tolerance}});
    setSaved(true);setTimeout(()=>setSaved(false),2000);
    setBackupReminder(true);
  };

  // ─── JSON Export ──────────────────────────────────────────────────────────
  const exportBackup=()=>{
    const backup={
      exportedAt:new Date().toLocaleString("en-AU",{timeZone:"Australia/Adelaide"}),
      version:"2.0",
      data:{staff,greenhouses:ghList,activities,cropTypes,clusters,clusterTransitions,
            demand,absences,schedule,scheduleSummary,quarantine,quarantineHistory,
            cycles,activeCycleId,settings:{tolerance}}
    };
    const ts=new Date().toLocaleDateString("en-AU").replace(/\//g,"-");
    downloadJSON(backup,`greenhouse-backup-${ts}.json`);
    setBackupReminder(false);
  };

  // ─── JSON Import ──────────────────────────────────────────────────────────
  const handleJSONFileRead=(file)=>{
    const reader=new FileReader();
    reader.onload=(e)=>{
      try{
        const parsed=JSON.parse(e.target.result);
        const data=parsed.data||parsed;
        setImportData(data);
        // Build preview client-side
        const incoming=data.staff||[];
        const currentIds=new Set(staff.map(s=>s.id));
        const preview=incoming.map(s=>({id:s.id,name:s.name,status:currentIds.has(s.id)?"duplicate":"new",activities:s.activities?.length||0}));
        setImportPreview({
          staffPreview:preview.slice(0,30),
          incomingStaffCount:incoming.length,
          currentStaffCount:staff.length,
          newCount:preview.filter(x=>x.status==="new").length,
          duplicateCount:preview.filter(x=>x.status==="duplicate").length,
          hasCycles:(data.cycles||[]).length>0,
          cycleCount:(data.cycles||[]).length,
          ghCount:(data.greenhouses||[]).length,
        });
        setImportMode("json");
      }catch(err){alert("Invalid JSON file: "+err.message);}
    };
    reader.readAsText(file);
  };

  const commitImport=async()=>{
    if(!importData)return;
    try{
      const res=await axios.post(`${API}/import`,{data:importData,mode:importMergeMode});
      if(res.data.error){alert("Import error: "+res.data.error);return;}
      alert(res.data.message+"\n\nPage will reload to show imported data.");
      window.location.reload();
    }catch(e){alert("Import failed: "+e.message);}
  };

  const generateSchedule=async(flatDemand,cropDemand)=>{
    setGenerating(true);setScheduleStale(false);
    const demandToUse=flatDemand||demand;
    try{
      const res=await axios.post(`${API}/optimise`,{
        staff,greenhouses:ghList,activities,demand:demandToUse,
        absences,clusters,clusterTransitions,tolerance,quarantine,
        currentDate:new Date().toLocaleString("en-AU",{timeZone:"Australia/Adelaide"}),
        cropDemand:cropDemand||null
      });
      if(res.data.schedule){
        let finalSchedule=res.data.schedule;
        let finalSummary=res.data.summary;
        // Auto-fill any unassigned slots with OT
        const unassigned=Object.values(finalSchedule).reduce((s,d)=>s+d.filter(a=>a.unassigned).length,0);
        if(unassigned>0){
          try{
            const otRes=await axios.post(`${API}/overtime/calculate`,{staff,greenhouses:ghList,activities,schedule:finalSchedule,absences});
            if(otRes.data.entries?.length>0){
              const merged=JSON.parse(JSON.stringify(finalSchedule));
              otRes.data.entries.forEach(ot=>{
                const day=ot.day;
                if(!merged[day])return;
                const idx=merged[day].findIndex(a=>a.unassigned&&a.greenhouse===ot.greenhouse&&a.activity===ot.activity);
                if(idx>=0){
                  const rem=merged[day][idx].hours-ot.hours;
                  if(rem>0.01)merged[day][idx]={...merged[day][idx],hours:rem};
                  else merged[day].splice(idx,1);
                }
                merged[day].push({staffId:ot.staffId,staffName:ot.staffName,greenhouse:ot.greenhouse,activity:ot.activity,cropType:ot.cropType||null,hours:ot.hours,transitionMins:0,unassigned:false,reoptimised:false,isOT:true});
              });
              finalSchedule=merged;
              const otHours=otRes.data.entries.reduce((s,e)=>s+e.hours,0);
              const newUnassigned=Object.values(merged).reduce((s,d)=>s+d.filter(a=>a.unassigned).reduce((s2,a)=>s2+a.hours,0),0);
              const newAssigned=Object.values(merged).reduce((s,d)=>s+d.filter(a=>!a.unassigned).reduce((s2,a)=>s2+a.hours,0),0);
              finalSummary={...finalSummary,totalUnassigned:newUnassigned,totalAssigned:newAssigned,totalOTHours:otHours,otStaffCount:new Set(otRes.data.entries.map(e=>e.staffId)).size};
              setOvertimeEntries(otRes.data.entries.map((e,i)=>({...e,id:`ot_${Date.now()}_${i}`,source:"system"})));
            }
          }catch(err){console.warn("OT auto-fill failed:",err.message);}
        }
        setSchedule(finalSchedule);setScheduleSummary(finalSummary);
        if(finalSummary?.efficiencyScore!=null)setEfficiencyScore(finalSummary.efficiencyScore);
        const warnings=res.data.summary?.noMatchWarnings||[];
        if(warnings.length>0)alert("Some slots could not be filled even with OT:\n"+warnings.map(w=>w.message).join("\n"));
        if(activeCycle&&activeWeek){
          const updated=cycles.map(cy=>cy.id===activeCycle.id?{...cy,weeks:cy.weeks.map((w,wi)=>wi===activeWeekIndex?{...w,schedule:finalSchedule,summary:finalSummary}:w)}:cy);
          setCycles(updated);
        }
        setPage("schedule");
      }else if(res.data.error)alert("Optimiser error: "+res.data.error);
    }catch(e){alert("Network error: "+e.message);}
    setGenerating(false);
  };
  const reoptimise=async(staffId,affectedDays)=>{
    setGenerating(true);
    try{
      const res=await axios.post(`${API}/reoptimise`,{
        existingSchedule:schedule,affectedStaffId:staffId,affectedDays,
        staff,greenhouses:ghList,activities,demand,absences,
        clusters,clusterTransitions,tolerance,quarantine,
        currentDate:new Date().toLocaleString("en-AU",{timeZone:"Australia/Adelaide"}),
        disruptionTolerancePct:5
      });
      if(res.data.schedule){
        let finalSchedule=res.data.schedule;
        let finalSummary=res.data.summary||{};
        const dc=finalSummary.disruptionCheck;
        if(dc?.exceeded){
          const proceed=window.confirm(`Disruption Warning\n\nEfficiency loss: ${dc.loss}% exceeds ${dc.threshold}% tolerance.\n\nKeep this schedule anyway?`);
          if(!proceed){setGenerating(false);return;}
        }
        // Auto-fill remaining unassigned with OT
        const unassigned=Object.values(finalSchedule).reduce((s,d)=>s+d.filter(a=>a.unassigned).length,0);
        if(unassigned>0){
          try{
            const otRes=await axios.post(`${API}/overtime/calculate`,{staff,greenhouses:ghList,activities,schedule:finalSchedule,absences});
            if(otRes.data.entries?.length>0){
              const merged=JSON.parse(JSON.stringify(finalSchedule));
              otRes.data.entries.forEach(ot=>{
                const day=ot.day;
                if(!merged[day])return;
                const idx=merged[day].findIndex(a=>a.unassigned&&a.greenhouse===ot.greenhouse&&a.activity===ot.activity);
                if(idx>=0){
                  const rem=merged[day][idx].hours-ot.hours;
                  if(rem>0.01)merged[day][idx]={...merged[day][idx],hours:rem};
                  else merged[day].splice(idx,1);
                }
                merged[day].push({staffId:ot.staffId,staffName:ot.staffName,greenhouse:ot.greenhouse,activity:ot.activity,hours:ot.hours,transitionMins:0,unassigned:false,reoptimised:true,isOT:true});
              });
              finalSchedule=merged;
              setOvertimeEntries(prev=>[...prev.filter(e=>!e.id?.startsWith("ot_reopt")),...otRes.data.entries.map((e,i)=>({...e,id:`ot_reopt_${Date.now()}_${i}`,source:"system"}))]);
            }
          }catch(err){console.warn("OT auto-fill failed:",err.message);}
        }
        setSchedule(finalSchedule);
        if(finalSummary)setScheduleSummary(finalSummary);
        const stillUnassigned=Object.values(finalSchedule).reduce((s,d)=>s+d.filter(a=>a.unassigned).length,0);
        alert(stillUnassigned>0?`Reoptimised. ${stillUnassigned} slot(s) still unassigned — no eligible staff or OT available.`:`Reoptimised successfully. All gaps filled.`);
      }
    }catch(e){alert("Error: "+e.message);}
    setGenerating(false);
  };

  // Rebuild schedule when GM edits OT — replace OT slots in schedule with updated entries
  const rebuildScheduleFromOT=async(updatedEntries)=>{
    if(!schedule)return;
    setGenerating(true);
    try{
      // Remove all existing OT slots from schedule
      const base={};
      Object.entries(schedule).forEach(([day,assignments])=>{
        base[day]=assignments.filter(a=>!a.isOT);
      });
      // Re-add updated OT entries
      updatedEntries.forEach(ot=>{
        const day=ot.day;
        if(!base[day])return;
        // Remove any matching unassigned slot first
        const idx=base[day].findIndex(a=>a.unassigned&&a.greenhouse===ot.greenhouse&&a.activity===ot.activity);
        if(idx>=0){
          const rem=base[day][idx].hours-ot.hours;
          if(rem>0.01)base[day][idx]={...base[day][idx],hours:rem};
          else base[day].splice(idx,1);
        }
        base[day].push({
          staffId:ot.staffId,staffName:ot.staffName,
          greenhouse:ot.greenhouse,activity:ot.activity,
          cropType:ot.cropType||null,hours:ot.hours,
          transitionMins:0,unassigned:false,reoptimised:false,isOT:true
        });
      });
      setSchedule(base);
      setScheduleStale(false);
    }catch(e){console.warn("Rebuild failed:",e.message);}
    setGenerating(false);
  };

  const btn=(active,color)=>({padding:"7px 14px",background:active?"#2ecc71":(color||C.blue),color:"white",border:"none",borderRadius:"5px",cursor:"pointer",margin:"0 3px",fontSize:"13px",fontWeight:"500"});
  const card={background:C.white,borderRadius:"10px",padding:"20px",marginBottom:"18px",boxShadow:"0 2px 8px rgba(0,0,0,0.07)"};
  const inp={padding:"6px 10px",border:`1px solid ${C.border}`,borderRadius:"5px",fontSize:"13px",outline:"none"};
  const TH=({children,center})=><th style={{padding:"9px 10px",textAlign:center?"center":"left",background:C.navy,color:"white",fontSize:"12px",fontWeight:"600"}}>{children}</th>;
  const TD=({children,i,center,color})=><td style={{padding:"8px 10px",background:i%2===0?C.light:C.white,textAlign:center?"center":"left",fontSize:"13px",color:color||"inherit"}}>{children}</td>;

  if(loading)return(<div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:C.bg}}><div style={{textAlign:"center"}}><div style={{fontSize:"48px",marginBottom:"16px"}}>🌿</div><div style={{color:C.textMid,fontSize:"18px"}}>Loading Greenhouse Planner...</div></div></div>);

  // ─── Import Modal ─────────────────────────────────────────────────────────
  if(importMode==="json"&&importPreview){
    return(
      <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000}}>
        <div style={{background:"white",borderRadius:"14px",padding:"28px",maxWidth:"680px",width:"95%",maxHeight:"90vh",overflowY:"auto"}}>
          <h2 style={{color:C.navy,marginBottom:"4px"}}>📥 Import Preview</h2>
          <p style={{color:C.textMid,fontSize:"13px",marginBottom:"20px"}}>Review what will be imported before committing.</p>

          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"10px",marginBottom:"20px"}}>
            {[[importPreview.incomingStaffCount,"Staff in file",C.blue],
              [importPreview.newCount,"New (will add)",C.green],
              [importPreview.duplicateCount,"Duplicates",C.orange]].map(([v,l,c])=>(
              <div key={l} style={{background:"#f8f9fa",borderRadius:"8px",padding:"12px",textAlign:"center",border:`2px solid ${c}33`}}>
                <div style={{fontSize:"28px",fontWeight:"800",color:c}}>{v}</div>
                <div style={{fontSize:"12px",color:C.textMid}}>{l}</div>
              </div>
            ))}
          </div>

          {importPreview.hasCycles&&<div style={{background:"#eafaf1",borderRadius:"6px",padding:"10px",marginBottom:"14px",fontSize:"13px",color:C.teal}}>✅ File includes {importPreview.cycleCount} planning cycle(s) — will also be restored.</div>}

          <div style={{marginBottom:"16px"}}>
            <label style={{display:"block",fontSize:"13px",fontWeight:"700",color:C.navy,marginBottom:"8px"}}>Import Mode:</label>
            <div style={{display:"flex",gap:"12px"}}>
              {[["replace","🔄 Replace All","Wipe current data and load file completely"],["merge","➕ Merge","Add new staff only, skip duplicate IDs"]].map(([v,l,desc])=>(
                <label key={v} style={{flex:1,display:"flex",gap:"10px",padding:"12px",border:`2px solid ${importMergeMode===v?C.teal:C.border}`,borderRadius:"8px",cursor:"pointer",background:importMergeMode===v?"#f0fdfb":"white"}}>
                  <input type="radio" value={v} checked={importMergeMode===v} onChange={()=>setImportMergeMode(v)} style={{marginTop:"2px"}}/>
                  <div><div style={{fontWeight:"700",color:C.navy,fontSize:"13px"}}>{l}</div><div style={{fontSize:"12px",color:C.textMid,marginTop:"2px"}}>{desc}</div></div>
                </label>
              ))}
            </div>
          </div>

          {importMergeMode==="replace"&&<div style={{background:"#fff5f5",border:`1px solid ${C.red}`,borderRadius:"6px",padding:"10px",marginBottom:"14px",fontSize:"12px",color:C.red}}>⚠️ Replace mode will overwrite ALL current staff, greenhouses, cycles and demand data. This cannot be undone.</div>}

          <div style={{marginBottom:"16px",maxHeight:"200px",overflowY:"auto",border:`1px solid ${C.border}`,borderRadius:"6px"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
              <thead><tr style={{background:C.navy,color:"white"}}><th style={{padding:"7px 10px",textAlign:"left"}}>ID</th><th style={{padding:"7px 10px",textAlign:"left"}}>Name</th><th style={{padding:"7px 10px",textAlign:"center"}}>Activities</th><th style={{padding:"7px 10px",textAlign:"center"}}>Status</th></tr></thead>
              <tbody>{importPreview.staffPreview.map((s,i)=>(
                <tr key={s.id} style={{background:i%2===0?C.light:C.white}}>
                  <td style={{padding:"6px 10px",fontFamily:"monospace",fontSize:"11px"}}>{s.id}</td>
                  <td style={{padding:"6px 10px"}}>{s.name}</td>
                  <td style={{padding:"6px 10px",textAlign:"center"}}>{s.activities}</td>
                  <td style={{padding:"6px 10px",textAlign:"center"}}><span style={{background:s.status==="new"?"#d5f5e3":"#fde8cc",color:s.status==="new"?C.green:C.orange,padding:"2px 8px",borderRadius:"10px",fontSize:"11px",fontWeight:"600"}}>{s.status==="new"?"New ✓":"Duplicate"}</span></td>
                </tr>
              ))}</tbody>
            </table>
            {importPreview.incomingStaffCount>30&&<div style={{padding:"8px 10px",fontSize:"12px",color:C.textLight,textAlign:"center"}}>Showing first 30 of {importPreview.incomingStaffCount} staff</div>}
          </div>

          <div style={{display:"flex",gap:"10px",justifyContent:"flex-end"}}>
            <button onClick={()=>{setImportMode(null);setImportPreview(null);setImportData(null);}} style={btn(false,"#95a5a6")}>Cancel</button>
            <button onClick={commitImport} style={btn(false,C.green)}>✅ Confirm Import</button>
          </div>
        </div>
      </div>
    );
  }

  const bgImg={position:"absolute",top:0,left:0,right:0,bottom:0,backgroundImage:"url('https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1600')",backgroundSize:"cover",backgroundPosition:"center",filter:"brightness(0.3)"};
  const backBtn={background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.7)",borderRadius:"8px",padding:"8px 16px",cursor:"pointer",fontSize:"13px",marginBottom:"28px"};

  if(!mainSection)return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden"}}>
      <div style={bgImg}/>
      <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"linear-gradient(135deg,rgba(27,67,50,0.85),rgba(45,106,79,0.7))"}}/>
      <div style={{position:"relative",zIndex:1,textAlign:"center",padding:"20px",width:"100%",maxWidth:"600px"}}>
        <div style={{fontSize:"60px",marginBottom:"10px"}}>🌿</div>
        <h1 style={{color:"white",marginBottom:"6px",fontSize:"30px",textShadow:"0 2px 12px rgba(0,0,0,0.6)"}}>Greenhouse Planner</h1>
        <p style={{color:"rgba(255,255,255,0.8)",marginBottom:"10px",fontSize:"14px"}}>Workforce Allocation & Scheduling System</p>
        <p style={{color:"rgba(255,255,255,0.5)",marginBottom:"36px",fontSize:"12px"}}>Adelaide Time: {adelaideTime}</p>
        <div style={{display:"flex",gap:"20px",justifyContent:"center"}}>
          {[{id:"labour",icon:"📋",title:"Labour Planner",sub:"Crop cycles · Greenhouse setup · Demand planning"},{id:"weekly",icon:"📅",title:"Weekly Scheduler",sub:"Staff scheduling · Overtime · Absence management"}].map(m=>(
            <div key={m.id} onClick={()=>{setMainSection(m.id);setRole(null);setLpRole(null);}} style={{background:"rgba(27,67,50,0.92)",backdropFilter:"blur(10px)",color:"white",padding:"36px 40px",borderRadius:"16px",cursor:"pointer",flex:1,border:"1px solid rgba(255,255,255,0.2)",boxShadow:"0 8px 32px rgba(0,0,0,0.3)"}}>
              <div style={{fontSize:"42px",marginBottom:"14px"}}>{m.icon}</div>
              <div style={{fontWeight:"700",fontSize:"17px"}}>{m.title}</div>
              <div style={{fontSize:"12px",opacity:0.75,marginTop:"8px"}}>{m.sub}</div>
            </div>
          ))}
        </div>
        <p style={{color:"rgba(255,255,255,0.4)",fontSize:"11px",marginTop:"30px"}}>Select a module to continue</p>
      </div>
    </div>
  );

  if(mainSection==="labour"&&!lpRole)return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden"}}>
      <div style={bgImg}/>
      <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"linear-gradient(135deg,rgba(27,67,50,0.85),rgba(45,106,79,0.7))"}}/>
      <div style={{position:"relative",zIndex:1,textAlign:"center",padding:"20px",width:"100%",maxWidth:"500px"}}>
        <button onClick={()=>setMainSection(null)} style={backBtn}>← Back to modules</button>
        <div style={{fontSize:"48px",marginBottom:"10px"}}>📋</div>
        <h2 style={{color:"white",marginBottom:"6px",fontSize:"24px"}}>Labour Planner</h2>
        <p style={{color:"rgba(255,255,255,0.6)",marginBottom:"36px",fontSize:"13px"}}>Select your role</p>
        <div style={{display:"flex",gap:"20px",justifyContent:"center"}}>
          {[{id:"gm",icon:"👔",title:"General Manager",sub:"Full access — all masters"},{id:"grower",icon:"🌱",title:"Grower",sub:"Read-only view"}].map(r=>(
            <div key={r.id} onClick={()=>setLpRole(r.id)} style={{background:"rgba(27,67,50,0.92)",backdropFilter:"blur(10px)",color:"white",padding:"32px 36px",borderRadius:"16px",cursor:"pointer",flex:1,border:"1px solid rgba(255,255,255,0.2)",boxShadow:"0 8px 32px rgba(0,0,0,0.3)"}}>
              <div style={{fontSize:"38px",marginBottom:"12px"}}>{r.icon}</div>
              <div style={{fontWeight:"700",fontSize:"16px"}}>{r.title}</div>
              <div style={{fontSize:"12px",opacity:0.75,marginTop:"6px"}}>{r.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if(mainSection==="weekly"&&!role)return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden"}}>
      <div style={bgImg}/>
      <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"linear-gradient(135deg,rgba(26,58,92,0.85),rgba(13,115,119,0.7))"}}/>
      <div style={{position:"relative",zIndex:1,textAlign:"center",padding:"20px",width:"100%",maxWidth:"640px"}}>
        <button onClick={()=>setMainSection(null)} style={backBtn}>← Back to modules</button>
        <div style={{fontSize:"48px",marginBottom:"10px"}}>📅</div>
        <h2 style={{color:"white",marginBottom:"6px",fontSize:"24px"}}>Weekly Scheduler</h2>
        <p style={{color:"rgba(255,255,255,0.6)",marginBottom:"36px",fontSize:"13px"}}>Select your role</p>
        <div style={{display:"flex",gap:"16px",justifyContent:"center"}}>
          {[{id:"gm",icon:"👔",title:"General Manager",sub:"Full access — all tabs",color:"rgba(26,58,92,0.92)"},{id:"lm",icon:"👷",title:"Labour Manager",sub:"Schedule · Absence · Overtime",color:"rgba(13,115,119,0.92)"},{id:"grower",icon:"🌱",title:"Grower",sub:"Demand review · Quarantine",color:"rgba(27,67,50,0.92)"}].map(r=>(
            <div key={r.id} onClick={()=>{setRole(r.id);setPage(r.id==="grower"?"demand":"dashboard");}} style={{background:r.color,backdropFilter:"blur(10px)",color:"white",padding:"28px 24px",borderRadius:"16px",cursor:"pointer",flex:1,border:"1px solid rgba(255,255,255,0.2)",boxShadow:"0 8px 32px rgba(0,0,0,0.3)"}}>
              <div style={{fontSize:"36px",marginBottom:"10px"}}>{r.icon}</div>
              <div style={{fontWeight:"700",fontSize:"15px"}}>{r.title}</div>
              <div style={{fontSize:"11px",opacity:0.75,marginTop:"6px"}}>{r.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const tabs=[
    {id:"dashboard",label:"Dashboard",icon:"📊",roles:["gm","lm"]},
    {id:"staff",    label:"Staff",    icon:"👥",roles:["gm"]},
    {id:"demand",   label:"Demand",   icon:"📋",roles:["gm","grower"]},
    {id:"schedule", label:"Schedule", icon:"📅",roles:["gm","lm"]},
    {id:"absence",  label:"Absence",  icon:"🏥",roles:["gm","lm"]},
    {id:"overtime", label:"Overtime", icon:"⏱️",roles:["gm","lm"]},
    {id:"edit",     label:"Edit",     icon:"✏️",roles:["gm"]},
    {id:"quarantine",label:"Quarantine",icon:"🔴",roles:["gm","lm","grower"]},
    {id:"backup",   label:"Backup",   icon:"💾",roles:["gm","lm"]},
  ].filter(t=>t.roles.includes(role));

  return(
    <div style={{background:C.bg,minHeight:"100vh",fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      {/* ── Navbar ── */}
      <div style={{background:C.navy,padding:"0 16px",display:"flex",alignItems:"stretch",gap:"2px",flexWrap:"wrap",boxShadow:"0 2px 8px rgba(0,0,0,0.2)"}}>
        <div style={{display:"flex",alignItems:"center",paddingRight:"16px",borderRight:"1px solid rgba(255,255,255,0.15)",marginRight:"8px"}}>
          <span style={{color:"white",fontWeight:"700",fontSize:"15px"}}>🌿 Greenhouse Planner</span>
        </div>
        <div style={{display:"flex",alignItems:"stretch",borderRight:"1px solid rgba(255,255,255,0.15)",marginRight:"4px",paddingRight:"4px"}}>
          {[{id:"labour",label:"Labour Planner",icon:"📋"},{id:"weekly",label:"Weekly Scheduler",icon:"📅"}].map(s=>(
            <button key={s.id} onClick={()=>setMainSection(s.id)} style={{
              background:mainSection===s.id?"rgba(255,255,255,0.15)":"transparent",
              color:"white",border:"none",
              borderBottom:mainSection===s.id?"3px solid #52B788":"3px solid transparent",
              padding:"12px 14px",cursor:"pointer",fontSize:"13px",
              fontWeight:mainSection===s.id?"700":"400",
              opacity:mainSection===s.id?1:0.6
            }}>{s.icon} {s.label}</button>
          ))}
        </div>
        {mainSection==="weekly"&&tabs.map(t=>(
          <button key={t.id} onClick={()=>setPage(t.id)} style={{
            background:page===t.id?"rgba(255,255,255,0.15)":"transparent",
            color:page===t.id?"white":t.id==="quarantine"?"rgba(255,100,100,0.8)":t.id==="backup"&&backupReminder?"#f39c12":"rgba(255,255,255,0.65)",
            border:"none",
            borderBottom:page===t.id?`3px solid ${t.id==="quarantine"?"#ff6b6b":t.id==="backup"?"#f39c12":"#2ecc71"}`:"3px solid transparent",
            padding:"12px 14px",cursor:"pointer",fontSize:"13px",fontWeight:"500"
          }}>
            {t.icon} {t.label}
            {t.id==="schedule"&&scheduleStale&&<span style={{color:C.gold,marginLeft:"4px"}}>●</span>}
            {t.id==="backup"&&backupReminder&&<span style={{color:C.gold,marginLeft:"4px",fontSize:"10px"}}>●</span>}
          </button>
        ))}
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:"10px",padding:"8px 0"}}>
          <span style={{color:"rgba(255,255,255,0.4)",fontSize:"11px"}}>{adelaideTime}</span>
          {efficiencyScore!=null&&role==="gm"&&<span style={{background:"rgba(46,204,113,0.2)",color:"#2ecc71",padding:"3px 10px",borderRadius:"12px",fontSize:"12px",fontWeight:"700",border:"1px solid rgba(46,204,113,0.4)"}}>📊 {efficiencyScore}%</span>}
          <span style={{color:"#aed6f1",fontSize:"12px",borderLeft:"1px solid rgba(255,255,255,0.2)",paddingLeft:"10px"}}>{mainSection==="labour"?(lpRole==="gm"?"👔 GM — Labour Planner":"🌱 Grower — Labour Planner"):(role==="gm"?"👔 General Manager":role==="lm"?"👷 Labour Manager":"🌱 Grower")}</span>
          <button onClick={saveData} style={{...btn(false,saved?"#27ae60":C.orange),fontSize:"12px"}}>{saved?"✓ Saved!":"💾 Save"}</button>
          <button onClick={exportBackup} style={{...btn(false,C.teal),fontSize:"12px"}}>📤 Export</button>
          <button onClick={()=>{if(mainSection==="labour"){setLpRole(null);}else{setRole(null);setPage("dashboard");}}} style={{...btn(false,"#c0392b"),fontSize:"12px"}}>⇦ Role</button>
          <button onClick={()=>{setMainSection(null);setRole(null);setLpRole(null);setPage("dashboard");}} style={{...btn(false,"#7f8c8d"),fontSize:"12px"}}>⌂ Home</button>
        </div>
      </div>

      {/* ── Backup reminder banner ── */}
      {backupReminder&&(
        <div style={{background:"#fffbea",borderBottom:`2px solid ${C.gold}`,padding:"8px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:"13px"}}>
          <span>⚠️ <strong>Reminder:</strong> You have unsaved backup. Export your data before pushing to GitHub to avoid losing it on Render redeploy.</span>
          <div style={{display:"flex",gap:"8px"}}>
            <button onClick={exportBackup} style={{...btn(false,C.gold),fontSize:"12px",padding:"5px 12px"}}>📤 Export Now</button>
            <button onClick={()=>setBackupReminder(false)} style={{background:"none",border:"none",cursor:"pointer",color:C.textLight,fontSize:"18px",padding:"0 4px"}}>✕</button>
          </div>
        </div>
      )}

      <div style={{padding:"20px"}}>
        {mainSection==="labour"&&<LabourPlanner lpRole={lpRole}/>}
        {mainSection==="weekly"&&<>

        {/* ══ DASHBOARD ══ */}
        {page==="dashboard"&&(
          <div>
            <h2 style={{color:C.navy,marginBottom:"16px"}}>📊 Dashboard</h2>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"14px",marginBottom:"20px"}}>
              {[[staff.length,"Total Staff",C.blue,"👥"],[ghList.length,"Greenhouses",C.teal,"🏗️"],[activities.length,"Activities",C.orange,"⚙️"],[cropTypes.length,"Crop Types",C.purple,"🌱"]].map(([val,label,color,icon])=>(
                <div key={label} style={{...card,borderTop:`4px solid ${color}`,textAlign:"center",padding:"18px",marginBottom:0}}>
                  <div style={{fontSize:"26px",marginBottom:"4px"}}>{icon}</div>
                  <div style={{fontSize:"36px",fontWeight:"800",color}}>{val}</div>
                  <div style={{color:C.textLight,fontSize:"13px",marginTop:"4px"}}>{label}</div>
                </div>
              ))}
            </div>

            {/* Efficiency score card — GM only */}
            {role==="gm"&&efficiencyScore!=null&&(
              <div style={{...card,borderTop:`4px solid ${efficiencyScore>=80?C.green:efficiencyScore>=60?C.gold:C.red}`,marginBottom:"16px"}}>
                <h4 style={{color:C.navy,margin:"0 0 10px 0"}}>📊 Cycle Efficiency Score</h4>
                <div style={{display:"flex",alignItems:"center",gap:"20px"}}>
                  <div style={{fontSize:"52px",fontWeight:"900",color:efficiencyScore>=80?C.green:efficiencyScore>=60?C.gold:C.red}}>{efficiencyScore}%</div>
                  <div>
                    <div style={{background:"#eee",borderRadius:"8px",overflow:"hidden",height:"20px",width:"200px",marginBottom:"6px"}}><div style={{width:`${efficiencyScore}%`,background:efficiencyScore>=80?C.green:efficiencyScore>=60?C.gold:C.red,height:"100%",transition:"width 0.5s"}}/></div>
                    <div style={{fontSize:"12px",color:C.textMid}}>{efficiencyScore>=80?"✅ Excellent allocation":"⚠️ Review unassigned slots"}</div>
                    <div style={{fontSize:"11px",color:C.textLight,marginTop:"2px"}}>Weighted: 60% coverage + 40% utilisation</div>
                  </div>
                </div>
              </div>
            )}

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px",marginBottom:"20px"}}>
              <div style={{...card,borderTop:`4px solid ${C.blue}`}}>
                <h4 style={{color:C.navy,margin:"0 0 14px 0"}}>📊 Capacity vs Demand</h4>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:"6px"}}><span style={{color:C.textMid,fontSize:"13px"}}>Staff Capacity:</span><strong style={{color:C.blue}}>{totalCapacity} hrs</strong></div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:"12px"}}><span style={{color:C.textMid,fontSize:"13px"}}>Weekly Demand:</span><strong style={{color:totalDemand>totalCapacity?C.red:C.green}}>{totalDemand} hrs</strong></div>
                <div style={{background:"#eee",borderRadius:"6px",overflow:"hidden",height:"16px",marginBottom:"10px"}}><div style={{width:`${Math.min(totalCapacity>0?totalDemand/totalCapacity*100:0,100)}%`,background:totalDemand>totalCapacity?C.red:C.green,height:"100%"}}/></div>
                {totalDemand>totalCapacity&&<p style={{color:C.red,fontSize:"12px",margin:"4px 0"}}>⚠️ Shortfall: {totalDemand-totalCapacity} hrs</p>}
                {totalDemand>0&&totalDemand<=totalCapacity&&<p style={{color:C.green,fontSize:"12px",margin:"4px 0"}}>✓ Surplus: {totalCapacity-totalDemand} hrs available</p>}
                {scheduleSummary?.shortfallByActivity?.length>0&&(
                  <div style={{marginTop:"10px",background:"#fff5f5",borderRadius:"6px",padding:"10px"}}>
                    <div style={{fontSize:"12px",fontWeight:"700",color:C.red,marginBottom:"6px"}}>⚠️ Shortfall by Activity:</div>
                    {scheduleSummary.shortfallByActivity.map((s,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:"12px",marginBottom:"3px"}}><span style={{color:C.textMid}}>{s.gh} — {s.activity}</span><span style={{color:C.red,fontWeight:"700"}}>-{s.hours}h</span></div>)}
                  </div>
                )}
              </div>
              <div style={{...card,borderTop:`4px solid ${C.orange}`}}>
                <h4 style={{color:C.navy,margin:"0 0 14px 0"}}>⚙️ Optimisation Settings</h4>
                <div style={{marginBottom:"14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:"6px"}}><label style={{fontSize:"13px",color:C.textMid}}>Whole-day preference tolerance:</label><strong style={{color:C.orange}}>{tolerance}%</strong></div>
                  <input type="range" min="0" max="20" value={tolerance} onChange={e=>setTolerance(parseInt(e.target.value))} style={{width:"100%",accentColor:C.orange}}/>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:"11px",color:"#aaa",marginTop:"4px"}}><span>0% — Pure optimisation</span><span>20% — Max human factors</span></div>
                </div>
                <div style={{borderTop:`1px solid ${C.border}`,paddingTop:"10px",fontSize:"13px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}><span style={{color:C.textMid}}>High versatility staff (75%+):</span><strong style={{color:C.green}}>{staff.filter(s=>calcVersatility(s)>=75).length}</strong></div>
                  <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:C.textMid}}>Active working days:</span><strong style={{color:C.blue}}>{displayDays.length} days</strong></div>
                </div>
              </div>
            </div>

            {/* Cluster transition time UI */}
            <ClusterTransitionUI clusters={clusters} setClusters={setClusters} clusterTransitions={clusterTransitions} setClusterTransitions={setClusterTransitions} ghNames={ghNames} btn={btn} inp={inp} card={card} C={C}/>

            {/* ── Collapsible Audit Trail ── */}
            <div style={{...card,marginTop:"16px",padding:0,overflow:"hidden"}}>
              <div onClick={()=>setShowAudit(v=>!v)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",cursor:"pointer",background:showAudit?C.light:"white",borderBottom:showAudit?`1px solid ${C.border}`:"none"}}>
                <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                  <span style={{fontWeight:"700",fontSize:"14px",color:C.navy}}>📋 Change Log</span>
                  <span style={{background:auditLog.length>0?"#e0f2fe":"#f3f4f6",color:auditLog.length>0?"#0369a1":C.textLight,fontSize:"11px",fontWeight:"700",padding:"2px 8px",borderRadius:"10px"}}>{auditLog.length} entries</span>
                </div>
                <span style={{color:C.textMid,fontSize:"13px"}}>{showAudit?"▲ collapse":"▼ expand"}</span>
              </div>
              {showAudit&&(
                <div style={{padding:"12px 16px"}}>
                  <div style={{display:"flex",gap:"6px",marginBottom:"10px",flexWrap:"wrap"}}>
                    {["all","confirm","unconfirm","holiday_add","holiday_remove","standard","quarantine"].map(f=>(
                      <button key={f} onClick={()=>setAuditFilter(f)} style={{padding:"3px 10px",background:auditFilter===f?C.navy:"white",color:auditFilter===f?"white":C.textMid,border:`1px solid ${auditFilter===f?C.navy:C.border}`,borderRadius:"12px",cursor:"pointer",fontSize:"11px",fontWeight:"600"}}>
                        {f==="all"?"All":f==="confirm"?"Confirmed":f==="unconfirm"?"Unconfirmed":f==="holiday_add"?"Holiday +":f==="holiday_remove"?"Holiday –":f==="standard"?"Standards":f==="quarantine"?"Quarantine":f}
                      </button>
                    ))}
                    {auditLog.length>0&&<button onClick={()=>{if(window.confirm("Clear all audit log entries?"))setAuditLog([]);}} style={{marginLeft:"auto",padding:"3px 10px",background:"white",color:"#dc2626",border:"1px solid #fca5a5",borderRadius:"12px",cursor:"pointer",fontSize:"11px"}}>Clear log</button>}
                  </div>
                  {auditLog.filter(e=>auditFilter==="all"||e.type===auditFilter).length===0?(
                    <p style={{color:C.textLight,fontStyle:"italic",fontSize:"13px",margin:0}}>No entries yet.</p>
                  ):(
                    <div style={{maxHeight:"320px",overflowY:"auto"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
                        <thead style={{position:"sticky",top:0,background:"#f0f4f8",zIndex:1}}>
                          <tr>
                            <th style={{padding:"6px 10px",textAlign:"left",color:C.navy,fontWeight:"700",borderBottom:`1px solid ${C.border}`,width:"130px"}}>When</th>
                            <th style={{padding:"6px 10px",textAlign:"left",color:C.navy,fontWeight:"700",borderBottom:`1px solid ${C.border}`,width:"100px"}}>Type</th>
                            <th style={{padding:"6px 10px",textAlign:"left",color:C.navy,fontWeight:"700",borderBottom:`1px solid ${C.border}`}}>Detail</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditLog.filter(e=>auditFilter==="all"||e.type===auditFilter).slice(0,50).map((e,i)=>{
                            const typeColors={confirm:"#16a34a",unconfirm:"#d97706",holiday_add:"#0369a1",holiday_remove:"#7c3aed",standard:"#0891b2",quarantine:"#dc2626"};
                            const typeLabels={confirm:"Confirmed",unconfirm:"Unconfirmed",holiday_add:"Holiday +",holiday_remove:"Holiday –",standard:"Standards",quarantine:"Quarantine"};
                            const ts=new Date(e.ts);
                            const dtStr=ts.toLocaleDateString("en-AU",{day:"2-digit",month:"short"})+" "+ts.toLocaleTimeString("en-AU",{hour:"2-digit",minute:"2-digit"});
                            return(
                              <tr key={e.id} style={{background:i%2===0?"white":"#f8faf8"}}>
                                <td style={{padding:"6px 10px",color:C.textMid,borderBottom:`1px solid ${C.borderLight}`,whiteSpace:"nowrap"}}>{dtStr}</td>
                                <td style={{padding:"6px 10px",borderBottom:`1px solid ${C.borderLight}`}}>
                                  <span style={{background:`${typeColors[e.type]||"#6b7280"}18`,color:typeColors[e.type]||"#6b7280",padding:"2px 7px",borderRadius:"10px",fontSize:"10px",fontWeight:"700",whiteSpace:"nowrap"}}>{typeLabels[e.type]||e.type}</span>
                                </td>
                                <td style={{padding:"6px 10px",color:C.textDark,borderBottom:`1px solid ${C.borderLight}`}}>{e.label}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ STAFF ══ */}
        {page==="staff"&&(
          <div>
            <h2 style={{color:C.navy,marginBottom:"16px"}}>👥 Staff ({staff.length})</h2>
            {staff.length===0?(<div style={card}><p style={{color:C.textLight}}>No staff added yet.</p></div>):(
              <div style={card}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr><TH>ID</TH><TH>Name</TH><TH center>Activities</TH><TH center>Versatility</TH><TH center>Hrs/Day</TH><TH center>OT Limit</TH><TH>Actions</TH></tr></thead>
                  <tbody>
                    {staff.map((s,i)=>{const v=calcVersatility(s);return(
                      <tr key={s.id} style={{background:i%2===0?C.light:C.white}}>
                        <TD i={i}><span style={{fontFamily:"monospace",color:C.navy,fontWeight:"700",fontSize:"12px"}}>{s.id}</span></TD>
                        <TD i={i}>{s.name}</TD>
                        <TD i={i} center>{(s.activities||[]).length}</TD>
                        <TD i={i} center><div style={{display:"flex",alignItems:"center",gap:"6px",justifyContent:"center"}}><div style={{background:"#eee",borderRadius:"4px",overflow:"hidden",width:"60px",height:"10px"}}><div style={{width:`${v}%`,background:v>75?C.green:v>50?C.gold:C.red,height:"100%"}}/></div><span style={{fontSize:"12px",fontWeight:"600",color:v>75?C.green:v>50?C.gold:C.red}}>{v}%</span></div></TD>
                        <TD i={i} center>{s.hoursPerDay??7}h</TD>
                        <TD i={i} center>{s.overtimeLimit??30}h</TD>
                        <TD i={i}><button onClick={()=>setSelectedStaff({...s})} style={btn(false,C.purple)}>✏️ Edit</button></TD>
                      </tr>
                    );})}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══ DEMAND ══ */}
        {page==="demand"&&(
          <DemandPage
            wsHolidays={wsHolidays} setWsHolidays={setWsHolidays}
            dailyAllocation={dailyAllocation} setDailyAllocation={setDailyAllocation}
            confirmedWeeks={confirmedWeeks} setConfirmedWeeks={setConfirmedWeeks}
            carStandards={carStandards} setCarStandards={setCarStandards}
            setDemandVersion={setDemandVersion}
            addAuditEntry={addAuditEntry}
            role={role}
            btn={btn} inp={inp} card={card} C={C}/>
        )}

        {/* ══ SCHEDULE ══ */}
        {page==="schedule"&&(
          <SchedulePage
            scheduleData={scheduleData} setScheduleData={setScheduleData}
            dailyAllocation={dailyAllocation} confirmedWeeks={confirmedWeeks}
            demandVersion={demandVersion}
            staff={staff} absences={absences}
            clusters={clusters} clusterTransitions={clusterTransitions}
            quarantine={quarantine}
            role={role} btn={btn} inp={inp} card={card} C={C} API={API}/>
        )}

        {/* ══ ABSENCE ══ */}
        {page==="absence"&&(
          <div>
            <h2 style={{color:C.navy,marginBottom:"4px"}}>🏥 Absence Management</h2>
            {activeWeek&&<p style={{color:C.textMid,fontSize:"13px",marginBottom:"16px"}}>Week {activeWeekIndex+1}: {fmtDate(activeWeek.startDate)} — {fmtDate(addDays(activeWeek.startDate,6))}</p>}
            {staff.length===0?(<div style={card}><p style={{color:C.textLight}}>No staff added yet.</p></div>):(
              <div style={card}>
                <p style={{color:C.textMid,fontSize:"13px",marginBottom:"4px"}}>Enter reduced hours or mark absent. <strong>Weekly overrides only.</strong></p>
                <p style={{color:C.textLight,fontSize:"12px",marginBottom:"16px"}}>Blank = normal hours | Number = partial hours | Tick = fully absent</p>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
                    <thead>
                      <tr>
                        <TH>ID</TH><TH>Name</TH>
                        {ALL_DAYS.map(d=>{
                          const dateStr=activeWeekDates[d]?fmtDateShort(activeWeekDates[d]):"";
                          return <th key={d} colSpan="2" style={{padding:"7px",textAlign:"center",background:["Saturday","Sunday"].includes(d)?"#2c5f6e":C.navy,color:"white",fontSize:"11px",borderLeft:"1px solid rgba(255,255,255,0.15)"}}>
                            {DAY_SHORT[d]}{dateStr&&<div style={{fontSize:"10px",opacity:0.8}}>{dateStr}</div>}
                          </th>;
                        })}
                        <TH center>Hrs Absent</TH>
                      </tr>
                      <tr style={{background:"#254a6e"}}>
                        <td colSpan="2"></td>
                        {ALL_DAYS.map(d=><React.Fragment key={d}><td style={{padding:"2px 5px",textAlign:"center",color:"rgba(255,255,255,0.7)",fontSize:"10px",borderLeft:"1px solid rgba(255,255,255,0.1)"}}>Hrs Absent</td><td style={{padding:"2px 5px",textAlign:"center",color:"rgba(255,255,255,0.7)",fontSize:"10px"}}>Full Day</td></React.Fragment>)}
                        <td></td>
                      </tr>
                    </thead>
                    <tbody>
                      {staff.map((s,i)=>{
                        const totalAbsHrs=ALL_DAYS.reduce((sum,d)=>{
                          const al=absences[d]||[];
                          const normalHrs=s.dayHours?.[d]??(["Saturday","Sunday"].includes(d)?0:s.hoursPerDay??7);
                          if(al.includes(s.id))return sum+normalHrs;
                          const partial=al.find(x=>typeof x==="object"&&x.id===s.id);
                          if(partial)return sum+(partial.hours||normalHrs);
                          return sum;
                        },0);
                        return(
                          <tr key={s.id} style={{background:i%2===0?C.light:C.white}}>
                            <TD i={i}><span style={{fontFamily:"monospace",color:C.navy,fontWeight:"700",fontSize:"11px"}}>{s.id}</span></TD>
                            <TD i={i}>{s.name}</TD>
                            {ALL_DAYS.map(day=>{
                              const al=absences[day]||[];
                              const isAbsent=al.includes(s.id)||al.some(x=>typeof x==="object"&&x.id===s.id&&x.hours===0);
                              const partialEntry=al.find(x=>typeof x==="object"&&x.id===s.id&&x.hours>0);
                              const normalHrs=s.dayHours?.[day]??(["Saturday","Sunday"].includes(day)?0:s.hoursPerDay??7);
                              return(
                                <React.Fragment key={day}>
                                  <td style={{padding:"2px",textAlign:"center",background:i%2===0?C.light:C.white,borderLeft:"1px solid #eee"}}>
                                    <input type="number" min="0" max="12" value={isAbsent?"":(partialEntry?partialEntry.hours:"")} disabled={isAbsent} placeholder={normalHrs}
                                      onChange={e=>{const val=parseInt(e.target.value)||0;setAbsences(prev=>{const cur=(prev[day]||[]).filter(x=>x!==s.id&&(typeof x!=="object"||x.id!==s.id));return val>0?{...prev,[day]:[...cur,{id:s.id,hours:val}]}:{...prev,[day]:cur};});}}
                                      style={{width:"36px",padding:"2px",border:`1px solid ${C.border}`,borderRadius:"3px",textAlign:"center",fontSize:"11px",background:isAbsent?"#f5f5f5":normalHrs===0?"#f0f0f0":"white"}}/>
                                  </td>
                                  <td style={{padding:"2px",textAlign:"center",background:i%2===0?C.light:C.white}}>
                                    <input type="checkbox" checked={isAbsent} onChange={e=>{setAbsences(prev=>{const cur=(prev[day]||[]).filter(x=>x!==s.id&&(typeof x!=="object"||x.id!==s.id));return e.target.checked?{...prev,[day]:[...cur,s.id]}:{...prev,[day]:cur};});}}/>
                                  </td>
                                </React.Fragment>
                              );
                            })}
                            <td style={{padding:"6px",textAlign:"center",fontWeight:"700",color:totalAbsHrs>0?C.red:C.textLight,background:i%2===0?C.light:C.white,fontSize:"12px"}}>{totalAbsHrs>0?`${totalAbsHrs}h`:"—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Best practice guide */}
                <div style={{marginTop:"14px",padding:"12px 16px",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:"8px",fontSize:"12px",color:"#166534"}}>
                  <strong>Coverage cascade (best practice):</strong> 1️⃣ Same-GH staff first → 2️⃣ Nearest capable staff → 3️⃣ Reschedule to later in week → 4️⃣ OT as last resort. Picking &amp; Harvesting cannot be deferred — flag as lost production if uncovered.
                </div>
                {/* Action buttons */}
                <div style={{marginTop:"10px",display:"flex",gap:"8px",flexWrap:"wrap",alignItems:"center"}}>
                  {(role==="gm"||role==="lm")&&<button onClick={()=>generateSchedule()} disabled={generating} style={{...btn(false,C.green),opacity:generating?0.7:1}}>{generating?"⏳ Optimising...":"🚀 Full Regenerate"}</button>}
                  {schedule&&staff.filter(s=>ALL_DAYS.some(d=>{const al=absences[d]||[];return al.includes(s.id)||al.some(x=>typeof x==="object"&&x.id===s.id);})).map(s=>{
                    const affectedDays=ALL_DAYS.filter(d=>{const al=absences[d]||[];return al.includes(s.id)||al.some(x=>typeof x==="object"&&x.id===s.id);});
                    return(<div key={s.id} style={{display:"flex",gap:"4px"}}>
                      <button onClick={()=>reoptimise(s.id,affectedDays)} disabled={generating} style={{...btn(false,C.gold),fontSize:"12px",opacity:generating?0.7:1}}>↻ Min-disrupt: {s.name}</button>
                      {affectedDays.map(day=>(
                        <button key={day} onClick={()=>reoptimise(s.id,[day])} disabled={generating} style={{...btn(false,C.teal),fontSize:"11px",padding:"5px 8px",opacity:generating?0.7:1}}>↻ {day.slice(0,3)} only</button>
                      ))}
                    </div>);
                  })}
                </div>
                {/* Coverage analysis per day */}
                {schedule&&ALL_DAYS.some(d=>{const al=absences[d]||[];return al.some(x=>x===staff.find(s=>true)?.id||typeof x==="object");})&&(
                  <div style={{marginTop:"16px"}}>
                    <div style={{fontSize:"13px",fontWeight:"700",color:C.navy,marginBottom:"10px"}}>📊 Day-by-Day Coverage Analysis</div>
                    {ALL_DAYS.map(day=>{
                      const al=absences[day]||[];
                      const absentStaff=staff.filter(s=>al.includes(s.id)||al.some(x=>typeof x==="object"&&x.id===s.id));
                      if(!absentStaff.length)return null;
                      const dayAssignments=schedule[day]||[];
                      return(
                        <div key={day} style={{marginBottom:"12px",border:`1px solid ${C.border}`,borderRadius:"8px",overflow:"hidden"}}>
                          <div style={{background:C.navy,color:"white",padding:"8px 14px",fontSize:"12px",fontWeight:"700"}}>{day} — {absentStaff.length} absent</div>
                          {absentStaff.map(s=>{
                            const sched=dayAssignments.filter(a=>a.staffId===s.id&&!a.unassigned&&!a.isOT);
                            const normalHrs=s.dayHours?.[day]??(["Saturday","Sunday"].includes(day)?0:s.hoursPerDay??7);
                            const partialEntry=(al.find(x=>typeof x==="object"&&x.id===s.id));
                            const absHrs=al.includes(s.id)?normalHrs:(partialEntry?.hours||0);
                            if(sched.length===0)return(
                              <div key={s.id} style={{padding:"8px 14px",fontSize:"12px",color:C.textLight,borderBottom:`1px solid ${C.borderLight}`}}>
                                {s.name} — {absHrs}h absent, no assignments to cover.
                              </div>
                            );
                            return(
                              <div key={s.id} style={{padding:"10px 14px",borderBottom:`1px solid ${C.borderLight}`}}>
                                <div style={{fontSize:"12px",fontWeight:"600",color:C.navy,marginBottom:"6px"}}>{s.name} — {absHrs}h absent</div>
                                {sched.map((a,ai)=>{
                                  const candidates=staff.filter(cs=>{
                                    if(cs.id===s.id)return false;
                                    const csAbs=absences[day]||[];
                                    if(csAbs.includes(cs.id)||csAbs.some(x=>typeof x==="object"&&x.id===cs.id))return false;
                                    const contracted=cs.dayHours?.[day]??(["Saturday","Sunday"].includes(day)?0:cs.hoursPerDay??7);
                                    const already=dayAssignments.filter(da=>da.staffId===cs.id&&!da.unassigned).reduce((s,da)=>s+da.hours,0);
                                    return contracted-already>=a.hours*0.5;
                                  }).sort((ca,cb)=>{
                                    const sameGHA=dayAssignments.some(da=>da.staffId===ca.id&&da.greenhouse===a.greenhouse);
                                    const sameGHB=dayAssignments.some(da=>da.staffId===cb.id&&da.greenhouse===a.greenhouse);
                                    if(sameGHA&&!sameGHB)return-1;
                                    if(!sameGHA&&sameGHB)return 1;
                                    return 0;
                                  }).slice(0,3);
                                  const isND=["Picking","Harvesting"].some(nd=>a.activity?.toLowerCase().includes(nd.toLowerCase()));
                                  return(
                                    <div key={ai} style={{display:"flex",alignItems:"center",gap:"10px",padding:"5px 0",borderBottom:"1px dashed #e5e7eb",flexWrap:"wrap"}}>
                                      <span style={{fontSize:"11px",background:isND?"#fee2e2":"#f0f4f8",color:isND?C.red:C.navy,padding:"2px 8px",borderRadius:"10px",fontWeight:"600",whiteSpace:"nowrap"}}>{a.activity} — {a.greenhouse} ({a.hours}h){isND?" ⚠️ Non-deferrable":""}</span>
                                      {candidates.length>0?(
                                        <span style={{fontSize:"11px",color:C.textMid}}>→ Suggest: {candidates.map(c=>{const sameGH=dayAssignments.some(da=>da.staffId===c.id&&da.greenhouse===a.greenhouse);return<span key={c.id} style={{background:sameGH?"#d1fae5":"#f3f4f6",color:sameGH?"#065f46":C.textDark,padding:"1px 6px",borderRadius:"8px",marginLeft:"4px",fontWeight:sameGH?"700":"400"}}>{c.name}{sameGH?" ★":""}</span>;})}
                                        </span>
                                      ):(
                                        <span style={{fontSize:"11px",color:C.red}}>⚠️ No available coverage — {isND?"production lost":"consider OT or reschedule"}</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      );
                    }).filter(Boolean)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══ OVERTIME ══ */}
        {page==="overtime"&&(
          <OvertimePage
            staff={staff} ghList={ghList} activities={activities}
            schedule={schedule} absences={absences}
            overtimeEntries={overtimeEntries} setOvertimeEntries={setOvertimeEntries}
            role={role} activeWeek={activeWeek} activeWeekIndex={activeWeekIndex}
            generating={generating} setGenerating={setGenerating}
            rebuildScheduleFromOT={rebuildScheduleFromOT}
            btn={btn} inp={inp} card={card} C={C} API={API} fmtDate={fmtDate}/>
        )}

        {/* ══ EDIT ══ */}
        {page==="edit"&&(
          <div>
            <h2 style={{color:C.navy,marginBottom:"16px"}}>✏️ Edit Master Data</h2>

            {/* ── Master Staff Defaults ── */}
            <div style={{...card,marginBottom:"18px",borderTop:`4px solid ${C.green}`,background:"#f0fff4"}}>
              <h3 style={{color:C.navy,marginBottom:"4px"}}>👥 Master Staff Defaults</h3>
              <p style={{fontSize:"12px",color:C.textLight,marginBottom:"14px"}}>Set defaults for all staff. Click "Apply to All" to push these values to every staff member (individual overrides remain possible).</p>
              <div style={{display:"flex",gap:"20px",alignItems:"flex-end",flexWrap:"wrap"}}>
                <div>
                  <label style={{fontSize:"12px",color:C.textMid,display:"block",marginBottom:"4px"}}>Max daily hours (all staff)</label>
                  <input type="number" min="1" max="16" value={masterDefaults.hoursPerDay}
                    onChange={e=>setMasterDefaults(p=>({...p,hoursPerDay:parseInt(e.target.value)||7}))}
                    style={{...inp,width:"70px",textAlign:"center",fontSize:"15px",fontWeight:"700"}}/>
                </div>
                <div>
                  <label style={{fontSize:"12px",color:C.textMid,display:"block",marginBottom:"4px"}}>Max overtime / week (all staff)</label>
                  <input type="number" min="0" max="80" value={masterDefaults.overtimeLimit}
                    onChange={e=>setMasterDefaults(p=>({...p,overtimeLimit:parseInt(e.target.value)||30}))}
                    style={{...inp,width:"70px",textAlign:"center",fontSize:"15px",fontWeight:"700"}}/>
                </div>
                <button onClick={()=>{
                  setStaff(prev=>prev.map(s=>({
                    ...s,
                    hoursPerDay:masterDefaults.hoursPerDay,
                    overtimeLimit:masterDefaults.overtimeLimit,
                    dayHours:{Monday:masterDefaults.hoursPerDay,Tuesday:masterDefaults.hoursPerDay,Wednesday:masterDefaults.hoursPerDay,Thursday:masterDefaults.hoursPerDay,Friday:masterDefaults.hoursPerDay,Saturday:0,Sunday:0},
                  })));
                  setBackupReminder(true);
                }} style={{...btn(false,C.green),alignSelf:"flex-end"}}>
                  ✓ Apply to All Staff
                </button>
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"18px"}}>
              <div style={card}>
                <h3 style={{color:C.navy,marginBottom:"6px"}}>🏗️ Greenhouses ({ghList.length})</h3>
                <div style={{maxHeight:"320px",overflowY:"auto",marginBottom:"10px"}}>
                  {ghList.map((gh,i)=><div key={i} style={{display:"flex",gap:"8px",marginBottom:"6px",alignItems:"center"}}><input value={gh.name} onChange={e=>{const g=[...greenhouses];g[i]={...normaliseGH(g[i]),name:e.target.value,id:e.target.value};setGreenhouses(g);}} style={{...inp,flex:1}}/><button onClick={()=>setGreenhouses(greenhouses.filter((_,j)=>j!==i))} style={btn(false,C.red)}>✕</button></div>)}
                </div>
                <button onClick={()=>setGreenhouses([...greenhouses,{id:`GH-${String(ghList.length+1).padStart(2,"0")}`,name:`GH-${String(ghList.length+1).padStart(2,"0")}`,cropTypes:[]}])} style={btn(false,C.green)}>+ Add Greenhouse</button>
              </div>
              <div style={card}>
                <h3 style={{color:C.navy,marginBottom:"12px"}}>🌱 Crop Types ({cropTypes.length})</h3>
                <div style={{maxHeight:"200px",overflowY:"auto",marginBottom:"10px"}}>{cropTypes.map((ct,i)=><div key={i} style={{display:"flex",gap:"8px",marginBottom:"6px"}}><input value={ct} onChange={e=>{const c=[...cropTypes];c[i]=e.target.value;setCropTypes(c);}} style={{...inp,flex:1}}/><button onClick={()=>setCropTypes(cropTypes.filter((_,j)=>j!==i))} style={btn(false,C.red)}>✕</button></div>)}</div>
                <button onClick={()=>setCropTypes([...cropTypes,"New Crop Type"])} style={btn(false,C.green)}>+ Add Crop Type</button>
              </div>
              <div style={card}>
                <h3 style={{color:C.navy,marginBottom:"12px"}}>⚙️ Activities ({activities.length})</h3>
                <div style={{maxHeight:"200px",overflowY:"auto",marginBottom:"10px"}}>{activities.map((act,i)=><div key={i} style={{display:"flex",gap:"8px",marginBottom:"6px"}}><input value={act} onChange={e=>{const a=[...activities];a[i]=e.target.value;setActivities(a);}} style={{...inp,flex:1}}/><button onClick={()=>setActivities(activities.filter((_,j)=>j!==i))} style={btn(false,C.red)}>✕</button></div>)}</div>
                <button onClick={()=>setActivities([...activities,"New Activity"])} style={btn(false,C.green)}>+ Add Activity</button>
              </div>
              <div style={card}><h3 style={{color:C.navy,marginBottom:"12px"}}>👤 Add New Staff</h3><AddStaffForm staff={staff} setStaff={setStaff} masterDefaults={masterDefaults} btn={btn} inp={inp} setBackupReminder={setBackupReminder}/></div>
            </div>

            {/* Staff table */}
            {staff.length>0&&(
              <div style={{...card,marginTop:"18px"}}>
                <h3 style={{color:C.navy,marginBottom:"12px"}}>👥 Manage Staff ({staff.length})</h3>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr><TH>ID</TH><TH>Name</TH><TH center>Hrs/Day</TH><TH center>OT Limit</TH><TH>Crops</TH><TH>Actions</TH></tr></thead>
                  <tbody>{staff.map((s,i)=>{
                    const crops=s.cropTypes||[];
                    return(<tr key={s.id} style={{background:i%2===0?C.light:C.white}}>
                      <TD i={i}><span style={{fontFamily:"monospace",color:C.navy,fontWeight:"700"}}>{s.id}</span></TD>
                      <TD i={i}>{s.name}</TD>
                      <TD i={i} center>{s.hoursPerDay??7}h</TD>
                      <TD i={i} center>{s.overtimeLimit??30}h</TD>
                      <TD i={i}><span style={{fontSize:"11px",color:crops.length===0?C.green:C.textMid}}>{crops.length===0?"All crops":crops.slice(0,3).join(", ")+(crops.length>3?` +${crops.length-3}`:"")}</span></TD>
                      <TD i={i}><button onClick={()=>setSelectedStaff({...s})} style={btn(false,C.purple)}>✏️ Edit</button><button onClick={()=>{if(window.confirm(`Remove ${s.name}?`))setStaff(staff.filter(x=>x.id!==s.id));}} style={btn(false,C.red)}>🗑️</button></TD>
                    </tr>);
                  })}</tbody>
                </table>
              </div>
            )}

            {/* CSV Bulk Import */}
            <div style={{...card,marginTop:"18px",borderTop:`4px solid ${C.blue}`}}>
              <h3 style={{color:C.navy,marginBottom:"8px"}}>📋 Bulk Import Staff (CSV)</h3>
              <BulkCSVImport staff={staff} setStaff={setStaff} API={API} btn={btn} inp={inp} C={C} setBackupReminder={setBackupReminder}/>
            </div>
          </div>
        )}

        {/* ══ QUARANTINE ══ */}
        {page==="quarantine"&&(role==="gm"||role==="lm"||role==="grower")&&(
          <div>
            <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"16px"}}>
              <h2 style={{color:C.red,margin:0}}>🔴 Quarantine</h2>
              <span style={{background:"#ffe5e5",color:C.red,padding:"4px 10px",borderRadius:"20px",fontSize:"12px",fontWeight:"700"}}>{role==="gm"?"GM":"FULL ACCESS"}</span>
            </div>
            <div style={card}>
              <QuarantinePanel staff={staff} ghList={ghList} quarantine={quarantine} setQuarantine={setQuarantine} quarantineHistory={quarantineHistory} setQuarantineHistory={setQuarantineHistory} schedule={schedule} dailyAllocation={dailyAllocation} setDailyAllocation={setDailyAllocation} confirmedWeeks={confirmedWeeks} setConfirmedWeeks={setConfirmedWeeks} wsHolidays={wsHolidays} activities={activities} addAuditEntry={addAuditEntry} btn={btn} inp={inp} C={C} API={API} adelaideTime={adelaideTime} fmtISOReadable={fmtISOReadable} role={role}/>
            </div>
          </div>
        )}

        {/* ══ BACKUP ══ */}
        {page==="backup"&&(
          <BackupPage
            staff={staff} ghList={ghList} activities={activities} cropTypes={cropTypes}
            clusters={clusters} clusterTransitions={clusterTransitions}
            demand={demand} absences={absences} schedule={schedule}
            scheduleSummary={scheduleSummary} quarantine={quarantine}
            quarantineHistory={quarantineHistory} cycles={cycles}
            activeCycleId={activeCycleId} tolerance={tolerance}
            exportBackup={exportBackup}
            handleJSONFileRead={handleJSONFileRead}
            importMergeMode={importMergeMode} setImportMergeMode={setImportMergeMode}
            btn={btn} inp={inp} card={card} C={C} API={API}
            adelaideTime={adelaideTime}/>
        )}
        </>}

      </div>

      {selectedStaff&&(
        <StaffProfilePopup selectedStaff={selectedStaff} setSelectedStaff={setSelectedStaff} staff={staff} setStaff={setStaff} activities={activities} ghNames={ghNames} ghList={ghList} cropTypes={cropTypes} absences={absences} calcVersatility={calcVersatility} btn={btn} inp={inp} C={C} ALL_DAYS={ALL_DAYS} DAY_SHORT={DAY_SHORT} setBackupReminder={setBackupReminder}/>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLUSTER TRANSITION UI — in Dashboard
// ═══════════════════════════════════════════════════════════════════════════════
function ClusterTransitionUI({clusters,setClusters,clusterTransitions,setClusterTransitions,ghNames,btn,inp,card,C}){
  const clusterNames=clusters.map(c=>c.name);
  // Build pairs of clusters for transition time entry
  const pairs=[];
  for(let i=0;i<clusterNames.length;i++){
    for(let j=i+1;j<clusterNames.length;j++){
      pairs.push([clusterNames[i],clusterNames[j]]);
    }
  }
  return(
    <div style={card}>
      <h4 style={{color:C.navy,margin:"0 0 12px 0"}}>🗺️ Greenhouse Clusters & Transition Times</h4>
      <div style={{display:"flex",gap:"14px",flexWrap:"wrap",marginBottom:"16px"}}>
        {clusters.map((cl,ci)=>(
          <div key={ci} style={{background:C.light,border:`1px solid ${C.border}`,borderRadius:"8px",padding:"12px",minWidth:"200px"}}>
            <div style={{display:"flex",gap:"6px",marginBottom:"8px"}}><input value={cl.name} onChange={e=>{const c=[...clusters];c[ci]={...c[ci],name:e.target.value};setClusters(c);}} style={{...inp,flex:1,fontSize:"13px"}}/><button onClick={()=>setClusters(clusters.filter((_,j)=>j!==ci))} style={btn(false,C.red)}>✕</button></div>
            <div style={{fontSize:"11px",color:C.textLight,marginBottom:"6px"}}>Greenhouses in cluster:</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:"4px"}}>
              {ghNames.map(gh=>(
                <label key={gh} style={{display:"flex",alignItems:"center",gap:"3px",background:(cl.greenhouses||[]).includes(gh)?"#d5f0ff":"white",padding:"2px 6px",borderRadius:"4px",border:`1px solid ${(cl.greenhouses||[]).includes(gh)?C.blue:C.border}`,cursor:"pointer",fontSize:"11px"}}>
                  <input type="checkbox" checked={(cl.greenhouses||[]).includes(gh)} onChange={e=>{const c=[...clusters];const ghs=cl.greenhouses||[];c[ci]={...c[ci],greenhouses:e.target.checked?[...ghs,gh]:ghs.filter(g=>g!==gh)};setClusters(c);}}/>{gh}
                </label>
              ))}
            </div>
          </div>
        ))}
        <button onClick={()=>setClusters([...clusters,{name:`Cluster ${clusters.length+1}`,greenhouses:[]}])} style={{...btn(false,C.teal),alignSelf:"flex-start"}}>+ Add Cluster</button>
      </div>

      {/* Cross-cluster transition times */}
      {pairs.length>0&&(
        <div>
          <div style={{fontSize:"13px",fontWeight:"700",color:C.navy,marginBottom:"8px"}}>⏱️ Cross-Cluster Travel Times (minutes)</div>
          <p style={{fontSize:"12px",color:C.textMid,marginBottom:"10px"}}>Within-cluster moves: 10 min (fixed). Set travel time between clusters below:</p>
          <div style={{display:"flex",gap:"10px",flexWrap:"wrap"}}>
            {pairs.map(([a,b])=>{
              const key=`${a}->${b}`;
              const val=clusterTransitions[key]||clusterTransitions[`${b}->${a}`]||"";
              return(
                <div key={key} style={{display:"flex",alignItems:"center",gap:"8px",background:C.light,padding:"8px 12px",borderRadius:"6px",border:`1px solid ${C.border}`}}>
                  <span style={{fontSize:"12px",fontWeight:"600",color:C.navy}}>{a}</span>
                  <span style={{color:C.textLight,fontSize:"12px"}}>↔</span>
                  <span style={{fontSize:"12px",fontWeight:"600",color:C.navy}}>{b}</span>
                  <input type="number" min="0" max="120" value={val} placeholder="mins"
                    onChange={e=>{const mins=parseInt(e.target.value)||0;setClusterTransitions(prev=>({...prev,[key]:mins,[`${b}->${a}`]:mins}));}}
                    style={{...inp,width:"60px",textAlign:"center",fontSize:"12px"}}/>
                  <span style={{fontSize:"11px",color:C.textLight}}>min</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {clusters.length===0&&<p style={{color:C.textLight,fontSize:"13px",margin:"8px 0 0 0"}}>No clusters defined. Add a cluster above.</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULE PAGE — three views (GH / Staff / Activity) over CP-SAT assignments
// ═══════════════════════════════════════════════════════════════════════════════
function SchedulePage({scheduleData,setScheduleData,dailyAllocation,confirmedWeeks,demandVersion,staff,absences,clusters,clusterTransitions,quarantine,role,btn,inp,card,C,API}){
  const DAYS=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  const DAY_S={Monday:"Mon",Tuesday:"Tue",Wednesday:"Wed",Thursday:"Thu",Friday:"Fri",Saturday:"Sat",Sunday:"Sun"};

  const [schedTab,setSchedTab]=React.useState("gh");
  const [selWeek,setSelWeek]=React.useState(null);
  const [selGH,setSelGH]=React.useState(null);
  const [selStaff,setSelStaff]=React.useState(null);
  const [selAct,setSelAct]=React.useState(null);
  const [running,setRunning]=React.useState(false);
  const [overrides,setOverrides]=React.useState({});
  const [editCell,setEditCell]=React.useState(null);

  const addD=(iso,n)=>{const d=new Date(iso);d.setDate(d.getDate()+n);return d.toISOString().split("T")[0];};
  const fmtD=(iso)=>{if(!iso)return"";const d=new Date(iso);return d.toLocaleDateString("en-AU",{day:"2-digit",month:"short"});};

  // Load YDP plans + GH name map
  const ydpPlans=React.useMemo(()=>{try{return JSON.parse(localStorage.getItem("ydp_plans_v1"))||[];}catch{return [];}});
  const ghNameMap=React.useMemo(()=>{try{const lp=JSON.parse(localStorage.getItem("labourPlanner_v1"))||{};const m={};(lp.greenhouses||[]).forEach(gh=>{m[gh.id]=gh.name;});return m;}catch{return {};}});
  const ghCropsMap=React.useMemo(()=>{
    const m={};
    ydpPlans.forEach(p=>{const n=ghNameMap[p.ghId]||p.ghId;if(!m[n])m[n]=[];if(p.cropName&&!m[n].includes(p.cropName))m[n].push(p.cropName);});
    return m;
  });

  // Find calendar weeks that have confirmed demand
  const confirmedCalWeeks=React.useMemo(()=>{
    const ws=new Set();
    ydpPlans.forEach(p=>{
      for(let wi=0;wi<p.cycleWeeks;wi++){
        if(confirmedWeeks[`${p.id}__w${wi}`]){ws.add(addD(p.startDate,wi*7));}
      }
    });
    return Array.from(ws).sort();
  },[confirmedWeeks,ydpPlans.length]);

  // Auto-select first week
  React.useEffect(()=>{
    if(!selWeek&&confirmedCalWeeks.length>0)setSelWeek(confirmedCalWeeks[0]);
  },[confirmedCalWeeks.length]);

  // Normalise short day names (Mon→Monday) stored by DemandPage
  const DAY_EXPAND={Mon:"Monday",Tue:"Tuesday",Wed:"Wednesday",Thu:"Thursday",Fri:"Friday",Sat:"Saturday",Sun:"Sunday"};
  const normDay=(d)=>DAY_EXPAND[d]||d;

  // Aggregate daily demand for selected calendar week across all confirmed plans
  const aggregateDemand=React.useCallback((weekStart)=>{
    const demand={};const crops={};
    ydpPlans.forEach(p=>{
      for(let wi=0;wi<p.cycleWeeks;wi++){
        const wStart=addD(p.startDate,wi*7);
        if(wStart!==weekStart||!confirmedWeeks[`${p.id}__w${wi}`])continue;
        const alloc=dailyAllocation[`${p.id}__w${wi}`]||{};
        const ghN=ghNameMap[p.ghId]||p.ghId;
        if(!demand[ghN])demand[ghN]={};
        if(!crops[ghN])crops[ghN]=[];
        if(p.cropName&&!crops[ghN].includes(p.cropName))crops[ghN].push(p.cropName);
        Object.entries(alloc).forEach(([act,days])=>{
          if(!demand[ghN][act])demand[ghN][act]={};
          Object.entries(days).forEach(([day,h])=>{
            const fullDay=normDay(day);
            demand[ghN][act][fullDay]=(demand[ghN][act][fullDay]||0)+(parseFloat(h)||0);
          });
        });
      }
    });
    return{demand,crops};
  },[ydpPlans,dailyAllocation,confirmedWeeks,ghNameMap]);

  // Translate simplified crop/activity model → backend {activity,allGreenhouses,cropTypes} format
  const expandStaff=React.useCallback((s,allActivities,allCrops)=>{
    const sCrops=s.cropTypes?.length?s.cropTypes:allCrops;
    const cActs=s.cropActivities||{};
    const actMap={};
    sCrops.forEach(crop=>{
      const acts=cActs[crop]==null?allActivities:(cActs[crop].length?cActs[crop]:allActivities);
      acts.forEach(act=>{if(!actMap[act])actMap[act]=[];actMap[act].push(crop);});
    });
    const activities=Object.entries(actMap).map(([act,crops])=>({activity:act,allGreenhouses:true,cropTypes:crops,ghCropTypes:{}}));
    return{...s,activities};
  },[]);

  // Run CP-SAT optimiser
  const runOptimiser=async()=>{
    if(!selWeek)return;
    setRunning(true);
    const{demand,crops}=aggregateDemand(selWeek);
    const allActNames=[...new Set(Object.values(demand).flatMap(a=>Object.keys(a)))];
    const allCropNames=[...new Set(Object.values(crops).flat())];
    const expandedStaff=staff.map(s=>expandStaff(s,allActNames.length?allActNames:["All"],allCropNames.length?allCropNames:["All"]));
    try{
      const res=await axios.post(`${API}/schedule-optimise`,{
        dailyDemand:demand,
        staff:expandedStaff,absences,clusters,clusterTransitions,quarantine,
        ghCropsMap:crops,
        currentDate:new Date().toISOString(),
        timeLimitSecs:10,
      });
      const{assignments=[],summary={}}=res.data;
      setScheduleData(prev=>({...prev,[selWeek]:{assignments,summary,generatedAt:new Date().toISOString()}}));
      setOverrides(prev=>({...prev,[selWeek]:{}}));
      // Auto-select first item in current tab
      const ghs=[...new Set(assignments.filter(a=>!a.unassigned).map(a=>a.greenhouse))].sort();
      if(ghs.length>0&&!selGH)setSelGH(ghs[0]);
    }catch(e){alert("Optimiser error: "+e.message);}
    setRunning(false);
  };

  // Auto-run: when a week is selected with no schedule, or demand version bumps
  const autoRunRef=React.useRef(null);
  React.useEffect(()=>{
    if(!selWeek||running)return;
    if(autoRunRef.current)clearTimeout(autoRunRef.current);
    const hasSchedule=!!scheduleData[selWeek];
    const delay=hasSchedule?4000:800;
    autoRunRef.current=setTimeout(()=>runOptimiser(),delay);
    return()=>{if(autoRunRef.current)clearTimeout(autoRunRef.current);};
  },[selWeek,demandVersion]);

  const weekData=selWeek?scheduleData[selWeek]:null;
  const assignments=weekData?.assignments||[];
  const summary=weekData?.summary||{};
  const weekOverrides=(selWeek&&overrides[selWeek])||{};

  // Override helpers
  const getHours=(a)=>{
    const k=`${a.staffId}__${a.greenhouse}__${a.activity}__${a.day}`;
    return weekOverrides[k]!=null?weekOverrides[k]:a.hours;
  };
  const setHours=(a,val)=>{
    const k=`${a.staffId}__${a.greenhouse}__${a.activity}__${a.day}`;
    setOverrides(prev=>({...prev,[selWeek]:{...(prev[selWeek]||{}),[k]:parseFloat(val)||0}}));
  };

  // Demand data for the selected week (always available once week is chosen)
  const weekDemand=React.useMemo(()=>selWeek?aggregateDemand(selWeek).demand:{},[selWeek,aggregateDemand]);
  const demandGHList=Object.keys(weekDemand).sort();

  // Unique lists from optimiser assignments
  const assigned=assignments.filter(a=>!a.unassigned);
  const unassigned=assignments.filter(a=>a.unassigned);
  const ghList=weekData?[...new Set(assignments.map(a=>a.greenhouse))].sort():demandGHList;
  const staffList=[...new Set(assigned.map(a=>a.staffId))].map(id=>{
    const a=assigned.find(x=>x.staffId===id);return{id,name:a?.staffName||id};
  }).sort((a,b)=>a.name.localeCompare(b.name));
  const actList=weekData?[...new Set(assigned.map(a=>a.activity))].sort():[...new Set(demandGHList.flatMap(gh=>Object.keys(weekDemand[gh]||{})))].sort();

  // Quality badge
  const qBg={optimal:"#dcfce7",feasible:"#fef9c3",greedy:"#e0f2fe",greedy_fallback:"#fce7f3",infeasible:"#fee2e2",timeout:"#fff7ed",unknown:"#f3f4f6"};
  const qCol={optimal:"#166534",feasible:"#713f12",greedy:"#075985",greedy_fallback:"#9d174d",infeasible:"#991b1b",timeout:"#9a3412",unknown:"#374151"};

  const Row=({label,val,sub,highlight})=>(
    <tr style={{background:highlight?"#f0fdf4":"white"}}>
      <td style={{padding:"8px 14px",fontSize:"13px",fontWeight:"500",color:C.textDark,borderBottom:`1px solid #e5e7eb`,width:"150px"}}>{label}</td>
      <td style={{padding:"8px 14px",fontSize:"13px",color:C.textDark,borderBottom:`1px solid #e5e7eb`,fontWeight:highlight?"700":"400"}}>{val}</td>
      {sub&&<td style={{padding:"8px 14px",fontSize:"11px",color:C.textLight,borderBottom:`1px solid #e5e7eb`}}>{sub}</td>}
    </tr>
  );

  // Read-only hour cell (schedule is auto-managed by CP-SAT)
  const HrsCell=({a,style={}})=>{
    const h=getHours(a);
    return <span style={{fontWeight:"700",color:C.navy,...style}}>{h}h</span>;
  };

  return(
    <div>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:"14px",marginBottom:"14px",flexWrap:"wrap"}}>
        <h2 style={{color:C.navy,margin:0,fontSize:"18px"}}>📅 Schedule</h2>
        {summary.quality&&<span style={{background:qBg[summary.quality]||"#f3f4f6",color:qCol[summary.quality]||"#374151",padding:"4px 12px",borderRadius:"12px",fontSize:"12px",fontWeight:"700"}}>
          {summary.solver==="cpsat"||summary.quality==="optimal"||summary.quality==="feasible"?"⚡ CP-SAT":"⚙️ Greedy"} · {summary.quality}
          {summary.wallTime?` · ${summary.wallTime}s`:""}
        </span>}
        {summary.quality&&<div style={{display:"flex",gap:"16px",fontSize:"12px",color:C.textMid}}>
          <span>Coverage: <strong style={{color:summary.coverageRate>=99?C.green:summary.coverageRate>=85?"#d97706":"#dc2626"}}>{summary.coverageRate}%</strong></span>
          <span>Assigned: <strong>{summary.totalAssigned}h</strong></span>
          {summary.totalUnmet>0&&<span style={{color:"#dc2626"}}>Unmet: <strong>{summary.totalUnmet}h</strong></span>}
          {summary.otHours>0&&<span style={{color:"#d97706"}}>OT: <strong>{summary.otHours}h</strong></span>}
          {summary.staffMultiGH>0&&<span style={{color:C.textMid}}>Multi-GH staff: {summary.staffMultiGH}</span>}
        </div>}
      </div>

      {/* Week selector row */}
      <div style={{display:"flex",gap:"8px",alignItems:"center",marginBottom:"14px",flexWrap:"wrap"}}>
        <span style={{fontSize:"12px",fontWeight:"600",color:C.textMid}}>Confirmed weeks:</span>
        {confirmedCalWeeks.length===0&&<span style={{fontSize:"12px",color:C.textLight,fontStyle:"italic"}}>No confirmed weeks yet — confirm a week in the Demand tab first.</span>}
        {confirmedCalWeeks.map(ws=>{
          const hasSched=!!scheduleData[ws];
          return(
            <button key={ws} onClick={()=>{setSelWeek(ws);setSelGH(null);setSelStaff(null);setSelAct(null);}}
              style={{padding:"6px 14px",background:selWeek===ws?C.navy:"white",color:selWeek===ws?"white":C.textMid,border:`2px solid ${selWeek===ws?C.navy:C.border}`,borderRadius:"7px",cursor:"pointer",fontSize:"12px",fontWeight:"600",position:"relative"}}>
              {fmtD(ws)} – {fmtD(addD(ws,6))}
              {hasSched&&<span style={{position:"absolute",top:"-6px",right:"-6px",background:"#22c55e",color:"white",borderRadius:"50%",width:"14px",height:"14px",fontSize:"9px",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"800"}}>✓</span>}
            </button>
          );
        })}
        {running&&<span style={{marginLeft:"8px",fontSize:"12px",color:C.teal,fontWeight:"600",display:"flex",alignItems:"center",gap:"6px"}}>
          <span style={{display:"inline-block",width:"12px",height:"12px",border:`2px solid ${C.teal}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
          CP-SAT optimising…
        </span>}
        {!running&&selWeek&&<span style={{marginLeft:"8px",fontSize:"11px",color:C.textLight,fontStyle:"italic"}}>⚡ CP-SAT optimiser active — schedule updates automatically</span>}
      </div>

      {!selWeek?(
        <div style={card}><p style={{color:C.textLight,fontStyle:"italic",textAlign:"center",padding:"20px 0"}}>Select a confirmed week above to view or generate its schedule.</p></div>
      ):(
        <div>
          {/* Sub-tabs */}
          <div style={{display:"flex",gap:0,marginBottom:"14px",borderBottom:`2px solid ${C.border}`}}>
            {[{id:"gh",label:"🏗 Greenhouse"},{id:"staff",label:"👤 Staff"},{id:"activity",label:"🔧 Activity"}].map(t=>(
              <button key={t.id} onClick={()=>setSchedTab(t.id)}
                style={{background:"none",border:"none",borderBottom:schedTab===t.id?`3px solid ${C.teal}`:"3px solid transparent",padding:"10px 20px",cursor:"pointer",fontSize:"13px",fontWeight:schedTab===t.id?"700":"400",color:schedTab===t.id?C.teal:C.textMid,marginBottom:"-2px"}}>
                {t.label}
              </button>
            ))}
            {unassigned.length>0&&<div style={{marginLeft:"auto",display:"flex",alignItems:"center",padding:"0 8px",fontSize:"12px",color:"#dc2626",fontWeight:"600"}}>
              ⚠️ {unassigned.length} unmet slot{unassigned.length!==1?"s":""}
            </div>}
          </div>

          {/* ── GH VIEW ── */}
          {schedTab==="gh"&&(
            <div style={{display:"flex",gap:0,height:"calc(100vh - 280px)",borderRadius:"10px",overflow:"hidden",border:`1px solid ${C.border}`,boxShadow:"0 2px 12px rgba(0,0,0,0.08)"}}>
              <div style={{width:"190px",minWidth:"190px",background:C.navy,display:"flex",flexDirection:"column"}}>
                <div style={{padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.45)",fontSize:"10px",fontWeight:"700",letterSpacing:"2px",textTransform:"uppercase"}}>Greenhouses</div>
                <div style={{flex:1,overflowY:"auto"}}>
                  {ghList.length===0&&<div style={{padding:"14px",color:"rgba(255,255,255,0.35)",fontSize:"12px",fontStyle:"italic"}}>No demand confirmed yet</div>}
                  {ghList.map(gh=>{
                    const demH=DAYS.reduce((s,d)=>s+Object.values(weekDemand[gh]||{}).reduce((ss,days)=>ss+(days[d]||0),0),0);
                    const assH=assigned.filter(a=>a.greenhouse===gh).reduce((s,a)=>s+getHours(a),0);
                    return(
                      <button key={gh} onClick={()=>setSelGH(gh)}
                        style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",background:selGH===gh?"rgba(255,255,255,0.13)":"transparent",border:"none",borderLeft:selGH===gh?"3px solid #52B788":"3px solid transparent",color:selGH===gh?"white":"rgba(255,255,255,0.65)",cursor:"pointer",fontSize:"12px",fontWeight:selGH===gh?"600":"400"}}>
                        {gh}
                        <div style={{fontSize:"10px",color:"rgba(255,255,255,0.35)",marginTop:"2px"}}>
                          {weekData?`${assH.toFixed(1)}h assigned / ${demH.toFixed(1)}h demand`:`${demH.toFixed(1)}h demand`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{flex:1,background:"#f8faf8",overflow:"auto"}}>
                {!selGH?<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:C.textLight,fontStyle:"italic"}}>Select a greenhouse</div>:(
                  <div style={{padding:"14px"}}>
                    {/* Demand grid — always shown */}
                    {!weekData&&(
                      <div style={{marginBottom:"16px",background:"#fffbea",border:"1px solid #fde68a",borderRadius:"8px",padding:"10px 14px",fontSize:"12px",color:"#92400e"}}>
                        ⚡ Run CP-SAT Optimiser above to assign staff to this demand.
                      </div>
                    )}
                    {/* Activity × Day demand table */}
                    {(()=>{
                      const ghDem=weekDemand[selGH]||{};
                      const acts=Object.keys(ghDem).sort();
                      if(!acts.length)return<div style={{color:C.textLight,fontStyle:"italic",fontSize:"13px"}}>No demand allocated for this greenhouse in the Demand tab.</div>;
                      return(
                        <div style={{marginBottom:"16px",background:"white",border:`1px solid ${C.border}`,borderRadius:"8px",overflow:"hidden"}}>
                          <div style={{background:C.navy,padding:"8px 14px",display:"flex",gap:"8px",alignItems:"center"}}>
                            <span style={{color:"white",fontWeight:"700",fontSize:"12px",flex:1}}>📋 Demand (hrs / activity / day)</span>
                          </div>
                          <div style={{overflowX:"auto"}}>
                            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
                              <thead>
                                <tr style={{background:"#f0f4f8"}}>
                                  <th style={{padding:"6px 12px",textAlign:"left",color:C.textMid,fontWeight:"600",borderBottom:`1px solid ${C.border}`,minWidth:"140px"}}>Activity</th>
                                  {DAYS.map(d=><th key={d} style={{padding:"6px 8px",textAlign:"center",color:C.textMid,fontWeight:"600",borderBottom:`1px solid ${C.border}`,minWidth:"52px"}}>{DAY_S[d]}</th>)}
                                  <th style={{padding:"6px 8px",textAlign:"center",color:C.textMid,fontWeight:"600",borderBottom:`1px solid ${C.border}`}}>Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {acts.map((act,i)=>{
                                  const row=ghDem[act]||{};
                                  const total=DAYS.reduce((s,d)=>s+(row[d]||0),0);
                                  return(
                                    <tr key={act} style={{background:i%2===0?"white":"#f8faf8"}}>
                                      <td style={{padding:"6px 12px",color:C.textDark,fontWeight:"500",borderBottom:`1px solid #e5e7eb`}}>{act}</td>
                                      {DAYS.map(d=>{
                                        const h=row[d]||0;
                                        const assAct=assigned.filter(a=>a.greenhouse===selGH&&a.activity===act&&a.day===d);
                                        const assH=assAct.reduce((s,a)=>s+getHours(a),0);
                                        return(
                                          <td key={d} style={{padding:"4px 8px",textAlign:"center",borderBottom:`1px solid #e5e7eb`,background:h>0?(weekData?(assH>=h*0.95?"#dcfce7":assH>0?"#fef9c3":"#fee2e2"):"#f0fdf4"):"white"}}>
                                            {h>0?(
                                              <div>
                                                <div style={{fontWeight:"700",color:C.navy,fontSize:"12px"}}>{h}h</div>
                                                {weekData&&assH>0&&<div style={{fontSize:"10px",color:"#166534"}}>{assH.toFixed(1)}✓</div>}
                                              </div>
                                            ):"—"}
                                          </td>
                                        );
                                      })}
                                      <td style={{padding:"6px 8px",textAlign:"center",fontWeight:"700",color:C.navy,borderBottom:`1px solid #e5e7eb`,background:"#f0f4f8"}}>{total.toFixed(1)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}
                    {/* Staff assignments per day (post-optimiser) */}
                    {weekData&&DAYS.map(day=>{
                      const dayRows=assigned.filter(a=>a.greenhouse===selGH&&a.day===day);
                      if(!dayRows.length)return null;
                      const acts=[...new Set(dayRows.map(a=>a.activity))].sort();
                      return(
                        <div key={day} style={{marginBottom:"14px",border:`1px solid ${C.border}`,borderRadius:"8px",overflow:"hidden",background:"white"}}>
                          <div style={{background:"#1e3a5f",padding:"8px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <span style={{color:"white",fontWeight:"700",fontSize:"13px"}}>{day}</span>
                            <span style={{color:"#52B788",fontSize:"12px"}}>{dayRows.reduce((s,a)=>s+getHours(a),0).toFixed(1)} hrs assigned</span>
                          </div>
                          {acts.map(act=>{
                            const actRows=dayRows.filter(a=>a.activity===act);
                            return(
                              <div key={act} style={{borderBottom:`1px solid #e5e7eb`}}>
                                <div style={{background:"#f0f4f8",padding:"5px 14px",fontSize:"11px",fontWeight:"700",color:C.textMid,textTransform:"uppercase",letterSpacing:"0.5px"}}>{act}</div>
                                {actRows.map((a,i)=>(
                                  <div key={i} style={{display:"flex",alignItems:"center",gap:"10px",padding:"7px 14px",borderTop:i>0?`1px solid #f3f4f6`:"none"}}>
                                    <span style={{flex:1,fontSize:"13px",color:C.textDark}}>{a.staffName}</span>
                                    {a.transitionMins>0&&<span style={{fontSize:"11px",color:"#d97706",background:"#fef3c7",padding:"1px 6px",borderRadius:"10px"}}>+{a.transitionMins}min travel</span>}
                                    <HrsCell a={a}/>
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                    {/* Unmet slots for this GH */}
                    {weekData&&unassigned.filter(a=>a.greenhouse===selGH).map((a,i)=>(
                      <div key={i} style={{background:"#fee2e2",border:"1px solid #fca5a5",borderRadius:"6px",padding:"8px 12px",marginBottom:"6px",fontSize:"12px",color:"#991b1b"}}>
                        ⚠️ {a.day} · {a.activity} · {a.hours}h unassigned — no eligible staff with capacity
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── STAFF VIEW ── */}
          {schedTab==="staff"&&(
            <div style={{display:"flex",gap:0,height:"calc(100vh - 280px)",borderRadius:"10px",overflow:"hidden",border:`1px solid ${C.border}`,boxShadow:"0 2px 12px rgba(0,0,0,0.08)"}}>
              <div style={{width:"190px",minWidth:"190px",background:C.navy,display:"flex",flexDirection:"column"}}>
                <div style={{padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.45)",fontSize:"10px",fontWeight:"700",letterSpacing:"2px",textTransform:"uppercase"}}>Staff</div>
                <div style={{flex:1,overflowY:"auto"}}>
                  {staffList.map(s=>{
                    const hrs=assigned.filter(a=>a.staffId===s.id).reduce((t,a)=>t+getHours(a),0);
                    return(
                      <button key={s.id} onClick={()=>setSelStaff(s.id)}
                        style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",background:selStaff===s.id?"rgba(255,255,255,0.13)":"transparent",border:"none",borderLeft:selStaff===s.id?"3px solid #52B788":"3px solid transparent",color:selStaff===s.id?"white":"rgba(255,255,255,0.65)",cursor:"pointer",fontSize:"12px",fontWeight:selStaff===s.id?"600":"400"}}>
                        {s.name}
                        <div style={{fontSize:"10px",color:"rgba(255,255,255,0.35)",marginTop:"2px"}}>{hrs.toFixed(1)}h scheduled</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{flex:1,background:"#f8faf8",overflow:"auto"}}>
                {!selStaff?<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:C.textLight,fontStyle:"italic"}}>Select a staff member</div>:(()=>{
                  const sRows=assigned.filter(a=>a.staffId===selStaff);
                  const sObj=staff.find(s=>s.id===selStaff);
                  const totalHrs=sRows.reduce((t,a)=>t+getHours(a),0);
                  const contracted=sObj?Object.values(sObj.dayHours||{}).reduce((s,h)=>s+h,0):0;
                  const isOT=totalHrs>contracted;
                  return(
                    <div style={{padding:"14px"}}>
                      <div style={{background:"white",borderRadius:"8px",border:`1px solid ${C.border}`,padding:"12px 16px",marginBottom:"14px",display:"flex",gap:"24px",alignItems:"center",flexWrap:"wrap"}}>
                        <div>
                          <div style={{fontWeight:"700",fontSize:"15px",color:C.navy}}>{sRows[0]?.staffName}</div>
                          <div style={{fontSize:"12px",color:C.textMid,marginTop:"2px"}}>
                            Total: <strong style={{color:isOT?"#d97706":C.green}}>{totalHrs.toFixed(1)}h</strong>
                            {contracted>0&&<> / Contracted: {contracted}h {isOT&&<span style={{color:"#d97706",fontWeight:"700"}}>(+{(totalHrs-contracted).toFixed(1)}h OT)</span>}</>}
                          </div>
                        </div>
                        <div style={{display:"flex",gap:"10px",flexWrap:"wrap",fontSize:"12px"}}>
                          {[...new Set(sRows.map(a=>a.greenhouse))].map(gh=>(
                            <span key={gh} style={{background:"#e0f2fe",color:"#0369a1",padding:"3px 10px",borderRadius:"12px"}}>{gh}</span>
                          ))}
                        </div>
                      </div>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px",background:"white",borderRadius:"8px",overflow:"hidden",border:`1px solid ${C.border}`}}>
                        <thead>
                          <tr style={{background:C.navy}}>
                            <th style={{padding:"8px 14px",textAlign:"left",color:"white",fontWeight:"700",fontSize:"12px"}}>Day</th>
                            <th style={{padding:"8px 14px",textAlign:"left",color:"white",fontWeight:"700",fontSize:"12px"}}>Greenhouse</th>
                            <th style={{padding:"8px 14px",textAlign:"left",color:"white",fontWeight:"700",fontSize:"12px"}}>Activity</th>
                            <th style={{padding:"8px 14px",textAlign:"center",color:"white",fontWeight:"700",fontSize:"12px"}}>Hours</th>
                            <th style={{padding:"8px 14px",textAlign:"center",color:"white",fontWeight:"700",fontSize:"12px"}}>Travel</th>
                          </tr>
                        </thead>
                        <tbody>
                          {DAYS.flatMap(day=>{
                            const dayRows=sRows.filter(a=>a.day===day);
                            if(!dayRows.length)return[];
                            return dayRows.map((a,i)=>(
                              <tr key={`${day}-${i}`} style={{background:i%2===0?"white":"#f8faf8",borderBottom:`1px solid #e5e7eb`}}>
                                {i===0&&<td rowSpan={dayRows.length} style={{padding:"8px 14px",fontWeight:"700",color:C.navy,verticalAlign:"top"}}>{DAY_S[day]||day}</td>}
                                <td style={{padding:"8px 14px",color:C.textDark}}>{a.greenhouse}</td>
                                <td style={{padding:"8px 14px",color:C.textDark}}>{a.activity}</td>
                                <td style={{padding:"8px 14px",textAlign:"center"}}><HrsCell a={a}/></td>
                                <td style={{padding:"8px 14px",textAlign:"center",color:a.transitionMins>0?"#d97706":C.textLight,fontSize:"12px"}}>{a.transitionMins>0?`${a.transitionMins}min`:"—"}</td>
                              </tr>
                            ));
                          })}
                          <tr style={{background:"#f0fdf4",fontWeight:"800"}}>
                            <td colSpan={3} style={{padding:"8px 14px",color:C.navy,fontSize:"13px"}}>Week total</td>
                            <td style={{padding:"8px 14px",textAlign:"center",color:isOT?"#d97706":C.green,fontSize:"14px"}}>{totalHrs.toFixed(1)}h</td>
                            <td/>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ── ACTIVITY VIEW ── */}
          {schedTab==="activity"&&(
            <div style={{display:"flex",gap:0,height:"calc(100vh - 280px)",borderRadius:"10px",overflow:"hidden",border:`1px solid ${C.border}`,boxShadow:"0 2px 12px rgba(0,0,0,0.08)"}}>
              <div style={{width:"190px",minWidth:"190px",background:C.navy,display:"flex",flexDirection:"column"}}>
                <div style={{padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.45)",fontSize:"10px",fontWeight:"700",letterSpacing:"2px",textTransform:"uppercase"}}>Activities</div>
                <div style={{flex:1,overflowY:"auto"}}>
                  {actList.length===0&&<div style={{padding:"14px",color:"rgba(255,255,255,0.35)",fontSize:"12px",fontStyle:"italic"}}>No demand confirmed yet</div>}
                  {actList.map(act=>{
                    const demH=demandGHList.reduce((s,gh)=>s+DAYS.reduce((ss,d)=>ss+((weekDemand[gh]||{})[act]?.[d]||0),0),0);
                    const assH=assigned.filter(a=>a.activity===act).reduce((s,a)=>s+getHours(a),0);
                    return(
                      <button key={act} onClick={()=>setSelAct(act)}
                        style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",background:selAct===act?"rgba(255,255,255,0.13)":"transparent",border:"none",borderLeft:selAct===act?"3px solid #52B788":"3px solid transparent",color:selAct===act?"white":"rgba(255,255,255,0.65)",cursor:"pointer",fontSize:"12px",fontWeight:selAct===act?"600":"400"}}>
                        {act}
                        <div style={{fontSize:"10px",color:"rgba(255,255,255,0.35)",marginTop:"2px"}}>
                          {weekData?`${assH.toFixed(1)}h assigned / ${demH.toFixed(1)}h demand`:`${demH.toFixed(1)}h demand`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{flex:1,background:"#f8faf8",overflow:"auto"}}>
                {!selAct?<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:C.textLight,fontStyle:"italic"}}>Select an activity</div>:(
                  <div style={{padding:"14px"}}>
                    {/* Demand summary per GH for this activity */}
                    <div style={{marginBottom:"14px",background:"white",border:`1px solid ${C.border}`,borderRadius:"8px",overflow:"hidden"}}>
                      <div style={{background:C.navy,padding:"8px 14px",display:"flex",gap:"8px",alignItems:"center"}}>
                        <span style={{color:"white",fontWeight:"700",fontSize:"12px",flex:1}}>📋 {selAct} — Demand by Greenhouse & Day</span>
                      </div>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
                        <thead><tr style={{background:"#f0f4f8"}}>
                          <th style={{padding:"6px 12px",textAlign:"left",fontWeight:"700",color:C.navy,borderBottom:`1px solid ${C.border}`}}>Greenhouse</th>
                          {DAYS.map(d=><th key={d} style={{padding:"6px 8px",textAlign:"center",fontWeight:"600",color:["Saturday","Sunday"].includes(d)?"#b45309":C.textMid,borderBottom:`1px solid ${C.border}`,minWidth:"52px"}}>{DAY_S[d]}</th>)}
                          <th style={{padding:"6px 8px",textAlign:"center",fontWeight:"700",color:C.navy,borderBottom:`1px solid ${C.border}`,background:"#e8f4fd"}}>Total</th>
                        </tr></thead>
                        <tbody>
                          {demandGHList.filter(gh=>(weekDemand[gh]||{})[selAct]).map((gh,gi)=>{
                            const row=(weekDemand[gh]||{})[selAct]||{};
                            const total=DAYS.reduce((s,d)=>s+(row[d]||0),0);
                            return(
                              <tr key={gh} style={{background:gi%2===0?"white":"#f8faf8"}}>
                                <td style={{padding:"7px 12px",color:C.textDark,fontWeight:"500",borderBottom:`1px solid #e5e7eb`}}>{gh}</td>
                                {DAYS.map(d=>{
                                  const h=row[d]||0;
                                  const assH=assigned.filter(a=>a.greenhouse===gh&&a.activity===selAct&&a.day===d).reduce((s,a)=>s+getHours(a),0);
                                  return<td key={d} style={{padding:"5px 4px",textAlign:"center",borderBottom:`1px solid #e5e7eb`,background:["Saturday","Sunday"].includes(d)?"#fffbf0":h>0?(weekData?(assH>=h*0.95?"#dcfce7":assH>0?"#fef9c3":"#fee2e2"):"#f0fdf4"):undefined}}>
                                    {h>0?(<div><div style={{fontWeight:"700",color:C.navy}}>{h}h</div>{weekData&&assH>0&&<div style={{fontSize:"10px",color:"#166534"}}>{assH.toFixed(1)}✓</div>}</div>):"—"}
                                  </td>;
                                })}
                                <td style={{padding:"7px 8px",textAlign:"center",fontWeight:"700",color:C.navy,borderBottom:`1px solid #e5e7eb`,background:"#e8f4fd"}}>{total.toFixed(1)}h</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {/* Staff assignments (post-optimiser) */}
                    {weekData&&ghList.map(gh=>{
                      const ghActRows=assigned.filter(a=>a.greenhouse===gh&&a.activity===selAct);
                      if(!ghActRows.length)return null;
                      const ghHrs=ghActRows.reduce((s,a)=>s+getHours(a),0);
                      return(
                        <div key={gh} style={{marginBottom:"14px",border:`1px solid ${C.border}`,borderRadius:"8px",overflow:"hidden",background:"white"}}>
                          <div style={{background:"#1e3a5f",padding:"8px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <span style={{color:"white",fontWeight:"700",fontSize:"13px"}}>{gh}</span>
                            <span style={{color:"#52B788",fontSize:"12px"}}>{ghHrs.toFixed(1)} hrs assigned</span>
                          </div>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
                            <thead><tr style={{background:"#f0f4f8"}}>
                              <th style={{padding:"6px 12px",textAlign:"left",fontWeight:"700",color:C.navy,borderBottom:`1px solid ${C.border}`}}>Staff</th>
                              {DAYS.map(d=><th key={d} style={{padding:"6px 8px",textAlign:"center",fontWeight:"600",color:["Saturday","Sunday"].includes(d)?"#b45309":C.textMid,borderBottom:`1px solid ${C.border}`,minWidth:"52px"}}>{DAY_S[d]}</th>)}
                              <th style={{padding:"6px 8px",textAlign:"center",fontWeight:"700",color:C.navy,borderBottom:`1px solid ${C.border}`,background:"#e8f4fd"}}>Total</th>
                            </tr></thead>
                            <tbody>
                              {[...new Set(ghActRows.map(a=>a.staffId))].map((sid,si)=>{
                                const name=ghActRows.find(a=>a.staffId===sid)?.staffName||sid;
                                const staffTotal=ghActRows.filter(a=>a.staffId===sid).reduce((s,a)=>s+getHours(a),0);
                                return(
                                  <tr key={sid} style={{background:si%2===0?"white":"#f8faf8"}}>
                                    <td style={{padding:"7px 12px",color:C.textDark,fontWeight:"500",borderBottom:`1px solid #e5e7eb`}}>{name}</td>
                                    {DAYS.map(day=>{
                                      const a=ghActRows.find(x=>x.staffId===sid&&x.day===day);
                                      return<td key={day} style={{padding:"6px 4px",textAlign:"center",borderBottom:`1px solid #e5e7eb`,background:["Saturday","Sunday"].includes(day)?"#fffbf0":undefined}}>
                                        {a?<HrsCell a={a}/>:<span style={{color:C.textLight}}>—</span>}
                                      </td>;
                                    })}
                                    <td style={{padding:"7px 8px",textAlign:"center",fontWeight:"700",color:C.navy,borderBottom:`1px solid #e5e7eb`,background:"#e8f4fd"}}>{staffTotal.toFixed(1)}h</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                    {weekData&&unassigned.filter(a=>a.activity===selAct).map((a,i)=>(
                      <div key={i} style={{background:"#fee2e2",border:"1px solid #fca5a5",borderRadius:"6px",padding:"8px 12px",marginBottom:"6px",fontSize:"12px",color:"#991b1b"}}>
                        ⚠️ {a.greenhouse} · {a.day} · {a.hours}h unassigned
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEMAND PAGE — splits YDP weekly hours into daily allocations per GH
// ═══════════════════════════════════════════════════════════════════════════════
function DemandPage({wsHolidays,setWsHolidays,dailyAllocation,setDailyAllocation,confirmedWeeks,setConfirmedWeeks,carStandards,setCarStandards,setDemandVersion,addAuditEntry,role,btn,inp,card,C}){
  const [demandSubTab,setDemandSubTab]=React.useState("weekly");
  const [selGHId,setSelGHId]=React.useState(null);       // weekly planner
  const [selPlanId,setSelPlanId]=React.useState(null);    // weekly planner
  const [selWeekIdx,setSelWeekIdx]=React.useState(0);
  const [selStdCropName,setSelStdCropName]=React.useState(null); // standards tab — crop type
  const [stdsDirty,setStdsDirty]=React.useState(false);  // true after editing a standard
  const [holidayForm,setHolidayForm]=React.useState({date:"",scope:"all",ghName:"",label:""});

  const FULL_DAYS=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  const DAYS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const DAY_SHORT={Monday:"Mon",Tuesday:"Tue",Wednesday:"Wed",Thursday:"Thu",Friday:"Fri",Saturday:"Sat",Sunday:"Sun"};
  const SPECIAL=["Picking","Pollination"];

  const addD=(iso,n)=>{const d=new Date(iso);d.setDate(d.getDate()+n);return d.toISOString().split("T")[0];};
  const fmtD=(iso)=>{if(!iso)return"";const d=new Date(iso);return d.toLocaleDateString("en-AU",{day:"2-digit",month:"short"});};
  const getCell=(cell)=>cell?.isManual?(parseFloat(cell.manualHours)||0):(parseFloat(cell?.hours)||0);

  const defaultDaysFor=(n)=>{
    if(n===1)return Math.random()<0.5?["Tuesday"]:["Thursday"];
    if(n===2)return["Monday","Wednesday"];
    if(n===3)return["Monday","Thursday","Friday"];
    return FULL_DAYS.slice(0,Math.min(n,7));
  };

  // Load YDP plans, GH name map, LP data from localStorage
  const ydpPlans=React.useMemo(()=>{try{return JSON.parse(localStorage.getItem("ydp_plans_v1"))||[];}catch{return [];}});
  const lpData=React.useMemo(()=>{try{return JSON.parse(localStorage.getItem("labourPlanner_v1"))||{};}catch{return {};}});
  const ghNameMap=React.useMemo(()=>{
    const m={};(lpData.greenhouses||[]).forEach(gh=>{m[gh.id]=gh.name;});return m;
  },[lpData]);
  const ghGroups=React.useMemo(()=>{
    const seen={};
    ydpPlans.forEach(p=>{
      if(!seen[p.ghId])seen[p.ghId]={ghId:p.ghId,name:ghNameMap[p.ghId]||p.ghId,plans:[]};
      seen[p.ghId].plans.push(p);
    });
    return Object.values(seen);
  },[ydpPlans.length]);

  // Standards tab — unique crop type list (from YDP plans)
  const stdCropList=React.useMemo(()=>[...new Set(ydpPlans.map(p=>p.cropName))].filter(Boolean).sort(),[ydpPlans.length]);

  // Auto-select first crop type for standards tab
  React.useEffect(()=>{
    if(!selStdCropName&&stdCropList.length>0)setSelStdCropName(stdCropList[0]);
  },[stdCropList.length]);

  // Auto-apply standards when switching to a crop type that has never been applied
  React.useEffect(()=>{
    if(!selStdCropName)return;
    const plans=ydpPlans.filter(p=>p.cropName===selStdCropName);
    const hasAnyAlloc=plans.some(plan=>Array.from({length:plan.cycleWeeks||0},(_,wi)=>`${plan.id}__w${wi}`).some(k=>dailyAllocation[k]&&Object.keys(dailyAllocation[k]).length>0));
    if(!hasAnyAlloc&&plans.length>0){recalcPlanWeeks(selStdCropName);}
    setStdsDirty(false);
  },[selStdCropName]);

  // Auto-select first GH on load (weekly planner)
  React.useEffect(()=>{
    if(!selGHId&&ghGroups.length>0)setSelGHId(ghGroups[0].ghId);
  },[ghGroups.length]);

  // Auto-select first plan when GH changes (weekly planner)
  React.useEffect(()=>{
    const gh=ghGroups.find(g=>g.ghId===selGHId);
    if(gh&&gh.plans.length>0&&!gh.plans.find(p=>p.id===selPlanId)){
      setSelPlanId(gh.plans[0].id);setSelWeekIdx(0);
    }
  },[selGHId]);

  const selGH=ghGroups.find(g=>g.ghId===selGHId)||null;
  const selPlan=selGH?.plans.find(p=>p.id===selPlanId)||selGH?.plans[0]||null;
  const allocKey=selPlan?`${selPlan.id}__w${selWeekIdx}`:null;
  const weekAlloc=allocKey?dailyAllocation[allocKey]||{}:{};
  const isConfirmed=allocKey?!!confirmedWeeks[allocKey]:false;

  // All rows for the selected plan (weekly planner)
  const actRows=selPlan?Object.keys(selPlan.grid?.activities||{}).filter(a=>!SPECIAL.includes(a)):[];
  const allRows=[...actRows,...SPECIAL];

  // Standards tab — representative plan + activity list for selected crop type
  const stdRepPlan=React.useMemo(()=>ydpPlans.find(p=>p.cropName===selStdCropName)||null,[selStdCropName,ydpPlans.length]);
  const stdActList=React.useMemo(()=>{
    // Activities from LP crop master for this crop type
    const cycles=lpData.cropCycles||[];
    const cyc=cycles.find(c=>c.name===selStdCropName);
    const cmd=(lpData.cropMasterData||[]).find(d=>d.cropId===cyc?.id);
    // Union: activities ticked in crop cycle master + any in YDP plan grids
    const fromLP=cyc?Object.keys(cyc.matrix||{}).map(k=>k.split("|||")[0]).filter(a=>!SPECIAL.includes(a)):[];
    const fromYDP=ydpPlans.filter(p=>p.cropName===selStdCropName).flatMap(p=>Object.keys(p.grid?.activities||{}).filter(a=>!SPECIAL.includes(a)));
    const regular=[...new Set([...fromLP,...fromYDP])].sort();
    // Include SPECIAL if data exists
    const hasPickData=!!(lpData.pickingData||[]).find(d=>d.cropId===cyc?.id&&d.roundsPerWeek);
    // Pollination applies per GH, always include
    return[...regular,...(regular.length>0||hasPickData?SPECIAL:[])];
  },[selStdCropName,lpData,ydpPlans.length]);

  // Weekly target for a row from YDP
  const weeklyTarget=(act,wi,plan)=>{
    if(!plan)return 0;
    if(act==="Picking")return getCell(plan.grid?.pickingCells?.[wi]);
    if(act==="Pollination")return getCell(plan.grid?.pollinationCells?.[wi]);
    return getCell(plan.grid?.activities?.[act]?.[wi]);
  };

  // Standards helpers
  const getDefaultTimesPerWeek=(plan,act)=>{
    const cycles=lpData.cropCycles||[];
    const cyc=cycles.find(c=>c.name===plan?.cropName);
    if(act==="Picking"){
      const pd=(lpData.pickingData||[]).find(d=>d.cropId===cyc?.id);
      if(pd?.roundsPerWeek)return Math.max(1,parseInt(pd.roundsPerWeek)||1);
      return 1;
    }
    if(act==="Pollination"){
      const pol=(lpData.pollinationData||[]).find(d=>d.ghId===plan?.ghId);
      if(pol?.roundsPerWeek)return Math.max(1,parseInt(pol.roundsPerWeek)||1);
      return 1;
    }
    // All other activities: read ×/wk from Crop Master cells[act].t
    if(cyc){
      const cmd=(lpData.cropMasterData||[]).find(d=>d.cropId===cyc.id);
      const t=cmd?.cells?.[act]?.t;
      if(t)return Math.max(1,parseInt(t)||1);
    }
    return 1;
  };
  // Standards are keyed by cropName (not planId) — one standard per crop type applies to ALL GHs growing it
  const getOrInitStd=(plan,act)=>{
    const saved=carStandards[plan?.cropName]?.[act];
    if(saved)return saved;
    const n=getDefaultTimesPerWeek(plan,act);
    return{timesPerWeek:n,mode:n>1?"alt":"once",days:defaultDaysFor(n)};
  };
  const updateStd=(cropName,act,updates)=>{
    setStdsDirty(true);
    setCarStandards(prev=>{
      const ps=prev[cropName]||{};const cur=ps[act]||{timesPerWeek:1,mode:"once",days:["Tuesday"]};
      let ns={...cur,...updates};
      if(updates.timesPerWeek!==undefined&&parseInt(updates.timesPerWeek)!==cur.timesPerWeek){
        const n=parseInt(updates.timesPerWeek)||1;ns.mode=n>1?"alt":"once";ns.days=defaultDaysFor(n);
      }
      return{...prev,[cropName]:{...ps,[act]:ns}};
    });
  };
  const toggleStdDay=(cropName,act,fullDay,std)=>{
    const days=std.days||[];
    const nd=days.includes(fullDay)?days.filter(d=>d!==fullDay):[...days,fullDay];
    if(!nd.length)return;
    updateStd(cropName,act,{days:nd});
  };

  // Allocate a specific plan+week from standards (returns {key, result})
  const allocPlanWeek=(plan,wi)=>{
    const key=`${plan.id}__w${wi}`;
    const weekStart=addD(plan.startDate,wi*7);
    const holDates=new Set(wsHolidays.filter(h=>h.scope==="all"||h.ghName===plan.ghId).map(h=>h.date));
    const rows=[...Object.keys(plan.grid?.activities||{}).filter(a=>!SPECIAL.includes(a)),...SPECIAL];
    const result={};
    rows.forEach(act=>{
      const total=weeklyTarget(act,wi,plan);
      if(!total||total===0)return;
      const std=carStandards[plan.cropName]?.[act]||getOrInitStd(plan,act);
      let workDays;
      if(std.days&&std.days.length>0){
        if(std.mode==="alt"){
          workDays=std.days.filter(fd=>{const di=FULL_DAYS.indexOf(fd);return di<0||!holDates.has(addD(weekStart,di));}).map(fd=>DAY_SHORT[fd]||fd);
        }else{
          const fd=std.days[0];const di=FULL_DAYS.indexOf(fd);
          if(di>=0&&!holDates.has(addD(weekStart,di))){workDays=[DAY_SHORT[fd]||fd];}
          else{workDays=DAYS.filter((_,i)=>!holDates.has(addD(weekStart,i)));}
        }
      }else{workDays=DAYS.filter((_,i)=>!holDates.has(addD(weekStart,i)));}
      if(!workDays.length)return;
      let rem=total;const alloc={};
      workDays.forEach((d,pos)=>{
        if(pos===workDays.length-1){alloc[d]=Math.round(rem*10)/10;}
        else{const share=Math.round(total/workDays.length*10)/10;alloc[d]=share;rem=Math.round((rem-share)*10)/10;}
      });
      result[act]=alloc;
    });
    return{key,result};
  };

  // Recalculate all unconfirmed weeks for ALL plans sharing the same cropName
  const recalcPlanWeeks=(cropName)=>{
    const plans=ydpPlans.filter(p=>p.cropName===cropName);
    if(!plans.length)return;
    if(addAuditEntry)addAuditEntry("standard",`Standards applied — ${cropName} (all GHs)`,{crop:cropName});
    let totalUpdates={};
    plans.forEach(plan=>{
      for(let wi=0;wi<plan.cycleWeeks;wi++){
        if(confirmedWeeks[`${plan.id}__w${wi}`])continue;
        const{key,result}=allocPlanWeek(plan,wi);
        totalUpdates[key]=result;
      }
    });
    if(Object.keys(totalUpdates).length>0){
      setDailyAllocation(prev=>({...prev,...totalUpdates}));
      if(setDemandVersion)setDemandVersion(v=>v+1);
    }
  };

  // Auto-allocate current week when it has no data yet
  React.useEffect(()=>{
    if(!selPlan||!allocKey||isConfirmed)return;
    const existing=dailyAllocation[allocKey];
    if(existing&&Object.keys(existing).length>0)return;
    const{key,result}=allocPlanWeek(selPlan,selWeekIdx);
    if(Object.keys(result).length>0)setDailyAllocation(prev=>({...prev,[key]:result}));
  },[allocKey]);

  // Daily allocation accessors
  const getAllocVal=(act,day)=>{const v=weekAlloc[act]?.[day];return v!=null?v:"";};
  const setAllocVal=(act,day,val)=>{
    if(!allocKey)return;
    setDailyAllocation(prev=>{
      const cur=prev[allocKey]||{};const curAct=cur[act]||{};const newAct={...curAct};
      const num=val===""?undefined:parseFloat(val);
      if(num==null||isNaN(num))delete newAct[day];else newAct[day]=num;
      return{...prev,[allocKey]:{...cur,[act]:newAct}};
    });
  };

  // Confirm / unconfirm
  const confirmWeek=()=>{
    if(!allocKey)return;
    setConfirmedWeeks(prev=>({...prev,[allocKey]:true}));
    if(setDemandVersion)setDemandVersion(v=>v+1);
    if(addAuditEntry)addAuditEntry("confirm",`Week ${selWeekIdx+1} confirmed — ${selGH?.name||""} ${selPlan?.cropName||""}`,{gh:selGH?.name,week:selWeekIdx+1,crop:selPlan?.cropName});
  };
  const unconfirmWeek=()=>{
    if(!allocKey)return;
    setConfirmedWeeks(prev=>{const n={...prev};delete n[allocKey];return n;});
    if(addAuditEntry)addAuditEntry("unconfirm",`Week ${selWeekIdx+1} unconfirmed — ${selGH?.name||""} ${selPlan?.cropName||""}`,{gh:selGH?.name,week:selWeekIdx+1,crop:selPlan?.cropName});
  };

  // Totals
  const rowTotal=(act)=>DAYS.reduce((s,d)=>s+(parseFloat(weekAlloc[act]?.[d])||0),0);
  const dayTotal=(day)=>allRows.reduce((s,act)=>s+(parseFloat(weekAlloc[act]?.[day])||0),0);
  const grandTotal=DAYS.reduce((s,d)=>s+dayTotal(d),0);
  const weekTargetTotal=selPlan?allRows.reduce((s,act)=>s+weeklyTarget(act,selWeekIdx,selPlan),0):0;

  // Deadline banner
  const todayDow=new Date().getDay();
  const isAmber=todayDow>=3&&todayDow<=5;
  const isRed=todayDow===6;

  // Holidays CRUD
  const addHoliday=()=>{
    if(!holidayForm.date||!holidayForm.label){alert("Date and label required.");return;}
    setWsHolidays(prev=>[...prev,{id:`hol_${Date.now()}`,date:holidayForm.date,scope:holidayForm.scope,ghName:holidayForm.ghName,label:holidayForm.label}]);
    if(addAuditEntry)addAuditEntry("holiday_add",`Holiday added: ${holidayForm.label} (${holidayForm.date})`,{date:holidayForm.date,label:holidayForm.label});
    setHolidayForm({date:"",scope:"all",ghName:"",label:""});
  };
  const removeHoliday=(id)=>{
    const h=wsHolidays.find(x=>x.id===id);
    if(addAuditEntry&&h)addAuditEntry("holiday_remove",`Holiday removed: ${h.label} (${h.date})`,{date:h.date,label:h.label});
    setWsHolidays(prev=>prev.filter(x=>x.id!==id));
  };

  return(
    <div>
      {/* Sub-tabs */}
      <div style={{display:"flex",alignItems:"center",gap:0,marginBottom:"18px",borderBottom:`2px solid ${C.border}`}}>
        <h2 style={{color:C.navy,margin:"0 24px 0 0",fontSize:"18px"}}>📋 Demand</h2>
        {[{id:"weekly",label:"Weekly Planner"},{id:"standards",label:"Crop Activity Standards"},{id:"holidays",label:"Holidays"}].map(t=>(
          <button key={t.id} onClick={()=>setDemandSubTab(t.id)} style={{background:"none",border:"none",borderBottom:demandSubTab===t.id?`3px solid ${C.teal}`:"3px solid transparent",padding:"10px 18px",cursor:"pointer",fontSize:"13px",fontWeight:demandSubTab===t.id?"700":"400",color:demandSubTab===t.id?C.teal:C.textMid,marginBottom:"-2px"}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ CROP ACTIVITY STANDARDS ══ */}
      {demandSubTab==="standards"&&(
        <div>
          {/* Info + Apply bar */}
          <div style={{marginBottom:"12px",display:"flex",alignItems:"center",gap:"12px",flexWrap:"wrap"}}>
            <div style={{flex:1,padding:"10px 14px",background:"#fef3c7",border:"1px solid #fcd34d",borderRadius:"8px",fontSize:"12px",color:"#92400e"}}>
              ⚠️ <strong>Standards are per crop type</strong> — applies to every GH growing that crop. Auto-applied on first load. After editing, click Apply to push changes to unconfirmed weeks.
            </div>
            {stdsDirty&&selStdCropName&&(
              <button onClick={()=>{recalcPlanWeeks(selStdCropName);setStdsDirty(false);}} style={{...btn(true,C.teal),padding:"10px 20px",fontSize:"13px",fontWeight:"700",boxShadow:`0 0 0 3px ${C.teal}44`}}>
                ↻ Apply to Unconfirmed Weeks
              </button>
            )}
            {!stdsDirty&&selStdCropName&&(
              <button onClick={()=>recalcPlanWeeks(selStdCropName)} style={{...btn(false,C.teal),padding:"10px 20px",fontSize:"13px"}}>
                ↻ Re-apply to Unconfirmed Weeks
              </button>
            )}
          </div>
          <div style={{display:"flex",gap:0,height:"calc(100vh - 290px)",borderRadius:"10px",overflow:"hidden",border:`1px solid ${C.border}`,boxShadow:"0 2px 12px rgba(0,0,0,0.08)"}}>
            {/* Crop Type sidebar */}
            <div style={{width:"220px",minWidth:"220px",background:C.navy,display:"flex",flexDirection:"column"}}>
              <div style={{padding:"12px 14px",borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
                <div style={{color:"rgba(255,255,255,0.45)",fontSize:"10px",fontWeight:"700",letterSpacing:"2px",textTransform:"uppercase"}}>Crop Types</div>
                <div style={{color:"#52B788",fontSize:"11px",marginTop:"2px"}}>from LP Crop Master</div>
              </div>
              <div style={{flex:1,overflowY:"auto"}}>
                {stdCropList.length===0&&<div style={{padding:"16px",color:"rgba(255,255,255,0.35)",fontSize:"12px",fontStyle:"italic"}}>No crop plans found</div>}
                {stdCropList.map(cropName=>{
                  const isCustom=!!(carStandards[cropName]&&Object.keys(carStandards[cropName]).length>0);
                  return(
                    <button key={cropName} onClick={()=>setSelStdCropName(cropName)} style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",background:selStdCropName===cropName?"rgba(255,255,255,0.13)":"transparent",border:"none",borderLeft:selStdCropName===cropName?"3px solid #52B788":"3px solid transparent",color:selStdCropName===cropName?"white":"rgba(255,255,255,0.65)",cursor:"pointer",fontSize:"12px",fontWeight:selStdCropName===cropName?"600":"400"}}>
                      {cropName}
                      {isCustom&&<span style={{marginLeft:"6px",background:"#f59e0b",color:"white",borderRadius:"4px",padding:"1px 5px",fontSize:"9px",fontWeight:"700"}}>CUSTOM</span>}
                      <div style={{fontSize:"10px",color:"rgba(255,255,255,0.35)",marginTop:"2px"}}>{ydpPlans.filter(p=>p.cropName===cropName).length} GH plan{ydpPlans.filter(p=>p.cropName===cropName).length!==1?"s":""}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Standards grid */}
            {!selStdCropName?(
              <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:C.textLight,fontStyle:"italic",fontSize:"14px",background:"#f8faf8"}}>Select a crop type</div>
            ):(
              <div style={{flex:1,background:"#f8faf8",overflowY:"auto"}}>
                <div style={{background:"white",borderBottom:`1px solid ${C.border}`,padding:"10px 16px",display:"flex",alignItems:"center",gap:"10px"}}>
                  <span style={{fontWeight:"700",color:C.navy,fontSize:"15px"}}>{selStdCropName}</span>
                  <span style={{fontSize:"12px",color:C.textMid}}>· {ydpPlans.filter(p=>p.cropName===selStdCropName).length} GH plan(s) will be updated</span>
                  {stdsDirty&&<span style={{marginLeft:"auto",background:"#fef3c7",color:"#92400e",border:"1px solid #fcd34d",borderRadius:"6px",padding:"3px 10px",fontSize:"11px",fontWeight:"700"}}>Unsaved changes</span>}
                </div>
                {stdActList.length===0?(
                  <div style={{padding:"30px",color:C.textLight,fontStyle:"italic",textAlign:"center"}}>No activities found for this crop in LP Crop Master</div>
                ):(
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px"}}>
                    <thead>
                      <tr style={{background:"#f0f4f8",position:"sticky",top:0,zIndex:2}}>
                        <th style={{padding:"10px 16px",textAlign:"left",fontWeight:"700",color:C.navy,borderBottom:`2px solid ${C.border}`,width:"180px"}}>Activity</th>
                        <th style={{padding:"10px 16px",textAlign:"center",fontWeight:"700",color:C.navy,borderBottom:`2px solid ${C.border}`,width:"110px"}}>Times/week</th>
                        <th style={{padding:"10px 16px",textAlign:"left",fontWeight:"700",color:C.navy,borderBottom:`2px solid ${C.border}`}}>Day schedule</th>
                        <th style={{padding:"10px 16px",textAlign:"center",fontWeight:"700",color:C.navy,borderBottom:`2px solid ${C.border}`,width:"100px"}}>Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stdActList.map((act,ai)=>{
                        const std=getOrInitStd(stdRepPlan,act);
                        const isCustomSaved=!!(carStandards[selStdCropName]?.[act]);
                        const saved=isCustomSaved?carStandards[selStdCropName][act]:std;
                        const isAlt=saved.mode==="alt";
                        const defN=getDefaultTimesPerWeek(stdRepPlan,act);
                        return(
                          <tr key={act} style={{background:ai%2===0?"white":"#f8faf8",borderBottom:`1px solid ${C.border}`}}>
                            <td style={{padding:"10px 16px",fontWeight:"600",color:SPECIAL.includes(act)?"#d4880e":C.textDark}}>{act}</td>
                            <td style={{padding:"10px 16px",textAlign:"center"}}>
                              <input type="number" min="1" max="7" value={saved.timesPerWeek||1}
                                onChange={e=>updateStd(selStdCropName,act,{timesPerWeek:parseInt(e.target.value)||1})}
                                style={{width:"56px",padding:"5px 8px",border:`1px solid ${C.border}`,borderRadius:"6px",textAlign:"center",fontSize:"13px",fontWeight:"700"}}/>
                            </td>
                            <td style={{padding:"10px 16px"}}>
                              <div style={{display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap"}}>
                                <div style={{display:"flex",borderRadius:"6px",overflow:"hidden",border:`1px solid ${C.border}`}}>
                                  <button onClick={()=>updateStd(selStdCropName,act,{mode:"once"})} style={{padding:"5px 14px",background:!isAlt?C.teal:"white",color:!isAlt?"white":C.textMid,border:"none",cursor:"pointer",fontSize:"12px",fontWeight:"600"}}>Once weekly</button>
                                  <button onClick={()=>updateStd(selStdCropName,act,{mode:"alt"})} style={{padding:"5px 14px",background:isAlt?C.teal:"white",color:isAlt?"white":C.textMid,border:"none",cursor:"pointer",fontSize:"12px",fontWeight:"600"}}>Specific days</button>
                                </div>
                                {isAlt?(
                                  <div style={{display:"flex",gap:"4px"}}>
                                    {FULL_DAYS.map((fd,di)=>{
                                      const sel=saved.days?.includes(fd);
                                      const isWE=di>=5;
                                      return(
                                        <button key={fd} onClick={()=>toggleStdDay(selStdCropName,act,fd,saved)}
                                          style={{width:"36px",height:"34px",borderRadius:"6px",background:sel?(isWE?"#f59e0b":C.teal):"white",color:sel?"white":(isWE?"#b45309":C.textMid),border:`1px solid ${sel?(isWE?"#f59e0b":C.teal):C.border}`,cursor:"pointer",fontSize:"11px",fontWeight:"700"}}>
                                          {DAYS[di]}
                                        </button>
                                      );
                                    })}
                                  </div>
                                ):(
                                  <span style={{fontSize:"12px",color:C.textMid,fontStyle:"italic"}}>
                                    {saved.days?.length>0?("→ "+saved.days.join(", ")):"→ No day set"}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{padding:"10px 16px",textAlign:"center"}}>
                              {isCustomSaved
                                ?<span style={{background:"#fef3c7",color:"#92400e",border:"1px solid #fcd34d",borderRadius:"6px",padding:"3px 8px",fontSize:"11px",fontWeight:"700"}}>Custom</span>
                                :<span style={{color:C.textLight,fontSize:"11px"}}>LP default (×{defN})</span>
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ WEEKLY PLANNER ══ */}
      {demandSubTab==="weekly"&&(
        <div>
          {/* Deadline banner */}
          {(isAmber||isRed)&&(
            <div style={{background:isRed?"#fee2e2":"#fef3c7",border:`1px solid ${isRed?"#fca5a5":"#fcd34d"}`,borderRadius:"8px",padding:"10px 16px",marginBottom:"14px",display:"flex",alignItems:"center",gap:"10px"}}>
              <span style={{fontSize:"18px"}}>{isRed?"🔴":"🟡"}</span>
              <span style={{fontSize:"13px",fontWeight:"600",color:isRed?"#991b1b":"#92400e"}}>
                {isRed?"Today is Saturday — confirm next week's demand now!":"Deadline approaching — confirm next week's demand by Saturday."}
              </span>
            </div>
          )}

          {/* Layout */}
          <div style={{display:"flex",gap:0,height:"calc(100vh - 220px)",borderRadius:"10px",overflow:"hidden",border:`1px solid ${C.border}`,boxShadow:"0 2px 12px rgba(0,0,0,0.08)"}}>

            {/* GH sidebar */}
            <div style={{width:"200px",minWidth:"200px",background:C.navy,display:"flex",flexDirection:"column"}}>
              <div style={{padding:"12px 14px",borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
                <div style={{color:"rgba(255,255,255,0.45)",fontSize:"10px",fontWeight:"700",letterSpacing:"2px",textTransform:"uppercase"}}>Greenhouses</div>
                <div style={{color:"#52B788",fontSize:"11px",marginTop:"2px"}}>{ghGroups.length} with plans</div>
              </div>
              <div style={{flex:1,overflowY:"auto"}}>
                {ghGroups.length===0&&<div style={{padding:"20px 14px",color:"rgba(255,255,255,0.35)",fontSize:"12px",fontStyle:"italic"}}>No plans yet — create plans in the Yearly Demand Planner first.</div>}
                {ghGroups.map(g=>(
                  <button key={g.ghId} onClick={()=>{setSelGHId(g.ghId);setSelWeekIdx(0);}} style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",background:selGHId===g.ghId?"rgba(255,255,255,0.13)":"transparent",border:"none",borderLeft:selGHId===g.ghId?"3px solid #52B788":"3px solid transparent",color:selGHId===g.ghId?"white":"rgba(255,255,255,0.65)",cursor:"pointer",fontSize:"12px",fontWeight:selGHId===g.ghId?"600":"400"}}>
                    {g.name}
                    <div style={{fontSize:"10px",color:"rgba(255,255,255,0.35)",marginTop:"2px"}}>{g.plans.length} crop plan{g.plans.length!==1?"s":""}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right panel */}
            {!selGH?(
              <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:C.textLight,fontStyle:"italic",fontSize:"14px",background:"#f8faf8"}}>
                Select a greenhouse to plan its weekly demand
              </div>
            ):(
              <div style={{flex:1,background:"#f8faf8",overflow:"hidden",display:"flex",flexDirection:"column"}}>

                {/* Crop plan selector (multiple plans) */}
                {selGH.plans.length>1&&(
                  <div style={{background:"white",borderBottom:`1px solid ${C.border}`,padding:"8px 14px",display:"flex",gap:"8px",alignItems:"center",flexWrap:"wrap"}}>
                    <span style={{fontSize:"12px",color:C.textMid,fontWeight:"600"}}>Crop plan:</span>
                    {selGH.plans.map(p=>(
                      <button key={p.id} onClick={()=>{setSelPlanId(p.id);setSelWeekIdx(0);}} style={{padding:"4px 12px",background:selPlanId===p.id?C.teal:"white",color:selPlanId===p.id?"white":C.textMid,border:`1px solid ${selPlanId===p.id?C.teal:C.border}`,borderRadius:"6px",cursor:"pointer",fontSize:"12px",fontWeight:"600"}}>
                        {p.cropName}{p.zone&&p.zone!=="full"?` (Zone ${p.zone})`:""}
                      </button>
                    ))}
                  </div>
                )}

                {selPlan&&(<>

                  {/* Week tabs */}
                  <div style={{background:"white",borderBottom:`1px solid ${C.border}`,padding:"8px 14px",display:"flex",gap:"6px",alignItems:"center",overflowX:"auto"}}>
                    <span style={{fontSize:"12px",color:C.textMid,fontWeight:"600",marginRight:"4px",whiteSpace:"nowrap"}}>Week:</span>
                    {Array.from({length:selPlan.cycleWeeks},(_,wi)=>{
                      const wStart=addD(selPlan.startDate,wi*7);
                      const wKey=`${selPlan.id}__w${wi}`;
                      const conf=!!confirmedWeeks[wKey];
                      return(
                        <button key={wi} onClick={()=>setSelWeekIdx(wi)} style={{padding:"5px 12px",background:selWeekIdx===wi?C.navy:"white",color:selWeekIdx===wi?"white":C.textMid,border:`2px solid ${selWeekIdx===wi?C.navy:C.border}`,borderRadius:"6px",cursor:"pointer",fontSize:"12px",fontWeight:"600",whiteSpace:"nowrap",position:"relative"}}>
                          W{wi+1}
                          <div style={{fontSize:"10px",fontWeight:"400",opacity:0.8,marginTop:"1px"}}>{fmtD(wStart)}</div>
                          {conf&&<div style={{position:"absolute",top:"-5px",right:"-5px",background:"#22c55e",color:"white",borderRadius:"50%",width:"14px",height:"14px",fontSize:"9px",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"800"}}>✓</div>}
                        </button>
                      );
                    })}
                  </div>

                  {/* Toolbar */}
                  <div style={{background:"white",borderBottom:`1px solid ${C.border}`,padding:"8px 14px",display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap"}}>
                    <div style={{flex:1,fontSize:"12px",color:C.textMid}}>
                      <strong style={{color:C.navy}}>{selPlan.cropName}</strong>
                      {selPlan.zone&&selPlan.zone!=="full"&&<span style={{marginLeft:"6px",background:"#e0f2fe",color:"#0369a1",padding:"1px 7px",borderRadius:"10px",fontSize:"10px"}}>Zone {selPlan.zone}</span>}
                      <span style={{marginLeft:"10px"}}>Week {selWeekIdx+1} of {selPlan.cycleWeeks} · {fmtD(addD(selPlan.startDate,selWeekIdx*7))} – {fmtD(addD(selPlan.startDate,selWeekIdx*7+6))}</span>
                    </div>
                    <span style={{fontSize:"12px",color:weekTargetTotal>0?(Math.abs(grandTotal-weekTargetTotal)<0.2?C.green:grandTotal>weekTargetTotal?"#dc2626":"#d97706"):C.textLight}}>
                      Allocated: <strong>{grandTotal.toFixed(1)}</strong> / Target: <strong>{weekTargetTotal.toFixed(1)}</strong> hrs
                    </span>
                    {isConfirmed
                      ?<><button onClick={unconfirmWeek} style={{...btn(false,"#6b7280"),padding:"6px 14px",fontSize:"12px"}}>↩ Unconfirm</button>
                        <span style={{background:"#dcfce7",color:"#166534",padding:"4px 10px",borderRadius:"12px",fontSize:"11px",fontWeight:"700"}}>✓ Confirmed</span></>
                      :<button onClick={confirmWeek} style={{...btn(true,C.green),padding:"6px 14px",fontSize:"12px"}}>✓ Confirm week</button>
                    }
                  </div>

                  {/* Grid */}
                  <div style={{flex:1,overflowY:"auto"}}>
                    <table style={{borderCollapse:"collapse",width:"100%",fontSize:"12px",tableLayout:"fixed"}}>
                      <thead style={{position:"sticky",top:0,zIndex:2}}>
                        <tr style={{background:"#f0f4f8"}}>
                          <th style={{padding:"8px 12px",textAlign:"left",fontWeight:"700",color:C.navy,borderBottom:`2px solid ${C.border}`,width:"150px",position:"sticky",left:0,background:"#f0f4f8",zIndex:3}}>Activity</th>
                          {DAYS.map((d,di)=>{
                            const isWE=di>=5;
                            return(
                              <th key={d} style={{padding:"6px 4px",textAlign:"center",fontWeight:"600",color:isWE?"#b45309":C.textMid,borderBottom:`2px solid ${C.border}`,background:isWE?"#fef9c3":"#f0f4f8",minWidth:"72px"}}>
                                {d}
                                <div style={{fontSize:"10px",fontWeight:"400",color:C.textLight}}>{fmtD(addD(selPlan.startDate,selWeekIdx*7+di))}</div>
                              </th>
                            );
                          })}
                          <th style={{padding:"6px 8px",textAlign:"center",fontWeight:"700",color:C.navy,borderBottom:`2px solid ${C.border}`,background:"#e8f4fd",minWidth:"70px"}}>Target<br/><span style={{fontWeight:"400",fontSize:"10px"}}>(from YDP)</span></th>
                          <th style={{padding:"6px 8px",textAlign:"center",fontWeight:"700",color:C.navy,borderBottom:`2px solid ${C.border}`,background:"#f0fdf4",minWidth:"68px"}}>Row<br/>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allRows.map((act,ai)=>{
                          const target=weeklyTarget(act,selWeekIdx,selPlan);
                          const rTotal=rowTotal(act);
                          const isSpec=SPECIAL.includes(act);
                          const rowBg=isSpec?"#fffbf0":ai%2===0?"white":"#f8faf8";
                          const diff=rTotal-target;
                          return(
                            <tr key={act} style={{background:rowBg}}>
                              <td style={{padding:"6px 12px",fontWeight:isSpec?"700":"500",color:isSpec?"#d4880e":C.textDark,borderBottom:`1px solid #e5e7eb`,position:"sticky",left:0,background:rowBg,zIndex:1}}>{act}</td>
                              {DAYS.map((day,di)=>{
                                const isWE=di>=5;
                                const hVal=getAllocVal(act,day);
                                return(
                                  <td key={day} style={{padding:"3px",textAlign:"center",borderBottom:`1px solid #e5e7eb`,background:isWE?"#fffbf0":undefined}}>
                                    <input type="number" min="0" step="0.5" value={hVal}
                                      onChange={e=>setAllocVal(act,day,e.target.value)}
                                      placeholder="–"
                                      style={{width:"60px",padding:"4px 3px",border:`1px solid ${C.border}`,borderRadius:"4px",textAlign:"center",fontSize:"12px",background:hVal!==""&&parseFloat(hVal)>0?"white":"#f5f5f5",color:C.textDark}}/>
                                  </td>
                                );
                              })}
                              <td style={{padding:"6px 8px",textAlign:"center",fontWeight:"700",color:target>0?C.navy:C.textLight,borderBottom:`1px solid #e5e7eb`,background:"#e8f4fd"}}>
                                {target>0?target.toFixed(1):"–"}
                              </td>
                              <td style={{padding:"6px 8px",textAlign:"center",fontWeight:"700",borderBottom:`1px solid #e5e7eb`,background:"#f0fdf4",color:target>0?(Math.abs(diff)<0.2?C.green:diff>0?"#dc2626":"#d97706"):rTotal>0?C.navy:C.textLight}}>
                                {rTotal>0?rTotal.toFixed(1):"–"}
                              </td>
                            </tr>
                          );
                        })}

                        {/* Daily total footer */}
                        <tr style={{background:C.navy,position:"sticky",bottom:0}}>
                          <td style={{padding:"8px 12px",fontWeight:"800",color:"white",position:"sticky",left:0,background:C.navy,zIndex:1}}>Daily Total</td>
                          {DAYS.map(day=>{
                            const dt=dayTotal(day);
                            return<td key={day} style={{padding:"8px 4px",textAlign:"center",fontWeight:"800",color:dt>0?"#52B788":"rgba(255,255,255,0.3)",fontSize:"13px"}}>{dt>0?dt.toFixed(1):"–"}</td>;
                          })}
                          <td style={{padding:"8px",textAlign:"center",fontWeight:"800",color:"#52B788",fontSize:"13px"}}>{weekTargetTotal.toFixed(1)}</td>
                          <td style={{padding:"8px",textAlign:"center",fontWeight:"800",fontSize:"13px",color:Math.abs(grandTotal-weekTargetTotal)<0.2?"#52B788":grandTotal>weekTargetTotal?"#fca5a5":"#fcd34d"}}>{grandTotal.toFixed(1)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ HOLIDAYS ══ */}
      {demandSubTab==="holidays"&&(
        <div>
          <div style={{...card,marginBottom:"16px"}}>
            <h4 style={{color:C.navy,marginBottom:"14px",fontSize:"14px"}}>Add Holiday / Non-Working Day</h4>
            <div style={{display:"flex",gap:"12px",flexWrap:"wrap",alignItems:"flex-end"}}>
              <div><label style={{display:"block",fontSize:"12px",color:C.textMid,marginBottom:"4px"}}>Date</label><input type="date" value={holidayForm.date} onChange={e=>setHolidayForm(f=>({...f,date:e.target.value}))} style={inp}/></div>
              <div><label style={{display:"block",fontSize:"12px",color:C.textMid,marginBottom:"4px"}}>Label</label><input value={holidayForm.label} onChange={e=>setHolidayForm(f=>({...f,label:e.target.value}))} placeholder="e.g. Christmas Day" style={{...inp,width:"180px"}}/></div>
              <div><label style={{display:"block",fontSize:"12px",color:C.textMid,marginBottom:"4px"}}>Scope</label>
                <select value={holidayForm.scope} onChange={e=>setHolidayForm(f=>({...f,scope:e.target.value,ghName:""}))} style={inp}>
                  <option value="all">All greenhouses</option>
                  <option value="specific">Specific greenhouse</option>
                </select>
              </div>
              {holidayForm.scope==="specific"&&<div><label style={{display:"block",fontSize:"12px",color:C.textMid,marginBottom:"4px"}}>Greenhouse</label>
                <select value={holidayForm.ghName} onChange={e=>setHolidayForm(f=>({...f,ghName:e.target.value}))} style={inp}>
                  <option value="">Select…</option>
                  {ghGroups.map(g=><option key={g.ghId} value={g.ghId}>{g.name}</option>)}
                </select>
              </div>}
              <button onClick={addHoliday} style={{...btn(true,C.teal),padding:"9px 20px"}}>+ Add</button>
            </div>
          </div>
          <div style={card}>
            <h4 style={{color:C.navy,marginBottom:"12px",fontSize:"14px"}}>Holidays & Non-Working Days ({wsHolidays.length})</h4>
            {wsHolidays.length===0?<p style={{color:C.textLight,fontStyle:"italic",fontSize:"13px"}}>No holidays entered yet.</p>:(
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px"}}>
                <thead><tr style={{background:C.navy,color:"white"}}><th style={{padding:"8px 12px",textAlign:"left"}}>Date</th><th style={{padding:"8px 12px",textAlign:"left"}}>Label</th><th style={{padding:"8px 12px",textAlign:"left"}}>Scope</th><th style={{padding:"8px 12px",textAlign:"center"}}>Remove</th></tr></thead>
                <tbody>{wsHolidays.sort((a,b)=>a.date.localeCompare(b.date)).map((h,i)=>(
                  <tr key={h.id} style={{background:i%2===0?"white":"#f8f9fa"}}>
                    <td style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}`}}>{fmtD(h.date)}</td>
                    <td style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}`,fontWeight:"600"}}>{h.label}</td>
                    <td style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}`,color:C.textMid}}>{h.scope==="all"?"All greenhouses":h.ghName||"—"}</td>
                    <td style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}`,textAlign:"center"}}><button onClick={()=>removeHoliday(h.id)} style={{...btn(false,"#c0392b"),padding:"4px 10px",fontSize:"11px"}}>✕</button></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// OVERTIME PAGE — with OT eligibility warning + overlap check + 30hr cap
// ═══════════════════════════════════════════════════════════════════════════════
function OvertimePage({staff,ghList,activities,schedule,absences,overtimeEntries,setOvertimeEntries,role,activeWeek,activeWeekIndex,generating,setGenerating,rebuildScheduleFromOT,btn,inp,card,C,API,fmtDate}){
  const [defaultRate,setDefaultRate]=useState("");
  const [manualEntry,setManualEntry]=useState({staffId:"",greenhouse:"",activity:"",day:"Monday",hours:"",ratePerHour:""});
  const [showAddManual,setShowAddManual]=useState(false);
  const [eligibilityWarning,setEligibilityWarning]=useState(null);
  const [showOTBalance,setShowOTBalance]=useState(false);

  const ghNames=ghList.map(g=>g.name);
  const ALL_DAYS_LOCAL=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

  // Check OT hours used this week per staff (regular + OT combined tracking)
  const getStaffOTHoursUsed=(staffId)=>overtimeEntries.filter(e=>e.staffId===staffId).reduce((s,e)=>s+(parseFloat(e.hours)||0),0);

  // Check for time overlap — OT on a workday must not overlap existing schedule
  const checkOverlap=(staffId,day)=>{
    if(!schedule||!schedule[day])return false;
    return schedule[day].some(a=>a.staffId===staffId&&!a.unassigned);
  };

  // Check 3-way eligibility for manual OT entry
  const checkManualEligibility=async(staffId,greenhouse,activity)=>{
    if(!staffId||!greenhouse||!activity){setEligibilityWarning(null);return;}
    const s=staff.find(x=>x.id===staffId);
    if(!s){setEligibilityWarning(null);return;}
    const gh=ghList.find(g=>g.name===greenhouse);
    const ghCrops=gh?.cropTypes||[];
    try{
      const res=await axios.post(`${API}/overtime/check-eligibility`,{staff,staffId,activity,greenhouse,ghCrops});
      if(!res.data.eligible){
        setEligibilityWarning({staffId,reason:res.data.reason});
      }else{
        setEligibilityWarning(null);
      }
    }catch(e){setEligibilityWarning(null);}
  };

  const calcOT=async()=>{
    setGenerating(true);
    try{
      const res=await axios.post(`${API}/overtime/calculate`,{staff,greenhouses:ghList,activities,schedule,absences});
      if(res.data.entries){
        // Filter out non-OT-willing staff, then sort by least OT hours (fairness)
        const nonWilling=new Set(staff.filter(s=>s.otWilling===false).map(s=>s.id));
        const rawEntries=res.data.entries.filter(e=>!nonWilling.has(e.staffId));
        const otUsedMap={};rawEntries.forEach(e=>{otUsedMap[e.staffId]=(otUsedMap[e.staffId]||0)+(parseFloat(e.hours)||0);});
        const sorted=[...rawEntries].sort((a,b)=>(otUsedMap[a.staffId]||0)-(otUsedMap[b.staffId]||0));
        const entries=sorted.map(e=>({...e,ratePerHour:defaultRate?parseFloat(defaultRate):null,estimatedCost:defaultRate&&e.hours?parseFloat(defaultRate)*e.hours:null,source:"system",id:`ot_${Date.now()}_${Math.random()}`}));
        setOvertimeEntries(entries);
        if(entries.length===0)alert("No unassigned hours found — no overtime needed.");
        if(nonWilling.size>0&&rawEntries.length<res.data.entries.length)alert(`ℹ️ ${res.data.entries.length-rawEntries.length} OT assignment(s) excluded — staff marked as not OT willing.`);
      }
    }catch(e){alert("Error: "+e.message);}
    setGenerating(false);
  };

  const toggleLock=(id)=>{
    setOvertimeEntries(prev=>prev.map(e=>e.id===id?{...e,locked:!e.locked}:e));
  };

  const deleteEntry=(id)=>{
    if(overtimeEntries.find(e=>e.id===id)?.locked)return alert("Unlock this entry before deleting.");
    const updated=overtimeEntries.filter(e=>e.id!==id);
    setOvertimeEntries(updated);
    rebuildScheduleFromOT(updated);
  };

  const updateEntry=(id,changes)=>{
    if(overtimeEntries.find(e=>e.id===id)?.locked)return;
    const newEntries=overtimeEntries.map(e=>{
      if(e.id!==id)return e;
      const updated={...e,...changes};
      if(updated.ratePerHour&&updated.hours)updated.estimatedCost=parseFloat(updated.ratePerHour)*parseFloat(updated.hours);
      else updated.estimatedCost=null;
      return updated;
    });
    setOvertimeEntries(newEntries);
    // Rebuild schedule immediately when GM changes staff/hours
    if(changes.staffId||changes.hours!==undefined||changes.greenhouse||changes.activity||changes.day){
      rebuildScheduleFromOT(newEntries);
    }
  };

  const addManual=async()=>{
    if(!manualEntry.staffId||!manualEntry.greenhouse||!manualEntry.activity)return alert("Please fill in staff, greenhouse and activity.");
    const s=staff.find(x=>x.id===manualEntry.staffId);

    // Check OT willing flag
    if(s?.otWilling===false){
      if(!window.confirm(`⚠️ ${s?.name} has indicated they are NOT willing to do overtime. Add anyway (GM override)?`))return;
    }

    // Check 30hr OT cap
    const otUsed=getStaffOTHoursUsed(manualEntry.staffId);
    const otLimit=s?.overtimeLimit??30;
    const hoursToAdd=parseFloat(manualEntry.hours)||0;
    if(otUsed+hoursToAdd>otLimit){
      alert(`⚠️ OT Cap Warning: ${s?.name} has already used ${otUsed}h of OT this week (cap: ${otLimit}h). This entry would exceed the cap by ${(otUsed+hoursToAdd-otLimit).toFixed(1)}h.`);
      if(!window.confirm("Add anyway?"))return;
    }

    // Check overlap on workday
    const isWeekend=["Saturday","Sunday"].includes(manualEntry.day);
    if(!isWeekend&&checkOverlap(manualEntry.staffId,manualEntry.day)){
      if(!window.confirm(`⚠️ ${s?.name} already has regular schedule assignments on ${manualEntry.day}. Confirm this OT does not overlap their regular hours?`))return;
    }

    // Check eligibility — warn but allow override
    if(eligibilityWarning&&eligibilityWarning.staffId===manualEntry.staffId){
      if(!window.confirm(`⚠️ Eligibility Warning:\n\n${eligibilityWarning.reason}\n\nClick OK to assign anyway (GM override).`))return;
    }

    const hrs=parseFloat(manualEntry.hours)||0;
    const rate=parseFloat(manualEntry.ratePerHour)||null;
    const newEntry={
      id:`ot_${Date.now()}`,staffId:manualEntry.staffId,staffName:s?.name||manualEntry.staffId,
      greenhouse:manualEntry.greenhouse,activity:manualEntry.activity,day:manualEntry.day,
      hours:hrs,ratePerHour:rate,estimatedCost:rate&&hrs?rate*hrs:null,
      source:"manual",createdAt:new Date().toISOString(),
      gmOverride:!!(eligibilityWarning&&eligibilityWarning.staffId===manualEntry.staffId)
    };
    const newEntries=[...overtimeEntries,newEntry];
    setOvertimeEntries(newEntries);
    rebuildScheduleFromOT(newEntries);
    setManualEntry({staffId:"",greenhouse:"",activity:"",day:"Monday",hours:"",ratePerHour:""});
    setShowAddManual(false);setEligibilityWarning(null);
  };

  const totalCost=overtimeEntries.reduce((s,e)=>s+(e.estimatedCost||0),0);
  const totalOTHours=overtimeEntries.reduce((s,e)=>s+(parseFloat(e.hours)||0),0);

  return(
    <div>
      <h2 style={{color:C.navy,marginBottom:"4px"}}>⏱️ Overtime</h2>
      {activeWeek&&<p style={{color:C.textMid,fontSize:"13px",marginBottom:"16px"}}>Week {activeWeekIndex+1}: {fmtDate(activeWeek.startDate)}</p>}

      {overtimeEntries.length>0&&(
        <div style={{...card,background:"#fff8ee",padding:"14px",marginBottom:"14px",borderLeft:`4px solid ${C.gold}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"12px"}}>
            <div style={{display:"flex",gap:"24px",flexWrap:"wrap",fontSize:"13px"}}>
              <span>⏱️ <strong>Total OT Hours:</strong> {totalOTHours.toFixed(1)}h</span>
              <span>👥 <strong>Staff on OT:</strong> {new Set(overtimeEntries.map(e=>e.staffId)).size}</span>
              {totalCost>0&&<span>💰 <strong>Estimated Cost:</strong> ${totalCost.toFixed(2)}</span>}
              <span>🔒 <strong>Locked:</strong> {overtimeEntries.filter(e=>e.locked).length}</span>
            </div>
            <button onClick={()=>setShowOTBalance(v=>!v)} style={{...btn(showOTBalance,C.navy),padding:"4px 12px",fontSize:"12px"}}>{showOTBalance?"▲ Hide":"📊 OT Balance"}</button>
          </div>
          {showOTBalance&&(
            <div style={{marginTop:"12px",borderTop:"1px solid #fde68a",paddingTop:"10px"}}>
              <div style={{fontSize:"11px",fontWeight:"700",color:C.textMid,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"8px"}}>OT Balance — This Week (sorted: most OT first)</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:"6px"}}>
                {[...staff].sort((a,b)=>getStaffOTHoursUsed(b.id)-getStaffOTHoursUsed(a.id)).map(s=>{
                  const used=getStaffOTHoursUsed(s.id);
                  const cap=s.overtimeLimit??30;
                  const pct=cap>0?Math.min(used/cap,1):0;
                  const notWilling=s.otWilling===false;
                  return(
                    <div key={s.id} style={{background:"white",borderRadius:"6px",padding:"8px 10px",border:`1px solid ${used>cap*0.8?"#fca5a5":used>0?"#fde68a":"#e5e7eb"}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"4px"}}>
                        <span style={{fontSize:"12px",fontWeight:"600",color:C.navy}}>{s.name}</span>
                        {notWilling&&<span style={{fontSize:"10px",color:C.orange}}>🚫 No OT</span>}
                      </div>
                      <div style={{height:"5px",background:"#e5e7eb",borderRadius:"3px",overflow:"hidden",marginBottom:"4px"}}>
                        <div style={{height:"100%",width:`${pct*100}%`,background:pct>0.8?C.red:pct>0.5?C.orange:C.green,borderRadius:"3px",transition:"width 0.3s"}}/>
                      </div>
                      <div style={{fontSize:"11px",color:used>0?C.textDark:C.textLight}}>{used.toFixed(1)} / {cap}h{used===0?" — No OT this week":""}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={card}>
        <div style={{display:"flex",gap:"12px",flexWrap:"wrap",alignItems:"flex-end",marginBottom:"16px"}}>
          <div>
            <label style={{display:"block",fontSize:"12px",color:C.textMid,marginBottom:"4px"}}>Default $/hr rate (optional):</label>
            <input type="number" min="0" value={defaultRate} onChange={e=>setDefaultRate(e.target.value)} style={{...inp,width:"120px"}} placeholder="e.g. 45.00"/>
          </div>
          {schedule?<button onClick={calcOT} disabled={generating} style={{...btn(false,C.orange),opacity:generating?0.7:1}}>{generating?"⏳ Calculating...":"⚡ Calculate System OT"}</button>:<span style={{color:C.textLight,fontSize:"13px",padding:"8px"}}>Generate a schedule first.</span>}
          {role==="gm"&&<button onClick={()=>setShowAddManual(!showAddManual)} style={btn(false,C.purple)}>+ Add Manual OT Entry</button>}
          {overtimeEntries.length>0&&role==="gm"&&<button onClick={()=>{if(window.confirm("Clear all OT entries?"))setOvertimeEntries([]);}} style={btn(false,C.red)}>🗑️ Clear All</button>}
        </div>

        <div style={{padding:"12px",background:C.light,borderRadius:"8px",fontSize:"12px",color:C.textMid,marginBottom:"16px"}}>
          <strong>OT rules:</strong> 30-hour OT cap per staff (separate from regular hours). OT on workdays must not overlap regular schedule. Under-utilised staff offered OT first → then highest versatility. 3-way eligibility (activity + GH + crop type) always checked — warnings shown for GM overrides.
        </div>

        {showAddManual&&role==="gm"&&(
          <div style={{background:"#f8f4ff",border:`1px solid ${C.purple}`,borderRadius:"8px",padding:"14px",marginBottom:"16px"}}>
            <h4 style={{color:C.purple,margin:"0 0 12px 0",fontSize:"14px"}}>Add Manual OT Entry (GM Override)</h4>
            {eligibilityWarning&&(
              <div style={{background:"#fff5f5",border:`1px solid ${C.red}`,borderRadius:"6px",padding:"10px",marginBottom:"12px",fontSize:"12px",color:C.red}}>
                ⚠️ <strong>Eligibility Warning:</strong> {eligibilityWarning.reason}<br/>
                <span style={{color:C.textMid}}>You can still save — GM override will be recorded.</span>
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"10px",marginBottom:"10px"}}>
              <div><label style={{fontSize:"12px",color:C.textMid,display:"block",marginBottom:"3px"}}>Staff (sorted: least OT first):</label>
                <select value={manualEntry.staffId} onChange={e=>{setManualEntry(p=>({...p,staffId:e.target.value}));checkManualEligibility(e.target.value,manualEntry.greenhouse,manualEntry.activity);}} style={{...inp,width:"100%"}}>
                  <option value="">— Select —</option>
                  {[...staff].sort((a,b)=>getStaffOTHoursUsed(a.id)-getStaffOTHoursUsed(b.id)).map(s=>{const otUsed=getStaffOTHoursUsed(s.id);const cap=s.overtimeLimit??30;const notWilling=s.otWilling===false;return <option key={s.id} value={s.id}>{notWilling?"🚫 ":""}{s.name} ({s.id}) — OT: {otUsed.toFixed(1)}/{cap}h{notWilling?" [Not willing]":""}</option>;})}
                </select>
              </div>
              <div><label style={{fontSize:"12px",color:C.textMid,display:"block",marginBottom:"3px"}}>Greenhouse:</label>
                <select value={manualEntry.greenhouse} onChange={e=>{setManualEntry(p=>({...p,greenhouse:e.target.value}));checkManualEligibility(manualEntry.staffId,e.target.value,manualEntry.activity);}} style={{...inp,width:"100%"}}>
                  <option value="">— Select —</option>{ghNames.map(g=><option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div><label style={{fontSize:"12px",color:C.textMid,display:"block",marginBottom:"3px"}}>Activity:</label>
                <select value={manualEntry.activity} onChange={e=>{setManualEntry(p=>({...p,activity:e.target.value}));checkManualEligibility(manualEntry.staffId,manualEntry.greenhouse,e.target.value);}} style={{...inp,width:"100%"}}>
                  <option value="">— Select —</option>{activities.map(a=><option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div><label style={{fontSize:"12px",color:C.textMid,display:"block",marginBottom:"3px"}}>Day:</label>
                <select value={manualEntry.day} onChange={e=>setManualEntry(p=>({...p,day:e.target.value}))} style={{...inp,width:"100%"}}>
                  {ALL_DAYS_LOCAL.map(d=>{const hasSchedule=checkOverlap(manualEntry.staffId,d);return <option key={d} value={d}>{d}{hasSchedule?" ⚠️ has schedule":""}</option>;})}
                </select>
              </div>
              <div><label style={{fontSize:"12px",color:C.textMid,display:"block",marginBottom:"3px"}}>Hours:</label>
                <input type="number" min="0" max="24" value={manualEntry.hours} onChange={e=>setManualEntry(p=>({...p,hours:e.target.value}))} style={{...inp,width:"100%"}} placeholder="e.g. 2"/>
              </div>
              <div><label style={{fontSize:"12px",color:C.textMid,display:"block",marginBottom:"3px"}}>$/hr (optional):</label>
                <input type="number" min="0" value={manualEntry.ratePerHour} onChange={e=>setManualEntry(p=>({...p,ratePerHour:e.target.value}))} style={{...inp,width:"100%"}} placeholder="e.g. 45"/>
              </div>
            </div>
            <div style={{display:"flex",gap:"8px"}}>
              <button onClick={addManual} style={btn(false,C.purple)}>✓ Add Entry</button>
              <button onClick={()=>{setShowAddManual(false);setEligibilityWarning(null);}} style={btn(false,C.textLight)}>Cancel</button>
            </div>
          </div>
        )}

        {overtimeEntries.length>0?(
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px"}}>
            <thead><tr>
              <th style={{padding:"8px",textAlign:"left",background:C.navy,color:"white",fontSize:"12px"}}>Staff</th>
              <th style={{padding:"8px",textAlign:"left",background:C.navy,color:"white",fontSize:"12px"}}>Day</th>
              <th style={{padding:"8px",textAlign:"left",background:C.navy,color:"white",fontSize:"12px"}}>Greenhouse</th>
              <th style={{padding:"8px",textAlign:"left",background:C.navy,color:"white",fontSize:"12px"}}>Activity</th>
              <th style={{padding:"8px",textAlign:"center",background:C.navy,color:"white",fontSize:"12px"}}>Hours</th>
              <th style={{padding:"8px",textAlign:"center",background:C.navy,color:"white",fontSize:"12px"}}>$/hr</th>
              <th style={{padding:"8px",textAlign:"center",background:C.navy,color:"white",fontSize:"12px"}}>Est. Cost</th>
              <th style={{padding:"8px",textAlign:"center",background:C.navy,color:"white",fontSize:"12px"}}>Source</th>
              {role==="gm"&&<th style={{padding:"8px",textAlign:"center",background:C.navy,color:"white",fontSize:"12px"}}>Actions</th>}
            </tr></thead>
            <tbody>
              {overtimeEntries.map((e,i)=>(
                <tr key={e.id} style={{background:e.locked?"#f0fdf4":e.source==="manual"?"#fdf4ff":i%2===0?C.light:C.white}}>
                  <td style={{padding:"8px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                      {e.locked&&<span title="Locked" style={{fontSize:"13px"}}>🔒</span>}
                      <div><strong>{e.staffName}</strong><br/><span style={{fontFamily:"monospace",fontSize:"11px",color:C.textLight}}>{e.staffId}</span></div>
                    </div>
                    {e.gmOverride&&<span style={{display:"block",fontSize:"10px",color:C.orange}}>⚠️ GM Override</span>}
                  </td>
                  <td style={{padding:"8px"}}>{e.day}</td>
                  <td style={{padding:"8px"}}>{e.greenhouse}</td>
                  <td style={{padding:"8px"}}>{e.activity}</td>
                  <td style={{padding:"8px",textAlign:"center"}}>{role==="gm"&&!e.locked?<input type="number" min="0" max="24" value={e.hours} onChange={ev=>updateEntry(e.id,{hours:parseFloat(ev.target.value)||0})} style={{width:"55px",padding:"3px",border:`1px solid ${C.border}`,borderRadius:"4px",textAlign:"center",fontSize:"12px"}}/>:<span>{e.hours}h</span>}</td>
                  <td style={{padding:"8px",textAlign:"center"}}>{role==="gm"&&!e.locked?<input type="number" min="0" value={e.ratePerHour||""} onChange={ev=>updateEntry(e.id,{ratePerHour:parseFloat(ev.target.value)||null})} style={{width:"65px",padding:"3px",border:`1px solid ${C.border}`,borderRadius:"4px",textAlign:"center",fontSize:"12px"}} placeholder="—"/>:<span>{e.ratePerHour?`$${e.ratePerHour}`:"—"}</span>}</td>
                  <td style={{padding:"8px",textAlign:"center",fontWeight:"600",color:e.estimatedCost?C.navy:C.textLight}}>{e.estimatedCost?`$${e.estimatedCost.toFixed(2)}`:"—"}</td>
                  <td style={{padding:"8px",textAlign:"center"}}><span style={{background:e.source==="manual"?"#f0e6ff":"#e8f4fd",color:e.source==="manual"?C.purple:C.blue,padding:"2px 8px",borderRadius:"10px",fontSize:"11px",fontWeight:"600"}}>{e.source==="manual"?"Manual ★":"System"}</span></td>
                  {role==="gm"&&<td style={{padding:"8px",textAlign:"center"}}>
                    <div style={{display:"flex",gap:"4px",justifyContent:"center"}}>
                      <button onClick={()=>toggleLock(e.id)} title={e.locked?"Unlock to edit":"Lock to protect"} style={{...btn(e.locked,e.locked?C.green:C.textLight),padding:"4px 7px",fontSize:"11px"}}>{e.locked?"🔒":"🔓"}</button>
                      <button onClick={()=>deleteEntry(e.id)} style={{...btn(false,C.red),padding:"4px 8px",fontSize:"11px"}}>🗑️</button>
                    </div>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        ):(
          <p style={{color:C.textLight,fontSize:"13px",textAlign:"center",padding:"20px"}}>No overtime entries yet.</p>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUARANTINE PANEL — with extend + expired history
// ═══════════════════════════════════════════════════════════════════════════════
const NON_DEFERRABLE_ACTS=["Picking","Harvesting"];

function QuarantinePanel({staff,ghList,quarantine,setQuarantine,quarantineHistory,setQuarantineHistory,schedule,dailyAllocation,setDailyAllocation,confirmedWeeks,setConfirmedWeeks,wsHolidays,activities,addAuditEntry,btn,inp,C,API,adelaideTime,fmtISOReadable,role}){
  const [typeA_gh,setTypeA_gh]=useState("");
  const [typeA_days,setTypeA_days]=useState(7);
  const [typeA_reason,setTypeA_reason]=useState("");
  const [typeB_staff,setTypeB_staff]=useState([]);
  const [typeB_gh,setTypeB_gh]=useState("");
  const [typeB_days,setTypeB_days]=useState(7);
  const [typeB_reason,setTypeB_reason]=useState("");
  const [showHistory,setShowHistory]=useState(false);
  const [extendId,setExtendId]=useState(null);
  const [extendDays,setExtendDays]=useState(7);
  // Type C — Limited Activity GH Quarantine
  const [typeC_gh,setTypeC_gh]=useState("");
  const [typeC_days,setTypeC_days]=useState(7);
  const [typeC_reason,setTypeC_reason]=useState("");
  const [typeC_allowedActs,setTypeC_allowedActs]=useState([]);
  const [typeC_staff,setTypeC_staff]=useState([]);
  const [typeC_carry,setTypeC_carry]=useState(true);

  const ghNames=ghList.map(g=>g.name);

  const getStaffInGH=(ghName)=>{
    if(!schedule||!ghName)return[];
    const ids=new Set();
    Object.values(schedule).forEach(assignments=>assignments.forEach(a=>{if(a.greenhouse===ghName&&!a.unassigned)ids.add(a.staffId);}));
    return[...ids];
  };

  // Calculate days remaining for an order
  const getDaysRemaining=(ev)=>{
    try{
      const start=new Date(ev.startDate);
      const totalDays=(ev.daysLocked||7)+(ev.extensionDays||0);
      const end=new Date(start.getTime()+totalDays*24*60*60*1000);
      const now=new Date();
      const diff=Math.ceil((end-now)/(1000*60*60*24));
      return Math.max(0,diff);
    }catch{return 0;}
  };

  const createTypeA=async()=>{
    if(!typeA_gh)return alert("Please select a greenhouse.");
    const autoStaff=getStaffInGH(typeA_gh);
    if(autoStaff.length===0&&!window.confirm(`No staff currently scheduled in ${typeA_gh}. Create quarantine anyway?`))return;
    try{
      const res=await axios.post(`${API}/quarantine`,{
        greenhouseId:typeA_gh,staffIds:autoStaff,
        allowedGreenhouses:[typeA_gh],daysLocked:typeA_days,
        reason:typeA_reason,startDate:new Date().toISOString(),
        quarantineType:"A",createdBy:"GM"
      });
      if(res.data.event){
        setQuarantine([...quarantine,res.data.event]);
        setTypeA_gh("");setTypeA_reason("");setTypeA_days(7);
        alert(`Type A Quarantine created for ${typeA_gh}.\n${autoStaff.length} staff auto-locked for ${typeA_days} days.`);
      }
    }catch(e){alert("Error: "+e.message);}
  };

  const createTypeB=async()=>{
    if(typeB_staff.length===0)return alert("Please select at least one staff member.");
    if(!typeB_gh)return alert("Please select a greenhouse to restrict them to.");
    try{
      const res=await axios.post(`${API}/quarantine`,{
        greenhouseId:typeB_gh,staffIds:typeB_staff,
        allowedGreenhouses:[typeB_gh],daysLocked:typeB_days,
        reason:typeB_reason,startDate:new Date().toISOString(),
        quarantineType:"B",createdBy:"GM"
      });
      if(res.data.event){
        setQuarantine([...quarantine,res.data.event]);
        setTypeB_staff([]);setTypeB_gh("");setTypeB_reason("");setTypeB_days(7);
        alert(`Type B Quarantine created. ${typeB_staff.length} staff restricted to ${typeB_gh} for ${typeB_days} days.`);
      }
    }catch(e){alert("Error: "+e.message);}
  };

  const createTypeC=async()=>{
    if(!typeC_gh)return alert("Please select a greenhouse.");
    if(typeC_allowedActs.length===0)return alert("Select at least one allowed activity (others will be restricted).");
    const autoStaff=typeC_staff.length>0?typeC_staff:getStaffInGH(typeC_gh);
    const restrictedActs=activities.filter(a=>!typeC_allowedActs.includes(a));
    try{
      const res=await axios.post(`${API}/quarantine`,{
        greenhouseId:typeC_gh,staffIds:autoStaff,
        allowedGreenhouses:[typeC_gh],daysLocked:typeC_days,
        reason:typeC_reason,startDate:new Date().toISOString(),
        quarantineType:"C",
        allowedActivities:typeC_allowedActs,
        restrictedActivities:restrictedActs,
        assignedStaff:autoStaff,
        createdBy:"GM"
      });
      if(res.data.event){
        const ev={...res.data.event,quarantineType:"C",allowedActivities:typeC_allowedActs,restrictedActivities:restrictedActs,assignedStaff:autoStaff};
        setQuarantine([...quarantine,ev]);
        // Carry-forward: find affected weeks in dailyAllocation and move restricted activity hours to next week
        if(typeC_carry){
          const ydpPlans=JSON.parse(localStorage.getItem("ydp_plans_v1")||"[]");
          const lpData=JSON.parse(localStorage.getItem("labourPlanner_v1")||"{}");
          const ghMap={};(lpData.greenhouses||[]).forEach(g=>{ghMap[g.id]=g.name;});
          const ghIdForName=ghList.find(g=>g.name===typeC_gh)?.id||typeC_gh;
          const affectedPlans=ydpPlans.filter(p=>p.ghId===ghIdForName);
          const today=new Date();
          let carryCount=0;
          setDailyAllocation(prev=>{
            const next={...prev};
            affectedPlans.forEach(plan=>{
              for(let wi=0;wi<plan.cycleWeeks;wi++){
                const wStart=new Date(plan.startDate);wStart.setDate(wStart.getDate()+wi*7);
                const wEnd=new Date(wStart);wEnd.setDate(wEnd.getDate()+6);
                if(wEnd<today||wStart>new Date(today.getTime()+typeC_days*86400000))continue;
                const key=`${plan.id}__w${wi}`;
                const nextKey=`${plan.id}__w${wi+1}`;
                const alloc=prev[key]||{};
                const nextAlloc={...prev[nextKey]||{}};
                restrictedActs.forEach(act=>{
                  const isND=NON_DEFERRABLE_ACTS.some(nd=>act.toLowerCase().includes(nd.toLowerCase()));
                  if(isND)return; // lost production — don't carry forward
                  const actH=Object.values(alloc[act]||{}).reduce((s,v)=>s+(parseFloat(v)||0),0);
                  if(!actH)return;
                  // Zero out current week restricted activity
                  const curAct={...alloc[act]||{}};
                  Object.keys(curAct).forEach(d=>{curAct[d]=0;});
                  if(!next[key])next[key]={...alloc};
                  next[key]={...next[key],[act]:curAct};
                  // Add to next week (divide across Mon-Fri)
                  if(wi+1<plan.cycleWeeks){
                    const days=["Mon","Tue","Wed","Thu","Fri"];
                    const perDay=Math.round(actH/days.length*10)/10;
                    const existing=nextAlloc[act]||{};
                    days.forEach((d,i)=>{existing[d]=(parseFloat(existing[d])||0)+(i===days.length-1?actH-perDay*(days.length-1):perDay);});
                    nextAlloc[act]=existing;
                    next[nextKey]=nextAlloc;
                    // Unconfirm next week so it can be reviewed
                    setConfirmedWeeks(prev2=>{const n={...prev2};delete n[nextKey];return n;});
                    carryCount++;
                  }
                });
                // Unconfirm current week
                setConfirmedWeeks(prev2=>{const n={...prev2};delete n[key];return n;});
              }
            });
            return next;
          });
          if(carryCount>0&&addAuditEntry)addAuditEntry("quarantine",`Type C: ${typeC_gh} limited — ${restrictedActs.filter(a=>!NON_DEFERRABLE_ACTS.some(nd=>a.toLowerCase().includes(nd.toLowerCase()))).length} deferrable activities carried forward`,{gh:typeC_gh});
        }
        if(addAuditEntry)addAuditEntry("quarantine",`Type C quarantine: ${typeC_gh} — limited activity (${typeC_allowedActs.join(", ")} allowed)`,{gh:typeC_gh});
        setTypeC_gh("");setTypeC_reason("");setTypeC_days(7);setTypeC_allowedActs([]);setTypeC_staff([]);
        const lostActs=restrictedActs.filter(a=>NON_DEFERRABLE_ACTS.some(nd=>a.toLowerCase().includes(nd.toLowerCase())));
        const deferActs=restrictedActs.filter(a=>!NON_DEFERRABLE_ACTS.some(nd=>a.toLowerCase().includes(nd.toLowerCase())));
        alert(`Type C Quarantine created for ${typeC_gh}.\nAllowed: ${typeC_allowedActs.join(", ")}\n${deferActs.length>0?`Deferred to next week: ${deferActs.join(", ")}\n`:""}${lostActs.length>0?`⚠️ Lost production (cannot defer): ${lostActs.join(", ")}`:""}`);
      }
    }catch(e){alert("Error: "+e.message);}
  };

  const removeEvent=async(id)=>{
    if(!window.confirm("Remove this quarantine event early?"))return;
    const removed=quarantine.find(e=>e.id===id);
    try{
      await axios.delete(`${API}/quarantine/${id}`);
      if(removed){
        setQuarantineHistory([{...removed,closedEarly:true,closedAt:new Date().toISOString()},...quarantineHistory]);
        if(addAuditEntry)addAuditEntry("quarantine",`Quarantine closed early: ${removed.greenhouseId} (Type ${removed.quarantineType})`,{gh:removed.greenhouseId});
      }
      setQuarantine(quarantine.filter(e=>e.id!==id));
    }catch(e){alert("Error: "+e.message);}
  };

  const extendEvent=async(id)=>{
    try{
      await axios.post(`${API}/quarantine/${id}/extend`,{additionalDays:extendDays});
      setQuarantine(quarantine.map(e=>e.id===id?{...e,extensionDays:(e.extensionDays||0)+extendDays,lastExtendedAt:new Date().toISOString()}:e));
      setExtendId(null);setExtendDays(7);
      alert(`Quarantine extended by ${extendDays} days.`);
    }catch(e){alert("Error: "+e.message);}
  };

  const autoPreview=getStaffInGH(typeA_gh);

  // Check for redundant (A+B same GH same staff)
  const checkRedundant=(ev)=>{
    if(ev.quarantineType!=="B")return false;
    return quarantine.some(other=>other.quarantineType==="A"&&other.greenhouseId===ev.greenhouseId&&ev.staffIds.some(sid=>other.staffIds.includes(sid)));
  };

  return(
    <div>
      <p style={{color:C.textMid,fontSize:"13px",marginBottom:"20px"}}>
        Multiple quarantine orders can run concurrently. Each has its own countdown. Use Extend before expiry to continue — otherwise it expires automatically and moves to history.
      </p>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"20px",marginBottom:"24px"}}>
        {/* TYPE A */}
        <div style={{border:`2px solid ${C.red}`,borderRadius:"10px",padding:"16px",background:"#fff8f8"}}>
          <h4 style={{color:C.red,margin:"0 0 4px 0",fontSize:"14px"}}>🔴 Type A — Greenhouse Quarantine</h4>
          <p style={{color:C.textMid,fontSize:"12px",marginBottom:"14px"}}>Locks a greenhouse. All currently scheduled staff are auto-locked to that GH. No other staff may enter.</p>
          <div style={{marginBottom:"10px"}}>
            <label style={{display:"block",fontSize:"12px",fontWeight:"600",color:C.navy,marginBottom:"4px"}}>Select Greenhouse:</label>
            <select value={typeA_gh} onChange={e=>setTypeA_gh(e.target.value)} style={{...inp,width:"100%"}}>
              <option value="">— Select greenhouse —</option>{ghNames.map(g=><option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          {typeA_gh&&(
            <div style={{background:autoPreview.length>0?"#fff3cd":"#f8f9fa",border:`1px solid ${autoPreview.length>0?"#ffc107":C.border}`,borderRadius:"6px",padding:"8px",marginBottom:"10px",fontSize:"12px"}}>
              {autoPreview.length>0?<span>⚠️ <strong>{autoPreview.length} staff</strong> will be auto-locked: {autoPreview.map(id=>staff.find(s=>s.id===id)?.name||id).join(", ")}</span>:<span style={{color:C.textLight}}>No staff currently scheduled in {typeA_gh}.</span>}
            </div>
          )}
          <div style={{display:"flex",gap:"10px",marginBottom:"10px"}}>
            <div><label style={{display:"block",fontSize:"12px",fontWeight:"600",color:C.navy,marginBottom:"4px"}}>Duration (days):</label><input type="number" min="1" max="90" value={typeA_days} onChange={e=>setTypeA_days(parseInt(e.target.value)||7)} style={{...inp,width:"80px"}}/></div>
          </div>
          <div style={{marginBottom:"12px"}}>
            <label style={{display:"block",fontSize:"12px",fontWeight:"600",color:C.navy,marginBottom:"4px"}}>Reason (optional):</label>
            <input value={typeA_reason} onChange={e=>setTypeA_reason(e.target.value)} style={{...inp,width:"100%"}} placeholder="e.g. Pest outbreak"/>
          </div>
          <button onClick={createTypeA} style={{...btn(false,C.red),width:"100%",padding:"10px"}}>🔴 Create Type A Quarantine</button>
          <p style={{color:C.textLight,fontSize:"11px",marginTop:"8px"}}>Adelaide time: {adelaideTime}</p>
        </div>

        {/* TYPE B */}
        <div style={{border:`2px solid ${C.purple}`,borderRadius:"10px",padding:"16px",background:"#fdf8ff"}}>
          <h4 style={{color:C.purple,margin:"0 0 4px 0",fontSize:"14px"}}>🟣 Type B — Individual Quarantine</h4>
          <p style={{color:C.textMid,fontSize:"12px",marginBottom:"14px"}}>Manually select specific staff and restrict to a designated GH. Runs independently from Type A.</p>
          <div style={{marginBottom:"10px"}}>
            <label style={{display:"block",fontSize:"12px",fontWeight:"600",color:C.navy,marginBottom:"4px"}}>Select Staff:</label>
            <div style={{maxHeight:"160px",overflowY:"auto",border:`1px solid ${C.border}`,borderRadius:"6px",padding:"6px",background:"white"}}>
              {staff.map(s=>(
                <label key={s.id} style={{display:"flex",alignItems:"center",gap:"8px",padding:"4px 6px",cursor:"pointer",borderRadius:"4px",background:typeB_staff.includes(s.id)?"#f0e6ff":"transparent"}}>
                  <input type="checkbox" checked={typeB_staff.includes(s.id)} onChange={e=>setTypeB_staff(e.target.checked?[...typeB_staff,s.id]:typeB_staff.filter(x=>x!==s.id))} style={{accentColor:C.purple}}/>
                  <span style={{fontFamily:"monospace",fontSize:"11px",color:C.textLight,minWidth:"40px"}}>{s.id}</span>
                  <span style={{fontSize:"13px"}}>{s.name}</span>
                </label>
              ))}
            </div>
            {typeB_staff.length>0&&<p style={{color:C.purple,fontSize:"12px",marginTop:"4px",fontWeight:"600"}}>{typeB_staff.length} selected</p>}
          </div>
          <div style={{marginBottom:"10px"}}>
            <label style={{display:"block",fontSize:"12px",fontWeight:"600",color:C.navy,marginBottom:"4px"}}>Restrict to Greenhouse:</label>
            <select value={typeB_gh} onChange={e=>setTypeB_gh(e.target.value)} style={{...inp,width:"100%"}}>
              <option value="">— Select greenhouse —</option>{ghNames.map(g=><option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div style={{display:"flex",gap:"10px",marginBottom:"10px"}}>
            <div><label style={{display:"block",fontSize:"12px",fontWeight:"600",color:C.navy,marginBottom:"4px"}}>Duration (days):</label><input type="number" min="1" max="90" value={typeB_days} onChange={e=>setTypeB_days(parseInt(e.target.value)||7)} style={{...inp,width:"80px"}}/></div>
          </div>
          <div style={{marginBottom:"12px"}}>
            <label style={{display:"block",fontSize:"12px",fontWeight:"600",color:C.navy,marginBottom:"4px"}}>Reason (optional):</label>
            <input value={typeB_reason} onChange={e=>setTypeB_reason(e.target.value)} style={{...inp,width:"100%"}} placeholder="e.g. Contact tracing"/>
          </div>
          <button onClick={createTypeB} style={{...btn(false,C.purple),width:"100%",padding:"10px"}}>🟣 Create Type B Quarantine</button>
        </div>

        {/* TYPE C */}
        <div style={{border:`2px solid ${C.orange}`,borderRadius:"10px",padding:"16px",background:"#fffbf5"}}>
          <h4 style={{color:C.orange,margin:"0 0 4px 0",fontSize:"14px"}}>🟠 Type C — Limited Activity</h4>
          <p style={{color:C.textMid,fontSize:"12px",marginBottom:"14px"}}>Greenhouse remains open but only certain activities are permitted. Restricted activities are automatically carried forward to next week (except non-deferrable ones like Picking/Harvesting which are flagged as lost).</p>
          <div style={{marginBottom:"10px"}}>
            <label style={{display:"block",fontSize:"12px",fontWeight:"600",color:C.navy,marginBottom:"4px"}}>Select Greenhouse:</label>
            <select value={typeC_gh} onChange={e=>setTypeC_gh(e.target.value)} style={{...inp,width:"100%"}}>
              <option value="">— Select greenhouse —</option>{ghNames.map(g=><option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div style={{marginBottom:"10px"}}>
            <label style={{display:"block",fontSize:"12px",fontWeight:"600",color:C.navy,marginBottom:"4px"}}>Allowed Activities (others will be restricted):</label>
            <div style={{maxHeight:"140px",overflowY:"auto",border:`1px solid ${C.border}`,borderRadius:"6px",padding:"6px",background:"white"}}>
              {activities.map(a=>(
                <label key={a} style={{display:"flex",alignItems:"center",gap:"8px",padding:"3px 6px",cursor:"pointer",borderRadius:"4px",background:typeC_allowedActs.includes(a)?"#fff3e0":"transparent"}}>
                  <input type="checkbox" checked={typeC_allowedActs.includes(a)} onChange={e=>setTypeC_allowedActs(e.target.checked?[...typeC_allowedActs,a]:typeC_allowedActs.filter(x=>x!==a))} style={{accentColor:C.orange}}/>
                  <span style={{fontSize:"12px"}}>{a}</span>
                </label>
              ))}
            </div>
            {typeC_allowedActs.length>0&&<p style={{color:C.orange,fontSize:"11px",marginTop:"4px",fontWeight:"600"}}>{typeC_allowedActs.length} allowed / {activities.length-typeC_allowedActs.length} restricted</p>}
          </div>
          <div style={{marginBottom:"10px"}}>
            <label style={{display:"block",fontSize:"12px",fontWeight:"600",color:C.navy,marginBottom:"4px"}}>Assign Staff (optional — defaults to GH staff):</label>
            <div style={{maxHeight:"120px",overflowY:"auto",border:`1px solid ${C.border}`,borderRadius:"6px",padding:"6px",background:"white"}}>
              {staff.map(s=>(
                <label key={s.id} style={{display:"flex",alignItems:"center",gap:"8px",padding:"3px 6px",cursor:"pointer",borderRadius:"4px",background:typeC_staff.includes(s.id)?"#fff3e0":"transparent"}}>
                  <input type="checkbox" checked={typeC_staff.includes(s.id)} onChange={e=>setTypeC_staff(e.target.checked?[...typeC_staff,s.id]:typeC_staff.filter(x=>x!==s.id))} style={{accentColor:C.orange}}/>
                  <span style={{fontFamily:"monospace",fontSize:"11px",color:C.textLight,minWidth:"40px"}}>{s.id}</span>
                  <span style={{fontSize:"12px"}}>{s.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div style={{display:"flex",gap:"10px",marginBottom:"10px"}}>
            <div><label style={{display:"block",fontSize:"12px",fontWeight:"600",color:C.navy,marginBottom:"4px"}}>Duration (days):</label><input type="number" min="1" max="90" value={typeC_days} onChange={e=>setTypeC_days(parseInt(e.target.value)||7)} style={{...inp,width:"80px"}}/></div>
          </div>
          <div style={{marginBottom:"10px"}}>
            <label style={{display:"flex",alignItems:"center",gap:"8px",cursor:"pointer",fontSize:"12px",fontWeight:"600",color:C.navy}}>
              <input type="checkbox" checked={typeC_carry} onChange={e=>setTypeC_carry(e.target.checked)} style={{accentColor:C.orange}}/>
              Auto-carry deferrable activities to next week
            </label>
          </div>
          <div style={{marginBottom:"12px"}}>
            <label style={{display:"block",fontSize:"12px",fontWeight:"600",color:C.navy,marginBottom:"4px"}}>Reason (optional):</label>
            <input value={typeC_reason} onChange={e=>setTypeC_reason(e.target.value)} style={{...inp,width:"100%"}} placeholder="e.g. Pest treatment in progress"/>
          </div>
          {typeC_allowedActs.length>0&&activities.length>typeC_allowedActs.length&&(
            <div style={{background:"#fff3e0",borderRadius:"6px",padding:"8px",marginBottom:"10px",fontSize:"11px",color:C.orange}}>
              ⚠️ Restricted: {activities.filter(a=>!typeC_allowedActs.includes(a)).map(a=>{const isND=NON_DEFERRABLE_ACTS.some(nd=>a.toLowerCase().includes(nd.toLowerCase()));return isND?<span key={a} style={{color:C.red,fontWeight:"700"}}>{a} (lost) </span>:<span key={a}>{a} (deferred) </span>;}) }
            </div>
          )}
          <button onClick={createTypeC} style={{...btn(false,C.orange),width:"100%",padding:"10px"}}>🟠 Create Type C Quarantine</button>
        </div>
      </div>

      {/* Active events */}
      {quarantine.length>0&&(
        <div style={{marginBottom:"20px"}}>
          <h4 style={{color:C.navy,marginBottom:"12px"}}>Active Quarantine Orders ({quarantine.length})</h4>
          {quarantine.map(ev=>{
            const isTypeA=ev.quarantineType==="A"||!ev.quarantineType;
            const isTypeC=ev.quarantineType==="C";
            const color=isTypeA?C.red:isTypeC?C.orange:C.purple;
            const bgColor=isTypeA?"#fff8f8":isTypeC?"#fffbf5":"#fdf8ff";
            const typeLabel=isTypeA?"Type A — GH Lock":isTypeC?"Type C — Limited Activity":"Type B — Individual";
            const staffNames=ev.staffIds?.map(id=>staff.find(s=>s.id===id)?.name||id)||[];
            const daysLeft=getDaysRemaining(ev);
            const isRedundant=checkRedundant(ev);
            const totalDays=(ev.daysLocked||7)+(ev.extensionDays||0);
            return(
              <div key={ev.id} style={{border:`1px solid ${color}33`,borderLeft:`4px solid ${color}`,borderRadius:"8px",padding:"14px",marginBottom:"10px",background:bgColor}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"12px"}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"6px",flexWrap:"wrap"}}>
                      <span style={{background:color,color:"white",padding:"2px 10px",borderRadius:"10px",fontSize:"11px",fontWeight:"700"}}>{typeLabel}</span>
                      <strong style={{color,fontSize:"14px"}}>{ev.greenhouseId}</strong>
                      <span style={{fontSize:"13px",color:C.textMid}}>{totalDays} days total {ev.extensionDays>0?`(+${ev.extensionDays} extended)`:""}</span>
                      <span style={{background:daysLeft<=2?"#ffe5e5":daysLeft<=5?"#fff8ee":"#eafaf1",color:daysLeft<=2?C.red:daysLeft<=5?C.orange:C.green,padding:"2px 8px",borderRadius:"10px",fontSize:"11px",fontWeight:"700"}}>{daysLeft}d left</span>
                      {isRedundant&&<span style={{background:"#fff8ee",color:C.gold,padding:"2px 8px",borderRadius:"10px",fontSize:"11px"}}>⚠️ Redundant with Type A</span>}
                    </div>
                    <div style={{fontSize:"12px",color:C.textMid,marginBottom:"4px"}}><strong>{staffNames.length} staff:</strong> {staffNames.length>0?staffNames.join(", "):"None"}</div>
                    {isTypeC&&ev.allowedActivities&&<div style={{fontSize:"11px",color:C.orange,marginBottom:"2px"}}>✅ Allowed: {ev.allowedActivities.join(", ")}</div>}
                    {isTypeC&&ev.restrictedActivities?.length>0&&<div style={{fontSize:"11px",color:C.red,marginBottom:"2px"}}>🚫 Restricted: {ev.restrictedActivities.join(", ")}</div>}
                    {ev.reason&&<div style={{fontSize:"12px",color:C.textLight}}>📝 {ev.reason}</div>}
                    {ev.extensionDays>0&&<div style={{fontSize:"11px",color:C.teal,marginTop:"2px"}}>⏱️ Extended {ev.extensionDays} days — last extended: {fmtISOReadable(ev.lastExtendedAt)}</div>}
                    <div style={{fontSize:"11px",color:C.textLight,marginTop:"4px"}}>Created: {fmtISOReadable(ev.createdAt)}</div>

                    {/* Extend UI */}
                    {extendId===ev.id&&(
                      <div style={{marginTop:"10px",display:"flex",alignItems:"center",gap:"8px",background:"#f0fdfb",padding:"10px",borderRadius:"6px"}}>
                        <span style={{fontSize:"12px",color:C.navy,fontWeight:"600"}}>Extend by:</span>
                        <input type="number" min="1" max="90" value={extendDays} onChange={e=>setExtendDays(parseInt(e.target.value)||7)} style={{...inp,width:"70px",textAlign:"center"}}/>
                        <span style={{fontSize:"12px",color:C.textMid}}>days</span>
                        <button onClick={()=>extendEvent(ev.id)} style={{...btn(false,C.teal),padding:"4px 12px",fontSize:"12px"}}>✓ Extend</button>
                        <button onClick={()=>setExtendId(null)} style={{...btn(false,"#95a5a6"),padding:"4px 10px",fontSize:"12px"}}>Cancel</button>
                      </div>
                    )}
                  </div>
                  {role==="gm"&&(
                    <div style={{display:"flex",gap:"6px",flexShrink:0}}>
                      <button onClick={()=>{setExtendId(extendId===ev.id?null:ev.id);setExtendDays(7);}} style={{...btn(false,C.teal),padding:"5px 10px",fontSize:"12px"}}>⏱️ Extend</button>
                      <button onClick={()=>removeEvent(ev.id)} style={{...btn(false,C.red),padding:"5px 10px",fontSize:"12px"}}>End Early</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {quarantine.length===0&&<p style={{color:C.textLight,fontSize:"13px",textAlign:"center",padding:"20px 0"}}>No active quarantine orders.</p>}

      {/* Expired history */}
      {(quarantineHistory.length>0)&&(
        <div>
          <button onClick={()=>setShowHistory(!showHistory)} style={{...btn(false,"#95a5a6"),marginBottom:"10px"}}>
            {showHistory?"▲ Hide":"▼ Show"} Expired/Closed History ({quarantineHistory.length})
          </button>
          {showHistory&&(
            <div style={{background:C.light,borderRadius:"8px",padding:"14px"}}>
              {quarantineHistory.map((ev,i)=>{
                const isTypeA=ev.quarantineType==="A"||!ev.quarantineType;
                const isTypeC=ev.quarantineType==="C";
                const color=isTypeA?"#e74c3c":isTypeC?C.orange:"#8e44ad";
                const histTypeLabel=isTypeA?"Type A":isTypeC?"Type C":"Type B";
                const staffNames=ev.staffIds?.map(id=>staff.find(s=>s.id===id)?.name||id)||[];
                return(
                  <div key={ev.id||i} style={{borderLeft:`3px solid ${color}88`,padding:"8px 12px",marginBottom:"8px",background:"white",borderRadius:"4px",opacity:0.75}}>
                    <div style={{display:"flex",gap:"8px",alignItems:"center",flexWrap:"wrap",marginBottom:"4px"}}>
                      <span style={{background:`${color}22`,color,padding:"2px 8px",borderRadius:"8px",fontSize:"11px",fontWeight:"700"}}>{histTypeLabel}</span>
                      <span style={{fontWeight:"700",color:C.textDark,fontSize:"13px"}}>{ev.greenhouseId}</span>
                      {ev.closedEarly&&<span style={{background:"#fff8ee",color:C.orange,padding:"2px 8px",borderRadius:"8px",fontSize:"11px"}}>Closed early</span>}
                    </div>
                    <div style={{fontSize:"12px",color:C.textMid}}>{staffNames.join(", ")||"No staff"}</div>
                    {ev.reason&&<div style={{fontSize:"11px",color:C.textLight}}>📝 {ev.reason}</div>}
                    <div style={{fontSize:"11px",color:C.textLight,marginTop:"2px"}}>Created: {fmtISOReadable(ev.createdAt)}{ev.closedAt?` | Closed: ${fmtISOReadable(ev.closedAt)}`:""}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BACKUP PAGE — Export + Import
// ═══════════════════════════════════════════════════════════════════════════════
function BackupPage({staff,ghList,activities,cropTypes,clusters,clusterTransitions,demand,absences,schedule,scheduleSummary,quarantine,quarantineHistory,cycles,activeCycleId,tolerance,exportBackup,handleJSONFileRead,importMergeMode,setImportMergeMode,btn,inp,card,C,API,adelaideTime}){
  const fileInputRef=useRef(null);

  return(
    <div>
      <h2 style={{color:C.navy,marginBottom:"4px"}}>💾 Backup & Restore</h2>
      <p style={{color:C.textMid,fontSize:"13px",marginBottom:"20px"}}>
        Export all data to a JSON file before pushing code to GitHub. After a Render redeploy, use Import to restore everything in one click.
      </p>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"20px"}}>

        {/* EXPORT */}
        <div style={{...card,borderTop:`4px solid ${C.green}`}}>
          <h3 style={{color:C.navy,marginBottom:"8px"}}>📤 Export Backup</h3>
          <p style={{fontSize:"13px",color:C.textMid,marginBottom:"16px"}}>Downloads a complete snapshot of your current data — staff, greenhouses, activities, crop types, planning cycles, demand, absences, and schedule.</p>

          <div style={{background:C.light,borderRadius:"8px",padding:"14px",marginBottom:"16px"}}>
            <div style={{fontSize:"13px",color:C.textMid,marginBottom:"8px",fontWeight:"700"}}>What will be exported:</div>
            {[[`👥 ${staff.length} staff members`,C.blue],
              [`🏗️ ${ghList.length} greenhouses`,C.teal],
              [`📋 ${cycles.length} planning cycles`,C.orange],
              [`📅 Schedule: ${schedule?"Yes":"None yet"}`,schedule?C.green:C.textLight],
              [`⚙️ ${activities.length} activities, ${cropTypes.length} crop types`,C.purple],
            ].map(([label,color])=>(
              <div key={label} style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px",fontSize:"13px"}}>
                <span style={{color,fontWeight:"600"}}>✓</span>
                <span style={{color:C.textMid}}>{label}</span>
              </div>
            ))}
          </div>

          <button onClick={exportBackup} style={{...btn(false,C.green),width:"100%",padding:"12px",fontSize:"15px"}}>📤 Export Full Backup (JSON)</button>
          <p style={{fontSize:"11px",color:C.textLight,marginTop:"8px",textAlign:"center"}}>File: greenhouse-backup-{new Date().toLocaleDateString("en-AU").replace(/\//g,"-")}.json</p>
          <p style={{fontSize:"11px",color:C.textLight,textAlign:"center"}}>Adelaide time: {adelaideTime}</p>
        </div>

        {/* IMPORT */}
        <div style={{...card,borderTop:`4px solid ${C.blue}`}}>
          <h3 style={{color:C.navy,marginBottom:"8px"}}>📥 Import from Backup</h3>
          <p style={{fontSize:"13px",color:C.textMid,marginBottom:"16px"}}>Select a previously exported JSON file to restore your data. You will see a full preview before anything is committed.</p>

          <div style={{marginBottom:"14px"}}>
            <label style={{display:"block",fontSize:"13px",fontWeight:"700",color:C.navy,marginBottom:"8px"}}>Import Mode:</label>
            <div style={{display:"flex",gap:"10px"}}>
              {[["replace","🔄 Replace All"],["merge","➕ Merge"]].map(([v,l])=>(
                <label key={v} style={{flex:1,display:"flex",gap:"8px",padding:"10px",border:`2px solid ${importMergeMode===v?C.teal:C.border}`,borderRadius:"8px",cursor:"pointer",background:importMergeMode===v?"#f0fdfb":"white"}}>
                  <input type="radio" value={v} checked={importMergeMode===v} onChange={()=>setImportMergeMode(v)}/>
                  <div><div style={{fontWeight:"700",color:C.navy,fontSize:"13px"}}>{l}</div></div>
                </label>
              ))}
            </div>
            <div style={{fontSize:"12px",color:C.textMid,marginTop:"6px"}}>
              {importMergeMode==="replace"?"Replace All: overwrites all current data completely.":"Merge: adds new staff only, keeps existing data."}
            </div>
          </div>

          {importMergeMode==="replace"&&(
            <div style={{background:"#fff5f5",border:`1px solid ${C.red}`,borderRadius:"6px",padding:"10px",marginBottom:"14px",fontSize:"12px",color:C.red}}>
              ⚠️ Replace mode will overwrite ALL current data. Make sure you export first if you want to keep anything.
            </div>
          )}

          <input type="file" ref={fileInputRef} accept=".json" style={{display:"none"}} onChange={e=>{if(e.target.files[0])handleJSONFileRead(e.target.files[0]);}}/>
          <button onClick={()=>fileInputRef.current?.click()} style={{...btn(false,C.blue),width:"100%",padding:"12px",fontSize:"15px"}}>📂 Select JSON File to Import</button>
          <p style={{fontSize:"11px",color:C.textLight,marginTop:"8px",textAlign:"center"}}>A preview will appear before any data is changed.</p>
        </div>
      </div>

      {/* Instructions */}
      <div style={{...card,marginTop:"20px",borderLeft:`4px solid ${C.gold}`}}>
        <h4 style={{color:C.navy,margin:"0 0 10px 0"}}>📋 Workflow: How to survive a GitHub push</h4>
        <ol style={{margin:0,paddingLeft:"20px",lineHeight:"2",fontSize:"13px",color:C.textMid}}>
          <li>Your friend enters all staff and data in the live app</li>
          <li>Click <strong>"Export Full Backup"</strong> above → save the JSON file to your computer</li>
          <li>Make your code changes, push to GitHub</li>
          <li>Render redeploys → data.json is wiped (expected)</li>
          <li>App reloads with empty data</li>
          <li>Click <strong>"Select JSON File to Import"</strong> → select your backup file</li>
          <li>Review the preview → click <strong>"Confirm Import"</strong></li>
          <li>All data is restored instantly ✅</li>
        </ol>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BULK CSV IMPORT
// ═══════════════════════════════════════════════════════════════════════════════
function BulkCSVImport({staff,setStaff,API,btn,inp,C,setBackupReminder}){
  const [csvText,setCsvText]=useState("");
  const [preview,setPreview]=useState([]);
  const [importMode,setImportMode]=useState("merge");
  const [result,setResult]=useState(null);
  const fileRef=useRef(null);

  const parseCSV=(text)=>{
    const lines=text.trim().split("\n");
    if(lines.length<2)return[];
    const headers=lines[0].split(",").map(h=>h.trim().toLowerCase().replace(/\s+/g,""));
    return lines.slice(1).map(line=>{
      const vals=line.split(",").map(v=>v.trim().replace(/^"|"$/g,""));
      const row={};
      headers.forEach((h,i)=>{row[h]=vals[i]||"";});
      return row;
    }).filter(r=>r.id&&r.name);
  };

  const handleFile=(file)=>{
    const reader=new FileReader();
    reader.onload=(e)=>{setCsvText(e.target.result);const rows=parseCSV(e.target.result);setPreview(rows.slice(0,10));};
    reader.readAsText(file);
  };

  const doImport=async()=>{
    const rows=parseCSV(csvText);
    if(!rows.length)return alert("No valid rows found. Check CSV format.");
    try{
      const res=await axios.post(`${API}/staff/bulk-import`,{rows,mode:importMode});
      setResult(res.data);
      // Refresh staff from backend
      const d=await axios.get(`${API}/data`);
      if(d.data.staff?.length>0){setStaff(d.data.staff.map(normaliseStaff));setBackupReminder(true);}
    }catch(e){alert("Import error: "+e.message);}
  };

  return(
    <div>
      <p style={{color:C.textMid,fontSize:"13px",marginBottom:"12px"}}>
        Upload a CSV file with columns: <code style={{background:"#f0f4f8",padding:"2px 6px",borderRadius:"3px"}}>id, name, hoursPerDay, overtimeLimit</code>. After import, assign activities/GH/crop types per staff using the Edit button.
      </p>

      <div style={{marginBottom:"12px",padding:"10px",background:"#f8f9fa",borderRadius:"6px",fontSize:"12px",color:C.textMid}}>
        <strong>CSV format example:</strong><br/>
        <code>id,name,hoursPerDay,overtimeLimit<br/>STF001,John Smith,7,30<br/>STF002,Jane Doe,7,30</code>
      </div>

      <div style={{display:"flex",gap:"10px",marginBottom:"12px",alignItems:"center",flexWrap:"wrap"}}>
        <input type="file" ref={fileRef} accept=".csv,.txt" style={{display:"none"}} onChange={e=>{if(e.target.files[0])handleFile(e.target.files[0]);}}/>
        <button onClick={()=>fileRef.current?.click()} style={btn(false,C.blue)}>📂 Upload CSV</button>
        <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
          <label style={{fontSize:"13px",color:C.textMid}}>Mode:</label>
          <select value={importMode} onChange={e=>setImportMode(e.target.value)} style={{...inp,fontSize:"12px"}}>
            <option value="merge">Merge (skip duplicates)</option>
            <option value="replace">Replace all staff</option>
          </select>
        </div>
      </div>

      {csvText&&(
        <div>
          <textarea value={csvText} onChange={e=>{setCsvText(e.target.value);setPreview(parseCSV(e.target.value).slice(0,10));}}
            style={{...inp,width:"100%",height:"120px",fontFamily:"monospace",fontSize:"12px",marginBottom:"10px",boxSizing:"border-box"}}
            placeholder="Or paste CSV text here..."/>

          {preview.length>0&&(
            <div style={{marginBottom:"12px"}}>
              <div style={{fontSize:"12px",fontWeight:"700",color:C.navy,marginBottom:"6px"}}>Preview (first {preview.length} rows):</div>
              <table style={{borderCollapse:"collapse",fontSize:"12px",width:"100%"}}>
                <thead><tr style={{background:C.navy,color:"white"}}><th style={{padding:"6px 10px",textAlign:"left"}}>ID</th><th style={{padding:"6px 10px",textAlign:"left"}}>Name</th><th style={{padding:"6px 10px",textAlign:"center"}}>Hrs/Day</th><th style={{padding:"6px 10px",textAlign:"center"}}>OT Limit</th></tr></thead>
                <tbody>{preview.map((r,i)=><tr key={i} style={{background:i%2===0?C.light:C.white}}><td style={{padding:"5px 10px",fontFamily:"monospace",fontSize:"11px"}}>{r.id||r["id"]}</td><td style={{padding:"5px 10px"}}>{r.name}</td><td style={{padding:"5px 10px",textAlign:"center"}}>{r.hoursperday||r.hoursPerDay||"7"}</td><td style={{padding:"5px 10px",textAlign:"center"}}>{r.overtimelimit||r.overtimeLimit||"30"}</td></tr>)}</tbody>
              </table>
              <div style={{fontSize:"12px",color:C.textLight,marginTop:"4px"}}>Total rows in file: {parseCSV(csvText).length}</div>
            </div>
          )}
          <button onClick={doImport} style={{...btn(false,C.green),padding:"10px 24px"}}>✅ Import {parseCSV(csvText).length} Staff</button>
        </div>
      )}

      {!csvText&&(
        <textarea onChange={e=>{setCsvText(e.target.value);setPreview(parseCSV(e.target.value).slice(0,10));}}
          style={{...inp,width:"100%",height:"100px",fontFamily:"monospace",fontSize:"12px",marginBottom:"10px",boxSizing:"border-box"}}
          placeholder="Or paste CSV content here directly..."/>
      )}

      {result&&(
        <div style={{marginTop:"12px",background:result.errors?.length?"#fff8ee":"#eafaf1",borderRadius:"6px",padding:"12px",fontSize:"13px"}}>
          <strong>{result.message}</strong>
          {result.errors?.length>0&&<div style={{marginTop:"6px",color:C.red,fontSize:"12px"}}>{result.errors.join("\n")}</div>}
          <div style={{fontSize:"12px",color:C.textMid,marginTop:"4px"}}>Total staff now in system: {result.totalStaff}</div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAFF PROFILE POPUP — simplified: crops + activities per crop
// ═══════════════════════════════════════════════════════════════════════════════
function StaffProfilePopup({selectedStaff,setSelectedStaff,staff,setStaff,activities,ghNames,ghList,cropTypes,absences,calcVersatility,btn,inp,C,ALL_DAYS,DAY_SHORT,setBackupReminder}){
  const update=(updates)=>{const u={...selectedStaff,...updates};setSelectedStaff(u);setStaff(staff.map(s=>s.id===selectedStaff.id?u:s));setBackupReminder(true);};

  // cropTypes: [] means ALL crops; non-empty means those specific crops
  const staffCrops=selectedStaff.cropTypes||[];
  const allCrops=staffCrops.length===0;
  const effectiveCrops=allCrops?cropTypes:staffCrops;

  // cropActivities: null/undefined = all; array = explicit selection
  const cropActs=selectedStaff.cropActivities||{};
  const allActsForCrop=(crop)=>cropActs[crop]==null;
  const getActsForCrop=(crop)=>allActsForCrop(crop)?activities:(cropActs[crop]||[]);

  const toggleCrop=(crop,checked)=>{
    let newCrops;
    if(allCrops){
      newCrops=checked?cropTypes:cropTypes.filter(c=>c!==crop);
    } else {
      newCrops=checked?[...staffCrops,crop]:staffCrops.filter(c=>c!==crop);
    }
    const final=newCrops.length===cropTypes.length?[]:newCrops;
    update({cropTypes:final});
  };

  const toggleAllCrops=()=>update({cropTypes:[]});

  const toggleActForCrop=(crop,act,checked)=>{
    const cur=allActsForCrop(crop)?[...activities]:(cropActs[crop]||[]);
    const next=checked?[...cur,act]:cur.filter(a=>a!==act);
    update({cropActivities:{...cropActs,[crop]:next}});
  };
  const toggleAllActsForCrop=(crop)=>{
    if(allActsForCrop(crop)){
      // Uncheck "All Activities" → switch to explicit with all pre-selected
      update({cropActivities:{...cropActs,[crop]:[...activities]}});
    } else {
      // Re-check "All Activities" → remove key (null = all)
      const n={...cropActs};delete n[crop];
      update({cropActivities:n});
    }
  };

  // Build backend-compatible activities array for display summary
  const summaryActCount=()=>{
    const s=new Set();
    effectiveCrops.forEach(crop=>getActsForCrop(crop).forEach(a=>s.add(a)));
    return s.size;
  };

  const v=calcVersatility(selectedStaff);
  const absCount=ALL_DAYS.filter(d=>{const al=absences[d]||[];return al.includes(selectedStaff.id)||al.some(x=>typeof x==="object"&&x.id===selectedStaff.id&&x.hours===0);}).length;

  return(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
      <div style={{background:"white",borderRadius:"14px",padding:"28px",maxWidth:"820px",width:"95%",maxHeight:"92vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"18px"}}>
          <div><h2 style={{color:C.navy,margin:"0 0 4px 0"}}>{selectedStaff.name}</h2><span style={{fontFamily:"monospace",color:C.textLight,fontSize:"13px"}}>{selectedStaff.id}</span></div>
          <button onClick={()=>setSelectedStaff(null)} style={btn(false,C.red)}>✕ Close</button>
        </div>

        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"10px",marginBottom:"18px"}}>
          {[[`${effectiveCrops.length===cropTypes.length?"All":effectiveCrops.length} crops`,"Crops",C.green,"#f0fff4"],[`${summaryActCount()} acts`,"Activities",C.teal,"#f0fdfb"],[selectedStaff.hoursPerDay??7,"Hrs/Day",C.blue,"#eaf2ff"],[selectedStaff.overtimeLimit??30,"OT Limit/Wk",C.purple,"#f8f4ff"]].map(([val,label,color,bg])=>(
            <div key={label} style={{background:bg,padding:"10px",borderRadius:"8px",textAlign:"center"}}><div style={{fontSize:"18px",fontWeight:"800",color}}>{val}</div><div style={{fontSize:"11px",color:C.textLight,marginTop:"2px"}}>{label}</div></div>
          ))}
        </div>

        {/* Basic info + hours */}
        <div style={{marginBottom:"18px",padding:"14px",background:"#fafafa",borderRadius:"8px",border:`1px solid ${C.border}`}}>
          <div style={{display:"flex",gap:"10px",flexWrap:"wrap",marginBottom:"10px"}}>
            <input value={selectedStaff.id} onChange={e=>update({id:e.target.value})} style={{...inp,flex:1,minWidth:"100px"}} placeholder="Staff ID"/>
            <input value={selectedStaff.name} onChange={e=>update({name:e.target.value})} style={{...inp,flex:2,minWidth:"150px"}} placeholder="Full Name"/>
          </div>
          <div style={{display:"flex",gap:"16px",flexWrap:"wrap",marginBottom:"14px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
              <label style={{fontSize:"13px",color:C.textMid}}>Daily max hrs:</label>
              <input type="number" min="0" max="16" value={selectedStaff.hoursPerDay??7} onChange={e=>update({hoursPerDay:parseInt(e.target.value)||0})} style={{...inp,width:"55px",textAlign:"center"}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
              <label style={{fontSize:"13px",color:C.textMid}}>OT limit/week:</label>
              <input type="number" min="0" max="80" value={selectedStaff.overtimeLimit??30} onChange={e=>update({overtimeLimit:parseInt(e.target.value)||0})} style={{...inp,width:"55px",textAlign:"center"}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
              <label style={{display:"flex",alignItems:"center",gap:"6px",cursor:"pointer",fontSize:"13px",color:C.textMid}}>
                <input type="checkbox" checked={selectedStaff.otWilling!==false} onChange={e=>update({otWilling:e.target.checked})} style={{accentColor:C.orange,width:16,height:16}}/>
                OT Willing
              </label>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"6px"}}>
            {ALL_DAYS.map(day=>{const isWE=["Saturday","Sunday"].includes(day);return(
              <div key={day} style={{textAlign:"center"}}>
                <div style={{fontSize:"10px",color:isWE?C.orange:C.textMid,marginBottom:"3px",fontWeight:isWE?"700":"400"}}>{DAY_SHORT[day]}</div>
                <input type="number" min="0" max="16"
                  value={selectedStaff.dayHours?.[day]??(isWE?0:selectedStaff.hoursPerDay??7)}
                  onChange={e=>update({dayHours:{...(selectedStaff.dayHours||{}),[day]:parseInt(e.target.value)||0}})}
                  style={{...inp,width:"100%",textAlign:"center",background:isWE?"#fff8f0":"white",borderColor:isWE?C.orange:C.border,padding:"4px 2px"}}/>
              </div>
            );})}
          </div>
          <p style={{color:C.textLight,fontSize:"11px",marginTop:"6px"}}>Set 0 for days not worked. Use Absence tab for one-off changes.</p>
        </div>

        {/* Crops section */}
        <div style={{marginBottom:"18px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"10px"}}>
            <h4 style={{color:C.navy,margin:0,fontSize:"14px"}}>🌱 Crops</h4>
            <label style={{display:"flex",alignItems:"center",gap:"5px",cursor:"pointer",background:allCrops?"#dcfce7":"#f3f4f6",padding:"4px 12px",borderRadius:"20px",border:`1px solid ${allCrops?C.green:C.border}`,fontSize:"12px",fontWeight:"600",color:allCrops?C.green:C.textMid}}>
              <input type="checkbox" checked={allCrops} onChange={toggleAllCrops} style={{accentColor:C.green}}/>
              All Crops
            </label>
            <span style={{fontSize:"11px",color:C.textLight}}>Greenhouse is auto-assigned from crop allocation</span>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
            {cropTypes.map(crop=>{
              const sel=allCrops||staffCrops.includes(crop);
              return(
                <label key={crop} style={{display:"flex",alignItems:"center",gap:"5px",cursor:"pointer",background:sel?"#d1fae5":"white",padding:"6px 12px",borderRadius:"8px",border:`1px solid ${sel?C.green:C.border}`,fontSize:"13px",fontWeight:sel?"600":"400",color:sel?C.navy:C.textMid}}>
                  <input type="checkbox" checked={sel} onChange={e=>toggleCrop(crop,e.target.checked)} style={{accentColor:C.green}}/>
                  {crop}
                </label>
              );
            })}
          </div>
        </div>

        {/* Activities per crop */}
        <div style={{marginBottom:"18px"}}>
          <h4 style={{color:C.navy,margin:"0 0 10px 0",fontSize:"14px"}}>⚙️ Activities per Crop</h4>
          <p style={{fontSize:"12px",color:C.textMid,marginBottom:"10px"}}>Default is all activities for each crop. Untick to restrict.</p>
          <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
            {effectiveCrops.map(crop=>{
              const allActs=allActsForCrop(crop);
              const selActs=allActs?activities:(cropActs[crop]||[]);
              return(
                <div key={crop} style={{border:`1px solid ${C.border}`,borderRadius:"8px",padding:"10px 14px",background:"#fafafa"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"8px",flexWrap:"wrap"}}>
                    <span style={{fontWeight:"700",color:C.navy,fontSize:"13px",minWidth:"140px"}}>{crop}</span>
                    <label style={{display:"flex",alignItems:"center",gap:"4px",cursor:"pointer",background:allActs?"#e0f2fe":"#f3f4f6",padding:"3px 10px",borderRadius:"12px",border:`1px solid ${allActs?C.teal:C.border}`,fontSize:"12px",fontWeight:"600",color:allActs?C.teal:C.textMid}}>
                      <input type="checkbox" checked={allActs} onChange={()=>toggleAllActsForCrop(crop)} style={{accentColor:C.teal}}/>
                      All Activities
                    </label>
                  </div>
                  {!allActs&&(
                    <div style={{display:"flex",flexWrap:"wrap",gap:"5px"}}>
                      {activities.map(act=>{
                        const sel=selActs.includes(act);
                        return(
                          <label key={act} style={{display:"flex",alignItems:"center",gap:"4px",cursor:"pointer",background:sel?"#e0f2fe":"white",padding:"4px 10px",borderRadius:"6px",border:`1px solid ${sel?C.teal:C.border}`,fontSize:"12px",color:sel?C.navy:C.textMid,fontWeight:sel?"600":"400"}}>
                            <input type="checkbox" checked={sel} onChange={e=>toggleActForCrop(crop,act,e.target.checked)} style={{accentColor:C.teal}}/>
                            {act}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:"14px",borderTop:`1px solid ${C.border}`}}>
          <button onClick={()=>{if(window.confirm(`Remove ${selectedStaff.name}?`)){setStaff(staff.filter(x=>x.id!==selectedStaff.id));setSelectedStaff(null);}}} style={btn(false,C.red)}>🗑️ Remove Staff</button>
          <button onClick={()=>setSelectedStaff(null)} style={btn(false,C.green)}>✓ Done</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADD STAFF FORM
// ═══════════════════════════════════════════════════════════════════════════════
function AddStaffForm({staff,setStaff,masterDefaults,btn,inp,setBackupReminder}){
  const [name,setName]=useState("");const [id,setId]=useState("");
  const h=masterDefaults?.hoursPerDay??7;const ot=masterDefaults?.overtimeLimit??30;
  const add=()=>{
    if(!name.trim()||!id.trim())return alert("Please enter both Staff ID and Name");
    if(staff.find(s=>s.id===id.trim()))return alert("Staff ID already exists");
    setStaff([...staff,{id:id.trim(),name:name.trim(),hoursPerDay:h,dayHours:{Monday:h,Tuesday:h,Wednesday:h,Thursday:h,Friday:h,Saturday:0,Sunday:0},overtimeLimit:ot,cropTypes:[],cropActivities:{},activities:[]}]);
    setName("");setId("");
    setBackupReminder(true);
  };
  return(
    <div>
      <input value={id} onChange={e=>setId(e.target.value)} style={{...inp,width:"100%",marginBottom:"8px",boxSizing:"border-box"}} placeholder="Staff ID (e.g. STF001)"/>
      <input value={name} onChange={e=>setName(e.target.value)} style={{...inp,width:"100%",marginBottom:"8px",boxSizing:"border-box"}} placeholder="Full Name"/>
      <p style={{fontSize:"12px",color:"#666",marginBottom:"12px"}}>Hours/day: <strong>{h}h</strong> · OT limit: <strong>{ot}h/wk</strong> (from master defaults — adjust after adding)</p>
      <button onClick={add} style={btn(false,"#27ae60")}>+ Add Staff Member</button>
      <p style={{color:"#888",fontSize:"12px",marginTop:"8px"}}>After adding, click ✏️ Edit to set crops and activities. Default: all crops + all activities.</p>
    </div>
  );
}