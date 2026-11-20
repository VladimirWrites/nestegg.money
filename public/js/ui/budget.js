// Budget tab: a rough monthly "what's left" view. Income comes from your latest salary month
// (auto, with an override), loan payments are pulled from your loans, and you enter recurring
// expenses as a short list. All math lives in domain/budget.js; this only renders and edits state.
import { $, toast, debounce, focusNew } from "./dom.js";
import { state } from "../domain/store.js";
import { nid } from "../domain/ids.js";
import { PALETTE } from "../domain/constants.js";
import { money, esc, parseNum, fmtPlain, fmtLocale } from "../domain/money.js";
import { budgetSummary, salaryIncome, budgetCategoryNames, addBudgetCategory, renameBudgetCategory, removeBudgetCategory, budgetCategoryUsage, UNCATEGORIZED } from "../domain/budget.js";
import { C, refreshPalette, donutArcs, exportChart, positionTip } from "./chart-kit.js";
import { categorySelectHTML, groupSectionHTML, groupHeadingId, TRASH_SVG } from "./categories-ui.js";
import { scheduleSync } from "../io/storage.js";
import { t } from "../i18n.js";

// Cache the latest segments so the tooltip and the PNG export can read them.
let _segs = [];

// Read-only mode (share viewer): plain text rows instead of inputs/selects, no empty categories,
// no override row, no add/delete controls. Mirrors setEntriesReadOnly in networth.js.
let RO = false;
export const setBudgetReadOnly = (v) => { RO = !!v; };

/* Budget used to be an edit form that happened to show your figures: every outgoing was a
 * name box, a category select and an amount box, permanently open, about 2,000px of controls
 * on a phone. Reading what you spend and changing what you spend are different jobs, and the
 * first one is why people open this screen.
 *
 * The read rows already existed for shared snapshots (RO). This puts the same rows in front
 * of the owner too, behind an Edit button — nothing is hidden, the figures are all still
 * there, they are just not all wearing form controls. */
let EDITING = false;
const reading = () => RO || !EDITING;

// A read-only outgoing row: just the name and the formatted amount (the category is already
// conveyed by the section the row sits in).
function roItemRow(name, amount) {
  return `<div class="bud-exp ro"><span class="bud-loan-name">${esc(name)}</span><span class="bud-loan-amt">${money(amount)}</span></div>`;
}

/* Give focus back to the equivalent control after a re-render. Every edit on this screen
   rebuilds the whole body, which destroys whatever the reader had just used.

   Takes several selectors and uses the first that resolves, because the natural landing place
   after a delete is the row that took the deleted one's place — and there may not be one. And
   it scrolls that control into view: sending focus to a control three screens down moved the
   caret somewhere the reader could not see, which on a phone is indistinguishable from the
   page having jumped on its own. */
function budRefocus(...selectors) {
  setTimeout(() => {
    let el = null;
    for (const sel of selectors) { if (sel) { el = document.querySelector(sel); if (el && !el.closest("[inert]")) break; el = null; } }
    if (!el) return;
    try { el.focus({ preventScroll: true }); } catch (e) {}
    try { el.scrollIntoView({ block: "nearest", behavior: "instant" }); } catch (e) {}
  }, 0);
}

/* Two category names a reader cannot tell apart are the same name.
 *
 * The check was byte-exact, so "food" beside "Food" passed, and a "Café" pasted from Finder
 * (decomposed) passed beside a typed one (composed) — two cards, two wedges, two legend rows
 * that look identical. The domain also trims when it buckets and the interface did not, so
 * "Food " and "Food" rendered as two sections for one wedge. */
const catKey = (n) => String(n || "").normalize("NFC").trim().toLowerCase();
const sameCat = (a, b) => catKey(a) === catKey(b);

/* Rename a category on screen without rebuilding the screen: the header's own hooks, the
   heading a screen reader announces the card by, and the matching <option> in every row's
   category picker — which is what a full render used to redo. */
function relabelCategory(grp, was, nw) {
  if (!grp) return;
  const hid = groupHeadingId("bud", nw);
  const inp = grp.querySelector("input.grpname");
  if (inp) { inp.dataset.grp = nw; if (inp.value !== nw) inp.value = nw; inp.setAttribute("aria-label", t("common.renameCategoryAria", { name: nw })); }
  const h = grp.querySelector(".grptitle-h"); if (h) h.id = hid;
  grp.setAttribute("aria-labelledby", hid);
  const sr = grp.querySelector(".grptitle-h .sr-only"); if (sr) sr.textContent = nw;
  const sub = grp.querySelector("[data-grpsub]"); if (sub) sub.setAttribute("data-grpsub", nw);
  const del = grp.querySelector("[data-grpdel]");
  if (del) { del.dataset.grpdel = nw; del.setAttribute("aria-label", t("common.deleteCategoryAria", { name: nw })); }
  $("budItems").querySelectorAll("select.bud-exp-cat option, select.bud-loan-cat option").forEach((o) => {
    if (o.value === was) { o.value = nw; o.textContent = nw; }
  });
}

