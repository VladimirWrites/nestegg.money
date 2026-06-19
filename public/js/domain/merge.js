// Multi-device merge: per-record modified-times (m) + tombstones for deletions.
// Edits aren't stamped in every handler; instead stampMtimes() diffs the live state against
// the last-synced "baseline" to assign an m to each changed record and a tombstone to each
// removed one. mergeStates() then merges local+remote per record (newest m wins, deletions
// honoured) rather than letting one whole document overwrite the other.
import { DEL_KINDS } from "./constants.js";
import { ensureDel } from "./schema.js";
import { state } from "./store.js";

export const cloneState = (s) => JSON.parse(JSON.stringify(s));

// Snapshot of the last-synced state, used as the diff baseline by stampMtimes().
let baseline = null;
export function setBaseline() {
  try { baseline = cloneState(state); } catch (e) { baseline = null; }
}

// A record's signature ignoring its mtime — used to detect real content changes.
const sigNoM = (o) => { const c = { ...o }; delete c.m; return JSON.stringify(c); };

// Stamp a flat keyed collection: assign m to new/changed records, tombstone removed ones.
function stampFlat(cur, base, keyOf, now, tomb) {
  const bm = new Map((base || []).map((r) => [keyOf(r), r]));
  const seen = new Set();
  (cur || []).forEach((r) => {
    const id = keyOf(r);
    seen.add(id);
    const o = bm.get(id);
    if (!o) r.m = r.m || now;
    else if (sigNoM(r) !== sigNoM(o)) r.m = now;
    else r.m = r.m || o.m || 0;
  });
  bm.forEach((o, id) => { if (!seen.has(id)) tomb[id] = now; });
}

// Stamp a parent collection whose children are stamped individually (so two devices editing
// different rows of the same parent both win). `metaEq` compares parent metadata only.
function stampParented(cur, base, parentKey, childKey, metaEq, now, parentTomb, childTomb) {
  const bp = new Map((base || []).map((p) => [parentKey(p), p]));
  const seenP = new Set();
  (cur || []).forEach((p) => {
    const pk = parentKey(p);
    seenP.add(pk);
    const o = bp.get(pk);
    if (!o) p.m = p.m || now;
    else if (metaEq && !metaEq(p, o)) p.m = now;
    else p.m = p.m || o.m || 0;

    const be = new Map(((o && o.entries) || []).map((e) => [childKey(e), e]));
    const seenE = new Set();
    (p.entries || []).forEach((e) => {
      const ek = childKey(e);
      seenE.add(ek);
      const oe = be.get(ek);
      if (!oe) e.m = e.m || now;
      else if (sigNoM(e) !== sigNoM(oe)) e.m = now;
      else e.m = e.m || oe.m || 0;
    });
    be.forEach((oe, ek) => { if (!seenE.has(ek)) childTomb(pk, ek, now); });
  });
  bp.forEach((o, pk) => { if (!seenP.has(pk)) parentTomb[pk] = now; });
}

// Stamp the whole live state against the baseline. Mutates state in place.
export function stampMtimes() {
  const now = Date.now();
  const b = baseline || {};
  const del = ensureDel(state);

  stampFlat(state.assets, b.assets, (a) => a.id, now, del.asset);

  // Snapshots: the year is the record; entries are stamped individually.
  stampParented(
    state.snapshots, b.snapshots,
    (s) => String(s.year), (e) => e.id, null,
    now, del.snap, (_pk, id, t) => { del.yent[id] = t; },
  );

  // Salaries: one record per person; metadata is name/ccy/group; entries keyed by month.
  const salMeta = (p, o) => JSON.stringify([p.name, p.ccy, p.group]) === JSON.stringify([o.name, o.ccy, o.group]);
  stampParented(
    state.salaries, b.salaries,
    (p) => p.id, (e) => e.ym, salMeta,
    now, del.sper, (pk, ym, t) => { del.sent[pk + "|" + ym] = t; },
  );
}

