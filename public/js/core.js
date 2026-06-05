const CCYS=["EUR","USD","GBP","CHF","JPY","CAD","AUD","SEK","NOK","DKK","PLN"];
const FALLBACK_FX={EUR:1,USD:1.08,GBP:0.85,CHF:0.96,JPY:170,CAD:1.47,AUD:1.64,SEK:11.4,NOK:11.7,DKK:7.46,PLN:4.3};
const PALETTE=["#4aa3ff","#ff8c1a","#3ad17a","#ffd23a","#ff4d6d","#9b8cff","#2fd0c8","#ffb000","#7aa0ff","#e06be0","#9ad13a","#ff7847"];
let uid=1;const nid=()=>"i"+(uid++)+Date.now().toString(36);

function emptyState(){
  return {v:6,baseCcy:"EUR",fxRates:Object.assign({},FALLBACK_FX),fxDate:null,fxHist:{},prices:{},assets:[],categories:[],salaries:[],snapshots:[{year:new Date().getFullYear(),entries:[]}]};
}
function normLoan(L,fallbackDate){
  if(!L||typeof L!=="object")return null;
  if(L.amount==null)L.amount=0;if(L.rate==null)L.rate=0;if(L.termYears==null)L.termYears=30;if(!L.startDate)L.startDate=fallbackDate;
  if(L.mode!=="payment")L.mode="term";if(L.payment==null)L.payment=0;
  if(L.fixedUntil===undefined)L.fixedUntil=null;   // rate certain until this date; beyond = estimated
  if(!Array.isArray(L.extra))L.extra=[];L.extra.forEach(x=>{if(!x.id)x.id=nid();if(x.amount==null)x.amount=0;if(!x.date)x.date=L.startDate;});
  return L;
}
function migrate(s){
  if(!s.baseCcy)s.baseCcy="EUR";
  if(!s.forecast||typeof s.forecast!=="object")s.forecast={enabled:true,monthly:0,growth:0,goalMode:"amount",goalAmount:0,annualSpending:0,redirectLoans:false};
  else{const f=s.forecast;f.enabled=f.enabled!==false;f.monthly=+f.monthly||0;f.growth=+f.growth||0;f.goalMode=f.goalMode==="spend"?"spend":"amount";f.goalAmount=+f.goalAmount||0;f.annualSpending=+f.annualSpending||0;f.redirectLoans=!!f.redirectLoans;}
  {const f=s.forecast;f.band=!!f.band;f.contribGrowth=+f.contribGrowth||0;f.horizonYear=+f.horizonYear||0;
   if(!f.pension||typeof f.pension!=="object")f.pension={on:false,points:0,ptsPerYear:1,ptValue:39.32,startYear:new Date().getFullYear()+20};
   else{const p=f.pension;p.on=!!p.on;p.points=+p.points||0;p.ptsPerYear=p.ptsPerYear!=null?+p.ptsPerYear:1;p.ptValue=p.ptValue!=null?+p.ptValue:39.32;p.startYear=+p.startYear||(new Date().getFullYear()+20);}}
  if(!s.fxRates)s.fxRates=Object.assign({},FALLBACK_FX);s.fxRates.EUR=1;
  if(!s.prices)s.prices={};
  if(!s.fxHist||typeof s.fxHist!=="object")s.fxHist={};
  const today=new Date().toISOString().slice(0,10);
  if(!Array.isArray(s.assets))s.assets=[];
  // Fold any earlier-format cars/properties into the unified asset list.
  (s.cars||[]).forEach(c=>s.assets.push({id:c.id||nid(),name:c.name||"Asset",ccy:c.ccy||s.baseCcy,value:c.price||0,depreciates:true,date:c.date||today,rate:c.rate!=null?c.rate:0.15,loan:null,group:c.group}));
  (s.properties||[]).forEach(p=>s.assets.push({id:p.id||nid(),name:p.name||"Property",ccy:p.ccy||s.baseCcy,value:p.value||0,depreciates:false,date:(p.loan&&p.loan.startDate)||today,rate:0,loan:normLoan(p.loan,today),group:p.group}));
  delete s.cars;delete s.properties;
  // A long-term asset: a value that optionally depreciates and/or carries a loan.
  s.assets.forEach(a=>{if(!a.id)a.id=nid();if(!a.name)a.name="Asset";if(!a.ccy)a.ccy=s.baseCcy||"EUR";if(a.value==null)a.value=0;
    a.depreciates=!!a.depreciates;a.up=!!a.up;a.liability=!!a.liability;if(!a.date)a.date=today;if(a.rate==null)a.rate=0.15;
    a.loan=a.loan?normLoan(a.loan,a.date):null;});
  // Salary history: one record per person, each a list of monthly net-pay entries.
  if(!Array.isArray(s.salaries))s.salaries=[];
  s.salaries.forEach(p=>{if(!p.id)p.id=nid();if(!p.name)p.name="Person";if(!p.ccy)p.ccy=s.baseCcy||"EUR";if(!Array.isArray(p.entries))p.entries=[];
    p.entries.forEach(en=>{if(!en.id)en.id=nid();if(!en.ym)en.ym=new Date().toISOString().slice(0,7);if(en.amount==null)en.amount=(parseFloat(en.base)||0)+(parseFloat(en.extra)||0);if(en.event==null)en.event="";if(!en.ccy)en.ccy=p.ccy||s.baseCcy||"EUR";delete en.base;delete en.extra;});});
  (s.snapshots||[]).forEach(sn=>{
    if(!sn.entries){const c=sn.cats||{};sn.entries=Object.keys(c).filter(k=>c[k]).map(k=>({id:nid(),name:k,ccy:"EUR",value:c[k]}));}
    sn.entries.forEach(en=>{if(!en.id)en.id=nid();if(!en.name)en.name=en.cat||"Asset";if(!en.ccy)en.ccy="EUR";if(en.value==null)en.value=0;if(!en.kind)en.kind="fixed";if(en.kind==="ticker"){if(en.shares==null)en.shares=0;if(en.ticker==null)en.ticker="";}delete en.cat;delete en.qty;});
    delete sn.cats;
  });
  // Categories are a global list (tags). Backfill from any groups already in use.
  if(!Array.isArray(s.categories))s.categories=[];
  const cset=new Set(s.categories);
  (s.snapshots||[]).forEach(sn=>(sn.entries||[]).forEach(e=>{if(e.group)cset.add(e.group);}));
  (s.assets||[]).forEach(a=>{if(a.group)cset.add(a.group);});
  s.categories=[...cset];
  ensureDel(s);   // tombstone store for cross-device deletions
  delete s.items;s.v=6;return s;
}
let state=emptyState();

