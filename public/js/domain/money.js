// Currency conversion + formatting, plus a couple of pure string helpers.
// Conversion/formatting read the live base currency and fx rates from the store.
import { FALLBACK_FX } from "./constants.js";
import { state } from "./store.js";

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
    return new Intl.NumberFormat("en-IE", { style: "currency", currency: state.baseCcy, maximumFractionDigits: 0 }).format(v);
  } catch (e) {
    return state.baseCcy + " " + Math.round(v).toLocaleString();
  }
}

// Two-decimal amount in an explicit currency (for native-currency display).
export function moneyIn(v, ccy) {
  try {
    return new Intl.NumberFormat("en-IE", { style: "currency", currency: ccy, maximumFractionDigits: 2 }).format(v);
  } catch (e) {
    return ccy + " " + (+v).toFixed(2);
  }
}

// The base currency's symbol alone (e.g. "€").
export function ccySym() {
  try {
    const parts = new Intl.NumberFormat("en-IE", { style: "currency", currency: state.baseCcy }).formatToParts(0);
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
