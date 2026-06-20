// Loan amortization engine. Pure — operates only on the loan object passed in.
import { parseDate, round2, addMonths } from "./dates.js";

// Resolve a loan's monthly payment (M) and number of months (n) from whichever the
// user fixed: the term (compute the payment) or the payment (compute the term).
export function loanTerms(loan) {
  const L = +loan.amount || 0;
  const i = (+loan.rate || 0) / 100 / 12;
  if (loan.mode === "payment") {
    const M = +loan.payment || 0;
    let n;
    if (M <= 0) n = 0;
    else if (i <= 0) n = Math.ceil(L / M - 1e-7);
    else if (M <= L * i) n = Infinity; // payment can't cover interest
    else n = Math.ceil(-Math.log(1 - (L * i) / M) / Math.log(1 + i) - 1e-7); // -eps avoids FP off-by-one
    return { L, i, M, n };
  }
  const n = Math.round((+loan.termYears || 0) * 12);
  const M = L > 0 && n > 0 ? (i > 0 ? (L * i) / (1 - Math.pow(1 + i, -n)) : L / n) : 0;
  return { L, i, M, n };
}

// Full monthly amortization schedule, applying dated extra principal payments.
// Returns a list of { type: "payment"|"extra", date, ... } rows.
function computeSchedule(loan) {
  const { L, i, M, n } = loanTerms(loan);
  const rows = [];
  const start = parseDate(loan.startDate);
  if (L <= 0 || !start || !(M > 0) || !isFinite(n) || n <= 0) return rows;

  const cap = Math.min(n, 1200);
  const pay = round2(M);
  const fixedUntil = loan.fixedUntil ? parseDate(loan.fixedUntil) : null; // rate certain until here
  const est = (d) => !!(fixedUntil && d >= fixedUntil); // beyond = estimated projection
  const extras = (loan.extra || [])
    .map((e) => ({ d: parseDate(e.date), a: round2(+e.amount || 0) }))
    .filter((e) => e.d && e.a > 0)
    .sort((a, b) => a.d - b.d);

  let bal = round2(L);
  let ei = 0;
  for (let k = 0; k < cap && bal > 0.005; k++) {
    const date = addMonths(start, k + 1);

    // Extra payments billed by this (in-arrears) payment: an extra paid on day D stops
    // interest on that sum for the remaining (30-D) days (30/360), credited before principal.
    let extraThis = 0;
    let credit = 0;
    let running = bal;
    while (ei < extras.length && extras[ei].d < date) {
      const x = extras[ei];
      const day = Math.min(30, Math.max(1, x.d.getDate()));
      credit += (x.a * (30 - day)) / 30;
      extraThis = round2(extraThis + x.a);
      running = round2(running - x.a);
      rows.push({ type: "extra", date: x.d, extra: x.a, balance: running, estimated: est(x.d) });
      ei++;
    }

    // Round each month's interest to whole cents, like a bank statement, then carry forward.
    const interest = round2((bal - credit) * i);
    let principal = round2(pay - interest);
    let rowPay = pay;

    // Final scheduled month, or early payoff: settle exactly what's still owed after
    // this month's extras — banks fold the cent-rounding residue into the final payment.
    const owe = round2(bal - extraThis);
    if (k === n - 1 || principal > owe) {
      principal = Math.max(0, owe);
      rowPay = round2(interest + principal);
    }

    bal = round2(bal - principal - extraThis);
    if (bal < 0) bal = 0;
    rows.push({ type: "payment", date, payment: rowPay, interest, principal, balance: bal, estimated: est(date) });
  }
  return rows;
}

// Memoized schedule, keyed by the loan's inputs. The engine runs up to ~1200 iterations and is
// called many times per render (outstandingAt, autoEntriesFor, forecast/retirement loops), so
// caching by signature avoids recomputing the same schedule repeatedly. Returned rows are
// read-only by all callers. Cache invalidates automatically when any loan field changes.
const _schedCache = new Map();
const loanSig = (loan) => JSON.stringify([loan.amount, loan.rate, loan.termYears, loan.startDate, loan.mode, loan.payment, loan.fixedUntil, loan.extra]);
export function buildSchedule(loan) {
  const key = loanSig(loan);
  const hit = _schedCache.get(key);
  if (hit) return hit;
  const rows = computeSchedule(loan);
  if (_schedCache.size > 200) _schedCache.clear(); // bound memory; rebuilds are cheap
  _schedCache.set(key, rows);
  return rows;
}

// Outstanding balance on a given date (0 once paid off).
export function outstandingAt(loan, asOf) {
  const rows = buildSchedule(loan);
  if (!rows.length) return Math.max(0, +loan.amount || 0);
  let bal = +loan.amount || 0;
  for (const r of rows) {
    if (r.date <= asOf) bal = r.balance;
    else break;
  }
  return Math.max(0, bal);
}
