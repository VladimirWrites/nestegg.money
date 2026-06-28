import { test } from "node:test";
import assert from "node:assert/strict";
import { near } from "./helpers.mjs";
import { futureValueOfContributions, requiredContribution } from "../public/lib/finance-math.js";

test("futureValueOfContributions: €100/mo at 12%/yr for 12 months ~= €1268.25", () => {
  near(futureValueOfContributions(100, 12, 12, 0), 1268.250301, 1e-3);
});

test("requiredContribution: inverse of futureValueOfContributions round-trips to €100/mo", () => {
  near(requiredContribution(1268.250301, 12, 12, 0).monthly, 100, 1e-2);
});

test("requiredContribution: a starting balance lowers the contribution needed", () => {
  const none = requiredContribution(1268.250301, 12, 12, 0).monthly;
  const some = requiredContribution(1268.250301, 12, 12, 500).monthly;
  assert.ok(some < none);
});
