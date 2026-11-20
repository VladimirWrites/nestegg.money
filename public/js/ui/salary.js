// Salary history: per person, monthly net pay. Read-only table on the Salary tab; all edits
// happen in the edit overlay. Dual-axis chart: per-person monthly + combined yearly total.
import { $, showEditor, hideEditor, toast, debounce, flash } from "./dom.js";
import { state } from "../domain/store.js";
import { nid } from "../domain/ids.js";
import { CCYS, PALETTE } from "../domain/constants.js";
import { money, moneyIn, esc, convToY, ccySym, shortK, parseNum, fmtNum } from "../domain/money.js";
import { fmtMY } from "../domain/dates.js";
import { C, refreshPalette, exportChart, scrollToNewest, positionTip } from "./chart-kit.js";
import { scheduleSync } from "../io/storage.js";
import { showView, goTab } from "./gate.js";
import { t } from "../i18n.js";

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
/* The chart is sized from its container, and it is first drawn while the Salary view is
   still hidden — so it measured a container that had not been laid out and kept that width,
   leaving 300px of the column empty on a desktop. One observer, armed on the first draw,
   redraws when the container's width actually changes. The guard is what stops the redraw
   from feeding itself: the chart's own width never changes its container's. */
let _salCW = 0;
function watchSalWidth(cont) {
  if (!cont || !window.ResizeObserver || cont.dataset.obs) return;
  cont.dataset.obs = "1";
  new ResizeObserver(() => {
    const w = cont.clientWidth;
    if (!w || Math.abs(w - _salCW) < 2) return;
    _salCW = w; drawSalDebounced();
  }).observe(cont);
}

export function drawSalaryChart() {
  const animOn = _animSal; _animSal = false;
  refreshPalette();
  const svg = $("salaryChart"), people = state.salaries || [], leg = $("salaryLegend");
  if (!svg || !leg) return;
  const all = people.flatMap((p) => p.entries || []);
  if (!all.length) { svg.innerHTML = ""; svg.removeAttribute("width"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", t("salary.ariaEmpty")); leg.innerHTML = ""; return; }
  const idxM = (ym) => { const [y, m] = ym.split("-").map(Number); return y * 12 + (m - 1); };
  const minI = Math.min(...all.map((e) => idxM(e.ym))), maxI = Math.max(...all.map((e) => idxM(e.ym))), span = Math.max(1, maxI - minI);
  const nmL = axisMax(Math.max(1, ...people.flatMap((p) => (p.entries || []).map((e) => salBase(p, e)))));
  const nowY = new Date().getFullYear(); // the current year isn't finalized — exclude from the yearly total
  const years = [...new Set(all.map((e) => +e.ym.slice(0, 4)))].sort((a, b) => a - b);
  const combY = years.filter((y) => y < nowY).map((y) => ({ y, v: people.reduce((s, p) => s + (salAnnual(p)[y] || 0), 0) }));
  const nmR = axisMax(Math.max(1, ...combY.map((c) => c.v)));
  const padL = 56, padR = 56, padT = 22, padB = 30;
  /* Shorter on a phone: at 400px the chart filled the screen on its own and pushed the
     legend below the fold, so the first thing a reader saw was three unlabelled lines. */
  const H = (window.innerWidth || 0) < 560 ? 320 : 400, plotH = H - padT - padB;
  // Fill the available width (the .histscroll container), so the graph scales with the screen.
  const cont = svg.closest(".histscroll"); let cw = cont ? cont.clientWidth : 0; if (!cw || cw < 80) cw = 720;
  _salCW = cont ? cont.clientWidth : 0; watchSalWidth(cont);
  // Minimum ~6px per month so the x-axis year labels stay legible; the chart overflows
  // its .histscroll container (horizontal scroll) on narrow screens rather than cramming.
  const minData = padL + padR + Math.round((maxI - minI + 1) * 3.0);
  const W = Math.max(360, Math.floor(cw), minData), plotW = W - padL - padR;
  const X = (i) => padL + ((i - minI) / span) * plotW, YL = (v) => padT + plotH - (v / nmL) * plotH, YR = (v) => padT + plotH - (v / nmR) * plotH, sym = ccySym();
  /* The chart is wider than a phone and opens on the newest month, so a left axis drawn
     inside it is scrolled off before a reader sees it. When that happens the labels go to a
     pinned axis beside the scroller (drawn below) and the chart keeps only its gridlines. */
  const pinned = W > (cont ? cont.clientWidth : W) + 1;
  let s = "";
  for (let i = 0; i <= 5; i++) {
    const val = (nmL * i) / 5, yy = padT + plotH - (val / nmL) * plotH;
    s += `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="${C.grid}" stroke-width="1"/>`;
    if (!pinned) s += `<text x="${padL - 8}" y="${yy + 3}" text-anchor="end" font-family="ui-monospace,monospace" font-size="11" fill="${C.axis}">${sym}${shortK(val)}</text>`;
  }
  for (let g = 0; g <= 5; g++) { const yy = padT + plotH - (g / 5) * plotH; s += `<text x="${W - padR + 8}" y="${yy + 3}" text-anchor="start" font-family="ui-monospace,monospace" font-size="11" fill="${C.axis}">${shortK((nmR * g) / 5)}</text>`; }
  /* Two scales, two meanings: the left one is one person's pay in a month, the right one is
     everyone's pay in a year. Numbers alone on either side say nothing about which, so each
     axis names its own unit at its head — and the legend repeats it below the chart, because
     the chart scrolls sideways and a caption at a corner can scroll out of sight. */
  if (!pinned) s += `<text x="${padL - 6}" y="${padT - 8}" text-anchor="end" font-size="10" fill="${C.axis}">${t("salary.axisLeft")}</text>`;
  s += `<text x="${W - padR + 8}" y="${padT - 8}" text-anchor="start" font-size="10" fill="${C.axis}">${t("salary.axisRight")}</text>`;
  /* How many years the axis can name is a question about width, not about how many years
     there are. A four-digit label needs about 34px of its own; fitting one per year into a
     phone's 248px of plot printed "2014" through "2026" on top of each other. */
  const minYr = Math.floor(minI / 12), maxYr = Math.floor(maxI / 12);
  const pxPerYear = plotW / Math.max(1, maxYr - minYr);
  const stepYr = Math.max(1, Math.ceil(34 / Math.max(1, pxPerYear)));
  /* A four-digit year is about 26px wide and is centred on its tick, so a tick within half
     that of either edge loses half its label — which is how the axis came to start with
     "18". The bound is the label's own width, not the plot area's. */
  const YR_HALF = 15;
  for (let yr = minYr; yr <= maxYr; yr += stepYr) { const xc = X(yr * 12); if (xc - YR_HALF >= 1 && xc + YR_HALF <= W - 1) s += `<text x="${xc}" y="${H - 9}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="11" fill="${C.axis}">${yr}</text>`; }
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
    s += `<circle class="saldot" cx="${p.x.toFixed(1)}" cy="${p.yy.toFixed(1)}" r="3.5" fill="${SAL_COMB}" data-lbl="${esc(p.y0 + " · " + t("salary.combined") + " · " + sym + Math.round(p.v).toLocaleString())}"></circle>`;
    /* No year written beside the point. The label sits on the line it belongs to, so at any
       width some of them print through it — it was only more obvious on a phone. The x-axis
       carries the years already, and tapping a point still names it. */
  });
  const ax = $("salaryAxis");
  if (ax) {
    if (pinned) {
      const AW = 48;
      /* The caption is wider than the figures under it, so it is anchored to the left edge
         of the gutter rather than to their right edge, where it was clipped to "er month". */
      let a = `<text x="0" y="${padT - 8}" text-anchor="start" font-size="9.5" fill="${C.axis}">${t("salary.axisLeft")}</text>`;
      for (let i = 0; i <= 5; i++) {
        const val = (nmL * i) / 5, yy = padT + plotH - (val / nmL) * plotH;
        a += `<text x="${AW - 6}" y="${yy + 3}" text-anchor="end" font-family="ui-monospace,monospace" font-size="11" fill="${C.axis}">${sym}${shortK(val)}</text>`;
      }
      ax.setAttribute("width", AW); ax.setAttribute("height", H); ax.setAttribute("viewBox", `0 0 ${AW} ${H}`);
      ax.innerHTML = a; ax.classList.remove("hide");
    } else { ax.innerHTML = ""; ax.classList.add("hide"); }
  }
  svg.setAttribute("width", W); svg.setAttribute("height", H); svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.innerHTML = s;
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", t("salary.ariaChart", { count: people.length }));
  svg.classList.toggle("anim", animOn);
  // when it overflows, show the most recent months first (scroll to the right edge)
  if (animOn) scrollToNewest(svg);
  leg.innerHTML = people.map((p, pi) => `<span><span class="chip" style="background:${salColor(pi)}"></span>${esc(p.name)}</span>`).join("")
    + `<span><span class="chip" style="background:${SAL_COMB}"></span>${t("salary.combinedYearly")}</span>`
    + `<span class="axishint">${t("salary.axisHint")}</span>`;
}

