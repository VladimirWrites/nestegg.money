// Year editor: the list of snapshots and the per-year entry editing overlay.
import { $, showEditor, hideEditor, toast, flash, focusNew } from "./dom.js";
import { state } from "../domain/store.js";
import { nid } from "../domain/ids.js";
import { CCYS } from "../domain/constants.js";
import { money, moneyIn, esc } from "../domain/money.js";
import { allNames, autoEntriesFor, colorOf, seriesKey, entryBase, tickerPx, snapTotalBase, effEntries } from "../domain/model.js";
import { scheduleSync, ensureHist, fetchPrice, fetchPriceYear } from "../io/storage.js";
import { renderAll } from "./charts.js";
import { openAssetEditor, newAsset, newLiability } from "./assets.js";
import { groupNames, addCategory, renameCategory, categoryUsage, removeCategory } from "../domain/categories.js";
import { categorySelectHTML, groupSectionHTML } from "./categories-ui.js";
import { t } from "../i18n.js";

let edIdx = -1;
let edYearPrev = null;

function openYearEditor(ri) {
  edIdx = ri;
  edYearPrev = state.snapshots[ri].year;
  $("edYearVal").textContent = String(state.snapshots[ri].year);
  showEditor("yearEditor");
  renderEntries();
  ensureHist();
}
function closeYearEditor() {
  hideEditor("yearEditor");
  edIdx = -1;
  renderAll();
}

// Read-only mode (shared snapshot viewer): the year drill-down renders static cards instead of
// the editable ones, so every value is formatted and right-aligned with no inert edit controls.
let RO = false;
export const setEntriesReadOnly = (v) => { RO = !!v; };

// A clean read-only entry row: name · (shares + ticker for holdings) · formatted value, right-aligned.
function roCardHTML(en, i, names, year) {
  const liab = en.kind === "liability", priced = en.kind === "ticker" || en.kind === "crypto";
  const v = entryBase(en, year);
  const p = priced ? tickerPx(en, year) : null;
  const dot = `<span class="dot" style="background:${liab ? "var(--danger)" : colorOf(seriesKey(en), names)}"></span>`;
  const mid = priced
    ? `<span class="ro-mid"><span class="ro-sh num">${en.shares != null ? en.shares : 0}</span><span class="ro-tk">${esc(en.ticker || "")}</span></span>`
    : "";
  const valTxt = liab ? "− " + money(Math.abs(v)) : (priced && !p ? "—" : money(v));
  return `<div class="rcard ro${liab ? " liabcard" : ""}">${dot}<span class="ro-name">${esc(en.name)}</span>${mid}<span class="ro-val${liab ? " liab" : ""}">${valTxt}</span></div>`;
}

// Read-only long-term-asset row: name · tag (loan/depreciating) · formatted value. No edit pencil.
function roAutoCardHTML(en, names, year) {
  const a = (state.assets || []).find((x) => x.id === en.assetId) || {}, liab = en.kind === "liability";
  const tags = liab ? t("net.tagLiability") : [a.depreciates ? (a.up ? t("net.tagAppreciating") : t("net.tagDepreciating")) : "", a.loan ? t("net.tagLoan") : ""].filter(Boolean).join(" · ") || t("net.tagAsset");
  const v = entryBase(en, year);
  const dot = `<span class="dot" style="background:${liab ? "var(--danger)" : colorOf(seriesKey(en), names)}"></span>`;
  return `<div class="rcard ro auto${liab ? " liabcard" : ""}">${dot}<span class="ro-name">${esc(en.name)}</span><span class="autotag">${tags}</span><span class="ro-val${liab ? " liab" : ""}">${liab ? "− " + money(Math.abs(v)) : money(v)}</span></div>`;
}

