import { test } from "node:test";
import assert from "node:assert/strict";
import { setState } from "../public/js/domain/store.js";
import { fcCfg, fcTarget, fcBandRates, contribFV, forecastNetAt, manualNetBase, debtSummary } from "../public/js/domain/forecast.js";

const cy = new Date().getFullYear();
const future = (yrs) => new Date(cy + yrs, 11, 31);

function withForecast(overrides = {}, extra = {}) {
  setState({
    baseCcy: "EUR",
    fxRates: { EUR: 1 },
    fxHist: {},
    prices: {},
    assets: extra.assets || [],
    snapshots: [{ year: cy, entries: [{ id: "c", name: "Cash", kind: "fixed", ccy: "EUR", value: 10000 }] }],
    forecast: { enabled: true, monthly: 1000, growth: 0.05, goalMode: "amount", goalAmount: 100000, annualSpending: 40000, contribGrowth: 0, redirectLoans: false, band: false, horizonYear: 0, ...overrides },
  });
}

test("fcCfg returns the live config object", () => {
  withForecast();
  assert.equal(fcCfg().monthly, 1000);
});

test("fcTarget: explicit amount, or annual spending x25", () => {
  withForecast({ goalMode: "amount", goalAmount: 250000 });
  assert.equal(fcTarget(), 250000);
  withForecast({ goalMode: "spend", annualSpending: 40000 });
  assert.equal(fcTarget(), 1000000);
});

test("fcBandRates spreads ±3pp around growth, floored at 0", () => {
  withForecast({ growth: 0.05 });
  const r = fcBandRates();
  assert.ok(Math.abs(r.lo - 0.02) < 1e-9 && Math.abs(r.mid - 0.05) < 1e-9 && Math.abs(r.hi - 0.08) < 1e-9);
  withForecast({ growth: 0.01 });
  assert.equal(fcBandRates().lo, 0); // floored
});

test("contribFV is zero for the past/now and grows with the horizon", () => {
  withForecast();
  assert.equal(contribFV(future(-1)), 0);
  const a = contribFV(future(5));
  const b = contribFV(future(10));
  assert.ok(a > 0 && b > a);
});

test("forecastNetAt today ≈ manual net; rises with positive growth + contributions", () => {
  withForecast();
  assert.ok(Math.abs(forecastNetAt(new Date()) - manualNetBase()) < 1);
  assert.ok(forecastNetAt(future(10)) > forecastNetAt(new Date()));
});

test("debtSummary reports payoff + remaining interest when a loan exists", () => {
  withForecast({}, { assets: [{ id: "h", name: "House", ccy: "EUR", value: 300000, depreciates: false, loan: { amount: 200000, rate: 3, termYears: 30, startDate: `${cy - 1}-01-01`, mode: "term", extra: [], fixedUntil: null } }] });
  const d = debtSummary();
  assert.equal(d.has, true);
  assert.ok(d.payoff instanceof Date);
  assert.ok(d.rem > 0);
});

test("debtSummary is empty with no loans", () => {
  withForecast();
  assert.deepEqual(debtSummary(), { has: false, payoff: null, rem: 0 });
});
