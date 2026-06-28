import { test } from "node:test";
import assert from "node:assert/strict";
import { near } from "./helpers.mjs";
import {
  annuityPV, annuityFV, annuityPayment, perpetuity, ruleOf72,
  paybackPeriod, discountedPayback, mirr, xnpv, xirr,
} from "../public/lib/finance-math.js";

test("annuityPV / annuityFV / annuityPayment round-trip", () => {
  near(annuityPV(100, 5, 10).pv, 772.17, 1e-2);
  near(annuityFV(100, 5, 10).fv, 1257.79, 1e-2);
  near(annuityPayment(annuityPV(100, 5, 10).pv, 5, 10).payment, 100, 1e-2);
});

test("perpetuity: level and growing, with a guard when growth >= rate", () => {
  near(perpetuity(100, 5).pv, 2000, 1e-6);
  near(perpetuity(100, 5, 2).pv, 100 / 0.03, 1e-6);
  assert.equal(perpetuity(100, 2, 5).pv, null);
});

test("ruleOf72: the 72 estimate and the exact doubling time", () => {
  assert.equal(ruleOf72(8).years72, 9);
  near(ruleOf72(8).exactYears, Math.log(2) / Math.log(1.08), 1e-6);
});

test("paybackPeriod: fractional period when the cost is recovered mid-period", () => {
  near(paybackPeriod(1000, [400, 400, 400, 400]).years, 2.5, 1e-9);
  assert.equal(paybackPeriod(1000, [100, 100]).years, null); // never recovered
});

test("discountedPayback: slower than the simple payback", () => {
  const d = discountedPayback(1000, [400, 400, 400, 400], 10).years;
  assert.ok(d > paybackPeriod(1000, [400, 400, 400, 400]).years);
});

test("mirr: rises with the reinvestment rate", () => {
  const lo = mirr([-1000, 500, 500, 500], 10, 5).mirrPct;
  const hi = mirr([-1000, 500, 500, 500], 10, 15).mirrPct;
  assert.ok(hi > lo);
});

test("xnpv / xirr: a 10% one-year deal prices to zero at 10% (365-day span)", () => {
  const cf = [{ date: "2023-01-01", amount: -1000 }, { date: "2024-01-01", amount: 1100 }];
  near(xnpv(cf, 10).npv, 0, 1e-2);
  near(xirr(cf).xirrPct, 10, 1e-2);
});
