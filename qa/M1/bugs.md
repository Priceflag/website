# M1 bug hunt, round 3 (final)

Tester: bug-hunter subagent (round 3), 2026-10-13. Target: working tree on `overhaul` (diff vs `0f93942` plus untracked files), served by `node qa/serve.mjs 8933`. The server was stopped afterwards.
Browsers: Chromium and WebKit through Playwright. Firefox was not attempted; it does not launch on this machine (see OVERHAUL_LOG.md).
The Apps Script endpoint was never called. Every `script.google.com` request was caught with `context.route` and given a mocked response: ok, duplicate, `ok:false`, `null`, empty, `"ok"`, HTML, 500, 302, abort, connection reset, a 2.5 s delay, and a 17 s hang. Every other off-site request except Google Fonts was aborted.
Scripts and evidence are in `qa/M1/bughunt-tmp3/`:
- `forms3.mjs` → `forms-{chromium,webkit}.json` / `.log`, with a digest in `summary.txt`
- `layout3.mjs` → `layout-*.json`
- `nav3.mjs` → `nav-*.json`
- `robust3.mjs` → `robust-*.json`
- `obscured.mjs`, `obscured2.mjs`, `signinbtn.mjs`
- screenshots in `shots/`

The existing unit suite `node --test qa/tests/review-form.test.mjs` passes 19 of 19.

## Round 2 status

| ID | Round-2 summary | Status | Re-test evidence |
|---|---|---|---|
| R2-1 | Emoji hung the form on "Sending…" | FIXED | 24 cases × 2 engines, each with an `ok` and an `abort` mock. Emoji in the note; 600 emoji; flags and ZWJ families; an emoji at the name and store cut points; an emoji-only store domain; a lone surrogate set from devtools; RTL; CJK; combining marks. Every case sends exactly 1 request and ends with the button back to its label. No page errors. `page` is ≤300 characters and always decodes, `ua` is ≤300, and the mailto is ≤1800 and decodes. A lone surrogate is sent as U+FFFD. |
| R2-2 | Nav focus ring clipped | FIXED | No ancestor of a nav link has overflow set. The full ring shows (`shots/chromium-navfocus.png`). |
| R2-3 | Long nav labels hidden but focusable | FIXED (side effect: R3-1) | With 2× text there are no off-screen focusable elements at any width from 320 to 1920. The nav now wraps instead, to 96–100 px tall, and 140 px in WebKit at 320. |
| R2-4 | Encoded store/name pushed `page` past 300 and cut mid-escape | FIXED | `maxStoreName` (a store of `a=%20&b=ü&…` × 25 plus a long accented name): `page` is 240 characters, decodes, and `host=` comes first. `storeE110` gives 176 characters and decodes. |
| R2-5 | `hp=1` cut off | FIXED | Honeypot filled plus a 1,000-character note: `page` starts `…#review?hp=1&host=…`, is 300 characters, and the payload has `hp:1`. |
| R2-6 | "Note too long" shown for a long name | FIXED | A 100-character name with no note gives "Your store address or name was longer than our form keeps…". The "note" copy appears only when the note is cut. |
| R2-7 | Reset / null body said "not sent" | FIXED | A reset, `null`, an empty body, HTML, 500 and 302 all say "We couldn't confirm your request arrived." Only `ok:false` or `"ok"` says the server turned it down. |
| R2-8 | Focus dropped to `<body>` while sending | FIXED | During the 2.5 s request, focus stays on the "Sending…" button (`aria-disabled="true"`). Enter, Enter, Space, a click, a double-click and Enter in the email field together send **1** request. |
| R2-9 | "Send another" focused Store when Email was empty | FIXED | After a reload with email empty, focus goes to `rv-email`. When email is still filled (sessionStorage blocked), focus goes to `rv-store`. |
| R2-10 | No-JS note/validation/stray fields | FIXED | JS off: `noValidate=false`. An empty or bad-email submit is blocked by native validation and nothing navigates. Only `email`, `store`, `name` and `message` are submitted; the hidden inputs and the honeypot are disabled. The noscript copy matches the behaviour. With JS on, `pf-review.js` sets `noValidate=true` and enables the honeypot (`tabIndex=-1`). With the script blocked, native validation still applies. |
| R2-11 | Sub-page `main` focus ring clipped | FIXED | `outline-offset:-4px`. All four sides are visible on about, contact and legal in both engines (`shots/*-mainring-*.png`). |
| R2-12 | Steps overflow below 300 px | FIXED | At 187×406 and 160×400 the index `scrollWidth` equals the viewport. |
| R2-13 | ZWSP passed; punycode rejected; long pastes cut silently | FIXED as specified (residuals: R3-2, R3-3, R3-8) | `me@shop.com​` and `shop.com​` are stripped and accepted. `shop.xn--p1ai` is accepted. A 400-character store gets the "too long" message. A 255-character email is rejected. |
| R2-14 | Hedvig fallback had no `size-adjust` | FIXED for the Georgia path (residual: R3-6) | At 88 px, Hedvig is 1787 px wide (Chromium) / 1793 px (WebKit) and `Hedvig Fallback` (Georgia at 103%) is 1788 px. With Google Fonts blocked, the title and nav sizes are unchanged at every width. CLS is 0. |
| B4 | Sub-page panel at 400% zoom | DEFERRED (M2) | Not re-tested. |
| B7 | Long words overflow | FIXED at 320/375 (residual ≥480 px: R3-4) | A 57-character word in the FAQ `summary`, `.pf-foot-head`, form `label`, hero `.pf-btn`, step h3, lede, form note and hero foot: page `scrollWidth` equals the viewport at 320 and 375. |
| B8 | Long sub-page H1 pushes the mark off-screen | DEFERRED (M2) | Still reproduces: /contact at 187 px gives `scrollWidth` 202. With a long word in the H1, every sub-page reaches `scrollWidth` 1182 at 320. |
| B16 | Dead intro CSS/JS on sub-pages | DEFERRED (M2) | Not re-tested. |
| B18 | No review CTA on sub-pages | DEFERRED (M7/M8) | /about has only "Talk to us" (mailto); /contact and /legal have none. |
| B19 | No 404 page | DEFERRED (M8) | Not re-tested. |

