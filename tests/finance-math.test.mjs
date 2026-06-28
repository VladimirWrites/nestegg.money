import { test } from "node:test";
import assert from "node:assert/strict";
import {
  amortization, loanPayoff, futureValue, futureValueOfContributions, cagr,
  savingsRate, fxConvert, depreciate, straightLineDepreciation,
} from "../public/lib/finance-math.js";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} !~= ${b}`);

test("amortization: €100k at 6% over 30y -> €599.55/mo, 360 payments (round2)", () => {
  const a = amortization({ amount: 100000, rate: 6, mode: "term", termYears: 30, startDate: "2020-01-01" });
  assert.equal(a.monthlyPayment, 599.55); // round half-up to cents
  assert.equal(a.payments, 360);
  assert.ok(a.totalInterest > 115000 && a.totalInterest < 116000); // ~115,838 minus final-payment rounding
  assert.ok(a.payoffDate instanceof Date);
});

test("loanPayoff: an extra €200/mo saves time and interest", () => {
  const p = loanPayoff({ amount: 100000, rate: 6, mode: "term", termYears: 30, startDate: "2020-01-01" }, 200);
  assert.ok(p.monthsSaved > 0);
  assert.ok(p.interestSaved > 0);
  assert.ok(p.accelerated.months < p.baseline.months);
});

test("cagr: a value that doubles over 10 years is ~7.177%", () => {
  near(cagr(100, 200, 10), 0.0717734625, 1e-9);
  assert.equal(cagr(0, 200, 10), null); // guard
});

test("futureValue: €1000 at 7% for 10y ~= €1967.15", () => {
  near(futureValue(1000, 7, 10), 1967.151357, 1e-3);
});

test("futureValueOfContributions: €100/mo at 12%/yr for 12 months ~= €1268.25", () => {
  near(futureValueOfContributions(100, 12, 12, 0), 1268.250301, 1e-3);
});

test("savingsRate: 1000 saved of 5000 income = 0.2", () => {
  assert.equal(savingsRate(5000, 1000), 0.2);
  assert.equal(savingsRate(0, 1000), null);
});

test("fxConvert: pure multiply by the supplied rate", () => {
  near(fxConvert(100, 1.1), 110);
});

test("depreciate: €20k losing 15%/yr for 3y ~= €12,282.50 (app compounding method)", () => {
  near(depreciate(20000, 15, 3, false), 12282.5, 1e-6);
  near(depreciate(20000, 15, 3, true), 20000 * 1.15 ** 3, 1e-6); // up=true appreciates
});

test("straightLineDepreciation: 20k -> 2k salvage over 10y, 3y in = 14,600", () => {
  assert.equal(straightLineDepreciation(20000, 2000, 10, 3), 14600);
  assert.equal(straightLineDepreciation(20000, 2000, 10, 99), 2000); // floored at salvage
});
