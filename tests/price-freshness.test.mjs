// A holding whose price can't be fetched must keep the last price it had. Dropping the cached
// figure before a live one arrives is what turned an unreachable price API into a net worth
// that had quietly lost its holdings.
import { test } from "node:test";
import assert from "node:assert/strict";
import { state } from "../public/js/domain/store.js";
import { frozenSuperseded, pricesStale, tickerPx, PRICE_STALE_MS } from "../public/js/domain/model.js";

const holding = (over = {}) => ({ id: "e1", name: "Vanguard", kind: "ticker", ticker: "AMS:VWRL", shares: 10, ccy: "EUR", px: 118.4, pxCcy: "EUR", ...over });

test("a cached price is not superseded when no live price exists", () => {
  assert.equal(frozenSuperseded(holding(), {}), false);
  assert.equal(frozenSuperseded(holding(), { "AMS:VWRL": {} }), false);
  assert.equal(frozenSuperseded(holding(), { "AMS:VWRL": { price: null } }), false);
  assert.equal(frozenSuperseded(holding(), { "OTHER:SYM": { price: 9 } }), false);
});

test("a cached price is superseded once a live one is in hand", () => {
  assert.equal(frozenSuperseded(holding(), { "AMS:VWRL": { price: 121.02, currency: "EUR" } }), true);
});

test("an entry with no cached price has nothing to supersede", () => {
  assert.equal(frozenSuperseded(holding({ px: undefined }), { "AMS:VWRL": { price: 121 } }), false);
  assert.equal(frozenSuperseded(null, {}), false);
});

test("the cached price is what values the holding while the live one is missing", () => {
  state.prices = {};
  const p = tickerPx(holding(), new Date().getFullYear());
  assert.equal(p.price, 118.4);
  assert.equal(p.frozen, true);
});

test("a live price wins over the cached one", () => {
  state.prices = { "AMS:VWRL": { price: 121.02, currency: "EUR" } };
  const p = tickerPx(holding({ px: undefined }), new Date().getFullYear());
  assert.equal(p.price, 121.02);
  assert.equal(p.frozen, false);
});

test("staleness is silent when prices were refreshed within the day", () => {
  const now = Date.now();
  state.snapshots = [{ year: 2026, entries: [holding()] }];
  state.lastPx = now - 60 * 1000;
  assert.equal(pricesStale(now), null);
});

test("staleness is reported, with its date, once the prices are a day old", () => {
  const now = Date.now();
  state.snapshots = [{ year: 2026, entries: [holding()] }];
  state.lastPx = now - PRICE_STALE_MS - 1000;
  const s = pricesStale(now);
  assert.ok(s);
  assert.equal(s.at, state.lastPx);
});

test("a ledger with nothing priced is never caveated", () => {
  state.snapshots = [{ year: 2026, entries: [{ id: "c", name: "Cash", kind: "fixed", value: 100, ccy: "EUR" }] }];
  state.lastPx = 0;
  assert.equal(pricesStale(Date.now()), null);
});
