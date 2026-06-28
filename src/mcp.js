// Remote MCP server (Streamable HTTP) wrapping the calculators as tools. Stateless: no
// sessions, no storage. Each calculator is one tool; logic lives in lib/finance-math.js via
// the shared registry, so nothing is duplicated. A POST carries one JSON-RPC message (or a
// batch) and gets a single JSON response; notifications get a 202 with no body.
import { CALCULATORS, CORS } from "./calculators.js";
import { validateArgs } from "./validate.js";

const DEFAULT_PROTOCOL = "2025-06-18";
const rpc = (id, result) => ({ jsonrpc: "2.0", id, result });
const rpcErr = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

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
        capabilities: { tools: {} },
        serverInfo: { name: "nestegg-calculators", version: "1.0.0" },
        instructions: "Deterministic personal-finance calculators. Each tool is a pure function of its inputs: no user data, no live prices, no FX lookup (pass the rate as input). Returns numbers and schedules, never financial advice.",
      });
    case "ping":
      return rpc(id, {});
    case "tools/list":
      // Every calculator is a pure function: read-only and idempotent. Advertise that so
      // clients can call freely without confirmation prompts.
      return rpc(id, {
        tools: Object.entries(CALCULATORS).map(([name, c]) => ({
          name, description: c.description, inputSchema: c.inputSchema,
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
        return rpc(id, { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result });
      } catch (e) {
        return rpc(id, { content: [{ type: "text", text: "Calculation failed: " + String((e && e.message) || e) }], isError: true });
      }
    }
    default:
      return rpcErr(id, -32601, "Method not found: " + method);
  }
}

// A JSON-RPC notification has no id (and is not a response we must answer).
const isNotification = (m) => m && m.id === undefined && typeof m.method === "string";

export async function mcpRoute(request) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") return send(rpcErr(null, -32000, "Use POST for MCP messages."), 405);
  let body;
  try { body = await request.json(); } catch (e) { return send(rpcErr(null, -32700, "Parse error"), 400); }

  if (Array.isArray(body)) {
    const responses = body.filter((m) => !isNotification(m)).map(handle);
    return responses.length ? send(responses) : new Response(null, { status: 202, headers: CORS });
  }
  if (isNotification(body)) return new Response(null, { status: 202, headers: CORS });
  return send(handle(body));
}
