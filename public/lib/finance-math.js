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

/* ---------- retirement / planning ---------- */

// FIRE target and (optionally) years to reach it. The target is the nest egg whose safe
// withdrawal covers annual spend: annualSpend / (withdrawalRate). yearsToFI solves the
// ordinary-annuity growth of currentNestEgg + annualContribution until it reaches target;
// null when the target is unreachable (no contribution and no growth, or growth that the
// inputs never bridge). All percents in; money via round2, target/gap rounded to cents.
export function fireNumber({ annualSpend, withdrawalRatePct = 4, currentNestEgg = 0, annualContribution = 0, annualRatePct = 0 } = {}) {
  const spend = +annualSpend || 0, wr = (+withdrawalRatePct || 0) / 100;
  const target = wr > 0 ? round2(spend / wr) : null;
  if (target === null) return { target: null, gap: null, yearsToFI: null };
  const P = +currentNestEgg || 0, C = +annualContribution || 0, r = (+annualRatePct || 0) / 100;
  const gap = round2(Math.max(0, target - P));
  let yearsToFI = null;
  if (gap <= 0) {
    yearsToFI = 0;
  } else if (r === 0) {
    if (C > 0) yearsToFI = round2((target - P) / C);
  } else {
    const k = C / r, num = target + k, den = P + k;
    if (num > 0 && den > 0) {
      const t = Math.log(num / den) / Math.log(1 + r);
      if (isFinite(t) && t >= 0) yearsToFI = round2(t);
    }
  }
  return { target, gap, yearsToFI };
}

// Inverse of futureValueOfContributions: the fixed monthly contribution needed to reach
// targetValue over `months` at annualRatePct, given an optional starting presentValue.
// Uses the same ordinary-annuity convention as fvContributionsCore. Returns null if the
// horizon is non-positive. Percents in; result rounded to cents.
export function requiredContribution(targetValue, annualRatePct, months, presentValue = 0) {
  const i = (+annualRatePct || 0) / 100 / 12, n = Math.max(0, Math.round(+months || 0));
  if (n <= 0) return { monthly: null };
  const g = Math.pow(1 + i, n);
  const factor = i === 0 ? n : (g - 1) / i;
  const fromPV = (+presentValue || 0) * g;
  return { monthly: round2(((+targetValue || 0) - fromPV) / factor) };
}

// Inflation: deflate a nominal amount to today's purchasing power, or (toNominal) inflate a
// real amount forward. value = amount / (1+infl)^years, or amount * (1+infl)^years. Raw value
// (unrounded) so round-trips are exact. Percent in.
export function inflationAdjust(amount, inflationRatePct, years, toNominal = false) {
  const f = Math.pow(1 + (+inflationRatePct || 0) / 100, +years || 0);
  const a = +amount || 0;
  return { value: toNominal ? a * f : (f === 0 ? 0 : a / f) };
}

// Convert between a nominal (stated) annual rate and the effective annual rate (APY) for a
// given compounding frequency. Forward: APY = ((1+nominal/m)^m - 1). Reverse (toNominal):
// recover the nominal rate from an APY. Percents in and out; raw (unrounded).
export function effectiveRate(ratePct, periodsPerYear, toNominal = false) {
  const m = +periodsPerYear || 0, x = (+ratePct || 0) / 100;
  if (m <= 0) return toNominal ? { nominalRatePct: null } : { effectiveRatePct: null };
  if (toNominal) return { nominalRatePct: m * (Math.pow(1 + x, 1 / m) - 1) * 100 };
  return { effectiveRatePct: (Math.pow(1 + x / m, m) - 1) * 100 };
}

/* ---------- discounted cash flow ---------- */

// Net present value of a cashflow series (index 0 = today; outflows negative) discounted at
// discountRatePct per period. Raw value. Percent in.
export function npv(cashflows, discountRatePct) {
  const r = (+discountRatePct || 0) / 100;
  const cf = Array.isArray(cashflows) ? cashflows : [];
  return { npv: cf.reduce((acc, c, t) => acc + (+c || 0) / Math.pow(1 + r, t), 0) };
}

// Internal rate of return: the per-period rate that zeroes the NPV of the series. Solved by
// bisection over (-99.99%, 1000%); returns null when the NPV does not change sign across that
// range (e.g. an all-positive stream) or the series is degenerate. Result in percent.
export function irr(cashflows) {
  const cf = Array.isArray(cashflows) ? cashflows : [];
  if (cf.length < 2) return { irrPct: null };
  const f = (r) => cf.reduce((acc, c, t) => acc + (+c || 0) / Math.pow(1 + r, t), 0);
  let lo = -0.9999, hi = 10, flo = f(lo), fhi = f(hi);
  if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return { irrPct: null };
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2, fmid = f(mid);
    if (fmid === 0) { lo = hi = mid; break; }
    if (flo * fmid < 0) { hi = mid; fhi = fmid; } else { lo = mid; flo = fmid; }
  }
  return { irrPct: ((lo + hi) / 2) * 100 };
}

/* ---------- everyday ratios ---------- */

// Refinance break-even: monthly saving (current - new payment), whole months to recoup the
// closing costs, and (if remainingMonths given) the net saving over the remaining term.
// breakevenMonths is null when the new payment does not save money. Money via round2.
export function refiBreakeven(closingCosts, currentPayment, newPayment, remainingMonths = null) {
  const monthlySaving = round2((+currentPayment || 0) - (+newPayment || 0));
  const cost = +closingCosts || 0;
  const breakevenMonths = monthlySaving > 0 ? Math.ceil(cost / monthlySaving) : null;
  const lifetimeSaving = remainingMonths == null ? null : round2(monthlySaving * (+remainingMonths || 0) - cost);
  return { monthlySaving, breakevenMonths, lifetimeSaving };
}

// Months of runway: liquid savings divided by monthly expenses. Null when expenses <= 0.
export function emergencyFund(liquidSavings, monthlyExpenses) {
  const exp = +monthlyExpenses || 0;
  if (exp <= 0) return { months: null };
  return { months: round2((+liquidSavings || 0) / exp) };
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