/* fx + format */
function rate(c){if(c==="EUR")return 1;const r=state.fxRates&&state.fxRates[c];return (r&&r>0)?r:(FALLBACK_FX[c]||1);}
// Rate as of a snapshot year: that year's ECB year-end rate for past years (once fetched),
// otherwise the current/live rate. EUR is always the 1.0 base.
function rateAt(c,year){
  const cy=new Date().getFullYear();
  if(year!=null&&year<cy){const h=state.fxHist&&state.fxHist[year];if(h){if(c==="EUR")return 1;const r=h[c];if(r&&r>0)return r;}}
  return rate(c);
}
const convTo=(a,from,to)=>a*rate(to)/rate(from);
const convToY=(a,from,to,year)=>a*rateAt(to,year)/rateAt(from,year);
function money(v){try{return new Intl.NumberFormat("en-IE",{style:"currency",currency:state.baseCcy,maximumFractionDigits:0}).format(v);}catch(e){return state.baseCcy+" "+Math.round(v).toLocaleString();}}
function moneyIn(v,ccy){try{return new Intl.NumberFormat("en-IE",{style:"currency",currency:ccy,maximumFractionDigits:2}).format(v);}catch(e){return ccy+" "+(+v).toFixed(2);}}
function ccySym(){try{const p=new Intl.NumberFormat("en-IE",{style:"currency",currency:state.baseCcy}).formatToParts(0);const s=p.find(x=>x.type==="currency");return s?s.value:state.baseCcy;}catch(e){return state.baseCcy;}}
const esc=s=>String(s).replace(/"/g,"&quot;").replace(/</g,"&lt;");

/* asset colours (stable within the current set of series). A "series" is the
   entry's group if it has one, otherwise the asset's own name — so charts show
   one segment per group, summing its members. */
const seriesKey=e=>e.group||e.name;
function allNames(){return [...new Set(state.snapshots.flatMap(s=>effEntries(s).filter(e=>!isLiability(e)).map(seriesKey)))].sort((a,b)=>a.localeCompare(b));}
function colorOf(name,names){const i=(names||allNames()).indexOf(name);return PALETTE[(i<0?0:i)%PALETTE.length];}

/* totals */
// Effective price for a ticker entry: a frozen historical close (past years) if one
// is stored on the entry, otherwise the live fetched price.
function tickerPx(en){
  if(en.px!=null)return{price:en.px,currency:en.pxCcy||en.ccy||"EUR",frozen:true};
  const p=state.prices[en.ticker];
  if(p)return{price:p.price,currency:p.currency,prevClose:p.prevClose,frozen:false};
  return null;
}
const isLiability=en=>en.kind==="liability";
function entryNative(en){
  if(en.kind==="ticker"){const p=tickerPx(en);if(!p)return{v:0,ccy:en.ccy||"EUR",miss:true};return{v:(parseFloat(en.shares)||0)*p.price,ccy:p.currency};}
  // Liabilities are entered as a positive amount owed but count negative toward net worth.
  if(isLiability(en))return {v:-(parseFloat(en.value)||0),ccy:en.ccy||"EUR"};
  return {v:parseFloat(en.value)||0,ccy:en.ccy||"EUR"};
}
const entryEUR=(en,year)=>{const n=entryNative(en);return convToY(n.v,n.ccy,"EUR",year);};
const entryBase=(en,year)=>{const n=entryNative(en);return convToY(n.v,n.ccy,state.baseCcy,year);};
function dayChangeBase(nw){
  const ls=latestSnap();if(!ls)return null;
  let abs=0,any=false;
  ls.entries.forEach(en=>{
    if(en.kind!=="ticker"||en.px!=null)return;   // frozen historical holdings have no daily change
    const p=state.prices[en.ticker];if(!p||p.prevClose==null)return;
    const sh=parseFloat(en.shares)||0;
    abs+=convTo(sh*(p.price-p.prevClose),p.currency,state.baseCcy);
    any=true;
  });
  if(!any)return null;
  const prev=nw-abs;
  return {abs,pct:prev>0?abs/prev*100:0};
}
/* computed assets: vehicles (depreciating) + property equity (value − mortgage).
   These live at the top level of state and are injected into every relevant
   year's snapshot as read-only "auto" entries, so net worth always reflects them. */
const DAY_MS=86400000, YEAR_MS=365.25*DAY_MS;
// Parse YYYY-MM-DD as a LOCAL date (not UTC) so day-of-month never shifts by timezone.
const parseDate=s=>{
  if(typeof s==="string"){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);if(m)return new Date(+m[1],+m[2]-1,+m[3]);}
  const d=new Date(s);return isNaN(+d)?null:d;
};
// Round to whole cents, half-up, with a tiny epsilon so exact half-cents (e.g. 1484.375)
// don't fall the wrong way through floating-point error — matches how banks amortize.
const round2=v=>Math.round((v+1e-9)*100)/100;
// Reference date for a snapshot: today for the current year (so values move daily),
// year-end for any other year (past values are locked, future ones projected).
function refDateForYear(y){const cy=new Date().getFullYear();if(y===cy)return new Date();return new Date(y,11,31,23,59,59);}
// Continuous declining-balance: value loses `rate` of itself per year, every day.
// Continuous compounding: value grows (up) or shrinks at `rate` per year, every day.
function compoundedValue(price,rate,fromDate,date,up){
  const d0=parseDate(fromDate);if(!d0)return +price||0;
  const yrs=(date-d0)/YEAR_MS;if(yrs<=0)return +price||0;
  const r=Math.min(Math.max(+rate||0,0),up?5:0.99);
  return (+price||0)*Math.pow(up?(1+r):(1-r),yrs);
}
// Gross (pre-loan) value on a date: a value that compounds up/down over time, or flat market value.
function assetGrossAt(a,date){return a.depreciates?compoundedValue(a.value,a.rate,a.date,date,a.up):(+a.value||0);}
// Net contribution: gross value minus any outstanding loan balance.
function assetNetAt(a,date){return assetGrossAt(a,date)-(a.loan?outstandingAt(a.loan,date):0);}
// When the asset starts counting toward net worth: the earliest of its depreciation
// (purchase) date and its loan start date — so a mortgage shows from the loan's start,
// not from the unused "bought" date. Plain value assets use their own date.
function assetOwnedFrom(a){
  const c=[];
  if(a.depreciates){const d=parseDate(a.date);if(d)c.push(+d);}
  if(a.loan){const d=parseDate(a.loan.startDate);if(d)c.push(+d);}
  if(!c.length){const d=parseDate(a.date);if(d)c.push(+d);}
  return c.length?new Date(Math.min(...c)):null;
}
function addMonths(date,m){const d=new Date(date);const day=d.getDate();d.setMonth(d.getMonth()+m);if(d.getDate()<day)d.setDate(0);return d;}
const fmtMonths=n=>{if(!isFinite(n)||n<=0)return"—";const y=Math.floor(n/12),mo=Math.round(n%12);return [y?y+" yr":"",mo?mo+" mo":""].filter(Boolean).join(" ")||"0 mo";};
// Resolve a loan's monthly payment (M) and number of months (n) from whichever
// the user fixed: the term (compute the payment) or the payment (compute the term).
function loanTerms(loan){
  const L=+loan.amount||0,i=(+loan.rate||0)/100/12;
  if(loan.mode==="payment"){
    const M=+loan.payment||0;let n;
    if(M<=0)n=0;
    else if(i<=0)n=Math.ceil(L/M-1e-7);
    else if(M<=L*i)n=Infinity;                                  // payment can't cover interest
    else n=Math.ceil(-Math.log(1-L*i/M)/Math.log(1+i)-1e-7);    // -eps avoids FP off-by-one
    return {L,i,M,n};
  }
  const n=Math.round((+loan.termYears||0)*12);
  const M=(L>0&&n>0)?(i>0?L*i/(1-Math.pow(1+i,-n)):L/n):0;
  return {L,i,M,n};
}
// Full monthly amortization schedule, applying extra principal payments by date.
function buildSchedule(loan){
  const {L,i,M,n}=loanTerms(loan),rows=[];
  const start=parseDate(loan.startDate);if(L<=0||!start||!(M>0)||!isFinite(n)||n<=0)return rows;
  const cap=Math.min(n,1200),pay=round2(M);
  const fixedUntil=loan.fixedUntil?parseDate(loan.fixedUntil):null;   // rate certain until here
  const est=d=>!!(fixedUntil&&d>=fixedUntil);                          // beyond = estimated projection
  const extras=(loan.extra||[]).map(e=>({d:parseDate(e.date),a:round2(+e.amount||0)})).filter(e=>e.d&&e.a>0).sort((a,b)=>a.d-b.d);
  let bal=round2(L),ei=0;
  for(let k=0;k<cap&&bal>0.005;k++){
    const date=addMonths(start,k+1);
    // Extra payments billed by this (in-arrears) payment: an extra paid on day D of
    // its month stops interest on that sum for the remaining (30−D) days (30/360),
    // so this month's interest is credited accordingly before deriving principal.
    let extraThis=0,credit=0,running=bal;
    while(ei<extras.length&&extras[ei].d<date){
      const x=extras[ei],day=Math.min(30,Math.max(1,x.d.getDate()));
      credit+=x.a*(30-day)/30; extraThis=round2(extraThis+x.a);
      running=round2(running-x.a);
      rows.push({type:"extra",date:x.d,extra:x.a,balance:running,estimated:est(x.d)});   // standalone dated overpayment
      ei++;
    }
    // Round each month's interest to whole cents, like a bank statement, then carry forward.
    const interest=round2((bal-credit)*i);
    let principal=round2(pay-interest),rowPay=pay;
    if(principal>bal){principal=bal;rowPay=round2(interest+principal);}   // final (partial) payment
    bal=round2(bal-principal-extraThis);
    if(bal<0)bal=0;
    rows.push({type:"payment",date,payment:rowPay,interest,principal,balance:bal,estimated:est(date)});
  }
  return rows;
}
function outstandingAt(loan,asOf){
  const rows=buildSchedule(loan);if(!rows.length)return Math.max(0,+loan.amount||0);
  let bal=+loan.amount||0;
  for(const r of rows){if(r.date<=asOf)bal=r.balance;else break;}
  return Math.max(0,bal);
}
// Synthetic entries: each long-term asset's net value, for the years it's owned.
function autoEntriesFor(year){
  const ref=refDateForYear(year),out=[];
  (state.assets||[]).forEach(a=>{const from=assetOwnedFrom(a);if(from&&from>ref)return;
    if(a.liability){const bal=a.loan?outstandingAt(a.loan,ref):0;if(bal<=0.005&&from&&from<ref)return;  // paid off — drop once cleared
      out.push({id:"asset:"+a.id,auto:true,assetId:a.id,kind:"liability",name:a.name||"Liability",ccy:a.ccy||state.baseCcy,value:bal,group:a.group});}
    else out.push({id:"asset:"+a.id,auto:true,assetId:a.id,kind:"fixed",name:a.name||"Asset",ccy:a.ccy||state.baseCcy,value:assetNetAt(a,ref),group:a.group});});
  return out;
}
const effEntries=sn=>(sn.entries||[]).concat(autoEntriesFor(sn.year));
const snapTotalEUR=sn=>effEntries(sn).reduce((a,e)=>a+entryEUR(e,sn.year),0);
const snapTotalBase=sn=>effEntries(sn).reduce((a,e)=>a+entryBase(e,sn.year),0);
const snapGrossBase=sn=>effEntries(sn).reduce((a,e)=>{const v=entryBase(e,sn.year);return a+(v>0?v:0);},0);  // assets only (for bar stacks/axis)
const snapLiabBase=sn=>effEntries(sn).filter(isLiability).reduce((a,e)=>a-entryBase(e,sn.year),0);            // total owed (positive)
const sortedSnaps=()=>[...state.snapshots].sort((a,b)=>a.year-b.year);
const latestSnap=()=>sortedSnaps().slice(-1)[0];

