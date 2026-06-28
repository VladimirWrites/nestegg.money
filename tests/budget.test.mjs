import { test } from "node:test";
import assert from "node:assert/strict";
import { setState } from "../public/js/domain/store.js";
import { salaryIncome, monthlyLoanOutflow, loanOutflows, budgetCategories, budgetSummary } from "../public/js/domain/budget.js";

const near = (a, b, eps = 1e-2) => assert.ok(Math.abs(a - b) <= eps, `${a} !~= ${b}`);

const base = (over = {}) => ({
  baseCcy: "EUR", fxRates: { EUR: 1, USD: 1.1 }, fxHist: {}, prices: {},
  assets: [], snapshots: [], salaries: [],
  budget: { incomeOverride: null, expenses: [] },
  ...over,
});

// An active 30-year mortgage started in 2024 (still has a balance today).
const activeMortgage = { id: "m1", name: "Home", ccy: "EUR", loan: { amount: 200000, rate: 6, mode: "term", termYears: 30, startDate: "2024-04-01" } };
// A 1-year loan from 2020, fully paid off well before today.
const paidOff = { id: "m2", name: "Old", ccy: "EUR", loan: { amount: 1000, rate: 5, mode: "term", termYears: 1, startDate: "2020-01-01" } };

test("salaryIncome: sums the latest month across people, in base currency", () => {
  setState(base({ salaries: [
    { id: "p1", name: "A", ccy: "EUR", entries: [{ id: "e1", ym: "2026-05", amount: 3000 }, { id: "e2", ym: "2026-06", amount: 3100 }] },
    { id: "p2", name: "B", ccy: "EUR", entries: [{ id: "e3", ym: "2026-06", amount: 2500 }] },
  ] }));
  assert.equal(salaryIncome(), 5600); // latest month is 2026-06: 3100 + 2500
});

test("salaryIncome: converts a foreign-currency entry to base", () => {
  setState(base({ salaries: [
    { id: "p1", name: "A", ccy: "USD", entries: [{ id: "e1", ym: "2026-06", amount: 1100, ccy: "USD" }] },
  ] }));
  near(salaryIncome(), 1000, 1e-6); // 1100 USD / 1.1 = 1000 EUR
});

test("salaryIncome: zero when there is no salary data", () => {
  setState(base());
  assert.equal(salaryIncome(), 0);
});

test("monthlyLoanOutflow: sums active loans' monthly payment, ignoring paid-off ones", () => {
  setState(base({ assets: [activeMortgage] }));
  near(monthlyLoanOutflow(), 1199.10, 1e-2);
  setState(base({ assets: [activeMortgage, paidOff] }));
  near(monthlyLoanOutflow(), 1199.10, 1e-2); // paid-off loan adds nothing
  setState(base());
  assert.equal(monthlyLoanOutflow(), 0);
});

test("loanOutflows: one named entry per active loan, paid-off ones omitted", () => {
  setState(base({ assets: [activeMortgage, paidOff] }));
  const ls = loanOutflows();
  assert.equal(ls.length, 1);
  assert.equal(ls[0].name, "Home");
  near(ls[0].monthly, 1199.10, 1e-2);
  assert.equal(budgetSummary().loans.length, 1); // surfaced on the summary too
});

test("budgetSummary: leftover = income - fixed - expenses, with savings rate", () => {
  setState(base({
    salaries: [{ id: "p1", name: "A", ccy: "EUR", entries: [{ id: "e1", ym: "2026-06", amount: 5600 }] }],
    assets: [activeMortgage],
    budget: { incomeOverride: null, expenses: [{ id: "x1", name: "Rent", amount: 2000 }, { id: "x2", name: "Food", amount: 500 }] },
  }));
  const s = budgetSummary();
  near(s.income, 5600, 1e-2);
  near(s.fixed, 1199.10, 1e-2);
  assert.equal(s.expenses, 2500);
  near(s.leftover, 5600 - 1199.10 - 2500, 1e-2);
  near(s.savingsRatePct, s.leftover / s.income * 100, 1e-6);
});

test("budgetCategories: expenses (by group) and loans (by loanCats) grouped together", () => {
  setState(base({
    assets: [activeMortgage], // "Home" loan, ~1199.10/mo
    budget: {
      incomeOverride: null,
      loanCats: { m1: "Housing" }, // put the mortgage under Housing
      expenses: [
        { id: "x1", name: "Rent help", group: "Housing", amount: 300 },
        { id: "x2", name: "Groceries", group: "Food", amount: 600 },
        { id: "x3", name: "Misc", amount: 50 }, // no group -> Uncategorized
      ],
    },
  }));
  const cats = budgetCategories();
  const housing = cats.find((c) => c.category === "Housing");
  near(housing.total, 300 + 1199.10, 1e-2);      // expense + the mortgage loan
  assert.equal(housing.items.length, 2);          // Rent help (expense) + Home (loan)
  assert.ok(housing.items.some((i) => i.kind === "loan" && i.name === "Home"));
  assert.ok(cats.some((c) => c.category === "Uncategorized")); // the un-grouped Misc
  assert.equal(budgetSummary().categories.length, 3); // Housing, Food, Uncategorized
});

test("budgetSummary: income override replaces the salary-derived income", () => {
  setState(base({
    salaries: [{ id: "p1", name: "A", ccy: "EUR", entries: [{ id: "e1", ym: "2026-06", amount: 5600 }] }],
    budget: { incomeOverride: 4000, expenses: [] },
  }));
  assert.equal(budgetSummary().income, 4000);
});

test("budgetSummary: negative leftover allowed; null savings rate when income is zero", () => {
  setState(base({ budget: { incomeOverride: null, expenses: [{ id: "x1", name: "Rent", amount: 1500 }] } }));
  const s = budgetSummary();
  assert.equal(s.income, 0);
  assert.equal(s.leftover, -1500);
  assert.equal(s.savingsRatePct, null);
});
