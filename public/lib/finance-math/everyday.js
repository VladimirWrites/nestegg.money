// Everyday money math: net worth, budgeting, tips, discounts, percentage change, unit pricing,
// hourly/salary conversion, and tax-equivalent yields. Money via round2; rates raw.
import { round2 } from "../../js/domain/dates.js";

// Net worth: assets minus liabilities.
export function netWorth(assets, liabilities) {
  return { netWorth: round2((+assets || 0) - (+liabilities || 0)) };
}

// The 50/30/20 budget split of monthly income (needs / wants / savings).
export function budget503020(monthlyIncome) {
  const m = +monthlyIncome || 0;
  return { needs: round2(m * 0.5), wants: round2(m * 0.3), savings: round2(m * 0.2) };
}

// Tip and split: the tip amount, the total, and the per-person share.
export function tipSplit(billAmount, tipPct, people) {
  const bill = +billAmount || 0, tip = round2(bill * (+tipPct || 0) / 100), total = round2(bill + tip);
  const n = Math.max(1, Math.round(+people || 1));
  return { tip, total, perPerson: round2(total / n) };
}

// A single percentage discount: the amount off and the final price.
export function discount(price, discountPct) {
  const p = +price || 0, off = round2(p * (+discountPct || 0) / 100);
  return { discount: off, finalPrice: round2(p - off) };
}

// Successive (stacked) discounts applied in order: the final price and the effective single rate.
export function successiveDiscounts(price, discountsPct) {
  const p = +price || 0;
  let cur = p;
  for (const d of (Array.isArray(discountsPct) ? discountsPct : [])) cur *= (1 - (+d || 0) / 100);
  return { finalPrice: round2(cur), effectivePct: p !== 0 ? (1 - cur / p) * 100 : null };
}

// Percentage change from one value to another. Null when the starting value is zero.
export function percentageChange(from, to) {
  const a = +from || 0;
  if (a === 0) return { changePct: null };
  return { changePct: ((+to || 0) - a) / a * 100 };
}

// Unit price: price divided by quantity. Null when quantity is zero.
export function unitPrice(price, quantity) {
  const q = +quantity || 0;
  if (q === 0) return { unitPrice: null };
  return { unitPrice: (+price || 0) / q };
}

// Annualize an hourly rate (and the monthly equivalent).
export function hourlyToSalary(hourlyRate, hoursPerWeek = 40, weeksPerYear = 52) {
  const annual = (+hourlyRate || 0) * (+hoursPerWeek || 0) * (+weeksPerYear || 0);
  return { annual: round2(annual), monthly: round2(annual / 12) };
}

// Hourly rate implied by an annual salary.
export function salaryToHourly(annualSalary, hoursPerWeek = 40, weeksPerYear = 52) {
  const hours = (+hoursPerWeek || 0) * (+weeksPerYear || 0);
  if (hours <= 0) return { hourly: null };
  return { hourly: (+annualSalary || 0) / hours };
}

// After-tax yield: a yield reduced by the tax rate. Percents in and out.
export function afterTaxYield(yieldPct, taxRatePct) {
  return { afterTaxPct: (+yieldPct || 0) * (1 - (+taxRatePct || 0) / 100) };
}

// Tax-equivalent yield: the taxable yield that matches a tax-free yield. Percents in and out.
export function taxEquivalentYield(taxFreeYieldPct, taxRatePct) {
  const t = (+taxRatePct || 0) / 100;
  if (t >= 1) return { taxEquivalentPct: null };
  return { taxEquivalentPct: (+taxFreeYieldPct || 0) / (1 - t) };
}