function downloadSalary() {
  const src = $("salaryChart"); if (!src.innerHTML) { toast(t("common.nothingToSave")); return; }
  exportChart({ src, title: t("salary.history"), width: +src.getAttribute("width"), height: +src.getAttribute("height"), filename: "nestegg-salary.png",
    items: state.salaries.map((p, pi) => ({ color: salColor(pi), label: p.name })).concat([{ color: SAL_COMB, label: t("salary.combinedYearly") }]) });
}

// Shared month axis across all people, and per-(person,month) lookup/creation.
function salGlobalYms() { const s = new Set(); (state.salaries || []).forEach((p) => (p.entries || []).forEach((e) => s.add(e.ym))); return [...s].sort(); }
// The tables read newest first. A salary history runs to a hundred and fifty rows, and the row
// you want is almost always this month or last — at the bottom of an ascending table, behind
// twelve years of scrolling. The charts stay chronological, because a line has to.
const salTableYms = () => salGlobalYms().reverse();
const salEntry = (p, ym) => (p.entries || []).find((e) => e.ym === ym);
const salPrevEntry = (p, ym) => salMonths(p).filter((e) => e.ym < ym).pop(); // the person's most recent month before ym
// A new, empty monthly entry, inheriting the previous month's currency.
const salNewEntry = (p, ym) => { const prev = salPrevEntry(p, ym); return { id: nid(), ym, amount: 0, event: "", ccy: (prev && prev.ccy) || p.ccy || state.baseCcy }; };
function salEnsure(p, ym) { let e = salEntry(p, ym); if (!e) { e = salNewEntry(p, ym); p.entries.push(e); } return e; }
// Add a blank month row for every person at ym. Amounts start empty rather than copying the
// previous month — a carried-over number reads as real data until you notice it isn't.
function salAddRowAt(ym) { (state.salaries || []).forEach((p) => { if (salEntry(p, ym)) return; p.entries.push(salNewEntry(p, ym)); }); }
const salThisMonth = () => new Date().toISOString().slice(0, 7);
// The month after the last one on record — the row "+ Next month" adds, blank, for every person.
const salNextMonth = () => { const ys = salGlobalYms(); return ys.length ? nextYm(ys[ys.length - 1]) : salThisMonth(); };

// Both tables live in their own scroll box, and every edit rebuilds it — which would throw the
// view back to the top of a long history. Keep the reader where they were across a re-render…
/* The editor overlay is what scrolls. These used to move `.saltable-scroll`, which stopped
   being a scroll container when it went to `overflow:clip` and does not exist at all in the
   card layout — so both of these were quietly doing nothing in both layouts, and a reader
   who added a month or a range saw no sign of where it went. */
