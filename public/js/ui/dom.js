// Leaf DOM helpers. The only layer that touches the document directly besides the
// renderers/editors. No domain or io imports, so anything may depend on it.

export const $ = (id) => document.getElementById(id);

// True when the user prefers reduced motion — gates the JS-driven count-up.
export const reduceMotion = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };

// Trailing debounce — collapses bursts (e.g. keystrokes) into one call.
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// Pure iOS check (incl. iPadOS, which reports as MacIntel with a touchscreen). Takes the
// navigator bits as args so it's unit-testable.
export const isIOSUserAgent = (ua, platform, maxTouchPoints) =>
  /iphone|ipad|ipod/i.test(ua || "") || ((platform || "") === "MacIntel" && (maxTouchPoints || 0) > 1);

// True when running as an installed/standalone PWA (so the install button can hide).
export const isStandalone = () => {
  try { return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; }
  catch (e) { return false; }
};

// Editor overlays: show one full-screen editor over the hidden app shell (scrolled to top),
// or reverse it.
export function showEditor(id) {
  const el = $(id);
  el.classList.remove("hide");
  $("app").classList.add("hide");
  window.scrollTo(0, 0);
  // Desktop only: focus + select the first field so you can type immediately. Skipped on
  // touch / coarse pointers so it doesn't pop the on-screen keyboard.
  try {
    if (matchMedia("(hover:hover) and (pointer:fine)").matches) {
      requestAnimationFrame(() => {
        const f = el.querySelector("input:not([type=checkbox]):not([type=radio]),select,textarea");
        if (f) { f.focus(); if (f.select) try { f.select(); } catch (e) {} }
      });
    }
  } catch (e) {}
}

// Brief amber highlight on an element whose displayed value just recomputed.
export function flash(el) {
  if (!el) return;
  el.classList.remove("flashed");
  void el.offsetWidth; // force reflow so the animation restarts on rapid edits
  el.classList.add("flashed");
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
// Human relative time, e.g. "just now", "5 min ago", "3 days ago". 0/missing -> "never".
export function relTime(ts) {
  if (!ts) return "never";
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 45) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return m + " min ago";
  const h = Math.floor(m / 60); if (h < 24) return h + " hour" + (h === 1 ? "" : "s") + " ago";
  const d = Math.floor(h / 24); if (d < 30) return d + " day" + (d === 1 ? "" : "s") + " ago";
  const mo = Math.floor(d / 30); if (mo < 12) return mo + " month" + (mo === 1 ? "" : "s") + " ago";
  const y = Math.floor(mo / 12); return y + " year" + (y === 1 ? "" : "s") + " ago";
}

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
  const dotCls = "syncdot " + (cls === "ok" ? "ok" : cls === "off" ? "off" : cls === "sync" ? "sync" : "");
  ["syncDot", "syncDot2"].forEach((id) => { const d = $(id); if (d) d.className = dotCls; });
  ["syncTxt", "syncTxt2"].forEach((id) => { const x = $(id); if (x) x.textContent = text; });
}
