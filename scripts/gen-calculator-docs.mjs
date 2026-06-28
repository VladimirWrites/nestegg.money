// Generates public/docs/calculators.md from the calculator registry (the single source of truth),
// so every calculator is documented with its description, inputs, and outputs, and the doc can
// never drift from the code. Run: `npm run gen-docs`.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CALCULATORS, CALC_VERSION } from "../src/calculators.js";

const names = Object.keys(CALCULATORS);

const HEADER = `# nestegg calculators

Deterministic, pure finance calculators (version ${CALC_VERSION}). Every function depends only on
its inputs: none read user data, fetch live prices, or look up exchange rates or tax tables. Where
current statutory figures are needed (e.g. German payroll), they are passed in as arguments. Money
is rounded half-up to two decimals (the app's \`round2\`); rates are in percent unless noted; dates
are ISO strings (\`YYYY-MM-DD\`). The shared implementation is \`public/lib/finance-math.js\`.

Each calculator is reachable two ways: as a JSON endpoint (\`POST /api/calc/<name>\` with the inputs
as the JSON body) and as an MCP tool (Streamable HTTP at \`/mcp\`, same name and inputs, with a typed
\`outputSchema\`). \`GET /api/calc\` lists them. Both are stateless, CORS-open, and need no auth.

> This file is generated from the registry by \`scripts/gen-calculator-docs.mjs\` — do not edit by
> hand; run \`npm run gen-docs\` after changing a calculator. ${names.length} calculators.
`;

function typeLabel(spec) {
  if (!spec) return "any";
  if (Array.isArray(spec.enum)) return `${spec.type || "string"}, one of: ${spec.enum.join(", ")}`;
  if (spec.type === "array") return spec.items && spec.items.type === "object" ? "array of objects" : `array of ${(spec.items && spec.items.type) || "values"}`;
  return spec.type || "object";
}

let md = HEADER;
for (const name of names) {
  const c = CALCULATORS[name];
  md += `\n## ${name}\n\n${c.description}\n\n`;
  md += `**Endpoint:** \`POST /api/calc/${name}\` · **MCP tool:** \`${name}\`\n`;

  const props = (c.inputSchema && c.inputSchema.properties) || {};
  const required = new Set((c.inputSchema && c.inputSchema.required) || []);
  if (Object.keys(props).length) {
    md += `\nInputs:\n\n`;
    for (const [k, spec] of Object.entries(props)) {
      md += `- \`${k}\`${required.has(k) ? " *(required)*" : ""} — ${typeLabel(spec)}${spec.description ? `: ${spec.description}` : ""}\n`;
    }
  }

  const out = (c.outputSchema && c.outputSchema.properties) || {};
  if (Object.keys(out).length) {
    md += `\nOutputs:\n\n`;
    for (const [k, spec] of Object.entries(out)) {
      md += `- \`${k}\`${spec.description ? ` — ${spec.description}` : ""}\n`;
    }
  }
}

const outPath = fileURLToPath(new URL("../public/docs/calculators.md", import.meta.url));
writeFileSync(outPath, md);
console.log(`Wrote ${names.length} calculators to ${outPath}`);
