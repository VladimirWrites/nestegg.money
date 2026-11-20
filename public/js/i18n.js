// Minimal i18n runtime for the two site locales (en default, de). No dependencies:
// dictionaries are plain ES modules under /i18n/, loaded on demand; plurals go through the
// native Intl.PluralRules; numbers/dates/currency stay with the Intl formatters call sites
// already use. Static public pages are pre-rendered per locale by scripts/gen-i18n-pages.mjs —
// this module covers the strings that are built at runtime.
export const LOCALES = ["en", "de"];
export const DEFAULT_LOCALE = "en";

let locale = DEFAULT_LOCALE;
let dict = {};

// Resolve the locale: explicit argument (e.g. from <html lang>), else the stored preference,
// else the browser language, else the default.
export function resolveLocale(explicit) {
  if (LOCALES.includes(explicit)) return explicit;
  try { const s = localStorage.getItem("nw_lang"); if (LOCALES.includes(s)) return s; } catch (e) {}
  const nav = (navigator.language || "").slice(0, 2).toLowerCase();
  return LOCALES.includes(nav) ? nav : DEFAULT_LOCALE;
}

export async function initI18n(explicit) {
  locale = resolveLocale(explicit);
  dict = (await import(`../i18n/${locale}.js`)).default;
  /* The document says which language it is in. Nothing set it, so the German app was served
     as lang="en" and read aloud by a screen reader in an English voice — and the hyphenation
     and quotation rules a browser applies are the wrong ones too. */
  try { if (typeof document !== "undefined") document.documentElement.lang = locale; } catch (e) {}
  return locale;
}

export const getLocale = () => locale;

// t("a.b.c", { name: "x", count: 2 }) — dotted key lookup, {param} interpolation, and plural
// forms when the entry is an object ({ one, other, ... }) and params.count is given.
export function t(key, params) {
  let v = dict;
  for (const part of key.split(".")) { v = v && v[part]; }
  if (v == null) return key;   // untranslated keys render as themselves — visible, not fatal
  if (typeof v === "object" && params && params.count != null) {
    const rule = new Intl.PluralRules(locale).select(params.count);
    v = v[rule] ?? v.other ?? key;
  }
  if (typeof v !== "string") return key;
  return params ? v.replace(/\{(\w+)\}/g, (m, p) => (params[p] != null ? String(params[p]) : m)) : v;
}

// Translate static DOM: <span data-i18n="key"> for text, data-i18n-placeholder / data-i18n-title
// for attributes. Pre-rendered pages rarely need this; it exists for runtime-built fragments.
export function translateDom(root = document) {
  /* A key that resolves to itself is a key that is missing — most often from a dictionary an
     old service worker is still serving, right after a deploy that added it. Printing
     "salary.savedShort" where a word should be is worse than leaving the English the page
     was authored with, which is what this now does. */
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    const k = el.getAttribute("data-i18n"), v = t(k);
    if (v !== k) el.textContent = v;
  });
  // `data-short` is the one-word form a CSS ::after prints where there is no room for the
  // sentence; it is translated like any other attribute.
  for (const attr of ["placeholder", "title", "aria-label", "data-short"]) {
    root.querySelectorAll(`[data-i18n-${attr}]`).forEach((el) => {
      const k = el.getAttribute(`data-i18n-${attr}`), v = t(k);
      if (v !== k) el.setAttribute(attr, v);
    });
  }
}
