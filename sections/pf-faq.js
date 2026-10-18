/* =====================================================================
   Priceflag — FAQ (goldsand.fi mechanics)
   ---------------------------------------------------------------------
   Usage:   var cleanup = window.initPfFaq(rootElementOrSelector);
            cleanup();            // removes DOM, listeners, timers, IO

   Exactly one global is created: window.initPfFaq.
   Every selector in the injected stylesheet is prefixed `.pff-`.
   Zero dependencies. No CDN. No imports. No pre-existing markup required.

   WHAT THIS SECTION IS ------------------------------------------------
   The FAQ, built to goldsand.fi's mechanics:
     * independent per-item state — MULTI-OPEN, not an accordion
     * plus-to-× icon: two bars rotating 0→45 and 90→-45 over 0.25s
     * panel height 0 ↔ auto over 0.35s
     * scroll-in stagger of min(index * 0.04, 0.24)s
     * house easing cubic-bezier(0.16, 1, 0.3, 1) throughout
     * 64px / 112px section padding, 1200px content width

   This file used to open with a second part: a "Built For:" strip of six
   platform lockups on a slow marquee. Those lockups now run across the
   hero instead (sections/pf-hero-logos.js), which is where the claim they
   answer — "Intelligence for ecommerce" — is actually made.

   RESPONSIVE ------------------------------------------------------------
   One layout, tuned by viewport *and* by viewport height, because a phone
   held sideways is 844x390 — wide enough to trip a width-only breakpoint
   but far too short for the desktop vertical rhythm. So:
     * the 112px section rhythm needs BOTH width >= 768 and height >= 600;
       short landscape viewports get a compact 44px rhythm instead
     * the two-column split needs a landscape viewport at >= 900px (or any
       viewport >= 1100px), which keeps iPad portrait — 768, 810 and 1024
       wide — stacked, along with every landscape phone
     * rows carry a 48px min-height, over the 44px touch floor

   ENVIRONMENT NOTE ----------------------------------------------------
   In the target environment `document.hidden` is permanently true, which
   starves requestAnimationFrame, IntersectionObserver AND CSS transitions.
   Two rules follow, and both are obeyed below:

     1. Every panel open/close arms a settle() timer alongside the
        `transitionend` listener. If the transition never fires, the timer
        still lands the panel on its exact final geometry. No code path
        returns early leaving a half-applied style behind.
     2. The reveal stagger is gated on IntersectionObserver, so it carries
        two fallbacks: one that fires if the observer never reports at all
        (i.e. it is starved), and an unconditional backstop. Rows can
        never be left invisible.
   ===================================================================== */

