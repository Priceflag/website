# goldsand.fi — structure & interaction teardown

Investigated 2026-08-10. Source of truth: production bundles
(`/assets/app-CTA_66Dp.js`, `/assets/Home-CtGYcxIL.js`, `/assets/app-W_1v69S_.css`)
plus live DOM/computed-style measurement at 1440×900 and 377×863.

Everything below is **mechanics**, restated in my own words. No verbatim source
blocks. Guesses are labelled `[GUESS]`.

---

## 0. Stack & global system

| Thing | Value |
|---|---|
| Build | Vite + React 18, SPA, code-split per route (`Home-*.js` is one chunk) |
| Animation lib | **framer-motion / `motion`** only. Bundled, tree-shaken. |
| Scroll library | **None.** No GSAP, no ScrollTrigger, no Lenis, no Locomotive, no Framer sites runtime. Verified by grepping every shipped bundle. |
| Smooth scroll | Native CSS: `html { scroll-behavior: smooth; overscroll-behavior-y: none }` |
| Scroll-linked motion | `useScroll` + `useTransform` from motion — used in exactly **one** place (the globe card). Everything else is discrete `useInView` → play-once. |
| 3D | three.js + `OrbitControls`, **lazily dynamic-imported** only when the globe section mounts. Plus `topojson-client` and a 55 KB `/data/land-110m.json`. |
| Reduced motion | A `useReducedMotion()` hook (matchMedia `prefers-reduced-motion`) is threaded into the globe, the counter, and the marquee. Each has a static fallback. |

### Vertical rhythm

Two shared primitives do all the layout work:

```
<Section pt="pt-16 md:pt-28" pb="pb-16 md:pb-28">   // 64px → 112px
  <Container>                                       // mx-auto w-full max-w-[1200px] px-6 md:px-10
```

- **Default section padding: 64px mobile / 112px desktop, top and bottom.**
  So the gap between two adjacent sections is 128px mobile / 224px desktop.
- **Max content width: 1200px**, gutters 24px mobile / 40px ≥768px.
- Two sections deliberately break the rhythm:
  - comparison/graph section overrides top only → `pt-8 md:pt-14` (32/56px), because
    it visually continues from the feature grid above it.
  - the simulator injects a `<style>` tag that hard-overrides its own padding to
    `200px` top / `44px` bottom on desktop, `0` / `68px` on mobile.
  - the globe section has **zero padding** — it is edge-to-edge and full-bleed.

### Measured section heights @1440

hero 1288 · testimonials 578 · feature grid 1608 · comparison 726 · simulator 790 ·
secured 599 · globe 1200 · FAQ 914 · final CTA 644. Page ≈ 8.5k px + 987px footer.

### Breakpoints actually used

Tailwind v4 defaults `sm 640 / md 768 / lg 1024` **plus** three hand-rolled ones:
`min-[810px]`, `min-[1200px]`, `min-[1400px]`. The unusual one is **1400px** — the
comparison section stays single-column until 1400 and only then goes 2-up, which is
why the graph feels large on a 1280 laptop.

### Type + colour tokens (for mapping onto your own language)

- `--font-display` = "Season Mix Medium", serif fallback. `--font-sans` = "Season Sans Medium".
- `.text-h1` = 32px / 48px ≥768, weight 580, line-height 105%, letter-spacing 0.
- `.text-body` = 18px, weight 550, line-height 140%.
- ink `#111`, gray `#575757`, gray-light `#959796`, cream `#edebe7`,
  panel `#f6f5f3`, line `#e0e0e0`, gold `#b27621`, gold-dark `#c48634`, blue-800 `#1e72af`.
- Signature green `#1fbc00` is a local literal inside the simulator, not a token.

### The one reveal primitive

Nearly every block is wrapped in a `<Reveal>`:

```
initial   { opacity: 0, y: 24 }
animate   { opacity: 1, y: 0 }      // once in view
transition{ duration: 0.7, delay: <prop>, ease: [0.16, 1, 0.3, 1] }  // expo-out
viewport  IntersectionObserver, rootMargin "-10% 0px -10% 0px", once: true
```

`[0.16, 1, 0.3, 1]` is the house easing — it also drives the FAQ accordion, the FAQ
icon, and the CTA coin. Copy that curve and you get 70% of the "feel" for free.

