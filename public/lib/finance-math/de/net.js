// German net salary (Brutto → Netto), exact per year: Lohnsteuer/Soli via the official BMF
// Programmablaufplan (generated per-year classes), church tax from the PAP's Kirchensteuer
// base, and social insurance via sozialversicherung.js. The year resolves statutory data from
// statutory.js; unsupported years throw there with a pointer to the manual tool.
import { round2 } from "../../../js/domain/dates.js";
import { BigDecimal } from "./bigdecimal.js";
import { deYearParams, isOst, isSaxony } from "./statutory.js";
import { deSozialversicherung } from "./sozialversicherung.js";
import { Lohnsteuer2023 } from "./lohnsteuer2023.js";
import { Lohnsteuer2024 } from "./lohnsteuer2024.js";
import { Lohnsteuer2025 } from "./lohnsteuer2025.js";
import { Lohnsteuer2026 } from "./lohnsteuer2026.js";

const PAP = { 2023: Lohnsteuer2023, 2024: Lohnsteuer2024, 2025: Lohnsteuer2025, 2026: Lohnsteuer2026 };

const eur = (cents) => round2(cents.divide(new BigDecimal(100)).doubleValue());

export function deNetSalary({
  year, grossAnnual, taxClass = 1, children = 0, childrenUnder25 = null,
  churchTaxPct = 0, bundesland = null, kvZusatzPct = null, privateHealth = null,
  age = null, faktor = null,
} = {}) {
  const p = deYearParams(+year);
  const Pap = PAP[+year];
  const g = +grossAnnual || 0;
  const stkl = Math.min(6, Math.max(1, Math.round(+taxClass || 1)));
  const ost = isOst(bundesland), saxony = isSaxony(bundesland);
  const kvz = privateHealth ? 0 : (kvZusatzPct == null ? p.kvAvgZusatzPct : +kvZusatzPct);
  const kids = +children || 0;
  // Steuerklasse II is by definition a single parent, so "no children given" still means
  // parenthood for the Pflegeversicherung (no childless surcharge) — matches the BMF tables.
  const childless = kids <= 0 && stkl !== 2;

  // ---- Lohnsteuer + Soli via the official PAP (annual run, amounts in cents) ----
  const pap = new Pap({
    LZZ: 1,                                        // Lohnzahlungszeitraum: year
    RE4: new BigDecimal(Math.round(g * 100)),      // gross in cents
    STKL: stkl,
    ZKF: new BigDecimal(String(kids)),             // Kinderfreibetrag counter (halves allowed)
    R: churchTaxPct > 0 ? 1 : 0,
    KVZ: new BigDecimal(String(kvz)),
    KRV: +year <= 2024 ? (ost ? 1 : 0) : 0,        // pre-2025 PAPs: 0 = BBG West, 1 = BBG Ost
    PKV: privateHealth ? 1 : 0,                    // 1 = private, without proof of premium
    PVS: saxony ? 1 : 0,
    PVZ: !privateHealth && childless && (age == null || age >= 23) ? 1 : 0,
    PVA: new BigDecimal(String(kids > 0 ? Math.min(Math.max((childrenUnder25 == null ? kids : +childrenUnder25) - 1, 0), 4) : 0)),
    ...(faktor != null && stkl === 4 ? { af: 1, f: +faktor } : { af: 0 }),
  }).calc();

  const incomeTax = eur(pap.LSTLZZ);
  const soli = eur(pap.SOLZLZZ);
  const churchTax = round2(eur(pap.BK) * (+churchTaxPct || 0) / 100);

  // ---- employee social insurance ----
  // Steuerklasse II with no children given still counts as a parent for the PV rate (see above).
  const svChildren = kids > 0 ? kids : stkl === 2 ? 1 : 0;
  const sv = deSozialversicherung(g, p, { ost, saxony, children: svChildren, childrenUnder25, age, kvZusatzPct, privateHealth });

  const totalTax = round2(incomeTax + soli + churchTax);
  const totalDeductions = round2(totalTax + sv.total);
  const net = round2(g - totalDeductions);

  return {
    year: +year,
    gross: { annual: round2(g), monthly: round2(g / 12) },
    incomeTax, soli, churchTax, totalTax,
    contributions: {
      pension: sv.pension, unemployment: sv.unemployment, health: sv.health, care: sv.care,
      total: sv.total, rates: sv.rates, ceilingsApplied: sv.bases,
    },
    totalDeductions,
    net: { annual: net, monthly: round2(net / 12) },
    assumptions: {
      taxClass: stkl, children: kids, churchTaxPct: +churchTaxPct || 0,
      bundesland: bundesland || null, ost, saxony,
      kvZusatzPct: privateHealth ? null : kvz,
      privateHealth: !!privateHealth,
      basis: +year === 2023
        ? "PAP Lohnsteuer 2023 (ab Juli) — Pflege rates of 2023-07-01 applied to the whole year"
        : +year === 2024
          ? "PAP Lohnsteuer Dezember 2024 — the retroactive 2024 tariff (Grundfreibetrag 11784)"
          : `PAP Lohnsteuer ${+year}`,
    },
  };
}
