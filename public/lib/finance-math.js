// Single source of truth for nestegg's deterministic finance math.
//
// Every export here is a PURE function of its inputs: no app state, no network, no live
// prices, no FX lookups. Any currency conversion takes the rate as an explicit parameter.
// Money uses the app's existing rounding convention: round half-up to 2 decimals (round2,
// with a tiny +1e-9 nudge to counter float drift). These functions are imported both by the
// site and by the calculator endpoints / MCP tools, so a formula is defined exactly once.
//
// Returns numbers and schedules only, never advice.

import { round2, addMonths, parseDate, YEAR_MS, MONTH_MS } from "../js/domain/dates.js";
import { loanTerms, buildSchedule, outstandingAt } from "../js/domain/loan.js";
import { compoundOver, compoundedValue, assetGrossAt, assetNetAt } from "../js/domain/asset-value.js";

// Re-export the canonical primitives so callers have a single import surface.
export { round2, addMonths, parseDate, YEAR_MS, MONTH_MS };
export { loanTerms, buildSchedule, outstandingAt };
export { compoundOver, compoundedValue, assetGrossAt, assetNetAt };

/* ---------- growth / depreciation ---------- */

// Future value of a lump sum compounded annually. rate is a percent (7 = 7%/yr).
export function futureValue(principal, annualRatePct, years) {
  return (+principal || 0) * Math.pow(1 + (+annualRatePct || 0) / 100, +years || 0);
}

// Value after compounding up or down at annualRatePct for `years` (the app's asset method).
// up=false depreciates, up=true appreciates. rate is a percent.
export function depreciate(value, annualRatePct, years, up = false) {
  return compoundOver(value, (+annualRatePct || 0) / 100, +years || 0, up);
}

// Straight-line depreciation: value falls evenly from `value` to `salvage` over usefulYears.
export function straightLineDepreciation(value, salvage, usefulYears, yearsElapsed) {
  const v = +value || 0, s = +salvage || 0, u = +usefulYears || 0;
  if (!(u > 0)) return v;
  const t = Math.min(Math.max(+yearsElapsed || 0, 0), u);
  return Math.max(s, v - ((v - s) * t) / u);
}

// Compound annual growth rate between two values over `years`. Returns a decimal (0.07 = 7%),
// or null if inputs are out of range.
export function cagr(begin, end, years) {
  const b = +begin, e = +end, y = +years;
  if (!(b > 0) || !(e > 0) || !(y > 0)) return null;
  return Math.pow(e / b, 1 / y) - 1;
}

/* ---------- contributions ---------- */

// Core monthly-contribution recurrence (decimals): each month the balance compounds at
// `monthlyRate`, then the contribution (which steps up by `contribGrowth` every 12 months)
// plus any cumulative `extraAt(m)` is added. Shared with the site's forecast so the
// compounding is defined once. Returns the raw (unrounded) future value.
export function fvContributionsCore(monthly, monthlyRate, months, contribGrowth = 0, extraAt = null) {
  const i = +monthlyRate || 0, cg = +contribGrowth || 0, n = Math.max(0, Math.round(+months || 0));
  let fv = 0, base = +monthly || 0, redirect = 0;
  for (let m = 0; m < n; m++) {
    if (m > 0 && m % 12 === 0) base *= 1 + cg;
    if (extraAt) redirect += extraAt(m) || 0;
    fv = fv * (1 + i) + base + redirect;
  }
  return fv;
}

// Future value of a fixed monthly contribution over `months`, compounding at annualRatePct,
// with the contribution optionally stepping up contribGrowthPct each year. Percents in.
export function futureValueOfContributions(monthly, annualRatePct, months, contribGrowthPct = 0) {
  return fvContributionsCore(monthly, (+annualRatePct || 0) / 100 / 12, months, (+contribGrowthPct || 0) / 100, null);
}

/* ---------- savings rate ---------- */

// Fraction of income saved (savings / income). Returns a decimal, or null if income <= 0.
export function savingsRate(income, savings) {
  const inc = +income || 0;
  if (inc <= 0) return null;
  return (+savings || 0) / inc;
}

/* ---------- FX (rate supplied by the caller; pure arithmetic) ---------- */

// Convert an amount by an explicit rate (units of target per unit of source). No lookups.
export function fxConvert(amount, rate) {
  return (+amount || 0) * (+rate || 0);
}

/* ---------- loan summaries (compositions over the existing schedule engine) ---------- */

// Amortization schedule + summary for a loan object:
// { amount, rate (annual %), mode: "term"|"payment", termYears|payment, startDate,
//   extra: [{date, amount}], fixedUntil? }.
export function amortization(loan) {
  const { M, n } = loanTerms(loan);
  const schedule = buildSchedule(loan);
  const pays = schedule.filter((r) => r.type === "payment");
  const extras = schedule.filter((r) => r.type === "extra");
  const totalInterest = round2(pays.reduce((a, r) => a + (r.interest || 0), 0));
  const totalPaid = round2(pays.reduce((a, r) => a + (r.payment || 0), 0) + extras.reduce((a, r) => a + (r.extra || 0), 0));
  const last = schedule[schedule.length - 1];
  return {
    monthlyPayment: round2(M),
    scheduledMonths: isFinite(n) ? n : null,
    payments: pays.length,
    totalInterest,
    totalPaid,
    payoffDate: last ? last.date : null,
    schedule,
  };
}

// Effect of an extra fixed monthly payment: months and interest saved vs the baseline.
export function loanPayoff(loan, extraMonthly) {
  const base = amortization(loan);
  const { M } = loanTerms(loan);
  const accel = amortization({ ...loan, mode: "payment", payment: round2((+M || 0) + (+extraMonthly || 0)) });
  return {
    baseline: { months: base.payments, totalInterest: base.totalInterest, payoffDate: base.payoffDate },
    accelerated: { months: accel.payments, totalInterest: accel.totalInterest, payoffDate: accel.payoffDate },
    monthsSaved: base.payments - accel.payments,
    interestSaved: round2(base.totalInterest - accel.totalInterest),
  };
}
