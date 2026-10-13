/* =====================================================================
   Priceflag — "Test a price, then ask where to send it"
   ---------------------------------------------------------------------
   Usage:   var cleanup = window.initPfWaitlist(rootElementOrSelector);
            cleanup();          // removes DOM, listeners, timers, rAF, RO

   Exactly one global is created: window.initPfWaitlist.
   Every selector in the injected stylesheet is prefixed `.pfl-`.
   Zero dependencies. No CDN. No imports. No pre-existing markup required.

   WHAT THIS SECTION IS ------------------------------------------------
   The last thing on the page is not a metaphor for the product. It IS the
   product, at the smallest size it can be run: you type your own price and
   your own unit cost, and the section answers with the price it would test
   and what 90 days of that test is worth — as a range, never as a single
   confident number.

   Only then does it ask for an address, and it asks the one question the
   answer provokes: you have just seen this for one product; do you want it
   for the whole catalogue?

   THE EMAIL --------------------------------------------------------------
   There is no backend and this module does not pretend otherwise. On a
   valid submit it opens a `mailto:` to hello@priceflag.org prefilled with
   the address AND the numbers that were on screen — so the enquiry that
   lands is actually useful — and it SAYS SO in the confirmation, leaving
   the same mailto: on screen as a real link, because a mail client that
   silently fails to open is the one failure mode we cannot detect.
   Nothing is stored, nothing is POSTed, nothing is quietly thrown away.

   To wire a real endpoint later, replace exactly one function: `T.SUBMIT`,
   at the top of this file. It is also reachable at runtime as
   `window.initPfWaitlist.T.SUBMIT` (a property of the single global, not a
   second global) so a host page can swap it without editing this file.

   ENVIRONMENT NOTE ----------------------------------------------------
   In the target environment `document.hidden` is permanently true, which
   starves requestAnimationFrame, ResizeObserver, IntersectionObserver and
   CSS transitions alike. Modules here have shipped broken because of it.
   The rules obeyed below:

     1. `render()` and `resize()` have NO early-return paths. Every call
        writes complete, final geometry and complete, final text. A starved
        rAF costs smoothness, never correctness.
     2. A watchdog interval drives the tween when rAF is starved, and
        stands down the moment real frames arrive. A slow probe keeps a
        running answer to "does rAF work here at all?"; when the answer is
        no, every value is set INSTANTLY instead of tweened, so a keystroke
        is never followed by a stale number.
     3. A settle timer is the last line of defence: whatever the loop
        managed, the numbers on screen are made to agree with the numbers
        the inputs imply.
     4. IntersectionObserver is not used at all. First paint is
        unconditional, at mount.
     5. Layout is re-measured on resize, orientationchange, visualViewport
        resize, a ResizeObserver AND a slow polling interval, because any
        one of those five may never deliver here.
   ===================================================================== */

