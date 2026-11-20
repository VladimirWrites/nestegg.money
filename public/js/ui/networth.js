// Year editor: the list of snapshots and the per-year entry editing overlay.
import { $, showEditor, hideEditor, toast, flash, focusNew, setInert, rememberFocus, restoreFocus } from "./dom.js";
import { state } from "../domain/store.js";
import { nid } from "../domain/ids.js";
import { CCYS } from "../domain/constants.js";
import { money, moneyIn, esc, parseNum, parseDec, fmtNum } from "../domain/money.js";
import { allNames, autoEntriesFor, colorOf, seriesKey, entryBase, tickerPx, snapTotalBase, effEntries } from "../domain/model.js";
import { scheduleSync, ensureHist, fetchPrice, fetchPriceYear } from "../io/storage.js";
import { renderAll } from "./charts.js";
import { openAssetEditor, newAsset, newLiability } from "./assets.js";
import { groupNames, addCategory, renameCategory, categoryUsage, removeCategory } from "../domain/categories.js";
import { categorySelectHTML, groupSectionHTML } from "./categories-ui.js";
import { t } from "../i18n.js";

let edIdx = -1;
let edYearPrev = null;

/* The button says 2026 and used to be labelled "Move", which replaces the text content — so
   a screen reader heard "Move, button" and never heard which year. */
function setYearLabel(y) {
  $("edYearVal").textContent = String(y);
  const b = $("edYearBtn");
  if (b) b.setAttribute("aria-label", t("yeared.changeYearAria", { year: y }));
}

function openYearEditor(ri) {
  edIdx = ri;
  edYearPrev = state.snapshots[ri].year;
  setYearLabel(state.snapshots[ri].year);
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
    valuePart = `<input class="rsh num" type="text" inputmode="decimal" value="${en.shares ? String(en.shares) : ""}" data-i="${i}" data-f="shares" placeholder="${isC ? t("net.coins") : t("net.shares")}" aria-label="${isC ? t("net.coins") : t("net.shares")}" title="${isC ? t("net.coins") : t("net.shares")}">
    <span class="rtkwrap"><input class="rtk" value="${esc(en.ticker || "")}" data-i="${i}" data-f="ticker" placeholder="${isC ? "BTC-EUR" : "AMS:VWRL"}" aria-label="${isC ? t("net.coinPairTitle") : t("net.tickerTitle")}" title="${isC ? t("net.coinPairTitle") : t("net.tickerTitle")}"><button type="button" class="rinfo" data-info="${isC ? "crypto" : "ticker"}" title="${t("net.symbolHelpTitle")}" aria-label="${t("net.symbolHelpAria")}">i</button></span>
    <span class="rconv">${p ? money(baseV) : pxtxt}</span>`;
  } else {
    valuePart = `<input class="rval num" type="text" inputmode="decimal" value="${en.value ? fmtNum(en.value) : ""}" data-i="${i}" data-f="value" aria-label="${liab ? t("net.amountOwed") : t("asset.value")}" placeholder="${liab ? t("net.amountOwed") : "0"}">
    <select data-i="${i}" data-f="ccy" aria-label="${t("asset.currency")}">${CCYS.map((x) => `<option ${x === en.ccy ? "selected" : ""}>${x}</option>`).join("")}</select>
    <span class="rconv${liab ? " liab" : ""}">${liab ? "− " + money(Math.abs(baseV)) : en.ccy !== state.baseCcy ? "= " + money(baseV) : ""}</span>`;
  }
  const cats = groupNames();
  const catSel = cats.length ? categorySelectHTML("rcat", `data-i="${i}" data-f="group"`, en.group, cats) : "";
  return `<div class="rcard${priced ? " is-priced" : ""}${liab ? " liabcard" + (Math.abs(baseV) > 0.005 ? " is-owing" : "") : ""}"><span class="dot" style="background:${liab ? "var(--danger)" : colorOf(seriesKey(en), names)}"></span>
    <input class="rname" value="${esc(en.name)}" data-i="${i}" data-f="name" aria-label="${liab ? t("net.liabilityName") : t("net.assetName")}" placeholder="${liab ? t("net.liabilityName") : t("net.assetName")}">
    <select class="rkind" data-i="${i}" data-f="kind" aria-label="${t("net.kindAria")}"><option value="fixed" ${!priced && !liab ? "selected" : ""}>${t("net.kindValue")}</option><option value="ticker" ${en.kind === "ticker" ? "selected" : ""}>${t("net.kindTicker")}</option><option value="crypto" ${en.kind === "crypto" ? "selected" : ""}>${t("net.kindCrypto")}</option><option value="liability" ${liab ? "selected" : ""}>${t("net.kindLiability")}</option></select>
    ${valuePart}
    ${catSel}
    <button type="button" class="rdel" data-del="${i}" title="${t("common.remove")}" aria-label="${esc(t("net.removeEntryAria", { name: en.name || t("net.thisRow") }))}">×</button>${priceNote}</div>`;
}

