// Single source of truth for nestegg's deterministic finance math.
//
// Every export here is a PURE function of its inputs: no app state, no network, no live
// prices, no FX lookups. Any currency conversion takes the rate as an explicit parameter.
// Money uses the app's existing rounding convention: round half-up to 2 decimals (round2,
// with a tiny +1e-9 nudge to counter float drift). These functions are imported both by the
// site and by the calculator endpoints / MCP tools, so a formula is defined exactly once.
//
// Returns numbers and schedules only, never advice.

import { round2, addMonths, parseDate, YEAR_MS, MONTH_MS } from "../js/domain/dates.js";
import { loanTerms, buildSchedule, outstandingAt } from "../js/domain/loan.js";
import { compoundOver, compoundedValue, assetGrossAt, assetNetAt } from "../js/domain/asset-value.js";

// Re-export the canonical primitives so callers have a single import surface.
export { round2, addMonths, parseDate, YEAR_MS, MONTH_MS };
export { loanTerms, buildSchedule, outstandingAt };
export { compoundOver, compoundedValue, assetGrossAt, assetNetAt };

/* ---------- growth / depreciation ---------- */

// Future value of a lump sum compounded annually. rate is a percent (7 = 7%/yr).
export function futureValue(principal, annualRatePct, years) {
  return (+principal || 0) * Math.pow(1 + (+annualRatePct || 0) / 100, +years || 0);
}

// Value after compounding up or down at annualRatePct for `years` (the app's asset method).
// up=false depreciates, up=true appreciates. rate is a percent.
export function depreciate(value, annualRatePct, years, up = false) {
  return compoundOver(value, (+annualRatePct || 0) / 100, +years || 0, up);
}

// Straight-line depreciation: value falls evenly from `value` to `salvage` over usefulYears.
export function straightLineDepreciation(value, salvage, usefulYears, yearsElapsed) {
  const v = +value || 0, s = +salvage || 0, u = +usefulYears || 0;
  if (!(u > 0)) return v;
  const t = Math.min(Math.max(+yearsElapsed || 0, 0), u);
  return Math.max(s, v - ((v - s) * t) / u);
}

// Compound annual growth rate between two values over `years`. Returns a decimal (0.07 = 7%),
// or null if inputs are out of range.
export function cagr(begin, end, years) {
  const b = +begin, e = +end, y = +years;
  if (!(b > 0) || !(e > 0) || !(y > 0)) return null;
  return Math.pow(e / b, 1 / y) - 1;
}

/* ---------- contributions ---------- */

// Core monthly-contribution recurrence (decimals): each month the balance compounds at
// `monthlyRate`, then the contribution (which steps up by `contribGrowth` every 12 months)
// plus any cumulative `extraAt(m)` is added. Shared with the site's forecast so the
// compounding is defined once. Returns the raw (unrounded) future value.
export function fvContributionsCore(monthly, monthlyRate, months, contribGrowth = 0, extraAt = null) {
  const i = +monthlyRate || 0, cg = +contribGrowth || 0, n = Math.max(0, Math.round(+months || 0));
  let fv = 0, base = +monthly || 0, redirect = 0;
  for (let m = 0; m < n; m++) {
    if (m > 0 && m % 12 === 0) base *= 1 + cg;
    if (extraAt) redirect += extraAt(m) || 0;
    fv = fv * (1 + i) + base + redirect;
  }
  return fv;
}

// Future value of a fixed monthly contribution over `months`, compounding at annualRatePct,
// with the contribution optionally stepping up contribGrowthPct each year. Percents in.
export function futureValueOfContributions(monthly, annualRatePct, months, contribGrowthPct = 0) {
  return fvContributionsCore(monthly, (+annualRatePct || 0) / 100 / 12, months, (+contribGrowthPct || 0) / 100, null);
}

/* ---------- savings rate ---------- */

// Fraction of income saved (savings / income). Returns a decimal, or null if income <= 0.
export function savingsRate(income, savings) {
  const inc = +income || 0;
  if (inc <= 0) return null;
  return (+savings || 0) / inc;
}

/* ---------- FX (rate supplied by the caller; pure arithmetic) ---------- */

