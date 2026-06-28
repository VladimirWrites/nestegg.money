import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const mcp = (msg) => worker.fetch(new Request("https://x/mcp", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(msg),
}), {});

test("initialize advertises the tools capability and server info", async () => {
  const r = await mcp({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("access-control-allow-origin"), "*");
  const j = await r.json();
  assert.equal(j.result.protocolVersion, "2025-06-18");
  assert.ok(j.result.capabilities.tools);
  assert.equal(j.result.serverInfo.name, "nestegg-calculators");
});

test("tools/list returns all twenty-eight calculators with input schemas and read-only annotations", async () => {
  const j = await (await mcp({ jsonrpc: "2.0", id: 2, method: "tools/list" })).json();
  assert.equal(j.result.tools.length, 28);
  const names = j.result.tools.map((t) => t.name);
  assert.ok(names.includes("amortization") && names.includes("cagr"));
  assert.ok(["fire-number", "required-contribution", "inflation-adjust", "effective-rate", "npv", "irr", "refi-breakeven", "emergency-fund"].every((n) => names.includes(n)));
  assert.ok(["mortgage-affordability", "debt-payoff", "portfolio-longevity"].every((n) => names.includes(n)));
  assert.ok(["present-value", "required-return", "yield-to-maturity", "tax-from-brackets", "margin-markup", "compound-interest"].every((n) => names.includes(n)));
  assert.ok(["de-gross-to-net", "vat"].every((n) => names.includes(n)));
  assert.ok(j.result.tools.every((t) => t.inputSchema && t.inputSchema.type === "object"));
  assert.ok(j.result.tools.every((t) => t.annotations && t.annotations.readOnlyHint === true && t.annotations.idempotentHint === true));
});

test("tools/call reaches the new calculators (fire-number, debt-payoff)", async () => {
  let j = await (await mcp({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "fire-number", arguments: { annualSpend: 40000 } } })).json();
  assert.equal(j.result.isError, undefined);
  assert.equal(j.result.structuredContent.target, 1000000);

  j = await (await mcp({ jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "debt-payoff", arguments: { debts: [{ name: "A", balance: 1000, rate: 5, minPayment: 25 }, { name: "B", balance: 2000, rate: 20, minPayment: 25 }], monthlyBudget: 200, method: "avalanche" } } })).json();
  assert.equal(j.result.structuredContent.payoffOrder[0], "B");
});

test("tools/call returns the Phase-1 vectors (text + structuredContent)", async () => {
  let j = await (await mcp({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "amortization", arguments: { amount: 100000, rate: 6, mode: "term", termYears: 30, startDate: "2020-01-01" } } })).json();
  assert.equal(j.result.isError, undefined);
  assert.equal(j.result.structuredContent.monthlyPayment, 599.55);
  assert.ok(JSON.parse(j.result.content[0].text).monthlyPayment === 599.55);

  j = await (await mcp({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "cagr", arguments: { begin: 100, end: 200, years: 10 } } })).json();
  assert.ok(Math.abs(j.result.structuredContent.value - 0.0717734625) < 1e-9);
});

test("tools/call on an unknown tool is a tool error, not a transport error", async () => {
  const j = await (await mcp({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "nope", arguments: {} } })).json();
  assert.equal(j.result.isError, true);
});

test("unknown method -> JSON-RPC method-not-found; notification -> 202 no body", async () => {
  const j = await (await mcp({ jsonrpc: "2.0", id: 6, method: "bogus" })).json();
  assert.equal(j.error.code, -32601);
  const n = await mcp({ jsonrpc: "2.0", method: "notifications/initialized" });
  assert.equal(n.status, 202);
});
