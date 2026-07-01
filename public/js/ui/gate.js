// The gate (create / sign in), boot + reconcile flow, the home view switcher, the profile
// overlay, and the forecast/retirement input wiring.
import { $, showEditor, hideEditor, toast, debounce, relTime } from "./dom.js";
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
import { renderBudget } from "./budget.js";

// Render an account number with digits and letters coloured differently, kept on one line —
// shrinking the font only if the screen is too narrow.
function showToken(el, tok) {
  el.innerHTML = '<span class="tokline">' + [...tok].map((c) => (c === "-" ? '<span class="s">-</span>' : /[0-9]/.test(c) ? `<span class="d">${c}</span>` : `<span class="a">${c}</span>`)).join("") + "</span>";
  const line = el.querySelector(".tokline"); line.style.fontSize = "";
  const cs = getComputedStyle(el), avail = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  if (avail > 0) { const base = parseFloat(getComputedStyle(line).fontSize), w = line.getBoundingClientRect().width; if (w > avail) line.style.fontSize = Math.max(11, (base * avail) / w) + "px"; }
}

let pendingToken = null;
function newToken() {
  pendingToken = generateToken();
  showToken($("newAcct"), pendingToken);
}
function showCreate() { $("gateCreate").classList.remove("hide"); $("gateSignin").classList.add("hide"); newToken(); }
function showSignin() { $("gateCreate").classList.add("hide"); $("gateSignin").classList.remove("hide"); }
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
$("copyAcct").onclick = async () => { toast((await copyText(pendingToken)) ? "Copied" : "Couldn't copy — write it down"); };
$("gateCreate").addEventListener("submit", async (e) => {
  e.preventDefault();
  LS.set("nw_token", pendingToken);
  try { await deriveKeys(pendingToken); } catch (e) {}
  setState(emptyState()); setBaseline(); saveLocal();
  enterApp();
  try { pushServer(); } catch (e) {}
  try { fetchFx().then((ok) => { if (ok) { scheduleSync(); renderAll(); } }).catch(() => {}); } catch (e) {}
});
$("gateSignin").addEventListener("submit", async (e) => {
  e.preventDefault();
  const t = $("signinInput").value.trim();
  if (!validToken(t)) { toast("That's not a valid account number"); return; }
  const canon = canonToken(t);
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
    $("dateline").textContent = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    $("ccySel").innerHTML = CCYS.map((c) => `<option ${c === state.baseCcy ? "selected" : ""}>${c}</option>`).join("");
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
  const frag = location.hash.replace(/^#/, "");
  const dot = frag.indexOf(".");
  const id = dot > 0 ? frag.slice(0, dot) : "";
  const keyStr = dot > 0 ? frag.slice(dot + 1) : "";
  if (!/^[a-f0-9]{32}$/.test(id) || !keyStr) return shareError("Invalid link", "This share link is incomplete or malformed. Ask for a fresh one.");
  setDemo(true); // no persistence, no sync
  let blob;
  try {
    const r = await fetch("/api/share", { headers: { "X-Share-Id": id } });
    if (r.status === 404 || r.status === 410) return shareError("Link no longer available", "This shared snapshot has expired or been revoked by its owner.");
    if (!r.ok) return shareError("Couldn't load", "Something went wrong fetching this snapshot. Try again later.");
    blob = (await r.json()).blob;
  } catch (e) { return shareError("Couldn't load", "Network error fetching this snapshot. Check your connection and retry."); }
  try {
    const key = await importShareKey(keyStr);
    const snap = await decWith(blob, key);
    const inc = snap._include || {};
    setState(migrate(snap));
    applyShareVisibility(inc);
    $("shareBanner").classList.remove("hide");
    enterApp(true); // frozen snapshot — skip the live FX/price refresh
    // Net worth may not be shared, so land on the first included section.
    const order = [["networth", "net"], ["salaries", "salary"], ["budget", "budget"]];
    const first = order.find(([k]) => inc[k]);
    if (first) showView(first[1]);
  } catch (e) { return shareError("Couldn't open", "The link's key didn't match this snapshot — it may be truncated."); }
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
  app.innerHTML = `<div class="sharemsg"><h1>${title}</h1><p>${body}</p><p class="sharemsg-foot"><a href="https://nestegg.money" rel="noopener">nestegg — private net-worth tracker</a></p></div>`;
}

let profShown = false;
function renderProfAcct() {
  const el = $("profAcct"), tok = LS.get("nw_token") || "";
  if (profShown) showToken(el, tok); else el.textContent = tok.replace(/[0-9A-Za-z]/g, "•") || "…";
  $("profEye").classList.toggle("on", profShown);
  const ls = $("lastSync"); if (ls) ls.textContent = "Last synced " + relTime(syncedAt());
}
function openProfile() { profShown = false; showEditor("profileEditor"); renderProfAcct(); syncThemeSel(); }
function closeProfile() { hideEditor("profileEditor"); }
$("profileBtn").onclick = openProfile;
$("profileBack").onclick = closeProfile;
$("profEye").onclick = () => { profShown = !profShown; renderProfAcct(); };

/* ---- theme ---- */
const currentTheme = () => (document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
function applyTheme(t) {
  if (t === "light") document.documentElement.setAttribute("data-theme", "light");
  else document.documentElement.removeAttribute("data-theme");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#0a0a0b");
}
function syncThemeSel() { const s = $("themeSel"); if (s) s.value = currentTheme(); }
const themeSel = $("themeSel");
if (themeSel) themeSel.addEventListener("change", () => {
  applyTheme(themeSel.value);
  try { LS.set("nw_theme", themeSel.value); } catch (err) {}
  // recolour the SVG charts (they read theme CSS vars) by re-rendering the visible view.
  // renderAll() would no-op here (state unchanged), so force a repaint for the net view.
  if ($("viewSalary") && !$("viewSalary").classList.contains("hide")) renderSalary();
  else if ($("viewBudget") && !$("viewBudget").classList.contains("hide")) renderBudget();
  else repaintCharts();
});
applyTheme(currentTheme()); // sync the browser UI colour to the theme set by the head script
$("profCopyAcct").onclick = async () => { const t = LS.get("nw_token") || ""; toast((await copyText(t)) ? "Account number copied" : "Couldn't copy — use the eye to reveal it"); };
$("profSyncNow").onclick = () => pushServer(true);
$("syncNowHome").onclick = () => pushServer(true);

// Net worth / Salary / Budget are tabs within the home page — switch the visible view in place.
export function showView(name) {
  const view = name === "salary" ? "salary" : name === "budget" ? "budget" : "net";
  $("viewNet").classList.toggle("hide", view !== "net");
  $("viewSalary").classList.toggle("hide", view !== "salary");
  $("viewBudget").classList.toggle("hide", view !== "budget");
  $("navNet").classList.toggle("on", view === "net");
  $("salaryBtn").classList.toggle("on", view === "salary");
  $("navBudget").classList.toggle("on", view === "budget");
  if (view === "net") {
    $("mastTitle").textContent = "Net Worth";
    $("mastSub").textContent = "A quiet accounting of what you hold.";
    armChartAnim(); renderAll();
  } else if (view === "salary") {
    $("mastTitle").textContent = "Salary";
    $("mastSub").textContent = "What you and yours bring home, month by month.";
    armSalaryAnim(); renderSalary();
  } else {
    $("mastTitle").textContent = "Budget";
    $("mastSub").textContent = "Roughly what's left each month.";
    renderBudget();
  }
  window.scrollTo(0, 0);
}
$("navNet").onclick = () => showView("net");
$("navBudget").onclick = () => showView("budget");
$("profLogout").onclick = () => { if (confirm("Log out on this device? Make sure your account number is saved — it's the only way back in.")) { LS.rem("nw_token"); LS.rem("nw_state"); LS.rem("nw_state_bak"); location.reload(); } };
$("ccySel").onchange = (e) => { state.baseCcy = e.target.value; scheduleSync(); renderAll(); };
$("pricesBtn").onclick = refreshPrices;

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
$("ratesBtn").onclick = async () => { toast("Updating rates…"); const ok = await fetchFx(); await refreshHistFx(); scheduleSync(); renderAll(); toast(ok ? "Rates updated · " + (state.fxDate || "") : "Rates unavailable (offline)"); };
