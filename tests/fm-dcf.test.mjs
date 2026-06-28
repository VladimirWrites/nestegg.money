import { test } from "node:test";
import assert from "node:assert/strict";
import { near } from "./helpers.mjs";
import { npv, irr, requiredReturn, yieldToMaturity, cagr } from "../public/lib/finance-math.js";

test("npv: [-1000, 500, 500, 500] discounted at 10% ~= €243.43", () => {
  near(npv([-1000, 500, 500, 500], 10).npv, 243.4259954, 1e-3);
});

test("irr: [-1000, 500, 500, 500] solves to a rate that zeroes the NPV", () => {
  const r = irr([-1000, 500, 500, 500]).irrPct;
  assert.ok(r > 23 && r < 24);
  near(npv([-1000, 500, 500, 500], r).npv, 0, 1e-2);
});

test("irr: a stream that never crosses zero returns null", () => {
  assert.equal(irr([100, 200, 300]).irrPct, null);
});

test("requiredReturn: no contributions matches CAGR; contributions lower the bar", () => {
  near(requiredReturn(1000, 2000, 10).ratePct, cagr(1000, 2000, 10) * 100, 1e-3);
  const none = requiredReturn(1000, 2000, 10).ratePct;
  const some = requiredReturn(1000, 2000, 10, 50).ratePct;
  assert.ok(some < none);
});

test("yieldToMaturity: a par-priced bond yields its coupon; a discount bond yields more", () => {
  near(yieldToMaturity(1000, 1000, 5, 10, 2).yieldPct, 5, 1e-2);
  assert.ok(yieldToMaturity(900, 1000, 5, 10, 2).yieldPct > 5);
});
