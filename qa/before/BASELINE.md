# Baseline ("before") — original site

- Source: pristine `git archive` of commit `0f93942` (the imported site + overhaul docs), served by `qa/serve.mjs`. It was run with `QA_GIT_REF` because other agents were already editing the working tree.
- Command: `QA_LABEL=before QA_GIT_REF=0f93942 npm run qa` (non-strict). Full run took 105 s (Lighthouse 78 s of that).
- Run at: 2026-10-13T20:36Z. Raw data: `summary.md`, `<check>.md/json`, `lighthouse.json`, `lighthouse/*.html`, `screens/`.
- **Firefox was not tested.** It does not launch inside the agent sandbox on this machine (see qa/README.md "Known limitations"), so the Firefox columns are n/a.

## Per page

| | index | about | contact | legal | signin |
| --- | --- | --- | --- | --- | --- |
| **Lighthouse perf / a11y / BP / SEO** (mobile, median of 3) | **74** / 96 / 100 / 100 | 88 / 100 / 100 / 100 | 88 / 100 / 100 / 100 | 87 / **95** / 100 / 100 | not in LH list |
| Lighthouse LCP (simulated) | 16.2 s | 3.3 s | 3.3 s | 3.5 s | – |
| Console errors / warnings: Chromium | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 1 / 0 |
| Console errors / warnings: WebKit | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 1 / 0 |
| Console errors / warnings: Firefox | n/a | n/a | n/a | n/a | n/a |
| Failed requests (Chromium, WebKit) | 0 | 0 | 0 | 0 | 1 (404 `https://priceflag.org/uploads/signin-hero.webp`) |
| axe serious+critical rules @375 / @1440 | 1 / 1 (`color-contrast`) | 1 / 1 (`scrollable-region-focusable`) | 0 / 0 | 1 / 1 (`color-contrast`) | 0 / 0 |
| axe moderate (`region`) @375 / @1440 | 1 / 1 | 1 / 1 | 1 / 1 | 1 / 1 | 1 / 1 |
| html-validate errors | **4** (`element-name` `<helmet>`, `valid-id` `__bundler_thumbnail`, `unique-landmark`, `prefer-native-element`) | 0 | 0 | 0 | 0 |
| `href="#"` / `href=""` links (static / rendered) | **10 / 10** | 0 | 0 | 0 | 0 |
| Broken links (internal + external) | 0 | 0 | 0 | 0 | 1 (same 404 image) |
| Broken in-page anchors | 0 | 0 | 0 | 0 | 0 |
| Horizontal overflow 375 / 768 / 1440 | no / no / no | no / no / no | no / no / no | no / no / no | no / no / no |
| Load CLS 375 / 768 / 1440 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0.0003 / 0.00004 |
| Keyboard focused / visible interactive @1440 | 32 / 32 | 5 / 4 ¹ | 6 / 6 | 10 / 10 | 5 / 5 |
| Keyboard unreached / invisible focus (1440 and 375) | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| No-JS: visible text chars / H1 / "price review" CTA | **0 / no / no** (2 CTAs in DOM, hidden) | 1164 / yes / none on page | 460 / yes / none on page | 28800 / yes / none on page | 274 / yes / none on page |

¹ about: the extra Tab stop is the scrollable `<main>` sheet. Chromium makes scroll containers keyboard-focusable on its own, so it is not in the interactive-element list.

## Check-level result

| check | result | driven by |
| --- | --- | --- |
| console | FAIL | signin 404 image (and Firefox WARN: not launched) |
| screens | PASS | no overflow, CLS ≈ 0 everywhere |
| axe | FAIL | color-contrast (index, legal), scrollable-region-focusable (about) |
| html | FAIL | index only (4 errors) |
| links | FAIL | 10 `#` links on index; signin 404 image |
| keyboard | PASS | — |
| nojs | WARN | index renders nothing without JS; no other page has a "price review" CTA |
| unit | PASS | placeholder test |
| lighthouse | FAIL | performance < 90 on all 4 pages; a11y 95/96 on legal/index |

Notes:
- Lighthouse runs on loopback, so first-party assets have no real network latency. Index's 16 s LCP comes from client-side rendering: the runtime builds the DOM with JavaScript and it renders nothing without JS.
- The signin 404 is in production: the page points at an absolute `https://priceflag.org/uploads/signin-hero.webp` that is not deployed.
