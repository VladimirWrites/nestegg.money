// Synthetic-but-realistic example data for the no-account demo. Recreates a believable
// two-earner household — stock + crypto tickers, an ungrouped cash holding, a workplace
// pension, a mortgaged flat (with extra payments) and a depreciating car, plus multi-year
// monthly salaries for two people. All figures are made up; no real finances are used.
// Lazily imported by the demo only, so it never bloats the normal app bundle.

import { getLocale } from "../i18n.js";

/* The demo's own words, in the reader's language.
 *
 * The German landing page's one credibility exhibit is a rail of screenshots headed "so sieht
 * es aus" — and it showed a chart legend reading Car, Cash, Crypto, Real estate, Stocks,
 * Workplace pension over a table of May, Apr, Mar. The figures and the dates now follow the
 * locale; these are the last English words in a German app.
 *
 * A small map rather than the i18n dictionary: this module is imported by the tests and by
 * the screenshot generator, neither of which boots the runtime, and English is the fallback
 * so nothing changes when it is not loaded. Proper nouns (Microsoft, Bitcoin, the fund) are
 * not translated. */
const DE = {
  Stocks: "Aktien", Crypto: "Krypto", "Real estate": "Immobilien",
  Cash: "Bargeld", "Workplace pension": "Betriebsrente", Flat: "Wohnung", Car: "Auto",
  Housing: "Wohnen", Food: "Essen", Transport: "Verkehr", Utilities: "Nebenkosten",
  Health: "Gesundheit", Leisure: "Freizeit", Savings: "Sparen",
  "Service charge": "Hausgeld", "Home insurance": "Hausratversicherung",
  Groceries: "Lebensmittel", Restaurants: "Restaurants", Fuel: "Kraftstoff",
  "Public transport": "ÖPNV", Electricity: "Strom", "Internet & phone": "Internet & Telefon",
  Gym: "Fitnessstudio", Subscriptions: "Abos", Hobbies: "Hobbys",
  "New job": "Neuer Job", Raise: "Gehaltserhöhung", Bonus: "Bonus", "Xmas bonus": "Weihnachtsgeld",
};
const w = (en) => (getLocale() === "de" && DE[en]) || en;

// Tiny seeded PRNG so the "organic" monthly variation is stable across loads.
function rng(seed) { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }

function monthsBetween(a, b) {
  const out = []; let [y, m] = a.split("-").map(Number); const [ey, em] = b.split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) { out.push(y + "-" + String(m).padStart(2, "0")); if (++m > 12) { m = 1; y++; } }
  return out;
}

// Build one person's monthly salary from carry-forward control points, with light monthly
// noise and a November bump (Xmas bonus) so the line looks lived-in rather than flat.
function salary(name, start, end, points, r) {
  const entries = monthsBetween(start, end).map((ym) => {
    let base = 0;
    for (const p of points) if (p[0] <= ym) base = p[1];
    const at = points.find((p) => p[0] === ym);
    let event = at && at[2] ? at[2] : "";
    let amount = 0;
    if (base > 0) {
      amount = base * (0.9 + r() * 0.2); // +/-10% monthly noise
      if (ym.slice(5) === "11" && r() < 0.8) { amount += base * (0.35 + r() * 0.7); event = event || w("Xmas bonus"); } // varied size, most (not all) years
      else if (r() < 0.07) { amount += base * (0.3 + r() * 0.6); event = event || w("Bonus"); } // occasional mid-year bonus
      amount = Math.round(amount * 100) / 100;
    }
    return event ? { ym, amount, event } : { ym, amount };
  });
  return { name, ccy: "EUR", entries };
}

