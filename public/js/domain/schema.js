// State shape: defaults, fresh state, loan normalization, and the version migrator.
// Pure — operates on the plain state object passed in.
import { nid } from "./ids.js";
import { FALLBACK_FX, DEL_KINDS, SCHEMA_VERSION, DEFAULT_BUDGET_CATEGORIES } from "./constants.js";

const todayISO = () => new Date().toISOString().slice(0, 10);
const thisMonthISO = () => new Date().toISOString().slice(0, 7);

// Default forecast / retirement configs — single source of truth, shared with the accessors.
export function defForecast() {
  return { enabled: true, monthly: 0, growth: 0, goalMode: "amount", goalAmount: 0, annualSpending: 0, redirectLoans: false };
}
export function defRetire() {
  const cy = new Date().getFullYear();
  return { on: false, retireYear: cy, spending: 0, pmode: "amount", pension: 0, points: 0, ptsPerYear: 1, ptValue: 39.32, pensionStart: cy + 15, inflation: 0.02, untilYear: cy + 45 };
}

export function emptyState() {
  return {
    v: SCHEMA_VERSION,
    baseCcy: "EUR",
    fxRates: { ...FALLBACK_FX },
    fxDate: null,
    fxHist: {},
    prices: {},
    assets: [],
    categories: [],
    salaries: [],
    snapshots: [{ year: new Date().getFullYear(), entries: [] }],
    budget: { incomeOverride: null, expenses: [], loanCats: {}, categories: DEFAULT_BUDGET_CATEGORIES.slice() },
    shares: [],
  };
}

// Fill in a loan's missing fields in place (or return null for a non-object).
export function normLoan(L, fallbackDate) {
  if (!L || typeof L !== "object") return null;
  if (L.amount == null) L.amount = 0;
  if (L.rate == null) L.rate = 0;
  if (L.termYears == null) L.termYears = 30;
  if (!L.startDate) L.startDate = fallbackDate;
  if (L.mode !== "payment") L.mode = "term";
  if (L.payment == null) L.payment = 0;
  if (L.fixedUntil === undefined) L.fixedUntil = null; // rate certain until this date; beyond = estimated
  if (!Array.isArray(L.extra)) L.extra = [];
  L.extra.forEach((x) => {
    if (!x.id) x.id = nid();
    if (x.amount == null) x.amount = 0;
    if (!x.date) x.date = L.startDate;
  });
  return L;
}

// Ensure the tombstone store exists with a bucket per record kind.
export function ensureDel(s) {
  s.del = s.del || {};
  DEL_KINDS.forEach((k) => {
    if (!s.del[k]) s.del[k] = {};
  });
  return s.del;
}

function migrateForecast(s) {
  if (!s.forecast || typeof s.forecast !== "object") {
    s.forecast = defForecast();
  } else {
    const f = s.forecast;
    f.enabled = f.enabled !== false;
    f.monthly = +f.monthly || 0;
    f.growth = +f.growth || 0;
    f.goalMode = f.goalMode === "spend" ? "spend" : "amount";
    f.goalAmount = +f.goalAmount || 0;
    f.annualSpending = +f.annualSpending || 0;
    f.redirectLoans = !!f.redirectLoans;
  }
  const f = s.forecast;
  f.band = !!f.band;
  f.contribGrowth = +f.contribGrowth || 0;
  f.horizonYear = +f.horizonYear || 0;
  delete f.real;
  delete f.inflation;
  delete f.pension;
}

function migrateBudget(s) {
  if (!s.budget || typeof s.budget !== "object") { s.budget = { incomeOverride: null, expenses: [], loanCats: {}, categories: DEFAULT_BUDGET_CATEGORIES.slice() }; return; }
  const b = s.budget;
  b.incomeOverride = b.incomeOverride == null ? null : (+b.incomeOverride || 0);
  if (!b.loanCats || typeof b.loanCats !== "object") b.loanCats = {};
  // Budget has its own category list (separate from net-worth categories). Seed once for older budgets.
  if (!Array.isArray(b.categories)) b.categories = DEFAULT_BUDGET_CATEGORIES.slice();
  if (!Array.isArray(b.expenses)) b.expenses = [];
  b.expenses.forEach((e) => {
    if (!e.id) e.id = nid();
    if (e.name == null) e.name = "Expense";
    // Expense category lives on .group, matching net-worth entries (was .category in an earlier build).
    if (e.group == null) e.group = e.category || "";
    delete e.category;
    e.amount = +e.amount || 0;
  });
}

function migrateRetire(s) {
  const cy = new Date().getFullYear();
  if (!s.retire || typeof s.retire !== "object") s.retire = defRetire();
  const r = s.retire;
  r.on = !!r.on;
  if (r.year != null && r.retireYear == null) r.retireYear = r.year;
  delete r.year;
  delete r.wrMode;
  delete r.wrRate;
  delete r.years;
  r.pmode = r.pmode === "de" ? "de" : "amount";
  r.retireYear = +r.retireYear || cy;
  r.spending = +r.spending || 0;
  r.pension = +r.pension || 0;
  r.points = +r.points || 0;
  r.ptsPerYear = r.ptsPerYear != null ? +r.ptsPerYear : 1;
  r.ptValue = r.ptValue != null ? +r.ptValue : 39.32;
  r.pensionStart = +r.pensionStart || cy + 15;
  r.inflation = r.inflation != null ? +r.inflation : 0.02;
  r.untilYear = +r.untilYear || cy + 45;
}