---

## 1. "Earn more with Goldsand." — the comparison graph

### It is not a chart library, not canvas, not SVG. It is three `<div>`s.

Three hardcoded data rows, each `{ label, rateText, heightRatio, background, logos[] }`:

| Row | Rate label | heightRatio | bg |
|---|---|---|---|
| Traditional Banks | `0.01%` | 0.16 | `#f0f0f0` |
| Investment Products | `4%` | 0.40 | `#ebebeb` |
| Goldsand | `Up to 7%` | 1.00 | `#123a1f` (highlight) |

There are **no axes and no numeric scale** — the ratios are art-directed, not
computed. The only "axis" is the row label under each bar.

### Sizing (the interesting bit)

The bar container measures itself with a `ResizeObserver` and derives a single
`maxHeight` in px:

```
maxHeight = round(520 * min(containerWidth / 600, 1.4))
```

So: 520px tall at exactly 600px wide, scaling **linearly with width** and clamping
at 728px once the container is ≥840px. Verified live:

- @1440 viewport → container 496px → maxHeight **430px** (measured 430) ✓
- @377 viewport → container 329px → maxHeight **285px** (measured 285) ✓

Layout of the row: `flex, gap 16px (md 24px)`, three equal `flex-1` columns.
@1440 each column is 149px wide inside a 496px container.

### Logo placement

Above each bar sits a fixed-height logo rail: `h-[47px] md:h-[92px]`, full width,
`items-center`. Logos are `<span>` chips, `36×36` (`h-9 w-9`) → `44×44` (`h-11 w-11`)
≥768, `rounded-xl` (12px), `overflow-hidden`, `object-cover` PNGs.

Overlap is done with a **negative left margin of −12px on every chip after the
first**, and `zIndex: logos.length - i` so the leftmost sits on top (left-over-right
shingle). Banks/investments have 3 logos each; Goldsand has 1.

### Scroll-in animation

One `useInView(ref, { once: true, amount: 0.15 })` on the *row wrapper* gates all
three columns — they do not observe individually. Per-column base delay:

```
delay(i) = 0.3 + i * 0.16     // 0.30s, 0.46s, 0.62s
```

Four staggered tracks per column:

| Element | from → to | duration | delay | easing |
|---|---|---|---|---|
| Bar height | `0` → `maxHeight * ratio` | **1.1s** | `delay(i)` | custom `t => 1 - (1-t)^4` (quart-out) |
| Logo chip opacity | 0 → 1 | 0.4s | `delay(i) + j*0.09` | `easeOut` |
| Logo chip y | −6 → 0 | 0.4s | `delay(i)` | `[0.34, 1.56, 0.64, 1]` (back-out, overshoots) |
| Rate label | opacity 0 → 1 | 0.5s | `delay(i) + 0.9` | `easeInOut` |
| Row label | opacity 0 → 1 | 0.5s | `delay(i) + 0.2` | `easeInOut` |

Note the rate label fires at `delay + 0.9` — i.e. it appears just before the 1.1s
bar growth finishes, so the number lands as the bar settles. That's the trick worth
stealing.

The rate label is absolutely positioned `bottom 8px / left 8px` (md `14px/14px`)
inside the bar, `whitespace-nowrap`, 19px on mobile / 30px (`text-3xl`) desktop.
Bar radius `rounded-xl` mobile → `rounded-3xl` (24px) desktop.

### Section layout

`grid-cols-1` by default, `min-[1400px]:grid-cols-2` with `gap-10` → `gap-16` (64px)
and `items-start`. Copy left (h1 + a `max-w-[440px]` paragraph, `mt-6`), graph right.
The graph grid itself carries extra `sm:px-6 md:px-8`.

### Pseudocode

```
BarGroup:
  ref, maxH = 520
  onResize(w): maxH = round(520 * min(w/600, 1.4))
  inView = useInView(ref, once, amount 0.15)
  for i, row in rows:
     d = 0.3 + 0.16*i
     LogoRail(row.logos, visible=inView, delay=d)
     Track(height: maxH):
        Bar animate height: inView ? maxH*row.ratio : 0
            transition {1.1s, delay d, ease quartOut}
        RateLabel fade 0.5s @ d+0.9
     RowLabel fade 0.5s @ d+0.2
```

