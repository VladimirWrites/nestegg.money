// Public Brutto-Netto calculator page. Thin UI over finance-math/de/net.js — the same engine
// the MCP server uses. Everything runs client-side; the salary never leaves the browser.
import { deNetSalary } from "../lib/finance-math/de/net.js";
import { DE_STATUTORY } from "../lib/finance-math/de/statutory.js";

const $ = (id) => document.getElementById(id);

/* ---- bilingual UI (German-first; toggle persists) ---- */
const I18N = {
  de: {
    navHome: "Startseite", navApp: "Dashboard",
    h1: "Brutto-Netto-Rechner",
    sub: "Exakt nach dem amtlichen Programmablaufplan des Bundesfinanzministeriums — auf den Euro genau, für die Steuerjahre 2023 bis 2026. Ihr Gehalt verlässt Ihren Browser nicht.",
    lYear: "Steuerjahr", lGross: "Bruttolohn", oYear: "pro Jahr", oMonth: "pro Monat",
    lClass: "Steuerklasse", lFaktor: "Faktor (Faktorverfahren)", lState: "Bundesland",
    oNone: "— keine Angabe —", lKids: "Kinderfreibeträge (ZKF)",
    lKidsU25: "Kinder unter 25 (für die Pflegeversicherung)",
    lChurch: "Kirchensteuer", oChNone: "keine",
    lKvz: "KV-Zusatzbeitrag (%)", lAge: "Alter (optional)",
    lPkv: "privat krankenversichert", lPkvPrem: "PKV-Jahresprämie (€)",
    bGo: "Netto berechnen", hResult: "Ergebnis",
    hMethod: "Wie wird gerechnet?",
    pMethod1: "Lohnsteuer und Solidaritätszuschlag folgen dem amtlichen Programmablaufplan (PAP) des Bundesfinanzministeriums für das jeweilige Jahr — derselbe Algorithmus, den professionelle Lohnabrechnungssoftware verwendet. Für 2024 gilt der rückwirkende Dezember-Tarif, für 2023 der PAP ab Juli. Die Berechnung ist gegen alle 1.008 amtlichen Prüftabellenwerte getestet und stimmt auf den Euro.",
    pMethod2: "Die Sozialversicherung verwendet die Beitragsbemessungsgrenzen, Beitragssätze und den durchschnittlichen Zusatzbeitrag des gewählten Jahres, inklusive der Kinderabschläge in der Pflegeversicherung und der sächsischen Sonderregelung. Tragen Sie den Zusatzbeitrag Ihrer Krankenkasse ein, um auf den Cent genaue Werte zu erhalten.",
    pMethod3: "Alles läuft in Ihrem Browser: Ihr Gehalt wird an keinen Server geschickt, nicht gespeichert und nicht ausgewertet. Der Quellcode ist offen (Apache-2.0), dieselbe Berechnung ist auch als MCP-Server und JSON-API für KI-Agenten verfügbar.",
    hMore: "Mehr als ein Rechner",
    pMore: "nestegg ist ein privater Vermögens- und Gehalts-Tracker — verschlüsselt im Browser, ohne E-Mail und ohne Passwort.",
    aDemo: "Live-Demo ansehen",
    tAnnual: "Jahr", tMonthly: "Monat",
    rGross: "Brutto", rTax: "Lohnsteuer", rSoli: "Solidaritätszuschlag", rChurch: "Kirchensteuer",
    rRv: "Rentenversicherung", rAv: "Arbeitslosenversicherung", rKv: "Krankenversicherung",
    rKvPkv: "Krankenversicherung (PKV-Prämie)", rPv: "Pflegeversicherung",
    rSum: "Summe Abzüge", rNet: "Netto",
    errGross: "Bitte einen Bruttolohn eingeben.",
    phKidsU25: "— wie oben —",
    themeLight: "Hell", themeDark: "Dunkel",
    langBtn: "English", locale: "de-DE",
  },
  en: {
    navHome: "Home", navApp: "Dashboard",
    h1: "German net salary calculator",
    sub: "Exact per the Federal Ministry of Finance's official payroll algorithm — to the euro, for tax years 2023 to 2026. Your salary never leaves your browser.",
    lYear: "Tax year", lGross: "Gross salary", oYear: "per year", oMonth: "per month",
    lClass: "Tax class (Steuerklasse)", lFaktor: "Factor (Faktorverfahren)", lState: "State (Bundesland)",
    oNone: "— not specified —", lKids: "Child allowances (ZKF)",
    lKidsU25: "Children under 25 (for care insurance)",
    lChurch: "Church tax", oChNone: "none",
    lKvz: "Health insurance surcharge (%)", lAge: "Age (optional)",
    lPkv: "privately health-insured", lPkvPrem: "Private premium per year (€)",
    bGo: "Calculate net salary", hResult: "Result",
    hMethod: "How is this calculated?",
    pMethod1: "Income tax and the solidarity surcharge follow the Federal Ministry of Finance's official Programmablaufplan (PAP) for the selected year — the same algorithm professional payroll software uses. 2024 applies the retroactive December tariff, 2023 the from-July PAP. The engine is tested against all 1,008 official test-table values and matches to the euro.",
    pMethod2: "Social insurance applies the selected year's contribution ceilings, rates and average health surcharge, including the care-insurance child discounts and the Saxony rule. Enter your own Krankenkasse's surcharge for cent-exact results.",
    pMethod3: "Everything runs in your browser: your salary is never sent to a server, stored, or analyzed. The source is open (Apache-2.0), and the same engine is available as an MCP server and JSON API for AI agents.",
    hMore: "More than a calculator",
    pMore: "nestegg is a private net-worth and salary tracker — encrypted in your browser, no email, no password.",
    aDemo: "Try the live demo",
    tAnnual: "Annual", tMonthly: "Monthly",
    rGross: "Gross", rTax: "Income tax", rSoli: "Solidarity surcharge", rChurch: "Church tax",
    rRv: "Pension insurance", rAv: "Unemployment insurance", rKv: "Health insurance",
    rKvPkv: "Health insurance (private premium)", rPv: "Care insurance",
    rSum: "Total deductions", rNet: "Net",
    errGross: "Please enter a gross salary.",
    phKidsU25: "— as above —",
    themeLight: "Light", themeDark: "Dark",
    langBtn: "Deutsch", locale: "en-DE",
  },
};

