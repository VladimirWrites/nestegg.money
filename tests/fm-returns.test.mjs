import { test } from "node:test";
import assert from "node:assert/strict";
import { near } from "./helpers.mjs";
import {
  roi, realReturn, returnStats, sharpeRatio, maxDrawdown,
  holdingPeriodReturn, feeDrag, dollarCostAveraging,
} from "../public/lib/finance-math.js";

test("roi: 1000 -> 1500 over 5y is 50% total, ~8.45%/yr annualized", () => {
  const r = roi(1000, 1500, 5);
  assert.equal(r.roiPct, 50);
  near(r.annualizedPct, 8.4471771, 1e-4);
  assert.equal(roi(1000, 1500).annualizedPct, null); // no years -> no annualized
});

test("realReturn: 7% nominal less 3% inflation is ~3.88% real (Fisher)", () => {
  near(realReturn(7, 3).realPct, 3.8834951, 1e-5);
});

test("returnStats: sample mean/variance/stdev of a return series", () => {
  const s = returnStats([10, -5, 15, 0]);
  assert.equal(s.mean, 5);
  near(s.variance, 250 / 3, 1e-6); // sample (n-1)
  near(s.stdev, Math.sqrt(250 / 3), 1e-6);
  assert.equal(returnStats([5]).stdev, null); // need >=2 for sample stdev
});

test("sharpeRatio: excess mean over volatility", () => {
  const r = sharpeRatio([10, -5, 15, 0], 1);
  near(r.sharpe, (5 - 1) / Math.sqrt(250 / 3), 1e-6);
});

test("maxDrawdown: worst peak-to-trough decline", () => {
  const d = maxDrawdown([100, 120, 90, 110, 80]);
  near(d.maxDrawdownPct, 100 * (120 - 80) / 120, 1e-6); // 33.33% from peak 120 to trough 80
});

test("holdingPeriodReturn: income plus price change over the start value", () => {
  near(holdingPeriodReturn(50, 1100, 1000).hprPct, 15, 1e-9);
});

test("feeDrag: a 1% fee erodes the compounded balance", () => {
  const f = feeDrag(10000, 7, 1, 30);
  near(f.gross, 10000 * 1.07 ** 30, 1e-2);
  near(f.net, 10000 * 1.06 ** 30, 1e-2);
  assert.ok(f.lostToFees > 0 && f.net < f.gross);
});

test("dollarCostAveraging: average cost sits below the simple price average", () => {
  const d = dollarCostAveraging([10, 20, 10, 25], 100);
  assert.equal(d.units, 29);          // 10 + 5 + 10 + 4
  assert.equal(d.invested, 400);
  near(d.avgCost, 400 / 29, 1e-6);
  assert.equal(d.finalValue, 725);    // 29 * 25
});
