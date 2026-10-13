You are overhauling the Priceflag marketing site (priceflag.org) in this repo, `Priceflag/website`.

How to work:
- Move fast and use subagents.
- Push after every major milestone.
- **Never call a milestone done until it has passed the Verify Loop below.** Its evidence must be saved.
- Don't stop to ask me questions unless you're truly blocked. Make a reasonable call, note it in `OVERHAUL_LOG.md`, and keep going.

## Inputs
- **The plan:** `docs/OVERHAUL_PLAN.md`.
  - It covers the YC research, the audit of today's site, the new page structure with draft copy, the fixes list and the rollout.
  - It is the source of truth for *what* to change. Read it fully before doing anything.
- **Product facts:** use only what the plan and this prompt state. Never invent numbers, logos, testimonials, customer names or features.
- **Skills:** load and follow my design skills before touching any UI: `apple-design` and `design-taste-frontend`.
  - If the names differ slightly, run `/skills` and use the matching ones.
  - Also use the `cro`, `copywriting` and `seo-audit` skills where they apply.
- **The stack:** a static site, deployed on Vercel. Keep it static. Don't introduce a framework or a build step.
  - Pages: `index.html`, `about.html`, `contact.html`, `legal.html`, `signin.html`.
  - Section components live in `sections/pf-*.js`, alongside `support.js`.
  - Images are at the root and in `uploads/`.
  - Config: `vercel.json`, `.vercelignore`.
  - Dev-only tooling (Playwright, test runners, validators) is fine under `qa/` and `package.json` devDependencies, as long as none of it ships to production.

## Design rules
1. **Keep our design scheme.** Before changing anything, a subagent extracts the current brand into `DESIGN_TOKENS.md`. That file is the contract: same palette, same typefaces, same mark, same overall feel. It records:
   - colors (hex)
   - fonts and weights
   - type scale and spacing
   - radii and shadows
   - logo/mark usage
   - the illustration/painting style (the summit artwork)
2. **Fix only what breaks the skills.** Audit every page and section against `apple-design` and `design-taste-frontend`, and change only what violates them:
   - typographic hierarchy, spacing rhythm and alignment
   - contrast, motion and density
   - component consistency and responsive behaviour
   - anything that reads as generic "AI slop": purple glows, pill clutter, gradient text, decorative motion
3. **YC landing-page rules from the plan.** These win any conflict with decoration:
   - At most three type sizes per section.
   - One primary CTA, repeated; no competing equal-weight buttons.
   - Screenshots cropped and readable at mobile width.
   - No scroll-jacking and no auto-advancing carousels.
   - Motion only where it explains something, such as rollout stages advancing. Respect `prefers-reduced-motion`.
4. **Accessibility and performance:**
   - WCAG AA contrast and visible focus states.
   - Real alt text and semantic headings, with one H1 per page.
   - Working layout at 375, 768 and 1440 px.
   - Lighthouse mobile 90+ for performance, accessibility, best practices and SEO.
   - Images in WebP/AVIF, sized correctly, lazy-loaded below the fold.

## Honesty guardrails (non-negotiable)
- **Rollouts:** price changes roll out by SKU cohort and time: 25% of selected SKUs, then 50%, then all. Never by visitor or traffic. Every shopper always sees the same price.
- **Guardrails:** in the beta, a tripped guardrail pauses the rollout and alerts. It does not roll back automatically. Remove every "reverts automatically" or "reverts on its own" claim, including in the meta tags.
- **Forecasts:** they are ranges with a breakeven. No "AI pricing" black-box language.
- **Simulation numbers:** may appear only labeled "in simulation" and linked to "How we measure":
  - 93% of forecast ranges contained the outcome
  - 4.7-point median miss
  - 82% of demand shocks caught, median day 6
  - 7% false pauses
  - 100% of prices restored after rollback
- **Missing real assets:** no logos, testimonials, pilot results, YC badge, founder photos or pricing until real assets exist.
  - Build the slot, but hide it from production with `data-pending="true"` and a `display:none` rule.
  - Add a `<!-- PENDING: what's needed -->` comment and an entry in `OVERHAUL_LOG.md`.
- **Pivot-dependent copy:** the company is weighing pivots. Keep each of these in one clearly marked place, and list them all in `OVERHAUL_LOG.md` under "Pivot-dependent copy":
  - hero headline and subhead
  - problem section
  - how-it-works steps
  - calculator labels
  - CTA text

## Definition of Done
A milestone is done only when every item below is true and backed by saved evidence in `qa/M<n>/`.

1. **Complete.** Every item the plan and this prompt list for that milestone is implemented.
   - Make an explicit checklist in `qa/M<n>/checklist.md`, one line per requirement, each marked PASS or FAIL with evidence: a screenshot path, command output, or file and line.
   - Anything deliberately deferred is marked DEFERRED, with the reason, and logged.