// A read-only category section: static header (no rename input, no delete ×).
function roGroupSection(name, color, subtotalHTML, cardsHTML, subKey, uncat) {
  /* A category with nothing in it rendered its header and then an empty 30px strip below —
     a card with a floor and no contents. With nothing to list there is nothing to open. */
  const body = cardsHTML && cardsHTML.trim() ? `<div class="grpcards">${cardsHTML}</div>` : "";
  /* `grptitle`, not `grpname`: the static label shared a class with the rename input, so a
     rule written for field edges painted a text input's underline across a word you cannot
     type in — a hairline from the name to the subtotal on every category, which also read as
     a second divider. A different class is what stops an input rule reaching it again. */
  /* Named, like the editing card is. An unnamed <section> is not exposed as a region at all,
     so the same card announced as a group while you were editing it and as nothing while you
     were reading it — which is the mode a reader is in most of the time. */
  const hid = groupHeadingId("bud", name);
  return `<section class="grp grp-ro${uncat ? " grp-uncat" : ""}${body ? "" : " is-empty"}" role="group" aria-labelledby="${hid}">`
    + `<div class="grphead"><span class="dot" style="background:${color}" aria-hidden="true"></span>`
    + `<h3 class="grptitle" id="${hid}">${esc(name)}</h3>`
    /* `refreshTotals` only rewrites `[data-grpsub]`, which this header did not carry — so while
       you typed in an untagged row (where "+ Add expense" always puts it) the ring, the grand
       total and the hero all moved and the card's own total above them did not. The key cannot
       be the sentinel itself: it starts with U+0000, which the parser turns into U+FFFD, so the
       attribute would never match what the domain stores. */
    + `<span class="grpsub num"${subKey == null ? "" : ` data-grpsub="${esc(subKey)}"`}${uncat ? " data-grpuncat" : ""}>${subtotalHTML}</span></div>${body}</section>`;
}

// Where the income goes, at the top level: one wedge per category (expenses + loans grouped by the
// domain) plus the leftover. Each carries its `items` so the tooltip can break it down on hover.
// The "Uncategorized" sentinel comes from domain/budget.js (which stays i18n-free), so it's
// mapped to the active locale here, at the UI boundary. Real category names are user data.
/* "0%" for a real outgoing is wrong rather than merely rounded: Health is €45 of this
   budget and the legend said it was none of it. */
/* Every money figure on this screen goes through Intl and every percentage was built by
   gluing "%" to a number — so a German reader got "17%" beside "9.058 €", where de-DE writes
   a narrow no-break space before the sign. And `(-0.2).toFixed(0)` is "-0", so a €10 shortfall
   printed "savings rate -0%" with an ASCII hyphen under a hero using a real minus. */
const pct = (p) => new Intl.NumberFormat(fmtLocale(), { style: "percent", maximumFractionDigits: 0, signDisplay: "negative" }).format(p / 100);
const pctOf = (v, total) => {
  if (!(total > 0) || !(v > 0)) return pct(0);
  const p = (v / total) * 100;
  return p < 0.5 ? "<" + pct(1) : pct(p);
};
const dispCat = (name) => (name === UNCATEGORIZED ? t("budget.uncategorized") : name);

function breakdownSegments(s) {
  /* What is left is not a category of spending, and green is this palette's documented
     colour for it — "money that grew: gains, what's left over, a goal reached". It was moved
     to a neutral grey because the third category was painted the identical green and a 3%
     sliver could not be told from a 17% arc. So the categories give that green up instead:
     the screen is named after the leftover, and it was the dullest wedge on it. */
  const left = LEFTOVER_HEX;
  const order = catOrder(bud());
  const segs = [];
  /* Same order as the cards below. The domain buckets in the order it meets the items, so a
     category whose first item is a loan, and the untagged bucket in particular, sat in a
     different place in the key than in the list it is a key to. */
  const rank = (n) => (n === UNCATEGORIZED ? -1 : (order.indexOf(n) + 1 || 1e6));
  [...(s.categories || [])].sort((a, c) => rank(a.category) - rank(c.category))
    .forEach((c) => { if (c.total > 0) segs.push({ name: dispCat(c.category), v: c.total, color: colorFor(c.category, order), items: c.items }); });
  if (s.leftover > 0) segs.push({ name: t("budget.leftOver"), v: s.leftover, color: left, items: [] });
  return segs;
}

/* A category <select> over the budget's own categories, in "move" mode: every row on this
   screen is drawn inside the card for the category it is in, so the picker's value was always
   the heading above it. In a card called Food the word "Food" appeared once as the heading and
   again under every row — on a phone, where the picker wraps to a line of its own, two of a
   two-expense card's five lines were the word Food. */
function catSelect(cls, dataAttr, current, itemName) {
  return categorySelectHTML(cls, dataAttr, current, budgetCategoryNames(), {
    move: current ? t("budget.moveTo") : t("budget.chooseCat"),
    label: t("budget.moveAria", { name: itemName || t("budget.thisExpense") }),
  });
}

const NS = "http://www.w3.org/2000/svg";

