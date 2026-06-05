/* gate */
let pendingToken=null;
function showCreate(){document.getElementById("gateCreate").classList.remove("hide");document.getElementById("gateSignin").classList.add("hide");pendingToken=generateToken();showToken(document.getElementById("newAcct"),pendingToken);}
function showSignin(){document.getElementById("gateCreate").classList.add("hide");document.getElementById("gateSignin").classList.remove("hide");}
document.getElementById("toSignin").onclick=showSignin;document.getElementById("toCreate").onclick=showCreate;
document.getElementById("regenAcct").onclick=()=>{pendingToken=generateToken();showToken(document.getElementById("newAcct"),pendingToken);};
document.getElementById("copyAcct").onclick=()=>{navigator.clipboard&&navigator.clipboard.writeText(pendingToken);toast("Copied");};
document.getElementById("confirmAcct").onclick=async()=>{LS.set("nw_token",pendingToken);try{await deriveKeys(pendingToken);}catch(e){}state=emptyState();setBaseline();saveLocal();enterApp();try{pushServer();}catch(e){}try{fetchFx().then(ok=>{if(ok){scheduleSync();renderAll();}}).catch(()=>{});}catch(e){}};
document.getElementById("signinBtn").onclick=async()=>{const t=document.getElementById("signinInput").value.trim();if(!validToken(t)){toast("That's not a valid account number");return;}const canon=canonToken(t);LS.set("nw_token",canon);try{await deriveKeys(canon);}catch(e){}const rem=await loadServer();const loc=loadLocal();state=migrate(rem&&rem.snapshots?(loc&&loc.snapshots?mergeStates(migrate(loc),migrate(rem)):rem):(loc||emptyState()));setBaseline();enterApp();try{pushServer();}catch(e){}};
async function boot(){
  try{
    const tok=LS.get("nw_token");
    if(!tok){showCreate();return;}
    try{await deriveKeys(tok);}catch(e){}
    let rem=null; try{rem=await loadServer();}catch(e){rem=null;}
    let repair=false;
    try{
      const loc=loadLocal();
      const remOk=rem&&rem.snapshots, locOk=loc&&loc.snapshots;
      if(remOk&&locOk){
        // Merge per record (newest m wins, deletions honoured) — never clobber whole-doc.
        state=migrate(mergeStates(migrate(loc),migrate(rem)));repair=true;
      }else{state=migrate(remOk?rem:(locOk?loc:emptyState()));}
    }catch(e){state=emptyState();}
    setBaseline();
    enterApp();
    // Push the reconciled/merged result so the server and this device converge.
    if(repair){try{pushServer();}catch(e){}}
  }catch(e){
    // absolute fallback: never leave a blank screen
    try{state=emptyState();}catch(_){}
    try{showCreate();}catch(_){}
  }
}
function enterApp(){
  try{
    document.getElementById("gate").classList.add("hide");
    document.getElementById("app").classList.remove("hide");
    document.getElementById("dateline").textContent=new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});
    document.getElementById("ccySel").innerHTML=CCYS.map(c=>`<option ${c===state.baseCcy?"selected":""}>${c}</option>`).join("");
    renderAll();
    // Refresh live FX rates + ticker prices (and value past-year holdings at that year's
    // close + ECB FX). Silent; re-render once fresh data lands. Won't block first paint.
    try{autoRefresh().then(ch=>{if(ch){scheduleSync();renderAll();}}).catch(()=>{});}catch(e){}
  }catch(e){console&&console.error&&console.error("enterApp:",e);}
}
let profShown=false;
function renderProfAcct(){const el=document.getElementById("profAcct"),tok=LS.get("nw_token")||"";
  if(profShown)showToken(el,tok);else el.textContent=(tok.replace(/[0-9A-Za-z]/g,"•")||"…");
  document.getElementById("profEye").classList.toggle("on",profShown);}
