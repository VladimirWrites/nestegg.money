// Entry point. Importing the ui modules runs their event-listener wiring; this file adds the
// cross-cutting handlers (field-select, import/export/reset, resize, tab-close flush), connects
// background data refreshes to a re-render, boots the app, and registers the service worker.
import { state, setState } from "./domain/store.js";
import { emptyState, migrate } from "./domain/schema.js";
import { $, toast, downloadBlob } from "./ui/dom.js";
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

try { boot(); } catch (e) {}

// PWA: offline app shell. Registered after boot so it never competes with startup.
if ("serviceWorker" in navigator) { try { navigator.serviceWorker.register("/sw.js"); } catch (e) {} }
