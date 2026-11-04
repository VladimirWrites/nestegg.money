import { test } from "node:test";
import assert from "node:assert/strict";
import { setState, state } from "../public/js/domain/store.js";
import { mergeStates, stampMtimes, setBaseline } from "../public/js/domain/merge.js";

const emptyDel = () => ({ asset: {}, snap: {}, sper: {}, sent: {}, yent: {} });
const doc = (snapshots, del, extra = {}) => ({ updatedAt: 1000, del: del || emptyDel(), assets: [], salaries: [], categories: [], snapshots, ...extra });

test("merge: per-entry — one device's deletion and the other's edit both survive", () => {
  const a = doc([{ year: 2024, m: 1, entries: [{ id: "e2", name: "Stocks", ccy: "EUR", value: 10, m: 1 }] }]);
  a.del.yent = { e1: 200 };
  const b = doc([{ year: 2024, m: 1, entries: [
    { id: "e1", name: "Cash", ccy: "EUR", value: 5, m: 1 },
    { id: "e2", name: "Stocks", ccy: "EUR", value: 99, m: 300 },
  ] }]);
  const ents = mergeStates(a, b).snapshots[0].entries;
  assert.ok(!ents.some((e) => e.id === "e1"), "tombstoned entry stays deleted");
  assert.equal(ents.find((e) => e.id === "e2").value, 99, "newer edit wins");
});

test("merge: a year tombstone only beats edits that are older", () => {
  const tomb = doc([], { ...emptyDel(), snap: { 2024: 400 } });
  const newer = doc([{ year: 2024, m: 1, entries: [{ id: "e9", name: "X", ccy: "EUR", value: 1, m: 500 }] }]);
  const older = doc([{ year: 2024, m: 1, entries: [{ id: "e9", name: "X", ccy: "EUR", value: 1, m: 300 }] }]);
  assert.equal(mergeStates(newer, tomb).snapshots.length, 1);
  assert.equal(mergeStates(older, tomb).snapshots.length, 0);
});

test("merge: salaries merge per-month with person tombstones", () => {
  const a = doc([], { ...emptyDel(), sent: { "p1|2024-02": 500 } }, {
    salaries: [{ id: "p1", name: "Me", ccy: "EUR", m: 1, entries: [{ ym: "2024-01", amount: 3000, m: 1 }, { ym: "2024-02", amount: 3000, m: 1 }] }],
  });
  const b = doc([], emptyDel(), {
    salaries: [{ id: "p1", name: "Me", ccy: "EUR", m: 1, entries: [{ ym: "2024-01", amount: 3500, m: 600 }, { ym: "2024-02", amount: 3000, m: 1 }] }],
  });
  const sal = mergeStates(a, b).salaries[0];
  assert.equal(sal.entries.find((e) => e.ym === "2024-01").amount, 3500, "newer month edit wins");
  assert.ok(!sal.entries.some((e) => e.ym === "2024-02"), "tombstoned month stays deleted");
});

test("stampMtimes: assigns m to new/changed records and tombstones removals", () => {
  setState({ assets: [{ id: "a1", name: "Car" }, { id: "a2", name: "Boat" }], snapshots: [], salaries: [] });
  setBaseline(); // baseline now equals current state
  state.assets[0].name = "Van"; // edit a1
  state.assets.splice(1, 1); // delete a2
  state.assets.push({ id: "a3", name: "Bike" }); // add a3
  stampMtimes();
  assert.ok(state.assets.find((a) => a.id === "a1").m > 0, "edited record stamped");
  assert.ok(state.assets.find((a) => a.id === "a3").m > 0, "new record stamped");
  assert.ok(state.del.asset.a2 > 0, "deleted record tombstoned");
});

/* Prices are not edits and carry no mtime, so nothing above merges them. They used to travel
   with whichever document had the newer updatedAt, which lost the other side's — and a holding
   whose price was lost is valued at zero, so it showed in its year and not in the total. */

test("merge: a price fetched on one device survives the other's newer document", () => {
  const withPrice = doc([], null, { updatedAt: 1000, prices: { AAPL: { price: 200, currency: "USD", t: 500 } } });
  const without = doc([], null, { updatedAt: 9000, prices: {} });
  assert.equal(mergeStates(without, withPrice).prices.AAPL.price, 200, "local newer, remote has the price");
  assert.equal(mergeStates(withPrice, without).prices.AAPL.price, 200, "and the other way round");
});

test("merge: the fresher price of the two wins", () => {
  const older = doc([], null, { prices: { AAPL: { price: 100, t: 100 } } });
  const newer = doc([], null, { prices: { AAPL: { price: 250, t: 900 } } });
  assert.equal(mergeStates(older, newer).prices.AAPL.price, 250);
  assert.equal(mergeStates(newer, older).prices.AAPL.price, 250);
});

test("merge: each device keeps the tickers the other never had", () => {
  const a = doc([], null, { prices: { AAPL: { price: 1, t: 1 } } });
  const b = doc([], null, { prices: { MSFT: { price: 2, t: 1 } } });
  assert.deepEqual(Object.keys(mergeStates(a, b).prices).sort(), ["AAPL", "MSFT"]);
});

test("merge: year-end rates are historical, so either side having them is enough", () => {
  const a = doc([], null, { updatedAt: 9000, fxHist: {} });
  const b = doc([], null, { updatedAt: 1000, fxHist: { 2023: { EUR: 1, USD: 1.1 } } });
  assert.equal(mergeStates(a, b).fxHist[2023].USD, 1.1);
});

test("merge: the last price refresh is the later of the two", () => {
  const a = doc([], null, { lastPx: 500 });
  const b = doc([], null, { lastPx: 900 });
  assert.equal(mergeStates(a, b).lastPx, 900);
  assert.equal(mergeStates(b, a).lastPx, 900);
});
