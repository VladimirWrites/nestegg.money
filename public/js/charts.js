/* render */
function getCss(v){return v;}
function renderAll(){drawHist();drawHistLegend();renderYears();drawDonut();updNote();renderForecast();}

const FC_AMBER="#ffb000",FC_GREEN="#3ad17a";
function fcSyncInputs(){const fc=fcCfg();
  const m=document.getElementById("fcMonthly");if(m&&document.activeElement!==m)m.value=fc.monthly||"";
  const g=document.getElementById("fcGrowth");if(g&&document.activeElement!==g)g.value=fc.growth?+(fc.growth*100).toFixed(2):"";
  const gm=document.getElementById("fcGoalMode");if(gm)gm.value=fc.goalMode;
  const lbl=document.getElementById("fcGoalLbl");if(lbl)lbl.textContent=fc.goalMode==="spend"?"Annual spending":"Target amount";
  const gv=document.getElementById("fcGoalVal");if(gv&&document.activeElement!==gv)gv.value=(fc.goalMode==="spend"?fc.annualSpending:fc.goalAmount)||"";}
function moY(d){return d?d.toLocaleDateString("en-GB",{month:"short",year:"numeric"}):"";}
function renderForecast(){
  const svg=document.getElementById("fcChart");if(!svg)return;fcSyncInputs();
  const stEl=document.getElementById("fcStats"),fc=fcCfg(),now=new Date(),cy=now.getFullYear();
  const actual=sortedSnaps().map(s=>({y:s.year,v:snapTotalBase(s)}));
  if(!actual.length){svg.innerHTML="";svg.removeAttribute("width");if(stEl)stEl.innerHTML='<div class="fchint">Add a year of net worth to see your trajectory.</div>';return;}
  const lastA=actual[actual.length-1],target=fcTarget();
  // FIRE crossing
  let fireY=null;if(target>0){if(forecastNetAt(now)>=target)fireY=cy;else for(let Y=cy+1;Y<=cy+50;Y++){if(forecastNetAt(new Date(Y,11,31))>=target){fireY=Y;break;}}}
  // horizon
  let horizon=cy+25;if(target>0)horizon=fireY?Math.min(fireY+3,cy+45):cy+45;horizon=Math.max(horizon,lastA.y+1);
  // projection from the last actual point forward (dashed, connects to the solid line)
  const proj=[];for(let Y=lastA.y;Y<=horizon;Y++)proj.push({y:Y,v:Y<=lastA.y?lastA.v:forecastNetAt(new Date(Y,11,31))});
  const projEnd=proj[proj.length-1];
  const minY=actual[0].y,maxY=horizon,span=Math.max(1,maxY-minY);
  const allV=actual.map(p=>Math.max(0,p.v)).concat(proj.map(p=>Math.max(0,p.v)));if(target>0)allV.push(target);
  const nm=niceCeil(Math.max(1,...allV));
  const padL=58,padR=16,padT=22,padB=30,perY=Math.max(20,Math.min(46,Math.round(720/span))),innerW=span*perY,W=Math.max(innerW+padL+padR,320),H=280,plotH=H-padT-padB;
  const X=y=>padL+(y-minY)/span*innerW,Y=v=>padT+plotH-(Math.max(0,v)/nm)*plotH;
  svg.setAttribute("width",W);svg.setAttribute("height",H);svg.setAttribute("viewBox",`0 0 ${W} ${H}`);
  let s="";const sym=ccySym();
  for(let i=0;i<=5;i++){const val=nm*i/5,y=padT+plotH-(val/nm)*plotH;s+=`<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="#26262a" stroke-width="1"/>`;s+=`<text x="${padL-8}" y="${y+3}" text-anchor="end" font-family="ui-monospace,monospace" font-size="9" fill="#8a867c">${sym}${shortK(val)}</text>`;}
  // x labels — first, last, and a sparse set between
  const step=Math.max(1,Math.ceil(span/8));for(let y=minY;y<=maxY;y+=step){s+=`<text x="${X(y)}" y="${H-padB+15}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="9.5" fill="#8a867c">${y}</text>`;}
  if((maxY-minY)%step!==0)s+=`<text x="${X(maxY)}" y="${H-padB+15}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="9.5" fill="#8a867c">${maxY}</text>`;
  // goal line
  if(target>0&&target<=nm){const gy=Y(target);s+=`<line x1="${padL}" y1="${gy}" x2="${W-padR}" y2="${gy}" stroke="${FC_GREEN}" stroke-width="1.4" stroke-dasharray="2 4"/>`;s+=`<text x="${W-padR}" y="${gy-5}" text-anchor="end" font-family="ui-monospace,monospace" font-size="9" fill="${FC_GREEN}">goal ${sym}${shortK(target)}</text>`;}
  // projection (dashed)
  s+=`<polyline points="${proj.map(p=>X(p.y)+","+Y(p.v)).join(" ")}" fill="none" stroke="${FC_AMBER}" stroke-width="2" stroke-dasharray="5 4" opacity="0.85"/>`;
  // actual (solid) + dots
  s+=`<polyline points="${actual.map(p=>X(p.y)+","+Y(p.v)).join(" ")}" fill="none" stroke="${FC_AMBER}" stroke-width="2.4"/>`;
  actual.forEach(p=>{s+=`<circle cx="${X(p.y)}" cy="${Y(p.v)}" r="3" fill="${FC_AMBER}"><title>${p.y}: ${money(p.v)}</title></circle>`;});
  // fire crossing marker
  if(fireY&&forecastNetAt(new Date(fireY,11,31))>=target){const fx=X(fireY),fyv=Y(Math.min(target,nm));s+=`<line x1="${fx}" y1="${padT}" x2="${fx}" y2="${padT+plotH}" stroke="${FC_GREEN}" stroke-width="1" stroke-dasharray="2 3" opacity="0.7"/>`;s+=`<circle cx="${fx}" cy="${fyv}" r="4" fill="${FC_GREEN}"><title>Goal reached ${fireY}</title></circle>`;}
  // projection endpoint
  s+=`<circle cx="${X(projEnd.y)}" cy="${Y(projEnd.v)}" r="3" fill="${FC_AMBER}" opacity="0.85"><title>${projEnd.y}: ${money(projEnd.v)}</title></circle>`;
  svg.innerHTML=s;
  // stats
  const d=debtSummary();
  const goalStat=target>0?(fireY?`<div class="fcstat"><span class="k">${fc.goalMode==="spend"?"FIRE goal ("+money(target)+")":"Goal "+money(target)}</span><span class="v ok">${fireY<=cy?"reached 🎉":("~"+fireY+" · in "+(fireY-cy)+" yr"+(fireY-cy===1?"":"s"))}</span></div>`:`<div class="fcstat"><span class="k">Goal ${money(target)}</span><span class="v">not within 45 yrs</span></div>`):`<div class="fcstat"><span class="k">Goal</span><span class="v dim">set a target above</span></div>`;
  const debtStat=d.has?`<div class="fcstat"><span class="k">Debt-free by</span><span class="v ok">${moY(d.payoff)}</span><span class="sub">${money(d.rem)} interest remaining</span></div>`:`<div class="fcstat"><span class="k">Debt</span><span class="v ok">none 🎉</span></div>`;
  if(stEl)stEl.innerHTML=`<div class="fcstat"><span class="k">Projected ${projEnd.y}</span><span class="v">${money(projEnd.v)}</span></div>`+goalStat+debtStat;
}
function downloadForecast(){
  const src=document.getElementById("fcChart");if(!src||!src.innerHTML){toast("Nothing to save");return;}
  const cW=+src.getAttribute("width"),cH=+src.getAttribute("height"),pad=24,titleH=52;
  const leg=legendSVG([{color:FC_AMBER,label:"Actual / Projected"},{color:FC_GREEN,label:"Goal"}],pad,titleH+cH+16,13);
  const f=frameSVG("Net Worth · forecast",src.innerHTML,cW,cH,leg,pad,titleH);
  svgToPng(f.svg,f.W,f.H,2,"nestegg-forecast.png");
}
function updNote(){const px=state.lastPx?("prices "+new Date(state.lastPx).toLocaleString("en-GB",{hour:"2-digit",minute:"2-digit",day:"numeric",month:"short"})):"";const fxd=state.fxDate?("FX "+state.fxDate):"";document.getElementById("updNote").textContent=[px,fxd].filter(Boolean).join(" · ");}

