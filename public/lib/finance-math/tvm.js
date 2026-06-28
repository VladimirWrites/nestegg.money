// Time-value-of-money completions: annuity present/future value and payment, perpetuities, the
// rule of 72, simple and discounted payback, MIRR, and date-aware XNPV/XIRR. Rates are per-period
// percents unless the function says annual. Money via round2; rates raw.
import { round2 } from "../../js/domain/dates.js";

// Present value of an ordinary annuity (payment at period end). i = ratePct/100 per period.
export function annuityPV(payment, ratePct, periods) {
  const pmt = +payment || 0, i = (+ratePct || 0) / 100, n = Math.max(0, Math.round(+periods || 0));
  const factor = i === 0 ? n : (1 - Math.pow(1 + i, -n)) / i;
  return { pv: round2(pmt * factor) };
}

// Future value of an ordinary annuity.
export function annuityFV(payment, ratePct, periods) {
  const pmt = +payment || 0, i = (+ratePct || 0) / 100, n = Math.max(0, Math.round(+periods || 0));
  const factor = i === 0 ? n : (Math.pow(1 + i, n) - 1) / i;
  return { fv: round2(pmt * factor) };
}

// The level payment that amortizes a present value over n periods (the loan-payment formula).
export function annuityPayment(presentValue, ratePct, periods) {
  const pv = +presentValue || 0, i = (+ratePct || 0) / 100, n = Math.max(0, Math.round(+periods || 0));
  if (n <= 0) return { payment: null };
  const payment = i === 0 ? pv / n : pv * i / (1 - Math.pow(1 + i, -n));
  return { payment: round2(payment) };
}

// Present value of a (optionally growing) perpetuity: payment / (rate - growth). Null when growth
// is not below the rate. Percents in.
export function perpetuity(payment, ratePct, growthPct = 0) {
  const r = (+ratePct || 0) / 100, g = (+growthPct || 0) / 100;
  if (!(r > g)) return { pv: null };
  return { pv: (+payment || 0) / (r - g) };
}

// Years to double: the 72 estimate and the exact figure (ln2 / ln(1+rate)). Percent in.
export function ruleOf72(ratePct) {
  const r = +ratePct || 0;
  return { years72: r !== 0 ? 72 / r : null, exactYears: r > -100 && r !== 0 ? Math.log(2) / Math.log(1 + r / 100) : null };
}

// Simple payback period: periods until cumulative cashflows recover the initial cost, interpolated
// within the period that crosses. Null if never recovered.
export function paybackPeriod(initialCost, cashflows) {
  let remaining = +initialCost || 0;
  const cf = Array.isArray(cashflows) ? cashflows : [];
  for (let t = 0; t < cf.length; t++) {
    const flow = +cf[t] || 0;
    if (flow >= remaining) return { years: t + (flow > 0 ? remaining / flow : 0) };
    remaining -= flow;
  }
  return { years: null };
}

// Discounted payback: like paybackPeriod but each cashflow is discounted at ratePct per period.
export function discountedPayback(initialCost, cashflows, ratePct) {
  const r = (+ratePct || 0) / 100;
  let remaining = +initialCost || 0;
  const cf = Array.isArray(cashflows) ? cashflows : [];
  for (let t = 0; t < cf.length; t++) {
    const flow = (+cf[t] || 0) / Math.pow(1 + r, t + 1);
    if (flow >= remaining) return { years: t + (flow > 0 ? remaining / flow : 0) };
    remaining -= flow;
  }
  return { years: null };
}

// Modified internal rate of return: negatives financed at financeRatePct, positives reinvested at
// reinvestRatePct. Percents in and out.
export function mirr(cashflows, financeRatePct, reinvestRatePct) {
  const cf = (Array.isArray(cashflows) ? cashflows : []).map((x) => +x || 0);
  const n = cf.length - 1;
  if (n < 1) return { mirrPct: null };
  const fr = (+financeRatePct || 0) / 100, rr = (+reinvestRatePct || 0) / 100;
  let pvNeg = 0, fvPos = 0;
  for (let t = 0; t < cf.length; t++) {
    if (cf[t] < 0) pvNeg += cf[t] / Math.pow(1 + fr, t);
    else fvPos += cf[t] * Math.pow(1 + rr, n - t);
  }
  if (pvNeg === 0 || fvPos === 0) return { mirrPct: null };
  return { mirrPct: (Math.pow(fvPos / -pvNeg, 1 / n) - 1) * 100 };
}

// Days between two ISO dates (UTC).
const daysBetween = (a, b) => (Date.parse(b) - Date.parse(a)) / 86400000;

// Date-aware net present value: each amount discounted by its fractional years (act/365) from the
// first cashflow's date. Annual rate in percent.
export function xnpv(cashflows, annualRatePct) {
  const cf = Array.isArray(cashflows) ? cashflows : [];
  if (!cf.length) return { npv: 0 };
  const r = (+annualRatePct || 0) / 100, d0 = cf[0].date;
  return { npv: cf.reduce((acc, c) => acc + (+c.amount || 0) / Math.pow(1 + r, daysBetween(d0, c.date) / 365), 0) };
}

// Date-aware internal rate of return: the annual rate that zeroes the XNPV, by bisection. Null
// when the cashflows never cross zero.
export function xirr(cashflows) {
  const cf = Array.isArray(cashflows) ? cashflows : [];
  if (cf.length < 2) return { xirrPct: null };
  const d0 = cf[0].date;
  const f = (r) => cf.reduce((acc, c) => acc + (+c.amount || 0) / Math.pow(1 + r, daysBetween(d0, c.date) / 365), 0);
  let lo = -0.9999, hi = 10, flo = f(lo), fhi = f(hi);
  if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return { xirrPct: null };
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2, fmid = f(mid);
    if (fmid === 0) { lo = hi = mid; break; }
    if (flo * fmid < 0) { hi = mid; fhi = fmid; } else { lo = mid; flo = fmid; }
  }
  return { xirrPct: ((lo + hi) / 2) * 100 };
}
