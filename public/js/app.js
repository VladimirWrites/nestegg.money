const CCYS=["EUR","USD","GBP","CHF","JPY","CAD","AUD","SEK","NOK","DKK","PLN"];
const FALLBACK_FX={EUR:1,USD:1.08,GBP:0.85,CHF:0.96,JPY:170,CAD:1.47,AUD:1.64,SEK:11.4,NOK:11.7,DKK:7.46,PLN:4.3};
const PALETTE=["#4aa3ff","#ff8c1a","#3ad17a","#ffd23a","#ff4d6d","#9b8cff","#2fd0c8","#ffb000","#7aa0ff","#e06be0","#9ad13a","#ff7847"];
let uid=1;const nid=()=>"i"+(uid++)+Date.now().toString(36);

function emptyState(){
  return {v:5,baseCcy:"EUR",fxRates:Object.assign({},FALLBACK_FX),fxDate:null,prices:{},snapshots:[{year:new Date().getFullYear(),entries:[]}]};
}
function migrate(s){
  if(!s.baseCcy)s.baseCcy="EUR";
  if(!s.fxRates)s.fxRates=Object.assign({},FALLBACK_FX);s.fxRates.EUR=1;
  if(!s.prices)s.prices={};
  (s.snapshots||[]).forEach(sn=>{
    if(!sn.entries){const c=sn.cats||{};sn.entries=Object.keys(c).filter(k=>c[k]).map(k=>({id:nid(),name:k,ccy:"EUR",value:c[k]}));}
    sn.entries.forEach(en=>{if(!en.id)en.id=nid();if(!en.name)en.name=en.cat||"Asset";if(!en.ccy)en.ccy="EUR";if(en.value==null)en.value=0;if(!en.kind)en.kind="fixed";if(en.kind==="ticker"){if(en.shares==null)en.shares=0;if(en.ticker==null)en.ticker="";}delete en.cat;delete en.qty;});
    delete sn.cats;
  });
  delete s.items;s.v=5;return s;
}
let state=emptyState();

