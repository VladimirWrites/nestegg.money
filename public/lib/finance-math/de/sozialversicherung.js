// German employee social-insurance contributions (annual, EUR) — a pure function of the
// statutory parameter object (see statutory.js) and the personal situation. Implements the
// SGB XI employee-share rules exactly: half the general PV rate, +0.5pp in Saxony, +0.6pp
// childless surcharge from age 23, −0.25pp per child from the 2nd to the 5th (children under 25).
import { round2 } from "../../../js/domain/dates.js";

// The employee's Pflegeversicherung rate in percent.
export function pvEmployeePct(p, { children = 0, childrenUnder25 = null, age = null, saxony = false } = {}) {
  let rate = p.pvTotalPct / 2;
  if (saxony) rate += p.pvSaxonyShiftPct;
  const kids = children > 0;
  if (!kids && (age == null || age >= 23)) rate += p.pvChildlessSurchargePct;
  const under25 = childrenUnder25 == null ? children : childrenUnder25;
  if (kids) rate -= p.pvPerChildDiscountPct * Math.min(Math.max(under25 - 1, 0), 4);
  return round2(rate);
}

// Annual employee contributions with the two contribution ceilings applied.
// grossAnnual EUR; opts: { ost, saxony, children, childrenUnder25, age, kvZusatzPct (defaults to
// the year average), privateHealth: { premiumAnnual } replaces GKV health+care }.
export function deSozialversicherung(grossAnnual, p, opts = {}) {
  const g = +grossAnnual || 0;
  const rvBase = Math.min(g, opts.ost ? p.bbgRvAvOst : p.bbgRvAvWest);
  const kvBase = Math.min(g, p.bbgKvPv);

  const pension = round2(rvBase * p.rvEmployeePct / 100);
  const unemployment = round2(rvBase * p.avEmployeePct / 100);

  if (opts.privateHealth) {
    const premium = round2(+opts.privateHealth.premiumAnnual || 0);
    return {
      pension, unemployment, health: premium, care: 0,
      total: round2(pension + unemployment + premium),
      rates: { rvPct: p.rvEmployeePct, avPct: p.avEmployeePct, kvPct: null, pvPct: null },
      bases: { rvBase: round2(rvBase), kvBase: null },
      privateHealth: true,
    };
  }

  const kvZusatz = opts.kvZusatzPct == null ? p.kvAvgZusatzPct : +opts.kvZusatzPct;
  const kvPct = round2(p.kvGeneralEmployeePct + kvZusatz / 2);
  const pvPct = pvEmployeePct(p, opts);
  const health = round2(kvBase * kvPct / 100);
  const care = round2(kvBase * pvPct / 100);

  return {
    pension, unemployment, health, care,
    total: round2(pension + unemployment + health + care),
    rates: { rvPct: p.rvEmployeePct, avPct: p.avEmployeePct, kvPct, pvPct },
    bases: { rvBase: round2(rvBase), kvBase: round2(kvBase) },
    privateHealth: false,
  };
}
