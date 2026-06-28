// Tax, pricing, and currency: progressive brackets, margin/markup, VAT, German net salary, and
// FX. No jurisdiction or rate is baked in — statutory figures and rates are inputs. Money via
// round2; percentages raw.
import { round2 } from "../../js/domain/dates.js";

// Convert an amount by an explicit rate (units of target per unit of source). No lookups.
export function fxConvert(amount, rate) {
  return (+amount || 0) * (+rate || 0);
}

// Progressive tax from caller-supplied brackets (no jurisdiction or year baked in). Each bracket
// is { upTo, ratePct }; the final bracket may omit upTo (or set it null) to run to infinity.
// Returns total tax, effective rate, and the marginal rate the income lands in. Percents.
export function taxFromBrackets(income, brackets) {
  const inc = +income || 0;
  const bands = (Array.isArray(brackets) ? brackets : [])
    .map((b) => ({ upTo: b && b.upTo != null ? +b.upTo : Infinity, ratePct: +(b && b.ratePct) || 0 }))
    .sort((a, b) => a.upTo - b.upTo);
  let tax = 0, lower = 0, marginalRatePct = 0;
  for (const band of bands) {
    if (inc <= lower) break;
    const taxable = Math.min(inc, band.upTo) - lower;
    if (taxable > 0) { tax += taxable * band.ratePct / 100; marginalRatePct = band.ratePct; }
    lower = band.upTo;
  }
  tax = round2(tax);
  return { tax, effectiveRatePct: inc > 0 ? tax / inc * 100 : 0, marginalRatePct };
}

// Margin/markup converter. Supply any one of {cost, price} plus one of {marginPct, markupPct}
// (or both of cost+price) and it fills in the rest. margin = profit/price; markup = profit/cost.
export function marginMarkup({ cost, price, marginPct, markupPct } = {}) {
  let c = cost != null ? +cost : null, p = price != null ? +price : null;
  if (c != null && p == null) {
    if (markupPct != null) p = c * (1 + (+markupPct) / 100);
    else if (marginPct != null) p = c / (1 - (+marginPct) / 100);
  } else if (p != null && c == null) {
    if (markupPct != null) c = p / (1 + (+markupPct) / 100);
    else if (marginPct != null) c = p * (1 - (+marginPct) / 100);
  }
  if (c == null || p == null) return { cost: null, price: null, marginPct: null, markupPct: null, profit: null };
  const profit = p - c;
  return {
    cost: round2(c), price: round2(p), profit: round2(profit),
    marginPct: p !== 0 ? profit / p * 100 : null,
    markupPct: c !== 0 ? profit / c * 100 : null,
  };
}

// German net (Netto) salary from gross (Brutto). Holds NO tax tables of its own: the caller
// passes the current year's statutory figures (income tax / Lohnsteuer, Soli, church-tax rate,
// the four employee social rates, and the two contribution ceilings). Pension and unemployment
// are capped at pensionCeiling; health and care at healthCeiling. Money via round2.
export function germanNetSalary({
  gross, incomeTax = 0, soli = 0, churchTaxPct = 0,
  pensionPct = 0, unemploymentPct = 0, healthPct = 0, carePct = 0,
  pensionCeiling = Infinity, healthCeiling = Infinity,
} = {}) {
  const g = +gross || 0;
  const rvBase = Math.min(g, +pensionCeiling || Infinity);
  const kvBase = Math.min(g, +healthCeiling || Infinity);
  const pension = round2(rvBase * (+pensionPct || 0) / 100);
  const unemployment = round2(rvBase * (+unemploymentPct || 0) / 100);
  const health = round2(kvBase * (+healthPct || 0) / 100);
  const care = round2(kvBase * (+carePct || 0) / 100);
  const total = round2(pension + unemployment + health + care);
  const tax = +incomeTax || 0, sol = +soli || 0;
  const churchTax = round2(tax * (+churchTaxPct || 0) / 100);
  const totalDeductions = round2(tax + sol + churchTax + total);
  return {
    gross: round2(g), incomeTax: round2(tax), soli: round2(sol), churchTax,
    contributions: { pension, unemployment, health, care, total },
    totalDeductions, net: round2(g - totalDeductions),
  };
}

// Value-added tax (MwSt/USt, sales tax). With a net price (default) it adds the tax; with
// inclusive=true it treats the amount as gross and extracts the tax. The rate is always an input.
export function vat(amount, ratePct, inclusive = false) {
  const a = +amount || 0, r = (+ratePct || 0) / 100;
  if (inclusive) {
    const net = a / (1 + r);
    return { net: round2(net), tax: round2(a - net), gross: round2(a) };
  }
  const tax = a * r;
  return { net: round2(a), tax: round2(tax), gross: round2(a + tax) };
}
