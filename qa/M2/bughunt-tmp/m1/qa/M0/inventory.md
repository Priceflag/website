# M0 Inventory: Priceflag marketing site

Branch `overhaul`, HEAD `0f93942`. Generated 2026-10-13. Read-only audit: no existing file was edited.
All `file:line` references are against HEAD. (Other agents had uncommitted edits to `.gitignore` and `.vercelignore` while this ran. See section 7.)

---

## 1. Pages

| File | Size | `<title>` | H1 | Meta description | dc runtime |
|---|---|---|---|---|---|
| `index.html` | 68,072 B / 1,290 lines | `Priceflag` (l.6) | "Change your store's prices without losing sales." (l.783). Only exists after JS renders it | l.7: "Priceflag forecasts a price change, rolls it out gradually across your products, and **reverts it automatically** if it stops paying. Every shopper always sees the same price. Built for Shopify." | **YES** |
| `about.html` | 16,721 B / 390 lines | `About — Priceflag` | "About" (l.324) | l.7: "…a guardrail that **reverts a change on its own**. One price for every shopper." | no |
| `contact.html` | 14,205 B / 355 lines | `Contact — Priceflag` | "Contact" (l.291) | l.7: "Reach Priceflag Syndicate with questions, feedback or issues — the on duty engineers and how to write to each of them." | no |
| `legal.html` | 45,714 B / 546 lines | `Legal — Priceflag` | "Legal" (l.269) | l.7: "The Privacy Policy and Terms of Service governing use of Priceflag, in full. Both drafted and pending legal review." | no |
| `signin.html` | 27,545 B / 588 lines | `Sign in – Priceflag` (en dash; the others use an em dash) | "Sign in to Priceflag" (l.382) | l.7: "Sign in to Priceflag. We email you a link — no password to remember." | no |
| `experiments/*.html` (11 files) | various | prototypes | – | – | `intro.html` and `scroll-fx.html` are dc prototypes. Excluded from deploy by `.vercelignore` |

### What each page loads

**index.html**
- Scripts (all `defer`, l.106-112): `./support.js` (69,478 B, the dc runtime), then `sections/pf-compare.js`, `pf-demo.js`, `pf-workflow.js`, `pf-faq.js`, `pf-hero-logos.js`, `pf-waitlist.js`.
- At runtime `support.js` injects `https://unpkg.com/react@18.3.1/umd/react.production.min.js` and `react-dom@18.3.1` (with SRI, `support.js:1143-1148`). Babel standalone 7.29.0 is only loaded on demand for JSX imports. It was not requested in the live run.
- `support.js:159` also does a second `fetch(location.href)` of index.html itself, to re-parse the template. Two GETs of `/` were seen in the run.
- Fonts: Google Fonts Hedvig Letters Serif (opsz 12..24) and Inter 300..700. This is loaded **twice**, at l.31 (head) and again at l.119 (inside `<helmet>`), with duplicate preconnects at l.28-29 and l.117-118.
- Images: `hero-new.png` (preload at l.27, `<img>` at l.775), `uploads/summit-lime.webp` (l.813), and `mark.svg` as a CSS mask (l.205-208). Icons are at l.23-26. The og image is the absolute URL `https://priceflag.org/og-v7.jpg` (l.14, l.21).
- JSON-LD (l.36-105): Organization, WebSite, SoftwareApplication and FAQPage (the 6 Q&As, duplicated from `pf-faq.js`).
- Inline `<style id="dc-hide-raw">x-dc{display:none!important}</style>` (l.35). **With JS disabled, or if unpkg fails, the body renders blank** apart from what `support.js` fail-open does. Crawlers without JS see no H1 or copy.

**about.html / contact.html / legal.html** (one shared "sheet" template)
- Inline scripts only: the `pf-boot` class at l.10, plus a reveal script (about l.354, contact l.319, legal l.510).
- Same Google Fonts link at l.15-17.
- `uploads/summit-painting-3.webp` (preload at l.9, plus an `<img>`), `mark.svg` as a mask, and icons at l.11-14.

**signin.html**
- One inline script (l.422). It talks to `APP_ORIGIN = 'https://dashboard.priceflag.org'` (l.433).
- The same Google Fonts link (l.20-22) and an inline base64 grain SVG (l.122).
- Images: `https://priceflag.org/uploads/signin-hero.webp` (l.361, an absolute URL). **This file is not in the repo.** Icons point to absolute `https://priceflag.org/...` URLs (l.17-19), and `mark.svg` is used as a mask (l.144-148).
- **In production this page is unreachable.** `vercel.json` 301s `/signin.html` and `signin.priceflag.org/` to `https://dashboard.priceflag.org/signin`.

---

## 2. index.html anatomy

### Line map

| Lines | Block |
|---|---|
| 1-35 | doctype, meta, canonical, OG/Twitter, icons, preload hero, preconnects, fonts, `dc-hide-raw` |
| 36-105 | JSON-LD `@graph` (Organization, WebSite, SoftwareApplication, FAQPage with 6 Q&As) |
| 106-112 | deferred scripts |
| 115 / 860 | `<x-dc>` … `</x-dc>` template wrapper |
| 116-751 | `<helmet>`: second fonts link (117-119), `__bundler_thumbnail` template (120), `<style>` (121-750) |
| 752-859 | template markup (scroller wrapper `div.pf-intro[data-scroller]`) |
| 861-1287 | `<script type="text/x-dc" data-dc-script>` with `class Component extends DCLogic` |

### `<helmet>` CSS rule groups

