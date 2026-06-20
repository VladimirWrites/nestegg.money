// All chart rendering (net-worth history, allocation donut, forecast, retirement) and
// the PNG export of each. Pulls computed values from the domain layer; only touches the DOM.
import { $, toast, syncVal, reduceMotion } from "./dom.js";
import { state } from "../domain/store.js";
import { money, ccySym, esc, shortK } from "../domain/money.js";
import {
  colorOf, allNames, effEntries, seriesKey, snapGrossBase, snapTotalBase,
  sortedSnaps, latestSnap, entryBase, isLiability, dayChangeBase,
} from "../domain/model.js";
import { fmtMY } from "../domain/dates.js";
import { fcCfg, forecastNetAt, fcTarget, fcBandRates, debtSummary } from "../domain/forecast.js";
import { retCfg, retSim, pensionPts } from "../domain/retirement.js";
import { FC_AMBER, FC_GREEN, CH_AXIS, CH_INK, CH_BG, CH_RED, niceCeil, chartDims, yGrid, txt, legendSVG, frameSVG, svgToPng } from "./chart-kit.js";

// Entrance animations play only on view-entry (boot / tab switch), never on the many
// live re-renders (keystrokes, background refresh) — gated by this one-shot arm flag.
let _arm = false;
let _animOn = false;
let _lastSig = "";
export function armChartAnim() { _arm = true; }

// Signature of everything the charts render from, ignoring churny non-visual fields
// (mtimes, sync/fetch timestamps, tombstones). Lets renderAll skip a no-op redraw so a
// background reconcile/refresh can't cut or replay the entrance animation.
const SIG_SKIP = new Set(["m", "updatedAt", "del", "lastPx", "t", "fxDate"]);
function chartSig() {
  try { return JSON.stringify(state, (k, v) => (SIG_SKIP.has(k) ? undefined : v)); }
  catch (e) { return "x" + Math.random(); }
}

export function renderAll() {
  const sig = chartSig();
  if (!_arm && sig === _lastSig) return; // nothing visual changed and not a fresh entry
  _animOn = _arm; _arm = false; _lastSig = sig;
  drawHist();
  drawHistLegend();
  renderYears();
  drawDonut();
  updNote();
  renderForecast();
  renderRetire();
  _animOn = false;
}

// Count-up the hero net-worth number from its last value to the new one.
let _heroVal = 0;
let _heroRaf = 0;
function setHero(nw) {
  const el = $("nwTotal");
  if (!el) return;
  if (reduceMotion() || _heroVal === nw) { el.textContent = money(nw); _heroVal = nw; return; }
  const from = _heroVal, to = nw, dur = 550;
  let t0 = 0; // seeded from the first frame's timestamp so we never mix clocks
  cancelAnimationFrame(_heroRaf);
  const step = (now) => {
    if (!t0) t0 = now;
    const p = Math.min(1, Math.max(0, (now - t0) / dur));
    const e = 1 - Math.pow(1 - p, 3); // ease-out cubic
    el.textContent = money(from + (to - from) * e);
    if (p < 1) _heroRaf = requestAnimationFrame(step);
  };
  _heroVal = to;
  _heroRaf = requestAnimationFrame(step);
}

/* ---- forecast ---- */
export function fcSyncInputs() {
  const fc = fcCfg();
  syncVal("fcMonthly", fc.monthly);
  syncVal("fcGrowth", fc.growth ? +(fc.growth * 100).toFixed(2) : "");
  const gm = $("fcGoalMode"); if (gm) gm.value = fc.goalMode;
  const lbl = $("fcGoalLbl"); if (lbl) { lbl.textContent = fc.goalMode === "spend" ? "Annual spending" : "Target amount"; lbl.title = lbl.textContent; }
  syncVal("fcGoalVal", (fc.goalMode === "spend" ? fc.annualSpending : fc.goalAmount) || "");
  const rd = $("fcRedirect"); if (rd) rd.checked = !!fc.redirectLoans;
  syncVal("fcContribGrowth", fc.contribGrowth ? +(fc.contribGrowth * 100).toFixed(2) : "");
  const bd = $("fcBand"); if (bd) bd.checked = !!fc.band;
  syncVal("fcHorizon", fc.horizonYear);
}

