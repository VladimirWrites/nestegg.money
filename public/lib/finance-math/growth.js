// Growth, discounting, and depreciation — single lump sums and rate conversions.
// Pure functions of their inputs; percents in unless noted; raw (unrounded) values out.
import { compoundOver } from "../../js/domain/asset-value.js";
import { annuityFactorFV } from "./annuity.js";

// Future value of a lump sum compounded annually. rate is a percent (7 = 7%/yr).
export function futureValue(principal, annualRatePct, years) {
  return (+principal || 0) * Math.pow(1 + (+annualRatePct || 0) / 100, +years || 0);
}

// Present value of a single future amount discounted annually. The inverse of futureValue.
export function presentValue(futureAmount, annualRatePct, years) {
  const r = (+annualRatePct || 0) / 100;
  return { pv: (+futureAmount || 0) / Math.pow(1 + r, +years || 0) };
}

// Compound growth at an arbitrary frequency, with an optional contribution each period (paid at
// period end). Generalizes futureValue (periodsPerYear=1) and futureValueOfContributions
// (periodsPerYear=12). Raw value. Percent in.
export function compoundInterest(principal, annualRatePct, years, periodsPerYear = 1, contributionPerPeriod = 0) {
  const m = +periodsPerYear || 0, n = Math.round((+years || 0) * m), i = m > 0 ? (+annualRatePct || 0) / 100 / m : 0;
  const P = +principal || 0, C = +contributionPerPeriod || 0;
  const g = Math.pow(1 + i, n);
  const annuity = C * annuityFactorFV(i, n);
  return { value: P * g + annuity };
}

// Compound annual growth rate between two values over `years`. Returns a decimal (0.07 = 7%),
// or null if inputs are out of range.
export function cagr(begin, end, years) {
  const b = +begin, e = +end, y = +years;
  if (!(b > 0) || !(e > 0) || !(y > 0)) return null;
  return Math.pow(e / b, 1 / y) - 1;
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

// Inflation: deflate a nominal amount to today's purchasing power, or (toNominal) inflate a
// real amount forward. Raw value so round-trips are exact. Percent in.
export function inflationAdjust(amount, inflationRatePct, years, toNominal = false) {
  const f = Math.pow(1 + (+inflationRatePct || 0) / 100, +years || 0);
  const a = +amount || 0;
  return { value: toNominal ? a * f : (f === 0 ? 0 : a / f) };
}

// Convert between a nominal annual rate and the effective annual rate (APY) for a compounding
// frequency. Forward: APY = ((1+nominal/m)^m - 1). Reverse (toNominal): recover the nominal rate.
export function effectiveRate(ratePct, periodsPerYear, toNominal = false) {
  const m = +periodsPerYear || 0, x = (+ratePct || 0) / 100;
  if (m <= 0) return toNominal ? { nominalRatePct: null } : { effectiveRatePct: null };
  if (toNominal) return { nominalRatePct: m * (Math.pow(1 + x, 1 / m) - 1) * 100 };
  return { effectiveRatePct: (Math.pow(1 + x / m, m) - 1) * 100 };
}
