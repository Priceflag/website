/* =====================================================================
   Priceflag — "Earn more with Priceflag." comparison section.

   Usage:
     <script src="./sections/pf-compare.js"></script>
     const cleanup = window.initPfCompare(document.getElementById('compare'));
     // ...later
     cleanup();

   Contract:
     - exactly one global: window.initPfCompare
     - builds all of its own DOM inside `root`
     - injects its own <style> exactly once, every selector prefixed .pfc-
     - returns a cleanup() that cancels rAF / observers / listeners / timers
     - zero dependencies

   The section says one thing: the neon line ends highest. It carries a
   headline, a single supporting line, and four short series labels drawn
   at the ends of the lines. No number: the curves are illustrative, and
   the invented "+11%" that used to print here is gone. Resist adding
   axes, ticks, dollar readouts or explanatory copy back.

   RESPONSIVE CONTRACT (phones and tablets, both orientations):
     * Layout is CONTAINER-driven. .pfc-grid is a flex-wrap row, so the
       two columns stack whenever the container cannot hold them — a
       narrow container inside a wide window included. There are no
       viewport media queries in the layout; one of those is what used
       to collapse the figure to zero width.
     * Height comes from the figure's own width (chartHeight), with the
       viewport only as a soft ceiling and a hard 2.4:1 aspect floor, so
       a landscape phone gets a chart rather than a letterbox slit.
     * The four end labels are sized to a gutter budget that shrinks with
       the canvas. In order, the layout tries: full words with the number
       inline, full words with the number stacked underneath, abbreviated
       words stacked, and finally smaller type. Because the gutter is
       measured FROM the chosen variant, labels can never run off the
       right edge, and the dodge in placeRows() keeps them from
       overlapping each other at any height.
     * Re-layout is live: resize, orientationchange, screen.orientation,
       pageshow, visibilitychange, ResizeObserver, plus a 250ms poll for
       the environments where none of those fire.

   ENVIRONMENT NOTE (do not "simplify" this away):
     This page can run with document.hidden === true, which pauses
     requestAnimationFrame indefinitely. Therefore:
       * draw() never early-returns — every call ends with a fully
         painted frame (background, series, labels).
       * resize() always repaints after touching canvas.width/height
         (assigning either one blanks the backing store).
       * a low-frequency watchdog interval advances the animation when
         rAF is starved, and stands down automatically the moment real
         rAF frames start arriving.
   ===================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     Tunables. Everything a designer is likely to want to move lives here.
     ------------------------------------------------------------------ */

  var C = {
    BG:     '#030818',
    CREAM:  '#f3ecde',
    NEON:   '#d8f24b',
    PERI:   '#93aaff',
    BLUE:   '#1d4ed8',
    NAVY:   '#0d2168',
    /* #1d4ed8 lifted 28% toward cream so a 1.4px hairline still clears
       ~4.8:1 against #030818. Pure #1d4ed8 sits at ~2.5:1 and disappears. */
    BLUE_LINE: '#597ada'
  };

  var SANS = "'Inter', system-ui, 'Helvetica Neue', Arial, sans-serif";

  /* Product constants — must agree with the rest of the site. */
  var P0     = 48.00;
  var COST   = 19.00;
  var O_DAY  = 25.2;
  var DAYS   = 90;
  var BASE   = (P0 - COST) * O_DAY * DAYS;   /* 65,772 */

  /* End-of-period lift vs. the do-nothing baseline, as a fraction.
     LIFT_PF is the one number this section prints. */
  var LIFT_PF    =  0.11;    /* Priceflag            -> +11%   */
  var LIFT_SHEET =  0.026;   /* spreadsheet + gut    ->  +2.6% */

  /* Shape controls for the blind-A/B drawdown (dollars, and t in 0..1). */
  var AB_RISE      = 2289;   /* banked before the bad test          */
  var AB_DIP       = 4900;   /* depth of the bad test               */
  var AB_DIP_FROM  = 0.40;
  var AB_DIP_TO    = 0.72;
  var AB_SCAR      = 1500;   /* permanent loss left behind          */

  var NOISE_SHEET  = 820;    /* dollars of wobble on the gut-feel line */
  var NOISE_PF     = 0.030;  /* fraction of end value, as texture      */

  /* Motion. */
  var ANIM_MS  = 1150;       /* per-series draw-in                   */
  var STAGGER  = 80;         /* ms between series starts             */
  var TOTAL_MS = ANIM_MS + 3 * STAGGER;
  var WATCH_MS = 34;         /* watchdog cadence                     */
  var STARVED_MS = 90;       /* rAF considered starved after this    */

  /* Geometry. There is no axis any more, so the plot only needs enough
     padding to keep strokes and labels off the edges. */
  var DPR_CAP     = 2;
  var PAD_TOP     = 26;
  var PAD_BOTTOM  = 26;
  var PAD_LEFT    = 12;
  var LEADER      = 14;      /* gap between endpoint and label       */
  var EDGE_PAD    = 8;       /* keep labels off the right edge       */
  var ROW_GAP     = 6;       /* clear space between label rows       */
  var COMPACT_W   = 560;     /* below this the labels get smaller    */
  var STACK_W     = 430;     /* below this the winner's number wraps */
  var MIN_PLOT_W  = 108;     /* the lines must stay readable         */

  /* Label gutter budget, as a fraction of the canvas width. Narrow
     canvases give the labels less room, which is what forces the
     stacked / abbreviated variants in labelPlan(). */
  var GUT_MIN_FRAC = 0.32;
  var GUT_MAX_FRAC = 0.42;
  var GUT_W_LO     = 300;
  var GUT_W_HI     = 560;

  /* Plot box sizing. The height comes from the figure's OWN width, not
     from the viewport: a wide-but-short window (landscape phone) must
     still get a chart, not a letterbox slit. Viewport height only ever
     acts as a soft ceiling, and never below the aspect floor. */
  var ASPECT_MIN   = 1.02;   /* w:h at ASPECT_W_LO and narrower      */
  var ASPECT_MAX   = 1.62;   /* w:h at ASPECT_W_HI and wider         */
  var ASPECT_W_LO  = 300;
  var ASPECT_W_HI  = 1000;
  var ASPECT_LIMIT = 2.40;   /* widest the chart may ever get        */
  var H_VH_CAP     = 0.72;   /* soft ceiling from viewport height    */
  var H_MAX        = 620;
  var H_MIN        = 250;

  /* ------------------------------------------------------------------
     Deterministic value noise. Seeded and stable across reloads — the
     chart must never re-roll itself in front of a customer.
     ------------------------------------------------------------------ */

  function hash1(n) {
    var s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  }
  function vnoise(x) {
    var i = Math.floor(x), f = x - i;
    var u = f * f * (3 - 2 * f);
    var a = hash1(i) * 2 - 1, b = hash1(i + 1) * 2 - 1;
    return a * (1 - u) + b * u;
  }
  function fbm(x) {
    return vnoise(x) * 0.60 + vnoise(x * 2.13 + 7.7) * 0.30 + vnoise(x * 4.31 + 19.3) * 0.12;
  }
  function smoothstep(a, b, x) {
    if (b === a) return x < a ? 0 : 1;
    var t = (x - a) / (b - a);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return t * t * (3 - 2 * t);
  }
  /* Smooth 0->1->0 hump across [a,b], flat derivative at both ends. */
  function hump(x, a, b) {
    if (x <= a || x >= b) return 0;
    var s = (x - a) / (b - a);
    var v = Math.sin(Math.PI * s);
    return v * v;
  }
  /* Window that is exactly 0 at both ends, so noise never moves an
     endpoint away from its published value. */
  function endWindow(t) { return 4 * t * (1 - t); }

  /* ------------------------------------------------------------------
     Chart height.

     Driven by the FIGURE's own width, so the section keeps its shape
     inside any container on any device:

       ideal   = w / aspect(w)        aspect eases 1.02 -> 1.62
       ceiling = max(vh * 0.72, w / 2.40)
       h       = clamp(H_MIN, min(ideal, ceiling, H_MAX))

     The `w / 2.40` term is what saves landscape phones: a 770px-wide
     figure in a 390px-tall window would otherwise be squashed to ~280px
     by the viewport term alone, and keeps squashing as the window gets
     shorter. Here it can never go under a 2.4:1 box.
     ------------------------------------------------------------------ */
  function chartHeight(w, vh) {
    if (!(w > 0)) w = ASPECT_W_LO;
    if (!(vh > 0)) vh = 768;
    var aspect = ASPECT_MIN +
      (ASPECT_MAX - ASPECT_MIN) * smoothstep(ASPECT_W_LO, ASPECT_W_HI, w);
    var ideal = w / aspect;
    var ceiling = Math.max(vh * H_VH_CAP, w / ASPECT_LIMIT);
    var h = Math.min(ideal, ceiling, H_MAX);
    return Math.max(H_MIN, Math.round(h));
  }

  /* ------------------------------------------------------------------
     Series data. y = BASE + (profit banked against the do-nothing plan
     through day d). "Never change price" is therefore exactly flat.
     ------------------------------------------------------------------ */

  function deltaPriceflag(t) {
    var end = BASE * LIFT_PF;
    var shape = 0.18 * t + 0.82 * Math.pow(t, 2.1);      /* compounding */
    return end * shape + end * NOISE_PF * fbm(t * 6.5 + 1.3) * endWindow(t);
  }
  function deltaSheet(t) {
    var end = BASE * LIFT_SHEET;
    return end * t + NOISE_SHEET * fbm(t * 9 + 11) * endWindow(t);
  }
  function deltaBlindAB(t) {
    var v = AB_RISE * smoothstep(0, 0.33, t);
    v -= AB_DIP * hump(t, AB_DIP_FROM, AB_DIP_TO);
    v -= AB_SCAR * smoothstep(0.55, 0.86, t);
    v += 240 * fbm(t * 11 + 4.2) * endWindow(t);
    return v;
  }
  function deltaFlat() { return 0; }

  function buildPoints(fn) {
    var out = [], d;
    for (d = 0; d <= DAYS; d++) out.push(BASE + fn(d / DAYS));
    return out;
  }

  /* ------------------------------------------------------------------
     Formatting.
     ------------------------------------------------------------------ */

  function fmtMoney(v) {
    if (Math.abs(v) >= 1000) return '$' + (v / 1000).toFixed(1) + 'k';
    return '$' + Math.round(v);
  }
  function fmtFull(v) {
    var n = Math.round(v), s = String(Math.abs(n)), out = '', i;
    for (i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 === 0) out += ',';
      out += s.charAt(i);
    }
    return (n < 0 ? '-$' : '$') + out;
  }
  /* Whole percent: this section prints one number and it is not a place
     for a decimal point. */
  function fmtPct(frac) {
    var p = Math.round(frac * 100);
    if (p === 0) return 'flat';
    return (p > 0 ? '+' : '−') + Math.abs(p) + '%';
  }

  /* ------------------------------------------------------------------
     Vertical domain. It hugs the data with a little padding. There are
     no ticks and no labels: the shape of the lines is the argument.
     ------------------------------------------------------------------ */

  function axisDomain(min, max) {
    var span = Math.max(1, max - min);
    var pad = span * 0.12;
    return { lo: min - pad, hi: max + pad };
  }

  /* ------------------------------------------------------------------
     Canvas helpers (no filter — patchy, and the test harness stubs the
     2D context).
     ------------------------------------------------------------------ */

  function rgba(hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }

  /* ------------------------------------------------------------------
     Stylesheet. Injected once per document.
     ------------------------------------------------------------------ */

  var STYLE_ID = 'pfc-style';
  var CSS = [
    '.pfc{background:#030818;color:#f3ecde;position:relative;',
    '  font-family:' + SANS + ';-webkit-font-smoothing:antialiased;}',
    '.pfc *,.pfc *::before,.pfc *::after{box-sizing:border-box;}',
    '.pfc-inner{max-width:1180px;margin:0 auto;',
    '  padding:clamp(40px,6vh,80px) clamp(18px,4.4vw,64px) clamp(40px,7vh,90px);}',

    /* Layout is CONTAINER-driven, never viewport-driven. Two columns when
       the container can hold 280 + 460 + gap, one column when it cannot.
       A viewport media query here is what once collapsed the figure to
       zero width inside a narrow container — do not bring one back. */
    '.pfc-grid{display:flex;flex-wrap:wrap;align-items:center;gap:36px 56px;}',
    '.pfc-col{min-width:0;}',
    '.pfc-col--text{flex:1 1 280px;}',
    '.pfc-col--graph{flex:3 1 460px;}',

    /* ---- text column ---- */
    '.pfc-title{margin:0;font-family:\'Hedvig Letters Serif\',Georgia,Cambria,\'Times New Roman\',serif;',
    '  font-weight:400;font-size:clamp(34px,3.6vw,52px);line-height:1.1;letter-spacing:-0.015em;',
    '  color:#f3ecde;text-wrap:balance;}',
    '.pfc-sub{margin:16px 0 0;max-width:30ch;font-size:15px;line-height:1.6;letter-spacing:-0.005em;',
    '  color:rgba(243,236,222,0.62);text-wrap:pretty;}',

    /* ---- graph ---- */
    '.pfc-fig{margin:0;position:relative;width:100%;min-height:' + H_MIN + 'px;}',
    '.pfc-canvas{display:block;width:100%;height:100%;}'
  ].join('\n');

  function injectStyle(doc) {
    if (!doc || doc.getElementById(STYLE_ID)) return;
    var s = doc.createElement('style');
    s.id = STYLE_ID;
    s.type = 'text/css';
    s.appendChild(doc.createTextNode(CSS));
    (doc.head || doc.documentElement).appendChild(s);
  }

  /* ==================================================================
     initPfCompare
     ================================================================== */

  window.initPfCompare = function (root) {
    if (!root) throw new Error('initPfCompare: root element required');

    var doc = root.ownerDocument || document;
    var win = doc.defaultView || window;
    injectStyle(doc);

    /* ---------------- data ---------------- */

    /* `short` is the whole of a series' visible copy. Keep it short.
       `abbr` is the last-resort variant for the narrowest canvases; the
       brand name never abbreviates. */
    var SERIES = [
      { key: 'flat',  short: 'No change',   abbr: 'Flat',
        color: C.CREAM, alpha: 0.42, w: 1.2, dash: [4, 5],
        pts: buildPoints(deltaFlat), win: false },
      { key: 'ab',    short: 'Blind A/B',   abbr: 'A/B',
        color: C.BLUE_LINE, alpha: 1, w: 1.4, dash: null,
        pts: buildPoints(deltaBlindAB), win: false, floor: true },
      { key: 'sheet', short: 'Spreadsheet', abbr: 'Sheet',
        color: C.PERI, alpha: 1, w: 1.4, dash: null,
        pts: buildPoints(deltaSheet), win: false },
      { key: 'pf',    short: 'Priceflag',   abbr: 'Priceflag',
        color: C.NEON, alpha: 1, w: 2.2, dash: null,
        pts: buildPoints(deltaPriceflag), win: true }
    ];

    var i, s, lo = Infinity, hi = -Infinity;
    for (i = 0; i < SERIES.length; i++) {
      s = SERIES[i];
      s.hidden = false;
      s.end = s.pts[s.pts.length - 1];
      s.lift = (s.end - BASE) / BASE;
      /* No series prints a number. The curves are an illustration of the
         shape of each approach, not a measurement; the one figure that
         used to sit here (+11%) was a constant, and a constant is not a
         result. Measured numbers live in the deck and the simulation
         report, and they are labelled simulated. */
      s.tag = '';
      for (var j = 0; j < s.pts.length; j++) {
        if (s.pts[j] < lo) lo = s.pts[j];
        if (s.pts[j] > hi) hi = s.pts[j];
      }
    }
    var axis = axisDomain(lo, hi);

    function byKey(k) {
      for (var n = 0; n < SERIES.length; n++) if (SERIES[n].key === k) return SERIES[n];
      return null;
    }

    /* The canvas is aria-hidden, so this sentence is the chart for anyone
       who cannot see it. It stays plain and short for the same reason the
       visible section does. */
    var summary = 'Illustrative line chart of ninety days of profit under four pricing approaches. ' +
      'Priceflag ends highest, above never changing price. ' +
      'Spreadsheet and gut feel ends a little above it. ' +
      'Blind A/B tooling dips well below it mid-period, then recovers to roughly flat. ' +
      'Never changing price stays flat.';

    /* ---------------- DOM ---------------- */

    var el = function (tag, cls) {
      var n = doc.createElement(tag);
      if (cls) n.className = cls;
      return n;
    };
    var txt = function (node, str) { node.appendChild(doc.createTextNode(str)); return node; };

    var wrap = el('div', 'pfc');
    var inner = el('div', 'pfc-inner');
    var grid = el('div', 'pfc-grid');

    var colText = el('div', 'pfc-col pfc-col--text');
    var title = txt(el('h2', 'pfc-title'), 'Earn more with Priceflag.');
    var sub = txt(el('p', 'pfc-sub'), 'Ninety days. One store. Four ways to price it. An illustration of the shape, not a measurement.');

    colText.appendChild(title);
    colText.appendChild(sub);

    var colGraph = el('div', 'pfc-col pfc-col--graph');
    var fig = el('figure', 'pfc-fig');
    fig.setAttribute('role', 'img');
    fig.setAttribute('aria-label', summary);
    var canvas = el('canvas', 'pfc-canvas');
    canvas.setAttribute('aria-hidden', 'true');
    fig.appendChild(canvas);

    colGraph.appendChild(fig);

    grid.appendChild(colText);
    grid.appendChild(colGraph);
    inner.appendChild(grid);
    wrap.appendChild(inner);
    root.appendChild(wrap);

    /* ---------------- canvas state ---------------- */

    var ctx = canvas.getContext ? canvas.getContext('2d') : null;
    var cssW = 0, cssH = 0, dpr = 1;

    var started = false, finished = false, t0 = 0;
    var rafId = 0, watchId = 0, lastPaint = 0, frames = 0;
    var destroyed = false;

    var reduceMotion = false;
    var mq = null;
    if (win.matchMedia) {
      try {
        mq = win.matchMedia('(prefers-reduced-motion: reduce)');
        reduceMotion = !!mq.matches;
      } catch (e) { mq = null; }
    }

    function nowMs() {
      return (win.performance && win.performance.now) ? win.performance.now() : Date.now();
    }

    /* ---------------- layout maths ---------------- */

    /* Width of a string in a given weight/size, with a metric-free
       fallback for the stubbed 2D contexts used in tests. */
    function textW(str, weight, size) {
      if (ctx && ctx.measureText) {
        ctx.font = weight + ' ' + size + 'px ' + SANS;
        var m = ctx.measureText(str);
        if (m && m.width > 0) return m.width;
      }
      return str.length * size * (weight >= 600 ? 0.60 : 0.56);
    }

    /* Fraction of the canvas the label gutter may claim. Narrow canvases
       get a smaller share, which is what pushes labelPlan() onto its
       stacked / abbreviated variants instead of eating the plot. */
    function gutterFrac(w) {
      return GUT_MIN_FRAC +
        (GUT_MAX_FRAC - GUT_MIN_FRAC) * smoothstep(GUT_W_LO, GUT_W_HI, w);
    }

    /* Measure one label variant.
         short  — use `abbr` instead of `short`
         stack  — put the winner's number on its own line under the name
         scale  — font multiplier, used only when nothing else fits
       Returns per-series width/height plus the widest label. */
    function measureVariant(useAbbr, stack, baseName, baseTag, scale) {
      var nameSize = Math.round(baseName * scale * 10) / 10;
      var tagSize  = Math.round(baseTag * scale * 10) / 10;
      var gapX = Math.max(6, Math.round(9 * scale));
      var out = { abbr: useAbbr, stack: stack, nameSize: nameSize,
                  tagSize: tagSize, gapX: gapX, maxW: 0, items: [] };
      var n, ser, text, nw, tw, w, h;
      for (n = 0; n < SERIES.length; n++) {
        ser = SERIES[n];
        if (ser.hidden) continue;
        text = useAbbr ? (ser.abbr || ser.short) : ser.short;
        nw = textW(text, 500, nameSize);
        tw = ser.tag ? textW(ser.tag, 600, tagSize) : 0;
        if (ser.tag && stack) {
          w = Math.max(nw, tw);
          h = nameSize * 1.2 + tagSize * 1.2;
        } else if (ser.tag) {
          w = nw + gapX + tw;
          h = Math.max(nameSize, tagSize) * 1.25;
        } else {
          w = nw;
          h = nameSize * 1.35;
        }
        out.items.push({ ser: ser, text: text, w: w, h: h, nw: nw, tw: tw });
        if (w > out.maxW) out.maxW = w;
      }
      return out;
    }

    /* Pick the widest label variant that fits the gutter budget.
       Order matters: full words beat abbreviations, and stacking the one
       number beats shrinking the type. Only when all three variants
       overflow do the fonts scale down, and even then the returned plan
       is guaranteed to fit because the gutter is sized from it. */
    function labelPlan() {
      var compact = cssW < COMPACT_W;
      var baseName = compact ? 11 : 12.5;
      var baseTag  = compact ? 14 : 17;
      var budget = Math.max(40, cssW * gutterFrac(cssW) - LEADER - EDGE_PAD);

      var plan;
      /* On a phone-width canvas the number always wraps under the name,
         even when the one-line form would technically fit: it buys the
         plot ~60px and keeps every phone laid out the same way. */
      if (cssW >= STACK_W) {
        plan = measureVariant(false, false, baseName, baseTag, 1);
        if (plan.maxW <= budget) return plan;
      }
      plan = measureVariant(false, true, baseName, baseTag, 1);
      if (plan.maxW <= budget) return plan;
      plan = measureVariant(true, true, baseName, baseTag, 1);
      if (plan.maxW <= budget) return plan;

      var scale = plan.maxW > 0 ? budget / plan.maxW : 1;
      if (scale > 1) scale = 1;
      if (scale < 0.62) scale = 0.62;
      return measureVariant(true, true, baseName, baseTag, scale);
    }

    function geometry() {
      var plan = labelPlan();
      var gutter = plan.maxW + LEADER + EDGE_PAD;
      var L = PAD_LEFT, R = cssW - gutter;
      var T = PAD_TOP, B = cssH - PAD_BOTTOM;
      /* The plot never disappears; if the canvas is so small that even a
         scaled-down gutter would swallow it, the labels give way and are
         clamped back inside by drawLabel(). */
      if (R < L + MIN_PLOT_W) R = Math.min(L + MIN_PLOT_W, cssW - LEADER - 12);
      if (R < L + 40) R = L + 40;
      if (B < T + 40) B = T + 40;
      return { L: L, R: R, T: T, B: B, W: R - L, H: B - T,
               plan: plan, nameSize: plan.nameSize, tagSize: plan.tagSize };
    }

    function yOf(g, v) {
      return g.B - ((v - axis.lo) / (axis.hi - axis.lo)) * g.H;
    }
    function xOf(g, d) {
      return g.L + (d / DAYS) * g.W;
    }

    /* Per-series eased progress at a given elapsed time. */
    function seriesProgress(idx, elapsed) {
      if (reduceMotion) return 1;
      var t = (elapsed - idx * STAGGER) / ANIM_MS;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      return easeOutQuart(t);
    }

    function currentElapsed() {
      if (!started || reduceMotion) return started ? TOTAL_MS : 0;
      if (finished) return TOTAL_MS;
      var e = nowMs() - t0;
      return e < 0 ? 0 : e > TOTAL_MS ? TOTAL_MS : e;
    }

    /* ---------------- painting ----------------
       draw() has exactly one exit condition (no context / zero size) and
       in every other case it clears AND repaints the whole frame. It must
       never leave a cleared canvas behind. */

    function draw(elapsed) {
      if (!ctx || cssW <= 0 || cssH <= 0) return false;
      var g = geometry(), n, ser, k;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.fillStyle = C.BG;
      ctx.fillRect(0, 0, cssW, cssH);

      /* No grid, no ticks, no numeric axis. The only reference line is the
         "No change" series itself, which is flat at the baseline. */
      var yBase = yOf(g, BASE);

      /* --- series --- */
      var rows = [];
      for (n = 0; n < SERIES.length; n++) {
        ser = SERIES[n];
        if (ser.hidden) continue;
        var q = seriesProgress(n, elapsed);
        if (q <= 0) continue;

        var dim = 1;
        var a = ser.alpha;

        /* path up to the revealed day, with a lerped final segment */
        var last = q * DAYS;
        var iLast = Math.floor(last);
        var path = [];
        for (k = 0; k <= iLast; k++) path.push([xOf(g, k), yOf(g, ser.pts[k])]);
        if (iLast < DAYS) {
          var f = last - iLast;
          var v0 = ser.pts[iLast], v1 = ser.pts[iLast + 1];
          path.push([xOf(g, iLast + f), yOf(g, v0 + (v1 - v0) * f)]);
        }
        var endX = path[path.length - 1][0];
        var endY = path[path.length - 1][1];

        /* The cost of a bad test: shade only the area where this line
           has fallen underneath the do-nothing baseline. Clipping to the
           sub-baseline band means the polygon above it simply vanishes. */
        if (ser.floor && path.length > 1 && ctx.clip && g.B > yBase) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(g.L, yBase, g.W, g.B - yBase);
          ctx.clip();
          ctx.beginPath();
          ctx.moveTo(path[0][0], yBase);
          for (k = 0; k < path.length; k++) ctx.lineTo(path[k][0], path[k][1]);
          ctx.lineTo(endX, yBase);
          ctx.closePath();
          ctx.fillStyle = rgba(ser.color, 0.17 * dim);
          ctx.fill();
          ctx.restore();
        }

        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = ser.w;
        ctx.strokeStyle = rgba(ser.color, a);
        if (ser.dash && ctx.setLineDash) ctx.setLineDash(ser.dash);
        if (ser.win) {
          ctx.shadowColor = rgba(ser.color, 0.30 * dim);
          ctx.shadowBlur = 14;
        }
        ctx.beginPath();
        ctx.moveTo(path[0][0], path[0][1]);
        for (k = 1; k < path.length; k++) ctx.lineTo(path[k][0], path[k][1]);
        ctx.stroke();
        ctx.restore();

        /* endpoint dot */
        ctx.save();
        ctx.fillStyle = rgba(ser.color, a);
        ctx.beginPath();
        ctx.arc(endX, endY, ser.win ? 3.4 : 2.6, 0, Math.PI * 2);
        ctx.fill();
        if (ser.win) {
          ctx.strokeStyle = rgba(ser.color, 0.28 * dim);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(endX, endY, 7.5, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();

        var item = planItem(g, ser);
        rows.push({
          ser: ser,
          item: item,
          h: item ? item.h : 16,
          y: yOf(g, ser.pts[DAYS]),
          alpha: Math.max(0, Math.min(1, (q - 0.68) / 0.32))
        });
      }

      placeRows(g, rows);

      for (n = 0; n < rows.length; n++) {
        if (rows[n].alpha <= 0.001) continue;
        drawLabel(ctx, g, rows[n]);
      }

      lastPaint = nowMs();
      return true;
    }

    /* Endpoint labels are pushed apart so they can never overlap. Rows
       have different heights (the winner stacks its number on a second
       line when the canvas is narrow), so the dodge works on half-heights
       rather than one fixed row pitch. */
    function placeRows(g, rows) {
      var n;
      rows.sort(function (a, b) { return a.y - b.y; });
      for (n = 0; n < rows.length; n++) {
        if (n === 0) { rows[n].cy = rows[n].y; continue; }
        rows[n].cy = Math.max(
          rows[n].y,
          rows[n - 1].cy + (rows[n - 1].h + rows[n].h) / 2 + ROW_GAP
        );
      }
      /* clamp inside the plot, then relax upward if we ran off the bottom */
      var lastRow = rows.length ? rows[rows.length - 1] : null;
      var overflow = lastRow ? (lastRow.cy + lastRow.h / 2) - g.B : 0;
      if (overflow > 0) for (n = 0; n < rows.length; n++) rows[n].cy -= overflow;
      if (rows.length && rows[0].cy - rows[0].h / 2 < g.T) {
        var shift = g.T - (rows[0].cy - rows[0].h / 2);
        for (n = 0; n < rows.length; n++) rows[n].cy += shift;
      }
      return rows;
    }

    function planItem(g, ser) {
      var items = g.plan.items, n;
      for (n = 0; n < items.length; n++) if (items[n].ser === ser) return items[n];
      return null;
    }

    /* Box a label occupies, in CSS pixels. Exported through labelBoxes()
       so the layout can be asserted at every viewport size. */
    function labelBox(g, row) {
      var item = row.item;
      var w = item ? item.w : 0;
      var x = Math.min(g.R + LEADER, Math.max(g.R + 4, cssW - EDGE_PAD - w));
      return { x: x, y: row.cy - row.h / 2, w: w, h: row.h,
               text: item ? item.text : '', key: row.ser.key };
    }

    /* A label is text and nothing else: no box, no glyph, no dollar value.
       The winner's label carries the one number in the section. On narrow
       canvases that number sits on a second line under the name, which is
       what keeps the gutter — and therefore the plot — a sane width. */
    function drawLabel(ctx2, g, row) {
      var ser = row.ser;
      var item = row.item;
      var box = labelBox(g, row);
      var x = box.x;

      ctx2.save();
      ctx2.globalAlpha = row.alpha;

      /* hairline leader from the endpoint across to the label */
      ctx2.strokeStyle = rgba(ser.color, ser.alpha * 0.34);
      ctx2.lineWidth = 1;
      if (ctx2.setLineDash) ctx2.setLineDash([]);
      ctx2.beginPath();
      ctx2.moveTo(g.R + 3, row.y);
      ctx2.lineTo(g.R + LEADER - 6, row.y);
      ctx2.lineTo(g.R + LEADER - 3, row.cy);
      ctx2.lineTo(x, row.cy);
      ctx2.stroke();

      ctx2.textBaseline = 'middle';
      ctx2.textAlign = 'left';

      var stacked = !!(ser.tag && g.plan.stack);
      var nameY = stacked ? box.y + g.nameSize * 1.2 / 2 : row.cy;

      ctx2.font = '500 ' + g.nameSize + 'px ' + SANS;
      ctx2.fillStyle = ser.win ? rgba(C.NEON, 1) : rgba(C.CREAM, 0.66);
      ctx2.fillText(item ? item.text : ser.short, x, nameY + 0.5);

      if (ser.tag) {
        ctx2.font = '600 ' + g.tagSize + 'px ' + SANS;
        ctx2.fillStyle = rgba(C.NEON, 1);
        if (stacked) {
          ctx2.fillText(ser.tag, x, box.y + g.nameSize * 1.2 + g.tagSize * 1.2 / 2 + 0.5);
        } else {
          ctx2.fillText(ser.tag, x + (item ? item.nw : 60) + g.plan.gapX, row.cy + 0.5);
        }
      }
      ctx2.restore();
    }

    /* Where every label ends up at full progress. Used by the responsive
       test harness to assert that nothing overlaps and nothing escapes
       the canvas; cheap enough to be harmless in production. */
    function measureLayout() {
      var g = geometry(), rows = [], n, ser, item, boxes = [];
      for (n = 0; n < SERIES.length; n++) {
        ser = SERIES[n];
        if (ser.hidden) continue;
        item = planItem(g, ser);
        rows.push({ ser: ser, item: item, h: item ? item.h : 16,
                    y: yOf(g, ser.pts[DAYS]), alpha: 1 });
      }
      placeRows(g, rows);
      for (n = 0; n < rows.length; n++) boxes.push(labelBox(g, rows[n]));
      return {
        cssW: cssW, cssH: cssH, dpr: dpr,
        canvasW: canvas.width, canvasH: canvas.height,
        plot: { L: g.L, R: g.R, T: g.T, B: g.B, W: g.W, H: g.H },
        plan: { abbr: g.plan.abbr, stack: g.plan.stack,
                nameSize: g.plan.nameSize, tagSize: g.plan.tagSize },
        boxes: boxes
      };
    }

    /* Paint whatever the current state is. Used by resize, toggles,
       hover, visibility changes — anything that must not leave the
       canvas blank. */
    function repaint() {
      return draw(currentElapsed());
    }

    /* ---------------- sizing ---------------- */

    var lastAppliedH = -1;
    var lastW = -1, lastVW = -1, lastVH = -1, lastDpr = -1;
    function resize() {
      if (destroyed) return;
      var vh = win.innerHeight || doc.documentElement.clientHeight || 768;

      /* Width comes from the figure itself, so a narrow container inside
         a wide window is handled correctly. Height is derived from that
         width (see chartHeight) with the viewport only as a soft cap. */
      var w = fig.clientWidth || colGraph.clientWidth || 0;
      var h = chartHeight(w, vh);

      /* Only touch the DOM when the value actually changes — the
         ResizeObserver watches an ancestor and we must not feed it. */
      if (h !== lastAppliedH) {
        lastAppliedH = h;
        fig.style.height = h + 'px';
      }

      cssW = w || fig.clientWidth || 0;
      cssH = h;
      dpr = Math.min(win.devicePixelRatio || 1, DPR_CAP);

      lastW = cssW;
      lastVW = win.innerWidth || doc.documentElement.clientWidth || 0;
      lastVH = vh;
      lastDpr = dpr;

      if (cssW > 0 && cssH > 0) {
        var bw = Math.max(1, Math.round(cssW * dpr));
        var bh = Math.max(1, Math.round(cssH * dpr));
        /* Assigning width/height blanks the backing store, so a repaint
           on the very next line is mandatory. */
        if (canvas.width !== bw) canvas.width = bw;
        if (canvas.height !== bh) canvas.height = bh;
      }
      /* Always repaint. No branch may return from resize() unpainted. */
      repaint();
    }

    /* ---------------- animation ---------------- */

    function stopWatch() {
      if (watchId) { win.clearInterval(watchId); watchId = 0; }
    }
    function startWatch() {
      if (watchId || destroyed) return;
      watchId = win.setInterval(function () {
        if (destroyed || !started || finished) { stopWatch(); return; }
        /* Stand down while real rAF frames are landing. */
        if (nowMs() - lastPaint <= STARVED_MS) return;
        step();
      }, WATCH_MS);
    }

    function step() {
      if (destroyed) return;
      /* The watchdog can enter here while a starved rAF is still queued;
         drop that handle so we never stack callbacks. */
      if (rafId && win.cancelAnimationFrame) win.cancelAnimationFrame(rafId);
      rafId = 0;

      var e = currentElapsed();
      draw(e);
      if (e >= TOTAL_MS) {
        finished = true;
        stopWatch();
        return;
      }
      schedule();
    }

    function schedule() {
      if (destroyed || finished || rafId) return;
      if (win.requestAnimationFrame) {
        rafId = win.requestAnimationFrame(function () { rafId = 0; frames++; step(); });
      }
      startWatch();
    }

    function play() {
      if (started || destroyed) return;
      started = true;
      t0 = nowMs();
      if (reduceMotion) {
        finished = true;
        repaint();            /* final state immediately, no animation */
        return;
      }
      draw(0);                /* one painted frame before any rAF exists */
      schedule();
    }

    /* ---------------- environment ---------------- */

    /* A tab that comes back may have been rotated while it was away, so
       this re-measures rather than only repainting. */
    function onVisibility() { resize(); }
    doc.addEventListener('visibilitychange', onVisibility);
    win.addEventListener('pageshow', onVisibility);

    /* iOS reports the OLD viewport during orientationchange, so re-run
       shortly afterwards as well. resize() is idempotent and only touches
       the DOM when a number actually changed. */
    var rotateId = 0;
    function onWinResize() { resize(); }
    function onRotate() {
      resize();
      win.clearTimeout(rotateId);
      rotateId = win.setTimeout(function () { resize(); }, 260);
    }
    win.addEventListener('resize', onWinResize);
    win.addEventListener('orientationchange', onRotate);

    var so = null;
    if (win.screen && win.screen.orientation && win.screen.orientation.addEventListener) {
      try {
        so = win.screen.orientation;
        so.addEventListener('change', onRotate);
      } catch (e) { so = null; }
    }

    var ro = null;
    if (win.ResizeObserver) {
      /* Observe the column, not the figure: the figure's height is
         written by resize(), and observing it would loop. */
      ro = new win.ResizeObserver(function () { resize(); });
      ro.observe(colGraph);
    }

    /* ResizeObserver does not fire in a document that stays hidden, and a
       container can change width without the window resizing at all, so
       a cheap poll backs it up. It compares numbers and calls resize()
       only when one moved, so it never feeds the observer. */
    var pollId = win.setInterval(function () {
      if (destroyed) return;
      var w = fig.clientWidth || colGraph.clientWidth || 0;
      var vw = win.innerWidth || doc.documentElement.clientWidth || 0;
      var vh = win.innerHeight || doc.documentElement.clientHeight || 0;
      var d = Math.min(win.devicePixelRatio || 1, DPR_CAP);
      if (w !== lastW || vw !== lastVW || vh !== lastVH || d !== lastDpr) resize();
    }, 250);

    function onMQ() {
      reduceMotion = !!(mq && mq.matches);
      if (reduceMotion) { finished = true; stopWatch(); }
      repaint();
    }
    if (mq) {
      if (mq.addEventListener) mq.addEventListener('change', onMQ);
      else if (mq.addListener) mq.addListener(onMQ);
    }

    var io = null;
    if (win.IntersectionObserver) {
      io = new win.IntersectionObserver(function (entries) {
        for (var n = 0; n < entries.length; n++) {
          if (entries[n].isIntersecting) {
            play();
            if (io) { io.disconnect(); io = null; }
            break;
          }
        }
      }, { threshold: 0.22 });
      io.observe(wrap);
    }

    /* First paint happens now, before anything is observed. */
    resize();

    /* Safety nets: never let the section sit un-animated because rAF,
       IO or a hidden document conspired against it. */
    if (!io || reduceMotion) play();
    var fallbackId = win.setTimeout(function () {
      if (!started) play();
      else repaint();
    }, 2600);

    /* ---------------- cleanup ---------------- */

    function cleanup() {
      if (destroyed) return;
      destroyed = true;
      if (rafId && win.cancelAnimationFrame) win.cancelAnimationFrame(rafId);
      rafId = 0;
      stopWatch();
      win.clearTimeout(fallbackId);
      win.clearTimeout(rotateId);
      win.clearInterval(pollId);
      if (io) { io.disconnect(); io = null; }
      if (ro) { ro.disconnect(); ro = null; }
      if (so) {
        if (so.removeEventListener) so.removeEventListener('change', onRotate);
        so = null;
      }
      if (mq) {
        if (mq.removeEventListener) mq.removeEventListener('change', onMQ);
        else if (mq.removeListener) mq.removeListener(onMQ);
      }
      doc.removeEventListener('visibilitychange', onVisibility);
      win.removeEventListener('pageshow', onVisibility);
      win.removeEventListener('resize', onWinResize);
      win.removeEventListener('orientationchange', onRotate);
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }

    /* Layout probe for the responsive test harness. Non-enumerable, so
       cleanup() is still just a function as far as callers are concerned. */
    try {
      Object.defineProperty(cleanup, '_layout', {
        value: function () { resize(); return measureLayout(); },
        enumerable: false
      });
    } catch (e) { /* ignore */ }

    return cleanup;
  };

  /* Test hook — non-enumerable so it does not read as a second global
     surface, and harmless in production. */
  try {
    Object.defineProperty(window.initPfCompare, '_internals', {
      value: {
        BASE: BASE, DAYS: DAYS,
        deltaPriceflag: deltaPriceflag,
        deltaSheet: deltaSheet,
        deltaBlindAB: deltaBlindAB,
        fmtMoney: fmtMoney, fmtPct: fmtPct, fmtFull: fmtFull,
        axisDomain: axisDomain, chartHeight: chartHeight
      },
      enumerable: false
    });
  } catch (e) { /* frozen function objects: ignore */ }
})();