export function renderForecast() {
  const svg = $("fcChart"); if (!svg) return;
  const fc = fcCfg(), enabled = fc.enabled !== false;
  const body = $("fcBody"), dl = $("dlFc"), on = $("fcOn");
  if (on) on.checked = enabled; if (body) body.classList.toggle("hide", !enabled); if (dl) dl.style.display = enabled ? "" : "none";
  if (!enabled) return;
  fcSyncInputs();
  const stEl = $("fcStats"), now = new Date(), cy = now.getFullYear();
  const actual = sortedSnaps().map((s) => ({ y: s.year, v: snapTotalBase(s) }));
  if (!actual.length) { svg.innerHTML = ""; svg.removeAttribute("width"); if (stEl) stEl.innerHTML = '<div class="fchint">Add a year of net worth to see your trajectory.</div>'; return; }
  const lastA = actual[actual.length - 1], target = fcTarget();
  const fnet = (d, g) => forecastNetAt(d, g);
  // FIRE crossing
  let fireY = null; if (target > 0) { if (fnet(now) >= target) fireY = cy; else for (let Y = cy + 1; Y <= cy + 50; Y++) { if (fnet(new Date(Y, 11, 31)) >= target) { fireY = Y; break; } } }
  // horizon
  let horizon = cy + 25; if (target > 0) horizon = fireY ? Math.min(fireY + 3, cy + 45) : cy + 45; horizon = Math.max(horizon, lastA.y + 1);
  if (fc.horizonYear > 0) horizon = Math.min(Math.max(fc.horizonYear, lastA.y + 1), cy + 60); // user-chosen end year overrides auto
  // projection from the last actual point forward (dashed, connects to the solid line)
  const proj = []; for (let Y = lastA.y; Y <= horizon; Y++) proj.push({ y: Y, v: Y <= lastA.y ? lastA.v : fnet(new Date(Y, 11, 31)) });
  const projEnd = proj[proj.length - 1];
  // scenario band: poor / great return paths (only the liquid+contributions vary)
  const band = fc.band, br = fcBandRates(), bandLo = [], bandHi = [];
  if (band) for (let Y = lastA.y; Y <= horizon; Y++) { const dt = new Date(Y, 11, 31); bandLo.push({ y: Y, v: Y <= lastA.y ? lastA.v : fnet(dt, br.lo) }); bandHi.push({ y: Y, v: Y <= lastA.y ? lastA.v : fnet(dt, br.hi) }); }
  const minY = actual[0].y, maxY = horizon, span = Math.max(1, maxY - minY);
  const allV = actual.map((p) => Math.max(0, p.v)).concat(proj.map((p) => Math.max(0, p.v))); if (target > 0) allV.push(target); if (band) bandHi.forEach((p) => allV.push(Math.max(0, p.v)));
  const nm = niceCeil(Math.max(1, ...allV));
  const dim = chartDims(svg, 720), W = dim.W, H = dim.H;
  const padL = 58, padR = 16, padT = 22, padB = 30, innerW = W - padL - padR, plotH = H - padT - padB;
  const X = (y) => padL + ((y - minY) / span) * innerW, Y = (v) => padT + plotH - (Math.max(0, v) / nm) * plotH;
  svg.setAttribute("width", W); svg.setAttribute("height", H); svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const sym = ccySym(); let s = yGrid(W, padL, padR, padT, plotH, nm, sym);
  // x labels — first, last, and a sparse set between
  const step = Math.max(1, Math.ceil(span / 8)); for (let y = minY; y <= maxY; y += step) { s += `<text x="${X(y)}" y="${H - padB + 15}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="9.5" fill="${CH_AXIS}">${y}</text>`; }
  if ((maxY - minY) % step !== 0) s += `<text x="${X(maxY)}" y="${H - padB + 15}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="9.5" fill="${CH_AXIS}">${maxY}</text>`;
  // soft area fill under the actual + projected trajectory
  { const areaPts = actual.concat(proj.slice(1)), by = Y(0);
    s += `<defs><linearGradient id="fcArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${FC_AMBER}" stop-opacity="0.20"/><stop offset="1" stop-color="${FC_AMBER}" stop-opacity="0"/></linearGradient></defs>`;
    s += `<polygon points="${X(areaPts[0].y)},${by} ${areaPts.map((p) => X(p.y) + "," + Y(p.v)).join(" ")} ${X(areaPts[areaPts.length - 1].y)},${by}" fill="url(#fcArea)"/>`; }
  // goal line
  if (target > 0 && target <= nm) {
    const gy = Y(target); s += `<line x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}" stroke="${FC_GREEN}" stroke-width="1.4" stroke-dasharray="2 4"/>`;
    const lbl = "goal " + sym + shortK(target), lw = lbl.length * 5.6 + 10, above = gy > padT + 18, ty = above ? gy - 5 : gy + 12, ry = above ? gy - 15 : gy + 2;
    s += `<rect x="${padL + 2}" y="${ry}" width="${lw}" height="14" rx="3" fill="${CH_BG}" opacity="0.78"/>`;
    s += `<text x="${padL + 7}" y="${ty}" text-anchor="start" font-family="ui-monospace,monospace" font-size="9.5" fill="${FC_GREEN}">${lbl}</text>`;
  }
  // scenario band fill (poor -> great), drawn under the lines
  if (band) {
    const poly = bandHi.map((p) => X(p.y) + "," + Y(p.v)).concat(bandLo.slice().reverse().map((p) => X(p.y) + "," + Y(p.v))).join(" ");
    s += `<polygon points="${poly}" fill="${FC_AMBER}" opacity="0.1"/>`;
    s += `<polyline points="${bandHi.map((p) => X(p.y) + "," + Y(p.v)).join(" ")}" fill="none" stroke="${FC_AMBER}" stroke-width="1" stroke-dasharray="2 3" opacity="0.45"><title>great: ${Math.round(br.hi * 100)}%/yr</title></polyline>`;
    s += `<polyline points="${bandLo.map((p) => X(p.y) + "," + Y(p.v)).join(" ")}" fill="none" stroke="${FC_AMBER}" stroke-width="1" stroke-dasharray="2 3" opacity="0.45"><title>poor: ${Math.round(br.lo * 100)}%/yr</title></polyline>`;
  }
  s += `<polyline points="${proj.map((p) => X(p.y) + "," + Y(p.v)).join(" ")}" fill="none" stroke="${FC_AMBER}" stroke-width="2" stroke-dasharray="5 4" opacity="0.85"/>`;
  s += `<polyline class="line" pathLength="1" points="${actual.map((p) => X(p.y) + "," + Y(p.v)).join(" ")}" fill="none" stroke="${FC_AMBER}" stroke-width="2.4"/>`;
  actual.forEach((p) => { s += `<circle cx="${X(p.y)}" cy="${Y(p.v)}" r="3" fill="${FC_AMBER}"><title>${p.y}: ${money(p.v)}</title></circle>`; });
  if (fireY && fnet(new Date(fireY, 11, 31)) >= target) { const fx = X(fireY), fyv = Y(Math.min(target, nm)); s += `<line x1="${fx}" y1="${padT}" x2="${fx}" y2="${padT + plotH}" stroke="${FC_GREEN}" stroke-width="1" stroke-dasharray="2 3" opacity="0.7"/>`; s += `<circle cx="${fx}" cy="${fyv}" r="4" fill="${FC_GREEN}"><title>Goal reached ${fireY}</title></circle>`; }
  s += `<circle cx="${X(projEnd.y)}" cy="${Y(projEnd.v)}" r="3" fill="${FC_AMBER}" opacity="0.85"><title>${projEnd.y}: ${money(projEnd.v)}</title></circle>`;
  svg.innerHTML = s;
  svg.classList.toggle("anim", _animOn);
  // stats
  const d = debtSummary();
  const goalStat = target > 0 ? (fireY ? `<div class="fcstat"><span class="k">${fc.goalMode === "spend" ? "FIRE goal (" + money(target) + ")" : "Goal " + money(target)}</span><span class="v ok">${fireY <= cy ? "reached 🎉" : "~" + fireY + " · in " + (fireY - cy) + " yr" + (fireY - cy === 1 ? "" : "s")}</span></div>` : `<div class="fcstat"><span class="k">Goal ${money(target)}</span><span class="v">not within 45 yrs</span></div>`) : `<div class="fcstat"><span class="k">Goal</span><span class="v dim">set a target above</span></div>`;
  const debtStat = d.has ? `<div class="fcstat"><span class="k">Debt-free by</span><span class="v ok">${fmtMY(d.payoff)}</span><span class="sub">${money(d.rem)} interest remaining</span></div>` : `<div class="fcstat"><span class="k">Debt</span><span class="v ok">none 🎉</span></div>`;
  const projSub = band ? "range " + money(bandLo[bandLo.length - 1].v) + " – " + money(bandHi[bandHi.length - 1].v) : "";
  const projStat = `<div class="fcstat"><span class="k">Projected ${projEnd.y}</span><span class="v">${money(projEnd.v)}</span>${projSub ? `<span class="sub">${projSub}</span>` : ""}</div>`;
  if (stEl) stEl.innerHTML = projStat + goalStat + debtStat;
}