// Convert an amount by an explicit rate (units of target per unit of source). No lookups.
export function fxConvert(amount, rate) {
  return (+amount || 0) * (+rate || 0);
}

/* ---------- retirement / planning ---------- */

// FIRE target and (optionally) years to reach it. The target is the nest egg whose safe
// withdrawal covers annual spend: annualSpend / (withdrawalRate). yearsToFI solves the
// ordinary-annuity growth of currentNestEgg + annualContribution until it reaches target;
// null when the target is unreachable (no contribution and no growth, or growth that the
// inputs never bridge). All percents in; money via round2, target/gap rounded to cents.
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

// Inverse of futureValueOfContributions: the fixed monthly contribution needed to reach
// targetValue over `months` at annualRatePct, given an optional starting presentValue.
// Uses the same ordinary-annuity convention as fvContributionsCore. Returns null if the
// horizon is non-positive. Percents in; result rounded to cents.
export function requiredContribution(targetValue, annualRatePct, months, presentValue = 0) {
  const i = (+annualRatePct || 0) / 100 / 12, n = Math.max(0, Math.round(+months || 0));
  if (n <= 0) return { monthly: null };
  const g = Math.pow(1 + i, n);
  const factor = i === 0 ? n : (g - 1) / i;
  const fromPV = (+presentValue || 0) * g;
  return { monthly: round2(((+targetValue || 0) - fromPV) / factor) };
}

// Inflation: deflate a nominal amount to today's purchasing power, or (toNominal) inflate a
// real amount forward. value = amount / (1+infl)^years, or amount * (1+infl)^years. Raw value
// (unrounded) so round-trips are exact. Percent in.
export function inflationAdjust(amount, inflationRatePct, years, toNominal = false) {
  const f = Math.pow(1 + (+inflationRatePct || 0) / 100, +years || 0);
  const a = +amount || 0;
  return { value: toNominal ? a * f : (f === 0 ? 0 : a / f) };
}

// Convert between a nominal (stated) annual rate and the effective annual rate (APY) for a
// given compounding frequency. Forward: APY = ((1+nominal/m)^m - 1). Reverse (toNominal):
// recover the nominal rate from an APY. Percents in and out; raw (unrounded).
export function effectiveRate(ratePct, periodsPerYear, toNominal = false) {
  const m = +periodsPerYear || 0, x = (+ratePct || 0) / 100;
  if (m <= 0) return toNominal ? { nominalRatePct: null } : { effectiveRatePct: null };
  if (toNominal) return { nominalRatePct: m * (Math.pow(1 + x, 1 / m) - 1) * 100 };
  return { effectiveRatePct: (Math.pow(1 + x / m, m) - 1) * 100 };
}

/* ---------- discounted cash flow ---------- */

// Net present value of a cashflow series (index 0 = today; outflows negative) discounted at
// discountRatePct per period. Raw value. Percent in.
export function npv(cashflows, discountRatePct) {
  const r = (+discountRatePct || 0) / 100;
  const cf = Array.isArray(cashflows) ? cashflows : [];
  return { npv: cf.reduce((acc, c, t) => acc + (+c || 0) / Math.pow(1 + r, t), 0) };
}

// Internal rate of return: the per-period rate that zeroes the NPV of the series. Solved by
// bisection over (-99.99%, 1000%); returns null when the NPV does not change sign across that
// range (e.g. an all-positive stream) or the series is degenerate. Result in percent.
export function irr(cashflows) {
  const cf = Array.isArray(cashflows) ? cashflows : [];
  if (cf.length < 2) return { irrPct: null };
  const f = (r) => cf.reduce((acc, c, t) => acc + (+c || 0) / Math.pow(1 + r, t), 0);
  let lo = -0.9999, hi = 10, flo = f(lo), fhi = f(hi);
  if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return { irrPct: null };
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2, fmid = f(mid);
    if (fmid === 0) { lo = hi = mid; break; }
    if (flo * fmid < 0) { hi = mid; fhi = fmid; } else { lo = mid; flo = fmid; }
  }
  return { irrPct: ((lo + hi) / 2) * 100 };
}

