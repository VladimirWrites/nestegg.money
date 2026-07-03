// The German statutory tool set beyond net salary: Abgeltungsteuer, Kindergeld, Midijob
// (Übergangsbereich), and Rentenpunkte. Statutory figures verified against official sources
// (gesetze-im-internet, SVBezGrV/RWBestV, BMAS Faktor-F announcements) as of 2026-07.
import { test } from "node:test";
import assert from "node:assert/strict";
import { deAbgeltungsteuer } from "../public/lib/finance-math/de/abgeltungsteuer.js";
import { deKindergeld } from "../public/lib/finance-math/de/kindergeld.js";
import { deMidijob } from "../public/lib/finance-math/de/midijob.js";
import { deRentenpunkte } from "../public/lib/finance-math/de/rentenpunkte.js";

test("Abgeltungsteuer: 25% above the Sparerpauschbetrag, Soli always on top", () => {
  const r = deAbgeltungsteuer({ year: 2026, capitalIncome: 11000 });
  assert.equal(r.allowance, 1000);
  assert.equal(r.taxable, 10000);
  assert.equal(r.incomeTax, 2500);            // 10000 / 4
  assert.equal(r.soli, 137.5);                // 5.5% — no Freigrenze for capital income
  assert.equal(r.churchTax, 0);
  assert.equal(r.totalTax, 2637.5);
  assert.equal(r.net, 11000 - 2637.5);
  const joint = deAbgeltungsteuer({ year: 2026, capitalIncome: 11000, joint: true });
  assert.equal(joint.allowance, 2000);
  assert.equal(joint.taxable, 9000);
});

test("Abgeltungsteuer: church tax lowers the flat rate per the §32d formula", () => {
  const r = deAbgeltungsteuer({ year: 2025, capitalIncome: 11000, churchTaxPct: 9 });
  assert.equal(r.incomeTax, 2444.99);         // 10000 / 4.09 — effectively 24.45%
  assert.equal(r.churchTax, 220.05);          // 9% of the reduced tax
  assert.equal(r.soli, 134.47);
  const kist8 = deAbgeltungsteuer({ year: 2025, capitalIncome: 11000, churchTaxPct: 8 });
  assert.equal(kist8.incomeTax, 2450.98);     // 10000 / 4.08
});

test("Abgeltungsteuer: below the allowance nothing is due; unsupported year throws", () => {
  const r = deAbgeltungsteuer({ year: 2024, capitalIncome: 900 });
  assert.equal(r.taxable, 0);
  assert.equal(r.totalTax, 0);
  assert.throws(() => deAbgeltungsteuer({ year: 2022, capitalIncome: 5000 }), /2023, 2024, 2025, 2026/);
});

test("Kindergeld: per-year flat amounts (250 / 250 / 255 / 259)", () => {
  assert.equal(deKindergeld({ year: 2023, children: 1 }).monthly, 250);
  assert.equal(deKindergeld({ year: 2024, children: 2 }).monthly, 500);
  assert.equal(deKindergeld({ year: 2025, children: 2 }).monthly, 510);
  const r = deKindergeld({ year: 2026, children: 3 });
  assert.equal(r.perChildMonthly, 259);
  assert.equal(r.monthly, 777);
  assert.equal(r.annual, 9324);
});

test("Midijob: zone classification against the year's thresholds", () => {
  assert.equal(deMidijob({ year: 2026, monthlyPay: 603 }).zone, "minijob");
  assert.equal(deMidijob({ year: 2026, monthlyPay: 603.01 }).zone, "midijob");
  assert.equal(deMidijob({ year: 2026, monthlyPay: 2000 }).zone, "midijob");
  assert.equal(deMidijob({ year: 2026, monthlyPay: 2000.01 }).zone, "regular");
  assert.equal(deMidijob({ year: 2023, monthlyPay: 530 }).zone, "midijob");   // 2023 threshold was 520
  assert.equal(deMidijob({ year: 2025, monthlyPay: 550 }).zone, "minijob");   // 2025 threshold is 556
});

test("Midijob: official Faktor F per year (2023's is NOT 28/GSV of the post-July rates)", () => {
  assert.equal(deMidijob({ year: 2023, monthlyPay: 1000 }).faktorF, 0.6922);
  assert.equal(deMidijob({ year: 2024, monthlyPay: 1000 }).faktorF, 0.6846);
  assert.equal(deMidijob({ year: 2025, monthlyPay: 1000 }).faktorF, 0.6683);
  assert.equal(deMidijob({ year: 2026, monthlyPay: 1000 }).faktorF, 0.6619);
});

test("Midijob: the reduced bases hit the statutory anchors at both ends of the band", () => {
  // At the top of the band (2000) both bases equal the pay — contributions are the full ones.
  const top = deMidijob({ year: 2026, monthlyPay: 2000 });
  assert.equal(top.contributionBase.total, 2000);
  assert.equal(top.contributionBase.employee, 2000);
  // Just above the Minijob threshold the employee base starts near zero (the relief is maximal)
  // while the total base starts near F x G.
  const bottom = deMidijob({ year: 2026, monthlyPay: 604 });
  assert.ok(bottom.contributionBase.employee < 2);
  assert.ok(Math.abs(bottom.contributionBase.total - 0.6619 * 603) < 2);
  // Employee always saves versus full contributions inside the band.
  for (const pay of [700, 1000, 1500, 1999]) {
    const r = deMidijob({ year: 2025, monthlyPay: pay });
    assert.ok(r.savingsVsFull > 0, `saving at ${pay}`);
    assert.ok(r.contributionBase.employee < pay);
  }
});

test("Rentenpunkte: one point at exactly the year's Durchschnittsentgelt; ceiling caps the max", () => {
  assert.equal(deRentenpunkte({ year: 2025, grossAnnual: 50493 }).points, 1);
  assert.equal(deRentenpunkte({ year: 2023, grossAnnual: 43142 }).points, 1);
  const capped = deRentenpunkte({ year: 2026, grossAnnual: 120000 });
  assert.equal(capped.insuredGross, 101400);
  assert.ok(capped.ceilingApplied);
  assert.equal(capped.points, 1.9521);        // 101400 / 51944, 4 decimals
  assert.equal(capped.maxPointsThisYear, capped.points);
});

test("Rentenpunkte: Rentenwert halves, the 2023 East split, and the pension projection", () => {
  const r26 = deRentenpunkte({ year: 2026, grossAnnual: 51944, totalPoints: 45 });
  assert.deepEqual(r26.rentenwert, { janToJun: 40.79, fromJuly: 42.52 });
  assert.equal(r26.projection.monthlyPension, 1913.4);   // 45 x 42.52
  const east23 = deRentenpunkte({ year: 2023, grossAnnual: 40000, bundesland: "TH" });
  assert.equal(east23.rentenwert.janToJun, 35.52);       // East value until 2023-06-30
  assert.equal(east23.rentenwert.fromJuly, 37.6);
  const west23 = deRentenpunkte({ year: 2023, grossAnnual: 40000 });
  assert.equal(west23.rentenwert.janToJun, 36.02);
});
