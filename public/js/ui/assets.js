// Long-term asset editor: one asset with optional toggles (depreciates and/or carries a loan).
// Net contribution = (depreciated price or market value) − outstanding loan.
import { $, toast, flash, focusNew, setInert, rememberFocus, restoreFocus, restoreFocusTo, behind } from "./dom.js";
import { state } from "../domain/store.js";
import { nid } from "../domain/ids.js";
import { CCYS } from "../domain/constants.js";
import { money, moneyIn, moneyIn0, esc, convTo, fmtLocale, parseNum, parseDec, fmtNum, fmtPlain } from "../domain/money.js";
import { fmtMY, fmtMonths, parseDate } from "../domain/dates.js";
import { buildSchedule, loanTerms, outstandingAt } from "../domain/loan.js";
import { assetGrossAt, assetNetAt } from "../domain/asset-value.js";
import { normLoan } from "../domain/schema.js";
import { groupNames } from "../domain/categories.js";
import { categorySelectHTML } from "./categories-ui.js";
import { renderAll } from "./charts.js";
import { renderEntries } from "./networth.js";
import { scheduleSync } from "../io/storage.js";
import { t, getLocale } from "../i18n.js";
import { pushEditor, popEditor } from "./history.js";

// The two helpers below carry the interface language into the pure date module.
const monthUnits = () => ({ yr: t("asset.yrShort"), mo: t("asset.moShort") });
const my = (d) => fmtMY(d, getLocale());
// The symbol alone, so a bare number field can say what unit it is in.
const ccyUnit = (ccy) => {
  try {
    const parts = new Intl.NumberFormat(fmtLocale(), { style: "currency", currency: ccy }).formatToParts(0);
    const c = parts.find((x) => x.type === "currency");
    return c ? c.value : ccy;
  } catch (e) { return ccy; }
};
const ymdDay = (d) => d.toLocaleDateString(getLocale(), { day: "numeric", month: "short", year: "numeric" }); // day-precision sibling of fmtMY

/* Today where the reader is, not where UTC is.
 *
 * `toISOString()` is UTC, and parseDate reads a bare YYYY-MM-DD as local — so east of UTC in
 * the small hours, and west of it in the evening, a thing bought today was dated yesterday or
 * tomorrow. A date one day in the future drops the asset out of the current year entirely
 * until midnight, because autoEntriesFor skips anything owned from after the year's reference
 * date. */
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/* When a thing added from a given year should be said to have been owned from.
 *
 * Adding a property while looking at 2023 and having it appear in 2026 is not a subtlety: the
 * year you are in is the whole context of the press. Anything before this year starts on the
 * 1st of January of it; this year and anything later start today, because a snapshot cannot be
 * valued in the future. */
export function ownedFromFor(year) {
  const now = new Date().getFullYear();
  return Number.isFinite(year) && year < now ? `${year}-01-01` : todayISO();
}

let curAssetId = null; // the single long-term asset the editor is focused on

/* Whether the month-by-month schedule is open.
 *
 * The computed block is rebuilt from scratch on every keystroke in a loan field, and a
 * <details> rebuilt without this is a <details> closed. So "open the schedule, nudge the rate,
 * see what moved" — the one reason to open it at all — shut the schedule on the first key and
 * sent the reader back down two hundred rows to reopen it. */
let schedOpen = false;

export function openAssetEditor(id, focusName) {
  curAssetId = id;
  rememberFocus("assetEditor");
  $("assetEditor").classList.remove("hide");
  /* This editor opens on top of the year editor rather than instead of it, so both the app
     and that layer have to be switched off: otherwise Tab walks through a whole screen of
     controls nobody can see, under an opaque one. */
  /* The same thing showEditor switches off, for the same reason: on a laptop the rail lives
     inside #app and stays on screen beside the editor, so inerting the lot left four tabs
     drawn as if they worked. */
  setInert(behind(), true);
  setInert($("yearEditor"), true);
  document.body.classList.add("no-nav");
  pushEditor("assetEditor");
  window.scrollTo(0, 0);
  renderAssets(focusName);
  if (!focusName) setTimeout(() => { const h = $("assetTitle"); if (h) { try { h.focus({ preventScroll: true }); } catch (e) {} } }, 0);
}
function closeAssetEditor() {
  $("assetEditor").classList.add("hide");
  setInert($("yearEditor"), false);
  const back = curAssetId;
  // The year editor underneath is an editor too, so the bar only comes back with both shut.
  if ($("yearEditor").classList.contains("hide")) {
    document.body.classList.remove("no-nav");
    setInert($("app"), false);
    setInert(document.querySelector(".shell-main"), false);
  } else setInert(behind(), true);   // the year editor is still up, so its own layer stays off
  popEditor();
  if (!$("yearEditor").classList.contains("hide")) {
    renderEntries();
    /* After the rebuild, not before it: renderEntries replaces the card focus came from. If
       the asset was deleted there is no card to go back to, so focus lands on the editor's
       own title rather than on the body. */
    const gone = !state.assets.some((x) => x.id === back);
    restoreFocusTo(gone ? "#yearEditor .ed-title" : `[data-editasset="${back}"]`);
  } else { renderAll(); restoreFocus("assetEditor"); }
}

