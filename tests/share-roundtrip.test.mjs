// End-to-end data path of a share, exactly as the viewer runs it: build a snapshot from live
// state, encrypt it under a fresh share key, decrypt it back with the exported/imported key,
// load it into the store, and confirm the reused pure domain calculations produce the right
// figures — and that excluded sections carry no data.
import { test } from "node:test";
import assert from "node:assert/strict";
import { setState } from "../public/js/domain/store.js";
import { buildSnapshot } from "../public/js/domain/snapshot.js";
import { encWith, decWith, genShareKey, exportShareKey, importShareKey } from "../public/js/io/crypto.js";
import { latestSnap, snapTotalBase, allocationRows } from "../public/js/domain/model.js";
import { budgetSummary } from "../public/js/domain/budget.js";

const live = () => ({
  v: 6,
  baseCcy: "EUR",
  fxRates: { EUR: 1, USD: 2 },
  fxDate: null, fxHist: {}, prices: {},
  assets: [],
  categories: [],
  snapshots: [
    { year: 2023, entries: [{ name: "Cash", kind: "fixed", ccy: "EUR", value: 30000, group: "Cash" }] },
    { year: 2024, entries: [
      { name: "VWCE", kind: "fixed", ccy: "EUR", value: 50000, group: "Stocks" },
      { name: "Cash", kind: "fixed", ccy: "EUR", value: 10000, group: "Cash" },
      { name: "Loan", kind: "liability", ccy: "EUR", value: 5000 },
    ] },
  ],
  salaries: [{ id: "p1", name: "Me", ccy: "EUR", entries: [{ id: "e1", ym: "2024-06", amount: 4000, ccy: "EUR" }] }],
  budget: { incomeOverride: 4000, expenses: [{ id: "x1", name: "Rent", amount: 1200 }], loanCats: {}, categories: [] },
  forecast: null, retire: null,
});

test("viewer path: snapshot survives encrypt/decrypt and the reused math is correct", async () => {
  // 1. author-side: build + encrypt under a fresh key, export the key for the link fragment.
  setState(live());
  const snap = buildSnapshot({ networth: true, budget: true });
  const key = await genShareKey();
  const keyStr = await exportShareKey(key);
  const blob = await encWith(snap, key);

  // 2. viewer-side: import the fragment key, decrypt, load into the store.
  const imported = await importShareKey(keyStr);
  const got = await decWith(blob, imported);
  setState(got);

  // 3. reused domain calculations produce the same figures the app would show.
  const latest = latestSnap();
  assert.equal(latest.year, 2024);
  assert.equal(snapTotalBase(latest), 55000);                 // 50000 + 10000 - 5000
  assert.deepEqual(allocationRows(latest), [
    { name: "Stocks", v: 50000 },
    { name: "Cash", v: 10000 },
  ]);
  assert.equal(budgetSummary().income, 4000);
  assert.equal(budgetSummary().expenses, 1200);

  // 4. excluded sections carry nothing (viewer would render no salary/forecast/retirement).
  assert.deepEqual(got.salaries, []);
  assert.equal(got.forecast, null);
  assert.equal(got.retire, null);
  assert.deepEqual(got._include, { networth: true, salaries: false, budget: true, forecast: false, retirement: false });
});
