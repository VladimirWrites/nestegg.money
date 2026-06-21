import { test } from "node:test";
import assert from "node:assert/strict";
import { relTime } from "../public/js/ui/dom.js";

const ago = (ms) => Date.now() - ms;
const MIN = 60000, HOUR = 3600000, DAY = 86400000;

test("relTime returns 'never' for 0 / missing", () => {
  assert.equal(relTime(0), "never");
  assert.equal(relTime(undefined), "never");
});

test("relTime: sub-minute is 'just now'", () => {
  assert.equal(relTime(Date.now()), "just now");
  assert.equal(relTime(ago(30000)), "just now");
});

test("relTime: minutes", () => {
  assert.equal(relTime(ago(5 * MIN)), "5 min ago");
  assert.equal(relTime(ago(59 * MIN)), "59 min ago");
});

test("relTime: hours, with singular/plural", () => {
  assert.equal(relTime(ago(1 * HOUR)), "1 hour ago");
  assert.equal(relTime(ago(2 * HOUR)), "2 hours ago");
  assert.equal(relTime(ago(23 * HOUR)), "23 hours ago");
});

test("relTime: days, with singular/plural", () => {
  assert.equal(relTime(ago(1 * DAY)), "1 day ago");
  assert.equal(relTime(ago(3 * DAY)), "3 days ago");
  assert.equal(relTime(ago(29 * DAY)), "29 days ago");
});

test("relTime: months and years", () => {
  assert.equal(relTime(ago(45 * DAY)), "1 month ago");
  assert.equal(relTime(ago(120 * DAY)), "4 months ago");
  assert.equal(relTime(ago(400 * DAY)), "1 year ago");
  assert.equal(relTime(ago(800 * DAY)), "2 years ago");
});

test("relTime: future timestamps clamp to 'just now' (no negative)", () => {
  assert.equal(relTime(Date.now() + 10 * MIN), "just now");
});