| Lines | Group |
|---|---|
| 122-130 | globals: html/body bg `#030818`, links (`a` cream, hover lime), `::selection`, `[data-scroller]` scrollbar hide, `[data-grain]` base64 noise |
| 132-189 | page-load intro: `.pf-intro`, `.pf-intro-go`, `.pf-intro-done`, keyframes `pfMediaFade`, `pfMediaZoom`, `pfGrainIn`, `pfRiseLg`, `pfRise` |
| 191-195 | `.pf-hero-logos` |
| 197-210 | `.pf-hiker` brand mark (mask `mark.svg`, `@supports` gate) |
| 212-284 | `.pf-btn` glass pill (::before ring, ::after sheen, hover/active/focus), `.pf-btn-dot`, `--light`, `--sm`, reduced-motion |
| 286-306 | scroll choreography `[data-hero-copy]`, `[data-enter]` will-change, plus reduced-motion overrides for hero and intro |
| 307-487 | footer slab: `.pf-foot`, `-art`, `-inner`, link colours, `-top`, `-lead`, `-mark`, `-head`, `-shop`, `-cta`; `.pf-btn--dark` (368-406); `-nav`, `-col`, `-link` underline sweep; pointer:coarse tap targets (428-434); `.pf-foot-word` giant SVG wordmark (438-450); `-bar`, `-legal`; 900px/359px breakpoints; reduced motion |
| 489-512 | "responsive shell" header comment, text-size-adjust, `:root{--pf-nav-h:43px;--pf-gutter}`, 56px on touch/≤900 (513) |
| 515-580 | nav: `.pf-nav` gutters, cluster gaps, `[data-pf-i]` hit boxes, ≤900 centre-link size, **≤739 hide centre link (547)**, touch 44px targets (552-562), **≤379 hide Legal (571)**, ≤359 tighten |
| 582-619 | hero sizing: `[data-screen-label=Hero]` svh, fixed `[data-hero-card]` lvh, `[data-hero-copy]` svh |
| 620-724 | hero layout: full-bleed card, `.pf-hero-wash`, `.pf-hero-top`, `.pf-eyebrow` and `.pf-tag` and `-link` and `-arrow`, `.pf-title` (`-accent`, `-lead`), `.pf-sub`, `.pf-cta`, `.pf-btn--ghost` (676-690), `.pf-hero-foot`, `.pf-works` and `-label`, ≤767 mobile, ≤767&≤700h hide sub, ≤620h hide hero foot |
| 725-739 | statement padding and mobile font |
| 741-749 | footer CTA align and mobile wordmark margin |

Inline `style=""` is used heavily in the markup (l.752-800). Several comments note that the dc runtime truncates inline style values at the first comma. That explains why many rules live in `<helmet>`, often with `!important` to beat the inline styles. A static conversion can drop that workaround.

### Template markup

| Lines | Section |
|---|---|
| 752 | `div.pf-intro[data-scroller]` (ref `scrollerRef`), font Inter |
| 754-766 | **nav** `nav.pf-nav` (sticky grid 1fr auto 1fr): logo hiker (756), About (757), FAQ (758), centre link "Learn more about the team ↗" (760), Legal (762), Contact (763), Sign In pill (764) |
| 771-797 | **hero** `section[data-screen-label=Hero]`. Fixed card `[data-hero-card]` (772), media wrapper with `hero-new.png` (774-776), wash (777), grain (778), dim scrim `[data-hero-dim]` (779), copy `[data-hero-copy]` (780): eyebrow link with tag "AI Pricing" (782), H1 (783), sub (784), CTAs (785-790, with a TODO comment at 786-787 about the booking link), hero foot "Works with [logos] Shopify & more" (792-794, host `data-pf-section="hero-logos"`) |
| 798-802 | **statement** `section[data-screen-label=Statement]`: "See the predicted impact on profit before anything goes live. Roll the change out gradually. We watch your real orders and put it back if it stops paying." |
| 804-810 | **section hosts** `section[data-screen-label=Sections]`: `div[data-pf-section=compare]` (805), `=sim` (806), `=workflow` (807), `=faq` (808), `=waitlist` (809) |
| 812-857 | **footer** `section.pf-foot[role=contentinfo]` (a `<section>` with role contentinfo, not a `<footer>`): art `summit-lime.webp` (813), mark link (818), H2 "A tool for [Shopify bag] Shopify & more" (820), dark CTA (823-826, TODO at 822), footer nav two columns (829-841), giant SVG wordmark "Priceflag" (844-846), bar "Built by Humans in San Francisco&#44; CA" plus Contact and Legal (848-854) |

### `data-dc-script` component logic (861-1287)

- **Refs** (863-871): scroller, heroImg, heroContent, heroDim, statementText, footerInner, compare, sim, workflow, faq, heroLogos, heroCard, waitlist. Exposed via `renderVals()` (1274-1285). It also exposes the unused `goJoin` and `onScroll` values.
- **Scroll FX** (`FX` 874-879, `applyScrollFx` 917-980, rAF-throttled `onScroll` 982-985):
  - Hero copy fades linearly to opacity 0 and blurs up to 12px over 0.5 viewport. `pointerEvents:none` once fully faded.
  - The dim scrim on the fixed card goes from 0 to 1 opacity (smoothstep over `max(0.42vh, heroH+stmtH-vh)`). At ≥0.999 the card gets `opacity:0; visibility:hidden`.
  - Forces the statement section background transparent `!important` (928-931). This counters pf-workflow's `--pf-bg` rule.
  - Statement text `_reveal`: opacity, translateY up to 34px and blur up to 7px over 0.55vh.
  - Footer inner reveal is normalised against the scroll travel left (972-979).
- **Reduced motion** (`_reduce` from `matchMedia`, 1178-1184, live listener): hero copy still fades (opacity only, no blur). Statement and footer are shown statically. In-page nav jumps instantly. CSS separately kills the intro animation, button transitions and `[data-enter]` transforms (280-306).
- **Intro** (`startIntro` 1195-1213): waits for the hero image load or error (fallback 1200ms), then double-rAF, adds `pf-intro-go`, and after 2400ms adds `pf-intro-done`.
- **Nav height sync** (`syncNav` 1146-1154): writes the measured `--pf-nav-h` on resize, orientationchange (re-measured at 120ms and 420ms), visualViewport resize, and `document.fonts.ready`.
- **In-page nav** (`data-pf-go`, 987-1136): one delegated document click listener (`onNavClick` 1127). It ignores modified clicks, calls `preventDefault`, and runs a fixed 900ms easeInOutCubic window tween (`goTo` 1104). The tween is cancelled by wheel, touchstart or keydown (1136), and a `setTimeout` guard lands it if rAF is starved. It re-measures on landing (`_land`). The offset is nav height plus `clamp(13vh, 44, 150)` px. Key-to-target map (`_resolveTarget` 1060-1076):

  | key | target |
  |---|---|
  | `top` | y=0 |
  | `bottom` | scrollHeight (no link uses it) |
  | `waitlist` | waitlist host |
  | `about` | statement text (no link uses it) |
  | `demo` | `_simTarget()`: the sim host (pf-demo) at 3.5% progress through its sticky span |
  | `workflow` / `how-it-works` | workflow host (no link uses either) |
  | `partners` | `.pff-mq-label` → `.pff-mq` → faq host. **The marquee was removed from pf-faq.js (see its l.19-22), so this always falls back to the FAQ host.** |
  | `faq` | `.pff-faq-sec` → `.pff-list` → faq host |

