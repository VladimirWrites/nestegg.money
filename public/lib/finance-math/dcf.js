// Discounted cash flow: NPV, IRR, the rate needed to reach a goal, and bond yield to maturity.
// The root-finders use bisection over (-99.99%, 1000%) via the shared bisectRate helper. Percents in.
import { cagr } from "./growth.js";
import { bisectRate } from "./roots.js";

// Net present value of a cashflow series (index 0 = today; outflows negative) discounted at
// discountRatePct per period. Raw value. Percent in.
export function npv(cashflows, discountRatePct) {
  const r = (+discountRatePct || 0) / 100;
  const cf = Array.isArray(cashflows) ? cashflows : [];
  return { npv: cf.reduce((acc, c, t) => acc + (+c || 0) / Math.pow(1 + r, t), 0) };
}

// Internal rate of return: the per-period rate that zeroes the NPV of the series. Returns null
// when the NPV does not change sign across the search range (e.g. an all-positive stream).
export function irr(cashflows) {
  const cf = Array.isArray(cashflows) ? cashflows : [];
  if (cf.length < 2) return { irrPct: null };
  const r = bisectRate((rr) => cf.reduce((acc, c, t) => acc + (+c || 0) / Math.pow(1 + rr, t), 0));
  return { irrPct: r == null ? null : r * 100 };
}

// Annual return needed to grow `begin` to `end` over `years`, optionally with a fixed annual
// contribution. With no contribution this is exactly CAGR; with one it is solved by bisection.
// Returns the rate in percent, or null when no rate bridges the two.
export function requiredReturn(begin, end, years, annualContribution = 0) {
  const P = +begin || 0, T = +end || 0, y = +years || 0, C = +annualContribution || 0;
  if (!(y > 0)) return { ratePct: null };
  if (C === 0) {
    const g = cagr(P, T, y);
    return { ratePct: g == null ? null : g * 100 };
  }
  const r = bisectRate((rr) => {
    const g = Math.pow(1 + rr, y);
    const annuity = rr === 0 ? C * y : C * (g - 1) / rr;
    return P * g + annuity - T;
  });
  return { ratePct: r == null ? null : r * 100 };
}

// Bond yield to maturity: the nominal annual yield (per-period rate times periodsPerYear) that
// prices the bond at `price`. Coupons are faceValue*couponRatePct/periodsPerYear each period,
// face is returned at maturity. Solved by bisection. Null when no yield prices it. Percents.
export function yieldToMaturity(price, faceValue, couponRatePct, years, periodsPerYear = 2) {
  const F = +faceValue || 0, m = +periodsPerYear || 0, n = Math.round((+years || 0) * m), pr = +price || 0;
  if (m <= 0 || n <= 0) return { yieldPct: null };
  const coupon = F * (+couponRatePct || 0) / 100 / m;
  const r = bisectRate((rp) => {
    let v = -pr;
    for (let t = 1; t <= n; t++) v += coupon / Math.pow(1 + rp, t);
    v += F / Math.pow(1 + rp, n);
    return v;
  });
  return { yieldPct: r == null ? null : r * m * 100 };
}
