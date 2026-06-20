import { test } from "node:test";
import assert from "node:assert/strict";
import { isIOSUserAgent } from "../public/js/ui/dom.js";

test("isIOSUserAgent detects iPhone / iPad / iPod", () => {
  assert.equal(isIOSUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", "iPhone", 5), true);
  assert.equal(isIOSUserAgent("Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)", "iPad", 5), true);
  assert.equal(isIOSUserAgent("Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0)", "iPhone", 5), true);
});

test("isIOSUserAgent detects iPadOS masquerading as MacIntel with touch", () => {
  assert.equal(isIOSUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 5), true);
});

test("isIOSUserAgent is false for desktop and Android", () => {
  assert.equal(isIOSUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 0), false); // real Mac, no touch
  assert.equal(isIOSUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Win32", 0), false);
  assert.equal(isIOSUserAgent("Mozilla/5.0 (Linux; Android 13; Pixel 7)", "Linux armv8l", 5), false);
});

test("isIOSUserAgent tolerates missing args", () => {
  assert.equal(isIOSUserAgent(undefined, undefined, undefined), false);
  assert.equal(isIOSUserAgent("", "", 0), false);
});