// The computed (read-only) outputs for a loan — refreshed in place as inputs change,
// so the editable fields (and the caret) are never destroyed by a re-render.
function loanComputedHTML(a) {
  const L = a.loan, byPayment = L.mode === "payment", sched = buildSchedule(L), { M, n } = loanTerms(L);
  const bal = outstandingAt(L, new Date());
  const payRows = sched.filter((r) => r.type !== "extra");
  const payoff = payRows.length ? payRows[payRows.length - 1].date : null, totInt = sched.reduce((s, r) => s + (r.interest || 0), 0);
  const fixedUntil = L.fixedUntil ? parseDate(L.fixedUntil) : null;
  const balAtChange = fixedUntil ? outstandingAt(L, fixedUntil) : null; // amount left when the rate resets
  /* The term the loan actually runs to. `loanTerms` solves the amortization and knows
     nothing about lump sums, so a mortgage with four of them read "19 yr 6 mo" beside a
     payoff of Apr 2041 and a schedule of 204 payments — seventeen years. */
  const realMonths = payRows.length || n;
  /* Whether this is a loan at all, measured on the schedule — which knows about the lump
     sums, and covers both modes. The engine caps its run at a hundred years, so a balance
     still standing at the last row is a balance that never clears; a payment a euro above
     the monthly interest used to produce "Payoff Dec 2125" and a total interest of three and
     a half million against a principal that had barely moved. */
  const LIFETIME_MONTHS = 600;   // fifty years
  const lastRow = payRows.length ? payRows[payRows.length - 1] : null;
  const neverClears = !!lastRow && lastRow.balance > 0.005;
  const tooSlow = neverClears || !isFinite(n) || realMonths > LIFETIME_MONTHS;
  const interestOnly = byPayment && +L.payment > 0 && +L.rate > 0 && +L.payment <= (+L.amount * +L.rate) / 100 / 12;
  const calcStat = byPayment
    ? `<div class="pstat"><span class="k">${t("asset.termCalc")}</span><span class="v num">${fmtMonths(realMonths, monthUnits())}</span></div>`
    : `<div class="pstat"><span class="k">${t("asset.monthlyPayment")}</span><span class="v num">${M ? moneyIn(M, a.ccy) : "—"}</span></div>`;
  /* What a calendar year did to the debt.
   *
   * A month tells you what you pay; it does not tell you what you bought. Most of an early
   * payment is rent on the money, and the question people actually ask at the end of a year —
   * how much of this is mine now — can only be answered from the monthly rows by adding twelve
   * numbers up by hand. So each year gets a row of its own, and the figure it leads with is the
   * amount that came off the loan: scheduled principal and any lump sums together, since both
   * are the debt shrinking and only their timing differs. Interest is counted separately
   * because it is the one part of the payment that buys nothing. */
  const yearly = new Map();
  for (const r of sched) {
    const y = r.date.getFullYear();
    const g = yearly.get(y) || { payment: 0, interest: 0, principal: 0, extra: 0, balance: 0, estimated: true };
    g.payment += r.payment || 0;
    g.interest += r.interest || 0;
    g.principal += r.principal || 0;
    g.extra += r.extra || 0;
    g.balance = r.balance;              // the schedule is in order, so the last one seen is year-end
    g.estimated = g.estimated && !!r.estimated; // only a wholly projected year is marked as one
    yearly.set(y, g);
  }
  /* The same figure for the year in progress, said at the top where it is read without opening
     anything. Counted only up to today, unlike the year rows: it sits beside "balance today", and
     a number that quietly included next November would not be what anybody reads it as. */
  const now = new Date();
  const nowYear = now.getFullYear();
  const ytd = sched.reduce((s, r) => (r.date.getFullYear() === nowYear && r.date <= now ? s + (r.principal || 0) + (r.extra || 0) : s), 0);
  const inYear = sched.some((r) => r.date.getFullYear() === nowYear);
  const yearRow = (y) => {
    const g = yearly.get(y);
    const off = g.principal + g.extra;
    return `<tr class="yrow${g.estimated ? " est" : ""}"><td>${y}</td><td class="num">${moneyIn(g.payment, a.ccy)}</td><td class="num">${moneyIn(g.interest, a.ccy)}</td><td class="num off">${moneyIn(off, a.ccy)}</td><td class="num sub">${g.extra > 0 ? t("asset.inclExtra", { amount: moneyIn(g.extra, a.ccy) }) : "—"}</td><td class="num">${moneyIn(g.balance, a.ccy)}</td></tr>`;
  };

  /* Every year of the loan on one screen, which the monthly schedule cannot be: two hundred rows
     is a document, and this is a shape — the interest falling away, the principal taking over,
     the balance walking down to nothing. Shown open, above the months, because it is the view
     somebody wants first and the month-by-month detail is what they open afterwards. */
  const anyEst = [...yearly.values()].some((g) => g.estimated);
  const yearTable = `<div class="yrsched">
    <div class="yrsched-h">${t("asset.byYear")}</div>
    <div class="schscroll"><table class="schtab yrtab"><thead><tr><th>${t("asset.thYear")}</th><th>${t("asset.thPaidOff")}</th><th>${t("asset.thInterest")}</th><th>${t("asset.thExtra")}</th><th>${t("asset.thYearEnd")}</th></tr></thead><tbody>${[...yearly.keys()].map((y) => {
      const g = yearly.get(y);
      const cls = [g.estimated ? "est" : "", y === nowYear ? "now" : ""].filter(Boolean).join(" ");
      /* The lump sum is repeated under the year because the Extra column is dropped on a
         narrow screen, and "paid off €62,430" with €40,000 of it invisible is not a layout
         problem — it is a wrong number. */
      const extraNote = g.extra > 0 ? `<i class="yr-extra">${t("asset.inclExtra", { amount: moneyIn0(g.extra, a.ccy) })}</i>` : "";
      return `<tr class="${cls}"><td>${y}${extraNote}</td><td class="num off">${moneyIn0(g.principal + g.extra, a.ccy)}</td><td class="num dim">${moneyIn0(g.interest, a.ccy)}</td><td class="num">${g.extra > 0 ? moneyIn0(g.extra, a.ccy) : "—"}</td><td class="num">${moneyIn0(g.balance, a.ccy)}</td></tr>`;
    }).join("")}</tbody></table></div>
    ${anyEst ? `<div class="yrsched-note">${t("asset.estNote", { date: my(fixedUntil), rate: fmtNum(L.rate, 3) })}</div>` : ""}
  </div>`;

  let divDone = false;
  let curYear = null;
  const rows = sched.map((r) => {
    let pre = "";
    const y = r.date.getFullYear();
    if (y !== curYear) { curYear = y; pre += yearRow(y); }
    if (!divDone && r.estimated) { divDone = true; pre += `<tr class="fxdiv"><td colspan="6">${t("asset.fixedEnds", { date: my(fixedUntil), amount: moneyIn(balAtChange, a.ccy), rate: fmtNum(L.rate, 3) })}</td></tr>`; }
    const cls = r.estimated ? " est" : "";
    return pre + (r.type === "extra"
      ? `<tr class="exline${cls}"><td>${ymdDay(r.date)}</td><td colspan="3">${t("asset.additionalPayment")}</td><td class="num">${moneyIn(r.extra, a.ccy)}</td><td class="num">${moneyIn(r.balance, a.ccy)}</td></tr>`
      : `<tr class="${cls.trim()}"><td>${my(r.date)}</td><td class="num">${moneyIn(r.payment, a.ccy)}</td><td class="num">${moneyIn(r.interest, a.ccy)}</td><td class="num">${moneyIn(r.principal, a.ccy)}</td><td class="num">—</td><td class="num">${moneyIn(r.balance, a.ccy)}</td></tr>`);
  }).join("");
  /* When nothing clears, the stats below are fiction — "Payoff Dec 2125", a total interest
     in the millions — so they are not printed. The previous guard added a banner above them
     and left them on the screen, which is what the last round objected to. */
  if (tooSlow) {
    return `<div class="loanwarn" role="alert">${interestOnly
      ? t("asset.paymentTooLow", { amount: moneyIn((+L.amount || 0) * (+L.rate || 0) / 100 / 12, a.ccy) })
      : t("asset.loanNeverClears")}</div>`;
  }
  return `
    <div class="pstats">
      ${calcStat}
      ${a.liability ? "" : `<div class="pstat"><span class="k">${t("asset.balanceToday")}</span><span class="v num">${moneyIn0(bal, a.ccy)}</span></div>`}
      ${inYear ? `<div class="pstat"><span class="k">${t("asset.paidOffIn", { year: nowYear })}</span><span class="v num off">${moneyIn0(ytd, a.ccy)}</span></div>` : ""}
      ${balAtChange != null ? `<div class="pstat"><span class="k">${t("asset.leftAtRateChange")}</span><span class="v num hilite">${moneyIn0(balAtChange, a.ccy)}</span></div>` : ""}
      <div class="pstat"><span class="k">${t("asset.payoff")}</span><span class="v num">${payoff ? my(payoff) : "—"}</span></div>
      <div class="pstat"><span class="k">${t("asset.totalInterest")}</span><span class="v num">${moneyIn0(totInt, a.ccy)}</span></div>
    </div>
    ${yearly.size ? yearTable : ""}
    ${payRows.length ? `<details class="psched"${schedOpen ? " open" : ""}><summary>${t("asset.schedule", { count: payRows.length })}</summary>
      <div class="schscroll"><table class="schtab"><thead><tr><th>${t("asset.thWhen")}</th><th>${t("asset.thPayment")}</th><th>${t("asset.thInterest")}</th><th>${t("asset.thPrincipal")}</th><th>${t("asset.thExtra")}</th><th>${t("asset.thBalance")}</th></tr></thead><tbody>${rows}</tbody></table></div></details>` : ""}`;
}

