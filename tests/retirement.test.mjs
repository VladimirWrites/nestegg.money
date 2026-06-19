import { test } from "node:test";
import assert from "node:assert/strict";
import { setState } from "../public/js/domain/store.js";
import { retCfg, pensionMonthly, pensionAnnual, pensionPts, retSim } from "../public/js/domain/retirement.js";

const cy = new Date().getFullYear();

function withRetire(retire = {}, liquid = 10000, growth = 0.05) {
  setState({
    baseCcy: "EUR",
    fxRates: { EUR: 1 },
    fxHist: {},
    prices: {},
    assets: [],
    snapshots: [{ year: cy, entries: [{ id: "c", name: "Cash", kind: "fixed", ccy: "EUR", value: liquid }] }],
    forecast: { enabled: true, monthly: 0, growth, goalMode: "amount", contribGrowth: 0 },
    retire: { on: true, retireYear: cy, spending: 40000, pmode: "amount", pension: 0, points: 0, ptsPerYear: 1, ptValue: 39.32, pensionStart: cy + 15, inflation: 0.02, untilYear: cy + 30, ...retire },
  });
}

test("pensionMonthly: explicit amount vs German points", () => {
  withRetire({ pmode: "amount", pension: 1500 });
  assert.equal(pensionMonthly(), 1500);
  assert.equal(pensionAnnual(), 18000);

  withRetire({ pmode: "de", points: 40, ptsPerYear: 0, ptValue: 39.32, retireYear: cy });
  assert.ok(Math.abs(pensionMonthly() - 40 * 39.32) < 1e-6);
});

test("pensionPts accrues points per working year until retirement", () => {
  withRetire({ pmode: "de", points: 10, ptsPerYear: 1, retireYear: cy + 5 });
  assert.equal(pensionPts(), 15); // 10 + 1*5
});

test("retSim: a small pot against high spending depletes", () => {
  withRetire({ spending: 40000 }, 10000);
  const sim = retSim();
  assert.ok(sim.depleted !== null);
  assert.equal(sim.pts[0].y, sim.retY);
});

test("retSim: a large pot against modest spending lasts the horizon", () => {
  withRetire({ spending: 30000, untilYear: cy + 30 }, 2000000);
  const sim = retSim();
  assert.equal(sim.depleted, null);
  assert.ok(sim.endPot > 0);
  assert.equal(sim.pts[sim.pts.length - 1].y, sim.until);
});

test("retSim: a generous pension covers spending so the pot survives", () => {
  withRetire({ spending: 30000, pension: 3000, pensionStart: cy + 1 }, 100000);
  const sim = retSim();
  assert.equal(sim.depleted, null); // 3000*12 = 36k/yr >= 30k spend
});
