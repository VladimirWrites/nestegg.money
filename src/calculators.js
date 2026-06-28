// Shared registry of the calculators, used by both the /api/calc/* JSON endpoints and the
// MCP server, so the wiring (and the math, via lib/finance-math.js) is defined once.
// Each entry: { description, inputSchema (JSON Schema), run(args) -> JSON-serializable }.
import {
  amortization, loanPayoff, futureValue, futureValueOfContributions, cagr,
  savingsRate, fxConvert, depreciate, straightLineDepreciation,
  fireNumber, requiredContribution, inflationAdjust, effectiveRate,
  npv, irr, refiBreakeven, emergencyFund,
} from "../public/lib/finance-math.js";

// CORS is open: the calculators carry no secrets and read no user data.
export const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, mcp-session-id, mcp-protocol-version",
  "access-control-max-age": "86400",
};

const num = (description) => ({ type: "number", description });
const str = (description) => ({ type: "string", description });
const bool = (description) => ({ type: "boolean", description });
const numArray = (description) => ({ type: "array", description, items: { type: "number" } });

// Shared loan input shape (amortization + loan-payoff).
const loanProps = {
  amount: num("Loan principal."),
  rate: num("Annual interest rate in percent (6 = 6%)."),
  mode: { type: "string", enum: ["term", "payment"], description: "Fix the term (compute the payment) or fix the payment (compute the term)." },
  termYears: num("Term in years, used when mode is 'term'."),
  payment: num("Monthly payment, used when mode is 'payment'."),
  startDate: str("First payment month as an ISO date (YYYY-MM-DD)."),
  fixedUntil: str("Optional. Rate is certain until this ISO date; beyond it the schedule is an estimate."),
  extra: {
    type: "array",
    description: "Optional dated extra principal payments.",
    items: { type: "object", properties: { date: str("ISO date."), amount: num("Extra principal.") } },
  },
};
const loanRequired = ["amount", "rate", "mode", "startDate"];
const obj = (properties, required) => ({ type: "object", properties, required, additionalProperties: false });

