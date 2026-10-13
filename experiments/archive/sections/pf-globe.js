/* ==========================================================================
   pf-globe.js — "Measured worldwide": a slow wireframe globe paired with a
   revenue counter.

   Contract
   --------
     var cleanup = window.initPfGlobe(root);   // root: element or selector
     cleanup();                                 // tears everything down

   The module builds every node it needs inside `root`, injects one <style>
   the first time it runs, and owns no markup it did not create. Every
   selector is prefixed `.pfg-`. Zero dependencies.

   The pairing is the point: each time the counter takes a step, a point of
   light pulses somewhere on the sphere, as though a price change just landed
   in a store. Neon is spent only on that "just now" event; everything else is
   periwinkle and cream at low alpha.

   PAINT DISCIPLINE (read before editing the loop)
   -----------------------------------------------
   This page can run with `document.hidden === true`, which starves
   requestAnimationFrame indefinitely. A sibling module once shipped as a
   permanently black canvas because its play() returned early while hidden,
   after resize() had already cleared the bitmap. Therefore:

     * render() fills the background before any early return, so a call can
       never leave an unpainted bitmap behind.
     * resize() ends in an unconditional render(). Assigning canvas.width
       clears the canvas; nothing may come between that and a paint.
     * play() paints one frame FIRST, then decides whether to schedule rAF.
       There is no code path that returns from play() without painting.
     * A watchdog interval drives the clock when rAF is starved, and stands
       down on its own as soon as real frames start arriving.

   LAYOUT DISCIPLINE
   -----------------
   Layout is decided in JS from the section's own box, never from a device
   guess and never from a viewport media query. applyLayout() reads the
   section's layout width and the viewport height, derives one aspect ratio
   from them, and picks `row` (copy beside globe) or `col` (stacked). Every
   size that matters — padding, gap, globe diameter, headline and figure type
   — is written out as a px custom property, so a wide-but-short landscape
   phone provably fits instead of hoping a clamp() lands well.

   The same starvation that kills rAF also kills ResizeObserver, so the
   watchdog additionally polls for size drift and re-lays-out on its own.
   ========================================================================== */