**Counts: 15 FIXED (R2-1…R2-14, B7), 0 STILL BROKEN, 5 DEFERRED (B4, B8, B16, B18, B19).**

## Round 3 new bugs

| ID | Sev | Page | Area | Repro | Expected | Actual | Fix |
|---|---|---|---|---|---|---|---|
| R3-1 | **Medium** | index | Sticky nav wraps at high zoom, so focus and anchors are obscured | Viewport 187×406 CSS px (a 375 px phone at 200% zoom). The same happens up to about 299 px, and at 320 in WebKit with 2× nav labels. Load `/`, focus the last footer link, then press Shift+Tab repeatedly (`obscured2.mjs`). Also click "FAQ" in the nav. | The header stays about one row tall, or stops being sticky, and a focused element is never hidden behind it (WCAG 2.4.11). | The R2-2/R2-3 fix (`flex-wrap` on `.pf-nav` and the groups) turns the sticky nav into 3 rows, **140 px of a 406 px viewport (34%)**, pinned on every scroll (`shots/chromium-zoom-phone200.png`). Going backwards, focused items sit fully under it: Twitter/X at 88–132, Home at 71–115, `rv-store` at 90–138, the FAQ summaries at 68+, the hero CTA at 101. The nav bottom is at 140. `scroll-padding-top` is fixed at 68 px, so every in-page anchor (#how-it-works, #faq, #review) lands with its h2 8 px under the nav. Forward Tab is fine. | Keep the nav to one row on narrow screens: below about 300 px, also hide "How it works"/"FAQ" (they are in the footer) with a breakpoint class such as `.pf-nav-narrow-hide`. Or drop stickiness when it can wrap, e.g. `@media (max-width:299px){.pf-nav{position:static}}`. If it can still wrap at other sizes, set `scroll-padding-top` from the real nav height, or make it non-sticky whenever it is taller than 56 px. |
| R3-2 | **Medium** | index | Form: text in name and note is silently changed | Name `علی‌رضا` (Persian, with ZWNJ U+200C). Note `می‌خواهم قیمت را تغییر دهم. क्‍ष 👨‍👩‍👧`. Submit (mocked ok) (`robust3.mjs` `zwnj`). | The visitor's name and note reach us exactly as typed. | `value()` applies `INVISIBLE_RE` (`[U+200B–U+200D, U+2060, U+FEFF]`) to **every** field. The payload has `علیرضا` and `میخواهم…`, which is wrong Persian orthography (ZWNJ appears in most Persian sentences). Devanagari `क्‍ष` loses its ZWJ, and the family emoji is split into 👨👩👧. The same altered text goes into `page`, `ua` and the mailto fallback. Both engines. | Strip invisibles only from `email` and `store`. For name, message and the mailto body, keep the raw (trimmed) value. |
| R3-3 | Low | index | Form validation: bidi/soft-hyphen marks and loose TLD | Email `me@shop.com` + U+200F (RLM, which comes along when copying from RTL text), `me@shop.com` + U+200E, or `me@sh­op.com` (U+00AD soft hyphen). Store `shop.com,` or `x.<script>`. Email `me@магазин.рф` in Chromium. | Invisible marks stripped (or the input rejected); the store TLD is letters only; the email is shown as typed. | All of these are accepted and sent. The success message reads "will email me@shop.com‏", with the RLM invisible, so the reply would bounce. The STORE_RE TLD class `[^\s\/?#:.@\d]{2,}` accepts punctuation, so `shop.com,` and `x.<script>` pass (no XSS: the store is never written as HTML, and the mailto is fully encoded, confirmed by an `"><img onerror>` test). Chromium shows an IDN email as punycode ("me@xn--80aairftm.xn--p1ai"). | For email and store use `/[­​-‏‪-‮⁠-⁤﻿]/g`. Make the TLD `(xn--[a-z0-9-]+|\p{L}{2,})` with the `u` flag. Optionally decode the punycode for display, or show the typed text. |
| R3-4 | Low | index | Long words above 480 px; nav and footer-legal links at any width | Append a 57-character word (`layout3.mjs` `lw/*`) to: the submit button at 600/768; the hero CTA at 600; the footer CTA at 600/768; the nav "FAQ" link at 320/375; "Sign in" at 320/375; the footer "Contact"/"Legal" links at 320/375. | Text wraps; no page scroll; no clipped focusable controls. | `.pf-btn` is `white-space:nowrap` at ≥480 px, so `overflow-wrap:anywhere` never applies. The submit button pushes the form to 764 px (page `scrollWidth` 764 at 600, 775 at 768). The hero and footer CTAs are cut off invisibly by `overflow:hidden`. `.pf-nav a{white-space:nowrap}` (0,1,1) outranks the `<480` `.pf-btn` rule, so "Sign in" never wraps (`scrollWidth` 392 at 320), and a long nav label gives `scrollWidth` 460. `.pf-foot-legal a` is not in the overflow-wrap list and gets clipped by the footer. The real copy and 2× copy fit everywhere, hence Low. | Let buttons wrap at every width (`white-space:normal; max-width:100%` with `text-wrap:balance`). Add `overflow-wrap:anywhere` to `.pf-nav a` and `.pf-foot-legal a`, and let `.pf-nav .pf-btn` use `white-space:normal` below 480 px. |
| R3-5 | Low | index | Form: leaving while the request is in flight | Submit with a 2.5 s response. Within 200 ms go to /about, then press Back (`awayMidSend`). The same applies to reload or tab close mid-send. | Some sign on return that the request may already have arrived. | The request reached the endpoint (1 request), but on return the form is filled and idle, with no status and no sent flag. That invites a second send, which only the script's duplicate reply catches. | Write a `pending` marker (email plus timestamp) to sessionStorage before `fetch` and clear it in `finish()`. On load, if it is still there, show "We may already have your request from X. Check your inbox, or send it again." |
| R3-6 | Low | all pages using Hedvig | Font fallback: one face, one set of overrides for four fonts | Load a `FontFace` for each `local()` candidate with the same overrides (`fontMetrics`). | Each fallback is metric-matched to Hedvig. | `size-adjust:103%` and the ascent/descent overrides are tuned for Georgia (1788 vs 1787 px, a match). The same numbers apply to Times New Roman, which comes out **1628 px (−9%)**. Noto Serif and DejaVu Serif, the fallbacks on Linux/ChromeOS/Android where Georgia is missing, aren't installed here and are untested; DejaVu Serif is known to be wider than Georgia. On those systems the `display=swap` headline can rewrap and shift. | Use one `@font-face` per local font, each with its own `size-adjust` (`'Hedvig Fallback Georgia'`, `'Hedvig Fallback Times'`, …), all listed in `--pf-serif`. Or preload the Hedvig woff2. |
| R3-7 | Low (cosmetic) | index | Form: splits by code point, not grapheme | A note of 400 × `é` (e + U+0301), or flags and ZWJ families longer than 300 characters. | Whole visible characters at every cut. | At the `page`/`ua` boundary and at the mailto cut, a base letter and its combining mark get separated: `ua` starts "note: ́ée". A flag or ZWJ sequence can be cut in half. Nothing crashes. | Use `Intl.Segmenter` (graphemes) in `chars()` when it exists, and fall back to `Array.from`. |
| R3-8 | Low | index | Form: note `maxlength="5000"` | Paste a 6,000-character note. | The visitor is told it's too long, or nothing is cut. | The browser keeps 5,000 characters silently. The "email us the full note" link then carries at most the cut text (and the mailto is capped at 1,800 anyway). This is the same issue as R2-13, which was fixed for email and store only. | Drop `maxlength` and validate with a message, or show a character counter. |

No Critical or High bugs. Nothing found here should block M1 except, arguably, R3-1 (WCAG 2.4.11 at 200% zoom) and R3-2 (the "lose nothing silently" rule).

## Tested and OK

**Forms**
- **Empty and invalid input.** Empty, whitespace-only, a fullwidth `＠`, a space inside the store, an email in the store field, a 255-character email and a 400-character store all get field errors and no request. `aria-invalid` is set and focus goes to the first bad field.
- **Very long input.** Notes of 150–6,000 characters are spread across `page` (≤300) and `ua` (≤300, `note:` prefix). `noteCut` is right at every boundary tested (150, 180, 200, 220, 450, 470, 480, 500). A 5,000-character note keeps the mailto at 1,800 and ends with "[Note shortened…]".
- **Emoji, RTL and CJK.** Every variant listed under R2-1 was tested in both engines. The only data problem is R3-2.
- **Double-submit.** Exactly 1 request (see R2-8). Editing a field mid-send does not change what was sent.
- **Offline.** `setOffline` gives "You look to be offline, so nothing was sent." The values are kept and a mailto is offered. Back online, the retry sends exactly 1 request and succeeds.
- **Failure, then retry.** The first attempt fails (abort) and the second succeeds; 2 requests in total.
- **Timeout.** A 17 s hang gives "The request timed out, so we can't be sure it arrived." after 15 s. The values are kept, the button is restored and focus is on the status.
- **Success and duplicate.** Success shows the email via `textContent`. The duplicate reply gets its own copy, a mailto and "Send another". A blocked sessionStorage or a quota error on `setItem` still gives success with no errors.
- **Injection.** A store of `"><img/src=x/onerror=…>` and a note of `"><svg/onload=…>` on the failure path: the link is fully percent-encoded, and no element or dialog appears.
- **Back, reload and Send another.**
  - Back (`back_forward`), forward then back again, reload, and a fresh visit through the about page's mark (same tab) all show "We already have your request".
  - "Send another" clears the sent state and focuses Email. An empty submit after it is blocked, and a second send succeeds.
  - A simulated bfcache `pageshow{persisted:true}`, even while "Sending…" is up, does not break the state machine.
  - Real bfcache restores did not happen in headless Chromium or WebKit (`persisted` undefined), so bfcache was only simulated.
- **Response shapes.** The mock without an ACAO header still succeeds; Playwright bypasses CORS for fulfilled routes, so this is not proof that CORS works in production.

**Layout**
- **Real copy, all 5 pages.** Tested at 21 widths from 320 to 2560 in both engines: no horizontal scroll, no word broken mid-word, no element outside the viewport and no clipped focusable element. On the index the nav stays 56 px everywhere with fonts loaded or blocked. (The sign-in button reports a 4 px `scrollWidth` excess from its arrow span; nothing visible.)
- **2× text.** Index at 21 widths from 320 to 1920: no page scroll and no off-screen focusable elements. The nav wraps (see R3-1).
- **200% zoom.** 720×450, 640×360 (landscape) and 360×225 (400% desktop) give clean index and sub-pages. At 187×406, "review" in the submit button breaks mid-word, which is acceptable at that width.
- **Dark scheme plus reduced motion, all pages.** There is an explicit navy body background, `scroll-behavior:auto`, no running animations and no console errors or warnings.

**Navigation**
- **Links.** Every link on all 5 pages was checked:
  - index: 20 links; anchors `#main`, `#how-it-works`, `#faq`, `#review` all exist; internal pages return 200.
  - about 4, contact 6, legal 10, signin 3.
  - External `_blank` links all have `noopener`.
  - Activating the hero "#review", then Tab, lands on `rv-email`.
- **Focus order.** Index at 375, 1440 and 187: skip, logo, nav, Sign in, hero CTAs, the 6 FAQ summaries, the form, then the footer. Every stop matches `:focus-visible` and has a ring. Sub-pages: skip, ←, mark, `main`, content. There is no trap.
- **Skip links.** On the index, focus moves to the hero CTA after the skip. On sub-pages focus goes to `MAIN#main` with the ring inside. The FAQ opens with Enter and closes with Space.
- **Overlay.** There is no mobile overlay menu in M1, so the overlay focus-trap check doesn't apply.

**Robustness**
- **JS disabled.** All pages render their H1 at opacity 1 with no sideways scroll. The index shows all 5 CTAs. Native validation applies to the form, which posts `text/plain` to `mailto:` with only the 4 real fields.
- **Slow 3G (CDP: 400 ms RTT, 400 kbps, 4× CPU, 375@2x mobile), scrolling to the bottom.** CLS is 0 on all 5 pages; contact has one 0.0000 shift. LCP is 4.3 s on index, 1.0–1.2 s on about/contact/legal and 3.9 s on signin.

**Release note (not a bug).** `sections/pf-review.js`, `site.css`, `uploads/hero-*.webp` and `uploads/summit-painting-3-{720,1080}.webp` are still **untracked**. The M1 commit must include them, or production loses the form script, all homepage styles and the hero images.
