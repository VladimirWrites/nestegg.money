// Entry point. Importing the ui modules runs their event-listener wiring; this file adds the
// cross-cutting handlers (field-select, import/export/reset, resize, tab-close flush), connects
// background data refreshes to a re-render, boots the app, and registers the service worker.
import { state, setState } from "./domain/store.js";
import { emptyState, migrate } from "./domain/schema.js";
import { $, toast, downloadBlob, isIOSUserAgent, isStandalone } from "./ui/dom.js";
import { scheduleSync, flushSync, autoRefresh, setDataListener } from "./io/storage.js";
import { renderAll } from "./ui/charts.js";
import { renderEntries } from "./ui/networth.js";
import { drawSalaryChart } from "./ui/salary.js";
import { boot, setDisplayCcy, showView } from "./ui/gate.js";
import { initHistory } from "./ui/history.js";
import { initI18n, translateDom, t } from "./i18n.js";
import "./ui/assets.js"; // side-effect: wire its editor listeners
import "./ui/share.js"; // side-effect: wire the share dialog

// After background data lands (FX/prices), re-render whichever view is active.
setDataListener(() => {
  if (!$("yearEditor").classList.contains("hide")) renderEntries();
  else renderAll();
});

// Select a field's contents on focus, so you can type straight over a value (e.g. "0") without
// deleting it first. Prevent the click's mouse-up from clearing that selection.
const selField = (t) => t && t.tagName === "INPUT" && (t.type === "number" || t.type === "text");
let selJustFocused = false;
document.addEventListener("focusin", (e) => { if (selField(e.target)) { try { e.target.select(); } catch (_) {} selJustFocused = true; } });
document.addEventListener("mouseup", (e) => { if (selJustFocused && selField(e.target)) e.preventDefault(); selJustFocused = false; });

$("exportBtn").onclick = () => {
  const b = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  downloadBlob(b, "networth-" + new Date().toISOString().slice(0, 10) + ".json");
};
$("importBtn").onclick = () => $("importFile").click();
$("importFile").onchange = (e) => {
  const f = e.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const d = JSON.parse(rd.result);
      if (d.snapshots) {
        const hasData = (state.snapshots && state.snapshots.length) || (state.salaries && state.salaries.length) || (state.assets && state.assets.length);
        if (hasData && !confirm(t("prof.importConfirm"))) { e.target.value = ""; return; }
        setState(migrate(d)); setDisplayCcy(state.baseCcy); scheduleSync(); renderAll(); toast(t("prof.imported"));
        // Refresh FX, live prices and past-year closes for whatever the import brought in.
        try { autoRefresh().then((ch) => { if (ch) { scheduleSync(); renderAll(); } }).catch(() => {}); } catch (err) {}
      } else toast(t("prof.noSnapshots"));
    } catch (err) { toast(t("prof.readFail")); }
    finally { e.target.value = ""; }
  };
  rd.readAsText(f);
};
$("resetBtn").onclick = () => { if (confirm(t("prof.resetConfirm"))) { setState(emptyState()); setDisplayCcy("EUR"); scheduleSync(); renderAll(); toast(t("prof.cleared")); } };

// Flush the pending change immediately when the tab is hidden/closed, so the last edit lands.
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") try { flushSync(); } catch (e) {} });
window.addEventListener("pagehide", () => { try { flushSync(); } catch (e) {} });

// Re-fit the width-filling charts when the viewport changes size.
let rszT;
window.addEventListener("resize", () => {
  clearTimeout(rszT);
  rszT = setTimeout(() => {
    try {
      const vn = $("viewNet"); if (vn && !vn.classList.contains("hide")) renderAll();
      const vs = $("viewSalary"); if (vs && !vs.classList.contains("hide")) drawSalaryChart();
    } catch (e) {}
  }, 160);
});

/* Esc, and the system Back button, close the open editor — routed through its own Back button
   so the sync and the re-render underneath run exactly as they do when it is pressed.

   Topmost first. An asset opens on top of the year editor that reached it, so both are open at
   once, and closing them in declaration order shut the year editor out from underneath the
   asset editor still covering the screen. */
