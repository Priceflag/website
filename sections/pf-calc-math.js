/* Priceflag breakeven calculator: pure math, no DOM.
   Every amount is an integer number of cents. Nothing here touches the page.

   Loading:
   - Browser: <script src="sections/pf-calc-math.js" defer></script> sets `window.PfCalc`.
   - Node tests: the repo is "type":"module", so this file is not require()-able. Evaluate it in a
     vm context and read `PfCalc` off that context's global (see qa/tests/calc.test.mjs):
       const ctx = vm.createContext({}); vm.runInContext(src, ctx); const PfCalc = ctx.PfCalc;
     If a CommonJS `module` is present it is also exported there.

   Parsing rules (each one has a test):
   - Leading/trailing spaces are ignored. One leading "$" is allowed ("$24", "$ 24").
   - Digits are ASCII 0-9. Exponents ("1e5"), signs other than one leading "-", letters and
     anything else are rejected as "not a number".
   - A leading "-" before an otherwise valid amount is "negative"; "--5" is "not a number".
   - Decimal point is ".". "24." and ".5" are accepted (24.00 and 0.50).
   - Commas: a single comma followed by exactly two digits, with no ".", is a decimal comma
     ("24,50" is 24.50). Otherwise commas must be thousands separators in groups of three
     ("1,299.99", "1,234,567"); anything else ("24,5", "1,2345", "1,23,456") is rejected.
   - More than two decimals: accepted only if the extra digits are zeros ("24.500" is 24.50).
     "12.345" is rejected, never rounded, because a silent rounding would change the user's price.
   - Maximum is $1,000,000.00 (100,000,000 cents). Larger is rejected with that limit in the message.
   - Zero parses fine here; whether it is allowed depends on the field (prices must be above zero,
     a unit cost of zero is allowed).

   Breakeven (docs: qa/briefs/COMMON.md "Breakeven math"):
   m0 = P - C, m1 = N - C. Same profit needs orders_after / orders_before = m0 / m1.
   - N > P: "lose up to (1 - m0/m1)", rounded DOWN to 0.1 point (never overstates safety).
   - N < P: "need (m0/m1 - 1) more", rounded UP to 0.1 point.
   Percentages are computed in integer tenths of a percent with exact integer division. */
