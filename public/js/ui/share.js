// Profile "Share a read-only link" dialog: choose sections, create a link, and manage
// (revoke) the shares already published. All the crypto/network lives in io/share.js — this is
// just the wiring.
import { state } from "../domain/store.js";
import { $, toast } from "./dom.js";
import { copyText } from "../io/crypto.js";
import { SHARE_SECTIONS } from "../domain/snapshot.js";
import { createShare, revokeShare } from "../io/share.js";
import { t, getLocale } from "../i18n.js";

const modal = $("shareModal");
if (modal) {
  // Render the section checkboxes on open, not at module load — that runs before initI18n,
  // and re-rendering per open keeps their labels (share.sec.*) in the active locale. Any
  // previously ticked boxes reset to the default (Net worth) each time, as before.
  const renderSecs = () => {
    $("shareSecs").innerHTML = SHARE_SECTIONS.map(
      (s) => `<label class="share-sec"><input type="checkbox" data-sec="${s.key}"${s.key === "networth" ? " checked" : ""}> ${t("share.sec." + s.key)}</label>`,
    ).join("");
  };

  const open = () => { renderSecs(); renderList(); resetResult(); modal.classList.remove("hide"); };
  const close = () => modal.classList.add("hide");
  $("shareBtn").onclick = open;
  $("shareClose").onclick = close;
  modal.onclick = (e) => { if (e.target === modal) close(); };

  $("shareCreate").onclick = async () => {
    const sel = {};
    modal.querySelectorAll("#shareSecs input[data-sec]").forEach((c) => { sel[c.dataset.sec] = c.checked; });
    if (!Object.values(sel).some(Boolean)) { toast(t("share.pickOne")); return; }

    const btn = $("shareCreate");
    btn.disabled = true;
    const prevLabel = btn.textContent;
    btn.textContent = t("share.creating");
    const label = $("shareLabel").value.trim();
    try {
      const { link } = await createShare(sel, label);
      $("shareLinkOut").value = link;
      $("shareResult").classList.remove("hide");
      $("shareLabel").value = "";
      renderList();
      // Best-effort auto-copy; the Copy button is the reliable fallback.
      if (await copyText(link)) toast(t("share.createdCopied"));
      else toast(t("share.created"));
    } catch (e) {
      toast((e && e.message) || t("share.createFailed"));
    } finally {
      btn.disabled = false;
      btn.textContent = prevLabel;
    }
  };

  $("shareCopy").onclick = async () => {
    toast((await copyText($("shareLinkOut").value)) ? t("common.copied") : t("share.copyFail"));
  };
}

function resetResult() {
  $("shareResult").classList.add("hide");
  $("shareLinkOut").value = "";
}

function renderList() {
  const box = $("shareList");
  const shares = (state.shares || []).slice().sort((a, b) => b.created - a.created);
  if (!shares.length) { box.innerHTML = `<div class="synced">${t("share.noActive")}</div>`; return; }
  const now = Date.now();
  box.innerHTML = shares.map((s) => {
    const expired = s.expires && s.expires <= now;
    const when = s.expires ? new Date(s.expires).toLocaleDateString(getLocale()) : "—";
    const status = expired ? t("share.expired", { date: when }) : t("share.expires", { date: when });
    const name = (s.label || t("share.untitled")).replace(/</g, "&lt;");
    return `<div class="share-row"><div class="share-row-meta"><div class="share-row-name">${name}</div><div class="synced">${status}</div></div><button class="btn btn-sm btn-danger" data-revoke="${s.id}">${t("share.revoke")}</button></div>`;
  }).join("");
  box.querySelectorAll("[data-revoke]").forEach((b) => {
    b.onclick = async () => {
      b.disabled = true;
      await revokeShare(b.dataset.revoke);
      renderList();
      toast(t("share.revoked"));
    };
  });
}
