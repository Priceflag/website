# lighthouse

Mobile emulation + default simulated throttling, 3 run(s)/page (median by performance). FAIL if any category < 90. Reports: lighthouse/<page>.html. Not in the Lighthouse list: signin.

| page | status | perf | a11y | best-practices | seo | LCP | TBT | CLS | error |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| index | FAIL | 74 | 96 | 100 | 100 | 16.2s | 78ms | 0 |  |
| about | FAIL | 88 | 100 | 100 | 100 | 3.3s | 0ms | 0 |  |
| contact | FAIL | 88 | 100 | 100 | 100 | 3.3s | 0ms | 0 |  |
| legal | FAIL | 87 | 95 | 100 | 100 | 3.5s | 0ms | 0 |  |

- index: audits < 0.9: largest-contentful-paint, interactive, color-contrast, label-content-name-mismatch, total-byte-weight, unminified-css, unminified-javascript, forced-reflow-insight, image-delivery-insight, network-dependency-tree-insight, render-blocking-insight
- about: audits < 0.9: first-contentful-paint, largest-contentful-paint, image-delivery-insight, render-blocking-insight
- contact: audits < 0.9: first-contentful-paint, largest-contentful-paint, image-delivery-insight, render-blocking-insight
- legal: audits < 0.9: first-contentful-paint, largest-contentful-paint, color-contrast, image-delivery-insight, render-blocking-insight
