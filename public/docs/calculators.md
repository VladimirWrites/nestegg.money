# nestegg calculators

Deterministic, pure finance calculators (version 1.3.0). Every function depends only on
its inputs: none read user data, fetch live prices, or look up exchange rates or tax tables. Where
current statutory figures are needed (e.g. German payroll), they are passed in as arguments. Money
is rounded half-up to two decimals (the app's `round2`); rates are in percent unless noted; dates
are ISO strings (`YYYY-MM-DD`). The shared implementation is `public/lib/finance-math.js`.

Each calculator is reachable two ways: as a JSON endpoint (`POST /api/calc/<name>` with the inputs
as the JSON body) and as an MCP tool (Streamable HTTP at `/mcp`, same name and inputs, with a typed
`outputSchema`). `GET /api/calc` lists them. Both are stateless, CORS-open, and need no auth.

> This file is generated from the registry by `scripts/gen-calculator-docs.mjs` — do not edit by
> hand; run `npm run gen-docs` after changing a calculator. 94 calculators.

## amortization

Monthly loan amortization schedule and summary. Supports dated extra principal payments and a rate-fixed period. detail controls output size: 'summary' (default) returns totals plus a per-year breakdown; 'monthly' returns the full schedule (paginate with offset/limit). Returns numbers and schedules; no advice.

**Endpoint:** `POST /api/calc/amortization` · **MCP tool:** `amortization`

Inputs:

- `amount` *(required)* — number: Loan principal.
- `rate` *(required)* — number: Annual interest rate in percent (6 = 6%).
- `mode` *(required)* — string, one of: term, payment: Fix the term (compute the payment) or fix the payment (compute the term).
- `termYears` — number: Term in years, used when mode is 'term'.
- `payment` — number: Monthly payment, used when mode is 'payment'.
- `startDate` *(required)* — string: First payment month as an ISO date (YYYY-MM-DD).
- `fixedUntil` — string: Optional. Rate is certain until this ISO date; beyond it the schedule is an estimate.
- `extra` — array of objects: Optional dated extra principal payments.
- `detail` — string, one of: summary, yearly, monthly: Output size. summary (default): totals + yearly breakdown. monthly: full schedule (use offset/limit to paginate).
- `offset` — number: Monthly schedule start index when detail=monthly (default 0).
- `limit` — number: Max monthly rows when detail=monthly (default all).
- `rateSteps` — array of objects: Optional rate changes (e.g. after a Zinsbindung). The installment is held; from each date the outstanding balance continues at the new annual rate.

Outputs:

- `monthlyPayment` — Monthly payment.
- `scheduledMonths` — Scheduled months (null if open-ended).
- `payments` — Number of payments made.
- `totalInterest` — Total interest paid.
- `totalPaid` — Total paid (incl. extras).
- `payoffDate` — Payoff date, ISO.
- `yearly` — Per-year totals: { year, interest, principal, extra, payments, endBalance }.
- `schedule` — Monthly rows (only when detail=monthly).
- `scheduleTotal` — Total monthly rows (when detail=monthly).
- `nextOffset` — Next pagination offset, or null.

## loan-payoff

Time and interest saved by paying a fixed extra amount every month on a loan, versus the baseline schedule.

**Endpoint:** `POST /api/calc/loan-payoff` · **MCP tool:** `loan-payoff`

Inputs:

- `amount` *(required)* — number: Loan principal.
- `rate` *(required)* — number: Annual interest rate in percent (6 = 6%).
- `mode` *(required)* — string, one of: term, payment: Fix the term (compute the payment) or fix the payment (compute the term).
- `termYears` — number: Term in years, used when mode is 'term'.
- `payment` — number: Monthly payment, used when mode is 'payment'.
- `startDate` *(required)* — string: First payment month as an ISO date (YYYY-MM-DD).
- `fixedUntil` — string: Optional. Rate is certain until this ISO date; beyond it the schedule is an estimate.
- `extra` — array of objects: Optional dated extra principal payments.
- `extraMonthly` *(required)* — number: Extra principal paid each month.

Outputs:

- `baseline` — Baseline { months, totalInterest, payoffDate }.
- `accelerated` — Accelerated { months, totalInterest, payoffDate }.
- `monthsSaved` — Months saved.
- `interestSaved` — Interest saved.

## future-value

Future value of a single lump sum compounded annually.

**Endpoint:** `POST /api/calc/future-value` · **MCP tool:** `future-value`

Inputs:

- `principal` *(required)* — number: Starting amount.
- `annualRatePct` *(required)* — number: Annual growth rate in percent.
- `years` *(required)* — number: Number of years.

Outputs:

- `value` — Result value.

## contributions

Future value of a fixed monthly contribution, optionally stepping up each year.

**Endpoint:** `POST /api/calc/contributions` · **MCP tool:** `contributions`

Inputs:

- `monthly` *(required)* — number: Monthly contribution.
- `annualRatePct` *(required)* — number: Annual growth rate in percent.
- `months` *(required)* — number: Number of months.
- `contribGrowthPct` — number: Optional. Contribution step-up percent per year.

Outputs:

- `value` — Result value.

## cagr

Compound annual growth rate between two values over a number of years. Returns a decimal (0.07 means 7%).

**Endpoint:** `POST /api/calc/cagr` · **MCP tool:** `cagr`

Inputs:

- `begin` *(required)* — number: Starting value.
- `end` *(required)* — number: Ending value.
- `years` *(required)* — number: Number of years.

Outputs:

- `value` — Result value.

## savings-rate

Fraction of income saved (savings divided by income). Returns a decimal.

**Endpoint:** `POST /api/calc/savings-rate` · **MCP tool:** `savings-rate`

Inputs:

- `income` *(required)* — number: Income.
- `savings` *(required)* — number: Amount saved.

Outputs:

- `value` — Result value.

## fx-convert

Convert an amount using a rate supplied by the caller (units of target currency per unit of source). No rate is ever looked up.

**Endpoint:** `POST /api/calc/fx-convert` · **MCP tool:** `fx-convert`

Inputs:

- `amount` *(required)* — number: Amount to convert.
- `rate` *(required)* — number: Rate: target units per source unit.

Outputs:

- `value` — Result value.

## depreciate

Value after compounding down (or up) at a yearly percentage rate over a number of years. This is the method the app uses for long-term assets.

**Endpoint:** `POST /api/calc/depreciate` · **MCP tool:** `depreciate`

Inputs:

- `value` *(required)* — number: Starting value.
- `annualRatePct` *(required)* — number: Annual rate in percent.
- `years` *(required)* — number: Number of years.
- `up` — boolean: false depreciates, true appreciates.

Outputs:

- `value` — Result value.

## straight-line-depreciation

Straight-line depreciation: value falling evenly to a salvage value over a useful life.

**Endpoint:** `POST /api/calc/straight-line-depreciation` · **MCP tool:** `straight-line-depreciation`

Inputs:

- `value` *(required)* — number: Starting value.
- `salvage` *(required)* — number: Salvage value.
- `usefulYears` *(required)* — number: Useful life in years.
- `yearsElapsed` *(required)* — number: Years elapsed.

Outputs:

- `value` — Result value.

## fire-number

FIRE target nest egg from annual spend and a safe withdrawal rate (default 4%), plus the gap from today and the years to reach it given optional savings and growth. No advice.

**Endpoint:** `POST /api/calc/fire-number` · **MCP tool:** `fire-number`

Inputs:

- `annualSpend` *(required)* — number: Yearly spending the nest egg must cover.
- `withdrawalRatePct` — number: Safe withdrawal rate in percent (default 4 = the 4% rule).
- `currentNestEgg` — number: Optional. Amount already saved (default 0).
- `annualContribution` — number: Optional. Amount saved per year (default 0).
- `annualRatePct` — number: Optional. Annual portfolio growth in percent (default 0).

Outputs:

- `target` — Target nest egg.
- `gap` — Gap from today.
- `yearsToFI` — Years to FI (null if unreachable).

## required-contribution

Inverse of contributions: the fixed monthly amount needed to reach a target future value over a number of months, given an optional starting balance.

**Endpoint:** `POST /api/calc/required-contribution` · **MCP tool:** `required-contribution`

Inputs:

- `targetValue` *(required)* — number: Future value goal.
- `annualRatePct` *(required)* — number: Annual growth rate in percent.
- `months` *(required)* — number: Number of months.
- `presentValue` — number: Optional. Starting balance (default 0).

Outputs:

- `monthly` — Monthly contribution needed (null if horizon<=0).

## inflation-adjust

Convert a nominal amount to today's purchasing power (real), or with toNominal inflate a real amount forward, at a given annual inflation rate.

**Endpoint:** `POST /api/calc/inflation-adjust` · **MCP tool:** `inflation-adjust`

Inputs:

- `amount` *(required)* — number: Amount to adjust.
- `inflationRatePct` *(required)* — number: Annual inflation rate in percent.
- `years` *(required)* — number: Number of years.
- `toNominal` — boolean: false (default) deflates nominal to real; true inflates real to nominal.

Outputs:

- `value` — Result value.

## effective-rate

Convert a nominal annual rate to the effective annual rate (APY) for a compounding frequency, or with toNominal recover the nominal rate from an APY.

**Endpoint:** `POST /api/calc/effective-rate` · **MCP tool:** `effective-rate`

Inputs:

- `ratePct` *(required)* — number: The rate in percent (nominal, or effective when toNominal is true).
- `periodsPerYear` *(required)* — number: Compounding periods per year (12 monthly, 365 daily).
- `toNominal` — boolean: false (default) returns the effective rate; true returns the nominal rate.

Outputs:

- `effectiveRatePct` — Effective annual rate (APY), percent.
- `nominalRatePct` — Nominal rate, percent (when toNominal).

## npv

Net present value of a cashflow series (index 0 is today; outflows negative) discounted at a per-period rate.

**Endpoint:** `POST /api/calc/npv` · **MCP tool:** `npv`

Inputs:

- `cashflows` *(required)* — array of number: Cashflows by period, starting at period 0. Outflows are negative.
- `discountRatePct` *(required)* — number: Discount rate per period in percent.

Outputs:

- `npv` — Net present value.

## irr

Internal rate of return: the per-period rate that zeroes the NPV of a cashflow series. Returns a percent, or null when the series never crosses zero.

**Endpoint:** `POST /api/calc/irr` · **MCP tool:** `irr`

Inputs:

- `cashflows` *(required)* — array of number: Cashflows by period, starting at period 0. Outflows are negative.

Outputs:

- `irrPct` — Internal rate of return, percent (null if none).

## refi-breakeven

Refinance break-even: monthly saving, whole months to recoup closing costs, and (if remainingMonths given) the net saving over the remaining term.

**Endpoint:** `POST /api/calc/refi-breakeven` · **MCP tool:** `refi-breakeven`

Inputs:

- `closingCosts` *(required)* — number: Upfront cost to refinance.
- `currentPayment` *(required)* — number: Current monthly payment.
- `newPayment` *(required)* — number: New monthly payment after refinancing.
- `remainingMonths` — number: Optional. Months left on the loan, for the lifetime saving.

Outputs:

- `monthlySaving` — Monthly saving.
- `breakevenMonths` — Whole months to recoup (null if no saving).
- `lifetimeSaving` — Net lifetime saving (null if no term).

## emergency-fund

Months of runway: liquid savings divided by monthly expenses.

**Endpoint:** `POST /api/calc/emergency-fund` · **MCP tool:** `emergency-fund`

Inputs:

- `liquidSavings` *(required)* — number: Cash and liquid savings on hand.
- `monthlyExpenses` *(required)* — number: Total monthly expenses.

Outputs:

- `months` — Months of runway (null if expenses<=0).

## mortgage-affordability

Maximum loan and home price the income supports: the DTI cap on gross monthly income (less existing debts) sets the payment, whose present value at the rate and term is the loan.

**Endpoint:** `POST /api/calc/mortgage-affordability` · **MCP tool:** `mortgage-affordability`

Inputs:

- `annualIncome` *(required)* — number: Gross annual income.
- `dtiPct` *(required)* — number: Max share of gross monthly income for the payment, in percent (e.g. 36).
- `rate` *(required)* — number: Annual interest rate in percent.
- `termYears` *(required)* — number: Loan term in years.
- `monthlyDebts` — number: Optional. Existing monthly debt payments (default 0).
- `downPayment` — number: Optional. Cash down payment, added to the loan for the home price (default 0).

Outputs:

- `maxMonthlyPayment` — Max payment.
- `maxLoan` — Max loan.
- `maxHomePrice` — Max home price.

## debt-payoff

Multi-debt payoff plan under a fixed monthly budget. method 'avalanche' (highest rate first) minimizes interest; 'snowball' (smallest balance first) clears accounts soonest. Returns months, total interest, and payoff order; flags insolvent budgets.

**Endpoint:** `POST /api/calc/debt-payoff` · **MCP tool:** `debt-payoff`

Inputs:

- `debts` *(required)* — array of objects: The debts to pay off.
- `monthlyBudget` *(required)* — number: Total amount available across all debts each month.
- `method` — string, one of: avalanche, snowball: Payoff strategy (default avalanche).

Outputs:

- `months` — Months to debt-free (null if insolvent).
- `totalInterest` — Total interest (null if insolvent).
- `payoffOrder` — Debt names in payoff order.
- `insolvent` — True if the budget can't keep up.

## portfolio-longevity

How many years a balance lasts while withdrawing from it: the balance grows each year, then the withdrawal (optionally stepping up) is taken. Returns the depletion year, or sustainable=true when it outlasts 200 years.

**Endpoint:** `POST /api/calc/portfolio-longevity` · **MCP tool:** `portfolio-longevity`

Inputs:

- `balance` *(required)* — number: Starting balance.
- `annualWithdrawal` *(required)* — number: Amount withdrawn in the first year.
- `annualRatePct` *(required)* — number: Annual portfolio growth in percent.
- `withdrawalGrowthPct` — number: Optional. Yearly step-up of the withdrawal in percent (default 0).

Outputs:

- `years` — Depletion year (null if sustainable).
- `sustainable` — True if it outlasts 200 years.

## present-value

Present value of a single future amount discounted annually. The inverse of future-value.

**Endpoint:** `POST /api/calc/present-value` · **MCP tool:** `present-value`

Inputs:

- `futureAmount` *(required)* — number: Amount received in the future.
- `annualRatePct` *(required)* — number: Annual discount rate in percent.
- `years` *(required)* — number: Number of years until the amount is received.

Outputs:

- `pv` — Present value.

## required-return

Annual return needed to grow a starting value to a target over a number of years, optionally with a fixed annual contribution. With no contribution this equals CAGR. Returns a percent, or null when unreachable.

**Endpoint:** `POST /api/calc/required-return` · **MCP tool:** `required-return`

Inputs:

- `begin` *(required)* — number: Starting value.
- `end` *(required)* — number: Target ending value.
- `years` *(required)* — number: Number of years.
- `annualContribution` — number: Optional. Amount added each year (default 0).

Outputs:

- `ratePct` — Annual rate, percent (null if unreachable).

## yield-to-maturity

Bond yield to maturity: the nominal annual yield that prices a bond at the given price, with periodic coupons and face returned at maturity. Solved numerically. Returns a percent, or null.

**Endpoint:** `POST /api/calc/yield-to-maturity` · **MCP tool:** `yield-to-maturity`

Inputs:

- `price` *(required)* — number: Current bond price.
- `faceValue` *(required)* — number: Face (par) value repaid at maturity.
- `couponRatePct` *(required)* — number: Annual coupon rate in percent of face.
- `years` *(required)* — number: Years to maturity.
- `periodsPerYear` — number: Coupon periods per year (default 2 = semiannual).

Outputs:

- `yieldPct` — Nominal annual yield, percent (null if none).

## tax-from-brackets

Progressive tax from caller-supplied brackets. No jurisdiction, year, or rates are baked in: pass the brackets yourself. Returns total tax, effective rate, and marginal rate.

**Endpoint:** `POST /api/calc/tax-from-brackets` · **MCP tool:** `tax-from-brackets`

Inputs:

- `income` *(required)* — number: Taxable income.
- `brackets` *(required)* — array of objects: Ordered tax bands. The final band may omit upTo to run to infinity.

Outputs:

- `tax` — Total tax.
- `effectiveRatePct` — Effective rate, percent.
- `marginalRatePct` — Marginal rate, percent.

## margin-markup

Convert between margin and markup. Supply any one of cost/price plus one of marginPct/markupPct (or both cost and price); returns cost, price, profit, marginPct, and markupPct.

**Endpoint:** `POST /api/calc/margin-markup` · **MCP tool:** `margin-markup`

Inputs:

- `cost` — number: Unit cost.
- `price` — number: Selling price.
- `marginPct` — number: Profit as a percent of price.
- `markupPct` — number: Profit as a percent of cost.

Outputs:

- `cost` — Cost.
- `price` — Price.
- `profit` — Profit.
- `marginPct` — Margin, percent.
- `markupPct` — Markup, percent.

## compound-interest

Compound growth at any frequency, with an optional contribution each period (paid at period end). Generalizes future-value (periodsPerYear 1) and contributions (periodsPerYear 12).

**Endpoint:** `POST /api/calc/compound-interest` · **MCP tool:** `compound-interest`

Inputs:

- `principal` *(required)* — number: Starting amount.
- `annualRatePct` *(required)* — number: Annual growth rate in percent.
- `years` *(required)* — number: Number of years.
- `periodsPerYear` — number: Compounding periods per year (default 1).
- `contributionPerPeriod` — number: Optional. Amount added each period (default 0).

Outputs:

- `value` — Result value.

## de-gross-to-net

German net (Netto) salary from gross (Brutto). No tax tables are baked in: look up the current year's statutory figures and pass them in. Income tax (Lohnsteuer) and Soli are amounts; church tax is a percent of the income tax; the four employee social rates and the two contribution ceilings are inputs. Use consistent units (e.g. all annual).

**Endpoint:** `POST /api/calc/de-gross-to-net` · **MCP tool:** `de-gross-to-net`

Inputs:

- `gross` *(required)* — number: Gross salary (Brutto).
- `incomeTax` — number: Income tax (Lohnsteuer) amount for the period — look up via the §32a / Steuerklasse tables.
- `soli` — number: Solidarity surcharge (Solidaritätszuschlag) amount (often 0 below the threshold).
- `churchTaxPct` — number: Church tax (Kirchensteuer) rate in percent of income tax (8 or 9, 0 if none).
- `pensionPct` — number: Employee pension (Rentenversicherung) rate in percent (e.g. 9.3).
- `unemploymentPct` — number: Employee unemployment (Arbeitslosenversicherung) rate in percent (e.g. 1.3).
- `healthPct` — number: Employee health (Krankenversicherung incl. Zusatzbeitrag) rate in percent.
- `carePct` — number: Employee long-term care (Pflegeversicherung) rate in percent.
- `pensionCeiling` — number: Contribution ceiling (Beitragsbemessungsgrenze) for pension and unemployment.
- `healthCeiling` — number: Contribution ceiling for health and care.

Outputs:

- `gross` — Gross.
- `incomeTax` — Income tax.
- `soli` — Soli.
- `churchTax` — Church tax.
- `contributions` — { pension, unemployment, health, care, total }.
- `totalDeductions` — Total deductions.
- `net` — Net.

## vat

Value-added tax (MwSt/USt, sales tax) on a price. By default adds the tax to a net price; with inclusive=true treats the amount as gross and extracts the tax. The rate is always an input (19 or 7 for Germany, etc.).

**Endpoint:** `POST /api/calc/vat` · **MCP tool:** `vat`

Inputs:

- `amount` *(required)* — number: The price.
- `ratePct` *(required)* — number: VAT rate in percent (e.g. 19 or 7).
- `inclusive` — boolean: false (default): amount is net, add the tax. true: amount is gross, extract the tax.

Outputs:

- `net` — Net price.
- `tax` — Tax amount.
- `gross` — Gross price.

## roi

Return on investment: total percent gain, plus the annualized rate when a holding period in years is given.

**Endpoint:** `POST /api/calc/roi` · **MCP tool:** `roi`

Inputs:

- `initial` *(required)* — number: Amount invested.
- `finalValue` *(required)* — number: Ending value.
- `years` — number: Optional. Holding period in years, for the annualized rate.

Outputs:

- `roiPct` — Total return, percent.
- `annualizedPct` — Annualized return, percent (null if no years).

## real-return

Real (inflation-adjusted) return from a nominal rate via the Fisher relation: (1+nominal)/(1+inflation) - 1.

**Endpoint:** `POST /api/calc/real-return` · **MCP tool:** `real-return`

Inputs:

- `nominalRatePct` *(required)* — number: Nominal annual rate in percent.
- `inflationRatePct` *(required)* — number: Annual inflation in percent.

Outputs:

- `realPct` — Real return, percent.

## return-stats

Mean, sample variance, and sample standard deviation (n-1) of a series of returns. Pass percents to get a percent stdev (volatility).

**Endpoint:** `POST /api/calc/return-stats` · **MCP tool:** `return-stats`

Inputs:

- `returns` *(required)* — array of number: The return series (e.g. yearly percents).

Outputs:

- `count` — Number of returns.
- `mean` — Mean return.
- `variance` — Sample variance (null if <2).
- `stdev` — Sample stdev / volatility (null if <2).

## sharpe-ratio

Sharpe ratio: excess mean return per unit of volatility, (mean - riskFree) / stdev. Null when volatility is undefined or zero.

**Endpoint:** `POST /api/calc/sharpe-ratio` · **MCP tool:** `sharpe-ratio`

Inputs:

- `returns` *(required)* — array of number: The return series (percents).
- `riskFreePct` — number: Risk-free rate in the same unit (default 0).

Outputs:

- `sharpe` — Sharpe ratio (null if no volatility).
- `meanPct` — Mean return.
- `stdevPct` — Volatility.

## max-drawdown

Maximum drawdown of a value series: the largest peak-to-trough decline, as a positive percent.

**Endpoint:** `POST /api/calc/max-drawdown` · **MCP tool:** `max-drawdown`

Inputs:

- `series` *(required)* — array of number: Sequence of values (e.g. portfolio levels).

Outputs:

- `maxDrawdownPct` — Largest peak-to-trough decline, percent.

## holding-period-return

Holding-period return: (income + capital gain) / starting value, in percent.

**Endpoint:** `POST /api/calc/holding-period-return` · **MCP tool:** `holding-period-return`

Inputs:

- `income` *(required)* — number: Income received over the period.
- `endValue` *(required)* — number: Ending value.
- `beginValue` *(required)* — number: Starting value.

Outputs:

- `hprPct` — Holding-period return, percent (null if begin=0).

## fee-drag

Effect of an annual fee: the compounded balance at the gross rate vs net of the fee, and the amount lost to fees.

**Endpoint:** `POST /api/calc/fee-drag` · **MCP tool:** `fee-drag`

Inputs:

- `principal` *(required)* — number: Starting amount.
- `grossAnnualPct` *(required)* — number: Gross annual return in percent.
- `feePct` *(required)* — number: Annual fee in percent.
- `years` *(required)* — number: Number of years.

Outputs:

- `gross` — Gross balance.
- `net` — Net of fees.
- `lostToFees` — Amount lost to fees.

## dollar-cost-averaging

Dollar-cost averaging: buying a fixed amount each period at the given prices. Returns units accumulated, total invested, average cost, and final value at the last price.

**Endpoint:** `POST /api/calc/dollar-cost-averaging` · **MCP tool:** `dollar-cost-averaging`

Inputs:

- `prices` *(required)* — array of number: Price at each purchase period.
- `periodicInvestment` *(required)* — number: Fixed amount invested each period.

Outputs:

- `units` — Units accumulated.
- `invested` — Total invested.
- `avgCost` — Average cost per unit (null if none).
- `finalValue` — Value at the last price.

## bond-price

Price of a coupon bond given a yield: present value of the coupons plus the face at maturity.

**Endpoint:** `POST /api/calc/bond-price` · **MCP tool:** `bond-price`

Inputs:

- `faceValue` *(required)* — number: Face (par) value.
- `couponRatePct` *(required)* — number: Annual coupon rate in percent of face.
- `years` *(required)* — number: Years to maturity.
- `yieldPct` *(required)* — number: Annual yield in percent.
- `periodsPerYear` — number: Coupon periods per year (default 2).

Outputs:

- `price` — Bond price (null if degenerate).

## current-yield

Current yield: the annual coupon as a percent of the bond's current price.

**Endpoint:** `POST /api/calc/current-yield` · **MCP tool:** `current-yield`

Inputs:

- `price` *(required)* — number: Current bond price.
- `faceValue` *(required)* — number: Face value.
- `couponRatePct` *(required)* — number: Annual coupon rate in percent of face.

Outputs:

- `currentYieldPct` — Current yield, percent (null if price<=0).

## bond-duration

Macaulay duration (PV-weighted average time of cashflows, in years) and modified duration (price sensitivity to yield).

**Endpoint:** `POST /api/calc/bond-duration` · **MCP tool:** `bond-duration`

Inputs:

- `faceValue` *(required)* — number: Face value.
- `couponRatePct` *(required)* — number: Annual coupon rate in percent.
- `years` *(required)* — number: Years to maturity.
- `yieldPct` *(required)* — number: Annual yield in percent.
- `periodsPerYear` — number: Coupon periods per year (default 2).

Outputs:

- `macaulay` — Macaulay duration, years.
- `modified` — Modified duration.

## convexity

Bond convexity (years^2): the curvature of price with respect to yield, used alongside duration.

**Endpoint:** `POST /api/calc/convexity` · **MCP tool:** `convexity`

Inputs:

- `faceValue` *(required)* — number: Face value.
- `couponRatePct` *(required)* — number: Annual coupon rate in percent.
- `years` *(required)* — number: Years to maturity.
- `yieldPct` *(required)* — number: Annual yield in percent.
- `periodsPerYear` — number: Coupon periods per year (default 2).

Outputs:

- `convexity` — Convexity, years^2.

## zero-coupon-price

Price of a zero-coupon bond: face value discounted to today at the yield.

**Endpoint:** `POST /api/calc/zero-coupon-price` · **MCP tool:** `zero-coupon-price`

Inputs:

- `faceValue` *(required)* — number: Face value.
- `years` *(required)* — number: Years to maturity.
- `yieldPct` *(required)* — number: Annual yield in percent.
- `compoundingPerYear` — number: Compounding periods per year (default 1).

Outputs:

- `price` — Zero-coupon price.

## accrued-interest

Accrued interest since the last coupon: the annual coupon pro-rated by days elapsed over the day-count basis.

**Endpoint:** `POST /api/calc/accrued-interest` · **MCP tool:** `accrued-interest`

Inputs:

- `faceValue` *(required)* — number: Face value.
- `couponRatePct` *(required)* — number: Annual coupon rate in percent.
- `daysSinceLastCoupon` *(required)* — number: Days since the last coupon.
- `dayCountBasis` — number: Day-count basis (default 360).

Outputs:

- `accrued` — Accrued interest.

## black-scholes

Black-Scholes price of a European call or put option, plus d1/d2. Volatility and rates in percent; optional continuous dividend yield.

**Endpoint:** `POST /api/calc/black-scholes` · **MCP tool:** `black-scholes`

Inputs:

- `spot` *(required)* — number: Current underlying price.
- `strike` *(required)* — number: Strike price.
- `years` *(required)* — number: Time to expiry in years.
- `volatilityPct` *(required)* — number: Annualized volatility in percent.
- `riskFreePct` *(required)* — number: Risk-free rate in percent.
- `dividendYieldPct` — number: Continuous dividend yield in percent (default 0).
- `type` — string, one of: call, put: Option type (default call).

Outputs:

- `price` — Option price (null if degenerate).
- `d1` — d1.
- `d2` — d2.

## option-greeks

Black-Scholes greeks for a European option: delta, gamma, vega (per 1% vol), theta (per day), rho (per 1% rate).

**Endpoint:** `POST /api/calc/option-greeks` · **MCP tool:** `option-greeks`

Inputs:

- `spot` *(required)* — number: Current underlying price.
- `strike` *(required)* — number: Strike price.
- `years` *(required)* — number: Time to expiry in years.
- `volatilityPct` *(required)* — number: Annualized volatility in percent.
- `riskFreePct` *(required)* — number: Risk-free rate in percent.
- `dividendYieldPct` — number: Continuous dividend yield in percent (default 0).
- `type` — string, one of: call, put: Option type (default call).

Outputs:

- `delta` — Delta.
- `gamma` — Gamma.
- `vega` — Vega per 1% vol.
- `theta` — Theta per day.
- `rho` — Rho per 1% rate.

## put-call-parity

Put-call parity: given one option price, returns both. Provide call or put, plus spot, strike, years, and the rate.

**Endpoint:** `POST /api/calc/put-call-parity` · **MCP tool:** `put-call-parity`

Inputs:

- `call` — number: Call price (provide call or put).
- `put` — number: Put price (provide call or put).
- `spot` *(required)* — number: Underlying price.
- `strike` *(required)* — number: Strike price.
- `years` *(required)* — number: Time to expiry in years.
- `riskFreePct` *(required)* — number: Risk-free rate in percent.
- `dividendYieldPct` — number: Continuous dividend yield in percent (default 0).

Outputs:

- `call` — Call price.
- `put` — Put price.

## option-breakeven

Break-even underlying price at expiry: strike + premium for a call, strike - premium for a put.

**Endpoint:** `POST /api/calc/option-breakeven` · **MCP tool:** `option-breakeven`

Inputs:

- `strike` *(required)* — number: Strike price.
- `premium` *(required)* — number: Option premium paid.
- `type` — string, one of: call, put: Option type (default call).

Outputs:

- `breakeven` — Break-even underlying price.

## intrinsic-time-value

Split an option premium into intrinsic value (in-the-money amount) and time value.

**Endpoint:** `POST /api/calc/intrinsic-time-value` · **MCP tool:** `intrinsic-time-value`

Inputs:

- `spot` *(required)* — number: Underlying price.
- `strike` *(required)* — number: Strike price.
- `premium` *(required)* — number: Option premium.
- `type` — string, one of: call, put: Option type (default call).

Outputs:

- `intrinsic` — Intrinsic value.
- `timeValue` — Time value.

## annuity-pv

Present value of an ordinary annuity (level payment at each period end). rate is the per-period rate in percent.

**Endpoint:** `POST /api/calc/annuity-pv` · **MCP tool:** `annuity-pv`

Inputs:

- `payment` *(required)* — number: Payment per period.
- `ratePct` *(required)* — number: Rate per period in percent.
- `periods` *(required)* — number: Number of periods.

Outputs:

- `pv` — Present value.

## annuity-fv

Future value of an ordinary annuity. rate is the per-period rate in percent.

**Endpoint:** `POST /api/calc/annuity-fv` · **MCP tool:** `annuity-fv`

Inputs:

- `payment` *(required)* — number: Payment per period.
- `ratePct` *(required)* — number: Rate per period in percent.
- `periods` *(required)* — number: Number of periods.

Outputs:

- `fv` — Future value.

## annuity-payment

The level payment that amortizes a present value over n periods (the loan-payment formula). rate is per period.

**Endpoint:** `POST /api/calc/annuity-payment` · **MCP tool:** `annuity-payment`

Inputs:

- `presentValue` *(required)* — number: Present value / principal.
- `ratePct` *(required)* — number: Rate per period in percent.
- `periods` *(required)* — number: Number of periods.

Outputs:

- `payment` — Level payment (null if periods<=0).

## perpetuity

Present value of a level or growing perpetuity: payment / (rate - growth). Null when growth is not below the rate.

**Endpoint:** `POST /api/calc/perpetuity` · **MCP tool:** `perpetuity`

Inputs:

- `payment` *(required)* — number: Periodic payment.
- `ratePct` *(required)* — number: Discount rate in percent.
- `growthPct` — number: Optional. Payment growth rate in percent (default 0).

Outputs:

- `pv` — Present value (null if growth>=rate).

## rule-of-72

Years to double: the rule-of-72 estimate (72/rate) and the exact figure (ln2 / ln(1+rate)).

**Endpoint:** `POST /api/calc/rule-of-72` · **MCP tool:** `rule-of-72`

Inputs:

- `ratePct` *(required)* — number: Growth rate in percent.

Outputs:

- `years72` — 72/rate estimate.
- `exactYears` — Exact doubling time.

## payback-period

Simple payback period: periods until cumulative cashflows recover the initial cost, interpolated within the crossing period. Null if never.

**Endpoint:** `POST /api/calc/payback-period` · **MCP tool:** `payback-period`

Inputs:

- `initialCost` *(required)* — number: Upfront cost.
- `cashflows` *(required)* — array of number: Inflow each period.

Outputs:

- `years` — Payback in periods (null if never).

## discounted-payback

Discounted payback period: like payback-period but each cashflow is discounted at the per-period rate.

**Endpoint:** `POST /api/calc/discounted-payback` · **MCP tool:** `discounted-payback`

Inputs:

- `initialCost` *(required)* — number: Upfront cost.
- `cashflows` *(required)* — array of number: Inflow each period.
- `ratePct` *(required)* — number: Discount rate per period in percent.

Outputs:

- `years` — Discounted payback in periods (null if never).

## mirr

Modified internal rate of return: negatives financed at financeRate, positives reinvested at reinvestRate. Percents in and out.

**Endpoint:** `POST /api/calc/mirr` · **MCP tool:** `mirr`

Inputs:

- `cashflows` *(required)* — array of number: Cashflows by period (index 0 today; outflows negative).
- `financeRatePct` *(required)* — number: Finance rate in percent.
- `reinvestRatePct` *(required)* — number: Reinvestment rate in percent.

Outputs:

- `mirrPct` — Modified IRR, percent (null if degenerate).

## xnpv

Date-aware net present value: each amount discounted by its fractional years (act/365) from the first cashflow's date. Annual rate in percent.

**Endpoint:** `POST /api/calc/xnpv` · **MCP tool:** `xnpv`

Inputs:

- `cashflows` *(required)* — array of objects: Dated cashflows; the first date is the valuation date.
- `annualRatePct` *(required)* — number: Annual discount rate in percent.

Outputs:

- `npv` — Date-aware net present value.

## xirr

Date-aware internal rate of return: the annual rate that zeroes the XNPV of irregular dated cashflows. Null if no rate fits.

**Endpoint:** `POST /api/calc/xirr` · **MCP tool:** `xirr`

Inputs:

- `cashflows` *(required)* — array of objects: Dated cashflows; the first date is the valuation date.

Outputs:

- `xirrPct` — Date-aware IRR, percent (null if none).

## loan-apr

Effective APR including upfront fees: the note-rate payment priced against the net proceeds (amount - fees). Annual percent.

**Endpoint:** `POST /api/calc/loan-apr` · **MCP tool:** `loan-apr`

Inputs:

- `amount` *(required)* — number: Loan amount.
- `ratePct` *(required)* — number: Note (nominal) annual rate in percent.
- `termMonths` *(required)* — number: Term in months.
- `fees` — number: Optional. Upfront fees / points in currency (default 0).

Outputs:

- `aprPct` — Effective APR, percent (null if degenerate).

## interest-only-payment

Interest-only monthly payment on a balance.

**Endpoint:** `POST /api/calc/interest-only-payment` · **MCP tool:** `interest-only-payment`

Inputs:

- `amount` *(required)* — number: Outstanding balance.
- `ratePct` *(required)* — number: Annual rate in percent.

Outputs:

- `payment` — Monthly interest payment.

## balloon-loan

Balloon loan: payment based on a long amortization, with the balloon being the balance still due after the shorter balloon term.

**Endpoint:** `POST /api/calc/balloon-loan` · **MCP tool:** `balloon-loan`

Inputs:

- `amount` *(required)* — number: Loan amount.
- `ratePct` *(required)* — number: Annual rate in percent.
- `balloonMonths` *(required)* — number: Months until the balloon is due.
- `amortMonths` *(required)* — number: Amortization basis in months.

Outputs:

- `payment` — Monthly payment.
- `balloon` — Balloon balance due.

## ltv

Loan-to-value ratio, percent (loan / property value).

**Endpoint:** `POST /api/calc/ltv` · **MCP tool:** `ltv`

Inputs:

- `loanAmount` *(required)* — number: Loan amount.
- `propertyValue` *(required)* — number: Property value.

Outputs:

- `ltvPct` — Loan-to-value, percent (null if value<=0).

## dti

Debt-to-income ratio, percent (monthly debt / gross monthly income).

**Endpoint:** `POST /api/calc/dti` · **MCP tool:** `dti`

Inputs:

- `monthlyDebt` *(required)* — number: Total monthly debt payments.
- `grossMonthlyIncome` *(required)* — number: Gross monthly income.

Outputs:

- `dtiPct` — Debt-to-income, percent (null if income<=0).

## credit-card-payoff

Months to clear a credit-card balance at a fixed monthly payment, plus interest paid. Null when the payment can't cover the first month's interest.

**Endpoint:** `POST /api/calc/credit-card-payoff` · **MCP tool:** `credit-card-payoff`

Inputs:

- `balance` *(required)* — number: Current balance.
- `aprPct` *(required)* — number: Annual percentage rate in percent.
- `monthlyPayment` *(required)* — number: Fixed monthly payment.

Outputs:

- `months` — Months to clear (null if never).
- `totalInterest` — Total interest (null if never).
- `totalPaid` — Total paid (null if never).

## points-breakeven

Mortgage points break-even: the upfront cost to buy down the rate, the monthly payment saving, and the whole months to recoup it.

**Endpoint:** `POST /api/calc/points-breakeven` · **MCP tool:** `points-breakeven`

Inputs:

- `loanAmount` *(required)* — number: Loan amount.
- `ratePct` *(required)* — number: Base annual rate in percent.
- `termMonths` *(required)* — number: Term in months.
- `pointsPct` *(required)* — number: Points paid, percent of the loan.
- `reducedRatePct` *(required)* — number: Reduced annual rate after buying points.

Outputs:

- `cost` — Upfront cost of points.
- `monthlySaving` — Monthly payment saving.
- `breakevenMonths` — Whole months to recoup (null if no saving).

## biweekly-payoff

Biweekly mortgage acceleration: paying half the monthly payment every two weeks. Returns the biweekly payment and the months and interest saved.

**Endpoint:** `POST /api/calc/biweekly-payoff` · **MCP tool:** `biweekly-payoff`

Inputs:

- `amount` *(required)* — number: Loan amount.
- `ratePct` *(required)* — number: Annual rate in percent.
- `termMonths` *(required)* — number: Original term in months.

Outputs:

- `biweeklyPayment` — Biweekly payment.
- `monthsSaved` — Months saved.
- `interestSaved` — Interest saved.

## cap-rate

Capitalization rate: net operating income as a percent of property value.

**Endpoint:** `POST /api/calc/cap-rate` · **MCP tool:** `cap-rate`

Inputs:

- `noi` *(required)* — number: Net operating income.
- `propertyValue` *(required)* — number: Property value.

Outputs:

- `capRatePct` — Cap rate, percent (null if value<=0).

## cash-on-cash

Cash-on-cash return: annual pre-tax cash flow as a percent of the cash invested.

**Endpoint:** `POST /api/calc/cash-on-cash` · **MCP tool:** `cash-on-cash`

Inputs:

- `annualCashFlow` *(required)* — number: Annual pre-tax cash flow.
- `cashInvested` *(required)* — number: Cash invested.

Outputs:

- `cashOnCashPct` — Cash-on-cash return, percent (null if invested<=0).

## noi

Net operating income: gross rental income less vacancy and operating expenses.

**Endpoint:** `POST /api/calc/noi` · **MCP tool:** `noi`

Inputs:

- `grossRentalIncome` *(required)* — number: Gross annual rental income.
- `vacancyPct` *(required)* — number: Vacancy rate in percent.
- `operatingExpenses` *(required)* — number: Annual operating expenses.

Outputs:

- `noi` — Net operating income.

## gross-rent-multiplier

Gross rent multiplier: price divided by gross annual rent.

**Endpoint:** `POST /api/calc/gross-rent-multiplier` · **MCP tool:** `gross-rent-multiplier`

Inputs:

- `price` *(required)* — number: Purchase price.
- `grossAnnualRent` *(required)* — number: Gross annual rent.

Outputs:

- `grm` — Gross rent multiplier (null if rent<=0).

## dscr

Debt service coverage ratio: net operating income divided by annual debt service.

**Endpoint:** `POST /api/calc/dscr` · **MCP tool:** `dscr`

Inputs:

- `noi` *(required)* — number: Net operating income.
- `annualDebtService` *(required)* — number: Annual debt service.

Outputs:

- `dscr` — Debt service coverage ratio (null if debt<=0).

## wacc

Weighted average cost of capital: equity and after-tax debt weighted by the capital structure. Percents in and out.

**Endpoint:** `POST /api/calc/wacc` · **MCP tool:** `wacc`

Inputs:

- `equity` *(required)* — number: Market value of equity.
- `debt` *(required)* — number: Market value of debt.
- `costEquityPct` *(required)* — number: Cost of equity in percent.
- `costDebtPct` *(required)* — number: Cost of debt in percent.
- `taxRatePct` *(required)* — number: Tax rate in percent.

Outputs:

- `waccPct` — WACC, percent (null if no capital).

## break-even-units

Break-even volume: fixed costs divided by the per-unit contribution (price - variable cost), plus the revenue at that volume.

**Endpoint:** `POST /api/calc/break-even-units` · **MCP tool:** `break-even-units`

Inputs:

- `fixedCosts` *(required)* — number: Total fixed costs.
- `pricePerUnit` *(required)* — number: Selling price per unit.
- `variableCostPerUnit` *(required)* — number: Variable cost per unit.

Outputs:

- `units` — Break-even units (null if no contribution).
- `revenue` — Revenue at break-even (null if none).

## contribution-margin

Contribution margin per unit and as a percent of price.

**Endpoint:** `POST /api/calc/contribution-margin` · **MCP tool:** `contribution-margin`

Inputs:

- `pricePerUnit` *(required)* — number: Selling price per unit.
- `variableCostPerUnit` *(required)* — number: Variable cost per unit.

Outputs:

- `contributionMargin` — Contribution per unit.
- `ratioPct` — Contribution margin ratio, percent (null if price=0).

## current-ratio

Current ratio: current assets over current liabilities.

**Endpoint:** `POST /api/calc/current-ratio` · **MCP tool:** `current-ratio`

Inputs:

- `currentAssets` *(required)* — number: Current assets.
- `currentLiabilities` *(required)* — number: Current liabilities.

Outputs:

- `currentRatio` — Current ratio (null if liabilities<=0).

## quick-ratio

Quick (acid-test) ratio: (current assets - inventory) over current liabilities.

**Endpoint:** `POST /api/calc/quick-ratio` · **MCP tool:** `quick-ratio`

Inputs:

- `currentAssets` *(required)* — number: Current assets.
- `inventory` *(required)* — number: Inventory.
- `currentLiabilities` *(required)* — number: Current liabilities.

Outputs:

- `quickRatio` — Quick ratio (null if liabilities<=0).

## roe

Return on equity, percent: net income over shareholders' equity.

**Endpoint:** `POST /api/calc/roe` · **MCP tool:** `roe`

Inputs:

- `netIncome` *(required)* — number: Net income.
- `equity` *(required)* — number: Shareholders' equity.

Outputs:

- `roePct` — Return on equity, percent (null if equity<=0).

## roa

Return on assets, percent: net income over total assets.

**Endpoint:** `POST /api/calc/roa` · **MCP tool:** `roa`

Inputs:

- `netIncome` *(required)* — number: Net income.
- `totalAssets` *(required)* — number: Total assets.

Outputs:

- `roaPct` — Return on assets, percent (null if assets<=0).

## declining-balance-depreciation

Declining-balance depreciation: a fixed percent of the reducing book value, for a given year. Returns that year's depreciation and the remaining book value.

**Endpoint:** `POST /api/calc/declining-balance-depreciation` · **MCP tool:** `declining-balance-depreciation`

Inputs:

- `value` *(required)* — number: Initial cost.
- `ratePct` *(required)* — number: Annual depreciation rate in percent.
- `year` *(required)* — number: Year (1-based).

Outputs:

- `depreciation` — Depreciation this year.
- `bookValue` — Book value at year end.

## double-declining-depreciation

Double-declining-balance depreciation: 2/usefulYears of the book value each year, not falling below salvage.

**Endpoint:** `POST /api/calc/double-declining-depreciation` · **MCP tool:** `double-declining-depreciation`

Inputs:

- `value` *(required)* — number: Initial cost.
- `usefulYears` *(required)* — number: Useful life in years.
- `year` *(required)* — number: Year (1-based).
- `salvage` — number: Salvage value (default 0).

Outputs:

- `depreciation` — Depreciation this year.
- `bookValue` — Book value at year end.

## sum-of-years-digits

Sum-of-the-years'-digits depreciation: the depreciable base weighted toward the early years.

**Endpoint:** `POST /api/calc/sum-of-years-digits` · **MCP tool:** `sum-of-years-digits`

Inputs:

- `value` *(required)* — number: Initial cost.
- `salvage` *(required)* — number: Salvage value.
- `usefulYears` *(required)* — number: Useful life in years.
- `year` *(required)* — number: Year (1-based).

Outputs:

- `depreciation` — Depreciation this year.
- `bookValue` — Book value at year end.

## units-of-production-depreciation

Units-of-production depreciation: the depreciable base spread over total expected units, charged by the units used this period.

**Endpoint:** `POST /api/calc/units-of-production-depreciation` · **MCP tool:** `units-of-production-depreciation`

Inputs:

- `value` *(required)* — number: Initial cost.
- `salvage` *(required)* — number: Salvage value.
- `totalUnits` *(required)* — number: Total expected units over the life.
- `unitsThisPeriod` *(required)* — number: Units produced this period.

Outputs:

- `depreciation` — Depreciation this period (null if totalUnits<=0).

## net-worth

Net worth: assets minus liabilities.

**Endpoint:** `POST /api/calc/net-worth` · **MCP tool:** `net-worth`

Inputs:

- `assets` *(required)* — number: Total assets.
- `liabilities` *(required)* — number: Total liabilities.

Outputs:

- `netWorth` — Assets minus liabilities.

## budget-50-30-20

The 50/30/20 budget split of monthly income into needs, wants, and savings.

**Endpoint:** `POST /api/calc/budget-50-30-20` · **MCP tool:** `budget-50-30-20`

Inputs:

- `monthlyIncome` *(required)* — number: Monthly take-home income.

Outputs:

- `needs` — 50% needs.
- `wants` — 30% wants.
- `savings` — 20% savings.

## tip-split

Tip and split: the tip amount, the total, and the per-person share.

**Endpoint:** `POST /api/calc/tip-split` · **MCP tool:** `tip-split`

Inputs:

- `billAmount` *(required)* — number: Bill amount.
- `tipPct` *(required)* — number: Tip in percent.
- `people` — number: Number of people (default 1).

Outputs:

- `tip` — Tip amount.
- `total` — Total with tip.
- `perPerson` — Per-person share.

## discount

A single percentage discount: the amount off and the final price.

**Endpoint:** `POST /api/calc/discount` · **MCP tool:** `discount`

Inputs:

- `price` *(required)* — number: Original price.
- `discountPct` *(required)* — number: Discount in percent.

Outputs:

- `discount` — Amount off.
- `finalPrice` — Final price.

## successive-discounts

Stacked discounts applied in order: the final price and the effective single discount rate.

**Endpoint:** `POST /api/calc/successive-discounts` · **MCP tool:** `successive-discounts`

Inputs:

- `price` *(required)* — number: Original price.
- `discountsPct` *(required)* — array of number: Discounts in percent, applied in order.

Outputs:

- `finalPrice` — Final price.
- `effectivePct` — Effective single discount, percent (null if price=0).

## percentage-change

Percentage change from one value to another. Null when the starting value is zero.

**Endpoint:** `POST /api/calc/percentage-change` · **MCP tool:** `percentage-change`

Inputs:

- `from` *(required)* — number: Starting value.
- `to` *(required)* — number: Ending value.

Outputs:

- `changePct` — Percentage change (null if from=0).

## unit-price

Unit price: price divided by quantity (for comparing pack sizes). Null when quantity is zero.

**Endpoint:** `POST /api/calc/unit-price` · **MCP tool:** `unit-price`

Inputs:

- `price` *(required)* — number: Price.
- `quantity` *(required)* — number: Quantity / size.

Outputs:

- `unitPrice` — Price per unit (null if quantity=0).

## hourly-to-salary

Annualize an hourly rate (and the monthly equivalent).

**Endpoint:** `POST /api/calc/hourly-to-salary` · **MCP tool:** `hourly-to-salary`

Inputs:

- `hourlyRate` *(required)* — number: Hourly rate.
- `hoursPerWeek` — number: Hours per week (default 40).
- `weeksPerYear` — number: Weeks per year (default 52).

Outputs:

- `annual` — Annual salary.
- `monthly` — Monthly equivalent.

## salary-to-hourly

Hourly rate implied by an annual salary.

**Endpoint:** `POST /api/calc/salary-to-hourly` · **MCP tool:** `salary-to-hourly`

Inputs:

- `annualSalary` *(required)* — number: Annual salary.
- `hoursPerWeek` — number: Hours per week (default 40).
- `weeksPerYear` — number: Weeks per year (default 52).

Outputs:

- `hourly` — Hourly rate (null if hours<=0).

## after-tax-yield

After-tax yield: a yield reduced by the tax rate. Percents in and out.

**Endpoint:** `POST /api/calc/after-tax-yield` · **MCP tool:** `after-tax-yield`

Inputs:

- `yieldPct` *(required)* — number: Pre-tax yield in percent.
- `taxRatePct` *(required)* — number: Tax rate in percent.

Outputs:

- `afterTaxPct` — After-tax yield, percent.

## tax-equivalent-yield

Tax-equivalent yield: the taxable yield that matches a tax-free (e.g. muni) yield. Percents in and out.

**Endpoint:** `POST /api/calc/tax-equivalent-yield` · **MCP tool:** `tax-equivalent-yield`

Inputs:

- `taxFreeYieldPct` *(required)* — number: Tax-free yield in percent.
- `taxRatePct` *(required)* — number: Marginal tax rate in percent.

Outputs:

- `taxEquivalentPct` — Tax-equivalent yield, percent (null if tax>=100%).

## coast-fire

Coast FIRE: whether the current nest egg, left to grow untouched to retirement, already reaches the FIRE target. Returns the target, the projected balance, whether it coasts, and any shortfall.

**Endpoint:** `POST /api/calc/coast-fire` · **MCP tool:** `coast-fire`

Inputs:

- `currentNestEgg` *(required)* — number: Amount invested today.
- `annualRatePct` *(required)* — number: Expected annual growth in percent.
- `yearsToRetirement` *(required)* — number: Years until retirement.
- `annualSpend` *(required)* — number: Yearly spending in retirement.
- `withdrawalRatePct` — number: Safe withdrawal rate in percent (default 4).

Outputs:

- `fireTarget` — FIRE target.
- `projected` — Projected balance at retirement.
- `isCoasting` — True if it already coasts.
- `gap` — Shortfall in future-value terms.

## barista-fire

Barista FIRE: the nest egg needed when part-time income covers part of the spending, so the portfolio only funds the remainder at the safe withdrawal rate.

**Endpoint:** `POST /api/calc/barista-fire` · **MCP tool:** `barista-fire`

Inputs:

- `annualSpend` *(required)* — number: Yearly spending.
- `partTimeIncome` *(required)* — number: Yearly part-time income.
- `withdrawalRatePct` — number: Safe withdrawal rate in percent (default 4).

Outputs:

- `target` — Nest egg needed (null if withdrawal rate<=0).