(function () {
  'use strict';

  /* ==========================================================================
     TUNING — every meaningful knob lives here.
     ========================================================================== */
  var T = {
    /* ---- palette (site design system) ---- */
    BG:     '#030818',
    CREAM:  '243,236,222',
    PERI:   '147,170,255',
    NEON:   '216,242,75',

    /* ---- copy ----
       The globe plus one number is the whole idea. LABEL is the section
       eyebrow, HEAD the single headline, AND the one small line under the
       figure. There is deliberately nothing else. */
    LABEL:  'Measured worldwide',
    HEAD:   'Revenue increased by Priceflag',
    AND:    'and counting',

    /* ---- the number ----
       An exact, unrounded figure: $1,342. It is small enough to render in
       full, so there is no abbreviation anywhere — the counter races from $0
       to the real number and lands on it. */
    TARGET:      1342,      // headline figure in dollars -> renders as $1,342
    COUNT_S:     2.0,       // ease-up duration once the section is in view
    COUNT_POW:   3.2,       // easeOut exponent; higher = harder landing
    /* During the ease-up a light pulses every time the figure clears another
       PULSE_EVERY dollars — 13 pulses for $1,342, front-loaded by the easing,
       so the flurry decays into the resting cadence on its own. */
    PULSE_EVERY: 100,
    /* Live accrual AFTER the landing. At $4.24M a fast ticker was invisible
       inside the rounding; on an exact $1,342 it would read as a bug, so the
       figure creeps by a single dollar every ~15s. Rare enough that a reader
       sees one happen rather than watching a digit spin, and each one still
       lights its neon point — the pulse/tick pairing survives intact. */
    DRIFT_MIN:   11,        // seconds between live $1 ticks, min
    DRIFT_MAX:   19,        // …and max
    DRIFT_STEP:  1,         // dollars per live tick

    /* ---- globe geometry ---- */
    MAX_DPR:        2,
    EDGE_PAD:       0.13,   // fraction of the box left clear around the limb
    FALLBACK_SIZE:  420,    // css px, used only if the stage cannot be measured
    MAX_STAGE:      900,    // css px ceiling; see measure() for why this exists
    TILT:           0.38,   // axial tilt, radians (~22deg)
    SPIN_S:         80,     // seconds per revolution
    STATIC_SPIN:    0.9,    // frozen pose for prefers-reduced-motion, radians

    MERIDIAN_STEP:  30,     // degrees between meridians
    PARALLEL_STEP:  15,     // degrees between parallels
    PARALLEL_CAP:   75,     // highest/lowest parallel drawn
    LINE_SAMPLE:    5,      // degrees between samples along a graticule line
    DEPTH_BANDS:    5,      // depth-fade quantisation for the graticule strokes

    GRAT_A:         0.30,   // graticule peak alpha
    LIMB_A:         0.26,   // limb ring alpha
    DOTS:           620,    // fibonacci dot field count
    DOT_A:          0.34,   // dot field alpha at the front pole
    DOT_R:          1.9,    // dot sprite radius in css px, at REF_R
    DOT_BACK_A:     0.30,   // …alpha multiplier at the far pole (see note below)
    DOT_BACK_SZ:    0.60,   // …and size multiplier there
    /* Deterministic scatter that breaks the fibonacci spiral arms. Measured
       on nearest-neighbour spread: the raw lattice sits at CV 0.04 (which is
       what aliases), these values give CV 0.29 with a 6.7px minimum spacing
       at the 422px design size — scattered, but never clumping into blobs.
       Past ~0.5 radians of longitude jitter the minimum collapses to ~2px
       and the dots start to merge. */
    DOT_JITTER_Y:   1.0,    // in units of the y band
    DOT_JITTER_TH:  0.30,   // …and in radians of longitude
    SPRITE_PX:      36,     // offscreen sprite resolution
    SITE_A:         0.42,   // resting store-marker alpha
    HALO_A:         0.085,  // soft periwinkle bloom behind the sphere

    /* ---- events on the surface ---- */
    PULSE_S:        1.5,    // pulse lifetime, seconds
    PULSE_R0:       2.5,    // ring start radius, at REF_R
    PULSE_R1:       34,     // ring end radius, at REF_R
    REF_R:          210,    // radius the pixel constants above are authored at
    EVENT_MIN_Z:    0.18,   // events spawn on sites at least this far front-facing
    AMBIENT_MIN:    1.6,    // seconds between ambient (non-counter) pulses
    AMBIENT_MAX:    4.2,
    BURST_MAX:      6,      // pulses spawned per frame cap, so a long stall
                            // cannot dump the whole ease-up at once

    ARC_MIN:        2.4,    // seconds between ambient arcs
    ARC_MAX:        6.0,
    ARC_S:          2.6,    // arc lifetime, seconds
    ARC_LIFT:       0.16,   // how far the arc bulges off the surface
    ARC_TAIL:       0.34,   // length of the visible travelling segment
    ARC_SAMPLE:     42,     // points sampled along an arc

    /* ---- responsive layout ----
       All decisions come from ONE number: the section's own content width
       divided by the height of the viewport it sits in. That ratio is what
       "landscape phone" and "portrait tablet" actually mean; a device guess
       is not needed and would be wrong on a resized desktop window anyway.

       Section height is deliberately NOT used as the denominator: the section
       is as tall as its own content, so stacking makes it taller, which would
       make it look "portrait", which would keep it stacked — a latch, not a
       measurement. Viewport height is the stable signal. */
    INNER_MAX:      1180,   // css px; must match .pfg-inner max-width
    /* 420 rather than something rounder: the smallest phone in landscape
       (568x320) leaves 511px of content width, and stacking a 320px-tall
       viewport would push the globe entirely below the fold. Two columns at
       420px still leave the copy ~216px, which fits "$1,342" with slack. */
    ROW_MIN_W:      420,    // below this content width, always stack
    ROW_WIDE_W:     1000,   // at/above this width, row regardless of height
    ROW_RATIO:      1.0,    // width/viewport-height at/above which we go row
    SHORT_VH:       560,    // viewport heights under this are "short"
    MIN_STAGE:      168,    // css px floor for the globe
    LAY_EPS:        2,      // px of drift the watchdog tolerates before relayout

    /* ---- loop ---- */
    MAX_DT:         0.25,   // seconds; clamps the jump after a long stall
    WATCHDOG_MS:    250,    // rAF-starvation heartbeat
    IN_VIEW_FRAC:   0.25    // fraction of the section on screen to count as "in view"
  };

  /* Store markers. Real-ish coordinates so the scatter reads as commerce
     rather than noise; they are also the anchors for every pulse and arc. */
  var SITES = [
    [51.51, -0.13], [52.52, 13.40], [59.33, 18.07], [40.42, -3.70],
    [48.86, 2.35], [40.71, -74.01], [41.88, -87.63], [37.77, -122.42],
    [43.65, -79.38], [19.43, -99.13], [-23.55, -46.63], [-34.60, -58.38],
    [6.52, 3.38], [-33.92, 18.42], [25.20, 55.27], [19.08, 72.88],
    [1.35, 103.82], [35.68, 139.69], [37.57, 126.98], [-33.87, 151.21],
    [-36.85, 174.76], [13.76, 100.50]
  ];

  var STYLE_ID  = 'pfg-style';
  var TAU       = Math.PI * 2;
  var DEG       = Math.PI / 180;
  var instances = 0;

  /* ==========================================================================
     Stylesheet — injected once per document.
     ========================================================================== */
  /* Every layout number below is a custom property that applyLayout()
     overwrites with a measured px value. The clamp()s are the pre-measurement
     defaults only — they render sensibly on their own, but the moment the
     module initialises, JS owns them. Base state is the SAFE one (stacked);
     `.pfg-row` is the opt-in. */
  var CSS = [
    '.pfg-root{position:relative;box-sizing:border-box;width:100%;background:' + T.BG + ';',
    'color:#f3ecde;-webkit-font-smoothing:antialiased;',
    "font-family:'Inter',system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif;",
    '--pfg-pad-x:clamp(20px,5vw,72px);--pfg-pad-y:clamp(56px,10vw,148px);',
    '--pfg-gap:clamp(38px,6vw,92px);--pfg-stage:min(78vw,380px);',
    '--pfg-head:clamp(24px,4.1vw,46px);--pfg-amount:clamp(44px,9.4vw,124px);',
    '--pfg-lead:clamp(18px,3vw,36px);--pfg-fig:clamp(14px,2.4vw,30px);',
    'padding:var(--pfg-pad-y) var(--pfg-pad-x);}',
    '.pfg-root *{box-sizing:border-box;}',

    '.pfg-inner{max-width:' + T.INNER_MAX + 'px;margin:0 auto;display:grid;',
    'grid-template-columns:minmax(0,1fr);align-items:center;gap:var(--pfg-gap);}',
    '.pfg-row .pfg-inner{grid-template-columns:minmax(0,1fr) auto;}',

    '.pfg-copy{min-width:0;}',

    '.pfg-label{margin:0 0 var(--pfg-lead);display:flex;align-items:center;gap:10px;',
    'font-size:11px;font-weight:500;line-height:1;letter-spacing:.2em;',
    'text-transform:uppercase;color:#93aaff;}',
    '.pfg-dot{width:5px;height:5px;border-radius:50%;background:#d8f24b;',
    'box-shadow:0 0 10px rgba(216,242,75,.85);flex:0 0 auto;}',

    ".pfg-head{margin:0;font-family:'Hedvig Letters Serif',Georgia,'Times New Roman',serif;",
    'font-weight:400;font-size:var(--pfg-head);line-height:1.14;',
    'letter-spacing:-.012em;color:#f3ecde;max-width:20ch;}',
    '.pfg-row .pfg-head{max-width:15ch;}',

    '.pfg-figure{display:block;margin:var(--pfg-fig) 0 0;}',
    /* nowrap: the figure grows from "$0" to "$1,342" as it counts, and must
       never be allowed to break across two lines mid-race. */
    '.pfg-amount{display:block;white-space:nowrap;font-weight:600;color:#d8f24b;',
    'font-size:var(--pfg-amount);line-height:.92;letter-spacing:-.042em;',
    'font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1;',
    'text-shadow:0 0 38px rgba(216,242,75,.20);}',

    '.pfg-tick{display:block;margin-top:calc(var(--pfg-fig) * .6);',
    'opacity:0;transform:translateY(5px);',
    'transition:opacity .8s ease,transform .8s cubic-bezier(.22,1,.36,1);}',
    '.pfg-tick.pfg-on{opacity:1;transform:none;}',
    '.pfg-and{font-size:11px;font-weight:500;letter-spacing:.16em;',
    'text-transform:uppercase;color:#93aaff;opacity:.72;}',

    /* Width AND height are both set: aspect-ratio alone leaves the box at
       zero height on engines that do not support it, which would starve the
       canvas measurement. */
    '.pfg-stage{position:relative;flex:0 0 auto;',
    'width:var(--pfg-stage);height:var(--pfg-stage);aspect-ratio:1/1;line-height:0;}',
    '.pfg-col .pfg-stage{margin:0 auto;}',
    '.pfg-canvas{position:absolute;top:0;left:0;width:100%;height:100%;display:block;}',

    '.pfg-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;',
    'overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;}',

    '@media (prefers-reduced-motion: reduce){',
    '.pfg-tick{transition:none;}',
    '}'
  ].join('');

  function injectStyle(doc) {
    if (doc.getElementById(STYLE_ID)) return;
    var s = doc.createElement('style');
    s.id = STYLE_ID;
    s.appendChild(doc.createTextNode(CSS));
    (doc.head || doc.documentElement).appendChild(s);
  }

  /* ==========================================================================
     Small helpers
     ========================================================================== */
  function sph(latDeg, lonDeg) {
    var la = latDeg * DEG, lo = lonDeg * DEG, cl = Math.cos(la);
    return [cl * Math.sin(lo), Math.sin(la), cl * Math.cos(lo)];
  }

  /* Exact money, always in full, always with a thousands separator: the
     figure is $1,342, not $1.3K and not $0.00M. Truncated rather than
     rounded, so the running value can never briefly overshoot the target. */
  function money(v) {
    if (!(v > 0)) v = 0;
    var s = String(Math.floor(v));
    return '$' + s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function rand(a, b) { return a + Math.random() * (b - a); }

  function clampN(lo, v, hi) {
    if (!(v > lo)) return lo;
    return v > hi ? hi : v;
  }

  /* Deterministic 0..1 hash — the dot field must look identical on every
     load, so it cannot use Math.random. */
  function hash(n) {
    var x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  /* ==========================================================================
     initPfGlobe
     ========================================================================== */
  window.initPfGlobe = function (root) {
    /* ---- resolve the mount ------------------------------------------- */
    var doc = (root && root.ownerDocument) || document;
    if (typeof root === 'string') root = doc.querySelector(root);
    if (!root || !root.appendChild) root = doc.body;

    var win = doc.defaultView || window;
    injectStyle(doc);
    instances++;

    /* ---- DOM --------------------------------------------------------- */
    function el(tag, cls, parent) {
      var n = doc.createElement(tag);
      if (cls) n.className = cls;
      if (parent) parent.appendChild(n);
      return n;
    }

    var section = el('section', 'pfg-root');
    var inner   = el('div', 'pfg-inner', section);
    var copy    = el('div', 'pfg-copy', inner);

    var label = el('p', 'pfg-label', copy);
    el('span', 'pfg-dot', label);
    label.appendChild(doc.createTextNode(T.LABEL));

    var head = el('h2', 'pfg-head', copy);
    head.appendChild(doc.createTextNode(T.HEAD));

    /* The figure is one polite live region. Everything animated inside it is
       aria-hidden; the single announcement is the .pfg-sr text, written once
       when the count settles, so a screen reader is never spammed. */
    var figure = el('p', 'pfg-figure', copy);
    figure.setAttribute('aria-live', 'polite');
    figure.setAttribute('aria-atomic', 'true');

    var amount = el('span', 'pfg-amount', figure);
    amount.setAttribute('aria-hidden', 'true');

    var tickRow = el('span', 'pfg-tick', figure);
    tickRow.setAttribute('aria-hidden', 'true');
    var andEl = el('span', 'pfg-and', tickRow);
    andEl.appendChild(doc.createTextNode(T.AND));

    var srEl = el('span', 'pfg-sr', figure);

    var stage = el('div', 'pfg-stage', inner);
    var cvs   = el('canvas', 'pfg-canvas', stage);
    cvs.setAttribute('aria-hidden', 'true');
    cvs.setAttribute('role', 'presentation');

    root.appendChild(section);

    var ctx = null;
    try { ctx = cvs.getContext('2d'); } catch (e) { ctx = null; }

    /* ---- reduced motion ---------------------------------------------- */
    var mq = null, reduce = false;
    try {
      mq = win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)');
      reduce = !!(mq && mq.matches);
    } catch (e2) { mq = null; }

    /* ==========================================================================
       Geometry — built once, in unit-sphere space, then rotated per frame.
       ========================================================================== */
    var lineXYZ, lineIdx = [], linePts = 0;
    var dotXYZ, siteXYZ;

    (function buildGeometry() {
      var chunks = [], lon, lat, pts, i;

      for (lon = 0; lon < 360; lon += T.MERIDIAN_STEP) {
        pts = [];
        for (lat = -90; lat <= 90; lat += T.LINE_SAMPLE) pts.push(sph(lat, lon));
        chunks.push(pts);
      }
      for (lat = -T.PARALLEL_CAP; lat <= T.PARALLEL_CAP; lat += T.PARALLEL_STEP) {
        pts = [];
        for (lon = 0; lon <= 360; lon += T.LINE_SAMPLE) pts.push(sph(lat, lon));
        chunks.push(pts);
      }

      for (i = 0; i < chunks.length; i++) linePts += chunks[i].length;
      lineXYZ = new Float32Array(linePts * 3);

      var o = 0, start = 0, j, p;
      for (i = 0; i < chunks.length; i++) {
        lineIdx.push([start, chunks[i].length]);
        for (j = 0; j < chunks[i].length; j++) {
          p = chunks[i][j];
          lineXYZ[o++] = p[0]; lineXYZ[o++] = p[1]; lineXYZ[o++] = p[2];
        }
        start += chunks[i].length;
      }

      /* Fibonacci sphere: an even dot field with no polar clumping. Raw, it
         aliases into visible spiral arms, so each point gets a deterministic
         jitter — same field on every load, but the eye reads scatter instead
         of a lattice. */
      dotXYZ = new Float32Array(T.DOTS * 3);
      var ga = Math.PI * (3 - Math.sqrt(5));
      var band = 2 / T.DOTS;
      for (i = 0; i < T.DOTS; i++) {
        var j1 = hash(i * 2 + 1), j2 = hash(i * 2 + 2);
        var y = 1 - (i / (T.DOTS - 1)) * 2 + (j1 - 0.5) * band * T.DOT_JITTER_Y;
        if (y > 1) y = 1; else if (y < -1) y = -1;
        var r = Math.sqrt(Math.max(0, 1 - y * y));
        var th = ga * i + (j2 - 0.5) * T.DOT_JITTER_TH;
        dotXYZ[i * 3]     = Math.cos(th) * r;
        dotXYZ[i * 3 + 1] = y;
        dotXYZ[i * 3 + 2] = Math.sin(th) * r;
      }

      siteXYZ = new Float32Array(SITES.length * 3);
      for (i = 0; i < SITES.length; i++) {
        p = sph(SITES[i][0], SITES[i][1]);
        siteXYZ[i * 3] = p[0]; siteXYZ[i * 3 + 1] = p[1]; siteXYZ[i * 3 + 2] = p[2];
      }
    })();

    var lineProj = new Float32Array(linePts * 3);

    /* ==========================================================================
       Animation state
       ========================================================================== */
    var spin      = 0;
    var value     = 0;
    var counting  = false;   // ease-up running
    var counted   = false;   // ease-up finished, live ticking
    var countT    = 0;
    var pulsedTo  = 0;       // dollars already acknowledged with a pulse / PULSE_EVERY
    var eventTmr  = 0;
    var ambientTmr = rand(T.AMBIENT_MIN, T.AMBIENT_MAX);
    var arcTmr    = rand(T.ARC_MIN, T.ARC_MAX);
    var pulses    = [];
    var arcs      = [];

    var lastBig = '';

    /* ---- projection scratch ------------------------------------------ */
    var cssW = 0, cssH = 0, dpr = 1;
    var cx = 0, cy = 0, R = 0;
    var ca = 1, sa = 0, ct = 1, st = 0;

    function setPose(angle) {
      ca = Math.cos(angle); sa = Math.sin(angle);
      ct = Math.cos(T.TILT); st = Math.sin(T.TILT);
    }

    /* Spin about Y, then tilt about X, then orthographic drop of z.
       Writes screen x, screen y, depth (>0 = front hemisphere). */
    function xf(bx, by, bz, out, o, rad) {
      var x = bx * ca + bz * sa;
      var z = -bx * sa + bz * ca;
      var y2 = by * ct - z * st;
      var z2 = by * st + z * ct;
      out[o]     = cx + x * rad;
      out[o + 1] = cy - y2 * rad;
      out[o + 2] = z2;
    }

    var p3 = new Float32Array(3);

    /* ---- dot sprite --------------------------------------------------
       One soft radial blob, rasterised once and stamped per point. A hard
       1px rect stipples; a blurred sprite under 'lighter' reads as a lit
       surface. Built lazily so a context-less environment degrades to
       fillRect instead of throwing. */
    var sprite = null, spriteTried = false;

    function buildSprite() {
      spriteTried = true;
      try {
        var c = doc.createElement('canvas');
        var n = T.SPRITE_PX;
        c.width = n; c.height = n;
        var g2 = c.getContext && c.getContext('2d');
        if (!g2 || !g2.createRadialGradient) return null;
        var h = n / 2;
        var gr = g2.createRadialGradient(h, h, 0, h, h, h);
        gr.addColorStop(0.00, 'rgba(214,226,255,1)');
        gr.addColorStop(0.26, 'rgba(' + T.PERI + ',0.62)');
        gr.addColorStop(0.62, 'rgba(' + T.PERI + ',0.14)');
        gr.addColorStop(1.00, 'rgba(' + T.PERI + ',0)');
        g2.fillStyle = gr;
        g2.fillRect(0, 0, n, n);
        return c;
      } catch (e) { return null; }
    }

    /* ==========================================================================
       Events on the surface
       ========================================================================== */
    /* Rejection-sample a site on the hemisphere facing the viewer. Without
       this, roughly half of every event lands behind the globe and is culled
       — and a counter tick that lights nothing breaks the whole pairing. */
    function pickSite(minZ) {
      var best = 0, bestZ = -2, i, o;
      for (var k = 0; k < 14; k++) {
        i = (Math.random() * SITES.length) | 0;
        o = i * 3;
        xf(siteXYZ[o], siteXYZ[o + 1], siteXYZ[o + 2], p3, 0, 1);
        if (p3[2] > minZ) return i;
        if (p3[2] > bestZ) { bestZ = p3[2]; best = i; }
      }
      return best;
    }

    function spawnPulse(neon) {
      pulses.push({ i: pickSite(T.EVENT_MIN_Z), t: 0, neon: !!neon });
      if (pulses.length > 26) pulses.shift();
    }

    function spawnArc() {
      var n = SITES.length;
      var a = pickSite(T.EVENT_MIN_Z);
      var b = (Math.random() * n) | 0;
      var guard = 0;
      while (b === a && guard++ < 8) b = (Math.random() * n) | 0;
      if (b === a) return;

      var ax = siteXYZ[a * 3], ay = siteXYZ[a * 3 + 1], az = siteXYZ[a * 3 + 2];
      var bx = siteXYZ[b * 3], by = siteXYZ[b * 3 + 1], bz = siteXYZ[b * 3 + 2];
      var d = ax * bx + ay * by + az * bz;
      if (d > 1) d = 1; else if (d < -1) d = -1;
      var om = Math.acos(d);
      if (om < 0.35) return;                    // too short to read as an arc

      arcs.push({
        ax: ax, ay: ay, az: az, bx: bx, by: by, bz: bz,
        om: om, so: Math.sin(om), t: 0,
        col: Math.random() < 0.5 ? T.CREAM : T.PERI
      });
      if (arcs.length > 6) arcs.shift();
    }

    /* ==========================================================================
       Counter
       ========================================================================== */
    function writeBig(v) {
      var s = money(v);
      if (s !== lastBig) { lastBig = s; amount.textContent = s; }
    }

    function startCount() {
      if (counting || counted) return;
      if (reduce) { settle(); return; }
      counting = true;
      countT = 0;
      pulsedTo = 0;
    }

    function settle() {
      counting = false;
      counted = true;
      value = T.TARGET;                       // exact; never a rounded easing tail
      writeBig(value);
      eventTmr = rand(T.DRIFT_MIN, T.DRIFT_MAX);
      if (tickRow.className.indexOf('pfg-on') < 0) tickRow.className = 'pfg-tick pfg-on';
      /* One announcement, once, after the visual animation is done. The slow
         $1 drift that follows deliberately does NOT re-announce. */
      srEl.textContent = T.HEAD + ': ' + money(T.TARGET) + ', ' + T.AND + '.';
    }

    /* ==========================================================================
       Advance
       ========================================================================== */
    function advance(dt) {
      spin += (TAU / T.SPIN_S) * dt;
      if (spin > TAU) spin -= TAU;
      setPose(spin);

      var i;

      if (counting) {
        countT += dt;
        var p = countT / T.COUNT_S;
        if (p > 1) p = 1;
        var e = 1 - Math.pow(1 - p, T.COUNT_POW);
        value = T.TARGET * e;
        writeBig(value);

        /* The globe lights up in step with the racing number: one pulse each
           time the figure clears another PULSE_EVERY dollars. Because the
           easing is front-loaded, that is a flurry that decays into the
           resting cadence without any separate rate curve. Cream/periwinkle
           here — neon is reserved for a real, discrete "just now" tick. */
        var marks = Math.floor(value / T.PULSE_EVERY);
        var fired = 0;
        while (pulsedTo < marks && fired < T.BURST_MAX) {
          pulsedTo++; fired++; spawnPulse(false);
        }
        if (pulsedTo < marks) pulsedTo = marks;   // a long stall is not a debt

        if (p >= 1) settle();
      } else if (counted) {
        /* Live accrual: a single dollar every ~15s, each one paired with the
           neon pulse. See DRIFT_MIN in the tuning block for why it is this
           slow now that the figure is exact. */
        eventTmr -= dt;
        if (eventTmr <= 0) {
          eventTmr = rand(T.DRIFT_MIN, T.DRIFT_MAX);
          value += T.DRIFT_STEP;
          writeBig(value);
          spawnPulse(true);            // the one neon moment
        }
      }

      ambientTmr -= dt;
      if (ambientTmr <= 0) {
        ambientTmr = rand(T.AMBIENT_MIN, T.AMBIENT_MAX);
        spawnPulse(false);
      }

      arcTmr -= dt;
      if (arcTmr <= 0) {
        arcTmr = rand(T.ARC_MIN, T.ARC_MAX);
        spawnArc();
      }

      for (i = pulses.length - 1; i >= 0; i--) {
        pulses[i].t += dt;
        if (pulses[i].t >= T.PULSE_S) pulses.splice(i, 1);
      }
      for (i = arcs.length - 1; i >= 0; i--) {
        arcs[i].t += dt;
        if (arcs[i].t >= T.ARC_S) arcs.splice(i, 1);
      }
    }

    /* ==========================================================================
       Render
       ========================================================================== */
    function render() {
      if (!ctx) return;

      var w = cssW || T.FALLBACK_SIZE, h = cssH || T.FALLBACK_SIZE;

      /* Background first, unconditionally: after this line the bitmap is
         painted, so every later guard is safe to take. */
      if (ctx.setTransform) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = T.BG;
      ctx.fillRect(0, 0, w, h);

      cx = w / 2;
      cy = h / 2;
      R  = Math.min(w, h) * (0.5 - T.EDGE_PAD);
      if (!(R > 6)) return;

      var scale = R / T.REF_R;
      var i, o, a;

      /* ---- soft bloom behind the sphere ---- */
      if (ctx.createRadialGradient) {
        var g = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.5);
        g.addColorStop(0, 'rgba(' + T.PERI + ',' + T.HALO_A.toFixed(3) + ')');
        g.addColorStop(0.55, 'rgba(' + T.PERI + ',' + (T.HALO_A * 0.35).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(' + T.PERI + ',0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      /* ---- dot field ----
         The back hemisphere is NOT culled. It is drawn attenuated, on a
         smooth ramp across the terminator: alpha falls to DOT_BACK_A and
         radius to DOT_BACK_SZ at the far pole. That is what makes the
         sphere read as translucent with real depth rather than as a flat
         disc of dots — the graticule below is hard-culled, so the two
         layers together give a lit front and a ghosted back. */
      if (!sprite && !spriteTried) sprite = buildSprite();
      var canStamp = !!(sprite && ctx.drawImage);
      if (!canStamp) ctx.fillStyle = 'rgb(' + T.PERI + ')';
      ctx.globalCompositeOperation = 'lighter';

      var dotR = T.DOT_R * Math.max(0.55, scale);
      for (i = 0; i < T.DOTS; i++) {
        o = i * 3;
        xf(dotXYZ[o], dotXYZ[o + 1], dotXYZ[o + 2], p3, 0, R);
        /* front-ness in 0..1, smoothstepped so the terminator is a soft
           gradient rather than a visible seam */
        var f = 0.5 + 0.5 * p3[2];
        if (f < 0) f = 0; else if (f > 1) f = 1;
        f = f * f * (3 - 2 * f);
        ctx.globalAlpha = T.DOT_A * (T.DOT_BACK_A + (1 - T.DOT_BACK_A) * f);
        var rr = dotR * (T.DOT_BACK_SZ + (1 - T.DOT_BACK_SZ) * f);
        if (canStamp) {
          ctx.drawImage(sprite, p3[0] - rr * 2, p3[1] - rr * 2, rr * 4, rr * 4);
        } else {
          ctx.fillRect(p3[0] - rr * 0.5, p3[1] - rr * 0.5, rr, rr);
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;

      /* ---- graticule ----
         Projected once, then stroked in DEPTH_BANDS passes so the front of
         the sphere reads brighter than the back without paying for a stroke
         per segment. */
      for (i = 0; i < linePts; i++) {
        o = i * 3;
        xf(lineXYZ[o], lineXYZ[o + 1], lineXYZ[o + 2], lineProj, o, R);
      }

      var NB = T.DEPTH_BANDS;
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgb(' + T.PERI + ')';
      for (var b = 0; b < NB; b++) {
        ctx.globalAlpha = T.GRAT_A * (0.14 + 0.86 * ((b + 0.5) / NB));
        ctx.beginPath();
        var drew = false;
        for (var li = 0; li < lineIdx.length; li++) {
          var s0 = lineIdx[li][0], n0 = lineIdx[li][1];
          for (var k = 0; k < n0 - 1; k++) {
            var oa = (s0 + k) * 3, ob = oa + 3;
            var z0 = lineProj[oa + 2], z1 = lineProj[ob + 2];
            if (z0 <= 0 && z1 <= 0) continue;

            var zs = (z0 > 0 ? z0 : 0) + (z1 > 0 ? z1 : 0);
            var zc = (z0 > 0 ? 1 : 0) + (z1 > 0 ? 1 : 0);
            var bi = ((zs / zc) * NB) | 0;
            if (bi >= NB) bi = NB - 1; else if (bi < 0) bi = 0;
            if (bi !== b) continue;

            var x0 = lineProj[oa], y0 = lineProj[oa + 1];
            var x1 = lineProj[ob], y1 = lineProj[ob + 1];
            if (z0 <= 0 || z1 <= 0) {
              /* Clip the segment to the terminator so lines die exactly at
                 the limb instead of jittering across it. */
              var tt = z0 / (z0 - z1);
              var mx = x0 + (x1 - x0) * tt, my = y0 + (y1 - y0) * tt;
              if (z0 > 0) { x1 = mx; y1 = my; } else { x0 = mx; y0 = my; }
            }
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            drew = true;
          }
        }
        if (drew) ctx.stroke();
      }

      /* ---- limb ---- */
      ctx.globalAlpha = T.LIMB_A;
      ctx.strokeStyle = 'rgb(' + T.PERI + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, TAU);
      ctx.stroke();

      /* ---- resting store markers ---- */
      ctx.fillStyle = 'rgb(' + T.CREAM + ')';
      for (i = 0; i < SITES.length; i++) {
        o = i * 3;
        xf(siteXYZ[o], siteXYZ[o + 1], siteXYZ[o + 2], p3, 0, R);
        if (p3[2] <= 0.02) continue;
        ctx.globalAlpha = T.SITE_A * (0.18 + 0.82 * p3[2]);
        ctx.beginPath();
        ctx.arc(p3[0], p3[1], 1.15 * Math.max(0.7, scale), 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      /* ---- arcs and pulses read as light, so they add ---- */
      ctx.globalCompositeOperation = 'lighter';

      for (i = 0; i < arcs.length; i++) drawArc(arcs[i], scale);
      for (i = 0; i < pulses.length; i++) drawPulse(pulses[i], scale);

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    function drawArc(A, scale) {
      var life = A.t / T.ARC_S;
      var headP = life < 1 ? 1 - Math.pow(1 - life, 2) : 1;
      var tailP = headP - T.ARC_TAIL;
      if (tailP < 0) tailP = 0;
      /* fade in over the first 15%, out over the last 30% */
      var fade = Math.min(1, life / 0.15) * Math.min(1, (1 - life) / 0.3);
      if (fade <= 0) return;

      var N = T.ARC_SAMPLE;
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = 'rgba(' + A.col + ',' + (0.5 * fade).toFixed(3) + ')';
      ctx.beginPath();

      var open = false, hx = 0, hy = 0, hz = -1;
      for (var i = 0; i <= N; i++) {
        var u = i / N;
        if (u < tailP || u > headP) { open = false; continue; }
        var s1 = Math.sin((1 - u) * A.om) / A.so;
        var s2 = Math.sin(u * A.om) / A.so;
        var lift = 1 + T.ARC_LIFT * Math.sin(Math.PI * u);
        xf(A.ax * s1 + A.bx * s2, A.ay * s1 + A.by * s2, A.az * s1 + A.bz * s2,
           p3, 0, R * lift);
        if (p3[2] <= 0) { open = false; continue; }
        if (!open) { ctx.moveTo(p3[0], p3[1]); open = true; }
        else ctx.lineTo(p3[0], p3[1]);
        hx = p3[0]; hy = p3[1]; hz = p3[2];
      }
      ctx.stroke();

      /* the travelling head */
      if (hz > 0 && ctx.createRadialGradient) {
        var r = 5 * Math.max(0.6, scale);
        var g = ctx.createRadialGradient(hx, hy, 0, hx, hy, r);
        g.addColorStop(0, 'rgba(' + A.col + ',' + (0.55 * fade).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(' + A.col + ',0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(hx, hy, r, 0, TAU);
        ctx.fill();
      }
    }

    function drawPulse(P, scale) {
      var o = P.i * 3;
      xf(siteXYZ[o], siteXYZ[o + 1], siteXYZ[o + 2], p3, 0, R);
      if (p3[2] <= 0) return;

      var e = P.t / T.PULSE_S;
      if (e > 1) e = 1;
      var col = P.neon ? T.NEON : (P.i % 2 ? T.CREAM : T.PERI);
      var depth = 0.30 + 0.70 * p3[2];
      var fall = (1 - e) * (1 - e);
      var ring = (T.PULSE_R0 + (T.PULSE_R1 - T.PULSE_R0) * (1 - Math.pow(1 - e, 2.4)))
                 * scale * (P.neon ? 1.15 : 0.85);

      ctx.lineWidth = P.neon ? 1.3 : 1;
      ctx.strokeStyle = 'rgba(' + col + ',' + (fall * depth * 0.85).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(p3[0], p3[1], Math.max(0.5, ring), 0, TAU);
      ctx.stroke();

      var core = (P.neon ? 9 : 6) * Math.max(0.6, scale);
      var alpha = (1 - e) * depth * (P.neon ? 0.95 : 0.55);
      if (ctx.createRadialGradient) {
        var g = ctx.createRadialGradient(p3[0], p3[1], 0, p3[0], p3[1], core);
        g.addColorStop(0, 'rgba(' + col + ',' + alpha.toFixed(3) + ')');
        g.addColorStop(0.35, 'rgba(' + col + ',' + (alpha * 0.45).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(' + col + ',0)');
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = 'rgba(' + col + ',' + (alpha * 0.5).toFixed(3) + ')';
      }
      ctx.beginPath();
      ctx.arc(p3[0], p3[1], core, 0, TAU);
      ctx.fill();

      if (P.neon) {
        ctx.fillStyle = 'rgba(' + col + ',' + (alpha).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(p3[0], p3[1], 1.5 * Math.max(0.6, scale), 0, TAU);
        ctx.fill();
      }
    }

    /* The frozen pose for prefers-reduced-motion: a lit sphere, the final
       number, no rotation, no pulses, no arcs. Still a full paint. */
    function renderStatic() {
      spin = T.STATIC_SPIN;
      setPose(spin);
      pulses.length = 0;
      arcs.length = 0;
      render();
    }

    /* ==========================================================================
       Sizing
       ========================================================================== */
    /* Measure from clientWidth/clientHeight, never from
       getBoundingClientRect(). The rect is post-transform: any ancestor
       carrying a rotate or a scroll-driven scale inflates it, and the
       backing store is allocated from that number — a few hundred CSS px of
       card can turn into a tens-of-megapixel bitmap. clientWidth is the
       layout box and is transform-independent. The rect is used only as a
       last resort when layout has not run yet, and everything is clamped to
       MAX_STAGE so no measurement can ever blow up the allocation. */
    function measure(fallback) {
      var w = stage.clientWidth || 0, h = stage.clientHeight || 0;
      if ((!w || !h) && stage.getBoundingClientRect) {
        var r = stage.getBoundingClientRect();
        if (!w) w = r.width || 0;
        if (!h) h = r.height || 0;
      }
      /* The fallback is the size applyLayout() just computed, not a constant:
         in a document that never runs layout, clientWidth reads 0 forever and
         a fixed 420px would ignore the viewport entirely. */
      if (!(w > 0)) w = (fallback > 0 ? fallback : T.FALLBACK_SIZE);
      if (!(h > 0)) h = w;                 // the stage is square by CSS
      if (w > T.MAX_STAGE) w = T.MAX_STAGE;
      if (h > T.MAX_STAGE) h = T.MAX_STAGE;
      return [w, h];
    }

    /* ---- responsive layout -------------------------------------------
       Phones, tablets and desktops all get the identical globe, counter and
       pulses; only the arrangement changes, and it changes off ONE measured
       ratio rather than any device sniffing.

       outerW is the section's own layout width — padding-independent, so
       deriving the padding from it is not circular. availW is then the real
       content width, capped at the same max-width the inner grid uses, which
       is what a big desktop actually gives the copy.

       The denominator is the viewport height, not the section height: see the
       note on ROW_RATIO in the tuning block. Using the section's own height
       would latch, because stacking makes the section taller.

       Every returned size is a hard px value, so "wide but only 390px tall"
       is solved by arithmetic rather than by hoping a clamp() lands well. */
    var layW = -1, layH = -1;

    function viewportH() {
      var h = win.innerHeight ||
              (doc.documentElement && doc.documentElement.clientHeight) || 0;
      return h > 0 ? h : 800;
    }

    function sectionW() {
      var w = section.clientWidth || 0;
      if (!w && section.getBoundingClientRect) w = section.getBoundingClientRect().width || 0;
      if (!w && root.clientWidth) w = root.clientWidth;
      return w > 0 ? w : T.FALLBACK_SIZE;
    }

    function applyLayout() {
      var outerW = sectionW();
      var vh     = viewportH();
      layW = outerW; layH = vh;

      var padX   = clampN(20, outerW * 0.05, 72);
      var availW = clampN(160, outerW - padX * 2, T.INNER_MAX);
      var ratio  = availW / vh;

      var short = vh < T.SHORT_VH;
      var row   = availW >= T.ROW_WIDE_W ||
                  (availW >= T.ROW_MIN_W && ratio >= T.ROW_RATIO);

      /* Vertical padding collapses hard when the viewport is short — on a
         390px-tall landscape phone the default 72px band alone would eat more
         than a third of the screen. */
      var padY = short ? clampN(22, vh * 0.075, 46) : clampN(56, vh * 0.10, 148);
      var gap  = row ? clampN(28, availW * 0.055, 92) : clampN(26, vh * 0.045, 56);

      /* The globe is bounded by BOTH axes. In row mode the height bound is
         what saves landscape phones; in column mode the width bound is what
         saves narrow ones. */
      var stagePx = row
        ? Math.min(availW * 0.42, vh * (short ? 0.74 : 0.82))
        : Math.min(availW * 0.84, vh * 0.43);
      stagePx = clampN(T.MIN_STAGE, stagePx, T.MAX_STAGE);

      /* Type is bounded the same way. In row mode the copy only owns
         availW - stage - gap, so the coefficients are lower; at 11.5% of the
         content width "$1,342" measures ~3.3x its font size and still leaves
         78-215px of slack at every viewport checked, the tightest being the
         568x320 landscape phone. */
      var headPx = clampN(21, Math.min(availW * (row ? 0.052 : 0.088), vh * 0.085), 46);
      var amtPx  = clampN(36, Math.min(availW * (row ? 0.115 : 0.200), vh * 0.200), 124);
      var leadPx = clampN(12, vh * 0.035, 36);
      var figPx  = clampN(10, vh * 0.026, 30);

      var st = section.style;
      st.setProperty('--pfg-pad-x', Math.round(padX) + 'px');
      st.setProperty('--pfg-pad-y', Math.round(padY) + 'px');
      st.setProperty('--pfg-gap',   Math.round(gap) + 'px');
      st.setProperty('--pfg-stage', Math.round(stagePx) + 'px');
      st.setProperty('--pfg-head',  headPx.toFixed(1) + 'px');
      st.setProperty('--pfg-amount', amtPx.toFixed(1) + 'px');
      st.setProperty('--pfg-lead',  Math.round(leadPx) + 'px');
      st.setProperty('--pfg-fig',   Math.round(figPx) + 'px');

      var cls = 'pfg-root ' + (row ? 'pfg-row' : 'pfg-col') + (short ? ' pfg-short' : '');
      if (section.className !== cls) section.className = cls;

      /* Handed to measure() as the authoritative stage size: in a document
         that never runs layout, stage.clientWidth can read 0 forever, and the
         globe would fall back to FALLBACK_SIZE instead of the size we just
         computed. */
      return Math.round(stagePx);
    }

    /* True when the box the layout was computed from has drifted — an
       orientation flip, a window resize, a pane being dragged. Cheap enough
       to call on the watchdog heartbeat. */
    function layoutStale() {
      return Math.abs(sectionW() - layW) > T.LAY_EPS ||
             Math.abs(viewportH() - layH) > T.LAY_EPS;
    }

    function resize() {
      var m = measure(applyLayout());
      cssW = m[0]; cssH = m[1];
      dpr = Math.min(win.devicePixelRatio || 1, T.MAX_DPR);
      var pw = Math.max(1, Math.round(cssW * dpr));
      var ph = Math.max(1, Math.round(cssH * dpr));
      if (cvs.width !== pw) cvs.width = pw;      // NB: this clears the bitmap
      if (cvs.height !== ph) cvs.height = ph;
      /* Unconditional. There is no return path out of resize() that leaves
         the canvas unpainted. */
      if (reduce) renderStatic(); else render();
    }

    /* ==========================================================================
       Loop / lifecycle
       ========================================================================== */
    var nowMs = (win.performance && win.performance.now)
      ? function () { return win.performance.now(); }
      : function () { return Date.now(); };

    /* lastRealFrame starts far in the past, not at 0: it means "no real rAF
       frame has EVER arrived". Seeding it with 0 makes the watchdog treat the
       page-load instant as a healthy frame and skip its own first heartbeat,
       which costs the count a quarter-second on exactly the starved documents
       the watchdog exists for. */
    var raf = 0, lastNow = 0, lastRealFrame = -1e9, watchdog = 0;
    var inView = false, destroyed = false;

    function running() { return !destroyed && !reduce && inView; }

    function step(now) {
      if (destroyed) return;
      if (reduce) { renderStatic(); return; }
      var dt = lastNow ? (now - lastNow) / 1000 : 1 / 60;
      lastNow = now;
      if (!(dt > 0)) dt = 1 / 60;
      if (dt > T.MAX_DT) dt = T.MAX_DT;
      advance(dt);
      render();
    }

    function frame(now) {
      raf = 0;
      lastRealFrame = nowMs();
      step(typeof now === 'number' ? now : nowMs());
      if (running()) raf = win.requestAnimationFrame(frame);
    }

    function stopRaf() {
      if (raf) { win.cancelAnimationFrame(raf); raf = 0; }
    }

    /* Paint first, schedule second. Never returns without a painted frame. */
    function play() {
      if (destroyed) return;
      stopRaf();
      lastNow = 0;                        // don't bill the pause to the clock
      step(nowMs());
      if (!running()) return;
      if (win.requestAnimationFrame) raf = win.requestAnimationFrame(frame);
    }

    /* Watchdog. Two jobs, both of them insurance against a document that
       never renders:

       1. IntersectionObserver delivery is part of the rendering lifecycle, so
          in a document with `hidden === true` it can go permanently silent —
          measured here: a fresh observer on a fully-visible element produced
          zero callbacks. Relying on IO alone would leave the counter frozen
          at $0.00M forever. Until the count has started we therefore also
          poll the layout box, which is always accurate. The poll retires the
          moment the counter is running, so it costs one rect read per tick
          for a second or two and nothing after that.

       2. ResizeObserver delivery rides the same starved lifecycle, so an
          orientation flip can land with no callback at all. Polling the
          section box every heartbeat catches that: it is two integer reads,
          and it re-lays-out only when the box has actually moved. This is
          also the backstop for environments with no ResizeObserver.

       3. Once running, it drives the clock whenever rAF is starved, and
          stands down the moment real frames start arriving. */
    watchdog = win.setInterval(function () {
      if (destroyed) return;
      if (!counting && !counted && !inView) setInView(inViewNow());
      if (layoutStale()) { resize(); play(); return; }
      if (!running()) return;
      var n = nowMs();
      if (n - lastRealFrame < T.WATCHDOG_MS * 1.6) return;   // rAF is healthy
      step(n);
    }, T.WATCHDOG_MS);

    /* ---- visibility ---------------------------------------------------- */
    function inViewNow() {
      if (!section.getBoundingClientRect) return true;
      var r = section.getBoundingClientRect();
      var vh = win.innerHeight || (doc.documentElement && doc.documentElement.clientHeight) || 0;
      if (!vh) return true;
      /* A rect that is zero on BOTH axes carries no information — layout has
         not run yet. Reading that as "off screen" is what would leave the
         counter parked at $0 forever, so it reads as visible instead; the
         same optimistic default as the !vh case above. */
      if (!(r.width > 0) && !(r.height > 0) && !r.top && !r.bottom) return true;
      if (!(r.height > 0)) return r.top < vh && r.bottom > 0;
      var shown = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      return shown > 0 && shown / Math.min(r.height, vh) >= T.IN_VIEW_FRAC;
    }

    function setInView(v) {
      if (v === inView) return;
      inView = v;
      if (v) { startCount(); play(); } else { stopRaf(); }
    }

    var io = null, ro = null, scrollBound = false;

    /* ---- listeners ----------------------------------------------------- */
    var resizeTimer = 0;
    function onWinResize() {
      win.clearTimeout(resizeTimer);
      resizeTimer = win.setTimeout(function () {
        if (destroyed) return;
        resize();
        play();
      }, 90);
    }

    /* iOS fires orientationchange before the new innerHeight is readable, so
       relayout twice: once on the debounce, once after the frame settles. */
    function onOrientation() {
      onWinResize();
      win.setTimeout(function () {
        if (destroyed) return;
        resize();
        play();
      }, 320);
    }

    function onVisibility() { play(); }

    function onScroll() {
      if (destroyed) return;
      setInView(inViewNow());
    }

    function onReduceChange() {
      try { reduce = !!(mq && mq.matches); } catch (e) {}
      if (reduce) { stopRaf(); settle(); renderStatic(); }
      else play();
    }

    if (typeof win.ResizeObserver !== 'undefined') {
      ro = new win.ResizeObserver(onWinResize);
      ro.observe(section);          // the section, not the stage: the stage's
      ro.observe(stage);            // size is an OUTPUT of the layout decision
    }
    win.addEventListener('resize', onWinResize);
    win.addEventListener('orientationchange', onOrientation);
    doc.addEventListener('visibilitychange', onVisibility);

    if (typeof win.IntersectionObserver !== 'undefined') {
      io = new win.IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          setInView(!!entries[i].isIntersecting);
        }
      }, { threshold: [0, T.IN_VIEW_FRAC] });
      io.observe(section);
    } else {
      win.addEventListener('scroll', onScroll, true);
      scrollBound = true;
    }

    if (mq) {
      if (mq.addEventListener) mq.addEventListener('change', onReduceChange);
      else if (mq.addListener) mq.addListener(onReduceChange);
    }

    /* ---- first paint ---------------------------------------------------- */
    writeBig(0);
    resize();                                // paints
    inView = inViewNow();                      // works fine in a hidden document
    if (inView) startCount();
    if (reduce) { settle(); renderStatic(); }
    play();                                    // paints again, then schedules

    /* ==========================================================================
       Cleanup
       ========================================================================== */
    return function cleanup() {
      if (destroyed) return;
      destroyed = true;
      stopRaf();
      win.clearInterval(watchdog);
      win.clearTimeout(resizeTimer);
      if (ro && ro.disconnect) ro.disconnect();
      if (io && io.disconnect) io.disconnect();
      win.removeEventListener('resize', onWinResize);
      win.removeEventListener('orientationchange', onOrientation);
      doc.removeEventListener('visibilitychange', onVisibility);
      if (scrollBound) win.removeEventListener('scroll', onScroll, true);
      if (mq) {
        if (mq.removeEventListener) mq.removeEventListener('change', onReduceChange);
        else if (mq.removeListener) mq.removeListener(onReduceChange);
      }
      pulses.length = 0;
      arcs.length = 0;
      if (section.parentNode) section.parentNode.removeChild(section);
      instances--;
      if (instances <= 0) {
        instances = 0;
        var s = doc.getElementById(STYLE_ID);
        if (s && s.parentNode) s.parentNode.removeChild(s);
      }
    };
  };
})();
