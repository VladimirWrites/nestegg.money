// Salary history: per person, monthly net pay. Read-only table on the Salary tab; all edits
// happen in the edit overlay. Dual-axis chart: per-person monthly + combined yearly total.
import { $, showEditor, hideEditor, toast, debounce, flash } from "./dom.js";
import { state } from "../domain/store.js";
import { nid } from "../domain/ids.js";
import { CCYS, PALETTE } from "../domain/constants.js";
import { money, moneyIn, esc, convToY, ccySym, shortK } from "../domain/money.js";
import { fmtMY } from "../domain/dates.js";
import { yGrid, C, refreshPalette, legendSVG, frameSVG, svgToPng } from "./chart-kit.js";
import { scheduleSync } from "../io/storage.js";
import { showView } from "./gate.js";

const salTotal = (en) => parseFloat(en.amount) || 0; // raw amount, in the entry's own currency
const salEccy = (p, e) => e.ccy || p.ccy || state.baseCcy; // a month's currency (defaults to person)
const salBase = (p, e) => convToY(salTotal(e), salEccy(p, e), state.baseCcy, +e.ym.slice(0, 4)); // display currency
const salMonths = (p) => [...(p.entries || [])].sort((a, b) => (a.ym < b.ym ? -1 : a.ym > b.ym ? 1 : 0));
function nextYm(ym) {
  if (!/^\d{4}-\d{2}$/.test(ym || "")) return new Date().toISOString().slice(0, 7);
  let [y, m] = ym.split("-").map(Number);
  m++; if (m > 12) { m = 1; y++; }
  return y + "-" + String(m).padStart(2, "0");
}
const ymLabel = (ym) => { const [y, m] = String(ym).split("-").map(Number); return fmtMY(new Date(y, (m || 1) - 1, 1)); };
// Per-year totals, converted to the display currency (handles mixed currencies across months).
function salAnnual(p) { const a = {}; salMonths(p).forEach((en) => { const y = en.ym.slice(0, 4); a[y] = (a[y] || 0) + salBase(p, en); }); return a; }
const salColor = (i) => PALETTE[i % PALETTE.length];
// Tight ~5-tick axis maximum (little empty headroom).
function axisMax(v) {
  if (!(v > 0)) return 1;
  const raw = v / 5, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  const step = (f <= 1 ? 1 : f <= 1.5 ? 1.5 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 3 ? 3 : f <= 4 ? 4 : f <= 5 ? 5 : f <= 6 ? 6 : f <= 8 ? 8 : 10) * p;
  return Math.ceil(v / step) * step;
}
const SAL_COMB = "#c9a227"; // gold, matching the combined-yearly line

// Entrance animation armed by the Salary tab, consumed on the next draw only.
let _animSal = false;
export function armSalaryAnim() { _animSal = true; }
const drawSalDebounced = debounce(() => drawSalaryChart(), 120);

