// Long-term asset editor: one asset with optional toggles (depreciates and/or carries a loan).
// Net contribution = (depreciated price or market value) − outstanding loan.
import { $, toast } from "./dom.js";
import { state } from "../domain/store.js";
import { nid } from "../domain/ids.js";
import { CCYS } from "../domain/constants.js";
import { money, moneyIn, esc, convTo } from "../domain/money.js";
import { fmtMY, fmtMonths, parseDate } from "../domain/dates.js";
import { buildSchedule, loanTerms, outstandingAt } from "../domain/loan.js";
import { assetGrossAt, assetNetAt } from "../domain/asset-value.js";
import { normLoan } from "../domain/schema.js";
import { renderAll } from "./charts.js";
import { renderEntries } from "./networth.js";
import { scheduleSync } from "../io/storage.js";

const ymdDay = (d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); // day-precision sibling of fmtMY
const todayISO = () => new Date().toISOString().slice(0, 10);

let curAssetId = null; // the single long-term asset the editor is focused on

export function openAssetEditor(id, focusName) {
  curAssetId = id;
  $("assetEditor").classList.remove("hide");
  window.scrollTo(0, 0);
  renderAssets(focusName);
}
function closeAssetEditor() {
  $("assetEditor").classList.add("hide");
  if (!$("yearEditor").classList.contains("hide")) renderEntries();
  else renderAll();
}

// The global category list (plus any group still in use, defensively).
export function groupNames() {
  const s = new Set(state.categories || []);
  state.snapshots.forEach((sn) => (sn.entries || []).forEach((e) => { if (e.group) s.add(e.group); }));
  (state.assets || []).forEach((a) => { if (a.group) s.add(a.group); });
  return [...s];
}

// The computed (read-only) outputs for a loan — refreshed in place as inputs change,
// so the editable fields (and the caret) are never destroyed by a re-render.
function loanComputedHTML(a) {
  const L = a.loan, byPayment = L.mode === "payment", sched = buildSchedule(L), { M, n } = loanTerms(L);
  const bal = outstandingAt(L, new Date());
  const tooLow = byPayment && +L.payment > 0 && !isFinite(n);
  const payRows = sched.filter((r) => r.type !== "extra");
  const payoff = payRows.length ? payRows[payRows.length - 1].date : null, totInt = sched.reduce((s, r) => s + (r.interest || 0), 0);
  const fixedUntil = L.fixedUntil ? parseDate(L.fixedUntil) : null;
  const balAtChange = fixedUntil ? outstandingAt(L, fixedUntil) : null; // amount left when the rate resets
  const calcStat = byPayment
    ? `<div class="pstat"><span class="k">Term (calculated)</span><span class="v num">${fmtMonths(n)}</span></div>`
    : `<div class="pstat"><span class="k">Monthly payment</span><span class="v num">${M ? moneyIn(M, a.ccy) : "—"}</span></div>`;
  let divDone = false;
  const rows = sched.map((r) => {
    let pre = "";
    if (!divDone && r.estimated) { divDone = true; pre = `<tr class="fxdiv"><td colspan="6">Fixed rate ends ${fmtMY(fixedUntil)} · ${moneyIn(balAtChange, a.ccy)} left · estimated at ${L.rate}% beyond</td></tr>`; }
    const cls = r.estimated ? " est" : "";
    return pre + (r.type === "extra"
      ? `<tr class="exline${cls}"><td>${ymdDay(r.date)}</td><td colspan="3">Additional payment</td><td class="num">${moneyIn(r.extra, a.ccy)}</td><td class="num">${moneyIn(r.balance, a.ccy)}</td></tr>`
      : `<tr class="${cls.trim()}"><td>${fmtMY(r.date)}</td><td class="num">${moneyIn(r.payment, a.ccy)}</td><td class="num">${moneyIn(r.interest, a.ccy)}</td><td class="num">${moneyIn(r.principal, a.ccy)}</td><td class="num">—</td><td class="num">${moneyIn(r.balance, a.ccy)}</td></tr>`);
  }).join("");
  return `${tooLow ? `<div class="loanwarn">That payment is below the monthly interest, so the loan never amortizes — raise it above ${moneyIn((+L.amount || 0) * (+L.rate || 0) / 100 / 12, a.ccy)}.</div>` : ""}
    <div class="pstats">
      ${calcStat}
      <div class="pstat"><span class="k">Balance today</span><span class="v num">${moneyIn(bal, a.ccy)}</span></div>
      ${balAtChange != null ? `<div class="pstat"><span class="k">Left at rate change</span><span class="v num hilite">${moneyIn(balAtChange, a.ccy)}</span></div>` : ""}
      <div class="pstat"><span class="k">Payoff</span><span class="v num">${payoff ? fmtMY(payoff) : "—"}</span></div>
      <div class="pstat"><span class="k">Total interest</span><span class="v num">${moneyIn(totInt, a.ccy)}</span></div>
    </div>
    ${payRows.length ? `<details class="psched"><summary>Payment schedule · ${payRows.length} payments</summary>
      <div class="schscroll"><table class="schtab"><thead><tr><th>When</th><th>Payment</th><th>Interest</th><th>Principal</th><th>Extra</th><th>Balance</th></tr></thead><tbody>${rows}</tbody></table></div></details>` : ""}`;
}