/* ---- Forecast: project net worth forward ----
   Long-term assets compound (up/down) and loans amortise via their own engines, so they
   project exactly for any future date. The "liquid" portion (the latest year's manually
   entered values) is grown at an assumed annual return, and a planned monthly contribution
   is added with monthly compounding. Future FX is unknown, so current rates are used. */
function fcCfg(){if(!state.forecast||typeof state.forecast!=="object")state.forecast={enabled:true,monthly:0,growth:0,goalMode:"amount",goalAmount:0,annualSpending:0,redirectLoans:false};return state.forecast;}
// Net of all long-term assets/liabilities (in base ccy) on an arbitrary date.
function ltNetBaseAt(date){return (state.assets||[]).reduce((s,a)=>{const from=assetOwnedFrom(a);if(from&&from>date)return s;const nat=a.liability?-(a.loan?outstandingAt(a.loan,date):0):assetNetAt(a,date);return s+convTo(nat,a.ccy||state.baseCcy,state.baseCcy);},0);}
// The manually-entered ("liquid") portion of the latest snapshot, in base ccy.
function manualNetBase(){const ls=latestSnap();if(!ls)return 0;return (ls.entries||[]).reduce((s,e)=>s+entryBase(e,ls.year),0);}
const MONTH_MS=YEAR_MS/12;
// When "reinvest after payoff" is on, each future loan payoff frees its monthly payment
// into the contribution stream from that month on: [{month, amt(base)}].
function redirectStreams(){const fc=fcCfg();if(!fc.redirectLoans)return [];const now=new Date(),out=[];
  (state.assets||[]).forEach(a=>{if(!a.loan)return;const rows=buildSchedule(a.loan),pays=rows.filter(r=>r.type!=="extra");if(!pays.length)return;
    const payoff=pays[pays.length-1].date;if(payoff<=now)return;const M=loanTerms(a.loan).M;if(!(M>0)||!isFinite(M))return;
    out.push({month:Math.max(1,Math.round((payoff-now)/MONTH_MS)),amt:convTo(M,a.ccy||state.baseCcy,state.baseCcy)});});
  return out;}
