// The gate (create / sign in), boot + reconcile flow, the home view switcher, the profile
// overlay, and the forecast/retirement input wiring.
import { $, showEditor, hideEditor, toast, debounce, relTime, pickerInit } from "./dom.js";
import { state, setState } from "../domain/store.js";
import { emptyState, migrate } from "../domain/schema.js";
import { mergeStates, setBaseline } from "../domain/merge.js";
import { CCYS } from "../domain/constants.js";
import { fcCfg } from "../domain/forecast.js";
import { retCfg } from "../domain/retirement.js";
import { generateToken, validToken, canonToken, normTok, deriveKeys, copyText, decWith, importShareKey } from "../io/crypto.js";
import { LS, syncedAt, setDemo, loadLocal, saveLocal, scheduleSync, pushServer, loadServer, autoRefresh, fetchFx, refreshHistFx, refreshPrices } from "../io/storage.js";
import { renderAll, repaintCharts, renderForecast, renderRetire, fcSyncInputs, retSyncInputs, downloadForecast, downloadHist, downloadDonut, armChartAnim } from "./charts.js";
import { renderSalary, armSalaryAnim } from "./salary.js";
import { renderBudget, setBudgetReadOnly } from "./budget.js";
import { setEntriesReadOnly } from "./networth.js";
import { initI18n, translateDom, t, getLocale } from "../i18n.js";
import { navView } from "./history.js";

/* Render an account number with digits and letters coloured differently.
   It wraps at its own dashes rather than being squeezed onto one line: the old version shrank
   the type to fit and stopped at 11px, which on a 320px phone still left the last group cut
   off — on the one screen whose whole job is getting this number read and saved correctly.
   Each dash-separated group is kept whole, so a break never falls inside a group. */
function showToken(el, tok) {
  const groups = String(tok).split("-");
  el.innerHTML = groups.map((g, i) => {
    const chars = [...g].map((c) => (/[0-9]/.test(c) ? `<span class="d">${c}</span>` : `<span class="a">${c}</span>`)).join("");
    const sep = i < groups.length - 1 ? '<span class="s">-</span>' : "";
    return `<span class="tokgrp">${chars}${sep}</span>`;
  }).join("");
}

/* ---- the password manager ----
   The account number is the only credential and there is no recovery, so the create screen
   offers it to the browser's password manager as well as to the clipboard. Chrome and Edge
   implement the credential store; Firefox and Safari don't, and there the constructor can
   exist while the call throws — so nothing below is ever promised. Copy is the offer; this is
   a shortcut for browsers that have one.

   The entry files under a constant name, never anything derived from the number: a username
   shows in plain text in manager lists, syncs between devices and turns up in exports. */
const VAULT_USER = "nestegg account";
const hasCredentialApi = () => typeof window.PasswordCredential === "function";

/* Asking twice for the same number is the commonest way to annoy someone who has just done as
   they were told: the offer is made when the screen appears, and again when they press the
   button that says they've saved it. So never for a number already stored on this device, and
   never twice inside a minute — the cooldown covers a manager that took the credential while
   the page was in the background, where the silent check answers late. */
let lastAsk = { token: null, at: 0 };
const ASK_COOLDOWN = 60000;

/* Whether it was actually saved. store() resolves the same way whether the prompt was accepted
   or dismissed, so it answers nothing; asking for the credential back does. The password is
   compared rather than the name, because every account files under the same name — an older
   number left in the manager would otherwise read as this one being safe. */
async function savedToManager(token) {
  if (!hasCredentialApi()) return false;
  try {
    const got = await navigator.credentials.get({ password: true, mediation: "silent" });
    return !!got && got.type === "password" && got.password === canonToken(token);
  } catch (e) { return false; }
}

