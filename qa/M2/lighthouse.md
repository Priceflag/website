# lighthouse

Mobile emulation + default simulated throttling, 3 run(s)/page (median by performance). FAIL if any category < 90. Reports: lighthouse/<page>.html. Not in the Lighthouse list: signin.

| page | status | perf | a11y | best-practices | seo | LCP | TBT | CLS | error |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| index | PASS | 99 | 100 | 100 | 100 | 2.0s | 0ms | 0 |  |
| about | PASS | 99 | 100 | 100 | 100 | 1.8s | 0ms | 0 |  |
| contact | PASS | 99 | 100 | 100 | 100 | 1.8s | 0ms | 0 |  |
| legal | PASS | 98 | 100 | 100 | 100 | 2.0s | 0ms | 0 |  |

- index: audits < 0.9: mainthread-work-breakdown, bootup-time, image-delivery-insight, network-dependency-tree-insight, render-blocking-insight
- about: audits < 0.9: image-delivery-insight, network-dependency-tree-insight, render-blocking-insight
- contact: audits < 0.9: image-delivery-insight, network-dependency-tree-insight, render-blocking-insight
- legal: audits < 0.9: image-delivery-insight, network-dependency-tree-insight, render-blocking-insight
