# M1 checklist (builder self-check)

Run: `QA_LABEL=M1 QA_STRICT=1 QA_BLOCKED_BROWSERS=firefox QA_COMPARE=before npm run qa` → `qa/M1/summary.md`.
Tests: `npm test` → 10/10 pass (`qa/tests/review-form.test.mjs`).

| # | Requirement (source) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Every CTA goes to a working form (prompt M1, plan "Fixes") | PASS | `index.html` hero, footer → `#review`; form `index.html` `#review` + `sections/pf-review.js` POSTs to the live Apps Script endpoint (verified in `qa/M0/cta-backend.md`); mocked tests in `qa/tests/review-form.test.mjs` |
| 2 | Mailto fallback if the endpoint fails | PASS | `sections/pf-review.js` `fail()`; test "endpoint failure keeps the input…" |
| 3 | Confirmation email on submit (plan "Fixes") | DEFERRED | Needs a patch to `integrations/waitlist-sheet.gs` that only the owner can deploy; patch text in `qa/M0/cta-backend.md` §5. Logged. |
| 4 | Say what happens next | PASS | Form note "Free. We reply within 48 hours. No app install needed."; success message names the email and 48 hours |
| 5 | Zero `href="#"` / `href=""` | PASS | `qa/M1/links.md` (0 static / 0 rendered on every page) |
| 6 | Logo, FAQ, See how it works, banner, Home, Partners, Demo links fixed or removed | PASS | nav logo `/`, FAQ `#faq`, "See how it works" `#how-it-works`, banner removed, footer Home `/`, Partners removed, Demo → "How it works" `#how-it-works` |
| 7 | No "reverts automatically / on its own" anywhere, including meta | PASS | `grep -rni "revert\|on its own" *.html sections/` → no hits; about.html meta, lede and guardrail line rewritten; FAQ "restore automatically" removed; legal.html "automatic rollback" → "rollback" (3 places) |
| 8 | Rollouts by SKU cohort 25% → 50% → all | PASS | `index.html` how-it-works step 2 and FAQ answer 2 |
| 9 | Typo "Works withShopify & more" fixed, "& more" dropped | PASS | hero foot "Built for Shopify"; footer "A tool for Shopify stores" |
| 10 | "AI Pricing" banner removed | PASS | `grep -i "ai pricing" index.html` → none |
| 11 | `<title>` "Priceflag — Change Shopify prices safely" (< 60 chars) | PASS | `index.html:6` (40 chars) |
| 12 | One phrasing ("forecast") across og:title, og:image:alt and copy | PASS | og:title "forecast a Shopify price change…", og:image:alt "forecast a price change…" |
| 13 | Meta description and og:description distinct, each < 155 chars | PASS | 142 and 144 chars |
| 14 | Alt text on hero and summit art | PASS | hero `<img alt="A painting of a night mountain…">`, footer `summit-lime.webp` alt |
| 15 | Hero served as WebP at the right size | PASS | `uploads/hero-{720,1080,1671}.webp` (33/69/165 KB, was 2.7 MB PNG), `srcset` + preload |
| 16 | Contrast on buttons and small text; 375 px | PASS | axe 0 serious/critical on every page (`qa/M1/axe.md`); screens at 375 |
| 17 | Lighthouse mobile 90+ (all 4 categories) on changed pages | PASS | `qa/M1/lighthouse.json`: index 99/100/100/100, about 100/100/100/100, contact 100/100/100/100, legal 99/100/100/100 (before: 74/96, 88, 88, 87/95) |
| 18 | `sitemap.xml` lists only live pages | PASS | 4 URLs (/, /about, /contact, /legal), all 200 in links check |
| 19 | `experiments/` in `.vercelignore` | PASS | `.vercelignore` line 2 (was already there); also added qa/, docs/, package.json, integrations/, design sources |
| 20 | Decide each unused section | PASS | All `sections/pf-*.js` and `support.js` moved to `experiments/archive/` (not deployed); FAQ and how-it-works rebuilt as static HTML |
| 21 | Zero console errors/warnings, 3 browsers | PASS (Chromium, WebKit) / BLOCKED (Firefox) | `qa/M1/console.md`; Firefox cannot launch on this machine, logged BLOCKED |
| 22 | html-validate no errors | PASS | `qa/M1/html.md` |
| 23 | Keyboard reaches everything with visible focus | PASS | `qa/M1/keyboard.md`; skip link added to index |
| 24 | No horizontal scroll, no layout shift | PASS | `qa/M1/screens.md` (CLS ≤ 0.02, under 0.1) |
| 25 | Homepage shows content and CTA with JS off | PASS | `qa/M1/nojs.md` index PASS (was blank) |
| 26 | Point Vercel project at Priceflag/website | DEFERRED | Owner action (account settings); logged |

Note for reviewers: in `screens/<page>-<w>.png` full-page shots the sticky nav can appear partway down the image. That is how the harness stitches a sticky element, not a layout bug; the `-fold.png` shots show the real top of the page.