// Raise the browser's save prompt. Built from the form where that works — the credential then
// carries exactly what the browser would have read out of the form itself.
async function askManager(token, form) {
  if (!hasCredentialApi() || !token) return;
  const now = Date.now();
  if (lastAsk.token === token && now - lastAsk.at < ASK_COOLDOWN) return;
  if (await savedToManager(token)) return;
  lastAsk = { token, at: now };
  try {
    let cred;
    try { cred = new window.PasswordCredential(form); }
    catch (e) { cred = new window.PasswordCredential({ id: VAULT_USER, password: canonToken(token), name: "nestegg account number" }); }
    await navigator.credentials.store(cred);
  } catch (e) { /* unimplemented, dismissed or blocked — the clipboard and JSON export remain */ }
}

/* The prompt belongs to the browser and fires no event, so the only way to notice an answer is
   to look again: a handful of times over the next twenty seconds, stopping at the first yes.
   Coming back to the tab is the likeliest moment for it to have changed — saving into a
   password manager often means leaving the browser for it. Returns its own canceller. */
const LOOK_AT = [700, 1500, 2500, 4000, 6000, 9000];
function watchForSave(token, onSaved) {
  let stopped = false, next = 0;
  const look = async () => {
    if (stopped) return;
    if (await savedToManager(token)) { stopped = true; return onSaved(); }
    if (next < LOOK_AT.length) setTimeout(look, LOOK_AT[next++]);
  };
  const onReturn = () => { if (document.visibilityState === "visible") look(); };
  addEventListener("visibilitychange", onReturn);
  setTimeout(look, LOOK_AT[next++]);
  return () => { stopped = true; removeEventListener("visibilitychange", onReturn); };
}

let pendingToken = null;
let acctStored = false;   // the browser confirmed it holds the number on screen
let stopAcctWatch = null;
function acctSaveConfirmed() { acctStored = true; $("acctSaved").classList.remove("hide"); }
function newToken() {
  pendingToken = generateToken();
  showToken($("newAcct"), pendingToken);
  // The hidden credential field is what the manager reads; the display above is for the eye.
  $("newAcctField").value = pendingToken;
  acctStored = false;
  $("acctSaved").classList.add("hide");
  if (stopAcctWatch) stopAcctWatch();
  // Offered while the number is still on screen rather than at the end of the flow: this is the
  // moment it's worth saving, and there's nothing to lose by asking early.
  askManager(pendingToken, $("gateCreate"));
  stopAcctWatch = watchForSave(pendingToken, acctSaveConfirmed);
}
/* Put the gate back on screen. Two things can be holding it off: the attribute the head script
   sets before first paint, and the class boot() adds the moment it finds a token — which it does
   before it has finished, so a failure anywhere after that used to leave the create form inside
   a hidden gate, i.e. a blank page with no way in. Both come off together. */
