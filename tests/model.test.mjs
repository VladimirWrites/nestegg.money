import { test } from "node:test";
import assert from "node:assert/strict";
import { setState } from "../public/js/domain/store.js";
import {
  seriesKey, allNames, colorOf, isLiability, isPriced, entryNative, entryBase,
  effEntries, snapTotalBase, snapGrossBase, snapLiabBase, autoEntriesFor, sortedSnaps, latestSnap, dayChangeBase,
} from "../public/js/domain/model.js";

const CY = new Date().getFullYear();
const PAST = CY - 2;

const base = () => ({
  baseCcy: "EUR",
  fxRates: { EUR: 1, USD: 2 },
  fxHist: {},
  prices: { AAPL: { price: 100, prevClose: 90, currency: "USD", asOf: null } },
  assets: [],
  snapshots: [
    { year: PAST, entries: [{ id: "a", name: "Cash", kind: "fixed", ccy: "EUR", value: 1000 }] },
    { year: CY, entries: [
      { id: "b", name: "Cash", kind: "fixed", ccy: "EUR", value: 2000 },
      { id: "c", name: "Loan", kind: "liability", ccy: "EUR", value: 500 },
      { id: "d", name: "Shares", kind: "ticker", ccy: "USD", ticker: "AAPL", shares: 10 },
    ] },
  ],
});

test("seriesKey prefers group over name", () => {
  assert.equal(seriesKey({ name: "X", group: "G" }), "G");
  assert.equal(seriesKey({ name: "X" }), "X");
});

test("entry valuation: liabilities go negative, current-year tickers use live price x shares, FX applies", () => {
  setState(base());
  assert.equal(isLiability({ kind: "liability" }), true);
  assert.equal(isPriced({ kind: "ticker" }), true);
  assert.equal(isPriced({ kind: "crypto" }), true);
  assert.equal(entryNative({ kind: "liability", value: 500, ccy: "EUR" }).v, -500);
  // current year: 10 shares * $100 live = $1000, at 2 USD/EUR -> 500 EUR
  assert.equal(entryBase({ kind: "ticker", ticker: "AAPL", shares: 10, ccy: "USD" }, CY), 500);
});

test("priced holding in a PAST year never uses the live price (the crypto/stock year bug)", () => {
  setState(base());
  // no frozen close -> value is unknown, NOT today's price
  assert.equal(entryBase({ kind: "ticker", ticker: "AAPL", shares: 10, ccy: "USD" }, PAST), 0);
  assert.equal(entryBase({ kind: "crypto", ticker: "BTC-EUR", shares: 1, ccy: "EUR" }, PAST), 0);
});

test("priced holding in a past year uses its frozen year-end close", () => {
  setState(base());
  // ticker: $50 year-end x 10 = $500 -> 250 EUR
  assert.equal(entryBase({ kind: "ticker", ticker: "AAPL", shares: 10, ccy: "USD", px: 50, pxCcy: "USD" }, PAST), 250);
  // crypto behaves identically: 1 BTC at the year's €3000 close -> €3000
  assert.equal(entryBase({ kind: "crypto", ticker: "BTC-EUR", shares: 1, ccy: "EUR", px: 3000, pxCcy: "EUR" }, PAST), 3000);
});

test("snapshot totals: net, gross (assets only), liabilities (positive)", () => {
  setState(base());
  const sn = latestSnap();
  // 2000 cash - 500 loan + 500 shares = 2000 net
  assert.equal(snapTotalBase(sn), 2000);
  assert.equal(snapGrossBase(sn), 2500);
  assert.equal(snapLiabBase(sn), 500);
});

test("sortedSnaps ascending, latestSnap is the newest year", () => {
  setState(base());
  assert.deepEqual(sortedSnaps().map((s) => s.year), [PAST, CY]);
  assert.equal(latestSnap().year, CY);
});

test("allNames lists asset series (not liabilities), colorOf is stable", () => {
  setState(base());
  const names = allNames();
  assert.ok(names.includes("Cash"));
  assert.ok(names.includes("Shares"));
  assert.ok(!names.includes("Loan"));
  assert.equal(colorOf("Cash", names), colorOf("Cash", names));
});

test("autoEntriesFor injects a long-term asset's net value into its owned years", () => {
  const s = base();
  s.assets = [{ id: "car", name: "Car", ccy: "EUR", value: 20000, depreciates: false, date: `${PAST - 3}-01-01`, loan: null }];
  setState(s);
  const autos = autoEntriesFor(CY);
  assert.equal(autos.length, 1);
  assert.equal(autos[0].value, 20000);
  assert.equal(autos[0].auto, true);
  assert.equal(effEntries(s.snapshots[1]).some((e) => e.assetId === "car"), true);
});

test("autoEntriesFor drops an asset before it is owned", () => {
  const s = base();
  s.assets = [{ id: "future", name: "Future", ccy: "EUR", value: 100, depreciates: false, date: `${CY + 4}-01-01`, loan: null }];
  setState(s);
  assert.equal(autoEntriesFor(PAST).length, 0);
});

test("dayChangeBase sums priced-holding moves in base currency", () => {
  setState(base());
  const nw = snapTotalBase(latestSnap());
  const dc = dayChangeBase(nw);
  // 10 shares * (100-90)=$100 move, at 2 USD/EUR -> 50 EUR up today
  assert.ok(dc);
  assert.equal(Math.round(dc.abs), 50);
});
