// The gate (create / sign in), boot + reconcile flow, the home view switcher, the profile
// overlay, and the forecast/retirement input wiring.
import { $, showEditor, hideEditor, toast, debounce } from "./dom.js";
import { state, setState } from "../domain/store.js";
import { emptyState, migrate } from "../domain/schema.js";
import { mergeStates, setBaseline } from "../domain/merge.js";
import { CCYS } from "../domain/constants.js";
import { fcCfg } from "../domain/forecast.js";
import { retCfg } from "../domain/retirement.js";
import { generateToken, validToken, canonToken, normTok, deriveKeys, copyText } from "../io/crypto.js";
import { LS, loadLocal, saveLocal, scheduleSync, pushServer, loadServer, autoRefresh, fetchFx, refreshHistFx, refreshPrices } from "../io/storage.js";
import { renderAll, renderForecast, renderRetire, fcSyncInputs, retSyncInputs, downloadForecast, downloadHist, downloadDonut, armChartAnim } from "./charts.js";
import { renderSalary, armSalaryAnim } from "./salary.js";

// Render an account number with digits and letters coloured differently, kept on one line —
// shrinking the font only if the screen is too narrow.
function showToken(el, tok) {
  el.innerHTML = '<span class="tokline">' + [...tok].map((c) => (c === "-" ? '<span class="s">-</span>' : /[0-9]/.test(c) ? `<span class="d">${c}</span>` : `<span class="a">${c}</span>`)).join("") + "</span>";
  const line = el.querySelector(".tokline"); line.style.fontSize = "";
  const cs = getComputedStyle(el), avail = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  if (avail > 0) { const base = parseFloat(getComputedStyle(line).fontSize), w = line.getBoundingClientRect().width; if (w > avail) line.style.fontSize = Math.max(11, (base * avail) / w) + "px"; }
}

let pendingToken = null;
function showCreate() { $("gateCreate").classList.remove("hide"); $("gateSignin").classList.add("hide"); pendingToken = generateToken(); showToken($("newAcct"), pendingToken); }
function showSignin() { $("gateCreate").classList.add("hide"); $("gateSignin").classList.remove("hide"); }
$("toSignin").onclick = showSignin;
$("toCreate").onclick = showCreate;
$("regenAcct").onclick = () => { pendingToken = generateToken(); showToken($("newAcct"), pendingToken); };
$("copyAcct").onclick = async () => { toast((await copyText(pendingToken)) ? "Copied" : "Couldn't copy — write it down"); };
$("confirmAcct").onclick = async () => {
  LS.set("nw_token", pendingToken);
  try { await deriveKeys(pendingToken); } catch (e) {}
  setState(emptyState()); setBaseline(); saveLocal(); enterApp();
  try { pushServer(); } catch (e) {}
  try { fetchFx().then((ok) => { if (ok) { scheduleSync(); renderAll(); } }).catch(() => {}); } catch (e) {}
};
$("signinBtn").onclick = async () => {
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
  setBaseline(); enterApp();
  try { pushServer(); } catch (e) {}
};

export async function boot() {
  try {
    const tok = LS.get("nw_token");
    if (!tok) { showCreate(); return; }
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
    // First paint already happened from local; otherwise enter now. Either way re-render the merge.
    if ($("app").classList.contains("hide")) enterApp(); else renderAll();
    if (repair) { try { pushServer(); } catch (e) {} }
  } catch (e) {
    try { setState(emptyState()); } catch (_) {}
    try { showCreate(); } catch (_) {}
  }
}

function enterApp() {
  try {
    $("gate").classList.add("hide");
    $("app").classList.remove("hide");
    $("dateline").textContent = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    $("ccySel").innerHTML = CCYS.map((c) => `<option ${c === state.baseCcy ? "selected" : ""}>${c}</option>`).join("");
    armChartAnim();
    renderAll();
    // Refresh live FX + ticker prices (+ past-year closes). Silent; re-render once fresh.
    try { autoRefresh().then((ch) => { if (ch) { scheduleSync(); renderAll(); } }).catch(() => {}); } catch (e) {}
  } catch (e) { console && console.error && console.error("enterApp:", e); }
}

let profShown = false;
function renderProfAcct() {
  const el = $("profAcct"), tok = LS.get("nw_token") || "";
  if (profShown) showToken(el, tok); else el.textContent = tok.replace(/[0-9A-Za-z]/g, "•") || "…";
  $("profEye").classList.toggle("on", profShown);
}
function openProfile() { profShown = false; showEditor("profileEditor"); renderProfAcct(); }
function closeProfile() { hideEditor("profileEditor"); }
$("profileBtn").onclick = openProfile;
$("profileBack").onclick = closeProfile;
$("profEye").onclick = () => { profShown = !profShown; renderProfAcct(); };
$("profCopyAcct").onclick = async () => { const t = LS.get("nw_token") || ""; toast((await copyText(t)) ? "Account number copied" : "Couldn't copy — use the eye to reveal it"); };
$("profSyncNow").onclick = () => pushServer(true);
$("syncNowHome").onclick = () => pushServer(true);

// Net worth / Salary are tabs within the home page — switch the visible view in place.
export function showView(name) {
  const net = name !== "salary";
  $("viewNet").classList.toggle("hide", !net);
  $("viewSalary").classList.toggle("hide", net);
  $("navNet").classList.toggle("on", net);
  $("salaryBtn").classList.toggle("on", !net);
  $("mastTitle").textContent = net ? "Net Worth" : "Salary";
  $("mastSub").textContent = net ? "A quiet accounting of what you hold." : "What you and yours bring home, month by month.";
  if (net) { armChartAnim(); renderAll(); } else { armSalaryAnim(); renderSalary(); }
  window.scrollTo(0, 0);
}
$("navNet").onclick = () => showView("net");
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