let lang = "de";
try { lang = localStorage.getItem("nw_bnr_lang") === "en" ? "en" : "de"; } catch (e) {}

function applyLang() {
  const t = I18N[lang];
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => { const k = el.getAttribute("data-i18n"); if (t[k]) el.textContent = t[k]; });
  $("fKidsU25").placeholder = t.phKidsU25;
  $("langBtn").textContent = t.langBtn;
  syncThemeBtn();
  if (!$("bnrResult").classList.contains("hide")) calc();
}
$("langBtn").onclick = () => {
  lang = lang === "de" ? "en" : "de";
  try { localStorage.setItem("nw_bnr_lang", lang); } catch (e) {}
  applyLang();
};

/* ---- theme toggle (shares nw_theme with the rest of the site) ---- */
const currentTheme = () => (document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
function syncThemeBtn() {
  const t = I18N[lang];
  $("themeBtn").textContent = currentTheme() === "light" ? t.themeDark : t.themeLight;
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

/* ---- form behaviour ---- */
let kvzTouched = false;
function prefillKvz() {
  if (kvzTouched) return;
  $("fKvz").value = DE_STATUTORY[+$("fYear").value].kvAvgZusatzPct;
}
$("fKvz").addEventListener("input", () => { kvzTouched = true; });
$("fYear").addEventListener("change", prefillKvz);
$("fClass").addEventListener("change", () => $("rowFaktor").classList.toggle("hide", $("fClass").value !== "4"));
$("fPkv").addEventListener("change", () => $("rowPkvPrem").classList.toggle("hide", !$("fPkv").checked));
prefillKvz();

/* ---- calculation + rendering ---- */
const fmt = (v) => new Intl.NumberFormat(I18N[lang].locale, { style: "currency", currency: "EUR" }).format(v);

function calc() {
  const t = I18N[lang];
  const grossIn = parseFloat($("fGross").value);
  const err = $("bnrErr");
  if (!(grossIn > 0)) { err.textContent = t.errGross; err.classList.remove("hide"); $("bnrResult").classList.add("hide"); return; }
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

  const r = deNetSalary(args);
  const c = r.contributions;
  const rows = [
    [t.rGross, r.gross.annual],
    [t.rTax, r.incomeTax], [t.rSoli, r.soli],
    ...(r.churchTax > 0 ? [[t.rChurch, r.churchTax]] : []),
    [t.rRv, c.pension], [t.rAv, c.unemployment],
    [pkv ? t.rKvPkv : t.rKv, c.health], [t.rPv, c.care],
    [t.rSum, r.totalDeductions],
  ];
  const tr = (label, v, cls = "") => `<tr class="${cls}"><td>${label}</td><td>${fmt(v)}</td><td>${fmt(Math.round(v / 12 * 100) / 100)}</td></tr>`;
  $("bnrTable").innerHTML =
    `<tr><th></th><th>${t.tAnnual}</th><th>${t.tMonthly}</th></tr>`
    + rows.map(([l, v]) => tr(l, v)).join("")
    + tr(t.rNet, r.net.annual, "bnr-net");
  $("bnrBasis").textContent = r.assumptions.basis;
  $("bnrResult").classList.remove("hide");
}

$("bnrForm").addEventListener("submit", (e) => { e.preventDefault(); calc(); });
$("bnrForm").addEventListener("change", () => { if (!$("bnrResult").classList.contains("hide")) calc(); });

applyLang();