/* ---------- everyday ratios ---------- */

// Refinance break-even: monthly saving (current - new payment), whole months to recoup the
// closing costs, and (if remainingMonths given) the net saving over the remaining term.
// breakevenMonths is null when the new payment does not save money. Money via round2.
export function refiBreakeven(closingCosts, currentPayment, newPayment, remainingMonths = null) {
  const monthlySaving = round2((+currentPayment || 0) - (+newPayment || 0));
  const cost = +closingCosts || 0;
  const breakevenMonths = monthlySaving > 0 ? Math.ceil(cost / monthlySaving) : null;
  const lifetimeSaving = remainingMonths == null ? null : round2(monthlySaving * (+remainingMonths || 0) - cost);
  return { monthlySaving, breakevenMonths, lifetimeSaving };
}

// Months of runway: liquid savings divided by monthly expenses. Null when expenses <= 0.
export function emergencyFund(liquidSavings, monthlyExpenses) {
  const exp = +monthlyExpenses || 0;
  if (exp <= 0) return { months: null };
  return { months: round2((+liquidSavings || 0) / exp) };
}

// How much house the income supports. The DTI cap on gross monthly income (less existing
// monthly debts) is the most you can put toward the payment; the present value of that annuity
// at the given rate and term is the max loan, and adding the down payment gives the max price.
// Percents in; money via round2.
export function mortgageAffordability({ annualIncome, dtiPct, rate, termYears, monthlyDebts = 0, downPayment = 0 } = {}) {
  const monthlyIncome = (+annualIncome || 0) / 12;
  const maxMonthlyPayment = round2(Math.max(0, monthlyIncome * (+dtiPct || 0) / 100 - (+monthlyDebts || 0)));
  const i = (+rate || 0) / 100 / 12, n = Math.round((+termYears || 0) * 12);
  const factor = n <= 0 ? 0 : (i === 0 ? n : (1 - Math.pow(1 + i, -n)) / i);
  const maxLoan = round2(maxMonthlyPayment * factor);
  return { maxMonthlyPayment, maxLoan, maxHomePrice: round2(maxLoan + (+downPayment || 0)) };
}

// Debt payoff plan across several debts under a fixed total monthly budget. Each month every
// balance accrues interest, the minimums are paid, then the leftover attacks one debt by the
// chosen method: "avalanche" (highest rate first) minimizes interest, "snowball" (smallest
// balance first) clears accounts soonest. Returns months to debt-free, total interest, and the
// order debts were cleared. insolvent (months/totalInterest null) when the budget cannot keep
// up with the minimums and interest. Percents in; money via round2.
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

/* ---------- discounting, rates, and pricing ---------- */

// Present value of a single future amount discounted annually. The inverse of futureValue.
// Raw value. Percent in.
export function presentValue(futureAmount, annualRatePct, years) {
  const r = (+annualRatePct || 0) / 100;
  return { pv: (+futureAmount || 0) / Math.pow(1 + r, +years || 0) };
}

// Annual return needed to grow `begin` to `end` over `years`, optionally with a fixed annual
// contribution. With no contribution this is exactly CAGR; with one it is solved by bisection
// over (-99.99%, 1000%). Returns the rate in percent, or null when no rate bridges the two.
export function requiredReturn(begin, end, years, annualContribution = 0) {
  const P = +begin || 0, T = +end || 0, y = +years || 0, C = +annualContribution || 0;
  if (!(y > 0)) return { ratePct: null };
  if (C === 0) {
    const g = cagr(P, T, y);
    return { ratePct: g == null ? null : g * 100 };
  }
  const f = (r) => {
    const g = Math.pow(1 + r, y);
    const annuity = r === 0 ? C * y : C * (g - 1) / r;
    return P * g + annuity - T;
  };
  let lo = -0.9999, hi = 10, flo = f(lo), fhi = f(hi);
  if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return { ratePct: null };
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2, fmid = f(mid);
    if (fmid === 0) { lo = hi = mid; break; }
    if (flo * fmid < 0) { hi = mid; fhi = fmid; } else { lo = mid; flo = fmid; }
  }
  return { ratePct: ((lo + hi) / 2) * 100 };
}

