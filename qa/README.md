# QA harness

Dev-only. Nothing here ships: `.vercelignore` excludes `qa/`, `package.json`,
`package-lock.json`, `node_modules/`, `docs/`, `scripts/` and the overhaul notes,
so Vercel keeps serving the repo as a pure static site with no build step.

## Setup (once)

```sh
npm install
npx playwright install chromium firefox webkit
```

## Commands

| command | what it does |
| --- | --- |
| `npm run qa` | every check, 3 browsers, Lighthouse (≈3–4 min locally) |
| `npm run qa:fast` | skips Lighthouse; console check runs Chromium only (≈30–60 s) |
| `npm test` | unit tests only: `node --test "qa/tests/**/*.test.mjs"` |
| `npm run qa:serve` | start the Vercel-like local server on :8902 (`node qa/serve.mjs [port] [root]`) |

Typical milestone run:

```sh
QA_LABEL=M3 QA_STRICT=1 QA_COMPARE=M2 npm run qa
```

Output goes to `qa/<label>/`:

- `summary.md` / `summary.json` — PASS/FAIL/WARN per check and per page + Lighthouse scores (also printed to stdout)
- `<check>.json` + `<check>.md` for each check (Lighthouse details: `lighthouse-details.json`, `lighthouse.md`)
- `screens/<page>-<width>.png` (full page), `screens/<page>-<width>-fold.png` (900px viewport), `screens/<page>-1440-nojs-fold.png`
- `lighthouse.json` — `{ "<page>": { "performance": 0.93, "accessibility": …, "best-practices": …, "seo": … } }`
- `lighthouse/<page>.html` — full reports; `lighthouse-metrics.json` — LCP/TBT/CLS/FCP/SI + failing audits

Exit code: `0` normally; `1` when `QA_STRICT=1` and anything is FAIL/ERROR; `2` when a check crashed (ERROR) even in non-strict mode.

## Environment variables

| var | default | meaning |
| --- | --- | --- |
| `QA_LABEL` | `latest` | output folder `qa/<label>/` |
| `QA_BASE_URL` | unset | test a deployed URL instead of the local server; pages with `skipOnRemote` are skipped |
| `QA_ONLY` | all | comma list of checks: `console,screens,axe,html,links,keyboard,nojs,unit,lighthouse` |
| `QA_PAGES` | all | comma list of page names from `pages.json` (e.g. only the pages a milestone changed) |
| `QA_STRICT` | `0` | `1` = exit non-zero on any FAIL. Use for milestone runs. Also makes a browser that cannot launch a FAIL instead of WARN |
| `QA_FAST` | `0` | `1` = same as `npm run qa:fast` |
| `QA_GIT_REF` | unset | serve a pristine `git archive` of that commit (exported to `qa/<label>/tmp/site`, gitignored) instead of the working tree. Used for the baseline so in-progress edits don't leak in |
| `QA_COMPARE` | unset | another label; FAIL if any Lighthouse category dropped more than `QA_LH_TOLERANCE` vs `qa/<that>/lighthouse.json` |
| `QA_LH_TOLERANCE` | `0.02` | allowed Lighthouse drop for `QA_COMPARE` (run-to-run noise) |
| `QA_LH_RUNS` | `3` | Lighthouse runs per page; the median-performance run is reported |
| `QA_NOJS_STRICT` | `0` | `1` = no-JS problems FAIL instead of WARN |
| `QA_CONCURRENCY` | `3` | how many non-Lighthouse checks run at once |
| `QA_PORT` | random | port for the local server |
| `CHROME_PATH` | Playwright Chromium | browser binary for Lighthouse |
| `QA_SERVE_REDIRECTS` | `0` | `1` = local server also applies `vercel.json` redirects |

## Adding a page

Add one line to `qa/pages.json`:

```json
{ "name": "how-we-measure", "path": "/how-we-measure", "lighthouse": true }
```