---

## 2. "Simulate your savings" — the interactive

A 546px-tall pill (`border-radius: 40px`, bg `rgba(237,235,231,0.5)`) split
**50 / 50**: copy+controls left, chart right. All of its CSS is injected as a
component-local `<style>` string, not Tailwind.

### Inputs (three, all different affordances)

1. **Initial deposit** — native `<input type=range>`, `min 100 / max 50000 / step 100`.
   Track 6px tall, 99px radius, filled with a `linear-gradient` driven by a
   `--slider-progress` custom property set inline as `((v-min)/(max-min))*100%`.
   Thumb 18×18 circle `#1a9e3f`; fill `#1fbc00`; empty `#ddd`.
   Sits in a `.deposit-card`: `max-w 400px`, `padding 14px 18px 16px`, `radius 16px`,
   bg `#edebe7`, with a label (16px, `#888`) and an `<output>` (24px 700, mobile 40px).
2. **Period** — a custom dropdown, not a select. Trigger pill (`bg #ebebeb`,
   `radius 8px`, `padding 3px 8px 3px 10px`, 12px chevron at 45% opacity) opens a
   `role="listbox"` popover: `top: calc(100% + 6px)`, `min-width 140px`,
   `radius 14px`, bg `#f7f7f7`, `box-shadow 0 8px 28px rgba(0,0,0,.12)`.
   Options: **5, 10, 15, 20, 25, 30** years. Default 30.
3. **Monthly contribution %** — click-to-edit inline text. Renders as a
   `border-bottom: 1.5px solid #aaa` button showing the number; clicking swaps it
   for a 28px-wide `<input type=number>` with `autoFocus`, committed on blur or
   Enter, clamped to **1–50**. Default 10 (%). The absolute `$/mo` is derived:
   `round(deposit * pct/100)`.

No presets. No "goal" input — goals are emergent (see milestones).

### The maths

```
compound(deposit, monthly, years):
  b = deposit
  repeat years times:
      b += monthly * 12
      b *= 1.07                 // 7% APY, applied annually after contributions
  return b
```

Per year `n`: `balance = compound(...)`, `principal = deposit + monthly*12*n`,
`interest = max(0, balance - principal)`.

Outputs: total (last year balance), earned (`total - lastPrincipal`), contributed.

### Bar geometry

`CHART_H = 410px`, `GAP = 3px`, `nBars = years` (so 30 bars at default, each ~15px
wide @1440 / 6px wide @377).

```
h        = max(10, balance/maxBalance * 410)      // min 10px so year 1 is visible
interest = max(0,  interestShare * h)
principal= max(4,  h - interest - 3)              // 3px = the divider <i>
```

Each bar is a `<button>` (keyboard-reachable, `aria-label` carries the numbers)
with an absolutely-positioned inner stack: green `#1fbc00` segment on top
(`flexGrow: interestHeight`), a 3px transparent spacer, orange-brown `#c48634`
below (`flexGrow: principalHeight`). Segments `border-radius: 4px`.

Two dashed gridlines, `1px dashed #e8e8e8`, absolutely at `bottom: 213.3px` and
`bottom: 348.6px` (≈ 52% and 85% of 410) — **hardcoded, not data-derived**.

Axis is two labels only: `Today` … `30Y`, `justify-between`, `margin-top 10px`,
13px `#bbb`.

### Milestones (the delightful bit)

Seven goals with emoji: Phone 📱 $1k, Vacation ✈️ $5k, Hajj 🕋 $16k,
College 🎓 $40k, Wedding 💍 $60k, Car 🚗 $25k, Home 🏡 $200k.

Each goal is attached to **the first year whose balance ≥ target**. The emoji is
rendered as a `<span>` above that bar, `left:50%; translateX(-50%)`.

Marker font-size is responsive to bar density:
`markerSize = clamp(18, 34 - years*0.5, 28)` → 19px at 30y, 28px at ≤12y.

Vertical offset above the bar:
`top = -(markerSize + 10 + min(nextBarHeightDelta, cap) + laneOffset)`
where `cap = 8` if years ≤10, `12` if ≤15, else the raw delta, and `laneOffset`
adds `markerSize + 6` when two markers would collide. Collision is decided by
converting the marker's pixel width into "bar index" units
(`ceil(markerSize / floor(availableWidth/years))`) and alternating lanes 0/1.
Neat trick: it staggers emoji into two rows instead of overlapping.

