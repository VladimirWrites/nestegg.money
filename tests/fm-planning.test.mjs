import { test } from "node:test";
import assert from "node:assert/strict";
import { near } from "./helpers.mjs";
import { savingsRate, fireNumber, portfolioLongevity, emergencyFund, coastFire, baristaFire } from "../public/lib/finance-math.js";

test("savingsRate: 1000 saved of 5000 income = 0.2", () => {
  assert.equal(savingsRate(5000, 1000), 0.2);
  assert.equal(savingsRate(0, 1000), null);
});

test("fireNumber: 40k spend at the default 4% rule -> €1,000,000 target (25x)", () => {
  const f = fireNumber({ annualSpend: 40000 });
  assert.equal(f.target, 1000000);
  assert.equal(f.gap, 1000000);
  assert.equal(f.yearsToFI, null); // no contribution and no growth -> unreachable
});

test("fireNumber: gap floors at 0 once the nest egg covers the target", () => {
  const f = fireNumber({ annualSpend: 40000, currentNestEgg: 1200000 });
  assert.equal(f.gap, 0);
  assert.equal(f.yearsToFI, 0);
});

test("fireNumber: €50k/yr with no growth reaches €1M in exactly 20 years", () => {
  const f = fireNumber({ annualSpend: 40000, annualContribution: 50000, annualRatePct: 0 });
  assert.equal(f.yearsToFI, 20);
});

test("fireNumber: growth reaches the target sooner than no growth", () => {
  const flat = fireNumber({ annualSpend: 40000, annualContribution: 50000, annualRatePct: 0 });
  const grown = fireNumber({ annualSpend: 40000, annualContribution: 50000, annualRatePct: 7 });
  assert.ok(grown.yearsToFI < flat.yearsToFI);
});

test("portfolioLongevity: withdrawing exactly the real return lasts indefinitely", () => {
  const r = portfolioLongevity({ balance: 1000000, annualWithdrawal: 40000, annualRatePct: 4 });
  assert.equal(r.sustainable, true);
  assert.equal(r.years, null);
});

test("portfolioLongevity: over-withdrawing depletes the balance in finite years", () => {
  const r = portfolioLongevity({ balance: 1000000, annualWithdrawal: 100000, annualRatePct: 4 });
  assert.equal(r.sustainable, false);
  assert.ok(r.years > 0 && r.years < 20);
});

test("portfolioLongevity: a rising withdrawal depletes no later than a flat one", () => {
  const flat = portfolioLongevity({ balance: 1000000, annualWithdrawal: 100000, annualRatePct: 4 });
  const rising = portfolioLongevity({ balance: 1000000, annualWithdrawal: 100000, annualRatePct: 4, withdrawalGrowthPct: 5 });
  assert.ok(rising.years <= flat.years);
});

test("emergencyFund: €12k liquid against €3k/mo expenses = 4 months", () => {
  assert.equal(emergencyFund(12000, 3000).months, 4);
  assert.equal(emergencyFund(12000, 0).months, null); // guard
});

test("coastFire: enough invested to coast vs not", () => {
  const c = coastFire(300000, 7, 20, 40000, 4);
  assert.equal(c.fireTarget, 1000000);          // 40k / 4%
  assert.ok(c.projected > c.fireTarget && c.isCoasting === true && c.gap === 0);
  const short = coastFire(50000, 7, 20, 40000, 4);
  assert.ok(short.isCoasting === false && short.gap > 0);
});

test("baristaFire: only the spending the portfolio must cover", () => {
  assert.equal(baristaFire(40000, 20000, 4).target, 500000); // (40k-20k)/4%
  assert.equal(baristaFire(40000, 40000, 4).target, 0);       // part-time covers it
});
