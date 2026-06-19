import { test } from "node:test";
import assert from "node:assert/strict";
import { loanTerms, buildSchedule, outstandingAt } from "../public/js/domain/loan.js";

const loan = (o) =>
  Object.assign(
    { amount: 0, rate: 0, termYears: 30, startDate: "2020-01-01", mode: "term", payment: 0, extra: [], fixedUntil: null },
    o,
  );
const payments = (l) => buildSchedule(l).filter((r) => r.type === "payment");

test("30y amortization: 360 payments, residue folded into the final one", () => {
  const rows = payments(loan({ amount: 100000, rate: 3 }));
  assert.equal(rows.length, 360);
  assert.equal(rows[359].balance, 0);
  assert.ok(Math.abs(rows[0].payment - 421.6) < 0.05);
});

test("0% loan with an extra payment in the last month settles exactly", () => {
  const l = loan({ amount: 12000, rate: 0, termYears: 1, extra: [{ id: "x", date: "2020-12-10", amount: 500 }] });
  const rows = payments(l);
  const last = rows[rows.length - 1];
  assert.equal(last.balance, 0);
  assert.ok(Math.abs(last.payment - 500) < 0.01);
  const total = buildSchedule(l).reduce((a, r) => a + (r.payment || 0) + (r.extra || 0), 0);
  assert.ok(Math.abs(total - 12000) < 0.01);
});

test("payment-mode loan terminates at zero without overshooting", () => {
  const rows = payments(loan({ amount: 10000, rate: 5, mode: "payment", payment: 300 }));
  assert.equal(rows[rows.length - 1].balance, 0);
  assert.ok(rows[rows.length - 1].payment <= 300.01);
});

test("large mid-loan extra payment ends the schedule early", () => {
  const rows = payments(loan({ amount: 10000, rate: 5, termYears: 10, extra: [{ id: "x", date: "2020-06-15", amount: 9500 }] }));
  assert.equal(rows[rows.length - 1].balance, 0);
  assert.ok(rows.length < 12);
});

test("loanTerms: payment below monthly interest never amortizes (n = Infinity)", () => {
  const { n } = loanTerms(loan({ amount: 100000, rate: 12, mode: "payment", payment: 100 }));
  assert.equal(n, Infinity);
});

test("buildSchedule: a non-amortizing loan yields no rows", () => {
  assert.equal(buildSchedule(loan({ amount: 100000, rate: 12, mode: "payment", payment: 100 })).length, 0);
  assert.equal(buildSchedule(loan({ amount: 0 })).length, 0);
  assert.equal(buildSchedule(loan({ amount: 1000, startDate: "not-a-date" })).length, 0);
});

test("fixedUntil marks rows beyond the fixed date as estimated", () => {
  const rows = payments(loan({ amount: 100000, rate: 3, fixedUntil: "2025-01-01" }));
  assert.equal(rows.find((r) => r.date < new Date(2025, 0, 1)).estimated, false);
  assert.equal(rows.find((r) => r.date >= new Date(2025, 0, 1)).estimated, true);
});

test("outstandingAt: full balance before start, zero after payoff", () => {
  const l = loan({ amount: 100000, rate: 3 });
  assert.equal(outstandingAt(l, new Date(2019, 0, 1)), 100000);
  assert.equal(outstandingAt(l, new Date(2060, 0, 1)), 0);
  const mid = outstandingAt(l, new Date(2035, 0, 1));
  assert.ok(mid > 0 && mid < 100000);
});

test("outstandingAt: monotonically non-increasing over time", () => {
  const l = loan({ amount: 100000, rate: 3 });
  let prev = Infinity;
  for (let y = 2020; y <= 2050; y++) {
    const bal = outstandingAt(l, new Date(y, 0, 1));
    assert.ok(bal <= prev + 1e-6, `balance rose at ${y}`);
    prev = bal;
  }
});