// Draw the breakdown as an SVG doughnut plus a legend. animate=true plays the entrance draw
// (only on tab entry / structural change, not on every keystroke).
function drawBudgetDonut(s, animate = false) {
  const svg = $("budgetDonut"); if (!svg) return;
  refreshPalette();
  svg.innerHTML = "";
  const segs = breakdownSegments(s);
  _segs = segs;
  const total = donutArcs(svg, segs, (p, seg, i) => p.setAttribute("data-idx", String(i)));
  if (total > 0) {
    // Say which number this is. A bare figure in the middle of a ring of outgoings reads as the
    // outgoings total, which is the one thing it isn't.
    /* Say what the ring actually adds up to. In surplus the wedges are the categories plus the
       leftover, so they sum to income and "INCOME" is the honest centre. Overspend and the
       leftover wedge is dropped (`breakdownSegments`), so the ring sums to the outgoings and
       every percentage beside it is a share of the outgoings — while the centre went on saying
       INCOME in red. With €5,000 coming in and €7,480 going out, Housing read "81%" of a figure
       that was not its base. */
    const over = s.leftover < 0;
    const t1 = document.createElementNS(NS, "text"); t1.setAttribute("x", 120); t1.setAttribute("y", 114); t1.setAttribute("text-anchor", "middle"); t1.setAttribute("font-size", "10"); t1.setAttribute("letter-spacing", "2"); t1.setAttribute("fill", C.axis); t1.textContent = (over ? t("budget.outgoings") : t("budget.income")).toUpperCase();
    svg.appendChild(t1);
    const t2 = document.createElementNS(NS, "text"); t2.setAttribute("x", 120); t2.setAttribute("y", 136); t2.setAttribute("text-anchor", "middle"); t2.setAttribute("font-size", "17"); t2.setAttribute("font-weight", "600"); t2.setAttribute("font-family", "ui-monospace,SFMono-Regular,Menlo,monospace"); t2.setAttribute("fill", over ? C.red : C.ink); t2.textContent = money(over ? s.fixed + s.expenses : s.income);
    svg.appendChild(t2);
  }
  svg.classList.toggle("anim", !!animate && total > 0);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", total > 0 ? t("budget.ariaList", { list: segs.map((x) => x.name + " " + pctOf(x.v, total)).join(", ") }) : t("budget.ariaEmpty"));
  const leg = $("budgetLegend"); if (leg) {
    leg.innerHTML = segs.map((x) => `<div class="legrow"><span class="swatch" style="background:${x.color}"></span><span>${esc(x.name)}</span><span class="pct">${pctOf(x.v, total)}</span><span class="amt num">${money(x.v)}</span></div>`).join("");
  }
}

// Hover/tap a wedge to break it down (the expenses in a category, or each loan). Reads the live
// segment by index so it survives re-renders.
function budgetTipShow(path) {
  const tip = $("budgetTip"); if (!tip) return;
  const seg = _segs[+path.getAttribute("data-idx")]; if (!seg) return;
  const total = _segs.reduce((a, x) => a + x.v, 0);
  const pct = pctOf(seg.v, total);
  let html = `<div class="tiph">${esc(seg.name)} <span class="tippct">${pct}</span></div>`;
  const items = (seg.items || []).slice().sort((a, b) => b.amount - a.amount);
  if (items.length) {
    items.forEach((it) => { html += `<div class="tipr"><span class="tipn">${esc(it.name)}</span><span class="tipv">${money(it.amount)}</span></div>`; });
    if (items.length > 1) html += `<div class="tipnet">${t("common.total")} <b>${money(seg.v)}</b></div>`;
  } else {
    html += `<div class="tipr"><span class="tipn">&nbsp;</span><span class="tipv">${money(seg.v)}</span></div>`;
  }
  tip.innerHTML = html;
  tip.classList.remove("hide");
  positionTip(tip, +path.getAttribute("data-mx"), +path.getAttribute("data-my"), 240);
}
// Redrawing the SVG doughnut on every keystroke is wasteful — debounce it (the numeric totals
// still update immediately in refreshTotals). Mirrors the salary chart's debounced redraw.
const drawDonutSoon = debounce((s) => drawBudgetDonut(s), 100);

function budgetTipHide() { const t = $("budgetTip"); if (t) t.classList.add("hide"); }
let _tipWired = false;
// Delegate from document (stable) so the listeners survive every re-render — renderBudget()
// rebuilds the SVG element, which would orphan listeners bound directly to it.
function wireBudgetTip() {
  if (_tipWired) return;
  _tipWired = true;
  const wedge = (e) => { const p = e.target.closest && e.target.closest(".dwedge"); return p && p.closest("#budgetDonut") ? p : null; };
  document.addEventListener("mouseover", (e) => { const p = wedge(e); if (p) budgetTipShow(p); });
  document.addEventListener("mouseout", (e) => { if (wedge(e)) budgetTipHide(); });
  document.addEventListener("click", (e) => { const p = wedge(e); if (p) budgetTipShow(p); else if (e.target.closest("#budgetDonut")) budgetTipHide(); });
  document.addEventListener("pointerdown", (e) => { if (!e.target.closest("#budgetDonut")) budgetTipHide(); });
}

// Export the doughnut as a framed PNG, like the other charts.
function downloadBudgetDonut() {
  const src = $("budgetDonut");
  if (!src || !_segs.length) { toast(t("common.nothingToSave")); return; }
  const total = _segs.reduce((a, x) => a + x.v, 0);
  const items = _segs.map((x) => ({ color: x.color, label: x.name + "   " + pctOf(x.v, total) + "   " + money(x.v) }));
  exportChart({ src, title: t("budget.expTitle"), items, width: 240, height: 240, filename: "nestegg-budget.png" });
}

