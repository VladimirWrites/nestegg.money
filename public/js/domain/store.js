// The single in-memory app state. A live ES-module binding: readers `import { state }`
// and see mutations and whole-document replacements (via setState, used by load/import/merge).
import { emptyState } from "./schema.js";

export let state = emptyState();

// Replace the whole state document (sign-in, import, merge result).
export function setState(s) {
  state = s;
}