export function sampleState() {
  const r = rng(20260626);
  const j = (v) => Math.round(v * (0.95 + r() * 0.1)); // +/-5% jitter, rounded (shares / cash)

  // Per-year holdings: [name, kind, group, ticker, { year: [shares, pxEUR] }].
  // px are plausible EUR market prices; share counts are synthetic.
  const PRICED = [
    ["Vanguard FTSE All-World", "ticker", w("Stocks"), "AMS:VWRL", { 2019: [460, 83], 2020: [3830, 86], 2021: [7640, 109], 2022: [11200, 93], 2023: [13730, 107], 2024: [11120, 133], 2025: [11120, 158], 2026: [13210, 160] }],
    ["Microsoft", "ticker", w("Stocks"), "NASDAQ:MSFT", { 2019: [30, 140], 2020: [50, 190], 2021: [50, 290], 2022: [50, 225], 2023: [50, 340], 2024: [50, 390], 2025: [50, 430], 2026: [50, 350] }],
    ["AMD", "ticker", w("Stocks"), "NASDAQ:AMD", { 2019: [90, 41], 2020: [250, 80], 2021: [300, 126], 2022: [300, 57], 2023: [300, 129], 2024: [300, 106], 2025: [300, 188], 2026: [300, 190] }],
    ["Intel", "ticker", w("Stocks"), "ETR:INL", { 2022: [650, 24], 2024: [590, 19], 2025: [590, 31], 2026: [590, 29] }],
    ["Bitcoin", "crypto", w("Crypto"), "BTC-EUR", { 2021: [3, 40000], 2022: [3, 16000], 2023: [4, 38000], 2024: [5, 60000], 2025: [6, 85000], 2026: [6, 52000] }],
  ];
  const CASH = { 2019: 310000, 2020: 310000, 2021: 300000, 2022: 300000, 2023: 650000, 2024: 200000, 2025: 410000, 2026: 300000 };
  const BAV = { 2020: 38000, 2021: 71000, 2022: 106000, 2023: 105000, 2024: 164000, 2025: 144000, 2026: 164000 };

  const snapshots = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map((year) => {
    const entries = [];
    PRICED.forEach(([name, kind, group, ticker, byYear]) => {
      const cell = byYear[year]; if (!cell) return;
      const [shares, px] = cell;
      entries.push({ name, kind, ccy: "EUR", ticker, shares: kind === "crypto" ? shares : j(shares), px, pxCcy: "EUR", group });
    });
    entries.push({ name: w("Cash"), kind: "fixed", ccy: "EUR", value: j(CASH[year]) }); // ungrouped — categories are optional
    if (BAV[year]) entries.push({ name: w("Workplace pension"), kind: "fixed", ccy: "EUR", value: j(BAV[year]) });
    return { year, entries };
  });

  return {
    baseCcy: "EUR",
    categories: [w("Stocks"), w("Crypto"), w("Real estate")],
    snapshots,
    assets: [
      {
        id: "demo-flat", name: w("Flat"), ccy: "EUR", group: w("Real estate"),
        value: 1060000, depreciates: false, up: false, date: "2024-04-01",
        loan: {
          startDate: "2024-04-01", amount: 950000, rate: 3.75, termYears: 30, mode: "payment", payment: 5740,
          fixedUntil: "2033-11-30",
          extra: [
            { date: "2024-11-26", amount: 40000 }, { date: "2025-08-11", amount: 10000 },
            { date: "2025-12-01", amount: 20000 }, { date: "2026-06-01", amount: 20000 },
          ],
        },
      },
      { id: "demo-car", name: w("Car"), ccy: "EUR", value: 39400, depreciates: true, up: false, rate: 0.15, date: "2023-10-01", loan: null },
    ],
    salaries: [
      salary("Alex", "2014-01", "2026-05", [
        ["2014-01", 600], ["2015-08", 2000, w("New job")], ["2017-09", 2900, w("New job")],
        ["2019-02", 3500, w("Raise")], ["2020-02", 3900, w("Raise")], ["2022-02", 4900, w("New job")],
        ["2024-10", 5000, w("Bonus")], ["2026-05", 5500, w("Raise")],
      ], r),
      salary("Sam", "2014-02", "2026-05", [
        ["2014-02", 260], ["2015-07", 0], ["2018-05", 400, w("New job")], ["2020-02", 1000, w("New job")],
        ["2021-07", 2700, w("Raise")], ["2023-08", 3100], ["2025-09", 3800, w("Raise")],
      ], r),
    ],
    forecast: { monthly: 18000, growth: 0.06, goalMode: "amount", goalAmount: 15000000, annualSpending: 400000, enabled: true, band: true, horizonYear: 2055 },
    // Retirement drawdown is shown (on:true). Pension via the German Rentenpunkte method:
    // points x point-value = monthly state pension, which kicks in at pensionStart.
    retire: { on: true, retireYear: 2046, spending: 60000, pmode: "de", pension: 0, points: 42, ptsPerYear: 1, ptValue: 39.32, pensionStart: 2057, inflation: 0.025, untilYear: 2071 },
    // Budget: its own spending categories (separate from the net-worth ones above). The mortgage on
    // the flat is filed under Housing; a handful of recurring expenses fill out the categories.
    budget: {
      incomeOverride: null,
      categories: ["Housing", "Food", "Transport", "Utilities", "Health", "Leisure", "Savings"].map(w),
      loanCats: { "demo-flat": w("Housing") },
      expenses: [
        { id: "be1", name: w("Service charge"), group: w("Housing"), amount: 250 },
        { id: "be2", name: w("Home insurance"), group: w("Housing"), amount: 60 },
        { id: "be3", name: w("Groceries"), group: w("Food"), amount: 600 },
        { id: "be4", name: w("Restaurants"), group: w("Food"), amount: 180 },
        { id: "be5", name: w("Fuel"), group: w("Transport"), amount: 160 },
        { id: "be6", name: w("Public transport"), group: w("Transport"), amount: 90 },
        { id: "be7", name: w("Electricity"), group: w("Utilities"), amount: 110 },
        { id: "be8", name: w("Internet & phone"), group: w("Utilities"), amount: 70 },
        { id: "be9", name: w("Gym"), group: w("Health"), amount: 45 },
        { id: "be10", name: w("Subscriptions"), group: w("Leisure"), amount: 55 },
        { id: "be11", name: w("Hobbies"), group: w("Leisure"), amount: 120 },
      ],
    },
  };
}
