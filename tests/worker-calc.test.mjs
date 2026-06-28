import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const call = (method, path, body, headers = {}) =>
  worker.fetch(new Request("https://x" + path, {
    method,
    headers: body !== undefined ? { ...headers, "content-type": "application/json" } : headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }), {}); // calc routes need no env

test("GET /api/calc lists the calculators", async () => {
  const r = await call("GET", "/api/calc");
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.ok(Array.isArray(b.calculators) && b.calculators.includes("amortization"));
  assert.equal(r.headers.get("access-control-allow-origin"), "*");
});

test("POST calculators return the Phase-1 vectors", async () => {
  let r = await call("POST", "/api/calc/cagr", { begin: 100, end: 200, years: 10 });
  assert.equal(r.status, 200);
  assert.ok(Math.abs((await r.json()).value - 0.0717734625) < 1e-9);

  r = await call("POST", "/api/calc/amortization", { amount: 100000, rate: 6, mode: "term", termYears: 30, startDate: "2020-01-01" });
  const a = await r.json();
  assert.equal(a.monthlyPayment, 599.55);
  assert.equal(a.payments, 360);

  r = await call("POST", "/api/calc/fx-convert", { amount: 100, rate: 1.1 });
  assert.ok(Math.abs((await r.json()).value - 110) < 1e-9);

  r = await call("POST", "/api/calc/loan-payoff", { amount: 100000, rate: 6, mode: "term", termYears: 30, startDate: "2020-01-01", extraMonthly: 200 });
  const p = await r.json();
  assert.ok(p.monthsSaved > 0 && p.interestSaved > 0);
});

test("CORS preflight, unknown calc, wrong method, and bad body are handled", async () => {
  assert.equal((await call("OPTIONS", "/api/calc/cagr")).status, 204);
  assert.equal((await call("POST", "/api/calc/nope", {})).status, 404);
  assert.equal((await call("GET", "/api/calc/cagr")).status, 405); // index is GET; a specific calc needs POST
  const bad = await worker.fetch(new Request("https://x/api/calc/cagr", { method: "POST", headers: { "content-type": "application/json" }, body: "{nope" }), {});
  assert.equal(bad.status, 400);
});

test("calc endpoints never touch storage (no env access)", async () => {
  // env is {} above; if any calc route read env.DB it would throw. All pass, so they do not.
  const r = await call("POST", "/api/calc/future-value", { principal: 1000, annualRatePct: 7, years: 10 });
  assert.equal(r.status, 200);
  assert.ok(Math.abs((await r.json()).value - 1967.151357) < 1e-3);
});