// Future value of the contribution stream to `date`: a monthly amount that ramps each year
// (raises), steps up as each loan is paid off (if reinvest is on), grown at the assumed
// monthly return. `gOverride` lets the scenario band re-run at low/high returns.
function contribFV(date,gOverride){const fc=fcCfg(),g=gOverride!=null?gOverride:(+fc.growth||0),i=g/12,cg=+fc.contribGrowth||0,now=new Date();
  const months=Math.round((date-now)/MONTH_MS);if(months<=0)return 0;
  const streams=redirectStreams();let fv=0,base=+fc.monthly||0,redirect=0;
  for(let m=0;m<months;m++){if(m>0&&m%12===0)base*=(1+cg);for(const s of streams)if(s.month===m)redirect+=s.amt;fv=fv*(1+i)+base+redirect;}
  return fv;}
function forecastNetAt(date,gOverride){const fc=fcCfg(),g=gOverride!=null?gOverride:(+fc.growth||0);let t=(date-new Date())/YEAR_MS;if(t<0)t=0;
  const grown=manualNetBase()*Math.pow(1+g,t);
  return grown+contribFV(date,gOverride)+ltNetBaseAt(date);}
// Scenario band returns: poor / expected / great (expected ∓ 3pp, floored at 0).
function fcBandRates(){const g=+fcCfg().growth||0;return {lo:Math.max(0,g-0.03),mid:g,hi:g+0.03};}
// German statutory pension: total Rentenpunkte (points so far + points/yr until start) × point value.
function pensionPts(){const p=fcCfg().pension;if(!p||!p.on)return 0;const cy=new Date().getFullYear();const yrs=Math.max(0,(+p.startYear||cy)-cy);return (+p.points||0)+(+p.ptsPerYear||0)*yrs;}
function pensionMonthly(){const p=fcCfg().pension;if(!p||!p.on)return 0;return pensionPts()*(+p.ptValue||0);}
function pensionAnnual(){return pensionMonthly()*12;}
// Goal target: an explicit amount, or (annual spending − statutory pension) × 25 (the 4% rule).
function fcTarget(){const fc=fcCfg();if(fc.goalMode!=="spend")return +fc.goalAmount||0;
  return Math.max(0,(+fc.annualSpending||0)-pensionAnnual())*25;}
