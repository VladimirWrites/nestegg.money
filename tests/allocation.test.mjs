import { test } from "node:test";
import assert from "node:assert/strict";
import { setState } from "../public/js/domain/store.js";
import { allocationRows, snapGrossBase } from "../public/js/domain/model.js";

const base = () => ({ baseCcy: "EUR", fxRates: { EUR: 1, USD: 2 }, fxHist: {}, prices: {}, assets: [], snapshots: [], salaries: [], categories: [] });

const snap = {
  year: 2024,
  entries: [
    { name: "VWCE", kind: "fixed", ccy: "EUR", value: 50000, group: "Stocks" },
    { name: "AAPL", kind: "fixed", ccy: "EUR", value: 15000, group: "Stocks" },
    { name: "Cash", kind: "fixed", ccy: "EUR", value: 10000, group: "Cash" },
    { name: "Mortgage", kind: "liability", ccy: "EUR", value: 20000 },
  ],
};

test("allocationRows groups positive holdings by series, sorted high to low", () => {
  setState(base());
  assert.deepEqual(allocationRows(snap), [
    { name: "Stocks", v: 65000 },
    { name: "Cash", v: 10000 },
  ]);
});

test("allocationRows excludes liabilities; total equals snapGrossBase", () => {
  setState(base());
  const rows = allocationRows(snap);
  assert.ok(!rows.some((r) => r.name === "Mortgage"));
  assert.equal(rows.reduce((a, r) => a + r.v, 0), snapGrossBase(snap));
});

test("allocationRows handles a missing snapshot", () => {
  setState(base());
  assert.deepEqual(allocationRows(null), []);
  assert.deepEqual(allocationRows(undefined), []);
});

test("allocationRows uses group when set, else the entry name", () => {
  setState(base());
  const s = { year: 2024, entries: [
    { name: "Gold", kind: "fixed", ccy: "EUR", value: 5000 },        // no group -> keyed by name
    { name: "Silver", kind: "fixed", ccy: "EUR", value: 8000, group: "Metals" },
  ] };
  assert.deepEqual(allocationRows(s), [
    { name: "Metals", v: 8000 },
    { name: "Gold", v: 5000 },
  ]);
});
