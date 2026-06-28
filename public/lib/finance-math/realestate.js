// Real-estate investment ratios: cap rate, cash-on-cash, net operating income, gross rent
// multiplier, and debt service coverage. Percents in/out where noted; raw ratios otherwise.

// Capitalization rate: NOI as a percent of property value.
export function capRate(noiAmount, propertyValue) {
  const v = +propertyValue || 0;
  if (v <= 0) return { capRatePct: null };
  return { capRatePct: (+noiAmount || 0) / v * 100 };
}

// Cash-on-cash return: annual pre-tax cash flow as a percent of the cash invested.
export function cashOnCash(annualCashFlow, cashInvested) {
  const c = +cashInvested || 0;
  if (c <= 0) return { cashOnCashPct: null };
  return { cashOnCashPct: (+annualCashFlow || 0) / c * 100 };
}

// Net operating income: gross rental income less vacancy and operating expenses.
export function noi(grossRentalIncome, vacancyPct, operatingExpenses) {
  const gross = (+grossRentalIncome || 0) * (1 - (+vacancyPct || 0) / 100);
  return { noi: gross - (+operatingExpenses || 0) };
}

// Gross rent multiplier: price divided by gross annual rent.
export function grossRentMultiplier(price, grossAnnualRent) {
  const r = +grossAnnualRent || 0;
  if (r <= 0) return { grm: null };
  return { grm: (+price || 0) / r };
}

// Debt service coverage ratio: NOI divided by annual debt service.
export function dscr(noiAmount, annualDebtService) {
  const d = +annualDebtService || 0;
  if (d <= 0) return { dscr: null };
  return { dscr: (+noiAmount || 0) / d };
}