/* What a loan still needs before anything can be computed from it. An amount with no term
   and no payment has no schedule, no payoff and no monthly figure; printing the labels over
   dashes says "broken" rather than "not finished". */
function loanMissing(L) {
  if (!(+L.amount > 0)) return "asset.loanNeedsAmount";
  if (L.mode === "payment" ? !(+L.payment > 0) : !(+L.termYears > 0)) return "asset.loanNeedsTerm";
  /* A date input can be cleared, and with no start there is no schedule — so the screen
     printed "Total interest €0.00" beside a balance of the whole principal on a live
     mortgage, and the asset's net value silently dropped by the full loan. */
  if (!L.startDate) return "asset.loanNeedsStart";
  // A term that rounds to zero months has no schedule either.
  if (L.mode !== "payment" && Math.round((+L.termYears || 0) * 12) < 1) return "asset.loanNeedsTerm";
  return null;
}
function loanBlockHTML(a) {
  const missing = loanMissing(a.loan);
  return missing ? `<div class="exhint">${t(missing)}</div>` : loanComputedHTML(a);
}

function assetCardHTML(a) {
  const today = new Date();
  const gross = assetGrossAt(a, today), bal = a.loan ? outstandingAt(a.loan, today) : 0, net = gross - bal;
  const inBase = (v) => (a.ccy !== state.baseCcy ? " · " + money(convTo(v, a.ccy, state.baseCcy)) : "");
  let depBlock = "", loanBlock = "";
  if (a.depreciates) {
    depBlock = `<div class="frow">
      <label class="fld">${t("asset.direction")}<select data-aid="${a.id}" data-f="up"><option value="down" ${a.up ? "" : "selected"}>${t("asset.depDown")}</option><option value="up" ${a.up ? "selected" : ""}>${t("asset.appUp")}</option></select></label>
      <label class="fld">${t("asset.changeYr")}<span class="suffix"><input class="fin num" type="text" inputmode="decimal" value="${fmtPlain(+(a.rate * 100).toFixed(3), 3)}" data-aid="${a.id}" data-f="rate"><i>%</i></span></label>
    </div>`;
  }
  if (a.loan) {
    const L = a.loan, byPayment = L.mode === "payment";
    const termField = byPayment
      ? `<label class="fld">${t("asset.monthlyPayment")}<input class="fin num" type="text" inputmode="decimal" value="${L.payment ? fmtNum(L.payment) : ""}" placeholder="0" data-aid="${a.id}" data-lf="payment"></label>`
      : `<label class="fld">${t("asset.term")}<span class="suffix"><input class="fin num" type="text" inputmode="decimal" value="${L.termYears == null || L.termYears === "" ? "" : fmtPlain(L.termYears, 3)}" placeholder="0" data-aid="${a.id}" data-lf="termYears"><i>${t("asset.yrShort")}</i></span></label>`;
    /* A date and an amount belong to each other. Stacked with the same gap as the gap
       between payments, four of them were eight identical boxes with no way to tell which
       date owned which figure — and none of them had a name an assistive reader could use. */
    const extras = (L.extra || []).map((x, xi) => `<div class="exrow" role="group" aria-label="${t("asset.extraNth", { n: xi + 1 })}">
        <input type="date" class="fin" min="${esc(L.startDate || "1900-01-01")}" value="${esc(x.date)}" data-aid="${a.id}" data-eid="${x.id}" data-ef="date" aria-label="${t("asset.extraDateAria", { n: xi + 1 })}">
        <span class="suffix"><input class="fin num" type="text" inputmode="decimal" value="${x.amount ? fmtNum(x.amount) : ""}" data-aid="${a.id}" data-eid="${x.id}" data-ef="amount" placeholder="${t("asset.amountPh")}" aria-label="${t("asset.extraAmountAria", { n: xi + 1 })}"><i>${ccyUnit(a.ccy)}</i></span>
        <button type="button" class="rdel" data-extradel="${x.id}" data-aid="${a.id}" title="${t("asset.removePayment")}" aria-label="${t("asset.removeExtraAria", { n: xi + 1 })}">×</button></div>`).join("");
    loanBlock = `<div class="loanbox">
      <div class="frow">
        <label class="fld">${t("asset.loanAmount")}<input class="fin num" type="text" inputmode="decimal" value="${L.amount ? fmtNum(L.amount) : ""}" placeholder="0" data-aid="${a.id}" data-lf="amount"></label>
        <label class="fld">${t("asset.interestYr")}<span class="suffix"><input class="fin num" type="text" inputmode="decimal" value="${L.rate == null || L.rate === "" ? "" : fmtPlain(L.rate, 3)}" placeholder="0" data-aid="${a.id}" data-lf="rate"><i>%</i></span></label>
        <label class="fld">${t("asset.setBy")}<select data-aid="${a.id}" data-lf="mode"><option value="term" ${byPayment ? "" : "selected"}>${t("asset.term")}</option><option value="payment" ${byPayment ? "selected" : ""}>${t("asset.byPayment")}</option></select></label>
        ${termField}
        <label class="fld">${t("asset.start")}<input class="fin" type="date" value="${esc(L.startDate)}" data-aid="${a.id}" data-lf="startDate"></label>
        <label class="fld">${t("asset.fixedUntil")}<input class="fin" type="date" value="${esc(L.fixedUntil || "")}" data-aid="${a.id}" data-lf="fixedUntil"></label>
      </div>
      <div class="exwrap"><div class="psub"><span>${t("asset.extraPayments")}</span><button class="btn btn-sm" data-extraadd="${a.id}">${t("asset.addExtra")}</button></div>${extras || `<div class="exhint">${t("asset.extraHint")}</div>`}</div>
      <!-- Six labels over four dashes and two zeroes is furniture, not an answer. Until there
           is an amount there is nothing to compute, and the screen says what it needs. -->
      <div class="lcomp">${loanBlockHTML(a)}</div>
    </div>`;
  }
  const ccySel = `<select data-aid="${a.id}" data-f="ccy">${CCYS.map((x) => `<option ${x === a.ccy ? "selected" : ""}>${x}</option>`).join("")}</select>`;
  const catSel = categorySelectHTML("", `data-aid="${a.id}" data-f="group"`, a.group, groupNames());
  if (a.liability) {
    return `<div class="rcard acard liabcard${bal > 0.005 ? " is-owing" : ""}" id="acard-${a.id}" data-aid="${a.id}">
      <div class="pchead"><input class="rname" value="${esc(a.name)}" data-aid="${a.id}" data-f="name" placeholder="${t("net.liabilityName")}" aria-label="${t("net.liabilityName")}"></div>
      <div class="ahero is-liab"><span class="ah-k">${t("asset.owedToday")}</span><span class="ah-v num${bal > 0.005 ? " liab" : ""}">${bal > 0.005 ? "− " + moneyIn0(bal, a.ccy) : moneyIn0(0, a.ccy)}${inBase(-bal)}</span></div>
      ${a.loan ? "" : `<div class="toggles"><div class="tglgroup"><label class="tgl"><input type="checkbox" data-aid="${a.id}" data-toggle="loan"><span>${t("asset.ledeLoan")}<i>${t("asset.loanHint")}</i></span></label></div></div>`}
      <div class="frow"><label class="fld">${t("asset.currency")}${ccySel}</label><label class="fld">${t("common.category")}${catSel}</label>
        <label class="fld">${t("asset.borrowedOn")}<input class="fin" type="date" min="1900-01-01" max="${todayISO()}" value="${esc(a.date)}" data-aid="${a.id}" data-f="date"></label></div>
      ${loanBlock}
      <div class="acard-danger"><button class="btn btn-sm btn-quiet-danger" data-adel="${a.id}">${t("asset.removeLiability")}</button></div>
    </div>`;
  }
  /* The answer, at the top. "Net value today" used to be the last line of the card, which on
     a 320px phone with a mortgage on it is 2,700px below the fold, set at the same size as
     every label above it. */
  const hero = `<div class="ahero"><span class="ah-k">${t("asset.netValueToday")}</span><span class="ah-v num">${moneyIn0(net, a.ccy)}${inBase(net)}</span><span class="ah-sub">${a.loan && +a.loan.amount > 0 ? t("asset.worthOwes", { worth: moneyIn0(gross, a.ccy), owed: moneyIn0(bal, a.ccy) }) : ""}</span></div>`;
  return `<div class="rcard acard" id="acard-${a.id}" data-aid="${a.id}">
    <div class="pchead"><input class="rname" value="${esc(a.name)}" data-aid="${a.id}" data-f="name" placeholder="${t("net.assetName")}" aria-label="${t("net.assetName")}"></div>
    ${hero}
    <div class="frow">
      <label class="fld">${a.depreciates ? t("asset.startingValue") : t("asset.value")}<input class="fin num" type="text" inputmode="decimal" value="${a.value ? fmtNum(a.value) : ""}" placeholder="0" data-aid="${a.id}" data-f="value"></label>
      <label class="fld">${t("asset.currency")}${ccySel}</label>
      <label class="fld">${t("common.category")}${catSel}</label>
      <!-- On every asset, not only a depreciating one. This date decides which years the
           thing appears in at all; hidden inside the depreciation block, the only way to
           correct it was to tick a box that changes the value, fix the date and untick. -->
      <label class="fld">${t("asset.ownedSince")}<input class="fin" type="date" min="1900-01-01" max="${todayISO()}" value="${esc(a.date)}" data-aid="${a.id}" data-f="date"></label>
    </div>
    <!-- Each sub-form sits under the toggle that reveals it. Rendered after both toggles,
         the depreciation fields appeared beneath the "Has a loan" hint, so ticking one box
         grew a form under the other one. -->
    <div class="toggles">
      <div class="tglgroup">
        <label class="tgl"><input type="checkbox" data-aid="${a.id}" data-toggle="depreciates" ${a.depreciates ? "checked" : ""}><span>${t("asset.valueChanges")}<i>${t("asset.depHint")}</i></span></label>
        ${depBlock}
      </div>
      <div class="tglgroup">
        <label class="tgl"><input type="checkbox" data-aid="${a.id}" data-toggle="loan" ${a.loan ? "checked" : ""}><span>${t("asset.ledeLoan")}<i>${t("asset.loanHint")}</i></span></label>
        ${loanBlock}
      </div>
    </div>
    <!-- A labelled word at the foot, not an × in the corner of the only card on screen —
         which is the position and the glyph of "close this editor". -->
    <div class="acard-danger"><button class="btn btn-sm btn-quiet-danger" data-adel="${a.id}">${t("asset.removeAsset")}</button></div>
  </div>`;
}