const revealGate = () => {
  try { document.documentElement.removeAttribute("data-boot"); } catch (e) {}
  const g = $("gate"); if (g) g.classList.remove("hide");
};
function showCreate() { revealGate(); $("gateCreate").classList.remove("hide"); $("gateSignin").classList.add("hide"); newToken(); }
function showSignin() {
  revealGate();
  if (stopAcctWatch) { stopAcctWatch(); stopAcctWatch = null; } // no create screen, nothing to confirm
  $("gateCreate").classList.add("hide"); $("gateSignin").classList.remove("hide");
}
$("toSignin").onclick = showSignin;
$("toCreate").onclick = showCreate;
// these are role="button" links — let keyboard users activate them with Enter/Space too
const keyActivate = (el) => el && el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); el.click(); } });
keyActivate($("toSignin")); keyActivate($("toCreate"));
if ($("toDemo")) { $("toDemo").onclick = startDemo; keyActivate($("toDemo")); }
// Leaving the demo (banner buttons) reloads to a clean gate — drops the in-memory sample.
if ($("demoCreate")) $("demoCreate").onclick = () => location.assign("/dashboard");
if ($("demoExit")) $("demoExit").onclick = () => location.assign("/dashboard");
$("regenAcct").onclick = () => newToken();
$("copyAcct").onclick = async () => { toast((await copyText(pendingToken)) ? t("common.copied") : t("gate.copyFail")); };
$("gateCreate").addEventListener("submit", async (e) => {
  e.preventDefault();
  // Last chance to save it, and only if it isn't already there — telling someone who saved it
  // from the first offer that they hadn't would be worse than not asking.
  if (!acctStored) await askManager(pendingToken, $("gateCreate"));
  if (stopAcctWatch) { stopAcctWatch(); stopAcctWatch = null; }
  LS.set("nw_token", pendingToken);
  try { await deriveKeys(pendingToken); } catch (e) {}
  setState(emptyState()); setBaseline(); saveLocal();
  enterApp();
  try { pushServer(); } catch (e) {}
  try { fetchFx().then((ok) => { if (ok) { scheduleSync(); renderAll(); } }).catch(() => {}); } catch (e) {}
});
$("gateSignin").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = $("signinInput").value.trim();
  if (!validToken(input)) { toast(t("gate.invalid")); return; }
  const canon = canonToken(input);
  // Any cached local state belongs to whoever was signed in before. Only merge it if it's the
  // same account — otherwise discard it so two accounts can never bleed together.
  const prevTok = LS.get("nw_token"), sameAcct = !!prevTok && normTok(prevTok) === normTok(canon);
  if (!sameAcct) { LS.rem("nw_state"); LS.rem("nw_state_bak"); }
  LS.set("nw_token", canon);
  try { await deriveKeys(canon); } catch (e) {}
  const rem = await loadServer();
  const loc = sameAcct ? loadLocal() : null;
  setState(migrate(rem && rem.snapshots ? (loc && loc.snapshots ? mergeStates(migrate(loc), migrate(rem)) : rem) : loc || emptyState()));
  setBaseline();
  enterApp();
  try { pushServer(); } catch (e) {}
});

export async function boot() {
  try {
    if (location.pathname === "/s" || location.pathname === "/s/") { await bootShare(); return; } // read-only shared snapshot
    if (location.hash === "#demo") { startDemo(); return; } // no-account tour with sample data
    const tok = LS.get("nw_token");
    if (!tok) { if (location.hash === "#signin") showSignin(); else showCreate(); return; }
    // Already signed in — never flash the login screen. Paint from the local cache immediately
    // (it's plaintext + synchronous), then reconcile with the server.
    $("gate").classList.add("hide");
    let loc = null; try { loc = loadLocal(); } catch (e) {}
    if (loc && loc.snapshots) { try { setState(migrate(loc)); setBaseline(); enterApp(); } catch (e) {} }
    try { await deriveKeys(tok); } catch (e) {}
    let rem = null; try { rem = await loadServer(); } catch (e) { rem = null; }
    let repair = false;
    try {
      const remOk = rem && rem.snapshots, locOk = loc && loc.snapshots;
      if (remOk && locOk) {
        // Merge per record (newest m wins, deletions honoured) — never clobber whole-doc.
        setState(migrate(mergeStates(migrate(loc), migrate(rem)))); repair = true;
      } else { setState(migrate(remOk ? rem : locOk ? loc : emptyState())); }
    } catch (e) { if (!state || !state.snapshots) setState(emptyState()); }
    setBaseline();
    // First paint already happened from local; otherwise enter now. renderAll() no-ops when
    // nothing chart-relevant changed, so this reconcile never cuts or replays the entrance.
    if ($("app").classList.contains("hide")) enterApp(); else renderAll();
    if (repair) { try { pushServer(); } catch (e) {} }
  } catch (e) {
    try { setState(emptyState()); } catch (_) {}
    try { showCreate(); } catch (_) {}
  }
}

function enterApp(skipRefresh) {
  try {
    $("gate").classList.add("hide");
    $("app").classList.remove("hide");
    $("dateline").textContent = new Date().toLocaleDateString(getLocale(), { day: "numeric", month: "long", year: "numeric" });
    ccyPicker.set(state.baseCcy);
    armChartAnim();
    renderAll();
    // Refresh live FX + ticker prices (+ past-year closes). Silent; re-render once fresh.
    // Skipped in demo mode (deterministic, offline, and scheduleSync is a no-op there anyway).
    if (!skipRefresh) { try { autoRefresh().then((ch) => { if (ch) { scheduleSync(); renderAll(); } }).catch(() => {}); } catch (e) {} }
  } catch (e) { console && console.error && console.error("enterApp:", e); }
}

