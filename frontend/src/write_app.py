# -*- coding: utf-8 -*-
code = r'''
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

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
  const [saved,setSaved]=useState(false);
  const [loading,setLoading]=useState(true);
  const [generating,setGenerating]=useState(false);
  const [tolerance,setTolerance]=useState(5);
  const [scheduleStale,setScheduleStale]=useState(false);
  const [adelaideTime,setAdelaideTime]=useState("");
  const [quarantine,setQuarantine]=useState([]);
  const [quarantineHistory,setQuarantineHistory]=useState([]);
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

  useEffect(()=>{
    const tick=()=>setAdelaideTime(new Date().toLocaleString("en-AU",{timeZone:"Australia/Adelaide",weekday:"short",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:true}));
    tick();const t=setInterval(tick,1000);return()=>clearInterval(t);
  },[]);

  useEffect(()=>{
    axios.get(`${API}/data`).then(res=>{
      const d=res.data;
      if(d.staff?.length>0)setStaff(d.staff);
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

  const normaliseGH=(gh)=>{if(typeof gh==="string")return{id:gh,name:gh,cropTypes:[]};return{id:gh.id||gh.name||"",name:gh.name||gh.id||"",cropTypes:gh.cropTypes||[]};};
  const ghList=greenhouses.map(normaliseGH);
  const ghNames=ghList.map(g=>g.name);

  const calcVersatility=(s)=>{
    if(!activities.length||!ghNames.length)return 0;
    const sa=s.activities||[];
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

  if(!role)return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,backgroundImage:"url('https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1600')",backgroundSize:"cover",backgroundPosition:"center",filter:"brightness(0.3)"}}/>
      <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"linear-gradient(135deg,rgba(26,58,92,0.8),rgba(13,115,119,0.6))"}}/>
      <div style={{position:"relative",zIndex:1,textAlign:"center",padding:"20px",width:"100%",maxWidth:"540px"}}>
        <div style={{fontSize:"60px",marginBottom:"10px"}}>🌿</div>
        <h1 style={{color:"white",marginBottom:"6px",fontSize:"30px",textShadow:"0 2px 12px rgba(0,0,0,0.6)"}}>Greenhouse Planner</h1>
        <p style={{color:"rgba(255,255,255,0.8)",marginBottom:"10px",fontSize:"14px"}}>Workforce Allocation & Scheduling System</p>
        <p style={{color:"rgba(255,255,255,0.5)",marginBottom:"36px",fontSize:"12px"}}>Adelaide Time: {adelaideTime}</p>
        <div style={{display:"flex",gap:"20px",justifyContent:"center"}}>
          {[{role:"gm",icon:"👔",title:"General Manager",sub:"Full Access — All Tabs",color:"rgba(26,58,92,0.92)"},{role:"lm",icon:"👷",title:"Labour Manager",sub:"Staff & Operations",color:"rgba(13,115,119,0.92)"}].map(r=>(
            <div key={r.role} onClick={()=>{setRole(r.role);setPage("dashboard");}} style={{background:r.color,backdropFilter:"blur(10px)",color:"white",padding:"36px 40px",borderRadius:"16px",cursor:"pointer",flex:1,border:"1px solid rgba(255,255,255,0.2)",boxShadow:"0 8px 32px rgba(0,0,0,0.3)"}}>
              <div style={{fontSize:"42px",marginBottom:"14px"}}>{r.icon}</div>
              <div style={{fontWeight:"700",fontSize:"17px"}}>{r.title}</div>
              <div style={{fontSize:"12px",opacity:0.75,marginTop:"8px"}}>{r.sub}</div>
            </div>
          ))}
        </div>
        <p style={{color:"rgba(255,255,255,0.4)",fontSize:"11px",marginTop:"30px"}}>Select your role to continue</p>
      </div>
    </div>
  );

  const tabs=[
    {id:"dashboard",label:"Dashboard",icon:"📊"},
    {id:"staff",label:"Staff",icon:"👥"},
    {id:"demand",label:"Demand",icon:"📋"},
    {id:"schedule",label:"Schedule",icon:"📅"},
    {id:"absence",label:"Absence",icon:"🏥"},
    {id:"overtime",label:"Overtime",icon:"⏱️"},
    {id:"edit",label:"Edit",icon:"✏️"},
    ...(role==="gm"?[{id:"quarantine",label:"Quarantine",icon:"🔴"},{id:"backup",label:"Backup",icon:"💾"}]:[{id:"backup",label:"Backup",icon:"💾"}])
  ];

  return(
    <div style={{background:C.bg,minHeight:"100vh",fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      {/* ── Navbar ── */}
      <div style={{background:C.navy,padding:"0 16px",display:"flex",alignItems:"stretch",gap:"2px",flexWrap:"wrap",boxShadow:"0 2px 8px rgba(0,0,0,0.2)"}}>
        <div style={{display:"flex",alignItems:"center",paddingRight:"16px",borderRight:"1px solid rgba(255,255,255,0.15)",marginRight:"8px"}}>
          <span style={{color:"white",fontWeight:"700",fontSize:"15px"}}>🌿 Greenhouse Planner</span>
        </div>
        {tabs.map(t=>(
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
          <span style={{color:"#aed6f1",fontSize:"12px",borderLeft:"1px solid rgba(255,255,255,0.2)",paddingLeft:"10px"}}>{role==="gm"?"👔 General Manager":"👷 Labour Manager"}</span>
          <button onClick={saveData} style={{...btn(false,saved?"#27ae60":C.orange),fontSize:"12px"}}>{saved?"✓ Saved!":"💾 Save"}</button>
          <button onClick={exportBackup} style={{...btn(false,C.teal),fontSize:"12px"}}>📤 Export</button>
          <button onClick={()=>{setRole(null);setPage("dashboard");}} style={{...btn(false,"#c0392b"),fontSize:"12px"}}>Exit</button>
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
            ghList={ghList} activities={activities} cropTypes={cropTypes}
            demand={demand} setDemand={setDemand}
            cycles={cycles} setCycles={setCycles}
            activeCycleId={activeCycleId} setActiveCycleId={setActiveCycleId}
            activeWeekIndex={activeWeekIndex} setActiveWeekIndex={setActiveWeekIndex}
            totalCapacity={totalCapacity} generating={generating}
            generateSchedule={generateSchedule} setScheduleStale={setScheduleStale}
            btn={btn} inp={inp} card={card} C={C}/>
        )}

        {/* ══ SCHEDULE ══ */}
        {page==="schedule"&&(
          <div>
            <h2 style={{color:C.navy,marginBottom:"4px"}}>📅 Schedule</h2>
            {activeWeek&&<p style={{color:C.textMid,fontSize:"13px",marginBottom:"16px"}}>Week {activeWeekIndex+1}: {fmtDate(activeWeek.startDate)} — {fmtDate(addDays(activeWeek.startDate,6))}</p>}
            {!schedule?(<div style={card}><p style={{color:C.textLight}}>No schedule yet. Go to Demand and click Generate.</p></div>):(
              <div>
                {scheduleSummary&&(
                  <div style={{...card,background:"#eafaf1",padding:"14px",marginBottom:"14px"}}>
                    <div style={{display:"flex",gap:"20px",flexWrap:"wrap",fontSize:"13px",alignItems:"center"}}>
                      <span>✅ <strong>Regular:</strong> {scheduleSummary.totalAssigned}h</span>
                      {scheduleSummary.totalOTHours>0&&<span style={{color:C.orange}}>⏱️ <strong>OT:</strong> {scheduleSummary.totalOTHours}h ({scheduleSummary.otStaffCount} staff)</span>}
                      <span style={{color:scheduleSummary.totalUnassigned>0?C.red:C.green}}>{scheduleSummary.totalUnassigned>0?"⚠️":"✓"} <strong>Unassigned:</strong> {scheduleSummary.totalUnassigned}h</span>
                      <span>📊 <strong>Demand:</strong> {scheduleSummary.totalDemand}h</span>
                      {efficiencyScore!=null&&role==="gm"&&<span style={{color:efficiencyScore>=80?C.green:C.gold,fontWeight:"700"}}>📊 Efficiency: {efficiencyScore}%</span>}
                      {scheduleSummary.generatedAt&&<span style={{color:C.textLight,fontSize:"11px",marginLeft:"auto"}}>Generated: {fmtISOReadable(scheduleSummary.generatedAt)}</span>}
                    </div>
                  </div>
                )}
                {Object.entries(schedule).map(([day,assignments])=>{
                  const dateStr=activeWeekDates[day]?` — ${fmtDateShort(activeWeekDates[day])}`:"";
                  return(
                    <div key={day} style={card}>
                      <h3 style={{color:C.navy,marginBottom:"10px",fontSize:"15px"}}>
                        {day}<span style={{color:C.teal,fontWeight:"600"}}>{dateStr}</span>
                        <span style={{fontWeight:"400",color:C.textMid,fontSize:"13px",marginLeft:"8px"}}>— {assignments.filter(x=>!x.unassigned).length} assignments</span>
                        {assignments.filter(x=>x.unassigned).length>0&&<span style={{color:C.red,fontSize:"13px"}}> | ⚠️ {assignments.filter(x=>x.unassigned).length} unassigned</span>}
                      </h3>
                      {!assignments.length?<p style={{color:C.textLight,fontSize:"13px"}}>No assignments</p>:(
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px"}}>
                          <thead><tr><TH>Staff ID</TH><TH>Name</TH><TH>Greenhouse</TH><TH>Activity</TH><TH>Crop Type</TH><TH center>Hours</TH><TH center>Transit</TH></tr></thead>
                          <tbody>
                            {assignments.map((a,i)=>(
                              <tr key={i} style={{background:a.unassigned?"#fde8e8":a.isOT?"#fff8ee":a.reoptimised?"#fffbea":i%2===0?C.light:C.white}}>
                                <td style={{padding:"8px 10px",fontFamily:"monospace",color:a.unassigned?C.red:C.navy,fontSize:"12px"}}>{a.staffId}</td>
                                <td style={{padding:"8px 10px",fontSize:"13px"}}>{a.unassigned?<span style={{color:C.red}}>⚠️ {a.staffName}</span>:<button onClick={()=>{const s=staff.find(x=>x.id===a.staffId);if(s)setSelectedStaff(s);}} style={{background:"none",border:"none",color:C.blue,cursor:"pointer",textDecoration:"underline",fontSize:"13px",padding:0}}>{a.staffName}</button>}{a.isOT&&<span style={{fontSize:"11px",color:C.orange,marginLeft:"6px",fontWeight:"700"}}>⏱️OT</span>}{a.reoptimised&&<span style={{fontSize:"11px",color:C.gold,marginLeft:"6px"}}>↻</span>}</td>
                                <td style={{padding:"8px 10px"}}>{a.greenhouse}</td>
                                <td style={{padding:"8px 10px"}}>{a.activity}</td>
                                <td style={{padding:"8px 10px",fontSize:"12px",color:C.textMid}}>{a.cropType||"—"}</td>
                                <td style={{padding:"8px 10px",textAlign:"center"}}>{a.hours}h</td>
                                <td style={{padding:"8px 10px",textAlign:"center",color:a.transitionMins>0?C.gold:C.textLight,fontSize:"12px"}}>{a.transitionMins>0?`${a.transitionMins}min`:"—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
                        <TH center>Abs</TH>
                      </tr>
                      <tr style={{background:"#254a6e"}}>
                        <td colSpan="2"></td>
                        {ALL_DAYS.map(d=><React.Fragment key={d}><td style={{padding:"2px 5px",textAlign:"center",color:"rgba(255,255,255,0.7)",fontSize:"10px",borderLeft:"1px solid rgba(255,255,255,0.1)"}}>Hrs</td><td style={{padding:"2px 5px",textAlign:"center",color:"rgba(255,255,255,0.7)",fontSize:"10px"}}>Off</td></React.Fragment>)}
                        <td></td>
                      </tr>
                    </thead>
                    <tbody>
                      {staff.map((s,i)=>{
                        const totalAbs=ALL_DAYS.filter(d=>{const al=absences[d]||[];return al.includes(s.id)||al.some(x=>typeof x==="object"&&x.id===s.id&&x.hours===0);}).length;
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
                            <td style={{padding:"6px",textAlign:"center",fontWeight:"700",color:totalAbs>0?C.red:C.textLight,background:i%2===0?C.light:C.white,fontSize:"12px"}}>{totalAbs||"—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{marginTop:"14px",display:"flex",gap:"8px",flexWrap:"wrap",alignItems:"center"}}>
                  {(role==="gm"||role==="lm")&&<button onClick={()=>generateSchedule()} disabled={generating} style={{...btn(false,C.green),opacity:generating?0.7:1}}>{generating?"⏳ Optimising...":"🚀 Full Regenerate"}</button>}
                  {schedule&&staff.filter(s=>ALL_DAYS.some(d=>{const al=absences[d]||[];return al.includes(s.id)||al.some(x=>typeof x==="object"&&x.id===s.id);})).map(s=>{
                    const affectedDays=ALL_DAYS.filter(d=>{const al=absences[d]||[];return al.includes(s.id)||al.some(x=>typeof x==="object"&&x.id===s.id);});
                    return <button key={s.id} onClick={()=>reoptimise(s.id,affectedDays)} disabled={generating} style={{...btn(false,C.gold),fontSize:"12px",opacity:generating?0.7:1}}>↻ Min-disrupt: {s.name}</button>;
                  })}
                </div>
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
              <div style={card}><h3 style={{color:C.navy,marginBottom:"12px"}}>👤 Add New Staff</h3><AddStaffForm staff={staff} setStaff={setStaff} btn={btn} inp={inp} setBackupReminder={setBackupReminder}/></div>
            </div>
            {staff.length>0&&(
              <div style={{...card,marginTop:"18px"}}>
                <h3 style={{color:C.navy,marginBottom:"12px"}}>👥 Manage Staff ({staff.length})</h3>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr><TH>ID</TH><TH>Name</TH><TH center>Default Hrs</TH><TH center>OT Limit</TH><TH>Versatility</TH><TH>Actions</TH></tr></thead>
                  <tbody>{staff.map((s,i)=>{const v=calcVersatility(s);return(<tr key={s.id} style={{background:i%2===0?C.light:C.white}}><TD i={i}><span style={{fontFamily:"monospace",color:C.navy,fontWeight:"700"}}>{s.id}</span></TD><TD i={i}>{s.name}</TD><TD i={i} center>{s.hoursPerDay??7}h</TD><TD i={i} center>{s.overtimeLimit??30}h</TD><TD i={i}><div style={{display:"flex",alignItems:"center",gap:"6px"}}><div style={{background:"#eee",borderRadius:"4px",overflow:"hidden",width:"70px",height:"10px"}}><div style={{width:`${v}%`,background:v>75?C.green:v>50?C.gold:C.red,height:"100%"}}/></div><span style={{fontSize:"12px",fontWeight:"600",color:v>75?C.green:v>50?C.gold:C.red}}>{v}%</span></div></TD><TD i={i}><button onClick={()=>setSelectedStaff({...s})} style={btn(false,C.purple)}>✏️ Edit</button><button onClick={()=>{if(window.confirm(`Remove ${s.name}?`))setStaff(staff.filter(x=>x.id!==s.id));}} style={btn(false,C.red)}>🗑️</button></TD></tr>);})}</tbody>
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
        {page==="quarantine"&&role==="gm"&&(
          <div>
            <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"16px"}}>
              <h2 style={{color:C.red,margin:0}}>🔴 Quarantine</h2>
              <span style={{background:"#ffe5e5",color:C.red,padding:"4px 10px",borderRadius:"20px",fontSize:"12px",fontWeight:"700"}}>GM ONLY</span>
            </div>
            <div style={card}>
              <QuarantinePanel staff={staff} ghList={ghList} quarantine={quarantine} setQuarantine={setQuarantine} quarantineHistory={quarantineHistory} setQuarantineHistory={setQuarantineHistory} schedule={schedule} btn={btn} inp={inp} C={C} API={API} adelaideTime={adelaideTime} fmtISOReadable={fmtISOReadable} role={role}/>
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
// DEMAND PAGE — day-by-day entry per GH per crop per activity
// ═══════════════════════════════════════════════════════════════════════════════
function DemandPage({ghList,activities,cropTypes,demand,setDemand,cycles,setCycles,activeCycleId,setActiveCycleId,activeWeekIndex,setActiveWeekIndex,totalCapacity,generating,generateSchedule,setScheduleStale,btn,inp,card,C}){
  const fmtD=(iso)=>{if(!iso)return"";const d=new Date(iso);return d.toLocaleDateString("en-AU",{day:"2-digit",month:"short",year:"numeric"});};
  const addD=(iso,n)=>{const d=new Date(iso);d.setDate(d.getDate()+n);return d.toISOString().split("T")[0];};
  const ALL_DAYS_D=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  const DAY_SHORT_D={"Monday":"Mon","Tuesday":"Tue","Wednesday":"Wed","Thursday":"Thu","Friday":"Fri","Saturday":"Sat","Sunday":"Sun"};

  const [newCycleName,setNewCycleName]=useState("Cycle 1");
  const [newCycleStart,setNewCycleStart]=useState(new Date().toISOString().split("T")[0]);
  const [newCycleActivationDate,setNewCycleActivationDate]=useState("");

  const createCycle=()=>{
    const start=newCycleStart;
    const cycle={
      id:`cycle_${Date.now()}`,name:newCycleName,status:"active",
      activationDate:newCycleActivationDate||null,
      weeks:[0,1,2].map(i=>({weekIndex:i,label:`Week ${i+1}`,startDate:addD(start,i*7),endDate:addD(start,i*7+6),ghCrops:{},demand:{}}))
    };
    const updated=[...cycles,cycle];
    setCycles(updated);setActiveCycleId(cycle.id);
    setDemand(prev=>({...prev,__cycles:updated}));
  };

  const carryForward=()=>{
    if(!activeCycle)return;
    if(!window.confirm("Copy this cycle's demand into a new cycle?"))return;
    const lastEnd=activeCycle.weeks[2].endDate;
    const newStart=addD(lastEnd,1);
    const newCycle={
      id:`cycle_${Date.now()}`,
      name:`Cycle ${cycles.length+1}`,status:"draft",
      activationDate:newStart,
      weeks:[0,1,2].map(i=>({
        weekIndex:i,label:`Week ${i+1}`,
        startDate:addD(newStart,i*7),endDate:addD(newStart,i*7+6),
        ghCrops:JSON.parse(JSON.stringify(activeCycle.weeks[i]?.ghCrops||{})),
        demand:JSON.parse(JSON.stringify(activeCycle.weeks[i]?.demand||{}))
      }))
    };
    const updated=[...cycles,newCycle];
    setCycles(updated);setActiveCycleId(newCycle.id);setActiveWeekIndex(0);
    setDemand(prev=>({...prev,__cycles:updated}));
  };

  const activeCycle=cycles.find(c=>c.id===activeCycleId)||cycles[0]||null;
  const activeWeek=activeCycle?.weeks?.[activeWeekIndex]||null;

  const canActivateCycle=(cy)=>{
    if(!cy.activationDate)return true;
    return new Date()>=new Date(cy.activationDate);
  };

  // demand structure: { ghName: { cropType: { activity: { day: hours } } } }
  const getWeekDemand=()=>activeWeek?.demand||{};

  const setDayVal=(ghName,cropType,activity,day,val)=>{
    const updated=cycles.map(cy=>cy.id===activeCycle.id?{...cy,weeks:cy.weeks.map((w,wi)=>{
      if(wi!==activeWeekIndex)return w;
      const d=JSON.parse(JSON.stringify(w.demand||{}));
      if(!d[ghName])d[ghName]={};
      if(!d[ghName][cropType])d[ghName][cropType]={};
      if(!d[ghName][cropType][activity])d[ghName][cropType][activity]={};
      d[ghName][cropType][activity][day]=val;
      return{...w,demand:d};
    })}:cy);
    setCycles(updated);
    // Flatten for optimiser: sum across days per gh/crop/activity
    const wd=updated.find(cy=>cy.id===activeCycleId)?.weeks[activeWeekIndex]?.demand||{};
    const flatDemand={};
    Object.entries(wd).forEach(([gh,cropRows])=>{
      flatDemand[gh]={};
      Object.entries(cropRows).forEach(([,acts])=>Object.entries(acts).forEach(([act,days])=>{
        const total=Object.values(days).reduce((s,h)=>s+(parseInt(h)||0),0);
        flatDemand[gh][act]=(flatDemand[gh][act]||0)+total;
      }));
    });
    setDemand(prev=>({...prev,...flatDemand,__cycles:updated}));
    setScheduleStale(true);
  };

  const wd=getWeekDemand();

  // Week total
  const weekTotal=Object.values(wd).reduce((s1,cropRows)=>s1+Object.values(cropRows).reduce((s2,acts)=>s2+Object.values(acts).reduce((s3,days)=>s3+Object.values(days).reduce((s4,h)=>s4+(parseInt(h)||0),0),0),0),0);

  // Build week day dates for header
  const weekDates={};
  if(activeWeek?.startDate){ALL_DAYS_D.forEach((day,i)=>{const d=new Date(activeWeek.startDate);d.setDate(d.getDate()+i);weekDates[day]=d.toLocaleDateString("en-AU",{day:"2-digit",month:"short"});});}

  const handleGenerate=()=>{
    // Build flat demand and cropDemand for optimiser
    const flat={};
    const cropDemand={};
    Object.entries(wd).forEach(([gh,cropRows])=>{
      flat[gh]={};
      cropDemand[gh]={};
      Object.entries(cropRows).forEach(([ct,acts])=>{
        cropDemand[gh][ct]={};
        Object.entries(acts).forEach(([act,days])=>{
          const total=Object.values(days).reduce((s,h)=>s+(parseInt(h)||0),0);
          flat[gh][act]=(flat[gh][act]||0)+total;
          cropDemand[gh][ct][act]=total;
        });
      });
    });
    generateSchedule(flat,cropDemand);
  };

  // Get GH crops for a specific GH from the ghCrops setting in this week
  const getGhCrops=(ghName)=>activeWeek?.ghCrops?.[ghName]||[];
  const setGhCrops=(ghName,crops)=>{
    const updated=cycles.map(cy=>cy.id===activeCycle.id?{...cy,weeks:cy.weeks.map((w,wi)=>wi===activeWeekIndex?{...w,ghCrops:{...w.ghCrops,[ghName]:crops}}:w)}:cy);
    setCycles(updated);setDemand(prev=>({...prev,__cycles:updated}));
  };

  if(!cycles.length||!activeCycle)return(
    <div>
      <h2 style={{color:C.navy,marginBottom:"16px"}}>📋 Demand Planning</h2>
      <div style={card}>
        <h4 style={{color:C.navy,marginBottom:"16px"}}>Create Your First Planning Cycle</h4>
        <p style={{color:C.textMid,fontSize:"13px",marginBottom:"16px"}}>A planning cycle covers 3 weeks. Enter the cycle name and start date.</p>
        <div style={{display:"flex",gap:"12px",flexWrap:"wrap",alignItems:"flex-end"}}>
          <div><label style={{display:"block",fontSize:"13px",color:C.textMid,marginBottom:"4px"}}>Cycle Name:</label><input value={newCycleName} onChange={e=>setNewCycleName(e.target.value)} style={{...inp,width:"160px"}} placeholder="Cycle 1"/></div>
          <div><label style={{display:"block",fontSize:"13px",color:C.textMid,marginBottom:"4px"}}>Start Date:</label><input type="date" value={newCycleStart} onChange={e=>setNewCycleStart(e.target.value)} style={inp}/></div>
          <div><label style={{display:"block",fontSize:"13px",color:C.textMid,marginBottom:"4px"}}>Activation Date (optional):</label><input type="date" value={newCycleActivationDate} onChange={e=>setNewCycleActivationDate(e.target.value)} style={inp}/></div>
          <button onClick={createCycle} style={{...btn(false,C.green),padding:"9px 20px"}}>🚀 Create Cycle</button>
        </div>
      </div>
    </div>
  );

  return(
    <div>
      <h2 style={{color:C.navy,marginBottom:"16px"}}>📋 Demand Planning</h2>

      {/* Cycle tabs */}
      <div style={{...card,padding:"12px",marginBottom:"12px"}}>
        <div style={{display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"}}>
          <span style={{fontWeight:"700",color:C.navy,fontSize:"13px",marginRight:"4px"}}>Cycle:</span>
          {cycles.map((cy)=>{
            const locked=cy.status==="draft"&&cy.activationDate&&!canActivateCycle(cy);
            return(
              <button key={cy.id} onClick={()=>{setActiveCycleId(cy.id);setActiveWeekIndex(0);}}
                style={{padding:"6px 14px",background:cy.id===activeCycleId?C.navy:"white",color:cy.id===activeCycleId?"white":C.textMid,border:`2px solid ${cy.id===activeCycleId?C.navy:C.border}`,borderRadius:"6px",cursor:"pointer",fontSize:"12px",fontWeight:"600"}}>
                {cy.name}
                <span style={{marginLeft:"6px",fontSize:"10px",opacity:0.7}}>[{cy.status}]</span>
                {locked&&<span style={{marginLeft:"4px",fontSize:"10px",color:C.gold}}>🔒</span>}
              </button>
            );
          })}
          <button onClick={()=>{const nm=window.prompt("New cycle name:",`Cycle ${cycles.length+1}`);if(!nm)return;const sd=window.prompt("Start date (YYYY-MM-DD):",addD(activeCycle.weeks[2].endDate,1));if(!sd)return;const ad=window.prompt("Activation date lock (YYYY-MM-DD, optional):",addD(activeCycle.weeks[2].endDate,1));const nc={id:`cycle_${Date.now()}`,name:nm,status:"draft",activationDate:ad||null,weeks:[0,1,2].map(i=>({weekIndex:i,label:`Week ${i+1}`,startDate:addD(sd,i*7),endDate:addD(sd,i*7+6),ghCrops:{},demand:{}}))};const upd=[...cycles,nc];setCycles(upd);setActiveCycleId(nc.id);setActiveWeekIndex(0);setDemand(prev=>({...prev,__cycles:upd}));}} style={{...btn(false,C.teal),fontSize:"12px",padding:"6px 12px"}}>+ New Cycle</button>
          <button onClick={carryForward} style={{...btn(false,C.blue),fontSize:"12px",padding:"6px 12px"}}>⏩ Carry Forward</button>
          {activeCycle?.activationDate&&(
            <span style={{fontSize:"11px",color:canActivateCycle(activeCycle)?C.green:C.gold,marginLeft:"8px"}}>
              {canActivateCycle(activeCycle)?"✅ Can activate":"🔒 Activates: "+new Date(activeCycle.activationDate).toLocaleDateString("en-AU")}
            </span>
          )}
        </div>
      </div>

      {/* Week tabs */}
      <div style={{display:"flex",gap:"8px",marginBottom:"16px"}}>
        {activeCycle.weeks.map((w,wi)=>(
          <button key={wi} onClick={()=>setActiveWeekIndex(wi)}
            style={{padding:"10px 20px",background:activeWeekIndex===wi?C.teal:"white",color:activeWeekIndex===wi?"white":C.textMid,border:`2px solid ${activeWeekIndex===wi?C.teal:C.border}`,borderRadius:"8px",cursor:"pointer",fontSize:"13px",fontWeight:"600",flex:1}}>
            <div>{w.label}</div>
            <div style={{fontSize:"11px",opacity:0.8,marginTop:"2px"}}>{fmtD(w.startDate)} — {fmtD(w.endDate)}</div>
          </button>
        ))}
      </div>

      {/* Demand grid */}
      <div style={card}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px",flexWrap:"wrap",gap:"8px"}}>
          <div>
            <h4 style={{color:C.navy,margin:"0 0 4px 0"}}>{activeCycle.name} — {activeWeek?.label}</h4>
            <span style={{fontSize:"12px",color:C.textLight}}>{fmtD(activeWeek?.startDate)} to {fmtD(activeWeek?.endDate)}</span>
          </div>
          <span style={{fontSize:"13px",color:C.textMid}}>Week total: <strong style={{color:weekTotal>totalCapacity?C.red:C.navy}}>{weekTotal}h</strong> / Capacity: <strong style={{color:C.green}}>{totalCapacity}h</strong></span>
        </div>

        {/* Per-GH demand entry */}
        {ghList.map((gh)=>{
          const ghName=gh.name;
          const selectedCrops=getGhCrops(ghName);
          const ghDemand=wd[ghName]||{};

          return(
            <div key={ghName} style={{marginBottom:"20px",border:`1px solid ${C.border}`,borderRadius:"8px",overflow:"hidden"}}>

              {/* GH header — crop selection */}
              <div style={{background:C.navy,padding:"8px 12px",display:"flex",alignItems:"center",gap:"12px",flexWrap:"wrap"}}>
                <span style={{color:"white",fontWeight:"700",fontSize:"13px",minWidth:"120px"}}>{ghName}</span>
                <span style={{color:"rgba(255,255,255,0.7)",fontSize:"11px"}}>Crops this week:</span>
                <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                  {cropTypes.map(ct=>(
                    <label key={ct} style={{display:"flex",alignItems:"center",gap:"4px",background:selectedCrops.includes(ct)?"rgba(46,204,113,0.3)":"rgba(255,255,255,0.1)",padding:"3px 8px",borderRadius:"4px",cursor:"pointer",border:`1px solid ${selectedCrops.includes(ct)?"#2ecc71":"rgba(255,255,255,0.2)"}`,fontSize:"11px",color:"white"}}>
                      <input type="checkbox" checked={selectedCrops.includes(ct)} onChange={e=>{const crops=e.target.checked?[...selectedCrops,ct]:selectedCrops.filter(c=>c!==ct);setGhCrops(ghName,crops);}} style={{accentColor:C.green}}/>{ct}
                    </label>
                  ))}
                </div>
              </div>

              {selectedCrops.length===0?(
                <div style={{padding:"10px 14px",background:"#fafafa",fontSize:"12px",color:C.textLight,fontStyle:"italic"}}>Select crop types above to enter demand hours.</div>
              ):(
                <div style={{overflowX:"auto"}}>
                  {selectedCrops.map((ct,ci)=>{
                    const ctDemand=ghDemand[ct]||{};
                    // Calc row total across all activities and days
                    const ctTotal=activities.reduce((s,act)=>s+ALL_DAYS_D.reduce((sd,day)=>sd+(parseInt(ctDemand[act]?.[day])||0),0),0);
                    return(
                      <div key={ct} style={{borderTop:ci>0?`1px solid ${C.border}`:"none"}}>
                        {/* Crop sub-header */}
                        <div style={{background:"#eaf4fb",padding:"6px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <span style={{fontWeight:"700",color:C.teal,fontSize:"12px"}}>🌱 {ct}</span>
                          <span style={{fontSize:"11px",color:C.textMid}}>Total: <strong style={{color:ctTotal>0?C.navy:C.textLight}}>{ctTotal||0}h</strong></span>
                        </div>

                        {/* Per-activity day grid */}
                        <table style={{borderCollapse:"collapse",fontSize:"11px",width:"100%"}}>
                          <thead>
                            <tr style={{background:"#f5f7fa"}}>
                              <th style={{padding:"5px 12px",textAlign:"left",fontSize:"11px",color:C.navy,fontWeight:"700",minWidth:"150px",borderBottom:`1px solid ${C.border}`}}>Activity</th>
                              {ALL_DAYS_D.map(day=>(
                                <th key={day} style={{padding:"4px 3px",textAlign:"center",fontSize:"10px",color:["Saturday","Sunday"].includes(day)?C.orange:C.textMid,minWidth:"52px",borderBottom:`1px solid ${C.border}`,fontWeight:"600"}}>
                                  {DAY_SHORT_D[day]}
                                  {weekDates[day]&&<div style={{fontSize:"9px",color:C.textLight,fontWeight:"400"}}>{weekDates[day]}</div>}
                                </th>
                              ))}
                              <th style={{padding:"4px 8px",textAlign:"center",fontSize:"11px",color:C.navy,fontWeight:"700",borderBottom:`1px solid ${C.border}`}}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activities.map((activity,ai)=>{
                              const actDays=ctDemand[activity]||{};
                              const actTotal=ALL_DAYS_D.reduce((s,day)=>s+(parseInt(actDays[day])||0),0);
                              return(
                                <tr key={activity} style={{background:ai%2===0?"white":C.light}}>
                                  <td style={{padding:"4px 12px",fontWeight:"500",color:C.textDark,fontSize:"11px",borderRight:`1px solid ${C.border}`}}>{activity}</td>
                                  {ALL_DAYS_D.map(day=>(
                                    <td key={day} style={{padding:"2px",textAlign:"center",background:["Saturday","Sunday"].includes(day)?"#fffbf5":"inherit"}}>
                                      <input type="number" min="0" max="99"
                                        value={actDays[day]||""}
                                        onChange={e=>setDayVal(ghName,ct,activity,day,parseInt(e.target.value)||0)}
                                        style={{width:"44px",padding:"2px",border:`1px solid ${C.border}`,borderRadius:"3px",textAlign:"center",fontSize:"11px",background:["Saturday","Sunday"].includes(day)?"#fff8f0":"white"}}/>
                                    </td>
                                  ))}
                                  <td style={{padding:"4px 8px",textAlign:"center",fontWeight:"700",color:actTotal>0?C.navy:C.textLight,fontSize:"11px"}}>{actTotal||"—"}</td>
                                </tr>
                              );
                            })}
                            {/* Crop subtotal row */}
                            <tr style={{background:"#eaf4fb",borderTop:`2px solid ${C.border}`}}>
                              <td style={{padding:"5px 12px",fontWeight:"700",color:C.navy,fontSize:"11px"}}>Daily Total</td>
                              {ALL_DAYS_D.map(day=>{
                                const dayTotal=activities.reduce((s,act)=>s+(parseInt(ctDemand[act]?.[day])||0),0);
                                return <td key={day} style={{padding:"4px 3px",textAlign:"center",fontSize:"11px",fontWeight:dayTotal>0?"700":"400",color:dayTotal>0?C.navy:C.textLight}}>{dayTotal||""}</td>;
                              })}
                              <td style={{padding:"5px 8px",textAlign:"center",fontWeight:"700",color:C.navy,fontSize:"11px"}}>{ctTotal}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <div style={{marginTop:"16px",display:"flex",gap:"10px",alignItems:"center",flexWrap:"wrap"}}>
          <button onClick={handleGenerate} disabled={generating} style={{...btn(false,C.green),padding:"11px 26px",fontSize:"14px",opacity:generating?0.7:1}}>{generating?"⏳ Optimising...":"🚀 Generate Optimised Plan"}</button>
          <button onClick={()=>{if(window.confirm("Clear all demand for this week?")){const updated=cycles.map(cy=>cy.id===activeCycleId?{...cy,weeks:cy.weeks.map((w,wi)=>wi===activeWeekIndex?{...w,demand:{}}:w)}:cy);setCycles(updated);setDemand(prev=>({...prev,__cycles:updated}));}}} style={btn(false,C.red)}>🗑️ Clear This Week</button>
        </div>
      </div>
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
        const entries=res.data.entries.map(e=>({...e,ratePerHour:defaultRate?parseFloat(defaultRate):null,estimatedCost:defaultRate&&e.hours?parseFloat(defaultRate)*e.hours:null,source:"system",id:`ot_${Date.now()}_${Math.random()}`}));
        setOvertimeEntries(entries);
        if(entries.length===0)alert("No unassigned hours found — no overtime needed.");
      }
    }catch(e){alert("Error: "+e.message);}
    setGenerating(false);
  };

  const deleteEntry=(id)=>{
    const updated=overtimeEntries.filter(e=>e.id!==id);
    setOvertimeEntries(updated);
    rebuildScheduleFromOT(updated);
  };

  const updateEntry=(id,changes)=>{
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
          <div style={{display:"flex",gap:"24px",flexWrap:"wrap",fontSize:"13px"}}>
            <span>⏱️ <strong>Total OT Hours:</strong> {totalOTHours.toFixed(1)}h</span>
            <span>👥 <strong>Staff on OT:</strong> {new Set(overtimeEntries.map(e=>e.staffId)).size}</span>
            {totalCost>0&&<span>💰 <strong>Estimated Cost:</strong> ${totalCost.toFixed(2)}</span>}
          </div>
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
              <div><label style={{fontSize:"12px",color:C.textMid,display:"block",marginBottom:"3px"}}>Staff:</label>
                <select value={manualEntry.staffId} onChange={e=>{setManualEntry(p=>({...p,staffId:e.target.value}));checkManualEligibility(e.target.value,manualEntry.greenhouse,manualEntry.activity);}} style={{...inp,width:"100%"}}>
                  <option value="">— Select —</option>
                  {staff.map(s=>{const otUsed=getStaffOTHoursUsed(s.id);const cap=s.overtimeLimit??30;return <option key={s.id} value={s.id}>{s.name} ({s.id}) — OT: {otUsed.toFixed(1)}/{cap}h</option>;})}
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
                <tr key={e.id} style={{background:e.source==="manual"?"#fdf4ff":i%2===0?C.light:C.white}}>
                  <td style={{padding:"8px"}}><strong>{e.staffName}</strong><br/><span style={{fontFamily:"monospace",fontSize:"11px",color:C.textLight}}>{e.staffId}</span>{e.gmOverride&&<span style={{display:"block",fontSize:"10px",color:C.orange}}>⚠️ GM Override</span>}</td>
                  <td style={{padding:"8px"}}>{e.day}</td>
                  <td style={{padding:"8px"}}>{e.greenhouse}</td>
                  <td style={{padding:"8px"}}>{e.activity}</td>
                  <td style={{padding:"8px",textAlign:"center"}}>{role==="gm"?<input type="number" min="0" max="24" value={e.hours} onChange={ev=>updateEntry(e.id,{hours:parseFloat(ev.target.value)||0})} style={{width:"55px",padding:"3px",border:`1px solid ${C.border}`,borderRadius:"4px",textAlign:"center",fontSize:"12px"}}/>:<span>{e.hours}h</span>}</td>
                  <td style={{padding:"8px",textAlign:"center"}}>{role==="gm"?<input type="number" min="0" value={e.ratePerHour||""} onChange={ev=>updateEntry(e.id,{ratePerHour:parseFloat(ev.target.value)||null})} style={{width:"65px",padding:"3px",border:`1px solid ${C.border}`,borderRadius:"4px",textAlign:"center",fontSize:"12px"}} placeholder="—"/>:<span>{e.ratePerHour?`$${e.ratePerHour}`:"—"}</span>}</td>
                  <td style={{padding:"8px",textAlign:"center",fontWeight:"600",color:e.estimatedCost?C.navy:C.textLight}}>{e.estimatedCost?`$${e.estimatedCost.toFixed(2)}`:"—"}</td>
                  <td style={{padding:"8px",textAlign:"center"}}><span style={{background:e.source==="manual"?"#f0e6ff":"#e8f4fd",color:e.source==="manual"?C.purple:C.blue,padding:"2px 8px",borderRadius:"10px",fontSize:"11px",fontWeight:"600"}}>{e.source==="manual"?"Manual ★":"System"}</span></td>
                  {role==="gm"&&<td style={{padding:"8px",textAlign:"center"}}><button onClick={()=>deleteEntry(e.id)} style={{...btn(false,C.red),padding:"4px 8px",fontSize:"11px"}}>🗑️</button></td>}
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
function QuarantinePanel({staff,ghList,quarantine,setQuarantine,quarantineHistory,setQuarantineHistory,schedule,btn,inp,C,API,adelaideTime,fmtISOReadable,role}){
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

  const removeEvent=async(id)=>{
    if(!window.confirm("Remove this quarantine event early?"))return;
    try{
      await axios.delete(`${API}/quarantine/${id}`);
      const removed=quarantine.find(e=>e.id===id);
      if(removed)setQuarantineHistory([{...removed,closedEarly:true,closedAt:new Date().toISOString()},...quarantineHistory]);
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

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"20px",marginBottom:"24px"}}>
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
      </div>

      {/* Active events */}
      {quarantine.length>0&&(
        <div style={{marginBottom:"20px"}}>
          <h4 style={{color:C.navy,marginBottom:"12px"}}>Active Quarantine Orders ({quarantine.length})</h4>
          {quarantine.map(ev=>{
            const isTypeA=ev.quarantineType==="A"||!ev.quarantineType;
            const color=isTypeA?C.red:C.purple;
            const staffNames=ev.staffIds?.map(id=>staff.find(s=>s.id===id)?.name||id)||[];
            const daysLeft=getDaysRemaining(ev);
            const isRedundant=checkRedundant(ev);
            const totalDays=(ev.daysLocked||7)+(ev.extensionDays||0);
            return(
              <div key={ev.id} style={{border:`1px solid ${color}33`,borderLeft:`4px solid ${color}`,borderRadius:"8px",padding:"14px",marginBottom:"10px",background:isTypeA?"#fff8f8":"#fdf8ff"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"12px"}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"6px",flexWrap:"wrap"}}>
                      <span style={{background:color,color:"white",padding:"2px 10px",borderRadius:"10px",fontSize:"11px",fontWeight:"700"}}>{isTypeA?"Type A — GH Lock":"Type B — Individual"}</span>
                      <strong style={{color,fontSize:"14px"}}>{ev.greenhouseId}</strong>
                      <span style={{fontSize:"13px",color:C.textMid}}>{totalDays} days total {ev.extensionDays>0?`(+${ev.extensionDays} extended)`:""}</span>
                      <span style={{background:daysLeft<=2?"#ffe5e5":daysLeft<=5?"#fff8ee":"#eafaf1",color:daysLeft<=2?C.red:daysLeft<=5?C.orange:C.green,padding:"2px 8px",borderRadius:"10px",fontSize:"11px",fontWeight:"700"}}>{daysLeft}d left</span>
                      {isRedundant&&<span style={{background:"#fff8ee",color:C.gold,padding:"2px 8px",borderRadius:"10px",fontSize:"11px"}}>⚠️ Redundant with Type A</span>}
                    </div>
                    <div style={{fontSize:"12px",color:C.textMid,marginBottom:"4px"}}><strong>{staffNames.length} staff:</strong> {staffNames.length>0?staffNames.join(", "):"None"}</div>
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
                const color=isTypeA?"#e74c3c":"#8e44ad";
                const staffNames=ev.staffIds?.map(id=>staff.find(s=>s.id===id)?.name||id)||[];
                return(
                  <div key={ev.id||i} style={{borderLeft:`3px solid ${color}88`,padding:"8px 12px",marginBottom:"8px",background:"white",borderRadius:"4px",opacity:0.75}}>
                    <div style={{display:"flex",gap:"8px",alignItems:"center",flexWrap:"wrap",marginBottom:"4px"}}>
                      <span style={{background:`${color}22`,color,padding:"2px 8px",borderRadius:"8px",fontSize:"11px",fontWeight:"700"}}>{isTypeA?"Type A":"Type B"}</span>
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
      if(d.data.staff?.length>0){setStaff(d.data.staff);setBackupReminder(true);}
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
// STAFF PROFILE POPUP
// ═══════════════════════════════════════════════════════════════════════════════
function StaffProfilePopup({selectedStaff,setSelectedStaff,staff,setStaff,activities,ghNames,ghList,cropTypes,absences,calcVersatility,btn,inp,C,ALL_DAYS,DAY_SHORT,setBackupReminder}){
  const [expandedAct,setExpandedAct]=useState(null);
  const update=(updates)=>{const u={...selectedStaff,...updates};setSelectedStaff(u);setStaff(staff.map(s=>s.id===selectedStaff.id?u:s));setBackupReminder(true);};

  // Migrate old flat model to new per-GH model on the fly
  const migrateActObj=(a)=>{
    if(typeof a==="string")return{activity:a,allGreenhouses:true,greenhouses:[...ghNames],ghCropTypes:{}};
    // old model had flat cropTypes — migrate to ghCropTypes
    if(a.cropTypes&&!a.ghCropTypes){
      const ghCropTypes={};
      (a.allGreenhouses?ghNames:a.greenhouses||[]).forEach(gh=>{ghCropTypes[gh]=[...a.cropTypes];});
      return{...a,ghCropTypes,cropTypes:undefined};
    }
    if(!a.ghCropTypes)return{...a,ghCropTypes:{}};
    return a;
  };

  const staffActs=(selectedStaff.activities||[]).map(migrateActObj);
  const hasActivity=(actName)=>staffActs.some(a=>a.activity===actName);

  const toggleActivity=(actName,checked)=>{
    // When adding: default all GHs, and for each GH default all its crops
    const defaultGhCropTypes={};
    ghNames.forEach(gh=>{
      const ghObj=ghList.find(g=>g.name===gh);
      defaultGhCropTypes[gh]=[...(ghObj?.cropTypes||cropTypes)];
    });
    const newActs=checked
      ?[...staffActs,{activity:actName,allGreenhouses:true,greenhouses:[...ghNames],ghCropTypes:defaultGhCropTypes}]
      :staffActs.filter(a=>a.activity!==actName);
    if(!checked&&expandedAct===actName)setExpandedAct(null);
    update({activities:newActs});
  };

  const updateActObj=(actName,changes)=>update({activities:staffActs.map(a=>a.activity===actName?{...a,...changes}:a)});
  const getActObj=(actName)=>staffActs.find(a=>a.activity===actName)||null;

  // Get crops for a specific GH under an activity
  const getGhCrops=(actObj,gh)=>actObj.ghCropTypes?.[gh]??[];
  const setGhCrops=(actName,gh,crops)=>{
    const actObj=getActObj(actName);
    if(!actObj)return;
    updateActObj(actName,{ghCropTypes:{...actObj.ghCropTypes,[gh]:crops}});
  };

  // Which GHs are active for this activity
  const getActiveGHs=(actObj)=>actObj.allGreenhouses?ghNames:(actObj.greenhouses||[]);

  // Summary for display
  const actSummary=(actObj)=>{
    const ghs=getActiveGHs(actObj);
    const totalCrops=new Set(ghs.flatMap(gh=>getGhCrops(actObj,gh))).size;
    return`${actObj.allGreenhouses?"All GHs":`${ghs.length} GHs`} · ${totalCrops} crops`;
  };

  const v=calcVersatility(selectedStaff);
  const absCount=ALL_DAYS.filter(d=>{const al=absences[d]||[];return al.includes(selectedStaff.id)||al.some(x=>typeof x==="object"&&x.id===selectedStaff.id&&x.hours===0);}).length;

  return(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
      <div style={{background:"white",borderRadius:"14px",padding:"28px",maxWidth:"900px",width:"95%",maxHeight:"92vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"20px"}}>
          <div><h2 style={{color:C.navy,margin:"0 0 4px 0"}}>{selectedStaff.name}</h2><span style={{fontFamily:"monospace",color:C.textLight,fontSize:"13px"}}>{selectedStaff.id}</span></div>
          <button onClick={()=>setSelectedStaff(null)} style={btn(false,C.red)}>✕ Close</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"10px",marginBottom:"22px"}}>
          {[[v+"%","Versatility",C.blue,"#eaf2ff"],[absCount,"Absent Days",C.red,"#fdf2f2"],[selectedStaff.hoursPerDay??7,"Default Hrs/Day",C.green,"#f0fff4"],[selectedStaff.overtimeLimit??30,"OT Limit/Wk",C.purple,"#f8f4ff"]].map(([val,label,color,bg])=>(
            <div key={label} style={{background:bg,padding:"12px",borderRadius:"8px",textAlign:"center"}}><div style={{fontSize:"22px",fontWeight:"800",color}}>{val}</div><div style={{fontSize:"11px",color:C.textLight,marginTop:"2px"}}>{label}</div></div>
          ))}
        </div>
        <div style={{marginBottom:"20px",padding:"14px",background:"#fafafa",borderRadius:"8px",border:`1px solid ${C.border}`}}>
          <h4 style={{color:C.navy,margin:"0 0 10px 0",fontSize:"14px"}}>✏️ Name, ID & Settings</h4>
          <div style={{display:"flex",gap:"10px",flexWrap:"wrap",marginBottom:"10px"}}>
            <input value={selectedStaff.id} onChange={e=>update({id:e.target.value})} style={{...inp,flex:1,minWidth:"100px"}} placeholder="Staff ID"/>
            <input value={selectedStaff.name} onChange={e=>update({name:e.target.value})} style={{...inp,flex:2,minWidth:"150px"}} placeholder="Full Name"/>
          </div>
          <div style={{display:"flex",gap:"16px",flexWrap:"wrap"}}>
            <div style={{display:"flex",alignItems:"center",gap:"6px"}}><label style={{fontSize:"13px",color:C.textMid}}>Default hrs/day:</label><input type="number" min="0" max="16" value={selectedStaff.hoursPerDay??7} onChange={e=>update({hoursPerDay:parseInt(e.target.value)||0})} style={{...inp,width:"55px",textAlign:"center"}}/></div>
            <div style={{display:"flex",alignItems:"center",gap:"6px"}}><label style={{fontSize:"13px",color:C.textMid}}>OT limit/week:</label><input type="number" min="0" max="80" value={selectedStaff.overtimeLimit??30} onChange={e=>update({overtimeLimit:parseInt(e.target.value)||0})} style={{...inp,width:"55px",textAlign:"center"}}/></div>
          </div>
        </div>
        <div style={{marginBottom:"20px"}}>
          <h4 style={{color:C.navy,marginBottom:"10px",fontSize:"14px"}}>🕐 Hours Per Day (7-day week)</h4>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"8px"}}>
            {ALL_DAYS.map(day=>{const isWE=["Saturday","Sunday"].includes(day);return(
              <div key={day} style={{textAlign:"center"}}>
                <div style={{fontSize:"11px",color:isWE?C.orange:C.textMid,marginBottom:"4px",fontWeight:isWE?"700":"400"}}>{DAY_SHORT[day]}</div>
                <input type="number" min="0" max="16" value={selectedStaff.dayHours?.[day]??(isWE?0:selectedStaff.hoursPerDay??7)}
                  onChange={e=>update({dayHours:{...(selectedStaff.dayHours||{}),[day]:parseInt(e.target.value)||0}})}
                  style={{...inp,width:"100%",textAlign:"center",background:isWE?"#fff8f0":"white",borderColor:isWE?C.orange:C.border}}/>
              </div>
            );})}
          </div>
          <p style={{color:C.textLight,fontSize:"12px",marginTop:"8px"}}>Set 0 for days not worked. Use Absence tab for one-off weekly changes.</p>
        </div>

        {/* ── Activities with per-GH crop types ── */}
        <div style={{marginBottom:"20px"}}>
          <h4 style={{color:C.navy,marginBottom:"4px",fontSize:"14px"}}>⚙️ Activities, Greenhouses & Crop Types</h4>
          <p style={{color:C.textMid,fontSize:"12px",marginBottom:"12px"}}>
            Tick an activity → choose which greenhouses → for each greenhouse choose which crop types. By default all greenhouses and all crops are selected.
          </p>
          <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
            {activities.map(actName=>{
              const isChecked=hasActivity(actName);
              const actObj=getActObj(actName);
              const isExpanded=expandedAct===actName&&isChecked;
              const activeGHs=actObj?getActiveGHs(actObj):[];
              return(
                <div key={actName} style={{border:`1px solid ${isChecked?C.teal:C.border}`,borderRadius:"8px",overflow:"hidden",background:isChecked?"#f0fdfb":"#fafafa"}}>
                  {/* Activity row */}
                  <div style={{display:"flex",alignItems:"center",gap:"10px",padding:"10px 14px"}}>
                    <input type="checkbox" checked={isChecked} onChange={e=>toggleActivity(actName,e.target.checked)} style={{width:"16px",height:"16px",cursor:"pointer",accentColor:C.teal}}/>
                    <span style={{flex:1,fontSize:"13px",fontWeight:isChecked?"600":"400",color:isChecked?C.navy:C.textMid}}>{actName}</span>
                    {isChecked&&actObj&&<span style={{fontSize:"11px",color:C.textLight}}>{actSummary(actObj)}</span>}
                    {isChecked&&<button onClick={()=>setExpandedAct(isExpanded?null:actName)} style={{background:"none",border:`1px solid ${C.teal}`,color:C.teal,borderRadius:"4px",padding:"2px 10px",cursor:"pointer",fontSize:"12px"}}>{isExpanded?"▲ Hide":"▼ Configure"}</button>}
                  </div>

                  {/* Expanded config */}
                  {isExpanded&&actObj&&(
                    <div style={{borderTop:"1px solid #c8ede8",padding:"14px",background:"white"}}>

                      {/* Step 1: Greenhouse selection */}
                      <div style={{marginBottom:"16px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"10px"}}>
                          <span style={{fontSize:"13px",fontWeight:"700",color:C.navy}}>Step 1 — Greenhouses:</span>
                          <label style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"13px",cursor:"pointer",background:actObj.allGreenhouses?"#e8fdf5":"#f8f9fa",padding:"4px 10px",borderRadius:"6px",border:`1px solid ${actObj.allGreenhouses?C.teal:C.border}`}}>
                            <input type="checkbox" checked={actObj.allGreenhouses}
                              onChange={e=>{
                                const allGH=e.target.checked;
                                const newGHs=allGH?[...ghNames]:actObj.greenhouses||[];
                                // When switching to all, seed ghCropTypes for any missing GHs
                                const newGhCropTypes={...actObj.ghCropTypes};
                                if(allGH){
                                  ghNames.forEach(gh=>{
                                    if(!newGhCropTypes[gh]){
                                      const ghObj=ghList.find(g=>g.name===gh);
                                      newGhCropTypes[gh]=[...(ghObj?.cropTypes||cropTypes)];
                                    }
                                  });
                                }
                                updateActObj(actName,{allGreenhouses:allGH,greenhouses:newGHs,ghCropTypes:newGhCropTypes});
                              }}
                              style={{accentColor:C.teal}}/>
                            <span style={{fontWeight:"600",color:actObj.allGreenhouses?C.teal:C.textMid}}>All Greenhouses</span>
                          </label>
                        </div>
                        {!actObj.allGreenhouses&&(
                          <div style={{display:"flex",flexWrap:"wrap",gap:"5px"}}>
                            {ghNames.map(gh=>{
                              const selected=(actObj.greenhouses||[]).includes(gh);
                              return(
                                <label key={gh} style={{display:"flex",alignItems:"center",gap:"4px",background:selected?"#d5f0ff":"white",padding:"5px 10px",borderRadius:"6px",cursor:"pointer",border:`1px solid ${selected?C.blue:C.border}`,fontSize:"12px",fontWeight:selected?"600":"400"}}>
                                  <input type="checkbox" checked={selected}
                                    onChange={e=>{
                                      const ghs=actObj.greenhouses||[];
                                      const newGHs=e.target.checked?[...ghs,gh]:ghs.filter(g=>g!==gh);
                                      // Seed crops for newly added GH
                                      const newGhCropTypes={...actObj.ghCropTypes};
                                      if(e.target.checked&&!newGhCropTypes[gh]){
                                        const ghObj=ghList.find(g=>g.name===gh);
                                        newGhCropTypes[gh]=[...(ghObj?.cropTypes||cropTypes)];
                                      }
                                      updateActObj(actName,{greenhouses:newGHs,ghCropTypes:newGhCropTypes});
                                    }}
                                    style={{accentColor:C.blue}}/>{gh}
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Step 2: Per-GH crop types */}
                      <div>
                        <div style={{fontSize:"13px",fontWeight:"700",color:C.navy,marginBottom:"10px"}}>Step 2 — Crop Types per Greenhouse:</div>
                        <p style={{fontSize:"12px",color:C.textMid,marginBottom:"10px"}}>For each greenhouse, select which crop types this staff can work with for this activity. By default all crops are selected.</p>
                        <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                          {activeGHs.map(gh=>{
                            const ghObj=ghList.find(g=>g.name===gh);
                            // Show only crops that belong to this GH (if GH has crops defined), else show all
                            const availableCrops=cropTypes; // Always show all crop types — user picks which apply per GH
                            const selectedCrops=getGhCrops(actObj,gh);
                            return(
                              <div key={gh} style={{background:"#fafafa",border:`1px solid ${C.border}`,borderRadius:"8px",padding:"10px 12px"}}>
                                <div style={{display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap"}}>
                                  <span style={{fontWeight:"700",color:C.navy,fontSize:"13px",minWidth:"120px"}}>{gh}</span>
                                  <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
                                    {availableCrops.map(ct=>{
                                      const isSel=selectedCrops.includes(ct);
                                      return(
                                        <label key={ct} style={{display:"flex",alignItems:"center",gap:"3px",background:isSel?"#fdebd0":"white",padding:"3px 8px",borderRadius:"5px",cursor:"pointer",border:`1px solid ${isSel?C.orange:C.border}`,fontSize:"12px"}}>
                                          <input type="checkbox" checked={isSel}
                                            onChange={e=>{
                                              const newCrops=e.target.checked?[...selectedCrops,ct]:selectedCrops.filter(c=>c!==ct);
                                              setGhCrops(actName,gh,newCrops);
                                            }}
                                            style={{accentColor:C.orange}}/>{ct}
                                        </label>
                                      );
                                    })}
                                  </div>
                                  {availableCrops.length===0&&<span style={{fontSize:"12px",color:C.textLight,fontStyle:"italic"}}>No crops assigned to this GH yet — go to Edit tab to add crop types to greenhouses.</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:"10px",paddingTop:"14px",borderTop:`1px solid ${C.border}`}}>
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
function AddStaffForm({staff,setStaff,btn,inp,setBackupReminder}){
  const [name,setName]=useState("");const [id,setId]=useState("");const [hours,setHours]=useState(7);
  const add=()=>{
    if(!name.trim()||!id.trim())return alert("Please enter both Staff ID and Name");
    if(staff.find(s=>s.id===id.trim()))return alert("Staff ID already exists");
    setStaff([...staff,{id:id.trim(),name:name.trim(),hoursPerDay:parseInt(hours)||7,dayHours:{Monday:parseInt(hours)||7,Tuesday:parseInt(hours)||7,Wednesday:parseInt(hours)||7,Thursday:parseInt(hours)||7,Friday:parseInt(hours)||7,Saturday:0,Sunday:0},overtimeLimit:30,activities:[],versatility:0}]);
    setName("");setId("");setHours(7);
    setBackupReminder(true);
  };
  return(
    <div>
      <input value={id} onChange={e=>setId(e.target.value)} style={{...inp,width:"100%",marginBottom:"8px",boxSizing:"border-box"}} placeholder="Staff ID (e.g. STF001)"/>
      <input value={name} onChange={e=>setName(e.target.value)} style={{...inp,width:"100%",marginBottom:"8px",boxSizing:"border-box"}} placeholder="Full Name"/>
      <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"12px"}}>
        <label style={{fontSize:"13px",color:"#666"}}>Default hours/day:</label>
        <input type="number" min="0" max="16" value={hours} onChange={e=>setHours(e.target.value)} style={{...inp,width:"65px",textAlign:"center"}}/>
      </div>
      <button onClick={add} style={btn(false,"#27ae60")}>+ Add Staff Member</button>
      <p style={{color:"#888",fontSize:"12px",marginTop:"8px"}}>After adding, click Edit in Manage Staff to assign activities, greenhouses and crop types.</p>
    </div>
  );
}
'''

with open("App.js", "w", encoding="utf-8") as f:
    f.write(code.strip())

print("App.js written successfully!")