function renderAssets(focusName) {
  const wrap = $("assetList");
  const a = state.assets.find((x) => x.id === curAssetId);
  if (!a) { closeAssetEditor(); return; }
  wrap.innerHTML = assetCardHTML(a);
  const title = $("assetTitle");
  if (title) title.textContent = a.name || t(a.liability ? "common.newLiability" : "common.newAsset");
  /* The lede explains two toggles. A standalone debt has neither, so on that screen it was
     60 words of instructions for controls that are not on it. */
  const lede = $("assetLede");
  if (lede) lede.classList.toggle("hide", !!a.liability);
  if (focusName) { const nm = wrap.querySelector(".rname"); if (nm) { nm.focus(); nm.select && nm.select(); } }
}

export function newAsset(year) {
  const iso = ownedFromFor(year);
  /* rate 0, not 0.15. One button adds a house and a car, and the old default meant ticking
     "Value changes over time" on a flat silently asserted a 15%-a-year decline. */
  const a = { id: nid(), name: t("common.newAsset"), ccy: state.baseCcy, value: 0, depreciates: false, up: false, date: iso, rate: 0, loan: null };
  state.assets.push(a); scheduleSync(); return a;
}
export function newLiability(year) {
  const iso = ownedFromFor(year);
  const a = { id: nid(), name: t("common.newLiability"), ccy: state.baseCcy, value: 0, depreciates: false, up: false, liability: true, date: iso, rate: 0, loan: normLoan({ startDate: iso }, iso) };
  state.assets.push(a); scheduleSync(); return a;
}

