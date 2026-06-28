// Business & corporate-finance calculators: WACC, break-even units, contribution margin, liquidity
// ratios, and return on equity/assets. Percents in/out where noted; raw ratios otherwise.

// Weighted average cost of capital: E/V*re + D/V*rd*(1-tax). Percents in and out.
export function wacc(equity, debt, costEquityPct, costDebtPct, taxRatePct) {
  const E = +equity || 0, D = +debt || 0, V = E + D;
  if (V <= 0) return { waccPct: null };
  const re = +costEquityPct || 0, rd = +costDebtPct || 0, t = (+taxRatePct || 0) / 100;
  return { waccPct: E / V * re + D / V * rd * (1 - t) };
}

// Break-even volume: fixed costs divided by the per-unit contribution (price - variable cost), and
// the revenue at that volume. Null when price does not exceed the variable cost.
export function breakEvenUnits(fixedCosts, pricePerUnit, variableCostPerUnit) {
  const contribution = (+pricePerUnit || 0) - (+variableCostPerUnit || 0);
  if (contribution <= 0) return { units: null, revenue: null };
  const units = (+fixedCosts || 0) / contribution;
  return { units, revenue: units * (+pricePerUnit || 0) };
}

// Contribution margin per unit and as a percent of price.
export function contributionMargin(pricePerUnit, variableCostPerUnit) {
  const p = +pricePerUnit || 0, cm = p - (+variableCostPerUnit || 0);
  return { contributionMargin: cm, ratioPct: p !== 0 ? cm / p * 100 : null };
}

// Current ratio: current assets over current liabilities.
export function currentRatio(currentAssets, currentLiabilities) {
  const l = +currentLiabilities || 0;
  if (l <= 0) return { currentRatio: null };
  return { currentRatio: (+currentAssets || 0) / l };
}

// Quick (acid-test) ratio: (current assets - inventory) over current liabilities.
export function quickRatio(currentAssets, inventory, currentLiabilities) {
  const l = +currentLiabilities || 0;
  if (l <= 0) return { quickRatio: null };
  return { quickRatio: ((+currentAssets || 0) - (+inventory || 0)) / l };
}

// Return on equity, percent.
export function roe(netIncome, equity) {
  const e = +equity || 0;
  if (e <= 0) return { roePct: null };
  return { roePct: (+netIncome || 0) / e * 100 };
}

// Return on assets, percent.
export function roa(netIncome, totalAssets) {
  const a = +totalAssets || 0;
  if (a <= 0) return { roaPct: null };
  return { roaPct: (+netIncome || 0) / a * 100 };
}