const EDITOR_BACK = { assetEditor: "assetBack", salaryEditor: "salaryBack", yearEditor: "edBack" };
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const im = $("infoModal"); if (im && !im.classList.contains("hide")) return; // the info modal handles its own Esc
  for (const id in EDITOR_BACK) { const ed = $(id); if (ed && !ed.classList.contains("hide")) { const b = $(EDITOR_BACK[id]); if (b) b.click(); return; } }
});

// PWA install (profile "Install app" button). Chromium/Android fire beforeinstallprompt, so
// we trigger the native prompt. iOS/iPadOS has no install API, so the button opens a short
// "Add to Home Screen" guide. Hidden only when already running standalone.
const installBtn = $("installBtn");
const installRow = $("installRow");
const onIOS = isIOSUserAgent(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
let deferredInstall = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredInstall = e; });
window.addEventListener("appinstalled", () => { deferredInstall = null; if (installBtn) installRow && installRow.classList.add("hide"); });

if (installBtn) {
  // Show whenever not already installed. Some browsers (Brave, Firefox) never fire
  // beforeinstallprompt, so we can't rely on it to reveal the button.
  if (!isStandalone()) installRow && installRow.classList.remove("hide");
  installBtn.onclick = async () => {
    if (deferredInstall) {
      // Chromium with a captured prompt — trigger the native install dialog.
      deferredInstall.prompt();
      try { await deferredInstall.userChoice; } catch (e) {}
      deferredInstall = null; installRow && installRow.classList.add("hide");
      return;
    }
    // No programmatic prompt (iOS, Brave, Firefox, or not yet eligible) — show how to install.
    // The guide HTML lives in the i18n dictionaries (prof.installIOS / prof.installOther).
    const b = $("infoBody");
    if (b) b.innerHTML = onIOS ? t("prof.installIOS") : t("prof.installOther");
    if ($("infoModal")) $("infoModal").classList.remove("hide");
  };
}

// Resolve the locale and translate the static page before first paint (module scripts run
// pre-render), so boot never flashes English at a German user. Failure = English fallback.
try { await initI18n(); translateDom(); } catch (e) {}

try { boot(); } catch (e) {}

/* The system Back button. Editors close first, then the tab bar walks back to Net worth, and
   Back from there leaves the app — which is what Back does everywhere else on the platform.
   Wired after boot, so the entry it records is the view boot actually landed on. */
initHistory({
  onView: (v) => showView(v),
  // Through each editor's own Back button, so closing by the system button runs exactly what
  // closing by the arrow runs: the sync, and the re-render underneath.
  onCloseEditor: () => {
    for (const id in EDITOR_BACK) {
      const ed = $(id);
      if (ed && !ed.classList.contains("hide")) { const b = $(EDITOR_BACK[id]); if (b) { b.click(); return true; } }
    }
    return false;
  },
});


/* ---------- the update screen ----------

   The one screen this app puts up that is not about anybody's money, so it is the one most at
   risk of looking like a different program. A borrowed spinner is what it used to be. Drawn in
   the app's own vocabulary instead: the stacked column chart the home screen draws, arriving a
   year at a time.

   The run is walked rather than fixed — each year lands within 15% of the one before it, on a
   gentle upward drift — so the chart is a different ledger every time it appears, and never the
   suspiciously smooth curve nobody's savings actually make. It is a picture of nothing in
   particular, which is the point: it is drawn from no one's figures.

   Each column grows up from the axis as it arrives, and they all hold full at the end of the
   cycle before starting again together. Growing them on their own staggered timers instead
   would also drain them left to right when the cycle turned over, which on a chart of savings
   reads as losing it all rather than as an animation repeating.

   It repeats rather than measures: nothing here can know how far along a download is. */
const UPD_COUNT = 20;
const UPD_CYCLE = 3.4;   // seconds for the whole run
const UPD_FILL = 0.74;   // …of which this much is spent arriving, the rest held full

/* A year somewhere between 5% down and 30% up on the one before it — a good decade, which is
   what a nest egg is drawn as. Multiplicative all the way, and scaled to the tallest year only
   at the end, so the run keeps its shape whatever it lands on.

   Twenty of them, and the count is doing real work: the first column is only small if the run
   has had room to compound. Over nine steps these odds multiply about threefold and the first
   year still stands a third as tall as the last; over nineteen they multiply about ninefold,
   which puts the first year down near the axis where it belongs. */