2. **Works.** The site serves locally and every page loads with **zero console errors or warnings** in Chromium, WebKit and Firefox (Playwright).
3. **No broken links.**
   - Zero `href="#"` or `href=""` anywhere.
   - Zero internal 404s (crawl every internal link and asset).
   - External links return 2xx/3xx.
4. **Renders.** Screenshots at 375, 768 and 1440 px for every changed page go in `qa/M<n>/screens/`. No horizontal scroll, no overlapping or clipped text, no layout shift on load.
5. **Valid and accessible.**
   - `html-validate` (or the W3C Nu checker) shows no errors.
   - `axe-core` (via `@axe-core/playwright`) shows no serious or critical violations.
   - Keyboard-only navigation reaches every interactive element, in order, with a visible focus ring.
6. **Fast.** Lighthouse mobile scores of 90+ on every changed page, saved to `qa/M<n>/lighthouse.json`. The score must not drop below the previous milestone's.
7. **Tested.** All automated tests pass. These cover the calculator math (once M5 exists) and the form submission (mocked).
8. **Honest and on-brand.** Fresh-eyes review against the honesty guardrails, `DESIGN_TOKENS.md` and the design skills shows no violations.
9. **No regressions.** Every earlier milestone's checks still pass.

## The Verify Loop (run for every milestone, before pushing)
1. **Self-check.** The builder walks the milestone checklist and fixes anything it can see is missing.
2. **Independent verifier.** Spawn a *fresh* verifier subagent with no memory of building the work.
   - Give it only: this prompt, the plan, the milestone's requirement list, and the diff.
   - Its job is adversarial. Assume the work is incomplete or buggy until proven otherwise.
   - It runs every Definition of Done check itself. It does not trust the builder's claims.
   - It fills in `qa/M<n>/verifier-report.md`, marking every requirement PASS or FAIL with evidence.
