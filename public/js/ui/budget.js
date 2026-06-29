// Budget tab: a rough monthly "what's left" view. Income comes from your latest salary month
// (auto, with an override), loan payments are pulled from your loans, and you enter recurring
// expenses as a short list. All math lives in domain/budget.js; this only renders and edits state.
import { $, toast } from "./dom.js";
import { state } from "../domain/store.js";
import { nid } from "../domain/ids.js";
import { PALETTE } from "../domain/constants.js";
import { money, esc } from "../domain/money.js";
import { budgetSummary, salaryIncome, budgetCategoryNames, addBudgetCategory, renameBudgetCategory, removeBudgetCategory, budgetCategoryUsage } from "../domain/budget.js";
import { C, refreshPalette, legendSVG, frameSVG, svgToPng, positionTip } from "./chart-kit.js";
import { scheduleSync } from "../io/storage.js";

// Cache the latest segments so the tooltip and the PNG export can read them.
let _segs = [];

// Where the income goes, at the top level: one wedge per category (expenses + loans grouped by the
// domain) plus the leftover. Each carries its `items` so the tooltip can break it down on hover.
function breakdownSegments(s) {
  const segs = [];
  (s.categories || []).forEach((c, i) => { if (c.total > 0) segs.push({ name: c.category, v: c.total, color: PALETTE[i % PALETTE.length], items: c.items }); });
  if (s.leftover > 0) segs.push({ name: "Left over", v: s.leftover, color: C.green, items: [] });
  return segs;
}

// A category <select> matching the net-worth picker: the global category list plus "— no category —".
function catSelect(cls, dataAttr, current) {
  const cats = budgetCategoryNames();
  return `<select class="${cls}" ${dataAttr} aria-label="Category"><option value="" ${!current ? "selected" : ""}>— no category —</option>${cats.map((g) => `<option ${g === current ? "selected" : ""}>${esc(g)}</option>`).join("")}</select>`;
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
  const total = segs.reduce((a, x) => a + x.v, 0);
  if (total > 0) {
    const cx = 120, cy = 120, r = 82, sw = 30; let a = -Math.PI / 2;
    segs.forEach((seg) => {
      const f = seg.v / total, a2 = a + f * Math.PI * 2, lg = f > 0.5 ? 1 : 0, am = (a + a2) / 2;
      const x1 = cx + r * Math.cos(a), y1 = cy + r * Math.sin(a), x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", `M ${x1} ${y1} A ${r} ${r} 0 ${lg} 1 ${x2} ${y2}`);
      p.setAttribute("fill", "none"); p.setAttribute("stroke", seg.color); p.setAttribute("stroke-width", sw);
      p.setAttribute("pathLength", "1"); p.setAttribute("class", "dwedge");
      p.setAttribute("data-idx", String(segs.indexOf(seg)));
      p.setAttribute("data-mx", (cx + r * Math.cos(am)).toFixed(1)); p.setAttribute("data-my", (cy + r * Math.sin(am)).toFixed(1));
      svg.appendChild(p);
      a = a2;
    });
    // Centre shows income (the money coming in) — never the outgoings total, which would read as
    // "expenses in the centre" when overspending. Red when spending exceeds income.
    const t2 = document.createElementNS(NS, "text"); t2.setAttribute("x", cx); t2.setAttribute("y", cy + 6); t2.setAttribute("text-anchor", "middle"); t2.setAttribute("font-size", "17"); t2.setAttribute("font-weight", "600"); t2.setAttribute("fill", s.leftover < 0 ? C.red : C.ink); t2.textContent = money(s.income);
    svg.appendChild(t2);
  }
  svg.classList.toggle("anim", !!animate && total > 0);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", total > 0 ? "Budget breakdown: " + segs.map((x) => x.name + " " + Math.round(x.v / total * 100) + "%").join(", ") : "Budget breakdown — add income or expenses to see it.");
  const leg = $("budgetLegend"); if (leg) {
    leg.innerHTML = segs.map((x) => `<div class="legrow"><span class="swatch" style="background:${x.color}"></span><span>${esc(x.name)}</span><span class="pct">${total > 0 ? (x.v / total * 100).toFixed(0) : 0}%</span><span class="amt num">${money(x.v)}</span></div>`).join("");
  }
}