// No-account tour: load sample data, flag demo mode (no persistence, no sync), show the app.
// The sample data module is large, so it's only fetched when the demo is actually started.
async function startDemo() {
  setDemo(true);
  const { sampleState } = await import("../domain/sample-data.js");
  setState(migrate(sampleState()));
  const b = $("demoBanner"); if (b) b.classList.remove("hide");
  enterApp(true);
}

// Read-only shared snapshot. Boots the same dashboard, but from a share link instead of an
// account: no gate, no sync, no persistence (demo plumbing), and editing chrome hidden via the
// `share` body class. The snapshot's `_include` decides which sections/tabs are shown.
async function bootShare() {
  document.body.classList.add("share");
  setEntriesReadOnly(true); // year drill-down renders static, formatted, right-aligned rows
  setBudgetReadOnly(true);  // budget renders plain rows, no empty categories, no edit controls
  const frag = location.hash.replace(/^#/, "");
  const dot = frag.indexOf(".");
  const id = dot > 0 ? frag.slice(0, dot) : "";
  const keyStr = dot > 0 ? frag.slice(dot + 1) : "";
  if (!/^[a-f0-9]{32}$/.test(id) || !keyStr) return shareError(t("share.errInvalidTitle"), t("share.errInvalidBody"));
  setDemo(true); // no persistence, no sync
  let blob;
  try {
    const r = await fetch("/api/share", { headers: { "X-Share-Id": id } });
    if (r.status === 404 || r.status === 410) return shareError(t("share.errGoneTitle"), t("share.errGoneBody"));
    if (!r.ok) return shareError(t("share.errLoadTitle"), t("share.errLoadBody"));
    blob = (await r.json()).blob;
  } catch (e) { return shareError(t("share.errLoadTitle"), t("share.errNetBody")); }
  try {
    const key = await importShareKey(keyStr);
    const snap = await decWith(blob, key);
    const inc = snap._include || {};
    setState(migrate(snap));
    applyShareVisibility(inc);
    $("shareBanner").classList.remove("hide");
    syncShareThemeLabel(); // now in the viewer's language (module-load ran before initI18n)
    enterApp(true); // frozen snapshot — skip the live FX/price refresh
    // Net worth may not be shared, so land on the first included section.
    const order = [["networth", "net"], ["salaries", "salary"], ["budget", "budget"]];
    const first = order.find(([k]) => inc[k]);
    if (first) showView(first[1]);
  } catch (e) { return shareError(t("share.errOpenTitle"), t("share.errOpenBody")); }
}

// Hide tabs/sections the sharer didn't include. Net worth, Salary and Budget are top-level
// tabs; Forecast and Retirement are sub-sections of the net-worth page.
function applyShareVisibility(inc) {
  const tabs = { networth: "navNet", salaries: "salaryBtn", budget: "navBudget" };
  for (const k in tabs) { const el = $(tabs[k]); if (el) el.classList.toggle("hide", !inc[k]); }
  const fc = document.querySelector(".forecast:not(.retire)"); if (fc) fc.classList.toggle("hide", !inc.forecast);
  const rt = document.querySelector(".forecast.retire"); if (rt) rt.classList.toggle("hide", !inc.retirement);
}

function shareError(title, body) {
  document.body.classList.add("share");
  $("gate").classList.add("hide");
  const app = $("app");
  app.classList.remove("hide");
  app.innerHTML = `<div class="sharemsg"><h1>${title}</h1><p>${body}</p><p class="sharemsg-foot"><a href="https://nestegg.money" rel="noopener">${t("share.errFoot")}</a></p></div>`;
}

/* The account number is not printed when the screen opens. This is the one secret here, the
   screen is reachable over anybody's shoulder, and nothing else on it needs the number to be
   legible — Copy works without ever showing it. So the row asks first, and once shown it stays
   shown until you leave. */
let profShown = false;
function renderProfAcct() {
  const el = $("profAcct"), tok = LS.get("nw_token") || "", btn = $("profEye");
  el.classList.toggle("hide", !profShown);
  if (profShown) showToken(el, tok);
  if (btn) { btn.textContent = t(profShown ? "prof.hideCta" : "prof.showCta"); btn.setAttribute("aria-expanded", String(profShown)); }
  const ls = $("lastSync"); if (ls) ls.textContent = relTime(syncedAt());
}
// Profile is a destination on the rail, not something you tap into and back out of — so it
// renders in place like the other three views and keeps the navigation on screen.
function openProfile() { profShown = false; navView("profile"); showView("profile"); }
$("profileBtn").onclick = openProfile;
$("profEye").onclick = () => { profShown = !profShown; renderProfAcct(); };

/* ---- theme ---- */
const currentTheme = () => (document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
function applyTheme(t) {
  if (t === "light") document.documentElement.setAttribute("data-theme", "light");
  else document.documentElement.removeAttribute("data-theme");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#0a0a0b");
}
// Mark whichever of the two buttons is the current answer.
function segSync(host, attr, value) {
  if (!host) return;
  host.querySelectorAll(".seg-btn").forEach((b) => {
    const on = b.getAttribute(attr) === value;
    b.classList.toggle("is-on", on);
    b.setAttribute("aria-pressed", String(on));
  });
}
function syncThemeSel() { segSync($("themeSeg"), "data-theme-opt", currentTheme()); }
// Recolour the SVG charts (they read theme CSS vars) by re-rendering the visible view.
// renderAll() would no-op here (state unchanged), so force a repaint for the net view.
function repaintForTheme() {
  if ($("viewSalary") && !$("viewSalary").classList.contains("hide")) renderSalary();
  else if ($("viewBudget") && !$("viewBudget").classList.contains("hide")) renderBudget();
  else repaintCharts();
}
function setTheme(t) {
  applyTheme(t);
  try { LS.set("nw_theme", t); } catch (err) {}
  repaintForTheme();
}
const themeSeg = $("themeSeg");
if (themeSeg) themeSeg.addEventListener("click", (e) => {
  const b = e.target.closest("[data-theme-opt]"); if (!b) return;
  setTheme(b.getAttribute("data-theme-opt"));
  syncThemeSel();
});
// Share viewer: the profile (and its theme picker) is hidden, so the banner carries a toggle.
// t() falls back to English literals for the module-load call, which runs before initI18n.
const shareTheme = $("shareTheme");
function syncShareThemeLabel() {
  if (!shareTheme) return;
  const key = currentTheme() === "light" ? "banner.darkMode" : "banner.lightMode";
  const v = t(key);
  shareTheme.textContent = v === key ? (currentTheme() === "light" ? "Dark mode" : "Light mode") : v;
}
if (shareTheme) shareTheme.onclick = () => { setTheme(currentTheme() === "light" ? "dark" : "light"); syncShareThemeLabel(); };
syncShareThemeLabel();
applyTheme(currentTheme()); // sync the browser UI colour to the theme set by the head script

/* ---- language ---- */
const langSeg = $("langSeg");
function syncLangSel() { segSync($("langSeg"), "data-lang-opt", getLocale()); }
if (langSeg) langSeg.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-lang-opt]"); if (!b) return;
  const lang = b.getAttribute("data-lang-opt");
  LS.set("nw_lang", lang);
  await initI18n(lang);
  translateDom();       // static labels, incl. the open profile
  applyMastTexts();     // the masthead tracks the active tab, so re-derive it
  syncShareThemeLabel();
  repaintForTheme();    // charts bake text into SVG the same way a theme change does
});
$("profCopyAcct").onclick = async () => { const tok = LS.get("nw_token") || ""; toast((await copyText(tok)) ? t("prof.acctCopied") : t("prof.copyFail")); };
$("profSyncNow").onclick = () => pushServer(true);
$("syncNowHome").onclick = () => pushServer(true);