- **Section mounting** (`mountSections` 1214-1238, `tryMountSections` 1239-1248): this retries every 60ms and on `load`, and gives up after 15s. Each init runs in its own try/catch, and cleanups are collected. The calls are:

  | global | host ref | host element |
  |---|---|---|
  | `initPfCompare` | `compareRef` | `[data-pf-section=compare]` |
  | `initPfDemo` | `simRef` | `[data-pf-section=sim]` (**pf-demo renders into the host named "sim"**) |
  | `initPfWorkflow` | `workflowRef` | `[data-pf-section=workflow]` |
  | `initPfFaq` | `faqRef` | `[data-pf-section=faq]` |
  | `initPfWaitlist` | `waitlistRef` | `[data-pf-section=waitlist]` |
  | `initPfHeroLogos` | `heroLogosRef` | `[data-pf-section=hero-logos]` |

  All six scripts that index.html loads are initialised and render. No script on index loads without rendering. `pf-globe`, `pf-sim`, `pf-sim-b`, `pf-waitlist-b` and `pf-week` are not loaded at all.
- `componentWillUnmount` (1254-1273) tears everything down. It calls `cancelAnimationFrame(this.raf)`, but `this.raf` is never set.

### Live render check (Playwright, Chromium, 1440×900, `python3 -m http.server 8901`)

Note: headless Chromium in this sandbox stalled on the unpkg `react-dom` download, which curl fetched fine. The run therefore proxied external requests through Node `fetch` using `page.route`. Request URLs are as the page issued them. The server was killed afterwards.

- **Console errors / warnings: none. Page errors: none. Failed requests: none.**
- `document.scrollHeight` = 7,750px. Order of what renders (top y / height):
  - nav 0-43
  - Hero 43 / 857
  - hero-logos host at 820 (40px tall): an animated cluster of 3 of 6 colored badges. Its `role=img` aria-label is "Integrates with Shopify, WooCommerce, BigCommerce, Magento, Squarespace, Stripe"
  - Statement 900 / 348
  - **compare** 1248 / 610: H2 "Earn more with Priceflag." plus a canvas chart
  - **sim (pf-demo)** 1858 / 2025: H2 "Forecast it. Roll it out. Undo it.", sticky 3-step app mock
  - **workflow** 3883 / 2104: H2 "Every price change staged and reversible", SVG timeline
  - **faq** 5987 / 672: H2 "Questions worth asking", 6 items. The section is still labelled `data-screen-label="Platforms & FAQ"`
  - **waitlist** 6658 / 335: H2 "Join the waitlist.", a single email field plus "Send it to me". There is also an empty H2, the success heading, sitting in the DOM
  - footer 6993 / 757
- Headings: one H1. The H2s are the five section titles plus "A tool for Shopify & more".
- With reduced motion, pf-demo renders three stacked static stages and **drops its H2 and eyebrow** (`pf-demo.js:360-365`). Everything else matched.
- `data-pf-go` click results: `top` → 0, `faq` → 5907 (FAQ), `demo` → 1897 (pf-demo), `waitlist` → 6498, `partners` → 5827 (FAQ marquee fallback, since no partners content exists).
- Injected style tags: `pfc-style`, `pfd-style`, `pfw-style`, `pff-styles`, `pfl-style`, `pfhl-styles`, plus the runtime's own.
- **External hosts contacted on load:** `fonts.googleapis.com`, `fonts.gstatic.com` (5× Inter TTF and 1× Hedvig TTF), `unpkg.com` (react and react-dom).
- On submit only, not exercised: `script.google.com` (pf-waitlist Apps Script endpoint), or a `mailto:` fallback.
- Local caveat: `/about`, `/legal` and `/contact` 404 under `python -m http.server`. They only resolve through Vercel rewrites.

---

## 3. Section scripts

| File | Bytes / lines | Global | Loaded by index | Renders on index | Recommendation |
|---|---|---|---|---|---|
| `pf-compare.js` | 39,829 / 1,028 | `window.initPfCompare` (l.323) | yes (l.107) | **yes** (compare host) | **cut** |
| `pf-demo.js` | 31,806 / 471 | `window.initPfDemo` (l.470) | yes (l.108) | **yes** (sim host) | **ship** (as static HTML) |
| `pf-faq.js` | 24,702 / 542 | `window.initPfFaq` (l.51) | yes (l.110) | **yes** | **ship** (as static HTML) |
| `pf-globe.js` | 51,043 / 1,203 | `window.initPfGlobe` (l.295) | no (`experiments/globe.html` only) | no: UNUSED | **cut** |
| `pf-hero-logos.js` | 14,763 / 311 | `window.initPfHeroLogos` (l.45) | yes (l.111) | **yes** | **cut** |
| `pf-sim.js` | 85,187 / 2,033 | `window.initPfSim` (l.2032) | no (`experiments/sim.html`) | no: UNUSED | **cut** |
| `pf-sim-b.js` | 73,106 / 1,765 | `window.initPfSimB` (l.1764) | no (`experiments/sim-b.html`) | no: UNUSED | **cut** |
| `pf-waitlist.js` | 60,136 / 1,443 | `window.initPfWaitlist` (l.60) | yes (l.112) | **yes** | **mine-for-parts** |
| `pf-waitlist-b.js` | 51,236 / 1,229 | `window.initPfWaitlistB` (l.55) | no (`experiments/waitlist-b.html`) | no: UNUSED | **cut** |
| `pf-week.js` | 18,423 / 305 | `window.initPfWeek` (l.304) | no (not even in experiments) | no: UNUSED | **mine-for-parts** |
| `pf-workflow.js` | 60,140 / 893 | `window.initPfWorkflow` (l.892) | yes (l.109) | **yes** | **cut** (mine copy only after rewriting) |

All modules claim "zero dependencies". None loads a CDN. Only pf-waitlist and pf-waitlist-b have endpoints.

