# html

html-validate with qa/.htmlvalidate.json (extends html-validate:recommended). FAIL on any error.

| page | status | errors | warnings | by rule |
| --- | --- | --- | --- | --- |
| index | FAIL | 4 | 0 | element-name (error)×1, valid-id (error)×1, unique-landmark (error)×1, prefer-native-element (error)×1 |
| about | PASS | 0 | 0 |  |
| contact | PASS | 0 | 0 |  |
| legal | PASS | 0 | 0 |  |
| signin | PASS | 0 | 0 |  |

## index

- error `element-name` L116:2 — <helmet> is not a valid element name
- error `valid-id` L120:15 — element id "__bundler_thumbnail" must begin with a letter
- error `unique-landmark` L754:4 — Landmarks must have a non-empty and unique accessible name (aria-label or aria-labelledby)
- error `prefer-native-element` L812:55 — Prefer to use the native <footer> element
