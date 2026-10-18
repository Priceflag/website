/* =====================================================================
   Priceflag — Vertical "Staged & Reversible" workflow section.
   Choreographed SVG timeline showing how Priceflag stages price rollouts
   and automatically reverts when guardrails are breached.

   Usage:
     <script src="./sections/pf-workflow.js"></script>
     const cleanup = window.initPfWorkflow(host);

   Contract:
     - exactly one global: window.initPfWorkflow
     - builds all of its own DOM inside `root`
     - injects its own <style> once, every selector prefixed .pfw-
     - returns cleanup() that removes listeners and observers
     - zero external dependencies
   ===================================================================== */
(function () {
  'use strict';

  var STYLE_ID = 'pfw-style';
  var SERIF = "'Hedvig Letters Serif', Georgia, Cambria, 'Times New Roman', serif";
  var SANS = "'Inter', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif";
  var MONO = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

  // Easing curves matching Framer Motion / Backenly
  var EASE_DRAW = 'cubic-bezier(0.65, 0, 0.35, 1)';
  var EASE_POP  = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
  var EASE_RISE = 'cubic-bezier(0.16, 1, 0.3, 1)';
  var EASE_FADE = 'ease-out';

  // Palette
  var C_GREEN = '#4ade80';
  var C_AMBER = '#fbbf24';
  var C_PURPLE = '#93aaff';   // brand periwinkle (was violet)
  var C_PURPLE_DEEP = '#1e2ede';   // brand blue (was violet)
  var C_ZINC_LIGHT = '#e4e4e7';
  var C_ZINC_MUTED = '#a1a1aa';
  var C_ZINC_DARK = '#71717a';

  function injectCss(doc) {
    if (doc.getElementById(STYLE_ID)) return;
    var st = doc.createElement('style');
    st.id = STYLE_ID;
    st.textContent = [
      // One shared page background variable, driven by scroll. Every full-width section paints with it,
      // so there are no seams between sections while the page fades navy -> black -> navy.
      ':root { --pf-bg: #030818; }',
      '[data-screen-label="Hero"], [data-screen-label="Statement"], [data-screen-label="Sections"], .pfc, .pfd, .pff, .pfl-root, .pfq { background-color: var(--pf-bg) !important; }',
      '.pfw-section { position: relative; z-index: 2; padding: clamp(90px, 10vh, 140px) clamp(20px, 5vw, 64px) clamp(100px, 12vh, 160px); background: transparent; color: #f3ecde; font-family: ' + SANS + '; overflow: hidden; scroll-margin-top: 100px; }',
      '.pfw-wrap { max-width: 1040px; margin: 0 auto; position: relative; }',
      '.pfw-head { text-align: center; max-width: 720px; margin: 0 auto 36px; }',
      '.pfw-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-family: ' + MONO + '; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #c4ea70; margin-bottom: 14px; }',
      '.pfw-eyebrow-dot { width: 6px; height: 6px; border-radius: 50%; background: #c4ea70; box-shadow: 0 0 10px #c4ea70; }',
      '.pfw-title { font-family: ' + SERIF + '; font-size: clamp(34px, 4.2vw, 56px); font-weight: 400; line-height: 1.1; letter-spacing: -0.02em; color: #f3ecde; margin: 0 0 16px; text-wrap: balance; }',
      '.pfw-sub { font-size: clamp(16px, 1.3vw, 19px); line-height: 1.6; color: rgba(243,236,222,0.72); margin: 0 auto; text-wrap: pretty; }',
      '.pfw-bar { display: flex; align-items: center; justify-content: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.08); }',
      '.pfw-legend { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 24px; list-style: none; margin: 0; padding: 0; font-size: 13.5px; color: #a1a1aa; }',
      '.pfw-legend-item { display: flex; align-items: center; gap: 8px; cursor: default; transition: color 0.2s, transform 0.2s; }',
      '.pfw-legend-item:hover { color: #fff; transform: translateY(-1px); }',
      '.pfw-legend-ring { width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid; display: inline-flex; align-items: center; justify-content: center; }',
      '.pfw-legend-dot { width: 6px; height: 6px; border-radius: 50%; }',
      '.pfw-stage { position: relative; width: 100%; max-width: 980px; margin: 0 auto; background: transparent; border: none; }',
      '.pfw-svg { display: block; width: 100%; height: auto; user-select: none; }',
      '.pfw-mob-svg { display: none; width: 100%; max-width: 440px; margin: 0 auto; height: auto; user-select: none; }',
      '@media (max-width: 767px) { .pfw-desk-svg { display: none; } .pfw-mob-svg { display: block; } }',
      // Immersive Hover Effects
      '.pfw-card-group { cursor: pointer; transform-box: fill-box; transform-origin: center; transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), filter 0.28s ease; }',
      '.pfw-card-group:hover { transform: translateY(-4px); filter: drop-shadow(0 14px 32px rgba(0,0,0,0.9)) drop-shadow(0 0 20px rgba(196,234,112,0.22)); }',
      '.pfw-card-group.pfw-amber:hover { filter: drop-shadow(0 14px 32px rgba(0,0,0,0.9)) drop-shadow(0 0 20px rgba(251,191,36,0.3)); }',
      '.pfw-card-group.pfw-purple:hover { filter: drop-shadow(0 14px 32px rgba(0,0,0,0.9)) drop-shadow(0 0 24px rgba(147,170,255,0.35)); }',
      '.pfw-node-group { cursor: pointer; transform-box: fill-box; transform-origin: center; transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.25s ease; }',
      '.pfw-node-group:hover { transform: scale(1.18); filter: drop-shadow(0 0 10px rgba(74,222,128,0.5)); }',
      '.pfw-node-group.pfw-amber-node:hover { filter: drop-shadow(0 0 10px rgba(251,191,36,0.6)); }',
      '.pfw-pill-group { cursor: pointer; transform-box: fill-box; transform-origin: center; transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), filter 0.25s ease; }',
      '.pfw-pill-group:hover { transform: translateY(-2px); filter: drop-shadow(0 4px 14px rgba(255,255,255,0.12)); }'
    ].join('\n');
    doc.head.appendChild(st);
  }

  /* Glyphs */
  var GLYPH_CHECK  = 'M-5 0.5 L-1.5 4 L5.5 -3.5';
  var GLYPH_UP     = 'M0 5.5 V-5.5 M-4.5 -1 L0 -5.5 L4.5 -1';
  var GLYPH_PERSON = 'M0 -1 A3 3 0 1 0 0 -7 A3 3 0 1 0 0 -1 M-5.5 6 A5.5 5 0 0 1 5.5 6';
  var GLYPH_SUN    = 'M12 8.5 A3.5 3.5 0 1 0 12 15.5 A3.5 3.5 0 1 0 12 8.5 Z M12 2.5 V4.5 M12 19.5 V21.5 M2.5 12 H4.5 M19.5 12 H21.5 M5.3 5.3 L6.7 6.7 M17.3 17.3 L18.7 18.7 M5.3 18.7 L6.7 17.3 M17.3 6.7 L18.7 5.3';
  var GLYPH_MOON   = 'M20 14.5 A8.5 8.5 0 1 1 9.5 4 A7 7 0 0 0 20 14.5 Z';
  var GLYPH_AGENT  = 'M4.5 7 L9.5 12 L4.5 17 M12 17.5 H19.5';
  var GLYPH_AUTONOMY = 'M19.5 12 A7.5 7.5 0 1 1 17.3 6.7 M19.8 3.8 V7.6 H16';

  function buildVerticalDesktopSvg() {
    // Center trunk is X = 490
    var tickDots = [];
    var keyY = [160, 490, 550, 880, 970, 1290];
    for (var y = 100; y <= 1400; y += 45) {
      var isKey = false;
      for (var k = 0; k < keyY.length; k++) {
        if (Math.abs(keyY[k] - y) <= 15) { isKey = true; break; }
      }
      if (!isKey) tickDots.push(y);
    }

    var dotsHtml = tickDots.map(function (ty) {
      return '<circle cx="490" cy="' + ty + '" r="2.5" fill="rgba(255,255,255,0.26)" data-anim="pop" data-delay="' + (0.15 + (ty - 100)/1300 * 1.8).toFixed(3) + '" data-dur="0.3" style="transform-box:fill-box;transform-origin:center;" />';
    }).join('');

    return [
      '<svg viewBox="0 0 980 1560" class="pfw-svg pfw-desk-svg" role="img" aria-label="Vertical timeline of Priceflag staged price rollouts and automatic recovery">',
        '<defs>',
          '<linearGradient id="pfw-vtrack" gradientUnits="userSpaceOnUse" x1="0" y1="70" x2="0" y2="1420">',
            '<stop offset="0" stop-color="#fff" stop-opacity="0.28" />',
            '<stop offset="0.88" stop-color="#fff" stop-opacity="0.22" />',
            '<stop offset="1" stop-color="#fff" stop-opacity="0.04" />',
          '</linearGradient>',
          '<radialGradient id="pfw-night-glow" cx="0.5" cy="0.45" r="0.5">',
            '<stop offset="0" stop-color="#1e2ede" stop-opacity="0.35" />',
            '<stop offset="0.6" stop-color="#0b1a5c" stop-opacity="0.14" />',
            '<stop offset="1" stop-color="#000000" stop-opacity="0" />',
          '</radialGradient>',

          // Branch Masks
          '<mask id="pfw-vm1" maskUnits="userSpaceOnUse" x="0" y="0" width="980" height="1560">',
            '<path d="M490 160 H540 A20 20 0 0 1 560 180 V196" stroke="#fff" stroke-width="6" fill="none" pathLength="1" data-anim="draw" data-delay="0.4" data-dur="0.35" />',
          '</mask>',
          '<mask id="pfw-vm2" maskUnits="userSpaceOnUse" x="0" y="0" width="980" height="1560">',
            '<path d="M702 216 V240" stroke="#fff" stroke-width="6" fill="none" pathLength="1" data-anim="draw" data-delay="0.85" data-dur="0.25" />',
          '</mask>',
          '<mask id="pfw-vm3" maskUnits="userSpaceOnUse" x="0" y="0" width="980" height="1560">',
            '<path d="M490 550 H440 A20 20 0 0 0 420 570 V586" stroke="#fff" stroke-width="6" fill="none" pathLength="1" data-anim="draw" data-delay="0.4" data-dur="0.35" />',
          '</mask>',
          '<mask id="pfw-vm4" maskUnits="userSpaceOnUse" x="0" y="0" width="980" height="1560">',
            '<path d="M265 606 V630" stroke="#fff" stroke-width="6" fill="none" pathLength="1" data-anim="draw" data-delay="0.85" data-dur="0.25" />',
          '</mask>',
          '<mask id="pfw-vm5" maskUnits="userSpaceOnUse" x="0" y="0" width="980" height="1560">',
            '<path d="M490 970 H540 A20 20 0 0 1 560 990 V1006" stroke="#fff" stroke-width="6" fill="none" pathLength="1" data-anim="draw" data-delay="0.4" data-dur="0.35" />',
          '</mask>',
          '<mask id="pfw-vm6" maskUnits="userSpaceOnUse" x="0" y="0" width="980" height="1560">',
            '<path d="M715 1026 V1050" stroke="#fff" stroke-width="6" fill="none" pathLength="1" data-anim="draw" data-delay="0.85" data-dur="0.25" />',
          '</mask>',
          '<mask id="pfw-vm7" maskUnits="userSpaceOnUse" x="0" y="0" width="980" height="1560">',
            '<path d="M490 1290 V1310 A20 20 0 0 1 510 1330 H540" stroke="#fff" stroke-width="6" fill="none" pathLength="1" data-anim="draw" data-delay="5.1" data-dur="0.3" />',
          '</mask>',
        '</defs>',

        // Top Storefront Header Badge
        '<g data-anim="rise" data-delay="0" data-dur="0.5">',
          '<rect x="405" y="20" width="170" height="42" rx="8" fill="#f4f4f5" />',
          '<rect x="413" y="29" width="44" height="24" rx="4" fill="#16a34a" />',
          '<text x="435" y="45" text-anchor="middle" font-size="11" letter-spacing="0.06em" fill="#f0fdf4" font-family="' + MONO + '">LIVE</text>',
          '<text x="468" y="46" font-size="14.5" font-weight="500" fill="#09090b">Storefront</text>',
        '</g>',

        // Central Vertical Track Line
        '<path d="M490 62 V1420" stroke="url(#pfw-vtrack)" stroke-width="1.25" fill="none" pathLength="1" data-anim="draw" data-delay="0.15" data-dur="1.8" />',

        // Central Tick Dots
        dotsHtml,

        // Day Indicator
        '<g data-anim="fade" data-delay="0.1" data-dur="0.5">',
          '<svg x="506" y="80" width="14" height="14" viewBox="0 0 24 24"><path d="' + GLYPH_SUN + '" stroke="#a1a1aa" stroke-width="2" fill="none" stroke-linecap="round" /></svg>',
          '<text x="528" y="91" font-size="12" fill="#71717a" font-family="' + MONO + '">storefront active</text>',
        '</g>',

        // ================= STAGE 1: 10:00 - CANDIDATE PRICES (Right Side) =================
        '<g data-anim="pop" data-delay="0.3" data-dur="0.45" style="transform-box:fill-box;transform-origin:center;">',
          '<circle cx="490" cy="160" r="8" fill="#08090a" stroke="' + C_ZINC_LIGHT + '" stroke-opacity="0.55" stroke-width="1.25" />',
          '<circle cx="490" cy="160" r="3.5" fill="' + C_ZINC_LIGHT + '" />',
        '</g>',
        '<text x="466" y="164" text-anchor="end" font-size="12" fill="#71717a" font-family="' + MONO + '" data-anim="fade" data-delay="0.35" data-dur="0.3">10:00</text>',

        '<path d="M490 160 H540 A20 20 0 0 1 560 180 V196" stroke="rgba(255,255,255,0.32)" stroke-width="1.25" stroke-dasharray="3 5" fill="none" mask="url(#pfw-vm1)" />',

        // Actor Pill
        '<g class="pfw-pill-group" data-anim="rise" data-delay="0.5" data-dur="0.45">',
          '<rect x="560" y="180" width="285" height="36" rx="18" fill="#0c0d10" stroke="rgba(255,255,255,0.14)" />',
          '<svg x="576" y="190" width="16" height="16" viewBox="0 0 24 24"><path d="' + GLYPH_AGENT + '" stroke="#e4e4e7" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" /></svg>',
          '<text x="600" y="202" font-size="12.5" font-family="' + MONO + '"><tspan fill="#71717a">Merchant </tspan><tspan fill="#f4f4f5">stage candidate prices</tspan></text>',
        '</g>',

        '<path d="M702 216 V240" stroke="rgba(255,255,255,0.32)" stroke-width="1.25" stroke-dasharray="3 5" fill="none" mask="url(#pfw-vm2)" />',

        // Forecast Box (W: 410, fits all content cleanly)
        '<g class="pfw-card-group" data-anim="rise" data-delay="0.9" data-dur="0.5">',
          '<rect x="540" y="240" width="410" height="136" rx="12" fill="#0c0d10" stroke="rgba(255,255,255,0.12)" />',
          '<rect x="556" y="254" width="82" height="24" rx="4" fill="#09090b" />',
          '<text x="597" y="270" text-anchor="middle" font-size="11" letter-spacing="0.06em" fill="#fafafa" font-family="' + MONO + '">FORECAST</text>',
          '<text x="648" y="271" font-size="16" font-weight="600" fill="#f4f4f5">+$1,420 / mo estimated</text>',
          '<text x="556" y="296" font-size="13" fill="#a1a1aa">6 everyday basics selected &middot; +6% target price</text>',
          // Metric Chips
          '<rect x="556" y="312" width="176" height="28" rx="6" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />',
          '<text x="566" y="330" font-size="11" font-family="' + MONO + '" fill="#e4e4e7">Break-even: -3.8% units</text>',
          '<rect x="740" y="312" width="194" height="28" rx="6" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />',
          '<text x="750" y="330" font-size="11" font-family="' + MONO + '" fill="#c4ea70">Model: 95% confidence</text>',
        '</g>',

        // Line down to verification steps
        '<path d="M745 376 V396" stroke="' + C_GREEN + '" stroke-width="1.5" stroke-linecap="round" fill="none" pathLength="1" data-anim="draw" data-delay="1.3" data-dur="0.2" />',

        // Step 1: Applied (2 items)
        '<g class="pfw-node-group" data-anim="pop" data-delay="1.5" data-dur="0.45" style="transform-box:fill-box;transform-origin:center;">',
          '<circle cx="650" cy="420" r="18" fill="#08090a" stroke="' + C_GREEN + '" stroke-width="1.5" />',
          '<path d="' + GLYPH_UP + '" transform="translate(650 420)" stroke="' + C_GREEN + '" stroke-width="1.75" fill="none" stroke-linecap="round" stroke-linejoin="round" />',
        '</g>',
        '<text x="650" y="450" text-anchor="middle" font-size="13" fill="#a1a1aa" data-anim="fade" data-delay="1.55" data-dur="0.3">Applied</text>',

        // Line to Step 2
        '<path d="M668 420 H732" stroke="' + C_GREEN + '" stroke-width="1.5" stroke-linecap="round" fill="none" pathLength="1" data-anim="draw" data-delay="1.65" data-dur="0.2" />',

        // Step 2: Orders in range
        '<g class="pfw-node-group" data-anim="pop" data-delay="1.85" data-dur="0.45" style="transform-box:fill-box;transform-origin:center;">',
          '<circle cx="750" cy="420" r="18" fill="#08090a" stroke="' + C_GREEN + '" stroke-width="1.5" />',
          '<path d="' + GLYPH_CHECK + '" transform="translate(750 420)" stroke="' + C_GREEN + '" stroke-width="1.75" fill="none" stroke-linecap="round" stroke-linejoin="round" />',
        '</g>',
        '<text x="750" y="450" text-anchor="middle" font-size="13" fill="#a1a1aa" data-anim="fade" data-delay="1.9" data-dur="0.3">In range</text>',

        // Return curve down to central trunk
        '<path d="M768 420 H810 A24 24 0 0 1 834 444 V466 A24 24 0 0 1 810 490 H490" stroke="' + C_GREEN + '" stroke-width="1.5" stroke-linecap="round" fill="none" pathLength="1" data-anim="draw" data-delay="2.05" data-dur="0.5" />',

        // Merged node on trunk at y=490
        '<g data-anim="pop" data-delay="2.55" data-dur="0.45" style="transform-box:fill-box;transform-origin:center;">',
          '<circle cx="490" cy="490" r="8" fill="#08090a" stroke="' + C_GREEN + '" stroke-opacity="0.55" stroke-width="1.25" />',
          '<circle cx="490" cy="490" r="3.5" fill="' + C_GREEN + '" />',
        '</g>',

        // ================= STAGE 2: 16:30 - NEEDS YOU / REVIEW (Left Side) =================
        '<g data-anim="pop" data-delay="0.65" data-dur="0.45" style="transform-box:fill-box;transform-origin:center;">',
          '<circle cx="490" cy="550" r="8" fill="#08090a" stroke="' + C_ZINC_LIGHT + '" stroke-opacity="0.55" stroke-width="1.25" />',
          '<circle cx="490" cy="550" r="3.5" fill="' + C_ZINC_LIGHT + '" />',
        '</g>',
        '<text x="514" y="554" text-anchor="start" font-size="12" fill="#71717a" font-family="' + MONO + '" data-anim="fade" data-delay="0.7" data-dur="0.3">16:30</text>',

        '<path d="M490 550 H440 A20 20 0 0 0 420 570 V586" stroke="rgba(255,255,255,0.32)" stroke-width="1.25" stroke-dasharray="3 5" fill="none" mask="url(#pfw-vm3)" />',

        // Actor Pill (Priceflag: review before 100% rollout) - Widened to 310, x=110 to fit comfortably
        '<g class="pfw-pill-group" data-anim="rise" data-delay="0.9" data-dur="0.45">',
          '<rect x="110" y="570" width="310" height="36" rx="18" fill="#0c0d10" stroke="rgba(255,255,255,0.14)" />',
          '<svg x="126" y="580" width="16" height="16" viewBox="0 0 24 24"><path d="' + GLYPH_AGENT + '" stroke="#e4e4e7" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" /></svg>',
          '<text x="150" y="592" font-size="12.5" font-family="' + MONO + '"><tspan fill="#71717a">Priceflag </tspan><tspan fill="#f4f4f5">review before 100% rollout</tspan></text>',
        '</g>',

        '<path d="M265 606 V630" stroke="rgba(255,255,255,0.32)" stroke-width="1.25" stroke-dasharray="3 5" fill="none" mask="url(#pfw-vm4)" />',

        // Needs You Box (W: 410, x=30)
        '<g class="pfw-card-group pfw-amber" data-anim="rise" data-delay="1.3" data-dur="0.5">',
          '<rect x="30" y="630" width="410" height="140" rx="12" fill="#0c0d10" stroke="rgba(251,191,36,0.28)" />',
          '<rect x="46" y="644" width="86" height="24" rx="4" fill="' + C_AMBER + '" />',
          '<text x="89" y="660" text-anchor="middle" font-size="11" letter-spacing="0.06em" fill="#1c1407" font-family="' + MONO + '">NEEDS YOU</text>',
          '<text x="142" y="661" font-size="16" font-weight="600" fill="#f4f4f5">Margin sensitivity check</text>',
          '<text x="46" y="688" font-size="13" fill="#a1a1aa">Widening rollout touches high-volume SKU-4</text>',
          // Warning alert pill
          '<rect x="46" y="704" width="378" height="28" rx="6" fill="rgba(251,191,36,0.06)" stroke="rgba(251,191,36,0.2)" />',
          '<text x="56" y="722" font-size="11.5" font-family="' + MONO + '" fill="' + C_AMBER + '">Rollout held for review. Awaiting approval.</text>',
        '</g>',

        // Line down to Approval and Applied
        '<path d="M235 770 V790" stroke="' + C_AMBER + '" stroke-width="1.5" stroke-linecap="round" fill="none" pathLength="1" data-anim="draw" data-delay="1.7" data-dur="0.2" />',

        // Approval Node
        '<g class="pfw-node-group pfw-amber-node" data-anim="pop" data-delay="1.9" data-dur="0.45" style="transform-box:fill-box;transform-origin:center;">',
          '<circle cx="180" cy="815" r="18" fill="#08090a" stroke="' + C_AMBER + '" stroke-width="1.5" />',
          '<path d="' + GLYPH_PERSON + '" transform="translate(180 815)" stroke="' + C_AMBER + '" stroke-width="1.75" fill="none" stroke-linecap="round" stroke-linejoin="round" />',
        '</g>',
        '<text x="180" y="845" text-anchor="middle" font-size="13" fill="#a1a1aa" data-anim="fade" data-delay="1.95" data-dur="0.3">You approved</text>',

        // Line to Applied Node
        '<path d="M198 815 H262" stroke="' + C_GREEN + '" stroke-width="1.5" stroke-linecap="round" fill="none" pathLength="1" data-anim="draw" data-delay="2.1" data-dur="0.2" />',

        // Applied Node
        '<g class="pfw-node-group" data-anim="pop" data-delay="2.3" data-dur="0.45" style="transform-box:fill-box;transform-origin:center;">',
          '<circle cx="280" cy="815" r="18" fill="#08090a" stroke="' + C_GREEN + '" stroke-width="1.5" />',
          '<path d="' + GLYPH_UP + '" transform="translate(280 815)" stroke="' + C_GREEN + '" stroke-width="1.75" fill="none" stroke-linecap="round" stroke-linejoin="round" />',
        '</g>',
        '<text x="280" y="845" text-anchor="middle" font-size="13" fill="#a1a1aa" data-anim="fade" data-delay="2.35" data-dur="0.3">All 6 live</text>',

        // Return curve to trunk - Smooth, beautiful cubic S-curve with zero kinks
        '<path d="M298 815 H350 C415 815 425 880 490 880" stroke="' + C_GREEN + '" stroke-width="1.5" stroke-linecap="round" fill="none" pathLength="1" data-anim="draw" data-delay="2.5" data-dur="0.45" />',

        // Merged node on trunk at y=880
        '<g data-anim="pop" data-delay="2.95" data-dur="0.45" style="transform-box:fill-box;transform-origin:center;">',
          '<circle cx="490" cy="880" r="8" fill="#08090a" stroke="' + C_GREEN + '" stroke-opacity="0.55" stroke-width="1.25" />',
          '<circle cx="490" cy="880" r="3.5" fill="' + C_GREEN + '" />',
        '</g>',

        // ================= STAGE 3: 02:14 - OVERNIGHT GUARDRAIL & AUTO-REVERT (Right Side) =================
        // Atmospheric Night Glow Rect
        '<rect x="20" y="910" width="940" height="610" rx="20" fill="url(#pfw-night-glow)" data-anim="fade" data-delay="2.6" data-dur="0.8" />',

        // Moon & Guardrail Indicator
        '<g data-anim="fade" data-delay="2.8" data-dur="0.6">',
          '<svg x="506" y="930" width="14" height="14" viewBox="0 0 24 24"><path d="' + GLYPH_MOON + '" fill="' + C_PURPLE + '" fill-opacity="0.8" /></svg>',
          '<text x="528" y="941" font-size="12" fill="#93aaff" font-family="' + MONO + '">guardrail active &middot; orders monitored</text>',
        '</g>',

        // Trunk node at 02:14
        '<g data-anim="pop" data-delay="3.0" data-dur="0.45" style="transform-box:fill-box;transform-origin:center;">',
          '<circle cx="490" cy="970" r="8" fill="#08090a" stroke="' + C_PURPLE + '" stroke-opacity="0.55" stroke-width="1.25" />',
          '<circle cx="490" cy="970" r="3.5" fill="' + C_PURPLE + '" />',
        '</g>',
        '<text x="466" y="974" text-anchor="end" font-size="12" fill="#93aaff" font-family="' + MONO + '" data-anim="fade" data-delay="3.05" data-dur="0.3">02:14</text>',

        '<path d="M490 970 H540 A20 20 0 0 1 560 990 V1006" stroke="rgba(147,170,255,0.55)" stroke-width="1.25" stroke-dasharray="3 5" fill="none" mask="url(#pfw-vm5)" />',

        // Actor Pill (Priceflag: flags order velocity dip) - Widened to 310 to fit comfortably
        '<g class="pfw-pill-group" data-anim="rise" data-delay="3.3" data-dur="0.45">',
          '<rect x="560" y="990" width="310" height="36" rx="18" fill="#0c0d10" stroke="rgba(147,170,255,0.4)" />',
          '<svg x="576" y="1000" width="16" height="16" viewBox="0 0 24 24"><path d="' + GLYPH_AUTONOMY + '" stroke="' + C_PURPLE + '" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" /></svg>',
          '<text x="600" y="1012" font-size="12.5" font-family="' + MONO + '"><tspan fill="' + C_PURPLE + '">Priceflag </tspan><tspan fill="#f4f4f5">flags order velocity dip</tspan></text>',
        '</g>',

        '<path d="M715 1026 V1050" stroke="rgba(147,170,255,0.55)" stroke-width="1.25" stroke-dasharray="3 5" fill="none" mask="url(#pfw-vm6)" />',

        // Auto-Revert Box (W: 410)
        '<g class="pfw-card-group pfw-purple" data-anim="rise" data-delay="3.7" data-dur="0.5">',
          '<rect x="540" y="1050" width="410" height="130" rx="12" fill="#0c0d10" stroke="rgba(147,170,255,0.3)" />',
          '<rect x="556" y="1064" width="96" height="24" rx="4" fill="' + C_PURPLE_DEEP + '" />',
          '<text x="604" y="1080" text-anchor="middle" font-size="11" letter-spacing="0.06em" fill="#fafafa" font-family="' + MONO + '">AUTO-REVERT</text>',
          '<text x="664" y="1081" font-size="16" font-weight="600" fill="#f4f4f5">Restoring original prices</text>',
          '<text x="556" y="1108" font-size="13" fill="#a1a1aa">2 consecutive days tracking below statistical forecast band</text>',
          '<text x="556" y="1130" font-size="12" font-family="' + MONO + '" fill="' + C_PURPLE + '">Pre-rollout prices retrieved from price journal</text>',
        '</g>',

        // Line to Storefront Verified
        '<path d="M745 1180 V1204" stroke="' + C_GREEN + '" stroke-width="1.5" stroke-linecap="round" fill="none" pathLength="1" data-anim="draw" data-delay="4.1" data-dur="0.2" />',

        // Verified Node
        '<g class="pfw-node-group" data-anim="pop" data-delay="4.3" data-dur="0.45" style="transform-box:fill-box;transform-origin:center;">',
          '<circle cx="745" cy="1225" r="18" fill="#08090a" stroke="' + C_GREEN + '" stroke-width="1.5" />',
          '<path d="' + GLYPH_CHECK + '" transform="translate(745 1225)" stroke="' + C_GREEN + '" stroke-width="1.75" fill="none" stroke-linecap="round" stroke-linejoin="round" />',
        '</g>',
        '<text x="745" y="1255" text-anchor="middle" font-size="13" fill="#a1a1aa" data-anim="fade" data-delay="4.35" data-dur="0.3">Catalog verified</text>',

        // Return curve down to main track
        '<path d="M763 1225 H810 A24 24 0 0 1 834 1249 V1266 A24 24 0 0 1 810 1290 H490" stroke="' + C_GREEN + '" stroke-width="1.5" stroke-linecap="round" fill="none" pathLength="1" data-anim="draw" data-delay="4.55" data-dur="0.45" />',

        // Merged node on trunk at y=1290
        '<g data-anim="pop" data-delay="5.0" data-dur="0.45" style="transform-box:fill-box;transform-origin:center;">',
          '<circle cx="490" cy="1290" r="8" fill="#08090a" stroke="' + C_GREEN + '" stroke-opacity="0.55" stroke-width="1.25" />',
          '<circle cx="490" cy="1290" r="3.5" fill="' + C_GREEN + '" />',
        '</g>',
        '<text x="466" y="1294" text-anchor="end" font-size="12" fill="#71717a" font-family="' + MONO + '" data-anim="fade" data-delay="5.05" data-dur="0.3">02:15</text>',

        // Branch line down to Receipt Card
        '<path d="M490 1290 V1310 A20 20 0 0 1 510 1330 H540" stroke="rgba(147,170,255,0.55)" stroke-width="1.25" stroke-dasharray="3 5" fill="none" mask="url(#pfw-vm7)" />',

        // Detailed Audit Receipt Card (W: 440)
        '<g class="pfw-card-group pfw-purple" data-anim="rise" data-delay="5.2" data-dur="0.55">',
          '<rect x="510" y="1310" width="440" height="195" rx="12" fill="#0c0d10" stroke="rgba(147,170,255,0.35)" />',
          '<path d="' + GLYPH_CHECK + '" transform="translate(534 1334) scale(0.85)" stroke="' + C_GREEN + '" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />',
          '<text x="552" y="1339" font-size="15" font-weight="600" fill="#f4f4f5">Reverted while you slept</text>',
          '<text x="932" y="1338" text-anchor="end" font-size="11.5" letter-spacing="0.04em" fill="' + C_PURPLE + '" font-family="' + MONO + '">immutable audit</text>',
          '<line x1="510" x2="950" y1="1354.5" y2="1354.5" stroke="rgba(255,255,255,0.07)" />',

          // Receipt Rows
          '<text x="528" y="1378" font-size="12.5" fill="#71717a" font-family="' + MONO + '">02:14</text>',
          '<text x="578" y="1378" font-size="12.5" fill="' + C_PURPLE + '" font-family="' + MONO + '">detected</text>',
          '<text x="648" y="1378" font-size="12.5" fill="#e4e4e7" font-family="' + MONO + '">2 days below forecast confidence band</text>',

          '<text x="528" y="1402" font-size="12.5" fill="#71717a" font-family="' + MONO + '">02:14</text>',
          '<text x="578" y="1402" font-size="12.5" fill="' + C_PURPLE + '" font-family="' + MONO + '">journal</text>',
          '<text x="648" y="1402" font-size="12.5" fill="#e4e4e7" font-family="' + MONO + '">original $24.00 prices restored</text>',

          '<text x="528" y="1426" font-size="12.5" fill="#71717a" font-family="' + MONO + '">02:15</text>',
          '<text x="578" y="1426" font-size="12.5" fill="' + C_PURPLE + '" font-family="' + MONO + '">shopify</text>',
          '<text x="648" y="1426" font-size="12.5" fill="#e4e4e7" font-family="' + MONO + '">catalog read back &amp; verified in sync</text>',

          '<text x="528" y="1450" font-size="12.5" fill="#71717a" font-family="' + MONO + '">02:16</text>',
          '<text x="578" y="1450" font-size="12.5" fill="' + C_PURPLE + '" font-family="' + MONO + '">alert</text>',
          '<text x="648" y="1450" font-size="12.5" fill="#e4e4e7" font-family="' + MONO + '">merchant report sent &amp; logged</text>',

          '<line x1="510" x2="950" y1="1466.5" y2="1466.5" stroke="rgba(255,255,255,0.07)" />',
          '<text x="528" y="1488" font-size="12" fill="#71717a">Zero lost sales compounded. Catalog verified safe.</text>',
        '</g>',
      '</svg>'
    ].join('');
  }

  function buildVerticalMobileSvg() {
    return [
      '<svg viewBox="0 0 420 1780" class="pfw-svg pfw-mob-svg" role="img" aria-label="Mobile vertical timeline of price change rollout and rollback">',
        '<defs>',
          '<linearGradient id="pfwm-vtrack" gradientUnits="userSpaceOnUse" x1="0" y1="70" x2="0" y2="1620">',
            '<stop offset="0" stop-color="#fff" stop-opacity="0.28" />',
            '<stop offset="0.88" stop-color="#fff" stop-opacity="0.22" />',
            '<stop offset="1" stop-color="#fff" stop-opacity="0.04" />',
          '</linearGradient>',
          '<radialGradient id="pfwm-night-glow" cx="0.5" cy="0.45" r="0.5">',
            '<stop offset="0" stop-color="#1e2ede" stop-opacity="0.36" />',
            '<stop offset="0.6" stop-color="#0b1a5c" stop-opacity="0.14" />',
            '<stop offset="1" stop-color="#000000" stop-opacity="0" />',
          '</radialGradient>',

          // Mobile masks
          '<mask id="pfwm-vm1" maskUnits="userSpaceOnUse" x="0" y="0" width="420" height="1780">',
            '<path d="M210 160 H280 A20 20 0 0 1 300 180 V196" stroke="#fff" stroke-width="6" fill="none" pathLength="1" data-anim="draw" data-delay="0.2" data-dur="0.35" />',
          '</mask>',
          '<mask id="pfwm-vm2" maskUnits="userSpaceOnUse" x="0" y="0" width="420" height="1780">',
            '<path d="M300 228 V250" stroke="#fff" stroke-width="6" fill="none" pathLength="1" data-anim="draw" data-delay="0.6" data-dur="0.2" />',
          '</mask>',
          '<mask id="pfwm-vm3" maskUnits="userSpaceOnUse" x="0" y="0" width="420" height="1780">',
            '<path d="M210 600 H140 A20 20 0 0 0 120 620 V636" stroke="#fff" stroke-width="6" fill="none" pathLength="1" data-anim="draw" data-delay="0.2" data-dur="0.35" />',
          '</mask>',
          '<mask id="pfwm-vm4" maskUnits="userSpaceOnUse" x="0" y="0" width="420" height="1780">',
            '<path d="M120 668 V690" stroke="#fff" stroke-width="6" fill="none" pathLength="1" data-anim="draw" data-delay="0.6" data-dur="0.2" />',
          '</mask>',
          '<mask id="pfwm-vm5" maskUnits="userSpaceOnUse" x="0" y="0" width="420" height="1780">',
            '<path d="M210 1060 H280 A20 20 0 0 1 300 1080 V1096" stroke="#fff" stroke-width="6" fill="none" pathLength="1" data-anim="draw" data-delay="0.2" data-dur="0.35" />',
          '</mask>',
          '<mask id="pfwm-vm6" maskUnits="userSpaceOnUse" x="0" y="0" width="420" height="1780">',
            '<path d="M300 1128 V1150" stroke="#fff" stroke-width="6" fill="none" pathLength="1" data-anim="draw" data-delay="0.6" data-dur="0.2" />',
          '</mask>',
        '</defs>',

        // Top Storefront Header Badge
        '<g data-anim="rise" data-delay="0" data-dur="0.5">',
          '<rect x="134" y="20" width="152" height="38" rx="8" fill="#f4f4f5" />',
          '<rect x="142" y="28" width="40" height="22" rx="4" fill="#16a34a" />',
          '<text x="162" y="43" text-anchor="middle" font-size="10" letter-spacing="0.06em" fill="#f0fdf4" font-family="' + MONO + '">LIVE</text>',
          '<text x="190" y="44" font-size="13.5" font-weight="500" fill="#09090b">Storefront</text>',
        '</g>',

        // Center Track
        '<path d="M210 60 V1650" stroke="url(#pfwm-vtrack)" stroke-width="1.25" fill="none" pathLength="1" data-anim="draw" data-delay="0.15" data-dur="1.8" />',

        // Day label
        '<g data-anim="fade" data-delay="0.1" data-dur="0.4">',
          '<svg x="156" y="80" width="13" height="13" viewBox="0 0 24 24"><path d="' + GLYPH_SUN + '" stroke="#a1a1aa" stroke-width="2" fill="none" stroke-linecap="round" /></svg>',
          '<text x="176" y="91" font-size="11" fill="#71717a" font-family="' + MONO + '">storefront active</text>',
        '</g>',

        // Stage 1 (Mobile)
        '<g data-anim="pop" data-delay="0.25" data-dur="0.4" style="transform-box:fill-box;transform-origin:center;">',
          '<circle cx="210" cy="160" r="7.5" fill="#08090a" stroke="' + C_ZINC_LIGHT + '" stroke-opacity="0.55" stroke-width="1.25" />',
          '<circle cx="210" cy="160" r="3.25" fill="' + C_ZINC_LIGHT + '" />',
        '</g>',
        '<text x="194" y="164" text-anchor="end" font-size="11" fill="#71717a" font-family="' + MONO + '" data-anim="fade" data-delay="0.3" data-dur="0.3">10:00</text>',
        '<path d="M210 160 H280 A20 20 0 0 1 300 180 V196" stroke="rgba(255,255,255,0.32)" stroke-width="1.25" stroke-dasharray="3 5" fill="none" mask="url(#pfwm-vm1)" />',

        '<g class="pfw-pill-group" data-anim="rise" data-delay="0.4" data-dur="0.4">',
          '<rect x="210" y="196" width="180" height="32" rx="16" fill="#0c0d10" stroke="rgba(255,255,255,0.16)" />',
          '<text x="300" y="216" text-anchor="middle" font-size="11.5" fill="#f4f4f5" font-family="' + MONO + '">stage candidate prices</text>',
        '</g>',

        '<path d="M300 228 V250" stroke="rgba(255,255,255,0.32)" stroke-width="1.25" stroke-dasharray="3 5" fill="none" mask="url(#pfwm-vm2)" />',

        // Forecast Box (Mobile)
        '<g class="pfw-card-group" data-anim="rise" data-delay="0.75" data-dur="0.4">',
          '<rect x="180" y="250" width="230" height="110" rx="10" fill="#0c0d10" stroke="rgba(255,255,255,0.14)" />',
          '<rect x="194" y="262" width="72" height="22" rx="4" fill="#09090b" />',
          '<text x="230" y="277" text-anchor="middle" font-size="10" letter-spacing="0.06em" fill="#fafafa" font-family="' + MONO + '">FORECAST</text>',
          '<text x="194" y="302" font-size="14.5" font-weight="600" fill="#f4f4f5">+$1,420 / mo</text>',
          '<text x="194" y="322" font-size="11.5" fill="#a1a1aa">6 basics &middot; +6% price target</text>',
          '<text x="194" y="342" font-size="11" font-family="' + MONO + '" fill="#c4ea70">Break-even: -3.8% units</text>',
        '</g>',

        '<path d="M300 360 V385" stroke="' + C_GREEN + '" stroke-width="1.5" stroke-linecap="round" fill="none" pathLength="1" data-anim="draw" data-delay="1.0" data-dur="0.2" />',
        '<g class="pfw-node-group" data-anim="pop" data-delay="1.15" data-dur="0.4" style="transform-box:fill-box;transform-origin:center;">',
          '<circle cx="300" cy="405" r="16" fill="#08090a" stroke="' + C_GREEN + '" stroke-width="1.5" />',
          '<path d="' + GLYPH_UP + '" transform="translate(300 405) scale(0.9)" stroke="' + C_GREEN + '" stroke-width="1.75" fill="none" stroke-linecap="round" stroke-linejoin="round" />',
        '</g>',
        '<text x="274" y="410" text-anchor="end" font-size="12" fill="#a1a1aa" data-anim="fade" data-delay="1.2" data-dur="0.3">Applied</text>',

        '<path d="M300 421 V446" stroke="' + C_GREEN + '" stroke-width="1.5" stroke-linecap="round" fill="none" pathLength="1" data-anim="draw" data-delay="1.3" data-dur="0.2" />',
        '<g class="pfw-node-group" data-anim="pop" data-delay="1.45" data-dur="0.4" style="transform-box:fill-box;transform-origin:center;">',
          '<circle cx="300" cy="466" r="16" fill="#08090a" stroke="' + C_GREEN + '" stroke-width="1.5" />',
          '<path d="' + GLYPH_CHECK + '" transform="translate(300 466) scale(0.9)" stroke="' + C_GREEN + '" stroke-width="1.75" fill="none" stroke-linecap="round" stroke-linejoin="round" />',
        '</g>',
        '<text x="274" y="471" text-anchor="end" font-size="12" fill="#a1a1aa" data-anim="fade" data-delay="1.5" data-dur="0.3">In range</text>',

        '<path d="M300 482 V502 A22 22 0 0 1 278 524 H210" stroke="' + C_GREEN + '" stroke-width="1.5" stroke-linecap="round" fill="none" pathLength="1" data-anim="draw" data-delay="1.6" data-dur="0.4" />',
        '<g data-anim="pop" data-delay="1.95" data-dur="0.4" style="transform-box:fill-box;transform-origin:center;">',
          '<circle cx="210" cy="524" r="7.5" fill="#08090a" stroke="' + C_GREEN + '" stroke-opacity="0.55" stroke-width="1.25" />',
          '<circle cx="210" cy="524" r="3.25" fill="' + C_GREEN + '" />',
        '</g>',

        // Stage 2 (Left Side on Mobile)
        '<g data-anim="pop" data-delay="0.65" data-dur="0.4" style="transform-box:fill-box;transform-origin:center;">',
          '<circle cx="210" cy="600" r="7.5" fill="#08090a" stroke="' + C_ZINC_LIGHT + '" stroke-opacity="0.55" stroke-width="1.25" />',
          '<circle cx="210" cy="600" r="3.25" fill="' + C_ZINC_LIGHT + '" />',
        '</g>',
        '<text x="226" y="604" text-anchor="start" font-size="11" fill="#71717a" font-family="' + MONO + '" data-anim="fade" data-delay="0.7" data-dur="0.3">16:30</text>',
        '<path d="M210 600 H140 A20 20 0 0 0 120 620 V636" stroke="rgba(255,255,255,0.32)" stroke-width="1.25" stroke-dasharray="3 5" fill="none" mask="url(#pfwm-vm3)" />',

        '<g class="pfw-pill-group" data-anim="rise" data-delay="0.4" data-dur="0.4">',
          '<rect x="30" y="636" width="180" height="32" rx="16" fill="#0c0d10" stroke="rgba(255,255,255,0.16)" />',
          '<text x="120" y="656" text-anchor="middle" font-size="11.5" fill="#f4f4f5" font-family="' + MONO + '">review 100% rollout</text>',
        '</g>',

        '<path d="M120 668 V690" stroke="rgba(255,255,255,0.32)" stroke-width="1.25" stroke-dasharray="3 5" fill="none" mask="url(#pfwm-vm4)" />',

        // Needs You Box (Mobile)
        '<g class="pfw-card-group pfw-amber" data-anim="rise" data-delay="0.75" data-dur="0.4">',
          '<rect x="10" y="690" width="230" height="110" rx="10" fill="#0c0d10" stroke="rgba(251,191,36,0.3)" />',
          '<rect x="24" y="702" width="78" height="22" rx="4" fill="' + C_AMBER + '" />',
          '<text x="63" y="717" text-anchor="middle" font-size="10" letter-spacing="0.06em" fill="#1c1407" font-family="' + MONO + '">NEEDS YOU</text>',
          '<text x="24" y="742" font-size="14.5" font-weight="600" fill="#f4f4f5">Margin check</text>',
          '<text x="24" y="762" font-size="11.5" fill="#a1a1aa">High-volume SKU-4</text>',
          '<text x="24" y="782" font-size="11" font-family="' + MONO + '" fill="' + C_AMBER + '">Awaiting approval</text>',
        '</g>',

        '<path d="M120 800 V825" stroke="' + C_AMBER + '" stroke-width="1.5" stroke-linecap="round" fill="none" pathLength="1" data-anim="draw" data-delay="0.95" data-dur="0.2" />',
        '<g class="pfw-node-group pfw-amber-node" data-anim="pop" data-delay="1.1" data-dur="0.4" style="transform-box:fill-box;transform-origin:center;">',
          '<circle cx="120" cy="845" r="16" fill="#08090a" stroke="' + C_AMBER + '" stroke-width="1.5" />',
          '<path d="' + GLYPH_PERSON + '" transform="translate(120 845) scale(0.9)" stroke="' + C_AMBER + '" stroke-width="1.75" fill="none" stroke-linecap="round" stroke-linejoin="round" />',
        '</g>',
        '<text x="146" y="850" text-anchor="start" font-size="12" fill="#a1a1aa" data-anim="fade" data-delay="1.15" data-dur="0.3">Approved</text>',

        '<path d="M120 861 V886" stroke="' + C_GREEN + '" stroke-width="1.5" stroke-linecap="round" fill="none" pathLength="1" data-anim="draw" data-delay="1.25" data-dur="0.2" />',
        '<g class="pfw-node-group" data-anim="pop" data-delay="1.4" data-dur="0.4" style="transform-box:fill-box;transform-origin:center;">',
          '<circle cx="120" cy="906" r="16" fill="#08090a" stroke="' + C_GREEN + '" stroke-width="1.5" />',
          '<path d="' + GLYPH_UP + '" transform="translate(120 906) scale(0.9)" stroke="' + C_GREEN + '" stroke-width="1.75" fill="none" stroke-linecap="round" stroke-linejoin="round" />',
        '</g>',
        '<text x="146" y="911" text-anchor="start" font-size="12" fill="#a1a1aa" data-anim="fade" data-delay="1.45" data-dur="0.3">Applied</text>',

        '<path d="M120 922 V942 A22 22 0 0 0 142 964 H210" stroke="' + C_GREEN + '" stroke-width="1.5" stroke-linecap="round" fill="none" pathLength="1" data-anim="draw" data-delay="1.55" data-dur="0.4" />',
        '<g data-anim="pop" data-delay="1.95" data-dur="0.4" style="transform-box:fill-box;transform-origin:center;">',
          '<circle cx="210" cy="964" r="7.5" fill="#08090a" stroke="' + C_GREEN + '" stroke-opacity="0.55" stroke-width="1.25" />',
          '<circle cx="210" cy="964" r="3.25" fill="' + C_GREEN + '" />',
        '</g>',

        // Night zone on mobile
        '<rect x="10" y="1000" width="400" height="740" rx="16" fill="url(#pfwm-night-glow)" data-anim="fade" data-delay="1.8" data-dur="0.7" />',
        '<g data-anim="fade" data-delay="1.9" data-dur="0.5">',
          '<svg x="14" y="1020" width="13" height="13" viewBox="0 0 24 24"><path d="' + GLYPH_MOON + '" fill="' + C_PURPLE + '" fill-opacity="0.8" /></svg>',
          '<text x="34" y="1031" font-size="11" font-family="' + MONO + '" fill="#8b86a8">guardrail active &middot; orders monitored</text>',
        '</g>',

        // Stage 3 (Guardrail Revert Mobile)
        '<g data-anim="pop" data-delay="2.0" data-dur="0.4" style="transform-box:fill-box;transform-origin:center;">',
          '<circle cx="210" cy="1060" r="7.5" fill="#08090a" stroke="' + C_PURPLE + '" stroke-opacity="0.55" stroke-width="1.25" />',
          '<circle cx="210" cy="1060" r="3.25" fill="' + C_PURPLE + '" />',
        '</g>',
        '<text x="194" y="1064" text-anchor="end" font-size="11" fill="#71717a" font-family="' + MONO + '" data-anim="fade" data-delay="2.05" data-dur="0.3">02:14</text>',
        '<path d="M210 1060 H280 A20 20 0 0 1 300 1080 V1096" stroke="rgba(147,170,255,0.55)" stroke-width="1.25" stroke-dasharray="3 5" fill="none" mask="url(#pfwm-vm5)" />',

        '<g class="pfw-pill-group" data-anim="rise" data-delay="2.2" data-dur="0.4">',
          '<rect x="210" y="1096" width="180" height="32" rx="16" fill="#0c0d10" stroke="rgba(147,170,255,0.4)" />',
          '<text x="300" y="1116" text-anchor="middle" font-size="11.5" fill="#f4f4f5" font-family="' + MONO + '">velocity dip flagged</text>',
        '</g>',

        '<path d="M300 1128 V1150" stroke="rgba(147,170,255,0.55)" stroke-width="1.25" stroke-dasharray="3 5" fill="none" mask="url(#pfwm-vm6)" />',

        // Auto-Revert Box (Mobile)
        '<g class="pfw-card-group pfw-purple" data-anim="rise" data-delay="2.4" data-dur="0.4">',
          '<rect x="180" y="1150" width="230" height="110" rx="10" fill="#0c0d10" stroke="rgba(147,170,255,0.3)" />',
          '<rect x="194" y="1162" width="82" height="22" rx="4" fill="' + C_PURPLE_DEEP + '" />',
          '<text x="235" y="1177" text-anchor="middle" font-size="10" letter-spacing="0.06em" fill="#fafafa" font-family="' + MONO + '">REVERT</text>',
          '<text x="194" y="1202" font-size="14.5" font-weight="600" fill="#f4f4f5">Restoring prices</text>',
          '<text x="194" y="1222" font-size="11.5" fill="#a1a1aa">Below forecast band</text>',
          '<text x="194" y="1242" font-size="11" font-family="' + MONO + '" fill="' + C_PURPLE + '">Restoring $24.00 journal</text>',
        '</g>',

        '<path d="M300 1260 V1285" stroke="' + C_GREEN + '" stroke-width="1.5" stroke-linecap="round" fill="none" pathLength="1" data-anim="draw" data-delay="2.6" data-dur="0.2" />',
        '<g class="pfw-node-group" data-anim="pop" data-delay="2.75" data-dur="0.4" style="transform-box:fill-box;transform-origin:center;">',
          '<circle cx="300" cy="1305" r="16" fill="#08090a" stroke="' + C_GREEN + '" stroke-width="1.5" />',
          '<path d="' + GLYPH_CHECK + '" transform="translate(300 1305) scale(0.9)" stroke="' + C_GREEN + '" stroke-width="1.75" fill="none" stroke-linecap="round" stroke-linejoin="round" />',
        '</g>',
        '<text x="274" y="1310" text-anchor="end" font-size="12" fill="#a1a1aa" data-anim="fade" data-delay="2.8" data-dur="0.3">Verified</text>',

        '<path d="M300 1321 V1341 A22 22 0 0 1 278 1363 H210" stroke="' + C_GREEN + '" stroke-width="1.5" stroke-linecap="round" fill="none" pathLength="1" data-anim="draw" data-delay="2.9" data-dur="0.45" />',
        '<g data-anim="pop" data-delay="3.3" data-dur="0.4" style="transform-box:fill-box;transform-origin:center;">',
          '<circle cx="210" cy="1363" r="7.5" fill="#08090a" stroke="' + C_GREEN + '" stroke-opacity="0.55" stroke-width="1.25" />',
          '<circle cx="210" cy="1363" r="3.25" fill="' + C_GREEN + '" />',
        '</g>',
        '<text x="194" y="1367" text-anchor="end" font-size="11" fill="#71717a" font-family="' + MONO + '" data-anim="fade" data-delay="3.35" data-dur="0.3">02:15</text>',

        // Mobile Receipt Card (Width: 400, x=10)
        '<g class="pfw-card-group pfw-purple" data-anim="rise" data-delay="3.5" data-dur="0.5">',
          '<rect x="10" y="1400" width="400" height="186" rx="10" fill="#0c0d10" stroke="rgba(147,170,255,0.35)" />',
          '<path d="' + GLYPH_CHECK + '" transform="translate(28 1424) scale(0.85)" stroke="' + C_GREEN + '" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />',
          '<text x="46" y="1429" font-size="14.5" font-weight="600" fill="#f4f4f5">Reverted while you slept</text>',
          '<text x="396" y="1428" text-anchor="end" font-size="11" letter-spacing="0.04em" fill="' + C_PURPLE + '" font-family="' + MONO + '">receipt</text>',
          '<line x1="10" x2="410" y1="1444.5" y2="1444.5" stroke="rgba(255,255,255,0.07)" />',

          '<text x="24" y="1468" font-size="12" fill="#71717a" font-family="' + MONO + '">02:14</text>',
          '<text x="70" y="1468" font-size="12" fill="' + C_PURPLE + '" font-family="' + MONO + '">detected</text>',
          '<text x="142" y="1468" font-size="12" fill="#e4e4e7" font-family="' + MONO + '">below forecast band</text>',

          '<text x="24" y="1490" font-size="12" fill="#71717a" font-family="' + MONO + '">02:14</text>',
          '<text x="70" y="1490" font-size="12" fill="' + C_PURPLE + '" font-family="' + MONO + '">journal</text>',
          '<text x="142" y="1490" font-size="12" fill="#e4e4e7" font-family="' + MONO + '">original prices restored</text>',

          '<text x="24" y="1512" font-size="12" fill="#71717a" font-family="' + MONO + '">02:15</text>',
          '<text x="70" y="1512" font-size="12" fill="' + C_PURPLE + '" font-family="' + MONO + '">shopify</text>',
          '<text x="142" y="1512" font-size="12" fill="#e4e4e7" font-family="' + MONO + '">catalog verified safe</text>',

          '<text x="24" y="1534" font-size="12" fill="#71717a" font-family="' + MONO + '">02:16</text>',
          '<text x="70" y="1534" font-size="12" fill="' + C_PURPLE + '" font-family="' + MONO + '">alert</text>',
          '<text x="142" y="1534" font-size="12" fill="#e4e4e7" font-family="' + MONO + '">merchant report sent</text>',

          '<line x1="10" x2="410" y1="1548.5" y2="1548.5" stroke="rgba(255,255,255,0.07)" />',
          '<text x="24" y="1568" font-size="12" fill="#71717a">Zero lost sales compounded. Verified safe.</text>',
        '</g>',
      '</svg>'
    ].join('');
  }

  /* ------------------------------------------------------------------
     Animation Controller
     ------------------------------------------------------------------ */
  function hideEl(el) {
    if (el._currentAnim) {
      try { el._currentAnim.cancel(); } catch (e) {}
      el._currentAnim = null;
    }
    var type = el.getAttribute('data-anim');
    if (type === 'draw') {
      el.style.opacity = '0';
      el.style.strokeDasharray = '1';
      el.style.strokeDashoffset = '1';
    } else if (type === 'pop') {
      el.style.opacity = '0';
      el.style.transform = 'scale(0.4)';
    } else if (type === 'rise') {
      el.style.opacity = '0';
      el.style.transform = 'translateY(10px)';
    } else if (type === 'fade') {
      el.style.opacity = '0';
    }
  }

  function showEl(el) {
    el.style.opacity = '1';
    el.style.transform = 'none';
    if (el.getAttribute('pathLength') === '1') {
      el.style.strokeDashoffset = '0';
      el.style.strokeDasharray = '1';
    }
  }

  function animateEl(el, delay) {
    var aType = el.getAttribute('data-anim');
    var dur = parseFloat(el.getAttribute('data-dur') || '0.5') * 1000;
    var keyframes = null;
    var easing = EASE_FADE;

    if (aType === 'draw') {
      keyframes = [
        { strokeDashoffset: '1', opacity: 0 },
        { strokeDashoffset: '1', opacity: 1, offset: 0.01 },
        { strokeDashoffset: '0', opacity: 1 }
      ];
      easing = EASE_DRAW;
    } else if (aType === 'pop') {
      keyframes = [
        { transform: 'scale(0.4)', opacity: 0 },
        { transform: 'scale(1)', opacity: 1 }
      ];
      easing = EASE_POP;
    } else if (aType === 'rise') {
      keyframes = [
        { transform: 'translateY(10px)', opacity: 0 },
        { transform: 'translateY(0)', opacity: 1 }
      ];
      easing = EASE_RISE;
    } else if (aType === 'fade') {
      keyframes = [{ opacity: 0 }, { opacity: 1 }];
    }
    if (!keyframes) return;
    try {
      el._currentAnim = el.animate(keyframes, {
        delay: delay, duration: dur, easing: easing, fill: 'forwards'
      });
    } catch (e) {
      showEl(el);
    }
  }

  /* Scroll-driven choreography. Each piece of the timeline animates when it
     scrolls into view, so the diagram builds as you move down it. A piece
     that drops back below the viewport (you scrolled up) is reset, so it
     plays again the next time you come down. Pieces that leave off the top
     stay drawn. Pieces entering together keep their authored order.
     Positions come from getBBox(), not getBoundingClientRect(): some pieces
     live inside <mask>, where the client rect is always empty. */
  function runChoreography(root, isReducedMotion) {
    var els = root.querySelectorAll('[data-anim]');
    var win = root.ownerDocument.defaultView || window;
    var i;
    if (isReducedMotion) {
      for (i = 0; i < els.length; i++) showEl(els[i]);
      return function () {};
    }
    for (i = 0; i < els.length; i++) { els[i]._shown = false; hideEl(els[i]); }

    var STAGGER = 120;
    var LINE = 0.88; // a piece plays once its top passes 88% of the viewport height

    function pieceTop(el) {
      var svg = el.ownerSVGElement;
      if (!svg) return el.getBoundingClientRect().top;
      var r = svg.getBoundingClientRect();
      if (!r.height) return null; // this SVG is the hidden breakpoint variant
      var vb = svg.viewBox && svg.viewBox.baseVal;
      var scale = vb && vb.height ? r.height / vb.height : 1;
      var b;
      try { b = el.getBBox(); } catch (e) { return r.top; }
      return r.top + (b.y - (vb ? vb.y : 0)) * scale;
    }

    function check() {
      var vh = win.innerHeight || 1;
      var entering = [];
      for (var k = 0; k < els.length; k++) {
        var el = els[k];
        var top = pieceTop(el);
        if (top === null) continue;
        if (!el._shown && top < vh * LINE) {
          el._shown = true;
          entering.push(el);
        } else if (el._shown && top > vh) {
          el._shown = false;
          hideEl(el);
        }
      }
      entering.sort(function (a, b) {
        return parseFloat(a.getAttribute('data-delay') || '0') - parseFloat(b.getAttribute('data-delay') || '0');
      });
      // A fast scroll can bring many pieces in at once; keep the whole group under ~1.2s.
      var step = entering.length > 1 ? Math.min(STAGGER, 1200 / entering.length) : 0;
      for (var m = 0; m < entering.length; m++) animateEl(entering[m], m * step);
    }

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      win.requestAnimationFrame(function () { ticking = false; check(); });
    }
    win.addEventListener('scroll', onScroll, { passive: true });
    win.addEventListener('resize', onScroll);
    check();

    return function cancelAll() {
      win.removeEventListener('scroll', onScroll);
      win.removeEventListener('resize', onScroll);
      for (var j = 0; j < els.length; j++) {
        if (els[j]._currentAnim) { try { els[j]._currentAnim.cancel(); } catch (e) {} }
      }
    };
  }

  /* ------------------------------------------------------------------
     Init PfWorkflow
     ------------------------------------------------------------------ */
  function initPfWorkflow(root) {
    if (!root) return function () {};
    var doc = root.ownerDocument || document;
    var win = doc.defaultView || window;
    injectCss(doc);

    var isReducedMotion = false;
    try {
      isReducedMotion = win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {}

    root.innerHTML = [
      '<section class="pfw-section" aria-labelledby="pfw-heading">',
        '<div class="pfw-wrap">',
          '<div class="pfw-head">',
            '<div class="pfw-eyebrow"><span class="pfw-eyebrow-dot" aria-hidden="true"></span>Autonomous Guardrails</div>',
            '<h2 id="pfw-heading" class="pfw-title">Every price change staged and reversible</h2>',
            '<p class="pfw-sub">One rollout on production. You pick the catalog slice and test the waters, then our guardrail loop watches live orders and pulls the price if anything slips.</p>',
          '</div>',

          '<div class="pfw-bar">',
            '<ul class="pfw-legend" aria-label="Timeline legend">',
              '<li class="pfw-legend-item">',
                '<span class="pfw-legend-ring" style="border-color:' + C_ZINC_LIGHT + ';"><span class="pfw-legend-dot" style="background:' + C_ZINC_LIGHT + ';"></span></span>',
                '<span>You configure</span>',
              '</li>',
              '<li class="pfw-legend-item">',
                '<span class="pfw-legend-ring" style="border-color:' + C_AMBER + ';"><span class="pfw-legend-dot" style="background:' + C_AMBER + ';"></span></span>',
                '<span>Waits for you</span>',
              '</li>',
              '<li class="pfw-legend-item">',
                '<span class="pfw-legend-ring" style="border-color:' + C_PURPLE + ';"><span class="pfw-legend-dot" style="background:' + C_PURPLE + ';"></span></span>',
                '<span>Priceflag, on its own</span>',
              '</li>',
              '<li class="pfw-legend-item">',
                '<span class="pfw-legend-ring" style="border-color:' + C_GREEN + ';"><span class="pfw-legend-dot" style="background:' + C_GREEN + ';"></span></span>',
                '<span>Staged &amp; verified</span>',
              '</li>',
            '</ul>',
          '</div>',

          '<div class="pfw-stage">',
            buildVerticalDesktopSvg(),
            buildVerticalMobileSvg(),
          '</div>',
        '</div>',
      '</section>'
    ].join('');

    var cancelCurrent = null;
    var sectionEl = root.querySelector('.pfw-section');

    function play() {
      if (cancelCurrent) cancelCurrent();
      cancelCurrent = runChoreography(root, isReducedMotion);
    }

    /* ---- Text fitting: guarantee no text leaves its pill / card / chip,
       whatever monospace font the system resolves to. ---- */
    function num(el, a) { return parseFloat(el.getAttribute(a)) || 0; }
    function fitSvg(svg) {
      var pills = svg.querySelectorAll('.pfw-pill-group');
      for (var p = 0; p < pills.length; p++) {
        var g = pills[p];
        var rect = g.querySelector('rect');
        var txt = g.querySelector('text');
        var icon = g.querySelector('svg');
        if (!rect || !txt) continue;
        if (!rect.hasAttribute('data-w0')) {
          rect.setAttribute('data-w0', rect.getAttribute('width'));
          rect.setAttribute('data-x0', rect.getAttribute('x'));
          txt.setAttribute('data-x0', txt.getAttribute('x'));
          if (icon) icon.setAttribute('data-x0', icon.getAttribute('x'));
        }
        var w0 = num(rect, 'data-w0'), x0 = num(rect, 'data-x0');
        rect.setAttribute('width', w0); rect.setAttribute('x', x0);
        txt.setAttribute('x', num(txt, 'data-x0'));
        if (icon) icon.setAttribute('x', num(icon, 'data-x0'));
        var bb; try { bb = txt.getBBox(); } catch (e) { continue; }
        if (!bb || !bb.width) continue;
        var need = (bb.x + bb.width + 22) - x0; // 22px right padding
        if (need > w0) {
          var grow = need - w0;
          var rightAnchored = x0 + w0 < 480;   // left-hand pill hugs the trunk, grow leftwards
          if (rightAnchored) {
            rect.setAttribute('x', x0 - grow);
            txt.setAttribute('x', num(txt, 'data-x0') - grow);
            if (icon) icon.setAttribute('x', num(icon, 'data-x0') - grow);
          }
          rect.setAttribute('width', need);
        }
      }

      var cards = svg.querySelectorAll('.pfw-card-group');
      for (var c = 0; c < cards.length; c++) {
        var cg = cards[c];
        var rects = cg.querySelectorAll('rect');
        var texts = cg.querySelectorAll('text');
        var card = rects[0];
        for (var t = 0; t < texts.length; t++) {
          var te = texts[t];
          var anchor = te.getAttribute('text-anchor');
          if (anchor === 'middle' || anchor === 'end') continue;
          te.removeAttribute('textLength'); te.removeAttribute('lengthAdjust');
          var b; try { b = te.getBBox(); } catch (e) { continue; }
          if (!b || !b.width) continue;
          var tx = num(te, 'x'), ty = num(te, 'y');
          var box = card;
          for (var r = 0; r < rects.length; r++) {
            var rx = num(rects[r], 'x'), ry = num(rects[r], 'y');
            var rw = num(rects[r], 'width'), rh = num(rects[r], 'height');
            if (r > 0 && tx >= rx && tx <= rx + rw && ty >= ry && ty <= ry + rh && rw < num(card, 'width')) { box = rects[r]; break; }
          }
          var pad = box === card ? 18 : 10;
          var limit = num(box, 'x') + num(box, 'width') - pad;
          if (b.x + b.width > limit) {
            te.setAttribute('textLength', Math.max(20, limit - b.x));
            te.setAttribute('lengthAdjust', 'spacingAndGlyphs');
          }
        }
      }
    }
    function fitAll() {
      var svgs = root.querySelectorAll('.pfw-svg');
      for (var i = 0; i < svgs.length; i++) fitSvg(svgs[i]);
    }
    fitAll();
    win.addEventListener('resize', fitAll);
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(fitAll);
    var fitTimer = win.setTimeout(fitAll, 400);

    /* ---- Scroll-driven page background ----
       One CSS variable (--pf-bg) paints every full-width section, so the whole page
       fades navy -> black as the workflow approaches, and back to navy as it leaves.
       No seams: top, middle and bottom all use the same continuously-changing color. */
    var rootEl = doc.documentElement;
    function smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }

    function onScrollUpdate() {
      if (!sectionEl) return;
      var rect = sectionEl.getBoundingClientRect();
      var vh = win.innerHeight || 1;

      // Fade in: begins once the section's top reaches the bottom of the viewport (1.0vh)
      // and finishes 1.3 screens of scrolling later (top at -0.3vh).
      var inT = smooth((vh * 1.0 - rect.top) / (vh * 1.3));
      // Fade out: begins while the section's bottom is still 1.6vh down the page and takes the
      // same 1.3 screens of scrolling (bottom at 0.3vh) to return to navy.
      var outT = smooth((rect.bottom - vh * 0.3) / (vh * 1.3));
      var factor = Math.min(inT, outT);

      var r = Math.round(3 * (1 - factor));
      var g = Math.round(8 * (1 - factor));
      var b = Math.round(24 * (1 - factor));
      rootEl.style.setProperty('--pf-bg', 'rgb(' + r + ',' + g + ',' + b + ')');
    }

    win.addEventListener('scroll', onScrollUpdate, { passive: true });
    win.addEventListener('resize', onScrollUpdate);
    onScrollUpdate();

    // Each timeline piece is observed on its own; see runChoreography.
    play();

    return function cleanup() {
      if (cancelCurrent) cancelCurrent();
      win.removeEventListener('scroll', onScrollUpdate);
      win.removeEventListener('resize', onScrollUpdate);
      win.removeEventListener('resize', fitAll);
      win.clearTimeout(fitTimer);
      rootEl.style.removeProperty('--pf-bg');
      root.innerHTML = '';
    };
  }

  window.initPfWorkflow = initPfWorkflow;
})();
