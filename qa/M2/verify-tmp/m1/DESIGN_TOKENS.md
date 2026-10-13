# Priceflag design tokens

The contract for the `overhaul` branch. Everything here is pulled from the site as it ships today. The redesign keeps the palette, typefaces, mark and painted-summit feel. It only changes what breaks accessibility or design-quality rules (section 10).

**Scope audited:** `index.html` and the six modules it loads (`sections/pf-compare.js`, `pf-demo.js`, `pf-workflow.js`, `pf-faq.js`, `pf-waitlist.js`, `pf-hero-logos.js`), plus `about.html`, `contact.html`, `legal.html`, `signin.html`, `mark.svg`, `favicon.svg`, `mark.png`, `og-v7.jpg`, `hero-new.png`, `uploads/summit-lime.webp`, `uploads/summit-painting-3.webp`.

**Not audited:**
- `sections/pf-sim.js`, `pf-sim-b.js`, `pf-globe.js`, `pf-week.js` and `pf-waitlist-b.js`. `index.html` doesn't load them (index.html:106-112).
- `uploads/hero2.{jpg,webp}`. Nothing references it, and its pink Mediterranean sunset is off-palette, so don't use it.
- `signin.html` loads `https://priceflag.org/uploads/signin-hero.webp` (signin.html:361), but that file is not in the repo. It is described from the code comments only.

Contrast numbers are WCAG 2.x ratios. They were computed from the sRGB values, with alpha flattened onto the stated background.

---

## 1. Brand summary

Priceflag is a **night climb**. The ground is a deep blue-black field (`#030818`) with a fine fractal-noise grain over it. Headlines are set in a warm, bookish serif (Hedvig Letters Serif) in **cream** (`#f3ecde`). Exactly one idea per headline gets the **neon lime** (`#d8f24b`): the flag, the winning line, the number that matters.

The artwork is a painted mountain at night, in impasto-like knife strokes. A switchback of tiny climbers forms an S, and a lime beam runs up the spine to a flag at the summit, so the two together draw a `$`. A hand-stamped hiker-with-flag silhouette is the mark.

The tone is calm, sure and a little literary. Glass pill buttons carry a soft lime halo. The page ends on a full lime slab with the same summit, duotoned. The sub-pages (About, Contact, Legal) switch to a cream paper "ticket" floating over the painting.

---

## 2. Color

### 2.1 Core palette (proposed tokens)

Counts are literal hex plus `rgb[a]()` occurrences across the 11 in-scope files. They don't include JS constant references (for example `LIME`, `C.NEON`, `C_GREEN`, which is used about 80 times inside `pf-workflow.js`).

| Token | Hex | Role | Where (examples) | Uses (hex / rgba) | Stray variants to fold in |
|---|---|---|---|---|---|
| `--pf-navy-950` | `#030818` | surface: page ground, nav, sections; dark button on paper; scrims | index.html:122-123, 754, 771, 779; pf-faq.js:116; pf-demo.js:89; pf-waitlist.js:440; signin.html:36; about.html:20 (`--ink`) | 20 / 66 | `rgb(0,0,0)` page fade from pf-workflow.js:853-857 (see §10); `#08090a`, `#09090b`, `#0c0d10` (Tailwind zinc card fills, pf-workflow.js:165, 148, 174); `#000` drop shadows |
| `--pf-navy-900` | `#071238` | ink on lime and cream fills; favicon tile; frosted-panel tint | index.html:126, 275, 648; pf-hero-logos.js:198; pf-demo.js:167; favicon.svg; signin.html:188 | 9 / 2 | `#0f1830` (paper headings, about.html:23), `#101a38` (paper CTA hover, about.html:252), `#121a30` (ghost hover, index.html:687) |
| `--pf-navy-800` | `#0d2168` | raised navy: thumbnail ground, field gradient end | index.html:120; pf-compare.js:67; pf-waitlist.js:486 | 3 / 2 | `#18224a` / `#080d22` (demo app glass, pf-demo.js:135), `#141e46` (demo float, pf-demo.js:190), `#0b1a5c` (workflow gradient, pf-workflow.js:115) |
| `--pf-cream` | `#f3ecde` | primary text on dark; light pill fill; logo discs | index.html:124, 663, 783, 800; pf-faq.js:116; pf-hero-logos.js:191; signin.html:37 | 30 / 52 | `#ffffff` used as heading or hover text (signin.html:178 h1, pf-faq.js:184 hover, pf-demo.js:158); `#fafafa`, `#f4f4f5`, `#e4e4e7` (workflow zinc, pf-workflow.js:36, 145, 185); `#e8ebf8`, `#dfe3f5` (demo, pf-demo.js:140, 159); `#f4f7ea` (dark-pill label, index.html:371) |
| `--pf-cream-muted` | `#f3ecde` @ .72 (≈`#b0aca7`) | secondary text on dark | pfw-sub .72 (pf-workflow.js:55); hero sub .84 (index.html:668); signin label .78 (signin.html:198) | (part of cream rgba) | alphas .66, .72, .78, .80, .84, .86 → use .72 for secondary and keep .84 for the hero sub. `#a1a1aa` (pf-workflow.js:37), `#aab3cf`, `#c9cfe8` (pf-demo.js:106, 152) |
| `--pf-cream-subtle` | `#f3ecde` @ .58 (≈`#8e8c8b`) | tertiary text: notes, meta, FAQ answers | pff-lede .62 (pf-faq.js:143); pff-a .66 (pf-faq.js:205); pfl-note .52 (pf-waitlist.js:560); signin note .58 (signin.html:254) | (part of cream rgba) | alphas .52, .55, .58, .62, .66 → .58 is the floor. `#71717a` (pf-workflow.js:38), `#7f89b0`, `#6f7aa3`, `#5f6a92` (pf-demo.js:37, 119, 117), `#8b86a8` (pf-workflow.js:523) |
| `--pf-paper` | `#f7f3ea` | surface: the About/Contact/Legal "ticket" | about.html:21 (`--sheet`); contact.html:21; legal.html:21 | 3 / 0 | none |
| `--pf-paper-ink` | `#0f1830` | headings on paper | about.html:23 (`--head`) | 3 / 18 | fold into `--pf-navy-900` if the redesign allows (15.5:1 vs 15.9:1) |
| `--pf-paper-text` | `#333c52` | body on paper | about.html:22 (`--text`) | 3 / 0 | none |
| `--pf-paper-muted` | `#5d6579` (proposed) | list markers and meta on paper | replaces `#8b93a8` (about.html:198, 204) and `#6b7387` (legal.html:170) | 5 / 0 | both originals fail; see §2.3 |
| `--pf-link-on-paper` | `#3f4fb0` | links and focus ring on paper | about.html:177-179 | 6 / 0 | none |
| `--pf-lime` | `#d8f24b` | accent: primary CTA, title accent, eyebrow, winning line, key number, selection, footer slab | index.html:125-126, 216, 643, 662; pf-compare.js:64; pf-demo.js:37; pf-waitlist.js:528; favicon.svg | 26 / 18 | `#dcf34a` (footer slab, index.html:313, 318; the contrast comments at index.html:314-315 were measured on `#d8f24b`); `#c4ea70` (workflow eyebrow, pf-workflow.js:52-53, 192); `#b9ef6b` (demo "good", pf-demo.js:37) → `--pf-ok` |
| `--pf-lime-ink` | `#0d1f00` | text and rules on lime | index.html:314, 338, 372, 449 | 6 / 9 | `#13200a` (pf-btn label, index.html:216; skip link, about.html:68), `#3d4413` (paper note ink, about.html:222) |
| `--pf-peri` | `#93aaff` | secondary accent: kickers, data bands, links on dark, the "Priceflag acts" legend | pf-faq.js:135; pf-workflow.js:34; pf-compare.js:65; pf-waitlist.js:534, 641 | 8 / 30 | `#8fa0ff` (pf-demo.js:37, 182) |
| `--pf-blue` | `#1d4ed8` | data: fills only, never text or hairlines | pf-compare.js:66; pf-waitlist.js:486 | 3 / 2 | `#1e2ede` (pf-workflow.js:35; demo glow pf-demo.js:136), `#4658ff` (aura, pf-demo.js:102) |
| `--pf-blue-line` | `#597ada` | data: the "Blind A/B" line | pf-compare.js:70 | 1 / 0 | none |

### 2.2 Signal and third-party colors

