import { test } from "node:test";
import assert from "node:assert/strict";
import { migrate, emptyState, defForecast, defRetire } from "../public/js/domain/schema.js";

test("migrate stamps the current schema version and base currency", () => {
  const s = migrate({});
  assert.equal(s.v, 6);
  assert.equal(s.baseCcy, "EUR");
  assert.equal(s.fxRates.EUR, 1);
  assert.equal(s.forecast.goalMode, defForecast().goalMode);
  assert.equal(s.forecast.band, false); // added on top of the base defaults
  assert.deepEqual(s.retire, defRetire());
});

test("migrate folds legacy cars and properties into the asset list", () => {
  const s = migrate({ cars: [{ name: "Car", price: 20000 }], properties: [{ name: "Flat", value: 300000 }] });
  assert.equal(s.cars, undefined);
  assert.equal(s.properties, undefined);
  assert.equal(s.assets.length, 2);
  assert.equal(s.assets.find((a) => a.name === "Car").depreciates, true);
  assert.equal(s.assets.find((a) => a.name === "Flat").value, 300000);
});

test("migrate converts legacy salary base/extra into a single amount", () => {
  const s = migrate({ salaries: [{ name: "Me", entries: [{ ym: "2022-01", base: 3000, extra: 500 }] }] });
  const en = s.salaries[0].entries[0];
  assert.equal(en.amount, 3500);
  assert.equal(en.base, undefined);
  assert.equal(en.extra, undefined);
});

test("migrate converts legacy snapshot cats into entries, dropping zero rows", () => {
  const s = migrate({ snapshots: [{ year: 2023, cats: { Cash: 5000, Empty: 0 } }] });
  assert.equal(s.snapshots[0].cats, undefined);
  assert.deepEqual(s.snapshots[0].entries.map((e) => e.name), ["Cash"]);
});

test("migrate carries retire.year -> retireYear and drops dead fields", () => {
  const s = migrate({ retire: { year: 2050, wrRate: 0.04 } });
  assert.equal(s.retire.retireYear, 2050);
  assert.equal(s.retire.year, undefined);
  assert.equal(s.retire.wrRate, undefined);
});

test("migrate prunes tombstones older than 180 days, keeps recent ones", () => {
  const old = Date.now() - 200 * 86400000;
  const recent = Date.now() - 10 * 86400000;
  const s = migrate({ del: { asset: { stale: old, fresh: recent } } });
  assert.equal(s.del.asset.stale, undefined);
  assert.equal(s.del.asset.fresh, recent);
});

test("emptyState is a valid v6 state", () => {
  const s = emptyState();
  assert.equal(s.v, 6);
  assert.equal(s.snapshots.length, 1);
  assert.deepEqual(migrate(structuredClone(s)).v, 6);
});