export const CALCULATORS = {
  "amortization": {
    description: "Monthly loan amortization schedule and summary. Supports dated extra principal payments and a rate-fixed period. Returns the schedule plus totals; no advice.",
    inputSchema: obj(loanProps, loanRequired),
    run: (a) => amortization(a),
  },
  "loan-payoff": {
    description: "Time and interest saved by paying a fixed extra amount every month on a loan, versus the baseline schedule.",
    inputSchema: obj({ ...loanProps, extraMonthly: num("Extra principal paid each month.") }, [...loanRequired, "extraMonthly"]),
    run: (a) => loanPayoff(a, a.extraMonthly),
  },
  "future-value": {
    description: "Future value of a single lump sum compounded annually.",
    inputSchema: obj({ principal: num("Starting amount."), annualRatePct: num("Annual growth rate in percent."), years: num("Number of years.") }, ["principal", "annualRatePct", "years"]),
    run: (a) => ({ value: futureValue(a.principal, a.annualRatePct, a.years) }),
  },
  "contributions": {
    description: "Future value of a fixed monthly contribution, optionally stepping up each year.",
    inputSchema: obj({ monthly: num("Monthly contribution."), annualRatePct: num("Annual growth rate in percent."), months: num("Number of months."), contribGrowthPct: num("Optional. Contribution step-up percent per year.") }, ["monthly", "annualRatePct", "months"]),
    run: (a) => ({ value: futureValueOfContributions(a.monthly, a.annualRatePct, a.months, a.contribGrowthPct || 0) }),
  },
  "cagr": {
    description: "Compound annual growth rate between two values over a number of years. Returns a decimal (0.07 means 7%).",
    inputSchema: obj({ begin: num("Starting value."), end: num("Ending value."), years: num("Number of years.") }, ["begin", "end", "years"]),
    run: (a) => ({ value: cagr(a.begin, a.end, a.years) }),
  },
  "savings-rate": {
    description: "Fraction of income saved (savings divided by income). Returns a decimal.",
    inputSchema: obj({ income: num("Income."), savings: num("Amount saved.") }, ["income", "savings"]),
    run: (a) => ({ value: savingsRate(a.income, a.savings) }),
  },
  "fx-convert": {
    description: "Convert an amount using a rate supplied by the caller (units of target currency per unit of source). No rate is ever looked up.",
    inputSchema: obj({ amount: num("Amount to convert."), rate: num("Rate: target units per source unit.") }, ["amount", "rate"]),
    run: (a) => ({ value: fxConvert(a.amount, a.rate) }),
  },
  "depreciate": {
    description: "Value after compounding down (or up) at a yearly percentage rate over a number of years. This is the method the app uses for long-term assets.",
    inputSchema: obj({ value: num("Starting value."), annualRatePct: num("Annual rate in percent."), years: num("Number of years."), up: { type: "boolean", description: "false depreciates, true appreciates." } }, ["value", "annualRatePct", "years"]),
    run: (a) => ({ value: depreciate(a.value, a.annualRatePct, a.years, !!a.up) }),
  },
  "straight-line-depreciation": {
    description: "Straight-line depreciation: value falling evenly to a salvage value over a useful life.",
    inputSchema: obj({ value: num("Starting value."), salvage: num("Salvage value."), usefulYears: num("Useful life in years."), yearsElapsed: num("Years elapsed.") }, ["value", "salvage", "usefulYears", "yearsElapsed"]),
    run: (a) => ({ value: straightLineDepreciation(a.value, a.salvage, a.usefulYears, a.yearsElapsed) }),
  },
  "fire-number": {
    description: "FIRE target nest egg from annual spend and a safe withdrawal rate (default 4%), plus the gap from today and the years to reach it given optional savings and growth. No advice.",
    inputSchema: obj({
      annualSpend: num("Yearly spending the nest egg must cover."),
      withdrawalRatePct: num("Safe withdrawal rate in percent (default 4 = the 4% rule)."),
      currentNestEgg: num("Optional. Amount already saved (default 0)."),
      annualContribution: num("Optional. Amount saved per year (default 0)."),
      annualRatePct: num("Optional. Annual portfolio growth in percent (default 0)."),
    }, ["annualSpend"]),
    run: (a) => fireNumber(a),
  },
  "required-contribution": {
    description: "Inverse of contributions: the fixed monthly amount needed to reach a target future value over a number of months, given an optional starting balance.",
    inputSchema: obj({
      targetValue: num("Future value goal."),
      annualRatePct: num("Annual growth rate in percent."),
      months: num("Number of months."),
      presentValue: num("Optional. Starting balance (default 0)."),
    }, ["targetValue", "annualRatePct", "months"]),
    run: (a) => requiredContribution(a.targetValue, a.annualRatePct, a.months, a.presentValue || 0),
  },
  "inflation-adjust": {
    description: "Convert a nominal amount to today's purchasing power (real), or with toNominal inflate a real amount forward, at a given annual inflation rate.",
    inputSchema: obj({
      amount: num("Amount to adjust."),
      inflationRatePct: num("Annual inflation rate in percent."),
      years: num("Number of years."),
      toNominal: bool("false (default) deflates nominal to real; true inflates real to nominal."),
    }, ["amount", "inflationRatePct", "years"]),
    run: (a) => inflationAdjust(a.amount, a.inflationRatePct, a.years, !!a.toNominal),
  },
  "effective-rate": {
    description: "Convert a nominal annual rate to the effective annual rate (APY) for a compounding frequency, or with toNominal recover the nominal rate from an APY.",
    inputSchema: obj({
      ratePct: num("The rate in percent (nominal, or effective when toNominal is true)."),
      periodsPerYear: num("Compounding periods per year (12 monthly, 365 daily)."),
      toNominal: bool("false (default) returns the effective rate; true returns the nominal rate."),
    }, ["ratePct", "periodsPerYear"]),
    run: (a) => effectiveRate(a.ratePct, a.periodsPerYear, !!a.toNominal),
  },
  "npv": {
    description: "Net present value of a cashflow series (index 0 is today; outflows negative) discounted at a per-period rate.",
    inputSchema: obj({
      cashflows: numArray("Cashflows by period, starting at period 0. Outflows are negative."),
      discountRatePct: num("Discount rate per period in percent."),
    }, ["cashflows", "discountRatePct"]),
    run: (a) => npv(a.cashflows, a.discountRatePct),
  },
  "irr": {
    description: "Internal rate of return: the per-period rate that zeroes the NPV of a cashflow series. Returns a percent, or null when the series never crosses zero.",
    inputSchema: obj({
      cashflows: numArray("Cashflows by period, starting at period 0. Outflows are negative."),
    }, ["cashflows"]),
    run: (a) => irr(a.cashflows),
  },
  "refi-breakeven": {
    description: "Refinance break-even: monthly saving, whole months to recoup closing costs, and (if remainingMonths given) the net saving over the remaining term.",
    inputSchema: obj({
      closingCosts: num("Upfront cost to refinance."),
      currentPayment: num("Current monthly payment."),
      newPayment: num("New monthly payment after refinancing."),
      remainingMonths: num("Optional. Months left on the loan, for the lifetime saving."),
    }, ["closingCosts", "currentPayment", "newPayment"]),
    run: (a) => refiBreakeven(a.closingCosts, a.currentPayment, a.newPayment, a.remainingMonths == null ? null : a.remainingMonths),
  },
  "emergency-fund": {
    description: "Months of runway: liquid savings divided by monthly expenses.",
    inputSchema: obj({
      liquidSavings: num("Cash and liquid savings on hand."),
      monthlyExpenses: num("Total monthly expenses."),
    }, ["liquidSavings", "monthlyExpenses"]),
    run: (a) => emergencyFund(a.liquidSavings, a.monthlyExpenses),
  },
};
