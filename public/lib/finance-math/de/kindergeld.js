// Kindergeld (§66 EStG): a flat monthly amount per child since 2023 (no more per-child-count
// tiers). The amount is fixed per year in the statutory table.
import { round2 } from "../../../js/domain/dates.js";
import { deYearParams } from "./statutory.js";

export function deKindergeld({ year, children = 1 } = {}) {
  const p = deYearParams(+year);
  const n = Math.max(0, Math.round(+children || 0));
  return {
    year: +year,
    children: n,
    perChildMonthly: p.kindergeldMonthly,
    monthly: round2(n * p.kindergeldMonthly),
    annual: round2(n * p.kindergeldMonthly * 12),
  };
}
