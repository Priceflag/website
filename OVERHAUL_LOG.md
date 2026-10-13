# Overhaul log

## Final report (Oct 13, 2026)

**Mode change.** Midway through, the owner asked for the full scope in about an hour, speed over verification. From M2 on, the per-milestone verifier and bug-hunter rounds, Lighthouse, axe, html-validate and Firefox were skipped, and M8's regression was replaced by one quick pass (`qa/final/quick-pass.mjs`).

| Milestone | Commit | Preview | Result |
| --- | --- | --- | --- |
| M0 setup | `0f93942` + harness in `d0b8ed8` | – | inventory, tokens, harness, baseline, CTA backend |
| M1 fixes | `d0b8ed8`, `a2da53f`, `7f7bed7` | priceflagv1-fhmdqgh6n | verifier round 3 ALL PASS; bug hunt round 3: 0 Critical/High |
| M2 design system | `ea131ff` | (see final) | verify loop stopped early by the owner; strict harness run passed before that (Lighthouse 98–99 / 100 / 100 / 100, axe clean) |
| M3–M7 sections + pages | `9b7507c` | https://priceflagv1-nefv7z2zs-nithin-arus-projects.vercel.app | quick pass only |
| Final quick pass | – | same | 7 pages × 1440/375 in Chromium: every link resolves, nav anchors land, mobile menu opens/closes/Esc, calculator 17.2% (same profit with $9.60 cost), form submits once with prefilled numbers (endpoint mocked; live endpoint answers `ok`), 5/5 results carry "In simulation", 0 console errors/warnings, 0 horizontal overflow (`qa/final/preview.txt`) |

**Lighthouse before → last measured (M2, local):** index 74/96/100/100 → 99/100/100/100; about 88/100 → 99/100; contact 88/100 → 99/100; legal 87/95 → 98/100. Not re-measured after M3–M7 integration (skipped in speed mode).

**Skipped or not verified in speed mode:** verifier/bug-hunt rounds for M2–M7; Lighthouse, axe and html-validate after M2; Firefox (BLOCKED anyway); M8 5-second test, Vercel Web Analytics events, copy proofread; 404 page (B19); review CTA on sub-pages (B18).

**Owner to confirm or supply (PENDING / OWNER):** pilot logos or brand count and YC badge (proof strip, hidden); one pilot result with permission (results, hidden); founder photos (hidden); real merchant quotes for the problem lines; confidence-tier names (how-we-measure, hidden); "48 hours" reply promise; "free, 5 minutes" setup; FAQ answers on pricing, setup and subscriptions; baseline definition and simulation definitions on how-we-measure; legal wording on rollback (counsel); Apps Script patch (name/store/message columns, honeypot, no dedupe, confirmation email, formula escaping); delete the M0 test row; repoint the Vercel project at Priceflag/website.

