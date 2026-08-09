// Leaf DOM helpers. The only layer that touches the document directly besides the
// renderers/editors. No domain or io imports, so anything may depend on it.
import { t } from "../i18n.js";
import { pushEditor, popEditor } from "./history.js";

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
  /* On a phone the editor is the whole window, so the app behind it is put away. On a desktop
     the navigation rail lives inside #app, and hiding the lot took the rail with it — an editor
     is a place you tapped into, not a dialog you have to answer, so the rail stays and the
     editor takes the column beside it. It is opaque and covers that column exactly, so there is
     nothing to see behind it either way. */
  if (!matchMedia("(min-width: 900px)").matches) $("app").classList.add("hide");
  // An editor is tapped into rather than navigated to, so the tab bar steps aside and gives
  // the room back to the page it was holding.
  document.body.classList.add("no-nav");
  // …and it is a place of its own, so the system's Back button closes it rather than the app.
  pushEditor(id);
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

// Put the caret in a just-added field and scroll it into view. Placeholder text is selected, so
// the first keystroke replaces it instead of appending to it.
export function focusNew(el) {
  if (!el) return;
  el.focus();
  if (el.select) try { el.select(); } catch (e) {}
  if (el.scrollIntoView) try { el.scrollIntoView({ block: "nearest" }); } catch (e) {}
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
  document.body.classList.remove("no-nav");
  // Closed by its own arrow: spend the entry it pushed, so Back doesn't have to be pressed
  // twice for one screen. A no-op when the close came from Back in the first place.
  popEditor();
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
  if (!ts) return t("common.never");
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 45) return t("common.justNow");
  const m = Math.floor(s / 60); if (m < 60) return t("common.minAgo", { count: m });
  const h = Math.floor(m / 60); if (h < 24) return t("common.hoursAgo", { count: h });
  const d = Math.floor(h / 24); if (d < 30) return t("common.daysAgo", { count: d });
  const mo = Math.floor(d / 30); if (mo < 12) return t("common.monthsAgo", { count: mo });
  const y = Math.floor(mo / 12); return t("common.yearsAgo", { count: y });
}

export function toast(m) {
  const el = $("toast");
  if (!el) return;
  el.textContent = m;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2300);
}

// Sync status. In the rail it is the lamp beside the wordmark — amber when the vault is in
// step, pulsing while a sync is in flight, grey when this device is on its own. The words
// themselves are for screen readers and for the Profile screen, which has room to say them.
export function setSync(cls, text) {
  const lamp = $("syncDot");
  if (lamp) lamp.className = "brand-lamp" + (cls === "sync" ? " sync" : cls === "off" ? " off" : "");
  const dot2 = $("syncDot2");
  if (dot2) dot2.className = "syncdot " + (cls === "ok" ? "ok" : cls === "off" ? "off" : cls === "sync" ? "sync" : "");
  ["syncTxt", "syncTxt2"].forEach((id) => { const x = $(id); if (x) x.textContent = text; });
}

/* ---------- a picker we draw all of ----------
   For a choice with more options than a pair of buttons can hold. A native select would do the
   job, but its popup belongs to the platform — no stylesheet reaches inside it, and on a phone
   eleven currencies arrive as a full-height wheel. So: a button, a panel, and the keyboard
   behaviour a listbox is supposed to have.

   Takes the option list and returns a setter, so the caller never touches the markup. */
export function pickerInit(rootId, btnId, valId, panelId, options, onPick) {
  const root = $(rootId), btn = $(btnId), val = $(valId), panel = $(panelId);
  if (!root || !btn || !val || !panel) return { set: () => {} };
  let current = null, cursor = -1;

  const opts = () => [...panel.querySelectorAll(".picker-opt")];
  const draw = () => {
    panel.innerHTML = options.map((o) =>
      `<button type="button" class="picker-opt" role="option" data-val="${o}" aria-selected="${o === current}">${o}</button>`).join("");
  };
  const setCursor = (i) => {
    const list = opts(); if (!list.length) return;
    cursor = (i + list.length) % list.length;
    list.forEach((el, n) => el.classList.toggle("is-cursor", n === cursor));
    list[cursor].scrollIntoView({ block: "nearest" });
  };
  const open = () => {
    draw();
    root.setAttribute("data-open", "");
    panel.classList.remove("hide");
    btn.setAttribute("aria-expanded", "true");
    setCursor(Math.max(0, options.indexOf(current)));
  };
  const close = () => {
    root.removeAttribute("data-open");
    panel.classList.add("hide");
    btn.setAttribute("aria-expanded", "false");
    cursor = -1;
  };
  const isOpen = () => root.hasAttribute("data-open");
  const choose = (v) => { current = v; val.textContent = v; close(); btn.focus(); if (onPick) onPick(v); };

  btn.addEventListener("click", () => (isOpen() ? close() : open()));
  panel.addEventListener("click", (e) => {
    const o = e.target.closest(".picker-opt"); if (o) choose(o.getAttribute("data-val"));
  });
  // A click anywhere else is a dismissal, which is what a platform popup would do.
  document.addEventListener("pointerdown", (e) => { if (isOpen() && !root.contains(e.target)) close(); });
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) { e.preventDefault(); close(); btn.focus(); return; }
    if (!isOpen()) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor(cursor + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor(cursor - 1); }
    else if (e.key === "Home") { e.preventDefault(); setCursor(0); }
    else if (e.key === "End") { e.preventDefault(); setCursor(options.length - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); const el = opts()[cursor]; if (el) choose(el.getAttribute("data-val")); }
  });

  return { set: (v) => { current = v; val.textContent = v; if (isOpen()) draw(); } };
}
