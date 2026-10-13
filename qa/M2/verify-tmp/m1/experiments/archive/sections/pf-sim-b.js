/* =============================================================================
   pf-sim-b.js — "The wind tunnel"
   -----------------------------------------------------------------------------
   ONE scroll-driven section that replaces both the slider simulator and the
   step-by-step protection strip. The metaphor is a smoke-line wind tunnel.

   Aeronautical engineers never argue about whether a shape will fly. They put
   it in a tunnel, stream smoke over it and watch. Priceflag does exactly that
   to a price: the shape is tested in simulation, thousands of times, before it
   ever meets a real order. Raise the price and you raise the angle of attack —
   more lift, right up until the flow separates and the whole thing stalls.

   Five acts, driven purely by document scroll:

     1. THE SHAPE    dark #030818. A price renders as an aerofoil in a tunnel.
     2. THE TUNNEL   background begins lifting. Smoke pours over the shape,
                     laminar, then the angle sweeps up and the flow separates
                     into a Karman vortex street. Ghost outlines of every angle
                     already tried fan out behind it; the response surface in
                     the corner fills with trial points. That fan IS the AI.
     3. THE READING  mid tone. Turbulence damps, calipers close on the flow and
                     the response surface resolves to a BAND, not a point.
     4. THE ROAD     lighter. Real orders stream over the shape in the observed
                     colour, sparser and brighter than simulated smoke, as the
                     aperture opens 5% -> 20% -> 50% -> 100%. The observed point
                     lands inside the predicted band. That is the payoff.
     5. THE STALL    near cream. Pushed too far the flow separates, the trace
                     crosses the guardrail floor, and everything REVERSES: the
                     stream runs backwards, the angle returns, the price returns.

   Contract
   --------
     window.initPfSimB(root) -> function cleanup()

   Exactly one global. Zero dependencies, no imports, no CDN. Every node is
   built inside `root` with createElement; one id-guarded, refcounted <style>
   carries the CSS and every selector is prefixed `.pfw-`. Cleanup cancels the
   rAF, the watchdog, the observers, the timers and every listener, then removes
   the DOM it made.

   Read-only test hooks hang off the same global so the whole timeline can be
   driven from node with no DOM at all:

     initPfSimB.stateAt(p)   -> the full scene state at scroll progress p
     initPfSimB.model        -> { orders, profit }
     initPfSimB.flow         -> { velocity } (the aerodynamics, frame-free)
     initPfSimB.T            -> the tunables
     initPfSimB.ACTS         -> the copy timeline

   THE HIDDEN-DOCUMENT RULE
   ------------------------
   This page is routinely rendered with `document.hidden === true`, which
   starves requestAnimationFrame, ResizeObserver AND IntersectionObserver.
   Modules in this repo have shipped as permanently blank canvases because of
   it. So, as a hard rule here:

     * everything is driven from the WALL CLOCK, never from a frame counter,
     * a watchdog interval drives the tick whenever rAF has gone quiet and
       stands itself down the moment real frames start arriving again,
     * resize sizes the canvas and then re-renders SYNCHRONOUSLY, warming the
       trail buffer back up so it is never left empty,
     * no visibility, scroll or resize path may return without having painted,
     * nothing waits on IntersectionObserver. There is no IntersectionObserver.
       Visibility is read from the same getBoundingClientRect the scroll
       progress already needs, and the default is "visible".

   THE AERODYNAMICS
   ----------------
   Genuine Joukowski aerofoil theory, because it is only about forty lines and
   it looks right in a way that faked curl noise never does.

   A circle of radius A centred at MU in the zeta plane is mapped to an aerofoil
   by z = zeta + B^2/zeta. The complex potential around the circle is

     w(s) = U( s e^-ia + A^2 e^ia / s ) + i*GAMMA/(2pi) * ln s ,   s = zeta - MU

   and the Kutta condition — the flow must leave the sharp trailing edge
   smoothly — fixes the circulation exactly:

     GAMMA = 4 pi U A sin(alpha - theta_TE)

   Physical velocity is (dw/ds) / (dz/dzeta), and dz/dzeta = 1 - B^2/zeta^2.
   Particles are advected through that field with RK2. Because the field is the
   real potential flow, streamlines never enter the body; the only numerical
   guard needed is a projection back to the surface.

   Potential flow, of course, never stalls — that is its famous failure. So the
   stall is added on top, exactly where the real physics lives: past a critical
   angle a wake deficit opens behind the body and vortices are shed alternately
   from the separation point, giving a Karman street. That is the picture every
   aerodynamicist recognises, and it is the picture of a price pushed too far.

   THE ECONOMICS
   -------------
   Constant elasticity with a stall term, which is the same shape as the lift
   curve and is the point of the whole metaphor:

     orders(dp, e) = O_DAY * (1+dp)^e * exp( -STALL_K * excess^2 )
     excess        = max(0, dp - STALL_ONSET) / STALL_ONSET
     profit(dp, e) = (P0*(1+dp) - COST) * orders(dp, e)

   Demand answers a small price rise smoothly and answers a large one by
   breaking. With the shipped constants the guardrail floor (-8% on baseline
   profit) is crossed at about +21.5%, which is where act five trips.
   ============================================================================= */

