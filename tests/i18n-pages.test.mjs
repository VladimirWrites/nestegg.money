// The per-locale public pages are generated (scripts/gen-i18n-pages.mjs) and committed.
// These tests re-render every page from its template + dictionary and require the committed
// output to match — catching edits to generated files and forgotten regenerations alike.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PAGES, renderPage, tpl, dict } from "../scripts/gen-i18n-pages.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("committed pages match their template + dictionary (run npm run gen-i18n after edits)", () => {
  for (const p of PAGES) {
    const expected = renderPage(tpl(p.template), dict(p.dict));
    const committed = fs.readFileSync(path.join(ROOT, p.out), "utf8");
    assert.equal(committed, expected, `${p.out} is out of sync`);
  }
});

test("every page declares canonical, hreflang alternates for both locales, and its language", () => {
  for (const p of PAGES) {
    const d = dict(p.dict);
    const html = fs.readFileSync(path.join(ROOT, p.out), "utf8");
    assert.ok(html.includes(`<html lang="${d.lang}">`), `${p.out} lang`);
    assert.ok(html.includes(`<link rel="canonical" href="${d.canonical}">`), `${p.out} canonical`);
    for (const [hl, href] of Object.entries(d.alternates)) {
      assert.ok(html.includes(`hreflang="${hl}" href="${href}"`), `${p.out} hreflang ${hl}`);
    }
  }
});

test("the locale dictionaries of a page define the same keys", () => {
  const groups = { landing: ["landing.en.json", "landing.de.json"], bnr: ["bnr.en.json", "bnr.de.json"] };
  for (const [name, [a, b]] of Object.entries(groups)) {
    const ka = Object.keys(dict(a)).sort(), kb = Object.keys(dict(b)).sort();
    assert.deepEqual(ka, kb, `${name} dictionaries diverge`);
  }
});

test("runtime dictionaries (public/i18n) stay structurally in sync", async () => {
  const en = (await import("../public/i18n/en.js")).default;
  const de = (await import("../public/i18n/de.js")).default;
  const shape = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "object" ? shape(v) : "s"]));
  assert.deepEqual(shape(en), shape(de));
});