// Read-only card for a long-term asset (tap to edit in the focused asset editor).
function autoCardHTML(en, names, year) {
  if (RO) return roAutoCardHTML(en, names, year);
  const a = (state.assets || []).find((x) => x.id === en.assetId) || {}, liab = en.kind === "liability";
  const tags = liab ? t("net.tagLiability") : [a.depreciates ? (a.up ? t("net.tagAppreciating") : t("net.tagDepreciating")) : "", a.loan ? t("net.tagLoan") : ""].filter(Boolean).join(" · ") || t("net.tagAsset");
  const v = entryBase(en, year);
  /* A button, not a div with a click handler. This card is the only route from a year into
     the asset editor, so as a div it was unreachable by keyboard or switch, and a screen
     reader read it as loose text with no name and no hint that it opened anything. */
  const amount = liab ? "− " + money(Math.abs(v)) : money(v);
  return `<button type="button" class="rcard auto${liab ? " liabcard" + (Math.abs(v) > 0.005 ? " is-owing" : "") : ""}" data-editasset="${en.assetId}" aria-label="${esc(t("net.editAssetAria", { name: en.name, tags, amount }))}"><span class="dot" style="background:${liab ? "var(--danger)" : colorOf(seriesKey(en), names)}"></span>` +
    `<span class="rname ro">${esc(en.name)}</span>` +
    `<span class="autotag">${tags}</span>` +
    `<span class="rconv${liab ? " liab" : ""}">${amount}</span>` +
    `<svg class="autoedit" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg></button>`;
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
$("edDone").onclick = () => $("edBack").click();
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
    /* A struck-through year says nothing on a phone, where there is no tooltip to hover, so
       the reason is printed. The current year is disabled too: pressing the big highlighted
       tile ran the whole move and toasted "Moved to 2026" without moving anything. */
    /* Two elements, not a year with a word glued to it. Written as `${y}<i>…</i>` the tile
       read "2025In your ledger", wrapped mid-word, and inherited the button's strikethrough
       and 36% opacity — so the only explanation on the screen was itself crossed out, and
       the highlighted current year looked cancelled. */
    const note = isTaken ? t("yeared.inLedger") : isNow ? t("yeared.current") : "";
    const label = isTaken ? t("yeared.yearTaken", { year: y }) : isNow ? t("yeared.yearNow", { year: y }) : t("yeared.moveTo", { year: y });
    return `<button type="button" class="${cls}" data-year="${y}"${isTaken || isNow ? " disabled" : ""}${title ? ` title="${title}"` : ""}${isNow ? ' aria-current="true"' : ""} aria-label="${esc(label)}"><span class="yo-y">${y}</span>${note ? `<span class="yo-n">${note}</span>` : ""}</button>`;
  }).join("");
}

function openYearModal() {
  if (edIdx < 0) return;
  renderYearGrid();
  rememberFocus("yearModal");
  $("yearModal").classList.remove("hide");
  /* The markup claimed aria-modal and the dialog behaved like a card: focus stayed on the
     year button behind the scrim, Tab walked the whole editor before reaching a tile, and
     picking one dropped focus on <body>. */
  setInert($("yearEditor"), true);
  const now = $("yearGrid").querySelector(".is-now");
  if (now) now.scrollIntoView({ block: "center" });
  const first = $("yearGrid").querySelector("button:not([disabled])");
  if (first) setTimeout(() => { try { first.focus({ preventScroll: true }); } catch (e) {} }, 0);
}
const closeYearModal = () => {
  $("yearModal").classList.add("hide");
  setInert($("yearEditor"), false);
  restoreFocus("yearModal");
};
/* Escape and the system Back button both reach for "the editor" — which, with this dialog
   open, shut the year editor underneath and left the year grid floating over the Net worth
   screen with every tile in it dead, because the handler reads state.snapshots[edIdx] and
   edIdx is now -1. The dialog is what Escape means while the dialog is up. */
export const yearModalOpen = () => !$("yearModal").classList.contains("hide");

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
  setYearLabel(y);
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
/* The open year goes with the press. Adding a property while looking at 2023 and finding it
   in 2026 is not a subtlety: a new asset is dated today, and autoEntriesFor drops anything
   owned from after a year's reference date, so it was absent from the year that added it and
   that year's total never moved. */