| Token | Hex | Role | Where | Stray variants |
|---|---|---|---|---|
| `--pf-ok` | `#b9ef6b` (text), `#58c40a` (dot) | positive delta, "verified" | pf-demo.js:37, 161, 186 | `#4ade80` (pf-workflow.js:32), `#58a30a` (pf-demo.js:145, 153), `#16a34a` / `#f0fdf4` (workflow "LIVE" badge, pf-workflow.js:146-147) |
| `--pf-warn` | `#fbbf24` | waits for you | pf-workflow.js:33, 69-73 | none |
| `--pf-bad` | `#ff9d7a` (text), `#ff6a2b` (dot) | error, below range | pf-waitlist.js:510, 600, 645; pf-demo.js:161, 183 | `#ff8a5c` (pf-demo.js:37), `#ff8a78` / `#ffd8d0` (signin.html:269) |
| platform tints | `#5E8E3E` Shopify, `#7F54B3` Woo, `#34313F` BigCommerce, `#F26322` Magento, `#101010` Squarespace, `#635BFF` Stripe | logo marks on cream discs only | pf-hero-logos.js:209-216 | `#95BF47` (rejected: 1.70:1 on lime, index.html:360) |
| *(not brand)* | `#ff5f57`, `#febc2e`, `#28c840` | macOS traffic lights in the demo window | pf-demo.js:143 | drop, or render them as neutral dots |

### 2.3 Contrast audit

Text needs 4.5:1, or 3:1 for large text (24px and up, or 18.66px bold). UI parts and focus rings need 3:1. ✗ marks a failure.

**Dark ground (`#030818`)**

| Pair | Ratio | Use | Verdict |
|---|---|---|---|
| cream `#f3ecde` on navy-950 | **16.98** | all headings, body | ✓ AAA |
| cream on `#071238` / `#0d2168` | 15.50 / 12.45 | | ✓ |
| cream on `#000` (workflow fade) | 17.86 | | ✓ |
| cream @.84 (hero sub, index.html:668) | 11.98 | | ✓ |
| cream @.72 (pfw-sub) | 8.85 | | ✓ |
| cream @.66 (FAQ answer) | 7.49 | | ✓ |
| cream @.62 (FAQ lede, compare sub) | 6.71 | | ✓ |
| cream @.58 (signin note) | 5.97 | | ✓ |
| cream @.55 (waitlist status, pf-waitlist.js:640) | 5.44 | | ✓ |
| cream @.52 (pfl-note, pf-waitlist.js:560) | 5.00 | 13px | ✓ (thin margin; 300 weight) |
| cream @.40 (`$` prefix in fields, pf-waitlist.js:496) | **3.34** | 17-20px | ✗ |
| cream @.38 (signin placeholder, signin.html:207) | **3.13** | 16px | ✗ |
| cream @.34 (chart "0" label, pf-waitlist.js:551) | **2.73** | **9px** | ✗ |
| cream @.30 (email placeholder, pf-waitlist.js:597) | **2.34** | 16px | ✗ |
| cream @.26 (number placeholder, pf-waitlist.js:507) | **2.02** | 19-23px | ✗ |
| lime `#d8f24b` on navy-950 | **15.90** | accent text, eyebrow | ✓ AAA |
| peri `#93aaff` on navy-950 | 8.97 | kicker, links | ✓ |
| peri @.66 (pfl-cap-t, pf-waitlist.js:518) | **4.37** | 11px caps | ✗ |
| peri @.62 (pfl-lab field labels, pf-waitlist.js:480) | **3.95** | 11px caps | ✗ |
| peri @.55 (pfl-rangeLab, pf-waitlist.js:539) | **3.34** | 11px caps | ✗ |
| `#c4ea70` workflow eyebrow | 14.59 | | ✓ (but off-token) |
| `#a1a1aa` workflow legend | 7.79 | | ✓ (off-token) |
| `#71717a` workflow SVG labels on `#08090a` / `#0c0d10` | **4.12 / 4.02** | 12px mono, scaled down | ✗ |
| `#aab3cf` demo copy | 9.56 | | ✓ |
| `#6f7aa3` demo inactive step heading (pf-demo.js:119) | 4.74 | 20-26px | ✓ |
| `#5f6a92` demo step number (pf-demo.js:117) | **3.77** | 11px mono | ✗ |
| `#7f89b0` demo MUTED in app glass `#18224a` | **4.47** | 9.5-12px, then scaled down | ✗ |
| `#597ada` compare A/B line | 4.96 | 1.4px line | ✓ (UI) |
| `#1d4ed8` / `#1e2ede` on navy | **2.98 / 2.38** | | ✗ as text or line; fills only |
| `#ff9d7a` error text | 9.85 | | ✓ |

**Buttons and lime**

| Pair | Ratio | Use | Verdict |
|---|---|---|---|
| `#13200a` on lime (`.pf-btn`) | **13.50** | primary CTA label | ✓ AAA |
| `#071238` on lime (tag, selection, demo button) | 14.51 | | ✓ |
| `#071238` on cream (`.pf-btn--light`) | 15.50 | Sign In | ✓ |
| `#f4f7ea` on `#0d1f00` (`.pf-btn--dark`) | 15.94 | footer CTA | ✓ |
| lime-ink `#0d1f00` on `#dcf34a` | 13.98 | footer text | ✓ |
| lime-ink on darkest painting tone `#a7ba2b` (summit-lime) | 8.00 | | ✓ |
| lime-ink @.68 on `#dcf34a` (`--pf-ink-soft`) | 5.42 | footer legal bar | ✓ on flat lime… |
| lime-ink @.68 on painting `#a7ba2b` | **4.06** | the legal bar sits on the full-opacity art (index.html:325-327) | ✗ |
| lime `#d8f24b` on paper `#f7f3ea` | **1.13** | | never set lime text on paper |

**Paper ground (`#f7f3ea`)**

| Pair | Ratio | Use | Verdict |
|---|---|---|---|
| `#0f1830` on paper | 15.89 | headings | ✓ |
| `#333c52` on paper | 9.93 | body | ✓ |
| `#3f4fb0` on paper | 6.41 | links, focus ring | ✓ |
| `#3d4413` on lime-tint note / `.pf-fill` | 9.06 / 8.59 | | ✓ |
| `#6b7387` on paper (legal meta, legal.html:170) | **4.28** | 13.5px | ✗ → use `#5d6579` (5.26) |
| `#8b93a8` on paper (list numbers, about.html:198) | **2.77** | 15.5px 600 | ✗ → use `#5d6579` |

**Over the paintings**

| Pair | Ratio | Use | Verdict |
|---|---|---|---|
| cream on hero sky average `#021331` | 15.67 | | ✓ |
| cream @.84 on the hero wash | 11.92 | | ✓ |
| cream on the hero's brightest snow `#6c9fbd` | **2.44** | | ✗ if copy ever drifts right of ~45% width, so keep the wash |
| cream @.58 on signin legal line (bottom scrim over warm snow) | 4.66 | depends on the photo | borderline |

**UI boundaries and focus rings (3:1)**

| Pair | Ratio | Use | Verdict |
|---|---|---|---|
| `rgba(147,170,255,.24)` waitlist field border (pf-waitlist.js:485) | **1.52** | | ✗ |
| `rgba(147,170,255,.26)` email border (pf-waitlist.js:591) | **1.59** | | ✗ |
| `rgba(243,236,222,.20)` signin input border (signin.html:202) | **1.66** | | ✗ |
| `rgba(243,236,222,.26)` ghost-button ring (index.html:680) | **2.02** | the label carries it, but the button edge is lost on the painting | ✗ |
| cream @.55 FAQ plus icon | 5.44 | | ✓ |
| white @.85 focus ring | 14.27 | | ✓ |
| lime @.85 focus ring | 11.45 | | ✓ |
| peri @.85 focus ring | 6.67 | | ✓ |
| lime @.14 signin focus halo (signin.html:212) | **1.33** | decorative; the border change to lime @.66 (7.05) carries focus | ✓ via border |

**Platform logos on cream discs (3:1)**

| Logo | Ratio | Verdict |
|---|---|---|
| Shopify `#5E8E3E` | 3.30 | ✓ |
| Woo | 4.67 | ✓ |
| BigCommerce | 10.78 | ✓ |
| Magento `#F26322` | **2.71** | ✗ |
| Squarespace | 16.19 | ✓ |
| Stripe | 4.00 | ✓ |