### pf-demo.js: ship
Renders "How it works". On the left is a numbered list of 3 steps: Forecast, Rollout, Undo. On the right is a 3D-tilted dark-glass "app window" mock (`dashboard.priceflag.org` in the URL bar, "Demo store · Shopify · connected") with three screens swapped by scroll progress. The host is `3 × 75vh` tall with a sticky 100vh stage, plus pointer parallax and glass "float" chips. Reduced motion stacks the three stages.
- Copy: H2 "Forecast it. Roll it out. Undo it." (l.370). The steps (l.42-52) are "See what it will do before it goes live.", "Try it on a few products first, then we watch." ("…Two bad days in a row pauses the rollout and emails you."), and "Put every price back with one click." ("…Undo restores all of them and reads Shopify back to prove it.").
- Numbers: these are demo-store figures, labelled as a demo in a comment (l.19-21) and in the UI ("Demo store"). They include 6% higher and 6 of 14 products (l.234), units −9% with a range of −16% to −3% (l.237), profit per day $1,160 from $1,090 with a range of $1,010-$1,230 (l.238), "Based on 180 days of your own orders", break-even 14% (l.242), and scenario rows of −$80, +$70 and +$140 (l.244-246). There are also daily units (l.62-71), product prices such as Everyday Tee $32.00→$33.92 (l.73-80), floats "Break-even −14% units" and "Shopify read back 6 of 6" (l.55-59), and "✓ Every price was checked. Shopify is back at all 6 original prices." (l.300).
- Honesty: consistent with the FAQ. It says pause and email, then a manual Undo. No auto-revert claim and no "AI". The numbers are illustrative but framed as a demo store. Consider an explicit "Example data" caption.
- External: CSS `mask:url(mark.svg)` (l.149). Otherwise none.
- Why ship: it is the most accurate product depiction on the site. For the static conversion, port the DOM to HTML and keep a small JS for step switching, or use static stacked panels.

### pf-faq.js: ship
A 6-item multi-open disclosure list (goldsand mechanics, plus-to-× icon, staggered reveal) with the heading chrome "FAQ" / "Questions worth asking" / "The six things merchants ask us before they install. Short answers, no hedging." (l.317-321). The Q&A text (l.77-102) is identical to the JSON-LD at index l.70-101.
- Copy flags: the lede "things merchants ask us before they install" implies existing merchants. legal.html says no merchant has been accepted yet. The answers are careful: "restore the original prices automatically" is an opt-in choice ("acts the way you chose") (l.91), "We do not roll anything back on the way out" (l.99), and "Autonomy is something you grant deliberately" (l.95).
- The marquee "Built For" strip was removed (header l.19-22). The host's `data-screen-label="Platforms & FAQ"` (l.310) and index's `partners` key are leftovers.
- External: none. Why ship: honest, core content. Convert to `<details>/<summary>` in static HTML and keep the JSON-LD in sync.

### pf-workflow.js: cut
A vertical choreographed SVG timeline, with desktop and mobile SVGs (l.106, l.378). Eyebrow "Autonomous Guardrails" (l.717), H2 "Every price change staged and reversible" (l.718), and sub "…then our guardrail loop watches live orders and **pulls the price** if anything slips." (l.719). The legend includes "**Priceflag, on its own**" (l.734).
- Copy flags (SVG `<text>`):
  - "+$1,420 / mo estimated" (l.186, l.449) and "Break-even: -3.8% units" (l.190, l.451). These **contradict** pf-demo's −14%.
  - "Model: 95% confidence" (l.192)
  - "**AUTO-REVERT** / Restoring original prices" (l.315-316)
  - "2 consecutive days tracking below statistical forecast band" (l.317)
  - "**Reverted while you slept**" (l.348, l.569)
  - "original $24.00 prices restored" (l.359)
  - "**Zero lost sales compounded. Catalog verified safe.**" (l.370, l.590)
  - "immutable audit" (l.349)
  - The aria-label "…automatic recovery" (l.106) and the header comment "automatically reverts when guardrails are breached" (l.3-4).
- Side effect: it injects `:root{--pf-bg}` and repaints Hero, Statement, Sections, `.pf-nav`, `.pfc`, `.pfd`, `.pff`, `.pfl-root` and `.pfq` backgrounds via a scroll listener, fading navy to black (l.47-48, l.834-862). index.html has to fight this (l.925-931).
- Why cut: it is the largest concentration of auto-revert, invented-number and "unattended" claims, and it duplicates pf-demo's story. If anything is kept, it is the "Waits for you" / "You approved" approval gate concept, re-written.

### pf-compare.js: cut
"Earn more with Priceflag." (l.397) and "Ninety days. One store. Four ways to price it. An illustration of the shape, not a measurement." (l.398). An animated canvas line chart has four series: "No change", "Blind A/B", "Spreadsheet" and "Priceflag" (l.334-346). Priceflag always ends highest. The curves are driven by invented constants: `LIFT_PF = 0.11` (+11%), `LIFT_SHEET = 0.026`, and an A/B "drawdown" and "permanent scar" (l.84-92). The visible "+11%" was removed, but the shape still asserts a result.
- The aria summary (l.377-381) says "Priceflag ends highest… Blind A/B tooling dips well below it mid-period". That is a comparative performance claim with no data behind it.
- External: none. Why cut: it is an outcome claim ("Earn more") resting on made-up curves, the caveat in the subhead undercuts the headline, and it is 40 KB of canvas code.

### pf-waitlist.js: mine-for-parts
Renders only the H2 "Join the waitlist." (l.784), the label "Get early access to Priceflag." (l.902), an email input and a "Send it to me" button (l.919). A full what-if price calculator (price, cost, elasticity band, 90-day range chart) is still built but **never attached** (comment l.787-789), so about 50 KB is dead weight.
- Submit (`T.SUBMIT`, l.131-192): POSTs JSON as `text/plain` to the **Google Apps Script** endpoint `https://script.google.com/macros/s/AKfycbwihER5l9u8XY81Q55RYJh626QOXCIFI0LJDeQGBt84BFtSIdI4AAfox--A1MptpMZtnw/exec` (l.129). The payload includes email, the calculator's price/cost/testPrice/uplift/low/high (always defaults, since the calculator is hidden), page URL and userAgent. The server half is `integrations/waitlist-sheet.gs`. If the endpoint were blank it would fall back to a `mailto:hello@priceflag.org` draft. The Formspree `XXXXXXXX` appears only in a comment (l.107).
- Success copy: "You're on the list." / "We'll write to {email} when it opens up." (l.1268-1271).
- Copy issue: the hero and footer CTAs say "Get a free price review", but they land on "Join the waitlist." with "Send it to me". These are three different promises.
- Keep: the Apps Script submit seam, validation, and honest success/failure states. Rebuild as a static `<form>` plus a small JS.

