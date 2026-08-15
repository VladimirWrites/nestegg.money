/* The system Back button.
 *
 * Installed on Android, the app is a browser window with no address bar, so Back is whatever
 * the history stack says it is. Nothing here pushed anything, which left one entry — the cold
 * load — and every press of Back closed the app: from an editor, from the Profile tab, from
 * anywhere. The arrow drawn in an editor's own bar went somewhere; the one on the phone left.
 *
 * Modelled on nextly.tv, which resolves this in two parts.
 *
 * Tabs are places you switch between rather than places you go into, so walking back out
 * through every tab you happened to visit would be wrong — three taps around the bar should
 * not cost three presses of Back to leave. But no entry at all is what closes the app from a
 * tab you obviously arrived at from somewhere. So: one entry, not none. The first step away
 * from Net worth is pushed; moving between the other three replaces, so there is never more
 * than one of them on the stack. Back from Salary, Budget or Profile lands on Net worth, and
 * Back from Net worth leaves, which is what Back does everywhere else on the platform.
 * Returning to Net worth is a step back rather than a third entry, or Net worth would be
 * reachable by Back and then still be sitting on top of the tab it was reached from.
 *
 * An editor is a place you tapped into, so it pushes an entry of its own and Back closes it —
 * the same press, the same result as the arrow in its bar. Closing it by the arrow consumes
 * that entry, so Back never has to be pressed twice for one screen.
 *
 * No imports: this is wired by whoever owns the views and the editors, so it can't form a
 * cycle with them.
 */

const HOME = "net";

let renderView = () => {};      // paint a view, without touching history
let closeTopEditor = () => false; // shut the open editor, if there is one; true if it closed
let current = HOME;
let expectPop = false;          // we asked for this pop ourselves
let inPop = false;              // closing because a pop arrived, rather than the other way round
let skipped = 0;                // consecutive dead editor entries stepped over
const MAX_SKIP = 3;             // there are three editors; more than that is a bug, not a stack

const stateOf = () => history.state || {};
const depth = () => stateOf().depth || 0;

/* Called once at boot, after the first view is on screen. The entry a cold load starts on
   carries no state of ours, so it is given some — otherwise the first Back looks like a step
   out of a screen we never recorded arriving at. */
export function initHistory({ onView, onCloseEditor, view = HOME }) {
  renderView = onView || renderView;
  closeTopEditor = onCloseEditor || closeTopEditor;
  current = view;
  try { history.scrollRestoration = "manual"; } catch (e) {}
  history.replaceState({ view, depth: 0 }, "");

  addEventListener("popstate", () => {
    // A pop we caused by closing an editor ourselves: the editor is already shut, and the
    // entry it owned is what just went. Nothing else should happen.
    if (expectPop) { expectPop = false; return; }
    // An editor is a layer over the app: Back shuts that before it moves between views. The
    // close routine is the same one the arrow in its bar runs, so it syncs and re-renders the
    // way it always did — and its call to popEditor is ignored while this flag is up, since
    // the entry it would spend is the one that just went.
    inPop = true;
    try { if (closeTopEditor()) return; } finally { inPop = false; }
    /* An editor's address with nothing open at it.
     *
     * Left by tapping a tab rather than by stepping back, so the entry underneath the one that
     * was rewritten has no screen behind it any more. Stepping over it here is what popEditor
     * does for the ordinary route out; without it, Back from the tab would land on Net worth and
     * then need pressing again for nothing to happen. Bounded by the number of editors there
     * are, so a stack of them cannot turn this into a walk out of the app. */
    if (stateOf().editor && skipped < MAX_SKIP) { skipped++; expectPop = false; history.back(); return; }
    skipped = 0;
    const view = stateOf().view || HOME;
    current = view;
    renderView(view);
  });
}

/* A tab was tapped. Returns nothing — the caller paints, as it always did. */
export function navView(view) {
  if (view === current) return;
  if (view === HOME) {
    // Back rather than a new entry, so Net worth is never stacked on top of the tab that
    // reached it. Only when there is one of ours to go back to.
    if (depth() > 0) { expectPop = true; current = view; history.back(); return; }
    history.replaceState({ view, depth: 0 }, "");
  } else if (current === HOME) {
    history.pushState({ view, depth: depth() + 1 }, "");
  } else {
    // Already one tab deep. Stay at that depth so the side tabs share a single entry.
    history.replaceState({ view, depth: depth() }, "");
  }
  current = view;
}

/* An editor opened. It is a place of its own, so it gets an entry of its own. */
export function pushEditor(id) {
  history.pushState({ view: current, depth: depth() + 1, editor: id }, "");
}

/* A tab was tapped while an editor was open — a jump out of the layer rather than a step back
   through it.
 *
 * The editor's entry is rewritten as the tab's instead of being spent: going back has to lead
 * out of the pair, not into an editor that is no longer open. Which means the close routine must
 * not spend it on the way out either, hence keepingEntry around the closing.
 */
export function navOverEditor(view) {
  if (!stateOf().editor) { navView(view); return; }
  history.replaceState({ view, depth: depth() }, "");
  current = view;
}

/* Run a close routine without letting it spend the entry its editor pushed — for the caller
   that is about to put something else at that address. */
export function keepingEntry(fn) {
  const was = inPop;
  inPop = true;
  try { return fn(); } finally { inPop = was; }
}

/* An editor was closed by its own Back arrow rather than by the system's. The entry it pushed
   is still on the stack, so it is spent here — otherwise the next press of Back would land on
   the editor's address with nothing open, and appear to do nothing at all. */
export function popEditor() {
  if (inPop) return;               // the entry it would spend is the one that just went
  if (!stateOf().editor) return;
  expectPop = true;
  history.back();
}

// The view the stack believes we are on — for anything that needs to ask rather than assume.
export const currentView = () => current;