/* fx + format */
function rate(c){if(c==="EUR")return 1;const r=state.fxRates&&state.fxRates[c];return (r&&r>0)?r:(FALLBACK_FX[c]||1);}
const convTo=(a,from,to)=>a*rate(to)/rate(from);
function money(v){try{return new Intl.NumberFormat("en-IE",{style:"currency",currency:state.baseCcy,maximumFractionDigits:0}).format(v);}catch(e){return state.baseCcy+" "+Math.round(v).toLocaleString();}}
function moneyIn(v,ccy){try{return new Intl.NumberFormat("en-IE",{style:"currency",currency:ccy,maximumFractionDigits:2}).format(v);}catch(e){return ccy+" "+(+v).toFixed(2);}}
function ccySym(){try{const p=new Intl.NumberFormat("en-IE",{style:"currency",currency:state.baseCcy}).formatToParts(0);const s=p.find(x=>x.type==="currency");return s?s.value:state.baseCcy;}catch(e){return state.baseCcy;}}
const esc=s=>String(s).replace(/"/g,"&quot;").replace(/</g,"&lt;");

/* asset colours (stable within the current set of series). A "series" is the
   entry's group if it has one, otherwise the asset's own name — so charts show
   one segment per group, summing its members. */
const seriesKey=e=>e.group||e.name;
function allNames(){return [...new Set(state.snapshots.flatMap(s=>s.entries.map(seriesKey)))].sort((a,b)=>a.localeCompare(b));}
function colorOf(name,names){const i=(names||allNames()).indexOf(name);return PALETTE[(i<0?0:i)%PALETTE.length];}

/* totals */
function entryNative(en){
  if(en.kind==="ticker"){const p=state.prices[en.ticker];if(!p)return{v:0,ccy:en.ccy||"EUR",miss:true};return{v:(parseFloat(en.shares)||0)*p.price,ccy:p.currency};}
  return {v:parseFloat(en.value)||0,ccy:en.ccy||"EUR"};
}
const entryEUR=en=>{const n=entryNative(en);return convTo(n.v,n.ccy,"EUR");};
const entryBase=en=>{const n=entryNative(en);return convTo(n.v,n.ccy,state.baseCcy);};
function dayChangeBase(nw){
  const ls=latestSnap();if(!ls)return null;
  let abs=0,any=false;
  ls.entries.forEach(en=>{
    if(en.kind!=="ticker")return;
    const p=state.prices[en.ticker];if(!p||p.prevClose==null)return;
    const sh=parseFloat(en.shares)||0;
    abs+=convTo(sh*(p.price-p.prevClose),p.currency,state.baseCcy);
    any=true;
  });
  if(!any)return null;
  const prev=nw-abs;
  return {abs,pct:prev>0?abs/prev*100:0};
}
const snapTotalEUR=sn=>(sn.entries||[]).reduce((a,e)=>a+entryEUR(e),0);
const sortedSnaps=()=>[...state.snapshots].sort((a,b)=>a.year-b.year);
const latestSnap=()=>sortedSnaps().slice(-1)[0];

/* crypto/auth */
let accountId=null,cryptoKey=null;const B32="0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const PBKDF2_ITERS=310000;          // key stretching (defence-in-depth over the high-entropy token)
// Two-character Fletcher-style checksum over the base32 body: lets us reject
// typos and any string that isn't a genuine generated account number.
function tokChecksum(body){let a=1,b=0;for(const ch of body){a=(a+B32.indexOf(ch))%32;b=(b+a)%32;}return B32[a]+B32[b];}
function generateToken(){
  const bts=crypto.getRandomValues(new Uint8Array(16));let bits=0,val=0,o="";
  for(const x of bts){val=(val<<8)|x;bits+=8;while(bits>=5){o+=B32[(val>>>(bits-5))&31];bits-=5;}}
  if(bits>0)o+=B32[(val<<(5-bits))&31];
  return (o+tokChecksum(o)).match(/.{1,4}/g).join("-");   // 26 random + 2 check = 28 chars
}
// Uppercase, drop separators, and map look-alikes (O→0, I/L→1) so a mistyped
// account number still resolves to the same key instead of locking the user out.
const normTok=t=>(t||"").toUpperCase().replace(/[^0-9A-Z]/g,"").replace(/O/g,"0").replace(/[IL]/g,"1");
function validToken(t){const n=normTok(t);if(n.length!==28)return false;for(const ch of n)if(B32.indexOf(ch)<0)return false;return tokChecksum(n.slice(0,26))===n.slice(26);}
const canonToken=t=>{const n=normTok(t);return n.match(/.{1,4}/g).join("-");}
// Render an account number with digits and letters coloured differently,
// kept on a single line — shrinking the font only if the screen is too narrow.
function showToken(el,tok){
  el.innerHTML='<span class="tokline">'+[...tok].map(c=>c==="-"?'<span class="s">-</span>':(/[0-9]/.test(c)?`<span class="d">${c}</span>`:`<span class="a">${c}</span>`)).join("")+'</span>';
  const line=el.querySelector(".tokline");line.style.fontSize="";
  const cs=getComputedStyle(el),avail=el.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);
  if(avail>0){const base=parseFloat(getComputedStyle(line).fontSize),w=line.getBoundingClientRect().width;if(w>avail)line.style.fontSize=Math.max(11,base*avail/w)+"px";}
}
async function sha(s){return await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));}
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
const b64=b=>{let s="";for(const x of new Uint8Array(b))s+=String.fromCharCode(x);return btoa(s);};
const unb64=s=>{const z=atob(s),u=new Uint8Array(z.length);for(let i=0;i<z.length;i++)u[i]=z.charCodeAt(i);return u.buffer;};
async function deriveKeys(tok){
  const t=normTok(tok),enc=new TextEncoder();
  // Account id: a fast one-way hash — it's only a storage label, and it's high-entropy.
  accountId=hex(await sha("nw|id|v2|"+t));
  // Encryption key: PBKDF2-stretched and derived from a DIFFERENT input, so the
  // server's account id can never be turned back into the key.
  const base=await crypto.subtle.importKey("raw",enc.encode("nw|key|v2|"+t),{name:"PBKDF2"},false,["deriveKey"]);
  cryptoKey=await crypto.subtle.deriveKey(
    {name:"PBKDF2",salt:enc.encode("nw|salt|v2|"+t),iterations:PBKDF2_ITERS,hash:"SHA-256"},
    base,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
}
async function encS(){const iv=crypto.getRandomValues(new Uint8Array(12));const ct=await crypto.subtle.encrypt({name:"AES-GCM",iv},cryptoKey,new TextEncoder().encode(JSON.stringify(state)));return b64(iv)+"."+b64(ct);}
async function decS(blob){const[i,c]=blob.split(".");const pt=await crypto.subtle.decrypt({name:"AES-GCM",iv:new Uint8Array(unb64(i))},cryptoKey,unb64(c));return JSON.parse(new TextDecoder().decode(pt));}

/* persistence/sync */
const LS={get(k){try{return localStorage.getItem(k);}catch(e){return null;}},set(k,v){try{localStorage.setItem(k,v);}catch(e){}},rem(k){try{localStorage.removeItem(k);}catch(e){}}};
const saveLocal=()=>LS.set("nw_state",JSON.stringify(state));
const loadLocal=()=>{const r=LS.get("nw_state");try{return r?JSON.parse(r):null;}catch(e){return null;}};
let syncTimer;function scheduleSync(){saveLocal();clearTimeout(syncTimer);syncTimer=setTimeout(pushServer,1200);}
async function pushServer(){if(!accountId||!cryptoKey)return;try{const blob=await encS();const r=await fetch("/api/vault",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({id:accountId,blob})});setSync(r.ok?"ok":"off",r.ok?"Synced":"Sync error");}catch(e){setSync("off","Local only");}}
async function loadServer(){if(!accountId)return null;try{const r=await fetch("/api/vault?id="+accountId);if(r.status===404){setSync("ok","Synced (new)");return null;}if(!r.ok){setSync("off","Local only");return null;}const{blob}=await r.json();const o=await decS(blob);setSync("ok","Synced");return o;}catch(e){setSync("off","Local only");return null;}}
function setSync(c,t){const d=document.getElementById("syncDot"),x=document.getElementById("syncTxt");d.className="syncdot "+(c==="ok"?"ok":c==="off"?"off":"");x.textContent=t;}
async function fetchFx(){try{const r=await fetch("/api/fx");if(!r.ok)return false;const d=await r.json();if(d.rates){state.fxRates=Object.assign({EUR:1},d.rates);state.fxDate=d.date;return true;}}catch(e){}return false;}
async function fetchPrice(t){try{const r=await fetch("/api/price?ticker="+encodeURIComponent(t));if(!r.ok)return false;const d=await r.json();if(d.price!=null){state.prices[t]={price:d.price,prevClose:(d.prevClose!=null?d.prevClose:d.price),currency:d.currency||"USD",t:Date.now()};return true;}}catch(e){}return false;}
function tickersInUse(){return [...new Set(state.snapshots.flatMap(s=>s.entries).filter(e=>e.kind==="ticker"&&e.ticker).map(e=>e.ticker))];}
async function refreshPrices(){const ts=tickersInUse();if(!ts.length){toast("No ticker holdings to refresh");return;}toast("Fetching prices…");let n=0;for(const t of ts){if(await fetchPrice(t))n++;}state.lastPx=Date.now();scheduleSync();renderAll();toast(n+"/"+ts.length+" prices updated");}

