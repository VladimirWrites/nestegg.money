// Date / time helpers. Pure — no DOM, no globals.

const DAY_MS = 86400000;
export const YEAR_MS = 365.25 * DAY_MS;
export const MONTH_MS = YEAR_MS / 12;

// Parse "YYYY-MM-DD" as a LOCAL date (not UTC) so the day never shifts by timezone.
// Anything else falls back to Date parsing; returns null when unparseable.
export function parseDate(s) {
  if (typeof s === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  }
  const d = new Date(s);
  return isNaN(+d) ? null : d;
}

// Round to whole cents, half-up, nudged by a tiny epsilon so exact half-cents
// (e.g. 1484.375) don't fall the wrong way through floating-point error.
export const round2 = (v) => Math.round((v + 1e-9) * 100) / 100;

// Add `m` calendar months, clamping to the last valid day (Jan 31 + 1mo -> Feb 28/29).
export function addMonths(date, m) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + m);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

/* "2 yr 3 mo" style label from a month count.
 *
 * The two words are passed in rather than written here. This module is pure and knows nothing
 * about the interface language, and with them hard-coded the German build read "LAUFZEIT
 * (BERECHNET) 19 yr 6 mo" — English units under a German label. */
export function fmtMonths(n, units) {
  const yr = (units && units.yr) || "yr", mo_ = (units && units.mo) || "mo";
  if (!isFinite(n) || n <= 0) return "—";
  const y = Math.floor(n / 12);
  const mo = Math.round(n % 12);
  return [y ? `${y} ${yr}` : "", mo ? `${mo} ${mo_}` : ""].filter(Boolean).join(" ") || `0 ${mo_}`;
}

// Reference date for a snapshot year: now for the current year (values move daily),
// year-end otherwise (past values locked, future ones projected).
export function refDateForYear(y) {
  const cy = new Date().getFullYear();
  return y === cy ? new Date() : new Date(y, 11, 31, 23, 59, 59);
}

/* Short "Mon YYYY" label for a Date; empty string for a missing date.
 *
 * The locale is passed in, defaulting to en-GB. Pinned to en-GB it printed "Apr 2041" in the
 * German build, beside German labels and German day-precision dates from ymdDay. */
export const fmtMY = (d, locale = "en-GB") => {
  if (!d) return "";
  /* en-GB abbreviates September as "Sept" and every other month to three letters, so one
     row in a column of months was a character longer than the rest. Trimmed to three, and
     the trailing stop some locales add ("Okt.") goes with it. */
  const s = d.toLocaleDateString(locale, { month: "short", year: "numeric" });
  const i = s.indexOf(" ");
  return i < 0 ? s : s.slice(0, i).replace(/\.$/, "").slice(0, 3) + s.slice(i);
};
