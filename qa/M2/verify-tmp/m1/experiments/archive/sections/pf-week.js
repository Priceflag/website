/* =====================================================================
   Priceflag — "How it works": one price change, one week.

   Usage:
     <script src="./sections/pf-week.js"></script>
     const cleanup = window.initPfWeek(host);

   Contract (same as the other section modules):
     - exactly one global: window.initPfWeek
     - builds its own DOM inside `root`, injects one <style> (.pfw2-)
     - returns cleanup(); zero dependencies

   Minimal by design: no panel, no grid, no legend. A soft band for the
   sales we expected, one thin line for real sales with a glowing cursor
   at its tip, hairline flags where something happens with plain
   captions, and a slim lime step line for how many products carry the
   new price. The week plays out left to right as you scroll.

   Desktop pins the 1200x620 scene and scales it to fit. Phones keep it
   readable and pan with the week. Everything is driven from scroll
   position, never CSS transitions. Reduced motion shows the full week.
   ===================================================================== */
(function () {
  'use strict';

  var STYLE_ID = 'pfw2-style';
  var SANS = "'Inter', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif";
  var SERIF = "'Hedvig Letters Serif', Georgia, Cambria, 'Times New Roman', serif";
  var W = 1200, H = 620, VY = 186, VH = H - VY;

  var CREAM = '#f3ecde', MUTE = '#7f88a8', SOFT = '#aab3cf';
  var LIME = '#d8f24b', WAIT = '#f2c14e', AUTO = '#93aaff';

  /* Geometry. */
  var X0 = 40, X1 = 1160, DAYW = (X1 - X0) / 7;
  var Y0 = 250, Y1 = 452, UMAX = 50;          // sales chart
  var SY0 = 500, SY1 = 552;                     // products-on-new-price step line
  function dx(day) { return X0 + day * DAYW; }
  function uy(u) { return Y1 - (Y1 - Y0) * u / UMAX; }
  function sy(n) { return SY1 - (SY1 - SY0) * n / 6; }
  var DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  /* Mid-day readings: expected low/high and real units. */
  var READ = [[30, 44, 39], [27, 42, 33], [26, 41, 30], [25, 40, 34], [24, 39, 32], [24, 39, 35], [23, 38, 33]];

  /* Products on the new price as steps: [day, count]. */
  var STEPS = [[10 / 24, 2], [3 + 6.25 / 24, 3], [6 + 6.25 / 24, 6]];

  /* Moments on the chart: a hairline flag with a short label. */
  var MOMENTS = [
    { at: 10 / 24, c: LIME, h: 'You approve' },
    { at: 1 + 9.7 / 24, c: WAIT, h: 'Paused', until: 1 + 14 / 24 },
    { at: 3 + 6.25 / 24, c: AUTO, h: 'Now 3 products' },
    { at: 6 + 6.25 / 24, c: AUTO, h: 'All 6 products' }
  ];
  var FLAG_Y = 214;

  /* The narrator: one plain sentence for wherever the week has got to.
     `day` is where on the week it starts. */
  var STORY = [
    { day: -1, c: SOFT, t: 'A week with Priceflag', h: 'Scroll to watch one price change play out, day by day.' },
    { day: 10 / 24, c: LIME, t: 'Monday, 10:02 am', h: 'You raise prices 6% on 6 products. We start with just 2 of them, so a mistake stays small.' },
    { day: 0.95, c: SOFT, t: 'Every morning', h: 'We check whether sales landed where we predicted. Shaded: our prediction. White line: what really sold.' },
    { day: 1 + 9.7 / 24, c: WAIT, t: 'Tuesday, 9:40 am', h: 'Someone changed a price by hand in Shopify. We pause and email you. Nothing moves until you decide.' },
    { day: 2.15, c: SOFT, t: 'Wednesday', h: 'You tap “keep going.” Sales are still inside our prediction.' },
    { day: 3 + 6.25 / 24, c: AUTO, t: 'Thursday, 6:15 am', h: 'Sales held up, so overnight we put the new price on 3 products.' },
    { day: 6 + 6.25 / 24, c: AUTO, t: 'Sunday, 6:15 am', h: 'Still on track. All 6 products have the new price, and every shopper saw the same price all week.' }
  ];

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function clamp(v) { return Math.min(1, Math.max(0, v)); }
  function fx(x) { return ' data-fx="' + Math.round(x) + '" opacity="0"'; }

  var CSS = [
    '.pfw2{position:relative;background:#030818;color:' + CREAM + ';font-family:' + SANS + ';-webkit-font-smoothing:antialiased;}',
    '.pfw2 *{box-sizing:border-box;}',
    '.pfw2-head{max-width:1240px;margin:0 auto;padding:clamp(56px,9vh,112px) clamp(20px,5vw,64px) 0;}',
    '.pfw2-eyebrow{display:flex;align-items:center;gap:10px;margin:0 0 14px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:' + SOFT + ';}',
    '.pfw2-eyebrow::before{content:"";width:6px;height:6px;border-radius:50%;background:' + LIME + ';}',
    '.pfw2-title{margin:0;font-family:' + SERIF + ';font-weight:400;font-size:clamp(30px,3.6vw,52px);line-height:1.06;letter-spacing:-.015em;text-wrap:balance;}',
    '.pfw2-sub{margin:14px 0 0;max-width:52ch;font-size:clamp(15px,1.15vw,18px);line-height:1.5;color:' + SOFT + ';}',
    '.pfw2-track{position:relative;height:300vh;}',
    '.pfw2-stage{position:sticky;top:0;height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;overflow:hidden;}',
    '@supports (height:100svh){.pfw2-stage{height:100svh;}}',
    '.pfw2-box{position:relative;flex:none;}',
    '.pfw2-scene{position:absolute;left:0;top:0;width:' + W + 'px;height:' + VH + 'px;transform-origin:0 0;}',
    '.pfw2-say{flex:none;width:min(860px,calc(100vw - 40px));margin:0 0 clamp(8px,2vh,24px);min-height:7.2em;}',
    '.pfw2-say-t{margin:0 0 10px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;font-weight:600;}',
    '.pfw2-say-h{margin:0;font-family:' + SERIF + ';font-weight:400;font-size:clamp(22px,2.6vw,36px);line-height:1.2;letter-spacing:-.01em;color:' + CREAM + ';text-wrap:balance;}',
    '.pfw2-svg{display:block;width:100%;height:100%;overflow:visible;}',
    '.pfw2-note{position:absolute;right:40px;bottom:-34px;margin:0;font-size:12.5px;color:#5d6688;}',
    '.pfw2-still .pfw2-track{height:auto;}',
    '.pfw2-still .pfw2-stage{position:static;height:auto;padding:40px 0 72px;overflow-x:auto;}'
  ].join('\n');

  function injectCss(doc) {
    if (doc.getElementById(STYLE_ID)) return;
    var s = doc.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; doc.head.appendChild(s);
  }

  /* Smooth Catmull-Rom through the points, as cubic segments (no leading M). */
  function segs(pts) {
    var d = '';
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += ' C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ',' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + ' ' +
        (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ',' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + ' ' + p2[0] + ',' + p2[1];
    }
    return d;
  }
  function curve(pts) { return 'M' + pts[0][0] + ',' + pts[0][1] + segs(pts); }

  function build() {
    var o = [];
    var mids = READ.map(function (r, i) { return dx(i + 0.5); });

    o.push('<defs>' +
      '<linearGradient id="pfw2-band" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + AUTO + '" stop-opacity=".28"/><stop offset="1" stop-color="' + AUTO + '" stop-opacity=".06"/></linearGradient>' +
      '<linearGradient id="pfw2-fade" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".06" stop-color="#fff" stop-opacity="1"/><stop offset=".94" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
      '<mask id="pfw2-edges"><rect x="0" y="0" width="' + W + '" height="' + H + '" fill="url(#pfw2-fade)"/></mask>' +
      '<filter id="pfw2-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>' +
      '<clipPath id="pfw2-reveal"><rect class="pfw2-clip" x="0" y="0" width="0" height="' + H + '"/></clipPath>' +
      '</defs>');

    // Expected band, edges fading out at both ends.
    var hiPts = [[X0, uy(READ[0][1])]].concat(mids.map(function (x, i) { return [x, uy(READ[i][1])]; })).concat([[X1, uy(READ[6][1])]]);
    var loPts = [[X0, uy(READ[0][0])]].concat(mids.map(function (x, i) { return [x, uy(READ[i][0])]; })).concat([[X1, uy(READ[6][0])]]);
    var loRev = loPts.slice().reverse();
    var band = curve(hiPts) + ' L' + loRev[0][0] + ',' + loRev[0][1] + segs(loRev) + ' Z';
    o.push('<g mask="url(#pfw2-edges)"><path d="' + band + '" fill="url(#pfw2-band)"/>' +
      '<path d="' + curve(hiPts) + '" fill="none" stroke="' + AUTO + '" stroke-opacity=".35" stroke-width="1"/>' +
      '<path d="' + curve(loPts) + '" fill="none" stroke="' + AUTO + '" stroke-opacity=".35" stroke-width="1"/></g>');
    o.push('<text x="' + (X1 - 30) + '" y="' + (uy(READ[6][0]) + 24) + '" text-anchor="end" font-family="' + esc(SANS) + '" font-size="15" fill="' + AUTO + '">Our prediction</text>');

    // Paused stretch: drawn later on the product line.
    var pz = MOMENTS[1];

    // Real sales: one thin line revealed by a clip, plus a glowing cursor.
    var real = curve(mids.map(function (x, i) { return [x, uy(READ[i][2])]; }));
    o.push('<g clip-path="url(#pfw2-reveal)"><path d="' + real + '" fill="none" stroke="' + CREAM + '" stroke-width="2" stroke-linecap="round"/>' +
      mids.map(function (x, i) { return '<circle cx="' + x + '" cy="' + uy(READ[i][2]) + '" r="3" fill="#030818" stroke="' + CREAM + '" stroke-width="1.6"/>'; }).join('') + '</g>');
    o.push('<path class="pfw2-real" d="' + real + '" fill="none" stroke="none"/>');
    o.push('<text' + fx(mids[0]) + ' x="' + (mids[0] + 10) + '" y="' + (uy(READ[0][2]) - 12) + '" font-family="' + esc(SANS) + '" font-size="15" fill="' + CREAM + '">What really sold</text>');

    // Products on the new price: a slim lime step line.
    var sp = 'M' + dx(STEPS[0][0]) + ',' + sy(0) + ' V' + sy(STEPS[0][1]);
    for (var i = 1; i < STEPS.length; i++) sp += ' H' + dx(STEPS[i][0]) + ' V' + sy(STEPS[i][1]);
    sp += ' H' + X1;
    o.push('<line x1="' + X0 + '" y1="' + SY1 + '" x2="' + X1 + '" y2="' + SY1 + '" stroke="' + CREAM + '" stroke-opacity=".1"/>');
    o.push('<g clip-path="url(#pfw2-reveal)"><path d="' + sp + ' V' + SY1 + ' H' + dx(STEPS[0][0]) + ' Z" fill="' + LIME + '" fill-opacity=".08"/>' +
      '<path d="' + sp + '" fill="none" stroke="' + LIME + '" stroke-width="1.8" stroke-linejoin="round"/></g>');
    o.push('<g' + fx(dx(pz.at)) + '><line x1="' + dx(pz.at) + '" y1="' + sy(2) + '" x2="' + dx(pz.until) + '" y2="' + sy(2) + '" stroke="' + WAIT + '" stroke-width="3" stroke-linecap="round"/>' +
      '<text x="' + (dx(pz.until) + 8) + '" y="' + (sy(2) - 7) + '" text-anchor="start" font-family="' + esc(SANS) + '" font-size="12" fill="' + WAIT + '">paused</text></g>');
    STEPS.forEach(function (s) {
      var label = s[1] + ' of 6';
      o.push('<text' + fx(dx(s[0])) + ' x="' + (dx(s[0]) + 8) + '" y="' + (sy(s[1]) - 8) + '" font-family="' + esc(SANS) + '" font-size="14" font-weight="600" fill="' + LIME + '">' + label + '</text>');
    });
    o.push('<text x="' + X0 + '" y="' + (SY1 + 22) + '" font-family="' + esc(SANS) + '" font-size="13" fill="' + SOFT + '">Products with the new price</text>');

    // Day labels, quiet.
    DAYS.forEach(function (n, i) {
      o.push('<text x="' + (dx(i) + DAYW / 2) + '" y="' + (Y1 + 26) + '" text-anchor="middle" font-family="' + esc(SANS) + '" font-size="11" letter-spacing="1.8" fill="' + MUTE + '">' + n + '</text>');
    });

    // Moments: hairline flag, small pennant, a short label. Only the current one is bright.
    MOMENTS.forEach(function (m, i) {
      var x = dx(m.at), flip = x > X1 - 160, tx = flip ? x - 10 : x + 10;
      var g = '<g class="pfw2-flag" data-flag="' + i + '"' + fx(x) + '>';
      g += '<line x1="' + x + '" y1="' + (FLAG_Y - 8) + '" x2="' + x + '" y2="' + SY1 + '" stroke="' + m.c + '" stroke-opacity=".5" stroke-width="1"/>';
      g += '<path d="M' + x + ',' + (FLAG_Y - 8) + ' l' + (flip ? -16 : 16) + ',5 ' + (flip ? 16 : -16) + ',6 z" fill="' + m.c + '"/>';
      g += '<circle cx="' + x + '" cy="' + SY1 + '" r="3" fill="' + m.c + '"/>';
      g += '<text x="' + (flip ? x - 22 : x + 22) + '" y="' + (FLAG_Y + 2) + '" text-anchor="' + (flip ? 'end' : 'start') + '" font-family="' + esc(SANS) + '" font-size="14" font-weight="600" fill="' + m.c + '">' + esc(m.h) + '</text>';
      g += '</g>';
      o.push(g);
    });

    // The "now" cursor.
    o.push('<g class="pfw2-now" opacity="0"><line class="pfw2-now-line" x1="0" y1="' + Y0 + '" x2="0" y2="' + SY1 + '" stroke="' + CREAM + '" stroke-opacity=".18"/>' +
      '<circle class="pfw2-now-glow" r="10" fill="' + CREAM + '" fill-opacity=".35" filter="url(#pfw2-glow)"/>' +
      '<circle class="pfw2-now-dot" r="4.5" fill="' + CREAM + '"/></g>');

    return '<svg class="pfw2-svg" viewBox="0 ' + VY + ' ' + W + ' ' + VH + '" role="img" aria-label="One week of a price change. Monday you approve 6% on 6 products and it starts on 2. Tuesday a price edited by hand pauses it until you decide. Thursday at 6:15 am sales are on track and it moves to 3 products. Sunday it reaches all 6." xmlns="http://www.w3.org/2000/svg">' + o.join('') + '</svg>';
  }

  function initPfWeek(root) {
    if (!root) return function () {};
    var doc = root.ownerDocument, win = doc.defaultView || window;
    injectCss(doc);
    var still = false;
    try { still = win.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

    root.classList.add('pfw2');
    if (still) root.classList.add('pfw2-still');
    root.innerHTML =
      '<div class="pfw2-head"><p class="pfw2-eyebrow">How it works</p><h2 class="pfw2-title">One price change, one week.</h2>' +
      '<p class="pfw2-sub">You decide what changes. Priceflag starts small, checks your sales every morning, and stops to ask when something looks off.</p></div>' +
      '<div class="pfw2-track"><div class="pfw2-stage"><div class="pfw2-say" aria-live="polite"><p class="pfw2-say-t"></p><p class="pfw2-say-h"></p></div>' +
      '<div class="pfw2-box"><div class="pfw2-scene">' + build() + '<p class="pfw2-note">An example store. The steps are real; the numbers are made up.</p></div></div></div></div>';

    var track = root.querySelector('.pfw2-track');
    var scene = root.querySelector('.pfw2-scene');
    var box = root.querySelector('.pfw2-box');
    var say = root.querySelector('.pfw2-say');
    var sayT = say.querySelector('.pfw2-say-t'), sayH = say.querySelector('.pfw2-say-h');
    var flags = root.querySelectorAll('.pfw2-flag');
    var storyAt = -1;
    var clip = root.querySelector('.pfw2-clip');
    var real = root.querySelector('.pfw2-real');
    var now = root.querySelector('.pfw2-now');
    var nowLine = root.querySelector('.pfw2-now-line');
    var nowDot = root.querySelector('.pfw2-now-dot');
    var nowGlow = root.querySelector('.pfw2-now-glow');
    var fades = root.querySelectorAll('[data-fx]');
    var realLen = real.getTotalLength ? real.getTotalLength() : 0;
    var scale = 1, narrow = false, offX = 0;

    // Point on the real-sales line at a given x, by bisection along its length.
    function atX(x) {
      var a = 0, b = realLen;
      for (var i = 0; i < 18; i++) {
        var m = (a + b) / 2;
        if (real.getPointAtLength(m).x < x) a = m; else b = m;
      }
      return real.getPointAtLength((a + b) / 2);
    }

    function fit() {
      var vw = win.innerWidth, vh = win.innerHeight;
      narrow = vw <= 860;
      var room = vh - say.offsetHeight - 110;
      scale = narrow ? Math.min(0.8, room / VH) : Math.min((vw - 48) / W, room / VH, 1.12);
      offX = narrow ? 8 : (vw - W * scale) / 2;
      box.style.width = (narrow ? vw : W * scale) + 'px';
      box.style.height = (VH * scale) + 'px';
      box.style.marginLeft = (narrow ? 0 : offX) + 'px';
      say.style.marginLeft = (narrow ? 20 : offX + X0 * scale) + 'px';
      update();
    }

    function apply(sweep) {
      clip.setAttribute('width', String(Math.max(0, sweep)));
      Array.prototype.forEach.call(fades, function (el) {
        el.setAttribute('opacity', String(clamp((sweep - +el.getAttribute('data-fx')) / 50)));
      });
      var first = dx(0.5), last = dx(6.5);
      var cx = Math.min(Math.max(sweep, first), last);
      var p = atX(cx);
      nowLine.setAttribute('x1', cx); nowLine.setAttribute('x2', cx);
      nowDot.setAttribute('cx', p.x); nowDot.setAttribute('cy', p.y);
      nowGlow.setAttribute('cx', p.x); nowGlow.setAttribute('cy', p.y);
      now.setAttribute('opacity', String(still ? 0 : clamp((sweep - first + 20) / 40) * (1 - clamp((sweep - last - 40) / 60))));
      var pan = 0;
      if (narrow && !still) {
        var vw = win.innerWidth || 375;
        pan = Math.min(Math.max(0, sweep * scale - vw * 0.62), Math.max(0, W * scale - vw + 16));
      }
      scene.style.transform = 'translate(' + ((narrow ? offX : 0) - pan) + 'px,0) scale(' + scale + ')';
      tell(sweep);
    }

    // The narrator: the latest story beat the week has reached, fading in
    // as you scroll past where it starts. Only the matching flag is bright.
    function tell(sweep) {
      var i = 0;
      for (var k = 0; k < STORY.length; k++) if (STORY[k].day < 0 || sweep >= dx(STORY[k].day)) i = k;
      if (i !== storyAt) {
        storyAt = i;
        sayT.textContent = STORY[i].t;
        sayT.style.color = STORY[i].c;
        sayH.textContent = STORY[i].h;
      }
      var start = STORY[i].day < 0 ? -1e9 : dx(STORY[i].day);
      say.style.opacity = String(still ? 1 : 0.15 + 0.85 * clamp((sweep - start) / 45));
      var lit = -1;
      for (var m = 0; m < MOMENTS.length; m++) if (sweep >= dx(MOMENTS[m].at)) lit = m;
      Array.prototype.forEach.call(flags, function (el, j) {
        var base = clamp((sweep - dx(MOMENTS[j].at)) / 50);
        el.setAttribute('opacity', String(base * (j === lit || still ? 1 : 0.4)));
      });
    }

    function update() {
      if (still) { apply(W + 100); return; }
      var r = track.getBoundingClientRect();
      var span = r.height - (win.innerHeight || 1);
      var p = span > 0 ? clamp(-r.top / span) : 1;
      apply(X0 - 10 + clamp((p - 0.04) / 0.86) * (X1 - X0 + 120));
    }

    fit();
    win.addEventListener('scroll', update, { passive: true });
    win.addEventListener('resize', fit);
    var poll = win.setInterval(update, 400);

    return function cleanup() {
      win.removeEventListener('scroll', update);
      win.removeEventListener('resize', fit);
      win.clearInterval(poll);
      root.innerHTML = '';
      root.classList.remove('pfw2', 'pfw2-still');
    };
  }

  window.initPfWeek = initPfWeek;
})();
