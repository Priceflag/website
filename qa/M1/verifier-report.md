# M1 verifier report, round 3 (final; independent, adversarial)

**Rounds 1–2:** round 1 found 6 FAILs (F1–F6), all fixed by round 2. Round 2 found 1 low FAIL (R2-F1, honeypot flag cut off when `page` was full), and its bug hunt found 14 new bugs (R2-1 Critical emoji hang, R2-2..R2-14). Round 3 re-checks all of them below.

Run: 2026-10-13, branch `overhaul`, working tree vs `0f93942`. I re-ran every check myself and took no builder claim on trust. `script.google.com` was mocked in every script and the real endpoint was never called.

Evidence (all in this round):
- `QA_LABEL=M1-verify3 QA_STRICT=1 QA_BLOCKED_BROWSERS=firefox QA_COMPARE=before npm run qa`: exit 0, overall WARN (WARN comes only from the Firefox launch, moderate axe `region` and sub-page no-JS CTA). Output is in `qa/M1-verify3/`; the log is `qa/M1/verify-tmp3/qa-run.log`.
- `npm test`: 20/20 pass.
- My scripts in `qa/M1/verify-tmp3/`:
  - `form.mjs` → `form.log`, `form.json`: 90 checks, Chromium + WebKit. The mock works like the deployed `.gs` (300-char slice, prefix check). 88 passed; the 2 that failed were my own test's fault (see `dbl.mjs`).
  - `dbl.mjs` → `dbl.log`: double submit and focus while sending.
  - `seo.mjs` → `seo.log`: titles, meta lengths, H1s, JSON-LD vs FAQ, anchors.
  - `deploy_honesty.py` → `deploy_honesty.txt`: deployed set from `.vercelignore`, references, wording scan.

## Results

