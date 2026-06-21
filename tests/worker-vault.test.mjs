import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

// Minimal in-memory D1 stub: supports the SELECT / upsert INSERT / DELETE the vault uses.
function makeEnv() {
  const store = {};
  const db = {
    store,
    prepare(sql) {
      const s = sql.trim();
      return {
        bind(...args) {
          return {
            async first() {
              const row = store[args[0]];
              return row ? { blob: row.blob, updated_at: row.updated_at } : null;
            },
            async run() {
              if (/^INSERT/i.test(s)) { const [id, blob, ts] = args; store[id] = { blob, updated_at: ts }; }
              else if (/^DELETE/i.test(s)) { delete store[args[0]]; }
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
  return { DB: db };
}

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

test("GET still accepts the ?id= query param (back-compat for old clients)", async () => {
  const env = makeEnv();
  await call(env, "PUT", { body: { id: ID_A, blob: "iv.ct" } });
  const r = await call(env, "GET", { query: ID_A });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).blob, "iv.ct");
});

test("GET prefers the header over the query param", async () => {
  const env = makeEnv();
  await call(env, "PUT", { body: { id: ID_A, blob: "from-A" } });
  // header points at the real vault, query at a non-existent one -> header wins
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
  assert.equal((await call(env, "PUT", { body: { id: ID_A, blob: "x".repeat(2_000_001) } })).status, 400);
});

test("DELETE via header removes the vault", async () => {
  const env = makeEnv();
  await call(env, "PUT", { body: { id: ID_A, blob: "iv.ct" } });
  const d = await call(env, "DELETE", { headers: { "X-Vault-Id": ID_A } });
  assert.equal(d.status, 200);
  assert.equal((await call(env, "GET", { headers: { "X-Vault-Id": ID_A } })).status, 404);
});

test("a vault id is never exposed via the GET query string by the client", async () => {
  // guard: the client must send the id in a header, not the URL (log/Referer leakage).
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../public/js/io/storage.js", import.meta.url), "utf8");
  assert.ok(!/\/api\/vault\?id=/.test(src), "client must not put the vault id in the query string");
  assert.ok(/X-Vault-Id/.test(src), "client must send the vault id in the X-Vault-Id header");
});