// Bond yield to maturity: the nominal annual yield (per-period rate times periodsPerYear) that
// prices the bond at `price`. Coupons are faceValue*couponRatePct/periodsPerYear each period,
// face is returned at maturity. Solved by bisection. Null when no yield prices it. Percents.
export function yieldToMaturity(price, faceValue, couponRatePct, years, periodsPerYear = 2) {
  const F = +faceValue || 0, m = +periodsPerYear || 0, n = Math.round((+years || 0) * m), pr = +price || 0;
  if (m <= 0 || n <= 0) return { yieldPct: null };
  const coupon = F * (+couponRatePct || 0) / 100 / m;
  const f = (rp) => {
    let v = -pr;
    for (let t = 1; t <= n; t++) v += coupon / Math.pow(1 + rp, t);
    v += F / Math.pow(1 + rp, n);
    return v;
  };
  let lo = -0.9999, hi = 10, flo = f(lo), fhi = f(hi);
  if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return { yieldPct: null };
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2, fmid = f(mid);
    if (fmid === 0) { lo = hi = mid; break; }
    if (flo * fmid < 0) { hi = mid; fhi = fmid; } else { lo = mid; flo = fmid; }
  }
  return { yieldPct: ((lo + hi) / 2) * m * 100 };
}

// Progressive tax from caller-supplied brackets (no jurisdiction or year baked in). Each bracket
// is { upTo, ratePct }; the final bracket may omit upTo (or set it null) to run to infinity.
// Returns total tax, effective rate, and the marginal rate the income lands in. Percents.
export function taxFromBrackets(income, brackets) {
  const inc = +income || 0;
  const bands = (Array.isArray(brackets) ? brackets : [])
    .map((b) => ({ upTo: b && b.upTo != null ? +b.upTo : Infinity, ratePct: +(b && b.ratePct) || 0 }))
    .sort((a, b) => a.upTo - b.upTo);
  let tax = 0, lower = 0, marginalRatePct = 0;
  for (const band of bands) {
    if (inc <= lower) break;
    const taxable = Math.min(inc, band.upTo) - lower;
    if (taxable > 0) { tax += taxable * band.ratePct / 100; marginalRatePct = band.ratePct; }
    lower = band.upTo;
  }
  tax = round2(tax);
  return { tax, effectiveRatePct: inc > 0 ? tax / inc * 100 : 0, marginalRatePct };
}

// Margin/markup converter. Supply any one of {cost, price} plus one of {marginPct, markupPct}
// (or both of cost+price) and it fills in the rest. margin = profit/price; markup = profit/cost.
// Money via round2; percentages raw.
export function marginMarkup({ cost, price, marginPct, markupPct } = {}) {
  let c = cost != null ? +cost : null, p = price != null ? +price : null;
  if (c != null && p == null) {
    if (markupPct != null) p = c * (1 + (+markupPct) / 100);
    else if (marginPct != null) p = c / (1 - (+marginPct) / 100);
  } else if (p != null && c == null) {
    if (markupPct != null) c = p / (1 + (+markupPct) / 100);
    else if (marginPct != null) c = p * (1 - (+marginPct) / 100);
  }
  if (c == null || p == null) return { cost: null, price: null, marginPct: null, markupPct: null, profit: null };
  const profit = p - c;
  return {
    cost: round2(c), price: round2(p), profit: round2(profit),
    marginPct: p !== 0 ? profit / p * 100 : null,
    markupPct: c !== 0 ? profit / c * 100 : null,
  };
}

// Compound growth at an arbitrary frequency, with an optional contribution each period (paid at
// period end, like fvContributionsCore). Generalizes futureValue (periodsPerYear=1) and
// futureValueOfContributions (periodsPerYear=12). Raw value. Percent in.
export function compoundInterest(principal, annualRatePct, years, periodsPerYear = 1, contributionPerPeriod = 0) {
  const m = +periodsPerYear || 0, n = Math.round((+years || 0) * m), i = m > 0 ? (+annualRatePct || 0) / 100 / m : 0;
  const P = +principal || 0, C = +contributionPerPeriod || 0;
  const g = Math.pow(1 + i, n);
  const annuity = i === 0 ? C * n : C * (g - 1) / i;
  return { value: P * g + annuity };
}

