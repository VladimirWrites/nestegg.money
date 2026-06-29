// Persistence + multi-device sync + market-data fetches. Talks to localStorage, the
// /api/* Worker endpoints, and notifies the UI via toast/setSync and a data-changed listener.
import { state } from "../domain/store.js";
import { stampMtimes, setBaseline } from "../domain/merge.js";
import { encS, decS, keysReady, getAccountId } from "./crypto.js";
import { toast, setSync } from "../ui/dom.js";
import { MAX_BLOB } from "../../lib/limits.js";

// The UI registers how to re-render after background data lands (it decides which view).
let onDataChanged = () => {};
export function setDataListener(fn) { onDataChanged = fn; }

/* ---- local storage ---- */
export const LS = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  rem(k) { try { localStorage.removeItem(k); } catch (e) {} },
};
// Timestamp of the last successful server sync (push or load), for the profile's "last synced" line.
export const syncedAt = () => +LS.get("nw_synced_at") || 0;

// Demo/tour mode: sample data, never persisted to localStorage and never synced to the server.
let demoMode = false;
export function setDemo(on) { demoMode = !!on; }

// Keep a one-deep backup of the previous local state, so a bad save/clobber is recoverable.
export function saveLocal() {
  if (demoMode) return; // demo data is in-memory only — never touch real local storage
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
  if (demoMode) return; // demo: no persistence, no server sync
  state.updatedAt = Date.now();
  stampMtimes();
  saveLocal();
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushServer, 1200);
}
export function flushSync() {
  clearTimeout(syncTimer);
  pushServer(false, true); // tab-close flush: allow keepalive so it survives the page going away
}

export async function pushServer(manual, keepalive = false) {
  if (!keysReady()) return;
  try {
    stampMtimes();
    const blob = await encS();
    if (blob.length > MAX_BLOB) {
      setSync("off", "Too big to sync");
      toast("Data too large to sync — Export JSON to back up");
      return;
    }
    const body = JSON.stringify({ id: getAccountId(), blob });
    setSync("sync", "Saving…");
    // keepalive is ONLY for the tab-close flush. It shares a small (~64 KB) browser-wide
    // quota across all in-flight keepalive requests per page load; using it for every
    // routine save can exhaust that quota over a session and make fetch throw — which a
    // page refresh then clears. So normal saves use a plain fetch.
    const opts = { method: "PUT", headers: { "content-type": "application/json" }, body };
    if (keepalive && body.length < 60000) opts.keepalive = true;
    const r = await fetch("/api/vault", opts);
    if (r.ok) {
      setSync("ok", "Saved");
      syncWarned = false;
      setBaseline();
      LS.set("nw_synced_at", String(Date.now()));
      if (manual) toast("Data sent to server ✓");
    } else if (r.status === 429) {
      console.warn("[nestegg] sync rate-limited (HTTP 429) — too many new accounts from this network");
      setSync("off", "Rate limited");
      if (manual || !syncWarned) { syncWarned = true; toast("Too many new accounts from your network right now — your data is saved on this device. Try syncing again later."); }
    } else {
      console.warn("[nestegg] sync failed: HTTP", r.status, r.statusText, "—", body.length, "byte body");
      setSync("off", "Sync error");
      if (manual || !syncWarned) { syncWarned = true; toast("Sync failed — changes are saved on this device only"); }
    }
  } catch (e) {
    console.warn("[nestegg] sync failed:", (e && e.name) || "", (e && e.message) || e, e);
    setSync("off", "Local only");
    if (manual || !syncWarned) { syncWarned = true; toast("Sync failed — changes are saved on this device only"); }
  }
}

export async function loadServer() {
  if (!getAccountId()) return null;
  try {
    const r = await fetch("/api/vault", { headers: { "X-Vault-Id": getAccountId() } });
    if (r.status === 404) { setSync("ok", "Synced (new)"); return null; }
    if (!r.ok) { console.warn("[nestegg] load failed: HTTP", r.status, r.statusText); setSync("off", "Local only"); return null; }
    const { blob } = await r.json();
    const o = await decS(blob);
    setSync("ok", "Synced");
    LS.set("nw_synced_at", String(Date.now()));
    return o;
  } catch (e) {
    console.warn("[nestegg] load failed:", (e && e.name) || "", (e && e.message) || e, e);
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
async function fetchFxYear(year) {
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
  const years = [...new Set(state.snapshots.map((s) => s.year))].filter((y) => y < cy && !state.fxHist[y]);
  const fetched = await Promise.all(years.map((y) => fetchFxYear(y).then((h) => [y, h]))); // independent → parallel
  let changed = false;
  for (const [y, h] of fetched) if (h) { state.fxHist[y] = h; changed = true; }
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
function tickersInUse() {
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
  const toFetch = [];
  for (const sn of state.snapshots) {
    const past = sn.year < cy;
    for (const en of sn.entries || []) {
      if ((en.kind !== "ticker" && en.kind !== "crypto") || !en.ticker) continue;
      if (past) {
        const key = en.ticker + "@" + sn.year;
        if (en.px != null && en.pxKey === key) continue;
        if (_histMiss.has(key)) continue; // already known to have no year-end price
        toFetch.push({ en, year: sn.year, key });
      } else if (en.px != null) {
        delete en.px; delete en.pxCcy; delete en.pxKey; changed = true;
      }
    }
  }
  // Each year-end lookup is independent → fetch them in parallel, then apply the results.
  const fetched = await Promise.all(toFetch.map((x) => fetchPriceYear(x.en.ticker, x.year).then((r) => [x, r])));
  for (const [x, r] of fetched) {
    if (r) { x.en.px = r.price; x.en.pxCcy = r.currency; x.en.pxKey = x.key; changed = true; }
    else _histMiss.add(x.key);
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
    const olds = ts.map((t) => state.prices[t] && state.prices[t].price);
    const oks = await Promise.all(ts.map((t) => fetchPrice(t)));   // independent → parallel
    ts.forEach((t, i) => { if (oks[i] && state.prices[t].price !== olds[i]) changed = true; });
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
  const oks = await Promise.all(ts.map((t) => fetchPrice(t)));   // independent → parallel
  const n = oks.filter(Boolean).length;
  await refreshHistPrices();
  state.lastPx = Date.now();
  scheduleSync();
  onDataChanged();
  toast(n + "/" + ts.length + " prices updated");
}