export function drawSalaryChart() {
  const animOn = _animSal; _animSal = false;
  refreshPalette();
  const svg = $("salaryChart"), people = state.salaries || [], leg = $("salaryLegend");
  const all = people.flatMap((p) => p.entries || []);
  if (!all.length) { svg.innerHTML = ""; svg.removeAttribute("width"); leg.innerHTML = ""; return; }
  const idxM = (ym) => { const [y, m] = ym.split("-").map(Number); return y * 12 + (m - 1); };
  const minI = Math.min(...all.map((e) => idxM(e.ym))), maxI = Math.max(...all.map((e) => idxM(e.ym))), span = Math.max(1, maxI - minI);
  const nmL = axisMax(Math.max(1, ...people.flatMap((p) => (p.entries || []).map((e) => salBase(p, e)))));
  const nowY = new Date().getFullYear(); // the current year isn't finalized — exclude from the yearly total
  const years = [...new Set(all.map((e) => +e.ym.slice(0, 4)))].sort((a, b) => a - b);
  const combY = years.filter((y) => y < nowY).map((y) => ({ y, v: people.reduce((s, p) => s + (salAnnual(p)[y] || 0), 0) }));
  const nmR = axisMax(Math.max(1, ...combY.map((c) => c.v)));
  const padL = 56, padR = 56, padT = 22, padB = 30, H = 400, plotH = H - padT - padB;
  // Fill the available width (the .histscroll container), so the graph scales with the screen.
  const cont = svg.closest(".histscroll"); let cw = cont ? cont.clientWidth : 0; if (!cw || cw < 80) cw = 720;
  // Minimum ~6px per month so the x-axis year labels stay legible; the chart overflows
  // its .histscroll container (horizontal scroll) on narrow screens rather than cramming.
  const minData = padL + padR + Math.round((maxI - minI + 1) * 3.0);
  const W = Math.max(360, Math.floor(cw), minData), plotW = W - padL - padR;
  const X = (i) => padL + ((i - minI) / span) * plotW, YL = (v) => padT + plotH - (v / nmL) * plotH, YR = (v) => padT + plotH - (v / nmR) * plotH, sym = ccySym();
  // Left axis (per-person monthly) reuses the shared grid; the right axis (combined yearly) is overlaid.
  let s = yGrid(W, padL, padR, padT, plotH, nmL, sym);
  for (let g = 0; g <= 5; g++) { const yy = padT + plotH - (g / 5) * plotH; s += `<text x="${W - padR + 8}" y="${yy + 3}" text-anchor="start" font-family="ui-monospace,monospace" font-size="9" fill="${SAL_COMB}">${shortK((nmR * g) / 5)}</text>`; }
  const minYr = Math.floor(minI / 12), maxYr = Math.floor(maxI / 12), stepYr = Math.max(1, Math.ceil((maxYr - minYr + 1) / 14));
  for (let yr = minYr; yr <= maxYr; yr += stepYr) { const xc = X(yr * 12); if (xc >= padL - 1 && xc <= W - padR + 1) s += `<text x="${xc}" y="${H - 9}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="9" fill="${C.axis}">${yr}</text>`; }
  // monthly per-person lines (left axis) + event dots
  people.forEach((p, pi) => {
    const ms = salMonths(p); if (!ms.length) return; const col = salColor(pi);
    s += `<polyline class="line" pathLength="1" points="${ms.map((e) => X(idxM(e.ym)).toFixed(1) + "," + YL(salBase(p, e)).toFixed(1)).join(" ")}" fill="none" stroke="${col}" stroke-width="1.6"/>`;
    ms.forEach((e) => { if (!e.event) return; const lab = esc(ymLabel(e.ym) + " · " + p.name + " · " + moneyIn(salTotal(e), salEccy(p, e)) + " · " + e.event); s += `<circle class="saldot" cx="${X(idxM(e.ym)).toFixed(1)}" cy="${YL(salBase(p, e)).toFixed(1)}" r="4" fill="${col}" stroke="${C.bg}" stroke-width="1.5" data-lbl="${lab}"></circle>`; });
  });
  // combined yearly line (right axis), one point per finalized year, with year labels
  const cpts = combY.map((c) => ({ x: X(idxM(c.y + "-07")), yy: YR(c.v), y0: c.y, v: c.v }));
  s += `<polyline class="line" pathLength="1" points="${cpts.map((p) => p.x.toFixed(1) + "," + p.yy.toFixed(1)).join(" ")}" fill="none" stroke="${SAL_COMB}" stroke-width="2.4"/>`;
  cpts.forEach((p) => {
    s += `<circle class="saldot" cx="${p.x.toFixed(1)}" cy="${p.yy.toFixed(1)}" r="3.5" fill="${SAL_COMB}" data-lbl="${esc(p.y0 + " · combined · " + sym + Math.round(p.v).toLocaleString())}"></circle>`;
    s += `<text x="${p.x.toFixed(1)}" y="${(p.yy - 8).toFixed(1)}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="9" fill="${SAL_COMB}">${p.y0}</text>`;
  });
  svg.setAttribute("width", W); svg.setAttribute("height", H); svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.innerHTML = s;
  svg.classList.toggle("anim", animOn);
  // when it overflows, show the most recent months first (scroll to the right edge)
  if (animOn) { const sc = svg.closest(".histscroll"); if (sc) requestAnimationFrame(() => { try { sc.scrollLeft = sc.scrollWidth; } catch (e) {} }); }
  leg.innerHTML = people.map((p, pi) => `<span><span class="chip" style="background:${salColor(pi)}"></span>${esc(p.name)}</span>`).join("") + `<span><span class="chip" style="background:${SAL_COMB}"></span>Combined yearly net salary</span>`;
}