window.initPfFaq = (function () {
  'use strict';

  /* ---- tunables ---------------------------------------------------- */
  var EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';   // goldsand house curve

  var CFG = {
    PANEL_MS: 350,             // height 0 ↔ auto
    ICON_MS: 250,              // plus → ×
    EASE: EASE,
    SETTLE_SLACK_MS: 120,      // grace before the fallback settle fires
    REVEAL_MS: 700,            // per-row scroll-in
    REVEAL_STEP: 0.04,         // seconds of stagger per index
    REVEAL_CAP: 0.24,          // …capped here
    IO_STARVED_MS: 1000,       // "the observer never reported" fallback
    IO_BACKSTOP_MS: 3000,      // unconditional "never leave rows hidden"
    FIRST_OPEN: -1             // index open on load; -1 for all closed
  };

  var STYLE_ID = 'pff-styles';
  var uid = 0;


  /* ---- content ------------------------------------------------------ */

  /* An answer is either a plain string or an array of parts, where a part is
     a string or { text, href } for an inline link. The FAQPage JSON-LD in
     index.html carries the same questions with the parts joined as plain
     text; keep the two in sync when editing either. */
  var FAQ = [
    {
      q: 'How does the forecast work, and how much data do I need?',
      a: 'Before anything goes live, Priceflag fits your own order history, up to the last 180 days, and shows a range for the change in units and profit, never a single number. It also gives you a break-even in plain words, for example: you can sell up to 14% fewer units and still make the same profit, and the forecast expects about 9%. Higher-volume products give tighter ranges. If a product has too few orders for a trustworthy forecast, we say so and take smaller steps instead of inventing confidence.'
    },
    {
      q: 'How is the rollout staged, and will shoppers see different prices?',
      a: 'No. Rollouts add products, not visitors. A pass might go live on two products, then three, then all six, with each step held for a few days before the next begins. At every moment every shopper sees the same price for the same product, so there is no price discrimination and no split testing on your customers. Prices are written to your Shopify catalog like a manual edit in the admin, so your storefront and structured data stay in sync.'
    },
    {
      q: 'How is this different from an A/B testing app?',
      a: 'A/B apps split your traffic, wait, and hand you a chart to interpret. Priceflag forecasts first, rolls out gradually to a slice of your catalog, then compares real daily orders against the range it expected. It keeps checking after the rollout, and every change is journaled so it can be undone. The goal is not an experiment result. It is a price that is still working next quarter.'
    },
    {
      q: 'What happens if a price change hurts sales?',
      a: 'Priceflag checks daily orders on the products in a rollout against the forecast range. If orders fall below the range, the rollout pauses, so no more products get the new price. Priceflag notifies you and gives a recommendation, for example hold, continue, or put the old price back. You decide. Nothing is reverted automatically. Every change sits in your price journal next to the price it replaced, so putting the old prices back is one action, designed to restore the previous price and check it in Shopify. You also get an audit trail of what changed, what triggered it and when.'
    },
    {
      q: 'Does it change prices without asking me?',
      a: 'Not by default. Priceflag only touches the products you pick, and it proposes each change for you to approve before anything is applied. Autonomy per collection is opt-in: you can let Priceflag apply changes in a collection without asking each time, within limits you set. It is off by default, and you can turn it off at any time.'
    },
    {
      q: 'How much does it cost?',
      a: 'The price review is free right now. Pricing for the Priceflag app is not set yet. If you join a pilot before the app is live, any fee is agreed with you up front, before anything starts.'
    },
    {
      q: 'What data do you read?',
      a: [
        'Your products, prices and orders, read through Shopify’s API, because that is what a forecast needs. The pricing model may also use shopper IP addresses, encrypted and access-restricted, only to understand demand such as approximate region. They are never used to show different shoppers different prices, and never sold. We don’t sell your data or share it for advertising, and we don’t keep copies of your order history beyond what a forecast needs. What we must keep to run the service is deleted within 30 days of uninstall. The details are in our ',
        { text: 'privacy policy', href: '/legal#privacy' },
        '.'
      ]
    },
    {
      q: 'How long does setup take?',
      a: 'About five minutes. Sign up connects your Shopify store, with no code to write.'
    },
    /* CONFIRM: subscriptions answer (founder to check before launch) */
    {
      q: 'Do you work with subscriptions?',
      a: 'Not yet. Today Priceflag forecasts prices for one-time product purchases. Subscription pricing isn’t supported yet.'
    },
    {
      q: 'What happens to my prices if I uninstall?',
      a: 'Uninstalling removes our write access, so whatever price is live at that moment stays live. We do not roll anything back on the way out, because a silent rewrite of your catalog would be one more price change you never asked for. If you want the originals back, run Undo from your price journal before you uninstall, or ask us for your price history export and restore them yourself.'
    }
  ];

  /* plain-text form of an answer (used for the JSON-LD sync check) */
  function answerText(a) {
    if (typeof a === 'string') return a;
    var out = '';
    for (var i = 0; i < a.length; i++) out += typeof a[i] === 'string' ? a[i] : a[i].text;
    return out;
  }

  function buildAnswer(a) {
    var p = el('p', 'pff-a');
    if (typeof a === 'string') { p.textContent = a; return p; }
    for (var i = 0; i < a.length; i++) {
      var part = a[i];
      if (typeof part === 'string') { p.appendChild(document.createTextNode(part)); continue; }
      var link = el('a', 'pff-link', part.text);
      link.href = part.href;
      p.appendChild(link);
    }
    return p;
  }

  /* ---- small helpers ----------------------------------------------- */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }


  /* ---- stylesheet (injected once, refcounted) ----------------------- */

  var CSS = [
    /* ---------- shell ---------- */
    '.pff{background:#030818;color:#f3ecde;',
    '  font-family:\'Inter\',system-ui,\'Helvetica Neue\',Arial,sans-serif;',
    '  -webkit-font-smoothing:antialiased;position:relative;z-index:1;}',
    '.pff *,.pff *::before,.pff *::after{box-sizing:border-box;}',
    '.pff{scroll-margin-top:var(--pf-nav-h,64px);}',
    /* goldsand rhythm: 1200px content, 64px/24px mobile → 112px/40px desktop.
       The tall rhythm is gated on height as well as width: an iPhone held
       sideways is 844x390, which clears a width-only 768px breakpoint but
       would then spend more than half its screen on padding. */
    '.pff-wrap{max-width:1200px;margin:0 auto;padding:48px 24px;}',
    /* 320–359px: claw back gutter so the answers keep a readable measure */
    '@media (max-width:359px){.pff-wrap{padding-left:18px;padding-right:18px;}}',
    '@media (min-width:768px) and (min-height:600px){.pff-wrap{padding:80px 40px;}}',
    /* the matching short-viewport overrides live at the foot of this sheet,
       after the rules they have to beat (equal specificity, later wins) */

    /* ---------- section chrome (FAQ only — the strip carries no copy) ---------- */
    '.pff-chrome{max-width:640px;}',
    '.pff-kicker{margin:0;font-size:11.5px;font-weight:600;line-height:1;',
    '  letter-spacing:.16em;text-transform:uppercase;color:#93aaff;}',
    '.pff-head{margin:clamp(16px,1.8vw,22px) 0 0;',
    '  font-family:\'Hedvig Letters Serif\',Georgia,Cambria,\'Times New Roman\',serif;',
    '  font-weight:400;font-size:clamp(30px,4vw,52px);line-height:1.1;',
    '  letter-spacing:-0.02em;color:#f3ecde;text-wrap:balance;}',
    '.pff-lede{margin:clamp(14px,1.4vw,18px) 0 0;max-width:46ch;',
    '  font-size:clamp(15px,1.15vw,16.5px);font-weight:300;line-height:1.6;',
    '  letter-spacing:-0.005em;color:rgba(243,236,222,.62);text-wrap:pretty;}',


    /* ---------- B. FAQ ---------- */
    /* goldsand's split: heading column left, questions column right (1 : 1.3).
       Width alone is the wrong test. iPad portrait is 768/810/1024 wide and
       would pass a plain `min-width:900px`, but two 400px columns under a
       1366px-tall screen reads as a broken desktop layout, not a tablet one;
       a landscape phone at 896px is wide and 414px tall, where two columns
       are worse still. So the split asks for a landscape viewport of at
       least 900x560, or any viewport 1100px and wider. Everything else —
       all phones, all iPad portrait — stacks. */
    '.pff-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:clamp(28px,4vw,44px);}',
    '@media (min-width:900px) and (min-height:560px) and (orientation:landscape),',
    '       (min-width:1100px){',
    '  .pff-grid{grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);',
    '    gap:clamp(40px,5vw,64px);align-items:start;}',
    '}',

    '.pff-list{margin:0;padding:0;list-style:none;',
    '  border-top:1px solid rgba(243,236,222,.12);}',
    '.pff-row{border-bottom:1px solid rgba(243,236,222,.12);}',
    /* scroll-in reveal; the delay is written per row as --pff-d */
    '.pff-list--armed .pff-row{opacity:0;transform:translateY(24px);',
    '  transition:opacity ' + CFG.REVEAL_MS + 'ms ' + EASE + ' var(--pff-d,0s),',
    '             transform ' + CFG.REVEAL_MS + 'ms ' + EASE + ' var(--pff-d,0s);}',
    '.pff-list--armed .pff-row.pff-in{opacity:1;transform:none;}',

    /* min-height keeps the row over the 44px touch floor even if a question
       ever gets short enough for the padding alone not to carry it there;
       touch-action:manipulation drops the double-tap zoom delay on iOS. */
    '.pff-q{display:flex;align-items:center;justify-content:space-between;',
    '  gap:clamp(16px,3vw,32px);width:100%;margin:0;min-height:48px;',
    '  padding:clamp(18px,2vw,22px) 0;',
    '  background:none;border:0;border-radius:4px;',
    '  text-align:left;cursor:pointer;color:inherit;appearance:none;',
    '  -webkit-appearance:none;font:inherit;touch-action:manipulation;',
    '  -webkit-tap-highlight-color:rgba(216,242,75,.10);}',
    '.pff-q-text{font-family:\'Hedvig Letters Serif\',Georgia,Cambria,\'Times New Roman\',serif;',
    '  font-weight:400;font-size:clamp(17px,1.7vw,21px);line-height:1.34;',
    '  letter-spacing:-0.012em;color:#f3ecde;text-wrap:pretty;',
    '  transition:color .25s ' + EASE + ';}',
    '.pff-q:hover .pff-q-text{color:#fff;}',
    '.pff-q:focus-visible{outline:2px solid rgba(216,242,75,.85);outline-offset:3px;}',

    /* the plus that unfolds into an ×: two bars, one 0→45, one 90→-45 */
    '.pff-ind{position:relative;flex:none;display:block;width:32px;height:32px;',
    '  color:rgba(243,236,222,.55);transition:color .25s ' + EASE + ';}',
    '.pff-bar{position:absolute;left:50%;top:50%;width:14px;height:1.5px;',
    '  margin:-0.75px 0 0 -7px;border-radius:1px;background:currentColor;',
    '  transition:transform ' + CFG.ICON_MS + 'ms ' + EASE + ';}',
    '.pff-bar--a{transform:rotate(0deg);}',
    '.pff-bar--b{transform:rotate(90deg);}',
    '.pff-q:hover .pff-ind{color:rgba(243,236,222,.85);}',
    '.pff-q[aria-expanded="true"] .pff-ind{color:#d8f24b;}',
    '.pff-q[aria-expanded="true"] .pff-bar--a{transform:rotate(45deg);}',
    '.pff-q[aria-expanded="true"] .pff-bar--b{transform:rotate(-45deg);}',

    '.pff-panel{overflow:hidden;height:0;opacity:0;}',
    '.pff-panel[hidden]{display:none;}',
    '.pff-panel-inner{padding:0 clamp(16px,3vw,40px) clamp(20px,2.4vw,26px) 0;max-width:62ch;}',
    '.pff-a{margin:0;font-size:clamp(14.5px,1.1vw,16px);font-weight:300;',
    '  line-height:1.62;letter-spacing:-0.003em;',
    '  color:rgba(243,236,222,.66);text-wrap:pretty;}',
    '.pff-link{color:#f3ecde;text-decoration:underline;text-underline-offset:3px;',
    '  text-decoration-color:rgba(243,236,222,.4);transition:text-decoration-color .25s ' + EASE + ';}',
    '.pff-link:hover{text-decoration-color:#d8f24b;}',
    '.pff-link:focus-visible{outline:2px solid rgba(216,242,75,.85);outline-offset:2px;border-radius:2px;}',

    /* ---------- narrow ---------- */
    '@media (max-width:640px){',
    '  .pff-q{gap:14px;}',
    '  .pff-panel-inner{padding-right:clamp(28px,10vw,44px);}',
    '  .pff-ind{width:28px;height:28px;}',
    '}',
    /* 320px: the smallest phone still in circulation. The panel keeps its
       right padding but stops paying for a second inset it cannot afford. */
    '@media (max-width:359px){',
    '  .pff-q{gap:10px;}',
    '  .pff-panel-inner{padding-right:20px;}',
    '}',

    /* ---------- short viewports (phones and small tablets on their side) ---- */
    '@media (orientation:landscape) and (max-height:599px){',
    '  .pff-wrap{padding:44px clamp(24px,4vw,40px);}',
    '  .pff-q{padding:16px 0;}',
    '}',

    /* ---------- reduced motion ----------
       Panels and the reveal snap instead of easing — the JS also drops its
       durations to 0, so the two agree. */
    '@media (prefers-reduced-motion: reduce){',
    '  .pff-panel{transition:none!important;}',
    '  .pff-bar,.pff-ind,.pff-q,.pff-q-text{transition:none!important;}',
    '  .pff-list--armed .pff-row{opacity:1!important;transform:none!important;',
    '    transition:none!important;}',
    '}'
  ].join('\n');

  function mountStyle() {
    var s = document.getElementById(STYLE_ID);
    if (!s) {
      s = document.createElement('style');
      s.id = STYLE_ID;
      s.setAttribute('data-pff-refs', '0');
      s.appendChild(document.createTextNode(CSS));
      (document.head || document.documentElement).appendChild(s);
    }
    var n = parseInt(s.getAttribute('data-pff-refs') || '0', 10) + 1;
    s.setAttribute('data-pff-refs', String(n));
    return s;
  }

  function unmountStyle() {
    var s = document.getElementById(STYLE_ID);
    if (!s) return;
    var n = parseInt(s.getAttribute('data-pff-refs') || '1', 10) - 1;
    if (n <= 0) {
      if (s.parentNode) s.parentNode.removeChild(s);
    } else {
      s.setAttribute('data-pff-refs', String(n));
    }
  }

  /* ---- builders ----------------------------------------------------- */

  function buildChrome(kicker, head, lede) {
    var box = el('div', 'pff-chrome');
    box.appendChild(el('p', 'pff-kicker', kicker));
    box.appendChild(el('h2', 'pff-head', head));
    box.appendChild(el('p', 'pff-lede', lede));
    return box;
  }

  function buildIcon() {
    var wrap = el('span', 'pff-ind');
    wrap.setAttribute('aria-hidden', 'true');
    wrap.appendChild(el('span', 'pff-bar pff-bar--a'));
    wrap.appendChild(el('span', 'pff-bar pff-bar--b'));
    return wrap;
  }

  /* ---- main --------------------------------------------------------- */

  function initPfFaq(root) {
    var host = typeof root === 'string' ? document.querySelector(root) : root;
    if (!host || !host.appendChild) host = document.body;
    if (!host) return function () {};

    var id = 'pff' + (++uid);
    var styleEl = mountStyle();

    /* motion preference ------------------------------------------- */
    var mq = null, reduced = false;
    try {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      reduced = !!mq.matches;
    } catch (e) { mq = null; }

    /* bookkeeping so cleanup can be exhaustive --------------------- */
    var timers = [];
    var rafs = [];
    var offs = [];   // [target, type, handler]
    var io = null;
    var destroyed = false;

    function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
    function frame(fn) { var r = requestAnimationFrame(fn); rafs.push(r); return r; }
    function on(t, type, fn, opts) { t.addEventListener(type, fn, opts); offs.push([t, type, fn, opts]); }

    /* ---------- DOM ---------- */
    var sec = el('section', 'pff');
    sec.setAttribute('data-screen-label', 'FAQ');
    // /#faq from another page: the section is built at runtime, after the
    // browser has already looked for the fragment, so it gets an id here
    // and a late scroll below.
    if (!document.getElementById('faq')) sec.id = 'faq';

    var wrap = el('div', 'pff-wrap');
    sec.appendChild(wrap);

    var bSec = el('section', 'pff-part pff-faq-sec');
    var grid = el('div', 'pff-grid');
    grid.appendChild(buildChrome(
      'FAQ',
      'Questions worth asking',
      'What merchants ask us before they connect a store. Short answers, no hedging.'
    ));

    var list = el('ul', 'pff-list');
    var items = [];

    for (var i = 0; i < FAQ.length; i++) {
      (function (i) {
        var row = el('li', 'pff-row');
        row.style.setProperty('--pff-d',
          Math.min(i * CFG.REVEAL_STEP, CFG.REVEAL_CAP).toFixed(2) + 's');

        var btnId = id + '-q' + i;
        var panId = id + '-a' + i;

        var btn = el('button', 'pff-q');
        btn.type = 'button';
        btn.id = btnId;
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-controls', panId);
        btn.appendChild(el('span', 'pff-q-text', FAQ[i].q));
        btn.appendChild(buildIcon());

        var panel = el('div', 'pff-panel');
        panel.id = panId;
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-labelledby', btnId);
        panel.hidden = true;
        var inner = el('div', 'pff-panel-inner');
        inner.appendChild(buildAnswer(FAQ[i].a));
        panel.appendChild(inner);

        row.appendChild(btn);
        row.appendChild(panel);
        list.appendChild(row);

        items.push({ row: row, btn: btn, panel: panel, open: false, timer: 0, onEnd: null });

        on(btn, 'click', function () { toggle(i); });
      })(i);
    }

    grid.appendChild(list);
    bSec.appendChild(grid);
    wrap.appendChild(bSec);
    host.appendChild(sec);

    // Arrived on /#faq: the fragment had nothing to land on at load, so
    // scroll once the sections above have had a moment to lay out.
    if (sec.id === 'faq' && location.hash === '#faq') {
      later(function () {
        if (!destroyed && location.hash === '#faq') sec.scrollIntoView({ block: 'start' });
      }, 400);
    }

    /* ---------- panel mechanics ---------- */

    // Cancel any in-flight animation bookkeeping for one panel.
    function disarm(rec) {
      if (rec.timer) { clearTimeout(rec.timer); rec.timer = 0; }
      if (rec.onEnd) {
        rec.panel.removeEventListener('transitionend', rec.onEnd);
        rec.onEnd = null;
      }
    }

    // The single place a panel's resting geometry is written. Called by
    // `transitionend` AND by a fallback timer, so a hidden document (which
    // never fires transitionend) still lands on the correct final state.
    function settle(rec, open) {
      disarm(rec);
      var p = rec.panel;
      p.style.transition = 'none';
      p.style.opacity = open ? '1' : '0';
      if (open) {
        p.style.height = 'auto';      // reflows with its content afterwards
      } else {
        p.style.height = '0px';
        p.hidden = true;              // out of the a11y tree and tab order
      }
    }

    function setPanel(rec, open, animate) {
      disarm(rec);
      rec.open = open;
      rec.btn.setAttribute('aria-expanded', open ? 'true' : 'false');

      var p = rec.panel;

      if (!animate || reduced || CFG.PANEL_MS <= 0) {
        if (open) p.hidden = false;
        settle(rec, open);
        return;
      }

      if (open) p.hidden = false;

      // Current rendered height — non-zero if we are interrupting a
      // half-finished animation, which keeps reversals smooth.
      var from = p.getBoundingClientRect().height;

      p.style.transition = 'none';
      p.style.height = 'auto';
      var to = open ? p.getBoundingClientRect().height : 0;
      p.style.height = from + 'px';
      void p.offsetHeight;                       // force the start frame

      p.style.transition = 'height ' + CFG.PANEL_MS + 'ms ' + EASE +
                           ',opacity ' + CFG.PANEL_MS + 'ms ' + EASE;
      p.style.height = to + 'px';
      p.style.opacity = open ? '1' : '0';

      rec.onEnd = function (ev) {
        if (ev.target !== p || ev.propertyName !== 'height') return;
        settle(rec, open);
      };
      p.addEventListener('transitionend', rec.onEnd);
      rec.timer = later(function () { settle(rec, open); },
                        CFG.PANEL_MS + CFG.SETTLE_SLACK_MS);
    }

    // Independent per-item state — MULTI-OPEN. Opening one row never
    // closes another; this is deliberately not an accordion.
    function toggle(idx) {
      if (destroyed) return;
      setPanel(items[idx], !items[idx].open, true);
    }

    /* keyboard: buttons handle Enter/Space natively; add roving movement */
    function onKey(ev) {
      var k = ev.key;
      if (k !== 'ArrowDown' && k !== 'ArrowUp' && k !== 'Home' && k !== 'End') return;
      var cur = -1;
      for (var n = 0; n < items.length; n++) {
        if (items[n].btn === document.activeElement) { cur = n; break; }
      }
      if (cur < 0) return;
      var next = k === 'Home' ? 0
               : k === 'End' ? items.length - 1
               : k === 'ArrowDown' ? (cur + 1) % items.length
               : (cur - 1 + items.length) % items.length;
      ev.preventDefault();
      items[next].btn.focus();
    }
    on(list, 'keydown', onKey);

    /* optional row open on load, with no animation */
    if (CFG.FIRST_OPEN >= 0 && CFG.FIRST_OPEN < items.length) {
      setPanel(items[CFG.FIRST_OPEN], true, false);
    }

    /* ---------- reveal stagger ----------
       delay(i) = min(i * 0.04, 0.24)s, written as --pff-d above. The class
       flip is gated on IntersectionObserver, which this environment starves
       along with rAF — so there are two independent ways out, and neither
       can leave a row invisible. */
    var revealed = false;
    function revealAll() {
      if (revealed || destroyed) return;
      revealed = true;
      for (var n = 0; n < items.length; n++) items[n].row.classList.add('pff-in');
      if (io) { io.disconnect(); io = null; }
    }

    if (reduced) {
      // nothing to stagger; leave the rows unarmed and fully visible
      revealed = true;
    } else {
      list.classList.add('pff-list--armed');
      if (typeof IntersectionObserver === 'function') {
        var ioReported = false;
        io = new IntersectionObserver(function (entries) {
          ioReported = true;
          for (var n = 0; n < entries.length; n++) {
            if (entries[n].isIntersecting) { revealAll(); return; }
          }
        }, { rootMargin: '-10% 0px -10% 0px', threshold: 0 });
        io.observe(list);
        // (a) the observer never reported at all → it is starved, reveal now
        later(function () { if (!ioReported) revealAll(); }, CFG.IO_STARVED_MS);
      } else {
        frame(revealAll);
        later(revealAll, 0);
      }
      // (b) unconditional backstop — rows are never left hidden
      later(revealAll, CFG.IO_BACKSTOP_MS);
    }

    /* ---------- live reduced-motion changes ---------- */
    function onMq() {
      reduced = !!(mq && mq.matches);
      // Land every panel on a correct resting state for the new mode.
      for (var n = 0; n < items.length; n++) {
        disarm(items[n]);
        settle(items[n], items[n].open);
      }
      // Rows must be visible either way; reduced motion simply skips the
      // stagger rather than gating visibility on an observer.
      revealAll();
    }
    if (mq) {
      if (mq.addEventListener) on(mq, 'change', onMq);
      else if (mq.addListener) { mq.addListener(onMq); offs.push([mq, 'change', onMq, 'legacy']); }
    }

    /* ---------- cleanup ---------- */
    return function cleanup() {
      if (destroyed) return;
      destroyed = true;

      for (var a = 0; a < timers.length; a++) clearTimeout(timers[a]);
      for (var b = 0; b < rafs.length; b++) cancelAnimationFrame(rafs[b]);
      for (var c = 0; c < items.length; c++) disarm(items[c]);

      for (var d = 0; d < offs.length; d++) {
        var o = offs[d];
        if (o[3] === 'legacy') { if (o[0].removeListener) o[0].removeListener(o[2]); }
        else o[0].removeEventListener(o[1], o[2], o[3]);
      }
      offs.length = 0; timers.length = 0; rafs.length = 0;

      if (io) { io.disconnect(); io = null; }
      if (sec.parentNode) sec.parentNode.removeChild(sec);
      unmountStyle();
      void styleEl;
    };
  }

  initPfFaq.CFG = CFG;          // tunables, reachable without a second global
  initPfFaq.FAQ = FAQ.map(function (f) { return { q: f.q, a: answerText(f.a) }; });
  return initPfFaq;
})();
