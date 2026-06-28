// European options: Black-Scholes pricing, the greeks, put-call parity, break-even, and the
// intrinsic/time-value split. Inputs are spot, strike, time in years, volatility and rates in
// percent, optional continuous dividend yield. Pure functions of their inputs.

// Standard normal CDF via an erf approximation (Abramowitz & Stegun 7.1.26, ~1e-7 accurate).
function erf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
const Phi = (x) => 0.5 * (1 + erf(x / Math.SQRT2));            // N(x)
const phi = (x) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI); // N'(x)

// d1/d2 and the discount factors, shared by pricing and the greeks.
function bsTerms(spot, strike, years, volatilityPct, riskFreePct, dividendYieldPct) {
  const S = +spot || 0, K = +strike || 0, T = +years || 0;
  const v = (+volatilityPct || 0) / 100, r = (+riskFreePct || 0) / 100, q = (+dividendYieldPct || 0) / 100;
  if (!(S > 0 && K > 0 && T > 0 && v > 0)) return null;
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r - q + v * v / 2) * T) / (v * sqrtT);
  const d2 = d1 - v * sqrtT;
  return { S, K, T, v, r, q, sqrtT, d1, d2, eqt: Math.exp(-q * T), ert: Math.exp(-r * T) };
}

// Black-Scholes price of a European call (default) or put, plus d1/d2.
export function blackScholes(spot, strike, years, volatilityPct, riskFreePct, dividendYieldPct = 0, type = "call") {
  const t = bsTerms(spot, strike, years, volatilityPct, riskFreePct, dividendYieldPct);
  if (!t) return { price: null, d1: null, d2: null };
  const call = t.S * t.eqt * Phi(t.d1) - t.K * t.ert * Phi(t.d2);
  const put = t.K * t.ert * Phi(-t.d2) - t.S * t.eqt * Phi(-t.d1);
  return { price: type === "put" ? put : call, d1: t.d1, d2: t.d2 };
}

// The greeks. vega is per 1% change in volatility, theta per calendar day, rho per 1% in rates.
export function optionGreeks(spot, strike, years, volatilityPct, riskFreePct, dividendYieldPct = 0, type = "call") {
  const t = bsTerms(spot, strike, years, volatilityPct, riskFreePct, dividendYieldPct);
  if (!t) return { delta: null, gamma: null, vega: null, theta: null, rho: null };
  const isCall = type !== "put";
  const Nd1 = Phi(t.d1), pd1 = phi(t.d1);
  const delta = isCall ? t.eqt * Nd1 : t.eqt * (Nd1 - 1);
  const gamma = t.eqt * pd1 / (t.S * t.v * t.sqrtT);
  const vega = t.S * t.eqt * pd1 * t.sqrtT / 100;
  const theta = isCall
    ? (-(t.S * t.eqt * pd1 * t.v) / (2 * t.sqrtT) - t.r * t.K * t.ert * Phi(t.d2) + t.q * t.S * t.eqt * Nd1) / 365
    : (-(t.S * t.eqt * pd1 * t.v) / (2 * t.sqrtT) + t.r * t.K * t.ert * Phi(-t.d2) - t.q * t.S * t.eqt * Phi(-t.d1)) / 365;
  const rho = (isCall ? t.K * t.T * t.ert * Phi(t.d2) : -t.K * t.T * t.ert * Phi(-t.d2)) / 100;
  return { delta, gamma, vega, theta, rho };
}

// Put-call parity: given one option price, return both. C - P = S*e^{-qT} - K*e^{-rT}.
export function putCallParity({ call, put, spot, strike, years, riskFreePct, dividendYieldPct = 0 } = {}) {
  const S = +spot || 0, K = +strike || 0, T = +years || 0;
  const r = (+riskFreePct || 0) / 100, q = (+dividendYieldPct || 0) / 100;
  const fwd = S * Math.exp(-q * T) - K * Math.exp(-r * T); // = C - P
  if (call != null) return { call: +call, put: +call - fwd };
  if (put != null) return { call: +put + fwd, put: +put };
  return { call: null, put: null };
}

// Break-even underlying price at expiry: strike + premium for a call, strike - premium for a put.
export function optionBreakeven(strike, premium, type = "call") {
  const K = +strike || 0, p = +premium || 0;
  return { breakeven: type === "put" ? K - p : K + p };
}

// Split a premium into intrinsic value (in-the-money amount) and time value.
export function intrinsicTimeValue(spot, strike, premium, type = "call") {
  const S = +spot || 0, K = +strike || 0, p = +premium || 0;
  const intrinsic = type === "put" ? Math.max(0, K - S) : Math.max(0, S - K);
  return { intrinsic, timeValue: p - intrinsic };
}
