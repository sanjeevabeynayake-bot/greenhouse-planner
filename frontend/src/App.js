import React, { useState, useEffect } from "react";
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

  useEffect(()=>{
    const tick=()=>setAdelaideTime(new Date().toLocaleString("en-AU",{
      timeZone:"Australia/Adelaide",weekday:"short",day:"2-digit",month:"short",
      hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:true}));
    tick(); const t=setInterval(tick,1000); return ()=>clearInterval(t);
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
      if(d.scheduleSummary)setScheduleSummary(d.scheduleSummary);
      if(d.settings)setTolerance(d.settings.tolerance||5);
      if(d.quarantine)setQuarantine(d.quarantine);
    }).catch(()=>{}).finally(()=>setLoading(false));
  },[]);

  const normaliseGH=(gh)=>{
    if(typeof gh==="string")return{id:gh,name:gh,cropTypes:[]};
    return{id:gh.id||gh.name||"",name:gh.name||gh.id||"",cropTypes:gh.cropTypes||[]};
  };
  const ghList=greenhouses.map(normaliseGH);
  const ghNames=ghList.map(g=>g.name);

  const calcVersatility=(s)=>{
    if(!activities.length||!ghNames.length)return 0;
    const sa=s.activities||[];
    if(sa.length&&typeof sa[0]==="string"){
      const a=sa.filter(x=>activities.includes(x)).length/activities.length;
      const g=(s.greenhouses||[]).filter(x=>ghNames.includes(x)).length/ghNames.length;
      return Math.round((a+g)/2*100);
    }
    const actNames=sa.map(a=>a.activity);
    const a=actNames.filter(x=>activities.includes(x)).length/activities.length;
    const ghScores=sa.map(ao=>ao.allGreenhouses?1:(ao.greenhouses||[]).filter(x=>ghNames.includes(x)).length/(ghNames.length||1));
    const g=ghScores.length?ghScores.reduce((s,v)=>s+v,0)/ghScores.length:0;
    const allCrops=[...new Set(ghList.flatMap(g=>g.cropTypes||[]))];
    const staffCrops=new Set(sa.flatMap(ao=>ao.cropTypes||[]));
    const c=allCrops.length?[...staffCrops].filter(x=>allCrops.includes(x)).length/allCrops.length:1;
    return Math.round((a+g+c)/3*100);
  };

  const displayDays=ALL_DAYS.filter(day=>staff.some(s=>(s.dayHours?.[day]??( ["Saturday","Sunday"].includes(day)?0:s.hoursPerDay??7))>0));
  const activeDays=displayDays.length>0?displayDays:["Monday","Tuesday","Wednesday","Thursday","Friday"];

  const totalCapacity=staff.reduce((sum,s)=>sum+ALL_DAYS.reduce((ds,day)=>ds+(s.dayHours?.[day]??(["Saturday","Sunday"].includes(day)?0:s.hoursPerDay??7)),0),0);
  const totalDemand=Object.values(demand).reduce((sum,acts)=>sum+Object.values(acts).reduce((s,v)=>s+(parseInt(v)||0),0),0);

  const saveData=async()=>{
    await axios.post(`${API}/data`,{staff,greenhouses:ghList,activities,cropTypes,clusters,clusterTransitions,demand,absences,schedule,scheduleSummary,quarantine,settings:{tolerance}});
    setSaved(true); setTimeout(()=>setSaved(false),2000);
  };

  const generateSchedule=async()=>{
    setGenerating(true);setScheduleStale(false);
    try{
      const res=await axios.post(`${API}/optimise`,{staff,greenhouses:ghList,activities,demand,absences,clusters,clusterTransitions,tolerance,quarantine,currentDate:new Date().toLocaleString("en-AU",{timeZone:"Australia/Adelaide"})});
      if(res.data.schedule){setSchedule(res.data.schedule);setScheduleSummary(res.data.summary);setPage("schedule");}
      else if(res.data.error)alert("Optimiser error: "+res.data.error);
    }catch(e){alert("Network error: "+e.message);}
    setGenerating(false);
  };

  const reoptimise=async(staffId,affectedDays)=>{
    setGenerating(true);
    try{
      const res=await axios.post(`${API}/reoptimise`,{existingSchedule:schedule,affectedStaffId:staffId,affectedDays,staff,greenhouses:ghList,activities,demand,absences,clusters,clusterTransitions,tolerance,quarantine,currentDate:new Date().toLocaleString("en-AU",{timeZone:"Australia/Adelaide"})});
      if(res.data.schedule){setSchedule(res.data.schedule);if(res.data.summary)setScheduleSummary(res.data.summary);const u=res.data.summary?.totalUnassigned||0;alert(u>0?`Done. ${res.data.affectedTasks} reoptimised. ⚠️ ${u}h still unassigned.`:`Done. ${res.data.affectedTasks} assignments reoptimised with no gaps.`);}
    }catch(e){alert("Error: "+e.message);}
    setGenerating(false);
  };

  const btn=(active,color)=>({padding:"7px 14px",background:active?"#2ecc71":(color||C.blue),color:"white",border:"none",borderRadius:"5px",cursor:"pointer",margin:"0 3px",fontSize:"13px",fontWeight:"500"});
  const card={background:C.white,borderRadius:"10px",padding:"20px",marginBottom:"18px",boxShadow:"0 2px 8px rgba(0,0,0,0.07)"};
  const inp={padding:"6px 10px",border:`1px solid ${C.border}`,borderRadius:"5px",fontSize:"13px",outline:"none"};
  const TH=({children,center})=><th style={{padding:"9px 10px",textAlign:center?"center":"left",background:C.navy,color:"white",fontSize:"12px",fontWeight:"600"}}>{children}</th>;
  const TD=({children,i,center,color})=><td style={{padding:"8px 10px",background:i%2===0?C.light:C.white,textAlign:center?"center":"left",fontSize:"13px",color:color||"inherit"}}>{children}</td>;

  if(loading)return(<div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:C.bg}}><div style={{textAlign:"center"}}><div style={{fontSize:"48px",marginBottom:"16px"}}>🌿</div><div style={{color:C.textMid,fontSize:"18px"}}>Loading Greenhouse Planner...</div></div></div>);

  if(!role)return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,backgroundImage:"url('https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1600')",backgroundSize:"cover",backgroundPosition:"center",filter:"brightness(0.3)"}}/>
      <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"linear-gradient(135deg,rgba(26,58,92,0.8),rgba(13,115,119,0.6))"}}/>
      <div style={{position:"relative",zIndex:1,textAlign:"center",padding:"20px",width:"100%",maxWidth:"540px"}}>
        <div style={{fontSize:"60px",marginBottom:"10px"}}>🌿</div>
        <h1 style={{color:"white",marginBottom:"6px",fontSize:"30px",textShadow:"0 2px 12px rgba(0,0,0,0.6)"}}>Greenhouse Planner</h1>
        <p style={{color:"rgba(255,255,255,0.8)",marginBottom:"10px",fontSize:"14px"}}>Workforce Allocation & Scheduling System</p>
        <p style={{color:"rgba(255,255,255,0.5)",marginBottom:"36px",fontSize:"12px"}}>📍 Adelaide Time: {adelaideTime}</p>
        <div style={{display:"flex",gap:"20px",justifyContent:"center"}}>
          {[{role:"gm",icon:"👔",title:"General Manager",sub:"Full Access — All Tabs",color:"rgba(26,58,92,0.92)"},{role:"lm",icon:"👷",title:"Labour Manager",sub:"Staff & Operations",color:"rgba(13,115,119,0.92)"}].map(r=>(
            <div key={r.role} onClick={()=>{setRole(r.role);setPage("dashboard");}}
              style={{background:r.color,backdropFilter:"blur(10px)",color:"white",padding:"36px 40px",borderRadius:"16px",cursor:"pointer",flex:1,border:"1px solid rgba(255,255,255,0.2)",boxShadow:"0 8px 32px rgba(0,0,0,0.3)"}}>
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

  const tabs=[{id:"dashboard",label:"Dashboard",icon:"📊"},{id:"staff",label:"Staff",icon:"👥"},{id:"demand",label:"Demand",icon:"📋"},{id:"schedule",label:"Schedule",icon:"📅"},{id:"absence",label:"Absence",icon:"🏥"},{id:"overtime",label:"Overtime",icon:"⏱️"},{id:"edit",label:"Edit",icon:"✏️"},...(role==="gm"?[{id:"quarantine",label:"Quarantine",icon:"🔴"}]:[])];

  return(
    <div style={{background:C.bg,minHeight:"100vh",fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      <div style={{background:C.navy,padding:"0 16px",display:"flex",alignItems:"stretch",gap:"2px",flexWrap:"wrap",boxShadow:"0 2px 8px rgba(0,0,0,0.2)"}}>
        <div style={{display:"flex",alignItems:"center",paddingRight:"16px",borderRight:"1px solid rgba(255,255,255,0.15)",marginRight:"8px"}}>
          <span style={{color:"white",fontWeight:"700",fontSize:"15px"}}>🌿 Greenhouse Planner</span>
        </div>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setPage(t.id)}
            style={{background:page===t.id?"rgba(255,255,255,0.15)":"transparent",color:page===t.id?"white":"rgba(255,255,255,0.65)",border:"none",borderBottom:page===t.id?`3px solid ${t.id==="quarantine"?"#ff6b6b":"#2ecc71"}`:"3px solid transparent",padding:"12px 14px",cursor:"pointer",fontSize:"13px",fontWeight:"500",...(t.id==="quarantine"?{color:page===t.id?"#ff6b6b":"rgba(255,100,100,0.8)"}:{})}}>
            {t.icon} {t.label}{t.id==="schedule"&&scheduleStale&&<span style={{color:C.gold,marginLeft:"4px"}}>●</span>}
          </button>
        ))}
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:"10px",padding:"8px 0"}}>
          <span style={{color:"rgba(255,255,255,0.4)",fontSize:"11px"}}>{adelaideTime}</span>
          <span style={{color:"#aed6f1",fontSize:"12px",borderLeft:"1px solid rgba(255,255,255,0.2)",paddingLeft:"10px"}}>{role==="gm"?"👔 General Manager":"👷 Labour Manager"}</span>
          <button onClick={saveData} style={{...btn(false,saved?"#27ae60":C.orange),fontSize:"12px"}}>{saved?"✓ Saved!":"💾 Save"}</button>
          <button onClick={()=>{setRole(null);setPage("dashboard");}} style={{...btn(false,"#c0392b"),fontSize:"12px"}}>Exit</button>
        </div>
      </div>

      <div style={{padding:"20px"}}>

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
                    {scheduleSummary.shortfallByActivity.map((s,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:"12px",marginBottom:"3px"}}>
                        <span style={{color:C.textMid}}>{s.gh} — {s.activity}</span>
                        <span style={{color:C.red,fontWeight:"700"}}>-{s.hours}h</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{...card,borderTop:`4px solid ${C.orange}`}}>
                <h4 style={{color:C.navy,margin:"0 0 14px 0"}}>⚙️ Optimisation Settings</h4>
                <div style={{marginBottom:"14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:"6px"}}><label style={{fontSize:"13px",color:C.textMid}}>Whole-day preference tolerance:</label><strong style={{color:C.orange}}>{tolerance}%</strong></div>
                  <input type="range" min="0" max="20" value={tolerance} onChange={e=>setTolerance(parseInt(e.target.value))} style={{width:"100%",accentColor:C.orange}}/>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:"11px",color:"#aaa",marginTop:"4px"}}><span>0% — Pure optimisation</span><span>20% — Max human factors</span></div>
                  <div style={{marginTop:"8px",padding:"8px",background:"#fef9f0",borderRadius:"6px",fontSize:"12px",color:C.textMid}}>
                    {tolerance===0&&"⚡ Pure optimisation — staff assigned wherever most efficient. Cluster preferences ignored."}
                    {tolerance>0&&tolerance<=5&&`✓ Balanced (${tolerance}%) — staff kept in cluster unless it costs more than ${tolerance}% efficiency.`}
                    {tolerance>5&&tolerance<=12&&`👥 Staff-friendly (${tolerance}%) — strong preference to keep staff in one location all day.`}
                    {tolerance>12&&`🏠 Maximum stability (${tolerance}%) — staff almost always stay in one greenhouse.`}
                  </div>
                </div>
                <div style={{borderTop:`1px solid ${C.border}`,paddingTop:"10px",fontSize:"13px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}><span style={{color:C.textMid}}>High versatility staff (75%+):</span><strong style={{color:C.green}}>{staff.filter(s=>calcVersatility(s)>=75).length}</strong></div>
                  <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:C.textMid}}>Active working days:</span><strong style={{color:C.blue}}>{activeDays.length} days</strong></div>
                </div>
              </div>
            </div>
            <div style={card}>
              <h4 style={{color:C.navy,margin:"0 0 12px 0"}}>🗺️ Greenhouse Clusters</h4>
              <div style={{display:"flex",gap:"14px",flexWrap:"wrap"}}>
                {clusters.map((cl,ci)=>(
                  <div key={ci} style={{background:C.light,border:`1px solid ${C.border}`,borderRadius:"8px",padding:"12px",minWidth:"200px"}}>
                    <div style={{display:"flex",gap:"6px",marginBottom:"8px"}}>
                      <input value={cl.name} onChange={e=>{const c=[...clusters];c[ci]={...c[ci],name:e.target.value};setClusters(c);}} style={{...inp,flex:1,fontSize:"13px"}}/>
                      <button onClick={()=>setClusters(clusters.filter((_,j)=>j!==ci))} style={btn(false,C.red)}>✕</button>
                    </div>
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
              {clusters.length===0&&<p style={{color:C.textLight,fontSize:"13px",margin:"8px 0 0 0"}}>No clusters defined — all greenhouses are independent.</p>}
            </div>
          </div>
        )}

        {page==="staff"&&(
          <div>
            <h2 style={{color:C.navy,marginBottom:"16px"}}>👥 Staff ({staff.length})</h2>
            {staff.length===0?(<div style={card}><p style={{color:C.textLight}}>No staff added yet. Go to Edit to add staff.</p></div>):(
              <div style={card}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr><TH>ID</TH><TH>Name</TH><TH center>Activities</TH><TH center>Versatility</TH><TH center>Hrs/Day</TH><TH center>OT Limit</TH><TH>Actions</TH></tr></thead>
                  <tbody>
                    {staff.map((s,i)=>{
                      const v=calcVersatility(s);
                      const actCount=(s.activities||[]).length;
                      return(
                        <tr key={s.id} style={{background:i%2===0?C.light:C.white}}>
                          <TD i={i}><span style={{fontFamily:"monospace",color:C.navy,fontWeight:"700",fontSize:"12px"}}>{s.id}</span></TD>
                          <TD i={i}>{s.name}</TD>
                          <TD i={i} center>{actCount}</TD>
                          <TD i={i} center>
                            <div style={{display:"flex",alignItems:"center",gap:"6px",justifyContent:"center"}}>
                              <div style={{background:"#eee",borderRadius:"4px",overflow:"hidden",width:"60px",height:"10px"}}><div style={{width:`${v}%`,background:v>75?C.green:v>50?C.gold:C.red,height:"100%"}}/></div>
                              <span style={{fontSize:"12px",fontWeight:"600",color:v>75?C.green:v>50?C.gold:C.red}}>{v}%</span>
                            </div>
                          </TD>
                          <TD i={i} center>{s.hoursPerDay??7}h</TD>
                          <TD i={i} center>{s.overtimeLimit??30}h</TD>
                          <TD i={i}><button onClick={()=>setSelectedStaff({...s})} style={btn(false,C.purple)}>✏️ Edit</button></TD>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {page==="demand"&&(
          <div>
            <h2 style={{color:C.navy,marginBottom:"16px"}}>📋 Weekly Demand</h2>
            <div style={card}>
              <p style={{color:C.textMid,fontSize:"13px",marginBottom:"16px"}}>Enter weekly hours per greenhouse per activity. Hours are distributed across active working days.</p>
              <div style={{overflowX:"auto"}}>
                <table style={{borderCollapse:"collapse",fontSize:"12px"}}>
                  <thead>
                    <tr style={{background:C.navy,color:"white"}}>
                      <th style={{padding:"9px 10px",minWidth:"130px",position:"sticky",left:0,background:C.navy,zIndex:1}}>Greenhouse</th>
                      {activities.map(a=><th key={a} style={{padding:"6px 4px",minWidth:"78px",textAlign:"center",fontWeight:"600",fontSize:"11px"}}>{a}</th>)}
                      <th style={{padding:"6px 10px",minWidth:"60px",textAlign:"center"}}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ghList.map((gh,i)=>{
                      const ghName=gh.name;
                      const rowTotal=activities.reduce((sum,act)=>sum+(parseInt(demand[ghName]?.[act])||0),0);
                      return(
                        <tr key={ghName} style={{background:i%2===0?C.light:C.white}}>
                          <td style={{padding:"6px 10px",fontWeight:"700",color:C.navy,position:"sticky",left:0,background:i%2===0?C.light:C.white,fontSize:"12px",zIndex:1,borderRight:`1px solid ${C.border}`}}>{ghName}</td>
                          {activities.map(activity=>(
                            <td key={activity} style={{padding:"3px",textAlign:"center"}}>
                              <input type="number" min="0" max="999" value={demand[ghName]?.[activity]||""} onChange={e=>{const val=parseInt(e.target.value)||0;setDemand(prev=>({...prev,[ghName]:{...prev[ghName],[activity]:val}}));setScheduleStale(true);}} style={{width:"54px",padding:"3px",border:`1px solid ${C.border}`,borderRadius:"4px",textAlign:"center",fontSize:"12px"}}/>
                            </td>
                          ))}
                          <td style={{padding:"6px 10px",textAlign:"center",fontWeight:"700",color:rowTotal>0?C.navy:C.textLight,fontSize:"12px"}}>{rowTotal||"—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{marginTop:"18px",display:"flex",gap:"10px",alignItems:"center",flexWrap:"wrap"}}>
                <button onClick={generateSchedule} disabled={generating} style={{...btn(false,C.green),padding:"11px 26px",fontSize:"14px",opacity:generating?0.7:1}}>{generating?"⏳ Optimising...":"🚀 Generate Optimised Plan"}</button>
                <button onClick={()=>{setDemand({});setScheduleStale(true);}} style={btn(false,C.red)}>🗑️ Clear All</button>
                <span style={{color:C.textMid,fontSize:"13px"}}>Demand: <strong>{totalDemand}h</strong> | Capacity: <strong style={{color:totalDemand>totalCapacity?C.red:C.green}}>{totalCapacity}h</strong>{totalDemand>totalCapacity&&<span style={{color:C.red}}> | ⚠️ -{totalDemand-totalCapacity}h shortfall</span>}{totalDemand>0&&totalDemand<=totalCapacity&&<span style={{color:C.green}}> | +{totalCapacity-totalDemand}h surplus</span>}</span>
              </div>
            </div>
          </div>
        )}

        {page==="schedule"&&(
          <div>
            <h2 style={{color:C.navy,marginBottom:"16px"}}>📅 Schedule</h2>
            {!schedule?(<div style={card}><p style={{color:C.textLight}}>No schedule yet. Go to Demand and click Generate.</p></div>):(
              <div>
                {scheduleSummary&&(
                  <div style={{...card,background:"#eafaf1",padding:"14px",marginBottom:"14px"}}>
                    <div style={{display:"flex",gap:"20px",flexWrap:"wrap",fontSize:"13px",alignItems:"center"}}>
                      <span>✅ <strong>Assigned:</strong> {scheduleSummary.totalAssigned}h</span>
                      <span style={{color:scheduleSummary.totalUnassigned>0?C.red:C.green}}>{scheduleSummary.totalUnassigned>0?"⚠️":"✓"} <strong>Unassigned:</strong> {scheduleSummary.totalUnassigned}h</span>
                      <span>📊 <strong>Demand:</strong> {scheduleSummary.totalDemand}h</span>
                      <span>👥 <strong>Capacity:</strong> {scheduleSummary.totalCapacity}h</span>
                      {scheduleSummary.surplusHours>0&&<span style={{color:C.green}}>💚 Surplus: {scheduleSummary.surplusHours}h</span>}
                      {scheduleSummary.shortfallHours>0&&<span style={{color:C.red}}>🔴 Shortfall: {scheduleSummary.shortfallHours}h</span>}
                      {scheduleSummary.generatedAt&&<span style={{color:C.textLight,fontSize:"11px",marginLeft:"auto"}}>Generated: {scheduleSummary.generatedAt}</span>}
                    </div>
                  </div>
                )}
                {Object.entries(schedule).map(([day,assignments])=>(
                  <div key={day} style={card}>
                    <h3 style={{color:C.navy,marginBottom:"10px",fontSize:"15px"}}>{day}<span style={{fontWeight:"400",color:C.textMid,fontSize:"13px",marginLeft:"8px"}}>— {assignments.filter(x=>!x.unassigned).length} assignments</span>{assignments.filter(x=>x.unassigned).length>0&&<span style={{color:C.red,fontSize:"13px"}}> | ⚠️ {assignments.filter(x=>x.unassigned).length} unassigned</span>}</h3>
                    {!assignments.length?<p style={{color:C.textLight,fontSize:"13px"}}>No assignments</p>:(
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px"}}>
                        <thead><tr><TH>Staff ID</TH><TH>Name</TH><TH>Greenhouse</TH><TH>Activity</TH><TH center>Hours</TH><TH center>Transit</TH></tr></thead>
                        <tbody>
                          {assignments.map((a,i)=>(
                            <tr key={i} style={{background:a.unassigned?"#fde8e8":a.reoptimised?"#fffbea":i%2===0?C.light:C.white}}>
                              <td style={{padding:"8px 10px",fontFamily:"monospace",color:a.unassigned?C.red:C.navy,fontSize:"12px"}}>{a.staffId}</td>
                              <td style={{padding:"8px 10px",fontSize:"13px"}}>{a.unassigned?<span style={{color:C.red}}>⚠️ {a.staffName}</span>:<button onClick={()=>{const s=staff.find(x=>x.id===a.staffId);if(s)setSelectedStaff(s);}} style={{background:"none",border:"none",color:C.blue,cursor:"pointer",textDecoration:"underline",fontSize:"13px",padding:0}}>{a.staffName}</button>}{a.reoptimised&&<span style={{fontSize:"11px",color:C.gold,marginLeft:"6px"}}>↻</span>}</td>
                              <td style={{padding:"8px 10px"}}>{a.greenhouse}</td>
                              <td style={{padding:"8px 10px"}}>{a.activity}</td>
                              <td style={{padding:"8px 10px",textAlign:"center"}}>{a.hours}h</td>
                              <td style={{padding:"8px 10px",textAlign:"center",color:a.transitionMins>0?C.gold:C.textLight,fontSize:"12px"}}>{a.transitionMins>0?`${a.transitionMins}min`:"—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {page==="absence"&&(
          <div>
            <h2 style={{color:C.navy,marginBottom:"16px"}}>🏥 Absence Management</h2>
            {staff.length===0?(<div style={card}><p style={{color:C.textLight}}>No staff added yet.</p></div>):(
              <div style={card}>
                <p style={{color:C.textMid,fontSize:"13px",marginBottom:"4px"}}>Enter reduced hours or mark absent. <strong>Weekly overrides only</strong> — permanent profiles unchanged.</p>
                <p style={{color:C.textLight,fontSize:"12px",marginBottom:"16px"}}>Blank = normal hours | Number = partial hours that day | Tick = fully absent</p>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
                    <thead>
                      <tr>
                        <TH>ID</TH><TH>Name</TH>
                        {ALL_DAYS.map(d=><th key={d} colSpan="2" style={{padding:"7px",textAlign:"center",background:["Saturday","Sunday"].includes(d)?"#2c5f6e":C.navy,color:"white",fontSize:"11px",borderLeft:"1px solid rgba(255,255,255,0.15)"}}>{DAY_SHORT[d]}</th>)}
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
                  {(role==="gm"||role==="lm")&&<button onClick={generateSchedule} disabled={generating} style={{...btn(false,C.green),opacity:generating?0.7:1}}>{generating?"⏳ Optimising...":"🚀 Full Regenerate"}</button>}
                  {schedule&&staff.filter(s=>ALL_DAYS.some(d=>{const al=absences[d]||[];return al.includes(s.id)||al.some(x=>typeof x==="object"&&x.id===s.id);})).map(s=>{
                    const affectedDays=ALL_DAYS.filter(d=>{const al=absences[d]||[];return al.includes(s.id)||al.some(x=>typeof x==="object"&&x.id===s.id);});
                    return <button key={s.id} onClick={()=>reoptimise(s.id,affectedDays)} disabled={generating} style={{...btn(false,C.gold),fontSize:"12px",opacity:generating?0.7:1}}>↻ Min-disrupt: {s.name}</button>;
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {page==="overtime"&&(
          <div>
            <h2 style={{color:C.navy,marginBottom:"16px"}}>⏱️ Overtime</h2>
            <div style={card}>
              <p style={{color:C.textMid,fontSize:"13px",marginBottom:"12px"}}>Overtime allocations — under-utilised staff offered first, then highest versatility. Default OT limit: <strong>30 hrs/week per staff</strong>.</p>
              {schedule?<button onClick={async()=>{setGenerating(true);try{const res=await axios.post(`${API}/overtime/calculate`,{staff,greenhouses:ghList,activities,schedule,absences});if(res.data.entries)alert(`${res.data.entries.length} overtime entries calculated. Full OT management tab coming in next update.`);}catch(e){alert("Error: "+e.message);}setGenerating(false);}} disabled={generating} style={btn(false,C.orange)}>{generating?"⏳ Calculating...":"⚡ Calculate Suggested Overtime"}</button>
              :<p style={{color:C.textLight,fontSize:"13px"}}>Generate a schedule first to calculate overtime.</p>}
              <div style={{marginTop:"16px",padding:"14px",background:C.light,borderRadius:"8px",border:`1px solid ${C.border}`,fontSize:"13px",color:C.textMid}}>
                <strong>Overtime priority rules:</strong>
                <ol style={{margin:"8px 0 0 0",paddingLeft:"18px",lineHeight:"1.8"}}>
                  <li>Under-utilised staff (below normal weekly capacity) — must have matching activity, GH and crop type skills</li>
                  <li>Highest versatility score staff — if all staff fully utilised</li>
                  <li>GM can override any system allocation</li>
                  <li>$ rate per hour can be entered per entry to estimate total OT cost</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {page==="edit"&&(
          <div>
            <h2 style={{color:C.navy,marginBottom:"16px"}}>✏️ Edit Master Data</h2>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"18px"}}>
              <div style={card}>
                <h3 style={{color:C.navy,marginBottom:"6px"}}>🏗️ Greenhouses ({ghList.length})</h3>
                <p style={{color:C.textLight,fontSize:"12px",marginBottom:"10px"}}>Name each greenhouse.</p>
                <div style={{maxHeight:"320px",overflowY:"auto",marginBottom:"10px"}}>
                  {ghList.map((gh,i)=>(
                    <div key={i} style={{display:"flex",gap:"8px",marginBottom:"6px",alignItems:"center"}}>
                      <input value={gh.name} onChange={e=>{const g=[...greenhouses];g[i]={...normaliseGH(g[i]),name:e.target.value,id:e.target.value};setGreenhouses(g);}} style={{...inp,flex:1}}/>
                      <button onClick={()=>setGreenhouses(greenhouses.filter((_,j)=>j!==i))} style={btn(false,C.red)}>✕</button>
                    </div>
                  ))}
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
              <div style={card}>
                <h3 style={{color:C.navy,marginBottom:"12px"}}>👤 Add New Staff</h3>
                <AddStaffForm staff={staff} setStaff={setStaff} btn={btn} inp={inp}/>
              </div>
            </div>
            {staff.length>0&&(
              <div style={{...card,marginTop:"18px"}}>
                <h3 style={{color:C.navy,marginBottom:"12px"}}>👥 Manage Staff ({staff.length})</h3>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr><TH>ID</TH><TH>Name</TH><TH center>Default Hrs</TH><TH center>OT Limit</TH><TH>Versatility</TH><TH>Actions</TH></tr></thead>
                  <tbody>
                    {staff.map((s,i)=>{const v=calcVersatility(s);return(
                      <tr key={s.id} style={{background:i%2===0?C.light:C.white}}>
                        <TD i={i}><span style={{fontFamily:"monospace",color:C.navy,fontWeight:"700"}}>{s.id}</span></TD>
                        <TD i={i}>{s.name}</TD>
                        <TD i={i} center>{s.hoursPerDay??7}h</TD>
                        <TD i={i} center>{s.overtimeLimit??30}h</TD>
                        <TD i={i}><div style={{display:"flex",alignItems:"center",gap:"6px"}}><div style={{background:"#eee",borderRadius:"4px",overflow:"hidden",width:"70px",height:"10px"}}><div style={{width:`${v}%`,background:v>75?C.green:v>50?C.gold:C.red,height:"100%"}}/></div><span style={{fontSize:"12px",fontWeight:"600",color:v>75?C.green:v>50?C.gold:C.red}}>{v}%</span></div></TD>
                        <TD i={i}><button onClick={()=>setSelectedStaff({...s})} style={btn(false,C.purple)}>✏️ Edit</button><button onClick={()=>{if(window.confirm(`Remove ${s.name}?`))setStaff(staff.filter(x=>x.id!==s.id));}} style={btn(false,C.red)}>🗑️</button></TD>
                      </tr>
                    );})}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {page==="quarantine"&&role==="gm"&&(
          <div>
            <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"16px"}}>
              <h2 style={{color:C.red,margin:0}}>🔴 Quarantine</h2>
              <span style={{background:"#ffe5e5",color:C.red,padding:"4px 10px",borderRadius:"20px",fontSize:"12px",fontWeight:"700"}}>GM ONLY</span>
            </div>
            <div style={card}>
              <p style={{color:C.textMid,fontSize:"13px",marginBottom:"16px"}}>Select a greenhouse to quarantine. Staff currently assigned will be locked for the specified number of days. Additional staff can be added manually.</p>
              <QuarantinePanel staff={staff} ghList={ghList} quarantine={quarantine} setQuarantine={setQuarantine} btn={btn} inp={inp} adelaideTime={adelaideTime} API={API}/>
            </div>
          </div>
        )}

      </div>

      {selectedStaff&&(
        <StaffProfilePopup
          selectedStaff={selectedStaff} setSelectedStaff={setSelectedStaff}
          staff={staff} setStaff={setStaff}
          activities={activities} ghNames={ghNames} cropTypes={cropTypes}
          absences={absences} calcVersatility={calcVersatility}
          btn={btn} inp={inp} C={C} ALL_DAYS={ALL_DAYS} DAY_SHORT={DAY_SHORT}/>
      )}
    </div>
  );
}

function StaffProfilePopup({selectedStaff,setSelectedStaff,staff,setStaff,activities,ghNames,cropTypes,absences,calcVersatility,btn,inp,C,ALL_DAYS,DAY_SHORT}){
  const [expandedAct,setExpandedAct]=useState(null);
  const update=(updates)=>{const u={...selectedStaff,...updates};setSelectedStaff(u);setStaff(staff.map(s=>s.id===selectedStaff.id?u:s));};
  const staffActs=(selectedStaff.activities||[]).map(a=>typeof a==="string"?{activity:a,allGreenhouses:true,greenhouses:[...ghNames],cropTypes:[...cropTypes]}:a);
  const hasActivity=(actName)=>staffActs.some(a=>a.activity===actName);
  const toggleActivity=(actName,checked)=>{
    const newActs=checked?[...staffActs,{activity:actName,allGreenhouses:true,greenhouses:[...ghNames],cropTypes:[...cropTypes]}]:staffActs.filter(a=>a.activity!==actName);
    if(!checked&&expandedAct===actName)setExpandedAct(null);
    update({activities:newActs});
  };
  const updateActObj=(actName,changes)=>update({activities:staffActs.map(a=>a.activity===actName?{...a,...changes}:a)});
  const getActObj=(actName)=>staffActs.find(a=>a.activity===actName)||null;
  const v=calcVersatility(selectedStaff);
  const absCount=ALL_DAYS.filter(d=>{const al=absences[d]||[];return al.includes(selectedStaff.id)||al.some(x=>typeof x==="object"&&x.id===selectedStaff.id&&x.hours===0);}).length;
  return(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
      <div style={{background:"white",borderRadius:"14px",padding:"28px",maxWidth:"820px",width:"95%",maxHeight:"92vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"20px"}}>
          <div><h2 style={{color:C.navy,margin:"0 0 4px 0"}}>{selectedStaff.name}</h2><span style={{fontFamily:"monospace",color:C.textLight,fontSize:"13px"}}>{selectedStaff.id}</span></div>
          <button onClick={()=>setSelectedStaff(null)} style={btn(false,C.red)}>✕ Close</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"10px",marginBottom:"22px"}}>
          {[[v+"%","Versatility",C.blue,"#eaf2ff"],[absCount,"Absent Days",C.red,"#fdf2f2"],[selectedStaff.hoursPerDay??7,"Default Hrs/Day",C.green,"#f0fff4"],[selectedStaff.overtimeLimit??30,"OT Limit/Wk",C.purple,"#f8f4ff"]].map(([val,label,color,bg])=>(
            <div key={label} style={{background:bg,padding:"12px",borderRadius:"8px",textAlign:"center"}}>
              <div style={{fontSize:"22px",fontWeight:"800",color}}>{val}</div>
              <div style={{fontSize:"11px",color:C.textLight,marginTop:"2px"}}>{label}</div>
            </div>
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
            {ALL_DAYS.map(day=>{
              const isWE=["Saturday","Sunday"].includes(day);
              return(
                <div key={day} style={{textAlign:"center"}}>
                  <div style={{fontSize:"11px",color:isWE?C.orange:C.textMid,marginBottom:"4px",fontWeight:isWE?"700":"400"}}>{DAY_SHORT[day]}</div>
                  <input type="number" min="0" max="16" value={selectedStaff.dayHours?.[day]??(isWE?0:selectedStaff.hoursPerDay??7)}
                    onChange={e=>update({dayHours:{...(selectedStaff.dayHours||{}),[day]:parseInt(e.target.value)||0}})}
                    style={{...inp,width:"100%",textAlign:"center",background:isWE?"#fff8f0":"white",borderColor:isWE?C.orange:C.border}}/>
                </div>
              );
            })}
          </div>
          <p style={{color:C.textLight,fontSize:"12px",marginTop:"8px"}}>Set 0 for days not worked. Use Absence tab for one-off weekly changes.</p>
        </div>
        <div style={{marginBottom:"20px"}}>
          <h4 style={{color:C.navy,marginBottom:"6px",fontSize:"14px"}}>⚙️ Activities, Greenhouses & Crop Types</h4>
          <p style={{color:C.textMid,fontSize:"12px",marginBottom:"12px"}}>Tick an activity to assign it. Expand to configure which greenhouses and crop types apply for that activity.</p>
          <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
            {activities.map(actName=>{
              const isChecked=hasActivity(actName);
              const actObj=getActObj(actName);
              const isExpanded=expandedAct===actName&&isChecked;
              return(
                <div key={actName} style={{border:`1px solid ${isChecked?C.teal:C.border}`,borderRadius:"8px",overflow:"hidden",background:isChecked?"#f0fdfb":"#fafafa"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"10px",padding:"10px 14px"}}>
                    <input type="checkbox" checked={isChecked} onChange={e=>toggleActivity(actName,e.target.checked)} style={{width:"16px",height:"16px",cursor:"pointer",accentColor:C.teal}}/>
                    <span style={{flex:1,fontSize:"13px",fontWeight:isChecked?"600":"400",color:isChecked?C.navy:C.textMid}}>{actName}</span>
                    {isChecked&&actObj&&<span style={{fontSize:"11px",color:C.textLight}}>{actObj.allGreenhouses?"All GHs":`${actObj.greenhouses?.length||0} GHs`}{" · "}{actObj.cropTypes?.length||0} crops</span>}
                    {isChecked&&<button onClick={()=>setExpandedAct(isExpanded?null:actName)} style={{background:"none",border:`1px solid ${C.teal}`,color:C.teal,borderRadius:"4px",padding:"2px 8px",cursor:"pointer",fontSize:"12px"}}>{isExpanded?"▲ Hide":"▼ Configure"}</button>}
                  </div>
                  {isExpanded&&actObj&&(
                    <div style={{borderTop:"1px solid #c8ede8",padding:"14px",background:"white"}}>
                      <div style={{marginBottom:"14px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"8px"}}>
                          <label style={{fontSize:"13px",fontWeight:"600",color:C.navy}}>🏗️ Greenhouses:</label>
                          <label style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"13px",cursor:"pointer"}}>
                            <input type="checkbox" checked={actObj.allGreenhouses} onChange={e=>updateActObj(actName,{allGreenhouses:e.target.checked,greenhouses:e.target.checked?[...ghNames]:actObj.greenhouses})} style={{accentColor:C.teal}}/>
                            <span style={{color:actObj.allGreenhouses?C.teal:C.textMid,fontWeight:"600"}}>All Greenhouses</span>
                          </label>
                        </div>
                        {!actObj.allGreenhouses&&(
                          <div style={{display:"flex",flexWrap:"wrap",gap:"5px"}}>
                            {ghNames.map(gh=>(
                              <label key={gh} style={{display:"flex",alignItems:"center",gap:"3px",background:(actObj.greenhouses||[]).includes(gh)?"#d5f0ff":"white",padding:"4px 8px",borderRadius:"5px",cursor:"pointer",border:`1px solid ${(actObj.greenhouses||[]).includes(gh)?C.blue:C.border}`,fontSize:"12px"}}>
                                <input type="checkbox" checked={(actObj.greenhouses||[]).includes(gh)} onChange={e=>{const ghs=actObj.greenhouses||[];updateActObj(actName,{greenhouses:e.target.checked?[...ghs,gh]:ghs.filter(g=>g!==gh)});}} style={{accentColor:C.blue}}/>{gh}
                              </label>
                            ))}
                          </div>
                        )}
                        {actObj.allGreenhouses&&<div style={{fontSize:"12px",color:C.textLight,fontStyle:"italic"}}>✓ Staff can perform this activity in any greenhouse</div>}
                      </div>
                      <div>
                        <div style={{fontSize:"13px",fontWeight:"600",color:C.navy,marginBottom:"8px"}}>🌱 Crop Types:</div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:"5px"}}>
                          {cropTypes.map(ct=>(
                            <label key={ct} style={{display:"flex",alignItems:"center",gap:"3px",background:(actObj.cropTypes||[]).includes(ct)?"#fdebd0":"white",padding:"4px 8px",borderRadius:"5px",cursor:"pointer",border:`1px solid ${(actObj.cropTypes||[]).includes(ct)?C.orange:C.border}`,fontSize:"12px"}}>
                              <input type="checkbox" checked={(actObj.cropTypes||[]).includes(ct)} onChange={e=>{const cts=actObj.cropTypes||[];updateActObj(actName,{cropTypes:e.target.checked?[...cts,ct]:cts.filter(c=>c!==ct)});}} style={{accentColor:C.orange}}/>{ct}
                            </label>
                          ))}
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

function QuarantinePanel({staff,ghList,quarantine,setQuarantine,btn,inp,adelaideTime,API}){
  const [selectedGH,setSelectedGH]=useState("");
  const [daysLocked,setDaysLocked]=useState(7);
  const [reason,setReason]=useState("");
  const [extraStaff,setExtraStaff]=useState([]);
  const Cr={red:"#e74c3c",navy:"#1a3a5c",border:"#dee2e6",light:"#f8f9fa",textMid:"#555",textLight:"#888"};
  const createEvent=async()=>{
    if(!selectedGH)return alert("Please select a greenhouse");
    try{
      const res=await axios.post(`${API}/quarantine`,{greenhouseId:selectedGH,staffIds:extraStaff,allowedGreenhouses:[selectedGH],daysLocked,reason,startDate:new Date().toISOString(),createdBy:"GM"});
      if(res.data.event){setQuarantine([...quarantine,res.data.event]);setSelectedGH("");setReason("");setExtraStaff([]);setDaysLocked(7);alert(`Quarantine created for ${selectedGH}`);}
    }catch(e){alert("Error: "+e.message);}
  };
  const removeEvent=async(id)=>{try{await axios.delete(`${API}/quarantine/${id}`);setQuarantine(quarantine.filter(e=>e.id!==id));}catch(e){alert("Error: "+e.message);}};
  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"20px",marginBottom:"20px"}}>
        <div>
          <div style={{marginBottom:"12px"}}><label style={{display:"block",fontSize:"13px",fontWeight:"600",color:Cr.navy,marginBottom:"5px"}}>Select Greenhouse to Quarantine:</label><select value={selectedGH} onChange={e=>setSelectedGH(e.target.value)} style={{...inp,width:"100%"}}><option value="">— Select greenhouse —</option>{ghList.map(gh=><option key={gh.id} value={gh.id}>{gh.name}</option>)}</select></div>
          <div style={{marginBottom:"12px"}}><label style={{display:"block",fontSize:"13px",fontWeight:"600",color:Cr.navy,marginBottom:"5px"}}>Lock Duration (days, default 7):</label><input type="number" min="1" max="90" value={daysLocked} onChange={e=>setDaysLocked(parseInt(e.target.value)||7)} style={{...inp,width:"100px"}}/></div>
          <div style={{marginBottom:"12px"}}><label style={{display:"block",fontSize:"13px",fontWeight:"600",color:Cr.navy,marginBottom:"5px"}}>Reason (optional):</label><input value={reason} onChange={e=>setReason(e.target.value)} style={{...inp,width:"100%"}} placeholder="e.g. Pest outbreak, disease control"/></div>
          <button onClick={createEvent} style={{...btn(false,"#e74c3c"),padding:"10px 20px"}}>🔴 Create Quarantine Event</button>
          <p style={{color:Cr.textLight,fontSize:"12px",marginTop:"8px"}}>Adelaide time: {adelaideTime}</p>
        </div>
        <div>
          <label style={{display:"block",fontSize:"13px",fontWeight:"600",color:Cr.navy,marginBottom:"8px"}}>Manually add staff to quarantine:</label>
          <div style={{maxHeight:"200px",overflowY:"auto",border:`1px solid ${Cr.border}`,borderRadius:"6px",padding:"8px"}}>
            {staff.map(s=><label key={s.id} style={{display:"flex",alignItems:"center",gap:"6px",padding:"4px",cursor:"pointer",fontSize:"13px"}}><input type="checkbox" checked={extraStaff.includes(s.id)} onChange={e=>setExtraStaff(e.target.checked?[...extraStaff,s.id]:extraStaff.filter(x=>x!==s.id))}/><span style={{fontFamily:"monospace",color:Cr.navy,fontSize:"12px"}}>{s.id}</span><span>{s.name}</span></label>)}
          </div>
          {extraStaff.length>0&&<p style={{color:Cr.textMid,fontSize:"12px",marginTop:"6px"}}>{extraStaff.length} staff selected</p>}
        </div>
      </div>
      {quarantine.length>0&&(
        <div>
          <h4 style={{color:Cr.navy,marginBottom:"10px"}}>Active Quarantine Events ({quarantine.length})</h4>
          {quarantine.map(ev=>(
            <div key={ev.id} style={{background:"#fff5f5",border:"1px solid #fcc",borderRadius:"8px",padding:"12px",marginBottom:"8px",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <strong style={{color:Cr.red}}>🔴 {ev.greenhouseId}</strong>
                <span style={{fontSize:"13px",color:Cr.textMid,marginLeft:"10px"}}>Locked {ev.daysLocked} days · {ev.staffIds?.length||0} staff</span>
                {ev.reason&&<div style={{fontSize:"12px",color:Cr.textLight,marginTop:"4px"}}>📝 {ev.reason}</div>}
                <div style={{fontSize:"11px",color:Cr.textLight,marginTop:"4px"}}>Created: {ev.createdAt}</div>
              </div>
              <button onClick={()=>removeEvent(ev.id)} style={{...btn(false,"#e74c3c"),fontSize:"12px"}}>Remove</button>
            </div>
          ))}
        </div>
      )}
      {quarantine.length===0&&<p style={{color:"#888",fontSize:"13px"}}>No active quarantine events.</p>}
    </div>
  );
}

function AddStaffForm({staff,setStaff,btn,inp}){
  const [name,setName]=useState("");
  const [id,setId]=useState("");
  const [hours,setHours]=useState(7);
  const add=()=>{
    if(!name.trim()||!id.trim())return alert("Please enter both Staff ID and Name");
    if(staff.find(s=>s.id===id.trim()))return alert("Staff ID already exists");
    setStaff([...staff,{id:id.trim(),name:name.trim(),hoursPerDay:parseInt(hours)||7,dayHours:{Monday:parseInt(hours)||7,Tuesday:parseInt(hours)||7,Wednesday:parseInt(hours)||7,Thursday:parseInt(hours)||7,Friday:parseInt(hours)||7,Saturday:0,Sunday:0},overtimeLimit:30,activities:[],versatility:0}]);
    setName("");setId("");setHours(7);
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