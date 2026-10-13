# nojs

JavaScript disabled, Chromium 1440. OK = visible H1 + visible "price review" CTA + ≥200 chars of visible text. WARN-only unless QA_NOJS_STRICT=1. Fold screenshots: screens/<page>-1440-nojs-fold.png

| page | status | visible text chars | H1 visible | CTA visible |
| --- | --- | --- | --- | --- |
| index | PASS | 2005 | yes | yes |
| about | WARN | 1220 | yes | NO |
| contact | WARN | 458 | yes | NO |
| legal | WARN | 28897 | yes | NO |
| signin | WARN | 287 | yes | NO |
