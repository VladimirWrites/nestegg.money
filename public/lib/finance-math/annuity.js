// Annuity factors shared by the TVM, contribution, loan, and growth calculators, so the same
// (1+i)^n algebra isn't re-derived (and can't drift) across modules. i is the per-period rate
// (decimal), n the number of periods. The i===0 branch is the limit (a plain count of periods).
export const annuityFactorFV = (i, n) => (i === 0 ? n : (Math.pow(1 + i, n) - 1) / i); // FV of 1/period
export const annuityFactorPV = (i, n) => (i === 0 ? n : (1 - Math.pow(1 + i, -n)) / i); // PV of 1/period