const bud = () => {
  const b = (state.budget || (state.budget = { incomeOverride: null, expenses: [], loanCats: {}, categories: [] }));
  if (!b.loanCats) b.loanCats = {};
  if (!b.expenses) b.expenses = [];
  if (!b.categories) b.categories = [];
  return b;
};

// Update only the live totals (leftover, savings rate, income, expense total) without rebuilding
// the rows — so an input keeps focus and its caret while you type.
function refreshTotals() {
  const s = budgetSummary();
  const lo = $("budLeftover"), sv = $("budSavings"), inc = $("budIncome"), ot = $("budOutTotal"), card = $("budCard");
  if (inc) inc.textContent = money(s.income);
  if (ot) ot.textContent = money(s.fixed + s.expenses);
  if (lo) lo.textContent = money(s.leftover < 0 ? -s.leftover : s.leftover);
  const lk = $("budLeftK");
  if (lk) lk.textContent = s.leftover < 0 ? t("budget.shortPerMonth") : t("budget.leftPerMonth");
  if (sv) sv.textContent = s.savingsRatePct == null ? "—" : pct(s.savingsRatePct);
  if (card) card.classList.toggle("neg", s.leftover < 0);
  // live category subtotals (no row rebuild → focus kept while typing an amount)
  /* Scoped. Document-wide, this reached the net worth year editor's own sections — which
     keep their markup behind a `hide` class — and rewrote their subtotals with budget
     figures, or with 0.00 for a category the budget has never heard of. */
  const outTotal = ringTotal(s);
  $("budItems").querySelectorAll("[data-grpsub]").forEach((el) => {
    /* A flag, not a magic value. Keyed on the string "__uncategorized__", a category a reader
       had actually named that would have had its subtotal overwritten with the untagged total
       on every keystroke — the very collision the domain's NUL sentinel exists to prevent. */
    const key = el.hasAttribute("data-grpuncat") ? UNCATEGORIZED : el.getAttribute("data-grpsub");
    const c = s.categories.find((x) => x.category === key);
    const amt = el.querySelector(".grpamt"), pc = el.querySelector(".grppct");
    if (amt) amt.textContent = money(c ? c.total : 0); else el.textContent = money(c ? c.total : 0);
    if (pc) pc.textContent = pctOf(c ? c.total : 0, outTotal);
  });
  const ub = $("budUseSalary");
  if (ub) ub.classList.toggle("hide", !(state.budget && state.budget.incomeOverride != null));
  drawDonutSoon(s);
}

function expenseRow(e) {
  if (reading()) return roItemRow(e.name || t("budget.expense"), +e.amount || 0);
  return `<div class="bud-exp" data-id="${e.id}" role="group" aria-label="${esc(e.name || t("budget.thisExpense"))}">
    <input class="bud-exp-name" data-id="${e.id}" type="text" value="${esc(e.name || "")}" placeholder="${t("budget.expense")}" aria-label="${t("budget.expenseName")}">
    ${catSelect("bud-exp-cat", `data-id="${e.id}"`, e.group, e.name)}
    <input class="bud-exp-amt num" data-id="${e.id}" type="text" inputmode="decimal" value="${e.amount ? fmtPlain(e.amount) : ""}" placeholder="0" aria-label="${t("budget.monthlyAmount")}">
    <button type="button" class="bud-exp-del" data-id="${e.id}" title="${t("common.remove")}" aria-label="${esc(t("common.removeName", { name: e.name || t("budget.thisExpense") }))}">×</button>
  </div>`;
}

// A loan row: the loan name (from your assets), a category picker, and its monthly payment (fixed).
function loanRow(l, loanCats) {
  if (reading()) return roItemRow(l.name, l.monthly);
  return `<div class="bud-exp bud-loan" data-lid="${l.id}" role="group" aria-label="${esc(l.name)}">
    <span class="bud-loan-name" title="${t("budget.loanTitle")}">${esc(l.name)}<span class="autotag">${t("budget.loanTag")}</span></span>
    ${catSelect("bud-loan-cat", `data-lid="${l.id}"`, loanCats[l.id], l.name)}
    <span class="bud-loan-amt">${money(l.monthly)}</span>
  </div>`;
}

/* Colour a category to match its doughnut wedge — through the same filtered palette the
   wedges use, or the legend and the ring disagree about which colour is whose. */
/* A fixed index, not a themed comparison.
 *
 * This filtered PALETTE against `C.green`, which is rebound per theme — so in dark it removed
 * an entry and in light it removed nothing. The palette was eleven long in one theme and
 * twelve in the other, every category from the third onward changed colour between themes,
 * and in light a spending category was painted the very green that "Left over" uses, which
 * is the collision this filter exists to prevent. */
const LEFTOVER_HEX = "#3ad17a";
/* Green is the documented colour for "what's left", and #ffb000 is the interface's own accent
   — the Done button, the hero figure, the active tab — so a category painted it read as a
   control. Both are kept out of the categories' palette. */
const ACCENT_HEX = "#ffb000";
const budgetPalette = () => PALETTE.filter((c) => {
  const h = c.toLowerCase();
  return h !== LEFTOVER_HEX && h !== ACCENT_HEX;
});

