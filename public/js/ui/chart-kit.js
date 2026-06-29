// Reusable chart primitives shared by the net-worth charts and the salary chart:
// the colour palette, axis/grid helpers, and the titled-frame PNG export.
import { shortK, esc } from "../domain/money.js";
import { toast, downloadBlob } from "./dom.js";

// Chart colours, read from the active theme's CSS variables. Mutated by refreshPalette()
// before each render so a theme switch recolours the SVG charts.
export const C = { amber: "#ffb000", green: "#3ad17a", grid: "#26262a", axis: "#8a867c", ink: "#e8e4d8", bg: "#0a0a0b", red: "#ff4d6d" };
const cssVar = (n, fb) => { try { const v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v || fb; } catch (e) { return fb; } };
export function refreshPalette() {
  C.amber = cssVar("--amber", C.amber); C.green = cssVar("--green", C.green);
  C.grid = cssVar("--line", C.grid); C.axis = cssVar("--muted", C.axis);
  C.ink = cssVar("--ink", C.ink); C.bg = cssVar("--bg", C.bg); C.red = cssVar("--red", C.red);
}

// Round a value up to a "nice" axis maximum (1/2/2.5/5 x 10^n).
export function niceCeil(v) {
  const p = Math.pow(10, Math.floor(Math.log10(v || 1)));
  const f = (v || 1) / p;
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return n * p;
}

// Fit a chart to its container's width; height scales gently with width (bounded).
export function chartDims(svg, fallbackW) {
  // measure the scroll viewport, not the immediate parent (which may be a shrink-to-fit
  // .chartwrap added for tooltip positioning).
  const c = svg && (svg.closest(".histscroll") || svg.parentElement);
  let w = c ? c.clientWidth : 0;
  if (!w || w < 80) w = fallbackW || 680;
  w = Math.max(280, Math.floor(w));
  return { W: w, H: Math.round(Math.max(220, Math.min(w * 0.42, 360))) };
}

// Horizontal gridlines + left y-axis money labels (5 ticks).
export function yGrid(W, padL, padR, padT, plotH, nm, sym) {
  let s = "";
  for (let i = 0; i <= 5; i++) {
    const val = (nm * i) / 5;
    const y = padT + plotH - (val / nm) * plotH;
    s += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${C.grid}" stroke-width="1"/>`;
    s += `<text x="${padL - 8}" y="${y + 3}" text-anchor="end" font-family="ui-monospace,monospace" font-size="9" fill="${C.axis}">${sym}${shortK(val)}</text>`;
  }
  return s;
}

// Append a centred SVG <text> node (used for donut centre labels).
export function txt(svg, x, y, t, sz, fill, ls, w) {
  const e = document.createElementNS("http://www.w3.org/2000/svg", "text");
  e.setAttribute("x", x); e.setAttribute("y", y); e.setAttribute("text-anchor", "middle"); e.setAttribute("font-family", "ui-monospace,monospace"); e.setAttribute("font-size", sz);
  if (ls) e.setAttribute("letter-spacing", ls); if (w) e.setAttribute("font-weight", w);
  e.setAttribute("fill", fill); e.textContent = t; svg.appendChild(e);
}

/* ---- image export: wrap a chart's SVG in a titled, branded frame and save as PNG ---- */
export function legendSVG(items, x, y, fs) {
  const rowH = fs + 10;
  let s = "", maxW = 0;
  items.forEach((it, i) => {
    const yy = y + i * rowH;
    s += `<rect x="${x}" y="${yy}" width="${fs}" height="${fs}" rx="2" fill="${it.color}"/>`;
    s += `<text x="${x + fs + 9}" y="${yy + fs - 1}" font-family="ui-monospace,Menlo,monospace" font-size="${fs}" fill="${C.ink}">${esc(it.label)}</text>`;
    const w = fs + 9 + it.label.length * fs * 0.62; if (w > maxW) maxW = w;
  });
  return { svg: s, height: items.length * rowH, width: maxW };
}