(function (root) {
  'use strict';

  var MAX_CENTS = 100000000; // $1,000,000.00

  var MESSAGES = {
    empty: 'Enter an amount.',
    invalid: 'Enter a dollar amount, like 24 or 24.50.',
    negative: 'Enter an amount of zero or more, without a minus sign.',
    decimals: 'Use at most two decimal places, like 12.35.',
    'too-large': 'Enter an amount up to $1,000,000.00.',
    zero: 'Enter a price above $0.'
  };

  function fail(code) { return { ok: false, code: code, message: MESSAGES[code] }; }

  /** Parse a typed or pasted dollar amount into integer cents. */
  function parseMoney(input) {
    var s = String(input == null ? '' : input).replace(/^[\s ]+|[\s ]+$/g, '');
    if (s === '') return fail('empty');
    if (s.charAt(0) === '$') s = s.slice(1).replace(/^[\s ]+/, '');
    var negative = false;
    if (s.charAt(0) === '-' || s.charAt(0) === '−') { negative = true; s = s.slice(1); }
    if (s.charAt(0) === '$') s = s.slice(1); // "-$5"
    if (s === '' || !/^[0-9.,]+$/.test(s)) return fail('invalid');

    var intPart, frac;
    var dots = s.split('.').length - 1;
    var commas = s.split(',').length - 1;
    if (dots > 1) return fail('invalid');
    if (dots === 0 && commas === 1 && /^[0-9]+,[0-9]{2}$/.test(s)) {
      // Decimal comma: "24,50".
      intPart = s.split(',')[0];
      frac = s.split(',')[1];
    } else {
      var halves = s.split('.');
      intPart = halves[0];
      frac = halves.length > 1 ? halves[1] : '';
      if (commas > 0) {
        if (!/^[0-9]{1,3}(,[0-9]{3})+$/.test(intPart)) return fail('invalid');
        intPart = intPart.replace(/,/g, '');
      }
      if (frac.indexOf(',') !== -1) return fail('invalid');
    }
    if (intPart === '' && frac === '') return fail('invalid'); // "." alone
    if (intPart === '') intPart = '0';
    if (frac.length > 2) {
      if (/[^0]/.test(frac.slice(2))) return fail('decimals');
      frac = frac.slice(0, 2);
    }
    while (frac.length < 2) frac += '0';
    intPart = intPart.replace(/^0+(?=[0-9])/, '');
    if (intPart.length > 7) return fail(negative ? 'negative' : 'too-large');
    var cents = parseInt(intPart, 10) * 100 + parseInt(frac, 10);
    if (negative && cents !== 0) return fail('negative');
    if (cents > MAX_CENTS) return fail('too-large');
    return { ok: true, cents: cents };
  }

  /** Integer floor(a / b) and ceil(a / b) for a >= 0, b > 0. */
  function idivFloor(a, b) { return (a - (a % b)) / b; }
  function idivCeil(a, b) { return a % b === 0 ? a / b : idivFloor(a, b) + 1; }

  function groupDigits(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /** 1440 -> "$14.40", -120 -> "-$1.20", 129999 -> "$1,299.99". */
  function formatMoney(cents) {
    var neg = cents < 0;
    var a = Math.abs(cents);
    var c = a % 100;
    return (neg ? '-' : '') + '$' + groupDigits((a - c) / 100) + '.' + (c < 10 ? '0' : '') + c;
  }

  /** Plain value for the review form's hidden inputs: 1440 -> "14.40". */
  function plainMoney(cents) {
    var c = cents % 100;
    return ((cents - c) / 100) + '.' + (c < 10 ? '0' : '') + c;
  }

  /** Tenths of a percent -> "17.2%", 170 -> "17%", 12345 -> "1,234.5%". */
  function formatPct(tenths) {
    var whole = idivFloor(tenths, 10);
    var t = tenths % 10;
    return groupDigits(whole) + (t ? '.' + t : '') + '%';
  }

  /**
   * Breakeven for integer cents. Caller guarantees P > 0, N > 0, C >= 0.
   * Returns { kind, ... } where kind is one of:
   *  'same'          N === P
   *  'new-at-cost'   N === C (m1 = 0)
   *  'new-below-cost' N < C (m1 < 0)
   *  'current-not-positive' P <= C, N > C
   *  'up'            N > P: lossTenths = floor(1000 (m1 - m0) / m1)
   *  'down'          N < P: needTenths = ceil(1000 (m0 - m1) / m1)
   */
  function breakeven(P, N, C) {
    var m0 = P - C, m1 = N - C;
    var base = { price: P, newPrice: N, cost: C, m0: m0, m1: m1 };
    if (N === P) return assign(base, { kind: 'same', direction: 'same' });
    if (m1 === 0) return assign(base, { kind: 'new-at-cost', direction: N > P ? 'up' : 'down' });
    if (m1 < 0) return assign(base, { kind: 'new-below-cost', direction: N > P ? 'up' : 'down' });
    if (m0 <= 0) return assign(base, { kind: 'current-not-positive', direction: N > P ? 'up' : 'down' });
    if (N > P) return assign(base, { kind: 'up', direction: 'up', tenths: idivFloor(1000 * (m1 - m0), m1) });
    return assign(base, { kind: 'down', direction: 'down', tenths: idivCeil(1000 * (m0 - m1), m1) });
  }

  function assign(a, b) { for (var k in b) a[k] = b[k]; return a; }

  /** The sentences the page shows for a breakeven result. */
  function describe(r) {
    var M = formatMoney;
    switch (r.kind) {
      case 'same':
        return { sentence: 'Same price, so nothing changes.', support: 'Profit per order stays at ' + M(r.m0) + '.' };
      case 'new-at-cost':
        return { sentence: 'At ' + M(r.newPrice) + ' each order only covers its unit cost, so no number of extra orders makes a profit.', support: 'Profit per order goes from ' + M(r.m0) + ' to $0.00.' };
      case 'new-below-cost':
        return { sentence: 'At ' + M(r.newPrice) + ' you lose ' + M(-r.m1) + ' on every order, so no number of extra orders makes it profitable.', support: 'Profit per order goes from ' + M(r.m0) + ' to ' + M(r.m1) + '.' };
      case 'current-not-positive':
        return {
          sentence: r.m0 === 0
            ? 'At ' + M(r.price) + ' you make $0.00 per order today, so there is no profit yet for the breakeven to protect.'
            : 'At ' + M(r.price) + ' you lose ' + M(-r.m0) + ' per order today, so there is no profit yet for the breakeven to protect.',
          support: 'The breakeven needs a price above your unit cost today. At ' + M(r.newPrice) + ' you would make ' + M(r.m1) + ' per order.'
        };
      case 'up':
        if (r.tenths === 0) {
          return {
            sentence: 'You can lose less than 0.1% of orders and still make the same profit.',
            lead: 'You can lose less than ', figure: '0.1%', tail: ' of orders and still make the same profit.',
            support: 'Profit per order goes from ' + M(r.m0) + ' to ' + M(r.m1) + '.'
          };
        }
        return {
          sentence: 'You can lose up to ' + formatPct(r.tenths) + ' of orders and still make the same profit.',
          lead: 'You can lose up to ', figure: formatPct(r.tenths), tail: ' of orders and still make the same profit.',
          support: 'Profit per order goes from ' + M(r.m0) + ' to ' + M(r.m1) + '.'
        };
      case 'down':
        return {
          sentence: 'You need ' + formatPct(r.tenths) + ' more orders to make the same profit.',
          lead: 'You need ', figure: formatPct(r.tenths), tail: ' more orders to make the same profit.',
          support: 'Profit per order goes from ' + M(r.m0) + ' to ' + M(r.m1) + '.'
        };
    }
    return { sentence: '' };
  }

  /**
   * Full evaluation from three strings, as the page uses it.
   * Returns { ok, fields: {price, newPrice, cost} (each {ok, cents} or {ok:false, code, message}),
   *           result (breakeven, when ok), text (describe(result), when ok) }.
   */
  function evaluate(priceStr, newStr, costStr) {
    var f = { price: parseMoney(priceStr), newPrice: parseMoney(newStr), cost: parseMoney(costStr) };
    if (f.price.ok && f.price.cents === 0) f.price = fail('zero');
    if (f.newPrice.ok && f.newPrice.cents === 0) f.newPrice = fail('zero');
    if (!(f.price.ok && f.newPrice.ok && f.cost.ok)) return { ok: false, fields: f };
    var r = breakeven(f.price.cents, f.newPrice.cents, f.cost.cents);
    return { ok: true, fields: f, result: r, text: describe(r) };
  }

  var api = {
    MAX_CENTS: MAX_CENTS,
    MESSAGES: MESSAGES,
    parseMoney: parseMoney,
    breakeven: breakeven,
    describe: describe,
    evaluate: evaluate,
    formatMoney: formatMoney,
    plainMoney: plainMoney,
    formatPct: formatPct
  };

  root.PfCalc = api;
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
