import { test } from "node:test";
import assert from "node:assert/strict";
import { setState } from "../public/js/domain/store.js";
import { rate, rateAt, convTo, convToY, money, moneyIn, ccySym, esc, shortK } from "../public/js/domain/money.js";

const cy = new Date().getFullYear();
function withState() {
  setState({
    baseCcy: "EUR",
    fxRates: { EUR: 1, USD: 2, GBP: 0.5 },
    fxHist: { [cy - 2]: { EUR: 1, USD: 4 } },
  });
}

test("rate: EUR is 1, known live rates, fallback when absent", () => {
  withState();
  assert.equal(rate("EUR"), 1);
  assert.equal(rate("USD"), 2);
  assert.equal(rate("CHF"), 0.96); // not in fxRates -> FALLBACK_FX
});

test("rateAt: past year uses the year-end table, current year uses live", () => {
  withState();
  assert.equal(rateAt("USD", cy - 2), 4); // historical
  assert.equal(rateAt("USD", cy), 2); // live
  assert.equal(rateAt("USD", cy - 5), 2); // no hist for that year -> live
});

test("convTo / convToY convert through EUR", () => {
  withState();
  assert.equal(convTo(100, "USD", "EUR"), 50); // 100 USD at 2/EUR -> 50 EUR
  assert.equal(convTo(100, "EUR", "USD"), 200);
  assert.equal(convToY(100, "USD", "EUR", cy - 2), 25); // historical 4/EUR
});

test("money / moneyIn / ccySym format in the right currency", () => {
  withState();
  assert.match(money(1234.5), /1,235/);
  assert.match(moneyIn(1000, "USD"), /1,000/);
  assert.match(moneyIn(1000, "USD"), /\$|US/);
  assert.equal(ccySym(), "€");
});

test("esc escapes &, double quote and <", () => {
  assert.equal(esc('a&"<b'), "a&amp;&quot;&lt;b");
});

test("shortK abbreviates thousands and millions", () => {
  assert.equal(shortK(950), 950);
  assert.equal(shortK(1500), "1.5k");
  assert.equal(shortK(12345), "12k");
  assert.equal(shortK(2.5e6), "2.5M");
  assert.equal(shortK(2.5e7), "25M");
});