// Net worth / Salary / Budget are tabs within the home page — switch the visible view in place.
export function showView(name) {
  const view = name === "salary" ? "salary" : name === "budget" ? "budget" : name === "profile" ? "profile" : "net";
  $("viewNet").classList.toggle("hide", view !== "net");
  $("viewSalary").classList.toggle("hide", view !== "salary");
  $("viewBudget").classList.toggle("hide", view !== "budget");
  $("viewProfile").classList.toggle("hide", view !== "profile");
  const on = { navNet: view === "net", salaryBtn: view === "salary", navBudget: view === "budget", profileBtn: view === "profile" };
  Object.entries(on).forEach(([id, active]) => {
    const el = $(id); if (!el) return;
    el.classList.toggle("is-on", active);
    if (active) el.setAttribute("aria-current", "page"); else el.removeAttribute("aria-current");
  });
  applyMastTexts();
  if (view === "net") { armChartAnim(); renderAll(); }
  else if (view === "salary") { armSalaryAnim(); renderSalary(); }
  else if (view === "budget") renderBudget();
  else { renderProfAcct(); syncThemeSel(); syncLangSel(); }
  window.scrollTo(0, 0);
}
// The masthead title/sub follow the active tab, in the active locale. Reads the view off the
// DOM so a language change can re-apply it without knowing how the current view was reached.
function applyMastTexts() {
  const view = !$("viewSalary").classList.contains("hide") ? "salary"
    : !$("viewBudget").classList.contains("hide") ? "budget"
    : !$("viewProfile").classList.contains("hide") ? "profile" : "net";
  const key = { salary: "nav.salaryTitle", budget: "nav.budgetTitle", profile: "nav.profileTitle", net: "nav.netTitle" }[view];
  const subKey = { salary: "nav.salarySub", budget: "nav.budgetSub", profile: "nav.profileSub", net: "nav.netSub" }[view];
  const title = t(key);
  $("mastTitle").textContent = title;
  // The same words in both places, because only one of them is on screen at a time: the bar on
  // a phone, the masthead on a desktop.
  const top = $("topTitle"); if (top) top.textContent = title;
  $("mastSub").textContent = t(subKey);
}
$("navNet").onclick = () => { navView("net"); showView("net"); };
$("navBudget").onclick = () => { navView("budget"); showView("budget"); };
$("profLogout").onclick = () => { if (confirm(t("prof.logoutConfirm"))) { LS.rem("nw_token"); LS.rem("nw_state"); LS.rem("nw_state_bak"); location.reload(); } };
// The display currency is a list of eleven, so it gets the drawn picker rather than a select
// whose popup the platform owns.
const ccyPicker = pickerInit("ccyPicker", "ccyBtn", "ccyVal", "ccyList", CCYS, (v) => {
  state.baseCcy = v; scheduleSync(); renderAll();
});
// Import and reset replace the whole state, so they have to put the new value on screen too.
export const setDisplayCcy = (v) => ccyPicker.set(v);
/* Fetching prices and rates by hand, from either place that offers it: the two buttons under the
   net-worth chart and the rows in Profile. The button is held disabled for the duration — these
   are network calls against a rate-limited upstream, and a second press starts a second run. */
