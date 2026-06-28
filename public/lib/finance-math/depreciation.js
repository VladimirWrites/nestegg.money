// Accelerated and usage-based depreciation methods (the straight-line method lives in growth.js).
// All return the depreciation for the given year/period and the remaining book value. Money via
// round2.
import { round2 } from "../../js/domain/dates.js";

// Declining-balance: a fixed percent of the reducing book value each year.
export function decliningBalanceDepreciation(value, ratePct, year) {
  const v = +value || 0, r = (+ratePct || 0) / 100, y = Math.max(1, Math.round(+year || 1));
  const bookStart = v * Math.pow(1 - r, y - 1);
  const depreciation = bookStart * r;
  return { depreciation: round2(depreciation), bookValue: round2(bookStart - depreciation) };
}

// Double-declining-balance: rate = 2/usefulYears of the book value, not depreciating below salvage.
export function doubleDecliningDepreciation(value, usefulYears, year, salvage = 0) {
  const v = +value || 0, u = Math.max(1, Math.round(+usefulYears || 1)), y = Math.max(1, Math.round(+year || 1));
  const s = +salvage || 0, r = 2 / u;
  const bookStart = v * Math.pow(1 - r, y - 1);
  const depreciation = Math.max(0, Math.min(bookStart * r, bookStart - s));
  return { depreciation: round2(depreciation), bookValue: round2(bookStart - depreciation) };
}

// Sum-of-the-years'-digits: depreciable base weighted by (remaining life / sum-of-digits).
export function sumOfYearsDigits(value, salvage, usefulYears, year) {
  const v = +value || 0, s = +salvage || 0, u = Math.max(1, Math.round(+usefulYears || 1)), y = Math.max(1, Math.round(+year || 1));
  const syd = u * (u + 1) / 2;
  const depreciation = y <= u ? (v - s) * (u - y + 1) / syd : 0;
  // Book value after `year` complete years.
  let cumulative = 0;
  for (let k = 1; k <= Math.min(y, u); k++) cumulative += (v - s) * (u - k + 1) / syd;
  return { depreciation: round2(depreciation), bookValue: round2(v - cumulative) };
}

// Units-of-production: depreciable base spread over total expected units, charged by usage.
export function unitsOfProductionDepreciation(value, salvage, totalUnits, unitsThisPeriod) {
  const total = +totalUnits || 0;
  if (total <= 0) return { depreciation: null };
  const perUnit = ((+value || 0) - (+salvage || 0)) / total;
  return { depreciation: round2(perUnit * (+unitsThisPeriod || 0)) };
}
