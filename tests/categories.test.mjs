import { test } from "node:test";
import assert from "node:assert/strict";
import { setState, state } from "../public/js/domain/store.js";
import { groupNames, addCategory, categoryUsage, renameCategory, removeCategory } from "../public/js/domain/categories.js";

const base = () => ({
  baseCcy: "EUR", fxRates: { EUR: 1 }, fxHist: {}, prices: {},
  categories: ["Stocks", "Cash"],
  snapshots: [
    { year: 2023, entries: [{ name: "VWCE", group: "Stocks" }, { name: "Acc", group: "Cash" }, { name: "Misc" }] },
    { year: 2024, entries: [{ name: "VWCE", group: "Stocks" }, { name: "Doge", group: "Crypto" }] },
  ],
  assets: [{ id: "a1", name: "Flat", group: "Real estate" }],
  salaries: [],
});

test("groupNames returns the list plus any stray group still in use", () => {
  setState(base());
  assert.deepEqual(new Set(groupNames()), new Set(["Stocks", "Cash", "Crypto", "Real estate"]));
});

test("addCategory adds a uniquely-named category and returns the name", () => {
  setState(base());
  assert.equal(addCategory(), "New category");
  assert.equal(addCategory(), "New category 2");
  assert.equal(addCategory("Stocks"), "Stocks 2"); // collides with existing
  assert.deepEqual(state.categories, ["Stocks", "Cash", "New category", "New category 2", "Stocks 2"]);
});

test("categoryUsage counts tagged entries across years plus assets", () => {
  setState(base());
  assert.equal(categoryUsage("Stocks"), 2); // both years' VWCE
  assert.equal(categoryUsage("Cash"), 1);
  assert.equal(categoryUsage("Real estate"), 1); // the asset
  assert.equal(categoryUsage("Nope"), 0);
});

test("renameCategory updates the list, every year's entries, and assets", () => {
  setState(base());
  renameCategory("Stocks", "Equities");
  assert.ok(state.categories.includes("Equities") && !state.categories.includes("Stocks"));
  assert.equal(state.snapshots[0].entries[0].group, "Equities");
  assert.equal(state.snapshots[1].entries[0].group, "Equities");

  renameCategory("Real estate", "Property");
  assert.equal(state.assets[0].group, "Property");
});

test("removeCategory drops the list entry and clears the tag everywhere (nothing deleted)", () => {
  setState(base());
  removeCategory("Cash");
  assert.ok(!state.categories.includes("Cash"));
  assert.equal(state.snapshots[0].entries[1].group, undefined); // 'Acc' lost its tag
  assert.equal(state.snapshots[0].entries.length, 3); // item itself still there
});
