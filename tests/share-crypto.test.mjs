import { test } from "node:test";
import assert from "node:assert/strict";
import { encWith, decWith, genShareKey, exportShareKey, importShareKey, randShareId } from "../public/js/io/crypto.js";

test("a snapshot encrypts under a share key and decrypts back exactly", async () => {
  const key = await genShareKey();
  const snap = { _snap: 1, baseCcy: "EUR", assets: [{ id: "a1", value: 1234 }], _include: { networth: true } };
  const blob = await encWith(snap, key);
  assert.match(blob, /\./); // "<iv>.<ciphertext>"
  assert.deepEqual(await decWith(blob, key), snap);
});

test("exported key is URL-fragment-safe and round-trips via import", async () => {
  const key = await genShareKey();
  const s = await exportShareKey(key);
  assert.doesNotMatch(s, /[+/=]/); // base64url: no chars that need URL-escaping
  const snap = { hello: "world" };
  const blob = await encWith(snap, key);
  const imported = await importShareKey(s);
  assert.deepEqual(await decWith(blob, imported), snap);
});

test("a different share key cannot decrypt another share's blob", async () => {
  const k1 = await genShareKey();
  const k2 = await genShareKey();
  const blob = await encWith({ secret: 42 }, k1);
  await assert.rejects(() => decWith(blob, k2));
});

test("randShareId is a random 128-bit hex id and effectively unique", () => {
  const ids = new Set();
  for (let i = 0; i < 500; i++) {
    const id = randShareId();
    assert.match(id, /^[a-f0-9]{32}$/);
    ids.add(id);
  }
  assert.equal(ids.size, 500);
});