### pf-hero-logos.js: cut
A cluster of 3-of-6 overlapping round badges cycling by CSS animation. The marks are Shopify (real bag path), WooCommerce, BigCommerce, Magento, Squarespace and Stripe, drawn as "simplified geometric interpretations" in brand tints (l.65-147). The `role=img` aria-label reads "Integrates with Shopify, WooCommerce, BigCommerce, Magento, Squarespace, Stripe" (l.281-283).
- Honesty: this is an **integration claim the product does not make**. legal.html:454 says "Priceflag runs on Shopify and cannot work without it", and the meta says "Built for Shopify." It also uses other companies' logos or lookalikes. The header comment still refers to a removed "Intelligence for ecommerce" eyebrow (l.13).
- Why cut: replace it with a single Shopify mark, or with text alone.

### pf-globe.js: cut (UNUSED)
A wireframe canvas globe plus a counter: "Measured worldwide" / "**Revenue increased by Priceflag**" / "$1,342 … and counting", ticking +$1 every 11-19s (l.66-86). This is an invented traction number. External: none.

### pf-sim.js: cut (UNUSED)
A 5-act scroll-driven Galton board (l.1-30): "A price change is a bet.", "**We place it 20,000 times first.**", "We never hand you a single number.", "Real orders land inside the forecast.", "**It reverses itself at 3 a.m., unattended.**" (l.123-131). Rollout 5→20→50→100%. External: none. Note that index's comments, `_simTarget` and `SIM_P` were written for this module and now serve pf-demo.

### pf-sim-b.js: cut (UNUSED)
A "wind tunnel" metaphor in 5 acts (l.500-520): "Thousands of runs before one real buyer.", "Then live, five percent of products at a time.", "**It reverses itself at 3 a.m., unattended.**" / "…reverses itself, unattended." The header says "**That fan IS the AI**" (l.20; also l.655, l.1026). It reuses the `.pfw-` prefix, which collides with pf-workflow. External: none.

### pf-waitlist-b.js: cut (UNUSED)
An alternate "ticket" waitlist: kicker "Try it", H2 "Your price, 90 days out." (l.639-640), a calculator plus a `mailto:` only (l.588-602). No backend.

### pf-week.js: mine-for-parts (UNUSED, not referenced anywhere)
"A week with Priceflag": a scroll-scrubbed 7-day chart with captions (l.61-67). The captions are "You raise prices 6% on 6 products. We start with just 2 of them…", "Someone changed a price by hand in Shopify. **We pause and email you. Nothing moves until you decide.**", "Sales held up, so overnight we put the new price on 3 products.", and "…every shopper saw the same price all week." These are honest and consistent with the FAQ. There are no revert claims, but "overnight we put the new price on" implies autonomous step-ups. That conflicts with the FAQ's "By default it proposes and you approve." The narrative is good material for a static "How it works" sequence.

---

## 4. Links

### Every link (shipping pages and section scripts)

| file:line | text | href | target / notes |
|---|---|---|---|
| index.html:756 | (aria) "Priceflag — back to top" | `#` | `data-pf-go=top` |
| index.html:757 | About | `/about` | – |
| index.html:758 | FAQ | `#` | `data-pf-go=faq` |
| index.html:760 | Learn more about the team ↗ | `https://youtu.be/vfZ26mCQ79A` | `_blank`, noopener noreferrer. Hidden ≤739px |
| index.html:762 | Legal | `/legal` | hidden ≤379px |
| index.html:763 | Contact | `/contact` | – |
| index.html:764 | Sign In | `https://signin.priceflag.org` | `rel=noopener`, same tab. Vercel 301s it to `dashboard.priceflag.org/signin`, so link there directly |
| index.html:782 | "AI Pricing" + "Built for Shopify stores. See it work →" | `#` | `data-pf-go=demo` |
| index.html:788 | Get a free price review | `#` | `data-pf-go=waitlist` (TODO at l.786: booking link) |
| index.html:789 | See how it works | `#` | `data-pf-go=demo` |
| index.html:818 | Priceflag (footer mark) | `#` | `data-pf-go=top` |
| index.html:823 | Get a free price review (footer) | `#` | `data-pf-go=waitlist` (TODO at l.822) |
| index.html:831 | Home | `#` | `data-pf-go=top` |
| index.html:832 | About | `/about` | – |
| index.html:833 | Partners | `#` | `data-pf-go=partners`. **No partners content exists**, so it lands on the FAQ |
| index.html:834 | Demo | `#` | `data-pf-go=demo` |
| index.html:835 | Team ↗ | `https://youtu.be/vfZ26mCQ79A` | `_blank` |
| index.html:838 | Twitter / X | `https://x.com/Priceflag/` | `_blank` |
| index.html:839 | LinkedIn | `https://www.linkedin.com/company/priceflag/` | `_blank` |
| index.html:851 | Contact | `/contact` | – |
| index.html:852 | Legal | `/legal` | – |
| about.html:318 | Skip to content | `#main` | – |
| about.html:323 | ← (aria "Back to priceflag.org") | `index.html` | the other pages use `/about` style; this should be `/` |
| about.html:325 | (aria "Priceflag home") | `index.html` | should be `/` |
| about.html:349 | Talk to us | `mailto:hello@priceflag.org` | – |
| contact.html:285 | Skip to content | `#main` | – |
| contact.html:290 | ← | `index.html` | should be `/` |
| contact.html:292 | (aria "Priceflag home") | `index.html` | should be `/` |
| contact.html:303 | Say hi | `mailto:nithin@priceflag.org` | – |
| contact.html:308 | Say hi | `mailto:kabir@priceflag.org` | – |
| contact.html:312 | legal page | `/legal` | – |
| legal.html:263 | Skip to content | `#main` | – |
| legal.html:268 | ← | `index.html` | should be `/` |
| legal.html:270 | (aria "Priceflag home") | `index.html` | should be `/` |
| legal.html:355, 360, 374, 395, 463, 489, 503 | hello@priceflag.org | `mailto:hello@priceflag.org` | – |
| signin.html:371 | Priceflag | `https://priceflag.org/` | – |
| signin.html:415 | terms | `https://priceflag.org/legal#terms` | the anchor exists (legal.html:378) |
| signin.html:416 | privacy policy | `https://priceflag.org/legal#privacy` | the anchor exists (legal.html:278) |
| pf-waitlist.js:181 | (hidden, programmatic click) | `mailto:hello@priceflag.org?subject=…&body=…` | only used if `SHEET_ENDPOINT` is blank |
| pf-waitlist.js:1279 | open it again | the same mailto | mailto-mode success only |
| pf-waitlist-b.js:593 | (location.href) | mailto | unused module |
| pf-demo.js:339 | step buttons `[data-go]` | (button, scrolls inside its own section) | not links |