function cardHTML(en, i, names, year) {
  if (RO) return roCardHTML(en, i, names, year);
  const baseV = entryBase(en, year), liab = en.kind === "liability", priced = en.kind === "ticker" || en.kind === "crypto";
  let valuePart;
  let priceNote = "";
  if (priced) {
    const p = tickerPx(en, year), isC = en.kind === "crypto";
    // A past year with the symbol set but no price = no historical data for that year.
    const noHistData = !p && en.ticker && year < new Date().getFullYear();
    if (noHistData) priceNote = `<div class="rhint">${t("net.noYearEndPriceLong", { year })}</div>`;
    const pxtxt = p ? "@ " + moneyIn(p.price, p.currency) + (p.frozen ? " · " + t("net.yearEnd") : "") : noHistData ? t("net.noYearEndPrice") : en.ticker ? t("net.noPrice") : isC ? t("net.setCoin") : t("net.setTicker");
    valuePart = `<input class="rsh num" type="number" step="any" inputmode="decimal" value="${en.shares ? en.shares : ""}" data-i="${i}" data-f="shares" placeholder="${isC ? t("net.coins") : t("net.shares")}" title="${isC ? t("net.coins") : t("net.shares")}">
    <span class="rtkwrap"><input class="rtk" value="${esc(en.ticker || "")}" data-i="${i}" data-f="ticker" placeholder="${isC ? "BTC-EUR" : "AMS:VWRL"}" title="${isC ? t("net.coinPairTitle") : t("net.tickerTitle")}"><button type="button" class="rinfo" data-info="${isC ? "crypto" : "ticker"}" title="${t("net.symbolHelpTitle")}" aria-label="${t("net.symbolHelpAria")}">i</button></span>
    <span class="rconv">${p ? money(baseV) : pxtxt}</span>`;
  } else {
    valuePart = `<input class="rval num" type="number" step="any" inputmode="decimal" value="${en.value ? en.value : ""}" data-i="${i}" data-f="value" placeholder="${liab ? t("net.amountOwed") : "0"}">
    <select data-i="${i}" data-f="ccy">${CCYS.map((x) => `<option ${x === en.ccy ? "selected" : ""}>${x}</option>`).join("")}</select>
    <span class="rconv${liab ? " liab" : ""}">${liab ? "− " + money(Math.abs(baseV)) : en.ccy !== state.baseCcy ? "= " + money(baseV) : ""}</span>`;
  }
  const cats = groupNames();
  const catSel = cats.length ? categorySelectHTML("rcat", `data-i="${i}" data-f="group"`, en.group, cats) : "";
  return `<div class="rcard${liab ? " liabcard" : ""}"><span class="dot" style="background:${liab ? "var(--danger)" : colorOf(seriesKey(en), names)}"></span>
    <input class="rname" value="${esc(en.name)}" data-i="${i}" data-f="name" placeholder="${liab ? t("net.liabilityName") : t("net.assetName")}">
    <select class="rkind" data-i="${i}" data-f="kind"><option value="fixed" ${!priced && !liab ? "selected" : ""}>${t("net.kindValue")}</option><option value="ticker" ${en.kind === "ticker" ? "selected" : ""}>${t("net.kindTicker")}</option><option value="crypto" ${en.kind === "crypto" ? "selected" : ""}>${t("net.kindCrypto")}</option><option value="liability" ${liab ? "selected" : ""}>${t("net.kindLiability")}</option></select>
    ${valuePart}
    ${catSel}
    <button class="rdel" data-del="${i}" title="${t("common.remove")}">×</button>${priceNote}</div>`;
}

// Read-only card for a long-term asset (tap to edit in the focused asset editor).
function autoCardHTML(en, names, year) {
  if (RO) return roAutoCardHTML(en, names, year);
  const a = (state.assets || []).find((x) => x.id === en.assetId) || {}, liab = en.kind === "liability";
  const tags = liab ? t("net.tagLiability") : [a.depreciates ? (a.up ? t("net.tagAppreciating") : t("net.tagDepreciating")) : "", a.loan ? t("net.tagLoan") : ""].filter(Boolean).join(" · ") || t("net.tagAsset");
  const v = entryBase(en, year);
  return `<div class="rcard auto${liab ? " liabcard" : ""}" data-editasset="${en.assetId}" title="${t("common.edit")}"><span class="dot" style="background:${liab ? "var(--danger)" : colorOf(seriesKey(en), names)}"></span>` +
    `<span class="rname ro">${esc(en.name)}</span>` +
    `<span class="autotag">${tags}</span>` +
    `<span class="rconv${liab ? " liab" : ""}">${liab ? "− " + money(Math.abs(v)) : money(v)}</span>` +
    `<svg class="autoedit" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 2.5l2.5 2.5L6 12.5 3 13l.5-3z"/></svg></div>`;
}

