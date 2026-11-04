// A holding whose price can't be fetched must keep the last price it had. Dropping the cached
// figure before a live one arrives is what turned an unreachable price API into a net worth
// that had quietly lost its holdings.
import { test } from "node:test";
import assert from "node:assert/strict";
import { state } from "../public/js/domain/store.js";
import { frozenSuperseded, pricesStale, tickerPx, dayChangeRows, dayChangeBase, PRICE_STALE_MS } from "../public/js/domain/model.js";

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

/* "Up 5%" says nothing about which holding did it. These are the rows behind that figure, and
   the thing worth testing is that they are the same holdings the headline counted. */

const dayState = (entries, prices) => {
  state.snapshots = [{ year: new Date().getFullYear(), entries }];
  state.prices = prices;
  state.baseCcy = "EUR";
  state.assets = [];
};
const live = (price, prevClose) => ({ price, prevClose, currency: "EUR", asOf: Math.floor(Date.now() / 1000) });

test("the rows add up to the headline, to the cent", () => {
  dayState([
    { id: "a", name: "Vanguard", kind: "ticker", ticker: "VWRL", shares: 10, ccy: "EUR" },
    { id: "b", name: "Apple", kind: "ticker", ticker: "AAPL", shares: 4, ccy: "EUR" },
    { id: "c", name: "Cash", kind: "fixed", ccy: "EUR", value: 5000 },
  ], { VWRL: live(110, 100), AAPL: live(90, 100) });

  const rows = dayChangeRows();
  const nw = 10 * 110 + 4 * 90 + 5000;
  const head = dayChangeBase(nw);
  assert.equal(rows.length, 2, "cash has no market, so it is not a row");
  assert.equal(rows.reduce((n, r) => n + r.abs, 0).toFixed(2), head.abs.toFixed(2));
});

test("the biggest mover of the total leads, not the biggest percentage", () => {
  dayState([
    { id: "a", name: "Big position", kind: "ticker", ticker: "BIG", shares: 1000, ccy: "EUR" },
    { id: "b", name: "Small position", kind: "ticker", ticker: "SML", shares: 1, ccy: "EUR" },
    { id: "c", name: "The loser", kind: "ticker", ticker: "BAD", shares: 100, ccy: "EUR" },
  ], { BIG: live(101, 100), SML: live(150, 100), BAD: live(90, 100) });

  const rows = dayChangeRows();
  assert.deepEqual(rows.map((r) => r.ticker), ["BIG", "SML", "BAD"], "gains first, by money; losses last");
  assert.equal(rows[1].pct.toFixed(0), "50", "and each still reports its own move");
});

test("what cannot move today is not listed as having stood still", () => {
  dayState([
    { id: "a", name: "Frozen", kind: "ticker", ticker: "OLD", shares: 10, ccy: "EUR", px: 90, pxCcy: "EUR" },
    { id: "b", name: "No previous close", kind: "ticker", ticker: "NEW", shares: 10, ccy: "EUR" },
    { id: "c", name: "Market shut", kind: "ticker", ticker: "SHUT", shares: 10, ccy: "EUR" },
  ], {
    OLD: live(120, 100),
    NEW: { price: 50, currency: "EUR", asOf: Math.floor(Date.now() / 1000) },
    SHUT: { price: 120, prevClose: 100, currency: "EUR", asOf: Math.floor((Date.now() - 3 * 86400000) / 1000) },
  });
  assert.deepEqual(dayChangeRows(), []);
});

test("no holdings at all is no rows, not a crash", () => {
  state.snapshots = [];
  assert.deepEqual(dayChangeRows(), []);
});
