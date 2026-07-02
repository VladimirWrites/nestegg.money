import { test } from "node:test";
import assert from "node:assert/strict";
import { setState, state } from "../public/js/domain/store.js";
import { buildSnapshot, SHARE_SECTIONS } from "../public/js/domain/snapshot.js";
import { budgetSummary } from "../public/js/domain/budget.js";

const full = () => ({
  v: 6,
  baseCcy: "USD",
  fxRates: { EUR: 1, USD: 1.1 },
  fxDate: "2024-01-01",
  fxHist: { 2023: { EUR: 1, USD: 1.05 } },
  prices: { "NASDAQ:AAPL": { price: 200 } },
  assets: [{ id: "a1", name: "Car", value: 1000 }],
  categories: ["Cash", "Stocks"],
  snapshots: [{ year: 2024, entries: [{ name: "Cash", value: 500 }] }],
  salaries: [{ id: "p1", name: "Me", entries: [] }],
  budget: { incomeOverride: 3000, expenses: [] },
  forecast: { monthly: 500, growth: 0.05 },
  retire: { retireYear: 2050, spending: 40000 },
});

test("valuation context (currency, fx, prices) is always included", () => {
  setState(full());
  const snap = buildSnapshot({});
  assert.equal(snap.baseCcy, "USD");
  assert.deepEqual(snap.fxRates, { EUR: 1, USD: 1.1 });
  assert.deepEqual(snap.fxHist, { 2023: { EUR: 1, USD: 1.05 } });
  assert.deepEqual(snap.prices, { "NASDAQ:AAPL": { price: 200 } });
});

test("only checked sections carry data; the rest are empty defaults", () => {
  setState(full());
  const snap = buildSnapshot({ networth: true });
  // included
  assert.deepEqual(snap.assets, [{ id: "a1", name: "Car", value: 1000 }]);
  assert.deepEqual(snap.categories, ["Cash", "Stocks"]);
  assert.equal(snap.snapshots.length, 1);
  // excluded -> empty, never the real data
  assert.deepEqual(snap.salaries, []);
  assert.equal(snap.budget, null);
  assert.equal(snap.forecast, null);
  assert.equal(snap.retire, null);
});

test("_include mirrors the selection for every section", () => {
  setState(full());
  const snap = buildSnapshot({ budget: true, retirement: true });
  assert.deepEqual(snap._include, {
    networth: false, salaries: false, budget: true, forecast: false, retirement: true,
  });
  assert.deepEqual(snap.budget, { incomeOverride: 3000, expenses: [] });
  assert.deepEqual(snap.retire, { retireYear: 2050, spending: 40000 });
  assert.deepEqual(snap.assets, []);
});

test("snapshot is a deep clone — mutating it never touches live state", () => {
  setState(full());
  const snap = buildSnapshot({ networth: true });
  snap.assets[0].value = 999999;
  snap.snapshots[0].entries.push({ name: "Injected", value: 1 });
  assert.equal(state.assets[0].value, 1000);
  assert.equal(state.snapshots[0].entries.length, 1);
});

// Budget derives income from salaries and fixed outflow from asset loans. Sharing Budget alone
// must still render those figures — without leaking salaries or asset values.
const withDerivedBudget = () => ({
  v: 6, baseCcy: "EUR", fxRates: { EUR: 1 }, fxHist: {}, prices: {},
  assets: [{ id: "as1", name: "Flat", ccy: "EUR", value: 300000, group: "P", loan: { amount: 200000, rate: 0.03, termYears: 30, startDate: "2020-01-01", mode: "term", payment: 0, fixedUntil: null, extra: [] } }],
  categories: [], snapshots: [{ year: 2024, entries: [] }],
  salaries: [{ id: "p1", name: "Alex", ccy: "EUR", entries: [{ id: "e1", ym: "2024-06", amount: 4300, ccy: "EUR" }] }],
  budget: { incomeOverride: null, expenses: [], loanCats: {}, categories: [] },
});

test("budget-only snapshot bakes income and keeps loan outflows self-contained", () => {
  setState(withDerivedBudget());
  const live = budgetSummary();
  const snap = buildSnapshot({ budget: true });
  // income baked into the override (single figure), assets stripped to loan-only with zero value
  assert.equal(snap.budget.incomeOverride, 4300);
  assert.equal(snap.assets.length, 1);
  assert.equal(snap.assets[0].value, 0);       // asset worth is never exposed
  assert.ok(snap.assets[0].loan);              // but the loan (outflow) is kept
  assert.deepEqual(snap.salaries, []);         // per-person salary history not shared
  // the viewer (snapshot loaded as state) reproduces the live budget figures
  setState(snap);
  const shared = budgetSummary();
  assert.equal(shared.income, live.income);
  assert.equal(shared.fixed, live.fixed);
  assert.equal(shared.leftover, live.leftover);
});

test("income is NOT baked when salaries are shared (viewer computes it live)", () => {
  setState(withDerivedBudget());
  const snap = buildSnapshot({ budget: true, salaries: true });
  assert.equal(snap.budget.incomeOverride, null); // salaries present → no need to bake
  assert.equal(snap.salaries.length, 1);
});

test("loan assets are NOT stripped when net worth is shared (full assets kept)", () => {
  setState(withDerivedBudget());
  const snap = buildSnapshot({ budget: true, networth: true });
  assert.equal(snap.assets[0].value, 300000);  // full asset kept for the net-worth view
});

test("every declared section maps to real top-level state fields", () => {
  setState(full());
  const sel = {};
  SHARE_SECTIONS.forEach((s) => { sel[s.key] = true; });
  const snap = buildSnapshot(sel);
  for (const s of SHARE_SECTIONS) {
    for (const f of s.fields) assert.deepEqual(snap[f], state[f], `${s.key} → ${f}`);
  }
});