const salScroller = (host) => {
  const ed = $("salaryEditor");
  if (ed && !ed.classList.contains("hide")) return ed;
  /* The Salary tab's own table scrolls the page, not the editor — which is display:none
     there, so both of these used to read and write the scrollTop of a hidden element. */
  const box = host && host.closest ? host.closest(".saltable-scroll") : null;
  return box && box.scrollHeight > box.clientHeight + 4 ? box : document.scrollingElement || document.documentElement;
};
function salKeepScroll(host, render) {
  const box = salScroller(host);
  const top = box ? box.scrollTop : 0;
  render();
  if (box) box.scrollTop = top;
}
// …and, when a month was just added, bring it into view: it lands at the top of the newest year.
function salRevealMonth(host, ym, focus) {
  const box = salScroller(host); if (!box || !ym) return;
  const row = host.querySelector(`[data-ym="${ym}"]`); if (!row) return;
  const r = row.getBoundingClientRect(), b = box.getBoundingClientRect();
  if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom + 12;
  else if (r.top < b.top) box.scrollTop -= b.top - r.top + 12;
  if (focus) { const f = row.querySelector("input.salf"); if (f) try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); } }
}

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
  if (!p) { toast(t("salary.addFirst")); return; }
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
  scheduleSync(); salKeepScroll($("salaryList"), renderSalaryEdit);
  $("salImportText").value = "";
  toast(n ? t("salary.imported", { count: n }) + (bad ? " · " + t("salary.skipped", { count: bad }) : "") : t("salary.nothingParsed"));
}

/* The figure the Salary tab is opened for: what the household last took home, with the year
 * so far under it and who it is counting. The most recent month that anybody has an amount in
 * — not simply the last row, which may be a month nobody has filled in yet. */
function renderSalaryHero(people) {
  const amtEl = $("salHeroAmt"), noteEl = $("salHeroNote");
  if (!amtEl) return;
  const withAmt = [];
  people.forEach((p) => (p.entries || []).forEach((e) => { if (e && e.amount) withAmt.push(e.ym); }));
  if (!withAmt.length) {
    amtEl.textContent = "—"; noteEl.textContent = ""; return;
  }
  const ym = withAmt.sort()[withAmt.length - 1], year = ym.slice(0, 4);
  let month = 0, ytd = 0;
  people.forEach((p) => (p.entries || []).forEach((e) => {
    if (!e || !e.amount) return;
    if (e.ym === ym) month += salBase(p, e);
    if (e.ym.slice(0, 4) === year) ytd += salBase(p, e);
  }));
  amtEl.textContent = money(month);
  /* The month goes in this line rather than in the label above, because that label carries a
     data-i18n key: translateDom would put the generic string back over anything written here
     the moment somebody switched language. */
  const names = people.filter((p) => (p.entries || []).some((e) => e && e.amount)).map((p) => p.name).filter(Boolean);
  noteEl.textContent = ymLabel(ym) + " · " + t("salary.heroNote", { total: money(ytd), year })
    + (names.length > 1 ? " · " + names.join(" + ") : "");
}

/* Which past years are expanded on a phone.
 *
 * The table is every month anybody has ever been paid — eight thousand pixels of it by the
 * time a couple has a few years of history — and all of it is equally open, so this year's
 * figures compete with 2019's. The year rows were already in the table as subtotals; they
 * become the handle. The current year stays open, the rest fold behind their own totals, and
 * nothing is removed: the whole table is still in the DOM, and on a desktop, where there is
 * room for it, every row is shown as before. */
let openYearsSeeded = false;   // the newest year opens once, not on every render
const openYears = new Set();
/* The editor folds on its own state: opening a year to read it and opening one to type into
   it are different intentions, and the read-only tab's folds should not decide what the
   editor shows. The newest year is open to begin with — seeded once, because re-adding it
   on every render made the fold handler's delete-then-rerender a no-op, and the one year
   header that is always on screen could never be closed. */
let openEditSeeded = false;
const openEditYears = new Set();

