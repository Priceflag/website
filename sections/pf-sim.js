/* =============================================================================
   pf-sim.js — one scroll-driven simulation, told on a Galton board.
   -----------------------------------------------------------------------------
   A Galton board (bean machine, 1873) drops beads through a lattice of pegs.
   Each peg deflects a bead left or right at random; the beads pile into a bell
   curve at the bottom. It is the cleanest physical demonstration ever built
   that INDIVIDUAL RANDOMNESS PRODUCES A PREDICTABLE DISTRIBUTION — which is
   the entire argument this product makes about price changes.

   Five acts, driven by document scroll, dark to light:

     01 PROPOSAL   a price sits in the hopper. A price change is a bet.
     02 SIMULATION beads pour through the pegs. Each bead is one simulated
                   future; each peg is one market uncertainty. This is the
                   inference: thousands of trials before a real customer sees
                   the price. The posterior on elasticity visibly tightens.
     03 FORECAST   the pile IS the distribution. Overlay the 80% band. The
                   product never hands you a single number.
     04 ROLLOUT    the board reclines into a storefront floor (real 1-point
                   perspective). Rollout steps across 5 -> 20 -> 50 -> 100%
                   of products — never a traffic split. Real
                   orders arrive as neon beads and land INSIDE the forecast.
     05 GUARDRAIL  a profit floor sits under the distribution. Real beads
                   start landing below it. Past the breach threshold the whole
                   machine runs backwards: beads drain up, the pile unwinds,
                   the price returns to where it started.

   Contract
   --------
     window.initPfSim(root) -> function cleanup()

   Exactly one global. Zero dependencies, no imports, no CDN. Every node is
   built with createElement inside `root`; the stylesheet is injected once,
   id-guarded and refcounted; every selector is prefixed `.pfm-`.

   THE HIDDEN-DOCUMENT RULE
   ------------------------
   This page is routinely rendered with `document.hidden === true`, which
   starves requestAnimationFrame AND silences ResizeObserver and
   IntersectionObserver delivery. Modules in this repo have shipped as blank
   canvases because of it. So, as hard rules here:

     * resize() never returns without painting,
     * the tick is driven from the wall clock, so rAF and the watchdog can
       both advance it without double-counting,
     * a watchdog interval steps the tick whenever rAF has gone quiet and
       stands down the moment real frames arrive,
     * scroll progress is read from getBoundingClientRect() every tick — it is
       always accurate — and IntersectionObserver is used only as an
       optimisation hint, never as a gate on first paint.

   Test hooks (properties of the one global, not extra globals):
     initPfSim.model  -> the product maths, callable from node
     initPfSim.ramp   -> the colour ramp, callable from node
     initPfSim.probe  -> internals of the most recent instance
   ============================================================================= */

