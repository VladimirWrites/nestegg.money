/* The editors, as a set.
 *
 * An editor is a full-screen layer over the app — an asset, a salary, a year. Three different
 * places open them and three different things close them (the arrow in the editor's own bar, the
 * Escape key, the system Back button, and now a tab in the navigation), so the list of which
 * they are and how to shut one lives here rather than in whichever file happened to need it
 * first.
 *
 * Closing always goes through the editor's own Back button rather than reaching into its state,
 * so every route out runs exactly what the arrow runs: the sync, and the re-render underneath.
 *
 * The order is topmost first. The asset editor opens over the year editor, so a request to close
 * "the" editor has to mean the one actually on top, or Escape shuts the screen behind the one
 * being looked at.
 *
 * Imports nothing but the DOM helper, so it can be used by the modules that own the editors
 * without forming a cycle with them.
 */
import { $ } from "./dom.js";

export const EDITOR_BACK = { assetEditor: "assetBack", salaryEditor: "salaryBack", yearEditor: "edBack" };
const EDITOR_COUNT = Object.keys(EDITOR_BACK).length;

// The open editor nearest the reader, or null when the app itself is what is on screen.
export function topEditor() {
  for (const id in EDITOR_BACK) {
    const ed = $(id);
    if (ed && !ed.classList.contains("hide")) return id;
  }
  return null;
}

export const anyEditorOpen = () => topEditor() !== null;

// Shut the topmost one. True if there was one to shut.
export function closeTopEditor() {
  const id = topEditor();
  if (!id) return false;
  const back = $(EDITOR_BACK[id]);
  if (!back) return false;
  back.click();
  return true;
}

/* Shut all of them, for going somewhere else entirely rather than stepping back one layer.
   Bounded because it is a loop over the effect of a click: an editor that somehow refused to
   close would otherwise spin here forever. */
export function closeAllEditors() {
  let closed = false;
  for (let i = 0; i < EDITOR_COUNT && closeTopEditor(); i++) closed = true;
  return closed;
}