### Tooltip

Hover/focus a bar → `.chart-tooltip`, 220px wide, `padding 6px`, `radius 16px`,
bg `#eeedea`, `pointer-events: none`, containing two nested cards at
`rgba(255,255,255,.6)`, `radius 16px`:

- **Summary**: "Total" + `$xx,xxx` (22px/550), then two legend rows with 10px
  colour dots — Earned (`#1fbc00`) and Added (`#c8922a`), value pushed right with
  `margin-left:auto`.
- **Goal card** (only when that year has milestones): "Within reach" / "Year N",
  then emoji + goal name. If a year holds several goals it picks one **at random**
  on each hover — cheap variety, no state.

Positioning is manual, not popper:
```
barCenterX = 24 + ((i + 0.5)/years) * (chartW - 24 - (chartW<500 ? 24 : 48))
left       = clamp(barCenterX - 120, 0, chartW - 230)
top        = max((chartW<500 ? 426 : 428) - barHeight - tooltipHeight - 12, 10)
```
Tooltip height is read back from the DOM (`offsetHeight`) into state after render.
Non-hovered bars go to `opacity: .3` via `.is-muted` with `transition: opacity .15s ease`.

### The headline number — a rolling digit odometer

This is the standout piece. `$` + formatted total, 64px, `#1fbc00`, display font.

- Each **digit** is a 70px-tall `overflow:hidden` window containing a vertical reel
  of the glyphs `0..9`, stacked, translated by `-digit * 70px`.
- On change: the reel is snapped to the *old* position with `transition:none`, then
  after **two nested rAFs** the transition is switched on and it moves to the new
  position. Duration **0.5s**, easing `cubic-bezier(.22, 1, .36, 1)` (expo-out).
  The double-rAF is the standard "force a style flush so the browser doesn't
  coalesce the two transforms" trick — you need it.
- Each digit window has a vertical **mask** so glyphs fade at the edges:
  `linear-gradient(to bottom, transparent 0%, #000 8%, #000 92%, transparent 100%)`.
- Digit widths are not `ch` units. A hidden `.rolling-balance-measure` div renders
  `0-9`, `,` and `$` once, measures `offsetWidth` of each, takes `max()` of the ten
  digits, and applies that as a fixed width — re-run after `document.fonts.ready`.
  This is what stops the number jittering in a proportional display face.
- `,` and `$` render as static `.rolling-symbol` spans at the same 70px height.
- a11y: `aria-live="polite"` + `aria-label` on the wrapper, reels are `aria-hidden`,
  and there is an `sr-only` sentence restating total/contributed/earned.

There is **no easing of the value itself** — no tween from old total to new. The
number jumps to the new value and the *digit reels* do the animating. Much cheaper
and reads better.

### Responsive

Below 768px: simulator becomes `height:auto`, `flex-direction:column`;
`.savings-copy` becomes `display: contents` so its two children can be reordered —
summary (order 1), chart (order 2, `min-height 300px`), controls (order 3).
Padding drops 48px → 24px. Deposit output jumps to 40px.

### Pseudocode

```
state: years=30, deposit=500, pct=10, hovered=null
derived (useMemo on deposit/monthly/years):
   rows = [1..years].map(n => {balance, principal, interest})
   bars = rows.map(scale to 410px)
   milestones = Map<yearIndex, goals[]>
render:
   left:  h3 / Odometer(total) / "$X earned in [years ▾]" / DepositSlider / "auto-contributing $N/mo (10%)"
   right: 2 gridlines + 30 button-bars + axis + optional tooltip
onHover(i): hovered = i; goal = randomOf(milestones[i])
onLeave  : hovered = null
```

---

## 3. "Secured at every step."

Deliberately the calmest section. **Nothing advances, nothing is sequential** —
despite the word "steps" it is a static 2×2 grid of feature cards.

Layout:
```
Section (bg-white, 112px padding)
  Container
    grid gap-12 md:grid-cols-2 md:gap-16
      col A: h2 "Secured at / every step." + 320px-max paragraph (mt-5)
      col B: grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-12
```
So on desktop it's copy-left / 2×2-right; at `sm` the cards are 2-up; below `sm`
they stack to a single column.