// Read-only table shown on the Salary tab; all edits happen in the edit overlay.
export function renderSalary() {
  drawSalaryChart();
  const host = $("salaryTable"), people = state.salaries || [];
  renderSalaryHero(people);
  if (!people.length) { host.innerHTML = `<div class="emptyhint">${t("salary.emptyTable")}</div>`; return; }
  const yms = salTableYms(), multi = people.length > 1;
  let head = `<tr><th class="salm-h">${t("salary.impMonth")}</th>`;
  people.forEach((p) => (head += `<th class="r salgsep">${esc(p.name)}</th>`));
  if (multi) head += `<th class="r salgsep">${t("salary.household")}</th>`;
  head += `</tr>`;
  let body = "", curY = null, latestYear = null;
  yms.forEach((ym) => {
    const y = ym.slice(0, 4);
    if (y !== curY) {
      curY = y;
      if (latestYear == null) latestYear = y;         // the first year listed is the newest
      if (!openYearsSeeded) { openYearsSeeded = true; if (y === latestYear) openYears.add(y); }
      const open = openYears.has(y);
      let yr = `<tr class="saly${open ? " is-open" : ""}" data-ytoggle="${y}" role="button" tabindex="0" aria-expanded="${open}"><td><span class="salytog"><svg class="salychev" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg>${y}</span></td>`, ht = 0;
      people.forEach((p) => { const t = (p.entries || []).filter((e) => e.ym.slice(0, 4) === y).reduce((a, e) => a + salBase(p, e), 0); ht += t; yr += `<td class="num salgsep">${t ? money(t) : "—"}</td>`; });
      if (multi) yr += `<td class="num salgsep">${ht ? money(ht) : "—"}</td>`;
      body += yr + `</tr>`;
    }
    let row = `<tr class="salmonth${openYears.has(y) ? "" : " is-folded"}" data-ym="${ym}" data-y="${y}"><td class="salm">${ymLabel(ym)}</td>`, hh = 0;
    people.forEach((p) => { const e = salEntry(p, ym); if (e) hh += salBase(p, e); row += `<td class="num salgsep">${e && e.event ? `<button type="button" class="evtag" title="${esc(e.event)}" aria-label="${esc(e.event)}" aria-expanded="false">${esc(e.event)}</button><span class="evnote">${esc(e.event)}</span>` : ""}${e && e.amount ? moneyIn(salTotal(e), salEccy(p, e)) : "—"}</td>`; });
    if (multi) row += `<td class="num salgsep">${hh ? money(hh) : "—"}</td>`;
    body += row + `</tr>`;
  });
  host.innerHTML = `<div class="saltable-scroll"><table class="saltab rotab"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;

  /* Folding is a view state, not data, so it redraws the table rather than touching the
     ledger — and the whole table is already in the DOM, so this only toggles classes. */
  const toggleYear = (y) => {
    if (openYears.has(y)) openYears.delete(y); else openYears.add(y);
    renderSalary();
  };
  /* On a phone the note is a dot, and a dot's tooltip is unreachable by touch — which would
     mean the note is simply gone at the width most people read this on. Pressing it opens the
     word under the amount in that cell, and pressing it again closes it. */
  host.querySelectorAll("td.num .evtag").forEach((btn) => {
    btn.onclick = (ev) => {
      ev.stopPropagation();
      const cell = btn.closest("td");
      const open = cell.classList.toggle("is-note-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    };
  });

  /* Every width folds. This started as a phone-only control, on the reasoning that a desktop
     has room for the whole history — but "has room for" turned out to mean 7,347px of money
     columns with nothing naming them, which is not a better way to read a decade of salary
     than a list of years you can open. */
  host.querySelectorAll("[data-ytoggle]").forEach((tr) => {
    const y = tr.getAttribute("data-ytoggle");
    tr.onclick = () => toggleYear(y);
    tr.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleYear(y); }
    };
  });
}

/* Editable table — rendered into the edit overlay.

   Two people side by side is three columns each plus the month, which is 692px of table in the
   284px a phone has. Every horizontal scroll then slid the amount under the sticky month column,
   so a right-aligned "3.240,13" read as "0,13".

   Under 900px it shows one person at a time instead, chosen from a switch above the table: all
   of that person's columns at full width, and no horizontal scrolling at any width. It matches
   how the data actually gets entered — your own history first, then your partner's — and the
   read-only Salary tab keeps the side-by-side household table for reading. Above 900px there is
   room for everyone, so the full grid comes back. */
const salNarrow = () => { try { return matchMedia("(max-width: 899px)").matches; } catch (e) { return false; } };
/* Narrower again: the width at which five columns stop being readable at all. */
const salCards = () => { try { return matchMedia("(max-width: 619px)").matches; } catch (e) { return false; } };
let salWho = 0;   // which person the narrow layout is showing

function salPersonSwitch(people) {
  if (people.length < 2) return "";
  /* The track is its own element so the selected pill can sit inside it with a little air
     all round, which is what makes it read as raised rather than as a tab. */
  return `<div class="seg salwho"><div class="seg-inner" role="tablist" aria-label="${t("salary.whoAria")}">` + people.map((p, i) =>
    `<button type="button" role="tab" aria-selected="${i === salWho}" class="seg-btn${i === salWho ? " is-on" : ""}" data-salwho="${i}">${esc(p.name || t("salary.namePh"))}</button>`).join("") + `</div></div>`;
}

/* Below 620px the editor is a list of months, not a table.
 *
 * A row of this table is a month, a net amount, a currency, a note and a delete button. At
 * 320px those five columns leave 43px each for the amount, the currency and the note, so a
 * salary rendered as "5,4:" with its last glyph cut in half, the currency as "E", and the
 * note as "Rais". No amount of tightening fixes that: five columns do not fit, and the thing
 * being edited is money, where a half-read figure is worse than none.
 *
 * So each month becomes a card: the month and its delete button on one line, the amount and
 * its currency on the next, the note under them. Same fields, same data attributes, same
 * handlers — the only thing that changes is the shape. */
function salMonthCards(p, yms) {
  let out = "", curY = null;
  const latest = yms.length ? yms[0].slice(0, 4) : null;
  yms.forEach((ym) => {
    const y = ym.slice(0, 4);
    if (y !== curY) {
      curY = y;
      if (!openEditSeeded) { openEditSeeded = true; if (y === latest) openEditYears.add(y); }
      const tot = (p.entries || []).filter((e) => e.ym.slice(0, 4) === y).reduce((a, e) => a + salBase(p, e), 0);
      /* The subtotal says what it is. In the table it was a bare figure under the Event
         column, 250px from the amounts it sums, in the weight of a column heading. */
      const open = openEditYears.has(y);
      const filled = (p.entries || []).filter((e) => e.ym.slice(0, 4) === y && e.amount).length;
      const months = yms.filter((x) => x.slice(0, 4) === y).length;
      out += `<button type="button" class="smy${open ? " is-open" : ""}" data-yedit="${y}" aria-expanded="${open}">`
        + `<svg class="salychev" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg>`
        + `<span class="smy-y">${y}</span>`
        + `<span class="smy-n${filled && filled < months ? " is-part" : ""}">${t("salary.filledOf", { filled, months })}</span>`
        + `<span class="smy-t" data-ytot="${p.id}:${y}">${tot ? t("salary.yearTotal", { amount: money(tot) }) : ""}</span></button>`;
    }
    const e = salEntry(p, ym);
    const amt = e && e.amount ? e.amount : "", ev = e ? e.event || "" : "", ec = salEccy(p, e || {});
    const del = `<button class="delbtn" data-salrowdel="${ym}" title="${esc(t("salary.removeName", { name: ymLabel(ym) }))}" aria-label="${t("salary.removeMonthAria")}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/></svg></button>`;
    const tag = "";   // the dashed card and the ghost amount already say it
    /* No captions. NET / CURRENCY / NOTE above every field is tutorial text repeated a
       hundred and fifty times; the fields are a figure, a three-letter code and a line of
       prose, and a reader knows which is which. They keep their accessible names. The note
       only takes a row once it has something in it — an empty month is then a third of the
       height it was, which is what makes a new person's twelve years readable. */
    out += `<div class="smon${amt === "" ? " is-empty" : ""}${openEditYears.has(y) ? "" : " is-folded"}" data-ym="${ym}">`
      + `<div class="smon-h"><span class="smon-m">${ymLabel(ym)}</span>${tag}${del}</div>`
      + `<div class="smon-row">`
      + `<input class="salf num" type="text" inputmode="decimal" value="${amt === "" ? "" : fmtNum(amt, 2, 2)}" data-sid="${p.id}" data-ym="${ym}" data-f="amount" placeholder="${t("salary.amountPh")}" aria-label="${t("salary.thNet")}">`
      + `<select class="salmccy" data-sid="${p.id}" data-ym="${ym}" data-f="ccy" aria-label="${t("salary.thCcy")}">${CCYS.map((x) => `<option ${x === ec ? "selected" : ""}>${x}</option>`).join("")}</select>`
      + `</div>`
      + (ev ? `<input class="salev" value="${esc(ev)}" data-sid="${p.id}" data-ym="${ym}" data-f="event" placeholder="${t("salary.eventPh")}" aria-label="${t("salary.thEvent")}" title="${t("salary.eventTitle")}">`
        : `<button type="button" class="smon-addnote" data-addnote="${ym}">${t("salary.addNote")}</button>`)
      + `</div>`;
  });
  return out;
}

