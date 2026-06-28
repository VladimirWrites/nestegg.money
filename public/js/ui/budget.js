// Budget tab: a rough monthly "what's left" view. Income comes from your latest salary month
// (auto, with an override), loan payments are pulled from your loans, and you enter recurring
// expenses as a short list. All math lives in domain/budget.js; this only renders and edits state.
import { $, esc } from "./dom.js";
import { state } from "../domain/store.js";
import { nid } from "../domain/ids.js";
import { money } from "../domain/money.js";
import { budgetSummary, salaryIncome } from "../domain/budget.js";
import { scheduleSync } from "../io/storage.js";

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
    </section>

    <div class="bud-rows">
      <div class="bud-row"><span class="bud-lbl">Income <span class="hint">latest salary month: ${money(auto)}</span></span><span class="bud-val" id="budIncome">${money(s.income)}</span></div>
      <div class="bud-row indent">
        <span class="bud-lbl">Override monthly income</span>
        <input id="budOverride" class="bud-input" type="number" inputmode="decimal" value="${b.incomeOverride == null ? "" : b.incomeOverride}" placeholder="auto (${money(auto)})" aria-label="Override monthly income">
      </div>
      <div class="bud-row"><span class="bud-lbl">Loan payments <span class="hint">from your loans</span></span><span class="bud-val">− ${money(s.fixed)}</span></div>

      <div class="bud-exp-head">Monthly expenses</div>
      <div id="budExpList">${(b.expenses || []).map(expenseRow).join("") || `<div class="exhint">No expenses yet — add a few recurring ones below.</div>`}</div>
      <div class="bud-row total"><span class="bud-lbl">Total expenses</span><span class="bud-val" id="budExpTotal">− ${money(s.expenses)}</span></div>
    </div>

    <div class="controls"><button class="act ghost" id="budAddExp">+ Add expense</button></div>
  `;

  // Override income: live, no rebuild.
  $("budOverride").oninput = (ev) => {
    const v = ev.target.value.trim();
    b.incomeOverride = v === "" ? null : (parseFloat(v) || 0);
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
}