**Fixes that keep the look:**
- **Field labels and caps:** solid `--pf-peri` (8.97), or peri @.80 (6.01).
- **Placeholders:** cream @.55 (5.44).
- **Field borders:** `rgba(243,236,222,.45)` (3.98) or peri @.55 (3.34).
- **Muted mono labels:** `--pf-cream-subtle` (5.97).
- **Paper meta and list markers:** `#5d6579` (5.26).
- **Footer legal bar:** lime-ink @.78 (5.16:1 on the olive art), or solid `--pf-lime-ink`.

---

## 3. Typography

### 3.1 Families and loading

| Role | Stack | Verified |
|---|---|---|
| Display / serif | `'Hedvig Letters Serif', Georgia, Cambria, 'Times New Roman', serif` | ✓. All headings, the wordmark, FAQ questions, demo step titles, the paper-page CTA. Weight **400 only**: the family ships one weight, set with `opsz@12..24`. `pf-waitlist.js:457, 585, 650` uses a shorter fallback (`Georgia,serif`). |
| Body / UI sans | `'Inter', system-ui, 'Helvetica Neue', Arial, sans-serif` | ✓. Body, buttons, labels, numbers. `.impeccable/config.json` records Inter as intentional. Workflow and demo add `-apple-system` (pf-workflow.js:22, pf-demo.js:32). |
| Mono (third family) | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` | System font, not loaded. Workflow eyebrow and SVG labels (pf-workflow.js:23, 52), demo step numbers (pf-demo.js:117). |

Loading: one Google Fonts request, `family=Hedvig+Letters+Serif:opsz@12..24&family=Inter:wght@300..700&display=swap`. It appears at index.html:31 and **again** at index.html:119 inside `<helmet>` (duplicate), at about/contact/legal.html:17 and at signin.html:22. Preconnects are at index.html:28-29 (also duplicated at 117-118).

Weights in use:
- **Inter 300:** FAQ lede and answers, waitlist notes, status (6 rules).
- **Inter 400:** body.
- **Inter 500:** labels, numbers, the waitlist figure (8 rules, plus 2 SVG).
- **Inter 600:** buttons, tag, bold lead-ins (30 rules, plus 8 SVG).
- **Inter 700:** demo button, paper note label, contact `.pf-strong` (5 rules).
- **Hedvig 400** everywhere.

Numbers use `font-variant-numeric: tabular-nums` in the waitlist.

### 3.2 Current sizes (every distinct value)

Marketing page (`index.html` and the modules):

| Size | Where |
|---|---|
| `clamp(46px,5.1vw,92px)`; mobile `clamp(38px,11vw,56px)`; short `clamp(32px,5vw,52px)` | hero H1 `.pf-title` (index.html:658, 709, 721) |
| `clamp(34px,3.8vw,56px)`; ≤479px `clamp(26px,7.6vw,34px)` | statement (index.html:800, 737) |
| `clamp(34px,4.2vw,56px)` | `.pfw-title` (pf-workflow.js:54) |
| `clamp(34px,3.6vw,52px)` | `.pfc-title` (pf-compare.js:300) |
| `clamp(30px,4vw,52px)` | `.pff-head` (pf-faq.js:138) |
| `clamp(30px,5vw,56px)`; landscape `clamp(24px,3.4vw,34px)` | `.pfl-head` (pf-waitlist.js:458, 665) |
| `clamp(29px,3.4vw,50px)` | `.pf-foot-head` (index.html:356) |
| `clamp(28px,3vw,42px)` | `.pfd-head` (pf-demo.js:108) |
| `clamp(38px,7vw,68px)`; landscape `clamp(30px,4.6vw,44px)` | `.pfl-hero` figure, Inter 500 (pf-waitlist.js:527, 666) |
| `clamp(22px,2.8vw,30px)`, `clamp(22px,3vw,31px)` | `.pfl-askLab`, `.pfl-doneH` (pf-waitlist.js:584, 652) |
| `clamp(20px,1.9vw,26px)`; ≤980px `clamp(18px,4.6vw,22px)` | `.pfd-h` (pf-demo.js:119, 211) |
| `clamp(19px,2.3vw,23px)` | `.pfl-num` inputs (pf-waitlist.js:502) |
| `clamp(19px,1.5vw,22px)`; nav `22px` | footer lockup (index.html:351); nav mark (index.html:756) |
| `clamp(17px,1.7vw,21px)` | `.pff-q-text` (pf-faq.js:181) |
| `clamp(17px,2vw,20px)` | `.pfl-cur` (pf-waitlist.js:495) |
| `clamp(16px,1.35vw,20px)`; mobile `16px`; short `15px` | hero sub (index.html:667, 710, 722) |
| `clamp(16px,1.3vw,19px)` | `.pfw-sub` (pf-workflow.js:55) |
| `clamp(16px,2vw,19px)` | `.pfl-oops` (pf-waitlist.js:566) |
| `clamp(15px,1.9vw,19px)` | `.pfl-rangeVal` (pf-waitlist.js:542) |
| `clamp(15px,1.15vw,16.5px)` | `.pff-lede` (pf-faq.js:141) |
| `clamp(14.5px,1.1vw,16.5px)`; ≤980px `13.5px` | `.pfd-p` (pf-demo.js:124, 212) |
| `clamp(14.5px,1.1vw,16px)` | `.pff-a` (pf-faq.js:203) |
| `16px` | `.pf-btn`, `.pfl-send`, `.pfl-email` (index.html:221; pf-waitlist.js:595, 612) |
| `15px` | `.pfc-sub` (pf-compare.js:302); `.pf-foot-link` (index.html:417) |
| `clamp(14px,1.2vw,17px)`; mobile `14px` | `.pf-works` (index.html:697, 712) |
| `14px` | nav team link (index.html:760) |
| `clamp(13px,1.1vw,15px)` | `.pf-eyebrow` (index.html:643) |
| `clamp(13px,1.5vw,16px)` | `.pfl-pct` (pf-waitlist.js:533) |
| `13.5px` | `.pf-foot-bar` (index.html:458); `.pfw-legend` (pf-workflow.js:57) |
| `13px` | nav items (index.html:754-763); `.pf-btn--sm` (276); `.pfl-note`, `.pfl-status` (pf-waitlist.js:559, 639); `.pfd-float` (pf-demo.js:191) |
| `12px` | `.pfd-eyebrow` (pf-demo.js:106) |
| `11.5px` | `.pff-kicker` (pf-faq.js:133) |
| `11px` | `.pf-works-label` (index.html:700); `.pfw-eyebrow` (pf-workflow.js:52); `.pfd-num` (pf-demo.js:117); `.pfl-lab`, `.pfl-cap-t`, `.pfl-rangeLab` (pf-waitlist.js:478, 516, 537) |
| `.8em` (≈10.4-12px) | `.pf-tag` (index.html:649) |
| `9px` | `.pfl-zeroT` (pf-waitlist.js:551) |

Product mock-ups (design px, then scaled to fit, so they render smaller):
- **Demo app** (pf-demo.js:139-191): 24, 19, 16, 13, 12.5, 12, 11.5, 11, 10.5, 10, 9.5px.
- **Workflow SVG** `font-size=` attributes (pf-workflow.js): 16, 15, 14.5, 13.5, 13, 12.5, 12, 11.5, 11, 10, used 3, 1, 5, 1, 8, 15, 26, 8, 16 and 4 times respectively.

Sheet pages (about/contact/legal):
- `clamp(21px,3.4vw,25px)` sheet title (about.html:127)
- `clamp(20px,3vw,23px)` h2 (about.html:184)
- 18px CTA (about.html:248)
- 17px lede and contact `.pf-strong`
- 16.5px body (about.html:37), 16px on mobile
- 15.5px pairs, steps, lists
- 15px cards
- 14.5px note
- 13.5px legal meta
- 11.5px note label
- 0.94em fill

Signin:
- `clamp(38px,6vw,56px)` h1 (signin.html:177)
- 26px sent h2
- 20px wordmark
- 16px input and button
- 14.5px sent p
- 13.5px msg and link button
- 13px eyebrow, label, legal
- 12.5px note

**Tally:** about **55 distinct size declarations**, with half-pixel steps at 9.5, 10.5, 11.5, 12.5, 13.5, 14.5, 15.5 and 16.5. Per section:
- **Hero:** 7 sizes (eyebrow, tag, H1, sub, button, works row, works label).
- **Waitlist:** about 12.
- **Workflow:** 4 in HTML plus 10 in SVG.
- **Demo:** 5 in copy plus 11 in the app.
- **Footer:** 6.
- **FAQ:** 5.

### 3.3 Consolidated scale (keeps the look)

| Step | Token | Value | Family / weight | LH / tracking | Current sizes it absorbs |
|---|---|---|---|---|---|
| Display | `--pf-text-display` | `clamp(40px, 5.1vw, 92px)` | Hedvig 400 | 1.02 / -0.022em | hero H1 (46-92; mobile 38-56; short 32-52) |
| Heading | `--pf-text-h2` | `clamp(32px, 4vw, 54px)` | Hedvig 400 | 1.1 / -0.02em | statement, pfw, pfc, pff, pfl, footer head, pfd head, signin h1 |
| Figure | `--pf-text-figure` | `clamp(40px, 7vw, 68px)` | Inter 500 tabular | 1 / -0.03em | `.pfl-hero`. Counts as the section's Display. |
| Subhead | `--pf-text-h3` | `clamp(20px, 2vw, 26px)` | Hedvig 400 | 1.2 / -0.012em | pfd-h, pff-q, pfl-askLab, pfl-doneH, sheet title, sheet h2, signin sent h2, footer lockup, signin wordmark, pfl-num |
| Lead | `--pf-text-lead` | `clamp(16px, 1.35vw, 19px)` | Inter 400 | 1.55 / -0.005em | hero sub, pfw-sub, pfl-oops, pfl-rangeVal, pfl-cur, sheet lede (17) |
| Body | `--pf-text-body` | `16px` | Inter 400 (300 for long answers is OK) | 1.6 / -0.005em | buttons, inputs, pff-lede, pff-a, pfd-p, pfc-sub (15), footer links (15), sheet body (16.5, 15.5, 15), sent p (14.5) |
| Small | `--pf-text-small` | `14px` | Inter 400/500 | 1.5 / -0.005em | nav (13), team link (14), eyebrow (13-15), works (14-17), foot bar (13.5), legend (13.5), notes and status (13), signin label/note/legal (12.5-13.5), legal meta (13.5), pfl-pct, pfd-float |
| Label | `--pf-text-label` | `12px` caps | Inter 600 | 1 / 0.14em | tag (.8em), works label (11), kickers (11.5), mono eyebrow (11), pfd-num (11), pfl-lab/cap/rangeLab (11), sheet note label (11.5), pfd-eyebrow (12) |
| (exempt) | | fluid SVG | Hedvig 400 | | giant footer wordmark (index.html:446-450) |

Product mock-ups (demo app, workflow diagram) get their own four sizes, measured **after** scaling: `--pf-ui-sm 11px`, `--pf-ui-md 13px`, `--pf-ui-lg 16px`, `--pf-ui-stat 24px`. Nothing renders below 11px. Drop the 9-10.5px values.

**Three-sizes-per-section rule.** Each section picks at most three steps:
- **Hero:** Display + Lead + Body. The eyebrow and tag go to Body, so there is no separate tag size; the works row goes to Body or is dropped.
- **Sections:** usually Label + H2 + Body, or H2 + Lead + Body.
- **Waitlist:** H2 + Figure + Body. Field labels become Body 500 in peri, not 11px caps.

---

## 4. Spacing and layout

**Section vertical padding today:**
- `.pfc-inner`: `clamp(40px,6vh,80px)` top, `clamp(40px,7vh,90px)` bottom (pf-compare.js:287)
- `.pfw-section`: `clamp(90px,10vh,140px)` top, `clamp(100px,12vh,160px)` bottom (pf-workflow.js:49)
- `.pff-wrap`: 48px on mobile, 80px at ≥768×600, 44px in landscape (pf-faq.js:125, 127, 222)
- `.pfl-root`: 44/48px, then 72px, then 34/40px (pf-waitlist.js:443, 447, 450)
- Statement: `clamp(16px,3vh,40px)` / `clamp(32px,6vh,72px)` (index.html:727-728)
- Footer: `clamp(32px,4vw,56px)` (index.html:331)
- Demo: a sticky 100vh stage (pf-demo.js:91)
- Signin main: 96/80px (signin.html:154)

The rhythm is uneven: 40px to 160px with no shared rule.

**Horizontal gutters today:**
- `--pf-gutter: clamp(14px,4.4vw,28px)` (nav, index.html:511)
- hero `clamp(20px,5.6vw,80px)` (index.html:633)
- statement `clamp(20px,5.4vw,64px)` (732)
- compare `clamp(18px,4.4vw,64px)`
- workflow `clamp(20px,5vw,64px)`
- demo `clamp(20px,4vw,56px)`
- FAQ 24px → 40px (18px at ≤359px)
- waitlist `clamp(20px,5vw,72px)`
- footer `clamp(20px,4vw,64px)`
- sheet `clamp(18px,4vw,28px)`

**Content max-widths:**
- 1180px: statement, compare, waitlist (index.html:799; pf-compare.js:286; pf-waitlist.js:452)
- 1200px: FAQ (pf-faq.js:125)
- 1040px / 980px: workflow wrap / stage
- 1360px: demo (pf-demo.js:93)
- 1520px: footer (index.html:330)
- 1400px: signin main
- 500px × max 620px (680px on legal): sheet
- 452px / 436px: signin panel

**Measures:** H1 13em; hero sub 31em; FAQ chrome 640px; lede 46ch; answers 62ch; demo p 40ch; compare sub 30ch; waitlist head 17ch; workflow head 720px.

**Grid gaps:**
- compare `36px 56px`
- FAQ `clamp(28px,4vw,44px)` → `clamp(40px,5vw,64px)`
- demo `clamp(28px,4vw,64px)`
- waitlist `clamp(24px,3.4vw,44px)` → `clamp(36px,5vw,72px)`
- footer `clamp(30px,4vw,72px)`

**Breakpoints in use:**
- Width: 359, 379, 479, 520, 560, 600, 640, 660, 739, 767/768, 880, 900 (the most common), 980, 1100.
- Height: 520, 560, 599/600, 620, 700.
- Other: `pointer:coarse`, `orientation:landscape`.

Compare is container-driven by design (pf-compare.js:289-292), so don't add viewport queries there.

**Proposed:**
- **Spacing scale (4-based):** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128.
- **Section padding:** `--pf-section-y: clamp(64px, 10vh, 128px)`, and `--pf-section-y-tight: clamp(40px, 6vh, 80px)` for the statement and short-landscape views.
- **Gutters:** `--pf-gutter-x: clamp(20px, 5vw, 64px)` for every section. Keep `--pf-gutter` for the nav.
- **Max-widths:** `--pf-max: 1180px` for content, `--pf-max-wide: 1360px` for the demo and footer (pull the footer down from 1520), `--pf-measure: 46ch` for ledes, `--pf-measure-long: 62ch` for answers and legal.
- **Breakpoints:** 360 (tiny), 480 (phone), 768 (tablet), 900 (desktop, already dominant), 1100 (wide). Heights: 560 (short) and 620 (very short).

Z-index in use: page bg -2; sections and footer 2; module roots 1; nav 20; skip link 50; signin layers 2-3; logo shuffle 1-5 (local). Proposed: `--pf-z-bg:-1`, `--pf-z-raised:2`, `--pf-z-nav:20`, `--pf-z-skip:50`.

---

## 5. Radii, shadows and borders

### Radii in use

| Value | Where |
|---|---|
| `999px` / `99px` / `50%` | pills: buttons (index.html:219), email input (pf-waitlist.js:590), demo pills (pf-demo.js:159), scrollbars; circles: dots, discs, demo arrow button |
| `26px 26px 0 0` | footer slab (index.html:320) |
| `24px` (`24px 24px 0 0`, `clamp(18px,5vw,24px)`) | hero card (index.html:600, 772; **overridden to 0 at index.html:625**); signin card (signin.html:58) |
| `20px` | signin form (signin.html:187); workflow `rx=20` |
| `18px` | demo app window (pf-demo.js:134); workflow pills `rx=18` |
| `16px` | demo step item (pf-demo.js:111); workflow `rx=16` |
| `14px` | demo glass floats (pf-demo.js:189); waitlist field well (pf-waitlist.js:484) |
| `12px` | signin input and messages (signin.html:200, 262); workflow cards `rx=12`; favicon tile `rx=12` |
| `11px`, `10px`, `9px`, `8px`, `7px` | demo internals (pf-demo.js:145, 149, 165, 168, 186); sheet card 10 (about.html:210); paper note 8; skip link `0 0 8px 0` |
| `4px`, `3px`, `2px`, `1px` | FAQ button 4; tag 3 (index.html:647); fill and focus 2-3; FAQ bars 1; workflow chips `rx=4/6/8` |
| `0` | paper sheet and its CTA: deliberately square "ticket" corners with 12px punched notches (about.html:75-102, 244) |

That is 24 distinct radii.

**Proposed set:** `--pf-radius-xs 4px` (tags, chips), `--pf-radius-sm 8px` (nested UI rows, small controls), `--pf-radius-md 12px` (inputs, cards, mock-up cards, sheet cards 10 → 12), `--pf-radius-lg 20px` (panels, forms, app window 18 → 20, glass floats 14 → 12 or 20), `--pf-radius-xl 24px` (hero and signin card, footer slab 26 → 24), `--pf-radius-pill 999px`.

**Documented rule:** buttons and single-line inputs are pills. Big surfaces (hero card, footer slab) are 24px. Panels, forms and app windows are 20px. Cards inside them are 12px. Chips and tags are 4px. The paper ticket stays square with 12px notches, since that is its identity.

### Shadows in use

- **Button stack** (index.html:224-229): inset top highlight `rgba(255,255,255,.80)`, inset bottom `rgba(0,0,0,.10)`, contact `0 1px 2px rgba(3,8,24,.45)`, glow `0 8px 22px -10px rgba(lime,.42)`, halo ring `0 0 0 5px rgba(lime,.07)`. Hover grows to 14px/34px and 8px (index.html:251-256). Signin uses a stronger glow, `.60` and 6px (signin.html:225-226).
- **Paper sheet:** `0 40px 90px -34px rgba(3,8,24,.92), 0 2px 10px rgba(3,8,24,.25)` (about.html:81-82).
- **Demo app window:** five layers, including a blue glow `0 70px 120px -40px rgba(30,46,222,.38)` (pf-demo.js:136-137).
- **Glass float:** `0 22px 44px -14px rgba(0,0,0,.7)` (pf-demo.js:192).
- **Signin form:** `0 24px 60px -22px rgba(3,8,24,.9)` (signin.html:193).
- **Logo disc:** `0 0 0 1px rgba(3,8,24,.28), 0 1px 10px rgba(3,8,24,.55)` (pf-hero-logos.js:195).
- **Text shadows on art:** `0 4px 50px rgba(3,8,24,.7)` H1; `0 1px 16px rgba(3,8,24,.8)` sub; `0 2px 30px rgba(3,8,24,.9)` statement (index.html:783, 669, 800).
- **Glows:** see §10.

**Proposed:**
- `--pf-shadow-contact: 0 1px 2px rgba(3,8,24,.45)`
- `--pf-shadow-raised: 0 12px 28px -10px rgba(3,8,24,.55)`
- `--pf-shadow-float: 0 40px 90px -34px rgba(3,8,24,.92)`
- `--pf-inset-highlight: inset 0 1px 0 rgba(255,255,255,.2)`
- `--pf-halo-lime: 0 8px 22px -10px rgba(216,242,75,.42), 0 0 0 5px rgba(216,242,75,.07)`. The primary-CTA halo is brand: `.impeccable/config.json` keeps it by request. It is the only glow allowed.

### Borders in use

- **Cream hairlines** at .08 (hero card top, index.html:626), .12 (FAQ rows, pf-faq.js:162), .13, .14 (demo ring, signin form) and .20 / .26 (inputs, ghost button).
- **White hairlines** at .07-.18 (demo and workflow).
- **Peri** at .24 / .26 / .30 (waitlist).
- **Paper rule** `rgba(15,24,48,.16)`, plus a dashed .28 tear line (about.html:24, 240).
- **Lime rule** `rgba(13,31,0,.20)` (index.html:316).

**Proposed:** `--pf-line-faint: rgba(243,236,222,.08)`, `--pf-line: rgba(243,236,222,.14)` (dividers), `--pf-line-control: rgba(243,236,222,.45)` (3.98:1, for input and ghost-button edges), `--pf-line-paper: rgba(15,24,48,.16)`, `--pf-line-lime: rgba(13,31,0,.20)`.

---

## 6. Buttons and interactive components

**`.pf-btn`** (index.html:215-273): the primary "glass pill".
- **Shape:** lime `#d8f24b`, label `#13200a` in Inter 16/600, -0.01em, padding 15×32px, radius 999.
- **Surface:** a 180° white gloss gradient over the fill. A sheen ring 4px outside (`::before`). A diagonal highlight (`::after`) sweeps across in 1.7s on hover.
- **Hover:** lifts -2px, brightness 1.05, the halo grows, the ring moves out to 7px.
- **Active:** scale .985 and an inset shadow, in 90ms.
- **Focus:** `focus-visible` 2px `rgba(255,255,255,.85)` at offset 5px.
- **Dot:** `.pf-btn-dot` is a 9px currentColor dot at .75 (index.html:270).

