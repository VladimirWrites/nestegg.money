/* Reading a typed number.
 *
 * This is the one piece of formatting in the app that can quietly change what somebody owns:
 * "15.000" is fifteen thousand to a German reader and fifteen to an English one, and the app
 * ships in both languages. Every rule in parseNum has a case here, including the ones that
 * are a deliberate choice rather than an obvious truth.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNum, parseDec, fmtNum } from "../public/js/domain/money.js";

test("plain integers and decimals", () => {
  assert.equal(parseNum("0"), 0);
  assert.equal(parseNum("15"), 15);
  assert.equal(parseNum("39.32"), 39.32);
  assert.equal(parseNum("2.5"), 2.5);
});

test("a lone comma with one or two digits after it is a decimal comma", () => {
  assert.equal(parseNum("2,5"), 2.5);
  assert.equal(parseNum("39,32"), 39.32);
  assert.equal(parseNum("0,07"), 0.07);
});

test("a lone separator with exactly three digits after it is a thousands group", () => {
  assert.equal(parseNum("15,000"), 15000);
  assert.equal(parseNum("15.000"), 15000);
  assert.equal(parseNum("1,500"), 1500);
});

test("both separators: the later one is the decimal mark", () => {
  assert.equal(parseNum("1,234.56"), 1234.56);   // en-IE
  assert.equal(parseNum("1.234,56"), 1234.56);   // de
  assert.equal(parseNum("15,000,000.50"), 15000000.5);
  assert.equal(parseNum("15.000.000,50"), 15000000.5);
});

test("repeated groups are groups, however many there are", () => {
  assert.equal(parseNum("15,000,000"), 15000000);
  assert.equal(parseNum("15.000.000"), 15000000);
});

test("more than three digits after a lone separator is read as a decimal", () => {
  /* "12,3456" is malformed under either reading — a thousands group is exactly three digits.
     It is read as a decimal because that is the smaller of the two answers: a figure that
     comes out too small is obvious on the screen, one that comes out ten thousand times too
     large may not be. */
  assert.equal(parseNum("12,3456"), 12.3456);
});

test("currency symbols, percent signs and spaces are ignored", () => {
  assert.equal(parseNum("€1,234.56"), 1234.56);
  assert.equal(parseNum("1 234,56"), 1234.56);
  assert.equal(parseNum("1 234,56"), 1234.56);   // non-breaking space, as de formatting emits
  assert.equal(parseNum("2,5 %"), 2.5);
});

test("negatives, including the minus sign a formatter emits", () => {
  assert.equal(parseNum("-1,234.56"), -1234.56);
  assert.equal(parseNum("−2.5"), -2.5);
});

test("nothing readable is null, which is not zero", () => {
  assert.equal(parseNum(""), null);
  assert.equal(parseNum("   "), null);
  assert.equal(parseNum(null), null);
  assert.equal(parseNum(undefined), null);
  assert.equal(parseNum("abc"), null);
  assert.equal(parseNum("€"), null);
  assert.equal(parseNum(","), null);
  assert.equal(parseNum(NaN), null);
});

test("numbers pass straight through", () => {
  assert.equal(parseNum(42), 42);
  assert.equal(parseNum(0), 0);
  assert.equal(parseNum(-1.5), -1.5);
});

test("a formatted figure survives a round trip", () => {
  for (const n of [0, 15, 2.5, 39.32, 1234.56, 15000, 15000000, 15000000.5, -1234.56]) {
    assert.equal(parseNum(fmtNum(n)), n, `round trip failed for ${n}`);
  }
});

test("fmtNum writes the same shape the app prints elsewhere", () => {
  assert.equal(fmtNum(15000000), "15,000,000");
  assert.equal(fmtNum(1234.56), "1,234.56");
  assert.equal(fmtNum(2.5), "2.5");
  assert.equal(fmtNum(0), "0");
});

test("fmtNum gives an empty field for nothing, rather than NaN or 0", () => {
  assert.equal(fmtNum(null), "");
  assert.equal(fmtNum(""), "");
  assert.equal(fmtNum(undefined), "");
  assert.equal(fmtNum(NaN), "");
});

test("fmtNum holds a minimum number of decimals when a column asks for one", () => {
  /* A ledger column lines up on the decimal point, which it cannot do if the formatter
     drops trailing zeros: 3687.8 has to be written "3,687.80" beside "5,418.61". */
  assert.equal(fmtNum(3687.8, 2, 2), "3,687.80");
  assert.equal(fmtNum(626, 2, 2), "626.00");
  assert.equal(fmtNum(5418.61, 2, 2), "5,418.61");
  assert.equal(fmtNum(0, 2, 2), "0.00");
  // and a round trip still lands on the same number
  assert.equal(parseNum(fmtNum(3687.8, 2, 2)), 3687.8);
  // the default is unchanged
  assert.equal(fmtNum(3687.8), "3,687.8");
});

test("a lone separator after a bare zero is a decimal, never a group", () => {
  /* "0.125" cannot be a hundred and twenty-five under any convention, and read as one it
     turned an eighth of a bitcoin into 125 of them. */
  assert.equal(parseNum("0.125"), 0.125);
  assert.equal(parseNum("0,125"), 0.125);
  assert.equal(parseNum("00,500"), 0.5);
});

test("parseDec reads a decimal and never a thousands group", () => {
  /* For a rate, a term or a count of coins, where "3.125" means three and an eighth in
     either language and a thousands group is not a plausible reading. */
  assert.equal(parseDec("3.125"), 3.125);
  assert.equal(parseDec("3,125"), 3.125);
  assert.equal(parseDec("0.5"), 0.5);
  assert.equal(parseDec("15.000"), 15);
  assert.equal(parseDec("−2,5 %"), -2.5);
  assert.equal(parseDec(""), null);
  assert.equal(parseDec("abc"), null);
});