/* ---------- regional helpers (statutory values are inputs, never baked in) ---------- */

// German net (Netto) salary from gross (Brutto). Deliberately holds NO tax tables or rates of
// its own: the caller passes the current year's statutory figures (the income tax / Lohnsteuer
// amount, Soli amount, church-tax rate, the four employee social-insurance rates, and the two
// contribution ceilings), so the math stays pure and never goes stale. Pension and unemployment
// are capped at pensionCeiling; health and care at healthCeiling. Use consistent units (e.g. all
// annual). Percents in; money via round2.
export function germanNetSalary({
  gross, incomeTax = 0, soli = 0, churchTaxPct = 0,
  pensionPct = 0, unemploymentPct = 0, healthPct = 0, carePct = 0,
  pensionCeiling = Infinity, healthCeiling = Infinity,
} = {}) {
  const g = +gross || 0;
  const rvBase = Math.min(g, +pensionCeiling || Infinity);
  const kvBase = Math.min(g, +healthCeiling || Infinity);
  const pension = round2(rvBase * (+pensionPct || 0) / 100);
  const unemployment = round2(rvBase * (+unemploymentPct || 0) / 100);
  const health = round2(kvBase * (+healthPct || 0) / 100);
  const care = round2(kvBase * (+carePct || 0) / 100);
  const total = round2(pension + unemployment + health + care);
  const tax = +incomeTax || 0, sol = +soli || 0;
  const churchTax = round2(tax * (+churchTaxPct || 0) / 100);
  const totalDeductions = round2(tax + sol + churchTax + total);
  return {
    gross: round2(g), incomeTax: round2(tax), soli: round2(sol), churchTax,
    contributions: { pension, unemployment, health, care, total },
    totalDeductions, net: round2(g - totalDeductions),
  };
}

// Value-added tax (MwSt/USt, sales tax). With a net price (default) it adds the tax; with
// inclusive=true it treats the amount as gross and extracts the tax. The rate is always an
// input (19/7 for Germany, etc.) — nothing is assumed. Money via round2.
export function vat(amount, ratePct, inclusive = false) {
  const a = +amount || 0, r = (+ratePct || 0) / 100;
  if (inclusive) {
    const net = a / (1 + r);
    return { net: round2(net), tax: round2(a - net), gross: round2(a) };
  }
  const tax = a * r;
  return { net: round2(a), tax: round2(tax), gross: round2(a + tax) };
}

/* ---------- loan summaries (compositions over the existing schedule engine) ---------- */

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
//   extra: [{date, amount}], fixedUntil? }.
export function amortization(loan) {
  const { M, n } = loanTerms(loan);
  const schedule = buildSchedule(loan);
  const pays = schedule.filter((r) => r.type === "payment");
  const extras = schedule.filter((r) => r.type === "extra");
  const totalInterest = round2(pays.reduce((a, r) => a + (r.interest || 0), 0));
  const totalPaid = round2(pays.reduce((a, r) => a + (r.payment || 0), 0) + extras.reduce((a, r) => a + (r.extra || 0), 0));
  const last = schedule[schedule.length - 1];
  const base = {
    monthlyPayment: round2(M),
    scheduledMonths: isFinite(n) ? n : null,
    payments: pays.length,
    totalInterest,
    totalPaid,
    payoffDate: last ? last.date : null,
    yearly: scheduleByYear(schedule),
  };
  // detail controls output size. summary/yearly (default) stay compact (yearly is always
  // present); monthly returns the full row list, paginated with offset/limit.
  if ((loan.detail || "summary") !== "monthly") return base;
  const total = schedule.length;
  const offset = Math.max(0, Math.round(+loan.offset || 0));
  const limit = loan.limit == null ? total : Math.max(0, Math.round(+loan.limit || 0));
  const slice = schedule.slice(offset, offset + limit);
  const end = offset + slice.length;
  return { ...base, schedule: slice, scheduleTotal: total, nextOffset: end < total ? end : null };
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
