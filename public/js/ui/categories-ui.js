// Shared markup for the grouped-category editor used by both the net-worth year editor and the
// budget tab: the category <select> and the collapsible category section header (colour dot,
// inline-rename name, subtotal, delete ×). The cards/rows inside a section are caller-specific, so
// they're passed in as `cardsHTML`. Event wiring stays with each caller (their handlers differ).
import { esc } from "../domain/money.js";
import { t } from "../i18n.js";

/* A category picker: the given category names plus a leading "no category" option.

   `move` turns it from a state display into an action, for callers that already render the row
   inside its own category's card. There the picker's value is the card's name by construction,
   so it could only ever repeat the heading directly above it — a control that cannot carry
   information, drawn at the weight of one that does. In that mode the face shows a fixed verb,
   the row's current category is left out of the list (moving a row where it already is does
   nothing), and the label names the row so fourteen of them are not all called "Category".

   An explicit option value throughout. Without one an option's value is its text with
   whitespace collapsed, so a category whose name contains two spaces came back as a different
   string and stranded every row tagged with it in a section nothing matched. */
export function categorySelectHTML(cls, dataAttr, current, names, opts) {
  const o = opts || {};
  /* An expense with no category stores "", a loan with none has no entry at all. Compared
     untouched, the loan's picker listed "no category" as somewhere to move to. */
  const cur = current || "";
  const keep = (g) => !(o.move && g === cur);
  const list = (names || []).filter(keep)
    .map((g) => `<option value="${esc(g)}" ${!o.move && g === cur ? "selected" : ""}>${esc(g)}</option>`).join("");
  /* Disabled, so a reader can never land back on it, and it is not in the tab order of the
     open list. It is only ever the closed face. */
  const head = o.move ? `<option value="" selected disabled hidden>${esc(o.move)}</option>` : "";
  const none = keep("") ? `<option value="" ${!o.move && !cur ? "selected" : ""}>${t("common.noCategory")}</option>` : "";
  const label = o.label || t("common.category");
  return `<select class="${cls}" ${dataAttr} title="${esc(label)}" aria-label="${esc(label)}">${head}${none}${list}</select>`;
}

/* A DOM id for a category section's heading.

   The prefix matters: this same function renders the net-worth year editor, which stays in the
   document behind a `hide` class rather than being removed. Two screens sharing a category name
   — "Savings", "Housing" — minted the same id twice in one document, and `aria-labelledby` then
   resolved to whichever came first. `encodeURIComponent` is what keeps a name with a space, a
   quote or a bracket from producing an id that cannot be matched. */
export function groupHeadingId(prefix, name) {
  return prefix + "-grph-" + encodeURIComponent(String(name || "")).replace(/%/g, "-");
}

/* One category section: header (dot + rename input + subtotal + delete ×) wrapping its cards/rows.
   The default empty hint resolves at call time, so it follows the active locale.

   The header carries a real `<h3>`, invisible but present, for two reasons. Editing mode used to
   have no headings at all — screen-reader heading navigation skipped from the tab's own title
   straight past every category, and there was nothing to announce the section by. And the only
   label on the rename field was the generic "Category name", so five fields in a row read
   identically and none of them said which category it would rename. */
/* A trash can, for callers whose rows carry a × of their own. Two bordered × buttons of the
   same size in the same column, one of which empties a whole category and one of which deletes
   a single row, are not two weights of the same control — they are two different actions that
   had become impossible to tell apart. */
export const TRASH_SVG = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/></svg>`;

export function groupSectionHTML(name, color, subtotalHTML, cardsHTML, emptyHint = t("common.emptyCategory"), idPrefix = "grp", delGlyph = "×", isEmpty = null) {
  const hid = groupHeadingId(idPrefix, name);
  /* Stated by the caller when it knows, because "has no markup" stopped meaning "has nothing
     in it" the moment a caller began appending a control of its own to every card. */
  const empty = (isEmpty == null ? !cardsHTML : isEmpty) ? " is-empty" : "";
  return `<div class="grp${empty}" role="group" aria-labelledby="${hid}"><div class="grphead">`
    + `<span class="dot" style="background:${color}"></span>`
    + `<h3 class="grptitle-h" id="${hid}"><span class="sr-only">${esc(name)}</span>`
    + `<input class="grpname" data-grp="${esc(name)}" value="${esc(name)}" title="${t("common.categoryName")}" aria-label="${esc(t("common.renameCategoryAria", { name }))}" placeholder="${t("common.categoryName")}"></h3>`
    + `<span class="grpsub num" data-grpsub="${esc(name)}">${subtotalHTML}</span>`
    + `<button type="button" class="grpdel" data-grpdel="${esc(name)}" title="${t("common.deleteCategory")}" aria-label="${esc(t("common.deleteCategoryAria", { name }))}">${delGlyph}</button></div>`
    + `<div class="grpcards">${cardsHTML || `<div class="exhint">${esc(emptyHint)}</div>`}</div></div>`;
}