export function renderEntries() {
  const sn = state.snapshots[edIdx]; if (!sn) return;
  const wrap = $("edEntries"); const names = allNames();
  const autos = autoEntriesFor(sn.year);
  let html = "";
  // ungrouped: per-year entries, then long-term assets that aren't in a category
  sn.entries.forEach((en, i) => { if (!en.group) html += cardHTML(en, i, names, sn.year); });
  autos.forEach((en) => { if (!en.group) html += autoCardHTML(en, names, sn.year); });
  // category sections: the global category list, plus any stray groups still in use
  const order = [...(state.categories || [])];
  sn.entries.forEach((en) => { if (en.group && order.indexOf(en.group) < 0) order.push(en.group); });
  autos.forEach((en) => { if (en.group && order.indexOf(en.group) < 0) order.push(en.group); });
  order.forEach((g) => {
    let sub = 0, cards = "";
    sn.entries.forEach((en, i) => { if (en.group === g) { sub += entryBase(en, sn.year); cards += cardHTML(en, i, names, sn.year); } });
    autos.forEach((en) => { if (en.group === g) { sub += entryBase(en, sn.year); cards += autoCardHTML(en, names, sn.year); } });
    html += groupSectionHTML(g, colorOf(g, names), money(sub), cards, t("net.emptyCategoryYear"));
  });
  wrap.innerHTML = html;
  $("edTotal").textContent = money(snapTotalBase(sn));
}

$("years").addEventListener("click", (e) => { const h = e.target.closest("[data-open]"); if (h) openYearEditor(+h.dataset.open); });
$("edBack").onclick = () => { scheduleSync(); closeYearEditor(); };
/* Moving a snapshot to another year.

   The year is not a label on the record — it is the key the sync merge files it under, so two
   snapshots sharing a year collide the next time two devices reconcile and one absorbs the
   other. It used to be a number field that wrote to state on every keystroke, so replacing 2026
   with 2025 passed through the years 2, 20 and 202, saving each, and the duplicate check ran
   only on commit, which a system Back button never reaches.

   It is a dialog rather than a dropdown under the title. Moving a year is rare and it takes the
   whole year's contents with it, so it is worth asking for on purpose; and a decade reads at a
   glance as a grid, where a list of thirty-six years in a column the width of the button was
   eight visible at a time and a thousand pixels of scrolling to reach the far end.

   Years already in the ledger are shown rather than left out, and disabled with a reason. A gap
   where 2025 should be is a puzzle; 2025 greyed out and labelled is an answer. */
const YEAR_SPAN_BACK = 24;

/* A snapshot records what you held, so it cannot be dated later than today.

   Nothing would value it either. A holding in a year at or past the current one is priced at
   the live price, so a 2029 snapshot would be today's prices wearing a 2029 label; it would
   also become the latest snapshot, which is what the headline total reads and what the forecast
   projects forward from — so one stray future year moves the baseline of the whole projection.
   Where you are heading is the Forecast panel's job, and it does it from the years you have.

   A year already dated in the future — from the free-text field this replaced, or from + Year
   before it was capped — is still offered, or it could never be moved back. */
function yearRange() {
  const years = state.snapshots.map((s) => s.year).filter((y) => Number.isFinite(y));
  const cur = state.snapshots[edIdx] ? state.snapshots[edIdx].year : new Date().getFullYear();
  const now = new Date().getFullYear();
  const lo = Math.min(now, cur, ...(years.length ? years : [now])) - YEAR_SPAN_BACK;
  const hi = Math.max(now, cur);   // today, or wherever a stray snapshot already sits
  const out = [];
  for (let y = hi; y >= lo; y--) out.push(y);   // newest first, like the years list itself
  return out;
}

function renderYearGrid() {
  const sn = state.snapshots[edIdx]; if (!sn) return;
  const taken = new Map();
  state.snapshots.forEach((s, i) => { if (i !== edIdx) taken.set(s.year, true); });
  $("yearGrid").innerHTML = yearRange().map((y) => {
    const isNow = y === sn.year, isTaken = taken.has(y);
    const cls = "yearopt" + (isNow ? " is-now" : "") + (isTaken ? " is-taken" : "");
    const title = isTaken ? t("yeared.yearTaken", { year: y }) : isNow ? t("yeared.yearNow", { year: y }) : "";
    return `<button type="button" class="${cls}" data-year="${y}"${isTaken ? " disabled" : ""}${title ? ` title="${title}"` : ""}${isNow ? ' aria-current="true"' : ""}>${y}</button>`;
  }).join("");
}

