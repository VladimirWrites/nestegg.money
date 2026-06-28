import { test } from "node:test";
import assert from "node:assert/strict";
import { near } from "./helpers.mjs";
import { capRate, cashOnCash, noi, grossRentMultiplier, dscr } from "../public/lib/finance-math.js";

test("capRate: NOI over property value", () => {
  assert.equal(capRate(50000, 1000000).capRatePct, 5);
});

test("cashOnCash: annual cash flow over cash invested", () => {
  assert.equal(cashOnCash(12000, 100000).cashOnCashPct, 12);
});

test("noi: gross rent less vacancy and operating expenses", () => {
  assert.equal(noi(100000, 5, 30000).noi, 65000); // 100000*0.95 - 30000
});

test("grossRentMultiplier: price over annual rent", () => {
  assert.equal(grossRentMultiplier(500000, 50000).grm, 10);
});

test("dscr: NOI over annual debt service", () => {
  near(dscr(120000, 100000).dscr, 1.2, 1e-9);
});