(function () {
  'use strict';

  /* ===========================================================================
     Tunables. Everything an economist or a designer might argue about.
     ========================================================================= */
  var T = {
    /* --- product constants (must agree with the rest of the site) ------- */
    P0:            48.00,        // current price
    COST:          19.00,        // unit cost
    O_DAY:         25.2,         // orders per day at P0
    HORIZON:       90,           // forecast window, days
    WIDTH:         0.12,         // tested half-width; the proposal is P0*1.12
    ELASTICITY:    [-1.9, -0.9], // the honest 95% band for own-price elasticity
    GUARDRAIL_PCT: -8,           // stop if profit falls this far below baseline
    STAGES:        [5, 20, 50, 100],

    /* --- narrative ------------------------------------------------------ */
    /* Act boundaries in global scroll progress. The 04/05 boundary at 0.80 is
       load-bearing: the ink inversion is centred there, inside the copy's
       dead zone, so no text is ever legible while its colour is crossing the
       background's. See INK_STOPS. */
    ACTS: [
      { p0: 0.000, p1: 0.160, fi: 0.020, fo: 0.024 },
      { p0: 0.160, p1: 0.400, fi: 0.024, fo: 0.024 },
      { p0: 0.400, p1: 0.580, fi: 0.024, fo: 0.024 },
      { p0: 0.580, p1: 0.800, fi: 0.024, fo: 0.044 },
      { p0: 0.800, p1: 1.001, fi: 0.048, fo: 0.010 }
    ],
    REV_START:  0.50,   // fraction through act 5 at which the reversal begins
    TRIALS:     20000,  // simulated futures the bead count stands for

    /* --- board ---------------------------------------------------------- */
    ROWS_WIDE:  13,     // peg rows when there is room
    ROWS_MID:   11,
    ROWS_NARROW: 9,
    BEADS_WIDE: 520,    // simulated beads at full pour
    BEADS_MID:  340,
    BEADS_NARROW: 190,
    LIVE_ROLLOUT: 30,   // real orders released across act 4
    LIVE_GUARD:   18,   // real orders released across act 5 before reversal
    BREACH_N:      3,   // breaches that trip the guardrail
    SHOCK:      0.19,   // act-5 leftward drift in the real order stream
    BOARD_MAX:  620,    // px, widest the board ever gets
    FLIGHT_CAP: 64,     // beads allowed in the air; the backlog lands instantly
    PARTICLE_CAP: 140,

    /* --- motion --------------------------------------------------------- */
    ROW_TIME:   0.058,  // seconds a bead spends between two peg rows
    HOP:        0.30,   // upward kick off a peg, as a fraction of impact speed
    XSMOOTH:    26,     // horizontal ease rate, 1/s
    POUR_TIME:  2.6,    // seconds to fill the board while standing still
    POUR_LEAD:  0.30,   // how far the ambient pour may run ahead of scroll
    TILT_DEG:   38,     // how far the board reclines in act 4
    CAM:        2.2,    // camera distance, in board heights
    MAX_DT:     0.05,
    MAX_DPR:    2,
    WATCHDOG_MS: 90
  };

  var STYLE_ID = 'pfm-style';
  var TAU = Math.PI * 2;
  var instances = 0;

  var COPY = [
    { k: '01', t: 'Proposal',  line: 'A price change is a bet.',
      lab: 'proposed price',            tone: 'ink' },
    { k: '02', t: 'Simulation', line: 'We place it 20,000 times first.',
      lab: 'simulated futures',         tone: 'sim' },
    { k: '03', t: 'Forecast',  line: 'We never hand you a single number.',
      lab: '80% range · 90 days',       tone: 'ink' },
    { k: '04', t: 'Rollout',   line: 'Real orders land inside the forecast.',
      lab: 'of products live',          tone: 'live' },
    { k: '05', t: 'Guardrail', line: 'It reverses itself at 3 a.m., unattended.',
      lab: 'profit floor',              tone: 'live' }
  ];

  /* ===========================================================================
     Colour. Two ramps, sampled every frame.

     The background climbs from near-black to cream. The ink has to cross it,
     and a mid-grey word on a mid-grey field is unreadable — so the crossing is
     compressed into p 0.786..0.814 and parked exactly on the 04/05 act
     boundary, where every line of copy is at zero opacity anyway. Either side
     of that window the contrast ratio never drops below 4.9:1. Measured, not
     hoped: see initPfSim.ramp and the contrast note in the report.
     ========================================================================= */
  var BG_STOPS = [
    [0.000, '#030818'], [0.160, '#050e26'], [0.400, '#0d1a45'],
    [0.580, '#1a2a63'], [0.720, '#2e3f7a'], [0.792, '#46589a'],
    [0.800, '#6c76a4'], [0.808, '#8f95a8'], [0.860, '#c3bfb2'],
    [0.930, '#eae3d5'], [1.000, '#f3ecde']
  ];
  var INK_STOPS = [
    [0.000, '#f3ecde'], [0.792, '#f3ecde'], [0.797, '#cdd2e2'],
    [0.800, '#6a76a4'], [0.803, '#26386f'], [0.808, '#0d2168'],
    [1.000, '#0d2168']
  ];
  /* Simulated / predicted things. Periwinkle on the dark end, brand blue on
     the light end, so a bead is always visible against the field. */
  var SIM_STOPS = [
    [0.000, '#93aaff'], [0.700, '#93aaff'], [0.860, '#3f63d8'], [1.000, '#1d4ed8']
  ];
  /* Observed / actual / the live event. Neon is reserved for this and nothing
     else; it is darkened as the field lightens so it stays a colour and not a
     glare. */
  var LIVE_STOPS = [
    [0.000, '#d8f24b'], [0.780, '#d8f24b'], [0.880, '#9cba1e'], [1.000, '#87a614']
  ];

  function hex2rgb(h) {
    return [parseInt(h.slice(1, 3), 16),
            parseInt(h.slice(3, 5), 16),
            parseInt(h.slice(5, 7), 16)];
  }
  function bake(stops) {
    var out = [], i;
    for (i = 0; i < stops.length; i++) out.push([stops[i][0], hex2rgb(stops[i][1])]);
    return out;
  }
  var BG = bake(BG_STOPS), INK = bake(INK_STOPS),
      SIM = bake(SIM_STOPS), LIVE = bake(LIVE_STOPS);

  /* Piecewise-linear sRGB ramp. Returns [r,g,b] in 0..255. */
  function ramp(stops, p) {
    if (p <= stops[0][0]) return stops[0][1].slice();
    var n = stops.length, i;
    for (i = 1; i < n; i++) {
      if (p <= stops[i][0]) {
        var a = stops[i - 1], b = stops[i];
        var t = (p - a[0]) / (b[0] - a[0] || 1);
        return [a[1][0] + (b[1][0] - a[1][0]) * t,
                a[1][1] + (b[1][1] - a[1][1]) * t,
                a[1][2] + (b[1][2] - a[1][2]) * t];
      }
    }
    return stops[n - 1][1].slice();
  }
  function css(c) {
    return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';
  }
  function rgba(c, a) {
    return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
  }
  function mixc(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t,
            a[2] + (b[2] - a[2]) * t];
  }
  /* WCAG relative luminance — used to decide how hard the graphics have to
     push against the field, and to prove the contrast claim in tests. */
  function lum(c) {
    var v = [c[0] / 255, c[1] / 255, c[2] / 255], i, o = [];
    for (i = 0; i < 3; i++) {
      o[i] = v[i] <= 0.04045 ? v[i] / 12.92 : Math.pow((v[i] + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * o[0] + 0.7152 * o[1] + 0.0722 * o[2];
  }
  function contrast(a, b) {
    var la = lum(a), lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  /* ===========================================================================
     Small maths
     ========================================================================= */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function easeOut(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function easeIn(t) { t = clamp(t, 0, 1); return t * t * t; }

  /* Deterministic 32-bit hash -> 0..1. The bead field must be identical on
     every load and on every replay, so nothing here may use Math.random. */
  function h32(a, b) {
    var h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function group(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function money(v, dp) {
    var s = Math.abs(v);
    return '$' + (dp ? s.toFixed(dp).replace(/\B(?=(\d{3})+(?!\d)\.)/g, ',') : group(s));
  }
  function signedMoney(v) {
    return (v < 0 ? '−' : '+') + money(v);
  }

  /* ===========================================================================
     The model. Constant-elasticity demand, the standard first-order account of
     how volume answers price:

         orders(P, e) = O_DAY * (P / P0)^e
         profit(P, e) = (P - COST) * orders(P, e)

     The proposal is P0 * (1 + WIDTH). Evaluating it across the whole
     elasticity band gives the honest bounds; the centre of the band gives the
     point estimate. The Galton board's horizontal axis IS the 90-day profit
     delta, and its bin width is chosen so that the binomial's 10th and 90th
     percentiles land exactly on those two bounds. The picture and the
     arithmetic are therefore the same object, not an illustration of one.
     ========================================================================= */
  function model(rows) {
    rows = rows || T.ROWS_WIDE;
    var P1 = T.P0 * (1 + T.WIDTH);
    var base = (T.P0 - T.COST) * T.O_DAY * T.HORIZON;
    function d90(e) {
      var q = T.O_DAY * Math.pow(P1 / T.P0, e);
      return ((P1 - T.COST) * q - (T.P0 - T.COST) * T.O_DAY) * T.HORIZON;
    }
    var lo = d90(T.ELASTICITY[0]);           // pessimistic end of the band
    var hi = d90(T.ELASTICITY[1]);           // optimistic end
    var mid = d90((T.ELASTICITY[0] + T.ELASTICITY[1]) / 2);
    var sigma = (hi - lo) / 2 / 1.2816;      // so p10/p90 == the band ends
    var binW = sigma / Math.sqrt(rows * 0.25);
    var guard = base * (T.GUARDRAIL_PCT / 100);
    return {
      rows: rows, price0: T.P0, price1: P1, base: base,
      lo: lo, mid: mid, hi: hi, sigma: sigma, binW: binW, guard: guard,
      /* bin coordinate (0..rows) of a profit delta */
      binOf: function (v) { return rows / 2 + (v - mid) / binW; },
      /* profit delta at a bin coordinate */
      valOf: function (b) { return mid + (b - rows / 2) * binW; },
      guardBin: rows / 2 + (guard - mid) / binW,
      zeroBin: rows / 2 + (0 - mid) / binW
    };
  }

  /* ===========================================================================
     Stylesheet — injected once per document, refcounted.
     ========================================================================= */
  var CSS_TEXT = [
    ".pfm-root{position:relative;display:block;box-sizing:border-box;width:100%;",
    "margin:0;background:#030818;color:#f3ecde;height:380vh;",
    "font-family:'Inter',system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif;",
    "-webkit-font-smoothing:antialiased;",
    "--pfm-ink:#f3ecde;--pfm-dim:#aab3cf;--pfm-sim:#93aaff;--pfm-live:#d8f24b;",
    /* One gutter, plus whatever the device's own safe area asks for. The canvas
       reads the same numbers back off .pfm-safe, so the drawing and the
       stylesheet can never disagree about where the usable box is. */
    "--pfm-gut:clamp(22px,4vw,64px);",
    "--pfm-pl:calc(var(--pfm-gut) + env(safe-area-inset-left,0px));",
    "--pfm-pr:calc(var(--pfm-gut) + env(safe-area-inset-right,0px));",
    "--pfm-pt:calc(var(--pfm-gut) + env(safe-area-inset-top,0px));",
    "--pfm-pb:calc(var(--pfm-gut) + env(safe-area-inset-bottom,0px));}",
    /* svh — the SMALL viewport height — is the only unit that stays honest
       while a mobile browser's toolbars are on screen. The px floor stops the
       five acts flying past on a 390px-tall landscape phone. */
    "@supports (height:100svh){.pfm-root{height:max(380svh,2100px);}}",
    ".pfm-root *{box-sizing:border-box;}",

    /* The pin. Never taller than the visible viewport, or the pinned content
       cannot be reached on a phone. */
    /* No touch-action, no pointer handlers, no preventDefault anywhere in this
       module: the page keeps its own scroll and its own pinch-zoom. */
    ".pfm-stage{position:sticky;top:0;width:100%;height:100vh;overflow:hidden;}",
    "@supports (height:100svh){.pfm-stage{height:100svh;}}",
    ".pfm-canvas{position:absolute;top:0;left:0;width:100%;height:100%;",
    "display:block;pointer-events:none;}",
    /* Zero-sized probe. Its padding IS the safe-area inset, read back by the
       layout maths through getComputedStyle. */
    ".pfm-safe{position:absolute;top:0;left:0;width:0;height:0;",
    "pointer-events:none;visibility:hidden;",
    "padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) ",
    "env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);}",

    ".pfm-hud{position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;",
    "display:flex;padding:var(--pfm-pt) var(--pfm-pr) var(--pfm-pb) var(--pfm-pl);}",
    ".pfm-acts{display:grid;width:100%;}",
    ".pfm-act{grid-area:1/1;opacity:0;margin:0;will-change:opacity,transform;}",

    /* Orientation. .pfm-side and .pfm-stack are written by the module from the
       STAGE's measured aspect ratio — never from a device or width guess — so a
       landscape phone and a landscape tablet get the same treatment. */
    ".pfm-side .pfm-hud{align-items:center;}",
    ".pfm-side .pfm-acts{width:min(40%,440px);}",
    ".pfm-side .pfm-line{max-width:15ch;}",
    ".pfm-stack .pfm-hud{align-items:flex-start;",
    /* --pfm-chrome is the measured height of whatever the host page keeps
       pinned over the stage. The canvas reserved room for it; the copy has
       to as well, or the first line sits behind the nav. env() is already
       folded into the measured value, so it is not added again here. */
    "padding-top:max(calc(clamp(26px,6vh,52px) + env(safe-area-inset-top,0px)),",
    "calc(var(--pfm-chrome,0px) + clamp(14px,2.2vh,26px)));}",
    ".pfm-stack .pfm-acts{width:100%;max-width:34ch;}",
    ".pfm-stack .pfm-line{max-width:18ch;}",

    ".pfm-eyebrow{margin:0 0 clamp(13px,2vh,20px);display:flex;align-items:center;",
    "gap:9px;font-size:11px;font-weight:500;line-height:1;letter-spacing:.2em;",
    "text-transform:uppercase;color:var(--pfm-dim);}",
    ".pfm-dot{width:5px;height:5px;border-radius:50%;background:var(--pfm-live);",
    "flex:0 0 auto;}",
    ".pfm-k{opacity:.6;}",

    ".pfm-line{margin:0;font-family:'Hedvig Letters Serif',Georgia,",
    "'Times New Roman',serif;font-weight:400;font-size:clamp(27px,4.2vw,50px);",
    "line-height:1.1;letter-spacing:-.015em;color:var(--pfm-ink);max-width:15ch;}",

    ".pfm-fig{display:block;margin:clamp(18px,3vh,32px) 0 0;}",
    ".pfm-num{display:block;font-weight:600;font-size:clamp(24px,3.3vw,40px);",
    "line-height:1;letter-spacing:-.03em;font-variant-numeric:tabular-nums;",
    "font-feature-settings:\"tnum\" 1;color:var(--pfm-ink);}",
    ".pfm-num.pfm-sim{color:var(--pfm-sim);}",
    ".pfm-num.pfm-live{color:var(--pfm-live);}",
    ".pfm-lab{display:block;margin-top:9px;font-size:11px;font-weight:500;",
    "line-height:1;letter-spacing:.16em;text-transform:uppercase;",
    "color:var(--pfm-dim);}",

    ".pfm-rail{position:absolute;left:var(--pfm-pl);",
    "bottom:calc(clamp(18px,3.2vh,36px) + env(safe-area-inset-bottom,0px));",
    "display:flex;gap:6px;align-items:center;color:var(--pfm-ink);}",
    ".pfm-seg{position:relative;width:clamp(20px,2.4vw,30px);height:2px;",
    "border-radius:2px;}",
    ".pfm-seg::before{content:'';position:absolute;top:0;left:0;right:0;bottom:0;",
    "background:currentColor;opacity:.18;border-radius:inherit;}",
    ".pfm-seg i{position:absolute;top:0;left:0;right:0;bottom:0;",
    "background:currentColor;border-radius:inherit;transform:scaleX(0);",
    "transform-origin:left center;}",

    ".pfm-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;",
    "overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;",
    "border:0;}",

    /* Short stages — landscape phones, mostly. Nothing is removed; the type
       simply stops eating the whole 390px. */
    ".pfm-short .pfm-hud{padding:calc(clamp(12px,2.4vw,28px) + env(safe-area-inset-top,0px)) ",
    "var(--pfm-pr) calc(clamp(12px,2.4vw,28px) + env(safe-area-inset-bottom,0px)) ",
    "var(--pfm-pl);}",
    ".pfm-short .pfm-eyebrow{margin-bottom:8px;font-size:11px;letter-spacing:.18em;}",
    ".pfm-short .pfm-line{font-size:clamp(19px,3.1vw,30px);}",
    ".pfm-short .pfm-fig{margin-top:11px;}",
    ".pfm-short .pfm-num{font-size:clamp(19px,2.5vw,30px);}",
    ".pfm-short .pfm-lab{margin-top:6px;font-size:11px;letter-spacing:.14em;}",
    ".pfm-short .pfm-rail{bottom:calc(9px + env(safe-area-inset-bottom,0px));}",
    ".pfm-short.pfm-stack .pfm-hud{padding-top:max(calc(clamp(12px,2.4vw,28px) + " +
    "env(safe-area-inset-top,0px)),calc(var(--pfm-chrome,0px) + clamp(8px,1.6vh,16px)));}",

    /* ---- reduced motion: no pinning, no beads, five static frames -------- */
    ".pfm-root.pfm-still{height:auto;background:linear-gradient(180deg,",
    "#030818 0%,#0d1a45 26%,#1a2a63 44%,#46589a 62%,#8f95a8 71%,",
    "#c3bfb2 80%,#f3ecde 92%);}",
    ".pfm-still .pfm-stage{position:static;height:auto;overflow:visible;",
    "display:flex;flex-direction:column;}",
    ".pfm-still .pfm-hud{order:1;}",
    ".pfm-still .pfm-canvas{order:2;}",
    ".pfm-still .pfm-hud{position:static;display:block;",
    "padding:clamp(64px,9vw,120px) clamp(22px,5vw,72px);}",
    ".pfm-still .pfm-acts{display:block;width:100%;max-width:none;}",
    ".pfm-still .pfm-act{opacity:1;transform:none;",
    "max-width:min(46ch,100%);margin:0 0 clamp(56px,8vw,104px);}",
    ".pfm-still .pfm-canvas{position:static;width:100%;height:auto;",
    "aspect-ratio:4/3;margin:0 auto clamp(56px,8vw,104px);max-width:720px;}",
    ".pfm-still .pfm-rail{display:none;}",
    "@media (prefers-reduced-motion:reduce){.pfm-act{transition:none;}}"
  ].join('');

  function injectStyle(doc) {
    if (doc.getElementById(STYLE_ID)) return;
    var s = doc.createElement('style');
    s.id = STYLE_ID;
    s.appendChild(doc.createTextNode(CSS_TEXT));
    (doc.head || doc.documentElement).appendChild(s);
  }

  /* ===========================================================================
     initPfSim
     ========================================================================= */
  function initPfSim(root) {
    /* ---- resolve the mount --------------------------------------------- */
    var doc = (root && root.ownerDocument) || document;
    if (typeof root === 'string') root = doc.querySelector(root);
    if (!root || !root.appendChild) root = doc.body;
    var win = doc.defaultView || window;

    injectStyle(doc);
    instances++;

    var mq = null;
    try {
      mq = win.matchMedia ? win.matchMedia('(prefers-reduced-motion: reduce)') : null;
    } catch (e) { mq = null; }
    var reduce = !!(mq && mq.matches);

    /* ---- DOM ------------------------------------------------------------ */
    function el(tag, cls, parent) {
      var n = doc.createElement(tag);
      if (cls) n.className = cls;
      if (parent) parent.appendChild(n);
      return n;
    }

    var section = el('section', 'pfm-root');
    section.setAttribute('aria-label', 'How a price change is simulated, rolled out and reversed');

    var stage = el('div', 'pfm-stage', section);

    var cvs = el('canvas', 'pfm-canvas', stage);
    cvs.setAttribute('aria-hidden', 'true');
    cvs.setAttribute('role', 'presentation');

    /* Safe-area probe. Zero-sized, invisible, never read by a human — its
       padding carries env(safe-area-inset-*) into JavaScript. */
    var safeEl = el('i', 'pfm-safe', stage);
    safeEl.setAttribute('aria-hidden', 'true');

    var hud = el('div', 'pfm-hud', stage);
    var acts = el('div', 'pfm-acts', hud);

    var actEls = [];
    for (var ai = 0; ai < COPY.length; ai++) {
      var c = COPY[ai];
      var a = el('article', 'pfm-act', acts);
      var eb = el('p', 'pfm-eyebrow', a);
      el('span', 'pfm-dot', eb);
      var kEl = el('span', 'pfm-k', eb);
      kEl.appendChild(doc.createTextNode(c.k));
      eb.appendChild(doc.createTextNode(' ' + c.t));
      var ln = el('h3', 'pfm-line', a);
      ln.appendChild(doc.createTextNode(c.line));
      var fig = el('div', 'pfm-fig', a);
      var num = el('span', 'pfm-num' + (c.tone === 'ink' ? '' : ' pfm-' + c.tone), fig);
      num.appendChild(doc.createTextNode('—'));
      var lab = el('span', 'pfm-lab', fig);
      lab.appendChild(doc.createTextNode(c.lab));
      actEls.push({ root: a, num: num, lab: lab, alpha: -1, shift: 999 });
    }

    var rail = el('div', 'pfm-rail', hud);
    var segs = [];
    for (var si = 0; si < COPY.length; si++) {
      var sg = el('span', 'pfm-seg', rail);
      segs.push(el('i', null, sg));
    }

    var sr = el('div', 'pfm-sr', section);
    sr.setAttribute('aria-live', 'polite');
    sr.setAttribute('aria-atomic', 'true');

    /* Orientation mode. Decided from the stage's own aspect ratio in layout();
       the class is what the stylesheet keys off, so the copy column and the
       canvas board always describe the same arrangement. */
    var modeSide = false, modeShort = false;
    function applyClasses() {
      var c = 'pfm-root';
      if (reduce) c += ' pfm-still';
      else c += modeSide ? ' pfm-side' : ' pfm-stack';
      if (!reduce && modeShort) c += ' pfm-short';
      if (section.className !== c) section.className = c;
    }

    root.appendChild(section);
    applyClasses();

    var ctx = null;
    try { ctx = cvs.getContext('2d'); } catch (e2) { ctx = null; }

    /* =========================================================================
       Geometry. Recomputed on resize; every derived array is rebuilt with it.
       ======================================================================= */
    var cssW = 0, cssH = 0, dpr = 1;
    var G = {                       /* the board, in CSS pixels */
      rows: T.ROWS_WIDE, bins: T.ROWS_WIDE + 1, nMax: T.BEADS_WIDE,
      cx: 0, bx0: 0, bx1: 0, by0: 0, by1: 0, bw: 0, bh: 0,
      dx: 40, dy: 26, pegTop: 0, pegBot: 0,
      floorY: 0, pileH: 0, r: 4.6, rLive: 4.6, perRow: 4,
      hopY: 0, hopH: 0, grav: 1, hop: 1,
      /* the reserved band above the board — see layout() */
      safeTop: 0, chrome: 0, chipFs: 18, chipCy: 0, chipBand: 0, dropY: 0,
      side: false
    };
    var M = model(T.ROWS_WIDE);

    /* Simulated pile */
    var binCount = [], order = [];
    /* Observed pile (real orders, resting on the surface of the simulated one) */
    var liveCount = [], liveOrder = [];
    var flight = [];          // beads in the air
    var parts = [];           // rising particles during the reversal
    var pegGlow = null;       // Float32Array, one energy per peg
    var poured = 0;           // index into the deterministic bead sequence
    var landed = 0;
    var liveOut = 0;          // real orders released
    var breaches = 0;

    function resetSim() {
      binCount.length = 0; liveCount.length = 0;
      for (var i = 0; i < G.bins; i++) { binCount.push(0); liveCount.push(0); }
      order.length = 0; liveOrder.length = 0;
      flight.length = 0; parts.length = 0;
      poured = 0; landed = 0; liveOut = 0; breaches = 0;
      pegGlow = new Float32Array(G.rows * (G.rows + 1) / 2);
    }

    /* -----------------------------------------------------------------------
       Safe areas.

       Two different things eat the top of the stage and neither of them is
       visible to the drawing code by default:

         1. the device's own inset — a notch, a rounded corner, a home bar —
            which the stylesheet already respects through env(); the .pfm-safe
            probe hands the same numbers to the canvas;

         2. whatever chrome the HOST PAGE keeps pinned over the viewport. This
            section pins itself with `position:sticky; top:0`, so a site nav
            that is itself sticky or fixed at top:0 sits ON the first band of
            the stage. Nothing drawn there can be seen. That band is found by
            asking the document what is actually at y=1 and taking that
            element's own height — one hit test, exact, and immune to the
            magic numbers a guess would need.
       --------------------------------------------------------------------- */
    var _ins = { t: 0, r: 0, b: 0, l: 0 };
    function safeInsets() {
      try {
        var cs = win.getComputedStyle(safeEl);
        _ins.t = parseFloat(cs.paddingTop) || 0;
        _ins.r = parseFloat(cs.paddingRight) || 0;
        _ins.b = parseFloat(cs.paddingBottom) || 0;
        _ins.l = parseFloat(cs.paddingLeft) || 0;
      } catch (e) { _ins.t = _ins.r = _ins.b = _ins.l = 0; }
      return _ins;
    }

    var overlayPx = 0, overlayAt = -1e9;
    function overlayTop(force) {
      var t = (win.performance && win.performance.now)
        ? win.performance.now() : Date.now();
      if (!force && t - overlayAt < 600) return overlayPx;
      overlayAt = t;
      var out = 0;
      try {
        if (doc.elementFromPoint) {
          var r = stage.getBoundingClientRect();
          var vw = win.innerWidth || r.width || 0;
          var xs = [r.left + r.width * 0.5,
                    r.left + Math.min(80, r.width * 0.25),
                    r.right - Math.min(80, r.width * 0.25)];
          for (var i = 0; i < xs.length; i++) {
            var x = clamp(xs[i], 1, Math.max(2, vw - 2));
            var e = doc.elementFromPoint(x, 1), hops = 0;
            while (e && hops++ < 8) {
              if (e === section || section.contains(e)) break;
              var pos = '';
              try { pos = win.getComputedStyle(e).position; } catch (e5) {}
              if (pos === 'fixed' || pos === 'sticky') {
                var b = e.getBoundingClientRect().bottom;
                if (b > out) out = b;
                break;
              }
              e = e.parentElement;
            }
          }
        }
      } catch (e6) { out = 0; }
      /* A band deeper than a quarter of the stage is not chrome, it is a
         mis-read; refuse it rather than squash the board. */
      overlayPx = clamp(out, 0, Math.max(0, cssH * 0.25));
      return overlayPx;
    }

    /* Where the copy column ends, measured rather than assumed — the acts are
       a one-cell grid, so its height is the tallest act at the current type
       size, which is exactly what the board has to clear when stacked. */
    function copyBottom() {
      try {
        var sr2 = stage.getBoundingClientRect();
        var ar = acts.getBoundingClientRect();
        if (ar.height > 0 && sr2.height > 0) {
          return clamp(ar.bottom - sr2.top, 0, cssH * 0.62);
        }
      } catch (e) {}
      return cssH * 0.36;
    }

    /* Orientation, from the stage's aspect ratio. Wide-and-short sets the copy
       beside the board; anything else stacks them. The width floor is there
       because two columns need two columns' worth of room, not because of any
       particular device. */
    function decideMode(w, h) {
      var basePad = clamp(w * 0.04, 22, 64);
      var inner = Math.max(1, w - basePad * 2);
      var copyW = Math.min(inner * 0.40, 440);
      var gap = clamp(w * 0.03, 20, 48);
      var side = !reduce && (w / Math.max(1, h)) >= 1.15 && w >= 620 &&
                 (inner - copyW - gap) >= 240;
      var short = !reduce && h < 560;
      if (side !== modeSide || short !== modeShort) {
        modeSide = side; modeShort = short;
        applyClasses();
      }
      G.side = side;
    }

    function layout() {
      var w = cssW, h = cssH;
      decideMode(w, h);                 /* may restyle the copy column */

      var ins = safeInsets();
      var chrome = Math.max(overlayTop(false), ins.t);
      var basePad = clamp(w * 0.04, 22, 64);
      var padL = basePad + ins.l, padR = basePad + ins.r;
      var gapTop = clamp(h * 0.022, 8, 22);
      var botRes = clamp(h * 0.06, 26, 56) + ins.b;
      var bx0, bx1, by1, boardTop;

      if (reduce) {
        /* Reduced motion draws into its own block-level box with nothing
           overlaid, so the board gets the whole of it. */
        bx0 = padL; bx1 = w - padR;
        boardTop = h * 0.03;
        by1 = h * 0.95;
      } else if (modeSide) {
        var inner = Math.max(1, w - padL - padR);
        var copyW = Math.min(inner * 0.40, 440);
        bx0 = padL + copyW + clamp(w * 0.03, 20, 48);
        bx1 = w - padR;
        boardTop = chrome + gapTop;
        by1 = h - botRes;
      } else {
        bx0 = padL; bx1 = w - padR;
        /* Stacked: the board starts below the copy, or below the page's own
           chrome, whichever is lower. */
        boardTop = Math.max(chrome + gapTop,
                            copyBottom() + clamp(h * 0.03, 14, 40));
        by1 = h - botRes;
      }

      if (bx1 - bx0 < 200) { bx0 = padL; bx1 = Math.max(padL + 200, w - padR); }
      if (bx1 - bx0 > T.BOARD_MAX) {
        var mid = (bx0 + bx1) / 2;
        bx0 = mid - T.BOARD_MAX / 2; bx1 = mid + T.BOARD_MAX / 2;
      }
      if (by1 < boardTop + 120) by1 = boardTop + 120;

      var bw = bx1 - bx0;

      /* --- the price chip's band, reserved BEFORE the board gets a pixel ----
         The chip is the one thing drawn outside the board box, so the board
         box is defined to start below it. Its own type size is part of the
         reservation, which is why it cannot be clipped at any stage size:
             boardTop  <= chipTop  <  chipBottom  <= by0
         and boardTop itself is already clear of the page chrome and the
         device's safe area. */
      var span = by1 - boardTop;
      var chipGap = clamp(h * 0.014, 5, 14);
      var chipFs = clamp(Math.min(bw * 0.045, span * 0.085), 11, 26);
      var chipBand = Math.min(chipGap + chipFs * 1.5, Math.max(26, span * 0.24));
      chipFs = clamp((chipBand - chipGap) / 1.5, 11, 26);
      chipBand = chipGap + chipFs * 1.5;

      var by0 = boardTop + chipBand;
      G.chrome = chrome;
      /* Hand the measured chrome to CSS so the HTML copy can clear it too. */
      try { section.style.setProperty('--pfm-chrome', chrome.toFixed(1) + 'px'); } catch (e) {}
      G.safeTop = boardTop;
      G.chipFs = chipFs;
      G.chipBand = chipBand;
      G.chipCy = boardTop + chipFs * 0.75;   /* middle baseline of the chip */
      /* Real orders are released from just above the board, inside the chip's
         band — never from an arbitrary height that would put their entry trail
         in the page's chrome. */
      G.dropY = by0 - Math.min(chipBand * 0.45, 18);

      var bh = by1 - by0;
      var rows = bw >= 470 ? T.ROWS_WIDE : bw >= 340 ? T.ROWS_MID : T.ROWS_NARROW;
      if (bh < 380) rows = Math.min(rows, T.ROWS_MID);
      if (bh < 300) rows = T.ROWS_NARROW;

      var nMax = rows === T.ROWS_WIDE ? T.BEADS_WIDE
               : rows === T.ROWS_MID ? T.BEADS_MID : T.BEADS_NARROW;

      G.rows = rows; G.bins = rows + 1; G.nMax = nMax;
      G.bx0 = bx0; G.bx1 = bx1; G.by0 = by0; G.by1 = by1;
      G.bw = bw; G.bh = bh; G.cx = (bx0 + bx1) / 2;
      G.dx = bw / (rows + 1);

      G.hopY = by0;                       // hopper occupies the top tenth
      G.hopH = bh * 0.10;
      G.pegTop = by0 + bh * 0.16;
      G.pegBot = by0 + bh * 0.66;
      G.dy = (G.pegBot - G.pegTop) / rows;
      G.floorY = by0 + bh * 0.925;        // the bins rest here
      G.pileH = G.floorY - (by0 + bh * 0.68);

      /* Bead radius follows from the pile having to fit the space it is given.
         Packing a bell of nMax beads over `bins` columns of width dx into a
         zone of height pileH fixes the diameter:
             (2r)^2 = pileH * dx / (0.87 * peakCount)
         where peakCount is the modal bin of Binomial(rows, 1/2). */
      var peak = binomPeak(rows) * nMax;
      var d = Math.sqrt(G.pileH * G.dx / (0.87 * Math.max(1, peak)));
      G.r = clamp(d / 2, 2.2, 9);
      G.perRow = Math.max(1, Math.floor(G.dx / (2 * G.r)));
      /* The line above is the whole reason the pile used to overflow. The
         radius comes out of a continuous area model, but the columns are
         whole beads: on a phone dx/(2r) lands on ~3.9 and floor() throws away
         a quarter of the capacity, so the bell stood ~1.6x taller than the
         zone it was given — burying the 80% band and the lowest peg rows.
         Shrink r until the pile the integer column count actually builds fits.
         Height goes as r^2 here (perRow itself scales as 1/r), so sqrt of the
         miss is the right step and this settles in a couple of passes. */
      for (var gi = 0; gi < 24; gi++) {
        var need = (pileTopRow(peak, G.perRow) + 1) * (2 * G.r * 0.866);
        if (need <= G.pileH || G.r <= 2.2) break;
        G.r = Math.max(2.2, G.r * Math.sqrt(G.pileH / need));
        G.perRow = Math.max(1, Math.floor(G.dx / (2 * G.r)));
      }
      G.rLive = G.r * 1.18;

      /* Gravity is derived from the row time so the fall reads identically at
         every board size. */
      G.grav = 2 * G.dy / (T.ROW_TIME * T.ROW_TIME);
      G.hop = T.HOP * Math.sqrt(2 * G.grav * G.dy);

      M = model(rows);
      resetSim();
    }

    /* Modal probability of Binomial(n, 1/2) — how tall the middle bin gets. */
    function binomPeak(n) {
      var k = Math.floor(n / 2), lc = 0, i;
      for (i = 0; i < k; i++) lc += Math.log(n - i) - Math.log(i + 1);
      return Math.exp(lc - n * Math.LN2);
    }

    /* Lattice geometry ---------------------------------------------------- */
    function pegX(row, c) { return G.cx + (c - row / 2) * G.dx; }
    function pegY(row) { return G.pegTop + (row + 0.5) * G.dy; }
    function binX(b) { return G.cx + (b - G.rows / 2) * G.dx; }
    function pegIndex(row, c) { return row * (row + 1) / 2 + c; }

    /* Row index the top bead of an `n`-bead pile lands on, for the packing
       slotPos() below implements. Kept adjacent to it so the two stay in step:
       measure() sizes the beads against this. */
    function pileTopRow(n, per) {
      var k = Math.max(0, Math.round(n) - 1);
      if (per <= 1) return k;
      var pair = 2 * per - 1, q = Math.floor(k / pair), rem = k - q * pair;
      return rem < per ? 2 * q : 2 * q + 1;
    }

    /* Where the k-th bead in a bin comes to rest. Hexagonal packing: even rows
       hold `perRow` beads, odd rows hold one fewer and sit in the gaps. */
    var _slot = { x: 0, y: 0, row: 0 };
    function slotPos(b, k) {
      var per = G.perRow, x0 = binX(b) - G.dx / 2, row, ox;
      if (per <= 1) { row = k; ox = G.dx / 2; }
      else {
        var pair = 2 * per - 1;
        var q = Math.floor(k / pair), rem = k - q * pair;
        if (rem < per) { row = 2 * q; ox = (rem + 0.5) * (G.dx / per); }
        else { row = 2 * q + 1; ox = (rem - per + 1) * (G.dx / per); }
      }
      _slot.row = row;
      _slot.x = x0 + ox;
      _slot.y = G.floorY - (row + 0.5) * (2 * G.r * 0.866);
      return _slot;
    }
    /* Top of the simulated pile in a bin — real orders stack above this. */
    function surfaceY(b) {
      var n = binCount[b] | 0;
      if (n <= 0) return G.floorY;
      var s = slotPos(b, n - 1);
      return s.y - G.r;
    }

    /* =========================================================================
       Narrative state, derived from one number: scroll progress p in 0..1.
       ======================================================================= */
    var S = {
      p: 0, act: 0, a2: 0, a3: 0, a4: 0, a5: 0,
      rev: 0, tilt: 0, stage: 0, tripped: false
    };

    function derive(p) {
      S.p = p;
      var A = T.ACTS, i, act = 0;
      for (i = 0; i < A.length; i++) if (p >= A[i].p0) act = i;
      S.act = act;
      S.a2 = clamp((p - A[1].p0) / (A[1].p1 - A[1].p0), 0, 1);
      S.a3 = clamp((p - A[2].p0) / (A[2].p1 - A[2].p0), 0, 1);
      S.a4 = clamp((p - A[3].p0) / (A[3].p1 - A[3].p0), 0, 1);
      S.a5 = clamp((p - A[4].p0) / (A[4].p1 - A[4].p0), 0, 1);
      /* The reversal completes at 96% of act 5 rather than at its very end, so
         the section finishes on a settled frame instead of mid-drain. */
      S.rev = clamp((S.a5 - T.REV_START) / (0.96 - T.REV_START), 0, 1);
      /* The board reclines through act 4 and stands back up as it unwinds. */
      S.tilt = smooth(S.a4) * (1 - smooth(clamp((S.rev - 0.15) / 0.65, 0, 1)));
      S.stage = Math.min(T.STAGES.length - 1, Math.floor(S.a4 * T.STAGES.length));
      if (S.a5 <= 0) S.stage = S.a4 > 0 ? S.stage : 0;
      S.tripped = breaches >= T.BREACH_N;
    }

    /* How many simulated beads scroll alone insists on. Monotone in p, with a
       power curve so the pour visibly accelerates through act 2. */
    function pourFloor() {
      if (S.rev > 0) return G.nMax * (1 - easeIn(S.rev));
      if (S.p < T.ACTS[1].p0) return 0;
      var t = clamp(S.a2 / 0.92, 0, 1);
      return G.nMax * Math.pow(t, 1.55);
    }
    function pourCeil() {
      if (S.rev > 0) return G.nMax * (1 - easeIn(S.rev));
      return Math.min(G.nMax, pourFloor() + G.nMax * T.POUR_LEAD);
    }
    /* Real orders released so far. Act 4 meters them by exposure stage; act 5
       keeps them coming until the reversal starts. */
    function liveFloor() {
      if (S.rev > 0) {
        var total = T.LIVE_ROLLOUT + T.LIVE_GUARD;
        return total * (1 - easeIn(S.rev));
      }
      var n = easeOut(S.a4) * T.LIVE_ROLLOUT;
      if (S.a5 > 0) {
        n = T.LIVE_ROLLOUT +
            clamp(S.a5 / T.REV_START, 0, 1) * T.LIVE_GUARD;
      }
      return n;
    }

    /* ---- bead sequences ---------------------------------------------------
       Simulated beads take a free random walk: each peg is a fair coin, and
       the pile is therefore an honest Binomial(rows, 1/2). Nothing is nudged.

       Real orders take a BRIDGED walk to a target bin: at each remaining row
       the probability of going right is (target - accumulated) / rows-left,
       which produces a natural-looking path that provably ends on the target.
       The targets are stratified rather than sampled, so the demo tells the
       same story every time: in act 4 they land inside the forecast band, and
       in act 5 the stream drifts left by SHOCK and starts clearing the floor.
       ----------------------------------------------------------------------- */

    /* Inverse CDF of Binomial(rows, q) at u in 0..1. */
    function binomQuantile(rows, q, u) {
      var lp = 0, k, cum = 0, term = Math.pow(1 - q, rows);
      cum = term;
      if (u <= cum) return 0;
      for (k = 1; k <= rows; k++) {
        term = term * ((rows - k + 1) / k) * (q / (1 - q));
        cum += term;
        if (u <= cum) return k;
      }
      lp = rows;
      return lp;
    }

    /* Target bin for the i-th real order. Stratified over the unit interval so
       the scatter is even, with a low-discrepancy offset to break the ladder. */
    function liveTarget(i) {
      var rollout = i < T.LIVE_ROLLOUT;
      var n = rollout ? T.LIVE_ROLLOUT : T.LIVE_GUARD;
      var j = rollout ? i : i - T.LIVE_ROLLOUT;
      var u = (j + 0.5) / n;
      u = u + (h32(i, 7717) - 0.5) * (0.7 / n);
      /* Scatter, so consecutive orders do not march across the board in a
         ladder — real orders do not arrive sorted. */
      u = u + (h32(j, rollout ? 11 : 29) - 0.5) * 0.12;
      /* Rollout orders are held inside the 6th..98th percentile of the very
         distribution that was forecast: the point of act 4 is that reality
         lands where the simulation said it would. Act 5 gets the full range,
         because the point of act 5 is that sometimes it does not. */
      u = rollout ? clamp(u, 0.06, 0.98) : clamp(u, 0.004, 0.996);
      var q = rollout ? 0.5 : 0.5 - T.SHOCK;
      return binomQuantile(G.rows, q, u);
    }

    function spawnSim(i) {
      flight.push({
        i: i, kind: 0, row: 0, col: 0, target: -1,
        x: G.cx + (h32(i, 3) - 0.5) * G.dx * 0.30,
        y: G.hopY + G.hopH * 0.55,
        vy: 0, tx: G.cx, done: false, bin: -1
      });
    }
    function spawnLive(i) {
      flight.push({
        i: i, kind: 1, row: 0, col: 0, target: liveTarget(i),
        x: G.cx + (h32(i, 5) - 0.5) * G.dx * 0.22,
        y: G.dropY,
        vy: G.hop * 2, tx: G.cx, done: false, bin: -1
      });
    }

    /* Direction at a peg. Free coin for simulated beads; bridge for real ones. */
    function deflect(b) {
      var rowsLeft = G.rows - b.row;
      if (b.kind === 1 && b.target >= 0) {
        var need = b.target - b.col;
        if (need <= 0) return 0;
        if (need >= rowsLeft) return 1;
        return h32(b.i * 977 + b.row, 41) < (need / rowsLeft) ? 1 : 0;
      }
      return h32(b.i, b.row * 131 + 17) < 0.5 ? 1 : 0;
    }

    function landSim(bin) {
      binCount[bin] = (binCount[bin] | 0) + 1;
      order.push(bin);
      landed++;
    }
    function landLive(bin) {
      liveCount[bin] = (liveCount[bin] | 0) + 1;
      liveOrder.push(bin);
      if (bin < Math.ceil(M.guardBin)) breaches++;
      if (breaches >= T.BREACH_N) S.tripped = true;
    }
    function unlandSim() {
      var b = order.pop();
      if (b === undefined) return;
      var s = slotPos(b, binCount[b] - 1);
      binCount[b]--;
      landed--;
      pushPart(s.x, s.y, 0);
    }
    function unlandLive() {
      var b = liveOrder.pop();
      if (b === undefined) return;
      var y = surfaceY(b) - (liveCount[b] - 0.5) * (2 * G.rLive * 0.92);
      liveCount[b]--;
      if (b < Math.ceil(M.guardBin)) breaches = Math.max(0, breaches - 1);
      pushPart(binX(b), y, 1);
    }
    /* Beads only fly back up during the reversal. Scrubbing backwards through
       the earlier acts, or snapping to a new layout, just removes them —
       confetti in act 2 would be reporting an event that has not happened. */
    var snapping = false;
    function pushPart(x, y, kind) {
      if (snapping || S.rev <= 0) return;
      if (parts.length >= T.PARTICLE_CAP) return;
      parts.push({ x: x, y: y, vy: -(120 + h32((x * 7) | 0, (y * 13) | 0) * 220),
                   vx: (h32((y * 3) | 0, (x * 5) | 0) - 0.5) * 60,
                   a: 1, kind: kind });
    }

    /* ---- integration ------------------------------------------------------ */
    function advance(dt) {
      var i, b;

      /* 1. how many beads the story wants right now */
      var floorN = pourFloor(), ceilN = pourCeil();
      if (poured < floorN) poured = floorN;
      else if (S.rev <= 0 && S.p > T.ACTS[1].p0 && S.p < T.ACTS[3].p0 &&
               poured < G.nMax) {
        poured += (G.nMax / T.POUR_TIME) * dt;      // ambient pour when idle
      }
      if (poured > ceilN) poured = ceilN;
      if (poured < 0) poured = 0;
      var want = Math.floor(poured);

      /* Scrubbing backwards: drain the pile, newest first. */
      if (landed > want) {
        var guard = 0;
        while (landed > want && guard++ < 400) unlandSim();
        /* in-flight beads above the new mark go too */
        for (i = flight.length - 1; i >= 0; i--) {
          if (flight[i].kind === 0 && flight[i].i >= want) flight.splice(i, 1);
        }
      }

      /* Spawning. A big scroll jump lands the backlog instantly rather than
         building a wall of beads that takes seconds to clear. */
      var inAir = 0;
      for (i = 0; i < flight.length; i++) if (flight[i].kind === 0) inAir++;
      var next = landed + inAir;
      var budget = T.FLIGHT_CAP - inAir;
      while (next < want) {
        if (budget > 0) { spawnSim(next); budget--; }
        else { landSim(binOfSim(next)); }
        next++;
      }

      /* 2. real orders */
      var wantLive = Math.floor(liveFloor());
      var liveIn = 0;
      for (i = 0; i < flight.length; i++) if (flight[i].kind === 1) liveIn++;
      if (liveOrder.length > wantLive) {
        var g2 = 0;
        while (liveOrder.length > wantLive && g2++ < 200) unlandLive();
        for (i = flight.length - 1; i >= 0; i--) {
          if (flight[i].kind === 1 && flight[i].i >= wantLive) flight.splice(i, 1);
        }
        liveIn = 0;
        for (i = 0; i < flight.length; i++) if (flight[i].kind === 1) liveIn++;
      }
      var nextLive = liveOrder.length + liveIn;
      var lb = 18 - liveIn;
      while (nextLive < wantLive) {
        if (lb > 0) { spawnLive(nextLive); lb--; }
        else { landLive(liveTarget(nextLive)); }
        nextLive++;
      }
      liveOut = nextLive;
      S.tripped = breaches >= T.BREACH_N;

      /* 3. beads in the air */
      var xk = 1 - Math.exp(-T.XSMOOTH * dt);
      for (i = flight.length - 1; i >= 0; i--) {
        b = flight[i];
        b.vy += G.grav * dt;
        b.y += b.vy * dt;
        b.x += (b.tx - b.x) * xk;

        if (b.row < G.rows) {
          var py = pegY(b.row);
          if (b.y >= py) {
            var d = deflect(b);
            pegGlow[pegIndex(b.row, b.col)] = 1;
            b.col += d;
            b.row++;
            b.tx = b.row < G.rows ? pegX(b.row, b.col) : binX(b.col);
            b.y = py;
            b.vy = -G.hop;
          }
        } else {
          if (b.bin < 0) b.bin = b.col;
          var rest;
          if (b.kind === 0) {
            var s = slotPos(b.bin, binCount[b.bin] | 0);
            rest = s.y;
            b.tx = s.x;
          } else {
            rest = surfaceY(b.bin) -
                   ((liveCount[b.bin] | 0) + 0.5) * (2 * G.rLive * 0.92);
            b.tx = binX(b.bin);
          }
          if (b.y >= rest) {
            if (b.kind === 0) landSim(b.bin); else landLive(b.bin);
            flight.splice(i, 1);
          }
        }
      }

      /* 4. reversal particles */
      for (i = parts.length - 1; i >= 0; i--) {
        var q = parts[i];
        q.vy -= 260 * dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.a -= dt * 0.85;
        /* Draining beads expire at the mouth of the hopper — which reads as
           them going back where they came from, and keeps the confetti out of
           the band reserved for the price chip and the host page's chrome. */
        if (q.a <= 0 || q.y < G.by0 - 4) parts.splice(i, 1);
      }

      /* 5. peg glow decay */
      var decay = Math.exp(-dt * 4.2);
      for (i = 0; i < pegGlow.length; i++) {
        if (pegGlow[i] > 0.002) pegGlow[i] *= decay; else pegGlow[i] = 0;
      }

      S.tripped = breaches >= T.BREACH_N;
    }

    /* Bin of the i-th simulated bead, without simulating it — used when the
       backlog has to be landed instantly. Same coin, same answer. */
    function binOfSim(i) {
      var c = 0, r;
      for (r = 0; r < G.rows; r++) if (h32(i, r * 131 + 17) < 0.5) c++;
      return c;
    }

    /* Fast-forward to a steady state without animating — reduced motion, and
       the first paint after a resize mid-section. */
    function settle() {
      var want = Math.floor(pourFloor()), i;
      snapping = true;
      flight.length = 0; parts.length = 0;
      while (landed > want) unlandSim();
      while (landed < want) landSim(binOfSim(landed));
      var wl = Math.floor(liveFloor());
      while (liveOrder.length > wl) unlandLive();
      while (liveOrder.length < wl) landLive(liveTarget(liveOrder.length));
      liveOut = liveOrder.length;
      for (i = 0; i < pegGlow.length; i++) pegGlow[i] = 0;
      S.tripped = breaches >= T.BREACH_N;
      snapping = false;
    }

    /* =========================================================================
       Projection. In act 4 the board reclines away from the viewer, rotating
       about its own bottom edge — a real one-point perspective, not a scaleY.
       A point h above the floor is at depth h*sin(t) and height h*cos(t); the
       camera sits CAM board-heights away. The pile barely moves (it is at the
       floor) while the peg lattice recedes and narrows, which is exactly the
       reading we want: the machine tips over into a shop floor and the
       distribution stays where it is.
       ======================================================================= */
    var _pv = { x: 0, y: 0, s: 1 };
    function proj(x, y) {
      var t = S.tilt;
      if (t <= 0.0005) { _pv.x = x; _pv.y = y; _pv.s = 1; return _pv; }
      var th = t * T.TILT_DEG * Math.PI / 180;
      var h = G.floorY - y;
      var D = T.CAM * G.bh;
      var s = D / (D + h * Math.sin(th));
      _pv.s = s;
      _pv.x = G.cx + (x - G.cx) * s;
      _pv.y = G.floorY - h * Math.cos(th) * s;
      return _pv;
    }

    /* Palette for the current frame. */
    var PAL = {
      bg: [3, 8, 24], ink: [243, 236, 222], sim: [147, 170, 255],
      live: [216, 242, 75], lt: 0
    };
    function palette(p) {
      PAL.bg = ramp(BG, p);
      PAL.ink = ramp(INK, p);
      PAL.sim = ramp(SIM, p);
      PAL.live = ramp(LIVE, p);
      PAL.lt = clamp(lum(PAL.bg) / 0.6, 0, 1);   // 0 = dark field, 1 = cream
      return PAL;
    }

    /* =========================================================================
       Drawing
       ======================================================================= */
    function labelFont(px, weight) {
      ctx.font = (weight || 500) + ' ' + px +
        "px 'Inter',system-ui,-apple-system,sans-serif";
      try { ctx.letterSpacing = '0.14em'; } catch (e) {}
    }
    function plainFont(px, weight) {
      ctx.font = (weight || 600) + ' ' + px +
        "px 'Inter',system-ui,-apple-system,sans-serif";
      try { ctx.letterSpacing = '0em'; } catch (e) {}
    }

    function drawField() {
      ctx.fillStyle = css(PAL.bg);
      ctx.fillRect(0, 0, cssW, cssH);
      /* A soft lift behind the board so the lattice never floats on flat
         colour. It fades out as the field turns to cream — a glow on paper
         reads as a smudge. */
      var a = (1 - PAL.lt) * 0.5;
      if (a > 0.01 && ctx.createRadialGradient) {
        var gx = G.cx, gy = G.by0 + G.bh * 0.52;
        var gr = Math.max(G.bw, G.bh) * 0.8;
        var g = ctx.createRadialGradient(gx, gy, gr * 0.05, gx, gy, gr);
        var c0 = mixc(PAL.bg, PAL.sim, 0.16);
        g.addColorStop(0, rgba(c0, a * 0.5));
        g.addColorStop(1, rgba(c0, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, cssW, cssH);
      }
    }

    /* The hopper, and the price it is holding. In act 1 the beads wait inside
       it; from act 2 the gate is open; by act 4 the whole thing has receded. */
    function drawHopper() {
      /* Recedes through the rollout, and comes back as the machine unwinds —
         the price has to be seen returning to where it started. */
      var vis = 1 - smooth(clamp((S.a4 - 0.10) / 0.45, 0, 1));
      vis = Math.max(vis, smooth(clamp((S.rev - 0.30) / 0.45, 0, 1)));
      if (vis <= 0.01) return;
      var open = smooth(clamp(S.a2 / 0.14, 0, 1)) * (1 - easeIn(S.rev));
      var w = G.dx * 3.1, y0 = G.hopY, y1 = G.hopY + G.hopH;
      var a = proj(G.cx - w / 2, y0), ax = a.x, ay = a.y;
      var b = proj(G.cx + w / 2, y0), bx = b.x;
      var c = proj(G.cx + G.dx * 0.42, y1), cx2 = c.x, cy = c.y;
      var d = proj(G.cx - G.dx * 0.42, y1), dx2 = d.x;

      ctx.globalAlpha = vis;
      ctx.beginPath();
      ctx.moveTo(ax, ay); ctx.lineTo(bx, ay);
      ctx.lineTo(cx2, cy); ctx.lineTo(dx2, cy);
      ctx.closePath();
      ctx.fillStyle = rgba(mixc(PAL.bg, PAL.ink, 0.06), 0.9);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(PAL.ink, 0.26);
      ctx.stroke();

      /* Beads waiting inside, draining as the gate opens. */
      var keep = 1 - open;
      if (keep > 0.02) {
        ctx.beginPath();
        var rows = 4, k = 0;
        for (var r = 0; r < rows; r++) {
          var per = 7 - r * 2;
          for (var i = 0; i < per; i++, k++) {
            if (h32(k, 91) > keep) continue;
            var hx = G.cx + (i - (per - 1) / 2) * (G.r * 2.35);
            var hy = y1 - G.r * 1.6 - r * (G.r * 2.0);
            var pp = proj(hx, hy);
            ctx.moveTo(pp.x + G.r * pp.s, pp.y);
            ctx.arc(pp.x, pp.y, G.r * pp.s, 0, TAU);
          }
        }
        ctx.fillStyle = rgba(PAL.sim, 0.85);
        ctx.fill();
      }

      /* The price chip. Act 1 shows the current price; from act 2 it shows the
         proposal; the reversal walks it back.

         It sits in the band layout() reserved for it above the board — never
         at an offset subtracted from the board's own top edge, which is what
         used to push it off the stage on short viewports and underneath a
         sticky site nav on tall ones. */
      var tprop = smooth(clamp((S.p - 0.055) / 0.085, 0, 1));
      var shown = M.price0 +
        (M.price1 - M.price0) * tprop * (1 - easeIn(S.rev));
      plainFont(G.chipFs, 600);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      var warm = S.rev > 0.02 && S.rev < 0.99;
      ctx.fillStyle = warm ? rgba(PAL.live, 0.95) : rgba(PAL.ink, 0.94);
      ctx.fillText('$' + shown.toFixed(2), G.cx, G.chipCy);
      ctx.globalAlpha = 1;
    }

    function drawPegs() {
      var vis = 1 - smooth(clamp((S.a4 - 0.05) / 0.55, 0, 1)) * 0.82;
      var rows = G.rows, r, c, pr = Math.max(1.4, G.r * 0.52);
      ctx.globalAlpha = vis;
      ctx.beginPath();
      for (r = 0; r < rows; r++) {
        var y = pegY(r);
        for (c = 0; c <= r; c++) {
          var pp = proj(pegX(r, c), y);
          var rr = pr * pp.s;
          ctx.moveTo(pp.x + rr, pp.y);
          ctx.arc(pp.x, pp.y, rr, 0, TAU);
        }
      }
      ctx.fillStyle = rgba(PAL.ink, 0.30);
      ctx.fill();

      /* Struck pegs. Each one is a market uncertainty doing its job, so they
         are worth showing: the lattice sparkles where the beads are. */
      ctx.beginPath();
      var any = false;
      for (r = 0; r < rows; r++) {
        var yy = pegY(r);
        for (c = 0; c <= r; c++) {
          var e = pegGlow[pegIndex(r, c)];
          if (e < 0.03) continue;
          var q = proj(pegX(r, c), yy);
          var rad = (pr + e * G.r * 1.5) * q.s;
          ctx.moveTo(q.x + rad, q.y);
          ctx.arc(q.x, q.y, rad, 0, TAU);
          any = true;
        }
      }
      if (any) { ctx.fillStyle = rgba(PAL.sim, 0.42 * vis); ctx.fill(); }
      ctx.globalAlpha = 1;
    }

    /* The 80% band. p10 and p90 of the fitted distribution — which, by
       construction (see model()), are the two ends of the elasticity band.
       This is the "range, never a number". */
    function drawBand() {
      var vis = smooth(clamp((S.a3 - 0.12) / 0.35, 0, 1)) *
                (1 - smooth(clamp((S.rev - 0.25) / 0.5, 0, 1)));
      if (vis <= 0.01) return;
      var b0 = M.binOf(M.lo), b1 = M.binOf(M.hi);
      var x0 = binX(b0), x1 = binX(b1);
      var top = G.floorY - G.pileH * 1.12, bot = G.floorY;
      var p0 = proj(x0, top), p1 = proj(x1, top);
      var q0 = proj(x0, bot), q1 = proj(x1, bot);

      ctx.globalAlpha = vis;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(q1.x, q1.y); ctx.lineTo(q0.x, q0.y);
      ctx.closePath();
      ctx.fillStyle = rgba(PAL.sim, 0.10 + PAL.lt * 0.03);
      ctx.fill();

      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(PAL.sim, 0.42);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y); ctx.lineTo(q0.x, q0.y);
      ctx.moveTo(p1.x, p1.y); ctx.lineTo(q1.x, q1.y);
      ctx.stroke();

      labelFont(10, 500);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = rgba(PAL.sim, 0.72);
      ctx.fillText('80% OF FUTURES', (p0.x + p1.x) / 2, p0.y - 8);
      ctx.globalAlpha = 1;
    }

    /* Break-even. Where a price move stops paying for itself. No number
       attached — the line is the statement. */
    function drawZero() {
      var vis = smooth(clamp((S.a3 - 0.05) / 0.3, 0, 1)) *
                (1 - smooth(clamp((S.rev - 0.35) / 0.5, 0, 1)));
      if (vis <= 0.01) return;
      var x = binX(M.zeroBin);
      var a = proj(x, G.floorY - G.pileH * 1.2), b = proj(x, G.floorY);
      ctx.save();
      ctx.globalAlpha = vis * 0.55;
      ctx.setLineDash([3, 5]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(PAL.ink, 0.6);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.restore();
      labelFont(9, 500);
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.globalAlpha = vis * 0.7;
      ctx.fillStyle = rgba(PAL.ink, 0.7);
      ctx.fillText('BREAK-EVEN', b.x, b.y + 9);
      ctx.globalAlpha = 1;
    }

    /* The guardrail. Everything left of this line is a day that came in more
       than GUARDRAIL_PCT below baseline profit. */
    function drawGuard() {
      var vis = smooth(clamp(S.a5 / 0.18, 0, 1)) *
                (1 - smooth(clamp((S.rev - 0.60) / 0.35, 0, 1)));
      if (vis <= 0.01) return;
      var x = binX(M.guardBin);
      /* Kept a fixed distance clear of the band's own label, so FLOOR and
         80% OF FUTURES do not print on top of each other when the pile zone is
         only sixty pixels tall — which is what a landscape phone gives it. */
      var top = G.floorY - G.pileH * 1.12 - Math.max(14, G.pileH * 0.08);
      var a = proj(x, top), b = proj(x, G.floorY);
      var lft = proj(G.bx0, top), lfb = proj(G.bx0, G.floorY);

      ctx.globalAlpha = vis;
      ctx.beginPath();
      ctx.moveTo(lft.x, lft.y); ctx.lineTo(a.x, a.y);
      ctx.lineTo(b.x, b.y); ctx.lineTo(lfb.x, lfb.y);
      ctx.closePath();
      ctx.fillStyle = rgba(PAL.live, 0.07);
      ctx.fill();

      var hot = S.tripped ? 1 : clamp(breaches / T.BREACH_N, 0, 1);
      ctx.lineWidth = 1 + hot;
      ctx.strokeStyle = rgba(PAL.live, 0.45 + hot * 0.45);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();

      labelFont(10, 600);
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillStyle = rgba(PAL.live, 0.9);
      ctx.fillText('FLOOR', lft.x + 2, a.y - 8);
      ctx.globalAlpha = 1;
    }

    /* The pile. One path, one fill — several hundred arcs cost less than one
       shadowed circle, so the beads stay individual all the way to 60fps. */
    function drawPile() {
      var i, k, n, s, rr;
      ctx.beginPath();
      for (i = 0; i < G.bins; i++) {
        n = binCount[i] | 0;
        for (k = 0; k < n; k++) {
          s = slotPos(i, k);
          var pp = proj(s.x, s.y);
          rr = G.r * pp.s;
          ctx.moveTo(pp.x + rr, pp.y);
          ctx.arc(pp.x, pp.y, rr, 0, TAU);
        }
      }
      ctx.fillStyle = rgba(PAL.sim, 0.80);
      ctx.fill();

      /* The surface, traced. This is the bell curve emerging from the beads,
         and it is drawn FROM the beads rather than fitted over them. */
      var vis = smooth(clamp((S.a2 - 0.55) / 0.4, 0, 1));
      if (vis > 0.01 && landed > 8) {
        ctx.globalAlpha = vis;
        ctx.beginPath();
        var started = false;
        for (i = 0; i < G.bins; i++) {
          var y = surfaceY(i);
          var q = proj(binX(i), y);
          if (!started) { ctx.moveTo(q.x, q.y); started = true; }
          else ctx.lineTo(q.x, q.y);
        }
        ctx.lineWidth = 1.6;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = rgba(mixc(PAL.sim, PAL.ink, 0.35), 0.75);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    /* Real orders. Neon, larger, outlined so they read on cream, and stacked
       on the SURFACE of the simulated pile so you can see them falling inside
       the forecast. */
    function drawLive() {
      var i, k, n;
      if (!liveOrder.length) return;
      var strokeC = rgba(mixc(PAL.live, PAL.bg, 0.55), 0.85);
      ctx.beginPath();
      for (i = 0; i < G.bins; i++) {
        n = liveCount[i] | 0;
        if (!n) continue;
        var base = surfaceY(i), x = binX(i);
        for (k = 0; k < n; k++) {
          var y = base - (k + 0.5) * (2 * G.rLive * 0.92);
          var pp = proj(x, y);
          var rr = G.rLive * pp.s;
          ctx.moveTo(pp.x + rr, pp.y);
          ctx.arc(pp.x, pp.y, rr, 0, TAU);
        }
      }
      ctx.fillStyle = rgba(PAL.live, 0.95);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = strokeC;
      ctx.stroke();
    }

    function drawFlight() {
      var i, b, pp, rr;
      /* simulated */
      ctx.beginPath();
      for (i = 0; i < flight.length; i++) {
        b = flight[i];
        if (b.kind !== 0) continue;
        pp = proj(b.x, b.y);
        rr = G.r * pp.s;
        ctx.moveTo(pp.x + rr, pp.y);
        ctx.arc(pp.x, pp.y, rr, 0, TAU);
      }
      ctx.fillStyle = rgba(mixc(PAL.sim, PAL.ink, 0.30), 0.95);
      ctx.fill();

      /* real — with a short trail, because a live order is an event */
      ctx.lineCap = 'round';
      for (i = 0; i < flight.length; i++) {
        b = flight[i];
        if (b.kind !== 1) continue;
        pp = proj(b.x, b.y);
        /* The trail is clipped at the release height, so nothing an order does
           on the way in can reach the band reserved above the board. */
        var ty = Math.max(G.dropY - 2, b.y - Math.min(34, Math.abs(b.vy) * 0.055));
        var tp = proj(b.x, ty);
        rr = G.rLive * pp.s;
        ctx.beginPath();
        ctx.moveTo(tp.x, tp.y); ctx.lineTo(pp.x, pp.y);
        ctx.lineWidth = rr * 1.1;
        ctx.strokeStyle = rgba(PAL.live, 0.22);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pp.x + rr, pp.y);
        ctx.arc(pp.x, pp.y, rr, 0, TAU);
        ctx.fillStyle = rgba(PAL.live, 0.98);
        ctx.fill();
      }
    }

    function drawParts() {
      if (!parts.length) return;
      var i, q, pp;
      for (i = 0; i < parts.length; i++) {
        q = parts[i];
        pp = proj(q.x, q.y);
        var rr = (q.kind ? G.rLive : G.r) * pp.s;
        ctx.globalAlpha = clamp(q.a, 0, 1) * 0.85;
        ctx.beginPath();
        ctx.moveTo(pp.x + rr, pp.y);
        ctx.arc(pp.x, pp.y, rr, 0, TAU);
        ctx.fillStyle = css(q.kind ? PAL.live : PAL.sim);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function drawFloorLine() {
      var a = proj(G.bx0, G.floorY), b = proj(G.bx1, G.floorY);
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(PAL.ink, 0.22 + S.tilt * 0.18);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    /* The posterior on elasticity, tightening as trials accumulate. This is
       the inference made visible: the prior is the full published band, and
       every bead narrows it. Shown only while the simulation is the subject. */
    function drawPosterior() {
      var vis = smooth(clamp(S.a2 / 0.16, 0, 1)) *
                (1 - smooth(clamp((S.a3 - 0.5) / 0.5, 0, 1)));
      if (vis <= 0.01) return;
      var w = Math.min(G.bw * 0.5, 220);
      var x0 = G.cx - w / 2, y = G.floorY + Math.max(20, G.bh * 0.045);
      /* Stays inside the board box, so it can never sit on the act rail at the
         bottom of a short stage. */
      if (y > G.by1 - 6) y = G.by1 - 6;
      var t = clamp(landed / Math.max(1, G.nMax), 0, 1);
      var half = 0.5 * (1 - 0.78 * easeOut(t));   // shrinks toward the estimate

      ctx.globalAlpha = vis;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.strokeStyle = rgba(PAL.ink, 0.16);
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); ctx.stroke();
      ctx.strokeStyle = rgba(PAL.sim, 0.9);
      ctx.beginPath();
      ctx.moveTo(x0 + w * (0.5 - half), y);
      ctx.lineTo(x0 + w * (0.5 + half), y);
      ctx.stroke();
      labelFont(9, 500);
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillStyle = rgba(PAL.ink, 0.5);
      ctx.fillText('ELASTICITY, NARROWING', G.cx, y + 10);
      ctx.globalAlpha = 1;
    }

    /* Rollout. A strip of the catalog, the lit fraction of which carries the
       new price. Act 4 only — it is what "5% then 20% then 50% of products"
       looks like. Every shopper sees the same price; the ramp is by SKU. */
    function drawExposure() {
      var vis = smooth(clamp(S.a4 / 0.10, 0, 1)) *
                (1 - smooth(clamp((S.rev - 0.2) / 0.5, 0, 1)));
      if (vis <= 0.01) return;
      var n = 24, gap = Math.min(G.bw / n, 14);
      var w = gap * (n - 1), x0 = G.cx - w / 2;
      var y = G.by0 + Math.max(14, G.bh * 0.03);
      var pct = T.STAGES[S.a5 > 0 ? T.STAGES.length - 1 : S.stage] / 100;
      var lit = Math.round(pct * n);
      ctx.globalAlpha = vis;
      for (var i = 0; i < n; i++) {
        var on = i < lit;
        ctx.beginPath();
        ctx.arc(x0 + i * gap, y, on ? 2.6 : 1.7, 0, TAU);
        ctx.fillStyle = on ? rgba(PAL.live, 0.95) : rgba(PAL.ink, 0.22);
        ctx.fill();
      }
      labelFont(9, 500);
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillStyle = rgba(PAL.ink, 0.45);
      ctx.fillText('PRODUCTS ON NEW PRICE', G.cx, y - 11);
      ctx.globalAlpha = 1;
    }

    /* =========================================================================
       One frame.
       ======================================================================= */
    var drawCount = 0;
    function render() {
      drawCount++;
      palette(S.p);
      applyChrome();
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha = 1;

      drawField();
      drawHopper();
      drawPegs();
      drawBand();
      drawZero();
      drawFloorLine();
      drawPile();
      drawGuard();
      drawLive();
      drawFlight();
      drawParts();
      drawPosterior();
      drawExposure();
    }

    /* ---- HUD ------------------------------------------------------------- */
    var lastAct = -1, lastBgCss = '', varCache = {};
    function setVar(k, v) {
      if (varCache[k] === v) return;
      varCache[k] = v;
      section.style.setProperty(k, v);
    }
    function applyChrome() {
      var bgc = css(PAL.bg);
      if (bgc !== lastBgCss) {
        lastBgCss = bgc;
        if (!reduce) section.style.backgroundColor = bgc;
      }
      /* Only write a custom property when it has actually changed — each one
         invalidates style for the whole subtree, and at 60fps that adds up. */
      setVar('--pfm-ink', css(PAL.ink));
      setVar('--pfm-dim', css(mixc(PAL.ink, PAL.bg, 0.30)));
      setVar('--pfm-sim', css(PAL.sim));
      setVar('--pfm-live', css(PAL.live));

      var i, A = T.ACTS;
      for (i = 0; i < actEls.length; i++) {
        var a = A[i], e = actEls[i];
        var fin = clamp((S.p - a.p0) / a.fi, 0, 1);
        var fout = clamp((a.p1 - S.p) / a.fo, 0, 1);
        var o = reduce ? 1 : Math.min(fin, fout);
        o = smooth(o);
        /* Opacity only — never `visibility` or `display`. All five acts stay
           in the accessibility tree as real text, whatever is on screen. */
        if (Math.abs(o - e.alpha) > 0.004) {
          e.alpha = o;
          e.root.style.opacity = o.toFixed(3);
        }
        if (!reduce) {
          var sh = (1 - o) * 16 * (S.p > (a.p0 + a.p1) / 2 ? -1 : 1);
          if (Math.abs(sh - e.shift) > 0.4) {
            e.shift = sh;
            e.root.style.transform = 'translate3d(0,' + sh.toFixed(1) + 'px,0)';
          }
        }
        var seg = segs[i];
        var fill = clamp((S.p - a.p0) / (a.p1 - a.p0), 0, 1);
        seg.style.transform = 'scaleX(' + fill.toFixed(3) + ')';
      }

      writeFigures();

      if (!reduce && S.act !== lastAct) {
        lastAct = S.act;
        var c = COPY[S.act];
        sr.textContent = 'Act ' + (S.act + 1) + ' of 5, ' + c.t + '. ' + c.line;
      }
    }

    /* One number at a time — each act owns exactly one. */
    function writeFigures() {
      set(0, '$' + M.price1.toFixed(2));
      var trials = Math.round(landed / Math.max(1, G.nMax) * T.TRIALS / 20) * 20;
      set(1, group(trials));
      set(2, signedMoney(Math.round(M.lo / 100) * 100) + ' … ' +
             signedMoney(Math.round(M.hi / 100) * 100));
      set(3, T.STAGES[S.a5 > 0 ? T.STAGES.length - 1 : S.stage] + '%');
      if (S.rev > 0.35) {
        set(4, '$' + M.price0.toFixed(2));
        setLab(4, 'price restored');
      } else {
        set(4, '−' + Math.abs(T.GUARDRAIL_PCT) + '%');
        setLab(4, 'profit floor');
      }
      function set(i, v) {
        var n = actEls[i].num;
        if (n.firstChild) { if (n.firstChild.nodeValue !== v) n.firstChild.nodeValue = v; }
        else n.appendChild(doc.createTextNode(v));
      }
      function setLab(i, v) {
        var n = actEls[i].lab;
        if (n.firstChild) { if (n.firstChild.nodeValue !== v) n.firstChild.nodeValue = v; }
        else n.appendChild(doc.createTextNode(v));
      }
    }

    /* =========================================================================
       Scroll progress. Read from the layout box every tick — always accurate,
       never throttled, and it needs no scroll event to be correct.
       ======================================================================= */
    function readProgress() {
      /* Reduced motion: one frozen frame, taken after the rollout and with the
         guardrail in place, so the static picture still carries the argument. */
      if (reduce) return 0.85;
      if (!section.getBoundingClientRect) return 0;
      var r = section.getBoundingClientRect();
      var vh = win.innerHeight ||
        (doc.documentElement && doc.documentElement.clientHeight) || 800;
      var span = r.height - vh;
      if (!(span > 0)) return r.top <= 0 ? 1 : 0;
      return clamp(-r.top / span, 0, 1);
    }

    function nearViewport() {
      if (!section.getBoundingClientRect) return true;
      var r = section.getBoundingClientRect();
      var vh = win.innerHeight ||
        (doc.documentElement && doc.documentElement.clientHeight) || 800;
      return r.bottom > -vh * 0.5 && r.top < vh * 1.5;
    }

    /* =========================================================================
       Sizing. There is no path out of resize() that leaves the canvas
       unpainted, and the measurement uses clientWidth/Height (the layout box)
       rather than getBoundingClientRect, which is post-transform and can be
       inflated by any ancestor's scroll-driven scale.
       ======================================================================= */
    function measure() {
      /* In reduced-motion the canvas is a normal block in the flow with its
         own aspect box, so it is the thing to measure; otherwise the stage is
         the viewport-sized pin. */
      var box = reduce ? cvs : stage;
      var w = box.clientWidth || 0, h = box.clientHeight || 0;
      if ((!w || !h) && box.getBoundingClientRect) {
        var r = box.getBoundingClientRect();
        if (!w) w = r.width || 0;
        if (!h) h = r.height || 0;
      }
      if (!(w > 0)) w = win.innerWidth || 1200;
      if (!(h > 0)) h = reduce ? Math.round(w * 0.75) : (win.innerHeight || 800);
      return [Math.min(w, 4000), Math.min(h, 4000)];
    }

    function resize() {
      var m = measure();
      cssW = m[0]; cssH = m[1];
      dpr = Math.min(win.devicePixelRatio || 1, T.MAX_DPR);
      if (cvs) {
        var pw = Math.max(1, Math.round(cssW * dpr));
        var ph = Math.max(1, Math.round(cssH * dpr));
        if (cvs.width !== pw) cvs.width = pw;      // clears the bitmap
        if (cvs.height !== ph) cvs.height = ph;
      }
      layout();
      derive(readProgress());
      settle();                 // rebuild the pile for the current progress
      render();                 // unconditional
    }

    /* =========================================================================
       Loop. Wall-clock driven so rAF and the watchdog can both advance it.
       ======================================================================= */
    var nowMs = (win.performance && win.performance.now)
      ? function () { return win.performance.now(); }
      : function () { return Date.now(); };

    var raf = 0, lastNow = 0, lastRealFrame = 0, watchdog = 0, destroyed = false;

    function tick(now) {
      if (destroyed) return;
      var dt = lastNow ? (now - lastNow) / 1000 : 1 / 60;
      lastNow = now;
      if (!(dt > 0)) dt = 1 / 60;
      if (dt > T.MAX_DT) dt = T.MAX_DT;
      derive(readProgress());
      if (!reduce) advance(dt);
      render();
    }

    function frame(now) {
      raf = 0;
      lastRealFrame = nowMs();
      if (destroyed) return;
      if (nearViewport()) tick(typeof now === 'number' ? now : nowMs());
      else {
        /* Far offscreen: paint nothing, and let the chain die rather than
           burn 60 frames a second measuring an invisible section. The
           watchdog and the scroll handler both re-arm it on approach. */
        lastNow = 0;
        derive(readProgress());
        return;
      }
      if (!destroyed && !reduce) raf = win.requestAnimationFrame(frame);
    }

    function stopRaf() { if (raf) { win.cancelAnimationFrame(raf); raf = 0; } }

    /* Paint first, schedule second. */
    function play() {
      if (destroyed) return;
      stopRaf();
      lastNow = 0;
      tick(nowMs());
      if (reduce || !win.requestAnimationFrame) return;
      raf = win.requestAnimationFrame(frame);
    }

    /* Watchdog. In a document that reports itself hidden, rAF never fires and
       the section would freeze on its first frame forever. This drives the
       tick when frames have gone quiet and stands itself down the moment real
       ones start arriving. */
    watchdog = win.setInterval(function () {
      if (destroyed || reduce) return;
      var n = nowMs();
      if (n - lastRealFrame < T.WATCHDOG_MS * 1.6) return;   // rAF is healthy
      if (!nearViewport()) { lastNow = 0; return; }
      tick(n);
      /* The frame chain dies while offscreen; hand it back to rAF here so a
         healthy document resumes at full rate instead of watchdog cadence. */
      if (!raf && win.requestAnimationFrame) raf = win.requestAnimationFrame(frame);
    }, T.WATCHDOG_MS);

    /* ---- listeners -------------------------------------------------------- */
    var resizeTimer = 0;
    function onResize() {
      win.clearTimeout(resizeTimer);
      resizeTimer = win.setTimeout(function () {
        if (destroyed) return;
        resize();
        play();
      }, 90);
    }
    function onScroll() {
      if (destroyed) return;
      derive(readProgress());
      if (reduce) return;
      /* One paint per display frame: arm rAF if it is not already pending
         rather than also painting synchronously (which doubled the work
         during fast scrolling). Without rAF at all, paint directly. */
      if (win.requestAnimationFrame) {
        if (!raf) raf = win.requestAnimationFrame(frame);
      } else {
        render();
      }
    }
    function onVisibility() { play(); }
    function onReduce() {
      try { reduce = !!(mq && mq.matches); } catch (e) {}
      applyClasses();
      if (reduce) { stopRaf(); section.style.backgroundColor = ''; }
      resize();
      play();
    }

    /* Size drift. ResizeObserver is silenced in a document that reports itself
       hidden, and an orientation flip on iOS lands its final size a frame or
       two after the event — so the stage is measured on a slow interval and a
       relayout is forced whenever the box, the safe area or the host page's
       pinned chrome has moved. This is what makes a rotation correct without a
       reload. */
    function checkDrift() {
      if (destroyed) return false;
      var m = measure();
      if (Math.abs(m[0] - cssW) > 1 || Math.abs(m[1] - cssH) > 1) {
        resize(); play(); return true;
      }
      if (reduce) return false;
      /* The chrome probe walks elementFromPoint + getComputedStyle; skip it
         while the section is far offscreen — any drift is caught on the
         first check after it comes back near the viewport. */
      if (!nearViewport()) return false;
      var chrome = Math.max(overlayTop(true), safeInsets().t);
      if (Math.abs(chrome - G.chrome) > 1.5) { resize(); play(); return true; }
      return false;
    }
    var driftTimer = win.setInterval(checkDrift, 500);

    var ro = null, io = null;
    if (typeof win.ResizeObserver !== 'undefined') {
      ro = new win.ResizeObserver(onResize);
      try { ro.observe(stage); } catch (e3) {}
    }
    win.addEventListener('resize', onResize);
    win.addEventListener('orientationchange', onResize);
    if (win.visualViewport && win.visualViewport.addEventListener) {
      try { win.visualViewport.addEventListener('resize', onResize); } catch (e7) {}
    }
    /* Web fonts change the height of the copy column, which the stacked board
       measures against. */
    try {
      if (doc.fonts && doc.fonts.ready && doc.fonts.ready.then) {
        doc.fonts.ready.then(function () { if (!destroyed) { resize(); play(); } });
      }
    } catch (e8) {}
    /* Passive, capture-free: the page keeps its own scroll. Nothing here
       calls preventDefault, scrollTo or wheel handling. */
    win.addEventListener('scroll', onScroll, { passive: true });
    doc.addEventListener('visibilitychange', onVisibility);
    if (typeof win.IntersectionObserver !== 'undefined') {
      /* An optimisation hint only — first paint never waits on it. */
      io = new win.IntersectionObserver(function () { play(); },
        { threshold: [0, 0.01, 0.99] });
      try { io.observe(section); } catch (e4) {}
    }
    if (mq) {
      if (mq.addEventListener) mq.addEventListener('change', onReduce);
      else if (mq.addListener) mq.addListener(onReduce);
    }

    /* ---- first paint ------------------------------------------------------ */
    resize();                 // paints
    play();                   // paints again, then schedules

    initPfSim.probe = {
      state: S, geom: G, model: function () { return M; },
      palette: function () { return PAL; },
      counts: function () {
        return {
          landed: landed, live: liveOrder.length, flight: flight.length,
          parts: parts.length, breaches: breaches, tripped: S.tripped,
          draws: drawCount
        };
      },
      figures: function () {
        var o = [], i;
        for (i = 0; i < actEls.length; i++) {
          o.push({
            num: actEls[i].num.textContent,
            lab: actEls[i].lab.textContent,
            alpha: actEls[i].alpha
          });
        }
        return o;
      },
      setProgress: function (p) {
        derive(clamp(p, 0, 1));
        settle();
        render();
        return S.p;
      },
      step: function (n, dt) {
        for (var i = 0; i < (n || 1); i++) { advance(dt || 1 / 60); }
        render();
      },
      render: render,
      resize: resize,
      /* The price chip is canvas text, so it has no DOM box to inspect. This
         reports the box it actually occupies, in CSS pixels relative to the
         stage — which is what the clipping test asserts against. */
      chipBox: function () {
        var wpx = 0;
        if (ctx) {
          plainFont(G.chipFs, 600);
          try { wpx = ctx.measureText('$' + M.price1.toFixed(2)).width || 0; }
          catch (e) { wpx = G.chipFs * 3.4; }
        } else { wpx = G.chipFs * 3.4; }
        /* 0.62em above and below the middle baseline covers cap height plus
           the descender slack every font engine adds. */
        return {
          left: G.cx - wpx / 2, right: G.cx + wpx / 2,
          top: G.chipCy - G.chipFs * 0.62,
          bottom: G.chipCy + G.chipFs * 0.62,
          fs: G.chipFs, cy: G.chipCy
        };
      },
      layoutInfo: function () {
        return {
          w: cssW, h: cssH, mode: modeSide ? 'side' : 'stack',
          short: modeShort, chrome: G.chrome, safeTop: G.safeTop,
          chipBand: G.chipBand, chipFs: G.chipFs,
          bx0: G.bx0, bx1: G.bx1, by0: G.by0, by1: G.by1,
          rows: G.rows, beadR: G.r
        };
      },
      histogram: function () { return binCount.slice(); },
      liveHistogram: function () { return liveCount.slice(); },
      bg: function () { return css(PAL.bg); },
      ink: function () { return css(PAL.ink); }
    };

    /* =========================================================================
       Cleanup
       ======================================================================= */
    return function cleanup() {
      if (destroyed) return;
      destroyed = true;
      stopRaf();
      win.clearInterval(watchdog);
      win.clearInterval(driftTimer);
      win.clearTimeout(resizeTimer);
      if (ro && ro.disconnect) ro.disconnect();
      if (io && io.disconnect) io.disconnect();
      win.removeEventListener('resize', onResize);
      win.removeEventListener('orientationchange', onResize);
      if (win.visualViewport && win.visualViewport.removeEventListener) {
        try { win.visualViewport.removeEventListener('resize', onResize); } catch (e9) {}
      }
      win.removeEventListener('scroll', onScroll, { passive: true });
      doc.removeEventListener('visibilitychange', onVisibility);
      if (mq) {
        if (mq.removeEventListener) mq.removeEventListener('change', onReduce);
        else if (mq.removeListener) mq.removeListener(onReduce);
      }
      flight.length = 0; parts.length = 0;
      order.length = 0; liveOrder.length = 0;
      binCount.length = 0; liveCount.length = 0;
      pegGlow = null;
      if (initPfSim.probe && initPfSim.probe.state === S) initPfSim.probe = null;
      if (section.parentNode) section.parentNode.removeChild(section);
      instances--;
      if (instances <= 0) {
        instances = 0;
        var s = doc.getElementById(STYLE_ID);
        if (s && s.parentNode) s.parentNode.removeChild(s);
      }
    };
  }

  initPfSim.model = model;
  initPfSim.ramp = function (which, p) {
    var s = which === 'ink' ? INK : which === 'sim' ? SIM
          : which === 'live' ? LIVE : BG;
    return ramp(s, p);
  };
  initPfSim.contrast = contrast;
  initPfSim.lum = lum;
  window.initPfSim = initPfSim;
})();
