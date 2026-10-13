// Breakeven calculator math (sections/pf-calc-math.js). Pure Node, no browser.
// The file is a plain browser script; it is evaluated in a vm context and read off that global.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = fs.readFileSync(path.join(ROOT, 'sections/pf-calc-math.js'), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(src, ctx, { filename: 'pf-calc-math.js' });
const C = ctx.PfCalc;

const cents = (s) => { const r = C.parseMoney(s); assert.ok(r.ok, `${JSON.stringify(s)} should parse: ${r.message}`); return r.cents; };
const code = (s) => { const r = C.parseMoney(s); assert.ok(!r.ok, `${JSON.stringify(s)} should be rejected, got ${r.cents}`); return r.code; };
const sentence = (p, n, c) => { const ev = C.evaluate(p, n, c); assert.ok(ev.ok, 'inputs should be valid'); return ev.text.sentence; };

// ---------- parsing ----------
test('plain, decimal and padded amounts parse to integer cents', () => {
  assert.equal(cents('24'), 2400);
  assert.equal(cents('24.5'), 2450);
  assert.equal(cents('24.50'), 2450);
  assert.equal(cents(' 24 '), 2400);
  assert.equal(cents(' 24.00\t'), 2400);
  assert.equal(cents('24.'), 2400);
  assert.equal(cents('.5'), 50);
  assert.equal(cents('0.01'), 1);
  assert.equal(cents('007.10'), 710);
  assert.equal(cents('9.60'), 960);
});

test('pasted values with "$" and "," parse', () => {
  assert.equal(cents('$24'), 2400);
  assert.equal(cents('$ 24'), 2400);
  assert.equal(cents('$1,299.99'), 129999);
  assert.equal(cents('$1,234.50'), 123450);
  assert.equal(cents('123,456'), 12345600);
  assert.equal(code('1,234,567'), 'too-large');
  assert.equal(cents('1,000'), 100000);
});

test('a single comma followed by exactly two digits and no dot is a decimal comma', () => {
  assert.equal(cents('24,50'), 2450);
  assert.equal(cents('$9,60'), 960);
  assert.equal(cents('0,99'), 99);
  // Three digits after a single comma are a thousands group, not decimals.
  assert.equal(cents('1,299'), 129900);
});

test('badly grouped commas are rejected', () => {
  for (const s of ['24,5', '1,2345', '1,23,456', ',99', '1,,000', '1,000,00.5', '12.34,5', '1.234,50']) assert.equal(code(s), 'invalid', s);
});

test('non-numeric input is rejected', () => {
  for (const s of ['abc', '1e5', '1E5', '--5', '24abc', 'twelve', '$', '.', '1.2.3', '24 50', '0x10', 'Infinity', 'NaN', '+5', '٢٤', '24$', '5-']) {
    assert.equal(code(s), 'invalid', s);
  }
});

test('empty input is "empty", not an error kind of its own', () => {
  assert.equal(code(''), 'empty');
  assert.equal(code('   '), 'empty');
  assert.equal(code(null), 'empty');
  assert.equal(code(undefined), 'empty');
});

test('negative values are rejected; "-0" is zero', () => {
  assert.equal(code('-5'), 'negative');
  assert.equal(code('-$5'), 'negative');
  assert.equal(code('$-5'), 'negative');
  assert.equal(code('−5'), 'negative');
  assert.equal(cents('-0'), 0);
});

test('more than two decimals is rejected unless the extra digits are zeros', () => {
  assert.equal(code('12.345'), 'decimals');
  assert.equal(code('0.001'), 'decimals');
  assert.equal(cents('24.500'), 2450);
  assert.equal(cents('24.5000'), 2450);
});

test('very large values are capped at $1,000,000.00', () => {
  assert.equal(cents('1000000'), 100000000);
  assert.equal(cents('$1,000,000.00'), 100000000);
  assert.equal(code('1000000.01'), 'too-large');
  assert.equal(code('99999999999999999999'), 'too-large');
  assert.match(C.MESSAGES['too-large'], /\$1,000,000\.00/);
});

test('zero is parsed, but a zero price is rejected by evaluate while a zero cost is allowed', () => {
  assert.equal(cents('0'), 0);
  assert.equal(C.evaluate('0', '27', '9.60').fields.price.code, 'zero');
  assert.equal(C.evaluate('24', '0.00', '9.60').fields.newPrice.code, 'zero');
  const ev = C.evaluate('24', '27', '0');
  assert.ok(ev.ok);
});