// Draw a doughnut's arc wedges into `svg` from segments [{v, color}]. Each becomes a `.dwedge`
// path carrying data-mx/data-my (its midpoint, for tooltip anchoring); `tag(path, seg, i)` lets the
// caller stamp its own identity attribute (data-name / data-idx). Returns the total (0 → nothing
// drawn). The centre label and legend stay with the caller — only the shared arc geometry lives here.
export function donutArcs(svg, segs, tag) {
  const cx = 120, cy = 120, r = 82, sw = 30;
  const total = segs.reduce((acc, s) => acc + s.v, 0);
  if (total <= 0) return 0;
  let a = -Math.PI / 2;
  segs.forEach((seg, i) => {
    const f = seg.v / total, a2 = a + f * Math.PI * 2, lg = f > 0.5 ? 1 : 0, am = (a + a2) / 2;
    const x1 = cx + r * Math.cos(a), y1 = cy + r * Math.sin(a), x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", `M ${x1} ${y1} A ${r} ${r} 0 ${lg} 1 ${x2} ${y2}`);
    p.setAttribute("fill", "none"); p.setAttribute("stroke", seg.color); p.setAttribute("stroke-width", sw);
    p.setAttribute("pathLength", "1"); p.setAttribute("class", "dwedge");
    p.setAttribute("data-mx", (cx + r * Math.cos(am)).toFixed(1)); p.setAttribute("data-my", (cy + r * Math.sin(am)).toFixed(1));
    if (tag) tag(p, seg, i);
    svg.appendChild(p);
    a = a2;
  });
  return total;
}

export function frameSVG(title, inner, innerW, innerH, leg, pad, titleH) {
  const footH = 34, W = Math.max(innerW + pad * 2, (leg ? leg.width : 0) + pad * 2, 520), H = titleH + innerH + 16 + (leg ? leg.height : 0) + footH, dx = (W - innerW) / 2;
  return {
    W, H,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
      `<rect width="${W}" height="${H}" fill="${C.bg}"/>` +
      `<text x="${pad}" y="34" font-family="ui-monospace,Menlo,monospace" font-size="20" font-weight="700" fill="${C.amber}">${esc(title)}</text>` +
      `<g transform="translate(${dx},${titleH})">${inner}</g>` + (leg ? leg.svg : "") +
      `<text x="${W - pad}" y="${H - 13}" text-anchor="end" font-family="ui-monospace,Menlo,monospace" font-size="12" fill="${C.axis}">nestegg.money</text></svg>`,
  };
}

export function svgToPng(svgString, w, h, scale, filename) {
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" }), url = URL.createObjectURL(blob), img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas"); c.width = Math.round(w * scale); c.height = Math.round(h * scale); const ctx = c.getContext("2d"); ctx.scale(scale, scale); ctx.drawImage(img, 0, 0); URL.revokeObjectURL(url);
    c.toBlob((b) => { if (!b) { toast("Could not save image"); return; } downloadBlob(b, filename); toast("Image saved"); }, "image/png");
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast("Could not render image"); };
  img.src = url;
}

// Wrap a chart's current SVG in the titled, branded frame and save it as a 2x PNG. The caller
// supplies the source <svg>, a title, legend items, the inner content size, and a filename — the
// legend layout, framing, and rasterization (duplicated across every chart before) live here.
export function exportChart({ src, title, items, width, height, filename, pad = 24, titleH = 52 }) {
  const leg = legendSVG(items, pad, titleH + height + 16, 13);
  const f = frameSVG(title, src.innerHTML, width, height, leg, pad, titleH);
  svgToPng(f.svg, f.W, f.H, 2, filename);
}

// When a chart overflows its .histscroll container, jump to the right edge (newest data).
export function scrollToNewest(svg) {
  const sc = svg && svg.closest(".histscroll");
  if (sc) requestAnimationFrame(() => { try { sc.scrollLeft = sc.scrollWidth; } catch (e) {} });
}

// Place a tooltip flag centred above point (x,y), clamped within [0,maxW], flipping below
// the point when it would overflow the top. Shared by the net-worth, donut, and salary tips.
export function positionTip(tip, x, y, maxW) {
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  const left = Math.max(2, Math.min(x - tw / 2, maxW - tw - 2));
  let top = y - th - 12; if (top < 2) top = y + 14;
  tip.style.left = left + "px"; tip.style.top = top + "px";
}