// Merge two tombstone stores, keeping the latest time per id in each bucket.
export function mergeDel(a, b) {
  a = a || {};
  b = b || {};
  const out = {};
  DEL_KINDS.forEach((k) => {
    const o = {};
    Object.entries(a[k] || {}).forEach(([i, t]) => (o[i] = Math.max(o[i] || 0, t)));
    Object.entries(b[k] || {}).forEach(([i, t]) => (o[i] = Math.max(o[i] || 0, t)));
    out[k] = o;
  });
  return out;
}

// Merge a flat keyed collection: newest m wins; a tombstone beats any equal-or-older edit.
export function mergeArr(la, ra, keyOf, tomb) {
  const m = new Map();
  const add = (r) => {
    const id = keyOf(r);
    const mt = +r.m || 0;
    const t = tomb[id] || 0;
    if (t > 0 && t >= mt) return;
    const ex = m.get(id);
    if (!ex || (+ex.m || 0) < mt) m.set(id, r);
  };
  (la || []).forEach(add);
  (ra || []).forEach(add);
  return [...m.values()];
}

// A snapshot's effective mtime: the newest of the year record and its entries, so a
// year-deletion tombstone only wins over edits that are actually older.
const snapM = (s) => (s.entries || []).reduce((m, e) => Math.max(m, +e.m || 0), +s.m || 0);

// Generic parent+children merge (used for both snapshots and salaries).
function mergeParented(la, ra, parentKey, childKey, parentTombs, childTombKey, childTombs, parentEffM) {
  const A = new Map((la || []).map((p) => [parentKey(p), p]));
  const B = new Map((ra || []).map((p) => [parentKey(p), p]));
  const out = [];
  new Set([...A.keys(), ...B.keys()]).forEach((k) => {
    const pa = A.get(k);
    const pb = B.get(k);
    const pm = Math.max(pa ? parentEffM(pa) : 0, pb ? parentEffM(pb) : 0);
    if ((parentTombs[k] || 0) > 0 && (parentTombs[k] || 0) >= pm) return;
    const meta = ((pa ? +pa.m || 0 : 0) >= (pb ? +pb.m || 0 : 0) ? pa : pb) || pa || pb;
    const em = new Map();
    const addE = (e) => {
      const tt = childTombs[childTombKey(k, e)] || 0;
      const mt = +e.m || 0;
      if (tt > 0 && tt >= mt) return;
      const ex = em.get(childKey(e));
      if (!ex || (+ex.m || 0) < mt) em.set(childKey(e), e);
    };
    ((pa && pa.entries) || []).forEach(addE);
    ((pb && pb.entries) || []).forEach(addE);
    out.push(Object.assign({}, meta, { entries: [...em.values()] }));
  });
  return out;
}

export function mergeSnaps(la, ra, del) {
  return mergeParented(la, ra, (s) => String(s.year), (e) => e.id, del.snap, (_k, e) => e.id, del.yent, snapM);
}

export function mergeSal(la, ra, del) {
  return mergeParented(la, ra, (p) => p.id, (e) => e.ym, del.sper, (k, e) => k + "|" + e.ym, del.sent, (p) => +p.m || 0);
}

// Merge two whole states per record (newest m wins; tombstones win over older edits).
export function mergeStates(a, b) {
  const out = cloneState((+a.updatedAt || 0) >= (+b.updatedAt || 0) ? a : b);
  const del = mergeDel(a.del, b.del);
  out.del = del;
  out.assets = mergeArr(a.assets, b.assets, (x) => x.id, del.asset);
  out.snapshots = mergeSnaps(a.snapshots, b.snapshots, del);
  out.salaries = mergeSal(a.salaries, b.salaries, del);
  out.categories = [...new Set([...(a.categories || []), ...(b.categories || [])])];
  out.updatedAt = Math.max(+a.updatedAt || 0, +b.updatedAt || 0);
  return out;
}