**Variants:**
- **`--light`** (index.html:275): cream fill, navy-900 label, neutral glow. Used by the nav's Sign In.
- **`--sm`** (index.html:276): 8×18px, 13px, gap 7. It reaches 44px min-height on touch (index.html:561).
- **`--ghost`** (index.html:677-690): `rgba(3,8,24,.62)`, a 6px backdrop blur, a cream @.26 inset ring and a faint sheen. Hover goes to `rgba(18,26,48,.78)` with the ring at .42. No lift filter.
- **`--dark`** (index.html:370-399): `#0d1f00` with a white gloss and a `#f4f7ea` label, for the lime footer. Focus is a 2px `#0d1f00` ring at offset 5.

**Copies outside index.html:**
- `.pfl-send` (pf-waitlist.js:605-635) is a cream-glass pill with a periwinkle glow. It has its own focus ring (white .85) and a disabled state at .55 opacity.
- `signin.html:216-250` re-implements `.pf-btn` at full width with a stronger glow, plus a `:disabled` state.
- The paper pages use square serif CTAs: `.pf-cta` (18px, full width, navy, about.html:244) and `.pf-say` (15.5px, contact.html:177). Hover goes to `#101a38` with a -1px lift.

**Nav** (index.html:754-765):
- A sticky `#030818` bar on a 3-column grid. The hiker home link is 22px and carries no wordmark text.
- Text links are 13px cream: About, FAQ, Legal, Contact. The centre "Learn more about the team ↗" link is 14px lime.
- The Sign In pill sits on the right.
- Hover turns links lime through the global `a:hover` (index.html:125).
- Hit areas grow with padding and negative margin (index.html:527-528, 559-560). The centre link hides below 739px and Legal below 379px.