3. **Bug hunt.** In parallel, spawn a separate bug-hunter subagent to try to break what changed. It logs every bug it finds in `qa/M<n>/bugs.md` with repro steps. It must cover at least:
   - **Forms:**
     - empty and invalid input
     - very long input
     - double-submit
     - offline or endpoint failure, which must show an error and lose nothing silently
     - success state
     - back button after submit
   - **Calculator:**
     - zero, negative, decimal and very large values
     - new price below cost
     - new price equal to the old price
     - non-numeric input
     - pasted values with "$" or ","
     - rounding: money math in integer cents, and displayed percentages consistent with it
   - **Layout:**
     - long words and translated-length text
     - 320 px width and 1920+ px
     - browser zoom at 200%
     - `prefers-reduced-motion` and `prefers-color-scheme: dark` (it must not break, even if there's no dark theme)
   - **Navigation:**
     - every nav, footer and in-page anchor link
     - the mobile menu opens and closes, and closes with Esc
     - focus is trapped correctly in any overlay
   - **Robustness:**
     - the page still shows content and CTAs with JS disabled, or the gap is documented
     - slow-3G throttling, with no content jumping in late
4. **Fix and re-verify.** Fix every FAIL and every bug.
   - Re-run the verifier and the bug hunter on the fixed state.
   - Loop until everything passes.
   - After 3 loops, if something still fails, stop that item. Mark it BLOCKED in `OVERHAUL_LOG.md` with what you tried, and continue only if it doesn't break the site.
5. **Push.** Only after the verifier reports all PASS, commit and push. Record the commit hash, the preview URL, and a one-line verifier summary in `OVERHAUL_LOG.md`.

## Git and deploy workflow
- Create a branch `overhaul`. Every push goes there, which gives a Vercel preview per push.
- Do not push to `main`, and don't merge. I'll review the final preview and merge myself.
- One commit per milestone, with a clear message, e.g. `M3: new hero, proof strip slot, nav (verified)`.
- After each push, open the Vercel preview URL (use the `vercel` CLI or `gh` to find it). Re-run the link check and the console-error check **against the deployed preview**, not just localhost. Local and deployed can differ: routes in `vercel.json`, clean URLs, `.vercelignore`.

## Execution plan (orchestrate with subagents)
- **You are the orchestrator.**
  - Run subagents in parallel wherever their files don't overlap.
  - You alone integrate into `index.html` and make every commit.
  - New sections are built as new files (`sections/pf-<name>.js`, plus CSS in that file or a matching stylesheet) that you wire into `index.html`.
- **Subagent briefs.** Give each builder subagent:
  - its exact requirement list
  - the files it owns
  - the Definition of Done

  It must return its own checklist with evidence. Treat that as a claim, not proof: the verifier still checks it.

### M0: setup (no push needed)
Read the plan and the skills. Then run these subagents in parallel:
- **Inventory.**
  - Map every page, section script, CSS rule location, link and asset.
  - List every `href="#"`.
  - List every unused section: `pf-demo`, `pf-workflow`, `pf-compare`, `pf-waitlist`, `pf-hero-logos`, `pf-globe`, `pf-sim*`, `pf-week`.
- **Design tokens.** Produce `DESIGN_TOKENS.md`.
- **Baseline.**
  - Set up the QA harness under `qa/`: Playwright on 3 browsers, axe, html-validate, a link crawler and Lighthouse.
  - Capture "before" screenshots and scores into `qa/before/`.
  - Save the baseline numbers to `OVERHAUL_LOG.md`.
  - Commit the harness so every later milestone reuses it with one command: `npm run qa`.
- **CTA backend.**
  - Inspect `sections/pf-waitlist.js` and `integrations/waitlist-sheet.gs` to find out whether a working submission endpoint exists.
  - Report how the "Get my free price review" form can submit for real, and test it end to end with a clearly marked test entry.

### M1: fixes (push)
Everything in the plan's "Fixes to ship this week":
- **CTA:** wire every CTA to a working form. If no endpoint works, use a `mailto:` fallback and log it.
- **Dead links:** remove or wire every `#` link.
- **Honesty:** fix the auto-revert claims.
- **Typo:** fix "Works withShopify & more".
- **Banner:** remove the "AI Pricing" banner.
- **Meta:** set the new `<title>`, meta and OG copy.
- **Accessibility:** add alt text.
- **Sitemap:** make sure `sitemap.xml` lists only live pages.
- **Deploy hygiene:** add `experiments/` to `.vercelignore`.

### M2: design system pass (push)
Apply the skill audit across all pages using `DESIGN_TOKENS.md`. Consolidate CSS variables and unify the type scale, spacing, buttons, focus states and motion. No content changes in this milestone.

The verifier compares before and after screenshots side by side. The brand must be recognizably the same.

### M3–M6: new sections
Build these in parallel, one builder subagent per section, each owning its own file. Integrate, verify and push one at a time, in this order:
- **M3: nav and hero.**
  - Product UI mock with real-looking merchant numbers ("$24 → $27 on 12 SKUs. Breakeven: lose up to 11% of orders.").
  - Hidden proof-strip slot.
  - CTA micro-copy.
- **M4: problem, how it works, comparison.**
  - Problem section.
  - A 4-step how-it-works.
  - Comparison block: "Priceflag vs price A/B testing vs changing it all at once".
- **M5: the breakeven calculator** (the plan's "feat of strength").
  - Inputs: current price, new price, unit cost.
  - Output: "You can lose up to X% of orders and still make the same profit."
  - Do the money math in integer cents.
  - Show the answer before asking for an email.
  - The button goes to the review form with the inputs prefilled.
  - Unit tests cover every calculator case in the bug-hunt list.
- **M6: results, founders, FAQ, closing CTA.**
  - Results: the simulation numbers, labeled.
  - Founders: the slot stays hidden until photos exist. The names Nithin Aruswamy and Kabir Koratkar can show.
  - FAQ: the questions from the plan.
  - Closing CTA band.

### M7: new pages (push)
Build these in parallel subagents:
- **`/how-we-measure`:** the 90-day window, the baseline, the confidence tiers, and what "simulated" means.
- **`/vs-intelligems`:** factual only. Same price for every shopper vs per-visitor split testing. Make no claim about Intelligems that you can't source with a link.
- **`/black-friday`:** a "before you discount" breakeven page that reuses the calculator.

Add all three to the nav or footer, to `sitemap.xml`, and to internal links.

### M8: final QA and polish (push)
1. **Full regression run.** Run the whole Verify Loop across the *entire* site, not just the last change:
   - all pages
   - all 3 browsers
   - all 3 widths
   - axe, html-validate, link crawl, Lighthouse
   - the full bug-hunt list
2. **5-second test.** Have a fresh subagent look only at the 1440 px and 375 px hero screenshots. It answers three questions:
   - What is this?
   - Who is it for?
   - What do I click?

   If any answer is wrong or vague, fix the copy or hierarchy and repeat.
3. **Analytics.** Add privacy-friendly analytics (Vercel Web Analytics) with events for CTA clicks, form submits and calculator use. Verify the events fire.
4. **Copy proofread.** Do a final pass on all copy: typos, consistent capitalization, consistent product terms, no double spaces, H1 matches `<title>` intent.

## When you finish
Write a short final report at the top of `OVERHAUL_LOG.md` and print it:
- milestone → commit → preview URL → verifier result
- before/after Lighthouse scores per page
- every bug found and how it was fixed
- anything still BLOCKED or DEFERRED, and why
- every hidden `data-pending` slot and the asset it needs
- the pivot-dependent copy list
- anything you decided without me

Before you write this report, run the full `npm run qa` one last time against the final deployed preview. Paste its summary into the report.