Four items: Trusted financial partners · Audited infrastructure · 24/7 Monitoring ·
Halal Standard.

**Iconography**: inline 24×24 SVGs, hand-authored, rendered at **22×22** inside a
**44×44** (`h-11 w-11`) `rounded-xl` tile with `bg-panel` and `text-ink`.
Two are `fill: currentColor` solids (shield-with-check, gear-with-check), two are
`stroke: currentColor, strokeWidth 2, strokeLinecap round` outlines. Both outline
icons use a **dashed arc** (`strokeDasharray "1 3.2"` / `"1 3"`) for the incomplete
part of a circle plus a solid arc segment — a nice cheap "in progress" motif.

Card text: `h3` 18px semibold `tracking-[-0.01em]` at `mt-4`; body 16px
`leading-[1.45]` gray at `mt-1.5`.

**Animation**: each card observes itself — `useInView(once: true, amount: 0.5)` —
and does an **opacity-only** fade (no y-translate, unlike the global Reveal):

```
opacity 0 → 1, duration 0.4s, delay 0.6 + index*0.1, ease [0.44, 0, 0.56, 1]
```
`[0.44,0,0.56,1]` is a symmetric sine-in-out. Note the fat 0.6s base delay — the
cards wait for the heading before starting.

The intro paragraph uses a different transition again:
`whileInView`, `viewport { once, amount: 0.5 }`,
`type: "spring", bounce: 0, duration: 0.4, delay: 0.4`.

---

## 4. Globe + counter

### Section shell

```
<section class="globe-stat-section">    // full-bleed, bg #fff, overflow: clip, 1200px tall
  <motion.div class="globe-stat-card">  // the scroll-scaled slab
     <div class="globe-stat-orbit"><div class="globe-stat-renderer"/></div>
  </motion.div>
  <div class="globe-stat-content"> ...text, absolutely positioned over it... </div>
</section>
```

**Card**: `width 100%`, `height 1200px`, `border-radius 100px 100px 0 0`,
`overflow: clip`, background
`linear-gradient(180deg, #1e72af 0%, rgba(237,235,231,0.5) 99.9%)`.

Radius steps down responsively: `100px` ≥1400, **60px** at 810–1399, **40px** <810
(where the card also shrinks to `height: 913px`).

> **The section-to-section transition, and this is the clever part:**
> the gradient's end colour `#edebe780` composited over the section's white
> background resolves to exactly `rgb(246,245,243)` — which is `--color-panel`,
> the background of the FAQ section directly below. So the blue slab dissolves
> into the FAQ's own background with no seam and no overlay element. Verified:
> FAQ computed `background-color` is `rgb(246, 245, 243)`.

### Scroll-linked entrance

The only `useScroll` on the page:

```
{ scrollYProgress } = useScroll({ target: section, offset: ["start end", "start start"] })
scale = useTransform(p, [0,1], [0.9, 1])
y     = useTransform(p, [0,1], [100, 0])
```

i.e. from "section top hits viewport bottom" to "section top hits viewport top",
the card scales **0.9 → 1.0** and rises **100px → 0**. Continuous, scrubbed, not a
one-shot. `useReducedMotion` short-circuits both to `1` / `0`. I measured the card
mid-scroll at 1296×1080 — exactly 0.9 × 1440×1200. ✓

### Globe rendering — WebGL point cloud, not SVG/canvas2d/sprite sequence

On mount, in parallel:
`import('three')`, `import('three/OrbitControls')`, `import('topojson-client')`,
`fetch('/data/land-110m.json')` (55 KB TopoJSON).

Then:

1. `topojson.feature()` → land polygons. Polygons whose lon-span > 300° and whose
   mid-latitude |lat| > 60° are **discarded** (that's Antarctica's wrap-around ring).
2. **Coastlines**: each polygon edge is walked and resampled at a **1° step**
   (`STEP = 1`), each sample converted lon/lat → unit-sphere xyz. → `Float32Array`.
3. **Land fill**: a 1° lat/lon lattice is generated over each polygon's bbox and
   each candidate point is tested with a ray-casting point-in-polygon against the
   outer ring, then rejected if it also falls inside any hole ring. → second
   `Float32Array`. Antimeridian is handled by unwrapping longitudes relative to the
   polygon centroid before testing.
