import { test } from "node:test";
import assert from "node:assert/strict";
import { near } from "./helpers.mjs";
import {
  wacc, breakEvenUnits, contributionMargin, currentRatio, quickRatio, roe, roa,
} from "../public/lib/finance-math.js";

test("wacc: equity and after-tax debt weighted by capital structure", () => {
  // E=600k, D=400k, re=10%, rd=5%, tax=25% -> 0.6*10 + 0.4*5*0.75 = 7.5%
  near(wacc(600000, 400000, 10, 5, 25).waccPct, 7.5, 1e-9);
});

test("breakEvenUnits: fixed costs over the unit contribution", () => {
  const b = breakEvenUnits(10000, 50, 30);
  assert.equal(b.units, 500);       // 10000 / (50-30)
  assert.equal(b.revenue, 25000);   // 500 * 50
  assert.equal(breakEvenUnits(10000, 30, 50).units, null); // price <= variable
});

test("contributionMargin: per-unit margin and ratio", () => {
  const c = contributionMargin(50, 30);
  assert.equal(c.contributionMargin, 20);
  assert.equal(c.ratioPct, 40);
});

test("currentRatio and quickRatio", () => {
  assert.equal(currentRatio(100000, 50000).currentRatio, 2);
  assert.equal(quickRatio(100000, 20000, 40000).quickRatio, 2); // (100k-20k)/40k
});

test("roe and roa", () => {
  assert.equal(roe(50000, 250000).roePct, 20);
  assert.equal(roa(50000, 500000).roaPct, 10);
});