function downloadSalary() {
  const src = $("salaryChart"); if (!src.innerHTML) { toast("Nothing to save"); return; }
  const cW = +src.getAttribute("width"), cH = +src.getAttribute("height"), pad = 24, titleH = 52;
  const leg = legendSVG(state.salaries.map((p, pi) => ({ color: salColor(pi), label: p.name })).concat([{ color: SAL_COMB, label: "Combined yearly net salary" }]), pad, titleH + cH + 16, 13);
  const f = frameSVG("Our Net Salary History", src.innerHTML, cW, cH, leg, pad, titleH);
  svgToPng(f.svg, f.W, f.H, 2, "nestegg-salary.png");
}

// Shared month axis across all people, and per-(person,month) lookup/creation.
function salGlobalYms() { const s = new Set(); (state.salaries || []).forEach((p) => (p.entries || []).forEach((e) => s.add(e.ym))); return [...s].sort(); }
const salEntry = (p, ym) => (p.entries || []).find((e) => e.ym === ym);
const salPrevEntry = (p, ym) => salMonths(p).filter((e) => e.ym < ym).pop(); // the person's most recent month before ym
// A new monthly entry, inheriting the previous month's currency (and its amount, when carrying).
const salNewEntry = (p, ym, amount) => { const prev = salPrevEntry(p, ym); return { id: nid(), ym, amount: amount || 0, event: "", ccy: (prev && prev.ccy) || p.ccy || state.baseCcy }; };
function salEnsure(p, ym) { let e = salEntry(p, ym); if (!e) { e = salNewEntry(p, ym, 0); p.entries.push(e); } return e; }
// Add a month row for every person at ym; carry each person's most recent salary when carry=true.
function salAddRowAt(ym, carry) { (state.salaries || []).forEach((p) => { if (salEntry(p, ym)) return; const prev = salPrevEntry(p, ym); p.entries.push(salNewEntry(p, ym, carry && prev ? prev.amount : 0)); }); }
const salThisMonth = () => new Date().toISOString().slice(0, 7);

// Parse a pasted month cell into YYYY-MM: "May 2013", "2013-05", "5/2013", "2013/05/01"…
const SAL_MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function parseMonthCell(s) {
  s = (s || "").trim(); if (!s) return null; let m;
  if ((m = /^(\d{4})[-/.](\d{1,2})/.exec(s))) return m[1] + "-" + String(+m[2]).padStart(2, "0");
  if ((m = /^([A-Za-z]{3,})[\s\-/.]+(\d{4})$/.exec(s))) { const mo = SAL_MON[m[1].slice(0, 3).toLowerCase()]; if (mo) return m[2] + "-" + String(mo).padStart(2, "0"); }
  if ((m = /^(\d{1,2})[/.](\d{4})$/.exec(s))) return m[2] + "-" + String(+m[1]).padStart(2, "0");
  const d = new Date(s); if (!isNaN(+d)) return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  return null;
}
// Parse a money cell, tolerating currency symbols and either thousands convention.
function parseAmt(s) {
  if (s == null) return null; s = String(s).replace(/[^\d.,-]/g, ""); if (!s || s === "-") return null;
  const dec = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
  if (dec > -1 && s.length - dec - 1 <= 2 && s.length - dec - 1 >= 1) s = s.slice(0, dec).replace(/[.,]/g, "") + "." + s.slice(dec + 1);
  else s = s.replace(/[.,]/g, "");
  const n = parseFloat(s); return isNaN(n) ? null : n;
}
function importSalary() {
  const who = $("salImportWho").value, p = (state.salaries || []).find((x) => x.id === who);
  if (!p) { toast("Add a person first"); return; }
  const txt = $("salImportText").value || ""; let n = 0, bad = 0;
  txt.split(/\r?\n/).forEach((line) => {
    if (!line.trim()) return;
    let cells = line.split("\t"); if (cells.length < 2) cells = line.trim().split(/\s{2,}|;|,(?=\s)/);
    const ym = parseMonthCell(cells[0]), amt = parseAmt(cells[1]);
    if (!ym || amt == null) { bad++; return; }
    const e = salEnsure(p, ym); e.amount = amt;
    if (cells[2] && cells[2].trim() && parseAmt(cells[2]) == null) e.event = cells[2].trim();
    n++;
  });
  scheduleSync(); renderSalaryEdit();
  $("salImportText").value = "";
  toast(n ? "Imported " + n + " month" + (n === 1 ? "" : "s") + (bad ? " · " + bad + " skipped" : "") : "Nothing parsed — paste Month + amount columns");
}

