import { test } from "node:test";
import assert from "node:assert/strict";
import { near } from "./helpers.mjs";
import {
  netWorth, budget503020, tipSplit, discount, successiveDiscounts,
  percentageChange, unitPrice, hourlyToSalary, salaryToHourly,
  afterTaxYield, taxEquivalentYield,
} from "../public/lib/finance-math.js";

test("netWorth: assets minus liabilities", () => {
  assert.equal(netWorth(500000, 200000).netWorth, 300000);
});

test("budget503020: the 50/30/20 split of monthly income", () => {
  const b = budget503020(5000);
  assert.equal(b.needs, 2500);
  assert.equal(b.wants, 1500);
  assert.equal(b.savings, 1000);
});

test("tipSplit: tip, total, and per-person share", () => {
  const t = tipSplit(100, 20, 4);
  assert.equal(t.tip, 20);
  assert.equal(t.total, 120);
  assert.equal(t.perPerson, 30);
});

test("discount and successiveDiscounts", () => {
  const d = discount(100, 25);
  assert.equal(d.discount, 25);
  assert.equal(d.finalPrice, 75);
  const s = successiveDiscounts(100, [20, 10]);
  assert.equal(s.finalPrice, 72);      // 100 * 0.8 * 0.9
  near(s.effectivePct, 28, 1e-9);
});

test("percentageChange and unitPrice with guards", () => {
  assert.equal(percentageChange(80, 100).changePct, 25);
  assert.equal(percentageChange(0, 100).changePct, null);
  assert.equal(unitPrice(5, 2).unitPrice, 2.5);
  assert.equal(unitPrice(5, 0).unitPrice, null);
});

test("hourlyToSalary and salaryToHourly round-trip", () => {
  const s = hourlyToSalary(25);
  assert.equal(s.annual, 52000);       // 25 * 40 * 52
  near(s.monthly, 52000 / 12, 1e-2);
  near(salaryToHourly(52000).hourly, 25, 1e-9);
});

test("afterTaxYield and taxEquivalentYield are inverses", () => {
  near(afterTaxYield(5, 30).afterTaxPct, 3.5, 1e-9);
  near(taxEquivalentYield(3.5, 30).taxEquivalentPct, 5, 1e-9);
});