4. Two `THREE.Points` clouds share a 64×64 canvas radial-gradient sprite (white
   core, alpha 0 at the rim, generated at runtime as a `CanvasTexture`):
   - coastline: colour `#ffffff`, `size 0.005`, opacity 1
   - land fill: colour `#7ae1ff`, `size 0.00375`, opacity 0.6
   Both `sizeAttenuation: true`, `depthWrite: false`, `transparent`.
5. A patched `PointsMaterial` (via `onBeforeCompile`) adds a **back-hemisphere
   fade**: it computes `dot(viewDir, normalDir)` per point and
   - shrinks point size `mix(0.6, 1.0, smoothstep(0, 0.25, ndv))`
   - multiplies alpha by `mix(0.3, 1.0, smoothstep(0, 0.25, ndv))`
   So points on the far side of the globe are smaller and 30% opacity — you get
   depth without a depth buffer. **This is the single most copyable idea here.**

Camera: `PerspectiveCamera(fov 55, z = 3)` on a unit sphere.
Renderer: `alpha: true`, `antialias: false`, `powerPreference: 'low-power'`,
`premultipliedAlpha: true`, `setClearColor(0, 0)`, `pixelRatio = min(dpr, 2)`.
`OrbitControls` with `enableDamping: true`, `enablePan: false`, `enableZoom: false`
— so it's **draggable** but not zoomable, and it keeps gliding after release.

Motion: the whole points group starts at `rotation.y = 200°` and auto-rotates at
**0.03 rad/s** (≈ one revolution every 209 s — very slow). Frame loop is throttled
to **50 fps** (`1/50` accumulator; render only when the accumulator overflows) and
gated by an `IntersectionObserver` that starts/stops rAF as the section enters/leaves.
`prefers-reduced-motion` kills the auto-rotation but keeps the (static) render.

**Positioning / cropping** — this is how it reads as a horizon rather than a ball:
```
.globe-stat-orbit { position:absolute; inset: -244px -958px -874px -317px;
                    transform: rotate(-12deg); transform-origin: 50%; }
```
On a 1440×1200 card that's a **2715 × 2318** box, tilted −12°, with the card's
`overflow: clip` cutting it. The globe is far bigger than the card and pushed
down-right, so only an upper-left arc is visible. On <810px the bottom inset
becomes `-1161px`.

⚠️ **Perf caveat worth avoiding**: the renderer sizes itself from
`getBoundingClientRect()` of the orbit div, which *includes the ancestor rotate and
the scroll-driven scale*. At 1440×900 the canvas backing store measured
**5648 × 5098** (2824 × 2549 CSS px × dpr 2) — ~29 megapixels for a partially
occluded decoration. If you copy this, size from `offsetWidth/offsetHeight` (the
untransformed box) and cap `pixelRatio` at 1.5.

### The counter, and how it "syncs"

```
START = 1_230_000
END   = 1_923_456
```
It is **not** driven by scroll progress and **not** driven by the globe's clock.
It is a completely independent one-shot:

```
inView = useInView(ref, { once: true, margin: "0px 0px -5% 0px" })
if (inView) animate(1_230_000, 1_923_456, {
     duration: 5,
     ease: [0, 0, 0.58, 1],       // == CSS ease-out
     onUpdate: setValue })
render: Math.floor(value).toLocaleString('en-US')
```

So the pairing is purely *visual co-location*: the counter starts when the number
scrolls into view (5% before the bottom edge), which is roughly when the globe card
is finishing its scale-up. **5 seconds** is unusually long and is what makes it feel
tied to the slow globe rotation. Reduced motion → jump straight to the end value.

Typography: `$` and the digits are separate spans, both 64px / weight 580, display
serif, white. The counter span has `font-variant-numeric: tabular-nums`,
`letter-spacing: -0.04em`, `min-width: max-content` — tabular figures are what stop
the width juddering (contrast with the simulator, which measures glyphs manually
because it needs per-digit reels). `$` drops to 48px below 810px.
`aria-label="$1,923,456"` on the wrapper states the final value up front.

Content column: `position:absolute; inset:0; padding:48px 32px; flex column;
justify-content: space-between` — so the heading pins to the top of the slab and the
explainer pins to the bottom, both constrained to `max-width: 1200px`.

