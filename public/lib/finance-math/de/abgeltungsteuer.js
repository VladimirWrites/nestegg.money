// Abgeltungsteuer: German flat tax on capital income (§32d EStG). 25% on income above the
// Sparerpauschbetrag, plus Soli (5.5% — no Freigrenze for capital income) and optional church
// tax. With church tax the statutory formula lowers the income-tax rate itself:
//   ESt = (e − 4q) / (4 + k)
// where e is the taxable income, q the creditable foreign tax and k the church-tax rate as a
// decimal (0.08 / 0.09) — at 9% that's an effective 24.45% instead of 25%, and the church tax
// (k · ESt) comes on top. Sanity: k = 0, q = 0 gives e / 4 = 25%.
import { round2 } from "../../../js/domain/dates.js";
import { deYearParams } from "./statutory.js";

export function deAbgeltungsteuer({ year, capitalIncome, joint = false, churchTaxPct = 0, foreignTaxCredit = 0 } = {}) {
  const p = deYearParams(+year);
  const income = Math.max(0, +capitalIncome || 0);
  const allowance = joint ? p.sparerPauschbetragJoint : p.sparerPauschbetragSingle;
  const taxable = Math.max(0, round2(income - allowance));
  const k = (+churchTaxPct || 0) / 100;
  const q = Math.max(0, +foreignTaxCredit || 0);

  const incomeTax = Math.max(0, round2((taxable - 4 * q) / (4 + k)));
  const soli = round2(incomeTax * 0.055);
  const churchTax = round2(incomeTax * k);
  const totalTax = round2(incomeTax + soli + churchTax);

  return {
    year: +year,
    capitalIncome: round2(income),
    allowance,
    taxable,
    incomeTax, soli, churchTax, totalTax,
    net: round2(income - totalTax),
    effectiveRatePct: income > 0 ? round2(totalTax / income * 100) : 0,
  };
}
