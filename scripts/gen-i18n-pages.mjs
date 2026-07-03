// Generates the per-locale public pages (landing + Brutto-Netto calculator) from the templates
// in scripts/templates/ and the dictionaries in scripts/i18n/. Pre-rendering per locale keeps
// the pages fully indexable (hreflang alternates included) with no client-side i18n cost.
// Outputs are committed. Run: node scripts/gen-i18n-pages.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tpl = (name) => fs.readFileSync(path.join(ROOT, "scripts/templates", name), "utf8");
const dict = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/i18n", name), "utf8"));

const PAGES = [
  { template: "landing.template.html", dict: "landing.en.json", out: "public/index.html" },
  { template: "landing.template.html", dict: "landing.de.json", out: "public/de/index.html" },
  { template: "bnr.template.html", dict: "bnr.de.json", out: "public/brutto-netto-rechner.html" },
  { template: "bnr.template.html", dict: "bnr.en.json", out: "public/en/german-net-salary-calculator.html" },
];

export function renderPage(template, d) {
  const vars = {
    ...d,
    alternatesHtml: Object.entries(d.alternates)
      .map(([hl, href]) => `<link rel="alternate" hreflang="${hl}" href="${href}">`)
      .join("\n"),
    langLinkHreflang: d.lang === "de" ? "en" : "de",
  };
  const out = template.replace(/\{\{(\w+)\}\}/g, (m, k) => {
    if (vars[k] == null) throw new Error(`missing dictionary key: ${k} (${d.lang})`);
    return vars[k];
  });
  const leftover = out.match(/\{\{[^}]+\}\}/);
  if (leftover) throw new Error(`unresolved placeholder: ${leftover[0]}`);
  return out;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  for (const p of PAGES) {
    const outPath = path.join(ROOT, p.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, renderPage(tpl(p.template), dict(p.dict)));
    console.log(`${p.out}  <- ${p.template} + ${p.dict}`);
  }
}

export { PAGES, tpl, dict };