function openYearModal() {
  if (edIdx < 0) return;
  renderYearGrid();
  $("yearModal").classList.remove("hide");
  const now = $("yearGrid").querySelector(".is-now");
  if (now) now.scrollIntoView({ block: "center" });
}
const closeYearModal = () => $("yearModal").classList.add("hide");

$("edYearBtn").onclick = openYearModal;
$("yearClose").onclick = closeYearModal;
$("yearModal").addEventListener("click", (e) => { if (e.target.id === "yearModal") closeYearModal(); });
$("yearGrid").addEventListener("click", (e) => {
  const b = e.target.closest("[data-year]"); if (!b || b.disabled) return;
  const sn = state.snapshots[edIdx]; if (!sn) return;
  const y = parseInt(b.dataset.year, 10);
  // Belt and braces: the grid disables taken years, but nothing else may set one either.
  if (!Number.isFinite(y) || state.snapshots.some((s, idx) => idx !== edIdx && s.year === y)) {
    toast(t("net.yearExists", { year: y })); return;
  }
  sn.year = y;
  edYearPrev = y;
  $("edYearVal").textContent = String(y);
  scheduleSync();
  closeYearModal();
  // The entries are valued at their year — a holding priced at its year-end close, an asset
  // depreciated to it — so moving the year re-prices everything in it.
  renderEntries();
  ensureHist();
  toast(t("yeared.moved", { year: y }));
});

$("edDelYear").onclick = () => { if (edIdx < 0) return; if (confirm(t("net.delYearConfirm", { year: state.snapshots[edIdx].year }))) { state.snapshots.splice(edIdx, 1); scheduleSync(); closeYearEditor(); } };
// Adding a row lands on a placeholder name — focus and select it so typing replaces it, and
// bring the new card into view (it renders at the end of the ungrouped list).
$("edAdd").onclick = () => {
  const sn = state.snapshots[edIdx];
  sn.entries.push({ id: nid(), name: t("common.newAsset"), kind: "fixed", ccy: state.baseCcy, value: 0 });
  scheduleSync(); renderEntries();
  focusNew($("edEntries").querySelector(`.rname[data-i="${sn.entries.length - 1}"]`));
};
$("edAddLongterm").onclick = () => { const a = newAsset(); openAssetEditor(a.id, true); };
$("edAddLiability").onclick = () => { const a = newLiability(); openAssetEditor(a.id, true); };
$("edAddGroup").onclick = () => {
  const name = addCategory(t("common.newCategory"));
  scheduleSync(); renderEntries();
  focusNew($("edEntries").querySelector(`.grpname[data-grp="${name}"]`));
};
$("edCopyPrev").onclick = () => { const cur = state.snapshots[edIdx]; const prev = state.snapshots.filter((s) => s.year < cur.year).sort((a, b) => b.year - a.year)[0]; if (!prev) { toast(t("net.noEarlierYear")); return; } if (cur.entries.length && !confirm(t("net.replaceEntries", { year: prev.year }))) return; cur.entries = prev.entries.map((e) => ({ id: nid(), name: e.name, kind: e.kind || "fixed", ccy: e.ccy, value: e.value, shares: e.shares, ticker: e.ticker, group: e.group })); scheduleSync(); renderEntries(); ensureHist(); toast(t("net.copiedYear", { year: prev.year })); };

$("edEntries").addEventListener("input", (e) => {
  const el = e.target, sn = state.snapshots[edIdx];
  if (el.dataset.grp != null) {
    const nw = el.value;
    renameCategory(el.dataset.grp, nw); // global tag: rename in the list and across every year and asset
    el.dataset.grp = nw; scheduleSync(); return;
  }
  const i = +el.dataset.i, f = el.dataset.f; if (el.dataset.i == null || !f) return;
  const en = sn.entries[i];
  if (f === "value" || f === "shares") en[f] = parseFloat(el.value || 0);
  else if (f === "group") en.group = el.value || undefined;
  else en[f] = el.value;
  scheduleSync();
  if (f === "kind" || f === "ccy" || f === "group") { renderEntries(); return; }
  const card = el.closest(".rcard"); const cv = card && card.querySelector(".rconv");
  if (cv) {
    const bv = entryBase(en, sn.year);
    if (en.kind === "ticker" || en.kind === "crypto") { const p = tickerPx(en, sn.year); cv.textContent = p ? money(bv) : en.ticker ? t("net.noPrice") : en.kind === "crypto" ? t("net.setCoin") : t("net.setTicker"); }
    else if (en.kind === "liability") cv.textContent = "− " + money(Math.abs(bv));
    else cv.textContent = en.ccy !== state.baseCcy ? "= " + money(bv) : "";
    flash(cv);
  }
  if (en.group) { const gb = el.closest(".grp"), gs = gb && gb.querySelector(".grpsub"); if (gs) { gs.textContent = money(effEntries(sn).filter((x) => x.group === en.group).reduce((a, x) => a + entryBase(x, sn.year), 0)); flash(gs); } }
  $("edTotal").textContent = money(snapTotalBase(sn));
});

