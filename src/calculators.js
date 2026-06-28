// Shared registry of the calculators, used by both the /api/calc/* JSON endpoints and the
// MCP server, so the wiring (and the math, via lib/finance-math.js) is defined once.
// Each entry: { description, inputSchema (JSON Schema), run(args) -> JSON-serializable }.
import {
  amortization, loanPayoff, futureValue, futureValueOfContributions, cagr,
  savingsRate, fxConvert, depreciate, straightLineDepreciation,
  fireNumber, requiredContribution, inflationAdjust, effectiveRate,
  npv, irr, refiBreakeven, emergencyFund,
  mortgageAffordability, debtPayoff, portfolioLongevity,
  presentValue, requiredReturn, yieldToMaturity, taxFromBrackets,
  marginMarkup, compoundInterest,
  germanNetSalary, vat,
  roi, realReturn, returnStats, sharpeRatio, maxDrawdown,
  holdingPeriodReturn, feeDrag, dollarCostAveraging,
  bondPrice, currentYield, bondDuration, convexity, zeroCouponPrice, accruedInterest,
  blackScholes, optionGreeks, putCallParity, optionBreakeven, intrinsicTimeValue,
  annuityPV, annuityFV, annuityPayment, perpetuity, ruleOf72,
  paybackPeriod, discountedPayback, mirr, xnpv, xirr,
  loanAPR, interestOnlyPayment, balloonLoan, ltv, dti,
  creditCardPayoff, pointsBreakeven, biweeklyPayoff,
  capRate, cashOnCash, noi, grossRentMultiplier, dscr,
  wacc, breakEvenUnits, contributionMargin, currentRatio, quickRatio, roe, roa,
  decliningBalanceDepreciation, doubleDecliningDepreciation, sumOfYearsDigits, unitsOfProductionDepreciation,
} from "../public/lib/finance-math.js";