// Read-only table shown on the Salary tab; all edits happen in the edit overlay.
export function renderSalary() {
  drawSalaryChart();
  const host = $("salaryTable"), people = state.salaries || [];
  if (!people.length) { host.innerHTML = `<div class="emptyhint">No salary history yet. Tap “Edit salaries” to add people and months, or import from a spreadsheet.</div>`; return; }
  const yms = salGlobalYms(), multi = people.length > 1;
  let head = `<tr><th class="salm-h">Month</th>`;
  people.forEach((p) => (head += `<th class="r salgsep">${esc(p.name)}</th>`));
  if (multi) head += `<th class="r salgsep">Household</th>`;
  head += `</tr>`;
  let body = "", curY = null;
  yms.forEach((ym) => {
    const y = ym.slice(0, 4);
    if (y !== curY) {
      curY = y; let yr = `<tr class="saly"><td>${y}</td>`, ht = 0;
      people.forEach((p) => { const t = (p.entries || []).filter((e) => e.ym.slice(0, 4) === y).reduce((a, e) => a + salBase(p, e), 0); ht += t; yr += `<td class="num salgsep">${t ? money(t) : "—"}</td>`; });
      if (multi) yr += `<td class="num salgsep">${ht ? money(ht) : "—"}</td>`;
      body += yr + `</tr>`;
    }
    let row = `<tr><td class="salm">${ymLabel(ym)}</td>`, hh = 0;
    people.forEach((p) => { const e = salEntry(p, ym); if (e) hh += salBase(p, e); row += `<td class="num salgsep">${e && e.event ? `<span class="evtag">${esc(e.event)}</span>` : ""}${e && e.amount ? moneyIn(salTotal(e), salEccy(p, e)) : "—"}</td>`; });
    if (multi) row += `<td class="num salgsep">${hh ? money(hh) : "—"}</td>`;
    body += row + `</tr>`;
  });
  host.innerHTML = `<div class="saltable-scroll"><table class="saltab rotab"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

// Editable table — rendered into the edit overlay.
function renderSalaryEdit() {
  const host = $("salaryList");
  const people = state.salaries || [];
  if (!people.length) { host.innerHTML = `<div class="emptyhint">No one yet. Add yourself (and your partner) below, then add a range of months and type each one's net salary side by side.</div>`; return; }
  const yms = salGlobalYms();
  let h1 = `<th class="salm-h"></th>`, h2 = `<th class="salm-h">Month</th>`;
  people.forEach((p) => {
    h1 += `<th colspan="3" class="salp-h salgsep"><span class="salp-hin"><input class="salname" value="${esc(p.name)}" data-sid="${p.id}" data-f="name" placeholder="Name"><button class="delbtn" data-perdel="${p.id}" title="Remove ${esc(p.name)}" aria-label="Remove person"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 11v6M14 11v6"/></svg></button></span></th>`;
    h2 += `<th class="salgsep">Net</th><th>Ccy</th><th>Event</th>`;
  });
  h1 += `<th class="salx-h"></th>`; h2 += `<th class="salx-h"></th>`;
  let body = "", curY = null;
  yms.forEach((ym) => {
    const y = ym.slice(0, 4);
    if (y !== curY) {
      curY = y; let yr = `<tr class="saly"><td>${y}</td>`;
      people.forEach((p) => { const tot = (p.entries || []).filter((e) => e.ym.slice(0, 4) === y).reduce((a, e) => a + salBase(p, e), 0); yr += `<td colspan="3" class="num salgsep" data-ytot="${p.id}:${y}">${tot ? money(tot) : "—"}</td>`; });
      body += yr + `<td></td></tr>`;
    }
    let row = `<tr><td class="salm">${ymLabel(ym)}</td>`;
    people.forEach((p) => {
      const e = salEntry(p, ym); const amt = e ? e.amount : "", ev = e ? e.event || "" : "", ec = salEccy(p, e || {});
      row += `<td class="salgsep"><input class="salf num" type="number" step="any" inputmode="decimal" value="${amt}" data-sid="${p.id}" data-ym="${ym}" data-f="amount" placeholder="0"></td>` +
        `<td><select class="salmccy" data-sid="${p.id}" data-ym="${ym}" data-f="ccy">${CCYS.map((x) => `<option ${x === ec ? "selected" : ""}>${x}</option>`).join("")}</select></td>` +
        `<td><input class="salev" value="${esc(ev)}" data-sid="${p.id}" data-ym="${ym}" data-f="event" placeholder="—" title="Raise, job change…"></td>`;
    });
    row += `<td class="salxc"><button class="delbtn" data-salrowdel="${ym}" title="Remove ${ymLabel(ym)}" aria-label="Remove month"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/></svg></button></td>`;
    body += row + `</tr>`;
  });
  const dFrom = yms.length ? yms[0] : new Date().getFullYear() + "-01", dTo = salThisMonth();
  host.innerHTML = `<div class="saltable-scroll"><table class="saltab"><thead><tr class="salh1">${h1}</tr><tr class="salh2">${h2}</tr></thead><tbody>${body || `<tr><td colspan="${2 + people.length * 3}" class="exhint">No months yet — add a range below.</td></tr>`}</tbody></table></div>
    <div class="controls salctrls"><span class="salrlbl">Add months from</span><input type="month" class="salpick salfrom" value="${dFrom}" title="From"><span class="salrlbl">to</span><input type="month" class="salpick salto" value="${dTo}" title="To"><button class="act ghost mini" data-salgen>Add range</button><button class="act ghost mini" data-salnext>+ Next month</button></div>`;
  const who = $("salImportWho"); if (who) { const prev = who.value; who.innerHTML = people.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join(""); if (prev) who.value = prev; }
}

