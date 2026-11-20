// Currency conversion + formatting, plus a couple of pure string helpers.
// Conversion/formatting read the live base currency and fx rates from the store.
import { FALLBACK_FX } from "./constants.js";
import { state } from "./store.js";
import { getLocale } from "../i18n.js";

/* The locale every figure on the screen is written in.
 *
 * Every formatter here was pinned to en-IE, which is right for English and wrong for the
 * other half of the product: a German reader was shown "€1,060,000.00" and "3.75%" directly
 * above an input the browser had rendered as "3,75". Three number conventions on one screen.
 * English keeps en-IE exactly as before — it is the euro-with-no-space form this app has
 * always used — and German gets German.
 *
 * i18n.js imports nothing from the domain, so this cannot form a cycle. */
const FMT = { en: "en-IE", de: "de-DE" };
export const fmtLocale = () => FMT[getLocale()] || "en-IE";

// Live rate per EUR for a currency, falling back to the offline table.
export function rate(c) {
  if (c === "EUR") return 1;
  const r = state.fxRates && state.fxRates[c];
  return r && r > 0 ? r : FALLBACK_FX[c] || 1;
}

// Rate as of a snapshot year: that year's ECB year-end rate for past years (once fetched),
// otherwise the current/live rate. EUR is always the 1.0 base.
export function rateAt(c, year) {
  const cy = new Date().getFullYear();
  if (year != null && year < cy) {
    const h = state.fxHist && state.fxHist[year];
    if (h) {
      if (c === "EUR") return 1;
      const r = h[c];
      if (r && r > 0) return r;
    }
  }
  return rate(c);
}

export const convTo = (a, from, to) => (a * rate(to)) / rate(from);
export const convToY = (a, from, to, year) => (a * rateAt(to, year)) / rateAt(from, year);

// Whole-unit amount in the base currency (e.g. "€1,235").
export function money(v) {
  try {
    return new Intl.NumberFormat(fmtLocale(), { style: "currency", currency: state.baseCcy, maximumFractionDigits: 0 }).format(v);
  } catch (e) {
    return state.baseCcy + " " + Math.round(v).toLocaleString();
  }
}

// Two-decimal amount in an explicit currency (for native-currency display).
export function moneyIn(v, ccy) {
  try {
    return new Intl.NumberFormat(fmtLocale(), { style: "currency", currency: ccy, maximumFractionDigits: 2 }).format(v);
  } catch (e) {
    return ccy + " " + (+v).toFixed(2);
  }
}

/* Whole units in an explicit currency (e.g. "€887,569").
 *
 * For tables read down rather than reconciled: thirty rows of cents on a six-figure balance
 * is 90 characters of noise, and on a 320px screen it is the difference between the column
 * fitting and being clipped off the edge with nothing to say it is there. */
export function moneyIn0(v, ccy) {
  try {
    return new Intl.NumberFormat(fmtLocale(), { style: "currency", currency: ccy, maximumFractionDigits: 0 }).format(v);
  } catch (e) {
    return ccy + " " + Math.round(+v).toLocaleString();
  }
}

// The base currency's symbol alone (e.g. "€").
export function ccySym() {
  try {
    const parts = new Intl.NumberFormat(fmtLocale(), { style: "currency", currency: state.baseCcy }).formatToParts(0);
    const s = parts.find((x) => x.type === "currency");
    return s ? s.value : state.baseCcy;
  } catch (e) {
    return state.baseCcy;
  }
}

// Minimal HTML-escape for interpolating user text into markup.
export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

