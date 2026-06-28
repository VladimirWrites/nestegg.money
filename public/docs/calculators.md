# nestegg calculators

Deterministic, pure finance calculators. Every function depends only on its inputs. None read user data, fetch live prices, or look up exchange rates. Currency conversion takes the rate as an explicit argument. Results are numbers and schedules, not advice.

All money is rounded half-up to two decimals (the app's `round2`: `Math.round((v + 1e-9) * 100) / 100`). Rates are given in percent unless noted (for example `6` means 6% per year). Dates are ISO strings (`YYYY-MM-DD`). The shared implementation is `public/lib/finance-math.js`, used by both the site and the calculator endpoints.

Each calculator below is reachable two ways: as a JSON endpoint (`POST /api/calc/<name>`, with the inputs as the JSON body) and as an MCP tool (Streamable HTTP at `/mcp`, same name and inputs). `GET /api/calc` lists them. Both are stateless, CORS-open, and require no authentication.

## amortization

Full monthly repayment schedule and summary for a loan.

- Inputs: `amount`, `rate` (annual %), `mode` (`"term"` or `"payment"`), `termYears` (when mode is term) or `payment` (when mode is payment), `startDate`, optional `extra` (array of `{ date, amount }` lump-sum principal payments), optional `fixedUntil` (date beyond which the rate is treated as an estimate).
- Outputs: `monthlyPayment`, `scheduledMonths`, `payments` (count), `totalInterest`, `totalPaid`, `payoffDate`, and `schedule` (rows of `{ type: "payment"|"extra", date, payment, interest, principal, balance }`).
- Formula: standard amortization. Payment `M = L * i / (1 - (1 + i)^-n)` where `i = rate/100/12` and `n = termYears * 12` (or `n` solved from the payment). Each month, interest `= round2(balance * i)`, principal `= round2(M - interest)`, balance carried forward. Dated extra payments reduce principal (credited 30/360 for the partial month). The final month settles the exact remaining balance.
- Rounding: each month's interest and payment are rounded to cents; the final payment absorbs the residue.

## loanPayoff

Time and interest saved by paying a fixed extra amount every month.

- Inputs: the same loan object, plus `extraMonthly`.
- Outputs: `baseline` and `accelerated` (`months`, `totalInterest`, `payoffDate`), `monthsSaved`, `interestSaved`.
- Formula: runs `amortization` twice, once at the baseline payment and once at `round2(baselinePayment + extraMonthly)` in payment mode, and differences the results.
- Rounding: cents, as amortization.

## futureValue

Future value of a single lump sum compounded annually.

- Inputs: `principal`, `annualRatePct`, `years`.
- Output: `principal * (1 + annualRatePct/100)^years`.
- Rounding: none (raw value); round at the presentation layer if needed.

## futureValueOfContributions

Future value of a fixed monthly contribution.

- Inputs: `monthly`, `annualRatePct`, `months`, optional `contribGrowthPct` (the contribution steps up this percent every 12 months).
- Output: month-by-month recurrence `fv = fv * (1 + i) + contribution`, with `i = annualRatePct/100/12`. Contributions are end-of-month (annuity-immediate).
- Rounding: none (raw value).

## cagr

Compound annual growth rate between two values.

- Inputs: `begin`, `end`, `years`.
- Output: `(end / begin)^(1/years) - 1`, a decimal (0.07 means 7%). Returns `null` if any input is not positive.
- Rounding: none.

## savingsRate

Fraction of income saved.

- Inputs: `income`, `savings`.
- Output: `savings / income`, a decimal. Returns `null` if income is not positive.
- Rounding: none.

## fxConvert

Convert an amount using a rate supplied by the caller. No rate is ever looked up.

- Inputs: `amount`, `rate` (units of the target currency per unit of the source currency).
- Output: `amount * rate`.
- Rounding: none (round at the presentation layer if you need cents).

## depreciate

Value after compounding down (or up) at a yearly rate. This is the method the app uses for long-term assets.

- Inputs: `value`, `annualRatePct`, `years`, `up` (false depreciates, true appreciates).
- Output: `value * (1 - r)^years` when depreciating, `value * (1 + r)^years` when appreciating, with `r = annualRatePct/100` clamped (appreciation up to 5 per year, depreciation up to 0.99 per year).
- Rounding: none.

## straightLineDepreciation

Value falling evenly from `value` to `salvage` over a useful life.

- Inputs: `value`, `salvage`, `usefulYears`, `yearsElapsed`.
- Output: `value - (value - salvage) * min(yearsElapsed, usefulYears) / usefulYears`, floored at `salvage`.
- Rounding: none.

## fireNumber

FIRE target nest egg and the path to it. Endpoint name `fire-number`.

- Inputs: `annualSpend`, optional `withdrawalRatePct` (default 4, the 4% rule), optional `currentNestEgg` (default 0), optional `annualContribution` (default 0), optional `annualRatePct` (default 0).
- Outputs: `target` (`annualSpend / (withdrawalRatePct/100)`, e.g. 25× spend at 4%), `gap` (`max(0, target - currentNestEgg)`), `yearsToFI`.
- Formula: `yearsToFI` solves the ordinary-annuity growth of `currentNestEgg` plus `annualContribution`, `target = currentNestEgg*(1+r)^t + annualContribution*((1+r)^t - 1)/r` with `r = annualRatePct/100`. It is `0` when the gap is already closed, and `null` when the target is unreachable (no contribution and no growth).
- Rounding: `target` and `gap` to cents; `yearsToFI` to two decimals.

## requiredContribution

Inverse of contributions: the monthly amount needed to reach a target. Endpoint name `required-contribution`.

- Inputs: `targetValue`, `annualRatePct`, `months`, optional `presentValue` (default 0).
- Output: `monthly`, the fixed end-of-month contribution such that `presentValue*(1+i)^n + monthly*((1+i)^n - 1)/i = targetValue`, with `i = annualRatePct/100/12` and `n = months`. Returns `null` for a non-positive horizon. Same annuity-immediate convention as `futureValueOfContributions`.
- Rounding: cents.

## inflationAdjust

Nominal-to-real conversion. Endpoint name `inflation-adjust`.

- Inputs: `amount`, `inflationRatePct`, `years`, optional `toNominal` (default false).
- Output: `value`. Deflating (default): `amount / (1 + inflationRatePct/100)^years`. With `toNominal` true: `amount * (1 + inflationRatePct/100)^years`.
- Rounding: none (raw, so deflate/inflate round-trips exactly).

## effectiveRate

Nominal annual rate to effective annual rate (APY) and back. Endpoint name `effective-rate`.

- Inputs: `ratePct`, `periodsPerYear`, optional `toNominal` (default false).
- Output: default `effectiveRatePct = ((1 + ratePct/100/periodsPerYear)^periodsPerYear - 1) * 100`. With `toNominal` true: `nominalRatePct = periodsPerYear * ((1 + ratePct/100)^(1/periodsPerYear) - 1) * 100`.
- Rounding: none.

## npv

Net present value of a cashflow series.

- Inputs: `cashflows` (array; index 0 is today, outflows negative), `discountRatePct` (per period).
- Output: `npv = sum over t of cashflows[t] / (1 + discountRatePct/100)^t`.
- Rounding: none.

## irr

Internal rate of return.

- Inputs: `cashflows` (array; index 0 is today, outflows negative).
- Output: `irrPct`, the per-period rate that zeroes the NPV, found by bisection over (-99.99%, 1000%). Returns `null` when the NPV never changes sign across that range (for example an all-positive stream).
- Rounding: none.

## refiBreakeven

Refinance break-even. Endpoint name `refi-breakeven`.

- Inputs: `closingCosts`, `currentPayment`, `newPayment`, optional `remainingMonths`.
- Outputs: `monthlySaving` (`currentPayment - newPayment`), `breakevenMonths` (`ceil(closingCosts / monthlySaving)`, or `null` when the new payment does not save money), `lifetimeSaving` (`monthlySaving * remainingMonths - closingCosts` when `remainingMonths` is given, else `null`).
- Rounding: `monthlySaving` and `lifetimeSaving` to cents; `breakevenMonths` is a whole number of months.

## emergencyFund

Months of runway. Endpoint name `emergency-fund`.

- Inputs: `liquidSavings`, `monthlyExpenses`.
- Output: `months = liquidSavings / monthlyExpenses`. Returns `null` when expenses are not positive.
- Rounding: two decimals.