/* `el`, not `t`. The imported translator is called `t`, and an earlier screen in this app
   shadowed it with the event target — every keystroke threw, and nothing anybody typed was
   saved, for a whole round of review. */
$("assetList").addEventListener("input", (e) => {
  const el = e.target, id = el.dataset.aid; if (!id) return; const a = state.assets.find((x) => x.id === id); if (!a) return;
  if (el.dataset.eid) { const x = ((a.loan && a.loan.extra) || []).find((z) => z.id === el.dataset.eid); if (x) { if (el.dataset.ef === "amount") x.amount = parseNum(el.value) || 0; else x.date = el.value; } }
  else if (el.dataset.lf) {
    const f = el.dataset.lf;
    /* A rate and a term are read as decimals: "3.125" is three and an eighth per cent in
       either language, and parseNum's thousands rule would make it 3,125. An amount and a
       payment are money, where a thousands group is exactly what somebody means. */
    if (a.loan) a.loan[f] = f === "startDate" || f === "mode" || f === "fixedUntil" ? el.value
      : (f === "rate" || f === "termYears" ? parseDec(el.value) : parseNum(el.value)) || 0;
  }
  else if (el.dataset.f) {
    const f = el.dataset.f;
    if (f === "value") a.value = parseNum(el.value) || 0;
    else if (f === "rate") a.rate = Math.min(Math.max((parseDec(el.value) || 0) / 100, 0), 5);
    else if (f === "up") a.up = el.value === "up";
    else if (f === "group") a.group = el.value || undefined;
    else if (f === "date") return;   // committed on change — see the handler below
    else a[f] = el.value;
  }
  scheduleSync();
  if (el.dataset.f === "name") { const ti = $("assetTitle"); if (ti) ti.textContent = a.name || t(a.liability ? "common.newLiability" : "common.newAsset"); }
  // Refresh only the computed outputs in place — never the inputs — so the caret survives.
  const card = el.closest(".acard"); if (!card) return;
  const now = new Date();
  const vv = card.querySelector(".ah-v");
  if (vv) {
    const inBase = (v) => (a.ccy !== state.baseCcy ? " · " + money(convTo(v, a.ccy, state.baseCcy)) : "");
    if (a.liability) { const bal = a.loan ? outstandingAt(a.loan, now) : 0; vv.textContent = (bal > 0.005 ? "− " + moneyIn0(bal, a.ccy) : moneyIn0(0, a.ccy)) + inBase(-bal); }
    else { const net = assetNetAt(a, now); vv.textContent = moneyIn0(net, a.ccy) + inBase(net); }
    flash(vv);
  }
  const sub = card.querySelector(".ah-sub");
  if (sub && !a.liability) {
    const owed = a.loan ? outstandingAt(a.loan, now) : 0;
    sub.textContent = a.loan && +a.loan.amount > 0 ? t("asset.worthOwes", { worth: moneyIn0(assetGrossAt(a, now), a.ccy), owed: moneyIn0(owed, a.ccy) }) : "";
  }
  const lc = card.querySelector(".lcomp");
  if (lc && a.loan) lc.innerHTML = loanBlockHTML(a);
});

