/* =====================================================================
   Priceflag — hero platform stack
   ---------------------------------------------------------------------
   Usage:   var cleanup = window.initPfHeroLogos(rootElementOrSelector);
            cleanup();            // removes DOM and the stylesheet ref

   Exactly one global is created: window.initPfHeroLogos.
   Every selector in the injected stylesheet is prefixed `.pfhl-`.
   Zero dependencies. No CDN. No imports. No pre-existing markup required.

   WHAT THIS IS --------------------------------------------------------
   The little cluster of overlapping round platform badges that sits at
   the head of the hero eyebrow, ahead of "Intelligence for ecommerce".
   Three are on screen at rest, overlapping left to right; every couple
   of seconds the whole row shuffles one place to the left — the leftmost
   badge shrinks away, the rest slide over, and a new platform grows in
   on the right. Six platforms cycle through the three slots.

   The badges are cream discs carrying the same six marks the rest of the
   site uses: inline SVG, simplified geometric interpretations rather
   than traced brand artwork, all monochrome.

   HOW THE SHUFFLE IS BUILT --------------------------------------------
   Not as a JS conveyor that appends a node and transitions it — see the
   environment note. It is six badges that never move in the DOM, each
   running ONE keyframe loop, staggered by a negative animation-delay of
   a sixth of the cycle each. The keyframes walk a badge through four
   places — in at slot 3, then 2, 1, 0, then out past the left — holding
   still between moves so the row steps rather than drifts. Each badge is
   invisible for the half of the cycle it spends off the ends, which is
   what keeps exactly three on screen at any moment.

   z-index rides along in the same keyframes, highest at the right, so a
   badge is always overlapped by the one that entered after it.

   ENVIRONMENT NOTE ----------------------------------------------------
   In the target environment `document.hidden` is permanently true, which
   starves requestAnimationFrame AND CSS transitions. So the shuffle is a
   pure CSS animation and nothing here measures, ticks or schedules. A
   starved animation still paints the frame its delay puts it on, so the
   cluster degrades to a correct, static, three-badge stack rather than
   to an empty box or a pile of six overlapping discs.
   ===================================================================== */

