/* =====================================================================
   Priceflag &mdash; "How it works" product walkthrough.

   Usage:
     <script src="./sections/pf-demo.js"></script>
     const cleanup = window.initPfDemo(host);

   Contract (same as the other section modules):
     - exactly one global: window.initPfDemo
     - builds all of its own DOM inside `root`
     - injects its own <style> once, every selector prefixed .pfd-
     - returns cleanup() that removes listeners and observers
     - zero dependencies

   What it shows: three screens a merchant actually sees (Forecast, Rollout &
   watch, Undo), drawn as a dark-glass app window that floats in 3D over the
   page's navy background. The left column is a numbered list in the style of
   Dia's "reads between the tabs" section: the active step expands, the others
   collapse. The numbers are the demo store's ("Cost increase pass &mdash; everyday
   basics", 6% on six products). Nothing here is a measurement of a real
   merchant.

   Scroll contract: the host is a tall block (STEPS × 75vh) with a sticky
   100vh stage, so index.html's nav target maths (span × SIM_P) still works.
   With prefers-reduced-motion the three steps are simply stacked.
   ===================================================================== */
(function () {
  'use strict';

  var STYLE_ID = 'pfd-style';
  var SERIF = "'Hedvig Letters Serif', Georgia, Cambria, 'Times New Roman', serif";
  var SANS = "'Inter', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif";
  var MONO = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  var W = 720, H = 470;   // the app window's design size; it is scaled to fit

  /* Palette used by the inline-styled bits of the screens. */
  var MUTED = '#7f89b0', GREEN = '#b9ef6b', RED = '#ff8a5c', LIME = '#d8f24b', PERI = '#8fa0ff';

  /* ------------------------------------------------------------------
     Copy. Left column, one item per step.
     ------------------------------------------------------------------ */
  var STEPS = [
    { k: '01', t: 'Forecast', h: 'See what it will do before it goes live.',
      p: 'Pick the products and Priceflag never touches anything else. You get a range and the break-even in plain words, never a single number.',
      nav: 'Price changes' },
    { k: '02', t: 'Rollout', h: 'Try it on a few products first, then we watch.',
      p: 'Two products, then three, then all six, and every shopper sees the same price the whole time. We check real orders against the expected range every day. Two bad days in a row pauses the rollout and emails you.',
      nav: 'Price changes' },
    { k: '03', t: 'Undo', h: 'Put every price back with one click.',
      p: 'Every change sits in your price journal with the price it replaced. Undo restores all of them and reads Shopify back to prove it.',
      nav: 'Price journal' }
  ];

  /* Glass chips that float in front of the window, per step. */
  var FLOATS = [
    [['a', '<i></i>Break-even <b>&minus;14% units</b>'], ['b', '<i></i>Range <b>&minus;16% to &minus;3%</b>']],
    [['a', '<i></i>Day 4 <b>in range</b>'], ['b', '<i></i>Same price for <b>every shopper</b>']],
    [['a', '<i></i>Shopify read back <b>6 of 6</b>'], ['b', '<i></i>Journal <b>6 entries</b>']]
  ];

  /* The demo store's "Cost increase pass" readings, as the app shows them. */
  var DAYS = [
    { d: '21 Jul', u: 42, lo: 10.0, hi: 34.4, v: 'Above range' },
    { d: '22 Jul', u: 25, lo: 16.6, hi: 40.9, v: 'In range' },
    { d: '23 Jul', u: 37, lo: 15.8, hi: 40.2, v: 'In range' },
    { d: '24 Jul', u: 25, lo: 20.3, hi: 44.6, v: 'In range' },
    { d: '25 Jul', u: 33, lo: 24.1, hi: 49.4, v: 'In range' },
    { d: '26 Jul', u: 12, lo: 15.7, hi: 41.0, v: 'Below range' },
    { d: '27 Jul', u: 25, lo: 18.3, hi: 41.6, v: 'In range' },
    { d: '28 Jul', u: 36, lo: 14.6, hi: 39.9, v: 'In range' }
  ];

  var PRODUCTS = [
    ['Everyday Tee', 'EVERYDAYTEE-1', 32.00, 33.92],
    ['Ceramic Mug', 'CERAMICMUG-7', 28.00, 29.68],
    ['Wool Socks', 'WOOLSOCKS-6', 24.00, 25.44],
    ['Field Notebook', 'FIELDNOTEBOOK-12', 18.00, 19.08],
    ['Single-Origin Beans', 'COFFEEBEANS-10', 21.00, 22.26],
    ['Canvas Tote', 'CANVASTOTE-4', 58.00, 61.48]
  ];

  function money(n) { return '$' + n.toFixed(2); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  /* ------------------------------------------------------------------
     Stylesheet.
     ------------------------------------------------------------------ */
  var CSS = [
    '.pfd{position:relative;background:#030818;color:#f3ecde;font-family:' + SANS + ';',
    '  -webkit-font-smoothing:antialiased;}',
    '.pfd *{box-sizing:border-box;}',
    '.pfd-stage{position:sticky;top:0;height:100vh;display:flex;align-items:center;overflow:hidden;}',
    '@supports (height:100svh){.pfd-stage{height:100svh;}}',
    '.pfd-grid{position:relative;z-index:1;width:100%;max-width:1360px;margin:0 auto;padding:0 clamp(20px,4vw,56px);',
    '  display:grid;grid-template-columns:minmax(280px,400px) minmax(0,1fr);gap:clamp(28px,4vw,64px);align-items:center;}',

    /* ambient glow behind the window, so the glass has something to blur */
    '.pfd-aura{position:absolute;inset:0;pointer-events:none;overflow:hidden;',
    '  -webkit-mask-image:linear-gradient(to bottom,#000 58%,transparent 100%);mask-image:linear-gradient(to bottom,#000 58%,transparent 100%);}',
    '.pfd-aura i{position:absolute;border-radius:50%;filter:blur(80px);transition:transform 1.2s cubic-bezier(.16,1,.3,1),opacity 1.2s;}',
    '.pfd-aura i:nth-child(1){width:46vw;height:46vw;right:-6vw;top:6vh;background:radial-gradient(circle,rgba(216,242,75,.22),transparent 65%);transform:translate(var(--ax,0),0);}',
    '.pfd-aura i:nth-child(2){width:40vw;height:40vw;right:18vw;bottom:-14vh;background:radial-gradient(circle,rgba(70,88,255,.34),transparent 65%);transform:translate(calc(var(--ax,0) * -1),0);}',

    /* left column: heading + numbered list (Dia-style) */
    '.pfd-copy{position:relative;}',
    '.pfd-eyebrow{display:flex;align-items:center;gap:10px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#aab3cf;margin:0 0 14px;}',
    '.pfd-eyebrow::before{content:"";width:6px;height:6px;border-radius:50%;background:' + LIME + ';box-shadow:0 0 10px ' + LIME + ';}',
    '.pfd-head{margin:0 0 clamp(18px,3vh,30px);font-family:' + SERIF + ';font-weight:400;font-size:clamp(28px,3vw,42px);line-height:1.08;letter-spacing:-.015em;color:#f3ecde;text-wrap:balance;}',
    '.pfd-list{display:flex;flex-direction:column;gap:2px;}',
    '.pfd-item{position:relative;display:block;width:100%;text-align:left;font:inherit;color:inherit;background:transparent;border:0;border-radius:16px;',
    '  padding:18px 22px 18px 24px;cursor:pointer;transition:background .3s ease;}',
    '.pfd-item::before{content:"";position:absolute;left:0;top:16%;bottom:16%;width:3px;border-radius:3px;background:rgba(243,236,222,.14);transition:background .3s ease,box-shadow .3s ease;}',
    '.pfd-item:hover{background:rgba(243,236,222,.035);}',
    '.pfd-item.is-on{background:rgba(243,236,222,.06);}',
    '.pfd-item.is-on::before{background:' + LIME + ';box-shadow:0 0 14px rgba(216,242,75,.55);}',
    '.pfd-item:focus-visible{outline:2px solid ' + LIME + ';outline-offset:2px;}',
    '.pfd-num{display:block;font-family:' + MONO + ';font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#5f6a92;margin-bottom:8px;transition:color .3s;}',
    '.pfd-item.is-on .pfd-num{color:#aab3cf;}',
    '.pfd-h{display:block;font-family:' + SERIF + ';font-weight:400;font-size:clamp(20px,1.9vw,26px);line-height:1.18;letter-spacing:-.01em;color:#6f7aa3;text-wrap:balance;transition:color .3s;}',
    '.pfd-item.is-on .pfd-h,.pfd-item:hover .pfd-h{color:#f3ecde;}',
    '.pfd-desc{display:grid;grid-template-rows:0fr;opacity:0;transition:grid-template-rows .45s cubic-bezier(.16,1,.3,1),opacity .35s ease;}',
    '.pfd-item.is-on .pfd-desc{grid-template-rows:1fr;opacity:1;}',
    '.pfd-desc > span{display:block;min-height:0;overflow:hidden;}',
    '.pfd-p{margin:0;padding-top:12px;max-width:40ch;font-size:clamp(14.5px,1.1vw,16.5px);line-height:1.55;color:#aab3cf;text-wrap:pretty;}',

    /* 3D scene */
    '.pfd-scene{position:relative;perspective:1800px;perspective-origin:50% 40%;padding:clamp(10px,2vw,28px);}',
    '.pfd-tilt{position:relative;transform-style:preserve-3d;',
    '  transform:rotateX(calc(5deg + var(--my,0deg))) rotateY(calc(var(--by,-10deg) + var(--mx,0deg)));',
    '  transition:transform .7s cubic-bezier(.16,1,.3,1);will-change:transform;}',
    '.pfd-floor{position:absolute;left:6%;right:6%;bottom:-7%;height:16%;background:radial-gradient(ellipse at center,rgba(0,0,0,.75),transparent 70%);filter:blur(22px);transform:translateZ(-90px);pointer-events:none;}',

    /* the app window: dark glass */
    '.pfd-app{position:relative;width:100%;aspect-ratio:' + W + '/' + H + ';border-radius:18px;overflow:hidden;',
    '  background:linear-gradient(160deg,rgba(24,34,74,.94),rgba(8,13,34,.96));',
    '  box-shadow:0 1px 2px rgba(0,0,0,.5),0 12px 28px -10px rgba(0,0,0,.55),0 34px 70px -22px rgba(0,0,0,.75),0 70px 120px -40px rgba(30,46,222,.38),',
    '    0 0 0 1px rgba(243,236,222,.13),inset 0 1px 0 rgba(255,255,255,.2);}',
    '.pfd-app::after{content:"";position:absolute;inset:0;pointer-events:none;border-radius:inherit;',
    '  background:linear-gradient(118deg,rgba(255,255,255,.12) 0%,rgba(255,255,255,.03) 28%,transparent 46%);}',
    '.pfd-win{position:absolute;left:0;top:0;width:' + W + 'px;height:' + H + 'px;transform-origin:0 0;color:#e8ebf8;font-size:12.5px;line-height:1.35;}',
    '.pfd-bar{height:32px;display:flex;align-items:center;gap:6px;padding:0 14px;background:rgba(255,255,255,.04);border-bottom:1px solid rgba(255,255,255,.08);}',
    '.pfd-bar i{width:9px;height:9px;border-radius:50%;display:block;}',
    '.pfd-bar i:nth-child(1){background:#ff5f57;}.pfd-bar i:nth-child(2){background:#febc2e;}.pfd-bar i:nth-child(3){background:#28c840;}',
    '.pfd-url{margin:0 auto;width:46%;height:20px;border-radius:7px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);font-size:10px;color:' + MUTED + ';display:flex;align-items:center;justify-content:center;gap:5px;}',
    '.pfd-url::before{content:"";width:6px;height:6px;border-radius:50%;background:#58a30a;}',
    '.pfd-body{position:absolute;top:32px;left:0;right:0;bottom:0;display:grid;grid-template-columns:150px 1fr;}',
    '.pfd-side{display:flex;flex-direction:column;border-right:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.025);padding:14px 10px;}',
    '.pfd-brand{display:flex;align-items:center;gap:8px;padding:2px 8px 14px;font-family:' + SERIF + ';font-size:16px;color:#f3ecde;}',
    '.pfd-brand b{display:block;width:10px;height:17px;background:' + LIME + ';-webkit-mask:url(mark.svg) center/contain no-repeat;mask:url(mark.svg) center/contain no-repeat;}',
    '.pfd-nav{display:block;padding:7px 10px;margin-bottom:2px;border-radius:8px;font-size:12px;color:' + MUTED + ';}',
    '.pfd-nav.is-on{color:#fff;font-weight:600;background:rgba(216,242,75,.1);box-shadow:inset 2px 0 0 ' + LIME + ';}',
    '.pfd-store{margin-top:auto;display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.07);font-size:11px;color:#c9cfe8;}',
    '.pfd-store i{width:7px;height:7px;border-radius:50%;background:#58a30a;box-shadow:0 0 8px #58a30a;flex:none;}',
    '.pfd-store small{display:block;color:' + MUTED + ';font-size:9.5px;}',
    '.pfd-main{position:relative;overflow:hidden;}',
    '.pfd-screen{position:absolute;inset:0;padding:16px 18px;opacity:0;transform:translateY(10px);transition:opacity .45s ease,transform .45s ease;}',
    '.pfd-screen.is-on{opacity:1;transform:none;}',
    '.pfd-title{font-family:' + SERIF + ';font-size:19px;margin:0 0 11px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:#fff;}',
    '.pfd-pill{display:inline-flex;align-items:center;gap:5px;font-family:' + SANS + ';font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#dfe3f5;}',
    '.pfd-pill::before{content:"";width:5px;height:5px;border-radius:50%;background:' + PERI + ';}',
    '.pfd-pill.live::before{background:' + LIME + ';box-shadow:0 0 6px ' + LIME + ';}.pfd-pill.ok::before{background:#58c40a;}.pfd-pill.warn::before{background:#ff6a2b;}',
    '.pfd-card{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);border-radius:11px;padding:11px 13px;box-shadow:inset 0 1px 0 rgba(255,255,255,.05);}',
    '.pfd-row{display:grid;align-items:center;gap:8px;padding:6px 0;border-top:1px solid rgba(255,255,255,.07);}',
    '.pfd-row:first-child{border-top:0;}',
    '.pfd-th{font-size:10px;color:' + MUTED + ';text-transform:uppercase;letter-spacing:.07em;}',
    '.pfd-sku{font-size:10px;color:' + MUTED + ';letter-spacing:.03em;}',
    '.pfd-btn{display:inline-block;padding:7px 12px;border-radius:8px;background:' + LIME + ';color:#071238;font-weight:700;font-size:11.5px;box-shadow:0 6px 18px -6px rgba(216,242,75,.6);}',
    '.pfd-btn.ghost{background:rgba(255,255,255,.05);color:#e8ebf8;border:1px solid rgba(255,255,255,.18);box-shadow:none;font-weight:600;}',
    '.pfd-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:9px;}',
    '.pfd-stat b{display:block;font-family:' + SERIF + ';font-weight:400;font-size:24px;line-height:1.1;color:#fff;margin-top:3px;}',
    '.pfd-stat small{display:block;color:' + MUTED + ';font-size:10px;margin-top:3px;}',
    '.pfd-note{font-size:11.5px;color:#aab3cf;margin:9px 0 0;}',
    '.pfd-note b{color:#fff;}',
    '.pfd-steps{display:grid;gap:7px;}',
    '.pfd-st{display:grid;grid-template-columns:18px 1fr auto;gap:9px;align-items:center;}',
    '.pfd-st i{width:16px;height:16px;border-radius:50%;border:1.5px solid rgba(255,255,255,.22);display:block;}',
    '.pfd-st i.done{background:rgba(216,242,75,.16);border-color:' + LIME + ';}',
    '.pfd-st i.now{background:' + LIME + ';border-color:' + LIME + ';box-shadow:0 0 0 3px rgba(216,242,75,.2),0 0 12px rgba(216,242,75,.6);}',
    '.pfd-st small{color:' + MUTED + ';font-size:10.5px;margin-left:6px;}',
    '.pfd-legend{display:flex;gap:12px;font-size:10px;color:' + MUTED + ';margin-top:2px;}',
    '.pfd-legend span::before{content:"";display:inline-block;width:10px;height:3px;border-radius:2px;margin-right:5px;vertical-align:middle;background:#e8ebf8;}',
    '.pfd-legend span.band::before{background:rgba(143,160,255,.35);height:8px;}',
    '.pfd-legend span.low::before{background:#ff6a2b;width:8px;height:8px;border-radius:50%;}',
    '.pfd-journal .pfd-row{grid-template-columns:1fr auto auto;}',
    '.pfd-arrow{color:' + MUTED + ';margin:0 4px;}',
    '.pfd-ok{display:flex;align-items:center;gap:8px;margin-top:9px;padding:9px 11px;border-radius:9px;background:rgba(88,196,10,.14);border:1px solid rgba(88,196,10,.3);color:' + GREEN + ';font-weight:600;font-size:11.5px;}',

    /* glass chips floating in front of the window */
    '.pfd-float{position:absolute;display:flex;align-items:center;gap:8px;padding:10px 15px;border-radius:14px;',
    '  background:rgba(20,30,70,.5);-webkit-backdrop-filter:blur(16px) saturate(150%);backdrop-filter:blur(16px) saturate(150%);',
    '  border:1px solid rgba(255,255,255,.18);color:#c9cfe8;font-size:13px;white-space:nowrap;',
    '  box-shadow:0 22px 44px -14px rgba(0,0,0,.7),0 4px 10px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.25);',
    '  opacity:0;transform:translateZ(90px) translateY(12px);transition:opacity .5s ease .12s,transform .7s cubic-bezier(.16,1,.3,1) .12s;pointer-events:none;}',
    '.pfd-float.is-on{opacity:1;transform:translateZ(90px);}',
    '.pfd-float i{width:7px;height:7px;border-radius:50%;background:' + LIME + ';box-shadow:0 0 10px ' + LIME + ';flex:none;}',
    '.pfd-float b{font-weight:600;color:#fff;}',
    '.pfd-float.a{right:-2%;top:7%;}',
    '.pfd-float.b{left:-3%;bottom:9%;transform:translateZ(60px) translateY(12px);}',
    '.pfd-float.b.is-on{transform:translateZ(60px);}',

    /* reduced motion: three plain blocks */
    '.pfd-still .pfd-stage{position:static;height:auto;display:block;padding:48px 0;}',
    '.pfd-still .pfd-grid{margin-bottom:40px;}',
    '.pfd-still .pfd-item{cursor:default;}',
    '.pfd-still .pfd-screen,.pfd-still .pfd-float{position:absolute;transition:none;}',
    '.pfd-still .pfd-tilt{transition:none;}',
    '@media (max-width:980px){',
    '  .pfd-grid{grid-template-columns:1fr;gap:14px;align-content:center;}',
    '  .pfd-head,.pfd-eyebrow{display:none;}',
    '  .pfd-item{padding:12px 16px 12px 20px;}',
    '  .pfd-h{font-size:clamp(18px,4.6vw,22px);}',
    '  .pfd-p{font-size:13.5px;padding-top:8px;}',
    '  .pfd-float{font-size:11.5px;padding:7px 11px;}',
    '  .pfd-float.a{right:0;}.pfd-float.b{left:0;}',
    '}',
    '@media (max-width:560px){.pfd-float.b{display:none;}}'
  ].join('\n');

  function injectCss(doc) {
    if (doc.getElementById(STYLE_ID)) return;
    var s = doc.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    doc.head.appendChild(s);
  }

  /* ------------------------------------------------------------------
     Screens. Each returns an HTML string for the app's main area.
     ------------------------------------------------------------------ */
  function screenForecast() {
    var sel = PRODUCTS.map(function (p) {
      return '<span class="pfd-pill" style="font-weight:500">' + esc(p[0]) + '</span>';
    }).join('');
    return '<p class="pfd-title">Propose a price change <span class="pfd-pill">6% higher</span><span class="pfd-pill">6 of 14 products</span></p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:5px;margin:-3px 0 10px">' + sel + '</div>' +
      '<div class="pfd-stats">' +
      '<div class="pfd-card pfd-stat"><span class="pfd-th">Change in units</span><b>&minus;9%</b><small>Range &minus;16% to &minus;3%</small></div>' +
      '<div class="pfd-card pfd-stat"><span class="pfd-th">Profit per day</span><b>$1,160</b><small>From $1,090 &middot; range $1,010 to $1,230</small></div>' +
      '<div class="pfd-card pfd-stat"><span class="pfd-th">How sure we are</span><b style="font-size:19px;padding-top:3px">Fitted</b><small>Based on 180 days of your own orders</small></div>' +
      '</div>' +
      '<div class="pfd-card"><span class="pfd-th">Your break-even</span>' +
      '<p class="pfd-note" style="margin-top:4px"><b>You can sell up to 14% fewer units and still make the same profit.</b> The forecast expects you to lose about 9%.</p></div>' +
      '<div class="pfd-card" style="margin-top:9px;padding-top:4px;padding-bottom:4px"><div class="pfd-row pfd-th" style="grid-template-columns:1fr 1fr 1fr"><span>If unit sales…</span><span>Profit per day</span><span>Versus today</span></div>' +
      '<div class="pfd-row" style="grid-template-columns:1fr 1fr 1fr"><span>fall 16%</span><span>$1,010</span><span style="color:' + RED + '">&minus;$80</span></div>' +
      '<div class="pfd-row" style="grid-template-columns:1fr 1fr 1fr"><span>fall 9% <span class="pfd-sku">expected</span></span><span>$1,160</span><span style="color:' + GREEN + '">+$70</span></div>' +
      '<div class="pfd-row" style="grid-template-columns:1fr 1fr 1fr"><span>fall 3%</span><span>$1,230</span><span style="color:' + GREEN + '">+$140</span></div></div>' +
      '<div style="margin-top:11px;display:flex;gap:8px"><span class="pfd-btn">Start in 3 steps</span><span class="pfd-btn ghost">Change the selection</span></div>';
  }

  function chart(ch) {
    var cw = 520, padL = 26, padR = 10, padT = 10, padB = 20;
    var n = DAYS.length, ymax = 60;
    var x = function (i) { return padL + (cw - padL - padR) * i / (n - 1); };
    var y = function (v) { return padT + (ch - padT - padB) * (1 - v / ymax); };
    var top = DAYS.map(function (d, i) { return x(i).toFixed(1) + ',' + y(d.hi).toFixed(1); });
    var bot = DAYS.map(function (d, i) { return x(i).toFixed(1) + ',' + y(d.lo).toFixed(1); }).reverse();
    var line = DAYS.map(function (d, i) { return x(i).toFixed(1) + ',' + y(d.u).toFixed(1); }).join(' ');
    var dots = DAYS.map(function (d, i) {
      var c = d.v === 'Below range' ? '#ff6a2b' : (i === n - 1 ? LIME : PERI);
      return '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(d.u).toFixed(1) + '" r="3.4" fill="' + c + '"/>';
    }).join('');
    var labels = [0, 3, 7].map(function (i) {
      return '<text x="' + x(i).toFixed(1) + '" y="' + (ch - 5) + '" font-size="9.5" fill="' + MUTED + '" text-anchor="middle">' + DAYS[i].d + '</text>';
    }).join('');
    var step2 = x(4);
    return '<svg viewBox="0 0 ' + cw + ' ' + ch + '" width="100%" height="' + ch + '" aria-label="Units sold each day against the range we expected" role="img">' +
      '<text x="' + (padL - 4) + '" y="' + (y(60) + 3) + '" font-size="9.5" fill="' + MUTED + '" text-anchor="end">60</text>' +
      '<text x="' + (padL - 4) + '" y="' + (y(0) + 3) + '" font-size="9.5" fill="' + MUTED + '" text-anchor="end">0</text>' +
      '<polygon points="' + top.concat(bot).join(' ') + '" fill="rgba(143,160,255,.2)" stroke="rgba(143,160,255,.55)" stroke-width="1"/>' +
      '<line x1="' + step2 + '" y1="' + padT + '" x2="' + step2 + '" y2="' + (ch - padB) + '" stroke="rgba(255,255,255,.3)" stroke-dasharray="3 3"/>' +
      '<text x="' + (step2 + 4) + '" y="' + (padT + 8) + '" font-size="9" fill="' + MUTED + '">Step 2 of 3</text>' +
      '<polyline points="' + line + '" fill="none" stroke="#e8ebf8" stroke-width="1.7"/>' + dots + labels + '</svg>';
  }

  function screenRollout() {
    return '<p class="pfd-title">Cost increase pass <span class="pfd-pill live">Live</span><span class="pfd-pill ok">On track</span></p>' +
      '<div class="pfd-stats">' +
      '<div class="pfd-card pfd-stat"><span class="pfd-th">On a new price</span><b>6 of 6</b><small>Every shopper sees the same price.</small></div>' +
      '<div class="pfd-card pfd-stat"><span class="pfd-th">Step</span><b>3 of 3</b><small>This step started on 29 Jul.</small></div>' +
      '<div class="pfd-card pfd-stat"><span class="pfd-th">Days below your limit</span><b>0</b><small>Your limit acts at 2 days in a row.</small></div>' +
      '</div>' +
      '<div class="pfd-card" style="padding:9px 13px"><div class="pfd-steps">' +
      '<div class="pfd-st"><i class="done"></i><div><b>Step 1 &mdash; 2 of 6 products</b><small>Live 21 Jul &middot; held up 3 days</small></div><span class="pfd-sku">Done</span></div>' +
      '<div class="pfd-st"><i class="done"></i><div><b>Step 2 &mdash; 3 of 6 products</b><small>Live 25 Jul &middot; held up 3 days</small></div><span class="pfd-sku">Done</span></div>' +
      '<div class="pfd-st"><i class="now"></i><div><b>Step 3 &mdash; 6 of 6 products</b><small>Live 29 Jul &middot; watching 4 days</small></div><span class="pfd-sku" style="color:' + LIME + '">Happening now</span></div>' +
      '</div></div>' +
      '<div class="pfd-card" style="margin-top:9px;padding:8px 12px 6px"><span class="pfd-th">Orders vs the range we expected</span>' + chart(112) +
      '<div class="pfd-legend"><span class="band">Range we expected</span><span>Units sold</span><span class="low">Below the range</span></div></div>' +
      '<p class="pfd-note" style="margin-top:8px"><b>Your safety net:</b> two days in a row below the range pauses the rollout and emails you.</p>';
  }

  function screenUndo() {
    var rows = PRODUCTS.map(function (p) {
      return '<div class="pfd-row"><span>' + esc(p[0]) + '<span class="pfd-sku"><br>' + esc(p[1]) + '</span></span>' +
        '<span>' + money(p[3]) + '<span class="pfd-arrow">&rarr;</span><b>' + money(p[2]) + '</b></span><span class="pfd-pill ok">Put back</span></div>';
    }).join('');
    return '<p class="pfd-title">Price journal <span class="pfd-pill">6 entries</span></p>' +
      '<div style="display:flex;gap:8px;margin-bottom:9px"><span class="pfd-btn">Put prices back</span><span class="pfd-btn ghost">Pause rollout</span></div>' +
      '<div class="pfd-card pfd-journal" style="padding-top:2px;padding-bottom:2px">' + rows + '</div>' +
      '<div class="pfd-ok">✓ Every price was checked. Shopify is back at all 6 original prices.</div>';
  }

  var SCREENS = [screenForecast, screenRollout, screenUndo];
  var NAV = ['Overview', 'Products', 'Price changes', 'Price journal'];

  function appWindow(only) {
    var navFor = only === undefined ? STEPS[0].nav : STEPS[only].nav;
    var nav = NAV.map(function (n) {
      return '<span class="pfd-nav' + (n === navFor ? ' is-on' : '') + '" data-nav="' + n + '">' + n + '</span>';
    }).join('');
    var screens = SCREENS.map(function (fn, i) {
      return (only === undefined || only === i) ? '<div class="pfd-screen" data-step="' + i + '">' + fn() + '</div>' : '';
    }).join('');
    return '<div class="pfd-win">' +
      '<div class="pfd-bar"><i></i><i></i><i></i><span class="pfd-url">dashboard.priceflag.org</span></div>' +
      '<div class="pfd-body"><div class="pfd-side"><div class="pfd-brand"><b></b>Priceflag</div>' + nav +
      '<div class="pfd-store"><i></i><div>Demo store<small>Shopify &middot; connected</small></div></div></div>' +
      '<div class="pfd-main">' + screens + '</div></div></div>';
  }

  function floats(only) {
    var out = '';
    FLOATS.forEach(function (list, i) {
      if (only !== undefined && only !== i) return;
      list.forEach(function (f) {
        out += '<div class="pfd-float ' + f[0] + '" data-step="' + i + '">' + f[1] + '</div>';
      });
    });
    return out;
  }

  function scene(only) {
    return '<div class="pfd-scene"><div class="pfd-tilt"><div class="pfd-floor"></div>' +
      '<div class="pfd-app">' + appWindow(only) + '</div>' + floats(only) + '</div></div>';
  }

  function item(i, tag) {
    var s = STEPS[i];
    return '<' + tag + (tag === 'button' ? ' type="button"' : '') + ' class="pfd-item" data-step="' + i + '" data-go="' + i + '"' +
      (tag === 'button' ? ' aria-label="Step ' + (i + 1) + ': ' + esc(s.t) + '"' : '') + '>' +
      '<span class="pfd-num">' + s.k + ' &middot; ' + s.t + '</span><span class="pfd-h">' + esc(s.h) + '</span>' +
      '<span class="pfd-desc"><span><span class="pfd-p" style="display:block">' + esc(s.p) + '</span></span></span></' + tag + '>';
  }

  /* ------------------------------------------------------------------
     Init.
     ------------------------------------------------------------------ */
  function initPfDemo(root) {
    if (!root) return function () {};
    var doc = root.ownerDocument, win = doc.defaultView || window;
    injectCss(doc);

    var still = false;
    try { still = win.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

    root.classList.add('pfd');
    if (still) root.classList.add('pfd-still');
    root.style.height = still ? 'auto' : (STEPS.length * 75) + 'vh';

    if (still) {
      root.innerHTML = STEPS.map(function (_, i) {
        return '<div class="pfd-stage"><div class="pfd-grid"><div class="pfd-copy"><div class="pfd-list">' +
          item(i, 'div').replace('class="pfd-item"', 'class="pfd-item is-on"') + '</div></div>' + scene(i) + '</div></div>';
      }).join('');
      Array.prototype.forEach.call(root.querySelectorAll('[data-step]'), function (el) { el.classList.add('is-on'); });
    } else {
      root.innerHTML = '<div class="pfd-stage"><div class="pfd-aura" aria-hidden="true"><i></i><i></i></div>' +
        '<div class="pfd-grid"><div class="pfd-copy">' +
        '<p class="pfd-eyebrow">How it works</p>' +
        '<h2 class="pfd-head">Forecast it. Roll it out. Undo it.</h2>' +
        '<div class="pfd-list">' + STEPS.map(function (_, i) { return item(i, 'button'); }).join('') + '</div>' +
        '</div>' + scene() + '</div></div>';
    }

    var apps = root.querySelectorAll('.pfd-app');
    function fit() {
      Array.prototype.forEach.call(apps, function (app) {
        var w = app.clientWidth; if (!w) return;
        var wn = app.querySelector('.pfd-win');
        wn.style.transform = 'scale(' + (w / W) + ')';
      });
    }

    var current = -1;
    var tilt = root.querySelector('.pfd-tilt');
    var aura = root.querySelector('.pfd-aura');
    var BASE_Y = [-10, -3, -10];
    function show(i) {
      if (i === current) return;
      current = i;
      Array.prototype.forEach.call(root.querySelectorAll('[data-step]'), function (el) {
        el.classList.toggle('is-on', +el.getAttribute('data-step') === i);
      });
      Array.prototype.forEach.call(root.querySelectorAll('.pfd-nav'), function (n) {
        n.classList.toggle('is-on', n.getAttribute('data-nav') === STEPS[i].nav);
      });
      if (tilt) tilt.style.setProperty('--by', BASE_Y[i] + 'deg');
      if (aura) aura.style.setProperty('--ax', (i - 1) * 6 + 'vw');
    }

    function update() {
      if (still) return;
      var r = root.getBoundingClientRect();
      var vh = win.innerHeight || doc.documentElement.clientHeight || 1;
      var span = r.height - vh;
      var p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
      show(Math.min(STEPS.length - 1, Math.floor(p * STEPS.length)));
    }

    function onGo(e) {
      var b = e.target.closest ? e.target.closest('[data-go]') : null;
      if (!b || still) return;
      var i = +b.getAttribute('data-go');
      show(i);
      var r = root.getBoundingClientRect();
      var vh = win.innerHeight || 1;
      var top = r.top + (win.scrollY || win.pageYOffset || 0);
      var span = r.height - vh;
      if (span > 0) {
        win.scrollTo({ top: top + span * ((i + 0.5) / STEPS.length), behavior: 'smooth' });
      }
    }

    /* Pointer parallax: the window leans a few degrees toward the cursor. */
    var sceneEl = root.querySelector('.pfd-scene');
    var raf = 0, px = 0, py = 0;
    function applyTilt() {
      raf = 0;
      if (!tilt) return;
      tilt.style.setProperty('--mx', (px * 7).toFixed(2) + 'deg');
      tilt.style.setProperty('--my', (py * -5).toFixed(2) + 'deg');
    }
    function onMove(e) {
      var r = sceneEl.getBoundingClientRect();
      px = ((e.clientX - r.left) / r.width - 0.5) * 2;
      py = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!raf) raf = win.requestAnimationFrame(applyTilt);
    }
    function onLeave() { px = 0; py = 0; if (!raf) raf = win.requestAnimationFrame(applyTilt); }
    var fine = false;
    try { fine = win.matchMedia('(hover:hover) and (pointer:fine)').matches; } catch (e) {}
    if (sceneEl && !still && fine) {
      sceneEl.addEventListener('pointermove', onMove);
      sceneEl.addEventListener('pointerleave', onLeave);
    }

    fit(); update();
    if (!still) show(0);
    win.addEventListener('scroll', update, { passive: true });
    win.addEventListener('resize', fit);
    root.addEventListener('click', onGo);
    var ro = null;
    if (win.ResizeObserver) { ro = new win.ResizeObserver(fit); Array.prototype.forEach.call(apps, function (a) { ro.observe(a); }); }
    var poll = win.setInterval(fit, 1000);   // environments where no resize event fires

    return function cleanup() {
      win.removeEventListener('scroll', update);
      win.removeEventListener('resize', fit);
      root.removeEventListener('click', onGo);
      if (sceneEl) { sceneEl.removeEventListener('pointermove', onMove); sceneEl.removeEventListener('pointerleave', onLeave); }
      if (raf) win.cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      win.clearInterval(poll);
      root.innerHTML = '';
      root.classList.remove('pfd', 'pfd-still');
      root.style.height = '';
    };
  }

  window.initPfDemo = initPfDemo;
})();