function migrateFx(s) {
  if (!s.fxRates) s.fxRates = { ...FALLBACK_FX };
  s.fxRates.EUR = 1;
  if (!s.prices) s.prices = {};
  if (!s.fxHist || typeof s.fxHist !== "object") s.fxHist = {};
}

// Fold any earlier-format cars/properties into the unified asset list, then normalize.
// A long-term asset: a value that optionally depreciates and/or carries a loan.
function migrateAssets(s) {
  const today = todayISO();
  if (!Array.isArray(s.assets)) s.assets = [];
  (s.cars || []).forEach((c) =>
    s.assets.push({ id: c.id || nid(), name: c.name || "Asset", ccy: c.ccy || s.baseCcy, value: c.price || 0, depreciates: true, date: c.date || today, rate: c.rate != null ? c.rate : 0.15, loan: null, group: c.group }),
  );
  (s.properties || []).forEach((p) =>
    s.assets.push({ id: p.id || nid(), name: p.name || "Property", ccy: p.ccy || s.baseCcy, value: p.value || 0, depreciates: false, date: (p.loan && p.loan.startDate) || today, rate: 0, loan: normLoan(p.loan, today), group: p.group }),
  );
  delete s.cars;
  delete s.properties;
  s.assets.forEach((a) => {
    if (!a.id) a.id = nid();
    if (!a.name) a.name = "Asset";
    if (!a.ccy) a.ccy = s.baseCcy || "EUR";
    if (a.value == null) a.value = 0;
    a.depreciates = !!a.depreciates;
    a.up = !!a.up;
    a.liability = !!a.liability;
    if (!a.date) a.date = today;
    if (a.rate == null) a.rate = 0.15;
    a.loan = a.loan ? normLoan(a.loan, a.date) : null;
  });
}

// Salary history: one record per person, each a list of monthly net-pay entries.
function migrateSalaries(s) {
  if (!Array.isArray(s.salaries)) s.salaries = [];
  s.salaries.forEach((p) => {
    if (!p.id) p.id = nid();
    if (!p.name) p.name = "Person";
    if (!p.ccy) p.ccy = s.baseCcy || "EUR";
    if (!Array.isArray(p.entries)) p.entries = [];
    p.entries.forEach((en) => {
      if (!en.id) en.id = nid();
      if (!en.ym) en.ym = thisMonthISO();
      if (en.amount == null) en.amount = (parseFloat(en.base) || 0) + (parseFloat(en.extra) || 0);
      if (en.event == null) en.event = "";
      if (!en.ccy) en.ccy = p.ccy || s.baseCcy || "EUR";
      delete en.base;
      delete en.extra;
    });
  });
}

function migrateSnapshots(s) {
  (s.snapshots || []).forEach((sn) => {
    if (!sn.entries) {
      const c = sn.cats || {};
      sn.entries = Object.keys(c).filter((k) => c[k]).map((k) => ({ id: nid(), name: k, ccy: "EUR", value: c[k] }));
    }
    sn.entries.forEach((en) => {
      if (!en.id) en.id = nid();
      if (!en.name) en.name = en.cat || "Asset";
      if (!en.ccy) en.ccy = "EUR";
      if (en.value == null) en.value = 0;
      if (!en.kind) en.kind = "fixed";
      if (en.kind === "ticker" || en.kind === "crypto") {
        if (en.shares == null) en.shares = 0;
        if (en.ticker == null) en.ticker = "";
      }
      delete en.cat;
      delete en.qty;
    });
    delete sn.cats;
  });
}

// Active read-only shares the user has published: the local record of each link (id, label,
// timestamps). The share KEY is never stored here — it exists only in the link the user copied.
// This list rides inside the encrypted vault, so it syncs across devices and the server learns
// nothing about it. It's a record, not a transactional mirror of the server's rows.
function migrateShares(s) {
  if (!Array.isArray(s.shares)) { s.shares = []; return; }
  s.shares = s.shares.filter((sh) => sh && typeof sh.id === "string").map((sh) => ({
    id: sh.id,
    label: typeof sh.label === "string" ? sh.label : "",
    created: +sh.created || 0,
    expires: +sh.expires || 0,
  }));
}

// Categories are a global tag list. Backfill from any group still in use.
function rebuildCategories(s) {
  if (!Array.isArray(s.categories)) s.categories = [];
  const cset = new Set(s.categories);
  (s.snapshots || []).forEach((sn) => (sn.entries || []).forEach((e) => { if (e.group) cset.add(e.group); }));
  (s.assets || []).forEach((a) => { if (a.group) cset.add(a.group); });
  s.categories = [...cset];
}

// Prune tombstones older than 180 days — by then every device has synced past them,
// and they would otherwise grow forever.
function pruneTombstones(s) {
  const del = ensureDel(s);
  const cut = Date.now() - 180 * 86400000;
  DEL_KINDS.forEach((k) => {
    const b = del[k];
    Object.keys(b).forEach((id) => { if (b[id] < cut) delete b[id]; });
  });
}

// Upgrade a loaded state blob (any earlier format) to the current schema version, in place.
export function migrate(s) {
  if (!s.baseCcy) s.baseCcy = "EUR";
  migrateForecast(s);
  migrateRetire(s);
  migrateBudget(s);
  migrateFx(s);
  migrateAssets(s);
  migrateSalaries(s);
  migrateSnapshots(s);
  migrateShares(s);
  rebuildCategories(s);
  pruneTombstones(s);
  delete s.items;
  s.v = SCHEMA_VERSION;
  return s;
}
