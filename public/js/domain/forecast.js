// Forward net-worth projection. Long-term assets compound and loans amortise via their own
// engines; the "liquid" latest-year values grow at an assumed return with monthly contributions.
import { state } from "./store.js";
import { defForecast } from "./schema.js";
import { YEAR_MS, MONTH_MS } from "./dates.js";
import { convTo } from "./money.js";
import { buildSchedule, loanTerms, outstandingAt } from "./loan.js";
import { assetNetAt, assetOwnedFrom } from "./asset-value.js";
import { latestSnap, entryBase } from "./model.js";

// Lazily-initialised forecast config on the state.
export function fcCfg() {
  if (!state.forecast || typeof state.forecast !== "object") state.forecast = defForecast();
  return state.forecast;
}

// Net of all long-term assets/liabilities (base ccy) on an arbitrary date.
export function ltNetBaseAt(date) {
  return (state.assets || []).reduce((s, a) => {
    const from = assetOwnedFrom(a);
    if (from && from > date) return s;
    const nat = a.liability ? -(a.loan ? outstandingAt(a.loan, date) : 0) : assetNetAt(a, date);
    return s + convTo(nat, a.ccy || state.baseCcy, state.baseCcy);
  }, 0);
}

// The manually-entered ("liquid") portion of the latest snapshot, in base ccy.
export function manualNetBase() {
  const ls = latestSnap();
  if (!ls) return 0;
  return (ls.entries || []).reduce((s, e) => s + entryBase(e, ls.year), 0);
}

// When "reinvest after payoff" is on, each future loan payoff frees its monthly payment
// into the contribution stream from that month on: [{ month, amt(base) }].
export function redirectStreams() {
  const fc = fcCfg();
  if (!fc.redirectLoans) return [];
  const now = new Date();
  const out = [];
  (state.assets || []).forEach((a) => {
    if (!a.loan) return;
    const pays = buildSchedule(a.loan).filter((r) => r.type !== "extra");
    if (!pays.length) return;
    const payoff = pays[pays.length - 1].date;
    if (payoff <= now) return;
    const M = loanTerms(a.loan).M;
    if (!(M > 0) || !isFinite(M)) return;
    out.push({ month: Math.max(1, Math.round((payoff - now) / MONTH_MS)), amt: convTo(M, a.ccy || state.baseCcy, state.baseCcy) });
  });
  return out;
}

// Future value of the contribution stream to `date`: a monthly amount that ramps each year
// (raises), steps up as loans are paid off (if reinvest is on), grown at the monthly return.
// `gOverride` lets the scenario band re-run at low/high returns.
export function contribFV(date, gOverride) {
  const fc = fcCfg();
  const g = gOverride != null ? gOverride : +fc.growth || 0;
  const i = g / 12;
  const cg = +fc.contribGrowth || 0;
  const now = new Date();
  const months = Math.round((date - now) / MONTH_MS);
  if (months <= 0) return 0;
  const streams = redirectStreams();
  let fv = 0;
  let base = +fc.monthly || 0;
  let redirect = 0;
  for (let m = 0; m < months; m++) {
    if (m > 0 && m % 12 === 0) base *= 1 + cg;
    for (const s of streams) if (s.month === m) redirect += s.amt;
    fv = fv * (1 + i) + base + redirect;
  }
  return fv;
}

export function forecastNetAt(date, gOverride) {
  const fc = fcCfg();
  const g = gOverride != null ? gOverride : +fc.growth || 0;
  let t = (date - new Date()) / YEAR_MS;
  if (t < 0) t = 0;
  const grown = manualNetBase() * Math.pow(1 + g, t);
  return grown + contribFV(date, gOverride) + ltNetBaseAt(date);
}

// Scenario band returns: poor / expected / great (expected ∓ 3pp, floored at 0).
export function fcBandRates() {
  const g = +fcCfg().growth || 0;
  return { lo: Math.max(0, g - 0.03), mid: g, hi: g + 0.03 };
}

// Goal target: an explicit amount, or annual spending x 25 (the 4% rule).
export function fcTarget() {
  const fc = fcCfg();
  return fc.goalMode === "spend" ? (+fc.annualSpending || 0) * 25 : +fc.goalAmount || 0;
}

// Across every loan (asset-backed or standalone), the last payment date and remaining interest.
export function debtSummary() {
  const now = new Date();
  let payoff = null;
  let rem = 0;
  let has = false;
  (state.assets || []).forEach((a) => {
    if (!a.loan) return;
    const pays = buildSchedule(a.loan).filter((r) => r.type !== "extra");
    if (!pays.length) return;
    has = true;
    const last = pays[pays.length - 1].date;
    if (!payoff || last > payoff) payoff = last;
    pays.forEach((r) => { if (r.date > now) rem += convTo(r.interest || 0, a.ccy || state.baseCcy, state.baseCcy); });
  });
  return { has, payoff, rem };
}