/* Every category this budget knows of, in a stable order: the stored list first, then any name
   that only an expense or a loan uses. Colour is keyed on a position in here.

   It used to be keyed on a position in `summary.categories`, which the domain builds by walking
   the items and skipping anything that sums to zero. So an empty category had no index and wore
   the grey "no wedge" dot — and the moment you typed its first amount it took an index, the ring
   gave it a wedge, and every category after it in the list shifted one colour along. The dots are
   only repainted by a full render and the ring redraws on every keystroke, so for the rest of that
   edit the card dots and the wedges disagreed about which colour belonged to whom. */
function catOrder(b) {
  const order = [...((b && b.categories) || [])];
  ((b && b.expenses) || []).forEach((e) => { if (e.group && order.indexOf(e.group) < 0) order.push(e.group); });
  Object.values((b && b.loanCats) || {}).forEach((g) => { if (g && order.indexOf(g) < 0) order.push(g); });
  return order;
}
/* A literal, not `var(--dim)`: the PNG export rasterises these colours onto a canvas, which
   cannot resolve a custom property — the wedge would come out transparent. */
const UNCAT_HEX = "#6b7280";
function colorFor(name, order) {
  if (name === UNCATEGORIZED) return UNCAT_HEX;
  const i = (order || []).indexOf(name);
  const pal = budgetPalette();
  return i >= 0 ? pal[i % pal.length] : "var(--dim)";
}

/* A card's own share of the outgoings, beside its total. This is the one column the legend
   had that the cards did not — the swatch is the card's dot and the same hex, the name is its
   heading, the figure is its subtotal — so with the percentage here the legend has nothing
   left to say on a phone, where it was ~450px of restating the block directly beneath it. */
const subWithPct = (sub, total) =>
  `<span class="grppct">${pctOf(sub, total)}</span><span class="grpamt">${money(sub)}</span>`;
/* The same base the ring and its key divide by. In surplus the wedges are the categories plus
   the leftover and sum to income; overspend and the leftover wedge is dropped, so they sum to
   the outgoings. Dividing the cards by the outgoings in both cases put two bases on one
   screen — "Leisure 1%" in the legend beside "Housing 81%" on a card, for one budget. */
const ringTotal = (s) => Math.max(s.income, s.fixed + s.expenses);

// The outgoings list, grouped by category exactly like the net-worth editor: ungrouped items first,
// then a section per category with an inline-rename name, its subtotal, and a delete (×).
function itemsHTML(s, b) {
  const order = [...(b.categories || [])];
  b.expenses.forEach((e) => { if (e.group && order.indexOf(e.group) < 0) order.push(e.group); });
  Object.values(b.loanCats || {}).forEach((g) => { if (g && order.indexOf(g) < 0) order.push(g); });
  const loans = s.loans || [], lc = b.loanCats || {};
  const expRow = (e) => expenseRow(e), loanRowH = (l) => loanRow(l, lc);

  const palOrder = catOrder(b);
  const outTot = ringTotal(s);
  let html = "";
  const ungEx = b.expenses.filter((e) => !e.group), ungLo = loans.filter((l) => !lc[l.id]);
  /* These rows used to be dropped into a bare `.grpcards` with no card around them, no colour
     dot, no name and no subtotal — while the ring above gave them a wedge called
     "Uncategorized" and the legend gave that wedge a figure. The one block on the screen you
     could not match to the chart was the one the chart named. Same header as the rest, with
     the same words the wedge uses, and no rename or delete: it isn't a category. */
  if (ungEx.length || ungLo.length) {
    const ungSub = ungEx.reduce((a, e) => a + (+e.amount || 0), 0) + ungLo.reduce((a, l) => a + l.monthly, 0);
    /* The same colour the ring and the legend give these rows. It was grey — so the one card
       the chart names by its own words was the one card whose dot matched no wedge. */
    html += roGroupSection(t("budget.uncategorized"), UNCAT_HEX, subWithPct(ungSub, outTot),
      ungLo.map(loanRowH).join("") + ungEx.map(expRow).join(""), "", true);
  }

  order.forEach((g) => {
    const ex = b.expenses.filter((e) => e.group === g), lo = loans.filter((l) => lc[l.id] === g);
    const sub = ex.reduce((a, e) => a + (+e.amount || 0), 0) + lo.reduce((a, l) => a + l.monthly, 0);
    let cards = lo.map(loanRowH).join("") + ex.map(expRow).join("");
    if (reading() && !cards) return;   // a category with nothing in it is editor scaffolding, not data
    /* Add straight into the card you are looking at. The only way to put an expense in a
       category was the button after the whole list — about 2,300px below the top card on a
       phone — which filed the row as untagged, scrolled the page up to it, and left the
       reader to move it back down. An empty category's only content was a sentence telling
       them to go and do that. */
    if (!reading()) cards += `<button type="button" class="btn btn-sm bud-addin" data-addin="${esc(g)}">${t("budget.addToCat")}</button>`;
    html += reading() ? roGroupSection(g, colorFor(g, palOrder), subWithPct(sub, outTot), cards, g)
               : groupSectionHTML(g, colorFor(g, palOrder), subWithPct(sub, outTot), cards, undefined, "bud", TRASH_SVG);
  });
  return html;
}