/* gate */
let pendingToken=null;
function showCreate(){document.getElementById("gateCreate").classList.remove("hide");document.getElementById("gateSignin").classList.add("hide");pendingToken=generateToken();showToken(document.getElementById("newAcct"),pendingToken);}
function showSignin(){document.getElementById("gateCreate").classList.add("hide");document.getElementById("gateSignin").classList.remove("hide");}
document.getElementById("toSignin").onclick=showSignin;document.getElementById("toCreate").onclick=showCreate;
document.getElementById("regenAcct").onclick=()=>{pendingToken=generateToken();showToken(document.getElementById("newAcct"),pendingToken);};
document.getElementById("copyAcct").onclick=()=>{navigator.clipboard&&navigator.clipboard.writeText(pendingToken);toast("Copied");};
document.getElementById("confirmAcct").onclick=async()=>{LS.set("nw_token",pendingToken);try{await deriveKeys(pendingToken);}catch(e){}state=emptyState();saveLocal();enterApp();try{pushServer();}catch(e){}try{fetchFx().then(ok=>{if(ok){scheduleSync();renderAll();}}).catch(()=>{});}catch(e){}};
document.getElementById("signinBtn").onclick=async()=>{const t=document.getElementById("signinInput").value.trim();if(!validToken(t)){toast("That's not a valid account number");return;}const canon=canonToken(t);LS.set("nw_token",canon);try{await deriveKeys(canon);}catch(e){}const rem=await loadServer();state=migrate(rem&&rem.snapshots?rem:(loadLocal()||emptyState()));enterApp();};
async function boot(){
  try{
    const tok=LS.get("nw_token");
    if(!tok){showCreate();return;}
    try{await deriveKeys(tok);}catch(e){}
    let rem=null; try{rem=await loadServer();}catch(e){rem=null;}
    try{state=migrate(rem&&rem.snapshots?rem:(loadLocal()||emptyState()));}catch(e){state=emptyState();}
    enterApp();
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
  }catch(e){console&&console.error&&console.error("enterApp:",e);}
}
document.getElementById("showAcctBtn").onclick=()=>{const t=LS.get("nw_token")||"(none)";navigator.clipboard&&navigator.clipboard.writeText(t);toast("Account number copied: "+t);};
document.getElementById("syncNowBtn").onclick=pushServer;
document.getElementById("logoutBtn").onclick=()=>{if(confirm("Log out on this device? Make sure your account number is saved — it's the only way back in.")){LS.rem("nw_token");LS.rem("nw_state");location.reload();}};
document.getElementById("ccySel").onchange=e=>{state.baseCcy=e.target.value;scheduleSync();renderAll();};
document.getElementById("pricesBtn").onclick=refreshPrices;
document.getElementById("dlHist").onclick=downloadHist;
document.getElementById("dlDonut").onclick=downloadDonut;
document.getElementById("ratesBtn").onclick=async()=>{toast("Updating rates…");const ok=await fetchFx();scheduleSync();renderAll();toast(ok?("Rates updated · "+(state.fxDate||"")):"Rates unavailable (offline)");};

