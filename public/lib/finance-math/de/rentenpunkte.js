// Rentenpunkte (Entgeltpunkte, §63 SGB VI): a year's pension points are the insured gross
// (capped at that year's contribution ceiling) divided by the Durchschnittsentgelt — the
// average earnings figure fixed for the year. One point pays the "aktueller Rentenwert" per
// month; the Rentenwert changes each 1 July, so both halves of the year are returned.
import { round2 } from "../../../js/domain/dates.js";
import { deYearParams, isOst } from "./statutory.js";

const round4 = (x) => Math.round(x * 1e4) / 1e4;

export function deRentenpunkte({ year, grossAnnual, bundesland = null, totalPoints = null } = {}) {
  const p = deYearParams(+year);
  const g = Math.max(0, +grossAnnual || 0);
  const ceiling = isOst(bundesland) ? p.bbgRvAvOst : p.bbgRvAvWest;
  const insured = Math.min(g, ceiling);
  const points = round4(insured / p.durchschnittsentgelt);

  const out = {
    year: +year,
    grossAnnual: round2(g),
    insuredGross: round2(insured),
    ceilingApplied: insured < g,
    durchschnittsentgelt: p.durchschnittsentgelt,
    points,
    maxPointsThisYear: round4(ceiling / p.durchschnittsentgelt),
    // The Rentenwert was still split West/East in the first half of 2023; unified since 2023-07.
    rentenwert: { janToJun: isOst(bundesland) && p.rentenwertJanJunOst ? p.rentenwertJanJunOst : p.rentenwertJanJun, fromJuly: p.rentenwertFromJul },
    monthlyPensionPerPoint: p.rentenwertFromJul,
  };
  if (totalPoints != null) {
    out.projection = {
      totalPoints: +totalPoints,
      monthlyPension: round2(+totalPoints * p.rentenwertFromJul),
      note: "gross statutory pension at today's Rentenwert; taxes and KV/PV of pensioners not deducted",
    };
  }
  return out;
}