/* ---- retirement ---- */
export function retSyncInputs() {
  const r = retCfg();
  const set = (id, val, fmt) => { const el = $(id); if (el && document.activeElement !== el) el.value = (fmt ? fmt(val) : val) || (val === 0 ? "" : val) || ""; };
  const on = $("rtOn"); if (on) on.checked = r.on;
  const body = $("rtBody"); if (body) body.classList.toggle("hide", !r.on);
  set("rtYear", r.retireYear); set("rtSpend", r.spending); set("rtPension", r.pension);
  set("rtPts", r.points); set("rtPtsYr", r.ptsPerYear != null ? r.ptsPerYear : ""); set("rtPtVal", r.ptValue != null ? r.ptValue : "");
  set("rtPensStart", r.pensionStart); set("rtUntil", r.untilYear); set("rtInfl", r.inflation, (v) => (v ? +(v * 100).toFixed(2) : ""));
  const pm = $("rtPmode"); if (pm) pm.value = r.pmode; const de = r.pmode === "de";
  const amt = $("rtAmtFld"); if (amt) amt.classList.toggle("hide", de);
  document.querySelectorAll(".rt-de").forEach((el) => el.classList.toggle("hide", !de));
}

export function renderRetire() {
  const stEl = $("rtStats"); if (!stEl) return;
  const r = retCfg(), on = $("rtOn"), body = $("rtBody"), svg = $("rtChart");
  if (on) on.checked = r.on; if (body) body.classList.toggle("hide", !r.on);
  if (!r.on) return;
  retSyncInputs();
  if (!latestSnap()) { if (svg) { svg.innerHTML = ""; svg.removeAttribute("width"); } stEl.innerHTML = '<div class="fchint">Add a year of net worth to simulate retirement.</div>'; return; }
  const sim = retSim();
  if (svg) {
    const dim = chartDims(svg, 720), W = dim.W, H = dim.H, padL = 58, padR = 16, padT = 22, padB = 30, innerW = W - padL - padR, plotH = H - padT - padB;
    const minY = sim.pts[0].y, maxY = sim.pts[sim.pts.length - 1].y, span = Math.max(1, maxY - minY);
    const nm = niceCeil(Math.max(1, ...sim.pts.map((p) => Math.max(0, p.pot))));
    const X = (y) => padL + ((y - minY) / span) * innerW, Y = (v) => padT + plotH - (Math.max(0, v) / nm) * plotH;
    svg.setAttribute("width", W); svg.setAttribute("height", H); svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const sym = ccySym(); let s = yGrid(W, padL, padR, padT, plotH, nm, sym);
    const step = Math.max(1, Math.ceil(span / 8)); for (let y = minY; y <= maxY; y += step) s += `<text x="${X(y)}" y="${H - padB + 15}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="9.5" fill="${CH_AXIS}">${y}</text>`;
    if (sim.pensY > minY && sim.pensY <= maxY && sim.pensionAnnual > 0) { const px = X(sim.pensY); s += `<line x1="${px}" y1="${padT}" x2="${px}" y2="${padT + plotH}" stroke="${FC_GREEN}" stroke-width="1.6" stroke-dasharray="4 3" opacity="0.95"/>`; s += `<text x="${px + 4}" y="${padT + 10}" font-family="ui-monospace,monospace" font-size="9.5" fill="${FC_GREEN}">pension starts ${sim.pensY}</text>`; }
    s += `<defs><linearGradient id="rtArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${FC_AMBER}" stop-opacity="0.22"/><stop offset="1" stop-color="${FC_AMBER}" stop-opacity="0"/></linearGradient></defs>`;
    s += `<polygon points="${X(minY)},${Y(0)} ${sim.pts.map((p) => X(p.y) + "," + Y(p.pot)).join(" ")} ${X(maxY)},${Y(0)}" fill="url(#rtArea)"/>`;
    s += `<polyline class="line" pathLength="1" points="${sim.pts.map((p) => X(p.y) + "," + Y(p.pot)).join(" ")}" fill="none" stroke="${FC_AMBER}" stroke-width="2.4"/>`;
    sim.pts.forEach((p) => { if (p.y === sim.pensY || p.y === minY || p.y === maxY) s += `<circle cx="${X(p.y)}" cy="${Y(p.pot)}" r="3" fill="${FC_AMBER}"><title>${p.y}: ${money(p.pot)}</title></circle>`; });
    if (sim.depleted) s += `<circle cx="${X(sim.depleted)}" cy="${Y(0)}" r="4" fill="${CH_RED}"><title>Depleted ${sim.depleted}</title></circle>`;
    svg.innerHTML = s;
    svg.classList.toggle("anim", _animOn);
  }
  const eggStat = `<div class="fcstat"><span class="k">Nest egg ${sim.retY}</span><span class="v">${money(sim.pts[0].pot)}</span><span class="sub">today's money · investable</span></div>`;
  const ptsNote = r.pmode === "de" ? pensionPts().toFixed(1) + " pts · " : "";
  const pensStat = sim.pensionAnnual > 0 ? `<div class="fcstat"><span class="k">Pension from ${sim.pensY}</span><span class="v ok">${money(sim.pensionMonthly)}/mo</span><span class="sub">${ptsNote}covers ${sim.spend > 0 ? Math.min(100, Math.round((sim.pensionAnnual / sim.spend) * 100)) : 0}% of spend</span></div>` : `<div class="fcstat"><span class="k">Pension</span><span class="v dim">set amount</span></div>`;
  const spendStat = `<div class="fcstat"><span class="k">Spending</span><span class="v">${money(sim.spend)}/yr</span><span class="sub">${money(sim.spend / 12)}/mo · today's money</span></div>`;
  const verdict = sim.depleted ? `<div class="fcstat hero"><span class="k">Pot runs out</span><span class="v bad">${sim.depleted}</span><span class="sub">${sim.depleted - sim.retY} yrs into retirement</span></div>` : `<div class="fcstat hero"><span class="k">Lasts past ${sim.until}</span><span class="v ok">${money(sim.endPot)} left</span><span class="sub">low point ${money(sim.minPot)}</span></div>`;
  stEl.innerHTML = eggStat + pensStat + spendStat + verdict;
}

