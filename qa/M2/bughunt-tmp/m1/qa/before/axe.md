# axe

Counts are distinct violated rules (node counts in the details). FAIL on any serious/critical.

| page | width | status | critical | serious | moderate | minor | error |
| --- | --- | --- | --- | --- | --- | --- | --- |
| index | 375 | FAIL | 0 | 1 | 1 | 0 |  |
| index | 1440 | FAIL | 0 | 1 | 1 | 0 |  |
| about | 375 | FAIL | 0 | 1 | 1 | 0 |  |
| about | 1440 | FAIL | 0 | 1 | 1 | 0 |  |
| contact | 375 | WARN | 0 | 0 | 1 | 0 |  |
| contact | 1440 | WARN | 0 | 0 | 1 | 0 |  |
| legal | 375 | FAIL | 0 | 1 | 1 | 0 |  |
| legal | 1440 | FAIL | 0 | 1 | 1 | 0 |  |
| signin | 375 | WARN | 0 | 0 | 1 | 0 |  |
| signin | 1440 | WARN | 0 | 0 | 1 | 0 |  |

## index @ 375

- **serious** `color-contrast` (2 nodes): Elements must meet minimum color contrast ratio thresholds — e.g. `button[data-go="1"] > .pfd-num`
- **moderate** `region` (25 nodes): All page content should be contained by landmarks — e.g. `.pf-tag`

## index @ 1440

- **serious** `color-contrast` (2 nodes): Elements must meet minimum color contrast ratio thresholds — e.g. `button[data-go="1"] > .pfd-num`
- **moderate** `region` (30 nodes): All page content should be contained by landmarks — e.g. `.pf-tag`

## about @ 375

- **serious** `scrollable-region-focusable` (1 nodes): Scrollable region must have keyboard access — e.g. `#main`
- **moderate** `region` (2 nodes): All page content should be contained by landmarks — e.g. `.pf-sheet-top`

## about @ 1440

- **serious** `scrollable-region-focusable` (1 nodes): Scrollable region must have keyboard access — e.g. `#main`
- **moderate** `region` (2 nodes): All page content should be contained by landmarks — e.g. `.pf-sheet-top`

## contact @ 375

- **moderate** `region` (1 nodes): All page content should be contained by landmarks — e.g. `.pf-sheet-top`

## contact @ 1440

- **moderate** `region` (1 nodes): All page content should be contained by landmarks — e.g. `.pf-sheet-top`

## legal @ 375

- **serious** `color-contrast` (2 nodes): Elements must meet minimum color contrast ratio thresholds — e.g. `.pf-meta:nth-child(4)`
- **moderate** `region` (1 nodes): All page content should be contained by landmarks — e.g. `.pf-sheet-top`

## legal @ 1440

- **serious** `color-contrast` (2 nodes): Elements must meet minimum color contrast ratio thresholds — e.g. `.pf-meta:nth-child(4)`
- **moderate** `region` (1 nodes): All page content should be contained by landmarks — e.g. `.pf-sheet-top`

## signin @ 375

- **moderate** `region` (1 nodes): All page content should be contained by landmarks — e.g. `.pf-legal`

## signin @ 1440

- **moderate** `region` (1 nodes): All page content should be contained by landmarks — e.g. `.pf-legal`