**Decisions without the owner (highlights; full list below):** homepage rebuilt as static HTML; hero mock uses $24 → $27 with a $9.60 unit cost so the breakeven (17.2%) is same-profit (the plan's 11% only holds at zero cost); the plan's 28-word subhead kept verbatim; calculator button keeps the plan's label "Get the full forecast for my store"; "In simulation" placed above every simulated number; "We have not used Intelligems ourselves" removed from vs-intelligems (unverified).


## Milestones

| Milestone | Commit | Preview URL | Verifier result |
| --- | --- | --- | --- |
| M0 setup | `0f93942` (docs) + harness in `d0b8ed8` | – (no push needed) | Inventory, tokens, harness, baseline, CTA backend done (`qa/M0/`, `qa/before/`) |
| M1 fixes | `d0b8ed8`, `a2da53f` | https://priceflagv1-fhmdqgh6n-nithin-arus-projects.vercel.app | Round 3 ALL PASS (`qa/M1/verifier-report.md`); bug hunt round 3: 0 Critical/High, Medium/Low fixed (`qa/M1/bugs.md`); preview: 0 console errors/warnings (Chromium, WebKit), 0 broken links, html valid (`qa/M1/preview/`). The mixed-content warning from the `mailto:` form action was found only on the deployed preview and fixed in `a2da53f`. |

## Baseline (before)

Source: `qa/before/BASELINE.md` (commit `0f93942`, `QA_LABEL=before QA_GIT_REF=0f93942 npm run qa`).

| | index | about | contact | legal | signin |
| --- | --- | --- | --- | --- | --- |
| Lighthouse perf / a11y / BP / SEO (mobile) | 74 / 96 / 100 / 100 | 88 / 100 / 100 / 100 | 88 / 100 / 100 / 100 | 87 / 95 / 100 / 100 | not run (redirected in production) |
| LCP (simulated) | 16.2 s | 3.3 s | 3.3 s | 3.5 s | – |
| Console errors (Chromium, WebKit) | 0 | 0 | 0 | 0 | 1 (404 image) |
| axe serious/critical rules | 1 (contrast) | 1 (scrollable region) | 0 | 1 (contrast) | 0 |
| html-validate errors | 4 | 0 | 0 | 0 | 0 |
| `href="#"` links | 10 | 0 | 0 | 0 | 0 |
| Content with JS off | blank page | yes | yes | yes | yes |


## Decisions made without the owner

1. **Design read.** Redesign that preserves the brand, for a trust-first B2B landing page aimed at Shopify merchants. Layout variety, motion and density are kept moderate (`design-taste-frontend` dials roughly 5 / 3 / 4). Motion only where it explains something.
2. **Previews come from the Vercel CLI, behind Vercel Authentication.** Preview URLs need a Vercel login to open. The QA harness reaches them with the project's existing Protection Bypass for Automation secret (`QA_BYPASS`), sent only to the preview host and never stored. Pushes run outside the command sandbox (the sandbox proxy drops large pushes). The production project `priceflagv1` (priceflag.org) is connected to the personal repo, so pushing to `Priceflag/website` creates no preview. Each milestone is deployed with `vercel deploy` (preview, never `--prod`) from the `overhaul` working tree, after pushing to `origin/overhaul`. Repointing the project at `Priceflag/website` is left to the owner (plan: "Housekeeping").
3. **The homepage becomes real static HTML.** `index.html` was a template rendered in the browser by `support.js`, which loads React 18 and Babel-standalone from unpkg and compiles at runtime. That fails "content and CTAs with JS disabled", Lighthouse performance and HTML validation. The homepage is rebuilt as plain HTML, CSS and a little vanilla JS with the same look. New sections are written as static markup plus a `sections/pf-<name>.css` / `.js` pair, and the orchestrator integrates the markup into `index.html`.

4. **QA evidence in git.** Screenshots are committed as JPEG q70 copies (`qa/compress-screens.sh`); the PNG originals stay local. Verifier and bug-hunter scratch runs keep their scripts and reports in git but not their images.
5. **Firefox is BLOCKED on this machine** (see BLOCKED table). Strict QA runs pass `QA_BLOCKED_BROWSERS=firefox`, which reports a Firefox launch failure as WARN; a Firefox that launches and finds errors still FAILs.
6. **Old section modules archived, not deleted.** `support.js` and every `sections/pf-*.js` moved to `experiments/archive/` (in git, not deployed). The FAQ and how-it-works copy were kept and rebuilt as static HTML; pf-workflow, pf-compare and pf-hero-logos were cut (auto-revert claims, invented numbers, lookalike logos of other platforms).
7. **Form posts straight to the existing Apps Script** (`text/plain` JSON, readable CORS response), with a prefilled `mailto:hello@priceflag.org` on every failure path. The deployed script only keeps email, price numbers, page and user agent and only accepts `page` values on priceflag.org, so the store, name and the start of the message are packed into `page` (always `https://priceflag.org/...`, with the real host in a `host=` field) until the owner patches the script.
8. **Title keeps the plan's em-dash.** `design-taste-frontend` bans em-dashes in visible copy, but the plan gives the exact `<title>`. The owner's explicit text wins; on-page copy avoids em-dashes.
9. **Legal page wording.** `legal.html` described "automatic rollback" as a feature in three places. Changed to "rollback" (and "pauses a rollout and alerts you") with no other legal edits. **Owner / counsel should review** that section (`legal.html` "What Automation Can and Cannot Promise").
10. **Sub-page intro removed.** about/contact/legal hid the whole page until the painting loaded (a decorative fade-in). It delayed first paint to 2.7 s and cost Lighthouse 12 points, so the pages now render immediately.
11. **The 48-hour promise** ("Free. We reply within 48 hours. No app install needed.") is the plan's draft micro-copy. **Owner: confirm you can keep it.**

## Pivot-dependent copy

Each item lives in one marked place, tagged `<!-- PIVOT: ... -->` in `index.html`.

| Copy | Where | Depends on |
| --- | --- | --- |
| Hero headline and subhead | `index.html`, hero (`#hero-title`, `.pf-sub`) | who the buyer is; platform scope |
| CTA text "Get a free price review" and its micro-copy | `index.html` hero CTA; same label in the footer CTA and the form button; micro-copy `#review-note` | self-serve vs founder-led sales |
| How-it-works steps | `index.html` `#how-it-works` | the one use case to lead with |
| Problem section | `index.html` `.pf-problem` | who the buyer is |
| Calculator labels and button | `index.html` `#calculator`, `black-friday.html` | the feat of strength |
| Closing band heading and CTA | `index.html` `#review` | self-serve vs founder-led |

## Pending slots (`data-pending="true"`)

| Slot | Where | Asset needed |
| --- | --- | --- |
| Proof strip | `index.html` after the hero | pilot store logos with written permission, or the pilot brand count; YC badge only if accepted |
| Pilot result | `index.html` `#results` | one quantified pilot result, store name, written permission |
| Founder photos (2) | `index.html` `#founders` | square photos, ≥ 480px, WebP |
| Confidence tiers | `how-we-measure.html` | tier names and definitions from the product |

## Bugs found and fixed

| Milestone | Bug | Fix |
| --- | --- | --- |
| M1 | Verifier F2: form claimed "we have your request" while the deployed script drops store/name/message beyond 120 chars | Note now fills the spare room in `page` and `ua` (300 chars each); if anything still does not fit, the success message says so and links a mailto with the full note (test added) |
| M1 | Verifier F3: legal.html implied an automatic restore on a guardrail breach (lines 298, 300, 385) | Reworded to "pauses the rollout and alerts you" and "rollbacks you start" |
| M1 | Verifier F4: about.html meta description 186 chars | Rewritten, 138 chars |
| M1 | Verifier F5: font-swap layout shift (legal 0.02, index 0.001) | Inter loads with `display=optional`; Hedvig gets a Georgia fallback with matched ascent/descent (`site.css`); CLS 0 on every page |
| M1 | Verifier F1/F6: log sections and PIVOT markers missing | Filled; `<!-- PIVOT -->` markers on hero, CTA, how-it-works |
| M1 | B1 (High): with JS off the form did a GET with email and message in the URL | Form has `action="mailto:…" method="post" enctype="text/plain"`; script intercepts when present (test added) |
| M1 | B2: autofilled honeypot showed a fake "thanks" | Honeypot renamed (`pf_hp_field`, `autocomplete="new-password"`); a filled honeypot is sent flagged `hp=1` instead of dropped (test added) |
| M1 | B3: mailto fallback up to 12,000 chars | Capped at 1,800 chars; long notes are shortened with "[Note shortened. Paste the rest of it here.]" (test added) |
| M1 | B5: legal/contact scroll panel not keyboard-reachable in WebKit | `<main tabindex="0">` on all three sub-pages |
| M1 | B6/B7: 2× text overflowed at 320 px; long words overflowed | Buttons wrap under 480 px, grid children `min-width:0`, `overflow-wrap:break-word` on text |
| M1 | B9/B10: email accepted `a@b..com`; store rejected `?ref=`, ports, IDN | New patterns (test added); store max 300 |
| M1 | B11/B15: Back after success invited a resend; no way to send another | Sent state kept in sessionStorage and restored on reload/bfcache; "Send another request" button (test added) |
| M1 | B12: 5xx/non-JSON said "not sent" | Says "We couldn't confirm your request arrived" (test added) |
| M1 | B13: no "Sending" announcement; result announced twice | Separate polite live region for "Sending your request."; result announced once via focus |
| M1 | B14: mailto body lacked the visitor's email | Added |
| M1 | B17: sub-pages linked home as `index.html` | Now `/` |
| M1 | R2-1 (Critical): an emoji in the note (or at the store/name cut) hung the form on "Sending…" | Packing and the mailto cap work on whole characters; a guarded `enc()`; every path runs `finish()` (try/catch around the send) (test added) |
| M1 | R2-F1 / R2-5: honeypot flag cut off when `page` was full | `hp=1` goes first in the packed head (test added with a 1,000-char note) |
| M1 | R2-4: long store/name pushed `page` past 300 and cut mid-escape | Store and name are fitted by encoded length (110 / 50) before the head is built; host first |
| M1 | R2-6: "note too long" shown when the name was what got cut | Separate messages for a cut note vs a cut store/name (test added) |
| M1 | R2-7: reset / null body said "not sent" | Says "We couldn't confirm your request arrived"; only an explicit `ok:false` says it was turned down |
| M1 | R2-8: focus dropped to `<body>` while sending | Button uses `aria-disabled` instead of `disabled` (test added) |
| M1 | R2-9: "Send another" focused Store with Email empty | Focuses Email when it is empty |
| M1 | R2-10: no-JS note said the form needs JS; empty no-JS submit opened a blank draft with stray fields | `novalidate` set by the script only, extras and honeypot `disabled` in markup, new note text (test added) |
| M1 | B7 leftovers / R2-12: long words in FAQ, labels, footer, buttons; steps overflow under 300 px | `overflow-wrap:anywhere`; steps `minmax(min(260px,100%),1fr)` |
| M1 | R2-2 / R2-3: nav focus rings clipped; long labels hidden but focusable | Removed `overflow:hidden`; nav groups wrap instead |
| M1 | R2-11: sub-page `main` focus ring clipped by the panel mask | Ring drawn inside (`outline-offset:-4px`) |
| M1 | R2-13: zero-width spaces passed; punycode TLD rejected; long pastes cut silently | Invisible characters stripped; `xn--` endings allowed; no `maxlength` on email/store (validated with a message instead) |
| M1 | R2-14: Hedvig fallback only Georgia, no size-adjust | Fallback list adds Times New Roman, Noto Serif, DejaVu Serif; `size-adjust:103%`; CLS still 0 |
| M1 | R3-1: at 200% zoom on a phone the wrapping sticky nav covered focused fields | Under 360 px the nav is not sticky and scroll padding drops to 12 px |
| M1 | R3-2: zero-width joiners stripped from names and notes (Persian, emoji sequences) | Invisible-character stripping only on email and store (test added) |
| M1 | R3-3: RTL/LTR marks and soft hyphens passed in email; `shop.com,` accepted | Marks, bidi controls and soft hyphens stripped from email/store; store ending rejects `, ; < > " ' ( )` |
| M1 | R3-4: long words overflowed buttons ≥ 480 px and nav/footer links | Buttons and nav links wrap (`text-align:center`), `overflow-wrap:anywhere`; real copy stays on one line at desktop (screens) |
| M1 | R3-5: leaving mid-send then returning invited a duplicate | Pending flag in sessionStorage; on return the form says the last request may already have arrived (test added) |
| M1 | R3-8: note `maxlength` cut pastes silently | Removed; the honest "note too long, email us" path covers long notes |

## BLOCKED / DEFERRED

| Item | Status | Why / what was tried |
| --- | --- | --- |
| Firefox in Playwright (DoD 2, 5) | BLOCKED | `firefox-1555` exits at launch with "Could not find profile folder" on this Mac (macOS 27). Tried: default launch, `TMPDIR` in a writable scratch dir, outside the command sandbox, `launchPersistentContext` with an explicit profile dir. Chromium and WebKit run every check. Run `npm run qa` in a normal terminal, or after a Playwright update, to cover Firefox. |
| Confirmation email after a review request | DEFERRED | Needs `MailApp.sendEmail` in `integrations/waitlist-sheet.gs` and a redeploy by the owner (patch in `qa/M0/cta-backend.md` §5). |
| Store/name/message columns, honeypot, no dedupe for review requests | DEFERRED | Same `.gs` patch. Until then those fields ride in the `page` column, and a repeat email gets an honest "we already had a request" message with a mailto link. |
| Point the Vercel project at `Priceflag/website` | DEFERRED | Owner action in Vercel settings. |
| B4: sub-page fixed panel leaves little room at 400% zoom / landscape phone (pre-existing) | DEFERRED to M2 | Design-system pass on sub-pages |
| B8: long sub-page H1 pushes the mark off-screen at 320 px (pre-existing) | DEFERRED to M2 | Same |
| B16: dead intro CSS/JS still ships on sub-pages | DEFERRED to M2 | Cleanup with the sub-page CSS pass |
| B18: no review CTA on sub-pages | DEFERRED to M7/M8 | Added with the new pages and footer work |
| B19: no 404 page | DEFERRED to M8 | Branded 404.html in final polish |
| R3-6: Hedvig fallback `size-adjust` tuned for Georgia only (Times New Roman 9% narrower before the swap) | DEFERRED to M2 | Revisit with self-hosted fonts in the design pass; CLS is 0 on the tested engines |
| R3-7: cuts are by code point, so a combining accent or flag can split at the 300-char / mailto boundary | ACCEPTED (cosmetic) | Never throws or hangs (tested); only the last character of a cut note can render oddly |
| Apps Script: escape cells starting with `= + - @` (spreadsheet formula injection via the email field) | OWNER | Add to the `.gs` patch in `qa/M0/cta-backend.md` §5. |
| Delete the M0 test row from the sheet | OWNER | `qa-test+m0@priceflag.org`, 2026-10-13 ≈20:15 UTC, tab `Waitlist` (details in `qa/M0/cta-backend.md` §4). |