function updWalk(n) {
  const out = [];
  let h = 1;
  for (let i = 0; i < n; i++) {
    out.push(h);
    h *= 0.95 + Math.random() * 0.35;   // −5% to +30%
  }
  const max = Math.max(...out);
  // A floor of one pixel-ish, so a first year that lands very low is still a mark on the axis
  // rather than nothing at all.
  return out.map((v) => Math.max(2, Math.round((v / max) * 100)));
}

/* One rule per column, because each starts growing at its own point in the cycle and a keyframe
   cannot read a custom property for its percentages. Replaced on every show, so a new walk gets
   new timings. */
function updKeyframes(n) {
  let css = "";
  for (let i = 0; i < n; i++) {
    const at = ((i / n) * UPD_FILL * 100).toFixed(2);
    const to = (((i + 0.55) / n) * UPD_FILL * 100).toFixed(2);
    css += `@keyframes upd-grow-${i}{0%,${at}%{transform:scaleY(0)}${to}%,100%{transform:scaleY(1)}}`;
  }
  return css;
}

function updChart() {
  const heights = updWalk(UPD_COUNT);
  let style = document.getElementById("upd-keys");
  if (!style) { style = document.createElement("style"); style.id = "upd-keys"; document.head.appendChild(style); }
  style.textContent = updKeyframes(UPD_COUNT);

  const strip = document.createElement("div");
  strip.className = "upd-chart";
  strip.setAttribute("aria-hidden", "true");
  strip.style.setProperty("--count", String(UPD_COUNT));
  strip.style.setProperty("--cycle", UPD_CYCLE + "s");
  const bars = document.createElement("div");
  bars.className = "upd-bars";
  heights.forEach((h, i) => {
    const b = document.createElement("i");
    b.className = "upd-bar";
    b.style.height = h + "%";
    b.style.animationName = "upd-grow-" + i;
    bars.appendChild(b);
  });
  strip.appendChild(bars);
  const axis = document.createElement("i");
  axis.className = "upd-axis";
  strip.appendChild(axis);
  return strip;
}

function showUpdating() {
  if (document.querySelector(".updating")) return;
  const o = document.createElement("div");
  o.className = "updating";
  const brand = document.createElement("div");
  brand.className = "brand";
  brand.innerHTML = '<i class="brand-lamp sync"></i><span>nestegg</span>';
  const txt = document.createElement("div");
  txt.className = "updtxt";
  txt.setAttribute("role", "status");
  txt.textContent = t("prof.updating");
  o.append(brand, updChart(), txt);
  document.body.appendChild(o);
}

function hideUpdating() {
  const el = document.querySelector(".updating");
  if (el) el.remove();
}

// PWA: offline app shell + auto-update. When a new service worker is found it calls
// skipWaiting (in sw.js) and takes control; we show a brief "Updating…" overlay and reload
// into the fresh build. Guarded so the initial install's clients.claim doesn't reload.
if ("serviceWorker" in navigator) {
  // Controlled at load == a SW already ran here before, so any worker found now is a real
  // update (not the first install, whose fast skipWaiting+claim would otherwise look like one).
  const hadController = !!navigator.serviceWorker.controller;
  let updating = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (updating) window.location.reload(); });
  try {
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      reg.addEventListener("updatefound", () => {
        if (!hadController) return; // first install this session, not an update
        updating = true;
        showUpdating();
        /* An install that never activates would otherwise leave this panel over the app, and
           it is opaque. A worker going redundant takes it down; a backstop takes it down
           anyway if the install neither finishes nor reports. */
        const worker = reg.installing;
        if (worker) worker.addEventListener("statechange", () => {
          if (worker.state === "redundant") { updating = false; hideUpdating(); }
        });
        setTimeout(() => {
          if (document.querySelector(".updating")) { updating = false; hideUpdating(); }
        }, 20000);
      });
      // Installed PWAs rarely navigate, so the browser seldom re-checks sw.js on its own —
      // force a check on load and whenever the app regains focus so updates land promptly.
      const check = () => { try { reg.update(); } catch (e) {} };
      check();
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
    }).catch(() => {});
  } catch (e) {}
}