export function renderBudget() {
  const host = $("budgetBody");
  if (!host) return;
  const b = bud();
  const s = budgetSummary();
  const auto = salaryIncome();

  host.innerHTML = `
    <!-- The headline card sits outside the section, exactly as the hero does on the other two
         screens. Inside it, the section's own top padding pushed the card 24px further down
         the page than Net worth's and Salary's heroes, and left its rule hard against the
         first heading instead of the same 24px below it. -->
    <div class="bud-card${s.leftover < 0 ? " neg" : ""}" id="budCard">
      <span class="k" id="budLeftK">${s.leftover < 0 ? t("budget.shortPerMonth") : t("budget.leftPerMonth")}</span>
      <span class="v" id="budLeftover">${money(s.leftover < 0 ? -s.leftover : s.leftover)}</span>
      <span class="sub">${t("budget.savingsRate")} <b id="budSavings">${s.savingsRatePct == null ? "—" : pct(s.savingsRatePct)}</b></span>
    </div>
    <section class="over sect-plain">
      <!-- No section title above the card: the screen is already called Budget and already
           says what it is for, in the bar on a phone and in the masthead on a desktop. -->
      <!-- The donut gets the same header every other panel has. Its download button used to
           live inside the chart wrapper, which left it floating under the donut aligned to
           nothing, while the identical button on every other section sits top-right beside a
           title. There was no title here to sit beside; now there is. -->
      <div class="sectitle"><h2>${t("budget.breakdown")}</h2><span class="sectools"><button class="chartdl" id="dlBudget" title="${t("net.dlChart")}" aria-label="${t("net.dlChart")}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v11"/><path d="M8 11l4 4 4-4"/><path d="M5 19h14"/></svg></button></span></div>
      <div class="bud-chart">
        <div class="bud-chart-main">
          <div class="bud-chartwrap">
            <svg id="budgetDonut" viewBox="0 0 240 240" width="240" height="240" aria-label="${t("budget.breakdown")}"></svg>
            <div id="budgetTip" class="salflag hide"></div>
          </div>
          <div class="legend" id="budgetLegend"></div>
        </div>
      </div>
    </section>

    <div class="bud-rows">
      <div class="bud-row"><span class="bud-lbl">${t("budget.income")} <span class="hint">${t("budget.latestSalary", { amount: money(auto) })}</span></span><span class="bud-val" id="budIncome">${money(s.income)}</span></div>
      ${reading() ? "" : `<div class="bud-row indent">
        <span class="bud-lbl">${t("budget.overrideIncome")}</span>
        <span class="bud-ovr">
          <button id="budUseSalary" class="bud-reset${b.incomeOverride == null ? " hide" : ""}" type="button" title="${t("budget.useSalaryAgain")}">${t("budget.useSalary")}</button>
          <input id="budOverride" class="bud-input num" type="text" inputmode="decimal" value="${b.incomeOverride == null ? "" : fmtPlain(b.incomeOverride)}" placeholder="${t("budget.autoPh", { amount: money(auto) })}" aria-label="${t("budget.overrideIncome")}">
        </span>
      </div>`}
      <!-- Two explicit cells: the title and its explanation on the left, the switch on the
           right. Written as a bare text node plus an auto margin, the title, the button and
           the whitespace between them became three anonymous flex items and the button
           settled wherever that arithmetic put it — 836px into a 1354px row. -->
      <div class="bud-exp-head"><div class="bud-exp-headtext"><h2 class="bud-exp-title">${t("budget.outgoings")}</h2>${reading() ? "" : `<span class="hint">${t("budget.outgoingsHint")}</span>`}</div>${RO ? "" : `<button type="button" class="btn btn-sm bud-editbtn${EDITING ? " btn-primary" : ""}" id="budEdit" aria-controls="budItems"><span class="btnlbl">${EDITING ? t("budget.done") : t("common.edit")}</span><span class="btnlbl btnlbl-ghost" aria-hidden="true">${EDITING ? t("common.edit") : t("budget.done")}</span></button>`}</div>
      <div id="budItems">${itemsHTML(s, b)}</div>
      <div class="bud-row total"><span class="bud-lbl">${t("budget.totalOutgoings")}</span><span class="bud-val" id="budOutTotal">${money(s.fixed + s.expenses)}</span></div>
    </div>

    ${reading() ? "" : `<div class="controls"><button class="btn btn-sm" id="budAddExp">${t("budget.addExpense")}</button><button class="btn btn-sm" id="budAddCat">${t("budget.addCategory")}</button></div>`}
  `;

  const dl = $("dlBudget"); if (dl) dl.onclick = downloadBudgetDonut;
  drawBudgetDonut(s, true);   // animate on tab entry
  wireBudgetTip();
  if (RO) return;             // read-only viewer: nothing below exists to wire

  /* The Edit switch is wired before anything else and guarded on its own: the rest of this
     function reaches for controls that exist only while editing, so anything that throws down
     there would take the one button that gets you out of read mode with it. */
  const eb = $("budEdit");
  /* The button that was pressed is inside the markup the re-render replaces, so focus fell
     to <body> and a keyboard reader was returned to the top of the page with nothing said. */
  if (eb) eb.onclick = () => {
    /* Leaving the editor throws away rows that were never filled in. "+ Add expense" pushes a
       blank one, and nothing pruned it — so a reader who pressed Add and changed their mind
       was left with a permanent "Expense €0" in a card the ring and the legend know nothing
       about, and no way to remove it without going back into the editor. */
    if (EDITING) {
      const keep = (b.expenses || []).filter((e) => (e.name || "").trim() || +e.amount > 0);
      if (keep.length !== (b.expenses || []).length) { b.expenses = keep; scheduleSync(); }
    }
    EDITING = !EDITING; renderBudget(); budRefocus("#budEdit");
    // The body is replaced wholesale, so a live region inside it can never announce.
    toast(EDITING ? t("budget.editingOn") : t("budget.editingOff"));
  };
  if (reading()) return;

  // Override income: live, no rebuild (keeps focus while typing). Empty field = use salary.
  $("budOverride").oninput = (ev) => {
    const v = ev.target.value.trim();
    /* parseNum, like every other money field in this app. A type=number input invalidates
       "5.740,50" and hands back an empty string, so a German reader retyping the figure the
       screen had just printed set it to zero, silently. */
    const got = v === "" ? null : parseNum(v);
    /* A lone "-" parses to nothing, and `|| 0` turned that into an override of zero — income
       £0, Left over minus the whole budget, and the field still showing a minus sign. */
    b.incomeOverride = got == null ? null : Math.max(0, got);
    if (got != null && got < 0) ev.target.value = fmtPlain(b.incomeOverride);
    scheduleSync(); refreshTotals();
  };
  // Explicit "use salary": clear the override and revert the field to auto, in place.
  $("budUseSalary").onclick = () => {
    b.incomeOverride = null;
    const inp = $("budOverride"); if (inp) inp.value = "";
    scheduleSync(); refreshTotals();
  };

  // Expense edits: name and amount update in place (no rebuild → caret kept); totals refresh live.
  host.querySelectorAll(".bud-exp-name").forEach((el) => {
    el.oninput = (ev) => {
      const e = b.expenses.find((x) => x.id === ev.target.dataset.id); if (!e) return;
      e.name = ev.target.value; scheduleSync();
      /* The row's own labels, the delete's and the picker's are all written from the name at
         render time. A row added with "+ Add expense" therefore stayed "this outgoing" in all
         three until something else rebuilt the list. */
      const row = ev.target.closest(".bud-exp"), nm = e.name.trim() || t("budget.thisExpense");
      if (!row) return;
      row.setAttribute("aria-label", nm);
      const d = row.querySelector(".bud-exp-del"); if (d) d.setAttribute("aria-label", t("common.removeName", { name: nm }));
      const c = row.querySelector(".bud-exp-cat");
      if (c) { const lb = t("budget.moveAria", { name: nm }); c.setAttribute("aria-label", lb); c.setAttribute("title", lb); }
    };
  });
  // Amount edits update in place (focus kept); category changes move the card → full re-render.
  host.querySelectorAll(".bud-exp-amt").forEach((el) => {
    el.oninput = (ev) => { const e = b.expenses.find((x) => x.id === ev.target.dataset.id); if (e) { /* Written back, not only stored. A silent clamp left the box reading "-50" while the
           ledger held 0, and pressing Done then rendered the row blank — the figure typed
           was gone with nothing said. */
        const got = parseNum(ev.target.value);
        e.amount = Math.max(0, got || 0);
        if (got != null && got < 0) ev.target.value = fmtPlain(e.amount); scheduleSync(); refreshTotals(); } };
  });
  /* Commit a picker only when the reader has settled on a choice. On Windows and Linux an
     arrow key on a closed <select> fires `change` on every press; the row would move, the list
     rebuild, and the control under their finger cease to exist after one keystroke — and since
     the face resets to the hidden "Move to…" option, arrowing could only ever reach the first
     destination in the list. Arrow, Home, End and Page defer; Enter, Tab and a click commit. */
  const onPick = (el, apply) => {
    el.onkeydown = (ev) => {
      if (/^(Arrow|Home|End|Page)/.test(ev.key)) { el.dataset.pending = "1"; return; }
      if (ev.key === "Enter" && el.dataset.pending) { delete el.dataset.pending; apply(el); }
    };
    el.onblur = () => { if (el.dataset.pending) { delete el.dataset.pending; apply(el); } };
    el.onchange = () => { if (!el.dataset.pending) apply(el); };
  };
  host.querySelectorAll(".bud-exp-cat").forEach((el) => {
    /* The row moves to another card, so the list is rebuilt and the control that was focused
       no longer exists. Without this, a keyboard reader lands on <body> — and on Windows an
       arrow key inside a closed <select> fires `change` per press, so one keystroke ended the
       interaction — while a touch reader watches the row vanish from under their finger. */
    onPick(el, (tgt) => { const e = b.expenses.find((x) => x.id === tgt.dataset.id); if (e) { e.group = tgt.value; scheduleSync(); renderBudget(); budRefocus(`.bud-exp-cat[data-id="${CSS.escape(e.id)}"]`); } });
  });
  host.querySelectorAll(".bud-loan-cat").forEach((el) => {
    onPick(el, (tgt) => { const id = tgt.dataset.lid; if (tgt.value) b.loanCats[id] = tgt.value; else delete b.loanCats[id]; scheduleSync(); renderBudget(); budRefocus(`.bud-loan-cat[data-lid="${CSS.escape(id)}"]`); });
  });

  // Inline rename + delete on the category section headers (same as net worth).
  const items = $("budItems");
  /* The same guards the net worth editor has carried since its own review, which this copy
     of the pattern never received. Without them: clearing the field was silently refused and
     the input stayed blank over a category that still had its name; and typing a name that
     already existed merged the two for good — two identical cards, each listing the same
     rows, each headed the same total, the list summing to twice the ring, and no undo. */
  /* A rename does not move a single row, so this does not re-render — it relabels what is
     already on screen.

     Rebuilding the body was the root of a run of focus bugs that each fix only moved around.
     `change` on a text input fires during blur, so committing with Tab destroyed the control
     Tab was travelling to and dropped the reader on <body>; committing with the mouse replaced
     the button under the pointer between mousedown and mouseup, so that first click did
     nothing; and refocusing the field afterwards meant the only way out of it was Escape.
     Nothing is replaced now, so there is nothing to put focus back onto. */
  items.addEventListener("change", (ev) => {
    if (!ev.target.classList.contains("grpname")) return;
    const was = ev.target.dataset.grp, nw = ev.target.value.trim();
    if (nw === was) { ev.target.value = was; return; }
    if (!nw) { toast(t("common.categoryNeedsName")); ev.target.value = was; return; }
    if (sameCat(nw, t("budget.uncategorized"))) { toast(t("common.categoryExists", { name: nw })); ev.target.value = was; return; }
    if (budgetCategoryNames().some((g) => g !== was && sameCat(g, nw))) { toast(t("common.categoryExists", { name: nw })); ev.target.value = was; return; }
    renameBudgetCategory(was, nw); scheduleSync();
    relabelCategory(ev.target.closest(".grp"), was, nw);
    refreshTotals();
  });
  items.addEventListener("click", (ev) => {
    const gd = ev.target.closest("[data-grpdel]");
    if (gd) {
      const g = gd.dataset.grpdel, n = budgetCategoryUsage(g);
      /* An empty category used to go with no confirmation — and the control that deletes the
         whole card is in the same column, at the same size, with the same glyph as the control
         that deletes one row. The case where the two sat closest was the case with no net. */
      if (confirm(n === 0 ? t("budget.removeEmptyCategoryConfirm", { name: g })
                          : t("budget.removeCategoryConfirm", { name: g, count: n }))) {
        /* Land on the category that moved up into this one's place, or the one above it if
           this was the last — not on the Add button past the whole list. */
        const names = budgetCategoryNames(), i = names.indexOf(g);
        const near = (k) => (names[k] ? `input.grpname[data-grp="${CSS.escape(names[k])}"]` : null);
        removeBudgetCategory(g); scheduleSync(); renderBudget();
        budRefocus(near(i + 1), near(i - 1), "#budAddCat");
      }
      return;
    }
    const del = ev.target.closest(".bud-exp-del");
    if (del) {
      const row = b.expenses.find((x) => x.id === del.dataset.id);
      if (row && !confirm(t("budget.removeExpenseConfirm", { name: row.name || t("budget.thisExpense") }))) return;
      /* From the DOM, not from the array: the screen is grouped by category, so once a row has
         been re-tagged the next entry in `b.expenses` can be in a different card — and
         `budRefocus` scrolls, so the page jumped there. */
      const r = del.closest(".bud-exp"), nb = r && (r.nextElementSibling || r.previousElementSibling);
      const near = nb && nb.dataset.id ? `.bud-exp-name[data-id="${CSS.escape(nb.dataset.id)}"]`
                 : nb && nb.dataset.lid ? `.bud-loan-cat[data-lid="${CSS.escape(nb.dataset.lid)}"]` : null;
      b.expenses = b.expenses.filter((x) => x.id !== del.dataset.id); scheduleSync(); renderBudget();
      budRefocus(near, "#budAddExp");
    }
  });

  // "+ Add" inside a category card: the same row, already filed where the reader is looking.
  items.addEventListener("click", (ev) => {
    const ai = ev.target.closest("[data-addin]"); if (!ai) return;
    const id = nid();
    b.expenses.push({ id, name: "", group: ai.dataset.addin, amount: 0 });
    scheduleSync(); renderBudget();
    focusNew(document.querySelector(`.bud-exp-name[data-id="${id}"]`));
  });

  $("budAddExp").onclick = () => {
    const id = nid();
    b.expenses.push({ id, name: "", group: "", amount: 0 });
    scheduleSync(); renderBudget();
    // Focus the new row by id — it renders in the ungrouped section (top), not last in the DOM.
    focusNew(document.querySelector(`.bud-exp-name[data-id="${id}"]`));
  };
  // "+ Add category" — same as net worth: adds a category you then rename inline, with the
  // placeholder name selected so typing replaces it.
  $("budAddCat").onclick = () => {
    const name = addBudgetCategory(t("common.newCategory"));
    scheduleSync(); renderBudget();
    focusNew(document.querySelector(`#budItems .grpname[data-grp="${name}"]`));
  };
}
