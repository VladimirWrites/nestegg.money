/* year editor */
let edIdx=-1,edYearPrev=null;
function openYearEditor(ri){edIdx=ri;edYearPrev=state.snapshots[ri].year;document.getElementById("edYear").value=state.snapshots[ri].year;document.getElementById("yearEditor").classList.remove("hide");document.getElementById("app").classList.add("hide");window.scrollTo(0,0);renderEntries();ensureHist();}
function closeYearEditor(){document.getElementById("yearEditor").classList.add("hide");document.getElementById("app").classList.remove("hide");edIdx=-1;renderAll();}
function cardHTML(en,i,names,year){
  const baseV=entryBase(en,year),liab=en.kind==="liability",priced=en.kind==="ticker"||en.kind==="crypto";
  let valuePart;
  if(priced){
    const p=tickerPx(en),isC=en.kind==="crypto";
    const pxtxt=p?("@ "+moneyIn(p.price,p.currency)+(p.frozen?" · year-end":"")):(en.ticker?"no price":(isC?"set coin":"set ticker"));
    valuePart=`<input class="rsh num" type="number" step="any" inputmode="decimal" value="${en.shares!=null?en.shares:0}" data-i="${i}" data-f="shares" placeholder="${isC?"coins":"shares"}" title="${isC?"coins":"shares"}">
    <input class="rtk" value="${esc(en.ticker||"")}" data-i="${i}" data-f="ticker" placeholder="${isC?"BTC-EUR":"AMS:VWRL"}" title="${isC?"coin pair, e.g. BTC-EUR":"ticker"}">
    <span class="rconv">${p?money(baseV):pxtxt}</span>`;
  }else{
    valuePart=`<input class="rval num" type="number" step="any" inputmode="decimal" value="${en.value!=null?en.value:0}" data-i="${i}" data-f="value" placeholder="${liab?"amount owed":"0"}">
    <select data-i="${i}" data-f="ccy">${CCYS.map(x=>`<option ${x===en.ccy?"selected":""}>${x}</option>`).join("")}</select>
    <span class="rconv${liab?" liab":""}">${liab?("− "+money(Math.abs(baseV))):(en.ccy!==state.baseCcy?("= "+money(baseV)):"")}</span>`;
  }
  const cats=groupNames();
  const catSel=cats.length?`<select class="rcat" data-i="${i}" data-f="group" title="Category"><option value="" ${!en.group?"selected":""}>— no category —</option>${cats.map(g=>`<option ${g===en.group?"selected":""}>${esc(g)}</option>`).join("")}</select>`:"";
  return `<div class="rcard${liab?" liabcard":""}"><span class="dot" style="background:${liab?"var(--red)":colorOf(seriesKey(en),names)}"></span>
    <input class="rname" value="${esc(en.name)}" data-i="${i}" data-f="name" placeholder="${liab?"Liability name":"Asset name"}">
    <select class="rkind" data-i="${i}" data-f="kind"><option value="fixed" ${(!priced&&!liab)?"selected":""}>Value</option><option value="ticker" ${en.kind==="ticker"?"selected":""}>Ticker</option><option value="crypto" ${en.kind==="crypto"?"selected":""}>Crypto</option><option value="liability" ${liab?"selected":""}>Liability</option></select>
    ${valuePart}
    ${catSel}
    <button class="rdel" data-del="${i}" title="Remove">×</button></div>`;
}
// Read-only card for a long-term asset (tap to edit in the focused asset editor).
function autoCardHTML(en,names,year){
  const a=(state.assets||[]).find(x=>x.id===en.assetId)||{},liab=en.kind==="liability";
  const tags=liab?"liability":([a.depreciates?(a.up?"appreciating":"depreciating"):"",a.loan?"loan":""].filter(Boolean).join(" · ")||"asset");
  const v=entryBase(en,year);
  return `<div class="rcard auto${liab?" liabcard":""}" data-editasset="${en.assetId}" title="Edit"><span class="dot" style="background:${liab?"var(--red)":colorOf(seriesKey(en),names)}"></span>`+
    `<span class="rname ro">${esc(en.name)}</span>`+
    `<span class="autotag">${tags}</span>`+
    `<span class="rconv${liab?" liab":""}">${liab?("− "+money(Math.abs(v))):money(v)}</span>`+
    `<svg class="autoedit" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 2.5l2.5 2.5L6 12.5 3 13l.5-3z"/></svg></div>`;
}
function renderEntries(){
  const sn=state.snapshots[edIdx];if(!sn)return;const wrap=document.getElementById("edEntries");const names=allNames();
  const autos=autoEntriesFor(sn.year);
  let html="";
  // ungrouped: per-year entries, then long-term assets that aren't in a category
  sn.entries.forEach((en,i)=>{if(!en.group)html+=cardHTML(en,i,names,sn.year);});
  autos.forEach(en=>{if(!en.group)html+=autoCardHTML(en,names,sn.year);});
  // category sections: the global category list, plus any stray groups still in use
  const order=[...(state.categories||[])];
  sn.entries.forEach(en=>{if(en.group&&order.indexOf(en.group)<0)order.push(en.group);});
  autos.forEach(en=>{if(en.group&&order.indexOf(en.group)<0)order.push(en.group);});
  order.forEach(g=>{
    let sub=0,cards="";
    sn.entries.forEach((en,i)=>{if(en.group===g){sub+=entryBase(en,sn.year);cards+=cardHTML(en,i,names,sn.year);}});
    autos.forEach(en=>{if(en.group===g){sub+=entryBase(en,sn.year);cards+=autoCardHTML(en,names,sn.year);}});
    html+=`<div class="grp"><div class="grphead"><span class="dot" style="background:${colorOf(g,names)}"></span>`+
      `<input class="grpname" data-grp="${esc(g)}" value="${esc(g)}" title="Category name" placeholder="Category name">`+
      `<span class="grpsub num">${money(sub)}</span>`+
      `<button class="grpdel" data-grpdel="${esc(g)}" title="Delete category">×</button></div>`+
      `<div class="grpcards">${cards||'<div class="exhint">Empty — set an item\'s Category to this to file it here.</div>'}</div></div>`;
  });
  wrap.innerHTML=html;
  document.getElementById("edTotal").textContent=money(snapTotalBase(sn));
}
document.getElementById("years").addEventListener("click",e=>{const h=e.target.closest("[data-open]");if(h)openYearEditor(+h.dataset.open);});
document.getElementById("edBack").onclick=()=>{scheduleSync();closeYearEditor();};
document.getElementById("edYear").addEventListener("input",e=>{const sn=state.snapshots[edIdx];if(!sn)return;const y=parseInt(e.target.value);if(!isNaN(y))sn.year=y;scheduleSync();});
// On commit, reject a year that's already used by another snapshot (no duplicates).
document.getElementById("edYear").addEventListener("change",e=>{const sn=state.snapshots[edIdx];if(!sn)return;const y=parseInt(e.target.value);
  if(isNaN(y)||state.snapshots.some((s,idx)=>idx!==edIdx&&s.year===y)){
    if(!isNaN(y))toast("You already have a "+y+" — pick another year");
    sn.year=edYearPrev;e.target.value=edYearPrev;scheduleSync();return;}
  edYearPrev=y;scheduleSync();});