(function () {
  'use strict';

  /* ===========================================================================
     TUNABLES. Everything a designer or an economist might want to argue about
     lives in this one object.
     ========================================================================= */
  var T = {
    /* --- product constants --------------------------------------------- */
    P0:            48.00,
    COST:          19.00,
    O_DAY:         25.2,
    GUARDRAIL_PCT: -8,
    STAGES:        [5, 20, 50, 100],
    E_BAND:        [-1.9, -0.9],
    E_TRUE:        -1.35,          // the elasticity the world actually had

    /* Demand breaks past this price rise, and STALL_K is how hard it breaks.
       Tuned so the guardrail floor is crossed at about +21.5%. Do not move one
       without re-checking PUSH_DP below. */
    STALL_ONSET:   0.14,
    STALL_K:       0.42,

    /* --- the timeline, in scroll progress ------------------------------ */
    TRACK_VH:      460,            // section height, desktop
    TRACK_VH_SM:   420,            // section height, <=600px wide
    TEST_DP:       0.05,           // the tested step: +5%
    SWEEP_DP:      0.30,           // how far act two sweeps the angle
    PUSH_DP:       0.22,           // act five pushes here and trips the floor

    /* --- aerodynamics -------------------------------------------------- */
    B:             1.0,            // Joukowski singular points at +/- B
    MU:            [-0.10, 0.085], // circle centre: x is thickness, y is camber
    ALPHA_PER_DP:  58,             // degrees of angle of attack per unit dp
    ALPHA_STALL:   7,              // degrees where separation begins
    ALPHA_STALL_W: 6,              // degrees to fully separated
    V_MAX:         3.4,            // velocity clamp, in free streams
    WAKE_DEFICIT:  0.86,           // how much axial speed the wake kills
    WAKE_HALF:     0.95,           // wake half width, in world units
    TURB:          0.30,           // small-scale unsteadiness in the wake

    /* --- vortex shedding ------------------------------------------------ */
    SHED_MS:       210,            // base interval between shed vortices
    SHED_GAMMA:    1.35,           // strength of a freshly shed vortex
    SHED_LIFE:     3.4,            // seconds before a vortex has decayed away
    SHED_CORE:     0.055,          // core radius squared, keeps it finite
    VORTEX_MAX:    18,

    /* --- particles ------------------------------------------------------ */
    PX_PER_PARTICLE: 2900,         // one smoke particle per this many CSS px^2
    N_MIN:         130,
    N_MAX:         560,
    N_OBS:         84,             // real-order particles at 100% exposure
    ROW_MIN:       9,
    ROW_MAX:       26,
    ROW_PX:        30,             // one smoke filament per this many px of height
    FLOW_SPEED:    1.55,           // world units per second per free stream
    TRAIL_TAU:     0.17,           // seconds for a trail to fade to 1/e
    DT_MAX:        0.05,           // hard clamp on a simulation step, seconds
    WARM_STEPS:    26,             // substeps run after a resize to rebuild trails

    /* --- geometry ------------------------------------------------------- */
    CHORD_FRAC:    0.30,           // aerofoil chord as a fraction of stage width
    CHORD_MIN:     132,
    CHORD_MAX:     330,

    /* --- loop ----------------------------------------------------------- */
    WATCHDOG_MS:   32,
    RAF_QUIET_MS:  90,
    SCROLL_FORCE_MS: 60,           // repaint straight from the scroll handler
                                   // if the last paint is older than this
    ANNOUNCE_MS:   260
  };

  var DEG = Math.PI / 180;

  /* Derived aerofoil geometry. The circle must pass through the trailing-edge
     singularity at zeta = +B, which fixes its radius. */
  var A_RAD    = Math.sqrt((T.B - T.MU[0]) * (T.B - T.MU[0]) + T.MU[1] * T.MU[1]);
  var THETA_TE = Math.atan2(-T.MU[1], T.B - T.MU[0]);
  var CHORD_Z  = 4 * T.B;          // the mapped aerofoil spans roughly -2B..2B

  var STYLE_ID = 'pfw-style';
  var liveInstances = 0;
  var uidSeq = 0;

  /* ===========================================================================
     Small maths helpers.
     ========================================================================= */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function seg(x, a, b) { return clamp((x - a) / ((b - a) || 1e-6), 0, 1); }
  function smoothstep(a, b, x) { var t = seg(x, a, b); return t * t * (3 - 2 * t); }
  function ease(t) { return t * t * (3 - 2 * t); }
  function ramp(x, a, b) { return ease(seg(x, a, b)); }

  /* A tiny deterministic generator. The trial scatter and the particle seeding
     must be identical between a live frame and a reduced-motion still, so
     Math.random is not allowed anywhere in this file. */
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /* ===========================================================================
     Colour. Every colour in the section is a ramp over scroll progress, so the
     dark-to-light transition is one interpolation and not two themes swapped.
     ========================================================================= */
  function hex(h) {
    var n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rampColor(stops, p) {
    var i = 0;
    while (i < stops.length - 2 && p > stops[i + 1][0]) i++;
    var a = stops[i], b = stops[i + 1];
    var t = seg(p, a[0], b[0]);
    return [
      lerp(a[1][0], b[1][0], t),
      lerp(a[1][1], b[1][1], t),
      lerp(a[1][2], b[1][2], t)
    ];
  }

  function S(list) {
    return list.map(function (s) { return [s[0], hex(s[1])]; });
  }

  /* ---------------------------------------------------------------------------
     THE LIGHT.

     One rule governs every colour here, and it is a piece of arithmetic, not a
     taste: a foreground that has to travel from light to dark while the
     background travels from dark to light MUST pass the background on the way,
     and at the crossing the contrast between them is 1:1. There is no palette
     that avoids it. The only honest answers are to cross quickly and to cross
     where nothing is being read.

     So the tunnel stays dark right through act four — which is also where the
     neon wants a dark backdrop — and the whole flood to cream happens inside
     act five, in the wordless stretch between the guardrail tripping and the
     reversal line arriving. The instrument corner blanks itself across the same
     window (see `topOpacity`), so the numerals are not asked to be legible
     while they are mid-crossing either. When the copy returns, the tunnel is
     cream and the ink is navy, and nothing was ever hard to read.
     ------------------------------------------------------------------------ */

  var BG_STOPS = S([
    [0.00, '#030818'], [0.16, '#050e21'], [0.34, '#0b1730'], [0.46, '#16203c'],
    [0.56, '#253357'],                    /* act three: the tunnel lifts */
    [0.70, '#3c4668'], [0.80, '#4e5573'], /* act four: lighter still */
    [0.878, '#535a78'],                   /* held: cream ink still needs 4.5:1 */
    [0.906, '#c6c0b0'], [0.930, '#e6dfd0'], [1.00, '#f3ecde']  /* the flood */
  ]);

  var INK_STOPS = S([
    [0.00, '#f3ecde'], [0.80, '#f3ecde'], [0.880, '#eae4d6'],
    [0.904, '#2b3454'], [0.940, '#16203f'], [1.00, '#0d2168']
  ]);

  /* Simulated smoke: periwinkle on dark, brand blue on cream. */
  var SMOKE_STOPS = S([
    [0.00, '#5f76c8'], [0.45, '#93aaff'], [0.86, '#7b93f0'],
    [0.92, '#3559dd'], [1.00, '#1d4ed8']
  ]);
  var SMOKE_HOT_STOPS = S([
    [0.00, '#b9c8ff'], [0.45, '#dfe6ff'], [0.86, '#c3d0ff'],
    [0.92, '#5f7fea'], [1.00, '#3b63e6']
  ]);

  /* Observed. Neon is reserved for measured reality and the live event, and it
     stays pure neon for the whole of act four, which is the only place the
     product's real data is on screen against a dark tunnel. It deepens through
     the flood, because a #d8f24b numeral on cream is not a numeral. */
  var OBS_STOPS = S([
    [0.00, '#d8f24b'], [0.860, '#d8f24b'], [0.895, '#8fa81b'],
    [0.915, '#4e5c08'], [0.950, '#57680a'], [1.00, '#5f7208']
  ]);

  /* Guardrail / stall warning, as a GRAPHIC: the separation marker, the floor
     line, the breach ring. Free to be a hot coral, because none of it is text. */
  var WARN_STOPS = S([
    [0.00, '#ff8a6b'], [0.870, '#ff8a6b'], [0.910, '#b0361d'], [1.00, '#8e2410']
  ]);

  /* The same warning as TEXT, which is a different problem. A coral numeral on
     the act-four slate is 2.3:1 — a red simply cannot pass on a mid-dark
     background, because reds live at exactly the luminance the background has
     reached. So the breached number goes to a warm blush while the tunnel is
     dark and to a deep red once it is cream, and the hot coral stays where it
     is only ever a mark on a canvas. */
  var WARN_TEXT_STOPS = S([
    [0.00, '#ffd3c2'], [0.870, '#ffd3c2'], [0.910, '#96280f'], [1.00, '#7d1e0a']
  ]);

  function mixC(a, b, t) {
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  }

  function rgba(c, a) {
    return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
  }
  function rgb(c) {
    return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';
  }

  /* ===========================================================================
     Formatting. Locale-free on purpose: toLocaleString is not consistent across
     the environments this page renders in, and these numbers are typography.
     ========================================================================= */
  var ENDASH = '–';

  function group(s) { return s.replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function money2(v) {
    var s = Math.abs(v).toFixed(2).split('.');
    return '$' + group(s[0]) + '.' + s[1];
  }
  function money0(v) { return '$' + group(String(Math.round(Math.abs(v)))); }

  /* ===========================================================================
     THE ECONOMICS
     ========================================================================= */
  function orders(dp, e) {
    var base = T.O_DAY * Math.pow(1 + dp, e);
    var ex = Math.max(0, dp - T.STALL_ONSET) / T.STALL_ONSET;
    return base * Math.exp(-T.STALL_K * ex * ex);
  }
  function profit(dp, e) {
    return (T.P0 * (1 + dp) - T.COST) * orders(dp, e);
  }

  var BASE_PROFIT = profit(0, T.E_TRUE);                       // 730.80
  var FLOOR_PROFIT = BASE_PROFIT * (1 + T.GUARDRAIL_PCT / 100); // 672.34
  var BAND_LO = Math.min(profit(T.TEST_DP, T.E_BAND[0]), profit(T.TEST_DP, T.E_BAND[1]));
  var BAND_HI = Math.max(profit(T.TEST_DP, T.E_BAND[0]), profit(T.TEST_DP, T.E_BAND[1]));

  /* ===========================================================================
     THE AERODYNAMICS

     `velocity(st, wx, wy, out)` is the whole flow solver. World coordinates are
     screen-aligned with the free stream along +x and y pointing up; the aerofoil
     frame is the world rotated by +alpha, which puts the chord on the x axis and
     the stream at the angle of attack. Nothing here touches the DOM, so it can
     be driven from node.
     ========================================================================= */

  /* out is reused; allocating a vector per particle per substep is the one
     thing that would actually cost frames here. */
  function vec() { return { u: 0, v: 0, inside: false, px: 0, py: 0 }; }

  function velocity(st, wx, wy, out) {
    var ca = st.ca, sa = st.sa, U = st.U, B = T.B;

    /* world -> aerofoil frame */
    var zx = wx * ca - wy * sa;
    var zy = wx * sa + wy * ca;

    /* inverse Joukowski: zeta = (z +/- sqrt(z^2 - 4B^2)) / 2, outer branch */
    var cr = zx * zx - zy * zy - 4 * B * B;
    var ci = 2 * zx * zy;
    var rr = Math.sqrt(cr * cr + ci * ci);
    var sr = Math.sqrt(Math.max(0, (rr + cr) * 0.5));
    var si = Math.sqrt(Math.max(0, (rr - cr) * 0.5));
    if (ci < 0) si = -si;

    var p1x = (zx + sr) * 0.5, p1y = (zy + si) * 0.5;
    var p2x = (zx - sr) * 0.5, p2y = (zy - si) * 0.5;
    var zex, zey;
    if (p1x * p1x + p1y * p1y >= p2x * p2x + p2y * p2y) { zex = p1x; zey = p1y; }
    else { zex = p2x; zey = p2y; }

    /* s = zeta - MU, the circle-centred coordinate */
    var sx = zex - T.MU[0], sy = zey - T.MU[1];
    var s2 = sx * sx + sy * sy;

    out.inside = false;
    if (s2 < A_RAD * A_RAD) {
      /* Numerically inside the body. Project to just outside the surface and
         evaluate there, and hand the projected world point back so the caller
         can put the particle where it belongs. */
      out.inside = true;
      var k = (A_RAD * 1.004) / Math.sqrt(s2 || 1e-9);
      sx *= k; sy *= k;
      zex = sx + T.MU[0]; zey = sy + T.MU[1];
      s2 = sx * sx + sy * sy;
      var ze2 = zex * zex + zey * zey || 1e-9;
      var bzx = zex + B * B * zex / ze2;      /* z = zeta + B^2/zeta */
      var bzy = zey - B * B * zey / ze2;
      out.px = bzx * ca + bzy * sa;           /* back to world */
      out.py = -bzx * sa + bzy * ca;
    }

    /* dw/ds = U( e^-ia - A^2 e^ia / s^2 ) + i*GAMMA/(2 pi s) */
    var cosA = ca, sinA = sa;
    var s2x = sx * sx - sy * sy, s2y = 2 * sx * sy;
    var s2m = s2x * s2x + s2y * s2y || 1e-12;
    /* A^2 e^ia / s^2 = A^2 (cosA + i sinA) * conj(s^2) / |s^2|^2 */
    var A2 = A_RAD * A_RAD;
    var qr = (cosA * s2x + sinA * s2y) * A2 / s2m;
    var qi = (sinA * s2x - cosA * s2y) * A2 / s2m;

    var GAMMA = 4 * Math.PI * U * A_RAD * Math.sin(st.alpha - THETA_TE);
    var gk = GAMMA / (2 * Math.PI * (s2 || 1e-9));   /* i*G/(2 pi s) = gk*(sy + i sx) */

    var dr = U * (cosA - qr) + gk * sy;
    var di = U * (-sinA - qi) + gk * sx;

    /* dz/dzeta = 1 - B^2/zeta^2 */
    var ze2x = zex * zex - zey * zey, ze2y = 2 * zex * zey;
    var ze2m = ze2x * ze2x + ze2y * ze2y || 1e-12;
    var jr = 1 - B * B * ze2x / ze2m;
    var ji = B * B * ze2y / ze2m;

    /* (dw/ds) / (dz/dzeta) */
    var jm = jr * jr + ji * ji;
    if (jm < 1e-7) jm = 1e-7;
    var wr = (dr * jr + di * ji) / jm;
    var wi = (di * jr - dr * ji) / jm;

    /* conjugate velocity in the aerofoil frame, then back to world */
    var uz = wr, vz = -wi;
    var u = uz * ca + vz * sa;
    var v = -uz * sa + vz * ca;

    /* --- separation: the wake deficit ---------------------------------- */
    if (st.stall > 0.001) {
      var down = smoothstep(0.35, 1.7, wx);
      var across = Math.exp(-(wy * wy) / (T.WAKE_HALF * T.WAKE_HALF));
      var g = st.stall * down * across;
      u *= (1 - T.WAKE_DEFICIT * g);
      /* small-scale unsteadiness, so the wake never looks laminar */
      var tt = st.tSec;
      u += g * T.TURB * Math.sin(wy * 3.1 + tt * 2.3 + wx * 1.7);
      v += g * T.TURB * Math.sin(wx * 2.7 - tt * 2.9 + wy * 2.1) * 1.3;
    }

    /* --- shed vortices: the Karman street ------------------------------ */
    var vs = st.vortices;
    if (vs) {
      for (var i = 0; i < vs.length; i++) {
        var q = vs[i];
        var dx = wx - q.x, dy = wy - q.y;
        var r2 = dx * dx + dy * dy + T.SHED_CORE;
        var f = q.g / (2 * Math.PI * r2);
        u -= f * dy;
        v += f * dx;
      }
    }

    /* Clamp. The trailing edge is a removable singularity — Kutta makes the
       limit finite — but it is numerically loud, and a particle that takes one
       enormous step looks like a bug rather than like physics. */
    var sp = Math.sqrt(u * u + v * v);
    var lim = T.V_MAX;
    if (sp > lim) { var m = lim / sp; u *= m; v *= m; }

    out.u = u; out.v = v;
    return out;
  }

  /* The aerofoil outline in the aerofoil frame, computed once. Rotation and
     scale are applied at draw time, so ghosts are free. */
  var BODY = (function () {
    var pts = [];
    var n = 128;
    for (var i = 0; i <= n; i++) {
      var th = (i / n) * Math.PI * 2;
      var zex = T.MU[0] + A_RAD * Math.cos(th);
      var zey = T.MU[1] + A_RAD * Math.sin(th);
      var m = zex * zex + zey * zey || 1e-9;
      pts.push(zex + T.B * T.B * zex / m, zey - T.B * T.B * zey / m);
    }
    return pts;
  })();

  /* ===========================================================================
     THE TIMELINE

     stateAt(p) turns one scroll number into the entire scene. It is pure: no
     DOM, no time except the wall clock passed in for the unsteady terms, no
     randomness. Everything downstream — the live canvas, the reduced-motion
     stills, the HUD text, the node tests — reads this and nothing else.
     ========================================================================= */

  /* `mark` is where the act's NAME takes over — it drives the eyebrow, the
     spine and the announcement. `from`/`to` are where the act's LINE is
     readable, which is a narrower window, because the copy has to be absent
     while the colours cross. Act five's line deliberately arrives late: the
     stall itself is wordless, carried by the diving number and the picture. */
  var ACTS = [
    { key: 'shape',   label: 'The shape',   mark: 0.000,
      line: 'A price is a shape you push demand through.',
      say:  'The shape. A price is a shape you push demand through.',
      from: -0.012, to: 0.140 },   /* already legible on the very first frame */
    { key: 'tunnel',  label: 'The tunnel',  mark: 0.155,
      line: 'Thousands of runs before one real buyer.',
      say:  'The tunnel. Thousands of simulated runs before one real buyer ever sees the price.',
      from: 0.180, to: 0.400 },
    { key: 'reading', label: 'The reading', mark: 0.435,
      line: 'We never hand you a single number.',
      say:  'The reading. The forecast resolves to a range, never a single number.',
      from: 0.450, to: 0.560 },
    { key: 'road',    label: 'The road',    mark: 0.598,
      line: 'Then live, five percent of products at a time.',
      say:  'The road. Real orders are released five percent at a time and land inside the predicted range.',
      from: 0.645, to: 0.820 },
    { key: 'stall',   label: 'The stall',   mark: 0.825,
      line: 'It reverses itself at 3 a.m., unattended.',
      say:  'The stall. Pushed too far the price crosses the guardrail floor and reverses itself, unattended.',
      from: 0.918, to: 1.000 }
  ];
  var FADE = 0.035;

  /* The rollout ladder: 5% -> 20% -> 50% -> 100% of products. */
  var STAGE_AT = [0.650, 0.695, 0.740, 0.782];

  function actOpacity(i, p) {
    var a = ACTS[i];
    var inn = seg(p, a.from, a.from + FADE);
    var out = (i === ACTS.length - 1) ? 1 : (1 - seg(p, a.to - FADE, a.to));
    return ease(inn) * ease(out);
  }

  /* The instrument corner blanks itself while the colours cross. Nothing is
     asked to be legible at 1:1. */
  function topOpacity(p) {
    return 1 - ease(seg(p, 0.862, 0.876)) * (1 - ease(seg(p, 0.908, 0.922)));
  }

  function stateAt(p, tSec) {
    p = clamp(p || 0, 0, 1);
    var st = {};
    st.p = p;
    st.tSec = tSec || 0;

    /* --- price / angle of attack --------------------------------------- */
    var dp;
    if (p < 0.160)      dp = 0;
    else if (p < 0.300) dp = lerp(0, T.SWEEP_DP, ramp(p, 0.160, 0.300));
    else if (p < 0.360) dp = T.SWEEP_DP;
    else if (p < 0.440) dp = lerp(T.SWEEP_DP, T.TEST_DP, ramp(p, 0.360, 0.440));
    else if (p < 0.800) dp = T.TEST_DP;
    else if (p < 0.862) dp = lerp(T.TEST_DP, T.PUSH_DP, ramp(p, 0.800, 0.862));
    else if (p < 0.930) dp = lerp(T.PUSH_DP, 0, ramp(p, 0.862, 0.930));
    else                dp = 0;
    st.dp = dp;
    st.price = T.P0 * (1 + dp);

    var alphaDeg = dp * T.ALPHA_PER_DP;
    st.alphaDeg = alphaDeg;
    st.alpha = alphaDeg * DEG;
    st.ca = Math.cos(st.alpha);
    st.sa = Math.sin(st.alpha);
    st.stall = smoothstep(T.ALPHA_STALL, T.ALPHA_STALL + T.ALPHA_STALL_W, alphaDeg);

    /* --- free stream. Spins up, runs, reverses, settles. ---------------- */
    var U;
    if (p < 0.070)      U = lerp(0.15, 1, ramp(p, 0.000, 0.070));
    else if (p < 0.862) U = 1;
    else if (p < 0.905) U = lerp(1, -1, ramp(p, 0.862, 0.905));
    else if (p < 0.950) U = lerp(-1, 0.55, ramp(p, 0.905, 0.950));
    else                U = 0.55;
    st.U = U;
    st.reversing = smoothstep(0.862, 0.888, p) * (1 - smoothstep(0.905, 0.945, p));

    /* --- staging of the visual furniture -------------------------------- */
    /* Both of these start just above zero so that the very first painted frame
       already has a shape and a wall in it. A section whose opening frame is
       empty looks broken, not atmospheric. */
    st.rails    = ramp(p, -0.012, 0.105);
    st.shape    = ramp(p, -0.030, 0.070);
    st.trials   = ramp(p, 0.170, 0.360);
    st.ghosts   = st.trials * (1 - ramp(p, 0.460, 0.560));
    st.band     = ramp(p, 0.440, 0.560);
    st.calipers = ramp(p, 0.435, 0.575) * (1 - ramp(p, 0.800, 0.860));
    st.surface  = ramp(p, 0.150, 0.230);          // the response-surface inset
    st.observed = ramp(p, 0.600, 0.645) * (1 - ramp(p, 0.930, 0.985));
    st.floor    = smoothstep(0.846, 0.868, p) * (1 - ramp(p, 0.928, 0.968));
    st.restored = ramp(p, 0.930, 0.980);
    st.top      = topOpacity(p);

    /* Exposure ladder. Held at 100% once opened so act five runs at full road. */
    var stage = -1, expo = 0;
    for (var i = 0; i < STAGE_AT.length; i++) {
      if (p >= STAGE_AT[i]) { stage = i; }
    }
    if (stage >= 0) {
      expo = T.STAGES[stage] / 100;
      if (stage < STAGE_AT.length - 1) {
        /* ease between rungs so the aperture opens rather than jumping */
        var nxt = T.STAGES[stage + 1] / 100;
        expo = lerp(expo, nxt, ramp(p, STAGE_AT[stage + 1] - 0.018, STAGE_AT[stage + 1]));
      }
    }
    st.stage = stage;
    st.exposure = expo * st.observed;

    /* --- the numbers ---------------------------------------------------- */
    st.bandLo = BAND_LO;
    st.bandHi = BAND_HI;
    st.obsProfit = profit(dp, T.E_TRUE);
    st.obsPct = (st.obsProfit / BASE_PROFIT - 1) * 100;
    st.crossed = st.obsProfit < FLOOR_PROFIT;

    /* --- colours -------------------------------------------------------- */
    st.bg       = rampColor(BG_STOPS, p);
    st.ink      = rampColor(INK_STOPS, p);
    st.smoke    = rampColor(SMOKE_STOPS, p);
    st.smokeHot = rampColor(SMOKE_HOT_STOPS, p);
    st.obsCol   = rampColor(OBS_STOPS, p);
    st.warn     = rampColor(WARN_STOPS, p);
    st.warnText = rampColor(WARN_TEXT_STOPS, p);
    /* The muted UI colour is a real blend rather than an alpha, so its contrast
       against the background is a number we can check rather than hope about.
       0.90 is the lowest blend that keeps the eyebrow above 4.5:1 everywhere. */
    st.mute     = mixC(st.bg, st.ink, 0.90);

    /* --- act. Driven by `mark`, not by which line happens to be visible, so
       the eyebrow still names the stall during the wordless stretch. ------ */
    var best = 0;
    for (var j = 0; j < ACTS.length; j++) if (p >= ACTS[j].mark) best = j;
    st.act = best;
    st.actOpacity = actOpacity(best, p);

    /* --- readout: at most ONE number on screen at a time ---------------- */
    if (p < ACTS[1].mark) {
      st.read = money2(T.P0); st.unit = ''; st.tone = 'ink'; st.flag = '';
    } else if (p < ACTS[2].mark) {
      st.read = money2(st.price); st.unit = ''; st.tone = 'ink'; st.flag = '';
    } else if (p < ACTS[3].mark) {
      st.read = money0(BAND_LO) + ' ' + ENDASH + ' ' + money0(BAND_HI);
      st.unit = 'per day'; st.tone = 'ink'; st.flag = '';
    } else if (p < 0.930) {
      st.read = money0(st.obsProfit); st.unit = 'per day';
      st.tone = st.crossed ? 'warn' : 'obs';
      st.flag = st.crossed ? 'guardrail' : (st.stage >= 0 ? T.STAGES[st.stage] + '% of products' : '');
      if (st.reversing > 0.35 && !st.crossed) st.flag = 'reverting';
    } else {
      st.read = money2(T.P0); st.unit = ''; st.tone = 'ink'; st.flag = 'restored';
    }

    return st;
  }

  /* The AI's trial scatter: every run the model made before anything shipped.
     Deterministic, so a still and a live frame agree exactly. */
  var TRIALS = (function () {
    var r = rng(0x5eed17);
    var out = [];
    for (var i = 0; i < 260; i++) {
      var dp = r() * T.SWEEP_DP;
      /* triangular draw across the elasticity band: the middle is likelier */
      var e = T.E_BAND[0] + (T.E_BAND[1] - T.E_BAND[0]) * (r() + r()) * 0.5;
      out.push({ dp: dp, e: e, y: profit(dp, e), j: r() });
    }
    return out;
  })();

  /* ===========================================================================
     CSS. One stylesheet, id-guarded and refcounted. Every selector `.pfw-`.
     ========================================================================= */
  var CSS = [
    '.pfw-root{position:relative;display:block;isolation:isolate;',
    '  --pfw-bg:#030818;--pfw-ink:#f3ecde;--pfw-read:#f3ecde;',
    '  --pfw-mute:#b9b3a6;--pfw-line:rgba(243,236,222,.34);',
    '  background:var(--pfw-bg);color:var(--pfw-ink);',
    '  font-family:\'Inter\',system-ui,sans-serif;}',

    '.pfw-track{position:relative;height:' + T.TRACK_VH + 'vh;}',
    '.pfw-stage{position:sticky;top:0;height:100vh;overflow:hidden;}',
    '@supports (height:100svh){.pfw-stage{height:100svh;}}',

    '.pfw-flow,.pfw-chrome{position:absolute;inset:0;width:100%;height:100%;display:block;}',
    '.pfw-chrome{pointer-events:none;}',

    '.pfw-hud{position:absolute;inset:0;display:flex;flex-direction:column;',
    '  justify-content:space-between;gap:16px;pointer-events:none;',
    '  padding:clamp(20px,4.6vw,60px);}',

    '.pfw-top{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;}',

    '.pfw-eyebrow{margin:0;font-size:11px;font-weight:500;line-height:1;',
    '  letter-spacing:.19em;text-transform:uppercase;color:var(--pfw-mute);}',

    '.pfw-readwrap{text-align:right;min-width:0;}',
    '.pfw-readout{display:block;font-weight:300;font-size:clamp(28px,5vw,62px);',
    '  line-height:1;letter-spacing:-.025em;font-variant-numeric:tabular-nums;',
    '  color:var(--pfw-read);white-space:nowrap;}',
    '.pfw-unit{display:block;margin-top:7px;font-size:11px;letter-spacing:.16em;',
    '  text-transform:uppercase;color:var(--pfw-mute);min-height:12px;}',
    '.pfw-flag{display:block;margin-top:5px;font-size:11px;letter-spacing:.16em;',
    '  text-transform:uppercase;color:var(--pfw-read);opacity:.72;min-height:12px;}',

    '.pfw-lines{display:grid;max-width:19ch;}',
    '.pfw-line{grid-area:1/1;margin:0;font-family:\'Hedvig Letters Serif\',Georgia,serif;',
    '  font-weight:400;font-size:clamp(21px,3.5vw,42px);line-height:1.16;',
    '  letter-spacing:-.012em;color:var(--pfw-ink);opacity:0;}',

    /* the run spine: five stations down the right edge */
    '.pfw-spine{position:absolute;right:clamp(20px,4.6vw,60px);top:50%;',
    '  transform:translateY(-50%);display:flex;flex-direction:column;gap:14px;',
    '  pointer-events:none;}',
    '.pfw-node{width:7px;height:7px;border-radius:50%;border:1px solid var(--pfw-line);',
    '  background:transparent;}',
    '.pfw-node[data-on="1"]{background:var(--pfw-read);border-color:var(--pfw-read);}',

    '.pfw-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;',
    '  overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;}',

    /* reduced motion: no pinning, one static frame per act */
    '.pfw-stills{display:none;}',
    '.pfw-root[data-reduced="1"] .pfw-track{display:none;}',
    '.pfw-root[data-reduced="1"] .pfw-stills{display:block;',
    '  padding:clamp(28px,6vw,72px) clamp(20px,4.6vw,60px);}',
    /* Each still carries its own background, because in reduced motion the five
       acts are five separate pictures and each one keeps the light it was lit
       by. The section itself still ends cream. */
    '.pfw-still{margin:0 0 clamp(28px,5vw,56px);padding:clamp(18px,3.6vw,34px);',
    '  border-radius:3px;background:var(--pfw-bg);}',
    '.pfw-still:last-child{margin-bottom:0;}',
    '.pfw-still canvas{display:block;width:100%;height:auto;border-radius:2px;}',
    '.pfw-still .pfw-eyebrow{margin-bottom:14px;}',
    '.pfw-still .pfw-line{position:static;opacity:1;margin:18px 0 0;max-width:19ch;}',
    '.pfw-still .pfw-readout{margin-top:12px;text-align:left;}',
    '.pfw-still .pfw-unit,.pfw-still .pfw-flag{text-align:left;}',

    '@media (max-width:600px){',
    '  .pfw-track{height:' + T.TRACK_VH_SM + 'vh;}',
    '  .pfw-spine{display:none;}',
    '  .pfw-hud{justify-content:flex-end;padding-bottom:clamp(26px,7vw,44px);}',
    '  .pfw-top{flex-direction:column;align-items:flex-start;gap:0;',
    '    position:absolute;left:clamp(20px,4.6vw,60px);top:clamp(20px,4.6vw,60px);}',
    '  .pfw-readwrap{text-align:left;margin-top:12px;}',
    '  .pfw-lines{max-width:16ch;}',
    '}',

    '@media (prefers-reduced-motion:reduce){',
    '  .pfw-line{transition:none;}',
    '}'
  ].join('\n');

  function mountStyle() {
    var el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      el.setAttribute('type', 'text/css');
      el.textContent = CSS;
      (document.head || document.documentElement).appendChild(el);
    }
    liveInstances++;
    return el;
  }
  function unmountStyle() {
    liveInstances = Math.max(0, liveInstances - 1);
    if (liveInstances > 0) return;
    var el = document.getElementById(STYLE_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function el(tag, cls, parent, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }

  /* ===========================================================================
     DRAWING

     Two canvases. The lower one accumulates smoke trails — it is faded toward
     the current background each frame rather than cleared, which is what makes
     a filament read as a filament. The upper one is cleared every frame and
     carries the tunnel furniture, the aerofoil and the instrument.

     Both take a `lay` (layout) and a `st` (state) and never look at anything
     else, so the reduced-motion stills reuse them verbatim.
     ========================================================================= */

  function makeLayout(w, h, small) {
    var chord = clamp(w * T.CHORD_FRAC, T.CHORD_MIN, T.CHORD_MAX);
    var k = chord / CHORD_Z;                        // px per world unit
    var cx = small ? w * 0.50 : w * 0.44;
    var cy = small ? h * 0.42 : h * 0.47;
    var lay = {
      w: w, h: h, small: small, k: k, cx: cx, cy: cy,
      wxMin: (0 - cx) / k, wxMax: (w - cx) / k,
      wyMin: (cy - h) / k, wyMax: (cy - 0) / k
    };
    /* the smoke rake: discrete filaments, the way a real tunnel seeds it */
    var rows = clamp(Math.round(h / T.ROW_PX), T.ROW_MIN, T.ROW_MAX);
    lay.rows = rows;
    lay.rowY = [];
    var spanTop = lay.wyMax * 0.86, spanBot = lay.wyMin * 0.86;
    for (var i = 0; i < rows; i++) {
      lay.rowY.push(lerp(spanTop, spanBot, rows === 1 ? 0.5 : i / (rows - 1)));
    }
    /* the response-surface instrument */
    var iw = small ? Math.max(150, w - 40) : clamp(w * 0.24, 190, 280);
    var ih = small ? 96 : clamp(h * 0.24, 108, 168);
    lay.inset = {
      x: small ? 20 : w - iw - clamp(w * 0.046, 20, 60),
      y: small ? h - ih - 20 : h - ih - clamp(h * 0.10, 46, 118),
      w: iw, h: ih
    };
    return lay;
  }

  function sx(lay, wx) { return lay.cx + wx * lay.k; }
  function sy(lay, wy) { return lay.cy - wy * lay.k; }

  /* --- the aerofoil path, rotated by -alpha into world/screen ------------- */
  function bodyPath(ctx, lay, alpha) {
    var ca = Math.cos(alpha), sa = Math.sin(alpha);
    ctx.beginPath();
    for (var i = 0; i < BODY.length; i += 2) {
      var zx = BODY[i], zy = BODY[i + 1];
      /* aerofoil frame -> world is a rotation by -alpha */
      var wx = zx * ca + zy * sa;
      var wy = -zx * sa + zy * ca;
      var px = sx(lay, wx), py = sy(lay, wy);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function drawChrome(ctx, lay, st) {
    var w = lay.w, h = lay.h;
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    var ink = st.ink, line = rgba(ink, 0.30);

    /* ---- tunnel walls ------------------------------------------------- */
    if (st.rails > 0.01) {
      var inset = h * 0.085;
      var a = st.rails;
      ctx.strokeStyle = rgba(ink, 0.26 * a);
      ctx.lineWidth = 1;
      var yTop = inset, yBot = h - inset;
      var run = w * a;
      ctx.beginPath();
      ctx.moveTo(0, yTop); ctx.lineTo(run, yTop);
      ctx.moveTo(0, yBot); ctx.lineTo(run, yBot);
      ctx.stroke();
      /* station ticks along the walls */
      ctx.strokeStyle = rgba(ink, 0.16 * a);
      ctx.beginPath();
      for (var tx = w * 0.06; tx < run; tx += w * 0.055) {
        ctx.moveTo(tx, yTop); ctx.lineTo(tx, yTop + 7);
        ctx.moveTo(tx, yBot); ctx.lineTo(tx, yBot - 7);
      }
      ctx.stroke();
    }

    /* ---- the smoke rake at the inlet ---------------------------------- */
    if (st.rails > 0.4 && st.U > 0) {
      var rx = sx(lay, lay.wxMin) + 10;
      ctx.strokeStyle = rgba(ink, 0.22 * st.rails);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rx, sy(lay, lay.rowY[0]) - 8);
      ctx.lineTo(rx, sy(lay, lay.rowY[lay.rows - 1]) + 8);
      for (var r = 0; r < lay.rows; r++) {
        var ry = sy(lay, lay.rowY[r]);
        ctx.moveTo(rx, ry); ctx.lineTo(rx + 7, ry);
      }
      ctx.stroke();
    }

    /* ---- ghost fan: every angle the model already tried --------------- */
    if (st.ghosts > 0.01) {
      var n = 7;
      ctx.lineWidth = 1;
      for (var g = 0; g < n; g++) {
        var ga = (g + 1) / n * st.alpha;
        if (Math.abs(ga) < 0.004) continue;
        ctx.strokeStyle = rgba(st.smoke, 0.16 * st.ghosts * (1 - g / (n + 2)));
        bodyPath(ctx, lay, ga);
        ctx.stroke();
      }
    }

    /* ---- the shape ----------------------------------------------------- */
    if (st.shape > 0.01) {
      bodyPath(ctx, lay, st.alpha);
      ctx.fillStyle = rgba(st.bg, 0.92);
      ctx.fill();
      ctx.strokeStyle = rgba(ink, 0.80 * st.shape);
      ctx.lineWidth = 1.4;
      ctx.stroke();

      /* chord line and the free-stream reference, with the angle between them */
      var ca = Math.cos(st.alpha), sa = Math.sin(st.alpha);
      var leX = sx(lay, -2 * T.B * ca), leY = sy(lay, 2 * T.B * sa);
      var teX = sx(lay, 2 * T.B * ca), teY = sy(lay, -2 * T.B * sa);
      ctx.strokeStyle = rgba(ink, 0.20 * st.shape);
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(leX, leY); ctx.lineTo(teX, teY);
      ctx.moveTo(teX, teY); ctx.lineTo(teX + lay.k * 0.9, teY);
      ctx.stroke();
      ctx.setLineDash([]);

      if (st.alphaDeg > 0.6) {
        ctx.strokeStyle = rgba(st.stall > 0.5 ? st.warn : st.smokeHot,
                               0.55 * Math.min(1, st.alphaDeg / 6));
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(teX, teY, lay.k * 0.62, -st.alpha, 0);
        ctx.stroke();
      }
    }

    /* ---- separation marker -------------------------------------------- */
    if (st.stall > 0.05) {
      var sepW = lerp(1.4, -0.9, st.stall);          // walks forward as it stalls
      var caS = Math.cos(st.alpha), saS = Math.sin(st.alpha);
      var upper = 0.42;                              // above the chord
      var wxS = sepW * caS + upper * saS;
      var wyS = -sepW * saS + upper * caS;
      var pxS = sx(lay, wxS), pyS = sy(lay, wyS);
      ctx.fillStyle = rgba(st.warn, 0.9 * st.stall);
      ctx.beginPath(); ctx.arc(pxS, pyS, 3.1, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = rgba(st.warn, 0.34 * st.stall);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(pxS, pyS, 3.1 + 6 * st.stall, 0, Math.PI * 2); ctx.stroke();
    }

    /* ---- calipers: the instrument closing on the measured band -------- */
    if (st.calipers > 0.01) {
      var c = st.calipers;
      var half = lerp(1.45, 0.42, ease(c)) * lay.k;
      var x0 = sx(lay, 2.3), x1 = sx(lay, Math.min(lay.wxMax - 0.25, 4.4));
      var yc = sy(lay, 0);
      ctx.strokeStyle = rgba(ink, 0.42 * c);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, yc - half); ctx.lineTo(x1, yc - half);
      ctx.moveTo(x0, yc + half); ctx.lineTo(x1, yc + half);
      ctx.moveTo(x1, yc - half); ctx.lineTo(x1, yc + half);
      ctx.stroke();
      ctx.fillStyle = rgba(st.smoke, 0.10 * c);
      ctx.fillRect(x0, yc - half, x1 - x0, half * 2);
    }

    /* ---- exposure aperture: the road opening 5 -> 100% ----------------- */
    if (st.exposure > 0.005) {
      var ax = sx(lay, lay.wxMin) + 24;
      var frac = Math.max(0.06, st.exposure);
      var hh = (lay.wyMax * 0.86) * frac * lay.k;
      var ay = sy(lay, 0);
      ctx.strokeStyle = rgba(st.obsCol, 0.55 * st.observed);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ax, ay - hh); ctx.lineTo(ax, ay + hh);
      ctx.stroke();
      ctx.strokeStyle = rgba(st.obsCol, 0.22 * st.observed);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ax - 6, ay - hh); ctx.lineTo(ax + 6, ay - hh);
      ctx.moveTo(ax - 6, ay + hh); ctx.lineTo(ax + 6, ay + hh);
      ctx.stroke();
    }

    /* ---- vortex cores, very faint: the street made countable ---------- */
    if (st.vortices && st.stall > 0.2) {
      for (var vi = 0; vi < st.vortices.length; vi++) {
        var q = st.vortices[vi];
        var fade = clamp(1 - q.age / T.SHED_LIFE, 0, 1);
        ctx.strokeStyle = rgba(q.g > 0 ? st.smokeHot : st.warn, 0.16 * fade * st.stall);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sx(lay, q.x), sy(lay, q.y), 5 + 16 * (1 - fade), 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    drawInset(ctx, lay, st);
  }

  /* --- the response surface: price against profit per day ---------------- */
  function drawInset(ctx, lay, st) {
    if (st.surface < 0.01) return;
    var R = lay.inset, o = st.surface;
    var xLo = T.P0 * 0.97, xHi = T.P0 * (1 + T.SWEEP_DP) * 1.02;
    var yLo = 340, yHi = 800;
    function ix(price) { return R.x + (price - xLo) / (xHi - xLo) * R.w; }
    function iy(v) { return R.y + R.h - (clamp(v, yLo, yHi) - yLo) / (yHi - yLo) * R.h; }

    ctx.save();
    ctx.globalAlpha = o;

    /* frame */
    ctx.strokeStyle = rgba(st.ink, 0.22);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(R.x, R.y); ctx.lineTo(R.x, R.y + R.h); ctx.lineTo(R.x + R.w, R.y + R.h);
    ctx.stroke();

    /* baseline and guardrail floor */
    ctx.strokeStyle = rgba(st.ink, 0.20);
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(R.x, iy(BASE_PROFIT)); ctx.lineTo(R.x + R.w, iy(BASE_PROFIT));
    ctx.stroke();
    ctx.strokeStyle = rgba(st.warn, 0.30 + 0.55 * st.floor);
    ctx.beginPath();
    ctx.moveTo(R.x, iy(FLOOR_PROFIT)); ctx.lineTo(R.x + R.w, iy(FLOOR_PROFIT));
    ctx.stroke();
    ctx.setLineDash([]);

    /* the AI's trials */
    if (st.trials > 0.005) {
      var n = Math.floor(TRIALS.length * st.trials);
      ctx.fillStyle = rgba(st.smoke, 0.42);
      for (var i = 0; i < n; i++) {
        var t = TRIALS[i];
        ctx.fillRect(ix(T.P0 * (1 + t.dp)) - 0.75, iy(t.y) - 0.75, 1.5, 1.5);
      }
    }

    /* the band the trials resolve to */
    if (st.band > 0.005) {
      var steps = 46;
      var upto = st.band;
      ctx.beginPath();
      var j;
      for (j = 0; j <= steps; j++) {
        var dpj = (j / steps) * T.SWEEP_DP * upto;
        var pj = ix(T.P0 * (1 + dpj));
        var vy = iy(profit(dpj, T.E_BAND[1]));
        if (j === 0) ctx.moveTo(pj, vy); else ctx.lineTo(pj, vy);
      }
      for (j = steps; j >= 0; j--) {
        var dpk = (j / steps) * T.SWEEP_DP * upto;
        ctx.lineTo(ix(T.P0 * (1 + dpk)), iy(profit(dpk, T.E_BAND[0])));
      }
      ctx.closePath();
      ctx.fillStyle = rgba(st.smoke, 0.20);
      ctx.fill();
      ctx.strokeStyle = rgba(st.smoke, 0.42);
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    /* where we actually are */
    if (st.observed > 0.005) {
      var px = ix(st.price), py = iy(st.obsProfit);
      var col = st.crossed ? st.warn : st.obsCol;
      ctx.globalAlpha = o * st.observed;
      ctx.strokeStyle = rgba(col, 0.34);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, R.y + R.h); ctx.lineTo(px, py);
      ctx.stroke();
      ctx.fillStyle = rgba(col, 1);
      ctx.beginPath(); ctx.arc(px, py, 3.2, 0, Math.PI * 2); ctx.fill();
      if (st.floor > 0.02) {
        ctx.strokeStyle = rgba(st.warn, 0.7 * st.floor);
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(px, py, 3.2 + 7 * st.floor, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* ===========================================================================
     window.initPfSimB
     ========================================================================= */

  function initPfSimB(root) {
    if (!root) throw new Error('initPfSimB(root): root element required');

    var uid = 'pfw' + (++uidSeq);
    mountStyle();

    var reduceQ = (window.matchMedia)
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : { matches: false };

    /* =======================================================================
       BUILD
       ===================================================================== */
    var section = el('section', 'pfw-root');
    section.setAttribute('aria-label', 'How Priceflag tests a price');

    var track = el('div', 'pfw-track', section);
    var stage = el('div', 'pfw-stage', track);

    var flowC = el('canvas', 'pfw-flow', stage);
    var chromeC = el('canvas', 'pfw-chrome', stage);
    flowC.setAttribute('aria-hidden', 'true');
    chromeC.setAttribute('aria-hidden', 'true');

    var hud = el('div', 'pfw-hud', stage);
    var top = el('div', 'pfw-top', hud);
    var eyebrow = el('p', 'pfw-eyebrow', top, ACTS[0].label);
    var readWrap = el('div', 'pfw-readwrap', top);
    var readout = el('strong', 'pfw-readout', readWrap, money2(T.P0));
    var unitEl = el('span', 'pfw-unit', readWrap, '');
    var flagEl = el('span', 'pfw-flag', readWrap, '');
    readout.setAttribute('aria-hidden', 'true');
    unitEl.setAttribute('aria-hidden', 'true');
    flagEl.setAttribute('aria-hidden', 'true');

    var lines = el('div', 'pfw-lines', hud);
    var lineEls = ACTS.map(function (a) {
      var n = el('p', 'pfw-line', lines, a.line);
      n.id = uid + '-' + a.key;
      return n;
    });

    var spine = el('div', 'pfw-spine', stage);
    spine.setAttribute('aria-hidden', 'true');
    var nodes = ACTS.map(function () { return el('span', 'pfw-node', spine); });

    var stills = el('div', 'pfw-stills', section);
    var stillsBuilt = false;

    var sr = el('p', 'pfw-sr', section, '');
    sr.setAttribute('aria-live', 'polite');
    sr.setAttribute('aria-atomic', 'true');

    root.appendChild(section);

    /* =======================================================================
       CANVAS + SIMULATION STATE
       ===================================================================== */
    var fctx = flowC.getContext('2d');
    var cctx = chromeC.getContext('2d');

    var lay = makeLayout(1, 1, false);
    var dpr = 1;
    var particles = [];
    var obs = [];
    var vortices = [];
    var shedClock = 0, shedSide = 1;
    var scratch = vec();
    var prand = rng(0xa17f0);

    var st = stateAt(0, 0);
    st.vortices = vortices;

    var destroyed = false;
    var rafId = 0, watchdogId = 0, announceId = 0, resizeId = 0;
    var lastRafAt = 0, lastTickAt = 0, lastPaintAt = 0;
    var lastBg = st.bg.slice();
    var announcedAct = -1;
    var reduced = !!reduceQ.matches;

    function now() {
      return (window.performance && window.performance.now)
        ? window.performance.now() : Date.now();
    }

    /* --- particle pool ---------------------------------------------------- */
    function seedParticle(pt, i, spread) {
      var row = i % Math.max(1, lay.rows);
      pt.row = row;
      pt.y = lay.rowY[row] + (prand() - 0.5) * 0.05;
      var span = lay.wxMax - lay.wxMin;
      pt.x = lay.wxMin + (spread ? prand() * span : prand() * span * 0.04);
      pt.px = pt.x; pt.py = pt.y;
      pt.life = prand() * 3;
      return pt;
    }

    function seedObs(pt, i, spread) {
      /* observed orders enter through the aperture, centred, and are sparser */
      var f = Math.max(0.06, st.exposure || 0.06);
      pt.y = (prand() * 2 - 1) * lay.wyMax * 0.86 * f;
      var span = lay.wxMax - lay.wxMin;
      pt.x = lay.wxMin + (spread ? prand() * span : prand() * span * 0.05);
      pt.px = pt.x; pt.py = pt.y;
      pt.life = prand() * 2.4;
      return pt;
    }

    function buildPools(spread) {
      var target = clamp(Math.round(lay.w * lay.h / T.PX_PER_PARTICLE),
                         T.N_MIN, T.N_MAX);
      particles.length = 0;
      for (var i = 0; i < target; i++) {
        particles.push(seedParticle({}, i, spread !== false));
      }
      obs.length = 0;
      var no = lay.small ? Math.round(T.N_OBS * 0.6) : T.N_OBS;
      for (var j = 0; j < no; j++) obs.push(seedObs({}, j, spread !== false));
    }

    /* --- one simulation step --------------------------------------------- */
    function advect(pt, dt, isObs) {
      var h = dt * T.FLOW_SPEED;
      velocity(st, pt.x, pt.y, scratch);
      if (scratch.inside) { pt.x = scratch.px; pt.y = scratch.py; }
      var u1 = scratch.u, v1 = scratch.v;
      velocity(st, pt.x + u1 * h * 0.5, pt.y + v1 * h * 0.5, scratch);
      var u2 = scratch.u, v2 = scratch.v;

      pt.px = pt.x; pt.py = pt.y;
      pt.x += u2 * h;
      pt.y += v2 * h;
      pt.sp = Math.sqrt(u2 * u2 + v2 * v2);
      pt.life += dt;

      var pad = 0.35;
      var out = (pt.x > lay.wxMax + pad) || (pt.x < lay.wxMin - pad) ||
                (pt.y > lay.wyMax + pad) || (pt.y < lay.wyMin - pad) ||
                pt.life > 26;
      if (out) {
        if (isObs) seedObs(pt, (prand() * 1e6) | 0, false);
        else seedParticle(pt, (prand() * 1e6) | 0, false);
        /* enter from whichever end the stream is coming from */
        var span = lay.wxMax - lay.wxMin;
        if (st.U < 0) pt.x = lay.wxMax - prand() * span * 0.05;
        pt.px = pt.x; pt.py = pt.y;
      }
    }

    /* A frame-free view of the same state, used to convect the vortices in the
       potential field alone: a vortex must not induce itself. Reused rather
       than allocated, because this runs once per vortex per step. */
    var convectState = { ca: 1, sa: 0, U: 1, alpha: 0, stall: 0, tSec: 0, vortices: null };

    function shed(dt) {
      /* Vortices are shed alternately from the separation point once the flow
         has broken away. That alternation is the Karman street. */
      convectState.ca = st.ca; convectState.sa = st.sa; convectState.U = st.U;
      convectState.alpha = st.alpha; convectState.tSec = st.tSec;
      for (var i = vortices.length - 1; i >= 0; i--) {
        var q = vortices[i];
        velocity(convectState, q.x, q.y, scratch);
        q.x += scratch.u * dt * T.FLOW_SPEED * 0.92;
        q.y += scratch.v * dt * T.FLOW_SPEED * 0.92;
        q.age += dt;
        q.g = q.g0 * clamp(1 - q.age / T.SHED_LIFE, 0, 1);
        if (q.age > T.SHED_LIFE || q.x > lay.wxMax + 1.2 || q.x < lay.wxMin - 1.2) {
          vortices.splice(i, 1);
        }
      }
      if (st.stall < 0.06 || Math.abs(st.U) < 0.05) return;
      shedClock += dt * 1000 * (0.5 + st.stall);
      var period = T.SHED_MS;
      while (shedClock > period && vortices.length < T.VORTEX_MAX) {
        shedClock -= period;
        shedSide = -shedSide;
        var sepW = lerp(1.4, -0.9, st.stall);
        var off = 0.40 * shedSide;
        var wx = sepW * st.ca + off * st.sa;
        var wy = -sepW * st.sa + off * st.ca;
        var g0 = T.SHED_GAMMA * st.stall * shedSide * (st.U >= 0 ? 1 : -1);
        vortices.push({ x: wx, y: wy, g: g0, g0: g0, age: 0 });
      }
    }

    function simulate(dt) {
      st.vortices = vortices;
      shed(dt);
      var i;
      for (i = 0; i < particles.length; i++) advect(particles[i], dt, false);
      var nObs = Math.round(obs.length * clamp(st.exposure, 0, 1));
      for (i = 0; i < nObs; i++) advect(obs[i], dt, true);
      st.nObs = nObs;
    }

    /* --- the trail buffer ------------------------------------------------- */
    function fadeFlow(dt) {
      var a = 1 - Math.exp(-dt / T.TRAIL_TAU);
      /* If the background moved a long way since the last frame, catch up in
         essentially one step. This matters more than it looks: while the
         document reports itself hidden, rAF is starved AND setInterval is
         clamped to about a second, so a jumped scroll position may only get one
         or two frames before the reader looks at it. At normal scroll speeds
         the per-frame delta is a couple of units, this term stays below the
         time constant, and the trails are untouched. */
      var d = Math.abs(st.bg[0] - lastBg[0]) + Math.abs(st.bg[1] - lastBg[1]) +
              Math.abs(st.bg[2] - lastBg[2]);
      a = Math.max(a, Math.min(0.95, d / 22));
      lastBg[0] = st.bg[0]; lastBg[1] = st.bg[1]; lastBg[2] = st.bg[2];
      fctx.globalCompositeOperation = 'source-over';
      fctx.fillStyle = rgba(st.bg, a);
      fctx.fillRect(0, 0, lay.w, lay.h);
    }

    /* Schlieren banding. A schlieren photograph does not have a continuous
       palette either — it has fringes — so quantising speed into a handful of
       bands is both faster and more truthful. It also collapses several hundred
       strokeStyle changes per frame down to BANDS of them, which is the
       difference between 60fps and not. */
    var BANDS = 7;
    var bandStyle = new Array(BANDS);

    function drawParticles() {
      var i, pt, b;
      fctx.lineWidth = lay.small ? 1.0 : 1.15;
      fctx.lineCap = 'round';

      for (b = 0; b < BANDS; b++) {
        var t = b / (BANDS - 1);
        bandStyle[b] = rgba(mixC(st.smoke, st.smokeHot, t), 0.30 + 0.45 * t);
      }
      for (i = 0; i < particles.length; i++) {
        pt = particles[i];
        pt.band = (smoothstep(0.35, 1.9, pt.sp || 0) * (BANDS - 1) + 0.5) | 0;
      }
      for (b = 0; b < BANDS; b++) {
        fctx.strokeStyle = bandStyle[b];
        fctx.beginPath();
        var any = false;
        for (i = 0; i < particles.length; i++) {
          pt = particles[i];
          if (pt.band !== b || pt.life < 0.10) continue;   // just-spawned = invisible
          fctx.moveTo(sx(lay, pt.px), sy(lay, pt.py));
          fctx.lineTo(sx(lay, pt.x), sy(lay, pt.y));
          any = true;
        }
        if (any) fctx.stroke();
      }
      /* observed orders: fewer, brighter, unmistakably a different substance */
      var n = st.nObs || 0;
      if (n > 0) {
        fctx.lineWidth = lay.small ? 1.7 : 2.1;
        fctx.strokeStyle = rgba(st.obsCol, 0.85 * clamp(st.observed, 0, 1));
        fctx.beginPath();
        for (i = 0; i < n; i++) {
          pt = obs[i];
          if (pt.life < 0.12) continue;
          fctx.moveTo(sx(lay, pt.px), sy(lay, pt.py));
          fctx.lineTo(sx(lay, pt.x), sy(lay, pt.y));
        }
        fctx.stroke();
      }
    }

    /* --- HUD ------------------------------------------------------------- */
    function paintHud() {
      section.style.setProperty('--pfw-bg', rgb(st.bg));
      section.style.setProperty('--pfw-ink', rgb(st.ink));
      section.style.setProperty('--pfw-mute', rgb(st.mute));
      section.style.setProperty('--pfw-line', rgba(st.ink, 0.40));
      var read = st.tone === 'obs' ? st.obsCol
               : (st.tone === 'warn' ? st.warnText : st.ink);
      section.style.setProperty('--pfw-read', rgb(read));

      eyebrow.textContent = ACTS[st.act].label;
      readout.textContent = st.read;
      unitEl.textContent = st.unit;
      flagEl.textContent = st.flag;
      /* The instrument corner steps aside while the tunnel floods with light,
         so no numeral is ever asked to be legible mid-crossing. */
      top.style.opacity = st.top.toFixed(3);

      for (var i = 0; i < lineEls.length; i++) {
        var o = actOpacity(i, st.p);
        lineEls[i].style.opacity = o.toFixed(3);
        lineEls[i].setAttribute('aria-hidden', o < 0.5 ? 'true' : 'false');
        nodes[i].setAttribute('data-on', i <= st.act ? '1' : '0');
      }
    }

    function scheduleAnnounce() {
      if (announcedAct === st.act) return;
      announcedAct = st.act;
      var say = ACTS[st.act].say;
      clearTimeout(announceId);
      announceId = setTimeout(function () {
        announceId = 0;
        if (!destroyed) sr.textContent = say;
      }, T.ANNOUNCE_MS);
    }

    /* --- scroll progress -------------------------------------------------- */
    /* Default true, and only ever set false by a measurement we already had to
       take. Nothing here waits on an IntersectionObserver, because in this
       environment an IntersectionObserver may never fire at all. */
    var onScreen = true;

    function progress() {
      var r = track.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight || 1;
      var total = r.height - vh;
      var p = total > 4 ? (-r.top) / total : (r.top < 0 ? 1 : 0);
      /* onScreen is read from the same rect, so nothing waits on an observer */
      onScreen = r.bottom > -80 && r.top < vh + 80;
      return clamp(p, 0, 1);
    }

    /* =======================================================================
       THE TICK. Wall-clock driven, no early returns that skip the paint.
       ===================================================================== */
    function tick(t) {
      if (destroyed) return;
      var dt = lastTickAt ? (t - lastTickAt) / 1000 : 1 / 60;
      lastTickAt = t;
      if (!(dt > 0)) dt = 1 / 60;
      dt = Math.min(dt, T.DT_MAX);

      var p = progress();
      var prev = st;
      st = stateAt(p, (prev.tSec || 0) + dt);
      st.vortices = vortices;
      st.nObs = prev.nObs || 0;

      paintHud();
      scheduleAnnounce();

      if (reduced) { lastPaintAt = t; return; }

      /* Even off screen we keep the buffer coherent, but cheaply: no advection,
         no fade, just leave the last good frame alone. */
      if (onScreen) {
        simulate(dt);
        fadeFlow(dt);
        drawParticles();
        drawChrome(cctx, lay, st);
      }
      lastPaintAt = t;
    }

    function frame() {
      rafId = 0;
      if (destroyed) return;
      lastRafAt = now();
      tick(lastRafAt);
      if (window.requestAnimationFrame) rafId = window.requestAnimationFrame(frame);
    }

    /* The watchdog. It does nothing while real frames are arriving and becomes
       the entire animation when they are not, which — with document.hidden
       true — is the normal case here. */
    function beat() {
      if (destroyed) return;
      var t = now();
      if (t - lastRafAt < T.RAF_QUIET_MS) return;   // rAF is healthy, stand down
      tick(t);
    }

    /* =======================================================================
       LAYOUT / RESIZE. Sizes the canvases and then RENDERS, synchronously,
       warming the trail buffer so a resize never leaves an empty frame.
       ===================================================================== */
    function measure() {
      var r = stage.getBoundingClientRect();
      var w = Math.max(1, Math.round(r.width || stage.clientWidth || window.innerWidth || 1));
      var h = Math.max(1, Math.round(r.height || stage.clientHeight || window.innerHeight || 1));
      return { w: w, h: h };
    }

    function layout() {
      var m = measure();
      dpr = Math.min(2, (window.devicePixelRatio || 1));
      lay = makeLayout(m.w, m.h, m.w <= 600);

      flowC.width = Math.round(m.w * dpr);
      flowC.height = Math.round(m.h * dpr);
      chromeC.width = flowC.width;
      chromeC.height = flowC.height;
      fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      /* The buffer was cleared by the resize. Fill it with the live background
         so the very next frame is correct even if nothing else ever runs. */
      fctx.globalCompositeOperation = 'source-over';
      fctx.fillStyle = rgb(st.bg);
      fctx.fillRect(0, 0, lay.w, lay.h);

      buildPools(true);
    }

    /* Run a burst of steps so trails exist immediately rather than after a
       second of real frames that may never come. */
    function warm(steps) {
      var n = steps || T.WARM_STEPS;
      for (var i = 0; i < n; i++) {
        simulate(1 / 60);
        fadeFlow(1 / 60);
        drawParticles();
      }
      drawChrome(cctx, lay, st);
    }

    function hardRender(steps) {
      st = stateAt(progress(), st.tSec || 0);
      st.vortices = vortices;
      paintHud();
      if (reduced) { renderStills(); return; }
      layout();
      warm(steps);
      lastPaintAt = now();
    }

    function onResize() {
      if (destroyed) return;
      /* Paint FIRST and debounce second — a resize may never be followed by a
         frame. The immediate pass warms the trail buffer lightly so a drag stays
         cheap; the settled pass warms it properly. */
      hardRender(8);
      clearTimeout(resizeId);
      resizeId = setTimeout(function () {
        resizeId = 0;
        if (!destroyed) hardRender();
      }, 110);
    }

    /* =======================================================================
       REDUCED MOTION: no pinning, no particles. Five static frames, each drawn
       with integrated streamlines rather than advected ones, and the measured
       band shown on every one from act three onward.
       ===================================================================== */
    /* The five representative frames. The last one is the moment the guardrail
       is breached rather than a moment during the revert — a single static
       picture of act five has to show the stall, not its aftermath. */
    var STILL_P = [0.07, 0.30, 0.52, 0.72, 0.858];

    function buildStills() {
      if (stillsBuilt) return;
      stillsBuilt = true;
      for (var i = 0; i < ACTS.length; i++) {
        var art = el('article', 'pfw-still', stills);
        var c = el('canvas', null, art);
        c.setAttribute('aria-hidden', 'true');
        el('p', 'pfw-eyebrow', art, ACTS[i].label);
        var rw = el('div', 'pfw-readwrap', art);
        el('strong', 'pfw-readout', rw, '');
        el('span', 'pfw-unit', rw, '');
        el('span', 'pfw-flag', rw, '');
        el('p', 'pfw-line', art, ACTS[i].line);
        art.__canvas = c;
      }
    }

    function drawStreamlines(ctx, l, s) {
      /* Integrate a filament from each rake row. Same velocity field, no
         particles, no time — a schlieren photograph rather than a film. */
      ctx.lineWidth = 1.1;
      ctx.lineCap = 'round';
      var steps = 260, h = 0.032 * T.FLOW_SPEED;
      for (var r = 0; r < l.rows; r++) {
        var x = (s.U >= 0 ? l.wxMin : l.wxMax) + (s.U >= 0 ? 0.05 : -0.05);
        var y = l.rowY[r];
        ctx.beginPath();
        ctx.moveTo(sx(l, x), sy(l, y));
        for (var k = 0; k < steps; k++) {
          velocity(s, x, y, scratch);
          if (scratch.inside) { x = scratch.px; y = scratch.py; }
          var u1 = scratch.u, v1 = scratch.v;
          velocity(s, x + u1 * h * 0.5, y + v1 * h * 0.5, scratch);
          x += scratch.u * h; y += scratch.v * h;
          if (x > l.wxMax + 0.2 || x < l.wxMin - 0.2 ||
              y > l.wyMax + 0.2 || y < l.wyMin - 0.2) break;
          ctx.lineTo(sx(l, x), sy(l, y));
        }
        var t = 0.30 + 0.30 * (1 - Math.abs(l.rowY[r]) / (l.wyMax || 1));
        ctx.strokeStyle = rgba(s.smoke, t);
        ctx.stroke();
      }
    }

    function renderStills() {
      buildStills();
      var kids = stills.children;
      for (var i = 0; i < kids.length; i++) {
        var art = kids[i];
        var c = art.__canvas;
        var w = Math.max(240, Math.round(art.clientWidth || stills.clientWidth || 320));
        var h = Math.round(clamp(w * 0.54, 190, 430));
        var d = Math.min(2, window.devicePixelRatio || 1);
        c.style.height = h + 'px';
        c.width = Math.round(w * d);
        c.height = Math.round(h * d);
        var ctx = c.getContext('2d');
        ctx.setTransform(d, 0, 0, d, 0, 0);

        var s = stateAt(STILL_P[i], 0);
        /* Stills always carry the resolved band, so the honest range is visible
           even to a reader who never sees a single frame of motion. */
        s.band = 1;
        s.surface = Math.max(s.surface, 0.9);
        s.vortices = null;
        s.calipers = Math.max(s.calipers, i >= 2 ? 1 : 0);

        /* The last still is a composite, and deliberately so. Its physics and
           its numbers are the breach at p=0.858; its LIGHT is the end of the
           section, because the section has to leave the page cream however the
           reader has their motion settings. A film can show the stall and then
           the lights coming up; a photograph has to do both at once. */
        if (i === ACTS.length - 1) {
          var end = stateAt(1, 0);
          s.bg = end.bg; s.ink = end.ink; s.mute = end.mute;
          s.smoke = end.smoke; s.smokeHot = end.smokeHot;
          s.obsCol = end.obsCol; s.warn = end.warn; s.warnText = end.warnText;
        }
        var l = makeLayout(w, h, w <= 600);

        ctx.fillStyle = rgb(s.bg);
        ctx.fillRect(0, 0, w, h);
        drawStreamlines(ctx, l, s);
        drawChrome(ctx, l, s);

        art.style.setProperty('--pfw-bg', rgb(s.bg));
        art.style.setProperty('--pfw-ink', rgb(s.ink));
        art.style.setProperty('--pfw-mute', rgb(s.mute));
        art.style.setProperty('--pfw-line', rgba(s.ink, 0.45));
        art.style.setProperty('--pfw-read',
          rgb(s.tone === 'obs' ? s.obsCol : (s.tone === 'warn' ? s.warnText : s.ink)));
        art.querySelector('.pfw-readout').textContent = s.read;
        art.querySelector('.pfw-unit').textContent = s.unit;
        art.querySelector('.pfw-flag').textContent = s.flag;
      }
      /* The section as a whole ends light, whatever the reader's motion setting. */
      section.style.setProperty('--pfw-bg', rgb(stateAt(1, 0).bg));
      section.style.setProperty('--pfw-ink', rgb(stateAt(1, 0).ink));
    }

    function applyReduced() {
      reduced = !!reduceQ.matches;
      section.setAttribute('data-reduced', reduced ? '1' : '0');
      if (reduced) {
        stopRaf();
        if (watchdogId) { clearInterval(watchdogId); watchdogId = 0; }
        st = stateAt(progress(), st.tSec || 0);
        paintHud();
        renderStills();
      } else {
        hardRender();
        startLoop();
      }
    }

    /* =======================================================================
       WIRING
       ===================================================================== */
    var listeners = [];
    function on(target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      listeners.push([target, type, fn, opts]);
    }

    function stopRaf() {
      if (rafId && window.cancelAnimationFrame) window.cancelAnimationFrame(rafId);
      rafId = 0;
    }

    function startLoop() {
      stopRaf();
      if (watchdogId) clearInterval(watchdogId);
      if (reduced) return;
      watchdogId = setInterval(beat, T.WATCHDOG_MS);
      if (window.requestAnimationFrame) rafId = window.requestAnimationFrame(frame);
    }

    function onScroll() {
      if (destroyed || reduced) return;
      /* Progress must never look stale. If the loop has gone quiet, paint from
         here — this is the path that keeps the section correct when rAF and the
         interval are both being throttled. */
      var t = now();
      if (t - lastPaintAt > T.SCROLL_FORCE_MS) tick(t);
    }

    on(window, 'scroll', onScroll, { passive: true });
    on(window, 'resize', onResize);
    on(window, 'orientationchange', onResize);

    function onVisibility() {
      if (destroyed) return;
      hardRender();                        // repaint on the way through, always
      if (!reduced) startLoop();
    }
    on(document, 'visibilitychange', onVisibility);

    var ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(function () { onResize(); });
      try { ro.observe(stage); } catch (e) { ro = null; }
    }

    function onReduceChange() { if (!destroyed) applyReduced(); }
    if (reduceQ.addEventListener) {
      reduceQ.addEventListener('change', onReduceChange);
      listeners.push([reduceQ, 'change', onReduceChange, undefined]);
    } else if (reduceQ.addListener) {
      reduceQ.addListener(onReduceChange);
    }

    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(function () {
        if (!destroyed) onResize();
      })['catch'](function () { /* best effort */ });
    }

    /* First paint. Synchronous: the section is fully rendered before
       initPfSimB returns, with or without a working rAF. */
    section.setAttribute('data-reduced', reduced ? '1' : '0');
    if (reduced) {
      st = stateAt(0, 0);
      paintHud();
      renderStills();
    } else {
      hardRender();
      startLoop();
    }

    /* =======================================================================
       CLEANUP
       ===================================================================== */
    return function cleanup() {
      if (destroyed) return;
      destroyed = true;

      stopRaf();
      if (watchdogId) { clearInterval(watchdogId); watchdogId = 0; }
      if (announceId) { clearTimeout(announceId); announceId = 0; }
      if (resizeId) { clearTimeout(resizeId); resizeId = 0; }

      if (ro && ro.disconnect) ro.disconnect();
      ro = null;

      for (var i = 0; i < listeners.length; i++) {
        var L = listeners[i];
        if (L[0] && L[0].removeEventListener) L[0].removeEventListener(L[1], L[2], L[3]);
      }
      listeners.length = 0;
      if (reduceQ.removeListener && !reduceQ.removeEventListener) {
        reduceQ.removeListener(onReduceChange);
      }

      particles.length = 0;
      obs.length = 0;
      vortices.length = 0;

      if (section.parentNode) section.parentNode.removeChild(section);
      unmountStyle();
    };
  }

  /* Read-only test hooks. The whole timeline and the whole flow solver can be
     driven from node with no DOM at all, which is how this file is verified —
     screenshots are not trustworthy in this environment. */
  initPfSimB.stateAt = stateAt;
  initPfSimB.model = { orders: orders, profit: profit,
                       base: BASE_PROFIT, floor: FLOOR_PROFIT,
                       bandLo: BAND_LO, bandHi: BAND_HI };
  initPfSimB.flow = { velocity: velocity, A: A_RAD, thetaTE: THETA_TE, body: BODY };
  initPfSimB.T = T;
  initPfSimB.ACTS = ACTS;
  initPfSimB.actOpacity = actOpacity;
  initPfSimB.topOpacity = topOpacity;

  window.initPfSimB = initPfSimB;
})();
