import { test } from "node:test";
import assert from "node:assert/strict";
import { setState, state } from "../public/js/domain/store.js";
import { refreshHistPrices } from "../public/js/io/storage.js";

const CY = new Date().getFullYear();
const PAST = CY - 2;

const base = (snapshots) => ({ baseCcy: "EUR", fxRates: { EUR: 1, USD: 2 }, fxHist: {}, prices: {}, assets: [], snapshots, salaries: [], categories: [] });

// Stub global fetch; record the URLs it was called with so we can assert no-refetch.
let calls;
function stubFetch(handler) {
  calls = [];
  globalThis.fetch = async (url) => { calls.push(url); return handler(url); };
}
const ok = (price, currency = "USD") => ({ ok: true, json: async () => ({ price, currency }) });
const notOk = () => ({ ok: false, json: async () => ({}) });

test("refreshHistPrices freezes a past-year holding to that year's close, then doesn't re-fetch", async () => {
  stubFetch(() => ok(3256.93, "EUR"));
  setState(base([{ year: PAST, entries: [{ name: "Bitcoin", kind: "crypto", ccy: "EUR", ticker: "BTC-EUR", shares: 1 }] }]));

  const changed = await refreshHistPrices();
  const en = state.snapshots[0].entries[0];
  assert.equal(changed, true);
  assert.equal(en.px, 3256.93);
  assert.equal(en.pxCcy, "EUR");
  assert.equal(en.pxKey, "BTC-EUR@" + PAST);
  assert.equal(calls.length, 1);

  // already frozen with a matching key -> skip, no second fetch
  const again = await refreshHistPrices();
  assert.equal(again, false);
  assert.equal(calls.length, 1);
});

test("refreshHistPrices caches a missing year (no price) and won't re-fetch it", async () => {
  stubFetch(() => notOk());
  setState(base([{ year: PAST, entries: [{ name: "X", kind: "ticker", ccy: "USD", ticker: "NODATA2013", shares: 1 }] }]));

  await refreshHistPrices();
  const en = state.snapshots[0].entries[0];
  assert.equal(en.px, undefined); // nothing frozen
  const n = calls.length;
  assert.ok(n >= 1);

  await refreshHistPrices(); // _histMiss should suppress the re-fetch
  assert.equal(calls.length, n);
});

test("refreshHistPrices never freezes the current year and clears a stale frozen price", async () => {
  stubFetch(() => ok(100, "USD")); // would only be hit if it (wrongly) fetched
  setState(base([{ year: CY, entries: [{ name: "AAPL", kind: "ticker", ccy: "USD", ticker: "AAPL", shares: 1, px: 90, pxCcy: "USD", pxKey: "AAPL@" + CY }] }]));

  const changed = await refreshHistPrices();
  const en = state.snapshots[0].entries[0];
  assert.equal(changed, true);
  assert.equal(en.px, undefined); // unfrozen -> uses live price instead
  assert.equal(en.pxKey, undefined);
  assert.equal(calls.length, 0); // current-year holdings never fetch a historical close
});
