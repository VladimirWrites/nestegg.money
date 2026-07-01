// Read-only share links. Build a frozen snapshot of the chosen sections, encrypt it under a
// fresh per-share key (independent of the account number), store the ciphertext server-side, and
// hand back a link whose fragment carries the id + key. Revoking deletes the server row.
//
// Zero-knowledge is preserved end to end: the server sees a random id, opaque ciphertext, and an
// expiry — never the key (it lives only in the URL fragment) and never a link to the account.
import { state } from "../domain/store.js";
import { buildSnapshot } from "../domain/snapshot.js";
import { encWith, genShareKey, exportShareKey, randShareId } from "./crypto.js";
import { scheduleSync } from "./storage.js";

// Publish a snapshot: encrypt under a new key, POST the ciphertext, record the link locally.
// Returns { link, id, expires } on success; throws on any failure so the UI can report it.
export async function createShare(sel, label) {
  const snap = buildSnapshot(sel);
  const key = await genShareKey();
  const keyStr = await exportShareKey(key);
  const blob = await encWith(snap, key);
  const id = randShareId();

  const r = await fetch("/api/share", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, blob }),
  });
  if (!r.ok) {
    if (r.status === 429) throw new Error("Too many new shares from your network right now — try again later.");
    throw new Error("Could not create the share link.");
  }
  const { expires_at } = await r.json();

  if (!Array.isArray(state.shares)) state.shares = [];
  state.shares.push({ id, label: label || "", created: Date.now(), expires: expires_at });
  scheduleSync();

  return { link: shareLink(id, keyStr), id, expires: expires_at };
}

// Revoke a share: delete the server row and drop it from the local record. Best-effort on the
// network call — the local entry is removed regardless so the list reflects the user's intent.
export async function revokeShare(id) {
  try {
    await fetch("/api/share", { method: "DELETE", headers: { "X-Share-Id": id } });
  } catch (e) { /* remove locally even if the network call fails */ }
  if (Array.isArray(state.shares)) state.shares = state.shares.filter((s) => s.id !== id);
  scheduleSync();
}

// The viewer link. id + key ride in the fragment (after #), which browsers never send to the
// server — so neither the key nor the id leaks via access logs or Referer.
export const shareLink = (id, keyStr) => `${location.origin}/s/#${id}.${keyStr}`;
