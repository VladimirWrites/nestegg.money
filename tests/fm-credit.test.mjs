import { test } from "node:test";
import assert from "node:assert/strict";
import { near } from "./helpers.mjs";
import {
  loanAPR, interestOnlyPayment, balloonLoan, ltv, dti,
  creditCardPayoff, pointsBreakeven, biweeklyPayoff,
} from "../public/lib/finance-math.js";

test("loanAPR: equals the note rate with no fees, and rises with fees", () => {
  near(loanAPR(10000, 6, 60, 0).aprPct, 6, 1e-1);
  assert.ok(loanAPR(10000, 6, 60, 200).aprPct > 6);
});

test("interestOnlyPayment: monthly interest on the balance", () => {
  assert.equal(interestOnlyPayment(200000, 6).payment, 1000); // 200000 * 6%/12
});

test("balloonLoan: payment from a long amortization, balloon is the remaining balance", () => {
  const b = balloonLoan(200000, 6, 60, 360);
  near(b.payment, 1199.10, 1e-2);
  assert.ok(b.balloon > 180000 && b.balloon < 190000);
});

test("ltv and dti are simple ratios", () => {
  assert.equal(ltv(160000, 200000).ltvPct, 80);
  near(dti(2000, 6000).dtiPct, 2000 / 6000 * 100, 1e-9);
});

test("creditCardPayoff: a sufficient payment clears it; too small never does", () => {
  const r = creditCardPayoff(5000, 18, 200);
  assert.ok(r.months > 0 && r.months < 40 && r.totalInterest > 0);
  assert.equal(creditCardPayoff(5000, 18, 50).months, null); // 50 < first month's 75 interest
});

test("pointsBreakeven: cost recovered by the monthly saving", () => {
  const p = pointsBreakeven(300000, 6, 360, 1, 5.5);
  assert.equal(p.cost, 3000);          // 1 point on 300k
  assert.ok(p.monthlySaving > 0 && p.breakevenMonths > 0);
});

test("biweeklyPayoff: half the payment every two weeks shortens the loan", () => {
  const b = biweeklyPayoff(200000, 6, 360);
  near(b.biweeklyPayment, 599.55, 1e-2);
  assert.ok(b.monthsSaved > 0 && b.interestSaved > 0);
});
