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

/* ---------- budget categories (the budget's own list, separate from net-worth categories) ---------- */

// The budget's category list, plus any category currently in use that isn't listed.
export function budgetCategoryNames() {
  const b = state.budget || {};
  const names = [...(b.categories || [])];
  (b.expenses || []).forEach((e) => { if (e.group && names.indexOf(e.group) < 0) names.push(e.group); });
  Object.values(b.loanCats || {}).forEach((g) => { if (g && names.indexOf(g) < 0) names.push(g); });
  return names;
}

// Add a uniquely-named category to the budget list; returns the chosen name.
export function addBudgetCategory(baseName = "New category") {
  const b = state.budget || (state.budget = { incomeOverride: null, expenses: [], loanCats: {}, categories: [] });
  if (!Array.isArray(b.categories)) b.categories = [];
  const taken = new Set(b.categories);
  let name = baseName, k = 2;
  while (taken.has(name)) name = baseName + " " + k++;
  b.categories.push(name);
  return name;
}

// How many budget items (expenses + categorized loans) carry this category.
export function budgetCategoryUsage(name) {
  const b = state.budget || {};
  return (b.expenses || []).filter((e) => e.group === name).length
    + Object.values(b.loanCats || {}).filter((v) => v === name).length;
}

// Rename a budget category in the list, on every expense, and in the loan-category map.
export function renameBudgetCategory(oldName, newName) {
  const b = state.budget; if (!b) return;
  const ci = (b.categories || []).indexOf(oldName);
  if (ci >= 0) b.categories[ci] = newName;
  (b.expenses || []).forEach((e) => { if (e.group === oldName) e.group = newName; });
  Object.keys(b.loanCats || {}).forEach((k) => { if (b.loanCats[k] === oldName) b.loanCats[k] = newName; });
}

// Remove a budget category: drop it from the list and untag every expense and loan.
export function removeBudgetCategory(name) {
  const b = state.budget; if (!b) return;
  b.categories = (b.categories || []).filter((c) => c !== name);
  (b.expenses || []).forEach((e) => { if (e.group === name) e.group = ""; });
  Object.keys(b.loanCats || {}).forEach((k) => { if (b.loanCats[k] === name) delete b.loanCats[k]; });
}

// Combined monthly breakdown by category: expenses (by their .group) and loans (by the budget's
// loanCats map, keyed by asset id) grouped together — so a "Transportation" category can hold both
// the car loan and the fuel expense. Uncategorized items fall under "Uncategorized". Each category
// carries its items for the tooltip. Insertion order preserved.
export function budgetCategories() {
  const map = new Map();
  const add = (cat, name, amount, kind) => {
    if (!(amount > 0)) return;
    const c = (cat && String(cat).trim()) || "Uncategorized";
    let g = map.get(c);
    if (!g) { g = { category: c, total: 0, items: [] }; map.set(c, g); }
    g.total = round2(g.total + amount);
    g.items.push({ name, amount, kind });
  };
  for (const e of (state.budget && state.budget.expenses || [])) add(e.group, e.name || "Expense", +e.amount || 0, "expense");
  const lc = (state.budget && state.budget.loanCats) || {};
  for (const l of loanOutflows()) add(lc[l.id], l.name, l.monthly, "loan");
  return [...map.values()];
}

// The monthly budget summary: income (override or salary-derived), fixed loan outflow, total entered
// expenses, the leftover, the savings rate (null when income is not positive), the per-loan
// outflows, and the expenses grouped by category.
export function budgetSummary() {
  const b = state.budget || { incomeOverride: null, expenses: [] };
  const income = round2(b.incomeOverride != null ? (+b.incomeOverride || 0) : salaryIncome());
  const fixed = monthlyLoanOutflow();
  const expenses = round2((b.expenses || []).reduce((s, e) => s + (+e.amount || 0), 0));
  const leftover = round2(income - fixed - expenses);
  const savingsRatePct = income > 0 ? leftover / income * 100 : null;
  return { income, fixed, expenses, leftover, savingsRatePct, loans: loanOutflows(), categories: budgetCategories() };
}
