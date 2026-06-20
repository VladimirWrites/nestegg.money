// Stamp package.json's version into the service worker cache name, so a release bumps the
// PWA cache (forcing clients to pick up new assets). Run automatically by `npm version`,
// or manually: `node scripts/sync-version.mjs`. The version test guards against drift.
import { readFileSync, writeFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const swPath = new URL("../public/sw.js", import.meta.url);
const sw = readFileSync(swPath, "utf8");

const re = /const CACHE = "nestegg-v[^"]*";/;
if (!re.test(sw)) {
  console.error("sync-version: could not find the CACHE version line in public/sw.js");
  process.exit(1);
}
const next = sw.replace(re, `const CACHE = "nestegg-v${pkg.version}";`);
writeFileSync(swPath, next);
console.log(`sw.js CACHE -> nestegg-v${pkg.version}`);