/* A loan set aside because its box was unticked.
 *
 * Unticking has to clear a.loan — an asset carrying a loan nobody asked for would value itself
 * against a debt that is not there. But the box is one tap, and behind it are an amount, a rate,
 * a start, a fixed-until date and every lump sum ever entered; unticking it and ticking it back
 * used to hand back an empty form. So the object is kept here, in memory, keyed by asset, and
 * put back if the box returns.
 *
 * Not written to the vault, and gone when the tab closes. That is the honest span: it undoes a
 * mis-tap in the session that made it, and does not resurrect a loan somebody deliberately
 * removed a week ago. */
const setAsideLoans = new Map();

$("assetList").addEventListener("change", (e) => {
  /* `t` is the imported translator. Shadowing it with the event target is how an earlier
     screen in this app silently discarded every keystroke for a round. */
  const tgl = e.target, id = tgl.dataset.aid; if (!id) return; const a = state.assets.find((x) => x.id === id); if (!a) return;
  if (tgl.dataset.toggle) {
    if (tgl.dataset.toggle === "depreciates") a.depreciates = tgl.checked;
    else if (tgl.checked) {
      a.loan = normLoan(a.loan || setAsideLoans.get(id) || { startDate: a.date }, a.date);
      setAsideLoans.delete(id);
    } else {
      /* A loan is an amount, a rate, a term, two dates and every lump sum ever entered, and
         this is a 17px checkbox. The in-memory set-aside below undoes a mis-tap in the session
         that made it; it is gone on reload and it never existed on the other device this
         sync reaches in a second. So anything with figures in it is asked for. */
      const worthKeeping = a.loan && (+a.loan.amount > 0 || (a.loan.extra || []).length > 0);
      if (worthKeeping && !confirm(t("asset.dropLoanConfirm", { name: a.name || t("asset.thisAsset") }))) {
        tgl.checked = true;
        return;
      }
      if (a.loan) setAsideLoans.set(id, a.loan);
      a.loan = null;
    }
    scheduleSync(); renderAssets(); return;
  }
  // Only the Term/Payment mode swap changes structure — rebuild for that; everything else
  // (amount, rate, dates, currency, extras) is updated live by the input handler.
  if (tgl.dataset.lf === "mode") { renderAssets(); return; }
});