Unused `data-pf-go` keys supported by the component: `bottom`, `about`, `workflow`, `how-it-works`. No `href=""` exists anywhere. The experiments/ directory holds a further 30-odd `href="#"` placeholders, but it is not deployed.

### Every `href="#"` and what it should point to

| file:line | link | should point to |
|---|---|---|
| index.html:756 | nav logo | `/` (or `#top`) |
| index.html:758 | nav FAQ | `#faq` (give the FAQ section `id="faq"`) |
| index.html:782 | hero eyebrow "See it work" | `#how-it-works` (pf-demo section id). Also drop the "AI Pricing" tag |
| index.html:788 | hero CTA "Get a free price review" | the real booking URL (TODO). Until then `#waitlist`, with a matching label |
| index.html:789 | hero "See how it works" | `#how-it-works` |
| index.html:818 | footer mark | `/` |
| index.html:823 | footer CTA "Get a free price review" | same as l.788 |
| index.html:831 | footer Home | `/` |
| index.html:833 | footer Partners | **remove**: there is no partners section or page (or point it to a real page if one is planned) |
| index.html:834 | footer Demo | `#how-it-works` |

`href=""`: none found.

---

## 5. Assets

### Referenced assets

| Asset | Exists | Bytes | Pixels | Format | Used at | Alt status |
|---|---|---|---|---|---|---|
| `hero-new.png` | yes | **2,737,980** | 1671×941 | PNG | index.html:27 (preload, fetchpriority high), :775 `<img>` | `alt=""` (decorative). The comment at l.773 describes meaningful art ("…Together they draw a $"), so consider a short alt. **A 2.7 MB PNG LCP image needs a WebP/AVIF derivative** |
| `uploads/summit-lime.webp` | yes | 41,466 | 1855×848 | WebP | index.html:813 (footer art, lazy) | `alt=""`, decorative OK |
| `uploads/summit-painting-3.webp` | yes | 208,904 | 1672×941 | WebP | about/contact/legal l.9 preload, about:315, contact:282, legal:260 | `alt=""` inside an `aria-hidden` wrapper, OK |
| `uploads/signin-hero.webp` | **NO (missing from repo)** | – | – | WebP | signin.html:361 via absolute `https://priceflag.org/uploads/signin-hero.webp` | `alt=""`. Only the source `uploads/signin-hero.png` is named in `.vercelignore`, and it is also absent. The page is redirected in prod anyway |
| `mark.svg` | yes | 33,571 | viewBox 698×1296 | SVG | CSS mask: index:205-208, about:154-157, contact:130-133, legal:130-133, signin:144-148, pf-demo.js:149 | `aria-hidden` spans. The nav logo link has an aria-label (index:756) |
| `favicon.ico` | yes | 2,393 | 48×48 | ICO | index:23, about/contact/legal:11 (not signin) | n/a |
| `favicon.svg` | yes | 33,731 | 64×64 | SVG | index:24, about/contact/legal:12, signin:17 (absolute) | n/a |
| `favicon.png` | yes | 19,861 | 512×512 | PNG | index:25, others :13, signin:18 (absolute). Also the JSON-LD `logo` (index:46) | n/a |
| `apple-touch-icon.png` | yes | 4,059 | 180×180 | PNG | index:26, others :14, signin:19 (absolute) | n/a |
| `og-v7.jpg` | yes | 140,478 | 1200×630 | JPEG | index:14, :21 and signin:16 (absolute URLs). Source design: `experiments/og-card.html` | `og:image:alt` / `twitter:image:alt` present (index:17, :22): "Priceflag — a tool for Shopify. Simulate and safely roll out price changes." |
| `[data-grain]` noise | inline | – | 200×200 | base64 SVG data URI | index:130, signin:122 | decorative |
| `__bundler_thumbnail` | inline | – | – | SVG in a `<template>` | index:120 | dc-runtime artefact. Drop it in a static build |
| Inline SVG icons | inline | – | – | SVG | Shopify bag (index:820, signin:378, pf-hero-logos), X (index:838), LinkedIn (index:839), arrow (index:825), giant wordmark text (index:844-846) | all `aria-hidden` with visible text alongside, OK |
| Google Fonts | external | – | – | TTF via fonts.gstatic | all pages | – |

### On disk but unreferenced by any shipping file

| File | Bytes | Pixels | Note |
|---|---|---|---|
| `mark.png` | 41,946 | 512×512 PNG | referenced nowhere, deployed |
| `uploads/hero2.webp` | 150,186 | 1168×784 | referenced nowhere, deployed |
| `uploads/hero2.jpg` | 400,483 | 1168×784 | referenced nowhere. Excluded by `.vercelignore` |
| `sections/pf-globe.js`, `pf-sim.js`, `pf-sim-b.js`, `pf-waitlist-b.js`, `pf-week.js` | 279 KB total | – | **deployed** (sections/ is not ignored) but unused by any shipping page |
| `integrations/waitlist-sheet.gs` | 5,602 | – | Apps Script source. Deployed and publicly fetchable (not ignored at HEAD) |
| `scripts/e2e-signin.mjs` | 27,197 | – | test harness. Deployed at HEAD |
| `.impeccable/config.json`, `.claude/launch.json`, `LICENSE` | – | – | deployed at HEAD |

---

## 6. Honesty scan

Grep over the repo excluding `docs/` and `.git`. Hits inside code comments that are not user-visible are marked (comment). Prototype-only files under experiments/ are omitted unless they carry copy.

### Revert / roll back / automatic / on its own / unattended

