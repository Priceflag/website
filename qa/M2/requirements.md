# M2 requirements (docs/OVERHAUL_PROMPT.md "M2: design system pass" + "Design rules")

- Apply the skill audit (apple-design, design-taste-frontend) across ALL pages using DESIGN_TOKENS.md.
- Consolidate CSS variables: one shared token file (`tokens.css`) linked by every page; no stray hard-coded colors/sizes/radii/durations where a token exists.
- Unify the type scale (at most three type sizes per section), spacing rhythm, buttons, focus states (one ring per ground) and motion (only explanatory; prefers-reduced-motion respected).
- Fix what violates the skills only: contrast (WCAG AA), focus visibility, density, component consistency, responsive behaviour, AI-slop tells (glows, gradient text, pill clutter, decorative motion, em-dashes in visible copy).
- Deferred M1 bugs to close here: B4 (sub-page panel at 400% zoom / landscape), B8 (long sub-page H1 pushes the mark off-screen at 320px), B16 (dead intro CSS/JS on sub-pages), R3-6 (Hedvig fallback metrics; acceptable if CLS stays 0).
- NO content changes (punctuation-only em-dash replacement and capitalization consistency are allowed).
- The verifier compares before (qa/before/screens, qa/M1/screens) and after (qa/M2/screens) side by side: the brand must be recognizably the same.
- Full Definition of Done; Lighthouse must not drop below M1 (qa/M1/lighthouse.json).
- Out of scope (later milestones, not wired into any page yet; ignore): new files in sections/ other than pf-review.js, how-we-measure.html, qa/sandbox/, qa/briefs/.
