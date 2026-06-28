import { test } from "node:test";
import assert from "node:assert/strict";
import { validateArgs } from "../src/validate.js";

const schema = { type: "object", properties: { a: { type: "number" }, b: { type: "string" } }, required: ["a"] };

test("validateArgs: missing required field fails with a naming message", () => {
  const r = validateArgs(schema, { b: "x" });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes("a")));
});

test("validateArgs: wrong type fails", () => {
  const r = validateArgs(schema, { a: "not a number" });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes("a")));
});

test("validateArgs: valid args pass clean", () => {
  assert.deepEqual(validateArgs(schema, { a: 1, b: "x" }), { ok: true, errors: [] });
});

test("validateArgs: array and boolean types are checked", () => {
  const s = { type: "object", properties: { xs: { type: "array" }, flag: { type: "boolean" } }, required: ["xs"] };
  assert.equal(validateArgs(s, { xs: [1, 2], flag: true }).ok, true);
  assert.equal(validateArgs(s, { xs: "nope" }).ok, false);
});

test("validateArgs: enum values are enforced and the allowed set is named", () => {
  const s = { type: "object", properties: { mode: { type: "string", enum: ["term", "payment"] } }, required: ["mode"] };
  assert.equal(validateArgs(s, { mode: "payment" }).ok, true);
  const bad = validateArgs(s, { mode: "xyz" });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => e.includes("term") && e.includes("payment")));
});

test("validateArgs: minimum is enforced when declared", () => {
  const s = { type: "object", properties: { years: { type: "number", minimum: 0 } }, required: ["years"] };
  assert.equal(validateArgs(s, { years: 5 }).ok, true);
  assert.equal(validateArgs(s, { years: -1 }).ok, false);
});