window.initPfWaitlist = (function () {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  var STYLE_ID = 'pfl-style';
  var EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

  /* =====================================================================
     TUNABLES  +  THE INTEGRATION SEAM
     ===================================================================== */

  var T = {

    /* ---------------------------------------------------------------
       T.SUBMIT — THE ONE PLACE THE ADDRESS LEAVES THIS MODULE.
       ---------------------------------------------------------------
       Called only after the address has passed validation.

         payload = {
           email:     'someone@store.com',  // trimmed, validated
           price:     48,                   // what they typed
           cost:      19,                   // what they typed
           testPrice: 53.76,                // what the model would test
           uplift:    1496.9,               // 90-day centre estimate
           low:      -2210.4,               // pessimistic end of the band
           high:      5417.7,               // optimistic end
           horizon:   90,
           page:      'https://priceflag.org/'
         }

       Return (or resolve to) a result object:

         { ok: true,  via: 'mailto', href: '<mailto url>' }
             → UI says a draft was opened and shows `href` as a real,
               clickable fallback. Honest: nothing is stored yet.
         { ok: true,  via: 'api' }
             → UI says "you're on the list". Use this ONLY once something
               actually persists the address.
         { ok: false, message: 'Some human sentence.' }
             → UI keeps the form, shows the message, refocuses the input.

       Throwing, or returning nothing, is treated as { ok:false }.

       TO DROP IN A REAL ENDPOINT (Formspree, a Shopify app backend, a
       Worker, …) replace the whole body with something like:

         SUBMIT: function (p) {
           return fetch('https://formspree.io/f/XXXXXXXX', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json',
                        'Accept': 'application/json' },
             body: JSON.stringify(p)
           }).then(function (r) {
             if (!r.ok) throw new Error(r.status);
             return { ok: true, via: 'api' };
           }).catch(function () {
             return { ok: false,
                      message: 'That did not go through. Try again?' };
           });
         }

       Nothing else in this file needs to change. Async is fine — the
       button shows a pending state and is disabled until you settle.
       --------------------------------------------------------------- */
    /* Paste the Apps Script /exec URL here to send addresses to your Sheet.
       Leave blank and the module falls back to opening a mail draft.
       See integrations/waitlist-sheet.gs for the server half. No secret is
       sent: anything shipped in public JS is public, so the junk-filtering
       lives entirely on the Apps Script side. */
    SHEET_ENDPOINT: 'https://script.google.com/macros/s/AKfycbwihER5l9u8XY81Q55RYJh626QOXCIFI0LJDeQGBt84BFtSIdI4AAfox--A1MptpMZtnw/exec',

    SUBMIT: function (payload) {
      /* When an endpoint is configured, post to it and report the TRUTH.
         Deliberately not using mode:'no-cors' — an opaque response cannot
         distinguish success from failure, and claiming "you're on the list"
         when the row may not exist is the one failure mode worth avoiding.
         Content-Type is text/plain so the request stays "simple" and skips
         the CORS preflight that Apps Script does not answer. */
      if (T.SHEET_ENDPOINT) {
        return fetch(T.SHEET_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            email: payload.email,
            price: payload.price,
            cost: payload.cost,
            testPrice: payload.testPrice,
            uplift: payload.uplift,
            low: payload.low,
            high: payload.high,
            page: payload.page,
            ua: (navigator && navigator.userAgent) || ''
          })
        }).then(function (r) { return r.json(); }).then(function (j) {
          if (j && j.ok) return { ok: true, via: 'api' };
          return { ok: false,
                   message: 'That did not save. Try again, or email us.' };
        }).catch(function () {
          return { ok: false,
                   message: 'That did not save. Try again, or email us.' };
        });
      }
      var body =
        'I want this for my whole catalogue.' +
        '\n\nEmail: ' + payload.email +
        '\n\nMy numbers' +
        '\n  Price: ' + exactMoney(payload.price) +
        '\n  Unit cost: ' + exactMoney(payload.cost) +
        '\n\nWhat the page showed me' +
        '\n  Price to test: ' + exactMoney(payload.testPrice) +
        '\n  ' + payload.horizon + '-day profit: ' + signedMoney(payload.uplift) +
        '\n  Range: ' + signedMoney(payload.low) + ' to ' + signedMoney(payload.high) +
        '\n\n(sent from ' + payload.page + ')';

      var href = 'mailto:' + T.MAIL_TO +
        '?subject=' + encodeURIComponent(T.MAIL_SUBJECT) +
        '&body=' + encodeURIComponent(body);

      /* An anchor click behaves better than assigning location.href: if no
         mail client is registered the page is not unloaded or left blank. */
      try {
        var a = document.createElement('a');
        a.href = href;
        a.style.position = 'absolute';
        a.style.left = '-9999px';
        (document.body || document.documentElement).appendChild(a);
        a.click();
        if (a.parentNode) a.parentNode.removeChild(a);
      } catch (e) {
        try { window.location.href = href; } catch (e2) {}
      }
      return { ok: true, via: 'mailto', href: href };
    },

    MAIL_TO: 'hello@priceflag.org',
    MAIL_SUBJECT: 'Priceflag — my whole catalogue',

    /* Force the reduced-motion path on/off for testing. null = ask the OS. */
    FORCE_REDUCE: null,

    /* ---- the model --------------------------------------------------
       These four are the same numbers the simulation section runs on. If
       one of them changes there, change it here: the page must not tell
       two stories about the same arithmetic. */
    O_DAY:      25.2,          // orders per day at the merchant's own price
    HORIZON:    90,            // days in the forecast window
    ELASTICITY: [-1.9, -0.9],  // the honest band for own-price elasticity
    MAX_STEP:   0.12,          // biggest move one test is allowed to make

    /* ---- defaults + input limits ------------------------------------ */
    PRICE_DEFAULT: 48,
    COST_DEFAULT:  19,
    MONEY_MAX:     1000000,    // above this we say so rather than pretend
    MIN_MARGIN:    0.02,       // a tested price never lands within 2% of cost

    /* Below this the honest answer is "don't bother": an uplift smaller
       than FLAT_ABS over the whole horizon, or than FLAT_REL of baseline
       profit, is noise dressed up as a recommendation. */
    FLAT_ABS: 40,
    FLAT_REL: 0.002,

    /* ---- chart ------------------------------------------------------- */
    CHART_H:    52,            // px
    CHART_PAD:  10,            // px inset at each end
    CHART_ROOM: 1.10,          // headroom past the widest end of the band

    /* ---- motion / lifecycle ------------------------------------------ */
    TWEEN_MS:    400,          // the forecast eases to its new value
    SETTLE_MS:   140,          // …plus this, then it is snapped, loop or no
    ANNOUNCE_MS: 300,          // …plus this, then the screen reader is told
    FAST_MS:     33,           // rAF-starvation heartbeat, only while tweening
    WATCH_MS:    250,          // layout poll + "is rAF alive?" probe
    LIVE_MS:     1000,         // a frame older than this means rAF is starved
    LAY_EPS:     1.5,          // px of width drift tolerated before relayout
    REFLOW_MS:   [60, 260, 600] // re-measure after an orientation flip
  };

  /* =====================================================================
     THE MODEL
     ---------------------------------------------------------------------
     Constant-elasticity demand — the standard first-order account of how
     volume answers price, and the same arithmetic the simulation section
     runs, so the two halves of the page can never disagree:

         orders(P, e)  = O_DAY * (P / P0)^e
         profit(P, e)  = (P - COST) * orders(P, e)
         delta90(P, e) = [ profit(P,e) - profit(P0, ·) ] * HORIZON

     ELASTICITY is a band, [-1.9, -0.9], not a number. Everything here
     follows from refusing to collapse it:

       · The price to TEST is chosen with the band's CENTRE, e = -1.4.
         For e < -1 the profit curve is single-peaked in P, because

             d/dP [ (P - C) P^e ] = P^(e-1) [ (1 + e)P - eC ]

         which vanishes at  P* = C * e / (1 + e)  — at e = -1.4 that is
         3.5 * C. One test is not allowed to leap the whole way there, so
         the move is capped at ±MAX_STEP and the tested price is P* clamped
         into that window. (For e >= -1 the curve never turns over and the
         cap simply binds upward.) P0 is inside the window, so the centre
         case can never come out below zero: the worst the model will
         propose is "don't move".

       · The BOUNDS come from scoring that ONE chosen price at both ends of
         the band. Same price, same 90 days, the whole spread of demand
         responses we are not pretending to know. That is why the low end
         can be — and at the default numbers is — negative.

       · BREAK-EVEN TOLERANCE. Profit is unchanged when

             (P1 - COST) * q1 = (P0 - COST) * q0

         so the volume ratio that breaks even is (P0-COST)/(P1-COST), and
         the slack around it is

             tol = 1 - (P0 - COST) / (P1 - COST)

         Positive on a price rise: the share of orders you can afford to
         lose. Negative on a cut: the share you have to win back.
     ===================================================================== */

  var REASONS = {
    'price-empty': 'Enter your price.',
    'price-bad':   'Numbers only, please.',
    'price-zero':  'Price has to be above zero.',
    'price-huge':  'Try a price under $1,000,000.',
    'cost-empty':  'Enter your unit cost.',
    'cost-bad':    'Numbers only, please.',
    'cost-huge':   'Try a cost under $1,000,000.',
    'margin':      'Cost has to be under your price.',
    'range':       'Those numbers are out of range.'
  };

  function bad(reason) {
    return {
      ok: false, reason: reason, message: REASONS[reason] || REASONS.range,
      price: 0, cost: 0, testPrice: 0, mid: 0, lo: 0, hi: 0,
      base: 0, pct: 0, tol: 0, flat: true, moved: false, dir: 0
    };
  }

  function model(price, cost) {
    if (price !== price) return bad('price-bad');          // NaN from a typo
    if (price == null)   return bad('price-empty');
    if (!isFinite(price)) return bad('price-huge');
    if (price <= 0)      return bad('price-zero');
    if (price > T.MONEY_MAX) return bad('price-huge');

    if (cost !== cost)   return bad('cost-bad');
    if (cost == null)    return bad('cost-empty');
    if (!isFinite(cost)) return bad('cost-huge');
    if (cost < 0)        return bad('cost-bad');
    if (cost > T.MONEY_MAX) return bad('cost-huge');
    if (cost >= price)   return bad('margin');

    var E = T.ELASTICITY;
    var ec = (E[0] + E[1]) / 2;                   // the band's centre, -1.4

    /* the window one test may move within, never landing on top of cost */
    var top = price * (1 + T.MAX_STEP);
    var bot = Math.max(price * (1 - T.MAX_STEP), cost * (1 + T.MIN_MARGIN));
    if (bot > top) bot = top;

    /* the centre-case optimum, clamped into that window */
    var star = (ec < -1) ? (cost * ec / (1 + ec)) : Infinity;
    var P1 = star !== star ? top : (star < bot ? bot : (star > top ? top : star));
    if (!isFinite(P1) || P1 <= cost) P1 = top;

    function d90(P, e) {
      var q = T.O_DAY * Math.pow(P / price, e);
      return ((P - cost) * q - (price - cost) * T.O_DAY) * T.HORIZON;
    }

    var a = d90(P1, E[0]);                        // pessimistic end
    var b = d90(P1, E[1]);                        // optimistic end
    var mid = d90(P1, ec);
    var base = (price - cost) * T.O_DAY * T.HORIZON;

    if (!isFinite(a) || !isFinite(b) || !isFinite(mid) || !isFinite(base)) {
      return bad('range');
    }

    var lo = a < b ? a : b;
    var hi = a < b ? b : a;
    if (mid < 0) mid = 0;                         // see the derivation above

    var moved = Math.abs(P1 - price) > 0.005 * price;
    var worth = mid >= Math.max(T.FLAT_ABS, base * T.FLAT_REL);

    return {
      ok: true, reason: '', message: '',
      price: price, cost: cost, testPrice: P1,
      mid: mid, lo: lo, hi: hi, base: base,
      pct: base > 0 ? mid / base : 0,
      tol: 1 - (price - cost) / (P1 - cost),
      flat: !(moved && worth),
      moved: moved,
      dir: P1 > price ? 1 : (P1 < price ? -1 : 0)
    };
  }

  /* =====================================================================
     Formatting. Money is never shown to more precision than it deserves,
     and never as "NaN".
     ===================================================================== */

  function group(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function safe(v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; }

  /* $53.76 — two decimals, grouped */
  function exactMoney(v) {
    v = safe(v);
    var s = Math.abs(v).toFixed(2).split('.');
    return (v < 0 ? '−' : '') + '$' + group(s[0]) + '.' + s[1];
  }
  /* +$4,020 / −$2,210 */
  function signedMoney(v) {
    v = safe(v);
    var r = Math.round(Math.abs(v));
    if (r === 0) return '$0';
    return (v < 0 ? '−' : '+') + '$' + group(r);
  }
  /* the hero. Past a million, digits stop being read and start being
     counted — so hand those back compacted rather than as a wall. */
  function heroMoney(v) {
    v = safe(v);
    if (Math.abs(v) >= 1e6) return (v < 0 ? '−' : '+') + compactMoney(Math.abs(v));
    return signedMoney(v);
  }
  /* $1.0k — compact, for the range beside the hero */
  function compactMoney(v) {
    v = safe(v);
    var a = Math.abs(v);
    if (a < 0.5) return '$0';            /* never "−$0" */
    var s = v < 0 ? '−' : '';
    if (a < 1000)  return s + '$' + Math.round(a);
    if (a < 1e6)   return s + '$' + (Math.round(a / 100) / 10).toFixed(1) + 'k';
    if (a < 1e9)   return s + '$' + (Math.round(a / 1e5) / 10).toFixed(1) + 'm';
    return s + '$' + (Math.round(a / 1e8) / 10).toFixed(1) + 'b';
  }
  /* +11.4% — and past 100% the decimal is false precision, so it goes */
  function pct(v) {
    v = safe(v) * 100;
    var a = Math.abs(v);
    if (a < 0.05) return '0.0%';
    return (v < 0 ? '−' : '+') + (a < 100 ? a.toFixed(1) : group(Math.round(a))) + '%';
  }
  /* 16.6% — unsigned, for the break-even sentence */
  function pctAbs(v) {
    return (Math.abs(safe(v)) * 100).toFixed(1) + '%';
  }
  /* what a screen reader should hear, with the typography spelled out */
  function spoken(v) {
    v = safe(v);
    return (v < 0 ? 'minus ' : '') + '$' + group(Math.round(Math.abs(v)));
  }

  /* Lenient on purpose: "$1,299", " 48.50 " and "48." all parse. Anything
     with a letter, a sign or a second dot does not — and comes back as NaN,
     which the model turns into a sentence rather than a number. */
  function parseMoney(raw) {
    if (raw == null) return NaN;
    var s = String(raw).replace(/[\s,$  ]/g, '');
    if (!s) return null;                       // empty is its own message
    if (!/^[0-9]*\.?[0-9]*$/.test(s)) return NaN;
    if (s === '.') return NaN;
    var v = parseFloat(s);
    return isFinite(v) ? v : NaN;
  }

  /* =====================================================================
     Stylesheet — injected once per document, refcounted
     ===================================================================== */

  var CSS = [
    '.pfl-root{',
    '  position:relative;box-sizing:border-box;display:block;',
    '  background:#030818;color:#f3ecde;',
    "  font-family:'Inter',system-ui,'Helvetica Neue',Arial,sans-serif;",
    '  -webkit-font-smoothing:antialiased;',
    '  padding:44px clamp(20px,5vw,72px) 48px;',
    '}',
    '.pfl-root *,.pfl-root *::before,.pfl-root *::after{box-sizing:border-box;}',
    '@media (min-width:768px) and (min-height:600px){',
    '  .pfl-root{padding:72px clamp(20px,5vw,72px);}',
    '}',
    '@media (orientation:landscape) and (max-height:520px){',
    '  .pfl-root{padding:34px clamp(16px,4vw,48px) 40px;}',
    '}',
    '.pfl-inner{max-width:1180px;margin:0 auto;}',

    /* ---- headline ---- */
    '.pfl-head{',
    '  margin:0 0 clamp(22px,3.2vw,38px);max-width:17ch;',
    "  font-family:'Hedvig Letters Serif',Georgia,serif;",
    '  font-weight:400;font-size:clamp(30px,5vw,56px);',
    '  line-height:1.05;letter-spacing:-0.02em;color:#f3ecde;',
    '  text-wrap:balance;',
    '}',

    /* ---- two-column frame; one column below 880px ---- */
    '.pfl-grid{display:grid;grid-template-columns:1fr;gap:clamp(24px,3.4vw,44px);align-items:start;}',
    '@media (min-width:880px){',
    '  .pfl-grid{grid-template-columns:minmax(260px,340px) minmax(0,1fr);gap:clamp(36px,5vw,72px);}',
    '}',
    /* A landscape phone is wide and desperately short. Go to two columns
       early there — vertical room is the scarce thing, not horizontal. */
    '@media (min-width:660px) and (orientation:landscape) and (max-height:520px){',
    '  .pfl-grid{grid-template-columns:minmax(200px,286px) minmax(0,1fr);gap:30px;}',
    '}',

    /* ---- the two number fields ---- */
    '.pfl-fields{display:flex;flex-wrap:wrap;gap:12px;}',
    '.pfl-field{flex:1 1 128px;min-width:0;}',
    '.pfl-lab{',
    '  display:block;margin:0 0 8px;font-size:11px;font-weight:500;',
    '  letter-spacing:0.14em;text-transform:uppercase;',
    '  color:rgba(147,170,255,0.62);white-space:nowrap;',
    '}',
    '.pfl-well{',
    '  position:relative;display:flex;align-items:center;gap:2px;',
    '  min-height:56px;padding:0 14px;border-radius:14px;',
    '  border:1px solid rgba(147,170,255,0.24);',
    '  background:linear-gradient(180deg,rgba(29,78,216,0.10),rgba(13,33,104,0.34));',
    '  transition:border-color .22s ease,background .22s ease;',
    '}',
    '.pfl-well:focus-within{',
    '  border-color:rgba(147,170,255,0.62);',
    '  background:linear-gradient(180deg,rgba(29,78,216,0.18),rgba(13,33,104,0.44));',
    '  outline:2px solid rgba(147,170,255,0.85);outline-offset:2px;',
    '}',
    '.pfl-cur{',
    '  flex:none;font-size:clamp(17px,2vw,20px);font-weight:400;line-height:1;',
    '  color:rgba(243,236,222,0.40);pointer-events:none;',
    '}',
    '.pfl-num{',
    '  flex:1 1 auto;min-width:0;',
    '  margin:0;padding:15px 0;border:0;background:transparent;color:#f3ecde;',
    "  font-family:'Inter',system-ui,'Helvetica Neue',Arial,sans-serif;",
    '  font-size:clamp(19px,2.3vw,23px);font-weight:500;line-height:1.1;',
    '  letter-spacing:-0.01em;font-variant-numeric:tabular-nums;',
    '  appearance:none;-webkit-appearance:none;border-radius:0;',
    '  outline:none;-webkit-tap-highlight-color:transparent;',
    '}',
    '.pfl-num::placeholder{color:rgba(243,236,222,0.26);}',
    '.pfl-num::-webkit-outer-spin-button,.pfl-num::-webkit-inner-spin-button{',
    '  -webkit-appearance:none;margin:0;}',
    '.pfl-root.pfl-bad .pfl-well{border-color:rgba(255,157,122,0.55);}',

    /* ---- the forecast ---- */
    '.pfl-out{position:relative;min-height:196px;}',
    '.pfl-cap{display:flex;align-items:center;gap:12px;margin:0 0 clamp(12px,1.8vw,18px);}',
    '.pfl-cap-a{flex:0 0 22px;height:1px;background:rgba(147,170,255,0.30);}',
    '.pfl-cap-t{',
    '  flex:0 0 auto;font-size:11px;font-weight:500;letter-spacing:0.14em;',
    '  text-transform:uppercase;color:rgba(147,170,255,0.66);white-space:nowrap;',
    '  font-variant-numeric:tabular-nums;',
    '}',
    '.pfl-cap-b{flex:1 1 auto;min-width:8px;height:1px;',
    '  background:linear-gradient(90deg,rgba(147,170,255,0.30),rgba(147,170,255,0));}',

    '.pfl-figs{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px clamp(18px,3vw,34px);}',
    '.pfl-heroWrap{display:flex;align-items:baseline;gap:10px;min-width:0;}',
    '.pfl-hero{',
    '  font-size:clamp(38px,7vw,68px);font-weight:500;line-height:1;',
    '  letter-spacing:-0.03em;color:#d8f24b;font-variant-numeric:tabular-nums;',
    '  white-space:nowrap;',
    '}',
    '.pfl-root.pfl-flat .pfl-hero{color:rgba(243,236,222,0.62);}',
    '.pfl-pct{',
    '  font-size:clamp(13px,1.5vw,16px);font-weight:500;line-height:1;',
    '  color:#93aaff;font-variant-numeric:tabular-nums;white-space:nowrap;',
    '}',
    '.pfl-rangeWrap{display:flex;flex-direction:column;gap:5px;min-width:0;}',
    '.pfl-rangeLab{',
    '  font-size:11px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;',
    '  color:rgba(147,170,255,0.55);',
    '}',
    '.pfl-rangeVal{',
    '  font-size:clamp(15px,1.9vw,19px);font-weight:400;line-height:1.15;',
    '  color:rgba(243,236,222,0.80);font-variant-numeric:tabular-nums;white-space:nowrap;',
    '}',

    /* ---- the chart ---- */
    '.pfl-chart{display:block;width:100%;margin:clamp(14px,2.2vw,22px) 0 0;}',
    '.pfl-chart svg{display:block;width:100%;height:auto;overflow:visible;}',
    '.pfl-track{stroke:rgba(243,236,222,0.11);stroke-width:1;fill:none;}',
    '.pfl-zero{stroke:rgba(243,236,222,0.26);stroke-width:1;fill:none;stroke-dasharray:2 3;}',
    '.pfl-zeroT{fill:rgba(243,236,222,0.34);font-size:9px;letter-spacing:0.10em;}',
    '.pfl-band{stroke:rgba(147,170,255,0.58);stroke-width:1.5;fill:none;}',
    '.pfl-capL,.pfl-capR{stroke:rgba(147,170,255,0.58);stroke-width:1;fill:none;}',
    '.pfl-mid{stroke:#d8f24b;stroke-width:1;fill:none;}',
    '.pfl-dot{fill:#d8f24b;}',

    '.pfl-note{',
    '  margin:clamp(12px,1.8vw,16px) 0 0;max-width:46ch;',
    '  font-size:13px;font-weight:300;line-height:1.55;',
    '  color:rgba(243,236,222,0.52);font-variant-numeric:tabular-nums;',
    '}',

    /* invalid input: the figures step aside for one sentence, never NaN */
    '.pfl-oops{',
    '  display:none;margin:0;max-width:34ch;',
    '  font-size:clamp(16px,2vw,19px);font-weight:300;line-height:1.5;',
    '  color:rgba(255,157,122,0.92);',
    '}',
    '.pfl-root.pfl-bad .pfl-oops{display:block;}',
    '.pfl-root.pfl-bad .pfl-figs,',
    '.pfl-root.pfl-bad .pfl-chart,',
    '.pfl-root.pfl-bad .pfl-note{display:none;}',
    '.pfl-root.pfl-bad .pfl-cap{opacity:0.4;}',

    /* ---- the ask ---- */
    '.pfl-ask{',
    '  display:none;margin:clamp(14px,2vw,22px) 0 0;max-width:640px;',
    '}',
    '.pfl-root.pfl-ok .pfl-ask{display:block;}',
    '.pfl-root.pfl-sealed .pfl-ask{display:none;}',
    '.pfl-askLab{',
    '  display:block;margin:0 0 10px;',
    "  font-family:'Hedvig Letters Serif',Georgia,serif;",
    '  font-weight:400;font-size:clamp(22px,2.8vw,30px);line-height:1.2;',
    '  letter-spacing:-0.015em;color:#f3ecde;',
    '}',
    '.pfl-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;}',
    '.pfl-email{',
    '  flex:1 1 232px;min-width:0;min-height:48px;',
    '  padding:13px 20px;border-radius:999px;',
    '  border:1px solid rgba(147,170,255,0.26);',
    '  background:rgba(147,170,255,0.07);color:#f3ecde;',
    "  font:400 16px/1.2 'Inter',system-ui,sans-serif;",   /* 16px: no iOS zoom */
    '  appearance:none;-webkit-appearance:none;',
    '  transition:border-color .22s ease,background .22s ease;',
    '}',
    '.pfl-email::placeholder{color:rgba(243,236,222,0.30);}',
    '.pfl-email:focus{outline:2px solid rgba(147,170,255,0.85);outline-offset:2px;',
    '  border-color:rgba(147,170,255,0.55);background:rgba(147,170,255,0.11);}',
    '.pfl-email[aria-invalid="true"]{border-color:rgba(255,157,122,0.70);}',

    /* Same physical language as the page's .pf-btn glass pill (radius,
       inset highlight, lift, sheen) — defined independently so this module
       never depends on .pf-btn existing, and tinted cream rather than neon
       because neon belongs to the number and the confirmation. */
    '.pfl-send{',
    '  position:relative;isolation:isolate;flex:0 0 auto;',
    '  display:inline-flex;align-items:center;justify-content:center;gap:10px;',
    '  min-height:48px;padding:14px 28px;border-radius:999px;',
    '  border:1px solid rgba(243,236,222,0.34);',
    "  font-family:'Inter',system-ui,'Helvetica Neue',Arial,sans-serif;",
    '  font-size:16px;font-weight:600;letter-spacing:-0.01em;line-height:1;',
    '  color:#f3ecde;cursor:pointer;white-space:nowrap;',
    '  background:linear-gradient(180deg,rgba(243,236,222,0.20),rgba(243,236,222,0.05) 58%,rgba(243,236,222,0.02));',
    '  box-shadow:inset 0 1px 0 rgba(255,255,255,0.28),',
    '    inset 0 -1px 0 rgba(0,0,0,0.16),0 1px 2px rgba(3,8,24,0.45),',
    '    0 10px 30px -12px rgba(147,170,255,0.55);',
    '  transition:transform .34s ' + EASE + ',box-shadow .34s ' + EASE + ',',
    '    background .34s ease,border-color .34s ease;',
    '}',
    '.pfl-send::after{',
    '  content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;',
    '  background:linear-gradient(105deg,transparent 36%,rgba(255,255,255,0.28) 50%,transparent 64%);',
    '  background-size:250% 100%;background-repeat:no-repeat;background-position:-75% 0;',
    '  opacity:0;transition:background-position 1.7s cubic-bezier(.25,.9,.3,1),opacity .34s ease;',
    '}',
    '.pfl-send:hover{transform:translateY(-2px);border-color:rgba(243,236,222,0.52);',
    '  background:linear-gradient(180deg,rgba(243,236,222,0.28),rgba(243,236,222,0.08) 58%,rgba(243,236,222,0.03));',
    '  box-shadow:inset 0 1px 0 rgba(255,255,255,0.36),inset 0 -1px 0 rgba(0,0,0,0.16),',
    '    0 2px 4px rgba(3,8,24,0.42),0 18px 44px -14px rgba(147,170,255,0.75);}',
    '.pfl-send:hover::after{background-position:175% 0;opacity:1;}',
    '.pfl-send:active{transform:translateY(0) scale(.985);transition-duration:.09s;',
    '  box-shadow:inset 0 2px 4px rgba(0,0,0,0.28),inset 0 1px 0 rgba(255,255,255,0.18);}',
    '.pfl-send:focus-visible{outline:2px solid rgba(255,255,255,0.85);outline-offset:5px;}',
    '.pfl-send[disabled]{opacity:.55;cursor:default;transform:none;}',

    /* Both of these interpolate a user-supplied email address, and an address
       with no hyphen in it is a single unbreakable token: at 320px a long one
       ran ~200px past the content box and dragged the whole page into
       horizontal scroll — at the exact moment the signup succeeded. */
    '.pfl-status{margin:12px 0 0;max-width:54ch;overflow-wrap:anywhere;word-break:break-word;',
    '  font-size:13px;font-weight:300;line-height:1.6;color:rgba(243,236,222,0.55);}',
    '.pfl-status:empty{margin:0;}',
    '.pfl-status a{color:#93aaff;text-underline-offset:3px;}',
    '.pfl-status.pfl-err{color:#ff9d7a;}',

    /* ---- confirmation ---- */
    '.pfl-done{display:none;margin:clamp(26px,3.6vw,40px) 0 0;max-width:580px;}',
    '.pfl-root.pfl-sealed .pfl-done{display:block;}',
    '.pfl-doneH{margin:0 0 8px;',
    "  font-family:'Hedvig Letters Serif',Georgia,serif;font-weight:400;",
    '  font-size:clamp(22px,3vw,31px);line-height:1.1;letter-spacing:-0.02em;',
    '  color:#d8f24b;outline:none;}',
    '.pfl-doneP{margin:0;font-size:14px;font-weight:300;line-height:1.6;',
    '  overflow-wrap:anywhere;word-break:break-word;',
    '  color:rgba(243,236,222,0.62);}',
    '.pfl-doneP a{color:#93aaff;text-underline-offset:3px;}',

    '.pfl-sr{position:absolute!important;width:1px;height:1px;margin:-1px;',
    '  padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);',
    '  white-space:nowrap;border:0;}',

    /* Short landscape phones: the section has to fit beside a keyboard. */
    '@media (orientation:landscape) and (max-height:520px){',
    '  .pfl-head{font-size:clamp(24px,3.4vw,34px);margin-bottom:18px;}',
    '  .pfl-hero{font-size:clamp(30px,4.6vw,44px);}',
    '  .pfl-out{min-height:0;}',
    '  .pfl-well{min-height:48px;}',
    '  .pfl-num{padding:11px 0;}',
    '}',

    '@media (prefers-reduced-motion: reduce){',
    '  .pfl-send,.pfl-send::after,.pfl-email,.pfl-well{transition:none!important;}',
    '  .pfl-send:hover{transform:none;}',
    '  .pfl-send::after{display:none;}',
    '}'
  ].join('\n');

  function mountStyle() {
    var s = document.getElementById(STYLE_ID);
    if (!s) {
      s = document.createElement('style');
      s.id = STYLE_ID;
      s.setAttribute('data-pfl-refs', '0');
      s.appendChild(document.createTextNode(CSS));
      (document.head || document.documentElement).appendChild(s);
    }
    var n = parseInt(s.getAttribute('data-pfl-refs') || '0', 10) + 1;
    s.setAttribute('data-pfl-refs', String(n));
  }

  function unmountStyle() {
    var s = document.getElementById(STYLE_ID);
    if (!s) return;
    var n = parseInt(s.getAttribute('data-pfl-refs') || '1', 10) - 1;
    if (n <= 0) { if (s.parentNode) s.parentNode.removeChild(s); }
    else s.setAttribute('data-pfl-refs', String(n));
  }

  /* =====================================================================
     Small helpers
     ===================================================================== */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.appendChild(document.createTextNode(text));
    return n;
  }

  function svgEl(tag, cls, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    if (cls) n.setAttribute('class', cls);
    if (attrs) for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
    }
    return n;
  }

  function setText(node, s) { if (node.firstChild) node.firstChild.nodeValue = s; else node.appendChild(document.createTextNode(s)); }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /* Deliberately stricter than the browser's built-in type=email, which
     happily accepts `a@b`. Requires a dotted domain with an alphabetic TLD
     of two or more characters, and rejects the punctuation that would let
     someone smuggle a second header into the mailto. */
  var EMAIL_RE = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;

  function validEmail(v) {
    if (!v) return false;
    if (v.length > 254) return false;
    if (/[\s,;:<>()[\]\\"\r\n]/.test(v)) return false;
    if (v.indexOf('..') >= 0) return false;
    if (v.charAt(0) === '.' || v.indexOf('.@') >= 0) return false;
    var at = v.indexOf('@');
    if (at < 1 || at > 64) return false;
    if (v.indexOf('@', at + 1) >= 0) return false;
    return EMAIL_RE.test(v);
  }

  /* the channels that tween */
  var CH = ['testPrice', 'mid', 'lo', 'hi', 'pct', 'tol'];

  /* =====================================================================
     init
     ===================================================================== */

  function init(rootArg) {
    var root = (typeof rootArg === 'string')
      ? document.querySelector(rootArg) : rootArg;
    if (!root) throw new Error('initPfWaitlist: no mount element');

    var win = window, doc = document;
    mountStyle();

    var uid = 'pfl' + Math.random().toString(36).slice(2, 8);
    var destroyed = false;

    /* ---- reduced motion ---------------------------------------------- */
    var mq = null, reduce = false;
    if (typeof T.FORCE_REDUCE === 'boolean') {
      reduce = T.FORCE_REDUCE;
    } else if (win.matchMedia) {
      try {
        mq = win.matchMedia('(prefers-reduced-motion: reduce)');
        reduce = !!mq.matches;
      } catch (e) { mq = null; }
    }

    var nowMs = (win.performance && win.performance.now)
      ? function () { return win.performance.now(); }
      : function () { return Date.now(); };

    /* =================================================================
       DOM
       ================================================================= */

    var section = el('section', 'pfl-root');
    section.setAttribute('data-pf', 'waitlist');

    var inner = el('div', 'pfl-inner');
    section.appendChild(inner);

    var head = el('h2', 'pfl-head', 'Join the waitlist.');
    head.id = uid + '-h';
    inner.appendChild(head);

    /* The what-if calculator (fields, forecast figures, chart) is built but
       never attached: the tween, render and submit paths all write into these
       nodes, so they must exist even though the page no longer shows them. */
    var grid = el('div', 'pfl-grid');

    /* ---- fields ------------------------------------------------------ */
    var fields = el('div', 'pfl-fields');
    grid.appendChild(fields);

    function numberField(name, labelText, value) {
      var wrap = el('div', 'pfl-field');
      var lab = el('label', 'pfl-lab', labelText);
      lab.setAttribute('for', uid + '-' + name);
      var well = el('div', 'pfl-well');
      var cur = el('span', 'pfl-cur', '$');
      cur.setAttribute('aria-hidden', 'true');
      var inp = el('input', 'pfl-num');
      inp.id = uid + '-' + name;
      inp.type = 'text';
      inp.value = value;
      inp.setAttribute('inputmode', 'decimal');
      inp.setAttribute('autocomplete', 'off');
      inp.setAttribute('autocorrect', 'off');
      inp.setAttribute('autocapitalize', 'off');
      inp.setAttribute('spellcheck', 'false');
      inp.setAttribute('enterkeyhint', 'done');
      inp.setAttribute('placeholder', '0.00');
      inp.setAttribute('size', '7');
      inp.setAttribute('aria-describedby', uid + '-oops');
      well.appendChild(cur);
      well.appendChild(inp);
      wrap.appendChild(lab);
      wrap.appendChild(well);
      fields.appendChild(wrap);
      return inp;
    }

    var priceIn = numberField('price', 'Your price', T.PRICE_DEFAULT.toFixed(2));
    var costIn  = numberField('cost',  'Your cost',  T.COST_DEFAULT.toFixed(2));

    /* ---- forecast ---------------------------------------------------- */
    var out = el('div', 'pfl-out');
    out.setAttribute('role', 'group');
    out.setAttribute('aria-label', 'Forecast');
    grid.appendChild(out);

    var cap = el('div', 'pfl-cap');
    cap.appendChild(el('span', 'pfl-cap-a'));
    var capT = el('span', 'pfl-cap-t', T.HORIZON + ' days at $0.00');
    cap.appendChild(capT);
    cap.appendChild(el('span', 'pfl-cap-b'));
    out.appendChild(cap);

    var oops = el('p', 'pfl-oops', '');
    oops.id = uid + '-oops';
    out.appendChild(oops);

    var figs = el('div', 'pfl-figs');
    var heroWrap = el('div', 'pfl-heroWrap');
    var hero = el('div', 'pfl-hero', '$0');
    var pctEl = el('div', 'pfl-pct', '0.0%');
    heroWrap.appendChild(hero);
    heroWrap.appendChild(pctEl);
    figs.appendChild(heroWrap);

    var rangeWrap = el('div', 'pfl-rangeWrap');
    rangeWrap.appendChild(el('div', 'pfl-rangeLab', 'Range'));
    var rangeVal = el('div', 'pfl-rangeVal', '$0 – $0');
    rangeWrap.appendChild(rangeVal);
    figs.appendChild(rangeWrap);
    out.appendChild(figs);

    /* ---- chart: hairline geometry, nothing more ---------------------- */
    var chart = el('div', 'pfl-chart');
    var svg = svgEl('svg', 'pfl-svg', {
      viewBox: '0 0 320 ' + T.CHART_H,
      preserveAspectRatio: 'xMidYMid meet',
      focusable: 'false'
    });
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Forecast range');
    var gTrack = svgEl('line', 'pfl-track', {});
    var gZero  = svgEl('line', 'pfl-zero', {});
    var gZeroT = svgEl('text', 'pfl-zeroT', { 'text-anchor': 'middle' });
    gZeroT.appendChild(doc.createTextNode('0'));
    var gBand  = svgEl('line', 'pfl-band', {});
    var gCapL  = svgEl('line', 'pfl-capL', {});
    var gCapR  = svgEl('line', 'pfl-capR', {});
    var gMid   = svgEl('line', 'pfl-mid', {});
    var gDot   = svgEl('circle', 'pfl-dot', { r: 3.2 });
    svg.appendChild(gTrack); svg.appendChild(gZero); svg.appendChild(gZeroT);
    svg.appendChild(gBand); svg.appendChild(gCapL); svg.appendChild(gCapR);
    svg.appendChild(gMid); svg.appendChild(gDot);
    chart.appendChild(svg);
    out.appendChild(chart);

    var note = el('p', 'pfl-note', '');
    note.id = uid + '-note';
    out.appendChild(note);

    /* One live region for the whole forecast. It is written ONCE, after the
       tween has settled — never on a tween frame, which would machine-gun a
       screen reader with sixty numbers a second. The visible figures above
       stay in the accessibility tree, so they can still be browsed. */
    var live = el('p', 'pfl-sr', '');
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');
    out.appendChild(live);

    /* ---- the ask ----------------------------------------------------- */
    var form = el('form', 'pfl-ask');
    form.setAttribute('novalidate', 'novalidate');
    inner.appendChild(form);

    var askLab = el('label', 'pfl-askLab', 'Get early access to Priceflag.');
    askLab.setAttribute('for', uid + '-email');
    form.appendChild(askLab);

    var row = el('div', 'pfl-row');
    var email = el('input', 'pfl-email');
    email.id = uid + '-email';
    email.type = 'email';
    email.name = 'email';
    email.setAttribute('placeholder', 'you@store.com');
    email.setAttribute('autocomplete', 'email');
    email.setAttribute('autocorrect', 'off');
    email.setAttribute('autocapitalize', 'off');
    email.setAttribute('spellcheck', 'false');
    email.setAttribute('enterkeyhint', 'send');
    email.setAttribute('aria-invalid', 'false');
    email.setAttribute('aria-describedby', uid + '-status');
    var send = el('button', 'pfl-send', 'Send it to me');
    send.type = 'submit';
    row.appendChild(email);
    row.appendChild(send);
    form.appendChild(row);

    var status = el('p', 'pfl-status', '');
    status.id = uid + '-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    form.appendChild(status);

    var done = el('div', 'pfl-done');
    var doneH = el('h3', 'pfl-doneH', '');
    doneH.setAttribute('tabindex', '-1');
    var doneP = el('p', 'pfl-doneP', '');
    done.appendChild(doneH);
    done.appendChild(doneP);
    inner.appendChild(done);

    root.appendChild(section);

    /* =================================================================
       State
       ================================================================= */

    var state = model(T.PRICE_DEFAULT, T.COST_DEFAULT);   // the target truth
    var cur   = {};                                       // what is drawn
    var from  = {};
    var i, k;
    for (i = 0; i < CH.length; i++) { k = CH[i]; cur[k] = state[k]; from[k] = state[k]; }

    var tweening = false, t0 = 0;
    var sealed = false, pending = false;
    var lastW = 0, geomW = 320;

    var raf = 0, probe = 0, fast = 0, lastRealFrame = 0;
    var settleTimer = 0, announceTimer = 0, submitTimer = 0;
    var reflow = [];

    function ease(p) { var q = 1 - p; return 1 - q * q * q; }

    /* rAF is considered alive only if it delivered a frame recently. When it
       has not, tweening is skipped entirely and values are set instantly —
       a starved document shows the right number late by zero milliseconds
       instead of the wrong number for half a second. */
    function rafAlive() {
      return lastRealFrame > 0 && (nowMs() - lastRealFrame) < T.LIVE_MS;
    }
    function instant() { return reduce || !rafAlive(); }

    /* =================================================================
       Geometry — recomputed from the measured box, never guessed
       ================================================================= */

    function measure() {
      var w = 0;
      try { w = chart.getBoundingClientRect().width; } catch (e) { w = 0; }
      if (!w) { try { w = out.getBoundingClientRect().width; } catch (e2) { w = 0; } }
      if (!w) w = root.clientWidth || 320;
      return Math.max(160, Math.round(w));
    }

    function layoutStale() {
      return Math.abs(measure() - lastW) > T.LAY_EPS;
    }

    /* Rebuild the drawing box and repaint. No early return: a resize that
       cannot measure still leaves a complete, correct picture. */
    function resize() {
      lastW = measure();
      geomW = lastW;
      svg.setAttribute('viewBox', '0 0 ' + geomW + ' ' + T.CHART_H);
      render();
    }

    /* =================================================================
       Render — total, unconditional
       ================================================================= */

    function xOf(v, half) {
      var span = (geomW / 2) - T.CHART_PAD;
      var x = geomW / 2 + (half > 0 ? (v / half) * span : 0);
      return clamp(x, T.CHART_PAD, geomW - T.CHART_PAD);
    }

    function render() {
      var ok = state.ok;

      section.className = 'pfl-root'
        + (ok ? ' pfl-ok' : ' pfl-bad')
        + (ok && state.flat ? ' pfl-flat' : '')
        + (sealed ? ' pfl-sealed' : '');

      if (!ok) {
        setText(oops, state.message);
        setText(capT, T.HORIZON + ' days');
        svg.setAttribute('aria-label', 'No forecast yet');
        return;                       /* the figures are hidden by CSS, and
                                         still hold their last real values */
      }

      setText(oops, '');
      setText(capT, T.HORIZON + ' days at ' + exactMoney(cur.testPrice));
      setText(hero, heroMoney(cur.mid));
      setText(pctEl, pct(cur.pct));
      setText(rangeVal, compactMoney(cur.lo) + ' – ' + compactMoney(cur.hi));

      /* the note: honest about direction, and about doing nothing */
      if (state.flat && !state.moved) {
        setText(note, 'Your price is already about where we would test.');
      } else if (state.flat) {
        setText(note, 'Too little in this to be worth testing.');
      } else if (cur.tol >= 0) {
        setText(note, 'Break-even: orders can fall ' + pctAbs(cur.tol) + '.');
      } else {
        setText(note, 'Break-even: orders have to rise ' + pctAbs(cur.tol) + '.');
      }

      /* ---- chart ----
         The scale is symmetric about zero, so zero is always dead centre
         and the eye reads two things at once: how big the band is, and how
         much of it is a loss. */
      var half = Math.max(Math.abs(cur.lo), Math.abs(cur.hi)) * T.CHART_ROOM;
      if (!(half > 0)) half = 1;
      var yMid = Math.round(T.CHART_H * 0.46) + 0.5;
      var xL = xOf(cur.lo, half), xR = xOf(cur.hi, half), xM = xOf(cur.mid, half);
      var xZ = Math.round(geomW / 2) + 0.5;

      gTrack.setAttribute('x1', T.CHART_PAD); gTrack.setAttribute('x2', geomW - T.CHART_PAD);
      gTrack.setAttribute('y1', yMid); gTrack.setAttribute('y2', yMid);

      gZero.setAttribute('x1', xZ); gZero.setAttribute('x2', xZ);
      gZero.setAttribute('y1', yMid - 15); gZero.setAttribute('y2', yMid + 15);
      gZeroT.setAttribute('x', xZ); gZeroT.setAttribute('y', yMid + 27);

      gBand.setAttribute('x1', xL); gBand.setAttribute('x2', xR);
      gBand.setAttribute('y1', yMid); gBand.setAttribute('y2', yMid);

      gCapL.setAttribute('x1', xL); gCapL.setAttribute('x2', xL);
      gCapL.setAttribute('y1', yMid - 7); gCapL.setAttribute('y2', yMid + 7);
      gCapR.setAttribute('x1', xR); gCapR.setAttribute('x2', xR);
      gCapR.setAttribute('y1', yMid - 7); gCapR.setAttribute('y2', yMid + 7);

      gMid.setAttribute('x1', xM); gMid.setAttribute('x2', xM);
      gMid.setAttribute('y1', yMid - 11); gMid.setAttribute('y2', yMid + 11);
      gDot.setAttribute('cx', xM); gDot.setAttribute('cy', yMid);

      svg.setAttribute('aria-label',
        'Ninety-day profit range, from ' + spoken(cur.lo) +
        ' to ' + spoken(cur.hi) + ', estimate ' + spoken(cur.mid) + '.');
    }

    /* =================================================================
       The loop. Three drivers, because any one of them may be starved.
       ================================================================= */

    function tick() {
      if (destroyed) return;
      var p = 1;
      if (tweening) {
        p = (nowMs() - t0) / T.TWEEN_MS;
        if (p >= 1) { p = 1; tweening = false; }
        if (p < 0) p = 0;
      }
      var e = ease(p);
      for (var j = 0; j < CH.length; j++) {
        var c = CH[j];
        cur[c] = from[c] + (state[c] - from[c]) * e;
      }
      render();
    }

    function frame() {
      raf = 0;
      lastRealFrame = nowMs();
      tick();
      if (tweening) pump(); else stopLoop();
    }

    function pump() {
      if (destroyed) return;
      if (!raf && win.requestAnimationFrame) raf = win.requestAnimationFrame(frame);
      if (!fast) fast = win.setInterval(fastTick, T.FAST_MS);
    }

    /* The watchdog. It stands down whenever rAF has delivered a frame in
       the recent past, and takes over completely when it has not. */
    function fastTick() {
      if (destroyed) return;
      if (nowMs() - lastRealFrame < T.FAST_MS * 1.6) return;   /* rAF is fine */
      tick();
      if (!tweening) stopLoop();
    }

    function stopLoop() {
      if (raf) { try { win.cancelAnimationFrame(raf); } catch (e) {} raf = 0; }
      if (fast) { win.clearInterval(fast); fast = 0; }
    }

    /* Last line of defence: timers here can be throttled to ~1Hz and rAF may
       never fire at all, so "the loop will get there" is not a guarantee. */
    function armSettle() {
      win.clearTimeout(settleTimer);
      settleTimer = win.setTimeout(function () {
        if (destroyed) return;
        tweening = false;
        for (var j = 0; j < CH.length; j++) cur[CH[j]] = state[CH[j]];
        render();
        stopLoop();
      }, T.TWEEN_MS + T.SETTLE_MS);
    }

    function armAnnounce() {
      win.clearTimeout(announceTimer);
      announceTimer = win.setTimeout(function () {
        if (destroyed) return;
        if (!state.ok) { setText(live, state.message); return; }
        setText(live,
          'At ' + exactMoney(state.testPrice) + ', ' + T.HORIZON +
          '-day profit changes by ' + spoken(state.mid) +
          ', somewhere between ' + spoken(state.lo) +
          ' and ' + spoken(state.hi) + '.');
      }, T.TWEEN_MS + T.SETTLE_MS + T.ANNOUNCE_MS);
    }

    /* =================================================================
       Recompute — the one path every input change takes
       ================================================================= */

    function recompute() {
      if (destroyed) return;
      /* parseMoney gives null for an empty field and NaN for a typo; the
         model turns each of those into its own sentence, never a number. */
      var p = parseMoney(priceIn.value);
      var c = parseMoney(costIn.value);
      state = model(p === null ? undefined : p, c === null ? undefined : c);

      if (!state.ok) {
        /* Hold the last real figures behind the message. Nothing tweens
           toward a number that does not exist, and nothing shows NaN. */
        tweening = false;
        stopLoop();
        win.clearTimeout(settleTimer);
        render();
        armAnnounce();
        return;
      }

      if (instant()) {
        tweening = false;
        for (var j = 0; j < CH.length; j++) cur[CH[j]] = state[CH[j]];
        render();
        armAnnounce();
        return;
      }

      for (var i2 = 0; i2 < CH.length; i2++) from[CH[i2]] = cur[CH[i2]];
      t0 = nowMs();
      tweening = true;
      tick();          /* paint the from-state synchronously, then schedule */
      pump();
      armSettle();
      armAnnounce();
    }

    /* Tidy the field once the user leaves it, never while they are typing. */
    function normalise(input) {
      var v = parseMoney(input.value);
      if (v === null || v !== v || !isFinite(v)) return;
      if (v > T.MONEY_MAX) return;
      input.value = v.toFixed(2);
    }

    /* =================================================================
       The ask
       ================================================================= */

    function setStatus(html, isErr) {
      while (status.firstChild) status.removeChild(status.firstChild);
      status.className = 'pfl-status' + (isErr ? ' pfl-err' : '');
      if (!html) return;
      if (typeof html === 'string') { status.appendChild(doc.createTextNode(html)); return; }
      for (var j = 0; j < html.length; j++) status.appendChild(html[j]);
    }

    function onSubmit(ev) {
      if (ev && ev.preventDefault) ev.preventDefault();
      if (destroyed || pending || sealed) return;

      var addr = String(email.value || '').trim();
      if (!validEmail(addr)) {
        email.setAttribute('aria-invalid', 'true');
        setStatus('That address does not look right.', true);
        try { email.focus(); } catch (e) {}
        return;
      }
      email.setAttribute('aria-invalid', 'false');

      if (!state.ok) {
        setStatus('Fix the numbers above first.', true);
        return;
      }

      pending = true;
      send.disabled = true;
      setStatus('One moment…', false);

      var payload = {
        email: addr,
        price: state.price,
        cost: state.cost,
        testPrice: state.testPrice,
        uplift: state.mid,
        low: state.lo,
        high: state.hi,
        horizon: T.HORIZON,
        page: (win.location && win.location.href) || ''
      };

      var res;
      try { res = T.SUBMIT(payload); }
      catch (e) { res = { ok: false }; }

      if (res && typeof res.then === 'function') {
        res.then(finish, function () { finish({ ok: false }); });
      } else {
        /* Give the button a beat so the pending state is visible at all. */
        win.clearTimeout(submitTimer);
        submitTimer = win.setTimeout(function () { finish(res); }, 240);
      }
    }

    function finish(res) {
      if (destroyed) return;
      pending = false;
      send.disabled = false;
      res = res || { ok: false };

      if (!res.ok) {
        setStatus(res.message || 'That did not go through. Try again?', true);
        try { email.focus(); } catch (e) {}
        return;
      }

      sealed = true;
      setStatus('', false);

      if (res.via === 'api') {
        setText(doneH, 'You’re on the list.');
        while (doneP.firstChild) doneP.removeChild(doneP.firstChild);
        doneP.appendChild(doc.createTextNode(
          'We’ll write to ' + email.value.trim() + ' when it opens up.'));
      } else {
        setText(doneH, 'Check your mail app.');
        while (doneP.firstChild) doneP.removeChild(doneP.firstChild);
        doneP.appendChild(doc.createTextNode(
          'A draft to ' + T.MAIL_TO + ' is open with your numbers in it. ' +
          'Nothing is stored until you send it — '));
        if (res.href) {
          var a = doc.createElement('a');
          a.href = res.href;
          a.appendChild(doc.createTextNode('open it again'));
          doneP.appendChild(a);
          doneP.appendChild(doc.createTextNode('.'));
        } else {
          doneP.appendChild(doc.createTextNode('try again if it did not open.'));
        }
      }

      render();
      try { doneH.focus(); } catch (e) {}
    }

    /* =================================================================
       Listeners
       ================================================================= */

    var bound = [];
    function on(node, type, fn, opts) {
      node.addEventListener(type, fn, opts);
      bound.push([node, type, fn, opts]);
    }

    function onNum(ev) {
      recompute();
      if (ev && ev.type === 'blur') { normalise(ev.target); recompute(); }
    }

    on(priceIn, 'input', onNum);
    on(costIn, 'input', onNum);
    on(priceIn, 'change', onNum);
    on(costIn, 'change', onNum);
    on(priceIn, 'blur', onNum);
    on(costIn, 'blur', onNum);

    /* Enter in a number field should not do nothing: send the caret on. */
    function onNumKey(ev) {
      if (!ev || ev.key !== 'Enter') return;
      ev.preventDefault();
      recompute();
      try { (ev.target === priceIn ? costIn : email).focus(); } catch (e) {}
    }
    on(priceIn, 'keydown', onNumKey);
    on(costIn, 'keydown', onNumKey);

    on(form, 'submit', onSubmit);
    on(email, 'input', function () {
      if (email.getAttribute('aria-invalid') === 'true' &&
          validEmail(String(email.value || '').trim())) {
        email.setAttribute('aria-invalid', 'false');
        setStatus('', false);
      }
    });

    /* ---- resize: five independent sources, because any one of them may
       be starved in this environment ---------------------------------- */
    function scheduleReflow() {
      for (var j = 0; j < reflow.length; j++) win.clearTimeout(reflow[j]);
      reflow.length = 0;
      for (var m = 0; m < T.REFLOW_MS.length; m++) {
        reflow.push(win.setTimeout(function () {
          if (!destroyed) resize();
        }, T.REFLOW_MS[m]));
      }
    }

    function onResize() {
      if (destroyed) return;
      resize();                 /* renders unconditionally */
      scheduleReflow();
    }

    on(win, 'resize', onResize);
    on(win, 'orientationchange', onResize);
    if (win.visualViewport) on(win.visualViewport, 'resize', onResize);

    var ro = null;
    if (win.ResizeObserver) {
      try {
        ro = new win.ResizeObserver(function () {
          if (!destroyed && layoutStale()) resize();
        });
        ro.observe(chart);
      } catch (e) { ro = null; }
    }

    var onMq = null;
    if (mq && typeof T.FORCE_REDUCE !== 'boolean') {
      onMq = function () {
        reduce = !!mq.matches;
        if (reduce) {
          tweening = false;
          stopLoop();
          for (var j = 0; j < CH.length; j++) cur[CH[j]] = state[CH[j]];
        }
        resize();
      };
      if (mq.addEventListener) mq.addEventListener('change', onMq);
      else if (mq.addListener) mq.addListener(onMq);
    }

    /* ---- slow watchdog ------------------------------------------------
       Two jobs. It re-measures, because ResizeObserver delivery rides the
       same starved lifecycle and may never fire. And it keeps one rAF in
       flight so `rafAlive()` has a fresh answer: in a healthy document the
       probe lands and values tween; in a starved one it never does and
       every value is set instantly instead. */
    var watch = win.setInterval(function () {
      if (destroyed) return;
      if (layoutStale()) resize();
      if (!raf && !probe && win.requestAnimationFrame) {
        probe = win.requestAnimationFrame(function () {
          probe = 0;
          lastRealFrame = nowMs();
        });
      }
    }, T.WATCH_MS);

    /* =================================================================
       First paint — unconditional, not gated on anything
       ================================================================= */
    resize();
    armAnnounce();
    scheduleReflow();
    if (win.requestAnimationFrame) {
      probe = win.requestAnimationFrame(function () {
        probe = 0;
        lastRealFrame = nowMs();
      });
    }

    /* =================================================================
       Cleanup
       ================================================================= */
    return function cleanup() {
      if (destroyed) return;
      destroyed = true;
      stopLoop();
      if (probe) { try { win.cancelAnimationFrame(probe); } catch (e) {} probe = 0; }
      win.clearInterval(watch);
      win.clearTimeout(settleTimer);
      win.clearTimeout(announceTimer);
      win.clearTimeout(submitTimer);
      for (var j = 0; j < reflow.length; j++) win.clearTimeout(reflow[j]);
      reflow.length = 0;
      for (var b = 0; b < bound.length; b++) {
        try { bound[b][0].removeEventListener(bound[b][1], bound[b][2], bound[b][3]); }
        catch (e) {}
      }
      bound.length = 0;
      if (ro) { try { ro.disconnect(); } catch (e) {} ro = null; }
      if (mq && onMq) {
        if (mq.removeEventListener) mq.removeEventListener('change', onMq);
        else if (mq.removeListener) mq.removeListener(onMq);
      }
      if (section.parentNode) section.parentNode.removeChild(section);
      unmountStyle();
    };
  }

  init.T = T;          /* the seam, swappable at runtime; not a second global */
  init.model = model;  /* pure, side-effect free — used by the test harness */
  return init;
})();
