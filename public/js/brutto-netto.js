// Public Brutto-Netto calculator page. Thin UI over finance-math/de/net.js — the same engine
// the MCP server uses. Everything runs client-side; the salary never leaves the browser.
// Static copy is pre-rendered per locale (see scripts/gen-i18n-pages.mjs); this module only
// builds the dynamic parts (result table, errors) via the i18n runtime, keyed off <html lang>.
import { deNetSalary } from "../lib/finance-math/de/net.js";
import { DE_STATUTORY } from "../lib/finance-math/de/statutory.js";
import { initI18n, t, getLocale } from "./i18n.js";

const $ = (id) => document.getElementById(id);
await initI18n(document.documentElement.lang);

// Clicking the language link is an explicit preference — remember it for the rest of the site.
const langLink = $("langLink");
if (langLink) langLink.addEventListener("click", () => {
  try { localStorage.setItem("nw_lang", getLocale() === "de" ? "en" : "de"); } catch (e) {}
});

/* ---- theme toggle (shares nw_theme with the rest of the site) ---- */
const currentTheme = () => (document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
function syncThemeBtn() {
  $("themeBtn").textContent = currentTheme() === "light" ? t("bnr.themeDark") : t("bnr.themeLight");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#0a0a0b");
}
$("themeBtn").onclick = () => {
  const next = currentTheme() === "light" ? "dark" : "light";
  if (next === "light") document.documentElement.setAttribute("data-theme", "light");
  else document.documentElement.removeAttribute("data-theme");
  try { localStorage.setItem("nw_theme", next); } catch (e) {}
  syncThemeBtn();
};
syncThemeBtn();

/* ---- form behaviour ---- */
let kvzTouched = false;
function prefillKvz() {
  if (kvzTouched) return;
  $("fKvz").value = DE_STATUTORY[+$("fYear").value].kvAvgZusatzPct;
}
$("fKvz").addEventListener("input", () => { kvzTouched = true; });
$("fYear").addEventListener("change", prefillKvz);
$("fClass").addEventListener("change", () => $("rowFaktor").classList.toggle("hide", $("fClass").value !== "4"));
// The surcharge and the PKV premium share one grid cell, so toggling never reflows the form.
$("fPkv").addEventListener("change", () => {
  const pkv = $("fPkv").checked;
  $("fKvz").classList.toggle("hide", pkv);
  $("fPkvPrem").classList.toggle("hide", !pkv);
  $("kvzLabel").textContent = pkv ? t("bnr.lPkvPrem") : t("bnr.lKvz");
});
$("fNetMode").addEventListener("change", () => {
  $("grossLabel").textContent = $("fNetMode").checked ? t("bnr.lNetTarget") : t("bnr.lGross");
});
prefillKvz();

/* ---- calculation + rendering ---- */
const fmt = (v) => new Intl.NumberFormat(getLocale() === "de" ? "de-DE" : "en-DE", { style: "currency", currency: "EUR" }).format(v);

function calc() {
  const grossIn = parseFloat($("fGross").value);
  const err = $("bnrErr");
  if (!(grossIn > 0)) { err.textContent = t("bnr.errGross"); err.classList.remove("hide"); $("bnrResult").classList.add("hide"); return; }
  err.classList.add("hide");

  const gross = $("fPeriod").value === "month" ? grossIn * 12 : grossIn;
  const pkv = $("fPkv").checked;
  const args = {
    year: +$("fYear").value,
    grossAnnual: gross,
    taxClass: +$("fClass").value,
    children: parseFloat($("fKids").value) || 0,
    churchTaxPct: +$("fChurch").value,
    bundesland: $("fState").value || null,
    kvZusatzPct: pkv ? null : (parseFloat($("fKvz").value) || null),
  };
  const u25 = parseFloat($("fKidsU25").value);
  if (!Number.isNaN(u25)) args.childrenUnder25 = u25;
  const age = parseFloat($("fAge").value);
  if (!Number.isNaN(age)) args.age = age;
  if (pkv) args.privateHealth = { premiumAnnual: parseFloat($("fPkvPrem").value) || 0 };
  const fk = parseFloat($("fFaktor").value);
  if (args.taxClass === 4 && fk > 0 && fk <= 1) args.faktor = fk;

  let requiredGross = null;
  if ($("fNetMode").checked) {
    const targetNet = gross;               // the entered amount is the desired net
    let lo = targetNet, hi = targetNet * 3;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (deNetSalary({ ...args, grossAnnual: mid }).net.annual < targetNet) lo = mid; else hi = mid;
    }
    requiredGross = Math.round(hi * 100) / 100;
    args.grossAnnual = requiredGross;
  }
  const r = deNetSalary(args);
  const c = r.contributions;
  const rows = [
    [t("bnr.gross"), r.gross.annual],
    [t("bnr.incomeTax"), r.incomeTax], [t("bnr.soli"), r.soli],
    ...(r.churchTax > 0 ? [[t("bnr.churchTax"), r.churchTax]] : []),
    [t("bnr.pension"), c.pension], [t("bnr.unemployment"), c.unemployment],
    [pkv ? t("bnr.healthPkv") : t("bnr.health"), c.health], [t("bnr.care"), c.care],
    [t("bnr.totalDeductions"), r.totalDeductions],
  ];
  const tr = (label, v, cls = "") => `<tr class="${cls}"><td>${label}</td><td>${fmt(v)}</td><td>${fmt(Math.round(v / 12 * 100) / 100)}</td></tr>`;
  $("bnrTable").innerHTML =
    `<tr><th></th><th>${t("bnr.annual")}</th><th>${t("bnr.monthly")}</th></tr>`
    + rows.map(([l, v]) => tr(l, v)).join("")
    + tr(t("bnr.net"), r.net.annual, "bnr-net");
  $("bnrBasis").textContent = r.assumptions.basis;
  $("bnrResult").classList.remove("hide");
}

$("bnrForm").addEventListener("submit", (e) => { e.preventDefault(); calc(); });
$("bnrForm").addEventListener("change", () => { if (!$("bnrResult").classList.contains("hide")) calc(); });
