// Retirement drawdown simulation. At the retirement year contributions stop and drawdown
// begins; when the government pension starts it covers part of spending. Everything is in
// today's money; the pot grows at the real (inflation-adjusted) return between withdrawals.
import { state } from "./store.js";
import { defRetire } from "./schema.js";
import { fcCfg, manualNetBase, contribFV } from "./forecast.js";
import { YEAR_MS } from "./dates.js";

// Lazily-initialised retirement config on the state.
export function retCfg() {
  if (!state.retire || typeof state.retire !== "object") state.retire = defRetire();
  return state.retire;
}

// Inflation discount from a future year back to today's money.
export function retDeflator(year) {
  const infl = +retCfg().inflation || 0;
  const t = Math.max(0, year - new Date().getFullYear());
  return 1 / Math.pow(1 + infl, t);
}

// Investable nest egg only (liquid + contributions, grown) — excludes property/loans.
export function forecastLiquidAt(date, gOverride) {
  const fc = fcCfg();
  const g = gOverride != null ? gOverride : +fc.growth || 0;
  let t = (date - new Date()) / YEAR_MS;
  if (t < 0) t = 0;
  return manualNetBase() * Math.pow(1 + g, t) + contribFV(date, gOverride);
}

// German Rentenpunkte accrue only while working (until the retirement year).
export function pensionPts() {
  const r = retCfg();
  const yrs = Math.max(0, (+r.retireYear || 0) - new Date().getFullYear());
  return (+r.points || 0) + (+r.ptsPerYear || 0) * yrs;
}

// Monthly pension in today's money.
export function pensionMonthly() {
  const r = retCfg();
  return r.pmode === "de" ? pensionPts() * (+r.ptValue || 0) : +r.pension || 0;
}

export function pensionAnnual() {
  return pensionMonthly() * 12;
}

// Investable nest egg at the retirement year, in today's money.
export function retNestEggReal() {
  const y = +retCfg().retireYear || new Date().getFullYear();
  return forecastLiquidAt(new Date(y, 11, 31)) * retDeflator(y);
}

// Year-by-year drawdown in today's money. Returns the pot trajectory + verdict.
export function retSim() {
  const r = retCfg();
  const cy = new Date().getFullYear();
  const retY = Math.max(cy, +r.retireYear || cy);
  const pensY = Math.max(retY, +r.pensionStart || retY);
  const until = Math.max(retY + 1, +r.untilYear || retY + 45);
  const g = +fcCfg().growth || 0;
  const infl = +r.inflation || 0;
  const rr = (1 + g) / (1 + infl) - 1; // real return
  const spend = +r.spending || 0;
  const pensA = pensionAnnual();

  let pot = retNestEggReal();
  const pts = [{ y: retY, pot }];
  let depleted = null;
  let potAtPens = pot;
  let minPot = pot;
  for (let y = retY + 1; y <= until; y++) {
    const pension = y >= pensY ? pensA : 0;
    const draw = Math.max(0, spend - pension);
    pot = (pot - draw) * (1 + rr);
    if (y === pensY) potAtPens = Math.max(0, pot);
    if (pot <= 0) {
      depleted = y;
      pts.push({ y, pot: 0 });
      break;
    }
    minPot = Math.min(minPot, pot);
    pts.push({ y, pot });
  }
  return { pts, depleted, potAtPens, minPot, retY, pensY, until, pensionMonthly: pensionMonthly(), pensionAnnual: pensA, spend, rr, endPot: pts[pts.length - 1].pot };
}