**Links:**
- **Dark pages:** cream, no underline; hover lime (index.html:124-125; signin.html:50-51).
- **Hero eyebrow** (index.html:641-654): lime with a .45-lime underline that goes solid on hover, and an arrow that nudges 3px.
- **Footer links:** ink, with an underline that sweeps in by scaleX in .34s (index.html:419-435).
- **Paper:** `#3f4fb0`, underlined at offset 3px; hover goes to the heading ink (about.html:177-178).
- **Waitlist status:** peri, underlined (pf-waitlist.js:641).

**FAQ accordion** (pf-faq.js:170-206):
- A full-width button at least 48px tall. The serif question changes color to `#fff` on hover.
- A plus rotates into a × (250ms). The open icon is lime.
- Rows are separated by cream @.12 rules.
- Focus is a 2px lime @.85 ring at offset 3.

**Demo step list** (pf-demo.js:110-125):
- Rows have a 16px radius and a 3px left bar.
- The active row's bar is lime with a glow; inactive titles are `#6f7aa3`.
- Focus is a 2px lime ring.

**Waitlist fields** (pf-waitlist.js:482-510):
- The field well is 56px tall with a 14px radius and a peri gradient.
- `:focus-within` adds a 2px peri .85 outline.
- The invalid state uses an `#ff9d7a` border.

**Signin email input** (signin.html:199-213): 12px radius. Focus sets `outline:none` and swaps in a lime .66 border plus a 4px lime .14 ring.

**Focus-ring coverage:**
- **Present:**
  - `.pf-btn`, `.pf-btn--dark`
  - footer links
  - FAQ questions
  - demo items
  - waitlist fields, email and send
  - every element on the paper pages (global `:focus-visible` in `#3f4fb0`, about.html:179)
  - the skip link on the paper pages