function renderSalaryEdit() {
  const host = $("salaryList");
  const people = state.salaries || [];
  if (!people.length) { host.innerHTML = `<div class="emptyhint">${t("salary.emptyEdit")}</div>`; return; }
  const narrow = salNarrow();
  const cards = salCards();
  if (salWho >= people.length) salWho = 0;
  // One person's column, or everybody's.
  const shown = narrow ? [people[salWho]] : people;
  const yms = salTableYms();
  let h1 = `<th class="salm-h"></th>`, h2 = `<th class="salm-h">${t("salary.impMonth")}</th>`;
  shown.forEach((p) => {
    /* With one person on screen and a switch above naming them, the table's own name cell
       is the third place the same word appears. */
    h1 += narrow ? "" : `<th colspan="3" class="salp-h salgsep"><span class="salp-hin"><input class="salname" value="${esc(p.name)}" data-sid="${p.id}" data-f="name" placeholder="${t("salary.namePh")}"><button class="delbtn" data-perdel="${p.id}" title="${esc(t("salary.removeName", { name: p.name }))}" aria-label="${t("salary.removePersonAria")}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 11v6M14 11v6"/></svg></button></span></th>`;
    h2 += `<th class="salgsep salnet-h">${t("salary.thNet")}</th><th>${t("salary.thCcy")}</th><th>${t("salary.thEvent")}</th>`;
  });
  h1 += `<th class="salx-h"></th>`; h2 += `<th class="salx-h"></th>`;
  let body = "", curY = null;
  yms.forEach((ym) => {
    const y = ym.slice(0, 4);
    if (y !== curY) {
      curY = y;
      if (!openEditSeeded) { openEditSeeded = true; openEditYears.add(y); }
      const yOpen = openEditYears.has(y);
      let yr = `<tr class="saly${yOpen ? " is-open" : ""}" data-yedit="${y}" role="button" tabindex="0" aria-expanded="${yOpen}"><td><span class="salytog"><svg class="salychev" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg>${y}<em class="salytot-lbl">${t("salary.yearTotalLbl")}</em></span></td>`;
      /* Under the Net column, not spanning all three: as one cell across net, currency and
         note it right-aligned to the note's edge, which on a desktop left the year's total
         250px from the figures it adds up. */
      shown.forEach((p) => {
        const tot = (p.entries || []).filter((e) => e.ym.slice(0, 4) === y).reduce((a, e) => a + salBase(p, e), 0);
        yr += `<td class="num salgsep" data-ytot="${p.id}:${y}">${tot ? money(tot) : "—"}</td>`
          + `<td colspan="2"></td>`;
      });
      body += yr + `<td></td></tr>`;
    }
    let row = `<tr class="salmonth${openEditYears.has(y) ? "" : " is-folded"}" data-ym="${ym}"><td class="salm">${ymLabel(ym)}</td>`;
    shown.forEach((p) => {
      // A zero amount renders blank (the placeholder shows through) so a freshly added month is
      // an empty field to type into, not a "0" to clear first.
      const e = salEntry(p, ym); const amt = e && e.amount ? e.amount : "", ev = e ? e.event || "" : "", ec = salEccy(p, e || {});
      /* text, not number: a `number` field is formatted and parsed by the browser's own
         locale, so the same ledger showed "5418.61" on one machine and "5418,61" on the
         next, neither of which is the shape the app prints everywhere else. */
      row += `<td class="salgsep"><input class="salf num${amt === "" ? " is-empty" : ""}" type="text" inputmode="decimal" value="${amt === "" ? "" : fmtNum(amt, 2, 2)}" data-sid="${p.id}" data-ym="${ym}" data-f="amount" placeholder="${t("salary.amountPh")}"></td>` +
        `<td><select class="salmccy" data-sid="${p.id}" data-ym="${ym}" data-f="ccy">${CCYS.map((x) => `<option ${x === ec ? "selected" : ""}>${x}</option>`).join("")}</select></td>` +
        `<td><input class="salev" value="${esc(ev)}" data-sid="${p.id}" data-ym="${ym}" data-f="event" placeholder="${t("salary.eventPh")}" title="${t("salary.eventTitle")}"></td>`;
    });
    row += `<td class="salxc"><button class="delbtn" data-salrowdel="${ym}" title="${esc(t("salary.removeName", { name: ymLabel(ym) }))}" aria-label="${t("salary.removeMonthAria")}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/></svg></button></td>`;
    body += row + `</tr>`;
  });
  /* The range starts after the last month on record, not on it: offering "from May 2026"
     when May 2026 is already the top row is an invitation to add nothing. */
  const dFrom = yms.length ? salNextMonth() : new Date().getFullYear() + "-01", dTo = salThisMonth();
  const person = shown[0];
  /* With a switch above it, a name field printed the same word ninety pixels below the tab
     that already said it, and parked a delete bin beside it. Two quiet words instead: the
     name becomes a field when you ask to rename it, and removing a person is a word rather
     than a bin you can catch with a thumb. With one person there is no switch, so the field
     is the header and says who the ledger is for. */
  const cardHead = people.length > 1
    ? `<div class="smon-head is-compact"><button type="button" class="smon-act" data-rename="${person.id}">${t("salary.rename")}</button><button type="button" class="smon-act is-danger" data-perdel="${person.id}">${t("salary.removePerson")}</button></div>`
    : `<div class="smon-head"><input class="salname" value="${esc(person.name)}" data-sid="${person.id}" data-f="name" placeholder="${t("salary.namePh")}"><button class="delbtn" data-perdel="${person.id}" title="${esc(t("salary.removeName", { name: person.name }))}" aria-label="${t("salary.removePersonAria")}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 11v6M14 11v6"/></svg></button></div>`;
  const nextBtn = `<button class="btn btn-sm btn-primary smon-next" data-salnext>${t("salary.next")}</button>`;
  /* Beside the people, not at the bottom of their months: on a phone "+ Add person" sat
     below every month of every year, which is the one place you are not when you decide to
     add someone. */
  const addPersonTop = `<button class="btn btn-sm smon-addper" id="addPersonTop">${t("salary.addPerson")}</button>`;
  /* A person with nothing in the ledger gets one line, not thirteen years of somebody
     else's calendar: those years exist because another person was paid in them, and
     mirroring them as "0 of 12 filled · nothing yet" thirteen times is a wall to scroll
     rather than a place to start. */
  const theirs = (person.entries || []).some((e) => e.amount);
  const emptyPerson = !theirs && yms.length;
  const cardList = `${cardHead}<div class="smon-top">${nextBtn}${addPersonTop}</div>`
    + (emptyPerson
      ? `<div class="smon-blank"><p>${t("salary.personEmpty", { name: esc(person.name || t("salary.namePh")), count: yms.length })}</p>`
        + `<button type="button" class="btn btn-sm" data-fillfrom>${t("salary.fillFrom", { count: yms.length })}</button></div>`
      : `<div class="smons">${yms.length ? salMonthCards(person, yms) : `<div class="exhint">${t("salary.noMonths")}</div>`}</div>`);
  /* On a desktop the add button sat below a hundred and fifty rows while the month it adds
     appears at the top of them, so a reader pressed it and nothing visibly happened. It is
     at both ends now: beside the months on a phone, above the table on a desktop. */
  const tableHTML = `<div class="smon-top">${nextBtn}${addPersonTop}</div>`
    + (narrow && emptyPerson
      ? `<div class="smon-blank"><p>${t("salary.personEmpty", { name: esc(person.name || t("salary.namePh")), count: yms.length })}</p>`
        + `<button type="button" class="btn btn-sm" data-fillfrom>${t("salary.fillFrom", { count: yms.length })}</button></div>`
      : `<div class="saltable-scroll"><table class="saltab"><thead>${narrow ? "" : `<tr class="salh1">${h1}</tr>`}<tr class="salh2">${h2}</tr></thead><tbody>${body || `<tr><td colspan="${2 + shown.length * 3}" class="exhint">${t("salary.noMonths")}</td></tr>`}</tbody></table></div>`);
  /* Below 900px the table shows one person, chosen by the switch, so it needs the same
     header the cards have: two words, not a name repeated under the tab that says it. */
  host.innerHTML = (narrow ? salPersonSwitch(people) + (people.length > 1 ? cardHead : "") : "") + (cards ? cardList : tableHTML) +
    `<div class="controls salctrls"><span class="salrlbl">${t("salary.addFrom")}</span><input type="month" class="salpick salfrom" value="${dFrom}" title="${t("salary.fromTitle")}"><span class="salrlbl">${t("salary.toLbl")}</span><input type="month" class="salpick salto" value="${dTo}" title="${t("salary.toTitle")}"><button class="btn btn-sm" data-salgen>${t("salary.addRange")}</button>${cards ? "" : `<button class="btn btn-sm" data-salnext>${t("salary.next")}</button>`}</div>`;
  const who = $("salImportWho");
  if (who) {
    const prev = who.value;
    who.innerHTML = people.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("");
    /* Only if that person still exists: restoring the id of someone just deleted left the
       select on no option at all, and the importer then refused to import, telling a ledger
       with two people in it to add a person first. */
    if (prev && people.some((x) => x.id === prev)) who.value = prev;
  }
  /* Folding is a view state: it toggles a class on the cards already in the DOM, so the
     field you were typing in is still there, and a browser's find still reaches a month
     inside a folded year. */
  /* The note field arrives when it is asked for, and the ledger is untouched until something
     is typed into it. */
  const fill = host.querySelector("[data-fillfrom]");
  if (fill) fill.onclick = () => { openEditYears.add(yms[0].slice(0, 4)); salKeepScroll(host, renderSalaryEdit); };
  host.querySelectorAll("[data-rename]").forEach((btn) => {
    btn.onclick = () => {
      const row = btn.closest(".smon-head"); if (!row) return;
      const sid = btn.getAttribute("data-rename");
      const p2 = (state.salaries || []).find((x) => x.id === sid); if (!p2) return;
      const inp = document.createElement("input");
      inp.className = "salname"; inp.value = p2.name || "";
      inp.dataset.sid = sid; inp.dataset.f = "name";
      inp.placeholder = t("salary.namePh");
      inp.setAttribute("aria-label", t("salary.namePh"));
      row.classList.remove("is-compact");
      row.replaceChildren(inp);
      inp.focus();
      /* Leaving the field puts the row back, with the switch above it already renamed. */
      inp.onblur = () => salKeepScroll(host, renderSalaryEdit);
    };
  });
  host.querySelectorAll("[data-addnote]").forEach((btn) => {
    btn.onclick = () => {
      const card = btn.closest(".smon"); if (!card) return;
      const ym = btn.getAttribute("data-addnote");
      const sid = card.querySelector("[data-sid]").getAttribute("data-sid");
      const inp = document.createElement("input");
      inp.className = "salev";
      inp.dataset.sid = sid; inp.dataset.ym = ym; inp.dataset.f = "event";
      inp.placeholder = t("salary.eventPh");
      inp.setAttribute("aria-label", t("salary.thEvent"));
      btn.replaceWith(inp);
      inp.focus();
    };
  });
  host.querySelectorAll("[data-yedit]").forEach((el) => {
    const toggle = () => {
      const y = el.getAttribute("data-yedit");
      if (openEditYears.has(y)) openEditYears.delete(y); else openEditYears.add(y);
      salKeepScroll(host, renderSalaryEdit);
    };
    el.onclick = toggle;
    /* A table row is not a button, so it needs the keys a button would have given it. */
    if (el.tagName === "TR") el.onkeydown = (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggle(); } };
  });
}