// Across every loan (asset-backed or standalone), the last payment date and remaining interest.
function debtSummary(){const now=new Date();let payoff=null,rem=0,has=false;
  (state.assets||[]).forEach(a=>{if(!a.loan)return;const rows=buildSchedule(a.loan),pays=rows.filter(r=>r.type!=="extra");if(!pays.length)return;has=true;
    const last=pays[pays.length-1].date;if(!payoff||last>payoff)payoff=last;
    pays.forEach(r=>{if(r.date>now)rem+=convTo(r.interest||0,a.ccy||state.baseCcy,state.baseCcy);});});
  return {has,payoff,rem};}

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
// gzip/gunzip via the browser's Compression Streams (no library). JSON compresses well,
// so we compress BEFORE encrypting (ciphertext itself is incompressible). Falls back to
// uncompressed if the API is missing; reads detect gzip by its magic bytes (1f 8b).
async function gzip(bytes){if(typeof CompressionStream==="undefined")return null;const s=new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));return new Uint8Array(await new Response(s).arrayBuffer());}
async function gunzip(bytes){const s=new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));return new Uint8Array(await new Response(s).arrayBuffer());}
async function encS(){const iv=crypto.getRandomValues(new Uint8Array(12));let data=new TextEncoder().encode(JSON.stringify(state));const gz=await gzip(data);if(gz)data=gz;const ct=await crypto.subtle.encrypt({name:"AES-GCM",iv},cryptoKey,data);return b64(iv)+"."+b64(ct);}
async function decS(blob){const[i,c]=blob.split(".");const buf=await crypto.subtle.decrypt({name:"AES-GCM",iv:new Uint8Array(unb64(i))},cryptoKey,unb64(c));let pt=new Uint8Array(buf);if(pt[0]===0x1f&&pt[1]===0x8b)pt=await gunzip(pt);return JSON.parse(new TextDecoder().decode(pt));}