// Bump when a calculator's formula or output shape changes, so results are reproducible/citeable.
export const CALC_VERSION = "1.7.0";

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
const datedFlows = (description) => ({ type: "array", description, items: { type: "object", properties: { date: { type: "string", description: "ISO date." }, amount: { type: "number", description: "Cashflow amount (outflows negative)." } }, required: ["date", "amount"] } });

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
    description: "Monthly loan amortization schedule and summary. Supports dated extra principal payments and a rate-fixed period. detail controls output size: 'summary' (default) returns totals plus a per-year breakdown; 'monthly' returns the full schedule (paginate with offset/limit). Returns numbers and schedules; no advice.",
    inputSchema: obj({ ...loanProps,
      detail: { type: "string", enum: ["summary", "yearly", "monthly"], description: "Output size. summary (default): totals + yearly breakdown. monthly: full schedule (use offset/limit to paginate)." },
      offset: num("Monthly schedule start index when detail=monthly (default 0)."),
      limit: num("Max monthly rows when detail=monthly (default all)."),
      rateSteps: {
        type: "array",
        description: "Optional rate changes (e.g. after a Zinsbindung). The installment is held; from each date the outstanding balance continues at the new annual rate.",
        items: { type: "object", properties: { date: str("ISO date the new rate starts."), rate: num("New annual rate in percent.") }, required: ["date", "rate"] },
      },
    }, loanRequired),
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
  "mortgage-affordability": {
    description: "Maximum loan and home price the income supports: the DTI cap on gross monthly income (less existing debts) sets the payment, whose present value at the rate and term is the loan.",
    inputSchema: obj({
      annualIncome: num("Gross annual income."),
      dtiPct: num("Max share of gross monthly income for the payment, in percent (e.g. 36)."),
      rate: num("Annual interest rate in percent."),
      termYears: num("Loan term in years."),
      monthlyDebts: num("Optional. Existing monthly debt payments (default 0)."),
      downPayment: num("Optional. Cash down payment, added to the loan for the home price (default 0)."),
    }, ["annualIncome", "dtiPct", "rate", "termYears"]),
    run: (a) => mortgageAffordability(a),
  },
  "debt-payoff": {
    description: "Multi-debt payoff plan under a fixed monthly budget. method 'avalanche' (highest rate first) minimizes interest; 'snowball' (smallest balance first) clears accounts soonest. Returns months, total interest, and payoff order; flags insolvent budgets.",
    inputSchema: obj({
      debts: {
        type: "array",
        description: "The debts to pay off.",
        items: {
          type: "object",
          properties: { name: str("Optional label."), balance: num("Current balance."), rate: num("Annual interest rate in percent."), minPayment: num("Minimum monthly payment.") },
          required: ["balance", "rate", "minPayment"],
        },
      },
      monthlyBudget: num("Total amount available across all debts each month."),
      method: { type: "string", enum: ["avalanche", "snowball"], description: "Payoff strategy (default avalanche)." },
    }, ["debts", "monthlyBudget"]),
    run: (a) => debtPayoff(a.debts, a.monthlyBudget, a.method || "avalanche"),
  },
  "portfolio-longevity": {
    description: "How many years a balance lasts while withdrawing from it: the balance grows each year, then the withdrawal (optionally stepping up) is taken. Returns the depletion year, or sustainable=true when it outlasts 200 years.",
    inputSchema: obj({
      balance: num("Starting balance."),
      annualWithdrawal: num("Amount withdrawn in the first year."),
      annualRatePct: num("Annual portfolio growth in percent."),
      withdrawalGrowthPct: num("Optional. Yearly step-up of the withdrawal in percent (default 0)."),
    }, ["balance", "annualWithdrawal", "annualRatePct"]),
    run: (a) => portfolioLongevity(a),
  },
  "present-value": {
    description: "Present value of a single future amount discounted annually. The inverse of future-value.",
    inputSchema: obj({
      futureAmount: num("Amount received in the future."),
      annualRatePct: num("Annual discount rate in percent."),
      years: num("Number of years until the amount is received."),
    }, ["futureAmount", "annualRatePct", "years"]),
    run: (a) => presentValue(a.futureAmount, a.annualRatePct, a.years),
  },
  "required-return": {
    description: "Annual return needed to grow a starting value to a target over a number of years, optionally with a fixed annual contribution. With no contribution this equals CAGR. Returns a percent, or null when unreachable.",
    inputSchema: obj({
      begin: num("Starting value."),
      end: num("Target ending value."),
      years: num("Number of years."),
      annualContribution: num("Optional. Amount added each year (default 0)."),
    }, ["begin", "end", "years"]),
    run: (a) => requiredReturn(a.begin, a.end, a.years, a.annualContribution || 0),
  },
  "yield-to-maturity": {
    description: "Bond yield to maturity: the nominal annual yield that prices a bond at the given price, with periodic coupons and face returned at maturity. Solved numerically. Returns a percent, or null.",
    inputSchema: obj({
      price: num("Current bond price."),
      faceValue: num("Face (par) value repaid at maturity."),
      couponRatePct: num("Annual coupon rate in percent of face."),
      years: num("Years to maturity."),
      periodsPerYear: num("Coupon periods per year (default 2 = semiannual)."),
    }, ["price", "faceValue", "couponRatePct", "years"]),
    run: (a) => yieldToMaturity(a.price, a.faceValue, a.couponRatePct, a.years, a.periodsPerYear == null ? 2 : a.periodsPerYear),
  },
  "tax-from-brackets": {
    description: "Progressive tax from caller-supplied brackets. No jurisdiction, year, or rates are baked in: pass the brackets yourself. Returns total tax, effective rate, and marginal rate.",
    inputSchema: obj({
      income: num("Taxable income."),
      brackets: {
        type: "array",
        description: "Ordered tax bands. The final band may omit upTo to run to infinity.",
        items: {
          type: "object",
          properties: { upTo: num("Upper bound of this band (omit on the top band)."), ratePct: num("Marginal rate for this band in percent.") },
          required: ["ratePct"],
        },
      },
    }, ["income", "brackets"]),
    run: (a) => taxFromBrackets(a.income, a.brackets),
  },
  "margin-markup": {
    description: "Convert between margin and markup. Supply any one of cost/price plus one of marginPct/markupPct (or both cost and price); returns cost, price, profit, marginPct, and markupPct.",
    inputSchema: obj({
      cost: num("Unit cost."),
      price: num("Selling price."),
      marginPct: num("Profit as a percent of price."),
      markupPct: num("Profit as a percent of cost."),
    }, []),
    run: (a) => marginMarkup(a),
  },
  "compound-interest": {
    description: "Compound growth at any frequency, with an optional contribution each period (paid at period end). Generalizes future-value (periodsPerYear 1) and contributions (periodsPerYear 12).",
    inputSchema: obj({
      principal: num("Starting amount."),
      annualRatePct: num("Annual growth rate in percent."),
      years: num("Number of years."),
      periodsPerYear: num("Compounding periods per year (default 1)."),
      contributionPerPeriod: num("Optional. Amount added each period (default 0)."),
    }, ["principal", "annualRatePct", "years"]),
    run: (a) => compoundInterest(a.principal, a.annualRatePct, a.years, a.periodsPerYear == null ? 1 : a.periodsPerYear, a.contributionPerPeriod || 0),
  },
  "de-gross-to-net": {
    description: "German net (Netto) salary from gross (Brutto). No tax tables are baked in: look up the current year's statutory figures and pass them in. Income tax (Lohnsteuer) and Soli are amounts; church tax is a percent of the income tax; the four employee social rates and the two contribution ceilings are inputs. Use consistent units (e.g. all annual).",
    inputSchema: obj({
      gross: num("Gross salary (Brutto)."),
      incomeTax: num("Income tax (Lohnsteuer) amount for the period — look up via the §32a / Steuerklasse tables."),
      soli: num("Solidarity surcharge (Solidaritätszuschlag) amount (often 0 below the threshold)."),
      churchTaxPct: num("Church tax (Kirchensteuer) rate in percent of income tax (8 or 9, 0 if none)."),
      pensionPct: num("Employee pension (Rentenversicherung) rate in percent (e.g. 9.3)."),
      unemploymentPct: num("Employee unemployment (Arbeitslosenversicherung) rate in percent (e.g. 1.3)."),
      healthPct: num("Employee health (Krankenversicherung incl. Zusatzbeitrag) rate in percent."),
      carePct: num("Employee long-term care (Pflegeversicherung) rate in percent."),
      pensionCeiling: num("Contribution ceiling (Beitragsbemessungsgrenze) for pension and unemployment."),
      healthCeiling: num("Contribution ceiling for health and care."),
    }, ["gross"]),
    run: (a) => germanNetSalary(a),
  },
  "vat": {
    description: "Value-added tax (MwSt/USt, sales tax) on a price. By default adds the tax to a net price; with inclusive=true treats the amount as gross and extracts the tax. The rate is always an input (19 or 7 for Germany, etc.).",
    inputSchema: obj({
      amount: num("The price."),
      ratePct: num("VAT rate in percent (e.g. 19 or 7)."),
      inclusive: bool("false (default): amount is net, add the tax. true: amount is gross, extract the tax."),
    }, ["amount", "ratePct"]),
    run: (a) => vat(a.amount, a.ratePct, !!a.inclusive),
  },
  "roi": {
    description: "Return on investment: total percent gain, plus the annualized rate when a holding period in years is given.",
    inputSchema: obj({ initial: num("Amount invested."), finalValue: num("Ending value."), years: num("Optional. Holding period in years, for the annualized rate.") }, ["initial", "finalValue"]),
    run: (a) => roi(a.initial, a.finalValue, a.years),
  },
  "real-return": {
    description: "Real (inflation-adjusted) return from a nominal rate via the Fisher relation: (1+nominal)/(1+inflation) - 1.",
    inputSchema: obj({ nominalRatePct: num("Nominal annual rate in percent."), inflationRatePct: num("Annual inflation in percent.") }, ["nominalRatePct", "inflationRatePct"]),
    run: (a) => realReturn(a.nominalRatePct, a.inflationRatePct),
  },
  "return-stats": {
    description: "Mean, sample variance, and sample standard deviation (n-1) of a series of returns. Pass percents to get a percent stdev (volatility).",
    inputSchema: obj({ returns: numArray("The return series (e.g. yearly percents).") }, ["returns"]),
    run: (a) => returnStats(a.returns),
  },
  "sharpe-ratio": {
    description: "Sharpe ratio: excess mean return per unit of volatility, (mean - riskFree) / stdev. Null when volatility is undefined or zero.",
    inputSchema: obj({ returns: numArray("The return series (percents)."), riskFreePct: num("Risk-free rate in the same unit (default 0).") }, ["returns"]),
    run: (a) => sharpeRatio(a.returns, a.riskFreePct || 0),
  },
  "max-drawdown": {
    description: "Maximum drawdown of a value series: the largest peak-to-trough decline, as a positive percent.",
    inputSchema: obj({ series: numArray("Sequence of values (e.g. portfolio levels).") }, ["series"]),
    run: (a) => maxDrawdown(a.series),
  },
  "holding-period-return": {
    description: "Holding-period return: (income + capital gain) / starting value, in percent.",
    inputSchema: obj({ income: num("Income received over the period."), endValue: num("Ending value."), beginValue: num("Starting value.") }, ["income", "endValue", "beginValue"]),
    run: (a) => holdingPeriodReturn(a.income, a.endValue, a.beginValue),
  },
  "fee-drag": {
    description: "Effect of an annual fee: the compounded balance at the gross rate vs net of the fee, and the amount lost to fees.",
    inputSchema: obj({ principal: num("Starting amount."), grossAnnualPct: num("Gross annual return in percent."), feePct: num("Annual fee in percent."), years: num("Number of years.") }, ["principal", "grossAnnualPct", "feePct", "years"]),
    run: (a) => feeDrag(a.principal, a.grossAnnualPct, a.feePct, a.years),
  },
  "dollar-cost-averaging": {
    description: "Dollar-cost averaging: buying a fixed amount each period at the given prices. Returns units accumulated, total invested, average cost, and final value at the last price.",
    inputSchema: obj({ prices: numArray("Price at each purchase period."), periodicInvestment: num("Fixed amount invested each period.") }, ["prices", "periodicInvestment"]),
    run: (a) => dollarCostAveraging(a.prices, a.periodicInvestment),
  },
  "bond-price": {
    description: "Price of a coupon bond given a yield: present value of the coupons plus the face at maturity.",
    inputSchema: obj({ faceValue: num("Face (par) value."), couponRatePct: num("Annual coupon rate in percent of face."), years: num("Years to maturity."), yieldPct: num("Annual yield in percent."), periodsPerYear: num("Coupon periods per year (default 2).") }, ["faceValue", "couponRatePct", "years", "yieldPct"]),
    run: (a) => bondPrice(a.faceValue, a.couponRatePct, a.years, a.yieldPct, a.periodsPerYear == null ? 2 : a.periodsPerYear),
  },
  "current-yield": {
    description: "Current yield: the annual coupon as a percent of the bond's current price.",
    inputSchema: obj({ price: num("Current bond price."), faceValue: num("Face value."), couponRatePct: num("Annual coupon rate in percent of face.") }, ["price", "faceValue", "couponRatePct"]),
    run: (a) => currentYield(a.price, a.faceValue, a.couponRatePct),
  },
  "bond-duration": {
    description: "Macaulay duration (PV-weighted average time of cashflows, in years) and modified duration (price sensitivity to yield).",
    inputSchema: obj({ faceValue: num("Face value."), couponRatePct: num("Annual coupon rate in percent."), years: num("Years to maturity."), yieldPct: num("Annual yield in percent."), periodsPerYear: num("Coupon periods per year (default 2).") }, ["faceValue", "couponRatePct", "years", "yieldPct"]),
    run: (a) => bondDuration(a.faceValue, a.couponRatePct, a.years, a.yieldPct, a.periodsPerYear == null ? 2 : a.periodsPerYear),
  },
  "convexity": {
    description: "Bond convexity (years^2): the curvature of price with respect to yield, used alongside duration.",
    inputSchema: obj({ faceValue: num("Face value."), couponRatePct: num("Annual coupon rate in percent."), years: num("Years to maturity."), yieldPct: num("Annual yield in percent."), periodsPerYear: num("Coupon periods per year (default 2).") }, ["faceValue", "couponRatePct", "years", "yieldPct"]),
    run: (a) => convexity(a.faceValue, a.couponRatePct, a.years, a.yieldPct, a.periodsPerYear == null ? 2 : a.periodsPerYear),
  },
  "zero-coupon-price": {
    description: "Price of a zero-coupon bond: face value discounted to today at the yield.",
    inputSchema: obj({ faceValue: num("Face value."), years: num("Years to maturity."), yieldPct: num("Annual yield in percent."), compoundingPerYear: num("Compounding periods per year (default 1).") }, ["faceValue", "years", "yieldPct"]),
    run: (a) => zeroCouponPrice(a.faceValue, a.years, a.yieldPct, a.compoundingPerYear == null ? 1 : a.compoundingPerYear),
  },
  "accrued-interest": {
    description: "Accrued interest since the last coupon: the annual coupon pro-rated by days elapsed over the day-count basis.",
    inputSchema: obj({ faceValue: num("Face value."), couponRatePct: num("Annual coupon rate in percent."), daysSinceLastCoupon: num("Days since the last coupon."), dayCountBasis: num("Day-count basis (default 360).") }, ["faceValue", "couponRatePct", "daysSinceLastCoupon"]),
    run: (a) => accruedInterest(a.faceValue, a.couponRatePct, a.daysSinceLastCoupon, a.dayCountBasis == null ? 360 : a.dayCountBasis),
  },
  "black-scholes": {
    description: "Black-Scholes price of a European call or put option, plus d1/d2. Volatility and rates in percent; optional continuous dividend yield.",
    inputSchema: obj({ spot: num("Current underlying price."), strike: num("Strike price."), years: num("Time to expiry in years."), volatilityPct: num("Annualized volatility in percent."), riskFreePct: num("Risk-free rate in percent."), dividendYieldPct: num("Continuous dividend yield in percent (default 0)."), type: { type: "string", enum: ["call", "put"], description: "Option type (default call)." } }, ["spot", "strike", "years", "volatilityPct", "riskFreePct"]),
    run: (a) => blackScholes(a.spot, a.strike, a.years, a.volatilityPct, a.riskFreePct, a.dividendYieldPct || 0, a.type || "call"),
  },
  "option-greeks": {
    description: "Black-Scholes greeks for a European option: delta, gamma, vega (per 1% vol), theta (per day), rho (per 1% rate).",
    inputSchema: obj({ spot: num("Current underlying price."), strike: num("Strike price."), years: num("Time to expiry in years."), volatilityPct: num("Annualized volatility in percent."), riskFreePct: num("Risk-free rate in percent."), dividendYieldPct: num("Continuous dividend yield in percent (default 0)."), type: { type: "string", enum: ["call", "put"], description: "Option type (default call)." } }, ["spot", "strike", "years", "volatilityPct", "riskFreePct"]),
    run: (a) => optionGreeks(a.spot, a.strike, a.years, a.volatilityPct, a.riskFreePct, a.dividendYieldPct || 0, a.type || "call"),
  },
  "put-call-parity": {
    description: "Put-call parity: given one option price, returns both. Provide call or put, plus spot, strike, years, and the rate.",
    inputSchema: obj({ call: num("Call price (provide call or put)."), put: num("Put price (provide call or put)."), spot: num("Underlying price."), strike: num("Strike price."), years: num("Time to expiry in years."), riskFreePct: num("Risk-free rate in percent."), dividendYieldPct: num("Continuous dividend yield in percent (default 0).") }, ["spot", "strike", "years", "riskFreePct"]),
    run: (a) => putCallParity(a),
  },
  "option-breakeven": {
    description: "Break-even underlying price at expiry: strike + premium for a call, strike - premium for a put.",
    inputSchema: obj({ strike: num("Strike price."), premium: num("Option premium paid."), type: { type: "string", enum: ["call", "put"], description: "Option type (default call)." } }, ["strike", "premium"]),
    run: (a) => optionBreakeven(a.strike, a.premium, a.type || "call"),
  },
  "intrinsic-time-value": {
    description: "Split an option premium into intrinsic value (in-the-money amount) and time value.",
    inputSchema: obj({ spot: num("Underlying price."), strike: num("Strike price."), premium: num("Option premium."), type: { type: "string", enum: ["call", "put"], description: "Option type (default call)." } }, ["spot", "strike", "premium"]),
    run: (a) => intrinsicTimeValue(a.spot, a.strike, a.premium, a.type || "call"),
  },
  "annuity-pv": {
    description: "Present value of an ordinary annuity (level payment at each period end). rate is the per-period rate in percent.",
    inputSchema: obj({ payment: num("Payment per period."), ratePct: num("Rate per period in percent."), periods: num("Number of periods.") }, ["payment", "ratePct", "periods"]),
    run: (a) => annuityPV(a.payment, a.ratePct, a.periods),
  },
  "annuity-fv": {
    description: "Future value of an ordinary annuity. rate is the per-period rate in percent.",
    inputSchema: obj({ payment: num("Payment per period."), ratePct: num("Rate per period in percent."), periods: num("Number of periods.") }, ["payment", "ratePct", "periods"]),
    run: (a) => annuityFV(a.payment, a.ratePct, a.periods),
  },
  "annuity-payment": {
    description: "The level payment that amortizes a present value over n periods (the loan-payment formula). rate is per period.",
    inputSchema: obj({ presentValue: num("Present value / principal."), ratePct: num("Rate per period in percent."), periods: num("Number of periods.") }, ["presentValue", "ratePct", "periods"]),
    run: (a) => annuityPayment(a.presentValue, a.ratePct, a.periods),
  },
  "perpetuity": {
    description: "Present value of a level or growing perpetuity: payment / (rate - growth). Null when growth is not below the rate.",
    inputSchema: obj({ payment: num("Periodic payment."), ratePct: num("Discount rate in percent."), growthPct: num("Optional. Payment growth rate in percent (default 0).") }, ["payment", "ratePct"]),
    run: (a) => perpetuity(a.payment, a.ratePct, a.growthPct || 0),
  },
  "rule-of-72": {
    description: "Years to double: the rule-of-72 estimate (72/rate) and the exact figure (ln2 / ln(1+rate)).",
    inputSchema: obj({ ratePct: num("Growth rate in percent.") }, ["ratePct"]),
    run: (a) => ruleOf72(a.ratePct),
  },
  "payback-period": {
    description: "Simple payback period: periods until cumulative cashflows recover the initial cost, interpolated within the crossing period. Null if never.",
    inputSchema: obj({ initialCost: num("Upfront cost."), cashflows: numArray("Inflow each period.") }, ["initialCost", "cashflows"]),
    run: (a) => paybackPeriod(a.initialCost, a.cashflows),
  },
  "discounted-payback": {
    description: "Discounted payback period: like payback-period but each cashflow is discounted at the per-period rate.",
    inputSchema: obj({ initialCost: num("Upfront cost."), cashflows: numArray("Inflow each period."), ratePct: num("Discount rate per period in percent.") }, ["initialCost", "cashflows", "ratePct"]),
    run: (a) => discountedPayback(a.initialCost, a.cashflows, a.ratePct),
  },
  "mirr": {
    description: "Modified internal rate of return: negatives financed at financeRate, positives reinvested at reinvestRate. Percents in and out.",
    inputSchema: obj({ cashflows: numArray("Cashflows by period (index 0 today; outflows negative)."), financeRatePct: num("Finance rate in percent."), reinvestRatePct: num("Reinvestment rate in percent.") }, ["cashflows", "financeRatePct", "reinvestRatePct"]),
    run: (a) => mirr(a.cashflows, a.financeRatePct, a.reinvestRatePct),
  },
  "xnpv": {
    description: "Date-aware net present value: each amount discounted by its fractional years (act/365) from the first cashflow's date. Annual rate in percent.",
    inputSchema: obj({ cashflows: datedFlows("Dated cashflows; the first date is the valuation date."), annualRatePct: num("Annual discount rate in percent.") }, ["cashflows", "annualRatePct"]),
    run: (a) => xnpv(a.cashflows, a.annualRatePct),
  },
  "xirr": {
    description: "Date-aware internal rate of return: the annual rate that zeroes the XNPV of irregular dated cashflows. Null if no rate fits.",
    inputSchema: obj({ cashflows: datedFlows("Dated cashflows; the first date is the valuation date.") }, ["cashflows"]),
    run: (a) => xirr(a.cashflows),
  },
  "loan-apr": {
    description: "Effective APR including upfront fees: the note-rate payment priced against the net proceeds (amount - fees). Annual percent.",
    inputSchema: obj({ amount: num("Loan amount."), ratePct: num("Note (nominal) annual rate in percent."), termMonths: num("Term in months."), fees: num("Optional. Upfront fees / points in currency (default 0).") }, ["amount", "ratePct", "termMonths"]),
    run: (a) => loanAPR(a.amount, a.ratePct, a.termMonths, a.fees || 0),
  },
  "interest-only-payment": {
    description: "Interest-only monthly payment on a balance.",
    inputSchema: obj({ amount: num("Outstanding balance."), ratePct: num("Annual rate in percent.") }, ["amount", "ratePct"]),
    run: (a) => interestOnlyPayment(a.amount, a.ratePct),
  },
  "balloon-loan": {
    description: "Balloon loan: payment based on a long amortization, with the balloon being the balance still due after the shorter balloon term.",
    inputSchema: obj({ amount: num("Loan amount."), ratePct: num("Annual rate in percent."), balloonMonths: num("Months until the balloon is due."), amortMonths: num("Amortization basis in months.") }, ["amount", "ratePct", "balloonMonths", "amortMonths"]),
    run: (a) => balloonLoan(a.amount, a.ratePct, a.balloonMonths, a.amortMonths),
  },
  "ltv": {
    description: "Loan-to-value ratio, percent (loan / property value).",
    inputSchema: obj({ loanAmount: num("Loan amount."), propertyValue: num("Property value.") }, ["loanAmount", "propertyValue"]),
    run: (a) => ltv(a.loanAmount, a.propertyValue),
  },
  "dti": {
    description: "Debt-to-income ratio, percent (monthly debt / gross monthly income).",
    inputSchema: obj({ monthlyDebt: num("Total monthly debt payments."), grossMonthlyIncome: num("Gross monthly income.") }, ["monthlyDebt", "grossMonthlyIncome"]),
    run: (a) => dti(a.monthlyDebt, a.grossMonthlyIncome),
  },
  "credit-card-payoff": {
    description: "Months to clear a credit-card balance at a fixed monthly payment, plus interest paid. Null when the payment can't cover the first month's interest.",
    inputSchema: obj({ balance: num("Current balance."), aprPct: num("Annual percentage rate in percent."), monthlyPayment: num("Fixed monthly payment.") }, ["balance", "aprPct", "monthlyPayment"]),
    run: (a) => creditCardPayoff(a.balance, a.aprPct, a.monthlyPayment),
  },
  "points-breakeven": {
    description: "Mortgage points break-even: the upfront cost to buy down the rate, the monthly payment saving, and the whole months to recoup it.",
    inputSchema: obj({ loanAmount: num("Loan amount."), ratePct: num("Base annual rate in percent."), termMonths: num("Term in months."), pointsPct: num("Points paid, percent of the loan."), reducedRatePct: num("Reduced annual rate after buying points.") }, ["loanAmount", "ratePct", "termMonths", "pointsPct", "reducedRatePct"]),
    run: (a) => pointsBreakeven(a.loanAmount, a.ratePct, a.termMonths, a.pointsPct, a.reducedRatePct),
  },
  "biweekly-payoff": {
    description: "Biweekly mortgage acceleration: paying half the monthly payment every two weeks. Returns the biweekly payment and the months and interest saved.",
    inputSchema: obj({ amount: num("Loan amount."), ratePct: num("Annual rate in percent."), termMonths: num("Original term in months.") }, ["amount", "ratePct", "termMonths"]),
    run: (a) => biweeklyPayoff(a.amount, a.ratePct, a.termMonths),
  },
  "cap-rate": {
    description: "Capitalization rate: net operating income as a percent of property value.",
    inputSchema: obj({ noi: num("Net operating income."), propertyValue: num("Property value.") }, ["noi", "propertyValue"]),
    run: (a) => capRate(a.noi, a.propertyValue),
  },
  "cash-on-cash": {
    description: "Cash-on-cash return: annual pre-tax cash flow as a percent of the cash invested.",
    inputSchema: obj({ annualCashFlow: num("Annual pre-tax cash flow."), cashInvested: num("Cash invested.") }, ["annualCashFlow", "cashInvested"]),
    run: (a) => cashOnCash(a.annualCashFlow, a.cashInvested),
  },
  "noi": {
    description: "Net operating income: gross rental income less vacancy and operating expenses.",
    inputSchema: obj({ grossRentalIncome: num("Gross annual rental income."), vacancyPct: num("Vacancy rate in percent."), operatingExpenses: num("Annual operating expenses.") }, ["grossRentalIncome", "vacancyPct", "operatingExpenses"]),
    run: (a) => noi(a.grossRentalIncome, a.vacancyPct, a.operatingExpenses),
  },
  "gross-rent-multiplier": {
    description: "Gross rent multiplier: price divided by gross annual rent.",
    inputSchema: obj({ price: num("Purchase price."), grossAnnualRent: num("Gross annual rent.") }, ["price", "grossAnnualRent"]),
    run: (a) => grossRentMultiplier(a.price, a.grossAnnualRent),
  },
  "dscr": {
    description: "Debt service coverage ratio: net operating income divided by annual debt service.",
    inputSchema: obj({ noi: num("Net operating income."), annualDebtService: num("Annual debt service.") }, ["noi", "annualDebtService"]),
    run: (a) => dscr(a.noi, a.annualDebtService),
  },
  "wacc": {
    description: "Weighted average cost of capital: equity and after-tax debt weighted by the capital structure. Percents in and out.",
    inputSchema: obj({ equity: num("Market value of equity."), debt: num("Market value of debt."), costEquityPct: num("Cost of equity in percent."), costDebtPct: num("Cost of debt in percent."), taxRatePct: num("Tax rate in percent.") }, ["equity", "debt", "costEquityPct", "costDebtPct", "taxRatePct"]),
    run: (a) => wacc(a.equity, a.debt, a.costEquityPct, a.costDebtPct, a.taxRatePct),
  },
  "break-even-units": {
    description: "Break-even volume: fixed costs divided by the per-unit contribution (price - variable cost), plus the revenue at that volume.",
    inputSchema: obj({ fixedCosts: num("Total fixed costs."), pricePerUnit: num("Selling price per unit."), variableCostPerUnit: num("Variable cost per unit.") }, ["fixedCosts", "pricePerUnit", "variableCostPerUnit"]),
    run: (a) => breakEvenUnits(a.fixedCosts, a.pricePerUnit, a.variableCostPerUnit),
  },
  "contribution-margin": {
    description: "Contribution margin per unit and as a percent of price.",
    inputSchema: obj({ pricePerUnit: num("Selling price per unit."), variableCostPerUnit: num("Variable cost per unit.") }, ["pricePerUnit", "variableCostPerUnit"]),
    run: (a) => contributionMargin(a.pricePerUnit, a.variableCostPerUnit),
  },
  "current-ratio": {
    description: "Current ratio: current assets over current liabilities.",
    inputSchema: obj({ currentAssets: num("Current assets."), currentLiabilities: num("Current liabilities.") }, ["currentAssets", "currentLiabilities"]),
    run: (a) => currentRatio(a.currentAssets, a.currentLiabilities),
  },
  "quick-ratio": {
    description: "Quick (acid-test) ratio: (current assets - inventory) over current liabilities.",
    inputSchema: obj({ currentAssets: num("Current assets."), inventory: num("Inventory."), currentLiabilities: num("Current liabilities.") }, ["currentAssets", "inventory", "currentLiabilities"]),
    run: (a) => quickRatio(a.currentAssets, a.inventory, a.currentLiabilities),
  },
  "roe": {
    description: "Return on equity, percent: net income over shareholders' equity.",
    inputSchema: obj({ netIncome: num("Net income."), equity: num("Shareholders' equity.") }, ["netIncome", "equity"]),
    run: (a) => roe(a.netIncome, a.equity),
  },
  "roa": {
    description: "Return on assets, percent: net income over total assets.",
    inputSchema: obj({ netIncome: num("Net income."), totalAssets: num("Total assets.") }, ["netIncome", "totalAssets"]),
    run: (a) => roa(a.netIncome, a.totalAssets),
  },
  "declining-balance-depreciation": {
    description: "Declining-balance depreciation: a fixed percent of the reducing book value, for a given year. Returns that year's depreciation and the remaining book value.",
    inputSchema: obj({ value: num("Initial cost."), ratePct: num("Annual depreciation rate in percent."), year: num("Year (1-based).") }, ["value", "ratePct", "year"]),
    run: (a) => decliningBalanceDepreciation(a.value, a.ratePct, a.year),
  },
  "double-declining-depreciation": {
    description: "Double-declining-balance depreciation: 2/usefulYears of the book value each year, not falling below salvage.",
    inputSchema: obj({ value: num("Initial cost."), usefulYears: num("Useful life in years."), year: num("Year (1-based)."), salvage: num("Salvage value (default 0).") }, ["value", "usefulYears", "year"]),
    run: (a) => doubleDecliningDepreciation(a.value, a.usefulYears, a.year, a.salvage || 0),
  },
  "sum-of-years-digits": {
    description: "Sum-of-the-years'-digits depreciation: the depreciable base weighted toward the early years.",
    inputSchema: obj({ value: num("Initial cost."), salvage: num("Salvage value."), usefulYears: num("Useful life in years."), year: num("Year (1-based).") }, ["value", "salvage", "usefulYears", "year"]),
    run: (a) => sumOfYearsDigits(a.value, a.salvage, a.usefulYears, a.year),
  },
  "units-of-production-depreciation": {
    description: "Units-of-production depreciation: the depreciable base spread over total expected units, charged by the units used this period.",
    inputSchema: obj({ value: num("Initial cost."), salvage: num("Salvage value."), totalUnits: num("Total expected units over the life."), unitsThisPeriod: num("Units produced this period.") }, ["value", "salvage", "totalUnits", "unitsThisPeriod"]),
    run: (a) => unitsOfProductionDepreciation(a.value, a.salvage, a.totalUnits, a.unitsThisPeriod),
  },
};