/* render */
function getCss(v){return v;}
function renderAll(){drawHist();drawHistLegend();renderYears();drawDonut();updNote();}
function updNote(){const px=state.lastPx?("prices "+new Date(state.lastPx).toLocaleString("en-GB",{hour:"2-digit",minute:"2-digit",day:"numeric",month:"short"})):"";const fxd=state.fxDate?("FX "+state.fxDate):"";document.getElementById("updNote").textContent=[px,fxd].filter(Boolean).join(" · ");}

function shortK(v){const a=Math.abs(v);if(a>=1000)return (v/1000).toFixed(a>=10000?0:1)+"k";return Math.round(v);}
function niceCeil(v){const p=Math.pow(10,Math.floor(Math.log10(v||1)));const f=(v||1)/p;const n=f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10;return n*p;}

function drawHist(){
  const svg=document.getElementById("histChart");const snaps=sortedSnaps();const n=snaps.length;const names=allNames();
  const toBase=eur=>convTo(eur,"EUR",state.baseCcy);
  const bw=40,gap=18,padL=58,padR=14,padT=24,padB=32,innerW=Math.max(n,1)*bw+(n-1)*gap,W=Math.max(innerW+padL+padR,320),H=300,plotH=H-padT-padB;
  const maxV=Math.max(1,...snaps.map(s=>toBase(snapTotalEUR(s)))),nm=niceCeil(maxV);
  svg.setAttribute("width",W);svg.setAttribute("height",H);svg.setAttribute("viewBox",`0 0 ${W} ${H}`);
  let s="";const sym=ccySym();
  for(let i=0;i<=5;i++){const val=nm*i/5,y=padT+plotH-(val/nm)*plotH;s+=`<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="#26262a" stroke-width="1"/>`;s+=`<text x="${padL-8}" y="${y+3}" text-anchor="end" font-family="ui-monospace,monospace" font-size="9" fill="#8a867c">${sym}${shortK(val)}</text>`;}
  snaps.forEach((sn,idx)=>{const x=padL+idx*(bw+gap);let yTop=padT+plotH;
    names.forEach(nm2=>{const tot=sn.entries.filter(e=>seriesKey(e)===nm2).reduce((a,e)=>a+toBase(entryEUR(e)),0);if(tot<=0)return;const h=(tot/nm)*plotH;yTop-=h;s+=`<rect x="${x}" y="${yTop}" width="${bw}" height="${h}" fill="${colorOf(nm2,names)}"><title>${sn.year} · ${esc(nm2)}: ${money(tot)}</title></rect>`;});
    const t=toBase(snapTotalEUR(sn));s+=`<text x="${x+bw/2}" y="${yTop-6}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="8.5" fill="#8a867c">${sym}${shortK(t)}</text>`;s+=`<text x="${x+bw/2}" y="${H-padB+16}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="10" fill="#e8e4d8">${sn.year}</text>`;});
  svg.innerHTML=s;
  // hero = latest
  const ls=latestSnap();const nw=ls?convTo(snapTotalEUR(ls),"EUR",state.baseCcy):0;
  document.getElementById("nwTotal").textContent=money(nw);
  document.getElementById("nwNote").textContent=ls?("as of "+ls.year+" · "+ls.entries.length+" asset"+(ls.entries.length===1?"":"s")):"No data yet";
  const dEl=document.getElementById("nwDay");const dc=dayChangeBase(nw);
  if(dc){const flat=Math.abs(dc.abs)<0.005,up=dc.abs>=0;dEl.className="day "+(flat?"flat":(up?"up":"down"));const sign=up?"+":"−",arrow=flat?"":(up?"▲ ":"▼ ");dEl.textContent=arrow+sign+money(Math.abs(dc.abs))+" · "+sign+Math.abs(dc.pct).toFixed(2)+"% today";}
  else{dEl.className="day";dEl.textContent="";}
}
function drawHistLegend(){const names=allNames();document.getElementById("histLegend").innerHTML=names.map(n=>`<span><span class="chip" style="background:${colorOf(n,names)}"></span>${esc(n)}</span>`).join("");}

