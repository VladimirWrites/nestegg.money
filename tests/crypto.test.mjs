import { test } from "node:test";
import assert from "node:assert/strict";
import { setState } from "../public/js/domain/store.js";
import { generateToken, validToken, normTok, canonToken, deriveKeys, encS, decS } from "../public/js/io/crypto.js";

test("generated account tokens validate, including O/I/l look-alike typos", () => {
  for (let i = 0; i < 200; i++) {
    const tok = generateToken();
    assert.ok(validToken(tok));
    assert.ok(validToken(tok.toLowerCase().replace(/0/g, "O").replace(/1/g, "l")));
  }
  assert.ok(!validToken("AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA"));
  assert.ok(!validToken("too-short"));
});

test("normTok / canonToken normalize look-alikes and grouping", () => {
  const tok = generateToken();
  assert.equal(normTok(tok), normTok(tok.toLowerCase()));
  assert.match(canonToken(tok), /^([0-9A-Z]{4}-){6}[0-9A-Z]{4}$/);
});

test("encrypt -> decrypt round-trips the live state", async () => {
  await deriveKeys(generateToken());
  const original = { v: 6, baseCcy: "USD", assets: [{ id: "a1", name: "Car", value: 1234 }], snapshots: [{ year: 2024, entries: [] }] };
  setState(original);
  const blob = await encS();
  assert.match(blob, /\./); // "<iv>.<ciphertext>"
  const back = await decS(blob);
  assert.deepEqual(back, original);
});

test("different account numbers cannot decrypt each other's blob", async () => {
  await deriveKeys(generateToken());
  setState({ secret: 42 });
  const blob = await encS();
  await deriveKeys(generateToken()); // different account -> different key
  await assert.rejects(() => decS(blob));
});
