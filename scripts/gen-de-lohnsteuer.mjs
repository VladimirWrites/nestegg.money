// Generates the German Lohnsteuer calculators from the official BMF PAP XML pseudocode
// (scripts/pap/*.xml) into public/lib/finance-math/de/lohnsteuer<year>.js.
//
// The PAP pseudocode is Java BigDecimal expressions inside a tiny statement language
// (EVAL / IF-THEN-ELSE / EXECUTE). Translation is mechanical: declared variable names become
// `this.<name>`, BigDecimal statics map onto our bigdecimal.js, everything else is already
// valid JavaScript. Run: node scripts/gen-de-lohnsteuer.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, "scripts/pap");
const OUT = path.join(ROOT, "public/lib/finance-math/de");

// file -> { year the generated module represents, exported class name }
const FILES = {
  "Lohnsteuer2023AbJuli.xml": { year: 2023, cls: "Lohnsteuer2023" },
  "Lohnsteuer2024Dezember.xml": { year: 2024, cls: "Lohnsteuer2024" },
  "Lohnsteuer2025.xml": { year: 2025, cls: "Lohnsteuer2025" },
  "Lohnsteuer2026.xml": { year: 2026, cls: "Lohnsteuer2026" },
};

const decode = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

// ---- minimal parser for the restricted PAP XML shape ----
function parse(xml) {
  xml = xml.replace(/^﻿/, "").replace(/<!--[\s\S]*?-->/g, "");
  const vars = []; // { kind, name, type, default }
  for (const m of xml.matchAll(/<(INPUT|OUTPUT|INTERNAL|CONSTANT)\s+([^>]*?)\/>/g)) {
    const attrs = Object.fromEntries([...m[2].matchAll(/(\w+)\s*=\s*"([^"]*)"/g)].map((a) => [a[1], decode(a[2])]));
    vars.push({ kind: m[1], name: attrs.name, type: attrs.type, def: attrs.default ?? attrs.value });
  }
  const methodsXml = xml.slice(xml.indexOf("<METHODS>"), xml.indexOf("</METHODS>"));
  const methods = [];
  const mainM = methodsXml.match(/<MAIN>([\s\S]*?)<\/MAIN>/);
  methods.push({ name: "MAIN", body: parseStatements(mainM[1]) });
  for (const m of methodsXml.matchAll(/<METHOD\s+name\s*=\s*"(\w+)"\s*>([\s\S]*?)<\/METHOD>/g)) {
    methods.push({ name: m[1], body: parseStatements(m[2]) });
  }
  return { vars, methods };
}

// End index of the tag starting at `lt`, honouring quotes (2023's XML has a raw `>` inside
// an attribute value, so a plain indexOf(">") is not enough).
function tagEnd(s, lt) {
  let q = false;
  for (let i = lt; i < s.length; i++) {
    const c = s[i];
    if (c === '"') q = !q;
    else if (c === ">" && !q) return i;
  }
  throw new Error("unterminated tag at " + lt);
}
const attr = (tag, name) => {
  const m = tag.match(new RegExp(name + '\\s*=\\s*"([^"]*)"'));
  return m && decode(m[1]);
};

// Parse a statement list: EVAL, EXECUTE, and (possibly nested) IF/THEN/ELSE.
function parseStatements(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    const lt = s.indexOf("<", i);
    if (lt < 0) break;
    if (s.startsWith("<EVAL", lt)) {
      const end = tagEnd(s, lt);
      out.push({ t: "eval", exec: attr(s.slice(lt, end), "exec") });
      i = end + 1;
    } else if (s.startsWith("<EXECUTE", lt)) {
      const end = tagEnd(s, lt);
      out.push({ t: "call", method: attr(s.slice(lt, end), "method") });
      i = end + 1;
    } else if (s.startsWith("<IF", lt)) {
      const exprEnd = tagEnd(s, lt);
      const expr = attr(s.slice(lt, exprEnd), "expr");
      const close = matchClose(s, exprEnd + 1, "IF");
      const inner = s.slice(exprEnd + 1, close.start);
      // THEN first; ELSE must be searched only AFTER the THEN block closes — the first <ELSE>
      // in the region can belong to an IF nested inside the THEN.
      const thenOpen = inner.indexOf("<THEN>");
      let thenM = null, elseM = null;
      if (thenOpen >= 0) {
        const thenClose = matchClose(inner, thenOpen + 6, "THEN");
        thenM = inner.slice(thenOpen + 6, thenClose.start);
        elseM = extractBlock(inner.slice(thenClose.end), "ELSE");
      }
      out.push({ t: "if", expr, then: parseStatements(thenM || ""), else: elseM == null ? null : parseStatements(elseM) });
      i = close.end;
    } else {
      i = lt + 1; // stray text/whitespace
    }
  }
  return out;
}