// ---------- breakeven ----------
test('default example: $24.00 to $27.00 at $9.60 cost, 1440/1740 -> lose up to 17.2%', () => {
  const ev = C.evaluate('24.00', '27.00', '9.60');
  assert.equal(ev.result.m0, 1440);
  assert.equal(ev.result.m1, 1740);
  assert.equal(ev.result.kind, 'up');
  assert.equal(ev.result.tenths, 172); // 17.24...% rounded down
  assert.equal(ev.text.sentence, 'You can lose up to 17.2% of orders and still make the same profit.');
  assert.equal(ev.text.support, 'Profit per order goes from $14.40 to $17.40.');
  assert.equal(ev.text.lead + ev.text.figure + ev.text.tail, ev.text.sentence);
});

test('decrease: $27 to $24 at $9.60 -> need 20.9% more (20.83...% rounded up)', () => {
  const ev = C.evaluate('27', '24', '9.60');
  assert.equal(ev.result.kind, 'down');
  assert.equal(ev.result.tenths, 209);
  assert.equal(ev.text.sentence, 'You need 20.9% more orders to make the same profit.');
  assert.equal(ev.text.support, 'Profit per order goes from $17.40 to $14.40.');
});

test('cost of zero works and is the same-revenue case: $24 to $27 -> 11.1%', () => {
  // 1 - 2400/2700 = 11.11...% -> 11.1%
  assert.equal(sentence('24', '27', '0'), 'You can lose up to 11.1% of orders and still make the same profit.');
  // 2700/2400 - 1 = 12.5% exactly, no rounding up past an exact value
  assert.equal(sentence('27', '24', '0'), 'You need 12.5% more orders to make the same profit.');
});

test('a whole percentage drops the trailing ".0"', () => {
  // m0 = 900, m1 = 1000: lose 10% exactly.
  assert.equal(sentence('10', '11', '1'), 'You can lose up to 10% of orders and still make the same profit.');
  // m0 = 1000, m1 = 500: need 100% more.
  assert.equal(sentence('11', '6', '1'), 'You need 100% more orders to make the same profit.');
  assert.equal(C.formatPct(170), '17%');
  assert.equal(C.formatPct(172), '17.2%');
  assert.equal(C.formatPct(12345), '1,234.5%');
});

test('rounding is conservative: "lose up to" rounds down, "need more" rounds up', () => {
  // 1 - 2/3 = 33.33...% -> 33.3 (down); 3/2 - 1 = 50% exactly.
  assert.equal(C.breakeven(300, 400, 100).tenths, 333);
  // 1 - 1/3 = 66.66...% -> 66.6, never 66.7.
  assert.equal(C.breakeven(200, 400, 100).tenths, 666);
  // 3/1 - 1 = 200%; 2/3 - 1... decrease 400->300 at cost 100: 3/2 - 1 = 50%.
  assert.equal(C.breakeven(400, 300, 100).tenths, 500);
  // 7/6 - 1 = 16.66...% -> 16.7 (up), never 16.6.
  assert.equal(C.breakeven(800, 700, 100).tenths, 167);
});

test('a tiny increase under 0.1% says "less than 0.1%" instead of "up to 0%"', () => {
  const ev = C.evaluate('24.00', '24.01', '9.60'); // 1 - 1440/1441 = 0.069%
  assert.equal(ev.result.tenths, 0);
  assert.equal(ev.text.sentence, 'You can lose less than 0.1% of orders and still make the same profit.');
});

test('new price equal to the old price: "Same price, so nothing changes."', () => {
  const ev = C.evaluate('24', '$24.00', '9.60');
  assert.equal(ev.result.kind, 'same');
  assert.equal(ev.result.direction, 'same');
  assert.equal(ev.text.sentence, 'Same price, so nothing changes.');
});

test('new price below cost explains the loss per order', () => {
  const ev = C.evaluate('24', '8', '9.60');
  assert.equal(ev.result.kind, 'new-below-cost');
  assert.equal(ev.text.sentence, 'At $8.00 you lose $1.60 on every order, so no number of extra orders makes it profitable.');
  assert.equal(ev.text.support, 'Profit per order goes from $14.40 to -$1.60.');
});

test('new price exactly at cost', () => {
  const ev = C.evaluate('24', '9.60', '9.60');
  assert.equal(ev.result.kind, 'new-at-cost');
  assert.match(ev.text.sentence, /^At \$9\.60 each order only covers its unit cost/);
});