// Hover/tap a wedge to break it down (the expenses in a category, or each loan). Reads the live
// segment by index so it survives re-renders.
function budgetTipShow(path) {
  const tip = $("budgetTip"); if (!tip) return;
  const seg = _segs[+path.getAttribute("data-idx")]; if (!seg) return;
  const total = _segs.reduce((a, x) => a + x.v, 0);
  const pct = total > 0 ? Math.round(seg.v / total * 100) : 0;
  let html = `<div class="tiph">${esc(seg.name)} <span class="tippct">${pct}%</span></div>`;
  const items = (seg.items || []).slice().sort((a, b) => b.amount - a.amount);
  if (items.length) {
    items.forEach((it) => { html += `<div class="tipr"><span class="tipn">${esc(it.name)}</span><span class="tipv">${money(it.amount)}</span></div>`; });
    if (items.length > 1) html += `<div class="tipnet">Total <b>${money(seg.v)}</b></div>`;
  } else {
    html += `<div class="tipr"><span class="tipn">&nbsp;</span><span class="tipv">${money(seg.v)}</span></div>`;
  }
  tip.innerHTML = html;
  tip.classList.remove("hide");
  positionTip(tip, +path.getAttribute("data-mx"), +path.getAttribute("data-my"), 240);
}
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
export function downloadBudgetDonut() {
  const src = $("budgetDonut");
  if (!src || !_segs.length) { toast("Nothing to save"); return; }
  const total = _segs.reduce((a, x) => a + x.v, 0);
  const items = _segs.map((x) => ({ color: x.color, label: x.name + "   " + Math.round(x.v / total * 100) + "%   " + money(x.v) }));
  const pad = 24, titleH = 52, size = 240;
  const leg = legendSVG(items, pad, titleH + size + 16, 13);
  const f = frameSVG("Budget · monthly breakdown", src.innerHTML, size, size, leg, pad, titleH);
  svgToPng(f.svg, f.W, f.H, 2, "nestegg-budget.png");
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
  if (lo) lo.textContent = money(s.leftover);
  if (sv) sv.textContent = s.savingsRatePct == null ? "—" : s.savingsRatePct.toFixed(0) + "%";
  if (card) card.classList.toggle("neg", s.leftover < 0);
  // live category subtotals (no row rebuild → focus kept while typing an amount)
  document.querySelectorAll("[data-grpsub]").forEach((el) => {
    const c = s.categories.find((x) => x.category === el.getAttribute("data-grpsub"));
    el.textContent = money(c ? c.total : 0);
  });
  const ub = $("budUseSalary");
  if (ub) ub.classList.toggle("hide", !(state.budget && state.budget.incomeOverride != null));
  drawBudgetDonut(s);
}

function expenseRow(e) {
  return `<div class="bud-exp" data-id="${e.id}">
    <input class="bud-exp-name" data-id="${e.id}" type="text" value="${esc(e.name || "")}" placeholder="Expense" aria-label="Expense name">
    ${catSelect("bud-exp-cat", `data-id="${e.id}"`, e.group)}
    <input class="bud-exp-amt" data-id="${e.id}" type="number" inputmode="decimal" value="${e.amount || ""}" placeholder="0" aria-label="Monthly amount">
    <button class="bud-exp-del" data-id="${e.id}" title="Remove" aria-label="Remove">✕</button>
  </div>`;
}

// A loan row: the loan name (from your assets), a category picker, and its monthly payment (fixed).
function loanRow(l, loanCats) {
  return `<div class="bud-exp bud-loan" data-lid="${l.id}">
    <span class="bud-loan-name" title="Loan payment (from your assets)">${esc(l.name)}</span>
    ${catSelect("bud-loan-cat", `data-lid="${l.id}"`, loanCats[l.id])}
    <span class="bud-loan-amt">${money(l.monthly)}</span>
  </div>`;
}