function shortK(v){const a=Math.abs(v);if(a>=1000)return (v/1000).toFixed(a>=10000?0:1)+"k";return Math.round(v);}
function niceCeil(v){const p=Math.pow(10,Math.floor(Math.log10(v||1)));const f=(v||1)/p;const n=f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10;return n*p;}

function drawHist(){
  const svg=document.getElementById("histChart");const snaps=sortedSnaps();const n=snaps.length;const names=allNames();
  const bw=40,gap=18,padL=58,padR=14,padT=24,padB=32,innerW=Math.max(n,1)*bw+(n-1)*gap,W=Math.max(innerW+padL+padR,320),H=300,plotH=H-padT-padB;
  const maxV=Math.max(1,...snaps.map(s=>snapGrossBase(s))),nm=niceCeil(maxV);
  svg.setAttribute("width",W);svg.setAttribute("height",H);svg.setAttribute("viewBox",`0 0 ${W} ${H}`);
  let s="";const sym=ccySym();
  for(let i=0;i<=5;i++){const val=nm*i/5,y=padT+plotH-(val/nm)*plotH;s+=`<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="#26262a" stroke-width="1"/>`;s+=`<text x="${padL-8}" y="${y+3}" text-anchor="end" font-family="ui-monospace,monospace" font-size="9" fill="#8a867c">${sym}${shortK(val)}</text>`;}
  snaps.forEach((sn,idx)=>{const x=padL+idx*(bw+gap);let yTop=padT+plotH;const ents=effEntries(sn);
    names.forEach(nm2=>{const tot=ents.filter(e=>seriesKey(e)===nm2).reduce((a,e)=>a+entryBase(e,sn.year),0);if(tot<=0)return;const h=(tot/nm)*plotH;yTop-=h;s+=`<rect x="${x}" y="${yTop}" width="${bw}" height="${h}" fill="${colorOf(nm2,names)}"><title>${sn.year} · ${esc(nm2)}: ${money(tot)}</title></rect>`;});
    const net=snapTotalBase(sn),gross=snapGrossBase(sn);
    if(gross-net>0.005){const ny=padT+plotH-(Math.max(0,net)/nm)*plotH;s+=`<line x1="${x-3}" y1="${ny}" x2="${x+bw+3}" y2="${ny}" stroke="#ff4d6d" stroke-width="2"><title>${sn.year} net worth ${money(net)} — after ${money(gross-net)} liabilities</title></line>`;}
    s+=`<text x="${x+bw/2}" y="${yTop-6}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="8.5" fill="#8a867c">${sym}${shortK(net)}</text>`;s+=`<text x="${x+bw/2}" y="${H-padB+16}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="10" fill="#e8e4d8">${sn.year}</text>`;});
  svg.innerHTML=s;
  // hero = latest
  const ls=latestSnap();const nw=ls?snapTotalBase(ls):0;
  document.getElementById("nwTotal").textContent=money(nw);
  const nAssets=ls?effEntries(ls).filter(e=>!isLiability(e)).length:0;
  document.getElementById("nwNote").textContent=ls?("as of "+ls.year+" · "+nAssets+" asset"+(nAssets===1?"":"s")):"No data yet";
  const dEl=document.getElementById("nwDay");const dc=dayChangeBase(nw);
  if(dc){const flat=Math.abs(dc.abs)<0.005,up=dc.abs>=0;dEl.className="day "+(flat?"flat":(up?"up":"down"));const sign=up?"+":"−",arrow=flat?"":(up?"▲ ":"▼ ");dEl.textContent=arrow+sign+money(Math.abs(dc.abs))+" · "+sign+Math.abs(dc.pct).toFixed(2)+"% today";}
  else{dEl.className="day";dEl.textContent="";}
}
function drawHistLegend(){const names=allNames();document.getElementById("histLegend").innerHTML=names.map(n=>`<span><span class="chip" style="background:${colorOf(n,names)}"></span>${esc(n)}</span>`).join("");}

