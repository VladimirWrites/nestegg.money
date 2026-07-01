// Pure builder for a read-only share snapshot: a frozen, section-filtered copy of the live
// state. Kept dependency-free (only the store) so it's trivially testable and reusable by both
// the share IO layer and the section-picker UI.
import { state } from "./store.js";
import { salaryIncome } from "./budget.js";

// The sections a user can choose to include, in display order. `key` is the checkbox/flag name;
// `fields` are the top-level state properties copied into the snapshot when the section is on.
export const SHARE_SECTIONS = [
  { key: "networth", label: "Net worth", fields: ["assets", "categories", "snapshots"] },
  { key: "salaries", label: "Salaries", fields: ["salaries"] },
  { key: "budget", label: "Budget", fields: ["budget"] },
  { key: "forecast", label: "Forecast", fields: ["forecast"] },
  { key: "retirement", label: "Retirement", fields: ["retire"] },
];

const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

// A snapshot is a valid (partial) state object, so the viewer can drop it straight into the
// store and reuse every pure domain calculation. Valuation context (currency, fx, prices) is
// always included; section data only when its box is checked. `_include` tells the viewer which
// sections to render.
export function buildSnapshot(sel) {
  const snap = {
    _snap: 1,                              // snapshot format version
    _include: {},
    v: state.v,
    baseCcy: state.baseCcy,
    fxRates: { ...state.fxRates },
    fxDate: state.fxDate,
    fxHist: { ...state.fxHist },
    prices: { ...state.prices },
    // Empty defaults so the viewer's domain calls never hit an undefined section.
    assets: [], categories: [], snapshots: [], salaries: [],
    budget: null, forecast: null, retire: null,
  };
  for (const sec of SHARE_SECTIONS) {
    const on = !!sel[sec.key];
    snap._include[sec.key] = on;
    if (on) for (const f of sec.fields) snap[f] = clone(state[f]);
  }
  if (sel.budget && snap.budget) makeBudgetSelfContained(snap, sel);
  return snap;
}

// Budget is a derived view: income comes from salaries, and "fixed outflow" from asset loans.
// When those sections aren't shared, the budget would render empty — so bake in exactly what it
// needs, and nothing more (no per-person salary, no asset values).
function makeBudgetSelfContained(snap, sel) {
  // Income: bake the current total into the override when there's no manual override and salaries
  // aren't shared. It's a single figure — the per-person salary history is never exposed.
  if (snap.budget.incomeOverride == null && !sel.salaries) {
    const inc = salaryIncome();
    if (inc) snap.budget.incomeOverride = inc;
  }
  // Loan outflows: if net worth isn't shared, the assets that back them are absent. Include a
  // stripped copy of just the loan-bearing assets — loan schedule + label only, values zeroed —
  // so the outflow rows render without revealing what the assets are worth.
  if (!sel.networth) {
    snap.assets = (state.assets || [])
      .filter((a) => a.loan)
      .map((a) => ({ id: a.id, name: a.name, ccy: a.ccy || state.baseCcy, group: a.group, liability: !!a.liability, value: 0, depreciates: false, rate: 0, date: a.date, loan: clone(a.loan) }));
  }
}
