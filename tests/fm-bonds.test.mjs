import { test } from "node:test";
import assert from "node:assert/strict";
import { near } from "./helpers.mjs";
import {
  bondPrice, currentYield, bondDuration, convexity, zeroCouponPrice, accruedInterest,
} from "../public/lib/finance-math.js";

test("bondPrice: a bond priced at its coupon yield trades at par; a higher yield discounts it", () => {
  near(bondPrice(1000, 5, 10, 5, 2).price, 1000, 1e-2);
  assert.ok(bondPrice(1000, 5, 10, 6, 2).price < 1000);
});

test("currentYield: annual coupon over the price", () => {
  near(currentYield(950, 1000, 5).currentYieldPct, 50 / 950 * 100, 1e-6);
});

test("bondDuration: macaulay is below maturity and modified is below macaulay", () => {
  const d = bondDuration(1000, 5, 10, 5, 2);
  assert.ok(d.macaulay > 7 && d.macaulay < 10);
  assert.ok(d.modified < d.macaulay && d.modified > 0);
});

test("convexity: positive for a plain coupon bond", () => {
  const c = convexity(1000, 5, 10, 5, 2).convexity;
  assert.ok(c > 0 && c < 200);
});

test("zeroCouponPrice: face discounted to today", () => {
  near(zeroCouponPrice(1000, 10, 5, 1).price, 1000 / 1.05 ** 10, 1e-2);
});

test("accruedInterest: pro-rata coupon since the last payment", () => {
  assert.equal(accruedInterest(1000, 6, 90, 360).accrued, 15); // 60 * 90/360
});