/* Crossing the breakpoint changes which layout is right, and the editor can be open while it
   happens — a desktop window dragged narrow, or a phone turned on its side. */
try {
  /* Both breakpoints, not just the first: 899px decides one person or everybody, and 619px
     decides cards or a table. Watching only 899 meant a window dragged across 620 — or a
     phone turned on its side — kept whichever layout it happened to open with. */
  ["(max-width: 899px)", "(max-width: 619px)"].forEach((q) => {
    matchMedia(q).addEventListener("change", () => {
      if (!$("salaryEditor").classList.contains("hide")) renderSalaryEdit();
    });
  });
} catch (e) {}

/* `t` is the translator, imported at the top of this file. The event target is `el`: naming
   it `t` here shadowed the translator, and an attempt to keep a reference to it one line
   above the shadowing declaration read `t` inside its own temporal dead zone — which threw
   on every keystroke, before a single character reached the ledger. On a screen whose lede
   says "everything saves as you type", that is the worst bug this file can have. */
$("salaryList").addEventListener("input", (e) => {
  const el = e.target, sid = el.dataset.sid, f = el.dataset.f; if (!sid || !f) return;
  const p = state.salaries.find((x) => x.id === sid); if (!p) return;
  if (el.dataset.ym) {
    const en = salEnsure(p, el.dataset.ym);
    if (f === "amount") en.amount = parseNum(el.value) || 0; else en[f] = el.value;
    scheduleSync();
    if (f === "amount") {
      const yr = el.dataset.ym.slice(0, 4);
      const yt = document.querySelector('[data-ytot="' + sid + ":" + yr + '"]');
      if (yt) {
        const tot = p.entries.filter((x) => x.ym.slice(0, 4) === yr).reduce((a, x) => a + salBase(p, x), 0);
        /* Written the way the renderer writes it: rewritten as a bare figure, a card's
           "2026 · Total €24,740" lost its label at the first keystroke. */
        yt.textContent = yt.classList.contains("smy-t")
          ? (tot ? t("salary.yearTotal", { amount: money(tot) }) : t("salary.yearNone"))
          : (tot ? money(tot) : "—");
        flash(yt);
      }
      /* A card stops being an empty one the moment it holds a figure — and the year line
         above it counts filled months, so it is wrong the instant one changes. */
      const has = !!parseNum(el.value);
      const yline = document.querySelector('[data-yedit="' + yr + '"] .smy-n');
      if (yline) {
        const inYear = (x) => x.ym.slice(0, 4) === yr;
        const filled = p.entries.filter((x) => inYear(x) && x.amount).length;
        const months = salTableYms().filter((x) => x.slice(0, 4) === yr).length;
        yline.textContent = t("salary.filledOf", { filled, months });
      }
      const card = el.closest(".smon");
      if (card) {
        card.classList.toggle("is-empty", !has);
        const tag = card.querySelector(".smon-tag");
        if (tag) tag.hidden = has;
      }
      el.classList.toggle("is-empty", !has);
      drawSalDebounced();
    }
  } else {
    if (f === "name") p.name = el.value; else if (f === "ccy") p.ccy = el.value;
    scheduleSync();
    if (f === "name") drawSalDebounced();
  }
});
$("salaryList").addEventListener("change", (e) => {
  if (e.target.dataset.f !== "ccy") return;
  /* The amount is already written; only the year totals need recomputing, and replacing the
     editor's markup to do it destroyed the <select> the reader was still inside. In Firefox,
     where arrowing through a select fires change on every key, that made the list impossible
     to work through from the keyboard. The totals are updated where they stand. */
  const sid = e.target.dataset.sid;
  const p = (state.salaries || []).find((x) => x.id === sid); if (!p) return;
  document.querySelectorAll('[data-ytot^="' + sid + ':"]').forEach((cell) => {
    const yr = cell.getAttribute("data-ytot").split(":")[1];
    const tot = (p.entries || []).filter((x) => x.ym.slice(0, 4) === yr).reduce((a, x) => a + salBase(p, x), 0);
    cell.textContent = cell.classList.contains("smy-t")
      ? (tot ? t("salary.yearTotal", { amount: money(tot) }) : "")
      : (tot ? money(tot) : "—");
  });
  drawSalDebounced();
});
$("salaryList").addEventListener("click", (e) => {
  const sw = e.target.closest("[data-salwho]");
  if (sw) { salWho = +sw.dataset.salwho; renderSalaryEdit(); return; }
  const pd = e.target.closest("[data-perdel]"); if (pd) { const p = state.salaries.find((x) => x.id === pd.dataset.perdel); if (confirm(t("salary.removePersonConfirm", { name: p ? p.name : t("salary.thisPerson") }))) { state.salaries = state.salaries.filter((x) => x.id !== pd.dataset.perdel); scheduleSync(); salKeepScroll($("salaryList"), renderSalaryEdit); } return; }
  const rd = e.target.closest("[data-salrowdel]"); if (rd) {
    const ym = rd.dataset.salrowdel;
    /* This takes the month from everyone, and on a phone the screen is showing one person,
       so it says so and asks first. Deleting a person already asked; the control that
       touches everybody's data was the one that did not. */
    const many = (state.salaries || []).length > 1;
    const ask = many ? t("salary.removeMonthAllConfirm", { month: ymLabel(ym) }) : t("salary.removeMonthConfirm", { month: ymLabel(ym) });
    if (!confirm(ask)) return;
    state.salaries.forEach((p) => { p.entries = (p.entries || []).filter((en) => en.ym !== ym); });
    scheduleSync(); salKeepScroll($("salaryList"), renderSalaryEdit); return;
  }
  // New month: blank amounts for everyone, and land on the new row with the first field focused.
  const nx = e.target.closest("[data-salnext]"); if (nx) { const ym = salNextMonth(); salAddRowAt(ym); scheduleSync(); salKeepScroll($("salaryList"), renderSalaryEdit); salRevealMonth($("salaryList"), ym, true); return; }
  const gn = e.target.closest("[data-salgen]");
  if (gn) {
    const c = e.target.closest(".controls"); let from = c.querySelector(".salfrom").value, to = c.querySelector(".salto").value;
    if (!/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to)) { toast(t("salary.pickBoth")); return; }
    if (from > to) { const t2 = from; from = to; to = t2; }
    let cur = from, last = from, n = 0; while (cur <= to && n < 600) { salAddRowAt(cur); last = cur; cur = nextYm(cur); n++; }
    scheduleSync(); salKeepScroll($("salaryList"), renderSalaryEdit); salRevealMonth($("salaryList"), last, true); toast(t("salary.addedMonths", { count: n })); return;
  }
});
/* Both copies of the control, one handler. */
document.addEventListener("click", (e) => { if (e.target && e.target.id === "addPersonTop") $("addPerson").click(); });
$("addPerson").onclick = () => {
  const p = { id: nid(), name: state.salaries.length ? t("salary.partner") : t("salary.me"), ccy: state.baseCcy, entries: [] };
  state.salaries.push(p); scheduleSync();
  salWho = state.salaries.length - 1;   // the one you just added is the one you want to fill in
  salKeepScroll($("salaryList"), renderSalaryEdit);
  const nm = $("salaryList").querySelector(`.salname[data-sid="${p.id}"]`);
  /* Focused so it can be named straight away, but not selected: a selected name is wiped by
     the first keystroke, and it renders as a block of solid colour in every screenshot. */
  if (nm) { try { nm.focus({ preventScroll: true }); } catch (err) { nm.focus(); } try { const n = nm.value.length; nm.setSelectionRange(n, n); } catch (err) {} }
};
$("salImportBtn").onclick = importSalary;

