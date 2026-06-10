// Run with: node --test tests/core.test.mjs
// The frontend is plain global-scope scripts (no modules), so core.js is loaded
// into a VM sandbox and its functions pulled out of the context for testing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const src = readFileSync(new URL("../public/js/core.js", import.meta.url), "utf8");
const ctx = { crypto: globalThis.crypto, console, Date, Math, JSON, Intl, TextEncoder, TextDecoder, setTimeout, clearTimeout };
vm.createContext(ctx);
vm.runInContext(src, ctx);
const fn = (name) => vm.runInContext(name, ctx);

const buildSchedule = fn("buildSchedule");
const loan = (o) => Object.assign({ amount: 0, rate: 0, termYears: 30, startDate: "2020-01-01", mode: "term", payment: 0, extra: [], fixedUntil: null }, o);
const payments = (l) => buildSchedule(l).filter((r) => r.type === "payment");

test("30y amortization: 360 payments, residue folded into the final one", () => {
  const rows = payments(loan({ amount: 100000, rate: 3 }));
  assert.equal(rows.length, 360);
  assert.equal(rows[359].balance, 0);
  assert.ok(Math.abs(rows[0].payment - 421.6) < 0.05);
});

test("0% loan with an extra payment in the last month settles exactly", () => {
  const rows = payments(loan({ amount: 12000, rate: 0, termYears: 1, extra: [{ id: "x", date: "2020-12-10", amount: 500 }] }));
  const last = rows[rows.length - 1];
  assert.equal(last.balance, 0);
  assert.ok(Math.abs(last.payment - 500) < 0.01);
  const total = buildSchedule(loan({ amount: 12000, rate: 0, termYears: 1, extra: [{ id: "x", date: "2020-12-10", amount: 500 }] }))
    .reduce((a, r) => a + (r.payment || 0) + (r.extra || 0), 0);
  assert.ok(Math.abs(total - 12000) < 0.01);
});

test("payment-mode loan terminates at zero without overshooting", () => {
  const rows = payments(loan({ amount: 10000, rate: 5, mode: "payment", payment: 300 }));
  assert.equal(rows[rows.length - 1].balance, 0);
  assert.ok(rows[rows.length - 1].payment <= 300.01);
});

test("large mid-loan extra payment ends the schedule early", () => {
  const rows = payments(loan({ amount: 10000, rate: 5, termYears: 10, extra: [{ id: "x", date: "2020-06-15", amount: 9500 }] }));
  assert.equal(rows[rows.length - 1].balance, 0);
  assert.ok(rows.length < 12);
});

const mergeStates = fn("mergeStates");
const emptyDel = () => ({ asset: {}, snap: {}, sper: {}, sent: {}, yent: {} });
const doc = (snapshots, del) => ({ updatedAt: 1000, del: del || emptyDel(), assets: [], salaries: [], categories: [], snapshots });

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

test("account tokens validate, including O/I/l look-alike typos", () => {
  const generateToken = fn("generateToken"), validToken = fn("validToken");
  for (let i = 0; i < 200; i++) {
    const tok = generateToken();
    assert.ok(validToken(tok));
    assert.ok(validToken(tok.toLowerCase().replace(/0/g, "O").replace(/1/g, "l")));
  }
  assert.ok(!validToken("AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA"));
});

test("esc escapes &, double quote and <", () => {
  assert.equal(fn("esc")('a&"<b'), "a&amp;&quot;&lt;b");
});