function drawDonut(){
  const ls=latestSnap();const svg=document.getElementById("donut");svg.innerHTML="";
  document.getElementById("allocYear").textContent=ls?("— "+ls.year):"";
  const names=allNames();
  const agg={};(ls?ls.entries:[]).forEach(e=>{const k=seriesKey(e);agg[k]=(agg[k]||0)+entryBase(e);});
  const rows=Object.keys(agg).map(k=>({name:k,v:agg[k]})).filter(r=>r.v>0).sort((a,b)=>b.v-a.v);
  const total=rows.reduce((a,r)=>a+r.v,0);
  if(total>0){const cx=120,cy=120,r=82,sw=30;let a=-Math.PI/2;
    rows.forEach(row=>{const f=row.v/total,a2=a+f*Math.PI*2,lg=f>0.5?1:0;const x1=cx+r*Math.cos(a),y1=cy+r*Math.sin(a),x2=cx+r*Math.cos(a2),y2=cy+r*Math.sin(a2);const p=document.createElementNS("http://www.w3.org/2000/svg","path");p.setAttribute("d",`M ${x1} ${y1} A ${r} ${r} 0 ${lg} 1 ${x2} ${y2}`);p.setAttribute("fill","none");p.setAttribute("stroke",colorOf(row.name,names));p.setAttribute("stroke-width",sw);svg.appendChild(p);a=a2;});
    txt(svg,cx,cy-4,"TOTAL",10,"#8a867c",2,400);txt(svg,cx,cy+18,money(total),16,"#e8e4d8",0,600);}
  const leg=document.getElementById("legend");leg.innerHTML="";
  rows.forEach(row=>{const d=document.createElement("div");d.className="legrow";d.innerHTML=`<span class="swatch" style="background:${colorOf(row.name,names)}"></span><span>${esc(row.name)}</span><span class="pct">${(row.v/total*100).toFixed(0)}%</span><span class="amt num">${money(row.v)}</span>`;leg.appendChild(d);});
}
function txt(svg,x,y,t,sz,fill,ls,w){const e=document.createElementNS("http://www.w3.org/2000/svg","text");e.setAttribute("x",x);e.setAttribute("y",y);e.setAttribute("text-anchor","middle");e.setAttribute("font-family","ui-monospace,monospace");e.setAttribute("font-size",sz);if(ls)e.setAttribute("letter-spacing",ls);if(w)e.setAttribute("font-weight",w);e.setAttribute("fill",fill);e.textContent=t;svg.appendChild(e);}