function assetCardHTML(a) {
  const today = new Date();
  const gross = assetGrossAt(a, today), bal = a.loan ? outstandingAt(a.loan, today) : 0, net = gross - bal;
  const inBase = (v) => (a.ccy !== state.baseCcy ? " · " + money(convTo(v, a.ccy, state.baseCcy)) : "");
  let depBlock = "", loanBlock = "";
  if (a.depreciates) {
    depBlock = `<div class="frow">
      <label class="fld">Acquired<input class="fin" type="date" value="${esc(a.date)}" data-aid="${a.id}" data-f="date"></label>
      <label class="fld">Direction<select data-aid="${a.id}" data-f="up"><option value="down" ${a.up ? "" : "selected"}>Depreciates ↓</option><option value="up" ${a.up ? "selected" : ""}>Appreciates ↑</option></select></label>
      <label class="fld">Change / yr<span class="suffix"><input class="fin num" type="number" step="any" inputmode="decimal" value="${+(a.rate * 100).toFixed(2)}" data-aid="${a.id}" data-f="rate"><i>%</i></span></label>
    </div>`;
  }
  if (a.loan) {
    const L = a.loan, byPayment = L.mode === "payment";
    const termField = byPayment
      ? `<label class="fld">Monthly payment<input class="fin num" type="number" step="any" inputmode="decimal" value="${L.payment}" data-aid="${a.id}" data-lf="payment"></label>`
      : `<label class="fld">Term<span class="suffix"><input class="fin num" type="number" step="any" inputmode="numeric" value="${L.termYears}" data-aid="${a.id}" data-lf="termYears"><i>yr</i></span></label>`;
    const extras = (L.extra || []).map((x) => `<div class="exrow">
        <input type="date" class="fin" value="${esc(x.date)}" data-aid="${a.id}" data-eid="${x.id}" data-ef="date">
        <span class="suffix"><input class="fin num" type="number" step="any" inputmode="decimal" value="${x.amount}" data-aid="${a.id}" data-eid="${x.id}" data-ef="amount" placeholder="amount"></span>
        <button class="rdel" data-extradel="${x.id}" data-aid="${a.id}" title="Remove payment">×</button></div>`).join("");
    loanBlock = `<div class="loanbox">
      <div class="frow">
        <label class="fld">Loan amount<input class="fin num" type="number" step="any" inputmode="decimal" value="${L.amount}" data-aid="${a.id}" data-lf="amount"></label>
        <label class="fld">Interest / yr<span class="suffix"><input class="fin num" type="number" step="any" inputmode="decimal" value="${L.rate}" data-aid="${a.id}" data-lf="rate"><i>%</i></span></label>
        <label class="fld">Set by<select data-aid="${a.id}" data-lf="mode"><option value="term" ${byPayment ? "" : "selected"}>Term</option><option value="payment" ${byPayment ? "selected" : ""}>Monthly payment</option></select></label>
        ${termField}
        <label class="fld">Start<input class="fin" type="date" value="${esc(L.startDate)}" data-aid="${a.id}" data-lf="startDate"></label>
        <label class="fld">Rate fixed until<input class="fin" type="date" value="${esc(L.fixedUntil || "")}" data-aid="${a.id}" data-lf="fixedUntil"></label>
      </div>
      <div class="exwrap"><div class="psub">Extra payments<button class="act ghost mini" data-extraadd="${a.id}">+ add</button></div>${extras || '<div class="exhint">None — add one-off lump sums to pay down principal faster.</div>'}</div>
      <div class="lcomp">${loanComputedHTML(a)}</div>
    </div>`;
  }
  const ccySel = `<select data-aid="${a.id}" data-f="ccy">${CCYS.map((x) => `<option ${x === a.ccy ? "selected" : ""}>${x}</option>`).join("")}</select>`;
  const catSel = `<select data-aid="${a.id}" data-f="group"><option value="" ${!a.group ? "selected" : ""}>— none —</option>${groupNames().map((g) => `<option ${g === a.group ? "selected" : ""}>${esc(g)}</option>`).join("")}</select>`;
  if (a.liability) {
    return `<div class="rcard acard liabcard" id="acard-${a.id}" data-aid="${a.id}">
      <div class="pchead"><input class="rname" value="${esc(a.name)}" data-aid="${a.id}" data-f="name" placeholder="Liability name">
        <button class="rdel" data-adel="${a.id}" title="Remove">×</button></div>
      <div class="frow"><label class="fld">Currency${ccySel}</label><label class="fld">Category${catSel}</label></div>
      ${loanBlock}
      <div class="vsum"><span class="k">Owed today</span><span class="vval num liab">${bal > 0.005 ? "− " + moneyIn(bal, a.ccy) : moneyIn(0, a.ccy)}${inBase(-bal)}</span></div>
    </div>`;
  }
  return `<div class="rcard acard" id="acard-${a.id}" data-aid="${a.id}">
    <div class="pchead"><input class="rname" value="${esc(a.name)}" data-aid="${a.id}" data-f="name" placeholder="Asset name">
      <button class="rdel" data-adel="${a.id}" title="Remove asset">×</button></div>
    <div class="frow">
      <label class="fld">${a.depreciates ? "Starting value" : "Value"}<input class="fin num" type="number" step="any" inputmode="decimal" value="${a.value}" data-aid="${a.id}" data-f="value"></label>
      <label class="fld">Currency${ccySel}</label>
      <label class="fld">Category${catSel}</label>
    </div>
    <div class="toggles">
      <label class="tgl"><input type="checkbox" data-aid="${a.id}" data-toggle="depreciates" ${a.depreciates ? "checked" : ""}><span>Value changes over time</span></label>
      <label class="tgl"><input type="checkbox" data-aid="${a.id}" data-toggle="loan" ${a.loan ? "checked" : ""}><span>Has a loan</span></label>
    </div>
    ${depBlock}${loanBlock}
    <div class="vsum"><span class="k">Net value today</span><span class="vval num">${moneyIn(net, a.ccy)}${inBase(net)}</span></div>
  </div>`;
}