---

## 5. The "supported formats" / partner-logo strip

⚠️ Finding: **there is no separate logo-strip section, and nothing marquees here.**
Two things could be what you saw:

### (a) The payment-networks mark — this is the one directly above the FAQ

Bottom of the globe section, inside `.globe-stat-explainer`:

```
.globe-stat-explainer { display:flex; flex-direction:column; align-items:flex-start;
                        gap: 24px; width:100%; max-width:1200px }
  <img src="/images/payment-networks.svg" width=157 height=51 aria-hidden loading=lazy>
  <p class="globe-stat-copy">  // 18px/550, line-height 1.4, width: min(508px, 100%)
```

It is **one static inline SVG file**, 157×51, no animation, no marquee, no DOM per
logo. Four overlapping circles of radius 25.167 at cx **25.167 / 60.5 / 95.833 /
131.167** — i.e. a 35.33px pitch on a 50.33px diameter, so **15px of overlap**, in
paint order Goldsand → Ethereum → Visa → Mastercard (later ones on top, so the
shingle runs left-under-right — the opposite of the comparison-graph logo rail).
Mastercard is drawn properly with its two circles `#EB001B` / `#F79E1B` and the
`#FF5F00` intersection; Visa is `#3549FE`; the backing circle is `#C0C0C0`.

Then the section ends and the FAQ begins — the transition is the gradient-to-panel
colour match described in §4, plus the card's `100px 100px 0 0` radius. No fade
overlay, no mask, no parallax.

### (b) The testimonial marquee ("Trusted by experts")

If it's a *moving* strip you're after, this is the only one on the page, and it's
custom-written (no Swiper/Embla):

- Items are rendered **twice** (`[...items, ...items]` → 12 cards) inside a
  `overflow-hidden` scroller. Cards `w-[300px] md:w-[340px]`, `gap-5` (20px) +
  `pr-5`, `rounded-3xl`, `border-black/[0.08]`, `shadow 0 1px 2px + 0 8px 24px`
  at 4% black.
- A `ResizeObserver` reads `scrollWidth / 2` as the loop length. A rAF loop
  advances `scrollLeft` by `loopLen / (duration*1000) * dt` per frame and wraps
  modulo `loopLen`. `duration` prop = **46s** for a full lap; measured lap length
  2160px → **≈47 px/s**. `dt` is clamped to 50ms so tab-switches don't teleport it.
- It is **drag-throwable**: pointer events set a `dragging` flag, track
  `velocity = -dx/dt` clamped to ±2.5 px/ms, and on release the velocity decays
  with `v *= exp(-dt/360)` per frame (plus an immediate `exp(-dt/120)` release
  damp) until |v| < 0.01, at which point the constant auto-scroll resumes.
  `cursor-grab` / `active:cursor-grabbing`, `touch-pan-y`, `select-none`,
  `setPointerCapture`.
- Edge fades are two absolutely-positioned gradient divs, `w-16 md:w-28`,
  `from-white to-transparent`, `pointer-events-none`.
- `useReducedMotion` stops the auto-advance but leaves dragging working.

---

## 6. FAQ

```
Section (bg-panel #f6f5f3, 112px padding)
  Container
    grid gap-10 md:gap-16 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]
      left : h2 "Frequently asked questions"
      right: flex-col gap-3   // 12px between items
```
@1440 that resolves to columns of **459px / 597px**. Nine items.

Each item is wrapped in the global `<Reveal>` with
`delay = min(index * 0.04, 0.24)` — so items 0–6 stagger by 40ms and everything
from #7 on shares a 240ms delay. Cheap cap, avoids a long trailing cascade.

### Item shell
`overflow-hidden`, `rounded-3xl` (24px), `border: 1px solid #e0e0e0`, `bg-white`.
Header is a full-width `<button aria-expanded>`, `flex items-center justify-between
gap-4`, `px-5 py-4` → `md:px-6`, `text-left`. Question: 16px medium,
`tracking-[-0.01em]`, ink.

### Icon
Not a chevron — a **plus that rotates into an ×**. Two absolutely-positioned
`motion.span`s inside a 32×32 (`h-8 w-8`) flex box, each `1.5px × 14px`
(`h-[1.5px] w-3.5`), `rounded`, `bg-ink`:

