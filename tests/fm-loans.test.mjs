import { test } from "node:test";
import assert from "node:assert/strict";
import { near } from "./helpers.mjs";
import {
  amortization, loanPayoff, refiBreakeven, mortgageAffordability,
  debtPayoff, scheduleByYear, round2,
} from "../public/lib/finance-math.js";

test("amortization: €100k at 6% over 30y -> €599.55/mo, 360 payments (round2)", () => {
  const a = amortization({ amount: 100000, rate: 6, mode: "term", termYears: 30, startDate: "2020-01-01" });
  assert.equal(a.monthlyPayment, 599.55); // round half-up to cents
  assert.equal(a.payments, 360);
  assert.ok(a.totalInterest > 115000 && a.totalInterest < 116000); // ~115,838 minus final-payment rounding
  assert.ok(a.payoffDate instanceof Date);
});

test("amortization rateSteps: a rate rise after the fixed period costs more interest", () => {
  const flat = amortization({ amount: 300000, rate: 3, mode: "term", termYears: 30, startDate: "2024-01-01" });
  const stepped = amortization({ amount: 300000, rate: 3, mode: "term", termYears: 30, startDate: "2024-01-01",
    rateSteps: [{ date: "2034-01-01", rate: 5 }] });
  assert.ok(stepped.totalInterest > flat.totalInterest);
  assert.equal(stepped.monthlyPayment, flat.monthlyPayment); // installment held; term/Tilgung adjust
  assert.ok(Array.isArray(stepped.yearly) && stepped.yearly.length > 0);
});

test("amortization rateSteps: no steps is identical to a single-rate run", () => {
  const a = amortization({ amount: 200000, rate: 4, mode: "term", termYears: 20, startDate: "2024-01-01", detail: "monthly" });
  const b = amortization({ amount: 200000, rate: 4, mode: "term", termYears: 20, startDate: "2024-01-01", detail: "monthly", rateSteps: [] });
  assert.equal(a.totalInterest, b.totalInterest);
  assert.equal(a.schedule.length, b.schedule.length);
});

test("amortization detail: summary (default) omits the monthly schedule but keeps yearly + totals", () => {
  const a = amortization({ amount: 100000, rate: 6, mode: "term", termYears: 30, startDate: "2020-01-01" });
  assert.equal(a.schedule, undefined);
  assert.ok(Array.isArray(a.yearly) && a.yearly.length > 0);
  assert.equal(a.payments, 360);
  assert.equal(a.monthlyPayment, 599.55);
});

test("amortization detail: monthly returns the schedule with pagination metadata", () => {
  const a = amortization({ amount: 100000, rate: 6, mode: "term", termYears: 30, startDate: "2020-01-01", detail: "monthly", offset: 0, limit: 12 });
  assert.equal(a.schedule.length, 12);
  assert.equal(a.scheduleTotal, 360);
  assert.equal(a.nextOffset, 12);
});

test("amortization detail: monthly without a limit returns the whole schedule", () => {
  const a = amortization({ amount: 100000, rate: 6, mode: "term", termYears: 30, startDate: "2020-01-01", detail: "monthly" });
  assert.equal(a.schedule.length, 360);
  assert.equal(a.nextOffset, null);
});

test("loanPayoff: an extra €200/mo saves time and interest", () => {
  const p = loanPayoff({ amount: 100000, rate: 6, mode: "term", termYears: 30, startDate: "2020-01-01" }, 200);
  assert.ok(p.monthsSaved > 0);
  assert.ok(p.interestSaved > 0);
  assert.ok(p.accelerated.months < p.baseline.months);
});

test("refiBreakeven: €3000 cost, €150/mo saved -> 20 months, €15k lifetime over 120mo", () => {
  const r = refiBreakeven(3000, 1500, 1350, 120);
  assert.equal(r.monthlySaving, 150);
  assert.equal(r.breakevenMonths, 20);
  assert.equal(r.lifetimeSaving, 15000);
});

test("refiBreakeven: a costlier new payment never breaks even", () => {
  const r = refiBreakeven(3000, 1350, 1500);
  assert.equal(r.monthlySaving, -150);
  assert.equal(r.breakevenMonths, null);
});

test("mortgageAffordability: the max loan amortizes back to the max monthly payment", () => {
  const m = mortgageAffordability({ annualIncome: 120000, dtiPct: 36, rate: 6, termYears: 30, downPayment: 50000 });
  assert.equal(m.maxMonthlyPayment, 3600); // 10k/mo * 36%
  const a = amortization({ amount: m.maxLoan, rate: 6, mode: "term", termYears: 30, startDate: "2020-01-01" });
  near(a.monthlyPayment, 3600, 1); // round-trips within a euro
  assert.equal(m.maxHomePrice, round2(m.maxLoan + 50000));
});

test("mortgageAffordability: existing monthly debts shrink the budget and the loan", () => {
  const clean = mortgageAffordability({ annualIncome: 120000, dtiPct: 36, rate: 6, termYears: 30 });
  const burdened = mortgageAffordability({ annualIncome: 120000, dtiPct: 36, rate: 6, termYears: 30, monthlyDebts: 600 });
  assert.equal(burdened.maxMonthlyPayment, 3000);
  assert.ok(burdened.maxLoan < clean.maxLoan);
});

test("debtPayoff: avalanche attacks the highest rate first, snowball the smallest balance", () => {
  const debts = [
    { name: "A", balance: 1000, rate: 5, minPayment: 25 },
    { name: "B", balance: 2000, rate: 20, minPayment: 25 },
  ];
  const ava = debtPayoff(debts, 200, "avalanche");
  const snow = debtPayoff(debts, 200, "snowball");
  assert.equal(ava.payoffOrder[0], "B");
  assert.equal(snow.payoffOrder[0], "A");
  assert.ok(ava.months > 0 && snow.months > 0);
  assert.ok(ava.totalInterest <= snow.totalInterest); // avalanche minimizes interest
});

test("debtPayoff: a budget that cannot cover the minimums is insolvent", () => {
  const r = debtPayoff([{ balance: 1000, rate: 5, minPayment: 25 }, { balance: 2000, rate: 20, minPayment: 25 }], 10);
  assert.equal(r.insolvent, true);
  assert.equal(r.months, null);
});

test("scheduleByYear: buckets schedule rows into per-year totals that sum back", () => {
  const a = amortization({ amount: 100000, rate: 6, mode: "term", termYears: 30, startDate: "2020-01-01", detail: "monthly" });
  const yrs = scheduleByYear(a.schedule);
  assert.equal(yrs[0].year, 2020);
  near(yrs.reduce((s, y) => s + y.interest, 0), a.totalInterest, 1); // sums back to total
  assert.ok(yrs[0].endBalance < 100000);
  assert.equal(yrs[yrs.length - 1].endBalance, 0); // paid off by the end
});