- **Missing, so the browser default is used:**
  - the index nav text links and the hiker link
  - the hero eyebrow link
  - signin `.pf-note a`, `.pf-legal a` and `.pf-linkbtn`
- **No skip link** on index.html or signin.html.
- **Three different ring colors** (white, lime, peri) for the same job.

---

## 7. Motion

**Easing curves:**

| Curve | Name | Uses | Where |
|---|---|---|---|
| `cubic-bezier(.22,1,.36,1)` | house ease-out, `--pf-ease` | 16 | index.html:137, 230; signin.html:40; about.html:285 |
| `cubic-bezier(.16,1,.3,1)` | "goldsand" ease-out | 10 | pf-faq.js:55; pf-demo.js; pf-workflow.js:28 |
| `cubic-bezier(.25,.9,.3,1)` | button sheen sweep | | |
| `cubic-bezier(.58,.04,.16,1)` | hero zoom | | index.html:138 |
| `cubic-bezier(.65,0,.35,1)` | SVG line draw | | pf-workflow.js:26 |
| `cubic-bezier(.34,1.56,.64,1)` | overshoot "pop" | | pf-workflow.js:27, 65 |
| JS curves | | | `1-(1-t)^2.2` scroll reveal; smoothstep hero dim; cubic in-out for the 900ms nav scroll (index.html:885-887, 1004); ease-out-quart for the compare draw (pf-compare.js:275) |

The second curve is visually the same as the first. Fold it in.

**Durations:**
- 90ms: press
- 200-250ms: color, underline, arrow, FAQ icon
- 340ms: button lift, footer underline
- 450ms: demo screen swap, demo description
- 700ms: FAQ row reveal, demo tilt
- 760 / 620ms: paper-page entrance
- 800-1050ms: hero copy rise, signin rise
- 900ms: nav scroll
- 1150ms + 80ms stagger: compare draw
- 1.2s: demo aura
- 1.7s: sheen
- 2.2s: hero zoom
- 2.4s: intro teardown
- 14.4s: infinite logo shuffle
- up to 5s: workflow choreography delays

**Explanatory motion (keep):**
- compare line draw-in (shows the four outcomes diverge)
- workflow trunk draw and node reveal, which can be shortened
- demo screen change, but tied to clicks rather than scroll
- FAQ open and close
- button press and lift
- footer underline
- nav smooth-scroll

**Decorative motion (cut or reduce):**
- **Hero intro** (index.html:142-189): an 18px blur fade, a 1.11 zoom over 2.2s, and copy that rises in with blur. The CTA lands at 1080ms + 800ms, and the eyebrow lands *after* the CTA, at 1360ms.
- **Scroll-linked blur and fade:** the hero copy (12px blur), the statement and the footer rise 34px with 7px blur (index.html:875-979).
- **Infinite platform-logo shuffle** in the hero (pf-hero-logos.js:194, 222-235). This is an auto-moving carousel.
- **Demo 3D tilt** that follows the pointer, plus drifting aura blobs (pf-demo.js:96-103, 126-130, 398, 430).
- **Pinned scroll-driven demo**: a sticky 100vh stage that steps on scroll (pf-demo.js:91). This is scroll-jacking.
- **Workflow overshoot pops** and hover lifts and glows on SVG groups that do nothing when clicked (pf-workflow.js:64-70).
- **Whole-page background fade** navy → black → navy around the workflow (pf-workflow.js:835-858).
- **The 1.7s sheen sweep** on every pill.

**Reduced motion** is handled broadly:
- index CSS (index.html:280-306, 485-487) and the JS `_reduce` flag (index.html:957-963, 1111)
- FAQ (pf-faq.js:228-234)
- waitlist (pf-waitlist.js:672-676)
- demo `.pfd-still` stacked mode (pf-demo.js:201-206, 354)
- compare (pf-compare.js:428-433, 550)
- workflow JS (pf-workflow.js:710)
- hero logos paused (pf-hero-logos.js:239-240)
- paper pages, which kill all motion (about.html:261-263)
- signin (signin.html:330-334)

**Gaps:**
- The pf-workflow CSS hover transforms have no reduced-motion rule.
- The page background fade still runs.
- `.pf-eyebrow-arrow` and `-link` transitions are not disabled.

---

## 8. Logo and mark

**`mark.svg`** (viewBox `0 0 698 1296`, aspect about 0.54:1, one unfilled path) and **`mark.png`** (512²):
- **Shape:** a climber in profile with a big backpack, mid-stride uphill, gripping a tall pole with a square flag. It reads as a "price flag".
- **Edge:** rough, stamped or linocut ink with speckled texture, not geometric.
- **Use:** always as a **CSS mask** (`.pf-hiker`, index.html:202-210), so it takes `currentColor`.
  - cream on the nav
  - footer ink on lime
  - paper ink on the sheet (about.html:150-157)
  - cream with a drop shadow on signin (signin.html:139-147)
  - lime in the demo sidebar, at 10×17px (pf-demo.js:147)
- **Fallback:** hidden where masks are unsupported; the wordmark alone stands in.

**`favicon.svg`**: a 64×64 tile, `#071238`, radius 12. The mark is lime `#d8f24b`, 25×46px, centred, which leaves about 9px of clear space top and bottom (about 14% of the tile). The mark is about 72% of the tile height.

**Lockup**: hiker + "Priceflag" in Hedvig 400, `-0.01em`, gap `.45em`.
- The hiker is `0.87em × 1.6em` with a -0.3em block margin, so it rises above the cap height.
- Seen in the footer (index.html:348-352, 818), on signin (signin.html:131-147) and in `og-v7.jpg` (lime hiker plus cream wordmark, top-left).

**Giant footer wordmark** (index.html:438-450, 844-846):
- "Priceflag" in Hedvig, set as SVG `<text>` and fit to the measured ink box at 100% of the content width.
- `textLength=3931.02` keeps the fallback width identical.
- Fill `#0d1f00` on the lime slab, `aria-hidden`.

**Colors allowed for the mark:** cream on navy; navy-900 or paper-ink on cream or paper; lime-ink on lime; lime on navy (favicon, og image, demo).

**Observed minimum size:** 16px favicon and a 17px-tall demo glyph. Proposed:
- **Mark:** at least 16px tall in UI, and at least 24px when it stands alone.
- **Lockup:** wordmark at least 16px.

**Clear space:** at least 0.5× the mark's width on every side of the lockup. That matches the .45em gap and the favicon's 14% margin.

**Don't:**
- outline the mark
- recolor it to peri or signal colors
- place it on the busy part of a painting without a wash
- use the nav hiker alone without an accessible name (index.html:756 has one; keep it)

---

## 9. Illustration and painting style

| Asset | What it is | How it's used |
|---|---|---|
| `hero-new.png` (1671×941, 2.7 MB) | **Medium:** digital "oil" or palette-knife impasto with chunky, faceted strokes. **Palette:** deep night blues `#020f27`, `#021941`, `#0b2e64`, `#205391`, highlights `#6c9fbd`, and a lime beam. **Subject:** a snowy peak at night under a starry sky, with a sea of cloud and ridges on the left. A switchback path of about 14 tiny climber silhouettes draws an S, and a glowing lime vertical beam runs up the spine to a lime flag on the summit; together they read as `$`. **Mood:** quiet, ambitious, safe progress. | Full-bleed fixed hero, cropped `right bottom` (`78% 0` on mobile) so the copy sits on the empty left sky. A 90° navy wash: `.78 → .5 → 0` by 58% width (index.html:629); on mobile a vertical wash `.84 / .74 / .55 / .35 / .78` (index.html:707). Grain overlay at .5 (index.html:130, 140). A scroll-driven scrim fades it fully to `#030818` (index.html:945-955). |
| `uploads/summit-painting-3.webp` (1672×941) | The same composition **at dusk**: warm cream-gold lit snow (`#d1b383`) against a navy-black sky (`#010b24`), with a lime beam and flag. A warmer, more painterly brush. | Fixed background behind the paper ticket on About, Contact and Legal, `object-position:center`. A light vertical wash: `.34 / .16 / .20 / .44` (about.html:58-64). |
| `og-v7.jpg` (1200×630) | The dusk painting with the lockup, a two-line H1 (cream + lime) and a one-line sub in Inter. | Social card. |
| `uploads/summit-lime.webp` (1855×848) | A **duotone** of a different summit scene: a lone climber planting a flag on a rocky peak above a sea of cloud. The whole image is mapped to lime (`#dcf24b`) and olive (`#a7ba2b`). | Footer slab art, `object-position:70% 100%`. Masked from 28% opacity at the top to solid by 62% (index.html:325-327). |
| `signin-hero.webp` (not in repo) | Per comments, a dark sunset ridge with a rider and a lit snow plume right of centre. | Two scrims plus grain at .28 (signin.html:90-121). |