// Output schemas — declared so MCP clients get typed results (structuredContent shape) without a
// trial call. Kept beside the registry and attached below so each tool stays a single entry.
const out = (properties) => ({ type: "object", properties });
const onum = (description) => ({ type: "number", description });
const ostr = (description) => ({ type: "string", description });
const obool = (description) => ({ type: "boolean", description });
const oarr = (description) => ({ type: "array", description });
const oobj = (description) => ({ type: "object", description });
const VALUE = out({ value: onum("Result value.") });

const OUTPUTS = {
  "amortization": out({
    monthlyPayment: onum("Monthly payment."), scheduledMonths: onum("Scheduled months (null if open-ended)."),
    payments: onum("Number of payments made."), totalInterest: onum("Total interest paid."),
    totalPaid: onum("Total paid (incl. extras)."), payoffDate: ostr("Payoff date, ISO."),
    yearly: oarr("Per-year totals: { year, interest, principal, extra, payments, endBalance }."),
    schedule: oarr("Monthly rows (only when detail=monthly)."),
    scheduleTotal: onum("Total monthly rows (when detail=monthly)."), nextOffset: onum("Next pagination offset, or null."),
  }),
  "loan-payoff": out({
    baseline: oobj("Baseline { months, totalInterest, payoffDate }."),
    accelerated: oobj("Accelerated { months, totalInterest, payoffDate }."),
    monthsSaved: onum("Months saved."), interestSaved: onum("Interest saved."),
  }),
  "future-value": VALUE, "contributions": VALUE, "cagr": VALUE, "savings-rate": VALUE,
  "fx-convert": VALUE, "depreciate": VALUE, "straight-line-depreciation": VALUE,
  "inflation-adjust": VALUE, "compound-interest": VALUE,
  "present-value": out({ pv: onum("Present value.") }),
  "fire-number": out({ target: onum("Target nest egg."), gap: onum("Gap from today."), yearsToFI: onum("Years to FI (null if unreachable).") }),
  "required-contribution": out({ monthly: onum("Monthly contribution needed (null if horizon<=0).") }),
  "effective-rate": out({ effectiveRatePct: onum("Effective annual rate (APY), percent."), nominalRatePct: onum("Nominal rate, percent (when toNominal).") }),
  "npv": out({ npv: onum("Net present value.") }),
  "irr": out({ irrPct: onum("Internal rate of return, percent (null if none).") }),
  "required-return": out({ ratePct: onum("Annual rate, percent (null if unreachable).") }),
  "yield-to-maturity": out({ yieldPct: onum("Nominal annual yield, percent (null if none).") }),
  "refi-breakeven": out({ monthlySaving: onum("Monthly saving."), breakevenMonths: onum("Whole months to recoup (null if no saving)."), lifetimeSaving: onum("Net lifetime saving (null if no term).") }),
  "emergency-fund": out({ months: onum("Months of runway (null if expenses<=0).") }),
  "mortgage-affordability": out({ maxMonthlyPayment: onum("Max payment."), maxLoan: onum("Max loan."), maxHomePrice: onum("Max home price.") }),
  "debt-payoff": out({ months: onum("Months to debt-free (null if insolvent)."), totalInterest: onum("Total interest (null if insolvent)."), payoffOrder: oarr("Debt names in payoff order."), insolvent: obool("True if the budget can't keep up.") }),
  "portfolio-longevity": out({ years: onum("Depletion year (null if sustainable)."), sustainable: obool("True if it outlasts 200 years.") }),
  "tax-from-brackets": out({ tax: onum("Total tax."), effectiveRatePct: onum("Effective rate, percent."), marginalRatePct: onum("Marginal rate, percent.") }),
  "margin-markup": out({ cost: onum("Cost."), price: onum("Price."), profit: onum("Profit."), marginPct: onum("Margin, percent."), markupPct: onum("Markup, percent.") }),
  "de-gross-to-net": out({ gross: onum("Gross."), incomeTax: onum("Income tax."), soli: onum("Soli."), churchTax: onum("Church tax."), contributions: oobj("{ pension, unemployment, health, care, total }."), totalDeductions: onum("Total deductions."), net: onum("Net.") }),
  "vat": out({ net: onum("Net price."), tax: onum("Tax amount."), gross: onum("Gross price.") }),
  "roi": out({ roiPct: onum("Total return, percent."), annualizedPct: onum("Annualized return, percent (null if no years).") }),
  "real-return": out({ realPct: onum("Real return, percent.") }),
  "return-stats": out({ count: onum("Number of returns."), mean: onum("Mean return."), variance: onum("Sample variance (null if <2)."), stdev: onum("Sample stdev / volatility (null if <2).") }),
  "sharpe-ratio": out({ sharpe: onum("Sharpe ratio (null if no volatility)."), meanPct: onum("Mean return."), stdevPct: onum("Volatility.") }),
  "max-drawdown": out({ maxDrawdownPct: onum("Largest peak-to-trough decline, percent.") }),
  "holding-period-return": out({ hprPct: onum("Holding-period return, percent (null if begin=0).") }),
  "fee-drag": out({ gross: onum("Gross balance."), net: onum("Net of fees."), lostToFees: onum("Amount lost to fees.") }),
  "dollar-cost-averaging": out({ units: onum("Units accumulated."), invested: onum("Total invested."), avgCost: onum("Average cost per unit (null if none)."), finalValue: onum("Value at the last price.") }),
  "bond-price": out({ price: onum("Bond price (null if degenerate).") }),
  "current-yield": out({ currentYieldPct: onum("Current yield, percent (null if price<=0).") }),
  "bond-duration": out({ macaulay: onum("Macaulay duration, years."), modified: onum("Modified duration.") }),
  "convexity": out({ convexity: onum("Convexity, years^2.") }),
  "zero-coupon-price": out({ price: onum("Zero-coupon price.") }),
  "accrued-interest": out({ accrued: onum("Accrued interest.") }),
  "black-scholes": out({ price: onum("Option price (null if degenerate)."), d1: onum("d1."), d2: onum("d2.") }),
  "option-greeks": out({ delta: onum("Delta."), gamma: onum("Gamma."), vega: onum("Vega per 1% vol."), theta: onum("Theta per day."), rho: onum("Rho per 1% rate.") }),
  "put-call-parity": out({ call: onum("Call price."), put: onum("Put price.") }),
  "option-breakeven": out({ breakeven: onum("Break-even underlying price.") }),
  "intrinsic-time-value": out({ intrinsic: onum("Intrinsic value."), timeValue: onum("Time value.") }),
  "annuity-pv": out({ pv: onum("Present value.") }),
  "annuity-fv": out({ fv: onum("Future value.") }),
  "annuity-payment": out({ payment: onum("Level payment (null if periods<=0).") }),
  "perpetuity": out({ pv: onum("Present value (null if growth>=rate).") }),
  "rule-of-72": out({ years72: onum("72/rate estimate."), exactYears: onum("Exact doubling time.") }),
  "payback-period": out({ years: onum("Payback in periods (null if never).") }),
  "discounted-payback": out({ years: onum("Discounted payback in periods (null if never).") }),
  "mirr": out({ mirrPct: onum("Modified IRR, percent (null if degenerate).") }),
  "xnpv": out({ npv: onum("Date-aware net present value.") }),
  "xirr": out({ xirrPct: onum("Date-aware IRR, percent (null if none).") }),
  "loan-apr": out({ aprPct: onum("Effective APR, percent (null if degenerate).") }),
  "interest-only-payment": out({ payment: onum("Monthly interest payment.") }),
  "balloon-loan": out({ payment: onum("Monthly payment."), balloon: onum("Balloon balance due.") }),
  "ltv": out({ ltvPct: onum("Loan-to-value, percent (null if value<=0).") }),
  "dti": out({ dtiPct: onum("Debt-to-income, percent (null if income<=0).") }),
  "credit-card-payoff": out({ months: onum("Months to clear (null if never)."), totalInterest: onum("Total interest (null if never)."), totalPaid: onum("Total paid (null if never).") }),
  "points-breakeven": out({ cost: onum("Upfront cost of points."), monthlySaving: onum("Monthly payment saving."), breakevenMonths: onum("Whole months to recoup (null if no saving).") }),
  "biweekly-payoff": out({ biweeklyPayment: onum("Biweekly payment."), monthsSaved: onum("Months saved."), interestSaved: onum("Interest saved.") }),
  "cap-rate": out({ capRatePct: onum("Cap rate, percent (null if value<=0).") }),
  "cash-on-cash": out({ cashOnCashPct: onum("Cash-on-cash return, percent (null if invested<=0).") }),
  "noi": out({ noi: onum("Net operating income.") }),
  "gross-rent-multiplier": out({ grm: onum("Gross rent multiplier (null if rent<=0).") }),
  "dscr": out({ dscr: onum("Debt service coverage ratio (null if debt<=0).") }),
  "wacc": out({ waccPct: onum("WACC, percent (null if no capital).") }),
  "break-even-units": out({ units: onum("Break-even units (null if no contribution)."), revenue: onum("Revenue at break-even (null if none).") }),
  "contribution-margin": out({ contributionMargin: onum("Contribution per unit."), ratioPct: onum("Contribution margin ratio, percent (null if price=0).") }),
  "current-ratio": out({ currentRatio: onum("Current ratio (null if liabilities<=0).") }),
  "quick-ratio": out({ quickRatio: onum("Quick ratio (null if liabilities<=0).") }),
  "roe": out({ roePct: onum("Return on equity, percent (null if equity<=0).") }),
  "roa": out({ roaPct: onum("Return on assets, percent (null if assets<=0).") }),
  "declining-balance-depreciation": out({ depreciation: onum("Depreciation this year."), bookValue: onum("Book value at year end.") }),
  "double-declining-depreciation": out({ depreciation: onum("Depreciation this year."), bookValue: onum("Book value at year end.") }),
  "sum-of-years-digits": out({ depreciation: onum("Depreciation this year."), bookValue: onum("Book value at year end.") }),
  "units-of-production-depreciation": out({ depreciation: onum("Depreciation this period (null if totalUnits<=0).") }),
};

for (const [name, schema] of Object.entries(OUTPUTS)) CALCULATORS[name].outputSchema = schema;
