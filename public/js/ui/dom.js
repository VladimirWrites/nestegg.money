// Leaf DOM helpers. The only layer that touches the document directly besides the
// renderers/editors. No domain or io imports, so anything may depend on it.

export const $ = (id) => document.getElementById(id);

// True when the user prefers reduced motion — gates the JS-driven count-up.
export const reduceMotion = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };

// Trailing debounce — collapses bursts (e.g. keystrokes) into one call.
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// Editor overlays: show one full-screen editor over the hidden app shell (scrolled to top),
// or reverse it.
export function showEditor(id) {
  $(id).classList.remove("hide");
  $("app").classList.add("hide");
  window.scrollTo(0, 0);
}
export function hideEditor(id) {
  $(id).classList.add("hide");
  $("app").classList.remove("hide");
}

// Trigger a browser download of a Blob, releasing the object URL afterward.
export function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Set an input's value unless it's focused (so syncing never fights the user mid-type).
export function syncVal(id, val) {
  const el = $(id);
  if (el && document.activeElement !== el) el.value = val || "";
}

// Transient bottom toast.
let toastTimer;
export function toast(m) {
  const el = $("toast");
  if (!el) return;
  el.textContent = m;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2300);
}

// Sync status indicator (two mirrored dots/labels in the masthead + profile).
export function setSync(cls, text) {
  const dotCls = "syncdot " + (cls === "ok" ? "ok" : cls === "off" ? "off" : "");
  ["syncDot", "syncDot2"].forEach((id) => { const d = $(id); if (d) d.className = dotCls; });
  ["syncTxt", "syncTxt2"].forEach((id) => { const x = $(id); if (x) x.textContent = text; });
}
