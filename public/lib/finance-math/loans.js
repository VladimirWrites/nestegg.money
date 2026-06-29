// Loan & debt calculators composed over the shared schedule engine (js/domain/loan.js, which is
// left untouched): amortization (with detail/pagination and multi-rate steps), payoff effect,
// refinance break-even, affordability, and multi-debt payoff. Money via round2.
import { round2, parseDate } from "../../js/domain/dates.js";
import { loanTerms, buildSchedule } from "../../js/domain/loan.js";
import { annuityFactorPV } from "./annuity.js";

// Aggregate a monthly schedule into per-calendar-year totals — a compact view for agents and
// UIs that avoids returning hundreds of monthly rows. endBalance is the balance at year end.
export function scheduleByYear(schedule) {
  const out = [];
  const idx = new Map();
  for (const row of (schedule || [])) {
    const year = new Date(row.date).getUTCFullYear();
    let y = idx.get(year);
    if (!y) { y = { year, interest: 0, principal: 0, extra: 0, payments: 0, endBalance: 0 }; idx.set(year, y); out.push(y); }
    y.interest = round2(y.interest + (row.interest || 0));
    y.principal = round2(y.principal + (row.principal || 0));
    y.extra = round2(y.extra + (row.extra || 0));
    if (row.type === "payment") y.payments += 1;
    y.endBalance = row.balance;
  }
  return out;
}

// Amortization schedule + summary for a loan object:
// { amount, rate (annual %), mode: "term"|"payment", termYears|payment, startDate,
//   extra: [{date, amount}], fixedUntil?, rateSteps?, detail?, offset?, limit? }.
export function amortization(loan) {
  const steps = (loan.rateSteps || [])
    .map((s) => ({ from: parseDate(s.date || s.from), rate: +s.rate || 0 }))
    .filter((s) => s.from).sort((a, b) => a.from - b.from);
  if (steps.length) return amortizationStepped(loan, steps);
  const { M, n } = loanTerms(loan);
  const schedule = buildSchedule(loan);
  return summarizeSchedule(loan, schedule, M, isFinite(n) ? n : null);
}

// Build the return object from a schedule. detail controls output size: summary/yearly (default)
// stay compact (yearly is always present); monthly returns the full row list, paginated with
// offset/limit. Shared by the single-rate and multi-rate paths.
function summarizeSchedule(loan, schedule, monthlyPayment, scheduledMonths) {
  const pays = schedule.filter((r) => r.type === "payment");
  const extras = schedule.filter((r) => r.type === "extra");
  const totalInterest = round2(pays.reduce((a, r) => a + (r.interest || 0), 0));
  const totalPaid = round2(pays.reduce((a, r) => a + (r.payment || 0), 0) + extras.reduce((a, r) => a + (r.extra || 0), 0));
  const last = schedule[schedule.length - 1];
  const base = {
    monthlyPayment: round2(monthlyPayment),
    scheduledMonths,
    payments: pays.length,
    totalInterest,
    totalPaid,
    payoffDate: last ? last.date : null,
    yearly: scheduleByYear(schedule),
  };
  if ((loan.detail || "summary") !== "monthly") return base;
  const total = schedule.length;
  const offset = Math.max(0, Math.round(+loan.offset || 0));
  const limit = loan.limit == null ? total : Math.max(0, Math.round(+loan.limit || 0));
  const slice = schedule.slice(offset, offset + limit);
  const end = offset + slice.length;
  return { ...base, schedule: slice, scheduleTotal: total, nextOffset: end < total ? end : null };
}

// Multi-rate loan (e.g. a German Zinsbindung followed by an Anschlussfinanzierung): the
// installment from the initial rate/term is held, and at each step date the outstanding balance
// continues at the new rate. Composed by re-running the shared engine per rate segment.
function amortizationStepped(loan, steps) {
  const { M } = loanTerms(loan);
  const payment = round2(M);
  let segStart = loan.startDate, segRate = +loan.rate || 0, bal = +loan.amount || 0;
  const rows = [];
  for (let s = 0; s <= steps.length; s++) {
    const stopAt = s < steps.length ? steps[s].from : null;
    const startD = parseDate(segStart);
    // Only the extras that fall inside this segment, so they aren't double-applied downstream.
    const extra = (loan.extra || []).filter((e) => {
      const d = parseDate(e.date);
      return d && d >= startD && (!stopAt || d < stopAt);
    });
    const seg = buildSchedule({ amount: bal, rate: segRate, mode: "payment", payment, startDate: segStart, fixedUntil: loan.fixedUntil, extra });
    const kept = stopAt ? seg.filter((r) => r.date < stopAt) : seg;
    rows.push(...kept);
    const endBalance = kept.length ? kept[kept.length - 1].balance : bal;
    if (!stopAt || endBalance <= 0.005) break;
    bal = endBalance;
    segStart = new Date(stopAt).toISOString().slice(0, 10);
    segRate = steps[s].rate;
  }
  return summarizeSchedule(loan, rows, payment, null);
}