| file:line | exact text | visible? |
|---|---|---|
| index.html:7, :13, :20 | "…rolls it out gradually across your products, and reverts it automatically if it stops paying." | meta, OG and Twitter descriptions |
| index.html:47 | "…rolls it out gradually, and reverts it automatically if it stops paying." | JSON-LD Organization |
| index.html:65 | "Simulate and safely roll out price changes on Shopify. … reverts it automatically if it stops paying." | JSON-LD SoftwareApplication |
| index.html:784 | "…rolls it out gradually across your products, and reverts it on its own if it stops paying." | **hero sub** |
| index.html:800 | "We watch your real orders and put it back if it stops paying." | **statement** |
| index.html:89 / pf-faq.js:91 | "…pause the rollout and email you, or restore the original prices automatically." | FAQ (framed as the merchant's choice) |
| index.html:99 / pf-faq.js:99 | "We do not roll anything back on the way out…" | FAQ (honest) |
| about.html:7 | "…a guardrail that reverts a change on its own." | meta |
| about.html:329 | "…and reverts it automatically if it stops paying." | lede |
| about.html:335 | "An automatic guardrail. When real orders land outside the forecast, the price returns to where it started on its own." | body |
| about.html:333 | "A proposed price is simulated thousands of times…with the odds attached to each." | body (the FAQ describes fitting order history instead) |
| pf-workflow.js:3-4 | "automatically reverts when guardrails are breached" | (comment) |
| pf-workflow.js:106 | aria-label "…staged price rollouts and automatic recovery" | screen reader |
| pf-workflow.js:315 | "AUTO-REVERT" (mobile l.545 "REVERT") | **visible** |
| pf-workflow.js:316 | "Restoring original prices" | visible |
| pf-workflow.js:348, :569 | "Reverted while you slept" | **visible** |
| pf-workflow.js:370, :590 | "Zero lost sales compounded. Catalog verified safe." / "…Verified safe." | **visible** |
| pf-workflow.js:378 | aria-label "…price change rollout and rollback" | screen reader |
| pf-workflow.js:717 | "Autonomous Guardrails" | **visible** eyebrow |
| pf-workflow.js:719 | "…our guardrail loop watches live orders and pulls the price if anything slips." | **visible** |
| pf-workflow.js:734 | "Priceflag, on its own" | **visible** legend |
| pf-sim.js:131 | "It reverses itself at 3 a.m., unattended." | unused module |
| pf-sim-b.js:518-519 | "It reverses itself at 3 a.m., unattended." / "…reverses itself, unattended." | unused module |
| legal.html:282 | "…and pauses the rollout if the guardrail is breached so the price can be put back." | **contradicts** the marketing "reverts automatically" |
| legal.html:291, 299, 301, 312, 410, 413, 414, 418, 467, 481 | "rollback", "automatic rollback", "guardrail rollbacks", "We do not and cannot warrant … that a rollback will always execute" | legal, appropriately caveated |
| legal.html:437 | "Subscriptions renew automatically until cancelled." | legal, fine |

### "AI" / intelligence

| file:line | text |
|---|---|
| index.html:782 | `<span class="pf-tag">AI Pricing</span>`: **visible hero eyebrow tag** |
| pf-sim-b.js:20, :655, :1026 | "That fan IS the AI." / "The AI's trial scatter" / "the AI's trials" (comments, unused module) |
| pf-hero-logos.js:13, pf-faq.js:23 | "Intelligence for ecommerce" (comments referring to a removed eyebrow) |

### Guarantee

| file:line | text |
|---|---|
| legal.html:387 | "A forecast is a statistical estimate from past data. It is not a guarantee…" (fine) |
| legal.html:463 | "…we do not offer a service level agreement or an uptime guarantee" (fine) |
| everything else | code comments only (index:1201, :1217; pf-compare:500; pf-waitlist:1120) |

### Percentages and dollar figures (user-visible)

| file:line | text | note |
|---|---|---|
| index.html:74 / pf-faq.js:79 | "up to the last 180 days", "sell up to 14% fewer units…expects about 9%" | FAQ example, consistent with pf-demo |
| index.html:94 / pf-faq.js:95 | "before a rollout reaches 100% of your selection" | fine |
| pf-demo.js:56, 234, 237-246 | 6% higher, 6 of 14 products, −9%, −16% to −3%, $1,160, $1,090, $1,010-$1,230, 14% fewer, −$80 / +$70 / +$140 | demo store, illustrative |
| pf-demo.js:74-79 | product prices $32.00→$33.92 … $58.00→$61.48 | demo |
| pf-workflow.js:186, 449 | "+$1,420 / mo estimated" | **invented, conflicts with pf-demo** |
| pf-workflow.js:187, 450 | "+6% target price" | – |
| pf-workflow.js:190, 451 | "Break-even: -3.8% units" | **conflicts with the −14% elsewhere** |
| pf-workflow.js:192 | "Model: 95% confidence" | invented precision claim |
| pf-workflow.js:359, 548 | "original $24.00 prices restored" | – |
| pf-compare.js:84-85 | `LIFT_PF = 0.11` (+11%), `LIFT_SHEET = 0.026` | not printed, but they shape the "Priceflag ends highest" chart |
| pf-globe.js:66-74 | "Revenue increased by Priceflag … $1,342 and counting" | invented traction (unused) |
| pf-sim.js:125 | "We place it 20,000 times first." | unused |
| pf-sim-b.js:513-516 | "five percent of products at a time" | unused |
| pf-week.js:62 | "You raise prices 6% on 6 products" | unused |
| legal.html | "10 business days", "45 days", "30 days" | legal, fine |

### Testimonials / other companies' logos

- No testimonials anywhere in shipping code. The word appears only in `experiments/goldsand-analysis.md` (:45, :538, :666), as competitor-site analysis.
- **Other companies' logos:** `pf-hero-logos.js` uses Shopify (real path), WooCommerce, BigCommerce, Magento, Squarespace and Stripe lookalike marks, with the aria "Integrates with…" (l.282). It is visible on the index hero today. The footer uses the Shopify bag (index:820), X (:838) and LinkedIn (:839). signin uses the Shopify bag (:378).
- **Comparative claims:** pf-compare "Earn more with Priceflag." vs "Blind A/B" and "Spreadsheet". FAQ index:84 compares against "A/B testing app" (qualitative, fine).
- **Implied customers:** pf-faq.js:320 "The six things merchants ask us before they install." legal.html:276 says a lawyer must review "before Priceflag accepts its first merchant".

---

## 7. Config

**vercel.json** (31 lines)
- `rewrites`: `/about`, `/legal` and `/contact` map to their `.html` files. There is no `cleanUrls`, so `/about.html` is also served (duplicate URL, mitigated by canonicals). about/contact/legal link home via `index.html`, so `/index.html` gets served as a second home URL.
- `redirects`: a host `signin.priceflag.org` with path `/` gets a 301 to `https://dashboard.priceflag.org/signin`, and `/signin.html` gets a 301 to the same place. **signin.html is therefore dead in production.** README.md (l.18-27, l.36-41) still describes a host *rewrite* to `signin.html` and "the block is declared twice". The config now has only one header block (`/signin.html`) and no rewrite, so the README is stale.
- `headers`: a CSP plus nosniff, Referrer-Policy and HSTS, **only for `/signin.html`**, which now redirects. The marketing pages get no security headers at all. If index stays on unpkg React, a CSP would need `unpkg.com`. A static build removes that need.

**.vercelignore** (HEAD, 14 lines): ignores `experiments/`, `README.md`, `uploads/IMG_6461.png`, `uploads/new-hero.png`, `uploads/signin-hero.png`, `uploads/hero2.jpg` and `Priceflag-standalone.html`.
- experiments/ **is** ignored. Good.
- Stale entries: `uploads/IMG_6461.png`, `new-hero.png`, `signin-hero.png` and `Priceflag-standalone.html` do not exist in the repo. Harmless.
- **Not ignored at HEAD, so deployed and publicly fetchable:** `docs/` (OVERHAUL_PLAN.md and OVERHAUL_PROMPT.md, 48 KB of internal planning), `scripts/e2e-signin.mjs`, `integrations/waitlist-sheet.gs`, `.impeccable/`, `.claude/`, `LICENSE`, `mark.png`, `uploads/hero2.webp`, and the five unused `sections/*.js`.
- The working tree (another agent's uncommitted edit) adds `qa/`, `package.json`, `package-lock.json`, `node_modules/`, `docs/`, `DESIGN_TOKENS.md`, `OVERHAUL_LOG.md` and `scripts/`. That fixes docs and scripts. `integrations/`, `.impeccable/`, `.claude/`, `mark.png`, `uploads/hero2.webp` and the unused sections would still deploy.

**sitemap.xml**: 4 URLs (`/`, `/about`, `/contact`, `/legal`), all `lastmod 2026-10-04`. They match the canonicals and contain no signin or experiments entries. Issues: `lastmod` is hand-maintained and needs bumping on ship, and `changefreq` / `priority` are ignored by Google (harmless).

**robots.txt**: `User-agent: * / Allow: / / Sitemap: https://priceflag.org/sitemap.xml`. Fine. Nothing disallows `/experiments/` (not deployed) or `/docs/`, which is deployed at HEAD.

**.claude/launch.json**: config "static", running `python3 -m http.server 8901`.

---

## 8. Typos and copy issues

1. **"Works with" + "Shopify & more" run together**: index.html:793 is `<span class="pf-works-label">Works with</span><span …hero-logos></span><span>Shopify &amp; more</span>` with no whitespace text nodes. Visually it is separated by `gap:16px`, but the text content, copy-paste, reader mode and the no-JS case read "Works withShopify & more". A screen reader reads "Works with, Integrates with Shopify, WooCommerce, BigCommerce, Magento, Squarespace, Stripe, Shopify & more", which says Shopify twice and makes the integration claim.
2. **"AI Pricing"** tag in the hero eyebrow (index:782). The product is described everywhere else as forecasting and staged rollout, and nowhere else as AI.
3. The hero eyebrow "Built for Shopify stores. See it work" (index:782) has no closing punctuation and mixes a sentence with a fragment.
4. The **CTA promise is inconsistent**: "Get a free price review" (index:788, :824) leads to "Join the waitlist." / "Get early access to Priceflag." / "Send it to me" (pf-waitlist). "Send it to me" is left over from the hidden calculator. There is nothing to send.
5. The **hero sub vs FAQ vs legal** disagree on auto-revert: the hero says "reverts it on its own" (index:784), the FAQ makes it opt-in (index:89), and legal says it "pauses the rollout … so the price can be put back" (legal:282).
6. **Integration claim**: "Works with … Shopify & more" (index:793) and the footer "A tool for Shopify & more" (index:820) both conflict with legal:454, "Priceflag runs on Shopify and cannot work without it".
7. Numbers conflict between sections: break-even −14% (pf-demo and FAQ) vs −3.8% (pf-workflow). pf-demo also has "6 of 14 products" while the copy says "all six".
8. contact.html:296: "Priceflag Syndicate provides needed support for Priceflag." is awkward. :298 "On Duty Engineers" is wrong because Kabir is listed for sales, marketing and pricing. :307 "Any issues with our pricing or support." is a sentence fragment. The meta (:7) says "on duty engineers" without the hyphen ("on-duty").
9. legal.html:382: "Priceflag Syndicate, Inc.." has a double period.
10. Footer index:849: "Built by Humans in San Francisco&#44; CA" has an odd capital H. The `&#44;` entity is a dc-runtime comma workaround and can become a plain comma in static HTML.
11. The nav centre link "Learn more about the team ↗" (index:760) and the footer "Team ↗" (:835) go to a YouTube video, which is unexpected for "team". The About page has no team content.
12. Spelling is inconsistent between "catalogue" (about.html:7, :334, :342; pf-waitlist) and "catalog" (index JSON-LD and FAQ, pf-workflow, legal). Pick US "catalog".
13. The index `<title>` is just "Priceflag", while OG titles are "Priceflag — See what a price change will do before it goes live". The title should carry the value prop. signin uses "–" (en dash) and the other pages use "—".
14. Leftovers: `data-screen-label="Platforms & FAQ"` (pf-faq.js:310) with no platforms section; the footer "Partners" link has no destination; pf-hero-logos and pf-faq comments refer to a removed "Intelligence for ecommerce" eyebrow.
15. The FAQ lede "The six things merchants ask us before they install. Short answers, no hedging." (pf-faq.js:320) implies an installed base before launch.
16. In reduced-motion mode, pf-demo renders with no H2 or section heading (pf-demo.js:360-365), so its section is unlabelled.
17. The footer landmark is `<section role="contentinfo">` (index:812) rather than `<footer>`. The waitlist renders an empty `<h2>` (the success heading) in the DOM before submit.
18. Fonts are loaded twice on index (l.31 and l.119). `hero-new.png` is a 2.7 MB PNG LCP image.
