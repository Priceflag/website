/* =====================================================================
   Priceflag — waitlist, execution B: "the ticket"
   ---------------------------------------------------------------------
   Usage:   var cleanup = window.initPfWaitlistB(rootElementOrSelector);
            cleanup();          // removes DOM, listeners, timers, rAF

   Exactly one global is created: window.initPfWaitlistB.
   Every selector in the injected stylesheet is prefixed `.pfq-`.
   Zero dependencies. No CDN. No imports. No pre-existing markup needed.

   WHAT THIS SECTION IS -------------------------------------------------
   One object, not a form plus a panel. A ticket: a single engraved
   surface carrying the visitor's own two numbers at the top, the derived
   forecast in the middle, and — below a perforation — the address field
   that asks for the same answer across their whole catalogue. The two
   numbers at the top are real <input>s sitting in lit slots; every other
   figure on the ticket is plain text in the same right-hand column, so
   "boxed = you may edit this, plain = we computed this" is legible in
   under a second without a word of instruction.

   The forecast resolves ON the ticket. There is no result panel; the
   same surface simply prints more once you have edited it.

   THE HONEST BIT -------------------------------------------------------
   The readout is always a low-high range, never a point estimate, and
   the range's relationship to zero is drawn on a small axis so "does
   this clear zero?" is answerable at a glance. The verdict line says so
   out loud when the numbers do not justify the move.

   NO BACKEND -----------------------------------------------------------
   There is no server. The address is NOT posted anywhere and it is NOT
   thrown away: on submit it goes to the visitor's own mail client along
   with the numbers they entered, and the UI says exactly that. The one
   integration seam is window.initPfWaitlistB.SUBMIT — see the big
   comment above its definition.

   ENVIRONMENT NOTE -----------------------------------------------------
   In the target environment `document.hidden` is permanently true, which
   starves requestAnimationFrame, ResizeObserver AND IntersectionObserver.
   Three rules follow, and all three are obeyed below:

     1. Nothing is measured. The whole readout — including the range axis
        — is laid out in percentages and flexbox, so there is no resize
        path to starve. No ResizeObserver exists in this file.
     2. First paint is unconditional and synchronous: mount snaps the
        tween to its target and renders before returning. Nothing waits
        on an IntersectionObserver; there is no IntersectionObserver.
     3. The number tween is wall-clock driven, and a watchdog interval
        steps it whenever rAF has gone quiet — standing itself down the
        moment real frames arrive. Every path through tick(), render()
        and the input handlers ends in a complete rendered state; none
        of them can return early leaving a stale or half-written frame.
   ===================================================================== */