/* persistence/sync */
const LS={get(k){try{return localStorage.getItem(k);}catch(e){return null;}},set(k,v){try{localStorage.setItem(k,v);}catch(e){}},rem(k){try{localStorage.removeItem(k);}catch(e){}}};
// Keep a one-deep backup of the previous local state, so a bad save/clobber is recoverable.
const saveLocal=()=>{try{const prev=LS.get("nw_state");if(prev)LS.set("nw_state_bak",prev);}catch(e){}LS.set("nw_state",JSON.stringify(state));};
const loadLocal=()=>{const r=LS.get("nw_state");try{return r?JSON.parse(r):null;}catch(e){return null;}};
let syncTimer;function scheduleSync(){state.updatedAt=Date.now();stampMtimes();saveLocal();clearTimeout(syncTimer);syncTimer=setTimeout(pushServer,1200);}
function flushSync(){clearTimeout(syncTimer);pushServer();}   // push the pending change immediately
let syncWarned=false;
async function pushServer(manual){if(!accountId||!cryptoKey)return;try{stampMtimes();const blob=await encS();
  if(blob.length>1900000){setSync("off","Too big to sync");toast("Data too large to sync — Export JSON to back up");return;}
  const r=await fetch("/api/vault",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({id:accountId,blob})});
  if(r.ok){setSync("ok","Synced");syncWarned=false;setBaseline();if(manual)toast("Data sent to server ✓");}
  else{setSync("off","Sync error");if(manual||!syncWarned){syncWarned=true;toast("Sync failed — changes are saved on this device only");}}
}catch(e){setSync("off","Local only");if(manual||!syncWarned){syncWarned=true;toast("Sync failed — changes are saved on this device only");}}}
async function loadServer(){if(!accountId)return null;try{const r=await fetch("/api/vault?id="+accountId);if(r.status===404){setSync("ok","Synced (new)");return null;}if(!r.ok){setSync("off","Local only");return null;}const{blob}=await r.json();const o=await decS(blob);setSync("ok","Synced");return o;}catch(e){setSync("off","Local only");return null;}}
function setSync(c,t){const cls="syncdot "+(c==="ok"?"ok":c==="off"?"off":"");["syncDot","syncDot2"].forEach(id=>{const d=document.getElementById(id);if(d)d.className=cls;});["syncTxt","syncTxt2"].forEach(id=>{const x=document.getElementById(id);if(x)x.textContent=t;});}

/* ───────── multi-device merge: per-record mtimes + tombstones ─────────
   Edits aren't stamped in every handler; instead we diff against the last-synced
   "baseline" to assign a modified-time (m) to each changed record and a tombstone
   to each removed one. On load we merge local+remote per record (newest m wins,
   deletions honoured) instead of letting one whole document overwrite the other. */