test('current price at or below cost explains that the breakeven needs a positive margin today', () => {
  const at = C.evaluate('9.60', '12', '9.60');
  assert.equal(at.result.kind, 'current-not-positive');
  assert.match(at.text.sentence, /you make \$0\.00 per order today/);
  assert.match(at.text.support, /needs a price above your unit cost today/);
  const below = C.evaluate('8', '12', '9.60');
  assert.equal(below.result.kind, 'current-not-positive');
  assert.match(below.text.sentence, /^At \$8\.00 you lose \$1\.60 per order today/);
  assert.match(below.text.support, /At \$12\.00 you would make \$2\.40 per order/);
});

test('very large values stay exact', () => {
  const ev = C.evaluate('$999,999.99', '$1,000,000.00', '0');
  assert.equal(ev.result.kind, 'up');
  assert.equal(ev.result.tenths, 0); // 1 cent on a million dollars
  const big = C.evaluate('1000000', '0.02', '0.01'); // need (99999999 / 1) - 1 more
  assert.equal(big.result.tenths, 99999998000);
  assert.equal(big.text.sentence, 'You need 9,999,999,800% more orders to make the same profit.');
  assert.equal(C.formatMoney(100000000), '$1,000,000.00');
});

test('money formatting', () => {
  assert.equal(C.formatMoney(0), '$0.00');
  assert.equal(C.formatMoney(5), '$0.05');
  assert.equal(C.formatMoney(129999), '$1,299.99');
  assert.equal(C.formatMoney(-160), '-$1.60');
  assert.equal(C.plainMoney(960), '9.60');
  assert.equal(C.plainMoney(100000000), '1000000.00');
});

test('no visible sentence contains an em-dash or en-dash', () => {
  const cases = [['24', '27', '9.6'], ['27', '24', '9.6'], ['24', '24', '9.6'], ['24', '8', '9.6'], ['24', '9.6', '9.6'], ['8', '12', '9.6'], ['9.6', '12', '9.6'], ['24', '24.01', '9.6']];
  for (const c of cases) {
    const t = C.evaluate(...c).text;
    assert.doesNotMatch(t.sentence + t.support, /[–—]/);
  }
  for (const m of Object.values(C.MESSAGES)) assert.doesNotMatch(m, /[–—]/);
});

// ---------- property checks: displayed percentages are consistent with the cent math ----------
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

test('500 random increases: losing exactly the shown % never leaves profit below today by more than a cent', () => {
  const r = rng(42);
  for (let i = 0; i < 500; i++) {
    const C0 = Math.floor(r() * 50000);              // cost $0 to $500
    const P = C0 + 1 + Math.floor(r() * 100000);     // margin > 0
    const N = P + 1 + Math.floor(r() * 100000);
    const res = C.breakeven(P, N, C0);
    assert.equal(res.kind, 'up');
    const p = res.tenths / 1000; // fraction
    // Orders scale to (1 - p); profit = (1 - p) * m1 per 1 order before, vs m0.
    assert.ok((1 - p) * res.m1 >= res.m0 - 1, `P=${P} N=${N} C=${C0} p=${res.tenths}`);
    // And it is the largest such one-decimal figure: one more tenth would overstate it.
    assert.ok((1 - (res.tenths + 1) / 1000) * res.m1 < res.m0, `not tight: P=${P} N=${N} C=${C0}`);
    // The shown string is the same number.
    const t = C.describe(res);
    if (res.tenths > 0) assert.equal(t.figure, C.formatPct(res.tenths));
  }
});

test('500 random decreases: gaining exactly the shown % always restores today\'s profit', () => {
  const r = rng(7);
  for (let i = 0; i < 500; i++) {
    const C0 = Math.floor(r() * 50000);
    const N = C0 + 1 + Math.floor(r() * 100000);
    const P = N + 1 + Math.floor(r() * 100000);
    const res = C.breakeven(P, N, C0);
    assert.equal(res.kind, 'down');
    const q = res.tenths / 1000;
    assert.ok((1 + q) * res.m1 >= res.m0 - 1e-6, `P=${P} N=${N} C=${C0} q=${res.tenths}`);
    assert.ok(res.tenths === 0 || (1 + (res.tenths - 1) / 1000) * res.m1 < res.m0, `not tight: P=${P} N=${N} C=${C0}`);
  }
});

test('500 random typed strings round-trip through cents exactly', () => {
  const r = rng(99);
  for (let i = 0; i < 500; i++) {
    const c = Math.floor(r() * 100000001);
    const plain = C.plainMoney(c);
    assert.equal(C.parseMoney(plain).cents, c, plain);
    assert.equal(C.parseMoney(C.formatMoney(c)).cents, c, C.formatMoney(c));
  }
});