$("assetList").addEventListener("click", (e) => {
  const ad = e.target.closest("[data-adel]"); if (ad) { const a = state.assets.find((x) => x.id === ad.dataset.adel); if (confirm(t("asset.removeConfirm", { name: a ? a.name : t("asset.thisAsset") }))) { state.assets = state.assets.filter((x) => x.id !== ad.dataset.adel); scheduleSync(); closeAssetEditor(); } return; }
  const ea = e.target.closest("[data-extraadd]"); if (ea) { const a = state.assets.find((x) => x.id === ea.dataset.extraadd); if (a && a.loan) { const id = nid(); a.loan.extra = a.loan.extra || []; a.loan.extra.push({ id, date: a.loan.startDate, amount: 0 }); scheduleSync(); renderAssets(); focusNew($("assetList").querySelector(`[data-eid="${id}"][data-ef="amount"]`)); } return; }
  const ed = e.target.closest("[data-extradel]");
  if (ed) {
    const a = state.assets.find((x) => x.id === ed.dataset.aid);
    if (a && a.loan) {
      const x = (a.loan.extra || []).find((z) => z.id === ed.dataset.extradel);
      // A lump sum is a payment that moved the balance; every figure below it changes with it.
      if (x && +x.amount > 0 && !confirm(t("asset.removePaymentConfirm", { amount: moneyIn(+x.amount, a.ccy) }))) return;
      a.loan.extra = (a.loan.extra || []).filter((z) => z.id !== ed.dataset.extradel);
      scheduleSync(); renderAssets();
    }
    return;
  }
});

