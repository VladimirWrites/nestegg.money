// Personal-planning calculators: FIRE target, portfolio longevity, emergency fund, savings rate.
// Percents in; money via round2.
import { round2 } from "../../js/domain/dates.js";

// Fraction of income saved (savings / income). Returns a decimal, or null if income <= 0.
export function savingsRate(income, savings) {
  const inc = +income || 0;
  if (inc <= 0) return null;
  return (+savings || 0) / inc;
}

// FIRE target and (optionally) years to reach it. The target is the nest egg whose safe
// withdrawal covers annual spend: annualSpend / (withdrawalRate). yearsToFI solves the
// ordinary-annuity growth of currentNestEgg + annualContribution until it reaches target;
// null when the target is unreachable. All percents in; target/gap rounded to cents.
export function fireNumber({ annualSpend, withdrawalRatePct = 4, currentNestEgg = 0, annualContribution = 0, annualRatePct = 0 } = {}) {
  const spend = +annualSpend || 0, wr = (+withdrawalRatePct || 0) / 100;
  const target = wr > 0 ? round2(spend / wr) : null;
  if (target === null) return { target: null, gap: null, yearsToFI: null };
  const P = +currentNestEgg || 0, C = +annualContribution || 0, r = (+annualRatePct || 0) / 100;
  const gap = round2(Math.max(0, target - P));
  let yearsToFI = null;
  if (gap <= 0) {
    yearsToFI = 0;
  } else if (r === 0) {
    if (C > 0) yearsToFI = round2((target - P) / C);
  } else {
    const k = C / r, num = target + k, den = P + k;
    if (num > 0 && den > 0) {
      const t = Math.log(num / den) / Math.log(1 + r);
      if (isFinite(t) && t >= 0) yearsToFI = round2(t);
    }
  }
  return { target, gap, yearsToFI };
}

// How long a balance lasts while withdrawing from it. Each year the balance grows at
// annualRatePct, then the withdrawal (stepping up by withdrawalGrowthPct annually) is taken.
// Returns the year the balance is exhausted; { years: null, sustainable: true } when it still
// stands after 200 years (the withdrawal never outpaces the growth). Percents in.
export function portfolioLongevity({ balance, annualWithdrawal, annualRatePct, withdrawalGrowthPct = 0 } = {}) {
  let bal = +balance || 0, w = +annualWithdrawal || 0;
  const r = (+annualRatePct || 0) / 100, g = (+withdrawalGrowthPct || 0) / 100;
  if (bal <= 0) return { years: 0, sustainable: false };
  const MAX_YEARS = 200;
  for (let y = 1; y <= MAX_YEARS; y++) {
    bal = bal * (1 + r) - w;
    if (bal <= 0) return { years: y, sustainable: false };
    w *= 1 + g;
  }
  return { years: null, sustainable: true };
}

// Months of runway: liquid savings divided by monthly expenses. Null when expenses <= 0.
export function emergencyFund(liquidSavings, monthlyExpenses) {
  const exp = +monthlyExpenses || 0;
  if (exp <= 0) return { months: null };
  return { months: round2((+liquidSavings || 0) / exp) };
}
