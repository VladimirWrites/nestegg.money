// Account-number tokens, key derivation, and client-side encryption of the state blob.
// The account number is the only credential: a high-entropy base32 string the user keeps.
import { state } from "../domain/store.js";

const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford-style (no I/L/O/U)
const PBKDF2_ITERS = 310000; // key stretching, defence-in-depth over the high-entropy token

let accountId = null;
let cryptoKey = null;
export const getAccountId = () => accountId;
export const keysReady = () => !!(accountId && cryptoKey);

// Two-character Fletcher-style checksum over the base32 body: rejects typos and any string
// that isn't a genuine generated account number.
function tokChecksum(body) {
  let a = 1;
  let b = 0;
  for (const ch of body) {
    a = (a + B32.indexOf(ch)) % 32;
    b = (b + a) % 32;
  }
  return B32[a] + B32[b];
}

export function generateToken() {
  const bts = crypto.getRandomValues(new Uint8Array(16));
  let bits = 0;
  let val = 0;
  let o = "";
  for (const x of bts) {
    val = (val << 8) | x;
    bits += 8;
    while (bits >= 5) {
      o += B32[(val >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) o += B32[(val << (5 - bits)) & 31];
  return (o + tokChecksum(o)).match(/.{1,4}/g).join("-"); // 26 random + 2 check = 28 chars
}

// Uppercase, drop separators, map look-alikes (O->0, I/L->1) so a mistyped account number
// still resolves to the same key instead of locking the user out.
export const normTok = (t) => (t || "").toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");

export function validToken(t) {
  const n = normTok(t);
  if (n.length !== 28) return false;
  for (const ch of n) if (B32.indexOf(ch) < 0) return false;
  return tokChecksum(n.slice(0, 26)) === n.slice(26);
}

export const canonToken = (t) => normTok(t).match(/.{1,4}/g).join("-");

async function sha(s) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
}
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const b64 = (b) => {
  let s = "";
  for (const x of new Uint8Array(b)) s += String.fromCharCode(x);
  return btoa(s);
};
const unb64 = (s) => {
  const z = atob(s);
  const u = new Uint8Array(z.length);
  for (let i = 0; i < z.length; i++) u[i] = z.charCodeAt(i);
  return u.buffer;
};

export async function deriveKeys(tok) {
  const t = normTok(tok);
  const enc = new TextEncoder();
  // Account id: a fast one-way hash — only a storage label, and it's high-entropy.
  accountId = hex(await sha("nw|id|v2|" + t));
  // Encryption key: PBKDF2-stretched from a DIFFERENT input, so the server's account id
  // can never be turned back into the key.
  const base = await crypto.subtle.importKey("raw", enc.encode("nw|key|v2|" + t), { name: "PBKDF2" }, false, ["deriveKey"]);
  cryptoKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode("nw|salt|v2|" + t), iterations: PBKDF2_ITERS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

// gzip/gunzip via Compression Streams (no library). JSON compresses well, so we compress
// BEFORE encrypting (ciphertext is incompressible). Falls back to uncompressed if the API
// is missing; reads detect gzip by its magic bytes (1f 8b).
async function gzip(bytes) {
  if (typeof CompressionStream === "undefined") return null;
  const s = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
async function gunzip(bytes) {
  const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

// Encrypt the live state: "<iv>.<ciphertext>" (base64), gzipped first when possible.
export async function encS() {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  let data = new TextEncoder().encode(JSON.stringify(state));
  const gz = await gzip(data);
  if (gz) data = gz;
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, data);
  return b64(iv) + "." + b64(ct);
}

export async function decS(blob) {
  const [i, c] = blob.split(".");
  const buf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(unb64(i)) }, cryptoKey, unb64(c));
  let pt = new Uint8Array(buf);
  if (pt[0] === 0x1f && pt[1] === 0x8b) pt = await gunzip(pt);
  return JSON.parse(new TextDecoder().decode(pt));
}

// Copy to clipboard, reporting whether it actually worked (needs a secure context).
export async function copyText(t) {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch (e) {
    return false;
  }
}
