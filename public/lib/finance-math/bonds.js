// Fixed income: bond pricing from a yield, current yield, duration (Macaulay + modified),
// convexity, zero-coupon pricing, and accrued interest. Percents in; periodsPerYear defaults to
// 2 (semiannual coupons). Pure functions of their inputs.
import { round2 } from "../../js/domain/dates.js";

// Coupon cashflow each period and the per-period yield, shared by the pricing helpers below.
function bondFlows(faceValue, couponRatePct, years, yieldPct, periodsPerYear) {
  const F = +faceValue || 0, m = +periodsPerYear || 0, n = Math.round((+years || 0) * m);
  const c = F * (+couponRatePct || 0) / 100 / (m || 1);
  const y = (+yieldPct || 0) / 100 / (m || 1);
  return { F, m, n, c, y };
}

// Price of a coupon bond given a yield: PV of the coupons plus the face at maturity.
export function bondPrice(faceValue, couponRatePct, years, yieldPct, periodsPerYear = 2) {
  const { F, m, n, c, y } = bondFlows(faceValue, couponRatePct, years, yieldPct, periodsPerYear);
  if (m <= 0 || n <= 0) return { price: null };
  let pv = 0;
  for (let t = 1; t <= n; t++) pv += c / Math.pow(1 + y, t);
  pv += F / Math.pow(1 + y, n);
  return { price: round2(pv) };
}

// Current yield: the annual coupon as a percent of the current price.
export function currentYield(price, faceValue, couponRatePct) {
  const p = +price || 0;
  if (p <= 0) return { currentYieldPct: null };
  const annualCoupon = (+faceValue || 0) * (+couponRatePct || 0) / 100;
  return { currentYieldPct: annualCoupon / p * 100 };
}

// Macaulay duration (PV-weighted average time of the cashflows, in years) and modified duration
// (Macaulay / (1 + y per period)). Null for a degenerate bond.
export function bondDuration(faceValue, couponRatePct, years, yieldPct, periodsPerYear = 2) {
  const { F, m, n, c, y } = bondFlows(faceValue, couponRatePct, years, yieldPct, periodsPerYear);
  if (m <= 0 || n <= 0) return { macaulay: null, modified: null };
  let price = 0, weighted = 0;
  for (let t = 1; t <= n; t++) {
    const pv = (c + (t === n ? F : 0)) / Math.pow(1 + y, t);
    price += pv;
    weighted += t * pv;
  }
  if (price <= 0) return { macaulay: null, modified: null };
  const macaulay = weighted / price / m; // periods -> years
  return { macaulay, modified: macaulay / (1 + y) };
}

// Convexity (years^2): the curvature of price with respect to yield.
export function convexity(faceValue, couponRatePct, years, yieldPct, periodsPerYear = 2) {
  const { F, m, n, c, y } = bondFlows(faceValue, couponRatePct, years, yieldPct, periodsPerYear);
  if (m <= 0 || n <= 0) return { convexity: null };
  let price = 0, csum = 0;
  for (let t = 1; t <= n; t++) {
    const pv = (c + (t === n ? F : 0)) / Math.pow(1 + y, t);
    price += pv;
    csum += t * (t + 1) * pv;
  }
  if (price <= 0) return { convexity: null };
  return { convexity: csum / (price * Math.pow(1 + y, 2)) / (m * m) };
}

// Price of a zero-coupon bond: face discounted to today at the yield.
export function zeroCouponPrice(faceValue, years, yieldPct, compoundingPerYear = 1) {
  const m = +compoundingPerYear || 0;
  if (m <= 0) return { price: null };
  const n = (+years || 0) * m, y = (+yieldPct || 0) / 100 / m;
  return { price: round2((+faceValue || 0) / Math.pow(1 + y, n)) };
}

// Accrued interest since the last coupon: the annual coupon pro-rated by days elapsed.
export function accruedInterest(faceValue, couponRatePct, daysSinceLastCoupon, dayCountBasis = 360) {
  const annualCoupon = (+faceValue || 0) * (+couponRatePct || 0) / 100;
  const basis = +dayCountBasis || 360;
  return { accrued: round2(annualCoupon * (+daysSinceLastCoupon || 0) / basis) };
}
