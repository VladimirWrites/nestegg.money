// Midijob / Übergangsbereich (§20 Abs. 2a SGB IV): between the Minijob threshold and 2000 EUR
// per month, social-insurance contributions are computed on a reduced base so take-home rises
// smoothly. Formulas (G = Geringfügigkeitsgrenze, AE = monthly pay, U = 2000 upper limit):
//   total base    BE    = F·G + ( U/(U−G) − G/(U−G)·F ) · (AE − G)
//   employee base BE_AN = ( U/(U−G) ) · (AE − G)
// The employer covers the difference between contributions on BE and the employee's share on
// BE_AN. Faktor F (28 / total average contribution rate, announced yearly by the BMAS) comes
// from the statutory table — it is fixed at the START of the year, so e.g. 2023's official
// 0.6922 reflects the January care rate, not the table's post-July one.
import { round2 } from "../../../js/domain/dates.js";
import { deYearParams, isSaxony } from "./statutory.js";
import { pvEmployeePct } from "./sozialversicherung.js";

export function deMidijob({ year, monthlyPay, children = 0, childrenUnder25 = null, age = null, bundesland = null, kvZusatzPct = null } = {}) {
  const p = deYearParams(+year);
  const pay = +monthlyPay || 0;
  const G = p.minijobMonthly, U = p.midijobUpper;
  const zone = pay <= 0 ? "none" : pay <= G ? "minijob" : pay <= U ? "midijob" : "regular";
  const base = {
    year: +year, monthlyPay: round2(pay), zone,
    thresholds: { minijobMonthly: G, midijobUpper: U },
  };
  if (zone !== "midijob") return base;

  const kvZusatz = kvZusatzPct == null ? p.kvAvgZusatzPct : +kvZusatzPct;
  const F = p.midijobFaktorF;
  const slope = U / (U - G) - (G / (U - G)) * F;
  const totalBase = round2(F * G + slope * (pay - G));
  const employeeBase = round2((U / (U - G)) * (pay - G));

  const saxony = isSaxony(bundesland);
  const employeeRates = {
    rvPct: p.rvEmployeePct,
    avPct: p.avEmployeePct,
    kvPct: p.kvGeneralEmployeePct + kvZusatz / 2,   // unrounded — only amounts get rounded
    pvPct: pvEmployeePct(p, { children, childrenUnder25, age, saxony }),
  };
  const totalRates = {
    rvPct: 2 * p.rvEmployeePct,
    avPct: 2 * p.avEmployeePct,
    kvPct: 2 * p.kvGeneralEmployeePct + kvZusatz,
    pvPct: p.pvTotalPct + (children <= 0 && (age == null || age >= 23) ? p.pvChildlessSurchargePct : 0),
  };
  const emp = (r) => round2(employeeBase * r / 100);
  const tot = (r) => round2(totalBase * r / 100);
  const employee = {
    pension: emp(employeeRates.rvPct), unemployment: emp(employeeRates.avPct),
    health: emp(employeeRates.kvPct), care: emp(employeeRates.pvPct),
  };
  employee.total = round2(employee.pension + employee.unemployment + employee.health + employee.care);
  const totalAll = round2(tot(totalRates.rvPct) + tot(totalRates.avPct) + tot(totalRates.kvPct) + tot(totalRates.pvPct));

  return {
    ...base,
    faktorF: F,
    contributionBase: { total: totalBase, employee: employeeBase },
    employee,
    employer: { total: round2(totalAll - employee.total) },
    savingsVsFull: round2(round2(pay * (employeeRates.rvPct + employeeRates.avPct + employeeRates.kvPct + employeeRates.pvPct) / 100) - employee.total),
    rates: { employee: employeeRates, total: totalRates },
  };
}