`/x` resolves to `x.html` automatically (clean URLs), so no `vercel.json` rewrite is needed for the
local server. (Production still needs the rewrite, or `cleanUrls`, in `vercel.json`.)
Set `"skipOnRemote": true` for pages that production redirects away (like `/signin.html`), and
`"lighthouse": false` to keep a page out of the Lighthouse 90+ requirement.

## Local server (`qa/serve.mjs`)

Zero-dependency, mimics Vercel for this repo: serves the repo root, applies `vercel.json`
`rewrites` and `headers` (exact-path sources), clean URLs (`/x` → `/x.html`, `/dir/` → `index.html`),
returns 404 for anything matched by `.vercelignore` or dotfiles, 404 status for unknown paths
(body = `/404.html` if present), and brotli/gzip-compresses text like Vercel's edge.
`redirects` are not applied unless `QA_SERVE_REDIRECTS=1`, so `/signin.html` can be tested locally.

## Checks and thresholds

| check | what | FAIL when | WARN when |
| --- | --- | --- | --- |
| `console` | Chromium, Firefox, WebKit at 1440×900; load, network idle (30 s cap) + 1 s | any console error, uncaught page error, failed request (status ≥ 400 or network failure) | console warnings; browser could not launch (non-strict) |
| `screens` | Chromium at 375/768/1440 (height 900): fold + full-page PNGs; horizontal overflow; CLS | `scrollWidth > innerWidth` (before or after scrolling) or load CLS > 0.10 | load CLS > 0.01 |
| `axe` | `@axe-core/playwright`, all default rules, 375 + 1440 | any serious or critical violation | moderate/minor violations |
| `html` | `html-validate` on the served HTML (rewrites applied), config `qa/.htmlvalidate.json` | any error | warnings |
| `links` | static DOM (JS off) + rendered DOM (JS on) crawl of every page | any `<a href="#">` / `href=""`; internal URL not ending at 200 (redirect off-site = OK); external URL not 2xx/3xx; `#anchor` with no matching id on a tested page | 403/429/999/400 from bot-blocking hosts (linkedin.com, x.com, twitter.com, youtube.com, youtu.be, instagram.com, facebook.com, tiktok.com, reddit.com, medium.com, apps.shopify.com, g2.com, producthunt.com); Vercel bot challenge; `javascript:` links |
| `keyboard` | Chromium 1440 + 375, Tab up to 200× | a visible interactive element never focused; a focused element with no visible indicator; focus trapped | indicator could not be judged; focus never wrapped |
| `lighthouse` | mobile emulation + default simulated throttling, pages with `lighthouse: true`, 3 runs, median by performance | any category < 0.90 (and, with `QA_COMPARE`, a drop > tolerance) | — |
| `nojs` | Chromium, JS disabled | only with `QA_NOJS_STRICT=1` | no visible H1, no visible `<a>` containing "price review", or < 200 chars of visible text |
| `unit` | `node --test "qa/tests/**/*.test.mjs"` | non-zero exit | — |

Notes on how the checks judge things:

