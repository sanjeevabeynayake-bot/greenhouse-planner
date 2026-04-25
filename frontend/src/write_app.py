code = r'''import React, { useState, useEffect } from "react";
import axios from "axios";
const API = "https://greenhouse-planner-backend.onrender.com";
const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday"];
const DEFAULT_ACTIVITIES = ["Planting","Watering & Irrigation","Fertilizing","De-leafing & Pruning","Harvesting","Pest & Disease Control","Soil & Media Preparation","Transplanting","Trellising & Training","Climate Control","Quality Inspection","Packaging & Grading","Cleaning & Sanitation","Equipment Maintenance","Crop Monitoring"];
const DEFAULT_GHS = Array.from({length:30},(_,i)=>({id:`GH-${String(i+1).padStart(2,"0")}`,name:`GH-${String(i+1).padStart(2,"0")}`,cropTypes:[]}));
const DEFAULT_CROPS = ["Tomato Standard","Tomato Cherry","Cucumber Standard","Cucumber Mini","Other"];

export default function App() {
  const [role, setRole] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [staff, setStaff] = useState([]);
  const [greenhouses, setGreenhouses] = useState(DEFAULT_GHS);
  const [activities, setActivities] = useState(DEFAULT_ACTIVITIES);
  const [cropTypes, setCropTypes] = useState(DEFAULT_CROPS);
  const [demand, setDemand] = useState({});
  const [schedule, setSchedule] = useState(null);
  const [scheduleSummary, setScheduleSummary] = useState(null);
  const [absences, setAbsences] = useState({});
  const [clusters, setClusters] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [tolerance, setTolerance] = useState(5);
  const [scheduleStale, setScheduleStale] = useState(false);

  useEffect(()=>{
    axios.get(`${API}/data`).then(res=>{
      const d=res.data;
      if(d.staff && d.staff.length>0) setStaff(d.staff);
      if(d.greenhouses && d.greenhouses.length>0) setGreenhouses(d.greenhouses);
      if(d.activities && d.activities.length>0) setActivities(d.activities);
      if(d.cropTypes && d.cropTypes.length>0) setCropTypes(d.cropTypes);
      if(d.clusters) setClusters(d.clusters);
      if(d.demand) setDemand(d.demand);
      if(d.absences) setAbsences(d.absences);
      if(d.schedule) setSchedule(d.schedule);
      if(d.scheduleSummary) setScheduleSummary(d.scheduleSummary);
      if(d.settings) setTolerance(d.settings.tolerance||5);
    }).catch(()=>{}).finally(()=>setLoading(false));
  },[]);

  const normaliseGH = (gh) => {
    if(typeof gh === "string") return {id:gh, name:gh, cropTypes:[]};
    return {id:gh.id||gh.name||"", name:gh.name||gh.id||"", cropTypes:gh.cropTypes||[]};
  };

  const ghList = greenhouses.map(normaliseGH);
  const ghNames = ghList.map(g=>g.name);

  const allCrops = [...new Set(ghList.flatMap(g=>g.cropTypes||[]))];

  const calcVersatility = (s) => {
    if(!activities.length || !ghNames.length) return 0;
    const a = s.activities.filter(x=>activities.includes(x)).length / activities.length;
    const g = s.greenhouses.filter(x=>ghNames.includes(x)).length / ghNames.length;
    const c = allCrops.length ? s.cropTypes.filter(x=>allCrops.includes(x)).length / allCrops.length : 1;
    return Math.round((a+g+c)/3*100);
  };

  const totalCapacity = staff.reduce((sum,s)=>
    sum+DAYS.reduce((ds,day)=>ds+(s.dayHours?.[day]??s.hoursPerDay??7),0),0);

  const totalDemand = Object.values(demand).reduce((sum,acts)=>
    sum+Object.values(acts).reduce((s,v)=>s+(parseInt(v)||0),0),0);

  const saveData = async() => {
    await axios.post(`${API}/data`,{
      staff, greenhouses:ghList, activities, cropTypes,
      clusters, demand, absences, schedule, scheduleSummary,
      settings:{tolerance}
    });
    setSaved(true);
    setTimeout(()=>setSaved(false),2000);
  };

  const generateSchedule = async() => {
    setGenerating(true);
    setScheduleStale(false);
    try {
      const res = await axios.post(`${API}/optimise`,{
        staff, greenhouses:ghList, activities,
        demand, absences, clusters, tolerance
      });
      if(res.data.schedule){
        setSchedule(res.data.schedule);
        setScheduleSummary(res.data.summary);
        setPage("schedule");
      } else if(res.data.error){
        alert("Optimiser error: "+res.data.error);
      }
    } catch(e){ alert("Network error: "+e.message); }
    setGenerating(false);
  };

  const reoptimise = async(staffId, affectedDays) => {
    setGenerating(true);
    try {
      const res = await axios.post(`${API}/reoptimise`,{
        existingSchedule:schedule, affectedStaffId:staffId,
        affectedDays, staff, greenhouses:ghList, activities,
        demand, absences, clusters, tolerance
      });
      if(res.data.schedule){
        setSchedule(res.data.schedule);
        alert(`Done. ${res.data.affectedTasks} assignments reoptimised with minimum disruption.`);
      }
    } catch(e){ alert("Error: "+e.message); }
    setGenerating(false);
  };

  const btn = (active,color) => ({
    padding:"8px 16px", background:active?"#2ecc71":(color||"#2980b9"),
    color:"white", border:"none", borderRadius:"4px",
    cursor:"pointer", margin:"0 4px", fontSize:"13px"
  });
  const card = {background:"white",borderRadius:"8px",padding:"20px",marginBottom:"20px",boxShadow:"0 2px 4px rgba(0,0,0,0.1)"};
  const inp = {padding:"6px 10px",border:"1px solid #ddd",borderRadius:"4px",fontSize:"13px"};
  const TH = ({children,center}) => <th style={{padding:"10px",textAlign:center?"center":"left",background:"#1a5276",color:"white",fontSize:"13px"}}>{children}</th>;
  const TD = ({children,i,center,color}) => <td style={{padding:"8px",background:i%2===0?"#f8f9fa":"white",textAlign:center?"center":"left",fontSize:"13px",color:color||"inherit"}}>{children}</td>;

  if(loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",fontSize:"18px",color:"#666"}}>
      Loading...
    </div>
  );

  if(!role) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,backgroundImage:"url('https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1600')",backgroundSize:"cover",backgroundPosition:"center",filter:"brightness(0.35)"}}/>
      <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"linear-gradient(135deg,rgba(26,82,118,0.7),rgba(46,204,113,0.5))"}}/>
      <div style={{position:"relative",zIndex:1,textAlign:"center",padding:"20px",width:"100%",maxWidth:"520px"}}>
        <div style={{fontSize:"56px",marginBottom:"8px"}}>🌿</div>
        <h1 style={{color:"white",marginBottom:"6px",fontSize:"28px",textShadow:"0 2px 8px rgba(0,0,0,0.5)"}}>Greenhouse Planner</h1>
        <p style={{color:"rgba(255,255,255,0.85)",marginBottom:"40px",fontSize:"15px"}}>Workforce Allocation & Scheduling System</p>
        <div style={{display:"flex",gap:"20px",justifyContent:"center"}}>
          <div onClick={()=>{setRole("gm");setPage("dashboard");}}
            style={{background:"rgba(26,82,118,0.92)",backdropFilter:"blur(8px)",color:"white",padding:"32px 36px",borderRadius:"14px",cursor:"pointer",flex:1,border:"1px solid rgba(255,255,255,0.2)",boxShadow:"0 8px 32px rgba(0,0,0,0.3)"}}>
            <div style={{fontSize:"40px",marginBottom:"12px"}}>👔</div>
            <div style={{fontWeight:"bold",fontSize:"17px"}}>General Manager</div>
            <div style={{fontSize:"12px",opacity:0.8,marginTop:"8px"}}>Full Access</div>
          </div>
          <div onClick={()=>{setRole("hr");setPage("dashboard");}}
            style={{background:"rgba(39,174,96,0.92)",backdropFilter:"blur(8px)",color:"white",padding:"32px 36px",borderRadius:"14px",cursor:"pointer",flex:1,border:"1px solid rgba(255,255,255,0.2)",boxShadow:"0 8px 32px rgba(0,0,0,0.3)"}}>
            <div style={{fontSize:"40px",marginBottom:"12px"}}>👥</div>
            <div style={{fontWeight:"bold",fontSize:"17px"}}>HR Manager</div>
            <div style={{fontSize:"12px",opacity:0.8,marginTop:"8px"}}>Staff & Operations</div>
          </div>
        </div>
        <p style={{color:"rgba(255,255,255,0.5)",fontSize:"11px",marginTop:"30px"}}>Select your role to continue</p>
      </div>
    </div>
  );

  const tabOrder = ["dashboard","staff",...(role==="gm"?["demand"]:[]),"schedule","absence","edit"];

  return (
    <div style={{background:"#f0f4f8",minHeight:"100vh",fontFamily:"Arial,sans-serif"}}>
      <div style={{background:"#1a5276",padding:"10px 20px",display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap"}}>
        <span style={{color:"white",fontWeight:"bold",fontSize:"16px",marginRight:"12px"}}>🌿 Greenhouse Planner</span>
        {tabOrder.map(p=>(
          <button key={p} style={btn(page===p)} onClick={()=>setPage(p)}>
            {p.charAt(0).toUpperCase()+p.slice(1)}
          </button>
        ))}
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:"8px"}}>
          <span style={{color:"#aed6f1",fontSize:"12px"}}>{role==="gm"?"👔 General Manager":"👥 HR Manager"}</span>
          <button onClick={saveData} style={btn(false,saved?"#27ae60":"#e67e22")}>{saved?"✓ Saved!":"💾 Save"}</button>
          <button onClick={()=>{setRole(null);setPage("dashboard");}} style={btn(false,"#c0392b")}>Exit</button>
        </div>
      </div>

      <div style={{padding:"20px"}}>

        {page==="dashboard" && (
          <div>
            <h2 style={{color:"#1a5276"}}>Dashboard</h2>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"15px",marginBottom:"20px"}}>
              {[[staff.length,"Total Staff","#3498db"],[greenhouses.length,"Greenhouses","#2ecc71"],[activities.length,"Activities","#e67e22"],[cropTypes.length,"Crop Types","#9b59b6"]].map(([val,label,color])=>(
                <div key={label} style={{...card,borderTop:`4px solid ${color}`,textAlign:"center",padding:"20px"}}>
                  <div style={{fontSize:"40px",fontWeight:"bold",color}}>{val}</div>
                  <div style={{color:"#666",marginTop:"4px"}}>{label}</div>
                </div>
              ))}
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"15px",marginBottom:"20px"}}>
              <div style={{...card,borderTop:"4px solid #3498db"}}>
                <h4 style={{color:"#1a5276",margin:"0 0 12px 0"}}>📊 Weekly Capacity vs Demand</h4>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:"6px"}}>
                  <span style={{color:"#666",fontSize:"13px"}}>Staff Capacity:</span>
                  <strong style={{color:"#2980b9"}}>{totalCapacity} hrs</strong>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:"10px"}}>
                  <span style={{color:"#666",fontSize:"13px"}}>Weekly Demand:</span>
                  <strong style={{color:totalDemand>totalCapacity?"#e74c3c":"#27ae60"}}>{totalDemand} hrs</strong>
                </div>
                <div style={{background:"#eee",borderRadius:"4px",overflow:"hidden",height:"14px",marginBottom:"8px"}}>
                  <div style={{width:`${Math.min(totalCapacity>0?totalDemand/totalCapacity*100:0,100)}%`,background:totalDemand>totalCapacity?"#e74c3c":"#2ecc71",height:"100%"}}/>
                </div>
                {totalDemand>totalCapacity && <p style={{color:"#e74c3c",fontSize:"12px",margin:"4px 0"}}>⚠️ Shortfall: {totalDemand-totalCapacity} hrs this week</p>}
                {totalDemand>0 && totalDemand<=totalCapacity && <p style={{color:"#27ae60",fontSize:"12px",margin:"4px 0"}}>✓ Surplus: {totalCapacity-totalDemand} hrs available</p>}
                {scheduleSummary?.shortfallByActivity?.length>0 && (
                  <div style={{marginTop:"10px",background:"#fff5f5",borderRadius:"6px",padding:"10px"}}>
                    <div style={{fontSize:"12px",fontWeight:"bold",color:"#e74c3c",marginBottom:"6px"}}>⚠️ Shortfall by Activity:</div>
                    {scheduleSummary.shortfallByActivity.map((s,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:"12px",marginBottom:"3px"}}>
                        <span style={{color:"#666"}}>{s.gh} — {s.activity}</span>
                        <span style={{color:"#e74c3c",fontWeight:"bold"}}>-{s.hours}h</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{...card,borderTop:"4px solid #e67e22"}}>
                <h4 style={{color:"#1a5276",margin:"0 0 12px 0"}}>⚙️ Optimisation Settings</h4>
                <div style={{marginBottom:"16px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:"6px"}}>
                    <label style={{fontSize:"13px",color:"#666"}}>Whole-day preference tolerance:</label>
                    <strong style={{color:"#e67e22"}}>{tolerance}%</strong>
                  </div>
                  <input type="range" min="0" max="20" value={tolerance}
                    onChange={e=>setTolerance(parseInt(e.target.value))}
                    style={{width:"100%",accentColor:"#e67e22"}}
                  />
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:"11px",color:"#aaa",marginTop:"4px"}}>
                    <span>0% — Pure optimisation</span>
                    <span>20% — Max human factors</span>
                  </div>
                  {tolerance===0 && <p style={{color:"#e74c3c",fontSize:"12px",marginTop:"4px"}}>⚡ Pure optimisation mode — all cluster constraints ignored</p>}
                  {tolerance>0 && tolerance<=5 && <p style={{color:"#27ae60",fontSize:"12px",marginTop:"4px"}}>✓ Balanced — human factors protected within {tolerance}%</p>}
                  {tolerance>5 && <p style={{color:"#2980b9",fontSize:"12px",marginTop:"4px"}}>👥 Staff-friendly mode — strong cluster & whole-day preference</p>}
                </div>
                <div style={{borderTop:"1px solid #eee",paddingTop:"10px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
                    <span style={{color:"#666",fontSize:"13px"}}>High versatility staff (75%+):</span>
                    <strong style={{color:"#2ecc71"}}>{staff.filter(s=>calcVersatility(s)>=75).length}</strong>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{color:"#666",fontSize:"13px"}}>Avg hours/day:</span>
                    <strong>{staff.length>0?(staff.reduce((s,x)=>s+(x.hoursPerDay??7),0)/staff.length).toFixed(1):0}h</strong>
                  </div>
                </div>
              </div>
            </div>

            <div style={card}>
              <h3 style={{color:"#1a5276",marginBottom:"6px"}}>🏘️ Greenhouse Clusters</h3>
              <p style={{color:"#888",fontSize:"13px",marginBottom:"10px"}}>Group nearby greenhouses into clusters. One greenhouse can appear in multiple clusters. Greenhouses not in any cluster are treated independently.</p>
              {clusters.length===0 && <p style={{color:"#aaa",fontSize:"13px",marginBottom:"10px"}}>No clusters defined. All greenhouses treated independently.</p>}
              {clusters.map((cluster,ci)=>(
                <div key={ci} style={{background:"#f8f9fa",borderRadius:"8px",padding:"14px",marginBottom:"12px",border:"1px solid #e0e0e0"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"10px"}}>
                    <input value={cluster.name}
                      onChange={e=>{const c=[...clusters];c[ci]={...c[ci],name:e.target.value};setClusters(c);}}
                      style={{...inp,fontWeight:"bold"}} placeholder="Cluster name e.g. North Block"/>
                    <span style={{color:"#888",fontSize:"12px"}}>{cluster.greenhouses.length} greenhouses</span>
                    <button onClick={()=>setClusters(clusters.filter((_,i)=>i!==ci))} style={btn(false,"#e74c3c")}>Remove</button>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
                    {ghNames.map(gh=>(
                      <label key={gh} style={{display:"flex",alignItems:"center",gap:"4px",background:cluster.greenhouses.includes(gh)?"#d5f5e3":"white",padding:"5px 10px",borderRadius:"4px",border:`1px solid ${cluster.greenhouses.includes(gh)?"#2ecc71":"#ddd"}`,cursor:"pointer",fontSize:"13px"}}>
                        <input type="checkbox" checked={cluster.greenhouses.includes(gh)}
                          onChange={e=>{const c=[...clusters];c[ci]={...c[ci],greenhouses:e.target.checked?[...c[ci].greenhouses,gh]:c[ci].greenhouses.filter(g=>g!==gh)};setClusters(c);}}
                        />{gh}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <button onClick={()=>setClusters([...clusters,{name:`Cluster ${clusters.length+1}`,greenhouses:[]}])} style={btn(false,"#27ae60")}>+ Add New Cluster</button>
              {ghNames.filter(gh=>!clusters.some(c=>c.greenhouses.includes(gh))).length>0 && (
                <div style={{marginTop:"12px",background:"#f0f4f8",borderRadius:"6px",padding:"10px"}}>
                  <div style={{fontSize:"12px",color:"#888",marginBottom:"6px"}}>🏠 Independent (not in any cluster):</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:"4px"}}>
                    {ghNames.filter(gh=>!clusters.some(c=>c.greenhouses.includes(gh))).map(gh=>(
                      <span key={gh} style={{background:"#ddd",padding:"3px 8px",borderRadius:"4px",fontSize:"12px",color:"#555"}}>{gh}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {page==="staff" && (
          <div>
            <h2 style={{color:"#1a5276"}}>Staff Registry — {staff.length} Members</h2>
            {staff.length===0?(
              <div style={card}><p style={{color:"#888"}}>No staff added yet. Go to <strong>Edit</strong> tab to add staff.</p></div>
            ):(
              <div style={card}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead>
                    <tr>
                      <TH>ID</TH><TH>Name</TH><TH>Activities</TH>
                      <TH>Greenhouses</TH><TH>Crop Types</TH>
                      <TH center>Hrs/Day</TH><TH center>OT Limit</TH>
                      <TH>Versatility</TH><TH>Profile</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((s,i)=>{
                      const v=calcVersatility(s);
                      return (
                        <tr key={s.id}>
                          <TD i={i}><span style={{fontFamily:"monospace",color:"#1a5276",fontWeight:"bold"}}>{s.id}</span></TD>
                          <TD i={i}>{s.name}</TD>
                          <TD i={i}>{s.activities.filter(x=>activities.includes(x)).length}/{activities.length}</TD>
                          <TD i={i}>{s.greenhouses.filter(x=>ghNames.includes(x)).length}/{ghNames.length}</TD>
                          <TD i={i}>{s.cropTypes.filter(x=>cropTypes.includes(x)).length}/{cropTypes.length}</TD>
                          <TD i={i} center>{s.hoursPerDay??7}h</TD>
                          <TD i={i} center>{s.overtimeLimit??(v>=75?10:5)}h</TD>
                          <TD i={i}>
                            <div style={{background:"#eee",borderRadius:"4px",overflow:"hidden",minWidth:"80px"}}>
                              <div style={{width:`${v}%`,background:v>75?"#2ecc71":v>50?"#f39c12":"#e74c3c",padding:"2px 6px",color:"white",fontSize:"11px"}}>{v}%</div>
                            </div>
                          </TD>
                          <TD i={i}><button onClick={()=>setSelectedStaff({...s})} style={btn(false,"#8e44ad")}>View</button></TD>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {page==="demand" && role==="gm" && (
          <div>
            <h2 style={{color:"#1a5276"}}>Weekly Demand Entry</h2>
            {scheduleStale && <div style={{background:"#fff3cd",border:"1px solid #ffc107",borderRadius:"6px",padding:"10px",marginBottom:"15px",fontSize:"13px",color:"#856404"}}>⚠️ Demand has changed since last schedule generation. Regenerate to update.</div>}
            <div style={card}>
              <p style={{color:"#888",fontSize:"13px",marginBottom:"15px"}}>Enter total hours per activity per greenhouse for the <strong>entire week</strong>. The optimiser distributes across working days automatically.</p>
              <div style={{overflowX:"auto"}}>
                <table style={{borderCollapse:"collapse",fontSize:"12px"}}>
                  <thead>
                    <tr style={{background:"#1a5276",color:"white"}}>
                      <th style={{padding:"8px",minWidth:"110px",position:"sticky",left:0,background:"#1a5276",zIndex:1}}>Greenhouse</th>
                      <th style={{padding:"8px",minWidth:"130px",background:"#1a5276"}}>Crop Types</th>
                      {activities.map(a=><th key={a} style={{padding:"6px 4px",minWidth:"80px",textAlign:"center"}}>{a}</th>)}
                      <th style={{padding:"6px",minWidth:"65px",textAlign:"center",background:"#1a5276"}}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ghList.map((gh,i)=>{
                      const ghName=gh.name;
                      const ghCrops=(gh.cropTypes||[]).join(", ")||"—";
                      const rowTotal=activities.reduce((sum,act)=>sum+(parseInt(demand[ghName]?.[act])||0),0);
                      return (
                        <tr key={ghName} style={{background:i%2===0?"#f8f9fa":"white"}}>
                          <td style={{padding:"6px 8px",fontWeight:"bold",color:"#1a5276",position:"sticky",left:0,background:i%2===0?"#f8f9fa":"white",fontSize:"12px",zIndex:1}}>{ghName}</td>
                          <td style={{padding:"6px 8px",fontSize:"11px",color:"#888",fontStyle:"italic"}}>{ghCrops}</td>
                          {activities.map(activity=>(
                            <td key={activity} style={{padding:"3px",textAlign:"center"}}>
                              <input type="number" min="0" max="500"
                                value={demand[ghName]?.[activity]||""}
                                onChange={e=>{
                                  const val=parseInt(e.target.value)||0;
                                  setDemand(prev=>({...prev,[ghName]:{...prev[ghName],[activity]:val}}));
                                  setScheduleStale(true);
                                }}
                                style={{width:"55px",padding:"3px",border:"1px solid #ddd",borderRadius:"3px",textAlign:"center",fontSize:"12px"}}
                              />
                            </td>
                          ))}
                          <td style={{padding:"6px",textAlign:"center",fontWeight:"bold",color:rowTotal>0?"#1a5276":"#aaa",fontSize:"12px"}}>{rowTotal}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{marginTop:"20px",display:"flex",gap:"10px",alignItems:"center",flexWrap:"wrap"}}>
                <button onClick={generateSchedule} disabled={generating}
                  style={{...btn(false,"#2ecc71"),padding:"12px 28px",fontSize:"15px",opacity:generating?0.7:1}}>
                  {generating?"⏳ Optimising...":"🚀 Generate Optimised Plan"}
                </button>
                <button onClick={()=>{setDemand({});setScheduleStale(true);}} style={btn(false,"#e74c3c")}>🗑️ Clear</button>
                <span style={{color:"#888",fontSize:"13px"}}>
                  Demand: <strong>{totalDemand}h</strong> | Capacity: <strong style={{color:totalDemand>totalCapacity?"#e74c3c":"#27ae60"}}>{totalCapacity}h</strong>
                  {totalDemand>totalCapacity && <span style={{color:"#e74c3c"}}> | ⚠️ -{totalDemand-totalCapacity}h</span>}
                  {totalDemand>0 && totalDemand<=totalCapacity && <span style={{color:"#27ae60"}}> | +{totalCapacity-totalDemand}h surplus</span>}
                </span>
              </div>
            </div>
          </div>
        )}

        {page==="schedule" && (
          <div>
            <h2 style={{color:"#1a5276"}}>Weekly Schedule</h2>
            {!schedule?(
              <div style={card}><p style={{color:"#888"}}>{role==="gm"?"No schedule yet. Go to Demand and click Generate.":"No schedule available yet."}</p></div>
            ):(
              <div>
                {scheduleSummary && (
                  <div style={{...card,background:"#eafaf1",padding:"15px"}}>
                    <div style={{display:"flex",gap:"20px",flexWrap:"wrap",fontSize:"13px"}}>
                      <span>✅ <strong>Assigned:</strong> {scheduleSummary.totalAssigned}h</span>
                      <span style={{color:scheduleSummary.totalUnassigned>0?"#e74c3c":"#27ae60"}}>
                        {scheduleSummary.totalUnassigned>0?"⚠️":"✓"} <strong>Unassigned:</strong> {scheduleSummary.totalUnassigned}h
                      </span>
                      <span>📊 <strong>Demand:</strong> {scheduleSummary.totalDemand}h</span>
                      <span>👥 <strong>Capacity:</strong> {scheduleSummary.totalCapacity}h</span>
                      {scheduleSummary.surplusHours>0 && <span style={{color:"#27ae60"}}>💚 Surplus: {scheduleSummary.surplusHours}h</span>}
                      {scheduleSummary.shortfallHours>0 && <span style={{color:"#e74c3c"}}>🔴 Shortfall: {scheduleSummary.shortfallHours}h</span>}
                    </div>
                  </div>
                )}
                {DAYS.map(day=>(
                  <div key={day} style={card}>
                    <h3 style={{color:"#1a5276",marginBottom:"10px"}}>
                      {day} — {(schedule[day]||[]).filter(x=>!x.unassigned).length} assignments
                      {(schedule[day]||[]).filter(x=>x.unassigned).length>0 &&
                        <span style={{color:"#e74c3c",fontSize:"13px"}}> | ⚠️ {(schedule[day]||[]).filter(x=>x.unassigned).length} unassigned</span>}
                    </h3>
                    {!(schedule[day]||[]).length ? <p style={{color:"#888",fontSize:"13px"}}>No assignments</p>:
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px"}}>
                        <thead><tr><TH>Staff ID</TH><TH>Name</TH><TH>Greenhouse</TH><TH>Activity</TH><TH center>Hours</TH></tr></thead>
                        <tbody>
                          {(schedule[day]||[]).map((a,i)=>(
                            <tr key={i} style={{background:a.reoptimised?"#fffbea":a.unassigned?"#fde8e8":i%2===0?"#f8f9fa":"white"}}>
                              <td style={{padding:"8px",fontFamily:"monospace",color:a.unassigned?"#e74c3c":"#1a5276",fontSize:"13px"}}>{a.staffId}</td>
                              <td style={{padding:"8px",fontSize:"13px"}}>
                                {a.unassigned
                                  ? <span style={{color:"#e74c3c"}}>⚠️ {a.staffName}</span>
                                  : <button onClick={()=>{const s=staff.find(x=>x.id===a.staffId);if(s)setSelectedStaff(s);}} style={{background:"none",border:"none",color:"#2980b9",cursor:"pointer",textDecoration:"underline",fontSize:"13px",padding:0}}>{a.staffName}</button>
                                }
                                {a.reoptimised && <span style={{fontSize:"11px",color:"#f39c12",marginLeft:"6px"}}>↻</span>}
                              </td>
                              <td style={{padding:"8px",fontSize:"13px"}}>{a.greenhouse}</td>
                              <td style={{padding:"8px",fontSize:"13px"}}>{a.activity}</td>
                              <td style={{padding:"8px",textAlign:"center",fontSize:"13px"}}>{a.hours}h</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    }
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {page==="absence" && (
          <div>
            <h2 style={{color:"#1a5276"}}>Absence Management</h2>
            {staff.length===0?(
              <div style={card}><p style={{color:"#888"}}>No staff added yet.</p></div>
            ):(
              <div style={card}>
                <p style={{color:"#888",fontSize:"13px",marginBottom:"4px"}}>Enter reduced hours or mark absent. These are <strong>weekly overrides only</strong> — staff profiles unchanged.</p>
                <p style={{color:"#aaa",fontSize:"12px",marginBottom:"15px"}}>Blank = normal hours | Number = partial hours that day | Tick = fully absent</p>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
                    <thead>
                      <tr>
                        <TH>ID</TH><TH>Name</TH>
                        {DAYS.map(d=>(
                          <th key={d} colSpan="2" style={{padding:"8px",textAlign:"center",background:"#1a5276",color:"white",fontSize:"12px",borderLeft:"1px solid #2471a3"}}>{d.slice(0,3)}</th>
                        ))}
                        <TH center>Abs</TH>
                      </tr>
                      <tr style={{background:"#2471a3"}}>
                        <td colSpan="2"></td>
                        {DAYS.map(d=>(
                          <React.Fragment key={d}>
                            <td style={{padding:"3px 6px",textAlign:"center",color:"rgba(255,255,255,0.8)",fontSize:"11px",borderLeft:"1px solid #2980b9"}}>Hrs</td>
                            <td style={{padding:"3px 6px",textAlign:"center",color:"rgba(255,255,255,0.8)",fontSize:"11px"}}>Off</td>
                          </React.Fragment>
                        ))}
                        <td></td>
                      </tr>
                    </thead>
                    <tbody>
                      {staff.map((s,i)=>{
                        const totalAbs=DAYS.filter(d=>{
                          const al=absences[d]||[];
                          return al.includes(s.id)||al.some(x=>typeof x==="object"&&x.id===s.id&&x.hours===0);
                        }).length;
                        return (
                          <tr key={s.id} style={{background:i%2===0?"#f8f9fa":"white"}}>
                            <TD i={i}><span style={{fontFamily:"monospace",color:"#1a5276",fontWeight:"bold",fontSize:"11px"}}>{s.id}</span></TD>
                            <TD i={i}>{s.name}</TD>
                            {DAYS.map(day=>{
                              const al=absences[day]||[];
                              const isAbsent=al.includes(s.id)||al.some(x=>typeof x==="object"&&x.id===s.id&&x.hours===0);
                              const partialEntry=al.find(x=>typeof x==="object"&&x.id===s.id&&x.hours>0);
                              return (
                                <React.Fragment key={day}>
                                  <td style={{padding:"3px",textAlign:"center",background:i%2===0?"#f8f9fa":"white",borderLeft:"1px solid #eee"}}>
                                    <input type="number" min="0" max="12"
                                      value={isAbsent?"":(partialEntry?partialEntry.hours:"")}
                                      disabled={isAbsent}
                                      placeholder={s.dayHours?.[day]??s.hoursPerDay??7}
                                      onChange={e=>{
                                        const val=parseInt(e.target.value)||0;
                                        setAbsences(prev=>{
                                          const cur=(prev[day]||[]).filter(x=>x!==s.id&&(typeof x!=="object"||x.id!==s.id));
                                          return val>0?{...prev,[day]:[...cur,{id:s.id,hours:val}]}:{...prev,[day]:cur};
                                        });
                                      }}
                                      style={{width:"40px",padding:"2px",border:"1px solid #ddd",borderRadius:"3px",textAlign:"center",fontSize:"11px",background:isAbsent?"#f5f5f5":"white"}}
                                    />
                                  </td>
                                  <td style={{padding:"3px",textAlign:"center",background:i%2===0?"#f8f9fa":"white"}}>
                                    <input type="checkbox" checked={isAbsent}
                                      onChange={e=>{
                                        setAbsences(prev=>{
                                          const cur=(prev[day]||[]).filter(x=>x!==s.id&&(typeof x!=="object"||x.id!==s.id));
                                          return e.target.checked?{...prev,[day]:[...cur,s.id]}:{...prev,[day]:cur};
                                        });
                                      }}
                                    />
                                  </td>
                                </React.Fragment>
                              );
                            })}
                            <td style={{padding:"6px",textAlign:"center",fontWeight:"bold",color:totalAbs>0?"#e74c3c":"#aaa",background:i%2===0?"#f8f9fa":"white",fontSize:"12px"}}>{totalAbs}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{marginTop:"15px",display:"flex",gap:"10px",flexWrap:"wrap",alignItems:"center"}}>
                  {role==="gm" && (
                    <button onClick={generateSchedule} disabled={generating}
                      style={{...btn(false,"#2ecc71"),opacity:generating?0.7:1}}>
                      {generating?"⏳ Optimising...":"🚀 Full Regenerate"}
                    </button>
                  )}
                  {schedule && staff.filter(s=>DAYS.some(d=>{const al=absences[d]||[];return al.includes(s.id)||al.some(x=>typeof x==="object"&&x.id===s.id);})).map(s=>{
                    const affectedDays=DAYS.filter(d=>{const al=absences[d]||[];return al.includes(s.id)||al.some(x=>typeof x==="object"&&x.id===s.id);});
                    return (
                      <button key={s.id} onClick={()=>reoptimise(s.id,affectedDays)} disabled={generating}
                        style={{...btn(false,"#f39c12"),fontSize:"12px",opacity:generating?0.7:1}}>
                        ↻ Min-disrupt: {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {page==="edit" && (
          <div>
            <h2 style={{color:"#1a5276"}}>Edit Master Data</h2>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"20px"}}>

              <div style={card}>
                <h3 style={{color:"#1a5276",marginBottom:"6px"}}>🏗️ Greenhouses ({greenhouses.length})</h3>
                <p style={{color:"#888",fontSize:"12px",marginBottom:"10px"}}>Name each greenhouse and assign its crop types.</p>
                <div style={{maxHeight:"340px",overflowY:"auto",marginBottom:"12px"}}>
                  {ghList.map((gh,i)=>(
                    <div key={i} style={{background:"#f8f9fa",borderRadius:"6px",padding:"10px",marginBottom:"8px",border:"1px solid #eee"}}>
                      <div style={{display:"flex",gap:"8px",marginBottom:"8px",alignItems:"center"}}>
                        <input value={gh.name}
                          onChange={e=>{
                            const g=[...greenhouses];
                            g[i]={...normaliseGH(g[i]),name:e.target.value,id:e.target.value};
                            setGreenhouses(g);
                          }}
                          style={{...inp,flex:1}} placeholder="Greenhouse name"/>
                        <button onClick={()=>setGreenhouses(greenhouses.filter((_,j)=>j!==i))} style={btn(false,"#e74c3c")}>✕</button>
                      </div>
                      <div style={{fontSize:"12px",color:"#666",marginBottom:"5px"}}>Crop types grown here:</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:"4px"}}>
                        {cropTypes.map(ct=>(
                          <label key={ct} style={{display:"flex",alignItems:"center",gap:"3px",background:(gh.cropTypes||[]).includes(ct)?"#d5f5e3":"white",padding:"3px 8px",borderRadius:"4px",border:`1px solid ${(gh.cropTypes||[]).includes(ct)?"#2ecc71":"#ddd"}`,cursor:"pointer",fontSize:"12px"}}>
                            <input type="checkbox"
                              checked={(gh.cropTypes||[]).includes(ct)}
                              onChange={e=>{
                                const g=[...greenhouses];
                                const crops=gh.cropTypes||[];
                                g[i]={...normaliseGH(g[i]),cropTypes:e.target.checked?[...crops,ct]:crops.filter(c=>c!==ct)};
                                setGreenhouses(g);
                              }}
                            />{ct}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={()=>setGreenhouses([...greenhouses,{id:`GH-${String(greenhouses.length+1).padStart(2,"0")}`,name:`GH-${String(greenhouses.length+1).padStart(2,"0")}`,cropTypes:[]}])} style={btn(false,"#27ae60")}>+ Add Greenhouse</button>
              </div>

              <div style={card}>
                <h3 style={{color:"#1a5276",marginBottom:"12px"}}>🌱 Crop Types ({cropTypes.length})</h3>
                <div style={{maxHeight:"200px",overflowY:"auto",marginBottom:"12px"}}>
                  {cropTypes.map((ct,i)=>(
                    <div key={i} style={{display:"flex",gap:"8px",marginBottom:"6px"}}>
                      <input value={ct} onChange={e=>{const c=[...cropTypes];c[i]=e.target.value;setCropTypes(c);}} style={{...inp,flex:1}}/>
                      <button onClick={()=>setCropTypes(cropTypes.filter((_,j)=>j!==i))} style={btn(false,"#e74c3c")}>✕</button>
                    </div>
                  ))}
                </div>
                <button onClick={()=>setCropTypes([...cropTypes,"New Crop Type"])} style={btn(false,"#27ae60")}>+ Add Crop Type</button>
              </div>

              <div style={card}>
                <h3 style={{color:"#1a5276",marginBottom:"12px"}}>⚙️ Activities ({activities.length})</h3>
                <div style={{maxHeight:"200px",overflowY:"auto",marginBottom:"12px"}}>
                  {activities.map((act,i)=>(
                    <div key={i} style={{display:"flex",gap:"8px",marginBottom:"6px"}}>
                      <input value={act} onChange={e=>{const a=[...activities];a[i]=e.target.value;setActivities(a);}} style={{...inp,flex:1}}/>
                      <button onClick={()=>setActivities(activities.filter((_,j)=>j!==i))} style={btn(false,"#e74c3c")}>✕</button>
                    </div>
                  ))}
                </div>
                <button onClick={()=>setActivities([...activities,"New Activity"])} style={btn(false,"#27ae60")}>+ Add Activity</button>
              </div>

              <div style={card}>
                <h3 style={{color:"#1a5276",marginBottom:"12px"}}>👤 Add New Staff Member</h3>
                <AddStaffForm staff={staff} setStaff={setStaff} btn={btn} inp={inp}/>
              </div>

            </div>

            {staff.length>0 && (
              <div style={{...card,marginTop:"20px"}}>
                <h3 style={{color:"#1a5276",marginBottom:"12px"}}>👥 Manage Staff ({staff.length})</h3>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr><TH>ID</TH><TH>Name</TH><TH center>Hrs/Day</TH><TH center>OT Limit</TH><TH>Versatility</TH><TH>Actions</TH></tr></thead>
                  <tbody>
                    {staff.map((s,i)=>{
                      const v=calcVersatility(s);
                      return (
                        <tr key={s.id} style={{background:i%2===0?"#f8f9fa":"white"}}>
                          <TD i={i}><span style={{fontFamily:"monospace",color:"#1a5276",fontWeight:"bold"}}>{s.id}</span></TD>
                          <TD i={i}>{s.name}</TD>
                          <TD i={i} center>{s.hoursPerDay??7}h</TD>
                          <TD i={i} center>{s.overtimeLimit??(v>=75?10:5)}h</TD>
                          <TD i={i}>
                            <div style={{background:"#eee",borderRadius:"4px",overflow:"hidden",minWidth:"80px"}}>
                              <div style={{width:`${v}%`,background:v>75?"#2ecc71":v>50?"#f39c12":"#e74c3c",padding:"2px 6px",color:"white",fontSize:"11px"}}>{v}%</div>
                            </div>
                          </TD>
                          <TD i={i}>
                            <button onClick={()=>setSelectedStaff({...s})} style={btn(false,"#8e44ad")}>✏️ Edit</button>
                            <button onClick={()=>{if(window.confirm(`Remove ${s.name}?`))setStaff(staff.filter(x=>x.id!==s.id));}} style={btn(false,"#e74c3c")}>🗑️</button>
                          </TD>
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

      {selectedStaff && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
          <div style={{background:"white",borderRadius:"12px",padding:"28px",maxWidth:"760px",width:"95%",maxHeight:"92vh",overflowY:"auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"20px"}}>
              <div>
                <h2 style={{color:"#1a5276",margin:"0 0 4px 0"}}>{selectedStaff.name}</h2>
                <span style={{fontFamily:"monospace",color:"#888",fontSize:"13px"}}>{selectedStaff.id}</span>
              </div>
              <button onClick={()=>setSelectedStaff(null)} style={btn(false,"#e74c3c")}>✕ Close</button>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"10px",marginBottom:"20px"}}>
              {[
                [calcVersatility(selectedStaff)+"%","Versatility","#2980b9","#eaf2ff"],
                [DAYS.filter(d=>{const al=absences[d]||[];return al.includes(selectedStaff.id)||al.some(x=>typeof x==="object"&&x.id===selectedStaff.id&&x.hours===0);}).length,"Absent Days","#e74c3c","#fdf2f2"],
                [selectedStaff.hoursPerDay??7,"Default Hrs/Day","#27ae60","#f0fff4"],
                [selectedStaff.overtimeLimit??(calcVersatility(selectedStaff)>=75?10:5),"OT Limit/Wk","#8e44ad","#f8f4ff"]
              ].map(([val,label,color,bg])=>(
                <div key={label} style={{background:bg,padding:"12px",borderRadius:"8px",textAlign:"center"}}>
                  <div style={{fontSize:"22px",fontWeight:"bold",color}}>{val}</div>
                  <div style={{fontSize:"11px",color:"#666"}}>{label}</div>
                </div>
              ))}
            </div>

            <div style={{marginBottom:"18px"}}>
              <h4 style={{color:"#1a5276",marginBottom:"8px"}}>✏️ Name, ID & Settings</h4>
              <div style={{display:"flex",gap:"10px",flexWrap:"wrap",marginBottom:"8px"}}>
                <input value={selectedStaff.id}
                  onChange={e=>{const u={...selectedStaff,id:e.target.value};setSelectedStaff(u);setStaff(staff.map(s=>s.id===selectedStaff.id?u:s));}}
                  style={{...inp,flex:1,minWidth:"100px"}} placeholder="Staff ID"/>
                <input value={selectedStaff.name}
                  onChange={e=>{const u={...selectedStaff,name:e.target.value};setSelectedStaff(u);setStaff(staff.map(s=>s.id===selectedStaff.id?u:s));}}
                  style={{...inp,flex:2,minWidth:"150px"}} placeholder="Full Name"/>
              </div>
              <div style={{display:"flex",gap:"10px",alignItems:"center",flexWrap:"wrap"}}>
                <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                  <label style={{fontSize:"13px",color:"#666"}}>Default hrs/day:</label>
                  <input type="number" min="1" max="12"
                    value={selectedStaff.hoursPerDay??7}
                    onChange={e=>{const u={...selectedStaff,hoursPerDay:parseInt(e.target.value)||7};setSelectedStaff(u);setStaff(staff.map(s=>s.id===selectedStaff.id?u:s));}}
                    style={{...inp,width:"55px",textAlign:"center"}}/>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                  <label style={{fontSize:"13px",color:"#666"}}>OT limit/week:</label>
                  <input type="number" min="0" max="20"
                    value={selectedStaff.overtimeLimit??(calcVersatility(selectedStaff)>=75?10:5)}
                    onChange={e=>{const u={...selectedStaff,overtimeLimit:parseInt(e.target.value)||0};setSelectedStaff(u);setStaff(staff.map(s=>s.id===selectedStaff.id?u:s));}}
                    style={{...inp,width:"55px",textAlign:"center"}}/>
                </div>
              </div>
            </div>

            <div style={{marginBottom:"18px"}}>
              <h4 style={{color:"#1a5276",marginBottom:"8px"}}>🕐 Hours Per Day</h4>
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"8px"}}>
                {DAYS.map(day=>(
                  <div key={day} style={{textAlign:"center"}}>
                    <div style={{fontSize:"12px",color:"#666",marginBottom:"4px"}}>{day.slice(0,3)}</div>
                    <input type="number" min="0" max="12"
                      value={selectedStaff.dayHours?.[day]??selectedStaff.hoursPerDay??7}
                      onChange={e=>{
                        const val=parseInt(e.target.value)||0;
                        const u={...selectedStaff,dayHours:{...(selectedStaff.dayHours||{}),[day]:val}};
                        setSelectedStaff(u);
                        setStaff(staff.map(s=>s.id===selectedStaff.id?u:s));
                      }}
                      style={{...inp,width:"100%",textAlign:"center"}}/>
                  </div>
                ))}
              </div>
              <p style={{color:"#aaa",fontSize:"12px",marginTop:"6px"}}>These are permanent. Use Absence tab for one-off weekly changes.</p>
            </div>

            {[
              ["⚙️ Activities",activities,"activities","#d5f5e3","#2ecc71"],
              ["🏗️ Greenhouses",ghNames,"greenhouses","#d5e8ff","#2980b9"],
              ["🌱 Crop Types",cropTypes,"cropTypes","#fdebd0","#e67e22"]
            ].map(([label,list,key,bg,color])=>(
              <div key={key} style={{marginBottom:"18px"}}>
                <h4 style={{color:"#1a5276",marginBottom:"8px"}}>{label} ({(selectedStaff[key]||[]).filter(x=>list.includes(x)).length}/{list.length})</h4>
                <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
                  {list.map(item=>(
                    <label key={item} style={{display:"flex",alignItems:"center",gap:"4px",background:(selectedStaff[key]||[]).includes(item)?bg:"#f8f9fa",padding:"5px 10px",borderRadius:"4px",border:`1px solid ${(selectedStaff[key]||[]).includes(item)?color:"#ddd"}`,cursor:"pointer",fontSize:"13px"}}>
                      <input type="checkbox"
                        checked={(selectedStaff[key]||[]).includes(item)}
                        onChange={e=>{
                          const newList=e.target.checked?[...(selectedStaff[key]||[]),item]:(selectedStaff[key]||[]).filter(x=>x!==item);
                          const u={...selectedStaff,[key]:newList};
                          setSelectedStaff(u);
                          setStaff(staff.map(s=>s.id===u.id?u:s));
                        }}
                      />{item}
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:"10px"}}>
              <button onClick={()=>{if(window.confirm(`Remove ${selectedStaff.name}?`)){setStaff(staff.filter(x=>x.id!==selectedStaff.id));setSelectedStaff(null);}}} style={btn(false,"#e74c3c")}>🗑️ Remove Staff</button>
              <button onClick={()=>setSelectedStaff(null)} style={btn(false,"#27ae60")}>✓ Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddStaffForm({staff,setStaff,btn,inp}){
  const [name,setName]=useState("");
  const [id,setId]=useState("");
  const [hours,setHours]=useState(7);
  const add=()=>{
    if(!name.trim()||!id.trim()) return alert("Please enter both Staff ID and Name");
    if(staff.find(s=>s.id===id.trim())) return alert("Staff ID already exists");
    setStaff([...staff,{
      id:id.trim(), name:name.trim(),
      hoursPerDay:parseInt(hours)||7,
      dayHours:{}, overtimeLimit:5,
      activities:[], greenhouses:[], cropTypes:[],
      versatility:0
    }]);
    setName(""); setId(""); setHours(7);
  };
  return (
    <div>
      <input value={id} onChange={e=>setId(e.target.value)} style={{...inp,width:"100%",marginBottom:"8px",boxSizing:"border-box"}} placeholder="Staff ID (e.g. STF001)"/>
      <input value={name} onChange={e=>setName(e.target.value)} style={{...inp,width:"100%",marginBottom:"8px",boxSizing:"border-box"}} placeholder="Full Name"/>
      <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"12px"}}>
        <label style={{fontSize:"13px",color:"#666"}}>Default hours/day:</label>
        <input type="number" min="1" max="12" value={hours} onChange={e=>setHours(e.target.value)} style={{...inp,width:"65px",textAlign:"center"}}/>
      </div>
      <button onClick={add} style={btn(false,"#27ae60")}>+ Add Staff Member</button>
      <p style={{color:"#888",fontSize:"12px",marginTop:"8px"}}>After adding, click Edit to assign skills, greenhouses and crop types.</p>
    </div>
  );
}
'''

with open(r'C:\Users\sanje\greenhouse-planner\frontend\src\App.js','w',encoding='utf-8') as f:
    f.write(code)
print('App.js written successfully!')