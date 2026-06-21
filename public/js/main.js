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
import { boot } from "./ui/gate.js";
import "./ui/assets.js"; // side-effect: wire its editor listeners

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
        if (hasData && !confirm("Importing replaces ALL current data on this device. Export a backup first if you're unsure. Continue?")) { e.target.value = ""; return; }
        setState(migrate(d)); $("ccySel").value = state.baseCcy; scheduleSync(); renderAll(); toast("Imported");
        // Refresh FX, live prices and past-year closes for whatever the import brought in.
        try { autoRefresh().then((ch) => { if (ch) { scheduleSync(); renderAll(); } }).catch(() => {}); } catch (err) {}
      } else toast("No snapshots in that file");
    } catch (err) { toast("Could not read that file"); }
    finally { e.target.value = ""; }
  };
  rd.readAsText(f);
};
$("resetBtn").onclick = () => { if (confirm("Clear all data and start fresh? Export JSON first if you want a backup.")) { setState(emptyState()); $("ccySel").value = "EUR"; scheduleSync(); renderAll(); toast("Cleared"); } };

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
const EDITOR_BACK = { yearEditor: "edBack", salaryEditor: "salaryBack", assetEditor: "assetBack", profileEditor: "profileBack" };
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const im = $("infoModal"); if (im && !im.classList.contains("hide")) return; // the info modal handles its own Esc
  for (const id in EDITOR_BACK) { const ed = $(id); if (ed && !ed.classList.contains("hide")) { const b = $(EDITOR_BACK[id]); if (b) b.click(); return; } }
});

// PWA install (profile "Install app" button). Chromium/Android fire beforeinstallprompt, so
// we trigger the native prompt. iOS/iPadOS has no install API, so the button opens a short
// "Add to Home Screen" guide. Hidden only when already running standalone.
const installBtn = $("installBtn");
const onIOS = isIOSUserAgent(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
let deferredInstall = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredInstall = e; });
window.addEventListener("appinstalled", () => { deferredInstall = null; if (installBtn) installBtn.classList.add("hide"); });

if (installBtn) {
  // Show whenever not already installed. Some browsers (Brave, Firefox) never fire
  // beforeinstallprompt, so we can't rely on it to reveal the button.
  if (!isStandalone()) installBtn.classList.remove("hide");
  installBtn.onclick = async () => {
    if (deferredInstall) {
      // Chromium with a captured prompt — trigger the native install dialog.
      deferredInstall.prompt();
      try { await deferredInstall.userChoice; } catch (e) {}
      deferredInstall = null; installBtn.classList.add("hide");
      return;
    }
    // No programmatic prompt (iOS, Brave, Firefox, or not yet eligible) — show how to install.
    const b = $("infoBody");
    if (b) b.innerHTML = onIOS
      ? `<h3>Install on iPhone / iPad</h3>
         <p>iOS installs apps from the browser's Share menu:</p>
         <ul>
           <li>Tap the <b>Share</b> button (the square with an up-arrow) in Safari's toolbar.</li>
           <li>Scroll down and choose <b>Add to Home Screen</b>, then <b>Add</b>.</li>
         </ul>
         <p>nestegg then opens full-screen like an app; your data stays on this device.</p>`
      : `<h3>Install nestegg as an app</h3>
         <p>Look for the install control in your browser:</p>
         <ul>
           <li><b>Chrome / Edge</b> — the install icon (a monitor with a ↓) at the right of the address bar, or menu → <b>Install nestegg…</b></li>
           <li><b>Brave</b> — the install icon in the address bar, or menu → <b>Install nestegg.money…</b></li>
           <li><b>Firefox (desktop)</b> — no built-in install; use Chrome/Edge/Brave, or your phone.</li>
         </ul>
         <p>Once installed it opens in its own window and works offline.</p>`;
    if ($("infoModal")) $("infoModal").classList.remove("hide");
  };
}

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
        o.innerHTML = '<div class="spin"></div><div class="updtxt">Updating…</div>';
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
