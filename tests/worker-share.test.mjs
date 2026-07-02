import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

// Minimal in-memory D1 stub covering the shares + create_log tables the share API touches.
function makeEnv() {
  const shares = {}; // share_id -> { blob, expires_at, created_at }
  const log = [];    // { ip, ts }
  const prepare = (sql) => {
    const s = sql.replace(/\s+/g, " ").trim();
    return {
      bind(...a) {
        return {
          async first() {
            if (/^SELECT blob, expires_at FROM shares/i.test(s)) { const r = shares[a[0]]; return r ? { blob: r.blob, expires_at: r.expires_at } : null; }
            if (/^SELECT COUNT\(\*\) AS n FROM create_log/i.test(s)) { const [ip, since] = a; return { n: log.filter((e) => e.ip === ip && e.ts > since).length }; }
            return null;
          },
          async run() {
            if (/^DELETE FROM shares WHERE share_id/i.test(s)) { delete shares[a[0]]; }
            else if (/^DELETE FROM shares WHERE expires_at/i.test(s)) { const cut = a[0]; for (const k of Object.keys(shares)) if (shares[k].expires_at < cut) delete shares[k]; }
            else if (/^DELETE FROM create_log/i.test(s)) { const since = a[0]; for (let i = log.length - 1; i >= 0; i--) if (log[i].ts < since) log.splice(i, 1); }
            else if (/^INSERT INTO create_log/i.test(s)) { log.push({ ip: a[0], ts: a[1] }); }
            else if (/^INSERT INTO shares/i.test(s)) { const [id, blob, expires_at, created_at] = a; shares[id] = { blob, expires_at, created_at }; }
            return { meta: { changes: 1 } };
          },
        };
      },
    };
  };
  return { DB: { prepare }, _shares: shares, _log: log };
}

const ID_A = "a".repeat(32);
const ID_B = "b".repeat(32);
const req = (method, opts = {}) => {
  const headers = { ...(opts.headers || {}) };
  const init = { method, headers };
  if (opts.body !== undefined) { init.body = JSON.stringify(opts.body); headers["content-type"] = "application/json"; }
  return new Request("https://x/api/share", init);
};
const call = (env, method, opts) => worker.fetch(req(method, opts), env);

test("POST then GET round-trips the blob and sets a ~30-day expiry", async () => {
  const env = makeEnv();
  let r = await call(env, "POST", { body: { id: ID_A, blob: "iv.ct" } });
  assert.equal(r.status, 200);
  const posted = await r.json();
  assert.ok(posted.expires_at > Date.now() + 29 * 86400000);
  assert.ok(posted.expires_at <= Date.now() + 30 * 86400000 + 1000);

  r = await call(env, "GET", { headers: { "X-Share-Id": ID_A } });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).blob, "iv.ct");
});

test("GET requires the id in the header (missing/bad id -> 400)", async () => {
  const env = makeEnv();
  assert.equal((await call(env, "GET", {})).status, 400);
  assert.equal((await call(env, "GET", { headers: { "X-Share-Id": "not-hex" } })).status, 400);
});

test("GET on an unknown id is 404", async () => {
  const env = makeEnv();
  assert.equal((await call(env, "GET", { headers: { "X-Share-Id": ID_A } })).status, 404);
});

test("DELETE revokes: the share stops resolving", async () => {
  const env = makeEnv();
  await call(env, "POST", { body: { id: ID_A, blob: "iv.ct" } });
  assert.equal((await call(env, "DELETE", { headers: { "X-Share-Id": ID_A } })).status, 200);
  assert.equal((await call(env, "GET", { headers: { "X-Share-Id": ID_A } })).status, 404);
});

test("an expired share returns 410 and is purged on read", async () => {
  const env = makeEnv();
  env._shares[ID_A] = { blob: "iv.ct", expires_at: Date.now() - 1000, created_at: Date.now() - 100000 };
  assert.equal((await call(env, "GET", { headers: { "X-Share-Id": ID_A } })).status, 410);
  assert.equal(env._shares[ID_A], undefined);                 // purged
  assert.equal((await call(env, "GET", { headers: { "X-Share-Id": ID_A } })).status, 404);
});

test("POST opportunistically purges expired rows", async () => {
  const env = makeEnv();
  env._shares[ID_B] = { blob: "old", expires_at: Date.now() - 1, created_at: 0 };
  await call(env, "POST", { body: { id: ID_A, blob: "iv.ct" } });
  assert.equal(env._shares[ID_B], undefined);                 // stale row swept
  assert.ok(env._shares[ID_A]);                               // new row present
});

test("bad blob is rejected", async () => {
  const env = makeEnv();
  assert.equal((await call(env, "POST", { body: { id: ID_A, blob: "" } })).status, 400);
  assert.equal((await call(env, "POST", { body: { id: ID_A, blob: "x".repeat(256_001) } })).status, 400);
});

test("share creation is rate-limited per IP", async () => {
  const env = makeEnv();
  const headers = { "CF-Connecting-IP": "9.9.9.9" };
  for (let i = 0; i < 20; i++) {
    const id = i.toString(16).padStart(32, "0");
    assert.equal((await call(env, "POST", { headers, body: { id, blob: "iv.ct" } })).status, 200);
  }
  const r = await call(env, "POST", { headers, body: { id: "f".repeat(32), blob: "iv.ct" } });
  assert.equal(r.status, 429);
});
