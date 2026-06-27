// Long-term asset valuation: depreciation/appreciation and net-of-loan value. Pure.
import { parseDate, YEAR_MS } from "./dates.js";
import { outstandingAt } from "./loan.js";

// Compounding core: value grows (up) or shrinks at `rate` (per year, decimal) over `years`.
// Pure; rate is clamped (appreciation up to 5x/yr, depreciation up to 99%/yr). Shared by
// compoundedValue here and the depreciate() calculator in lib/finance-math.js.
export function compoundOver(value, rate, years, up) {
  const v = +value || 0;
  if (!(years > 0)) return v;
  const r = Math.min(Math.max(+rate || 0, 0), up ? 5 : 0.99);
  return v * Math.pow(up ? 1 + r : 1 - r, years);
}

// Compounding between two dates: value grows (up) or shrinks at `rate`/yr.
export function compoundedValue(price, rate, fromDate, date, up) {
  const d0 = parseDate(fromDate);
  if (!d0) return +price || 0;
  return compoundOver(price, rate, (date - d0) / YEAR_MS, up);
}

// Gross (pre-loan) value on a date: compounds up/down over time, or flat market value.
export function assetGrossAt(a, date) {
  return a.depreciates ? compoundedValue(a.value, a.rate, a.date, date, a.up) : +a.value || 0;
}

// Net contribution to net worth: gross value minus any outstanding loan balance.
export function assetNetAt(a, date) {
  return assetGrossAt(a, date) - (a.loan ? outstandingAt(a.loan, date) : 0);
}

// When the asset starts counting toward net worth: the earliest of its purchase
// (depreciation) date and its loan start date. Plain value assets use their own date.
export function assetOwnedFrom(a) {
  const c = [];
  if (a.depreciates) { const d = parseDate(a.date); if (d) c.push(+d); }
  if (a.loan) { const d = parseDate(a.loan.startDate); if (d) c.push(+d); }
  if (!c.length) { const d = parseDate(a.date); if (d) c.push(+d); }
  return c.length ? new Date(Math.min(...c)) : null;
}
