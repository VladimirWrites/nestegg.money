// Per-year German statutory payroll figures, 2023–2026. This is the one deliberately dated
// module: the calculators stay pure functions of a parameter object, and this table is where a
// `year` input resolves to those parameters (callers may still override any of them).
//
// Sources (verified 2026-07): SV-Rechengrößenverordnungen (BBGs), BMG announcements (average KV
// Zusatzbeitrag, Bundesanzeiger), PUEG 2023 (PV rates & child discounts), SGB XI §55 (Saxony
// split, childless surcharge). 2023 figures are the post-2023-07-01 state (PUEG), matching the
// "ab Juli 2023" Lohnsteuer PAP used for that year.
export const DE_YEARS = [2023, 2024, 2025, 2026];

export const DE_STATUTORY = {
  2023: {
    bbgRvAvWest: 87600, bbgRvAvOst: 85200, bbgKvPv: 59850,
    rvEmployeePct: 9.3, avEmployeePct: 1.3,
    kvGeneralEmployeePct: 7.3, kvAvgZusatzPct: 1.6,
    pvTotalPct: 3.4, pvChildlessSurchargePct: 0.6, pvPerChildDiscountPct: 0.25, pvSaxonyShiftPct: 0.5,
  },
  2024: {
    bbgRvAvWest: 90600, bbgRvAvOst: 89400, bbgKvPv: 62100,
    rvEmployeePct: 9.3, avEmployeePct: 1.3,
    kvGeneralEmployeePct: 7.3, kvAvgZusatzPct: 1.7,
    pvTotalPct: 3.4, pvChildlessSurchargePct: 0.6, pvPerChildDiscountPct: 0.25, pvSaxonyShiftPct: 0.5,
  },
  2025: {
    bbgRvAvWest: 96600, bbgRvAvOst: 96600, bbgKvPv: 66150,   // BBG unified from 2025-01-01
    rvEmployeePct: 9.3, avEmployeePct: 1.3,
    kvGeneralEmployeePct: 7.3, kvAvgZusatzPct: 2.5,
    pvTotalPct: 3.6, pvChildlessSurchargePct: 0.6, pvPerChildDiscountPct: 0.25, pvSaxonyShiftPct: 0.5,
  },
  2026: {
    bbgRvAvWest: 101400, bbgRvAvOst: 101400, bbgKvPv: 69750,
    rvEmployeePct: 9.3, avEmployeePct: 1.3,
    kvGeneralEmployeePct: 7.3, kvAvgZusatzPct: 2.9,          // BAnz 2025-11-10
    pvTotalPct: 3.6, pvChildlessSurchargePct: 0.6, pvPerChildDiscountPct: 0.25, pvSaxonyShiftPct: 0.5,
  },
};

// East states for the pre-2025 Rentenversicherung ceiling (Berlin counts as West here — the
// East ceiling applied only to employment in the former East including East Berlin; for a
// whole-Berlin input West is the safer default).
const OST = new Set(["BB", "MV", "SN", "ST", "TH"]);
export const isOst = (bundesland) => OST.has(String(bundesland || "").toUpperCase());
export const isSaxony = (bundesland) => String(bundesland || "").toUpperCase() === "SN";

export function deYearParams(year) {
  const p = DE_STATUTORY[year];
  if (!p) {
    throw new Error(
      `German net salary: no statutory data for ${year}. Supported tax years: ${DE_YEARS.join(", ")}. ` +
      `For earlier years use the de-gross-to-net tool and pass that year's statutory figures yourself.`,
    );
  }
  return p;
}
