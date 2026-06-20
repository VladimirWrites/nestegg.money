// Persistence + multi-device sync + market-data fetches. Talks to localStorage, the
// /api/* Worker endpoints, and notifies the UI via toast/setSync and a data-changed listener.
import { state } from "../domain/store.js";
import { stampMtimes, setBaseline } from "../domain/merge.js";
import { encS, decS, keysReady, getAccountId } from "./crypto.js";
import { toast, setSync } from "../ui/dom.js";

// The UI registers how to re-render after background data lands (it decides which view).
let onDataChanged = () => {};
export function setDataListener(fn) { onDataChanged = fn; }

/* ---- local storage ---- */
export const LS = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  rem(k) { try { localStorage.removeItem(k); } catch (e) {} },
};

// Keep a one-deep backup of the previous local state, so a bad save/clobber is recoverable.
export function saveLocal() {
  try { const prev = LS.get("nw_state"); if (prev) LS.set("nw_state_bak", prev); } catch (e) {}
  LS.set("nw_state", JSON.stringify(state));
}
export function loadLocal() {
  const r = LS.get("nw_state");
  try { return r ? JSON.parse(r) : null; } catch (e) { return null; }
}

/* ---- server sync ---- */
let syncTimer;
let syncWarned = false;

export function scheduleSync() {
  state.updatedAt = Date.now();
  stampMtimes();
  saveLocal();
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushServer, 1200);
}
export function flushSync() {
  clearTimeout(syncTimer);
  pushServer();
}

export async function pushServer(manual) {
  if (!keysReady()) return;
  try {
    stampMtimes();
    const blob = await encS();
    if (blob.length > 1900000) {
      setSync("off", "Too big to sync");
      toast("Data too large to sync — Export JSON to back up");
      return;
    }
    const body = JSON.stringify({ id: getAccountId(), blob });
    setSync("sync", "Saving…");
    // keepalive lets a flush on tab-close survive the page going away (64 KB browser cap).
    const r = await fetch("/api/vault", { method: "PUT", headers: { "content-type": "application/json" }, body, keepalive: body.length < 60000 });
    if (r.ok) {
      setSync("ok", "Saved");
      syncWarned = false;
      setBaseline();
      if (manual) toast("Data sent to server ✓");
    } else {
      setSync("off", "Sync error");
      if (manual || !syncWarned) { syncWarned = true; toast("Sync failed — changes are saved on this device only"); }
    }
  } catch (e) {
    setSync("off", "Local only");
    if (manual || !syncWarned) { syncWarned = true; toast("Sync failed — changes are saved on this device only"); }
  }
}

export async function loadServer() {
  if (!getAccountId()) return null;
  try {
    const r = await fetch("/api/vault?id=" + getAccountId());
    if (r.status === 404) { setSync("ok", "Synced (new)"); return null; }
    if (!r.ok) { setSync("off", "Local only"); return null; }
    const { blob } = await r.json();
    const o = await decS(blob);
    setSync("ok", "Synced");
    return o;
  } catch (e) {
    setSync("off", "Local only");
    return null;
  }
}

/* ---- FX rates ---- */
export async function fetchFx() {
  try {
    const r = await fetch("/api/fx");
    if (!r.ok) return false;
    const d = await r.json();
    if (d.rates) { state.fxRates = Object.assign({ EUR: 1 }, d.rates); state.fxDate = d.date; return true; }
  } catch (e) {}
  return false;
}
// Year-end (Dec 31) ECB rates for a year — used to value past-year holdings at the rate then.
export async function fetchFxYear(year) {
  try {
    const r = await fetch("/api/fx?date=" + year + "-12-31");
    if (!r.ok) return null;
    const d = await r.json();
    if (d.rates) return Object.assign({ EUR: 1 }, d.rates);
  } catch (e) {}
  return null;
}
export async function refreshHistFx() {
  const cy = new Date().getFullYear();
  state.fxHist = state.fxHist || {};
  let changed = false;
  for (const y of [...new Set(state.snapshots.map((s) => s.year))]) {
    if (y >= cy || state.fxHist[y]) continue;
    const h = await fetchFxYear(y);
    if (h) { state.fxHist[y] = h; changed = true; }
  }
  return changed;
}

