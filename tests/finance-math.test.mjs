import { test } from "node:test";
import assert from "node:assert/strict";
import {
  amortization, loanPayoff, futureValue, futureValueOfContributions, cagr,
  savingsRate, fxConvert, depreciate, straightLineDepreciation,
  fireNumber, requiredContribution, inflationAdjust, effectiveRate,
  npv, irr, refiBreakeven, emergencyFund,
  mortgageAffordability, debtPayoff, portfolioLongevity, round2,
  presentValue, requiredReturn, yieldToMaturity, taxFromBrackets,
  marginMarkup, compoundInterest,
  germanNetSalary, vat, scheduleByYear,
} from "../public/lib/finance-math.js";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} !~= ${b}`);

test("amortization: €100k at 6% over 30y -> €599.55/mo, 360 payments (round2)", () => {
  const a = amortization({ amount: 100000, rate: 6, mode: "term", termYears: 30, startDate: "2020-01-01" });
  assert.equal(a.monthlyPayment, 599.55); // round half-up to cents
  assert.equal(a.payments, 360);
  assert.ok(a.totalInterest > 115000 && a.totalInterest < 116000); // ~115,838 minus final-payment rounding
  assert.ok(a.payoffDate instanceof Date);
});

test("loanPayoff: an extra €200/mo saves time and interest", () => {
  const p = loanPayoff({ amount: 100000, rate: 6, mode: "term", termYears: 30, startDate: "2020-01-01" }, 200);
  assert.ok(p.monthsSaved > 0);
  assert.ok(p.interestSaved > 0);
  assert.ok(p.accelerated.months < p.baseline.months);
});

test("cagr: a value that doubles over 10 years is ~7.177%", () => {
  near(cagr(100, 200, 10), 0.0717734625, 1e-9);
  assert.equal(cagr(0, 200, 10), null); // guard
});

test("futureValue: €1000 at 7% for 10y ~= €1967.15", () => {
  near(futureValue(1000, 7, 10), 1967.151357, 1e-3);
});

test("futureValueOfContributions: €100/mo at 12%/yr for 12 months ~= €1268.25", () => {
  near(futureValueOfContributions(100, 12, 12, 0), 1268.250301, 1e-3);
});

test("savingsRate: 1000 saved of 5000 income = 0.2", () => {
  assert.equal(savingsRate(5000, 1000), 0.2);
  assert.equal(savingsRate(0, 1000), null);
});

test("fxConvert: pure multiply by the supplied rate", () => {
  near(fxConvert(100, 1.1), 110);
});

test("depreciate: €20k losing 15%/yr for 3y ~= €12,282.50 (app compounding method)", () => {
  near(depreciate(20000, 15, 3, false), 12282.5, 1e-6);
  near(depreciate(20000, 15, 3, true), 20000 * 1.15 ** 3, 1e-6); // up=true appreciates
});

test("straightLineDepreciation: 20k -> 2k salvage over 10y, 3y in = 14,600", () => {
  assert.equal(straightLineDepreciation(20000, 2000, 10, 3), 14600);
  assert.equal(straightLineDepreciation(20000, 2000, 10, 99), 2000); // floored at salvage
});

/* ---------- new calculators ---------- */

test("fireNumber: 40k spend at the default 4% rule -> €1,000,000 target (25x)", () => {
  const f = fireNumber({ annualSpend: 40000 });
  assert.equal(f.target, 1000000);
  assert.equal(f.gap, 1000000);
  assert.equal(f.yearsToFI, null); // no contribution and no growth -> unreachable
});

test("fireNumber: gap floors at 0 once the nest egg covers the target", () => {
  const f = fireNumber({ annualSpend: 40000, currentNestEgg: 1200000 });
  assert.equal(f.gap, 0);
  assert.equal(f.yearsToFI, 0);
});

test("fireNumber: €50k/yr with no growth reaches €1M in exactly 20 years", () => {
  const f = fireNumber({ annualSpend: 40000, annualContribution: 50000, annualRatePct: 0 });
  assert.equal(f.yearsToFI, 20);
});

test("fireNumber: growth reaches the target sooner than no growth", () => {
  const flat = fireNumber({ annualSpend: 40000, annualContribution: 50000, annualRatePct: 0 });
  const grown = fireNumber({ annualSpend: 40000, annualContribution: 50000, annualRatePct: 7 });
  assert.ok(grown.yearsToFI < flat.yearsToFI);
});

test("requiredContribution: inverse of futureValueOfContributions round-trips to €100/mo", () => {
  near(requiredContribution(1268.250301, 12, 12, 0).monthly, 100, 1e-2);
});

test("requiredContribution: a starting balance lowers the contribution needed", () => {
  const none = requiredContribution(1268.250301, 12, 12, 0).monthly;
  const some = requiredContribution(1268.250301, 12, 12, 500).monthly;
  assert.ok(some < none);
});

test("inflationAdjust: €1000 nominal at 3% for 10y ~= €744.09 real", () => {
  near(inflationAdjust(1000, 3, 10).value, 744.0939, 1e-3);
});

test("inflationAdjust: toNominal reverses the deflation", () => {
  near(inflationAdjust(744.0939, 3, 10, true).value, 1000, 1e-3);
});

test("effectiveRate: 12% nominal compounded monthly ~= 12.6825% APY", () => {
  near(effectiveRate(12, 12).effectiveRatePct, 12.68250301, 1e-6);
});

test("effectiveRate: toNominal recovers the nominal rate from the APY", () => {
  near(effectiveRate(12.68250301, 12, true).nominalRatePct, 12, 1e-6);
});

test("npv: [-1000, 500, 500, 500] discounted at 10% ~= €243.43", () => {
  near(npv([-1000, 500, 500, 500], 10).npv, 243.4259954, 1e-3);
});

test("irr: [-1000, 500, 500, 500] solves to a rate that zeroes the NPV", () => {
  const r = irr([-1000, 500, 500, 500]).irrPct;
  assert.ok(r > 23 && r < 24);
  near(npv([-1000, 500, 500, 500], r).npv, 0, 1e-2);
});

test("irr: a stream that never crosses zero returns null", () => {
  assert.equal(irr([100, 200, 300]).irrPct, null);
});

test("refiBreakeven: €3000 cost, €150/mo saved -> 20 months, €15k lifetime over 120mo", () => {
  const r = refiBreakeven(3000, 1500, 1350, 120);
  assert.equal(r.monthlySaving, 150);
  assert.equal(r.breakevenMonths, 20);
  assert.equal(r.lifetimeSaving, 15000);
});

test("refiBreakeven: a costlier new payment never breaks even", () => {
  const r = refiBreakeven(3000, 1350, 1500);
  assert.equal(r.monthlySaving, -150);
  assert.equal(r.breakevenMonths, null);
});

test("emergencyFund: €12k liquid against €3k/mo expenses = 4 months", () => {
  assert.equal(emergencyFund(12000, 3000).months, 4);
  assert.equal(emergencyFund(12000, 0).months, null); // guard
});

test("mortgageAffordability: the max loan amortizes back to the max monthly payment", () => {
  const m = mortgageAffordability({ annualIncome: 120000, dtiPct: 36, rate: 6, termYears: 30, downPayment: 50000 });
  assert.equal(m.maxMonthlyPayment, 3600); // 10k/mo * 36%
  const a = amortization({ amount: m.maxLoan, rate: 6, mode: "term", termYears: 30, startDate: "2020-01-01" });
  near(a.monthlyPayment, 3600, 1); // round-trips within a euro
  assert.equal(m.maxHomePrice, round2(m.maxLoan + 50000));
});

test("mortgageAffordability: existing monthly debts shrink the budget and the loan", () => {
  const clean = mortgageAffordability({ annualIncome: 120000, dtiPct: 36, rate: 6, termYears: 30 });
  const burdened = mortgageAffordability({ annualIncome: 120000, dtiPct: 36, rate: 6, termYears: 30, monthlyDebts: 600 });
  assert.equal(burdened.maxMonthlyPayment, 3000);
  assert.ok(burdened.maxLoan < clean.maxLoan);
});

test("debtPayoff: avalanche attacks the highest rate first, snowball the smallest balance", () => {
  const debts = [
    { name: "A", balance: 1000, rate: 5, minPayment: 25 },
    { name: "B", balance: 2000, rate: 20, minPayment: 25 },
  ];
  const ava = debtPayoff(debts, 200, "avalanche");
  const snow = debtPayoff(debts, 200, "snowball");
  assert.equal(ava.payoffOrder[0], "B");
  assert.equal(snow.payoffOrder[0], "A");
  assert.ok(ava.months > 0 && snow.months > 0);
  assert.ok(ava.totalInterest <= snow.totalInterest); // avalanche minimizes interest
});

test("debtPayoff: a budget that cannot cover the minimums is insolvent", () => {
  const r = debtPayoff([{ balance: 1000, rate: 5, minPayment: 25 }, { balance: 2000, rate: 20, minPayment: 25 }], 10);
  assert.equal(r.insolvent, true);
  assert.equal(r.months, null);
});

test("portfolioLongevity: withdrawing exactly the real return lasts indefinitely", () => {
  const r = portfolioLongevity({ balance: 1000000, annualWithdrawal: 40000, annualRatePct: 4 });
  assert.equal(r.sustainable, true);
  assert.equal(r.years, null);
});

test("portfolioLongevity: over-withdrawing depletes the balance in finite years", () => {
  const r = portfolioLongevity({ balance: 1000000, annualWithdrawal: 100000, annualRatePct: 4 });
  assert.equal(r.sustainable, false);
  assert.ok(r.years > 0 && r.years < 20);
});

test("portfolioLongevity: a rising withdrawal depletes no later than a flat one", () => {
  const flat = portfolioLongevity({ balance: 1000000, annualWithdrawal: 100000, annualRatePct: 4 });
  const rising = portfolioLongevity({ balance: 1000000, annualWithdrawal: 100000, annualRatePct: 4, withdrawalGrowthPct: 5 });
  assert.ok(rising.years <= flat.years);
});

test("presentValue: the inverse of futureValue round-trips €1000", () => {
  near(presentValue(futureValue(1000, 7, 10), 7, 10).pv, 1000, 1e-6);
});

test("requiredReturn: no contributions matches CAGR; contributions lower the bar", () => {
  near(requiredReturn(1000, 2000, 10).ratePct, cagr(1000, 2000, 10) * 100, 1e-3);
  const none = requiredReturn(1000, 2000, 10).ratePct;
  const some = requiredReturn(1000, 2000, 10, 50).ratePct;
  assert.ok(some < none);
});

test("yieldToMaturity: a par-priced bond yields its coupon; a discount bond yields more", () => {
  near(yieldToMaturity(1000, 1000, 5, 10, 2).yieldPct, 5, 1e-2);
  assert.ok(yieldToMaturity(900, 1000, 5, 10, 2).yieldPct > 5);
});

test("taxFromBrackets: progressive brackets on €50k -> €12k, 24% effective, 40% marginal", () => {
  const t = taxFromBrackets(50000, [
    { upTo: 10000, ratePct: 0 },
    { upTo: 30000, ratePct: 20 },
    { ratePct: 40 },
  ]);
  assert.equal(t.tax, 12000);
  near(t.effectiveRatePct, 24, 1e-9);
  assert.equal(t.marginalRatePct, 40);
});

test("marginMarkup: 50% markup on €100 cost -> €150 price, ~33.33% margin", () => {
  const m = marginMarkup({ cost: 100, markupPct: 50 });
  assert.equal(m.price, 150);
  near(m.marginPct, 33.33, 1e-2);
  assert.equal(m.profit, 50);
});

test("marginMarkup: a target margin implies cost and price", () => {
  const m = marginMarkup({ cost: 100, marginPct: 20 });
  assert.equal(m.price, 125);
  near(m.markupPct, 25, 1e-9);
});

test("compoundInterest: annual matches futureValue; monthly contributions match the annuity", () => {
  near(compoundInterest(1000, 7, 10, 1).value, futureValue(1000, 7, 10), 1e-6);
  near(compoundInterest(0, 12, 1, 12, 100).value, futureValueOfContributions(100, 12, 12), 1e-6);
});

test("germanNetSalary: brutto minus the statutory deductions the caller supplies", () => {
  // All statutory figures are inputs (the caller looks up the current year's numbers).
  const r = germanNetSalary({
    gross: 60000, incomeTax: 11000, soli: 0, churchTaxPct: 9,
    pensionPct: 9.3, unemploymentPct: 1.3, healthPct: 8.15, carePct: 2.3,
    pensionCeiling: 90600, healthCeiling: 62100,
  });
  assert.equal(r.churchTax, 990); // 11000 * 9%
  assert.equal(r.contributions.pension, 5580); // 60000 * 9.3%
  assert.equal(r.contributions.total, 12630); // 5580 + 780 + 4890 + 1380
  assert.equal(r.net, 35380); // 60000 - 11000 - 0 - 990 - 12630
});

test("germanNetSalary: contributions are capped at the contribution ceilings", () => {
  const r = germanNetSalary({ gross: 60000, healthPct: 8, healthCeiling: 50000 });
  assert.equal(r.contributions.health, 4000); // min(60000, 50000) * 8%, not 4800
});

test("vat: adds tax to a net price, and extracts it from a gross price", () => {
  const add = vat(100, 19);
  assert.equal(add.tax, 19);
  assert.equal(add.gross, 119);
  const extract = vat(119, 19, true);
  assert.equal(extract.net, 100);
  assert.equal(extract.tax, 19);
});

test("amortization detail: summary (default) omits the monthly schedule but keeps yearly + totals", () => {
  const a = amortization({ amount: 100000, rate: 6, mode: "term", termYears: 30, startDate: "2020-01-01" });
  assert.equal(a.schedule, undefined);
  assert.ok(Array.isArray(a.yearly) && a.yearly.length > 0);
  assert.equal(a.payments, 360);
  assert.equal(a.monthlyPayment, 599.55);
});

test("amortization detail: monthly returns the schedule with pagination metadata", () => {
  const a = amortization({ amount: 100000, rate: 6, mode: "term", termYears: 30, startDate: "2020-01-01", detail: "monthly", offset: 0, limit: 12 });
  assert.equal(a.schedule.length, 12);
  assert.equal(a.scheduleTotal, 360);
  assert.equal(a.nextOffset, 12);
});

test("amortization detail: monthly without a limit returns the whole schedule", () => {
  const a = amortization({ amount: 100000, rate: 6, mode: "term", termYears: 30, startDate: "2020-01-01", detail: "monthly" });
  assert.equal(a.schedule.length, 360);
  assert.equal(a.nextOffset, null);
});

test("scheduleByYear: buckets schedule rows into per-year totals that sum back", () => {
  const a = amortization({ amount: 100000, rate: 6, mode: "term", termYears: 30, startDate: "2020-01-01", detail: "monthly" });
  const yrs = scheduleByYear(a.schedule);
  assert.equal(yrs[0].year, 2020);
  near(yrs.reduce((s, y) => s + y.interest, 0), a.totalInterest, 1); // sums back to total
  assert.ok(yrs[0].endBalance < 100000);
  assert.equal(yrs[yrs.length - 1].endBalance, 0); // paid off by the end
});
