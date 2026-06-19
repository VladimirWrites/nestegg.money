// Reusable chart primitives shared by the net-worth charts and the salary chart:
// the colour palette, axis/grid helpers, and the titled-frame PNG export.
import { shortK, esc } from "../domain/money.js";
import { toast, downloadBlob } from "./dom.js";

export const FC_AMBER = "#ffb000";
export const FC_GREEN = "#3ad17a";
// Structural chart colours: gridlines, axis labels, ink, background, the net/depleted red.
export const CH_GRID = "#26262a";
export const CH_AXIS = "#8a867c";
export const CH_INK = "#e8e4d8";
export const CH_BG = "#0a0a0b";
export const CH_RED = "#ff4d6d";

// Round a value up to a "nice" axis maximum (1/2/2.5/5 x 10^n).
export function niceCeil(v) {
  const p = Math.pow(10, Math.floor(Math.log10(v || 1)));
  const f = (v || 1) / p;
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return n * p;
}

// Fit a chart to its container's width; height scales gently with width (bounded).
export function chartDims(svg, fallbackW) {
  const c = svg && svg.parentElement;
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
    s += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${CH_GRID}" stroke-width="1"/>`;
    s += `<text x="${padL - 8}" y="${y + 3}" text-anchor="end" font-family="ui-monospace,monospace" font-size="9" fill="${CH_AXIS}">${sym}${shortK(val)}</text>`;
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
    s += `<text x="${x + fs + 9}" y="${yy + fs - 1}" font-family="ui-monospace,Menlo,monospace" font-size="${fs}" fill="${CH_INK}">${esc(it.label)}</text>`;
    const w = fs + 9 + it.label.length * fs * 0.62; if (w > maxW) maxW = w;
  });
  return { svg: s, height: items.length * rowH, width: maxW };
}

export function frameSVG(title, inner, innerW, innerH, leg, pad, titleH) {
  const footH = 34, W = Math.max(innerW + pad * 2, (leg ? leg.width : 0) + pad * 2, 520), H = titleH + innerH + 16 + (leg ? leg.height : 0) + footH, dx = (W - innerW) / 2;
  return {
    W, H,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
      `<rect width="${W}" height="${H}" fill="${CH_BG}"/>` +
      `<text x="${pad}" y="34" font-family="ui-monospace,Menlo,monospace" font-size="20" font-weight="700" fill="${FC_AMBER}">${esc(title)}</text>` +
      `<g transform="translate(${dx},${titleH})">${inner}</g>` + (leg ? leg.svg : "") +
      `<text x="${W - pad}" y="${H - 13}" text-anchor="end" font-family="ui-monospace,Menlo,monospace" font-size="12" fill="${CH_AXIS}">nestegg.money</text></svg>`,
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