function openProfile(){profShown=false;document.getElementById("profileEditor").classList.remove("hide");document.getElementById("app").classList.add("hide");window.scrollTo(0,0);renderProfAcct();}
function closeProfile(){document.getElementById("profileEditor").classList.add("hide");document.getElementById("app").classList.remove("hide");}
document.getElementById("profileBtn").onclick=openProfile;
document.getElementById("profileBack").onclick=closeProfile;
document.getElementById("profEye").onclick=()=>{profShown=!profShown;renderProfAcct();};
document.getElementById("profCopyAcct").onclick=()=>{const t=LS.get("nw_token")||"";if(navigator.clipboard)navigator.clipboard.writeText(t);toast("Account number copied");};
document.getElementById("profSyncNow").onclick=()=>pushServer(true);
document.getElementById("syncNowHome").onclick=()=>pushServer(true);
// Net worth / Salary are tabs within the home page — switch the visible view in place.
function showView(name){
  const net=name!=="salary";
  document.getElementById("viewNet").classList.toggle("hide",!net);
  document.getElementById("viewSalary").classList.toggle("hide",net);
  document.getElementById("navNet").classList.toggle("on",net);
  document.getElementById("salaryBtn").classList.toggle("on",!net);
  document.getElementById("mastTitle").textContent=net?"Net Worth":"Salary";
  document.getElementById("mastSub").textContent=net?"A quiet accounting of what you hold.":"What you and yours bring home, month by month.";
  if(net)renderAll();else renderSalary();
  window.scrollTo(0,0);
}
document.getElementById("navNet").onclick=()=>showView("net");
document.getElementById("profLogout").onclick=()=>{if(confirm("Log out on this device? Make sure your account number is saved — it's the only way back in.")){LS.rem("nw_token");LS.rem("nw_state");location.reload();}};
document.getElementById("ccySel").onchange=e=>{state.baseCcy=e.target.value;scheduleSync();renderAll();};
document.getElementById("pricesBtn").onclick=refreshPrices;
// Forecast inputs
(()=>{const fcU=()=>{scheduleSync();renderForecast();renderRetire();};
  const on=document.getElementById("fcOn");if(on)on.onchange=e=>{fcCfg().enabled=e.target.checked;fcU();};
  const m=document.getElementById("fcMonthly");if(m)m.oninput=e=>{fcCfg().monthly=parseFloat(e.target.value)||0;fcU();};
  const g=document.getElementById("fcGrowth");if(g)g.oninput=e=>{fcCfg().growth=Math.min(Math.max((parseFloat(e.target.value)||0)/100,-0.5),1);fcU();};
  const gm=document.getElementById("fcGoalMode");if(gm)gm.onchange=e=>{fcCfg().goalMode=e.target.value==="spend"?"spend":"amount";fcSyncInputs();fcU();};
  const gv=document.getElementById("fcGoalVal");if(gv)gv.oninput=e=>{const fc=fcCfg(),v=parseFloat(e.target.value)||0;if(fc.goalMode==="spend")fc.annualSpending=v;else fc.goalAmount=v;fcU();};
  const rd=document.getElementById("fcRedirect");if(rd)rd.onchange=e=>{fcCfg().redirectLoans=e.target.checked;fcU();};
  const cg=document.getElementById("fcContribGrowth");if(cg)cg.oninput=e=>{fcCfg().contribGrowth=Math.min(Math.max((parseFloat(e.target.value)||0)/100,0),0.5);fcU();};
  const bd=document.getElementById("fcBand");if(bd)bd.onchange=e=>{fcCfg().band=e.target.checked;fcU();};
  const hz=document.getElementById("fcHorizon");if(hz)hz.oninput=e=>{fcCfg().horizonYear=parseInt(e.target.value,10)||0;fcU();};
})();
// Retirement calculator inputs
(()=>{const rU=()=>{scheduleSync();renderRetire();};const r=()=>retCfg(),cy=new Date().getFullYear();
  const on=document.getElementById("rtOn");if(on)on.onchange=e=>{r().on=e.target.checked;rU();};
  const yr=document.getElementById("rtYear");if(yr)yr.oninput=e=>{r().retireYear=parseInt(e.target.value,10)||cy;rU();};
  const sp=document.getElementById("rtSpend");if(sp)sp.oninput=e=>{r().spending=parseFloat(e.target.value)||0;rU();};
  const ps=document.getElementById("rtPensStart");if(ps)ps.oninput=e=>{r().pensionStart=parseInt(e.target.value,10)||cy;rU();};
  const un=document.getElementById("rtUntil");if(un)un.oninput=e=>{r().untilYear=parseInt(e.target.value,10)||(cy+45);rU();};
  const inf=document.getElementById("rtInfl");if(inf)inf.oninput=e=>{r().inflation=Math.min(Math.max((parseFloat(e.target.value)||0)/100,0),0.3);rU();};
  const pts=document.getElementById("rtPts");if(pts)pts.oninput=e=>{r().points=parseFloat(e.target.value)||0;rU();};
  const pyr=document.getElementById("rtPtsYr");if(pyr)pyr.oninput=e=>{r().ptsPerYear=parseFloat(e.target.value)||0;rU();};
  const pval=document.getElementById("rtPtVal");if(pval)pval.oninput=e=>{r().ptValue=parseFloat(e.target.value)||0;rU();};
})();
document.getElementById("dlFc")&&(document.getElementById("dlFc").onclick=()=>downloadForecast());
document.getElementById("dlHist").onclick=()=>downloadHist();
document.getElementById("dlDonut").onclick=()=>downloadDonut();
document.getElementById("ratesBtn").onclick=async()=>{toast("Updating rates…");const ok=await fetchFx();await refreshHistFx();scheduleSync();renderAll();toast(ok?("Rates updated · "+(state.fxDate||"")):"Rates unavailable (offline)");};

