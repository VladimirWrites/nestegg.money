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
  assert.ok(j.result.serverInfo.calcVersion);
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

test("tools/list advertises an outputSchema for every tool", async () => {
  const j = await (await mcp({ jsonrpc: "2.0", id: 20, method: "tools/list" })).json();
  assert.ok(j.result.tools.every((t) => t.outputSchema && t.outputSchema.type === "object" && t.outputSchema.properties));
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
  assert.ok(j.result.content[0].text.includes("599.55")); // text is now a readable summary, not raw JSON
  assert.ok(j.result._meta && j.result._meta.calcVersion); // each result is stamped for auditability

  j = await (await mcp({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "cagr", arguments: { begin: 100, end: 200, years: 10 } } })).json();
  assert.ok(Math.abs(j.result.structuredContent.value - 0.0717734625) < 1e-9);
});

test("tools/call validates inputs — a missing required field is a tool error", async () => {
  const j = await (await mcp({ jsonrpc: "2.0", id: 90, method: "tools/call", params: { name: "future-value", arguments: { principal: 1000 } } })).json();
  assert.equal(j.result.isError, true);
  assert.ok(j.result.content[0].text.toLowerCase().includes("required"));
});

test("tools/call text is a human-readable summary and the result is stamped with calcVersion", async () => {
  const j = await (await mcp({ jsonrpc: "2.0", id: 92, method: "tools/call", params: { name: "future-value", arguments: { principal: 1000, annualRatePct: 7, years: 10 } } })).json();
  assert.ok(/value:/.test(j.result.content[0].text));      // readable "value: 1967.15…"
  assert.ok(!j.result.content[0].text.trim().startsWith("{")); // not raw JSON
  assert.ok(j.result._meta.calcVersion);
  assert.ok(j.result.structuredContent.value > 1967 && j.result.structuredContent.value < 1968);
});

test("tools/call rejects an out-of-enum value naming the allowed set", async () => {
  const j = await (await mcp({ jsonrpc: "2.0", id: 91, method: "tools/call", params: { name: "amortization", arguments: { amount: 100000, rate: 6, mode: "bogus", termYears: 30, startDate: "2020-01-01" } } })).json();
  assert.equal(j.result.isError, true);
  assert.ok(j.result.content[0].text.includes("term") && j.result.content[0].text.includes("payment"));
});

test("tools/call on an unknown tool is a tool error, not a transport error", async () => {
  const j = await (await mcp({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "nope", arguments: {} } })).json();
  assert.equal(j.result.isError, true);
});

test("initialize advertises resources and prompts capabilities", async () => {
  const j = await (await mcp({ jsonrpc: "2.0", id: 30, method: "initialize", params: {} })).json();
  assert.ok(j.result.capabilities.resources);
  assert.ok(j.result.capabilities.prompts);
});

test("resources/list exposes the calculator docs", async () => {
  const j = await (await mcp({ jsonrpc: "2.0", id: 31, method: "resources/list" })).json();
  assert.ok(j.result.resources.some((r) => r.uri.includes("calculators.md")));
  assert.ok(j.result.resources.every((r) => r.uri && r.name && r.mimeType));
});

test("resources/read without an ASSETS binding errors cleanly (env-less harness)", async () => {
  const j = await (await mcp({ jsonrpc: "2.0", id: 32, method: "resources/read", params: { uri: "https://nestegg.money/llms.txt" } })).json();
  assert.ok(j.error || (j.result && j.result.contents)); // error here (env={}), real bytes in prod
});

test("prompts/list and prompts/get return canned workflows with interpolation", async () => {
  const list = await (await mcp({ jsonrpc: "2.0", id: 33, method: "prompts/list" })).json();
  assert.ok(list.result.prompts.some((p) => p.name === "mortgage-plan"));
  const get = await (await mcp({ jsonrpc: "2.0", id: 34, method: "prompts/get", params: { name: "fire-check", arguments: { annualSpend: 40000 } } })).json();
  assert.ok(get.result.messages[0].content.text.includes("40000"));
});

test("unknown method -> JSON-RPC method-not-found; notification -> 202 no body", async () => {
  const j = await (await mcp({ jsonrpc: "2.0", id: 6, method: "bogus" })).json();
  assert.equal(j.error.code, -32601);
  const n = await mcp({ jsonrpc: "2.0", method: "notifications/initialized" });
  assert.equal(n.status, 202);
});
