// Categories are global tags applied to net-worth entries and long-term assets. The list
// lives on state.categories; an item is "in" a category when its .group matches the name.
// These mutate state in place (the UI calls them, then re-renders + syncs).
import { state } from "./store.js";

// The global category list, plus any group still in use on an entry or asset (defensive,
// so a stray group from an import/merge still appears as a selectable category).
export function groupNames() {
  const s = new Set(state.categories || []);
  state.snapshots.forEach((sn) => (sn.entries || []).forEach((e) => { if (e.group) s.add(e.group); }));
  (state.assets || []).forEach((a) => { if (a.group) s.add(a.group); });
  return [...s];
}

// Add a new, uniquely-named category to the list; returns the chosen name.
export function addCategory(baseName = "New category") {
  if (!state.categories) state.categories = [];
  const taken = new Set(state.categories);
  let name = baseName, k = 2;
  while (taken.has(name)) name = baseName + " " + k++;
  state.categories.push(name);
  return name;
}

// How many entries + assets currently carry this category (for confirm prompts).
export function categoryUsage(name) {
  return state.snapshots.reduce((a, s) => a + (s.entries || []).filter((x) => x.group === name).length, 0)
    + (state.assets || []).filter((x) => x.group === name).length;
}

// Rename a category everywhere: the global list, every year's entries, and every asset.
export function renameCategory(oldName, newName) {
  const ci = (state.categories || []).indexOf(oldName);
  if (ci >= 0) state.categories[ci] = newName;
  state.snapshots.forEach((s) => (s.entries || []).forEach((en) => { if (en.group === oldName) en.group = newName; }));
  (state.assets || []).forEach((a) => { if (a.group === oldName) a.group = newName; });
}

// Remove a category: drop it from the list and clear the tag from every entry and asset.
// Nothing is deleted — tagged items simply lose the category.
export function removeCategory(name) {
  state.categories = (state.categories || []).filter((c) => c !== name);
  state.snapshots.forEach((s) => (s.entries || []).forEach((x) => { if (x.group === name) x.group = undefined; }));
  (state.assets || []).forEach((x) => { if (x.group === name) x.group = undefined; });
}