/* chart image export — wrap a chart's SVG in a titled, branded frame and save as PNG */
function legendSVG(items,x,y,fs){
  const rowH=fs+10;let s="",maxW=0;
  items.forEach((it,i)=>{const yy=y+i*rowH;
    s+=`<rect x="${x}" y="${yy}" width="${fs}" height="${fs}" rx="2" fill="${it.color}"/>`;
    s+=`<text x="${x+fs+9}" y="${yy+fs-1}" font-family="ui-monospace,Menlo,monospace" font-size="${fs}" fill="#e8e4d8">${esc(it.label)}</text>`;
    const w=fs+9+it.label.length*fs*0.62;if(w>maxW)maxW=w;});
  return {svg:s,height:items.length*rowH,width:maxW};
}
function frameSVG(title,inner,innerW,innerH,leg,pad,titleH){
  const footH=34,W=Math.max(innerW+pad*2,(leg?leg.width:0)+pad*2,520),H=titleH+innerH+16+(leg?leg.height:0)+footH,dx=(W-innerW)/2;
  return {W,H,svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`+
    `<rect width="${W}" height="${H}" fill="#0a0a0b"/>`+
    `<text x="${pad}" y="34" font-family="ui-monospace,Menlo,monospace" font-size="20" font-weight="700" fill="#ffb000">${esc(title)}</text>`+
    `<g transform="translate(${dx},${titleH})">${inner}</g>`+(leg?leg.svg:"")+
    `<text x="${W-pad}" y="${H-13}" text-anchor="end" font-family="ui-monospace,Menlo,monospace" font-size="12" fill="#8a867c">nestegg.money</text></svg>`};
}
function svgToPng(svgString,w,h,scale,filename){
  const blob=new Blob([svgString],{type:"image/svg+xml;charset=utf-8"}),url=URL.createObjectURL(blob),img=new Image();
  img.onload=()=>{const c=document.createElement("canvas");c.width=Math.round(w*scale);c.height=Math.round(h*scale);const ctx=c.getContext("2d");ctx.scale(scale,scale);ctx.drawImage(img,0,0);URL.revokeObjectURL(url);
    c.toBlob(b=>{if(!b){toast("Could not save image");return;}const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast("Image saved");},"image/png");};
  img.onerror=()=>{URL.revokeObjectURL(url);toast("Could not render image");};
  img.src=url;
}
function downloadHist(){
  const src=document.getElementById("histChart");if(!src.innerHTML){toast("Nothing to save");return;}
  const cW=+src.getAttribute("width"),cH=+src.getAttribute("height"),names=allNames(),pad=24,titleH=52;
  const leg=legendSVG(names.map(n=>({color:colorOf(n,names),label:n})),pad,titleH+cH+16,13);
  const f=frameSVG("Net Worth · over time",src.innerHTML,cW,cH,leg,pad,titleH);
  svgToPng(f.svg,f.W,f.H,2,"nestegg-over-time.png");
}
function downloadDonut(){
  const ls=latestSnap(),src=document.getElementById("donut"),names=allNames();
  const agg={};(ls?ls.entries:[]).forEach(e=>{const k=seriesKey(e);agg[k]=(agg[k]||0)+entryBase(e);});
  const rows=Object.keys(agg).map(k=>({name:k,v:agg[k]})).filter(r=>r.v>0).sort((a,b)=>b.v-a.v);
  if(!rows.length){toast("No allocation to save");return;}
  const total=rows.reduce((a,r)=>a+r.v,0);
  const items=rows.map(r=>({color:colorOf(r.name,names),label:r.name+"   "+Math.round(r.v/total*100)+"%   "+money(r.v)}));
  const pad=24,titleH=52,size=240;
  const leg=legendSVG(items,pad,titleH+size+16,13);
  const f=frameSVG("Allocation · "+(ls?ls.year:""),src.innerHTML,size,size,leg,pad,titleH);
  svgToPng(f.svg,f.W,f.H,2,"nestegg-allocation.png");
}

function renderYears(){
  const host=document.getElementById("years");host.innerHTML="";const names=allNames();
  const snaps=[...state.snapshots].sort((a,b)=>b.year-a.year);const toBase=eur=>convTo(eur,"EUR",state.baseCcy);
  const maxV=Math.max(1,...state.snapshots.map(s=>snapTotalEUR(s)));
  snaps.forEach(sn=>{const ri=state.snapshots.indexOf(sn),totEUR=snapTotalEUR(sn);
    const agg={};sn.entries.forEach(e=>{const v=entryEUR(e);if(v>0){const k=seriesKey(e);agg[k]=(agg[k]||0)+v;}});
    const segs=Object.keys(agg).map(k=>`<i style="width:${agg[k]/(totEUR||1)*100}%;background:${colorOf(k,names)}"></i>`).join("");
    const card=document.createElement("div");card.className="ycard";
    card.innerHTML=`<div class="yhead" data-open="${ri}"><span class="yr">${sn.year}</span><span class="ybar" style="max-width:${Math.max(8,totEUR/maxV*100)}%">${segs}</span><span class="ytot">${money(toBase(totEUR))}</span><svg class="ychev" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg></div>`;
    host.appendChild(card);});
}

/* year editor */
let edIdx=-1;
function openYearEditor(ri){edIdx=ri;document.getElementById("edYear").value=state.snapshots[ri].year;document.getElementById("yearEditor").classList.remove("hide");document.getElementById("app").classList.add("hide");window.scrollTo(0,0);renderEntries();}
function closeYearEditor(){document.getElementById("yearEditor").classList.add("hide");document.getElementById("app").classList.remove("hide");edIdx=-1;renderAll();}
function cardHTML(en,i,names){
  const baseV=entryBase(en);
  let valuePart;
  if(en.kind==="ticker"){
    const p=state.prices[en.ticker];
    const pxtxt=p?("@ "+moneyIn(p.price,p.currency)):(en.ticker?"no price":"set ticker");
    valuePart=`<input class="rsh num" type="number" step="any" inputmode="decimal" value="${en.shares!=null?en.shares:0}" data-i="${i}" data-f="shares" placeholder="shares" title="shares">
    <input class="rtk" value="${esc(en.ticker||"")}" data-i="${i}" data-f="ticker" placeholder="AMS:VWRL" title="ticker">
    <span class="rconv">${p?money(baseV):pxtxt}</span>`;
  }else{
    valuePart=`<input class="rval num" type="number" step="any" inputmode="decimal" value="${en.value!=null?en.value:0}" data-i="${i}" data-f="value">
    <select data-i="${i}" data-f="ccy">${CCYS.map(x=>`<option ${x===en.ccy?"selected":""}>${x}</option>`).join("")}</select>
    <span class="rconv">${en.ccy!==state.baseCcy?("= "+money(baseV)):""}</span>`;
  }
  return `<div class="rcard"><span class="dot" style="background:${colorOf(seriesKey(en),names)}"></span>
    <input class="rname" value="${esc(en.name)}" data-i="${i}" data-f="name" placeholder="Asset name">
    <select class="rkind" data-i="${i}" data-f="kind"><option value="fixed" ${en.kind!=="ticker"?"selected":""}>Value</option><option value="ticker" ${en.kind==="ticker"?"selected":""}>Ticker</option></select>
    ${valuePart}
    <button class="rdel" data-del="${i}" title="Remove asset">×</button></div>`;
}
function renderEntries(){
  const sn=state.snapshots[edIdx];if(!sn)return;const wrap=document.getElementById("edEntries");const names=allNames();
  let html="";
  // standalone assets (no group) first, in array order
  sn.entries.forEach((en,i)=>{if(!en.group)html+=cardHTML(en,i,names);});
  // then one section per group, in order of first appearance
  const order=[];sn.entries.forEach(en=>{if(en.group&&order.indexOf(en.group)<0)order.push(en.group);});
  order.forEach(g=>{
    let sub=0,cards="";
    sn.entries.forEach((en,i)=>{if(en.group===g){sub+=entryBase(en);cards+=cardHTML(en,i,names);}});
    html+=`<div class="grp"><div class="grphead"><span class="dot" style="background:${colorOf(g,names)}"></span>`+
      `<input class="grpname" data-grp="${esc(g)}" value="${esc(g)}" title="Group name" placeholder="Group name">`+
      `<span class="grpsub num">${money(sub)}</span>`+
      `<button class="grpdel" data-grpdel="${esc(g)}" title="Delete group">×</button></div>`+
      `<div class="grpcards">${cards}</div>`+
      `<button class="act ghost grpadd" data-grpadd="${esc(g)}">+ asset</button></div>`;
  });
  wrap.innerHTML=html;
  document.getElementById("edTotal").textContent=money(convTo(snapTotalEUR(sn),"EUR",state.baseCcy));
}
document.getElementById("years").addEventListener("click",e=>{const h=e.target.closest("[data-open]");if(h)openYearEditor(+h.dataset.open);});
document.getElementById("edBack").onclick=()=>{scheduleSync();closeYearEditor();};
document.getElementById("edYear").addEventListener("input",e=>{const sn=state.snapshots[edIdx];if(!sn)return;const y=parseInt(e.target.value);if(!isNaN(y))sn.year=y;scheduleSync();});
document.getElementById("edDelYear").onclick=()=>{if(edIdx<0)return;if(confirm("Delete year "+state.snapshots[edIdx].year+"?")){state.snapshots.splice(edIdx,1);scheduleSync();closeYearEditor();}};
document.getElementById("edAdd").onclick=()=>{state.snapshots[edIdx].entries.push({id:nid(),name:"New asset",kind:"fixed",ccy:state.baseCcy,value:0});scheduleSync();renderEntries();};
document.getElementById("edAddGroup").onclick=()=>{const sn=state.snapshots[edIdx];const ex=new Set(sn.entries.map(e=>e.group).filter(Boolean));let base="New group",nm=base,k=2;while(ex.has(nm))nm=base+" "+(k++);sn.entries.push({id:nid(),name:"New asset",kind:"fixed",ccy:state.baseCcy,value:0,group:nm});scheduleSync();renderEntries();};
document.getElementById("edCopyPrev").onclick=()=>{const cur=state.snapshots[edIdx];const prev=state.snapshots.filter(s=>s.year<cur.year).sort((a,b)=>b.year-a.year)[0];if(!prev){toast("No earlier year to copy from");return;}if(cur.entries.length&&!confirm("Replace this year's entries with a copy of "+prev.year+"?"))return;cur.entries=prev.entries.map(e=>({id:nid(),name:e.name,kind:e.kind||"fixed",ccy:e.ccy,value:e.value,shares:e.shares,ticker:e.ticker,group:e.group}));scheduleSync();renderEntries();toast("Copied "+prev.year);};
document.getElementById("edEntries").addEventListener("input",e=>{
  const t=e.target,sn=state.snapshots[edIdx];
  if(t.dataset.grp!=null){const old=t.dataset.grp,nw=t.value;sn.entries.forEach(en=>{if(en.group===old)en.group=nw;});t.dataset.grp=nw;scheduleSync();return;}
  const i=+t.dataset.i,f=t.dataset.f;if(t.dataset.i==null||!f)return;
  const en=sn.entries[i];
  if(f==="value"||f==="shares")en[f]=parseFloat(t.value||0);
  else en[f]=t.value;
  scheduleSync();
  if(f==="kind"||f==="ccy"){renderEntries();return;}
  const card=t.closest(".rcard");const cv=card&&card.querySelector(".rconv");
  if(cv){const bv=entryBase(en);if(en.kind==="ticker"){const p=state.prices[en.ticker];cv.textContent=p?money(bv):(en.ticker?"no price":"set ticker");}else{cv.textContent=en.ccy!==state.baseCcy?("= "+money(bv)):"";}}
  if(en.group){const gb=t.closest(".grp"),gs=gb&&gb.querySelector(".grpsub");if(gs)gs.textContent=money(sn.entries.filter(x=>x.group===en.group).reduce((a,x)=>a+entryBase(x),0));}
  document.getElementById("edTotal").textContent=money(convTo(snapTotalEUR(sn),"EUR",state.baseCcy));
});
document.getElementById("edEntries").addEventListener("change",async e=>{
  const t=e.target,f=t.dataset.f;
  if(t.dataset.grp!=null){renderEntries();return;}
  if(f==="name"){renderEntries();return;}
  if(f==="ticker"&&t.value.trim()){toast("Fetching price…");const ok=await fetchPrice(t.value.trim());scheduleSync();renderEntries();renderAll&&0;toast(ok?"Price updated":"Couldn't fetch that ticker");}
});
document.getElementById("edEntries").addEventListener("click",e=>{
  const sn=state.snapshots[edIdx];
  if(e.target.dataset.del!=null){sn.entries.splice(+e.target.dataset.del,1);scheduleSync();renderEntries();return;}
  const ga=e.target.closest("[data-grpadd]");
  if(ga){sn.entries.push({id:nid(),name:"New asset",kind:"fixed",ccy:state.baseCcy,value:0,group:ga.dataset.grpadd});scheduleSync();renderEntries();return;}
  const gd=e.target.closest("[data-grpdel]");
  if(gd){const g=gd.dataset.grpdel,n=sn.entries.filter(x=>x.group===g).length;if(confirm('Delete the "'+g+'" group and its '+n+' asset'+(n===1?"":"s")+'?')){sn.entries=sn.entries.filter(x=>x.group!==g);scheduleSync();renderEntries();}return;}
});

document.getElementById("addYear").onclick=()=>{const ys=state.snapshots.map(s=>s.year);const ny=ys.length?Math.max(...ys)+1:new Date().getFullYear();state.snapshots.push({year:ny,entries:[]});scheduleSync();openYearEditor(state.snapshots.length-1);};

document.getElementById("exportBtn").onclick=()=>{const b=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="networth-"+new Date().toISOString().slice(0,10)+".json";a.click();};
document.getElementById("importBtn").onclick=()=>document.getElementById("importFile").click();
document.getElementById("importFile").onchange=e=>{const f=e.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{try{const d=JSON.parse(rd.result);if(d.snapshots){state=migrate(d);document.getElementById("ccySel").value=state.baseCcy;scheduleSync();renderAll();toast("Imported");}else toast("No snapshots in that file");}catch(err){toast("Could not read that file");}};rd.readAsText(f);};
document.getElementById("resetBtn").onclick=()=>{if(confirm("Clear all data and start fresh? Export JSON first if you want a backup.")){state=emptyState();document.getElementById("ccySel").value="EUR";scheduleSync();renderAll();toast("Cleared");}};

let toastTimer;function toast(m){const el=document.getElementById("toast");el.textContent=m;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2300);}
try{boot();}catch(e){try{showCreate();}catch(_){}}