$("salaryList").addEventListener("input", (e) => {
  const t = e.target, sid = t.dataset.sid, f = t.dataset.f; if (!sid || !f) return; const p = state.salaries.find((x) => x.id === sid); if (!p) return;
  if (t.dataset.ym) {
    const en = salEnsure(p, t.dataset.ym);
    if (f === "amount") en.amount = parseFloat(t.value || 0); else en[f] = t.value;
    scheduleSync();
    if (f === "amount") { const yr = t.dataset.ym.slice(0, 4), yt = document.querySelector('[data-ytot="' + sid + ":" + yr + '"]'); if (yt) { const tot = p.entries.filter((x) => x.ym.slice(0, 4) === yr).reduce((a, x) => a + salBase(p, x), 0); yt.textContent = tot ? money(tot) : "—"; flash(yt); } drawSalDebounced(); }
  } else { if (f === "name") p.name = t.value; else if (f === "ccy") p.ccy = t.value; scheduleSync(); if (f === "name") drawSalDebounced(); }
});
$("salaryList").addEventListener("change", (e) => { if (e.target.dataset.f === "ccy") renderSalaryEdit(); });
$("salaryList").addEventListener("click", (e) => {
  const pd = e.target.closest("[data-perdel]"); if (pd) { const p = state.salaries.find((x) => x.id === pd.dataset.perdel); if (confirm("Remove " + (p ? p.name : "this person") + " and their salary history?")) { state.salaries = state.salaries.filter((x) => x.id !== pd.dataset.perdel); scheduleSync(); renderSalaryEdit(); } return; }
  const rd = e.target.closest("[data-salrowdel]"); if (rd) { const ym = rd.dataset.salrowdel; state.salaries.forEach((p) => { p.entries = (p.entries || []).filter((en) => en.ym !== ym); }); scheduleSync(); renderSalaryEdit(); return; }
  const nx = e.target.closest("[data-salnext]"); if (nx) { const ys = salGlobalYms(); salAddRowAt(ys.length ? nextYm(ys[ys.length - 1]) : salThisMonth(), true); scheduleSync(); renderSalaryEdit(); return; }
  const gn = e.target.closest("[data-salgen]");
  if (gn) {
    const c = e.target.closest(".controls"); let from = c.querySelector(".salfrom").value, to = c.querySelector(".salto").value;
    if (!/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to)) { toast("Pick both months"); return; }
    if (from > to) { const t2 = from; from = to; to = t2; }
    let cur = from, n = 0; while (cur <= to && n < 600) { salAddRowAt(cur, true); cur = nextYm(cur); n++; }
    scheduleSync(); renderSalaryEdit(); toast("Added " + n + " month" + (n === 1 ? "" : "s")); return;
  }
});
$("addPerson").onclick = () => { state.salaries.push({ id: nid(), name: state.salaries.length ? "Partner" : "Me", ccy: state.baseCcy, entries: [] }); scheduleSync(); renderSalaryEdit(); };
$("salImportBtn").onclick = importSalary;