// Compact axis/label number: 1.5k, 12k, 2.5M (fewer decimals as magnitude grows).
export function shortK(v) {
  const a = Math.abs(v);
  if (a >= 1e6) return +(v / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "M";
  if (a >= 1e3) return +(v / 1e3).toFixed(a >= 1e4 ? 0 : 1) + "k";
  return Math.round(v);
}

/* Reading a number a person typed.
 *
 * The app always *prints* en-IE — comma groups, dot decimal — but people type what their
 * keyboard and their habits give them, and the two languages this ships in disagree about
 * what a dot means: "15.000" is fifteen thousand to a German reader and fifteen to an English
 * one. Getting that backwards changes somebody's net worth by a factor of a thousand, so the
 * rules are written down and tested rather than guessed at per call site.
 *
 *   both separators present   the later one is the decimal mark   1.234,56 and 1,234.56 → 1234.56
 *   one separator, 3 digits after   grouping                      15.000 and 15,000     → 15000
 *   one separator, 1-2 digits after   decimal                     2,5 and 39.32         → 2.5, 39.32
 *   one separator, 4+ digits after    decimal — malformed either way, so take the
 *                                     smaller reading: too small is visible, too large is not
 *
 * Returns null for anything it cannot read, so a caller can tell "nothing" from zero.
 */
export function parseNum(s) {
  if (typeof s === "number") return Number.isFinite(s) ? s : null;
  if (s == null) return null;
  let t = String(s).trim().replace(/[\s  ]/g, "");
  if (!t) return null;
  const neg = /^[-−]/.test(t);
  if (neg) t = t.slice(1);
  t = t.replace(/[^\d.,]/g, "");           // currency symbols, percent signs, stray letters
  if (!t || !/\d/.test(t)) return null;

  const lastDot = t.lastIndexOf("."), lastComma = t.lastIndexOf(",");
  let dec = -1;
  if (lastDot >= 0 && lastComma >= 0) {
    dec = Math.max(lastDot, lastComma);
  } else {
    const i = lastDot >= 0 ? lastDot : lastComma;
    if (i >= 0) {
      const mark = t[i];
      const only = t.indexOf(mark) === i;
      const after = t.length - i - 1;
      /* "0.125" and "0,125" are decimals under either reading: nobody writes a thousands
         group after a lone zero. Without this, a three-decimal figure typed into a share
         count or an interest rate came back a thousand times too large — which is worse than
         the zero it replaced, because it is believable. */
      const leadingZero = /^0+$/.test(t.slice(0, i));
      if (only && (after !== 3 || leadingZero)) dec = i;
    }
  }
  const intPart = (dec >= 0 ? t.slice(0, dec) : t).replace(/[.,]/g, "");
  const frac = (dec >= 0 ? t.slice(dec + 1) : "").replace(/[.,]/g, "");
  const n = parseFloat((intPart || "0") + (frac ? "." + frac : ""));
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

// The canonical way to write a number back into a field: grouped, en-IE, like every figure
// the app prints beside it.
/* A number where a thousands group is not a plausible reading: an interest rate, a term in
 * years, a count of shares or coins. Both "." and "," are the decimal mark, and nothing is
 * grouping — so 3.125 is three and an eighth in either language, which is what somebody
 * typing a rate or a fraction of a bitcoin means. parseNum's grouping rule is right for
 * money and wrong here. */
export function parseDec(s) {
  if (typeof s === "number") return Number.isFinite(s) ? s : null;
  if (s == null) return null;
  let t = String(s).trim().replace(/[\s  ]/g, "");
  if (!t) return null;
  const neg = /^[-−]/.test(t);
  if (neg) t = t.slice(1);
  t = t.replace(/[^\d.,]/g, "").replace(/,/g, ".");
  const i = t.indexOf(".");
  if (i >= 0) t = t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, "");
  if (!t || !/\d/.test(t)) return null;
  const n = parseFloat(t);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

/* A number read the way the screen writes it.
 *
 * parseNum guesses between the two conventions, which is right when the figure could have
 * come from anywhere — a pasted spreadsheet, a bank statement. parseDec never groups, which
 * is right for a rate or a term. A share count is neither: "12,985" is twelve thousand
 * shares to an English reader and "0,125" is an eighth of a coin to a German one, and the
 * same string means the opposite thing in the other language. So it is read by the locale
 * the field was written in, which is the only reading that round-trips. */
export function parseLocaleNum(s) {
  if (typeof s === "number") return Number.isFinite(s) ? s : null;
  if (s == null) return null;
  const loc = fmtLocale();
  const parts = new Intl.NumberFormat(loc).formatToParts(12345.6);
  const group = (parts.find((p) => p.type === "group") || {}).value || ",";
  const decimal = (parts.find((p) => p.type === "decimal") || {}).value || ".";
  let t = String(s).trim().replace(/[\s  ]/g, "");
  if (!t) return null;
  const neg = /^[-−]/.test(t);
  if (neg) t = t.slice(1);
  t = t.split(group).join("");
  const i = t.indexOf(decimal);
  if (i >= 0) t = t.slice(0, i) + "." + t.slice(i + decimal.length).split(decimal).join("");
  t = t.replace(/[^\d.]/g, "");
  if (!t || !/\d/.test(t)) return null;
  const n = parseFloat(t);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

export function fmtNum(n, maxFrac = 2, minFrac = 0) {
  if (n == null || n === "" || !Number.isFinite(Number(n))) return "";
  /* minFrac is for columns of money: without it a formatter drops trailing zeros, so
     "3,687.80" is written "3,687.8" and sits a character short of the figures above and
     below it, which in a right-aligned ledger means the decimal points do not line up. */
  return new Intl.NumberFormat(fmtLocale(), { maximumFractionDigits: Math.max(maxFrac, minFrac), minimumFractionDigits: minFrac }).format(Number(n));
}