function renderAssets(focusName) {
  const wrap = $("assetList");
  const a = state.assets.find((x) => x.id === curAssetId);
  if (!a) { closeAssetEditor(); return; }
  wrap.innerHTML = assetCardHTML(a);
  if (focusName) { const nm = wrap.querySelector(".rname"); if (nm) { nm.focus(); nm.select && nm.select(); } }
}

export function newAsset() {
  const a = { id: nid(), name: "New asset", ccy: state.baseCcy, value: 0, depreciates: false, up: false, date: todayISO(), rate: 0.15, loan: null };
  state.assets.push(a); scheduleSync(); return a;
}
export function newLiability() {
  const t = todayISO();
  const a = { id: nid(), name: "New liability", ccy: state.baseCcy, value: 0, depreciates: false, up: false, liability: true, date: t, rate: 0.15, loan: normLoan({ startDate: t }, t) };
  state.assets.push(a); scheduleSync(); return a;
}

$("assetList").addEventListener("input", (e) => {
  const t = e.target, id = t.dataset.aid; if (!id) return; const a = state.assets.find((x) => x.id === id); if (!a) return;
  if (t.dataset.eid) { const x = ((a.loan && a.loan.extra) || []).find((z) => z.id === t.dataset.eid); if (x) { if (t.dataset.ef === "amount") x.amount = parseFloat(t.value || 0); else x.date = t.value; } }
  else if (t.dataset.lf) { const f = t.dataset.lf; if (a.loan) a.loan[f] = f === "startDate" || f === "mode" || f === "fixedUntil" ? t.value : parseFloat(t.value || 0); }
  else if (t.dataset.f) {
    const f = t.dataset.f;
    if (f === "value") a.value = parseFloat(t.value || 0);
    else if (f === "rate") a.rate = Math.min(Math.max(parseFloat(t.value || 0) / 100, 0), 5);
    else if (f === "up") a.up = t.value === "up";
    else if (f === "group") a.group = t.value || undefined;
    else a[f] = t.value;
  }
  scheduleSync();
  // Refresh only the computed outputs in place — never the inputs — so the caret survives.
  const card = t.closest(".acard"); if (!card) return;
  const vv = card.querySelector(".vval");
  if (vv) {
    if (a.liability) { const bal = a.loan ? outstandingAt(a.loan, new Date()) : 0; vv.textContent = (bal > 0.005 ? "− " + moneyIn(bal, a.ccy) : moneyIn(0, a.ccy)) + (a.ccy !== state.baseCcy ? " · " + money(convTo(-bal, a.ccy, state.baseCcy)) : ""); }
    else { const net = assetNetAt(a, new Date()); vv.textContent = moneyIn(net, a.ccy) + (a.ccy !== state.baseCcy ? " · " + money(convTo(net, a.ccy, state.baseCcy)) : ""); }
  }
  const lc = card.querySelector(".lcomp");
  if (lc && a.loan) lc.innerHTML = loanComputedHTML(a);
});

