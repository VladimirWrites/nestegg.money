// Budget tab: a rough monthly "what's left" view. Income comes from your latest salary month
// (auto, with an override), loan payments are pulled from your loans, and you enter recurring
// expenses as a short list. All math lives in domain/budget.js; this only renders and edits state.
import { $, toast } from "./dom.js";
import { state } from "../domain/store.js";
import { nid } from "../domain/ids.js";
import { PALETTE } from "../domain/constants.js";
import { money, esc } from "../domain/money.js";
import { budgetSummary, salaryIncome } from "../domain/budget.js";
import { C, refreshPalette, legendSVG, frameSVG, svgToPng, positionTip } from "./chart-kit.js";
import { scheduleSync } from "../io/storage.js";

// Cache the latest segments so the tooltip and the PNG export can read them.
let _segs = [];

// Where the income goes: each loan, each expense, and the leftover — for the breakdown doughnut.
function breakdownSegments(s) {
  const segs = [];
  (s.loans || []).forEach((l, i) => { if (l.monthly > 0) segs.push({ name: l.name || "Loan", v: l.monthly, color: PALETTE[(i + 1) % PALETTE.length] }); });
  (state.budget && state.budget.expenses || []).forEach((e, i) => { const v = +e.amount || 0; if (v > 0) segs.push({ name: e.name || "Expense", v, color: PALETTE[(i + 4) % PALETTE.length] }); });
  if (s.leftover > 0) segs.push({ name: "Left over", v: s.leftover, color: C.green });
  return segs;
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
      p.setAttribute("data-name", seg.name); p.setAttribute("data-amt", money(seg.v)); p.setAttribute("data-pct", Math.round(f * 100) + "%");
      p.setAttribute("data-mx", (cx + r * Math.cos(am)).toFixed(1)); p.setAttribute("data-my", (cy + r * Math.sin(am)).toFixed(1));
      svg.appendChild(p);
      a = a2;
    });
    const t1 = document.createElementNS(NS, "text"); t1.setAttribute("x", cx); t1.setAttribute("y", cy - 4); t1.setAttribute("text-anchor", "middle"); t1.setAttribute("font-size", "10"); t1.setAttribute("fill", C.axis); t1.setAttribute("letter-spacing", "2"); t1.textContent = "MONTHLY";
    const t2 = document.createElementNS(NS, "text"); t2.setAttribute("x", cx); t2.setAttribute("y", cy + 18); t2.setAttribute("text-anchor", "middle"); t2.setAttribute("font-size", "16"); t2.setAttribute("font-weight", "600"); t2.setAttribute("fill", C.ink); t2.textContent = money(total);
    svg.appendChild(t1); svg.appendChild(t2);
  }
  svg.classList.toggle("anim", !!animate && total > 0);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", total > 0 ? "Budget breakdown: " + segs.map((x) => x.name + " " + Math.round(x.v / total * 100) + "%").join(", ") : "Budget breakdown — add income or expenses to see it.");
  const leg = $("budgetLegend"); if (leg) {
    leg.innerHTML = segs.map((x) => `<div class="legrow"><span class="swatch" style="background:${x.color}"></span><span>${esc(x.name)}</span><span class="pct">${total > 0 ? (x.v / total * 100).toFixed(0) : 0}%</span><span class="amt num">${money(x.v)}</span></div>`).join("");
  }
}