function drawDonut(){
  const ls=latestSnap();const svg=document.getElementById("donut");svg.innerHTML="";
  document.getElementById("allocYear").textContent=ls?("— "+ls.year):"";
  const names=allNames();
  const agg={};(ls?effEntries(ls):[]).forEach(e=>{const k=seriesKey(e);agg[k]=(agg[k]||0)+entryBase(e,ls&&ls.year);});
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
  const agg={};(ls?effEntries(ls):[]).forEach(e=>{const k=seriesKey(e);agg[k]=(agg[k]||0)+entryBase(e,ls&&ls.year);});
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
  const snaps=[...state.snapshots].sort((a,b)=>b.year-a.year);
  const maxV=Math.max(1,...state.snapshots.map(s=>snapGrossBase(s)));
  snaps.forEach(sn=>{const ri=state.snapshots.indexOf(sn),tot=snapTotalBase(sn),gross=snapGrossBase(sn);
    const agg={};effEntries(sn).forEach(e=>{const v=entryBase(e,sn.year);if(v>0){const k=seriesKey(e);agg[k]=(agg[k]||0)+v;}});
    // Order segments by allNames() (same as the graph's stacking) so colours line up.
    const segs=names.map(k=>agg[k]>0?`<i style="width:${agg[k]/(gross||1)*100}%;background:${colorOf(k,names)}"></i>`:"").join("");
    const liab=gross-tot,liabHtml=liab>0.005?`<span class="yliab num" title="liabilities">−${money(liab)}</span>`:"";
    const card=document.createElement("div");card.className="ycard";
    card.innerHTML=`<div class="yhead" data-open="${ri}"><span class="yr">${sn.year}</span><span class="ybar" style="max-width:${Math.max(8,gross/maxV*100)}%">${segs}</span>${liabHtml}<span class="ytot">${money(tot)}</span><svg class="ychev" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg></div>`;
    host.appendChild(card);});
}

