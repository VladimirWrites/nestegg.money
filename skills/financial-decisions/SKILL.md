---
name: financial-decisions
description: Use when reasoning through money decisions — mortgage overpayment vs investing, comparing German job offers, retirement/FIRE timelines, or evaluating investment returns. Chains the nestegg MCP calculators so every number is computed, never estimated.
---

# Financial Decisions with nestegg Calculators

The nestegg MCP server (`https://nestegg.money/mcp`) provides deterministic finance calculators.
Whenever a money question needs arithmetic — compounding, amortization, tax, returns — call a
tool instead of computing in your head. Your reasoning stays yours; the numbers come from tools.

## Ground rules

1. **Never estimate what a tool can compute.** If a calculation spans more than one step or
   involves compounding, call the tool.
2. **Ask for missing load-bearing inputs instead of assuming them.** A mortgage needs amount,
   rate, and term *or* payment. A German salary needs tax class and the Krankenkasse's actual
   Zusatzbeitrag (rates change yearly — the year-average default is only right for rough
   estimates). If the user doesn't know a value, say what you defaulted and why it matters.
3. **State assumptions with the answer.** Every result includes the inputs it used; surface the
   ones the user didn't give explicitly (e.g. "assuming the 2026 average surcharge of 2.9%").
4. **Rates are inputs, not lookups.** The tools fetch nothing live. The one exception: the
   `de-*` tools carry official German statutory data for recent tax years.
5. **Keep results compact.** `amortization` returns per-year summaries by default; only request
   `detail: "monthly"` when the user asks for a schedule, and paginate with `offset`.

## Workflows

### Mortgage: overpay or invest?
1. `loan-payoff` with the loan and the extra monthly amount → interest saved, months saved.
2. `contributions` (or `compound-interest`) with the same monthly amount, the user's expected
   return, and the loan's remaining term → investment end value.
3. Compare: investment gain vs interest saved, over the same horizon. Name the crossover
   return rate and the risk asymmetry (paying down debt is a guaranteed return at the loan rate).

### German job offer / salary
1. `de-net-salary` for each offer with year, gross, tax class, Bundesland, children, church
   tax, and the actual Zusatzbeitrag.
2. Compare *net monthly* figures; note the marginal effects (a raise crossing a contribution
   ceiling changes less than expected).
3. For capital income use `de-abgeltungsteuer`; for part-time bands `de-midijob`; for the
   state-pension effect of a salary `de-rentenpunkte`.

### Retirement / FIRE
1. `fire-number` from annual spending → the target.
2. `compound-interest` (balance + monthly contribution) → year the target is crossed; or
   `required-contribution` for "what do I need to save".
3. `portfolio-longevity` to sanity-check the drawdown at the chosen spending.
4. Use real (inflation-adjusted) returns consistently and say so.

### Evaluating returns
- Irregular cash flows → `xirr` (dated) or `mirr`; simple two-point → `cagr`;
  risk framing → `return-stats`, `sharpe-ratio`, `max-drawdown`; cost impact → `fee-drag`.

## Presenting results

Lead with the decision-relevant number (net €/month, years earlier, annualized %), then the
two or three inputs that drive it, then caveats. Round money to whole euros in prose; keep the
tool's exact figures in any table. These are calculations, not financial advice — say so when
the stakes warrant it.