export function updNote() {
  const px = state.lastPx ? "prices " + new Date(state.lastPx).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }) : "";
  const fxd = state.fxDate ? "FX " + state.fxDate : "";
  $("updNote").textContent = [px, fxd].filter(Boolean).join(" · ");
}

/* ---- net-worth history bars ---- */
function drawHist() {
  const svg = $("histChart"); const snaps = sortedSnaps(); const n = snaps.length; const names = allNames();
  const dim = chartDims(svg, 680), H = dim.H;
  const padL = 58, padR = 14, padT = 24, padB = 32, plotH = H - padT - padB;
  // Minimum ~46px per year so the x-axis year labels never overlap; the chart then
  // overflows its .histscroll container (horizontal scroll) instead of squeezing.
  const W = Math.max(dim.W, padL + padR + Math.max(n, 1) * 32);
  const innerW = W - padL - padR;
  const slot = innerW / Math.max(n, 1), bw = Math.max(8, Math.min(64, slot * 0.62)); // bars fill the width, capped
  const maxV = Math.max(1, ...snaps.map((s) => snapGrossBase(s))), nm = niceCeil(maxV);
  svg.setAttribute("width", W); svg.setAttribute("height", H); svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const sym = ccySym(); let s = yGrid(W, padL, padR, padT, plotH, nm, sym);
  snaps.forEach((sn, idx) => {
    const cx = padL + idx * slot + slot / 2, x = cx - bw / 2; let yTop = padT + plotH; const ents = effEntries(sn);
    names.forEach((nm2) => { const tot = ents.filter((e) => seriesKey(e) === nm2).reduce((a, e) => a + entryBase(e, sn.year), 0); if (tot <= 0) return; const h = (tot / nm) * plotH; yTop -= h; s += `<rect x="${x}" y="${yTop}" width="${bw}" height="${h}" fill="${colorOf(nm2, names)}"><title>${sn.year} · ${esc(nm2)}: ${money(tot)}</title></rect>`; });
    const net = snapTotalBase(sn), gross = snapGrossBase(sn);
    if (gross - net > 0.005) { const ny = padT + plotH - (Math.max(0, net) / nm) * plotH; s += `<line x1="${x - 3}" y1="${ny}" x2="${x + bw + 3}" y2="${ny}" stroke="${CH_RED}" stroke-width="2"><title>${sn.year} net worth ${money(net)} — after ${money(gross - net)} liabilities</title></line>`; }
    s += `<text x="${cx}" y="${yTop - 6}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="8.5" fill="${CH_AXIS}">${sym}${shortK(net)}</text>`;
    s += `<text x="${cx}" y="${H - padB + 16}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="10" fill="${CH_INK}">${sn.year}</text>`;
  });
  svg.innerHTML = s;
  svg.classList.toggle("anim", _animOn);
  // hero = latest
  const ls = latestSnap(); const nw = ls ? snapTotalBase(ls) : 0;
  setHero(nw);
  const nAssets = ls ? effEntries(ls).filter((e) => !isLiability(e)).length : 0;
  $("nwNote").textContent = ls ? "as of " + ls.year + " · " + nAssets + " asset" + (nAssets === 1 ? "" : "s") : "No data yet";
  const dEl = $("nwDay"); const dc = dayChangeBase(nw);
  if (dc) { const flat = Math.abs(dc.abs) < 0.005, up = dc.abs >= 0; dEl.className = "day " + (flat ? "flat" : up ? "up" : "down"); const sign = up ? "+" : "−", arrow = flat ? "" : up ? "▲ " : "▼ "; dEl.textContent = arrow + sign + money(Math.abs(dc.abs)) + " · " + sign + Math.abs(dc.pct).toFixed(2) + "% today"; }
  else { dEl.className = "day"; dEl.textContent = ""; }
}
function drawHistLegend() {
  const names = allNames();
  $("histLegend").innerHTML = names.map((n) => `<span><span class="chip" style="background:${colorOf(n, names)}"></span>${esc(n)}</span>`).join("");
}