window.initPfHeroLogos = (function () {
  'use strict';

  /* ---- tunables ---------------------------------------------------- */
  var CFG = {
    SLOT_SEC: 2.4,     // how long a badge rests in one slot
    SLOTS: 6           // badges in the loop; 3 of them on screen at a time
  };

  var STYLE_ID = 'pfhl-styles';

  /* ---- platform marks -------------------------------------------------
     One shared 32x32 viewBox so every mark lands on the same optical
     size. Shopify is the site's existing bag glyph (also used in the
     footer), scaled into that box; the rest are simplified geometric
     interpretations drawn here — recognisable silhouettes rather than
     reproductions of trademarked artwork. All monochrome, currentColor.

     `name` is the badge's accessible name; `key` selects the badge's brand
     tint in the CSS, and keeps these marks interchangeable with the rest
     of the site's platform artwork. */

  var SHOPIFY_PATH = 'M388.3 104.1a4.66 4.66 0 0 0-4.4-4c-2 0-37.2-.8-37.2-.8s-21.6-20.8-29.6-28.8V503.2L442.8 472S388.7 106.5 388.3 104.1zM288.7 70.5a116.67 116.67 0 0 0-7.2-17.6C271 32.9 255.4 22 237 22a15 15 0 0 0-4 .4c-.4-.8-1.2-1.2-1.6-2C223.4 11.6 213 7.6 200.6 8c-24 .8-48 18-67.3 48.8-13.6 21.6-24 48.8-26.8 70.1-27.6 8.4-46.8 14.4-47.2 14.8-14 4.4-14.4 4.8-16 18C42.1 169.6 5 456.8 5 456.8L307.9 509V65.7a41.66 41.66 0 0 0-4.4.4S297.9 67.7 288.7 70.5zM233.4 87.7c-16 4.8-33.6 10.4-50.8 15.6 4.8-18.8 14.4-37.6 25.6-50 4.4-4.4 10.4-9.6 17.2-12.8C232.2 54.9 233.8 74.1 233.4 87.7zM200.6 24.4A27.48 27.48 0 0 1 215 28c-6.4 3.2-12.8 8.4-18.8 14.4-15.2 16.4-26.8 42-31.6 66.5-14.4 4.4-28.8 8.8-42 12.8C131.3 83.3 163.8 25.2 200.6 24.4zM154.2 244.6c1.6 25.6 69.3 31.2 73.3 91.7 2.8 47.6-25.2 80.1-65.7 82.5-48.8 3.2-75.7-25.6-75.7-25.6l10.4-44s26.8 20.4 48.4 18.8c14-.8 19.2-12.4 18.8-20.4-2-33.6-57.2-31.6-60.9-86.9-3.2-46.4 27.2-93.3 94.5-97.7 26-1.6 39.2 4.8 39.2 4.8L221.4 225.4s-17.2-8-37.6-6.4C154.2 221 153.8 239.8 154.2 244.6zM249.4 82.9c0-12.4-1.6-30-7.6-44.8 19.6 3.6 29.2 25.6 33.2 38.8C267.4 79.3 258.6 81.7 249.4 82.9z';

  var STROKE = { fill: 'none', stroke: 'currentColor', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

  function stroked(extra) {
    var o = {}, k;
    for (k in STROKE) if (Object.prototype.hasOwnProperty.call(STROKE, k)) o[k] = STROKE[k];
    for (k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) o[k] = extra[k];
    return o;
  }

  var MARKS = [
    {
      // Shopify — the site's own bag glyph, 448×512 fitted into 32×32.
      name: 'Shopify', key: 'shopify',
      nodes: [
        { t: 'g', a: { transform: 'translate(4.63 3) scale(0.0508)' },
          kids: [ { t: 'path', a: { d: SHOPIFY_PATH } } ] }
      ]
    },
    {
      // WooCommerce — speech bubble with a tail, a W set inside it.
      name: 'WooCommerce', key: 'woo',
      nodes: [
        { t: 'path', a: stroked({
            'stroke-width': '2',
            d: 'M7.5 4.8H24.5A6 6 0 0 1 30.5 10.8V16.3A6 6 0 0 1 24.5 22.3H16.6L10.9 27.4L12.5 22.3H7.5A6 6 0 0 1 1.5 16.3V10.8A6 6 0 0 1 7.5 4.8Z'
          }) },
        { t: 'path', a: stroked({
            'stroke-width': '2.2',
            d: 'M7.6 10.2L11.8 17L16 11.8L20.2 17L24.4 10.2'
          }) }
      ]
    },
    {
      // BigCommerce — a B whose right edge is cut on the diagonal; the
      // two counters are knocked out with fill-rule evenodd.
      name: 'BigCommerce', key: 'bigc',
      nodes: [
        { t: 'path', a: {
            'fill-rule': 'evenodd', 'clip-rule': 'evenodd',
            d: 'M4.5 3H26.5L17.8 29H4.5Z' +
               'M7.8 6.2H22.8L19.8 15.2H7.8Z' +
               'M7.8 17.6H19L16.2 26H7.8Z'
          } }
      ]
    },
    {
      // Magento — the pitched M: two outer legs and a centre post hung off
      // one apex, counters opening downward. Drawn as a single silhouette
      // so the post reads as part of the letter rather than a doorway.
      name: 'Magento', key: 'magento',
      nodes: [
        { t: 'path', a: {
            d: 'M16 2.5L29.5 10V29H25.1V12.6L18.4 16.35V29H13.6V16.35L6.9 12.6V29H2.5V10Z'
          } }
      ]
    },
    {
      // Squarespace — two interlocking rounded squares on the diagonal.
      name: 'Squarespace', key: 'sqsp',
      nodes: [
        { t: 'rect', a: stroked({
            'stroke-width': '2.3', x: '4.55', y: '8.75', width: '14.5', height: '14.5',
            rx: '3.8', transform: 'rotate(45 11.8 16)'
          }) },
        { t: 'rect', a: stroked({
            'stroke-width': '2.3', x: '12.95', y: '8.75', width: '14.5', height: '14.5',
            rx: '3.8', transform: 'rotate(45 20.2 16)'
          }) }
      ]
    },
    {
      // Stripe — the S, flat terminals.
      name: 'Stripe', key: 'stripe',
      nodes: [
        { t: 'path', a: stroked({
            'stroke-width': '3', 'stroke-linecap': 'butt',
            d: 'M23 9.5C23 6.3 19.9 4.2 16 4.2C11.9 4.2 8.8 6.6 8.8 10.2' +
               'C8.8 17.4 23.2 14.6 23.2 21.6C23.2 25.2 20 27.8 15.8 27.8' +
               'C12.4 27.8 9.6 26.6 7.8 24.8'
          }) }
      ]
    }
  ];

  /* ---- helpers ------------------------------------------------------ */

  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  function svg(tag, attrs) {
    var n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
    }
    return n;
  }

  function svgTree(spec) {
    var n = svg(spec.t, spec.a || {});
    if (spec.kids) for (var i = 0; i < spec.kids.length; i++) n.appendChild(svgTree(spec.kids[i]));
    return n;
  }

  /* ---- stylesheet (injected once, refcounted) ----------------------- */

  var CYCLE = (CFG.SLOT_SEC * CFG.SLOTS).toFixed(1) + 's';

  var CSS = [
    /* The box is only as wide as the three resting slots. Entering and
       leaving badges sit outside it, so overflow stays visible. */
    '.pfhl{position:relative;display:inline-block;flex:none;vertical-align:middle;',
    '  --pfhl-d:2.35em;',              /* badge diameter, tracks the eyebrow */
    '  --pfhl-step:1.88em;',           /* .8 of a diameter — the overlap */
    '  width:calc(var(--pfhl-d) + var(--pfhl-step) * 2);',
    '  height:var(--pfhl-d);}',

    '.pfhl-dot{position:absolute;top:0;left:0;',
    '  width:var(--pfhl-d);height:var(--pfhl-d);border-radius:50%;',
    '  display:flex;align-items:center;justify-content:center;',
    '  background:#f3ecde;',
    /* a hairline ring separates two overlapping discs, and the soft drop
       sits the cluster at the same depth as the eyebrow's text-shadow */
    '  box-shadow:0 0 0 1px rgba(3,8,24,.28), 0 1px 10px rgba(3,8,24,.55);',
    /* Five of the six marks are drawn as strokes in currentColor and the
       sixth inherits fill from it, so `color` is the one knob that tints a
       mark — hence the per-platform rules below rather than a fill each.
       The default is the site's ink, which every disc falls back to if a
       mark ever arrives without a tint of its own. */
    '  color:#071238;',
    '  animation:pfhlShuffle ' + CYCLE + ' cubic-bezier(.22,1,.36,1) infinite both;',
    '  will-change:transform,opacity;}',
    '.pfhl-dot svg{display:block;width:62%;height:62%;fill:currentColor;}',

    /* ---------- the six tints ----------
       Each platform's own brand colour, used to identify the platform we
       integrate with — the marks themselves stay the site's simplified
       geometry rather than traced artwork. Shopify takes its darker brand
       green (#5E8E3E) instead of #95BF47: the lighter one is close enough
       in value to the cream disc to wash out at 22px. */
    '.pfhl-dot--shopify{color:#5E8E3E;}',
    '.pfhl-dot--woo{color:#7F54B3;}',
    '.pfhl-dot--bigc{color:#34313F;}',
    '.pfhl-dot--magento{color:#F26322;}',
    '.pfhl-dot--sqsp{color:#101010;}',
    '.pfhl-dot--stripe{color:#635BFF;}',

    /* Four places, held between moves. The move itself takes the first
       ~3.9% of each 16.667% slot, which is the 0.56s the reference site
       spends on one shuffle; the rest of the slot is a hold. After the
       badge leaves on the left it is invisible, so it can be put straight
       back to the entry slot without anything showing. */
    '@keyframes pfhlShuffle{',
    '  0%     {transform:translateX(calc(var(--pfhl-step) * 3)) scale(.45);opacity:0;z-index:5;}',
    '  3.9%   {transform:translateX(calc(var(--pfhl-step) * 2)) scale(1);opacity:1;z-index:4;}',
    '  16.667%{transform:translateX(calc(var(--pfhl-step) * 2)) scale(1);opacity:1;z-index:4;}',
    '  20.6%  {transform:translateX(var(--pfhl-step)) scale(1);opacity:1;z-index:3;}',
    '  33.333%{transform:translateX(var(--pfhl-step)) scale(1);opacity:1;z-index:3;}',
    '  37.2%  {transform:translateX(0) scale(1);opacity:1;z-index:2;}',
    '  50%    {transform:translateX(0) scale(1);opacity:1;z-index:2;}',
    '  53.9%  {transform:translateX(calc(var(--pfhl-step) * -1)) scale(.45);opacity:0;z-index:1;}',
    '  66.6%  {transform:translateX(calc(var(--pfhl-step) * -1)) scale(.45);opacity:0;z-index:1;}',
    '  66.7%  {transform:translateX(calc(var(--pfhl-step) * 3)) scale(.45);opacity:0;z-index:5;}',
    '  100%   {transform:translateX(calc(var(--pfhl-step) * 3)) scale(.45);opacity:0;z-index:5;}}',

    /* Anyone who has asked for less motion gets the three resting badges
       and no shuffle. The delays already put three of the six on screen,
       so pausing is enough — nothing has to be rebuilt. */
    '@media (prefers-reduced-motion:reduce){',
    '  .pfhl-dot{animation-play-state:paused;}}'
  ].join('\n');

  function mountStyle() {
    var s = document.getElementById(STYLE_ID);
    if (!s) {
      s = document.createElement('style');
      s.id = STYLE_ID;
      s.setAttribute('data-pfhl-refs', '0');
      s.appendChild(document.createTextNode(CSS));
      (document.head || document.documentElement).appendChild(s);
    }
    var n = parseInt(s.getAttribute('data-pfhl-refs') || '0', 10) + 1;
    s.setAttribute('data-pfhl-refs', String(n));
    return s;
  }

  function unmountStyle() {
    var s = document.getElementById(STYLE_ID);
    if (!s) return;
    var n = parseInt(s.getAttribute('data-pfhl-refs') || '1', 10) - 1;
    if (n <= 0) {
      if (s.parentNode) s.parentNode.removeChild(s);
    } else {
      s.setAttribute('data-pfhl-refs', String(n));
    }
  }

  /* ---- main --------------------------------------------------------- */

  function initPfHeroLogos(root) {
    var host = typeof root === 'string' ? document.querySelector(root) : root;
    if (!host || !host.appendChild) return function () {};

    var styleEl = mountStyle();
    var box = el('div', 'pfhl');

    // The cluster stands for "the platforms we integrate", and the six
    // names are the whole of what it says — so the box carries that as
    // its label and each disc is decorative inside it. Announcing six
    // separate images in the middle of the eyebrow would read as noise.
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label',
      'Integrates with ' + MARKS.map(function (m) { return m.name; }).join(', '));

    for (var i = 0; i < MARKS.length; i++) {
      var dot = el('div', 'pfhl-dot pfhl-dot--' + MARKS[i].key);
      dot.setAttribute('aria-hidden', 'true');
      // Negative delay: badge i starts a sixth of the cycle further along
      // than badge i-1, which is what spreads six badges over three slots.
      dot.style.animationDelay = '-' + (i * CFG.SLOT_SEC).toFixed(1) + 's';

      var g = svg('svg', {
        viewBox: '0 0 32 32', 'aria-hidden': 'true', focusable: 'false'
      });
      for (var n = 0; n < MARKS[i].nodes.length; n++) g.appendChild(svgTree(MARKS[i].nodes[n]));
      dot.appendChild(g);
      box.appendChild(dot);
    }

    host.appendChild(box);

    return function () {
      if (box.parentNode) box.parentNode.removeChild(box);
      unmountStyle();
      void styleEl;
    };
  }

  initPfHeroLogos.CFG = CFG;    // tunables, reachable without a second global
  return initPfHeroLogos;
})();
