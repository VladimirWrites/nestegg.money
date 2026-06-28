// Budget: a rough monthly "what's left" — income (from salary) minus loan payments (auto from the
// asset list) minus recurring expenses you enter. Pure reads over the live app state, like the
// other domain modules. No transactions, no forecast coupling.
import { state } from "./store.js";
import { convTo } from "./money.js";
import { round2 } from "./dates.js";
import { loanTerms, outstandingAt } from "./loan.js";

// Sum of every person's net pay for the most recent month present in the salary history, converted
// to the base currency. Zero when there is no salary data.
export function salaryIncome() {
  const people = state.salaries || [];
  let latest = null;
  for (const p of people) for (const e of (p.entries || [])) {
    if (e.ym && (latest === null || e.ym > latest)) latest = e.ym;
  }
  if (latest === null) return 0;
  let sum = 0;
  for (const p of people) for (const e of (p.entries || [])) {
    if (e.ym === latest) sum += convTo(+e.amount || 0, e.ccy || p.ccy || state.baseCcy, state.baseCcy);
  }
  return round2(sum);
}

// The monthly payment on each loan that still has a balance today, named by its asset, in the base
// currency. Paid-off loans are omitted. Used to break the fixed outflow down by loan.
export function loanOutflows() {
  const today = new Date();
  const out = [];
  for (const a of (state.assets || [])) {
    if (!a.loan) continue;
    if (outstandingAt(a.loan, today) <= 0) continue;
    const { M } = loanTerms(a.loan);
    if (M > 0) out.push({ id: a.id, name: a.name || "Loan", monthly: round2(convTo(M, a.loan.ccy || a.ccy || state.baseCcy, state.baseCcy)) });
  }
  return out;
}

// Total monthly loan outflow (sum of the per-loan payments). Zero when there are no active loans.
export function monthlyLoanOutflow() {
  return round2(loanOutflows().reduce((s, l) => s + l.monthly, 0));
}

// The monthly budget summary: income (override or salary-derived), fixed loan outflow, total entered
// expenses, the leftover, and the savings rate (null when income is not positive).
export function budgetSummary() {
  const b = state.budget || { incomeOverride: null, expenses: [] };
  const income = round2(b.incomeOverride != null ? (+b.incomeOverride || 0) : salaryIncome());
  const fixed = monthlyLoanOutflow();
  const expenses = round2((b.expenses || []).reduce((s, e) => s + (+e.amount || 0), 0));
  const leftover = round2(income - fixed - expenses);
  const savingsRatePct = income > 0 ? leftover / income * 100 : null;
  return { income, fixed, expenses, leftover, savingsRatePct, loans: loanOutflows() };
}
