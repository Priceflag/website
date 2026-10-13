# Common brief for every builder subagent (Priceflag overhaul)

Repo: `/Users/NithinAwasome/Downloads/CODE/website`, branch `overhaul`. A static site on Vercel. No framework, no build step, no npm runtime deps. Read these first:
- `docs/OVERHAUL_PROMPT.md` (rules, honesty guardrails, Definition of Done), `docs/OVERHAUL_PLAN.md` ("The new page, section by section" has the draft copy).
- `DESIGN_TOKENS.md` (the brand contract) and `tokens.css` (the CSS variables you MUST use; never hard-code a color, size, radius or duration that has a token).
- `index.html` + `site.css` (the current homepage: nav, hero, statement, how it works, FAQ, review form `#review`, footer) and `sections/pf-review.js` (the form script; do not edit it).
- Load and follow the skills `anthropic-skills:apple-design` and `anthropic-skills:design-taste-frontend` (use the Skill tool) before designing. Also `copywriting` for any copy.

## Ownership
- You may create/edit ONLY the files your brief lists. Never edit `index.html`, `site.css`, `tokens.css`, `sections/pf-review.js`, `OVERHAUL_LOG.md` or another builder's files. The orchestrator integrates your markup into `index.html`.
- Deliver each section as: `sections/pf-<name>.html` (the markup fragment exactly as it should be pasted into index.html, starting with an HTML comment naming the section), `sections/pf-<name>.css` (all its styles, selectors prefixed `.pf-<name>`), and `sections/pf-<name>.js` only if behaviour is needed (vanilla, no deps, `defer`-safe, IIFE, no globals except where your brief says).
- Preview your work with a sandbox page `qa/sandbox/<name>.html` (not deployed: `qa/` is in .vercelignore) that links `../../tokens.css`, `../../site.css` and your CSS/JS, and includes your fragment inside the same `<body>` scaffolding as index.html. Serve with `node qa/serve.mjs <port>` (pick a free port 8940–8999, run in background, kill when done) and check it with Playwright (`node_modules/playwright`; Chromium + WebKit work, Firefox does not launch on this machine).

## Hard rules
- **Content works without JS.** All copy and links are in the HTML. JS only enhances.
- **Type:** at most three type sizes per section, from the tokens (`--pf-text-display/h2/h3/lead/body/small/figure`). Hedvig Letters Serif (`--pf-serif`, weight 400) for headings, Inter (`--pf-sans`) for everything else. No new fonts.
- **Color:** navy ground, cream text, lime as the ONE accent. No purple, no glows (the primary CTA halo is the only one), no gradient text, no pill clutter, no decorative dots, no eyebrows above every heading (max 1 per 3 sections across the page), no em-dashes (—) or en-dash separators in visible copy, no emoji.
- **Radius rule:** pills for buttons/chips, 24px (`--pf-radius-card`) for cards/panels/product mock, 12px for fields.
- **Primary CTA label everywhere: "Get my free price review"** (class `pf-btn`, href `#review` unless your brief says otherwise). One primary CTA per section at most; secondary actions are text links, never a second equal-weight button.
- **Motion** only where it explains something (e.g. rollout stages advancing). Respect `prefers-reduced-motion` (no motion at all). No scroll-jacking, no auto-advancing carousels, no `window.addEventListener('scroll')`.
- **Accessibility:** semantic headings (the page has ONE h1, in the hero), real alt text, labels on every control, visible focus (inherit the global `:focus-visible` ring from site.css: cream on navy, ink on lime), 44px touch targets, WCAG AA contrast (compute it; tokens list ratios), works at 320, 375, 768, 1440 and 1920 px with no horizontal scroll, at 200% zoom, with long words (use `overflow-wrap:anywhere` where text could overflow) and 2× longer translated text, in `prefers-color-scheme: dark` (page is dark already; must not break).
- **Performance:** no images heavier than needed; WebP; `loading="lazy"` below the fold; width/height on every img; no layout shift.
- **Honesty guardrails (non-negotiable):** rollouts go by SKU cohort and time, 25% of selected SKUs, then 50%, then all; never by visitor or traffic; every shopper always sees the same price. In the beta a tripped guardrail **pauses the rollout and alerts**; it never rolls back automatically (no "reverts", "on its own", "automatically restores"). Forecasts are ranges with a breakeven; no "AI pricing" or black-box language. Simulation numbers appear only labeled "in simulation" and linked to `/how-we-measure`: 93% of forecast ranges contained the outcome; 4.7-point median miss; 82% of demand shocks caught, median day 6; 7% false pauses; 100% of prices restored after rollback. No logos, testimonials, pilot results, YC badge, founder photos or pricing: build the slot, hide it with `data-pending="true"` (site.css will carry `[data-pending="true"]{display:none!important}`), and put `<!-- PENDING: what's needed -->` right above it. Never invent numbers, customers, quotes or features. Example numbers in a product mock must be labeled as an example and must be arithmetically consistent.
- **Pivot-dependent copy** (hero headline/subhead, problem section, how-it-works steps, calculator labels, CTA text): wrap it in `<!-- PIVOT: what it depends on -->` markers.

## Breakeven math (shared by the hero mock, the calculator and the Black Friday page)
All money in integer cents. With current price P, new price N and unit cost C (cents), margin before m0 = P − C, after m1 = N − C.
- Same-profit order change: orders after / orders before = m0 / m1. If N > P (and m1 > 0): you can lose up to `1 − m0/m1` of orders and keep the same profit. If N < P (and m1 > 0): you need `m0/m1 − 1` more orders.
- Show percentages conservatively: a "can lose up to" figure is rounded DOWN to one decimal place shown as a whole number when it is whole (e.g. 17.2% → "17.2%"); a "need X% more" figure is rounded UP. Never overstate safety.
- Example used across the site: $24.00 → $27.00, unit cost $9.60: m0 = 1440, m1 = 1740, loss = 1 − 1440/1740 = 17.24…% → "lose up to 17.2% of orders". (The plan's "11%" only holds at zero unit cost, i.e. same revenue, so it is not used.)

## Definition of Done for your piece
Return a checklist (one line per requirement in your brief → PASS/FAIL with evidence: sandbox screenshot paths under `qa/sandbox/screens/`, command output, file:line) plus: the exact list of files you created, any copy you wrote that is pivot-dependent, any `data-pending` slot and the asset it needs, and anything you could not do. Your checklist is a claim; an independent verifier will check it.
