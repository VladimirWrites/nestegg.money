// deNetSalary: the year-aware German net-salary orchestrator (PAP Lohnsteuer + social
// insurance + church tax). Statutory figures per year live in de/statutory.js; the Lohnsteuer
// engines themselves are golden-tested against the BMF Prüftabellen in fm-de-lohnsteuer.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { deNetSalary } from "../public/lib/finance-math/de/net.js";
import { DE_YEARS } from "../public/lib/finance-math/de/statutory.js";

test("unsupported years throw a helpful error", () => {
  for (const y of [1999, 2019, 2022]) {
    assert.throws(() => deNetSalary({ year: y, grossAnnual: 50000 }), /no statutory data for.*2023, 2024, 2025, 2026/s);
  }
  assert.deepEqual(DE_YEARS, [2023, 2024, 2025, 2026]);
});

test("2026 Steuerklasse I, 60k: full breakdown", () => {
  const r = deNetSalary({ year: 2026, grossAnnual: 60000, taxClass: 1 });
  assert.equal(r.incomeTax, 9389);           // official Prüftabelle value
  assert.equal(r.soli, 0);                   // below the Freigrenze
  assert.equal(r.contributions.pension, 5580);       // 9.3% of 60000
  assert.equal(r.contributions.unemployment, 780);   // 1.3%
  assert.equal(r.contributions.health, 5250);        // 7.3% + 2.9%/2 = 8.75%
  assert.equal(r.contributions.care, 1440);          // 1.8% + 0.6% childless = 2.4%
  assert.equal(r.contributions.total, 13050);
  assert.equal(r.net.annual, 60000 - 9389 - 13050);
  assert.equal(r.net.monthly, Math.round((60000 - 9389 - 13050) / 12 * 100) / 100);
});

test("church tax is the rate applied to the PAP Kirchensteuer base (with Kinderfreibeträge)", () => {
  const r = deNetSalary({ year: 2026, grossAnnual: 60000, taxClass: 1, churchTaxPct: 9 });
  assert.equal(r.churchTax, 845.01);         // 9% of BK 9389
  const kids = deNetSalary({ year: 2026, grossAnnual: 60000, taxClass: 3, children: 2, churchTaxPct: 9 });
  assert.ok(kids.churchTax < kids.incomeTax * 0.09, "children reduce the church-tax base below the Lohnsteuer");
});

test("contribution ceilings: 2023 East (Thüringen) uses the Ost BBG for pension/unemployment", () => {
  const r = deNetSalary({ year: 2023, grossAnnual: 90000, taxClass: 1, bundesland: "TH" });
  assert.equal(r.contributions.pension, 7923.6);       // 9.3% of 85200 (Ost), not 87600 (West)
  assert.equal(r.contributions.unemployment, 1107.6);
  assert.equal(r.contributions.health, 4847.85);       // (7.3 + 1.6/2)% of the 59850 KV ceiling
  assert.equal(r.contributions.care, 1376.55);         // 2.3% childless of 59850
});

test("Saxony: employee carries +0.5pp care insurance; one child removes the childless surcharge", () => {
  const r = deNetSalary({ year: 2025, grossAnnual: 50000, taxClass: 4, children: 1, bundesland: "SN" });
  assert.equal(r.contributions.rates.pvPct, 2.3);      // 3.6/2 + 0.5 Saxony
  assert.equal(r.contributions.care, 1150);
  const rest = deNetSalary({ year: 2025, grossAnnual: 50000, taxClass: 4, children: 1, bundesland: "BY" });
  assert.equal(rest.contributions.rates.pvPct, 1.8);
});

test("care insurance child discounts: 0.25pp per child from the 2nd to the 5th", () => {
  const pv = (children) => deNetSalary({ year: 2026, grossAnnual: 50000, children }).contributions.rates.pvPct;
  assert.equal(pv(0), 2.4);   // childless surcharge
  assert.equal(pv(1), 1.8);
  assert.equal(pv(2), 1.55);
  assert.equal(pv(5), 0.8);
  assert.equal(pv(7), 0.8);   // capped at 4 discounts
});

test("Steuerklasse II counts as a parent even with no children given (matches the BMF tables)", () => {
  const r = deNetSalary({ year: 2025, grossAnnual: 22500, taxClass: 2 });
  assert.equal(r.incomeTax, 75);                       // official Prüftabelle value (PVZ = 0)
  assert.equal(r.contributions.rates.pvPct, 1.8);      // no childless surcharge
});

test("private health: premium replaces statutory health+care, pension/unemployment unchanged", () => {
  const r = deNetSalary({ year: 2026, grossAnnual: 90000, taxClass: 1, privateHealth: { premiumAnnual: 7200 } });
  assert.equal(r.contributions.health, 7200);
  assert.equal(r.contributions.care, 0);
  assert.equal(r.contributions.pension, 8370);         // 9.3% of 90000 (below the 101400 ceiling)
  assert.equal(r.incomeTax, 22125);                    // PKV path of the PAP (no-proof minimum)
});

test("Soli kicks in above the Freigrenze at 5.5% of the Lohnsteuer", () => {
  const r = deNetSalary({ year: 2026, grossAnnual: 150000, taxClass: 1 });
  assert.equal(r.incomeTax, 44193);
  assert.equal(r.soli, 2430.61);                       // 5.5% of 44193 (inside the full zone)
  const low = deNetSalary({ year: 2026, grossAnnual: 60000, taxClass: 1 });
  assert.equal(low.soli, 0);
});

test("KV Zusatzbeitrag override replaces the year average in both tax and contributions", () => {
  const avg = deNetSalary({ year: 2026, grossAnnual: 60000 });
  const own = deNetSalary({ year: 2026, grossAnnual: 60000, kvZusatzPct: 1.9 });
  assert.equal(own.contributions.health, 4950);        // (7.3 + 0.95)% of 60000
  assert.ok(own.incomeTax > avg.incomeTax, "lower KV premium -> smaller Vorsorgepauschale -> more tax");
});
