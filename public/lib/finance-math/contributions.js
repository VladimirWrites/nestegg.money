// Recurring-contribution math: the shared monthly recurrence, its forward future value, and the
// inverse (the contribution needed to hit a target). Percents in.
import { round2 } from "../../js/domain/dates.js";
import { annuityFactorFV } from "./annuity.js";

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

// Inverse of futureValueOfContributions: the fixed monthly contribution needed to reach
// targetValue over `months` at annualRatePct, given an optional starting presentValue.
// Same ordinary-annuity convention as fvContributionsCore. Null if the horizon is non-positive.
export function requiredContribution(targetValue, annualRatePct, months, presentValue = 0) {
  const i = (+annualRatePct || 0) / 100 / 12, n = Math.max(0, Math.round(+months || 0));
  if (n <= 0) return { monthly: null };
  const g = Math.pow(1 + i, n);
  const factor = annuityFactorFV(i, n);
  const fromPV = (+presentValue || 0) * g;
  return { monthly: round2(((+targetValue || 0) - fromPV) / factor) };
}