// Hover/tap a wedge to see its share. Wired once; reads the live wedge under the pointer.
function budgetTipShow(path) {
  const tip = $("budgetTip"); if (!tip) return;
  tip.innerHTML = `<div class="tiph">${esc(path.getAttribute("data-name"))}</div><div class="tipr"><span class="tipn">${path.getAttribute("data-amt")}</span><span class="tipv">${path.getAttribute("data-pct")}</span></div>`;
  tip.classList.remove("hide");
  positionTip(tip, +path.getAttribute("data-mx"), +path.getAttribute("data-my"), 240);
}
function budgetTipHide() { const t = $("budgetTip"); if (t) t.classList.add("hide"); }
let _tipWired = false;
function wireBudgetTip() {
  if (_tipWired) return;
  const svg = $("budgetDonut"); if (!svg) return;
  svg.addEventListener("mouseover", (e) => { const p = e.target.closest(".dwedge"); if (p) budgetTipShow(p); });
  svg.addEventListener("mouseout", (e) => { if (e.target.closest(".dwedge")) budgetTipHide(); });
  svg.addEventListener("click", (e) => { const p = e.target.closest(".dwedge"); if (p) budgetTipShow(p); else budgetTipHide(); });
  document.addEventListener("pointerdown", (e) => { if (!e.target.closest("#budgetDonut")) budgetTipHide(); });
  _tipWired = true;
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

const bud = () => (state.budget || (state.budget = { incomeOverride: null, expenses: [] }));

// Update only the live totals (leftover, savings rate, income, expense total) without rebuilding
// the rows — so an input keeps focus and its caret while you type.
function refreshTotals() {
  const s = budgetSummary();
  const lo = $("budLeftover"), sv = $("budSavings"), inc = $("budIncome"), et = $("budExpTotal"), card = $("budCard");
  if (inc) inc.textContent = money(s.income);
  if (et) et.textContent = "− " + money(s.expenses);
  if (lo) lo.textContent = money(s.leftover);
  if (sv) sv.textContent = s.savingsRatePct == null ? "—" : s.savingsRatePct.toFixed(0) + "%";
  if (card) card.classList.toggle("neg", s.leftover < 0);
  const ub = $("budUseSalary");
  if (ub) ub.classList.toggle("hide", !(state.budget && state.budget.incomeOverride != null));
  drawBudgetDonut(s);
}

function expenseRow(e) {
  return `<div class="bud-exp" data-id="${e.id}">
    <input class="bud-exp-name" data-id="${e.id}" type="text" value="${esc(e.name || "")}" placeholder="Expense" aria-label="Expense name">
    <input class="bud-exp-amt" data-id="${e.id}" type="number" inputmode="decimal" value="${e.amount || ""}" placeholder="0" aria-label="Monthly amount">
    <button class="bud-exp-del" data-id="${e.id}" title="Remove" aria-label="Remove">✕</button>
  </div>`;
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
      <button class="chartdl" id="dlBudget" title="Download chart" aria-label="Download chart"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v11"/><path d="M8 11l4 4 4-4"/><path d="M5 19h14"/></svg></button>
      <div class="bud-chart">
        <div class="bud-chartwrap"><svg id="budgetDonut" viewBox="0 0 240 240" width="220" height="220" aria-label="Budget breakdown"></svg><div id="budgetTip" class="salflag hide"></div></div>
        <div class="chiplegend" id="budgetLegend"></div>
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
      ${(s.loans || []).length > 1
        ? `<div class="bud-row"><span class="bud-lbl">Loan payments <span class="hint">from your loans</span></span><span class="bud-val">− ${money(s.fixed)}</span></div>`
          + s.loans.map((l) => `<div class="bud-row indent"><span class="bud-lbl">${esc(l.name)}</span><span class="bud-val">− ${money(l.monthly)}</span></div>`).join("")
        : `<div class="bud-row"><span class="bud-lbl">${(s.loans || []).length === 1 ? esc(s.loans[0].name) : "Loan payments"} <span class="hint">from your loans</span></span><span class="bud-val">− ${money(s.fixed)}</span></div>`}

      <div class="bud-exp-head">Monthly expenses</div>
      <div id="budExpList">${(b.expenses || []).map(expenseRow).join("") || `<div class="exhint">No expenses yet — add a few recurring ones below.</div>`}</div>
      <div class="bud-row total"><span class="bud-lbl">Total expenses</span><span class="bud-val" id="budExpTotal">− ${money(s.expenses)}</span></div>
    </div>

    <div class="controls"><button class="act ghost" id="budAddExp">+ Add expense</button></div>
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
  host.querySelectorAll(".bud-exp-amt").forEach((el) => {
    el.oninput = (ev) => { const e = b.expenses.find((x) => x.id === ev.target.dataset.id); if (e) { e.amount = parseFloat(ev.target.value) || 0; scheduleSync(); refreshTotals(); } };
  });
  host.querySelectorAll(".bud-exp-del").forEach((el) => {
    el.onclick = (ev) => { const id = ev.target.dataset.id; b.expenses = (b.expenses || []).filter((x) => x.id !== id); scheduleSync(); renderBudget(); };
  });

  $("budAddExp").onclick = () => {
    if (!Array.isArray(b.expenses)) b.expenses = [];
    b.expenses.push({ id: nid(), name: "", amount: 0 });
    scheduleSync(); renderBudget();
    const rows = document.querySelectorAll(".bud-exp-name");
    if (rows.length) rows[rows.length - 1].focus();
  };

  const dl = $("dlBudget"); if (dl) dl.onclick = downloadBudgetDonut;
  drawBudgetDonut(s, true);   // animate on tab entry
  wireBudgetTip();
}
