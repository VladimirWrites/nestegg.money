// Shared markup for the grouped-category editor used by both the net-worth year editor and the
// budget tab: the category <select> and the collapsible category section header (colour dot,
// inline-rename name, subtotal, delete ×). The cards/rows inside a section are caller-specific, so
// they're passed in as `cardsHTML`. Event wiring stays with each caller (their handlers differ).
import { esc } from "../domain/money.js";
import { t } from "../i18n.js";

// A category picker: the given category names plus a leading "no category" option.
export function categorySelectHTML(cls, dataAttr, current, names) {
  /* An explicit value. Without one an option's value is its text with whitespace collapsed,
     so a category whose name contains two spaces came back as a different string and
     stranded every row tagged with it in a section nothing matched. */
  const opts = (names || []).map((g) => `<option value="${esc(g)}" ${g === current ? "selected" : ""}>${esc(g)}</option>`).join("");
  return `<select class="${cls}" ${dataAttr} title="${t("common.category")}" aria-label="${t("common.category")}"><option value="" ${!current ? "selected" : ""}>${t("common.noCategory")}</option>${opts}</select>`;
}

/* One category section: header (dot + rename input + subtotal + delete ×) wrapping its cards/rows.
   The default empty hint resolves at call time, so it follows the active locale.

   The header carries a real `<h3>`, invisible but present, for two reasons. Editing mode used to
   have no headings at all — screen-reader heading navigation skipped from the tab's own title
   straight past every category, and there was nothing to announce the section by. And the only
   label on the rename field was the generic "Category name", so five fields in a row read
   identically and none of them said which category it would rename. */
export function groupSectionHTML(name, color, subtotalHTML, cardsHTML, emptyHint = t("common.emptyCategory")) {
  const hid = "grph-" + encodeURIComponent(name).replace(/%/g, "-");
  const empty = !cardsHTML ? " is-empty" : "";
  return `<div class="grp${empty}" role="group" aria-labelledby="${hid}"><div class="grphead">`
    + `<span class="dot" style="background:${color}"></span>`
    + `<h3 class="grptitle-h" id="${hid}"><span class="sr-only">${esc(name)}</span>`
    + `<input class="grpname" data-grp="${esc(name)}" value="${esc(name)}" title="${t("common.categoryName")}" aria-label="${esc(t("common.renameCategoryAria", { name }))}" placeholder="${t("common.categoryName")}"></h3>`
    + `<span class="grpsub num" data-grpsub="${esc(name)}">${subtotalHTML}</span>`
    + `<button type="button" class="grpdel" data-grpdel="${esc(name)}" title="${t("common.deleteCategory")}" aria-label="${esc(t("common.deleteCategoryAria", { name }))}">×</button></div>`
    + `<div class="grpcards">${cardsHTML || `<div class="exhint">${esc(emptyHint)}</div>`}</div></div>`;
}
