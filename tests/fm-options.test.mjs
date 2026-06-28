import { test } from "node:test";
import assert from "node:assert/strict";
import { near } from "./helpers.mjs";
import {
  blackScholes, optionGreeks, putCallParity, optionBreakeven, intrinsicTimeValue,
} from "../public/lib/finance-math.js";

test("blackScholes: the textbook ATM call/put (S=K=100, 1y, 20% vol, 5% rate)", () => {
  near(blackScholes(100, 100, 1, 20, 5, 0, "call").price, 10.4506, 1e-2);
  near(blackScholes(100, 100, 1, 20, 5, 0, "put").price, 5.5735, 1e-2);
});

test("optionGreeks: ATM call delta ~0.637, positive gamma/vega, negative theta", () => {
  const g = optionGreeks(100, 100, 1, 20, 5, 0, "call");
  near(g.delta, 0.6368, 1e-3);
  assert.ok(g.gamma > 0 && g.vega > 0);
  assert.ok(g.theta < 0 && g.rho > 0);
});

test("putCallParity: recovers the put from the call (and back)", () => {
  const call = blackScholes(100, 100, 1, 20, 5, 0, "call").price;
  near(putCallParity({ call, spot: 100, strike: 100, years: 1, riskFreePct: 5 }).put, 5.5735, 1e-2);
});

test("optionBreakeven: strike plus/minus the premium", () => {
  assert.equal(optionBreakeven(100, 4, "call").breakeven, 104);
  assert.equal(optionBreakeven(100, 4, "put").breakeven, 96);
});

test("intrinsicTimeValue: splits a premium into intrinsic and time value", () => {
  const r = intrinsicTimeValue(110, 100, 14, "call");
  assert.equal(r.intrinsic, 10);   // max(0, 110-100)
  assert.equal(r.timeValue, 4);    // 14 - 10
});
