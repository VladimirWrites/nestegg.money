// Minimal Java-BigDecimal-compatible decimal arithmetic — exactly the subset the BMF
// Programmablaufplan (PAP) pseudocode uses: add/subtract/multiply, exact and scaled divide,
// setScale, compareTo, longValue, with ROUND_UP / ROUND_DOWN. BigInt mantissa + decimal scale,
// so every cent-level result is exact (no binary floating point anywhere).
const P10 = [1n];
const pow10 = (n) => {
  while (P10.length <= n) P10.push(P10[P10.length - 1] * 10n);
  return P10[n];
};

export class BigDecimal {
  // new BigDecimal("0.4") | new BigDecimal(12) | internal: new BigDecimal(mantissaBigInt, scale)
  constructor(value, scale) {
    if (typeof value === "bigint") { this.m = value; this.s = scale || 0; return; }
    const str = String(value).trim();
    const neg = str[0] === "-";
    const body = neg ? str.slice(1) : str;
    if (body.includes("e") || body.includes("E")) throw new Error("BigDecimal: exponent notation unsupported: " + str);
    const dot = body.indexOf(".");
    const digits = dot < 0 ? body : body.slice(0, dot) + body.slice(dot + 1);
    this.m = BigInt(digits || "0") * (neg ? -1n : 1n);
    this.s = dot < 0 ? 0 : body.length - dot - 1;
  }

  static valueOf(n) { return new BigDecimal(n); }

  add(o) {
    const s = Math.max(this.s, o.s);
    return new BigDecimal(this.m * pow10(s - this.s) + o.m * pow10(s - o.s), s);
  }
  subtract(o) {
    const s = Math.max(this.s, o.s);
    return new BigDecimal(this.m * pow10(s - this.s) - o.m * pow10(s - o.s), s);
  }
  multiply(o) { return new BigDecimal(this.m * o.m, this.s + o.s); }

  // divide(d): exact quotient (throws if it doesn't terminate within 34 digits — the PAP only
  // divides by 2, 100, 10000 and the like here). divide(d, scale, mode): quotient at the given
  // scale with explicit rounding, matching Java's divide(divisor, scale, roundingMode).
  divide(o, scale, mode) {
    if (o.m === 0n) throw new Error("BigDecimal: division by zero");
    if (scale === undefined) {
      const MAX = 34;
      const num = this.m * pow10(o.s + MAX);
      const den = o.m * pow10(this.s);
      if (num % den !== 0n) throw new Error("BigDecimal: non-terminating division");
      let m = num / den, s = MAX;
      while (s > 0 && m % 10n === 0n) { m /= 10n; s--; }
      return new BigDecimal(m, s);
    }
    const num = this.m * pow10(o.s + scale);
    const den = o.m * pow10(this.s);
    return new BigDecimal(roundDiv(num, den, mode), scale);
  }

  setScale(scale, mode) {
    if (scale >= this.s) return new BigDecimal(this.m * pow10(scale - this.s), scale);
    return new BigDecimal(roundDiv(this.m, pow10(this.s - scale), mode), scale);
  }

  compareTo(o) {
    const s = Math.max(this.s, o.s);
    const a = this.m * pow10(s - this.s), b = o.m * pow10(s - o.s);
    return a < b ? -1 : a > b ? 1 : 0;
  }

  negate() { return new BigDecimal(-this.m, this.s); }
  abs() { return this.m < 0n ? this.negate() : this; }
  longValue() { return Number(this.m / pow10(this.s)); }   // truncates toward zero, like Java
  doubleValue() { return Number(this.toString()); }

  toString() {
    const neg = this.m < 0n;
    let d = (neg ? -this.m : this.m).toString().padStart(this.s + 1, "0");
    const out = this.s === 0 ? d : d.slice(0, -this.s) + "." + d.slice(-this.s);
    return neg ? "-" + out : out;
  }
}

// Integer division of BigInts with a Java rounding mode. q truncates toward zero (BigInt `/`);
// ROUND_UP moves away from zero when there is any remainder, ROUND_DOWN keeps the truncation.
function roundDiv(num, den, mode) {
  if (den < 0n) { num = -num; den = -den; }
  const q = num / den;
  const rem = num - q * den;
  if (rem === 0n || mode === BigDecimal.ROUND_DOWN) return q;
  if (mode === BigDecimal.ROUND_UP) return q + (num < 0n ? -1n : 1n);
  throw new Error("BigDecimal: unsupported rounding mode " + mode);
}

BigDecimal.ROUND_UP = 0;
BigDecimal.ROUND_DOWN = 1;
BigDecimal.ZERO = new BigDecimal(0);
BigDecimal.ONE = new BigDecimal(1);
BigDecimal.TEN = new BigDecimal(10);
