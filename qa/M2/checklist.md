# M2 checklist (builder self-check)

Run: `QA_LABEL=M2 QA_STRICT=1 QA_BLOCKED_BROWSERS=firefox QA_COMPARE=M1 npm run qa` → `qa/M2/summary.md` (overall WARN = Firefox BLOCKED + sub-pages have no review CTA, B18 deferred to M7/M8).

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 1 | One token file linked first by every page | PASS | `tokens.css`; `<link rel="stylesheet" href="tokens.css">` in index, about, contact, legal, signin |
| 2 | Homepage CSS uses tokens only | PASS | `site.css` rewritten; header comment states the per-section type budget |
| 3 | ≤ 3 type sizes per section | PASS | site.css section comments (hero: display/lead/body; how: h2/h3/body; FAQ: h2/lead/body; form: h2/body/small; footer: h2/body/small + logo artwork); sub-pages per the sub-page builder report (no text < 15px) |
| 4 | One focus ring per ground | PASS | tokens `--pf-focus-on-dark/lime/paper`; site.css `:focus-visible`; sub-pages; keyboard check PASS all pages |
| 5 | Contrast AA | PASS | axe 0 serious/critical and 0 moderate on every page (`qa/M2/axe.md`); changed ratios listed in OVERHAUL_LOG.md |
| 6 | Motion only explanatory, reduced-motion respected | PASS | intro/entrance animations removed from sub-pages and signin; only hover/focus transitions on tokens; reduced-motion blocks |
| 7 | No em-dashes in visible copy | PASS | legal (31), contact, signin replaced with punctuation; remaining dashes are `<title>` tags only (owner style) |
| 8 | B4, B8, B16 | PASS | sub-page builder report; screens at 320 and 844×390 in `qa/sandbox/screens/m2-*` |
| 9 | Brand recognizably the same | PASS | compare `qa/M1/screens/*-fold.jpg` vs `qa/M2/screens/*-fold.jpg` |
| 10 | Lighthouse ≥ M1 | PASS | `qa/M2/lighthouse.json` 99/98–99, 100, 100, 100; "Lighthouse vs M1: PASS" |
| 11 | No content changes | PASS | `git diff a2da53f -- '*.html'` shows CSS, punctuation, capitalization ("On duty engineers", "Nithin, cofounder"), `<footer>` landmarks, skip link on signin |
| 12 | R3-6 font fallback | PASS | moved into `tokens.css`; CLS 0.0000 on every page/width (`qa/M2/screens.md`) |
