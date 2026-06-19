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
