import { test } from "node:test";
import assert from "node:assert/strict";
import { sampleState } from "../public/js/domain/sample-data.js";
import { migrate } from "../public/js/domain/schema.js";
import { setState, state } from "../public/js/domain/store.js";
import { latestSnap, snapTotalBase, allocationRows } from "../public/js/domain/model.js";

test("sampleState migrates to a valid two-earner household", () => {
  const s = migrate(sampleState());
  assert.equal(s.salaries.length, 2);
  assert.deepEqual(s.salaries.map((p) => p.name).sort(), ["Alex", "Sam"]);
  assert.ok(s.salaries[0].entries.length > 100); // monthly, many years
  assert.ok(s.salaries.some((p) => p.entries.some((e) => e.event === "Raise")));
  assert.equal(s.snapshots.length, 8);
  assert.ok(s.snapshots.every((sn) => sn.entries.every((e) => e.id))); // migrate assigns ids
  assert.equal(s.forecast.enabled, true); // forecast section shown
  assert.equal(s.retire.on, true); // retirement/pension section shown
  assert.ok(s.retire.points > 0 && s.retire.pmode === "de"); // pension via German Rentenpunkte
});

test("sample has stock + crypto tickers, an ungrouped cash holding, and a mortgaged asset", () => {
  const s = migrate(sampleState());
  const last = s.snapshots.find((sn) => sn.year === 2026).entries;
  assert.ok(last.filter((e) => e.kind === "ticker").length >= 2); // multiple stocks
  assert.ok(last.some((e) => e.kind === "crypto" && e.ticker)); // crypto
  assert.ok(last.some((e) => e.name === "Cash" && !e.group)); // cash needs no category
  const flat = s.assets.find((a) => a.loan);
  assert.ok(flat && flat.loan.amount > 0 && Array.isArray(flat.loan.extra) && flat.loan.extra.length); // mortgage w/ extra payments
});

test("net worth values offline, is sizeable, and grows over the years", () => {
  setState(migrate(sampleState()));
  const snaps = [...state.snapshots].sort((a, b) => a.year - b.year);
  assert.ok(snapTotalBase(snaps[snaps.length - 1]) > 1_000_000); // scaled up
  assert.ok(snapTotalBase(snaps[snaps.length - 1]) > snapTotalBase(snaps[0]));
  const names = allocationRows(latestSnap()).map((row) => row.name);
  assert.ok(names.includes("Stocks") && names.includes("Crypto") && names.includes("Real estate"));
});
