// Shared test helpers. Not a *.test.mjs file, so the runner doesn't execute it directly.
import assert from "node:assert/strict";

export const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} !~= ${b}`);
