// Minimal JSON-Schema argument validator for the calculator tools: checks required presence
// and the declared `type` of provided properties. Not a full validator — just enough to turn
// silent coercion (e.g. mode "term" with no termYears) into a clear, actionable error.
const typeOk = (val, type) => {
  switch (type) {
    case "number": return typeof val === "number" && !Number.isNaN(val);
    case "string": return typeof val === "string";
    case "boolean": return typeof val === "boolean";
    case "array": return Array.isArray(val);
    case "object": return val !== null && typeof val === "object" && !Array.isArray(val);
    default: return true; // unknown/declared-less property: accept
  }
};

export function validateArgs(inputSchema, args) {
  const errors = [];
  const props = (inputSchema && inputSchema.properties) || {};
  const required = (inputSchema && inputSchema.required) || [];
  const a = args || {};
  for (const key of required) {
    if (a[key] === undefined || a[key] === null) errors.push(`missing required field: ${key}`);
  }
  for (const [key, spec] of Object.entries(props)) {
    if (a[key] === undefined || a[key] === null) continue;
    if (spec && spec.type && !typeOk(a[key], spec.type)) errors.push(`field ${key} must be ${spec.type}`);
  }
  return { ok: errors.length === 0, errors };
}
