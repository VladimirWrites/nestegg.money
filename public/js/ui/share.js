// Profile "Share a read-only link" dialog: choose sections, create a link, and manage
// (revoke) the shares already published. All the crypto/network lives in io/share.js — this is
// just the wiring.
import { state } from "../domain/store.js";
import { $, toast } from "./dom.js";
import { copyText } from "../io/crypto.js";
import { SHARE_SECTIONS } from "../domain/snapshot.js";
import { createShare, revokeShare } from "../io/share.js";

const modal = $("shareModal");
if (modal) {
  // Render the section checkboxes once (Net worth pre-checked as the common case).
  $("shareSecs").innerHTML = SHARE_SECTIONS.map(
    (s) => `<label class="share-sec"><input type="checkbox" data-sec="${s.key}"${s.key === "networth" ? " checked" : ""}> ${s.label}</label>`,
  ).join("");

  const open = () => { renderList(); resetResult(); modal.classList.remove("hide"); };
  const close = () => modal.classList.add("hide");
  $("shareBtn").onclick = open;
  $("shareClose").onclick = close;
  modal.onclick = (e) => { if (e.target === modal) close(); };

  $("shareCreate").onclick = async () => {
    const sel = {};
    modal.querySelectorAll("#shareSecs input[data-sec]").forEach((c) => { sel[c.dataset.sec] = c.checked; });
    if (!Object.values(sel).some(Boolean)) { toast("Pick at least one section to include"); return; }

    const btn = $("shareCreate");
    btn.disabled = true;
    const label = $("shareLabel").value.trim();
    try {
      const { link } = await createShare(sel, label);
      $("shareLinkOut").value = link;
      $("shareResult").classList.remove("hide");
      $("shareLabel").value = "";
      renderList();
      // Best-effort auto-copy; the Copy button is the reliable fallback.
      if (await copyText(link)) toast("Link created and copied");
      else toast("Link created");
    } catch (e) {
      toast((e && e.message) || "Could not create the share link");
    } finally {
      btn.disabled = false;
    }
  };

  $("shareCopy").onclick = async () => {
    toast((await copyText($("shareLinkOut").value)) ? "Copied" : "Copy failed — select and copy manually");
  };
}

function resetResult() {
  $("shareResult").classList.add("hide");
  $("shareLinkOut").value = "";
}

function renderList() {
  const box = $("shareList");
  const shares = (state.shares || []).slice().sort((a, b) => b.created - a.created);
  if (!shares.length) { box.innerHTML = `<div class="synced">No active links.</div>`; return; }
  const now = Date.now();
  box.innerHTML = shares.map((s) => {
    const expired = s.expires && s.expires <= now;
    const when = s.expires ? new Date(s.expires).toLocaleDateString() : "—";
    const status = expired ? `expired ${when}` : `expires ${when}`;
    const name = (s.label || "Untitled link").replace(/</g, "&lt;");
    return `<div class="share-row"><div class="share-row-meta"><div class="share-row-name">${name}</div><div class="synced">${status}</div></div><button class="act ghost danger" data-revoke="${s.id}">Revoke</button></div>`;
  }).join("");
  box.querySelectorAll("[data-revoke]").forEach((b) => {
    b.onclick = async () => {
      b.disabled = true;
      await revokeShare(b.dataset.revoke);
      renderList();
      toast("Link revoked");
    };
  });
}
