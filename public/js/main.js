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
import { boot, setDisplayCcy } from "./ui/gate.js";
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

// Esc closes the open editor — routed through its Back button so sync + re-render run.
const EDITOR_BACK = { yearEditor: "edBack", salaryEditor: "salaryBack", assetEditor: "assetBack" };
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
        const o = document.createElement("div");
        o.className = "updating";
        o.innerHTML = `<div class="spin"></div><div class="updtxt">${t("prof.updating")}</div>`;
        document.body.appendChild(o);
      });
      // Installed PWAs rarely navigate, so the browser seldom re-checks sw.js on its own —
      // force a check on load and whenever the app regains focus so updates land promptly.
      const check = () => { try { reg.update(); } catch (e) {} };
      check();
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
    }).catch(() => {});
  } catch (e) {}
}
