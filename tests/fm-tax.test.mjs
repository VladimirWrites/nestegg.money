import { test } from "node:test";
import assert from "node:assert/strict";
import { near } from "./helpers.mjs";
import { fxConvert, taxFromBrackets, marginMarkup, germanNetSalary, vat } from "../public/lib/finance-math.js";

test("fxConvert: pure multiply by the supplied rate", () => {
  near(fxConvert(100, 1.1), 110);
});

test("taxFromBrackets: progressive brackets on €50k -> €12k, 24% effective, 40% marginal", () => {
  const t = taxFromBrackets(50000, [
    { upTo: 10000, ratePct: 0 },
    { upTo: 30000, ratePct: 20 },
    { ratePct: 40 },
  ]);
  assert.equal(t.tax, 12000);
  near(t.effectiveRatePct, 24, 1e-9);
  assert.equal(t.marginalRatePct, 40);
});

test("marginMarkup: 50% markup on €100 cost -> €150 price, ~33.33% margin", () => {
  const m = marginMarkup({ cost: 100, markupPct: 50 });
  assert.equal(m.price, 150);
  near(m.marginPct, 33.33, 1e-2);
  assert.equal(m.profit, 50);
});

test("marginMarkup: a target margin implies cost and price", () => {
  const m = marginMarkup({ cost: 100, marginPct: 20 });
  assert.equal(m.price, 125);
  near(m.markupPct, 25, 1e-9);
});

test("germanNetSalary: brutto minus the statutory deductions the caller supplies", () => {
  // All statutory figures are inputs (the caller looks up the current year's numbers).
  const r = germanNetSalary({
    gross: 60000, incomeTax: 11000, soli: 0, churchTaxPct: 9,
    pensionPct: 9.3, unemploymentPct: 1.3, healthPct: 8.15, carePct: 2.3,
    pensionCeiling: 90600, healthCeiling: 62100,
  });
  assert.equal(r.churchTax, 990); // 11000 * 9%
  assert.equal(r.contributions.pension, 5580); // 60000 * 9.3%
  assert.equal(r.contributions.total, 12630); // 5580 + 780 + 4890 + 1380
  assert.equal(r.net, 35380); // 60000 - 11000 - 0 - 990 - 12630
});

test("germanNetSalary: contributions are capped at the contribution ceilings", () => {
  const r = germanNetSalary({ gross: 60000, healthPct: 8, healthCeiling: 50000 });
  assert.equal(r.contributions.health, 4000); // min(60000, 50000) * 8%, not 4800
});

test("vat: adds tax to a net price, and extracts it from a gross price", () => {
  const add = vat(100, 19);
  assert.equal(add.tax, 19);
  assert.equal(add.gross, 119);
  const extract = vat(119, 19, true);
  assert.equal(extract.net, 100);
  assert.equal(extract.tax, 19);
});
