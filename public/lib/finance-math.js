// Single source of truth for nestegg's deterministic finance math.
//
// Every export is a PURE function of its inputs: no app state, no network, no live prices, no
// FX lookups. Any currency conversion takes the rate as an explicit parameter. Money uses the
// app's rounding convention: round half-up to 2 decimals (round2). Imported by both the site
// and the calculator endpoints / MCP tools, so a formula is defined exactly once.
//
// This file is a BARREL: the implementations live in ./finance-math/*.js, split by domain so
// each stays small. The public import surface (this file) is unchanged — add new calculators to
// the matching domain module (or a new one) and re-export it here.
//
// Returns numbers and schedules only, never advice.

// Canonical primitives, re-exported so callers have a single import surface.
export { round2, addMonths, parseDate, YEAR_MS, MONTH_MS } from "../js/domain/dates.js";
export { loanTerms, buildSchedule, outstandingAt } from "../js/domain/loan.js";
export { compoundOver, compoundedValue, assetGrossAt, assetNetAt } from "../js/domain/asset-value.js";

export * from "./finance-math/growth.js";          // futureValue, presentValue, compoundInterest, cagr, depreciate, straightLineDepreciation, inflationAdjust, effectiveRate
export * from "./finance-math/contributions.js";   // fvContributionsCore, futureValueOfContributions, requiredContribution
export * from "./finance-math/dcf.js";             // npv, irr, requiredReturn, yieldToMaturity
export * from "./finance-math/returns.js";         // roi, realReturn, returnStats, sharpeRatio, maxDrawdown, holdingPeriodReturn, feeDrag, dollarCostAveraging
export * from "./finance-math/loans.js";           // scheduleByYear, amortization, loanPayoff, refiBreakeven, mortgageAffordability, debtPayoff
export * from "./finance-math/planning.js";        // savingsRate, fireNumber, portfolioLongevity, emergencyFund
export * from "./finance-math/tax.js";             // fxConvert, taxFromBrackets, marginMarkup, germanNetSalary, vat
export * from "./finance-math/bonds.js";           // bondPrice, currentYield, bondDuration, convexity, zeroCouponPrice, accruedInterest
export * from "./finance-math/options.js";         // blackScholes, optionGreeks, putCallParity, optionBreakeven, intrinsicTimeValue