// In-chart tooltip flag: shown next to the hovered/tapped point, not as a bottom toast.
function salShowTip(c) {
  const tip = $("salTip"), chart = $("salaryChart");
  tip.textContent = c.getAttribute("data-lbl"); tip.classList.remove("hide"); // textContent: safe + getAttribute already decodes entities
  const W = +chart.getAttribute("width") || tip.offsetWidth;
  positionTip(tip, +c.getAttribute("cx"), +c.getAttribute("cy"), W);
}
function salHideTip() { const t = $("salTip"); if (t) t.classList.add("hide"); }
(function () {
  const chart = $("salaryChart"); if (!chart) return;
  chart.addEventListener("mouseover", (e) => { const c = e.target.closest(".saldot"); if (c) salShowTip(c); });
  chart.addEventListener("mouseout", (e) => { if (e.target.closest(".saldot")) salHideTip(); });
  chart.addEventListener("click", (e) => { const c = e.target.closest(".saldot"); if (c) salShowTip(c); else salHideTip(); });
  // mobile: a tap anywhere outside the chart dismisses the tooltip (mouseout never fires on touch)
  document.addEventListener("pointerdown", (e) => { if (!e.target.closest("#salaryChart")) salHideTip(); });
})();
$("dlSalary").onclick = downloadSalary;
$("salaryBtn").onclick = () => goTab("salary");

// Salary tab (read-only) actions: quick "+ Next month", and open the edit overlay.
function openSalaryEdit() { showEditor("salaryEditor"); renderSalaryEdit(); }
function closeSalaryEdit() { hideEditor("salaryEditor"); renderSalary(); }
$("salEdit").onclick = openSalaryEdit;
$("salaryBack").onclick = () => { scheduleSync(); closeSalaryEdit(); };
/* The same exit, said as a word: a chevron alone reads as "discard" on a form full of money. */
$("salaryDone") && ($("salaryDone").onclick = () => { scheduleSync(); closeSalaryEdit(); });
$("salNext").onclick = () => { const ym = salNextMonth(); salAddRowAt(ym); scheduleSync(); salKeepScroll($("salaryTable"), renderSalary); salRevealMonth($("salaryTable"), ym); };
