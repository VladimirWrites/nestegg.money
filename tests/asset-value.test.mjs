import { test } from "node:test";
import assert from "node:assert/strict";
import { compoundedValue, assetGrossAt, assetNetAt, assetOwnedFrom } from "../public/js/domain/asset-value.js";

test("compoundedValue depreciates and appreciates over a year", () => {
  const down = compoundedValue(10000, 0.1, "2020-01-01", new Date(2021, 0, 1), false);
  assert.ok(Math.abs(down - 9000) < 5); // ~10% lost over a year
  const up = compoundedValue(10000, 0.1, "2020-01-01", new Date(2021, 0, 1), true);
  assert.ok(Math.abs(up - 11000) < 5);
});

test("compoundedValue returns the price before its start date", () => {
  assert.equal(compoundedValue(500, 0.2, "2020-01-01", new Date(2019, 0, 1), false), 500);
});

test("assetGrossAt: flat market value when not depreciating", () => {
  assert.equal(assetGrossAt({ depreciates: false, value: 4200 }, new Date()), 4200);
});

test("assetNetAt subtracts the outstanding loan", () => {
  const a = {
    depreciates: false,
    value: 300000,
    loan: { amount: 200000, rate: 3, termYears: 30, startDate: "2020-01-01", mode: "term", extra: [], fixedUntil: null },
  };
  const net = assetNetAt(a, new Date(2020, 1, 1));
  assert.ok(net > 99000 && net < 101000); // ~300k value - ~200k owed early on
});

test("assetOwnedFrom takes the earliest of purchase and loan start", () => {
  const a = { depreciates: true, date: "2022-06-01", loan: { startDate: "2020-01-01" } };
  assert.equal(assetOwnedFrom(a).getFullYear(), 2020);
});
