import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Guards against the package.json version and the service-worker cache name drifting apart.
// If this fails, run `node scripts/sync-version.mjs` (or `npm version ...`).
test("service worker cache version matches package.json version", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const sw = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
  const m = sw.match(/const CACHE = "nestegg-v([^"]+)";/);
  assert.ok(m, "CACHE version line present in sw.js");
  assert.equal(m[1], pkg.version, "sw.js cache version must equal package.json version");
});
