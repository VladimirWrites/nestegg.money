import { test } from "node:test";
import assert from "node:assert/strict";
import { near } from "./helpers.mjs";
import {
  cagr, futureValue, depreciate, straightLineDepreciation,
  inflationAdjust, effectiveRate, presentValue, compoundInterest,
  futureValueOfContributions,
} from "../public/lib/finance-math.js";

test("cagr: a value that doubles over 10 years is ~7.177%", () => {
  near(cagr(100, 200, 10), 0.0717734625, 1e-9);
  assert.equal(cagr(0, 200, 10), null); // guard
});

test("futureValue: €1000 at 7% for 10y ~= €1967.15", () => {
  near(futureValue(1000, 7, 10), 1967.151357, 1e-3);
});

test("depreciate: €20k losing 15%/yr for 3y ~= €12,282.50 (app compounding method)", () => {
  near(depreciate(20000, 15, 3, false), 12282.5, 1e-6);
  near(depreciate(20000, 15, 3, true), 20000 * 1.15 ** 3, 1e-6); // up=true appreciates
});

test("straightLineDepreciation: 20k -> 2k salvage over 10y, 3y in = 14,600", () => {
  assert.equal(straightLineDepreciation(20000, 2000, 10, 3), 14600);
  assert.equal(straightLineDepreciation(20000, 2000, 10, 99), 2000); // floored at salvage
});

test("inflationAdjust: €1000 nominal at 3% for 10y ~= €744.09 real", () => {
  near(inflationAdjust(1000, 3, 10).value, 744.0939, 1e-3);
});

test("inflationAdjust: toNominal reverses the deflation", () => {
  near(inflationAdjust(744.0939, 3, 10, true).value, 1000, 1e-3);
});

test("effectiveRate: 12% nominal compounded monthly ~= 12.6825% APY", () => {
  near(effectiveRate(12, 12).effectiveRatePct, 12.68250301, 1e-6);
});

test("effectiveRate: toNominal recovers the nominal rate from the APY", () => {
  near(effectiveRate(12.68250301, 12, true).nominalRatePct, 12, 1e-6);
});

test("presentValue: the inverse of futureValue round-trips €1000", () => {
  near(presentValue(futureValue(1000, 7, 10), 7, 10).pv, 1000, 1e-6);
});

test("compoundInterest: annual matches futureValue; monthly contributions match the annuity", () => {
  near(compoundInterest(1000, 7, 10, 1).value, futureValue(1000, 7, 10), 1e-6);
  near(compoundInterest(0, 12, 1, 12, 100).value, futureValueOfContributions(100, 12, 12), 1e-6);
});
