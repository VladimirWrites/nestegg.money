import { test } from "node:test";
import assert from "node:assert/strict";
import { syncedAt } from "../public/js/io/storage.js";

function stubLS() {
  const m = {};
  globalThis.localStorage = {
    getItem: (k) => (k in m ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v); },
    removeItem: (k) => { delete m[k]; },
  };
}

test("syncedAt is 0 when nothing stored", () => {
  stubLS();
  assert.equal(syncedAt(), 0);
});

test("syncedAt returns the stored timestamp as a number", () => {
  stubLS();
  localStorage.setItem("nw_synced_at", "1700000000000");
  assert.equal(syncedAt(), 1700000000000);
});

test("syncedAt is 0 for a non-numeric value", () => {
  stubLS();
  localStorage.setItem("nw_synced_at", "not-a-number");
  assert.equal(syncedAt(), 0);
});