- **Collected links**: `<a href>`, `<link href>` (except `preconnect`/`dns-prefetch`, which are not fetchable resources), `<script src>`, `<img src/srcset>`, `<source src/srcset>`, media `src`/`poster`, `<iframe src>`, CSS `url()` in `style` attributes and `<style>` blocks, `og:image*`/`twitter:image*` meta. `mailto:`, `tel:`, `data:` are skipped. External: HEAD, then GET if HEAD fails or is ≥ 400.
- **Visible focus**: the focused element has a non-transparent outline with width > 0 (including Chromium's default `auto` ring), or any of box-shadow, border colour/width, background, colour, text-decoration, transform, opacity, filter, or its `::before`/`::after` (content, opacity, transform, background, box-shadow, border, size) differs from the element's unfocused computed style.
- **Interactive elements** for reachability: visible `a[href]`, `button`, `input` (not hidden), `select`, `textarea`, `summary`, `iframe`, `[tabindex]` ≥ 0, contenteditable, media with controls; disabled, `inert` and `tabindex="-1"` are excluded. Visible = `checkVisibility()` and a non-zero box (opacity 0 still counts as visible, since it is still in the tab order).
- **CLS** comes from a `layout-shift` PerformanceObserver injected with `addInitScript`; "load CLS" is measured after network idle + 1 s and before any scrolling (that's the number that gates). "After scroll" is reported for information.
- **Full-page screenshots**: the page is scrolled through first so reveal-on-scroll content renders. Pages whose content lives in an inner scroll container (`body{height:100vh;overflow:hidden}` + a scrolling sheet, as about/contact/legal do at desktop widths) are captured by un-clipping that container and its ancestors (`height:auto; overflow:visible`) right before the full-page shot, so those full-page images are an approximation of the layout; the `-fold` shot is exact.

## html-validate rules turned off or relaxed (`qa/.htmlvalidate.json`)

Everything in `html-validate:recommended` stays on, including all `wcag/*` rules,
`prefer-native-element`, `unique-landmark`, `heading-level`, `valid-id`, `element-name`,
`no-implicit-button-type`, etc. Only purely stylistic rules that flag valid HTML5 are off:

| rule | setting | reason |
| --- | --- | --- |
| `no-inline-style` | off | `style=""` is valid HTML; the site's component markup uses it deliberately. Not an a11y or validity issue (CSP for inline styles is handled in `vercel.json`) |
| `no-trailing-whitespace` | off | formatting only |
| `void-style` | off | `<br>` vs `<br/>` are both valid HTML5 |
| `attribute-boolean-style` | off | `disabled` vs `disabled=""` are both valid |
| `attribute-empty-style` | off | `alt` vs `alt=""` style preference only |
| `doctype-style` | off | `<!DOCTYPE html>` vs `<!doctype html>` are equivalent |
| `attr-case`, `element-case` | off | HTML is case-insensitive; casing is style |
| `attr-quotes` | off | single vs double quotes are both valid |
| `no-raw-characters` | relaxed | HTML5 allows unambiguous raw `&`; still errors on ambiguous ampersands |

## Known limitations

- **Firefox inside the Claude Code sandbox**: on this machine (macOS 27) Playwright's Firefox exits at launch with "Could not find profile folder" when run from the agent's sandboxed shell. The harness records that as WARN (FAIL with `QA_STRICT=1`) and still runs Chromium/WebKit. Running outside the agent sandbox was tried and fails the same way ("Could not find profile folder"), so Firefox is BLOCKED on this machine; see OVERHAUL_LOG.md. Try again after a Playwright/Firefox update or on another machine.
- The focus-visibility heuristic compares computed styles on the element and its pseudo-elements only. A focus style drawn on a child or parent (e.g. `a:focus-visible > span`) reads as "no visible focus" (false FAIL); a style change that is technically present but low-contrast reads as visible (false PASS). Contrast of the focus ring is not measured.
- Lighthouse runs against the local server on loopback, so there is no real network latency for first-party assets (third-party CDNs still go over the network). Treat local performance as a regression signal; the authoritative number is a run with `QA_BASE_URL` against the deployed preview.
- `QA_BASE_URL` runs may hit Vercel's bot checkpoint (403 with `x-vercel-mitigated`); internal links answering that way are WARN, but page checks would see the challenge page. Disable deployment protection for the preview or test locally.
- The link checker only checks anchors on pages listed in `pages.json`; links into other internal pages are status-checked but their `#fragment` is not.
- External link results depend on the network and on remote bot filtering at run time.

- `QA_BLOCKED_BROWSERS` (comma list, e.g. `firefox`): a browser that cannot launch on this machine and is logged as BLOCKED in `OVERHAUL_LOG.md` is reported WARN instead of FAIL in strict runs. It still FAILs if it launches and finds errors.