// Find the matching </TAG> for a tag opened just before `from`, honouring nesting.
function matchClose(s, from, tag) {
  let depth = 1, i = from;
  const open = "<" + tag, close = "</" + tag + ">";
  while (depth > 0) {
    const o = s.indexOf(open, i), c = s.indexOf(close, i);
    if (c < 0) throw new Error("unbalanced " + tag);
    if (o >= 0 && o < c) { depth++; i = o + open.length; }
    else { depth--; i = c + close.length; if (depth === 0) return { start: c, end: i }; }
  }
}

// Extract the top-level <TAG>...</TAG> block from a statement region (nesting-safe).
function extractBlock(s, tag) {
  const open = s.indexOf("<" + tag + ">");
  if (open < 0) return null;
  const c = matchClose(s, open + tag.length + 2, tag);
  return s.slice(open + tag.length + 2, c.start);
}

// ---- Java expression -> JS ----
function makeTranslate(names) {
  return (expr) => expr
    // prefix declared variables with `this.` (not when they follow a dot: those are methods/fields)
    .replace(/(\.?)\b([A-Za-z_][A-Za-z0-9_]*)\b/g, (m, dot, id) =>
      dot ? m : names.has(id) ? "this." + id : m)
    .replace(/\s+/g, " ")
    .trim();
}

function emitStatements(stmts, tr, ind) {
  const pad = "  ".repeat(ind);
  const lines = [];
  for (const st of stmts) {
    if (st.t === "eval") lines.push(pad + tr(st.exec) + ";");
    else if (st.t === "call") lines.push(pad + "this." + st.method + "();");
    else {
      lines.push(pad + "if (" + tr(st.expr) + ") {");
      lines.push(emitStatements(st.then, tr, ind + 1));
      if (st.else && st.else.length) {
        lines.push(pad + "} else {");
        lines.push(emitStatements(st.else, tr, ind + 1));
      }
      lines.push(pad + "}");
    }
  }
  return lines.filter((l) => l.trim().length).join("\n");
}

function emitDefault(v, tr) {
  if (v.def == null) return v.type === "int" || v.type === "double" ? "0" : "BigDecimal.ZERO";
  if (v.type === "BigDecimal[]") return tr(v.def.replace(/^\{/, "[").replace(/\}$/, "]"));
  return tr(v.def);
}

function generate(file, { year, cls }) {
  const { vars, methods } = parse(fs.readFileSync(path.join(SRC, file), "utf8"));
  const names = new Set(vars.map((v) => v.name));
  const tr = makeTranslate(names);
  const inputs = vars.filter((v) => v.kind === "INPUT");
  const outputs = vars.filter((v) => v.kind === "OUTPUT");

  const body = [];
  body.push(`// GENERATED from scripts/pap/${file} (official BMF Programmablaufplan pseudocode).`);
  body.push(`// Do not edit — regenerate with: node scripts/gen-de-lohnsteuer.mjs`);
  body.push(`import { BigDecimal } from "./bigdecimal.js";`);
  body.push(``);
  body.push(`// Inputs:  ${inputs.map((v) => v.name).join(", ")}`);
  body.push(`// Outputs: ${outputs.map((v) => v.name).join(", ")}`);
  body.push(`export class ${cls} {`);
  body.push(`  constructor(inputs = {}) {`);
  for (const v of vars) body.push(`    this.${v.name} = ${emitDefault(v, tr)};`);
  body.push(`    Object.assign(this, inputs);`);
  body.push(`  }`);
  body.push(`  calc() { this.MAIN(); return this; }`);
  for (const m of methods) {
    body.push(`  ${m.name}() {`);
    body.push(emitStatements(m.body, tr, 2));
    body.push(`  }`);
  }
  body.push(`}`);
  body.push(`${cls}.YEAR = ${year};`);
  body.push(``);
  fs.writeFileSync(path.join(OUT, `lohnsteuer${year}.js`), body.join("\n"));
  console.log(`lohnsteuer${year}.js  <- ${file} (${vars.length} vars, ${methods.length} methods)`);
}

fs.mkdirSync(OUT, { recursive: true });
for (const [file, meta] of Object.entries(FILES)) generate(file, meta);