```
bar A: rotate  0  → 45
bar B: rotate 90  → -45
transition { duration: 0.25, ease: [0.16, 1, 0.3, 1] }
```
Both bars animate simultaneously; B travelling 90→−45 (135°) while A travels 0→45
is what makes it feel like it *unfolds* rather than spins.

### Panel

`AnimatePresence` with `initial={false}` (so nothing animates on mount), one keyed
child:

```
initial { height: 0,      opacity: 0 }
animate { height: 'auto', opacity: 1 }
exit    { height: 0,      opacity: 0 }
transition { duration: 0.35, ease: [0.16, 1, 0.3, 1] }
className "overflow-hidden"
```
`height: 'auto'` is safe here only because framer-motion measures and substitutes a
px value; if you're hand-rolling, use a `grid-template-rows: 0fr → 1fr` wrapper or a
`ResizeObserver`-measured max-height, and keep `overflow:hidden` on the animating
element, not on the content.

Body: `px-5 pb-5 md:px-6`, 16px, `leading-[1.55]`, gray. Optional "Read more" link
`mt-3 block font-medium text-ink underline`.

Behaviour: **each item is independent local state** — it is *not* a single-open
accordion. Several can be open at once. No `<details>`, no ARIA `region`/
`aria-controls`, only `aria-expanded` on the button.

One FAQ answer ("What are the risks?") embeds a small inline component: a
`rounded-2xl bg-cream p-6` block with a 8px `rounded-full` bar filled
`bg-gradient-to-r from-green-500 via-gold to-red-500` and three labels beneath.
Nice pattern for putting a mini-visual inside an accordion body — it works because
the panel animates `height: auto` and doesn't care what's inside.

---

## Cheat sheet — numbers to reuse

| Thing | Value |
|---|---|
| Content width / gutters | 1200px / 24px, 40px ≥768 |
| Section padding | 64px, 112px ≥768 |
| House easing | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Standard reveal | opacity 0→1, y 24→0, 0.7s, IO rootMargin `-10% 0px` |
| Bar-grow easing | `t => 1 - (1-t)^4`, 1.1s |
| Logo pop easing | `cubic-bezier(0.34, 1.56, 0.64, 1)`, 0.4s |
| Odometer digit | 0.5s, `cubic-bezier(.22, 1, .36, 1)`, 70px reel, 8%/92% mask |
| Counter | 5s, `cubic-bezier(0, 0, 0.58, 1)`, 1.23M → 1.923M |
| Accordion panel | 0.35s; icon 0.25s |
| Marquee | 46s per lap ≈ 47 px/s; drag decay `exp(-dt/360)` |
| Globe | 0.03 rad/s, 50 fps cap, 1° geometry step, back-face alpha 0.3 |
| Custom breakpoints | 810 / 1200 / 1400 |

## Things I'd do differently if porting

1. Size the WebGL canvas from the untransformed box (§4 caveat) — they're burning
   ~29 Mpx.
2. The comparison graph's `maxHeight = 520 * min(w/600, 1.4)` produces a 728px-tall
   bar on wide screens; check that against your own hero scale.
3. `scroll-behavior: smooth` on `html` plus a scrubbed `useScroll` transform can
   feel rubbery on anchor jumps — they get away with it because there's only one
   scrubbed element.
4. FAQ items lack `aria-controls`/`id` pairing and the panel isn't a labelled
   region; trivial to add.

## Confidence notes

- Every duration, easing array, px value and colour above was read out of the
  shipped source or measured from computed style — not inferred.
- `[GUESS]` — the choice of 5s for the counter reading as "synced" to the globe is
  my interpretation; there is no code linking them.
- `[GUESS]` — the "supported formats strip" in the brief is most likely the
  `payment-networks.svg` mark (§5a). I found no other logo strip in the DOM or the
  Home chunk. If you saw a moving one, it was the testimonial carousel (§5b),
  which sits near the *top* of the page, not above the FAQ.
- rAF-driven state (bar heights, counter value, globe frames) could not be observed
  live because this environment reports `document.hidden === true`; all such
  behaviour above is read from source, and the static geometry was cross-checked
  against measured DOM where possible (bar maxHeight 430/285 ✓, card scale 0.9 ✓,
  panel colour match ✓).
