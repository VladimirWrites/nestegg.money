import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decliningBalanceDepreciation, doubleDecliningDepreciation,
  sumOfYearsDigits, unitsOfProductionDepreciation,
} from "../public/lib/finance-math.js";

test("decliningBalanceDepreciation: a fixed percent of the reducing book value", () => {
  const y1 = decliningBalanceDepreciation(10000, 20, 1);
  assert.equal(y1.depreciation, 2000);
  assert.equal(y1.bookValue, 8000);
  const y2 = decliningBalanceDepreciation(10000, 20, 2);
  assert.equal(y2.depreciation, 1600); // 8000 * 20%
  assert.equal(y2.bookValue, 6400);
});

test("doubleDecliningDepreciation: 2/life of the book value", () => {
  const y1 = doubleDecliningDepreciation(10000, 5, 1);
  assert.equal(y1.depreciation, 4000); // rate 2/5 = 40%
  assert.equal(y1.bookValue, 6000);
});

test("sumOfYearsDigits: weighted toward the early years", () => {
  const y1 = sumOfYearsDigits(10000, 1000, 5, 1);
  assert.equal(y1.depreciation, 3000); // (10000-1000) * 5/15
  assert.equal(y1.bookValue, 7000);
});

test("unitsOfProductionDepreciation: cost per unit times units used", () => {
  assert.equal(unitsOfProductionDepreciation(10000, 1000, 9000, 500).depreciation, 500); // (9000/9000)*500
});