// Colour a category to match its doughnut wedge (same index/palette).
function catColor(name, cats) {
  const i = (cats || []).findIndex((c) => c.category === name);
  return i >= 0 ? PALETTE[i % PALETTE.length] : "var(--muted)";
}

// The outgoings list, grouped by category exactly like the net-worth editor: ungrouped items first,
// then a section per category with an inline-rename name, its subtotal, and a delete (×).
function itemsHTML(s, b) {
  const order = [...(b.categories || [])];
  b.expenses.forEach((e) => { if (e.group && order.indexOf(e.group) < 0) order.push(e.group); });
  Object.values(b.loanCats || {}).forEach((g) => { if (g && order.indexOf(g) < 0) order.push(g); });
  const loans = s.loans || [], lc = b.loanCats || {};
  const expRow = (e) => expenseRow(e), loanRowH = (l) => loanRow(l, lc);

  let html = "";
  const ungEx = b.expenses.filter((e) => !e.group), ungLo = loans.filter((l) => !lc[l.id]);
  if (ungEx.length || ungLo.length) html += `<div class="grpcards">${ungLo.map(loanRowH).join("")}${ungEx.map(expRow).join("")}</div>`;

  order.forEach((g) => {
    const ex = b.expenses.filter((e) => e.group === g), lo = loans.filter((l) => lc[l.id] === g);
    const sub = ex.reduce((a, e) => a + (+e.amount || 0), 0) + lo.reduce((a, l) => a + l.monthly, 0);
    html += `<div class="grp"><div class="grphead"><span class="dot" style="background:${catColor(g, s.categories)}"></span>`
      + `<input class="grpname" data-grp="${esc(g)}" value="${esc(g)}" title="Category name" placeholder="Category name">`
      + `<span class="grpsub num" data-grpsub="${esc(g)}">${money(sub)}</span>`
      + `<button class="grpdel" data-grpdel="${esc(g)}" title="Delete category">×</button></div>`
      + `<div class="grpcards">${lo.map(loanRowH).join("")}${ex.map(expRow).join("") || `<div class="exhint">Empty — set an item's category to this.</div>`}</div></div>`;
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
    <section class="over" style="border:none;padding:8px 0">
      <div class="sectitle">Roughly what's left each month</div>
      <div class="bud-card${s.leftover < 0 ? " neg" : ""}" id="budCard">
        <span class="k">Left over / month</span>
        <span class="v" id="budLeftover">${money(s.leftover)}</span>
        <span class="sub">savings rate <b id="budSavings">${s.savingsRatePct == null ? "—" : s.savingsRatePct.toFixed(0) + "%"}</b></span>
      </div>
      <div class="bud-chart">
        <div class="bud-chart-main">
          <div class="bud-chartwrap">
            <svg id="budgetDonut" viewBox="0 0 240 240" width="240" height="240" aria-label="Budget breakdown"></svg>
            <div id="budgetTip" class="salflag hide"></div>
            <button class="chartdl" id="dlBudget" title="Download chart" aria-label="Download chart"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v11"/><path d="M8 11l4 4 4-4"/><path d="M5 19h14"/></svg></button>
          </div>
          <div class="legend" id="budgetLegend"></div>
        </div>
      </div>
    </section>

    <div class="bud-rows">
      <div class="bud-row"><span class="bud-lbl">Income <span class="hint">latest salary month: ${money(auto)}</span></span><span class="bud-val" id="budIncome">${money(s.income)}</span></div>
      <div class="bud-row indent">
        <span class="bud-lbl">Override monthly income</span>
        <span class="bud-ovr">
          <button id="budUseSalary" class="bud-reset${b.incomeOverride == null ? " hide" : ""}" type="button" title="Use the salary figure again">↺ use salary</button>
          <input id="budOverride" class="bud-input" type="number" inputmode="decimal" value="${b.incomeOverride == null ? "" : b.incomeOverride}" placeholder="auto (${money(auto)})" aria-label="Override monthly income">
        </span>
      </div>
      <div class="bud-exp-head">Outgoings <span class="hint">tag loans &amp; expenses into categories</span></div>
      <div id="budItems">${itemsHTML(s, b)}</div>
      <div class="bud-row total"><span class="bud-lbl">Total outgoings</span><span class="bud-val" id="budOutTotal">${money(s.fixed + s.expenses)}</span></div>
    </div>

    <div class="controls"><button class="act ghost" id="budAddExp">+ Add expense</button><button class="act ghost" id="budAddCat">+ Add category</button></div>
  `;

  // Override income: live, no rebuild (keeps focus while typing). Empty field = use salary.
  $("budOverride").oninput = (ev) => {
    const v = ev.target.value.trim();
    b.incomeOverride = v === "" ? null : (parseFloat(v) || 0);
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
    el.oninput = (ev) => { const e = b.expenses.find((x) => x.id === ev.target.dataset.id); if (e) { e.name = ev.target.value; scheduleSync(); } };
  });
  // Amount edits update in place (focus kept); category changes move the card → full re-render.
  host.querySelectorAll(".bud-exp-amt").forEach((el) => {
    el.oninput = (ev) => { const e = b.expenses.find((x) => x.id === ev.target.dataset.id); if (e) { e.amount = parseFloat(ev.target.value) || 0; scheduleSync(); refreshTotals(); } };
  });
  host.querySelectorAll(".bud-exp-cat").forEach((el) => {
    el.onchange = (ev) => { const e = b.expenses.find((x) => x.id === ev.target.dataset.id); if (e) { e.group = ev.target.value; scheduleSync(); renderBudget(); } };
  });
  host.querySelectorAll(".bud-loan-cat").forEach((el) => {
    el.onchange = (ev) => { const id = ev.target.dataset.lid; if (ev.target.value) b.loanCats[id] = ev.target.value; else delete b.loanCats[id]; scheduleSync(); renderBudget(); };
  });

  // Inline rename + delete on the category section headers (same as net worth).
  const items = $("budItems");
  items.addEventListener("change", (ev) => {
    if (!ev.target.classList.contains("grpname")) return;
    const old = ev.target.dataset.grp, nw = ev.target.value.trim();
    if (nw && nw !== old) { renameBudgetCategory(old, nw); scheduleSync(); renderBudget(); }
  });
  items.addEventListener("click", (ev) => {
    const gd = ev.target.closest("[data-grpdel]");
    if (gd) {
      const g = gd.dataset.grpdel, n = budgetCategoryUsage(g);
      if (n === 0 || confirm(`Remove the "${g}" category? Its ${n} tagged item${n === 1 ? "" : "s"} lose the category — nothing is deleted.`)) { removeBudgetCategory(g); scheduleSync(); renderBudget(); }
      return;
    }
    const del = ev.target.closest(".bud-exp-del");
    if (del) { b.expenses = b.expenses.filter((x) => x.id !== del.dataset.id); scheduleSync(); renderBudget(); }
  });

  $("budAddExp").onclick = () => {
    const id = nid();
    b.expenses.push({ id, name: "", group: "", amount: 0 });
    scheduleSync(); renderBudget();
    // Focus the new row by id — it renders in the ungrouped section (top), not last in the DOM.
    const el = document.querySelector(`.bud-exp-name[data-id="${id}"]`);
    if (el) el.focus();
  };
  // "+ Add category" — same as net worth: adds a category you then rename inline.
  $("budAddCat").onclick = () => { addBudgetCategory(); scheduleSync(); renderBudget(); };

  const dl = $("dlBudget"); if (dl) dl.onclick = downloadBudgetDonut;
  drawBudgetDonut(s, true);   // animate on tab entry
  wireBudgetTip();
}
