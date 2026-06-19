import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDate, round2, addMonths, fmtMonths, fmtMY } from "../public/js/domain/dates.js";

test("parseDate reads YYYY-MM-DD as a local date (no timezone shift)", () => {
  const d = parseDate("2020-03-15");
  assert.equal(d.getFullYear(), 2020);
  assert.equal(d.getMonth(), 2);
  assert.equal(d.getDate(), 15);
  assert.equal(parseDate("nonsense"), null);
});

test("round2 is half-up and immune to the 1484.375 float case", () => {
  assert.equal(round2(1484.375), 1484.38);
  assert.equal(round2(1.005), 1.01);
  assert.equal(round2(2.5049), 2.5);
});

test("addMonths clamps to the last valid day", () => {
  assert.equal(addMonths(new Date(2021, 0, 31), 1).getMonth(), 1); // Jan 31 -> Feb
  assert.equal(addMonths(new Date(2021, 0, 31), 1).getDate(), 28);
  assert.equal(addMonths(new Date(2020, 0, 31), 1).getDate(), 29); // leap year
});

test("fmtMonths renders years and months, with sane edges", () => {
  assert.equal(fmtMonths(27), "2 yr 3 mo");
  assert.equal(fmtMonths(12), "1 yr");
  assert.equal(fmtMonths(5), "5 mo");
  assert.equal(fmtMonths(0), "—");
  assert.equal(fmtMonths(Infinity), "—");
});

test("fmtMY is empty for a missing date", () => {
  assert.equal(fmtMY(null), "");
  assert.match(fmtMY(new Date(2024, 4, 1)), /May 2024/);
});