/* Typed figures settle into the ledger's formatting when the field is left — otherwise the
   card shows "41500" directly under "€1,060,000" until some unrelated thing re-renders it. */
/* The date this thing counts from, committed once the reader has finished typing it.
 *
 * On `input` a keyboard entry walks the year through partial values — typing 2027 emits
 * 0002, 0020, 0202 — and every one of those is "not in the future", so they were accepted
 * and synced, and the refusal of the real value then restored the field to the year 202.
 * An empty date was accepted too, which is worse than a wrong one: with no date the asset is
 * counted in every snapshot ever recorded, a depreciating one stops depreciating, and the
 * next load's migration replaces the date with today — so the purchase date is gone with no
 * record of what it was. */
const DATE_FLOOR = "1900-01-01";
$("assetList").addEventListener("change", (e) => {
  const el = e.target;
  if (!el.dataset || el.dataset.f !== "date") return;
  const a = state.assets.find((x) => x.id === el.dataset.aid); if (!a) return;
  const iso = el.value;
  if (!iso) { toast(t("asset.dateNeeded")); el.value = a.date; return; }
  if (iso > todayISO()) { toast(t("asset.futureDate")); el.value = a.date; return; }
  if (iso < DATE_FLOOR) { toast(t("asset.dateTooEarly")); el.value = a.date; return; }
  a.date = iso;
  scheduleSync();
  renderAssets();
});

$("assetList").addEventListener("focusout", (e) => {
  const el = e.target;
  if (!el.classList || !el.classList.contains("num") || el.type !== "text") return;
  const plain = el.dataset.lf === "rate" || el.dataset.lf === "termYears" || el.dataset.f === "rate";
  const n = plain ? parseDec(el.value) : parseNum(el.value);
  el.value = n == null ? "" : (plain ? fmtPlain(n, 3) : fmtNum(n));
});

$("assetList").addEventListener("toggle", (e) => {
  if (e.target.classList && e.target.classList.contains("psched")) schedOpen = e.target.open;
}, true);   // <details> toggle does not bubble, so it is caught on the way down

$("assetBack").onclick = () => { scheduleSync(); closeAssetEditor(); };
$("assetDone").onclick = () => $("assetBack").click();