document.getElementById("edDelYear").onclick=()=>{if(edIdx<0)return;if(confirm("Delete year "+state.snapshots[edIdx].year+"?")){state.snapshots.splice(edIdx,1);scheduleSync();closeYearEditor();}};
document.getElementById("edAdd").onclick=()=>{state.snapshots[edIdx].entries.push({id:nid(),name:"New asset",kind:"fixed",ccy:state.baseCcy,value:0});scheduleSync();renderEntries();};
document.getElementById("edAddLongterm").onclick=()=>{const a=newAsset();openAssetEditor(a.id,true);};
document.getElementById("edAddLiability").onclick=()=>{const a=newLiability();openAssetEditor(a.id,true);};
document.getElementById("edAddGroup").onclick=()=>{const ex=new Set(state.categories||(state.categories=[]));let base="New category",nm=base,k=2;while(ex.has(nm))nm=base+" "+(k++);state.categories.push(nm);scheduleSync();renderEntries();};
document.getElementById("edCopyPrev").onclick=()=>{const cur=state.snapshots[edIdx];const prev=state.snapshots.filter(s=>s.year<cur.year).sort((a,b)=>b.year-a.year)[0];if(!prev){toast("No earlier year to copy from");return;}if(cur.entries.length&&!confirm("Replace this year's entries with a copy of "+prev.year+"?"))return;cur.entries=prev.entries.map(e=>({id:nid(),name:e.name,kind:e.kind||"fixed",ccy:e.ccy,value:e.value,shares:e.shares,ticker:e.ticker,group:e.group}));scheduleSync();renderEntries();ensureHist();toast("Copied "+prev.year);};
document.getElementById("edEntries").addEventListener("input",e=>{
  const t=e.target,sn=state.snapshots[edIdx];
  if(t.dataset.grp!=null){const old=t.dataset.grp,nw=t.value;
    // Categories are global tags — rename in the list and across every year and asset.
    const ci=(state.categories||[]).indexOf(old);if(ci>=0)state.categories[ci]=nw;
    state.snapshots.forEach(s=>(s.entries||[]).forEach(en=>{if(en.group===old)en.group=nw;}));
    (state.assets||[]).forEach(a=>{if(a.group===old)a.group=nw;});
    t.dataset.grp=nw;scheduleSync();return;}
  const i=+t.dataset.i,f=t.dataset.f;if(t.dataset.i==null||!f)return;
  const en=sn.entries[i];
  if(f==="value"||f==="shares")en[f]=parseFloat(t.value||0);
  else if(f==="group")en.group=t.value||undefined;
  else en[f]=t.value;
  scheduleSync();
  if(f==="kind"||f==="ccy"||f==="group"){renderEntries();return;}
  const card=t.closest(".rcard");const cv=card&&card.querySelector(".rconv");
  if(cv){const bv=entryBase(en,sn.year);if(en.kind==="ticker"||en.kind==="crypto"){const p=tickerPx(en);cv.textContent=p?money(bv):(en.ticker?"no price":(en.kind==="crypto"?"set coin":"set ticker"));}else if(en.kind==="liability"){cv.textContent="− "+money(Math.abs(bv));}else{cv.textContent=en.ccy!==state.baseCcy?("= "+money(bv)):"";}}
  if(en.group){const gb=t.closest(".grp"),gs=gb&&gb.querySelector(".grpsub");if(gs)gs.textContent=money(sn.entries.filter(x=>x.group===en.group).reduce((a,x)=>a+entryBase(x,sn.year),0));}
  document.getElementById("edTotal").textContent=money(snapTotalBase(sn));
});
document.getElementById("edEntries").addEventListener("change",async e=>{
  const t=e.target,f=t.dataset.f;
  if(t.dataset.grp!=null){renderEntries();return;}
  if(f==="name"){renderEntries();return;}
  if(f==="ticker"&&t.value.trim()){
    const sn=state.snapshots[edIdx],en=sn&&sn.entries[+t.dataset.i],cy=new Date().getFullYear();
    if(!en)return;
    // Crypto: accept a bare coin (BTC → BTC-EUR) and normalise so it matches Yahoo's symbols.
    let sym=t.value.trim();if(en.kind==="crypto"&&!sym.includes("-"))sym=sym.toUpperCase()+"-EUR";en.ticker=sym;
    toast("Fetching price…");
    if(sn.year<cy){const r=await fetchPriceYear(sym,sn.year);if(r){en.px=r.price;en.pxCcy=r.currency;en.pxKey=sym+"@"+sn.year;}else{delete en.px;delete en.pxCcy;delete en.pxKey;}scheduleSync();renderEntries();toast(r?("Year-end price · "+sn.year):"Couldn't fetch that ticker");}
    else{delete en.px;delete en.pxCcy;delete en.pxKey;const ok=await fetchPrice(sym);scheduleSync();renderEntries();toast(ok?"Price updated":"Couldn't fetch that ticker");}
  }
});
document.getElementById("edEntries").addEventListener("click",e=>{
  const sn=state.snapshots[edIdx];
  const ae=e.target.closest("[data-editasset]");
  if(ae){openAssetEditor(ae.dataset.editasset);return;}
  if(e.target.dataset.del!=null){sn.entries.splice(+e.target.dataset.del,1);scheduleSync();renderEntries();return;}
  const gd=e.target.closest("[data-grpdel]");
  if(gd){const g=gd.dataset.grpdel;
    // Deleting a category removes the tag from every item in every year (nothing is removed).
    const n=state.snapshots.reduce((a,s)=>a+(s.entries||[]).filter(x=>x.group===g).length,0)+(state.assets||[]).filter(x=>x.group===g).length;
    if(n===0||confirm('Remove the "'+g+'" category from all years? Its '+n+' tagged item'+(n===1?"":"s")+' lose the category — nothing is deleted.')){
      state.categories=(state.categories||[]).filter(c=>c!==g);
      state.snapshots.forEach(s=>(s.entries||[]).forEach(x=>{if(x.group===g)x.group=undefined;}));
      (state.assets||[]).forEach(x=>{if(x.group===g)x.group=undefined;});scheduleSync();renderEntries();}return;}
});

document.getElementById("addYear").onclick=()=>{const ys=state.snapshots.map(s=>s.year);const ny=ys.length?Math.max(...ys)+1:new Date().getFullYear();state.snapshots.push({year:ny,entries:[]});scheduleSync();openYearEditor(state.snapshots.length-1);};

