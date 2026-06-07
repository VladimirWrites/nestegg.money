/* Select a field's contents on focus, so you can type straight over a value (e.g. "0")
   without deleting it first. Prevent the click's mouse-up from clearing that selection. */
const selField=t=>t&&t.tagName==="INPUT"&&(t.type==="number"||t.type==="text");
let _selJustFocused=false;
document.addEventListener("focusin",e=>{if(selField(e.target)){try{e.target.select();}catch(_){}_selJustFocused=true;}});
document.addEventListener("mouseup",e=>{if(_selJustFocused&&selField(e.target)){e.preventDefault();}_selJustFocused=false;});

document.getElementById("exportBtn").onclick=()=>{const b=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="networth-"+new Date().toISOString().slice(0,10)+".json";a.click();};
document.getElementById("importBtn").onclick=()=>document.getElementById("importFile").click();
document.getElementById("importFile").onchange=e=>{const f=e.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{try{const d=JSON.parse(rd.result);if(d.snapshots){state=migrate(d);document.getElementById("ccySel").value=state.baseCcy;scheduleSync();renderAll();toast("Imported");}else toast("No snapshots in that file");}catch(err){toast("Could not read that file");}};rd.readAsText(f);};
document.getElementById("resetBtn").onclick=()=>{if(confirm("Clear all data and start fresh? Export JSON first if you want a backup.")){state=emptyState();document.getElementById("ccySel").value="EUR";scheduleSync();renderAll();toast("Cleared");}};

let toastTimer;function toast(m){const el=document.getElementById("toast");el.textContent=m;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2300);}

// Flush the pending change immediately when the tab is hidden/closed, so the last edit lands.
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")try{flushSync();}catch(e){}});
window.addEventListener("pagehide",()=>{try{flushSync();}catch(e){}});

// Re-fit the width-filling charts when the viewport changes size.
let _rszT;window.addEventListener("resize",()=>{clearTimeout(_rszT);_rszT=setTimeout(()=>{try{const vn=document.getElementById("viewNet");if(vn&&!vn.classList.contains("hide")){drawHist();renderForecast();renderRetire();}
  const vs=document.getElementById("viewSalary");if(vs&&!vs.classList.contains("hide"))drawSalaryChart();}catch(e){}},160);});

try{boot();}catch(e){try{showCreate();}catch(_){}}