// In-chart tooltip flag: shown next to the hovered/tapped point, not as a bottom toast.
function salShowTip(c) {
  const tip = $("salTip"), chart = $("salaryChart");
  tip.textContent = c.getAttribute("data-lbl"); tip.classList.remove("hide");
  const cx = +c.getAttribute("cx"), cy = +c.getAttribute("cy"), W = +chart.getAttribute("width") || tip.offsetWidth;
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  let left = Math.max(2, Math.min(cx - tw / 2, W - tw - 2)), top = cy - th - 12; if (top < 2) top = cy + 14;
  tip.style.left = left + "px"; tip.style.top = top + "px";
}
function salHideTip() { const t = $("salTip"); if (t) t.classList.add("hide"); }
(function () {
  const chart = $("salaryChart"); if (!chart) return;
  chart.addEventListener("mouseover", (e) => { const c = e.target.closest(".saldot"); if (c) salShowTip(c); });
  chart.addEventListener("mouseout", (e) => { if (e.target.closest(".saldot")) salHideTip(); });
  chart.addEventListener("click", (e) => { const c = e.target.closest(".saldot"); if (c) salShowTip(c); else salHideTip(); });
})();
$("dlSalary").onclick = downloadSalary;
$("salaryBtn").onclick = () => showView("salary");

// Salary tab (read-only) actions: quick "+ Next month", and open the edit overlay.
function openSalaryEdit() { showEditor("salaryEditor"); renderSalaryEdit(); }
function closeSalaryEdit() { hideEditor("salaryEditor"); renderSalary(); }
$("salEdit").onclick = openSalaryEdit;
$("salaryBack").onclick = () => { scheduleSync(); closeSalaryEdit(); };
$("salNext").onclick = () => { const ys = salGlobalYms(); salAddRowAt(ys.length ? nextYm(ys[ys.length - 1]) : salThisMonth(), true); scheduleSync(); renderSalary(); };
