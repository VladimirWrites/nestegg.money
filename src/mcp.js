// Remote MCP server (Streamable HTTP) wrapping the calculators as tools. Stateless: no
// sessions, no storage. Each calculator is one tool; logic lives in lib/finance-math.js via
// the shared registry, so nothing is duplicated. A POST carries one JSON-RPC message (or a
// batch) and gets a single JSON response; notifications get a 202 with no body.
import { CALCULATORS, CORS, CALC_VERSION } from "./calculators.js";
import { validateArgs } from "./validate.js";
import { RESOURCES, PROMPTS } from "./resources.js";

const DEFAULT_PROTOCOL = "2025-06-18";
const rpc = (id, result) => ({ jsonrpc: "2.0", id, result });
const rpcErr = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

// Render a calculator result as a one-line human summary for the text content block (clients
// without structuredContent support, and humans reading a chat). Machines use structuredContent.
function humanizeResult(result) {
  if (result == null || typeof result !== "object") return String(result);
  const parts = [];
  for (const [k, v] of Object.entries(result)) {
    let s;
    if (v instanceof Date) s = v.toISOString().slice(0, 10);
    else if (Array.isArray(v)) s = `${v.length} rows`;
    else if (v && typeof v === "object") s = "{…}";
    else s = `${v}`;
    parts.push(`${k}: ${s}`);
  }
  return parts.join(" · ");
}

function send(obj, status = 200) {
  return new Response(obj === null ? null : JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...CORS },
  });
}

function handle(msg) {
  const { id, method, params } = msg || {};
  switch (method) {
    case "initialize":
      return rpc(id, {
        protocolVersion: (params && params.protocolVersion) || DEFAULT_PROTOCOL,
        capabilities: { tools: {}, resources: {}, prompts: {} },
        serverInfo: { name: "nestegg-calculators", version: "1.0.0", calcVersion: CALC_VERSION },
        instructions: "Deterministic personal-finance calculators. Each tool is a pure function of its inputs: no user data, no live prices, no FX lookup (pass the rate as input). Returns numbers and schedules, never financial advice.",
      });
    case "ping":
      return rpc(id, {});
    case "tools/list":
      // Every calculator is a pure function: read-only and idempotent. Advertise that so
      // clients can call freely without confirmation prompts.
      return rpc(id, {
        tools: Object.entries(CALCULATORS).map(([name, c]) => ({
          name, description: c.description, inputSchema: c.inputSchema, outputSchema: c.outputSchema,
          annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
        })),
      });
    case "tools/call": {
      const name = params && params.name;
      const args = (params && params.arguments) || {};
      const c = CALCULATORS[name];
      if (!c) return rpc(id, { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true });
      const v = validateArgs(c.inputSchema, args);
      if (!v.ok) return rpc(id, { content: [{ type: "text", text: "Invalid arguments: " + v.errors.join("; ") }], isError: true });
      try {
        const result = c.run(args);
        return rpc(id, { content: [{ type: "text", text: humanizeResult(result) }], structuredContent: result, _meta: { calcVersion: CALC_VERSION } });
      } catch (e) {
        return rpc(id, { content: [{ type: "text", text: "Calculation failed: " + String((e && e.message) || e) }], isError: true });
      }
    }
    case "resources/list":
      return rpc(id, { resources: RESOURCES.map(({ uri, name, mimeType, description }) => ({ uri, name, mimeType, description })) });
    case "prompts/list":
      return rpc(id, { prompts: PROMPTS.map(({ name, description, arguments: args }) => ({ name, description, arguments: args })) });
    case "prompts/get": {
      const p = PROMPTS.find((x) => x.name === (params && params.name));
      if (!p) return rpcErr(id, -32602, "Unknown prompt: " + (params && params.name));
      const args = (params && params.arguments) || {};
      const text = p.template.replace(/\{(\w+)\}/g, (_, k) => (args[k] != null ? String(args[k]) : `{${k}}`));
      return rpc(id, { description: p.description, messages: [{ role: "user", content: { type: "text", text } }] });
    }
    default:
      return rpcErr(id, -32601, "Method not found: " + method);
  }
}

// resources/read needs async access to the ASSETS binding, so it is handled in mcpRoute (which
// is async) rather than in the sync handle() dispatch.
async function readResource(id, params, env) {
  const uri = params && params.uri;
  const res = RESOURCES.find((r) => r.uri === uri);
  if (!res) return rpcErr(id, -32602, "Unknown resource: " + uri);
  if (!env || !env.ASSETS) return rpcErr(id, -32000, "Resource reading unavailable (no ASSETS binding)");
  const r = await env.ASSETS.fetch(new Request(new URL(res.path, "https://nestegg.money")));
  const text = await r.text();
  return rpc(id, { contents: [{ uri, mimeType: res.mimeType, text }] });
}

// A JSON-RPC notification has no id (and is not a response we must answer).
const isNotification = (m) => m && m.id === undefined && typeof m.method === "string";

export async function mcpRoute(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") return send(rpcErr(null, -32000, "Use POST for MCP messages."), 405);
  let body;
  try { body = await request.json(); } catch (e) { return send(rpcErr(null, -32700, "Parse error"), 400); }

  // resources/read is async (reads the ASSETS binding) — handle it before the sync dispatch.
  if (!Array.isArray(body) && body && body.method === "resources/read") {
    return send(await readResource(body.id, body.params, env));
  }

  if (Array.isArray(body)) {
    const responses = body.filter((m) => !isNotification(m)).map(handle);
    return responses.length ? send(responses) : new Response(null, { status: 202, headers: CORS });
  }
  if (isNotification(body)) return new Response(null, { status: 202, headers: CORS });
  return send(handle(body));
}