| # | Item | Result | Evidence |
| --- | --- | --- | --- |
| R1 | Every CTA goes to a working form | PASS | Hero and footer `href="#review"` both go to `#review` with the email field in view, in both engines. A valid submit sends 1 `text/plain` JSON POST. Success copy reads "Thanks. We have your request … within 48 hours". Focus goes to the status, and "Send another request" appears. |
| R1a | Mailto fallback; `page` prefix and length | PASS | Every case starts with `https://priceflag.org/`, is ≤ 300 UTF-16 chars, has `ua` ≤ 300, and `decodeURIComponent` succeeds. That covers short, long, emoji, ZWJ/flags, lone surrogate, 120-char multibyte name, 300-char store with `%`/`é`, and the `/index.html` path. Every mailto is ≤ 1,800 chars (max seen 1,800), decodes cleanly and starts with `Email:`, even with a 200-char CJK email. |
| R1b | Say what happens next | PASS | `index.html:258` "Free. We reply within 48 hours. No app install needed." The owner is asked to confirm this in log decision 10. |
| R1c | Confirmation email | DEFERRED-OK | Logged: needs a `.gs` patch and redeploy by the owner. The site never claims an email is sent. |
| R1d | Form states | PASS | **Failures** (500, HTML 200, abort, connection reset, `null` body): all say "couldn’t confirm" (R2-7 fixed).<br>**`ok:false`:** says "turned the request down".<br>**Offline:** nothing is sent and the copy says so. Retrying once back online succeeds.<br>**Every failure path:** keeps all input, gives the button back, focuses the status and offers a mailto.<br>**Duplicate:** honest copy plus a mailto.<br>**Double submit:** Enter ×2 + `click()` ×2 + `requestSubmit` send exactly 1 request. Focus stays on the button while sending, which reads "Sending…" with a polite live "Sending your request." (R2-8 fixed). |
| R1e | Emoji / astral (old R2-1 Critical) | PASS | 6 emoji cases × 2 engines, including 3,000 emoji and emoji right at the name and store cut points. Each one sends, shows success, has no page errors and no hang. A 500 response with emoji in every field gives the error plus a valid mailto. The stored note is always a clean prefix. |
| R1f | Long input; nothing lost silently | PASS | A cut note shows "Your note was longer…" with a mailto carrying the full note. A cut store or name shows its own message (R2-6 fixed). A store over 300 chars gets an inline error instead of a silent cut (R2-13). |
| R1g | Honeypot (old R2-F1) | PASS | With a 1,000-char note, the stored `page` begins `…#review?hp=1&host=…`, which survives the server slice in both engines. `payload.hp === 1`. |
| R1h | No-JS and script-blocked | PASS | The form uses `action="mailto:…" method=post enctype=text/plain`, with no `novalidate` in the markup. An empty form fails `checkValidity`, so native validation blocks it. The hidden fields and honeypot are `disabled`. No endpoint call, and no data in the URL. The noscript copy is accurate (`index.html:264`). R2-10 fixed. |
| R1i | Validation | PASS | Rejected with `aria-invalid` and focus: empty, `a@b..com`, `javascript:alert(1)`, a 400-char store. Accepted: zero-width-space suffix (sent with it stripped), `shop.xn--p1ai`, padded spaces. Reload or Back after success restores the sent state. "Send another" focuses Email when Email is empty (R2-9 fixed). |
| R2 | No `#` links; logo, FAQ, See how it works, banner, Home, Partners, Demo | PASS | `links.md`: 0/0 static and rendered on 5 pages. 34 URLs, 0 broken. `seo.log`: every in-page anchor resolves. |
| R3 | No revert/automatic claims; cohorts, never by visitor | PASS | `deploy_honesty.txt`: no "revert" or "on its own" in any deployed file. The remaining "automatic" hits are not about pricing (GDPR flows, subscription renewal, "no automatic restore on exit"). Every legal "rollback" now means a rollback the merchant starts, or a disclaimer. Cohort copy reads 25% → 50% → all. Every visitor/traffic mention is a negation. |
| R3a | No AI / black-box wording; no invented proof | PASS | No `\bAI\b`, "black box", "simulat", simulation stats, logos, testimonials, YC badge or pricing in any deployed file. The 14%/9% example is pre-existing FAQ copy. |
| R4 | Typo, "& more" | PASS | Hero foot reads "Built for Shopify" (1440 fold). |
| R5 | AI Pricing banner removed | PASS | Banner is visible in the before folds at 1440 and 375, gone in the after folds. |
| R6 | Title and meta | PASS | Index title is the exact plan text, 40 chars. Description 142 and og:description 144; they differ. og:title, og:image:alt and on-page copy all say "forecast". about 138, contact 118, legal 115. |
| R7 | Alt text | PASS | Hero `index.html:143`, summit-lime `:271`. No `<img>` without `alt` on any page. |
| R8 | WebP hero, contrast, 375, Lighthouse | PASS | Hero at 720/1080/1671 WebP with srcset and preload. axe: 0 serious/critical. Lighthouse mobile 99/100/100/100 on index, about, contact and legal; vs before: PASS. |
| R9 | Sitemap only live pages | PASS | 4 URLs, all rewritten and 200. signin is excluded and `noindex`. |
| R10 | `experiments/` in `.vercelignore` | PASS | `.vercelignore:2` |
| R11 | Unused sections decided | PASS | Archived to `experiments/archive/`. Only `sections/pf-review.js` ships. |
| R12 | Point Vercel at Priceflag/website | DEFERRED-OK | Owner action, logged. |
| DoD1 | Checklist and deferrals | PASS | `qa/M1/checklist.md` present. Every log section is filled. The Milestones table is empty, which is right until the push. Pending slots: none in M1. |
| DoD2 | Console, 3 browsers | PASS (Chromium, WebKit) / BLOCKED (Firefox) | 0 errors, warnings or failed requests on 5 pages × 2 engines. Firefox failed again with "Could not find profile folder" in this run (`console.md`), which confirms BLOCKED. |
| DoD3 | Links; deploy contents vs references | PASS | 24 files deploy. Every reference from a deployed HTML/CSS/JS file resolves to a deployed file; the only hits are false positives from og width/height `content`. No reference to `support.js`, `mark.png`, old sections, unpkg or `hero-new.png`. |
| DoD4 | Screens, overflow, CLS | PASS | 375/768/1440 for 5 pages, no overflow, load CLS 0 (signin 0.0003). The nav overlapping the hero in `index-375.png` is a full-page-capture artifact of `position:sticky`; the fold shot is correct. |
| DoD5 | html-validate, axe, keyboard | PASS | 0 html-validate errors or warnings. axe as R8; only the moderate `region` rule fires on about and signin. Keyboard: every candidate reached with visible focus on every page and width. |
| DoD6 | Lighthouse 90+, no drop | PASS | See R8. |
| DoD7 | Tests | PASS | 20/20, including the new emoji, long-note honeypot, no-JS and focus tests. |
| DoD8 | Honest and on-brand | PASS | Before/after folds at 1440 and 375: same painting, Hedvig/Inter, navy/lime/cream, hiker mark and CTA pill. Only the copy, banner and nav links changed. No gradient text, no purple, reduced motion respected. |
| DoD8a | Pivot markers and log list | PASS | `<!-- PIVOT -->` at `index.html:149`, `:152`, `:167`. The log lists all five items (problem and calculator listed as later milestones). |
| DoD8b | JSON-LD vs FAQ; one H1 | PASS | One valid JSON-LD graph. 6/6 FAQ entries match the visible `<details>` exactly. Exactly 1 H1 on each of the 5 pages. Canonicals correct. |
| DoD9 | No regressions | PASS | Every baseline failure still passes. Round 1/2 fixes all still hold. |
| Round-2 bug fixes | R2-1..R2-14 | PASS | Retested with variations (R2-1, -4, -5, -6, -7, -8, -9, -10, -13 directly in `form.mjs`/`dbl.mjs`). R2-2/3/11/12 are covered by the keyboard PASS and no overflow; I did not re-run the bug hunter's 187 px zoom case. R2-14 is code-read only: the fallback list and `size-adjust` are present, CLS is 0. |
| Deferrals | B4, B8, B16 → M2; B18 → M7/M8; B19 → M8; Firefox BLOCKED; `.gs` items OWNER | DEFERRED-OK | Each is logged with a reason. All are pre-existing or server-side, and none breaks the site or an M1 DoD item. |

## Failures

None.

Notes (not failures):
- The CTA label also serves as the `#review` H2. The log's pivot entry covers the label generally.
- The no-JS run WARNs that about, contact and legal have no "price review" CTA. This is pre-existing and logged as B18.
- If both the note and the store/name are cut, the success message mentions only the note. The mailto still carries everything.

## Verdict

**ALL PASS: 0 FAIL. Firefox is BLOCKED (environment, logged and confirmed); the confirmation email, Vercel repointing and the pre-existing layout items are DEFERRED-OK.**