**Grain:** an SVG `feTurbulence fractalNoise`, baseFrequency .8, 3 octaves, rect opacity .35, tiled at 200px. Applied at .5 over the hero (index.html:130, 140) and .28 over signin (signin.html:121).

**Rules for new imagery:**
1. **Medium:** painterly, visible brush or knife facets. No photos, 3D renders, flat vector or isometric illustration.
2. **Palette:** a night-blue field (`#010b24`-`#205391`), with optional warm snow or cream light (`#d1b383`-`#f3ecde`). The only saturated hue is **lime**, and it marks the single "Priceflag" element (beam, flag, path). No purple, pink, teal or orange.
3. **Subject:** mountains, ascent, a flag or summit, small human figures in silhouette. Progress is shown as a gradual, safe path. Keep a large calm area of sky or snow for type.
4. **Treatment:** crop so the focal point sits on the right third. Lay a navy wash (from `rgba(3,8,24,.78)`) under any copy until cream text clears 4.5:1. Add grain at .3-.5. Lime-slab contexts use the lime/olive duotone only.
5. **Don't:** add text inside the painting, glow effects beyond the painted beam, or more than one lime focal point per image.
6. **Weight:** ship WebP or AVIF. The 2.7 MB PNG hero (index.html:27, 775) should be re-encoded.

---

## 10. Known violations to fix (input for the M2 design pass)

**Contrast** (details in §2.3)
1. Waitlist field and caption labels are peri at .55-.66, 11px caps: 3.34-4.37 (pf-waitlist.js:480, 518, 539).
2. Placeholders and the `$` prefix are cream at .26-.40: 2.02-3.34 (pf-waitlist.js:496, 507, 597; signin.html:207).
3. The 9px chart "0" label is cream .34: 2.73 (pf-waitlist.js:551).
4. Workflow `#71717a` mono labels: 4.0-4.1 (pf-workflow.js:38, 160, 168). Demo `#5f6a92` step numbers: 3.77 (pf-demo.js:117). Demo `#7f89b0` in-app muted text: 4.47, then shrunk by scaling (pf-demo.js:37).
5. Paper `#8b93a8` list numbers: 2.77 (about.html:198, 204). Legal `#6b7387` meta: 4.28 (legal.html:170).
6. Footer `--pf-ink-soft` on the painted olive: 4.06 (index.html:315, 458).
7. Form and ghost-button boundaries: 1.5-2.0, under the 3:1 needed for UI (pf-waitlist.js:485, 591; signin.html:202; index.html:680).
8. The Magento tint on its cream disc: 2.71 (pf-hero-logos.js:214).

**Focus and keyboard**
9. No custom focus style on the index nav links, the hiker link or the hero eyebrow link (index.html:756-763, 782). The same goes for the signin links and link button (signin.html:253-255, 287-293, 303).
10. Three different focus-ring colors (white, lime, peri). Signin uses `outline:none` (signin.html:210).
11. No skip link on index.html or signin.html.
12. Workflow SVG groups use `cursor:pointer` and hover lifts but do nothing and can't take focus, which is a false affordance (pf-workflow.js:64-70). The legend items also hover-move (pf-workflow.js:58-59).

**Type**
13. About 55 distinct sizes, including half-pixel steps. 5-12 sizes per section against the 3-per-section rule (§3.2).
14. Section H2s use 7 different clamps (§3.2).
15. Five eyebrow and kicker styles: the lime tag pill (index.html:646-650), mono lime caps with a glowing dot (pf-workflow.js:52-53), slate caps with a glowing lime dot (pf-demo.js:106-107), peri caps (pf-faq.js:134-135), and peri field caps (pf-waitlist.js:477-481).
16. A third family (system mono) appears ad hoc.
17. Text renders below 11px: 9px, 9.5px and 10px, plus SVG text at 10-11px drawn on a 980px viewBox and scaled down (pf-waitlist.js:551; pf-demo.js:144-171; pf-workflow.js).
18. Inconsistent capitalization:
    - "Autonomous Guardrails" (pf-workflow.js:717)
    - "On Duty Engineers" (contact.html:298)
    - "Sign In" (index.html:764) vs "Sign in" (signin.html:6)
    - "AI Pricing" tag (index.html:782)
    - everything else is sentence case

**Color and tokens**
19. Foreign neutral families: Tailwind zinc in the workflow (`#71717a`, `#a1a1aa`, `#e4e4e7`, `#f4f4f5`, `#08090a`, `#0c0d10`, `#09090b`, `#fafafa`), periwinkle-slate greys in the demo, and macOS traffic lights (pf-demo.js:143).
20. Near-duplicates:
    - `#dcf34a` vs `#d8f24b`
    - `#c4ea70`
    - `#8fa0ff` vs `#93aaff`
    - `#13200a`, `#0d1f00`, `#3d4413`
    - `#0f1830`, `#101a38`, `#121a30` vs `#071238`
    - `#fff` headings (signin.html:178)
    - three greens and three reds (§2.1-2.2)
21. Token name collisions:
    - `--pf-bg` means "page background" in pf-workflow.js:47 but "button fill" in `.pf-btn` (index.html:216).
    - `--pf-ink` is `#0d1f00` in the footer (index.html:314) but `#030818` on signin (signin.html:36).
22. The page background animates to pure black, `rgb(0,0,0)`, through the workflow and forces `!important` on every section (pf-workflow.js:47-48, 853-857). The ground stops being the brand navy.

**Glows, gradients and pills**
23. Glows beyond the sanctioned CTA halo:
    - glowing dots (pf-workflow.js:53; pf-demo.js:107, 115, 153, 162, 175, 194)
    - blurred lime and blue aura blobs (pf-demo.js:96-102)
    - a blue under-glow on the app window (pf-demo.js:136)
    - drop-shadow glows on hover (pf-workflow.js:65-70)
    - canvas line glow, `shadowBlur 14` (pf-compare.js:630-631)
    - the periwinkle glow on `.pfl-send` (pf-waitlist.js:617, 629)
    - the stronger signin halo (signin.html:225-226, 238-239)
24. No gradient *text* was found; there is no `background-clip:text` anywhere. Keep it that way. Gloss gradients on the pills are part of the button identity.
25. Pill clutter in the hero and nav: tag + eyebrow link + two pills + rotating logo discs + Sign In pill (index.html:764, 782-793). The demo floats glass chips and status pills over the mock-up (pf-demo.js:159-162, 188-199). The workflow adds actor pills, chips and legend rings.

**Motion**
26. Decorative motion: hero blur and zoom intro, with the CTA delayed to about 1.9s (index.html:151-160); scroll-linked blur (index.html:899-979); the infinite logo carousel (pf-hero-logos.js); the pointer-tracking 3D tilt (pf-demo.js:126-130, 430); the pinned scroll-stepped demo (pf-demo.js:91); overshoot pops (pf-workflow.js:27); the 1.7s sheen on every button.
27. Reduced-motion gaps: the workflow CSS hover transforms, the page background fade, and the eyebrow arrow and link transitions.

**Layout and consistency**
28. 24 radii. The hero card is designed as a 24px inset card (index.html:600, 772) but overridden to full-bleed square (index.html:624-627), while signin still claims "the same 24px-radius inset card as the marketing hero" (signin.html:53-59). The footer slab is 26px.
29. Section padding runs from 40px to 160px with no shared rhythm. Seven different gutter clamps. Five content max-widths (§4).
30. Google Fonts and preconnects are loaded twice in index.html (index.html:28-31 and 117-119).
31. `index.html` aims the "Partners" nav target at `.pff-mq` / `.pff-mq-label` (index.html:1072), which pf-faq.js no longer renders, so the footer "Partners" link (index.html:833) falls back to the FAQ.

