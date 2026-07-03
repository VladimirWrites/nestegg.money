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
  root.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.getAttribute("data-i18n")); });
  for (const attr of ["placeholder", "title", "aria-label"]) {
    root.querySelectorAll(`[data-i18n-${attr}]`).forEach((el) => { el.setAttribute(attr, t(el.getAttribute(`data-i18n-${attr}`))); });
  }
}