async function busy(el, fn) {
  if (el) el.disabled = true;
  try { await fn(); } finally { if (el) el.disabled = false; }
}
const doPrices = (e) => busy(e.currentTarget, refreshPrices);   // read now: currentTarget is null after an await
const doRates = (e) => busy(e.currentTarget, async () => {
  toast(t("net.ratesUpdating"));
  const ok = await fetchFx();
  await refreshHistFx();
  scheduleSync();
  renderAll();
  toast(ok ? t("net.ratesUpdated", { date: state.fxDate || "" }) : t("net.ratesOffline"));
});
$("pricesBtn").onclick = doPrices;
$("profPricesBtn").onclick = doPrices;
$("profRatesBtn").onclick = doRates;

// Forecast inputs
(() => {
  const fcRender = debounce(() => { renderForecast(); renderRetire(); }, 120);
  const fcU = () => { scheduleSync(); fcRender(); };
  const on = $("fcOn"); if (on) on.onchange = (e) => { fcCfg().enabled = e.target.checked; fcU(); };
  const m = $("fcMonthly"); if (m) m.oninput = (e) => { fcCfg().monthly = parseFloat(e.target.value) || 0; fcU(); };
  const g = $("fcGrowth"); if (g) g.oninput = (e) => { fcCfg().growth = Math.min(Math.max((parseFloat(e.target.value) || 0) / 100, -0.5), 1); fcU(); };
  const gm = $("fcGoalMode"); if (gm) gm.onchange = (e) => { fcCfg().goalMode = e.target.value === "spend" ? "spend" : "amount"; fcSyncInputs(); fcU(); };
  const gv = $("fcGoalVal"); if (gv) gv.oninput = (e) => { const fc = fcCfg(), v = parseFloat(e.target.value) || 0; if (fc.goalMode === "spend") fc.annualSpending = v; else fc.goalAmount = v; fcU(); };
  const rd = $("fcRedirect"); if (rd) rd.onchange = (e) => { fcCfg().redirectLoans = e.target.checked; fcU(); };
  const cg = $("fcContribGrowth"); if (cg) cg.oninput = (e) => { fcCfg().contribGrowth = Math.min(Math.max((parseFloat(e.target.value) || 0) / 100, 0), 0.5); fcU(); };
  const bd = $("fcBand"); if (bd) bd.onchange = (e) => { fcCfg().band = e.target.checked; fcU(); };
  const hz = $("fcHorizon"); if (hz) hz.oninput = (e) => { fcCfg().horizonYear = parseInt(e.target.value, 10) || 0; fcU(); };
})();
// Retirement calculator inputs
(() => {
  const rRender = debounce(() => renderRetire(), 120);
  const rU = () => { scheduleSync(); rRender(); };
  const r = () => retCfg(), cy = new Date().getFullYear();
  const on = $("rtOn"); if (on) on.onchange = (e) => { r().on = e.target.checked; rU(); };
  const yr = $("rtYear"); if (yr) yr.oninput = (e) => { r().retireYear = parseInt(e.target.value, 10) || cy; rU(); };
  const sp = $("rtSpend"); if (sp) sp.oninput = (e) => { r().spending = parseFloat(e.target.value) || 0; rU(); };
  const ps = $("rtPensStart"); if (ps) ps.oninput = (e) => { r().pensionStart = parseInt(e.target.value, 10) || cy; rU(); };
  const un = $("rtUntil"); if (un) un.oninput = (e) => { r().untilYear = parseInt(e.target.value, 10) || cy + 45; rU(); };
  const inf = $("rtInfl"); if (inf) inf.oninput = (e) => { r().inflation = Math.min(Math.max((parseFloat(e.target.value) || 0) / 100, 0), 0.3); rU(); };
  const pm = $("rtPmode"); if (pm) pm.onchange = (e) => { r().pmode = e.target.value === "de" ? "de" : "amount"; retSyncInputs(); rU(); };
  const pen = $("rtPension"); if (pen) pen.oninput = (e) => { r().pension = parseFloat(e.target.value) || 0; rU(); };
  const pts = $("rtPts"); if (pts) pts.oninput = (e) => { r().points = parseFloat(e.target.value) || 0; rU(); };
  const pyr = $("rtPtsYr"); if (pyr) pyr.oninput = (e) => { r().ptsPerYear = parseFloat(e.target.value) || 0; rU(); };
  const pval = $("rtPtVal"); if (pval) pval.oninput = (e) => { r().ptValue = parseFloat(e.target.value) || 0; rU(); };
})();
$("dlFc") && ($("dlFc").onclick = () => downloadForecast());
$("dlHist").onclick = () => downloadHist();
$("dlDonut").onclick = () => downloadDonut();
$("ratesBtn").onclick = doRates;
