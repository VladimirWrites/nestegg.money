// Net-worth model: how entries and snapshots are valued, the series/colours they map to,
// and the synthetic entries injected from long-term assets. Reads the live store + fx rates.
import { PALETTE } from "./constants.js";
import { state } from "./store.js";
import { convTo, convToY } from "./money.js";
import { refDateForYear } from "./dates.js";
import { outstandingAt } from "./loan.js";
import { assetNetAt, assetOwnedFrom } from "./asset-value.js";

/* ---- series + colours ----
   A "series" is the entry's group if it has one, otherwise the asset's own name —
   so charts show one segment per group, summing its members. Colours are stable
   within the current set of series. */
export const seriesKey = (e) => e.group || e.name;

export function allNames() {
  const names = state.snapshots.flatMap((s) =>
    effEntries(s).filter((e) => !isLiability(e)).map(seriesKey),
  );
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

export function colorOf(name, names) {
  const i = (names || allNames()).indexOf(name);
  return PALETTE[(i < 0 ? 0 : i) % PALETTE.length];
}

/* ---- entry kinds + valuation ---- */
export const isLiability = (en) => en.kind === "liability";
export const isPriced = (en) => en.kind === "ticker" || en.kind === "crypto"; // valued at a live unit price

// Effective price for a ticker entry: a frozen historical close (past years) if stored
// on the entry, otherwise the live fetched price; null when unknown.
export function tickerPx(en, year) {
  if (en.px != null) return { price: en.px, currency: en.pxCcy || en.ccy || "EUR", frozen: true };
  // For a PAST year with no frozen close, never fall back to the live price — today's price
  // is wrong for an old holding (e.g. a 2013 BTC valued at today's BTC). Report no price.
  if (year != null && year < new Date().getFullYear()) return null;
  const p = state.prices[en.ticker];
  if (p) return { price: p.price, currency: p.currency, prevClose: p.prevClose, frozen: false };
  return null;
}

// Was the stored price from today's trade? Suppresses a stale "today" change on days the
// market is closed (weekends/holidays). Crypto trades 24/7 so it stays fresh.
export function priceIsToday(p) {
  if (!p || p.asOf == null) return true;
  const d = new Date(p.asOf * 1000);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

// An entry's value in its own currency: { v, ccy }. `year` makes priced holdings use the
// year's frozen close (and avoid the live price for past years).
export function entryNative(en, year) {
  if (isPriced(en)) {
    const p = tickerPx(en, year);
    if (!p) return { v: 0, ccy: en.ccy || "EUR", miss: true };
    return { v: (parseFloat(en.shares) || 0) * p.price, ccy: p.currency };
  }
  // Liabilities are entered as a positive amount owed but count negative toward net worth.
  if (isLiability(en)) return { v: -(parseFloat(en.value) || 0), ccy: en.ccy || "EUR" };
  return { v: parseFloat(en.value) || 0, ccy: en.ccy || "EUR" };
}

export const entryEUR = (en, year) => { const n = entryNative(en, year); return convToY(n.v, n.ccy, "EUR", year); };
export const entryBase = (en, year) => { const n = entryNative(en, year); return convToY(n.v, n.ccy, state.baseCcy, year); };

// Today's change in base currency across priced holdings (skips frozen + stale-market prices).
export function dayChangeBase(nw) {
  const ls = latestSnap();
  if (!ls) return null;
  let abs = 0;
  let any = false;
  ls.entries.forEach((en) => {
    if (!isPriced(en) || en.px != null) return; // frozen historical holdings have no daily change
    const p = state.prices[en.ticker];
    if (!p || p.prevClose == null || !priceIsToday(p)) return; // skip stale (markets closed)
    const sh = parseFloat(en.shares) || 0;
    abs += convTo(sh * (p.price - p.prevClose), p.currency, state.baseCcy);
    any = true;
  });
  if (!any) return null;
  const prev = nw - abs;
  return { abs, pct: prev > 0 ? (abs / prev) * 100 : 0 };
}

/* ---- long-term assets injected as synthetic per-year entries ----
   Each asset's net value (gross minus loan) for the years it is owned, so net worth
   always reflects vehicles/property/standalone loans without manual re-entry. */
export function autoEntriesFor(year) {
  const ref = refDateForYear(year);
  const out = [];
  (state.assets || []).forEach((a) => {
    const from = assetOwnedFrom(a);
    if (from && from > ref) return;
    if (a.liability) {
      const bal = a.loan ? outstandingAt(a.loan, ref) : 0;
      if (bal <= 0.005 && from && from < ref) return; // paid off — drop once cleared
      out.push({ id: "asset:" + a.id, auto: true, assetId: a.id, kind: "liability", name: a.name || "Liability", ccy: a.ccy || state.baseCcy, value: bal, group: a.group });
    } else {
      out.push({ id: "asset:" + a.id, auto: true, assetId: a.id, kind: "fixed", name: a.name || "Asset", ccy: a.ccy || state.baseCcy, value: assetNetAt(a, ref), group: a.group });
    }
  });
  return out;
}

/* ---- snapshot aggregates ---- */
export const effEntries = (sn) => (sn.entries || []).concat(autoEntriesFor(sn.year));
export const snapTotalEUR = (sn) => effEntries(sn).reduce((a, e) => a + entryEUR(e, sn.year), 0);
export const snapTotalBase = (sn) => effEntries(sn).reduce((a, e) => a + entryBase(e, sn.year), 0);
// Assets only (for bar stacks / axis scaling): positive contributions.
export const snapGrossBase = (sn) => effEntries(sn).reduce((a, e) => { const v = entryBase(e, sn.year); return a + (v > 0 ? v : 0); }, 0);
// Total owed (returned positive).
export const snapLiabBase = (sn) => effEntries(sn).filter(isLiability).reduce((a, e) => a - entryBase(e, sn.year), 0);

// Asset allocation for a snapshot: positive holdings summed per series, sorted high to low.
// The total equals snapGrossBase(sn). Shared by the donut, its PNG export, and the year bars,
// so the on-screen donut and the exported image can never drift apart.
export function allocationRows(sn) {
  if (!sn) return [];
  const agg = {};
  effEntries(sn).forEach((e) => { const v = entryBase(e, sn.year); if (v > 0) { const k = seriesKey(e); agg[k] = (agg[k] || 0) + v; } });
  return Object.keys(agg).map((k) => ({ name: k, v: agg[k] })).sort((a, b) => b.v - a.v);
}

export const sortedSnaps = () => [...state.snapshots].sort((a, b) => a.year - b.year);
export const latestSnap = () => sortedSnaps().slice(-1)[0];