// Effect of an extra fixed monthly payment: months and interest saved vs the baseline.
export function loanPayoff(loan, extraMonthly) {
  const base = amortization(loan);
  const { M } = loanTerms(loan);
  const accel = amortization({ ...loan, mode: "payment", payment: round2((+M || 0) + (+extraMonthly || 0)) });
  return {
    baseline: { months: base.payments, totalInterest: base.totalInterest, payoffDate: base.payoffDate },
    accelerated: { months: accel.payments, totalInterest: accel.totalInterest, payoffDate: accel.payoffDate },
    monthsSaved: base.payments - accel.payments,
    interestSaved: round2(base.totalInterest - accel.totalInterest),
  };
}

// Refinance break-even: monthly saving (current - new payment), whole months to recoup the
// closing costs, and (if remainingMonths given) the net saving over the remaining term.
export function refiBreakeven(closingCosts, currentPayment, newPayment, remainingMonths = null) {
  const monthlySaving = round2((+currentPayment || 0) - (+newPayment || 0));
  const cost = +closingCosts || 0;
  const breakevenMonths = monthlySaving > 0 ? Math.ceil(cost / monthlySaving) : null;
  const lifetimeSaving = remainingMonths == null ? null : round2(monthlySaving * (+remainingMonths || 0) - cost);
  return { monthlySaving, breakevenMonths, lifetimeSaving };
}

// How much house the income supports. The DTI cap on gross monthly income (less existing monthly
// debts) is the most you can put toward the payment; the present value of that annuity at the
// given rate and term is the max loan, and adding the down payment gives the max price.
export function mortgageAffordability({ annualIncome, dtiPct, rate, termYears, monthlyDebts = 0, downPayment = 0 } = {}) {
  const monthlyIncome = (+annualIncome || 0) / 12;
  const maxMonthlyPayment = round2(Math.max(0, monthlyIncome * (+dtiPct || 0) / 100 - (+monthlyDebts || 0)));
  const i = (+rate || 0) / 100 / 12, n = Math.round((+termYears || 0) * 12);
  const factor = n <= 0 ? 0 : annuityFactorPV(i, n);
  const maxLoan = round2(maxMonthlyPayment * factor);
  return { maxMonthlyPayment, maxLoan, maxHomePrice: round2(maxLoan + (+downPayment || 0)) };
}

// Debt payoff plan across several debts under a fixed total monthly budget. Each month every
// balance accrues interest, the minimums are paid, then the leftover attacks one debt by the
// chosen method: "avalanche" (highest rate first) or "snowball" (smallest balance first). Returns
// months to debt-free, total interest, and the payoff order; insolvent when the budget can't keep
// up with the minimums and interest.
export function debtPayoff(debts, monthlyBudget, method = "avalanche") {
  const list = (Array.isArray(debts) ? debts : []).map((d, idx) => ({
    name: d && d.name != null ? d.name : String(idx + 1),
    balance: +(d && d.balance) || 0,
    rate: +(d && d.rate) || 0,
    min: +(d && d.minPayment) || 0,
  }));
  const budget = +monthlyBudget || 0;
  const active = () => list.filter((d) => d.balance > 0.005);
  if (!list.length) return { months: 0, totalInterest: 0, payoffOrder: [] };
  if (budget <= 0) return { months: null, totalInterest: null, payoffOrder: [], insolvent: true };

  const payoffOrder = [];
  let totalInterest = 0, months = 0;
  const MAX_MONTHS = 1200; // 100 years: a budget that never gets ahead is treated as insolvent
  while (active().length && months < MAX_MONTHS) {
    months++;
    for (const d of active()) {
      const interest = round2(d.balance * d.rate / 100 / 12);
      d.balance = round2(d.balance + interest);
      totalInterest += interest;
    }
    let pool = budget;
    for (const d of active()) {
      const pay = Math.min(d.min, d.balance);
      d.balance = round2(d.balance - pay);
      pool = round2(pool - pay);
    }
    if (pool < -0.005) return { months: null, totalInterest: null, payoffOrder, insolvent: true };
    const targets = active().slice().sort((a, b) => method === "snowball" ? a.balance - b.balance : b.rate - a.rate);
    for (const d of targets) {
      if (pool <= 0.005) break;
      const pay = Math.min(pool, d.balance);
      d.balance = round2(d.balance - pay);
      pool = round2(pool - pay);
    }
    for (const d of list) {
      if (d.balance <= 0.005 && !payoffOrder.includes(d.name)) payoffOrder.push(d.name);
    }
  }
  if (active().length) return { months: null, totalInterest: null, payoffOrder, insolvent: true };
  return { months, totalInterest: round2(totalInterest), payoffOrder };
}
