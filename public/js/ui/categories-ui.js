// Shared markup for the grouped-category editor used by both the net-worth year editor and the
// budget tab: the category <select> and the collapsible category section header (colour dot,
// inline-rename name, subtotal, delete ×). The cards/rows inside a section are caller-specific, so
// they're passed in as `cardsHTML`. Event wiring stays with each caller (their handlers differ).
import { esc } from "../domain/money.js";

// A category picker: the given category names plus a leading "no category" option.
export function categorySelectHTML(cls, dataAttr, current, names) {
  const opts = (names || []).map((g) => `<option ${g === current ? "selected" : ""}>${esc(g)}</option>`).join("");
  return `<select class="${cls}" ${dataAttr} title="Category"><option value="" ${!current ? "selected" : ""}>— no category —</option>${opts}</select>`;
}

// One category section: header (dot + rename input + subtotal + delete ×) wrapping its cards/rows.
export function groupSectionHTML(name, color, subtotalHTML, cardsHTML, emptyHint = "Empty — set an item's category to this.") {
  return `<div class="grp"><div class="grphead">`
    + `<span class="dot" style="background:${color}"></span>`
    + `<input class="grpname" data-grp="${esc(name)}" value="${esc(name)}" title="Category name" placeholder="Category name">`
    + `<span class="grpsub num" data-grpsub="${esc(name)}">${subtotalHTML}</span>`
    + `<button class="grpdel" data-grpdel="${esc(name)}" title="Delete category">×</button></div>`
    + `<div class="grpcards">${cardsHTML || `<div class="exhint">${esc(emptyHint)}</div>`}</div></div>`;
}