/* ---- allocation donut ---- */
function drawDonut() {
  const ls = latestSnap(); const svg = $("donut"); svg.innerHTML = "";
  $("allocYear").textContent = ls ? "— " + ls.year : "";
  const names = allNames();
  const agg = {}; (ls ? effEntries(ls) : []).forEach((e) => { const k = seriesKey(e); agg[k] = (agg[k] || 0) + entryBase(e, ls && ls.year); });
  const rows = Object.keys(agg).map((k) => ({ name: k, v: agg[k] })).filter((r) => r.v > 0).sort((a, b) => b.v - a.v);
  const total = rows.reduce((a, r) => a + r.v, 0);
  if (total > 0) {
    const cx = 120, cy = 120, r = 82, sw = 30; let a = -Math.PI / 2;
    rows.forEach((row) => { const f = row.v / total, a2 = a + f * Math.PI * 2, lg = f > 0.5 ? 1 : 0; const x1 = cx + r * Math.cos(a), y1 = cy + r * Math.sin(a), x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2); const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", `M ${x1} ${y1} A ${r} ${r} 0 ${lg} 1 ${x2} ${y2}`); p.setAttribute("fill", "none"); p.setAttribute("stroke", colorOf(row.name, names)); p.setAttribute("stroke-width", sw); p.setAttribute("pathLength", "1"); svg.appendChild(p); a = a2; });
    txt(svg, cx, cy - 4, "TOTAL", 10, CH_AXIS, 2, 400); txt(svg, cx, cy + 18, money(total), 16, CH_INK, 0, 600);
  }
  svg.classList.toggle("anim", _animOn);
  const leg = $("legend"); leg.innerHTML = "";
  rows.forEach((row) => { const d = document.createElement("div"); d.className = "legrow"; d.innerHTML = `<span class="swatch" style="background:${colorOf(row.name, names)}"></span><span>${esc(row.name)}</span><span class="pct">${((row.v / total) * 100).toFixed(0)}%</span><span class="amt num">${money(row.v)}</span>`; leg.appendChild(d); });
}

export function downloadForecast() {
  const src = $("fcChart"); if (!src || !src.innerHTML) { toast("Nothing to save"); return; }
  const cW = +src.getAttribute("width"), cH = +src.getAttribute("height"), pad = 24, titleH = 52;
  const leg = legendSVG([{ color: FC_AMBER, label: "Actual / Projected" }, { color: FC_GREEN, label: "Goal" }], pad, titleH + cH + 16, 13);
  const f = frameSVG("Net Worth · forecast", src.innerHTML, cW, cH, leg, pad, titleH);
  svgToPng(f.svg, f.W, f.H, 2, "nestegg-forecast.png");
}
export function downloadHist() {
  const src = $("histChart"); if (!src.innerHTML) { toast("Nothing to save"); return; }
  const cW = +src.getAttribute("width"), cH = +src.getAttribute("height"), names = allNames(), pad = 24, titleH = 52;
  const leg = legendSVG(names.map((n) => ({ color: colorOf(n, names), label: n })), pad, titleH + cH + 16, 13);
  const f = frameSVG("Net Worth · over time", src.innerHTML, cW, cH, leg, pad, titleH);
  svgToPng(f.svg, f.W, f.H, 2, "nestegg-over-time.png");
}
export function downloadDonut() {
  const ls = latestSnap(), src = $("donut"), names = allNames();
  const agg = {}; (ls ? effEntries(ls) : []).forEach((e) => { const k = seriesKey(e); agg[k] = (agg[k] || 0) + entryBase(e, ls && ls.year); });
  const rows = Object.keys(agg).map((k) => ({ name: k, v: agg[k] })).filter((r) => r.v > 0).sort((a, b) => b.v - a.v);
  if (!rows.length) { toast("No allocation to save"); return; }
  const total = rows.reduce((a, r) => a + r.v, 0);
  const items = rows.map((r) => ({ color: colorOf(r.name, names), label: r.name + "   " + Math.round((r.v / total) * 100) + "%   " + money(r.v) }));
  const pad = 24, titleH = 52, size = 240;
  const leg = legendSVG(items, pad, titleH + size + 16, 13);
  const f = frameSVG("Allocation · " + (ls ? ls.year : ""), src.innerHTML, size, size, leg, pad, titleH);
  svgToPng(f.svg, f.W, f.H, 2, "nestegg-allocation.png");
}

/* ---- year list ---- */
function renderYears() {
  const host = $("years"); host.innerHTML = ""; const names = allNames();
  const snaps = [...state.snapshots].sort((a, b) => b.year - a.year);
  const maxV = Math.max(1, ...state.snapshots.map((s) => snapGrossBase(s)));
  snaps.forEach((sn) => {
    const ri = state.snapshots.indexOf(sn), tot = snapTotalBase(sn), gross = snapGrossBase(sn);
    const agg = {}; effEntries(sn).forEach((e) => { const v = entryBase(e, sn.year); if (v > 0) { const k = seriesKey(e); agg[k] = (agg[k] || 0) + v; } });
    // Order segments by allNames() (same as the graph's stacking) so colours line up.
    const segs = names.map((k) => (agg[k] > 0 ? `<i style="width:${(agg[k] / (gross || 1)) * 100}%;background:${colorOf(k, names)}"></i>` : "")).join("");
    const liab = gross - tot, liabHtml = liab > 0.005 ? `<span class="yliab num" title="liabilities">−${money(liab)}</span>` : "";
    const card = document.createElement("div"); card.className = "ycard";
    card.innerHTML = `<div class="yhead" data-open="${ri}"><span class="yr">${sn.year}</span><span class="ybar" style="max-width:${Math.max(8, (gross / maxV) * 100)}%">${segs}</span>${liabHtml}<span class="ytot">${money(tot)}</span><svg class="ychev" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg></div>`;
    host.appendChild(card);
  });
}