$("assetList").addEventListener("change", (e) => {
  const t = e.target, id = t.dataset.aid; if (!id) return; const a = state.assets.find((x) => x.id === id); if (!a) return;
  if (t.dataset.toggle) {
    if (t.dataset.toggle === "depreciates") a.depreciates = t.checked;
    else a.loan = t.checked ? normLoan(a.loan || { startDate: a.date }, a.date) : null;
    scheduleSync(); renderAssets(); return;
  }
  // Only the Term/Payment mode swap changes structure — rebuild for that; everything else
  // (amount, rate, dates, currency, extras) is updated live by the input handler.
  if (t.dataset.lf === "mode") { renderAssets(); return; }
});

$("assetList").addEventListener("click", (e) => {
  const ad = e.target.closest("[data-adel]"); if (ad) { const a = state.assets.find((x) => x.id === ad.dataset.adel); if (confirm("Remove " + (a ? a.name : "this asset") + "?")) { state.assets = state.assets.filter((x) => x.id !== ad.dataset.adel); scheduleSync(); closeAssetEditor(); } return; }
  const ea = e.target.closest("[data-extraadd]"); if (ea) { const a = state.assets.find((x) => x.id === ea.dataset.extraadd); if (a && a.loan) { a.loan.extra = a.loan.extra || []; a.loan.extra.push({ id: nid(), date: a.loan.startDate, amount: 0 }); scheduleSync(); renderAssets(); } return; }
  const ed = e.target.closest("[data-extradel]"); if (ed) { const a = state.assets.find((x) => x.id === ed.dataset.aid); if (a && a.loan) { a.loan.extra = (a.loan.extra || []).filter((z) => z.id !== ed.dataset.extradel); scheduleSync(); renderAssets(); } return; }
});

$("assetBack").onclick = () => { scheduleSync(); closeAssetEditor(); };
