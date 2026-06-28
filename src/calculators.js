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
    description: "Monthly loan amortization schedule and summary. Supports dated extra principal payments and a rate-fixed period. detail controls output size: 'summary' (default) returns totals plus a per-year breakdown; 'monthly' returns the full schedule (paginate with offset/limit). Returns numbers and schedules; no advice.",
    inputSchema: obj({ ...loanProps,
      detail: { type: "string", enum: ["summary", "yearly", "monthly"], description: "Output size. summary (default): totals + yearly breakdown. monthly: full schedule (use offset/limit to paginate)." },
      offset: num("Monthly schedule start index when detail=monthly (default 0)."),
      limit: num("Max monthly rows when detail=monthly (default all)."),
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
};

for (const [name, schema] of Object.entries(OUTPUTS)) CALCULATORS[name].outputSchema = schema;