**Em-dashes in visible copy** (house style: none)
32. Locations:
    - `contact.html:301`, `306` ("Nithin — Cofounder", "Kabir — Cofounder")
    - `legal.html`: 31 instances, for example 276, 284, 288-293, 295, 321-323, 335-337, 343-347, 394, 451, 480
    - `pf-demo.js:283-285` ("Step 1 — 2 of 6 products")
    - `pf-waitlist.js:1277` ("Nothing is stored until you send it —") and `:195` (mail subject)
    - `signin.html:407` ("Shopify admin — no sign-in needed"), `:470` (error copy)
    - page titles and meta: `index.html:12`, `17`, `19`, `22`; `about.html:6-7`; `contact.html:6-7`; `legal.html:6`; aria-label `index.html:756`

---

## 11. CSS custom properties (ready to paste)

```css
:root{
  /* ---------- color: surfaces ---------- */
  --pf-navy-950:#030818;          /* page ground, nav, sections           */
  --pf-navy-900:#071238;          /* ink on lime/cream, favicon tile      */
  --pf-navy-800:#0d2168;          /* raised navy, field gradient end      */
  --pf-surface-glass:rgba(7,18,56,.42);      /* frosted panels (signin) */
  --pf-surface-raised:rgba(243,236,222,.04); /* cards on navy           */
  --pf-scrim:rgba(3,8,24,.78);    /* wash under copy on paintings        */
  --pf-paper:#f7f3ea;             /* about/contact/legal ticket          */
  --pf-lime:#d8f24b;              /* accent + footer slab                */

  /* ---------- color: text ---------- */
  --pf-cream:#f3ecde;                   /* 16.98:1 on navy-950 */
  --pf-cream-strong:rgba(243,236,222,.84); /* hero sub, 11.98:1 */
  --pf-cream-muted:rgba(243,236,222,.72);  /* secondary, 8.85:1 */
  --pf-cream-subtle:rgba(243,236,222,.58); /* tertiary floor, 5.97:1 */
  --pf-placeholder:rgba(243,236,222,.55);  /* 5.44:1 */
  --pf-lime-ink:#0d1f00;          /* text on lime, 13.78:1              */
  --pf-lime-ink-soft:rgba(13,31,0,.78); /* was .68; 5.16:1 on the olive art, 7.43:1 on flat lime */
  --pf-paper-ink:#0f1830;         /* headings on paper, 15.89:1          */
  --pf-paper-text:#333c52;        /* body on paper, 9.93:1               */
  --pf-paper-muted:#5d6579;       /* meta/markers on paper, 5.26:1       */
  --pf-link-on-paper:#3f4fb0;     /* 6.41:1                              */

  /* ---------- color: accents, data, signal ---------- */
  --pf-peri:#93aaff;              /* kickers, links on dark, 8.97:1     */
  --pf-peri-soft:rgba(147,170,255,.80); /* captions, 6.01:1             */
  --pf-blue:#1d4ed8;              /* data fills only (2.98:1)           */
  --pf-blue-line:#597ada;         /* data lines, 4.96:1                 */
  --pf-ok:#b9ef6b;     --pf-ok-dot:#58c40a;
  --pf-warn:#fbbf24;
  --pf-bad:#ff9d7a;    --pf-bad-dot:#ff6a2b;

  /* ---------- lines ---------- */
  --pf-line-faint:rgba(243,236,222,.08);
  --pf-line:rgba(243,236,222,.14);
  --pf-line-control:rgba(243,236,222,.45);   /* inputs, ghost pill: 3.98:1 */
  --pf-line-paper:rgba(15,24,48,.16);
  --pf-line-lime:rgba(13,31,0,.20);

  /* ---------- type ---------- */
  --pf-font-serif:'Hedvig Letters Serif',Georgia,Cambria,'Times New Roman',serif;
  --pf-font-sans:'Inter',system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif;
  --pf-font-mono:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; /* product mock-ups only */

  --pf-text-display:clamp(40px,5.1vw,92px);  /* lh 1.02, -0.022em */
  --pf-text-h2:clamp(32px,4vw,54px);         /* lh 1.1,  -0.02em  */
  --pf-text-figure:clamp(40px,7vw,68px);     /* Inter 500, -0.03em */
  --pf-text-h3:clamp(20px,2vw,26px);         /* lh 1.2,  -0.012em */
  --pf-text-lead:clamp(16px,1.35vw,19px);    /* lh 1.55 */
  --pf-text-body:16px;                       /* lh 1.6  */
  --pf-text-small:14px;                      /* lh 1.5  */
  --pf-text-label:12px;                      /* caps, 600, .14em */
  --pf-ui-sm:11px; --pf-ui-md:13px; --pf-ui-lg:16px; --pf-ui-stat:24px; /* mock-ups, rendered size */

  --pf-lh-display:1.02; --pf-lh-heading:1.1; --pf-lh-sub:1.2;
  --pf-lh-lead:1.55;    --pf-lh-body:1.6;    --pf-lh-small:1.5;
  --pf-track-display:-0.022em; --pf-track-heading:-0.02em;
  --pf-track-body:-0.005em;    --pf-track-button:-0.01em; --pf-track-label:0.14em;

  /* ---------- space & layout ---------- */
  --pf-space-1:4px;  --pf-space-2:8px;  --pf-space-3:12px; --pf-space-4:16px;
  --pf-space-5:20px; --pf-space-6:24px; --pf-space-7:32px; --pf-space-8:40px;
  --pf-space-9:48px; --pf-space-10:64px; --pf-space-11:80px; --pf-space-12:96px;
  --pf-space-13:128px;
  --pf-section-y:clamp(64px,10vh,128px);
  --pf-section-y-tight:clamp(40px,6vh,80px);
  --pf-gutter:clamp(14px,4.4vw,28px);      /* nav (existing) */
  --pf-gutter-x:clamp(20px,5vw,64px);      /* every section */
  --pf-max:1180px; --pf-max-wide:1360px;
  --pf-measure:46ch; --pf-measure-long:62ch;
  --pf-nav-h:43px;                         /* measured live by index.html */
  /* breakpoints (for reference; CSS vars can't drive @media):
     360 tiny · 480 phone · 768 tablet · 900 desktop · 1100 wide · h560 short · h620 very short */

  /* ---------- radii ---------- */
  --pf-radius-xs:4px; --pf-radius-sm:8px; --pf-radius-md:12px;
  --pf-radius-lg:20px; --pf-radius-xl:24px; --pf-radius-pill:999px;
  --pf-notch:12px;                          /* paper ticket punch */

  /* ---------- shadows ---------- */
  --pf-shadow-contact:0 1px 2px rgba(3,8,24,.45);
  --pf-shadow-raised:0 12px 28px -10px rgba(3,8,24,.55);
  --pf-shadow-float:0 40px 90px -34px rgba(3,8,24,.92),0 2px 10px rgba(3,8,24,.25);
  --pf-inset-highlight:inset 0 1px 0 rgba(255,255,255,.2);
  --pf-halo-lime:0 8px 22px -10px rgba(216,242,75,.42),0 0 0 5px rgba(216,242,75,.07); /* primary CTA only */
  --pf-text-shadow-art:0 1px 16px rgba(3,8,24,.8);

  /* ---------- motion ---------- */
  --pf-ease-out:cubic-bezier(.22,1,.36,1);     /* house curve; absorbs (.16,1,.3,1) */
  --pf-ease-in-out:cubic-bezier(.65,0,.35,1);  /* line draws, nav scroll */
  --pf-dur-press:90ms;
  --pf-dur-fast:200ms;     /* color, underline, icon */
  --pf-dur-base:340ms;     /* lift, sweep */
  --pf-dur-slow:700ms;     /* reveals, panels */
  --pf-dur-draw:1150ms;    /* explanatory chart draw */

  /* ---------- focus ---------- */
  --pf-focus-width:2px;
  --pf-focus-offset:3px;            /* 5px around pills */
  --pf-focus-on-dark:#f3ecde;       /* 16.98:1 on navy, distinct from the lime halo */
  --pf-focus-on-lime:#0d1f00;
  --pf-focus-on-paper:#3f4fb0;

  /* ---------- z ---------- */
  --pf-z-bg:-1; --pf-z-raised:2; --pf-z-nav:20; --pf-z-skip:50;
}

/* button-local custom props must not reuse page-level names */
.pf-btn{ --pf-btn-bg:var(--pf-lime); --pf-btn-fg:#13200a; --pf-btn-glow:216,242,75; }
:focus-visible{ outline:var(--pf-focus-width) solid var(--pf-focus-on-dark); outline-offset:var(--pf-focus-offset); }
```
