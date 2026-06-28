// Loans & credit: APR with fees, interest-only payment, balloon loans, LTV/DTI ratios, credit-card
// payoff time, mortgage-points break-even, and biweekly acceleration. Percents in; money via round2.
import { round2 } from "../../js/domain/dates.js";

// Level monthly payment that amortizes `principal` at per-period rate `iPer` over n periods.
const pmt = (principal, iPer, n) => (n <= 0 ? 0 : (iPer === 0 ? principal / n : principal * iPer / (1 - Math.pow(1 + iPer, -n))));

// Effective APR including upfront fees: the payment is set by the note rate on the full amount,
// but you only receive (amount - fees), so the rate that prices that payment stream to the net
// proceeds is higher. Solved by bisection. Annual percent out.
export function loanAPR(amount, ratePct, termMonths, fees = 0) {
  const A = +amount || 0, i = (+ratePct || 0) / 100 / 12, n = Math.round(+termMonths || 0);
  if (n <= 0) return { aprPct: null };
  const payment = pmt(A, i, n);
  const net = A - (+fees || 0);
  if (net <= 0 || payment <= 0) return { aprPct: null };
  const f = (r) => (r === 0 ? payment * n : payment * (1 - Math.pow(1 + r, -n)) / r) - net;
  let lo = 1e-9, hi = 1, flo = f(lo), fhi = f(hi);
  if (flo * fhi > 0) return { aprPct: +ratePct || 0 };
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2, fmid = f(mid);
    if (flo * fmid < 0) { hi = mid; } else { lo = mid; flo = fmid; }
  }
  return { aprPct: ((lo + hi) / 2) * 12 * 100 };
}

// Interest-only monthly payment on a balance.
export function interestOnlyPayment(amount, ratePct) {
  return { payment: round2((+amount || 0) * (+ratePct || 0) / 100 / 12) };
}

// Balloon loan: payment based on a longer amortization, with the balloon being the outstanding
// balance due after the (shorter) balloon term.
export function balloonLoan(amount, ratePct, balloonMonths, amortMonths) {
  const A = +amount || 0, i = (+ratePct || 0) / 100 / 12;
  const namo = Math.round(+amortMonths || 0), nb = Math.round(+balloonMonths || 0);
  if (namo <= 0 || nb <= 0) return { payment: null, balloon: null };
  const payment = pmt(A, i, namo);
  const grow = Math.pow(1 + i, nb);
  const bal = i === 0 ? A - payment * nb : A * grow - payment * ((grow - 1) / i);
  return { payment: round2(payment), balloon: round2(Math.max(0, bal)) };
}

// Loan-to-value ratio, percent.
export function ltv(loanAmount, propertyValue) {
  const v = +propertyValue || 0;
  if (v <= 0) return { ltvPct: null };
  return { ltvPct: (+loanAmount || 0) / v * 100 };
}

// Debt-to-income ratio, percent.
export function dti(monthlyDebt, grossMonthlyIncome) {
  const inc = +grossMonthlyIncome || 0;
  if (inc <= 0) return { dtiPct: null };
  return { dtiPct: (+monthlyDebt || 0) / inc * 100 };
}

// Credit-card payoff: months to clear a balance at a fixed monthly payment, plus interest paid.
// Null when the payment cannot cover the first month's interest (the balance would never fall).
export function creditCardPayoff(balance, aprPct, monthlyPayment) {
  let bal = +balance || 0;
  const i = (+aprPct || 0) / 100 / 12, pay = +monthlyPayment || 0;
  if (bal <= 0) return { months: 0, totalInterest: 0, totalPaid: 0 };
  if (pay <= bal * i) return { months: null, totalInterest: null, totalPaid: null };
  let months = 0, totalInterest = 0;
  const MAX = 1200;
  while (bal > 0.005 && months < MAX) {
    months++;
    const interest = round2(bal * i);
    totalInterest = round2(totalInterest + interest);
    bal = round2(bal + interest - pay);
  }
  if (bal > 0.005) return { months: null, totalInterest: null, totalPaid: null };
  return { months, totalInterest, totalPaid: round2((+balance || 0) + totalInterest) };
}

// Mortgage-points break-even: the upfront cost of buying down the rate, the monthly payment saving,
// and the whole months to recoup the cost.
export function pointsBreakeven(loanAmount, ratePct, termMonths, pointsPct, reducedRatePct) {
  const A = +loanAmount || 0, n = Math.round(+termMonths || 0);
  const monthlySaving = round2(pmt(A, (+ratePct || 0) / 100 / 12, n) - pmt(A, (+reducedRatePct || 0) / 100 / 12, n));
  const cost = round2(A * (+pointsPct || 0) / 100);
  const breakevenMonths = monthlySaving > 0 ? Math.ceil(cost / monthlySaving) : null;
  return { cost, monthlySaving, breakevenMonths };
}

// Biweekly payoff: paying half the monthly payment every two weeks (26 payments a year ≈ 13 monthly
// payments) pays the loan off early. Returns the biweekly payment and the time/interest saved.
export function biweeklyPayoff(amount, ratePct, termMonths) {
  const A = +amount || 0, n = Math.round(+termMonths || 0);
  const M = pmt(A, (+ratePct || 0) / 100 / 12, n);
  const baseInterest = M * n - A;
  const iB = (+ratePct || 0) / 100 / 26, biPay = M / 2;
  let bal = A, periods = 0;
  const MAX = 2000;
  while (bal > 0.005 && periods < MAX) { periods++; bal = bal + bal * iB - biPay; }
  const biInterest = biPay * periods - A;
  const equivMonths = periods / 26 * 12;
  return { biweeklyPayment: round2(biPay), monthsSaved: round2(n - equivMonths), interestSaved: round2(baseInterest - biInterest) };
}