let baseline=null;
const cloneState=s=>JSON.parse(JSON.stringify(s));
function setBaseline(){try{baseline=cloneState(state);}catch(e){baseline=null;}}
const sigNoM=o=>{const c=Object.assign({},o);delete c.m;return JSON.stringify(c);};
function ensureDel(s){s.del=s.del||{};["asset","snap","sper","sent"].forEach(k=>{if(!s.del[k])s.del[k]={};});return s.del;}
function stampMtimes(){
  const now=Date.now(),b=baseline||{},del=ensureDel(state);
  const stamp=(cur,base,key,tomb)=>{
    const bm=new Map((base||[]).map(r=>[key(r),r])),seen=new Set();
    (cur||[]).forEach(r=>{const id=key(r);seen.add(id);const o=bm.get(id);
      if(!o)r.m=r.m||now;else if(sigNoM(r)!==sigNoM(o))r.m=now;else r.m=r.m||o.m||0;});
    bm.forEach((o,id)=>{if(!seen.has(id))tomb[id]=now;});
  };
  stamp(state.assets,b.assets,a=>a.id,del.asset);
  stamp(state.snapshots,b.snapshots,s=>String(s.year),del.snap);
  const bp=new Map((b.salaries||[]).map(p=>[p.id,p])),seenP=new Set();
  (state.salaries||[]).forEach(p=>{seenP.add(p.id);const o=bp.get(p.id);
    const meta=JSON.stringify([p.name,p.ccy,p.group]);
    if(!o)p.m=p.m||now;else if(meta!==JSON.stringify([o.name,o.ccy,o.group]))p.m=now;else p.m=p.m||o.m||0;
    const be=new Map(((o&&o.entries)||[]).map(e=>[e.ym,e])),seenE=new Set();
    (p.entries||[]).forEach(e=>{seenE.add(e.ym);const oe=be.get(e.ym);
      if(!oe)e.m=e.m||now;else if(sigNoM(e)!==sigNoM(oe))e.m=now;else e.m=e.m||oe.m||0;});
    be.forEach((oe,ym)=>{if(!seenE.has(ym))del.sent[p.id+"|"+ym]=now;});
  });
  bp.forEach((o,id)=>{if(!seenP.has(id))del.sper[id]=now;});
}
function mergeDel(a,b){a=a||{};b=b||{};const out={};["asset","snap","sper","sent"].forEach(k=>{const o={};Object.entries(a[k]||{}).forEach(([i,t])=>o[i]=Math.max(o[i]||0,t));Object.entries(b[k]||{}).forEach(([i,t])=>o[i]=Math.max(o[i]||0,t));out[k]=o;});return out;}
function mergeArr(la,ra,key,tomb){const m=new Map();const add=r=>{const id=key(r),mt=+r.m||0,t=tomb[id]||0;if(t>0&&t>=mt)return;const ex=m.get(id);if(!ex||(+ex.m||0)<mt)m.set(id,r);};(la||[]).forEach(add);(ra||[]).forEach(add);return [...m.values()];}
function mergeSal(la,ra,del){
  const A=new Map((la||[]).map(p=>[p.id,p])),B=new Map((ra||[]).map(p=>[p.id,p])),out=[];
  new Set([...A.keys(),...B.keys()]).forEach(id=>{
    const pa=A.get(id),pb=B.get(id),pm=Math.max(pa?+pa.m||0:0,pb?+pb.m||0:0),t=del.sper[id]||0;
    if(t>0&&t>=pm)return;
    const meta=((pa?+pa.m||0:0)>=(pb?+pb.m||0:0)?pa:pb)||pa||pb,em=new Map();
    const addE=e=>{const tt=del.sent[id+"|"+e.ym]||0,mt=+e.m||0;if(tt>0&&tt>=mt)return;const ex=em.get(e.ym);if(!ex||(+ex.m||0)<mt)em.set(e.ym,e);};
    ((pa&&pa.entries)||[]).forEach(addE);((pb&&pb.entries)||[]).forEach(addE);
    out.push(Object.assign({},meta,{entries:[...em.values()]}));});
  return out;
}
// Merge two states per record (newest m wins; tombstones win over older edits).
function mergeStates(a,b){
  const out=cloneState((+a.updatedAt||0)>=(+b.updatedAt||0)?a:b);
  const del=mergeDel(a.del,b.del);out.del=del;
  out.assets=mergeArr(a.assets,b.assets,x=>x.id,del.asset);
  out.snapshots=mergeArr(a.snapshots,b.snapshots,x=>String(x.year),del.snap);
  out.salaries=mergeSal(a.salaries,b.salaries,del);
  out.categories=[...new Set([...(a.categories||[]),...(b.categories||[])])];
  out.updatedAt=Math.max(+a.updatedAt||0,+b.updatedAt||0);
  return out;
}
async function fetchFx(){try{const r=await fetch("/api/fx");if(!r.ok)return false;const d=await r.json();if(d.rates){state.fxRates=Object.assign({EUR:1},d.rates);state.fxDate=d.date;return true;}}catch(e){}return false;}
// Year-end (Dec 31) ECB rates for a year — used to convert past-year holdings at the rate then.
async function fetchFxYear(year){try{const r=await fetch("/api/fx?date="+year+"-12-31");if(!r.ok)return null;const d=await r.json();if(d.rates)return Object.assign({EUR:1},d.rates);}catch(e){}return null;}
async function refreshHistFx(){
  const cy=new Date().getFullYear();state.fxHist=state.fxHist||{};let changed=false;
  for(const y of [...new Set(state.snapshots.map(s=>s.year))]){
    if(y>=cy||state.fxHist[y])continue;
    const h=await fetchFxYear(y);if(h){state.fxHist[y]=h;changed=true;}
  }
  return changed;
}
// Make sure past-year holdings are valued at that year's price + FX. Re-renders the
// open editor (or home) only if something was actually fetched, so it won't disrupt typing.
function ensureHist(){
  try{Promise.all([refreshHistPrices(),refreshHistFx()]).then(([a,b])=>{
    if(a||b){scheduleSync();if(!document.getElementById("yearEditor").classList.contains("hide"))renderEntries();else renderAll();}
  }).catch(()=>{});}catch(e){}
}
// On page open: refresh live FX + ticker prices, plus historical year-end values.
// Silent (no toasts); returns true if anything actually changed, so the caller can re-sync/re-render.
async function autoRefresh(){
  let changed=false;
  try{const pd=state.fxDate;if(await fetchFx()&&state.fxDate!==pd)changed=true;}catch(e){}
  try{if(!state.prices)state.prices={};const ts=tickersInUse();
    for(const t of ts){const old=state.prices[t]&&state.prices[t].price;if(await fetchPrice(t)&&state.prices[t].price!==old)changed=true;}
    if(ts.length)state.lastPx=Date.now();}catch(e){}
  try{if(await refreshHistFx())changed=true;}catch(e){}
  try{if(await refreshHistPrices())changed=true;}catch(e){}
  return changed;
}
async function fetchPrice(t){try{const r=await fetch("/api/price?ticker="+encodeURIComponent(t));if(!r.ok)return false;const d=await r.json();if(d.price!=null){state.prices[t]={price:d.price,prevClose:(d.prevClose!=null?d.prevClose:d.price),currency:d.currency||"USD",t:Date.now()};return true;}}catch(e){}return false;}
function tickersInUse(){return [...new Set(state.snapshots.flatMap(s=>s.entries).filter(e=>e.kind==="ticker"&&e.ticker).map(e=>e.ticker))];}
// Year-end close for a ticker, used to value holdings held in a past year.
async function fetchPriceYear(t,year){try{const r=await fetch("/api/price?ticker="+encodeURIComponent(t)+"&year="+year);if(!r.ok)return null;const d=await r.json();if(d.price!=null)return{price:d.price,currency:d.currency||"USD"};}catch(e){}return null;}
// Freeze each past-year ticker holding to that year's close (stored on the entry);
// current/future-year holdings stay on the live price. Returns true if anything changed.
async function refreshHistPrices(){
  const cy=new Date().getFullYear();let changed=false;
  for(const sn of state.snapshots){const past=sn.year<cy;
    for(const en of (sn.entries||[])){
      if(en.kind!=="ticker"||!en.ticker)continue;
      if(past){const key=en.ticker+"@"+sn.year;
        if(en.px!=null&&en.pxKey===key)continue;
        const r=await fetchPriceYear(en.ticker,sn.year);
        if(r){en.px=r.price;en.pxCcy=r.currency;en.pxKey=key;changed=true;}
      }else if(en.px!=null){delete en.px;delete en.pxCcy;delete en.pxKey;changed=true;}
    }
  }
  return changed;
}
async function refreshPrices(){
  const ts=tickersInUse();if(!ts.length){toast("No ticker holdings to refresh");return;}
  toast("Fetching prices…");let n=0;for(const t of ts){if(await fetchPrice(t))n++;}
  await refreshHistPrices();
  state.lastPx=Date.now();scheduleSync();renderAll();toast(n+"/"+ts.length+" prices updated");
}