window.initPfWaitlistB = (function () {
  'use strict';

  var win = window;
  var doc = document;

  /* ---- tunables ------------------------------------------------------
     The product constants MUST agree with the rest of the site; they are
     the same numbers sections/pf-sim.js runs on. */
  var T = {
    /* --- the model (shared with the rest of the site) --- */
    O_DAY:      25.2,           // reference volume: orders per day at P0
    HORIZON:    90,             // forecast window, days
    ELASTICITY: [-1.9, -0.9],   // the honest band for own-price elasticity
    MAX_MOVE:   0.15,           // furthest from today's price we will extrapolate
    SNAP:       0.05,           // the tested price lands on a 5c grid

    /* --- defaults the ticket opens on --- */
    PRICE0:     48.00,
    COST0:      19.00,

    /* --- input guards --- */
    MAX_VALUE:  1000000,        // typing 9999999999 must not produce Infinity
    NOISE_PCT:  0.005,          // |centre| under 0.5% of baseline == noise

    /* --- where the address goes until a real endpoint exists --- */
    MAILTO:     'hello@priceflag.org',

    /* --- motion ---
       ONE duration for the whole readout. Every figure on the ticket is
       lerped off a single shared progress, so they all leave together and
       all land together: the price, the percent, the range and the axis
       can never be caught mid-flight describing different forecasts. It
       is also a hard bound — after TWEEN_MS the readout is exact, however
       far the numbers had to travel, and however starved the frames. */
    TWEEN_MS:   420,
    /* Generous, deliberately. Under starved frames the watchdog delivers
       ~90ms steps, and a small MAX_DT would stretch a 420ms tween into
       nearly a second of visibly stale figures. Because the tween is
       bounded and monotone, an oversized dt is harmless — it just lands
       the readout early, which is the correct answer anyway. */
    MAX_DT:     0.5,
    WATCHDOG_MS: 90,
    ANNOUNCE_MS: 620            // quiet time before the live region speaks
  };

  var STYLE_ID = 'pfq-styles';
  var MINUS = '−';         // U+2212, not a hyphen: it aligns with digits
  var EMAIL_RE = /^[^\s@,;:<>()[\]\\"]+@[^\s@,;:<>()[\]\\"]+\.[A-Za-z]{2,}$/;
  var uid = 0;

  /* =====================================================================
     THE MODEL

       orders(P, e) = O_DAY * (P / P0)^e        constant-elasticity demand
       profit(P, e) = (P - COST) * orders(P, e)
       horizon      = 90 days

     O_DAY is the reference volume the elasticity band is quoted at. The
     band [-1.9, -0.9] is the honest range. Its CENTRE, -1.4, is what the
     tested price is chosen with; the two ENDS are what that same price is
     then scored across. Choosing and scoring off one band is the whole
     trick — it is what stops the headline and the range being answers to
     two different questions.

     Choosing. Under constant elasticity the profit-maximising price is
     the textbook markup

         P* = COST * e / (1 + e)

     which at e = -1.4 is 3.5 x COST. Constant elasticity is only worth
     trusting near the price it was measured at, so P* is clamped to
     +-MAX_MOVE around today's price and snapped to a 5c grid. Every
     figure below is then evaluated at that SNAPPED price, so the printed
     price and the printed forecast can never disagree with each other.

     Scoring. The 90-day profit delta at elasticity e is

         d90(e) = [ (P1 - COST) * O_DAY * (P1/P0)^e
                    - (P0 - COST) * O_DAY ] * HORIZON

     lo/hi are d90 at the two band ends, mid is d90 at the centre. lo is
     never presented alone and mid is never presented alone.

     Break-even. Setting (P1-COST)*Q1 == (P0-COST)*Q0 gives
     Q1/Q0 = (P0-COST)/(P1-COST), so the volume the move can afford to
     lose is

         tol = 1 - (P0 - COST) / (P1 - COST)

     Positive tol means "you may lose this much volume and still be even".
     Negative tol (a price CUT) means volume has to GROW by that much
     before the cut pays for itself. It is shown against what the model
     actually expects volume to do, so the cushion has something to be
     compared with.
     =================================================================== */
  function model(P0, COST) {
    var e0 = T.ELASTICITY[0], e1 = T.ELASTICITY[1];
    var ec = (e0 + e1) / 2;

    /* P* = COST * e/(1+e). Only meaningful for e < -1 (elastic demand);
       the band centre is -1.4, but guard anyway so a retuned band can
       never divide by zero or point the proposal the wrong way. */
    var opt = (ec < -1) ? (COST * ec / (1 + ec)) : (P0 * (1 + T.MAX_MOVE));

    var P1 = clamp(opt, P0 * (1 - T.MAX_MOVE), P0 * (1 + T.MAX_MOVE));
    P1 = Math.round(P1 / T.SNAP) * T.SNAP;
    /* Belt and braces: the clamp already keeps P1 well above COST for any
       COST < P0, but a tested price at or under cost would poison every
       ratio below, so it is made impossible rather than merely unlikely. */
    if (P1 <= COST) P1 = Math.ceil((COST + T.SNAP) / T.SNAP) * T.SNAP;
    P1 = Math.round(P1 * 100) / 100;

    var day0 = (P0 - COST) * T.O_DAY;          // profit per day today
    var ratio = P1 / P0;

    function d90(e) {
      return ((P1 - COST) * T.O_DAY * Math.pow(ratio, e) - day0) * T.HORIZON;
    }

    var a = d90(e0), b = d90(e1);
    var base = day0 * T.HORIZON;
    var mid = d90(ec);

    return {
      P0: P0, COST: COST, P1: P1,
      base: base,
      lo: Math.min(a, b),
      mid: mid,
      hi: Math.max(a, b),
      pct: base > 0 ? (mid / base) * 100 : 0,   // the headline uplift, %
      move: (ratio - 1) * 100,                  // how far the test moves price
      tol: (1 - (P0 - COST) / (P1 - COST)) * 100,   // volume cushion, %
      vol: (Math.pow(ratio, ec) - 1) * 100          // volume the model expects, %
    };
  }

  /* The honest read on the numbers. Order matters: "no move at all" and
     "the whole band loses" both outrank "the centre is positive".

     `s` is the tween's currently DISPLAYED figures. The sentence is read
     off the same numbers printed beside it, so the ticket can never be
     caught saying one thing while its own range says another mid-flight.
     Only the "no move at all" test comes from the settled model: that is
     a fact about the proposal, not a threshold an easing number should be
     able to trip over on its way past. */
  function verdict(m, s) {
    s = s || m;
    var eps = Math.abs(s.base) * T.NOISE_PCT;
    if (Math.abs(m.P1 - m.P0) < 0.005) {
      return 'Already where the model would put it. Nothing to test.';
    }
    if (s.hi <= 0) {
      return 'Every scenario in the band loses money. Leave the price alone.';
    }
    if (Math.abs(s.mid) < eps) {
      return 'The centre sits inside the noise. Not worth the disruption.';
    }
    if (s.lo >= 0) {
      return 'The whole band pays. This one is worth running.';
    }
    return 'The band crosses zero — a guarded test, not a rollout.';
  }

  /* ---- small helpers -------------------------------------------------- */

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function el(tag, cls, txt) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.appendChild(doc.createTextNode(txt));
    return n;
  }

  function group(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /* $65,772 / -$1,203 — full precision, for figures that anchor a percent */
  function moneyFull(v, minus) {
    if (!isFinite(v)) return '—';
    var neg = v < 0, a = Math.round(Math.abs(v));
    if (a === 0) return '$0';
    return (neg ? (minus || MINUS) : '') + '$' + group(a);
  }

  /* $55.20 — the tested price, always two decimals */
  function money2(v) {
    if (!isFinite(v)) return '—';
    var neg = v < 0, a = Math.abs(v);
    var s = a.toFixed(2).split('.');
    return (neg ? MINUS : '') + '$' + group(s[0]) + '.' + s[1];
  }

  /* +$6.6k / -$2.8k / $940 — compact, for the range ends */
  function moneyCompact(v, signed, minus) {
    if (!isFinite(v)) return '—';
    var neg = v < 0, a = Math.abs(v);
    var sign = neg ? (minus || MINUS) : (signed ? '+' : '');
    if (a >= 1e9) return sign + '$' + (a / 1e9).toFixed(1) + 'B';
    if (a >= 1e6) return sign + '$' + (a / 1e6).toFixed(1) + 'M';
    if (a >= 1000) return sign + '$' + (a / 1000).toFixed(1) + 'k';
    a = Math.round(a);
    if (a === 0) return '$0';
    return sign + '$' + group(a);
  }

  /* +11.4% / -17.8% / 0.0% */
  function pct(v, minus) {
    if (!isFinite(v)) return '—';
    if (Math.abs(v) < 0.05) return '0.0%';
    return (v < 0 ? (minus || MINUS) : '+') + Math.abs(v).toFixed(1) + '%';
  }

  /* spoken form for the live region — screen readers say "minus" better
     than they say U+2212 */
  function speak(v) {
    if (!isFinite(v)) return 'unavailable';
    var a = Math.round(Math.abs(v));
    if (a === 0) return 'zero dollars';
    return (v < 0 ? 'minus ' : 'plus ') + group(a) + ' dollars';
  }

  /* Only ever digits and at most one decimal point reach the model. */
  function parseNum(s) {
    if (s == null) return NaN;
    s = String(s).replace(/[$,\s ]/g, '');
    if (s === '' || s === '.') return NaN;
    if (!/^\d*\.?\d*$/.test(s)) return NaN;
    var v = parseFloat(s);
    return isFinite(v) ? v : NaN;
  }

  function sanitize(s) {
    s = String(s).replace(/[^0-9.]/g, '');
    var i = s.indexOf('.');
    if (i >= 0) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '');
    return s;
  }

  /* Everything the readout refuses to guess at, in one place. */
  function validate(P0, COST) {
    if (!isFinite(P0) && !isFinite(COST)) return 'Enter a price and a unit cost.';
    if (!isFinite(P0)) return 'Enter a price.';
    if (!isFinite(COST)) return 'Enter a unit cost.';
    if (P0 <= 0) return 'A price of zero has nothing to forecast.';
    if (COST < 0) return 'Cost cannot be negative.';
    if (COST >= P0) return 'Cost is at or above price — there is no margin to forecast.';
    return '';
  }

  /* =====================================================================
     Stylesheet — injected once per document, refcounted.
     =================================================================== */
  var CSS = [
    /* ---------- shell ---------- */
    '.pfq{background:#030818;color:#f3ecde;position:relative;z-index:1;',
    '  font-family:\'Inter\',system-ui,-apple-system,\'Helvetica Neue\',Arial,sans-serif;',
    '  -webkit-font-smoothing:antialiased;}',
    '.pfq *,.pfq *::before,.pfq *::after{box-sizing:border-box;}',
    '.pfq-wrap{max-width:1200px;margin:0 auto;padding:64px 24px;}',
    '@media (max-width:359px){.pfq-wrap{padding-left:18px;padding-right:18px;}}',
    '@media (min-width:768px) and (min-height:600px){.pfq-wrap{padding:104px 40px;}}',
    /* a phone held sideways is 844x390: wide enough to trip a width-only
       breakpoint, far too short to spend 104px a side on padding */
    '@media (max-height:540px) and (orientation:landscape){',
    '  .pfq-wrap{padding-top:44px;padding-bottom:44px;}}',

    /* ---------- layout ---------- */
    '.pfq-grid{display:grid;gap:clamp(26px,3.4vw,40px);align-items:start;}',
    '@media (min-width:920px){.pfq-grid{grid-template-columns:1fr minmax(360px,460px);',
    '  gap:clamp(40px,5vw,84px);align-items:center;}}',

    /* ---------- copy ---------- */
    '.pfq-chrome{max-width:44ch;}',
    '.pfq-kicker{margin:0;font-size:11.5px;font-weight:600;line-height:1;',
    '  letter-spacing:.16em;text-transform:uppercase;color:#93aaff;}',
    '.pfq-head{margin:clamp(14px,1.6vw,20px) 0 0;',
    '  font-family:\'Hedvig Letters Serif\',Georgia,Cambria,\'Times New Roman\',serif;',
    '  font-weight:400;font-size:clamp(30px,4vw,52px);line-height:1.1;',
    '  letter-spacing:-0.02em;color:#f3ecde;text-wrap:balance;}',
    '.pfq-lede{margin:clamp(12px,1.3vw,16px) 0 0;max-width:40ch;',
    '  font-size:clamp(15px,1.15vw,16.5px);font-weight:300;line-height:1.6;',
    '  letter-spacing:-0.005em;color:rgba(243,236,222,.62);text-wrap:pretty;}',
    '.pfq-fine{margin:clamp(14px,1.6vw,20px) 0 0;font-size:11px;font-weight:500;',
    '  line-height:1.5;letter-spacing:.08em;text-transform:uppercase;',
    '  color:rgba(243,236,222,.34);}',

    /* ---------- the ticket ----------
       One surface. Hairlines only; the "ticket" reads from the notch and
       the perforation, not from texture. Its own solid background (rather
       than a translucent lift) is load-bearing: the notches are punched
       by drawing the PAGE colour over the card edge. */
    '.pfq-ticket{position:relative;width:100%;max-width:520px;margin:0;',
    '  background:#070e24;border:1px solid rgba(243,236,222,.14);',
    '  border-radius:14px;padding:clamp(15px,2.2vw,21px);',
    '  box-shadow:0 0 0 1px rgba(3,8,24,.6),0 20px 50px -30px rgba(0,0,0,.9);}',

    '.pfq-tick-top{display:flex;align-items:baseline;justify-content:space-between;',
    '  gap:12px;padding-bottom:clamp(11px,1.4vw,14px);}',
    '.pfq-brand{font-size:11px;font-weight:700;letter-spacing:.2em;',
    '  text-transform:uppercase;color:rgba(243,236,222,.86);}',
    '.pfq-stamp{font-size:10px;font-weight:600;letter-spacing:.16em;',
    '  text-transform:uppercase;color:rgba(147,170,255,.8);white-space:nowrap;}',

    '.pfq-rule{height:1px;background:rgba(243,236,222,.13);',
    '  margin:clamp(9px,1.2vw,13px) 0;}',
    /* the receipt "total" rule: two hairlines, nothing between them */
    '.pfq-rule--heavy{height:4px;background:none;',
    '  border-top:1px solid rgba(243,236,222,.24);',
    '  border-bottom:1px solid rgba(243,236,222,.24);',
    '  margin:clamp(12px,1.6vw,16px) 0;}',

    /* ---------- ledger rows ---------- */
    '.pfq-row{display:flex;align-items:center;gap:10px;min-height:30px;}',
    '.pfq-row+.pfq-row{margin-top:2px;}',
    '.pfq-row--edit{min-height:50px;}',
    '.pfq-row--edit+.pfq-row--edit{margin-top:8px;}',
    '.pfq-lab{flex:1 1 auto;min-width:0;margin:0;font-size:10.5px;font-weight:600;',
    '  line-height:1.25;letter-spacing:.13em;text-transform:uppercase;',
    '  color:rgba(243,236,222,.5);}',
    '.pfq-row--edit .pfq-lab{font-size:11px;color:rgba(243,236,222,.72);cursor:pointer;}',
    '.pfq-val{flex:0 0 auto;min-width:96px;text-align:right;white-space:nowrap;',
    '  font-size:14.5px;font-weight:500;font-variant-numeric:tabular-nums;',
    '  font-feature-settings:\'tnum\' 1;color:rgba(243,236,222,.92);}',
    '.pfq-sub{flex:0 0 auto;min-width:56px;text-align:right;white-space:nowrap;',
    '  font-size:11.5px;font-weight:600;font-variant-numeric:tabular-nums;',
    '  color:rgba(147,170,255,.85);}',

    /* ---------- the two editable numbers ----------
       The whole affordance. A lit slot, a brighter periwinkle underline, a
       44px target and a visible caret colour — against plain, unboxed text
       on every computed row. Nobody has to be told which two move. */
    '.pfq-slot{flex:0 0 auto;display:flex;align-items:center;gap:1px;',
    '  min-width:140px;min-height:44px;padding:0 10px;border-radius:9px;',
    '  background:rgba(243,236,222,.05);',
    '  border:1px solid rgba(243,236,222,.17);',
    '  border-bottom:2px solid rgba(147,170,255,.55);',
    '  cursor:text;transition:background-color .18s ease,border-color .18s ease;}',
    '.pfq-slot:hover{background:rgba(243,236,222,.085);',
    '  border-bottom-color:rgba(147,170,255,.92);}',
    '.pfq-slot:focus-within{background:rgba(243,236,222,.1);',
    '  border-color:rgba(147,170,255,.45);border-bottom-color:#93aaff;',
    '  outline:2px solid rgba(147,170,255,.85);outline-offset:2px;}',
    '.pfq-cur{flex:0 0 auto;font-size:14px;font-weight:400;',
    '  color:rgba(243,236,222,.5);}',
    '.pfq-num{flex:1 1 auto;width:100%;min-width:0;margin:0;padding:0;',
    '  background:none;border:0;border-radius:0;outline:none;color:#f3ecde;',
    '  font-family:inherit;font-size:17px;font-weight:500;line-height:1.2;',
    '  font-variant-numeric:tabular-nums;font-feature-settings:\'tnum\' 1;',
    '  text-align:right;caret-color:#93aaff;-moz-appearance:textfield;',
    '  -webkit-appearance:none;appearance:none;}',
    '.pfq-num::-webkit-outer-spin-button,.pfq-num::-webkit-inner-spin-button{',
    '  -webkit-appearance:none;margin:0;}',

    /* ---------- the readout, on the same surface ---------- */
    '.pfq-outtop{display:flex;align-items:baseline;justify-content:space-between;',
    '  gap:10px;}',
    '.pfq-outlab{margin:0;font-size:10.5px;font-weight:600;letter-spacing:.13em;',
    '  text-transform:uppercase;color:rgba(243,236,222,.5);}',
    '.pfq-centrewrap{display:flex;align-items:baseline;gap:6px;white-space:nowrap;}',
    '.pfq-centrelab{font-size:9.5px;font-weight:600;letter-spacing:.13em;',
    '  text-transform:uppercase;color:rgba(243,236,222,.38);}',
    /* neon: the headline uplift number, and nothing else on the ticket */
    '.pfq-centre{font-size:15.5px;font-weight:600;font-variant-numeric:tabular-nums;',
    '  font-feature-settings:\'tnum\' 1;color:#d8f24b;}',
    '.pfq-centre.pfq-centre--down{color:rgba(243,236,222,.7);}',

    '.pfq-range{margin:clamp(6px,0.9vw,9px) 0 0;display:flex;align-items:baseline;',
    '  flex-wrap:wrap;font-size:clamp(23px,4.6vw,33px);font-weight:400;',
    '  line-height:1.12;letter-spacing:-0.022em;font-variant-numeric:tabular-nums;',
    '  font-feature-settings:\'tnum\' 1;color:#f3ecde;}',
    '.pfq-dash{padding:0 .34em;color:rgba(243,236,222,.36);}',

    /* the axis: percent-based, so there is nothing to measure and nothing
       to re-measure on resize */
    '.pfq-bar{position:relative;height:32px;margin:clamp(11px,1.5vw,15px) 0 2px;}',
    '.pfq-axis{position:absolute;left:0;right:0;top:14px;height:1px;',
    '  background:rgba(243,236,222,.15);}',
    '.pfq-band{position:absolute;top:8px;height:13px;border-radius:2px;',
    '  background:rgba(147,170,255,.22);',
    '  border-left:1px solid rgba(147,170,255,.9);',
    '  border-right:1px solid rgba(147,170,255,.9);}',
    '.pfq-zero{position:absolute;top:3px;width:1px;height:23px;',
    '  background:rgba(243,236,222,.5);}',
    '.pfq-zlab{position:absolute;top:24px;transform:translateX(-50%);',
    '  font-size:9.5px;font-weight:600;letter-spacing:.1em;',
    '  color:rgba(243,236,222,.42);}',
    '.pfq-mid{position:absolute;top:4px;width:2px;height:21px;margin-left:-1px;',
    '  border-radius:1px;background:#f3ecde;}',
    '.pfq-bar--off .pfq-band,.pfq-bar--off .pfq-mid{opacity:.18;}',

    '.pfq-verdict{margin:clamp(9px,1.2vw,12px) 0 0;font-size:13px;line-height:1.5;',
    '  letter-spacing:-0.004em;color:rgba(243,236,222,.66);text-wrap:pretty;}',

    /* ---------- perforation ---------- */
    '.pfq-perf{position:relative;height:1px;',
    '  margin:clamp(15px,2vw,20px) calc(clamp(15px,2.2vw,21px) * -1) 0;',
    '  border-top:1px dashed rgba(243,236,222,.22);}',
    '.pfq-notch{position:absolute;top:-7px;width:14px;height:14px;border-radius:50%;',
    '  background:#030818;box-shadow:inset 0 0 0 1px rgba(243,236,222,.1);}',
    '.pfq-notch--l{left:-8px;}',
    '.pfq-notch--r{right:-8px;}',

    /* ---------- the ask ---------- */
    '.pfq-send{padding-top:clamp(15px,2vw,19px);}',
    '.pfq-sendlab{display:block;margin:0 0 10px;font-size:13px;font-weight:500;',
    '  line-height:1.4;letter-spacing:-0.005em;color:rgba(243,236,222,.82);}',
    '.pfq-sendrow{display:flex;gap:8px;flex-wrap:wrap;}',
    '.pfq-email{flex:1 1 180px;min-width:0;min-height:46px;padding:0 12px;',
    '  border-radius:9px;background:rgba(243,236,222,.05);',
    '  border:1px solid rgba(243,236,222,.17);',
    '  border-bottom:2px solid rgba(147,170,255,.55);',
    '  color:#f3ecde;font-family:inherit;font-size:16px;line-height:1.2;',
    '  caret-color:#93aaff;-webkit-appearance:none;appearance:none;',
    '  transition:background-color .18s ease,border-color .18s ease;}',
    '.pfq-email::placeholder{color:rgba(243,236,222,.32);}',
    '.pfq-email:hover{background:rgba(243,236,222,.085);}',
    '.pfq-email:focus{outline:2px solid rgba(147,170,255,.85);outline-offset:2px;',
    '  background:rgba(243,236,222,.1);border-bottom-color:#93aaff;}',
    '.pfq-email[aria-invalid="true"]{border-color:rgba(243,236,222,.55);',
    '  border-bottom-color:rgba(243,236,222,.8);}',
    '.pfq-go{flex:0 0 auto;min-height:46px;min-width:104px;padding:0 20px;',
    '  border-radius:999px;border:1px solid rgba(243,236,222,.22);',
    '  background:rgba(243,236,222,.06);color:#f3ecde;font-family:inherit;',
    '  font-size:14px;font-weight:600;letter-spacing:.01em;cursor:pointer;',
    '  transition:color .2s ease,border-color .2s ease,background-color .2s ease;}',
    '.pfq-go:hover{color:#d8f24b;border-color:rgba(216,242,75,.5);',
    '  background:rgba(216,242,75,.08);}',
    '.pfq-go:focus-visible{outline:2px solid rgba(216,242,75,.85);outline-offset:2px;}',
    '.pfq-go[disabled]{opacity:.5;cursor:default;}',

    '.pfq-status{margin:10px 0 0;font-size:12.5px;line-height:1.5;',
    '  color:rgba(243,236,222,.55);min-height:1.4em;text-wrap:pretty;}',
    /* neon: the confirmed state, and nothing else down here */
    '.pfq-status--ok{color:#d8f24b;}',
    '.pfq-status--err{color:rgba(243,236,222,.92);}',
    '.pfq-status a{color:inherit;text-decoration:underline;',
    '  text-underline-offset:2px;}',

    /* ---------- utilities ---------- */
    '.pfq-sr{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;',
    '  overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;',
    '  border:0;}',

    /* 320-359px: give the ledger back the width the gutter was eating */
    '@media (max-width:359px){',
    '  .pfq-lab{font-size:10px;letter-spacing:.1em;}',
    '  .pfq-slot{min-width:126px;}',
    '  .pfq-val{min-width:80px;font-size:14px;}',
    '  .pfq-sub{min-width:44px;font-size:11px;}',
    '  .pfq-go{min-width:100%;}}',

    /* reduced motion: values land instantly, nothing eases anywhere */
    '@media (prefers-reduced-motion:reduce){',
    '  .pfq *,.pfq *::before,.pfq *::after{',
    '    transition-duration:0.001ms!important;animation-duration:0.001ms!important;',
    '    animation-iteration-count:1!important;}}'
  ].join('\n');

  function mountStyle() {
    var s = doc.getElementById(STYLE_ID);
    if (!s) {
      s = doc.createElement('style');
      s.id = STYLE_ID;
      s.setAttribute('data-pfq-refs', '0');
      s.appendChild(doc.createTextNode(CSS));
      (doc.head || doc.documentElement).appendChild(s);
    }
    var n = parseInt(s.getAttribute('data-pfq-refs') || '0', 10) + 1;
    s.setAttribute('data-pfq-refs', String(n));
  }

  function unmountStyle() {
    var s = doc.getElementById(STYLE_ID);
    if (!s) return;
    var n = parseInt(s.getAttribute('data-pfq-refs') || '1', 10) - 1;
    if (n <= 0) { if (s.parentNode) s.parentNode.removeChild(s); }
    else s.setAttribute('data-pfq-refs', String(n));
  }

  /* =====================================================================
     THE ONE INTEGRATION SEAM.

     There is no backend behind this site. Rather than post to an endpoint
     that does not exist, or — worse, and what this page used to do —
     accept an address and quietly drop it, the default hands the address
     AND the numbers to the visitor's own mail client, and the UI says so
     in plain words.

     A REAL ENDPOINT GOES HERE, and nowhere else:

       window.initPfWaitlistB.SUBMIT = function (p) {
         return fetch('/api/waitlist', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(p)
         }).then(function (r) {
           return {
             ok: r.ok,
             mode: 'api',
             note: r.ok ? 'You are on the list.'
                        : 'That did not send. Write to hello@priceflag.org.'
           };
         });
       };

     Contract: SUBMIT(payload) returns { ok, mode, note } — or a Promise
     of one. `note` is printed verbatim; `ok` decides whether it is
     printed as the confirmed state. The section reads the function off
     the global at click time, so it can be swapped at any point after
     load. `payload` fields are all plain ASCII strings, ready to be sent
     anywhere without re-encoding.
     =================================================================== */
  function defaultSubmit(p) {
    var subject = 'Priceflag waitlist: ' + p.price + ' -> ' + p.testPrice;
    var body = [
      'Add me to the Priceflag waitlist.',
      '',
      'Email          ' + p.email,
      'Current price  ' + p.price,
      'Unit cost      ' + p.cost,
      'Price to test  ' + p.testPrice + '  (' + p.move + ')',
      '',
      '90-day profit  ' + p.low + ' to ' + p.high,
      'Centre         ' + p.centre + '  (' + p.uplift + ')',
      'Model          constant elasticity, band ' + p.elasticity +
        ', ' + p.horizon + ' days',
      '',
      'Run this across my whole catalogue.'
    ].join('\r\n');

    var href = 'mailto:' + T.MAILTO +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);

    try {
      win.location.href = href;
    } catch (e) {
      return {
        ok: false, mode: 'mailto',
        note: 'This browser would not open a mail window. Send your address to ' +
              T.MAILTO + ' and it will go on the list.'
      };
    }
    return {
      ok: true, mode: 'mailto',
      note: 'Your mail app should be open with these numbers in it. Nothing ' +
            'happened? Write to ' + T.MAILTO + ' — nothing is stored here.'
    };
  }

  /* =====================================================================
     The section.
     =================================================================== */
  function init(rootArg) {
    var root = (typeof rootArg === 'string') ? doc.querySelector(rootArg) : rootArg;
    if (!root || root.nodeType !== 1) {
      throw new Error('initPfWaitlistB: needs an element or a selector that matches one');
    }

    mountStyle();

    var id = 'pfq' + (++uid);
    var destroyed = false;
    var listeners = [];

    function on(target, type, fn, opts) {
      target.addEventListener(type, fn, opts || false);
      listeners.push([target, type, fn, opts || false]);
    }
    var mqReduce = win.matchMedia
      ? win.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var reduce = !!(mqReduce && mqReduce.matches);

    /* ---- DOM ---------------------------------------------------------- */
    var prevClass = root.className;
    root.className = (prevClass ? prevClass + ' ' : '') + 'pfq';

    var wrap = el('div', 'pfq-wrap');
    var grid = el('div', 'pfq-grid');

    var chrome = el('div', 'pfq-chrome');
    chrome.appendChild(el('p', 'pfq-kicker', 'Try it'));
    chrome.appendChild(el('h2', 'pfq-head', 'Your price, 90 days out.'));
    chrome.appendChild(el('p', 'pfq-lede',
      'Edit either figure. The forecast is the model we ship.'));
    chrome.appendChild(el('p', 'pfq-fine',
      'Constant elasticity · band ' + T.ELASTICITY[0].toFixed(1) + ' to ' +
      T.ELASTICITY[1].toFixed(1) + ' · ' + T.HORIZON + ' days'));
    grid.appendChild(chrome);

    var form = doc.createElement('form');
    form.className = 'pfq-ticket';
    form.setAttribute('novalidate', 'novalidate');
    form.setAttribute('aria-labelledby', id + '-head');
    chrome.querySelector('.pfq-head').id = id + '-head';

    var top = el('div', 'pfq-tick-top');
    top.appendChild(el('span', 'pfq-brand', 'Priceflag'));
    top.appendChild(el('span', 'pfq-stamp', T.HORIZON + '-day forecast'));
    form.appendChild(top);
    form.appendChild(el('div', 'pfq-rule'));

    /* the two editable numbers */
    function editRow(key, labelText) {
      var row = el('div', 'pfq-row pfq-row--edit');
      var lab = doc.createElement('label');
      lab.className = 'pfq-lab';
      lab.htmlFor = id + '-' + key;
      lab.appendChild(doc.createTextNode(labelText));
      var sr = el('span', 'pfq-sr', ', in dollars');
      lab.appendChild(sr);

      var slot = el('div', 'pfq-slot');
      var cur = el('span', 'pfq-cur', '$');
      cur.setAttribute('aria-hidden', 'true');
      var input = doc.createElement('input');
      input.className = 'pfq-num';
      input.id = id + '-' + key;
      input.type = 'text';
      input.setAttribute('inputmode', 'decimal');
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('autocorrect', 'off');
      input.setAttribute('autocapitalize', 'off');
      input.spellcheck = false;
      input.setAttribute('enterkeyhint', 'done');
      slot.appendChild(cur);
      slot.appendChild(input);

      /* the whole slot is the target, not just the 17px of glyphs */
      on(slot, 'mousedown', function (ev) {
        if (ev.target !== input) { ev.preventDefault(); input.focus(); }
      });

      row.appendChild(lab);
      row.appendChild(slot);
      return { row: row, input: input };
    }

    var priceRow = editRow('price', 'Your price');
    var costRow = editRow('cost', 'Unit cost');
    form.appendChild(priceRow.row);
    form.appendChild(costRow.row);
    form.appendChild(el('div', 'pfq-rule'));

    /* the computed rows, in the same right-hand column */
    function calcRow(labelText) {
      var row = el('div', 'pfq-row');
      row.appendChild(el('span', 'pfq-lab', labelText));
      var val = el('span', 'pfq-val', '—');
      var sub = el('span', 'pfq-sub', '');
      row.appendChild(val);
      row.appendChild(sub);
      return { row: row, val: val, sub: sub };
    }

    var rBase = calcRow('Today, ' + T.HORIZON + ' days');
    var rTest = calcRow('We’d test');
    var rTol = calcRow('Break-even at');
    var rVol = calcRow('Model expects');
    form.appendChild(rBase.row);
    form.appendChild(rTest.row);
    form.appendChild(rTol.row);
    form.appendChild(rVol.row);

    form.appendChild(el('div', 'pfq-rule pfq-rule--heavy'));

    /* the forecast — same surface, no separate panel */
    var outTop = el('div', 'pfq-outtop');
    outTop.appendChild(el('span', 'pfq-outlab', T.HORIZON + '-day profit'));
    var cwrap = el('span', 'pfq-centrewrap');
    cwrap.appendChild(el('span', 'pfq-centrelab', 'Centre'));
    var centreEl = el('span', 'pfq-centre', '—');
    cwrap.appendChild(centreEl);
    outTop.appendChild(cwrap);
    form.appendChild(outTop);

    var rangeEl = el('p', 'pfq-range');
    var loEl = el('span', 'pfq-lo', '—');
    var dashEl = el('span', 'pfq-dash', '–');
    var hiEl = el('span', 'pfq-hi', '—');
    rangeEl.appendChild(loEl);
    rangeEl.appendChild(dashEl);
    rangeEl.appendChild(hiEl);
    form.appendChild(rangeEl);

    var bar = el('div', 'pfq-bar');
    bar.setAttribute('aria-hidden', 'true');
    var axisEl = el('div', 'pfq-axis');
    var bandEl = el('div', 'pfq-band');
    var zeroEl = el('div', 'pfq-zero');
    var zlabEl = el('div', 'pfq-zlab', '0');
    var midEl = el('div', 'pfq-mid');
    bar.appendChild(axisEl);
    bar.appendChild(bandEl);
    bar.appendChild(zeroEl);
    bar.appendChild(midEl);
    bar.appendChild(zlabEl);
    form.appendChild(bar);

    var verdictEl = el('p', 'pfq-verdict', '');
    form.appendChild(verdictEl);

    /* perforation */
    var perf = el('div', 'pfq-perf');
    perf.setAttribute('aria-hidden', 'true');
    perf.appendChild(el('span', 'pfq-notch pfq-notch--l'));
    perf.appendChild(el('span', 'pfq-notch pfq-notch--r'));
    form.appendChild(perf);

    /* the ask */
    var send = el('div', 'pfq-send');
    var sendLab = doc.createElement('label');
    sendLab.className = 'pfq-sendlab';
    sendLab.htmlFor = id + '-email';
    sendLab.appendChild(doc.createTextNode('Email me this for my whole catalogue'));
    send.appendChild(sendLab);

    var sendRow = el('div', 'pfq-sendrow');
    var email = doc.createElement('input');
    email.className = 'pfq-email';
    email.id = id + '-email';
    email.type = 'email';
    email.name = 'email';
    email.placeholder = 'you@yourstore.com';
    email.setAttribute('autocomplete', 'email');
    email.setAttribute('autocorrect', 'off');
    email.setAttribute('autocapitalize', 'off');
    email.setAttribute('enterkeyhint', 'send');
    email.spellcheck = false;
    var go = doc.createElement('button');
    go.className = 'pfq-go';
    go.type = 'submit';
    go.appendChild(doc.createTextNode('Join'));
    sendRow.appendChild(email);
    sendRow.appendChild(go);
    send.appendChild(sendRow);

    var statusEl = el('p', 'pfq-status', '');
    statusEl.id = id + '-status';
    statusEl.setAttribute('role', 'status');
    statusEl.setAttribute('aria-live', 'polite');
    email.setAttribute('aria-describedby', statusEl.id);
    send.appendChild(statusEl);
    form.appendChild(send);

    grid.appendChild(form);
    wrap.appendChild(grid);

    /* the settled forecast, announced once — never per frame */
    var liveEl = el('p', 'pfq-sr', '');
    liveEl.setAttribute('aria-live', 'polite');
    liveEl.setAttribute('aria-atomic', 'true');
    wrap.appendChild(liveEl);

    root.appendChild(wrap);

    /* ---- state -------------------------------------------------------- */
    priceRow.input.value = T.PRICE0.toFixed(2);
    costRow.input.value = T.COST0.toFixed(2);

    var KEYS = ['P1', 'base', 'move', 'tol', 'vol', 'lo', 'mid', 'hi', 'pct',
                'axLo', 'axHi'];
    var target = {}, shown = {}, from = {};
    var elapsed = T.TWEEN_MS;
    var current = null;      // the last VALID model, or null
    var problem = '';        // why there is no model, if there isn't one
    var settled = true;
    var announceTimer = 0;

    /* Axis bounds always contain zero, so "does the band clear zero?" is
       always answerable from the picture. */
    function axisFor(m) {
      var lo = Math.min(0, m.lo), hi = Math.max(0, m.hi);
      var span = hi - lo;
      if (!(span > 0)) span = 1;
      return { lo: lo - span * 0.1, hi: hi + span * 0.1 };
    }

    function recompute() {
      var P0 = parseNum(priceRow.input.value);
      var C = parseNum(costRow.input.value);
      if (isFinite(P0)) P0 = clamp(P0, 0, T.MAX_VALUE);
      if (isFinite(C)) C = clamp(C, 0, T.MAX_VALUE);

      problem = validate(P0, C);
      if (problem) { current = null; render(); scheduleAnnounce(); return; }

      var m = model(P0, C);
      /* Last line of defence. Nothing non-finite is ever allowed to reach
         the formatters or the tween. */
      var k, ok = true;
      for (k in m) {
        if (typeof m[k] === 'number' && !isFinite(m[k])) { ok = false; break; }
      }
      if (!ok) {
        current = null;
        problem = 'Those numbers are out of range.';
        render(); scheduleAnnounce(); return;
      }

      current = m;
      var ax = axisFor(m);
      target.P1 = m.P1; target.base = m.base; target.move = m.move;
      target.tol = -m.tol;         // shown as the volume you may LOSE
      target.vol = m.vol;
      target.lo = m.lo; target.mid = m.mid; target.hi = m.hi; target.pct = m.pct;
      target.axLo = ax.lo; target.axHi = ax.hi;
      begin();
      if (reduce) snap();
      wake();
      render();                    // never leave a frame unpainted
      scheduleAnnounce();
    }

    /* Freeze where the readout currently is, and start the clock. */
    function begin() {
      for (var i = 0; i < KEYS.length; i++) {
        var k = KEYS[i];
        from[k] = isFinite(shown[k]) ? shown[k] : target[k];
      }
      elapsed = 0;
      settled = false;
    }

    function snap() {
      for (var i = 0; i < KEYS.length; i++) {
        shown[KEYS[i]] = from[KEYS[i]] = target[KEYS[i]];
      }
      elapsed = T.TWEEN_MS;
      settled = true;
    }

    /* One progress, one ease, every figure. Wall-clock driven, so rAF and
       the watchdog can both step it and neither can double-step it. */
    function advance(dt) {
      if (dt > T.MAX_DT) dt = T.MAX_DT;
      if (!(dt > 0)) dt = 1 / 60;
      elapsed += dt * 1000;
      var u = elapsed / T.TWEEN_MS;
      if (!(u > 0)) u = 0;
      if (u >= 1) { snap(); return; }
      var e = 1 - Math.pow(1 - u, 3);          // ease-out cubic
      for (var i = 0; i < KEYS.length; i++) {
        var k = KEYS[i], a = from[k], b = target[k];
        shown[k] = (isFinite(a) && isFinite(b)) ? (a + (b - a) * e) : b;
      }
      settled = false;
    }

    /* ---- render — always leaves a complete, correct frame -------------- */
    function render() {
      if (!current) {
        setText(rBase.val, '—'); setText(rBase.sub, '');
        setText(rTest.val, '—'); setText(rTest.sub, '');
        setText(rTol.val, '—'); setText(rTol.sub, '');
        setText(rVol.val, '—'); setText(rVol.sub, '');
        setText(centreEl, '—');
        centreEl.className = 'pfq-centre pfq-centre--down';
        setText(loEl, '—'); setText(hiEl, ''); setText(dashEl, '');
        bar.className = 'pfq-bar pfq-bar--off';
        bandEl.style.left = '45%'; bandEl.style.width = '10%';
        midEl.style.left = '50%'; zeroEl.style.left = '50%'; zlabEl.style.left = '50%';
        setText(verdictEl, problem || 'Enter a price and a unit cost.');
        return;
      }

      var s = shown;
      setText(rBase.val, moneyFull(s.base));
      setText(rBase.sub, '');
      setText(rTest.val, money2(s.P1));
      setText(rTest.sub, pct(s.move));
      setText(rTol.val, pct(s.tol));
      setText(rTol.sub, '');
      setText(rVol.val, pct(s.vol));
      setText(rVol.sub, '');

      setText(centreEl, pct(s.pct));
      centreEl.className = 'pfq-centre' + (s.pct > 0.05 ? '' : ' pfq-centre--down');

      setText(loEl, moneyCompact(s.lo, true));
      setText(dashEl, '–');
      setText(hiEl, moneyCompact(s.hi, true));

      var span = s.axHi - s.axLo;
      function fx(v) { return span > 0 ? clamp((v - s.axLo) / span * 100, 0, 100) : 50; }
      var xlo = fx(s.lo), xhi = fx(s.hi), x0 = fx(0), xm = fx(s.mid);
      bar.className = 'pfq-bar';
      bandEl.style.left = xlo.toFixed(2) + '%';
      bandEl.style.width = Math.max(0.8, xhi - xlo).toFixed(2) + '%';
      zeroEl.style.left = x0.toFixed(2) + '%';
      zlabEl.style.left = x0.toFixed(2) + '%';
      midEl.style.left = xm.toFixed(2) + '%';

      setText(verdictEl, verdict(current, shown));
    }

    function setText(node, s) {
      if (node.firstChild && node.firstChild.nodeType === 3) {
        if (node.firstChild.nodeValue !== s) node.firstChild.nodeValue = s;
      } else {
        while (node.firstChild) node.removeChild(node.firstChild);
        node.appendChild(doc.createTextNode(s));
      }
    }

    /* ---- announcement — once per settle, never per frame --------------- */
    function scheduleAnnounce() {
      if (announceTimer) win.clearTimeout(announceTimer);
      announceTimer = win.setTimeout(function () {
        announceTimer = 0;
        if (destroyed) return;
        if (!current) { setText(liveEl, problem || 'No forecast yet.'); return; }
        var m = current;
        setText(liveEl,
          'Tested price ' + money2(m.P1).replace(MINUS, 'minus ') + '. ' +
          T.HORIZON + '-day profit between ' + speak(m.lo) + ' and ' +
          speak(m.hi) + '. Centre ' + speak(m.mid) + ', ' +
          pct(m.pct).replace(MINUS, 'minus ') + '. ' + verdict(m));
      }, T.ANNOUNCE_MS);
    }

    /* ---- loop ---------------------------------------------------------- */
    var nowMs = (win.performance && win.performance.now)
      ? function () { return win.performance.now(); }
      : function () { return Date.now(); };

    var raf = 0, lastNow = 0, lastRealFrame = -1e9, watchdog = 0;

    function tick(now) {
      if (destroyed) return;
      var dt = lastNow ? (now - lastNow) / 1000 : 1 / 60;
      lastNow = now;
      advance(dt);
      render();                       // unconditional: no early return above
    }

    function frame(now) {
      raf = 0;
      lastRealFrame = nowMs();
      if (destroyed) return;
      tick(typeof now === 'number' ? now : nowMs());
      if (!destroyed && !settled && win.requestAnimationFrame) {
        raf = win.requestAnimationFrame(frame);
      }
    }

    function stopRaf() { if (raf) { win.cancelAnimationFrame(raf); raf = 0; } }

    /* Paint first, schedule second. */
    function wake() {
      if (destroyed) return;
      if (reduce) { snap(); render(); stopRaf(); return; }
      if (settled) return;
      lastNow = 0;
      if (!raf && win.requestAnimationFrame) raf = win.requestAnimationFrame(frame);
    }

    /* Watchdog. In a document that reports itself hidden, rAF never fires
       and the numbers would sit frozen halfway between two forecasts
       forever. This steps the tween whenever frames have gone quiet, and
       stands itself down the moment real ones start arriving. */
    watchdog = win.setInterval(function () {
      if (destroyed || reduce || settled) return;
      var n = nowMs();
      if (n - lastRealFrame < T.WATCHDOG_MS * 1.6) return;   // rAF is healthy
      tick(n);
    }, T.WATCHDOG_MS);

    /* ---- number input behaviour ---------------------------------------- */
    function wireNumber(input) {
      on(input, 'input', function () {
        var raw = input.value, clean = sanitize(raw);
        if (clean !== raw) {
          var end = input.selectionEnd;
          input.value = clean;
          try {
            var d = raw.length - clean.length;
            input.setSelectionRange(Math.max(0, end - d), Math.max(0, end - d));
          } catch (e) { /* selection unsupported on this input type */ }
        }
        recompute();
      });

      on(input, 'blur', function () {
        var v = parseNum(input.value);
        if (isFinite(v)) input.value = clamp(v, 0, T.MAX_VALUE).toFixed(2);
        recompute();
      });

      on(input, 'focus', function () {
        try { input.select(); } catch (e) { /* not selectable, fine */ }
      });

      on(input, 'keydown', function (ev) {
        /* Enter in a price field must not fire the waitlist. */
        if (ev.key === 'Enter') {
          ev.preventDefault();
          input.blur();
          return;
        }
        if (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') return;
        ev.preventDefault();
        var v = parseNum(input.value);
        if (!isFinite(v)) v = 0;
        var step = ev.shiftKey ? 5 : 1;
        v = clamp(v + (ev.key === 'ArrowUp' ? step : -step), 0, T.MAX_VALUE);
        input.value = v.toFixed(2);
        recompute();
      });
    }
    wireNumber(priceRow.input);
    wireNumber(costRow.input);

    /* ---- submit --------------------------------------------------------- */
    var sending = false;

    function status(text, kind) {
      setText(statusEl, text);
      statusEl.className = 'pfq-status' + (kind ? ' pfq-status--' + kind : '');
    }

    /* ASCII-only payload: whatever endpoint replaces SUBMIT should not have
       to know about U+2212. */
    function payloadFor(addr) {
      var m = current;
      var p = {
        email: addr,
        price: isFinite(parseNum(priceRow.input.value))
          ? money2(clamp(parseNum(priceRow.input.value), 0, T.MAX_VALUE)) : '(blank)',
        cost: isFinite(parseNum(costRow.input.value))
          ? money2(clamp(parseNum(costRow.input.value), 0, T.MAX_VALUE)) : '(blank)',
        horizon: String(T.HORIZON),
        elasticity: T.ELASTICITY[0].toFixed(1) + ' to ' + T.ELASTICITY[1].toFixed(1),
        testPrice: '(none)', move: '(none)',
        low: '(none)', centre: '(none)', high: '(none)', uplift: '(none)',
        valid: !!m
      };
      if (m) {
        p.testPrice = money2(m.P1);
        p.move = pct(m.move, '-');
        p.low = moneyCompact(m.lo, true, '-');
        p.centre = moneyFull(m.mid, '-');
        p.high = moneyCompact(m.hi, true, '-');
        p.uplift = pct(m.pct, '-');
      }
      p.price = p.price.replace(MINUS, '-');
      p.cost = p.cost.replace(MINUS, '-');
      p.testPrice = p.testPrice.replace(MINUS, '-');
      return p;
    }

    function finish(res) {
      if (destroyed) return;
      sending = false;
      go.disabled = false;
      res = res || {};
      var note = res.note || (res.ok
        ? 'Sent.'
        : 'That did not send. Write to ' + T.MAILTO + '.');
      status(note, res.ok ? 'ok' : 'err');
    }

    on(form, 'submit', function (ev) {
      ev.preventDefault();
      if (sending) return;

      var addr = String(email.value || '').trim();
      if (!addr) {
        email.setAttribute('aria-invalid', 'true');
        status('An email address goes here.', 'err');
        email.focus();
        return;
      }
      if (addr.length > 254 || !EMAIL_RE.test(addr)) {
        email.setAttribute('aria-invalid', 'true');
        status('That does not look like an email address.', 'err');
        email.focus();
        return;
      }
      email.setAttribute('aria-invalid', 'false');

      sending = true;
      go.disabled = true;
      status('Sending…', '');

      var api = win.initPfWaitlistB;
      var fn = (api && typeof api.SUBMIT === 'function') ? api.SUBMIT : defaultSubmit;
      var out;
      try {
        out = fn(payloadFor(addr));
      } catch (e) {
        finish({ ok: false, mode: 'error',
          note: 'That did not send. Write to ' + T.MAILTO + ' instead.' });
        return;
      }
      if (out && typeof out.then === 'function') {
        out.then(finish, function () {
          finish({ ok: false, mode: 'error',
            note: 'That did not send. Write to ' + T.MAILTO + ' instead.' });
        });
      } else {
        finish(out);
      }
    });

    on(email, 'input', function () {
      if (email.getAttribute('aria-invalid') === 'true' &&
          EMAIL_RE.test(String(email.value || '').trim())) {
        email.setAttribute('aria-invalid', 'false');
        status('', '');
      }
    });

    /* ---- reduced-motion changes at runtime ------------------------------ */
    function onMotion() {
      reduce = !!(mqReduce && mqReduce.matches);
      if (reduce) { stopRaf(); snap(); render(); }
      else wake();
    }
    if (mqReduce) {
      if (mqReduce.addEventListener) on(mqReduce, 'change', onMotion);
      else if (mqReduce.addListener) {
        mqReduce.addListener(onMotion);
        listeners.push([mqReduce, 'change', onMotion, false, true]);
      }
    }

    /* ---- first paint: synchronous, unconditional, snapped ---------------
       The same code path every later edit takes, then snapped: there is no
       entrance tween, so the ticket is complete and correct the instant it
       exists. Nothing here waits on a frame, an observer or a visibility
       change, and nothing below this line is needed to make it readable. */
    (function firstPaint() {
      recompute();       // reads the two inputs, which are already filled in
      snap();
      stopRaf();
      render();
    })();

    /* ---- cleanup -------------------------------------------------------- */
    return function cleanup() {
      if (destroyed) return;
      destroyed = true;

      stopRaf();
      if (watchdog) { win.clearInterval(watchdog); watchdog = 0; }
      if (announceTimer) { win.clearTimeout(announceTimer); announceTimer = 0; }

      for (var i = 0; i < listeners.length; i++) {
        var L = listeners[i];
        if (L[4] && L[0].removeListener) L[0].removeListener(L[2]);
        else L[0].removeEventListener(L[1], L[2], L[3]);
      }
      listeners.length = 0;

      if (wrap.parentNode === root) root.removeChild(wrap);
      root.className = prevClass;
      if (!prevClass) root.removeAttribute('class');

      unmountStyle();
    };
  }

  /* The integration seam. It lives on the tunables as T.SUBMIT and is
     published on the one global, so it can be replaced at any time after
     load — including after the section has mounted, since every submit
     re-reads window.initPfWaitlistB.SUBMIT at click time. */
  T.SUBMIT = defaultSubmit;
  init.SUBMIT = T.SUBMIT;

  return init;
})();
