// Shared 1-D root finder (bisection). Used by the rate solvers — IRR, required-return, YTM, XIRR,
// and loan APR. Returns the midpoint rate, or `fallback` when the function does not change sign
// across [lo, hi] (so each caller decides what "no solution" means).
export function bisectRate(f, { lo = -0.9999, hi = 10, iters = 200, fallback = null } = {}) {
  let flo = f(lo);
  const fhi = f(hi);
  if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return fallback;
  for (let k = 0; k < iters; k++) {
    const mid = (lo + hi) / 2, fmid = f(mid);
    if (fmid === 0) return mid;
    if (flo * fmid < 0) hi = mid; else { lo = mid; flo = fmid; }
  }
  return (lo + hi) / 2;
}
