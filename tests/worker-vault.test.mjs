import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

// Minimal in-memory D1 stub: SQL-aware over the two tables the vault uses (vaults, create_log).
function makeEnv() {
  const vaults = {}; // id -> { blob, updated_at }
  const log = [];    // { ip, ts }
  const prepare = (sql) => {
    const s = sql.replace(/\s+/g, " ").trim();
    return {
      bind(...a) {
        return {
          async first() {
            if (/^SELECT 1 AS x FROM vaults/i.test(s)) return vaults[a[0]] ? { x: 1 } : null;
            if (/^SELECT blob, updated_at FROM vaults/i.test(s)) { const r = vaults[a[0]]; return r ? { blob: r.blob, updated_at: r.updated_at } : null; }
            if (/^SELECT COUNT\(\*\) AS n FROM create_log/i.test(s)) { const [ip, since] = a; return { n: log.filter((e) => e.ip === ip && e.ts > since).length }; }
            return null;
          },
          async run() {
            if (/^DELETE FROM create_log/i.test(s)) { const since = a[0]; for (let i = log.length - 1; i >= 0; i--) if (log[i].ts < since) log.splice(i, 1); }
            else if (/^INSERT INTO create_log/i.test(s)) { log.push({ ip: a[0], ts: a[1] }); }
            else if (/^INSERT INTO vaults/i.test(s)) { const [id, blob, ts] = a; vaults[id] = { blob, updated_at: ts }; }
            else if (/^DELETE FROM vaults/i.test(s)) { delete vaults[a[0]]; }
            return { meta: { changes: 1 } };
          },
        };
      },
    };
  };
  return { DB: { prepare }, _vaults: vaults, _log: log };
}
const idHex = (i) => i.toString(16).padStart(64, "0"); // distinct valid SHA-256-hex ids for loops

const ID_A = "a".repeat(64); // valid SHA-256 hex
const ID_B = "b".repeat(64);
const req = (method, opts = {}) => {
  const headers = opts.headers || {};
  const url = "https://x/api/vault" + (opts.query ? "?id=" + opts.query : "");
  const init = { method, headers };
  if (opts.body !== undefined) { init.body = JSON.stringify(opts.body); init.headers = { ...headers, "content-type": "application/json" }; }
  return new Request(url, init);
};
const call = (env, method, opts) => worker.fetch(req(method, opts), env);

test("PUT then GET via X-Vault-Id header round-trips the blob", async () => {
  const env = makeEnv();
  let r = await call(env, "PUT", { body: { id: ID_A, blob: "iv.ct" } });
  assert.equal(r.status, 200);
  r = await call(env, "GET", { headers: { "X-Vault-Id": ID_A } });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).blob, "iv.ct");
});

test("GET ignores the ?id= query param (id must be in the header)", async () => {
  const env = makeEnv();
  await call(env, "PUT", { body: { id: ID_A, blob: "iv.ct" } });
  // query-only, no header -> treated as no id -> 400 (the loggable query path is gone)
  const r = await call(env, "GET", { query: ID_A });
  assert.equal(r.status, 400);
});

test("GET reads the id from the header, ignoring any query param", async () => {
  const env = makeEnv();
  await call(env, "PUT", { body: { id: ID_A, blob: "from-A" } });
  const r = await call(env, "GET", { headers: { "X-Vault-Id": ID_A }, query: ID_B });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).blob, "from-A");
});

test("GET with no id is 400, bad id is 400, unknown id is 404", async () => {
  const env = makeEnv();
  assert.equal((await call(env, "GET", {})).status, 400);
  assert.equal((await call(env, "GET", { headers: { "X-Vault-Id": "nothex" } })).status, 400);
  assert.equal((await call(env, "GET", { headers: { "X-Vault-Id": ID_B } })).status, 404);
});

test("PUT rejects bad id and bad blob", async () => {
  const env = makeEnv();
  assert.equal((await call(env, "PUT", { body: { id: "short", blob: "x" } })).status, 400);
  assert.equal((await call(env, "PUT", { body: { id: ID_A, blob: "" } })).status, 400);
});

test("PUT enforces the 256 KB blob cap", async () => {
  const env = makeEnv();
  assert.equal((await call(env, "PUT", { body: { id: ID_A, blob: "x".repeat(256_000) } })).status, 200); // at the cap: ok
  assert.equal((await call(env, "PUT", { body: { id: ID_A, blob: "x".repeat(256_001) } })).status, 400); // over: rejected
});

test("DELETE via header removes the vault", async () => {
  const env = makeEnv();
  await call(env, "PUT", { body: { id: ID_A, blob: "iv.ct" } });
  const d = await call(env, "DELETE", { headers: { "X-Vault-Id": ID_A } });
  assert.equal(d.status, 200);
  assert.equal((await call(env, "GET", { headers: { "X-Vault-Id": ID_A } })).status, 404);
});

test("new-vault creation is rate-limited per IP (20/window), then 429", async () => {
  const env = makeEnv();
  const ip = { "CF-Connecting-IP": "1.2.3.4" };
  for (let i = 1; i <= 20; i++) {
    const r = await call(env, "PUT", { headers: ip, body: { id: idHex(i), blob: "b" } });
    assert.equal(r.status, 200, "create #" + i + " should succeed");
  }
  const over = await call(env, "PUT", { headers: ip, body: { id: idHex(21), blob: "b" } });
  assert.equal(over.status, 429, "21st new vault from same IP is rate-limited");
});

test("updates to an existing vault are never rate-limited", async () => {
  const env = makeEnv();
  const ip = { "CF-Connecting-IP": "5.6.7.8" };
  await call(env, "PUT", { headers: ip, body: { id: ID_A, blob: "v0" } }); // 1 creation
  for (let i = 0; i < 50; i++) {
    const r = await call(env, "PUT", { headers: ip, body: { id: ID_A, blob: "v" + i } });
    assert.equal(r.status, 200);
  }
});

test("the rate limit is per-IP — a different IP is unaffected", async () => {
  const env = makeEnv();
  for (let i = 1; i <= 20; i++) await call(env, "PUT", { headers: { "CF-Connecting-IP": "9.9.9.9" }, body: { id: idHex(i), blob: "b" } });
  const blocked = await call(env, "PUT", { headers: { "CF-Connecting-IP": "9.9.9.9" }, body: { id: idHex(99), blob: "b" } });
  assert.equal(blocked.status, 429);
  const other = await call(env, "PUT", { headers: { "CF-Connecting-IP": "8.8.8.8" }, body: { id: idHex(100), blob: "b" } });
  assert.equal(other.status, 200);
});

test("a vault id is never exposed via the GET query string by the client", async () => {
  // guard: the client must send the id in a header, not the URL (log/Referer leakage).
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../public/js/io/storage.js", import.meta.url), "utf8");
  assert.ok(!/\/api\/vault\?id=/.test(src), "client must not put the vault id in the query string");
  assert.ok(/X-Vault-Id/.test(src), "client must send the vault id in the X-Vault-Id header");
});
