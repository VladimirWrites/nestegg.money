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
    const val = a[key];
    if (val === undefined || val === null) continue;
    if (!spec) continue;
    if (spec.type && !typeOk(val, spec.type)) { errors.push(`field ${key} must be ${spec.type}`); continue; }
    if (Array.isArray(spec.enum) && !spec.enum.includes(val)) errors.push(`field ${key} must be one of: ${spec.enum.join(", ")}`);
    if (typeof spec.minimum === "number" && typeof val === "number" && val < spec.minimum) errors.push(`field ${key} must be >= ${spec.minimum}`);
  }
  return { ok: errors.length === 0, errors };
}
