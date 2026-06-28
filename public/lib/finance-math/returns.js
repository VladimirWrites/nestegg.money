// Returns & risk: ROI, real return, return-series statistics, Sharpe, drawdown, holding-period
// return, fee drag, and dollar-cost averaging. Percents in; money via round2, ratios raw.
import { round2 } from "../../js/domain/dates.js";

// Return on investment: total percent gain, plus the annualized rate when a holding period is
// given. Percents out; raw.
export function roi(initial, finalValue, years) {
  const i = +initial || 0, f = +finalValue || 0;
  const roiPct = i !== 0 ? (f - i) / i * 100 : null;
  const y = +years || 0;
  const annualizedPct = (years != null && y > 0 && i > 0 && f > 0) ? (Math.pow(f / i, 1 / y) - 1) * 100 : null;
  return { roiPct, annualizedPct };
}

// Real (inflation-adjusted) return from a nominal rate, the Fisher relation:
// (1+nominal)/(1+inflation) - 1. Percents in and out; raw.
export function realReturn(nominalRatePct, inflationRatePct) {
  const n = (+nominalRatePct || 0) / 100, i = (+inflationRatePct || 0) / 100;
  return { realPct: ((1 + n) / (1 + i) - 1) * 100 };
}

// Mean, sample variance, and sample standard deviation (n-1) of a series of returns. stdev is
// null for fewer than two points. Same unit in and out (pass percents to get a percent stdev).
export function returnStats(returns) {
  const xs = (Array.isArray(returns) ? returns : []).map((x) => +x || 0);
  const n = xs.length;
  if (n === 0) return { count: 0, mean: null, variance: null, stdev: null };
  const mean = xs.reduce((a, x) => a + x, 0) / n;
  if (n < 2) return { count: n, mean, variance: null, stdev: null };
  const variance = xs.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1);
  return { count: n, mean, variance, stdev: Math.sqrt(variance) };
}

// Sharpe ratio: excess mean return per unit of volatility, (mean - riskFree) / stdev. Returns
// null when volatility is undefined (fewer than two returns) or zero. Percents in.
export function sharpeRatio(returns, riskFreePct = 0) {
  const s = returnStats(returns);
  if (s.stdev == null || s.stdev === 0) return { sharpe: null, meanPct: s.mean, stdevPct: s.stdev };
  return { sharpe: (s.mean - (+riskFreePct || 0)) / s.stdev, meanPct: s.mean, stdevPct: s.stdev };
}

// Maximum drawdown of a value series: the largest peak-to-trough decline, as a positive percent.
export function maxDrawdown(series) {
  const xs = (Array.isArray(series) ? series : []).map((x) => +x || 0);
  let peak = -Infinity, worst = 0;
  for (const x of xs) {
    if (x > peak) peak = x;
    if (peak > 0) { const dd = (x - peak) / peak; if (dd < worst) worst = dd; }
  }
  return { maxDrawdownPct: -worst * 100 };
}

// Holding-period return: (income + capital gain) / starting value. Percents out; raw.
export function holdingPeriodReturn(income, endValue, beginValue) {
  const b = +beginValue || 0;
  if (b === 0) return { hprPct: null };
  return { hprPct: ((+income || 0) + ((+endValue || 0) - b)) / b * 100 };
}

// Fee drag: the compounded balance at a gross rate vs net of an annual fee, and the difference.
// net compounds at (gross - fee). Percents in; money via round2.
export function feeDrag(principal, grossAnnualPct, feePct, years) {
  const p = +principal || 0, g = (+grossAnnualPct || 0) / 100, fee = (+feePct || 0) / 100, y = +years || 0;
  const gross = p * Math.pow(1 + g, y);
  const net = p * Math.pow(1 + g - fee, y);
  return { gross: round2(gross), net: round2(net), lostToFees: round2(gross - net) };
}

// Dollar-cost averaging: buying a fixed amount each period at the given prices. Returns the units
// accumulated, total invested, the average cost per unit, and the final value at the last price.
export function dollarCostAveraging(prices, periodicInvestment) {
  const ps = (Array.isArray(prices) ? prices : []).map((x) => +x || 0).filter((x) => x > 0);
  const amt = +periodicInvestment || 0;
  if (!ps.length || amt <= 0) return { units: 0, invested: 0, avgCost: null, finalValue: 0 };
  const units = ps.reduce((a, p) => a + amt / p, 0);
  const invested = amt * ps.length;
  return { units, invested, avgCost: invested / units, finalValue: units * ps[ps.length - 1] };
}