$("edEntries").addEventListener("change", async (e) => {
  const el = e.target, f = el.dataset.f;
  if (el.dataset.grp != null) { renderEntries(); return; }
  if (f === "name") { renderEntries(); return; }
  if (f === "ticker" && el.value.trim()) {
    const sn = state.snapshots[edIdx], en = sn && sn.entries[+el.dataset.i], cy = new Date().getFullYear();
    if (!en) return;
    // Crypto: accept a bare coin (BTC -> BTC-EUR) and normalise so it matches Yahoo's symbols.
    let sym = el.value.trim(); if (en.kind === "crypto" && !sym.includes("-")) sym = sym.toUpperCase() + "-EUR"; en.ticker = sym;
    toast(t("net.fetchingPrice"));
    if (sn.year < cy) { const r = await fetchPriceYear(sym, sn.year); if (r) { en.px = r.price; en.pxCcy = r.currency; en.pxKey = sym + "@" + sn.year; } else { delete en.px; delete en.pxCcy; delete en.pxKey; } scheduleSync(); renderEntries(); toast(r ? t("net.yearEndPriceFor", { year: sn.year }) : t("net.fetchFailed")); }
    else { delete en.px; delete en.pxCcy; delete en.pxKey; const ok = await fetchPrice(sym); scheduleSync(); renderEntries(); toast(ok ? t("net.priceUpdated") : t("net.fetchFailed")); }
  }
});

// Symbol-format help, shown in an overlay from the (i) button next to the ticker field.
// The HTML lives in the i18n dictionaries (net.infoTicker / net.infoCrypto), resolved at open time.
function openInfo(kind) { const b = $("infoBody"); if (b) b.innerHTML = kind === "ticker" ? t("net.infoTicker") : kind === "crypto" ? t("net.infoCrypto") : ""; $("infoModal").classList.remove("hide"); }
function closeInfo() { $("infoModal").classList.add("hide"); }
$("infoClose").onclick = closeInfo;
$("infoModal").addEventListener("click", (e) => { if (e.target.id === "infoModal") closeInfo(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeInfo(); });

$("edEntries").addEventListener("click", (e) => {
  const sn = state.snapshots[edIdx];
  const inf = e.target.closest("[data-info]"); if (inf) { openInfo(inf.dataset.info); return; }
  const ae = e.target.closest("[data-editasset]"); if (ae) { openAssetEditor(ae.dataset.editasset); return; }
  if (e.target.dataset.del != null) { sn.entries.splice(+e.target.dataset.del, 1); scheduleSync(); renderEntries(); return; }
  const gd = e.target.closest("[data-grpdel]");
  if (gd) {
    const g = gd.dataset.grpdel;
    // Deleting a category removes the tag from every item in every year (nothing is removed).
    const n = categoryUsage(g);
    if (n === 0 || confirm(t("net.removeCategoryConfirm", { name: g, count: n }))) {
      removeCategory(g); scheduleSync(); renderEntries();
    }
    return;
  }
});

/* The next year worth recording: the newest one not already in the ledger, and never later
   than this one. It used to be simply the highest year plus one, which minted a year in the
   future the moment the ledger caught up with the present — a snapshot nothing can value, sitting
   where the headline total and the forecast's baseline both read from. */
$("addYear").onclick = () => {
  const taken = new Set(state.snapshots.map((s) => s.year));
  const now = new Date().getFullYear();
  let ny = now;
  while (taken.has(ny)) ny--;
  // Every year back to the earliest is spoken for; the gap, if any, is further back than anyone
  // is likely to mean, so say so rather than guess.
  if (now - ny > 60) { toast(t("net.yearsFull")); return; }
  state.snapshots.push({ year: ny, entries: [] });
  scheduleSync();
  openYearEditor(state.snapshots.length - 1);
};