const openYear = () => (state.snapshots[edIdx] ? state.snapshots[edIdx].year : new Date().getFullYear());
$("edAddLongterm").onclick = () => { const a = newAsset(openYear()); openAssetEditor(a.id, true); };
$("edAddLiability").onclick = () => { const a = newLiability(openYear()); openAssetEditor(a.id, true); };
$("edAddGroup").onclick = () => {
  const name = addCategory(t("common.newCategory"));
  scheduleSync(); renderEntries();
  focusNew($("edEntries").querySelector(`.grpname[data-grp="${name}"]`));
};
$("edCopyPrev").onclick = () => { const cur = state.snapshots[edIdx]; const prev = state.snapshots.filter((s) => s.year < cur.year).sort((a, b) => b.year - a.year)[0]; if (!prev) { toast(t("net.noEarlierYear")); return; } if (cur.entries.length && !confirm(t("net.replaceEntries", { year: prev.year }))) return; cur.entries = prev.entries.map((e) => ({ id: nid(), name: e.name, kind: e.kind || "fixed", ccy: e.ccy, value: e.value, shares: e.shares, ticker: e.ticker, group: e.group })); scheduleSync(); renderEntries(); ensureHist(); toast(t("net.copiedYear", { year: prev.year })); };

$("edEntries").addEventListener("input", (e) => {
  const el = e.target, sn = state.snapshots[edIdx];
  // A category name is committed on change, not on input — see the change handler below.
  if (el.dataset.grp != null) return;
  const i = +el.dataset.i, f = el.dataset.f; if (el.dataset.i == null || !f) return;
  const en = sn.entries[i];
  if (f === "value") en.value = parseNum(el.value) || 0;
  else if (f === "shares") en.shares = parseDec(el.value) || 0;   // 0.125 BTC is an eighth of a coin, not 125
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
  /* Renaming a category used to run on every keystroke, through a rename that retags by name
     equality across every year and every asset, with no uniqueness check. Backspacing
     "Groceries" into "Gro" and on into "" committed each of those as the global name; passing
     through a name that already existed merged the two categories for good, and an empty one
     left every tagged row both ungrouped and inside a nameless section. It is committed once,
     when the reader has finished, and refused if it is blank or already taken. */
  if (el.dataset.grp != null) {
    const was = el.dataset.grp, now = el.value.trim();
    if (now === was) { el.value = was; return; }
    if (!now) { toast(t("net.categoryNeedsName")); el.value = was; return; }
    if (groupNames().some((g) => g !== was && g === now)) { toast(t("net.categoryExists", { name: now })); el.value = was; return; }
    renameCategory(was, now);   // the global tag, in the list and across every year and asset
    scheduleSync(); renderEntries(); return;
  }
  /* A name does not change the shape of the list, and rebuilding it here destroyed whatever
     the reader was already reaching for: `change` fires on blur, during the press that is on
     its way to the value field or the ×, so the first tap after typing a name landed on an
     element that no longer existed and did nothing. Only the colour can move, and that is
     patched in place. */
  if (f === "name") {
    const sn2 = state.snapshots[edIdx], en2 = sn2 && sn2.entries[+el.dataset.i];
    const dot = el.closest(".rcard") && el.closest(".rcard").querySelector(".dot");
    if (dot && en2 && en2.kind !== "liability") dot.style.background = colorOf(seriesKey(en2), allNames());
    return;
  }
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
/* No Escape listener of its own.
 *
 * It had one, and because a module's imports evaluate before the importing module's body,
 * it was registered before the app's. So Escape hid this modal first, and by the time the
 * app's handler checked whether a modal was open the class was already gone: one press shut
 * the help and the whole year editor behind it. Escape is handled in one place, in main.js,
 * which closes the topmost layer and nothing else. */

$("edEntries").addEventListener("click", (e) => {
  const sn = state.snapshots[edIdx];
  const inf = e.target.closest("[data-info]"); if (inf) { openInfo(inf.dataset.info); return; }
  const ae = e.target.closest("[data-editasset]"); if (ae) { openAssetEditor(ae.dataset.editasset); return; }
  const del = e.target.closest("[data-del]");
  if (del) {
    const en = sn.entries[+del.dataset.del];
    // One tap on a glyph in the corner of a row used to remove a balance outright.
    if (en && !confirm(t("net.removeEntryConfirm", { name: en.name || t("net.thisRow") }))) return;
    sn.entries.splice(+del.dataset.del, 1); scheduleSync(); renderEntries(); return;
  }
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