/* ---- ticker / crypto prices ---- */
export async function fetchPrice(t) {
  try {
    const r = await fetch("/api/price?ticker=" + encodeURIComponent(t));
    if (!r.ok) return false;
    const d = await r.json();
    if (d.price != null) {
      state.prices[t] = { price: d.price, prevClose: d.prevClose != null ? d.prevClose : d.price, currency: d.currency || "USD", asOf: d.asOf || null, t: Date.now() };
      return true;
    }
  } catch (e) {}
  return false;
}
export function tickersInUse() {
  return [...new Set(state.snapshots.flatMap((s) => s.entries).filter((e) => (e.kind === "ticker" || e.kind === "crypto") && e.ticker).map((e) => e.ticker))];
}
// Year-end close for a ticker, used to value holdings held in a past year.
export async function fetchPriceYear(t, year) {
  try {
    const r = await fetch("/api/price?ticker=" + encodeURIComponent(t) + "&year=" + year);
    if (!r.ok) return null;
    const d = await r.json();
    if (d.price != null) return { price: d.price, currency: d.currency || "USD" };
  } catch (e) {}
  return null;
}
// Freeze each past-year ticker holding to that year's close (stored on the entry); current/
// future-year holdings stay on the live price. Returns true if anything changed.
const _histMiss = new Set(); // (ticker@year) with no historical price — don't re-fetch this session
export async function refreshHistPrices() {
  const cy = new Date().getFullYear();
  let changed = false;
  for (const sn of state.snapshots) {
    const past = sn.year < cy;
    for (const en of sn.entries || []) {
      if ((en.kind !== "ticker" && en.kind !== "crypto") || !en.ticker) continue;
      if (past) {
        const key = en.ticker + "@" + sn.year;
        if (en.px != null && en.pxKey === key) continue;
        if (_histMiss.has(key)) continue; // already known to have no year-end price
        const r = await fetchPriceYear(en.ticker, sn.year);
        if (r) { en.px = r.price; en.pxCcy = r.currency; en.pxKey = key; changed = true; }
        else _histMiss.add(key);
      } else if (en.px != null) {
        delete en.px; delete en.pxCcy; delete en.pxKey; changed = true;
      }
    }
  }
  return changed;
}

// On page open: refresh live FX + ticker prices, plus historical year-end values.
// Silent (no toasts); returns true if anything changed, so the caller can re-sync/re-render.
export async function autoRefresh() {
  let changed = false;
  try { const pd = state.fxDate; if ((await fetchFx()) && state.fxDate !== pd) changed = true; } catch (e) {}
  try {
    if (!state.prices) state.prices = {};
    const ts = tickersInUse();
    for (const t of ts) { const old = state.prices[t] && state.prices[t].price; if ((await fetchPrice(t)) && state.prices[t].price !== old) changed = true; }
    if (ts.length) state.lastPx = Date.now();
  } catch (e) {}
  try { if (await refreshHistFx()) changed = true; } catch (e) {}
  try { if (await refreshHistPrices()) changed = true; } catch (e) {}
  return changed;
}

// Make sure past-year holdings are valued at that year's price + FX, then re-render the
// active view only if something was actually fetched (so it won't disrupt typing).
export function ensureHist() {
  try {
    Promise.all([refreshHistPrices(), refreshHistFx()])
      .then(([a, b]) => { if (a || b) { scheduleSync(); onDataChanged(); } })
      .catch(() => {});
  } catch (e) {}
}

// Manual "refresh prices" button: fetch live + historical, re-sync, re-render, report.
export async function refreshPrices() {
  const ts = tickersInUse();
  if (!ts.length) { toast("No ticker holdings to refresh"); return; }
  toast("Fetching prices…");
  let n = 0;
  for (const t of ts) if (await fetchPrice(t)) n++;
  await refreshHistPrices();
  state.lastPx = Date.now();
  scheduleSync();
  onDataChanged();
  toast(n + "/" + ts.length + " prices updated");
}
