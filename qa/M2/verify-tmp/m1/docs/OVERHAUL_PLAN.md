# Priceflag website overhaul plan

Oct 13, 2026 · Nithin Aruswamy

## Summary

priceflag.org says the right thing in its headline, but nothing on the page backs it up. The main call to action (CTA) goes nowhere, the page shows no product, and it gives no reason to believe the claim.

YC's design reviews and the best recent YC e-commerce sites point to five changes that matter most:

1. **Make the one CTA work.**
   - Both "Get a free price review" buttons link to `#`.
   - Wire them to a real form or a booking link.
   - Say what happens next ("we send your report in 48 hours").
2. **Show the product above the fold.**
   - Use a real Priceflag forecast screen with numbers a merchant would recognize: the breakeven sentence, the 90-day range and the SKU rollout stages.
   - 4 of 7 recent YC e-commerce sites do this. Intelligems, the closest competitor, does not.
3. **Turn the free price review into an interactive diagnostic.**
   - Add a small breakeven calculator to the page. The visitor enters price, cost and the change.
   - It answers: "you can lose up to X% of orders and still make the same profit."
   - That is our feat of strength, and it matches the YC pattern of free audits and calculators.
4. **Add proof, even if it's small:**
   - pilot store logos (with permission)
   - one quantified pilot result
   - our simulation numbers, clearly labeled as simulated
   - a founder section
   - a FAQ
5. **Say who it's for and stay honest about the beta.**
   - Name the buyer: "repeat-purchase Shopify brands."
   - Describe safety as it ships today: a tripped guardrail pauses the rollout and alerts the merchant.
   - Our meta description says "reverts it automatically," which overstates the beta.

The e-commerce deep dive adds three more changes:

- Label every number with its baseline and link a "How we measure" page.
- Publish a comparison page against Intelligems.
- Ship a Black Friday breakeven page by Nov 1. None of the 24 YC e-commerce sites we checked has Black Friday content.

The structure below is built so the pivot changes the words, not the layout. "What waits for the pivot" lists what depends on the new direction.

## What YC teaches about landing pages

YC's advice reduces to one rule: in five seconds a visitor should know what it is, whether it's for them, and what to click.

Most of the advice comes from YC's *Design Review* series with Aaron Epstein and guests (Garry Tan, Pete Koomen, Katie Dill, Karri Saarinen, Ryo Lu), plus talks by Kevin Hale and an essay by Paul Graham. YC doesn't publish transcripts, so the episode points come from third-party summaries. Only Paul Graham's essay is primary text.

| # | Principle | The small details | Source |
| --- | --- | --- | --- |
| 1 | Answer "What is this?" and "Is it for me?" at once | Ryo Lu adds "Does it work?" Visitors arrive with a finger on the Back button. | [Zain Ali review](https://www.ycombinator.com/library/Ix-critiquing-startup-websites-with-instacart-s-first-designer-zain-ali), [Paul Graham](https://paulgraham.com/startuplessons.html) |
| 2 | Explain it in one or two sentences | Kevin Hale's test: would your mom understand it? Lead with *what*, not *why*. | [Kevin Hale](https://summify.io/discover/kevin-hale-how-to-improve-conversion-rates-PGqX9f), [Paul Graham](https://paulgraham.com/startuplessons.html) |
| 3 | One headline, one subhead, one CTA at the top | Two equally weighted headlines got flagged. Don't mix "Try beta", "Learn more" and "Join waitlist". | [First impression test](https://summify.io/discover/does-your-startup-website-pass-the-first-impression-test-des-pqwOL6/), [Garry Tan review](https://www.ycombinator.com/blog/design-review-watch-aaron-and-garry) |
| 4 | Repeat the CTA down the page | Put it at the top, middle and bottom, or make it sticky. Praised: InEvent's sticky "Book a Meeting". | [Conversions review](https://www.ycombinator.com/blog/design-review-tips-for-increasing-conversions) |
| 5 | Say what happens after the click | "Book a demo" feels vague without who, how long and what you get. Specific CTAs like "View my savings" won. | [Ryo Lu review](https://summify.io/discover/cursor-head-of-design-roasts-startup-websites-RynySr/) |
| 6 | Show, don't tell. Show a feat of strength. | Walk through one real customer example. Demo the hard thing only you can do. | [Garry Tan review](https://www.ycombinator.com/blog/design-review-watch-aaron-and-garry), [Paul Graham](https://paulgraham.com/startuplessons.html) |
| 7 | Get to the "aha" fast | Put the CTA next to the magic moment. Don't wall value behind signup. | [Conversions review](https://www.ycombinator.com/blog/design-review-tips-for-increasing-conversions), [Kevin Hale](https://summify.io/discover/kevin-hale-how-to-improve-conversion-rates-PGqX9f) |
| 8 | Concrete numbers beat adjectives | "Save 29%" beats "save money". Avoid outcomes with no number attached. | [Garry Tan review](https://www.ycombinator.com/blog/design-review-watch-aaron-and-garry), [YC site redesign](https://summify.io/discover/how-we-redesigned-our-website-K5JoLA/) |
| 9 | Name the customer | Be specific about the ideal customer profile. One fintech was told to name the exact entity types it serves. | [Ryo Lu review](https://summify.io/discover/cursor-head-of-design-roasts-startup-websites-RynySr/) |
| 10 | One use case on the homepage | Move depth to other pages. Too many concepts confuse. | [Karri Saarinen](https://rosetta.to/u/ycombinator/brand-design-tips-from-linear-founder-karri-saarinen) |
| 11 | Use the customer's words, not jargon | Ask users to describe you, then use their exact words. | [Zain Ali review](https://www.ycombinator.com/library/Ix-critiquing-startup-websites-with-instacart-s-first-designer-zain-ali) |
| 12 | Don't be too clever | Clever taglines that confuse backfire. | [Garry Tan review](https://www.ycombinator.com/blog/design-review-watch-aaron-and-garry) |
| 13 | Trust matters most when money is involved | Show a logo, the real product, people and proof. Text gradients read as untrustworthy for finance. | [Epstein & Migicovsky](https://summify.io/discover/yc-sus-aaron-epstein-eric-migicovsky-website-feedback-MP32_y/) |
| 14 | Screenshots must be readable | Crop, zoom and annotate. A screenshot should work even if nobody plays the video. | [Katie Dill review](https://opentools.ai/youtube-summary/stripe-head-of-design-katie-dill-reviews-startup-websites) |
| 15 | Little motion, no scroll-jacking | No auto-sliding carousels, no hijacked scroll, no "scroll to explore". | [Katie Dill review](https://opentools.ai/youtube-summary/stripe-head-of-design-katie-dill-reviews-startup-websites), [Kevin Hale](https://summify.io/discover/kevin-hale-how-to-improve-conversion-rates-PGqX9f) |
| 16 | Polish signals trust; avoid the "AI slop" look | At most three type sizes. No purple glows or pill clutter. Consistent capitalization. | [Stephen Haney episode](https://finance.biggo.com/podcast/02e3364420ca66dc), [Ryo Lu review](https://summify.io/discover/cursor-head-of-design-roasts-startup-websites-RynySr/) |
| 17 | Be honest about pricing and the catch | Make pricing easy to find. "No credit card required" answers an objection. | [Kevin Hale](https://summify.io/discover/kevin-hale-how-to-improve-conversion-rates-PGqX9f), [Conversions review](https://www.ycombinator.com/blog/design-review-tips-for-increasing-conversions) |
| 18 | Show the founders and your story | Founder stories beat bare logo walls; YC's own site uses them. | [YC site redesign](https://summify.io/discover/how-we-redesigned-our-website-K5JoLA/) |
| 19 | Fit your stage | Don't over-polish an early product. Even logos of little-known customers prove you're not the first. | [Karri Saarinen](https://rosetta.to/u/ycombinator/brand-design-tips-from-linear-founder-karri-saarinen), [Zain Ali review](https://www.ycombinator.com/library/Ix-critiquing-startup-websites-with-instacart-s-first-designer-zain-ali) |
| 20 | Test it on real people | Have them say back what you do. Keep improving: users see the site as frames of an animation. | [Epstein & Migicovsky](https://summify.io/discover/yc-sus-aaron-epstein-eric-migicovsky-website-feedback-MP32_y/), [Paul Graham](https://paulgraham.com/startuplessons.html) |

On the YC badge the advice is mixed. One review warned it can crowd out your own brand. Another counted its absence as a trust gap. It only applies to us if we're accepted.

## What the best YC company pages actually do

Recent YC e-commerce and revenue tools follow one playbook:

- a mock product screen with real merchant numbers
- a free diagnostic as the CTA
- a FAQ that handles objections

We opened 16 homepages on Oct 13, 2026:

- 8 established YC companies
- 7 recent YC e-commerce or pricing companies
- Intelligems, the direct competitor (not YC)

| Pattern | How common | Best example |
| --- | --- | --- |
| Headline of 7 words or fewer; specifics go in the subhead | 14 of 16 | [Zaymo](https://www.zaymo.com): "One-click conversions in email" |
| Names the buyer in the hero ("for DTC", "consumer brands") | 4 of 7 recent | [Converge](https://www.runconverge.com): "The AI-native growth platform for DTC." |
| Product UI or an interactive element above the fold | 4 of 7 recent | [Handled](https://www.itshandled.ai): a Slack-style answer showing margin by channel |
| Mock UI uses domain-real numbers | Most of those | [Converge](https://www.runconverge.com): "Meta −8% CAC" |
| Free diagnostic, audit or calculator as the CTA | 3 of 7 recent, 0 of 8 established | [Corgi Labs](https://www.corgilabs.ai): revenue-leak calculator, "No call required" |
| FAQ on the homepage | 5 of 7 recent, 0 of 8 established | [Wildcard](https://wild-card.ai): "nothing publishes without approval" |
| Quantified customer results | 11 of 16 | [Vanta](https://www.vanta.com): a metric attached to each logo |
| Customer logos in the first two sections | 10 of 16 | [Zaymo](https://www.zaymo.com): logos tagged "Case study" |
| Time to value or how-it-works steps | 9 of 16 | [Alguna](https://alguna.com): Day 1 / Day 14 / Day 30 |
| Micro-copy under the CTA | 5 of 16 | [PostHog](https://posthog.com): "No credit card required" |
| YC badge near the hero | 3 of 7 recent, 0 of 8 established | [Wildcard](https://wild-card.ai): "Backed by Y Combinator" |
| Prices shown on the homepage | 2 of 16 | [Mercury](https://mercury.com): "$0/month" |
| Comparison pages ("vs X") in nav or footer | 3 of 16 | [Converge](https://www.runconverge.com): vs Northbeam, Triple Whale, Elevar |
| Closing CTA band before the footer | 15 of 16 | Nearly everyone |

The small details that separate the best from the rest:

- **Founder access as the CTA.** [Wildcard](https://wild-card.ai) uses "Talk to a founder". It's an advantage only early companies have.
- **Interactive proof, not claims:**
  - [Corgi Labs](https://www.corgilabs.ai): a calculator with three scenarios
  - [Anglera](https://www.anglera.com): a before/after slider
  - [Mercury](https://mercury.com): "Launch demo" with no signup
- **Honest labels on numbers:**
  - "Measured against a holdout period" ([Corgi Labs](https://www.corgilabs.ai))
  - "sample data" ([PostHog](https://posthog.com))
  - footnoted claims ([Mercury](https://mercury.com))
- **Seasonal hooks for Shopify.** [Intelligems](https://www.intelligems.io) puts a "BFCM Hub" in its main nav. Black Friday is when merchants rethink prices.
- **Free tools as lead magnets.** [Anglera](https://www.anglera.com) offers an AI Readability Grader and [Alguna](https://alguna.com) an invoice generator.
- **Even funded YC sites ship mistakes:** placeholder `#` items, a dummy counter, typos, and an H1 that doesn't match the page title. Getting the basics right already sets you apart.

**Where Intelligems leaves an opening:**

- Its hero shows no product UI.
- Its headline and subhead never say "Shopify".
- Its pitch is testing ("Test pricing, offers, content, and more"), which needs traffic splits and weeks of data. Ours is a safe, staged rollout where every shopper sees the same price.

## Deep dive: 24 more YC e-commerce companies

YC companies that sell to brands follow three habits. They lead with a demo. They prove results with percentage lifts at named brands. They almost never put "Shopify" in the headline.

- We opened 24 more homepages on Oct 13, 2026. Each one is confirmed as YC on its YC directory page.
- 11 are Shopify and DTC apps. 13 are ops, finance, forecasting and agentic-commerce tools.
- We read the pages as text, so where something sits on screen (such as above the fold) is inferred.

| Company | Batch | What it does | Hero headline | Main CTA | Standout detail |
| --- | --- | --- | --- | --- | --- |
| [Skio](https://skio.com) | S20 | Subscriptions | "The fastest-growing CPG brands scale subscriptions with Skio." | Get a demo | 3-step migration from competitors; prefilled "Request an AI summary" links for ChatGPT and Claude |
| [Postscript](https://postscript.io) | W19 | SMS and email retention | "Retention, Rebuilt" | Book a Demo | Banner: "Skip the pitch and watch the demo"; free SMS Audit tool |
| [Shogun](https://getshogun.com) | W18 | Page builder and A/B testing | "Sell more with better post-click experiences" | Start converting (App Store) | Three product screenshots in the hero; CRO benchmark report |
| [Awtomic](https://www.awtomic.com) | S20 | Subscriptions | "the ultimate repeat purchase platform." | Get the app | "We automagically migrate subscriptions from ReCharge, Bold" |
| [Zoko](https://www.zoko.io) | W21 | WhatsApp commerce | "A complete WhatsApp platform for Shopify Brands" | Install on Shopify | Only one naming Shopify in the hero; shows 4.9 App Store rating; "7-day FREE Trial" under CTA |
| [REVER](https://itsrever.com) | S22 | Returns | "giving superpowers to" + rotating words | Turn returns into revenue | Dashboard mock: "157 returns processed & retained €25,000" |
| [OneText](https://onetext.com) | W23 | Text-to-buy SMS | "20% More Revenue Per Campaign. Guaranteed." | Try OneText (store URL field) | Live text-to-buy demo by QR code; the guarantee is never explained |
| [Yuma AI](https://yuma.ai) | W23 | AI support agents | "Every stage of the customer journey, handled by the right AI agent" | Book a Demo | Pay only per ticket resolved; Free CX Audit; compare pages vs Gorgias AI and others |
| [SureBright](https://surebright.com) | S24 | Product protection | "Offer customized product protection to your customers in 10 minutes. Zero cost. Zero effort." | Get started | Merchant earns a revenue share; "20.2% average attach rate (10–64%)" |
| [Pango](https://pango.ai) | S26 | Shipping and returns agents | "Shipping and returns on autopilot" | Book a Demo | FAQ names Aftership, Loop, Redo; free tier; "Free Operation Strategy Action Plan" widget |
| [Kinect](https://www.trykinect.ai) | Spring 26 | AI storefront personalization | "Your storefront, adapted to every shopper." | Book a demo | "Live in a day." under CTA; "4–7% … against each brand's own baseline" with a "How we measure" page |
| [FlyCode](https://www.flycode.com) | S22 | Failed-payment recovery | "Churn from failed payments hurts your ARR" | Get Started | Self-check calculator; charges only on dollars recovered |
| [Cenote](https://www.joincenote.com) | W25 | AI checkout recovery calls | "Every person, fully understood" | Book a demo | "Go live in 7 days, opt out anytime." + "Backed by Y Combinator" under CTA |
| [BetterBasket](https://www.betterbasket.com) | W24 | Grocery pricing and promotions | "The AI platform for grocery merchandising" | Speak to an expert | Closest to us: "6% margin uplift — on optimized SKUs vs. baseline, normalized for market trends"; UI shows "$3.50, +14% units" |
| [autone](https://autone.io) | S22 | Inventory and margin decisions | "Success is back in stock." | Book a demo | ROI calculator gated by work email; "glass box, not a black box" |
| [Confido](https://www.confidotech.com) | S21 | CPG finance and trade promotion | "Confido helps the best in CPG grow better" | Book a Demo | Results in dollars: "$325K saved and paid for itself in one year"; "See the demo on your first call" |
| [Corvera](https://www.corvera.ai) | W26 | AI sales agent for CPG | "The AI sales intelligence agent for CPG brands." | Schedule demo | UI dense with real numbers ("23 stores went dormant this week"); "Full audit log" |
| [Synder](https://synder.com) | S21 | E-commerce bookkeeping | "Accounting Automation Software for Retail, Ecommerce and SaaS" | Book a demo | 4.7 from 3,400+ reviews; badge wall incl. YC; "vs. Alternatives" pages |
| [Spherecast](https://www.spherecast.ai) | S24 | Supply planning for CPG | "Agentic Supply Chain Planning for Omni-Channel CPG Brands" | Book a Demo | Only founder section in the sample; free sandbox; 30-day money-back guarantee; "Every forecast method is explained in the app" |
| [Metreecs](https://www.metreecs.com) | F24 | Demand forecasting | "Optimizing inventory at scale with AI" | Get a demo | Warning sign: a 92% accuracy claim next to placeholder testimonials |
| [Channel3](https://trychannel3.com) | S25 | Product data for AI shopping agents | "Where agents find products" | One card per audience | Market stats credited to Stripe, Adobe, McKinsey |
| [Presti AI](https://www.presti.ai) | S24 | AI product imagery | "Your team's visual production, on autopilot." | Start now for free | Prices shown: Free, $49/mo; "Nothing goes live without sign-off" |
| [Fleek](https://www.joinfleek.com) | W22 | Wholesale marketplace | "Where resellers source their best inventory" | Download the app | "Buyer protection on every order" |
| [ShipBob](https://www.shipbob.com) | S14 | Fulfillment | "Chaos-proof your fulfillment with ShipBob." | Get A Quote | "99.97% accuracy rate" backed by a public Performance Data page |

We couldn't confirm these as YC and left them out: Gorgias, Triple Whale, Rebuy, Tapcart, Okendo, Recharge and Redo. The one YC pricing tool for brands we found, Luca (W23), is inactive.

## What the e-commerce sample adds

Selling to merchants rewards three things the first sample underplayed:

- showing exactly how each number was measured
- going after the incumbent openly
- tying price to results

The counts below are across the 24 companies above.

| Pattern | How common | What it means for us |
| --- | --- | --- |
| Demo, call or quote as the main CTA | 17 of 24 | Founder-led is normal at our stage. Pair it with a path that needs no call (the calculator), like Spherecast's sandbox. |
| "Shopify" named in the hero | 1 of 24 (Zoko) | An opening, not a rule. For a Shopify-only product, naming it answers "is it for me?" faster than a logo strip we don't have yet. |
| Named-brand % or $ results | 17 of 24 | One real pilot result with the store's name beats any aggregate claim. |
| Logo strip under the hero | 21 of 24 | Our proof strip needs pilot logos; get written permission now. |
| Time-to-live claim | 14 of 24 | "Connected in 5 minutes. First forecast the same day." Only if true. |
| Competitor comparison pages or named rivals | 10 of 24 | A "Priceflag vs Intelligems" page: the same price for every shopper vs split testing. |
| Free audit, calculator or sandbox | 11 of 24 | Our breakeven calculator fits; most others gate it behind email. Show the answer first, then ask. |
| Pricing tied to results (per order, % recovered, revenue share) | 6 of 11 Shopify apps | Consider "free until a rollout makes you money" or a small share of measured profit lift. |
| Prices shown on the homepage | 1 of 24 (Presti) | A Pricing link with a simple model is enough. Hiding it entirely reads as enterprise. |
| Migration offer from a competitor | 4 of 11 Shopify apps | "Already testing prices with Intelligems? We import your test results as forecast inputs." Only if we build it. |
| "Backed by Y Combinator" near the hero | 6 of 12 companies from 2023 or later, 0 of 12 older | Relevant only if accepted. |
| BFCM content | 0 of 24 | Open lane: a "Before you discount for Black Friday" breakeven page, live by Nov 1. |

**How money and forecast tools earn trust.** This matters most for us, because we ask merchants to believe a forecast.

- **Define the baseline next to the number.**
  - [BetterBasket](https://www.betterbasket.com): "6% margin uplift — on optimized SKUs vs. baseline, normalized for market trends."
  - [Kinect](https://www.trykinect.ai) links a "How we measure" page.
- **Use ranges, not single numbers.** autone shows "3% to 5%" and Kinect "4–7%". We already forecast as a range; say so plainly.
- **Explain the method in the product.**
  - Spherecast: "Every forecast method is explained in the app."
  - autone: "glass box, not a black box."
  - This matches our confidence tiers.
- **Put control in writing.**
  - Presti: "Nothing goes live without sign-off."
  - Corvera: "Full audit log."
  - Ours: you approve every change, and every change is journaled and reversible.
- **Lower the risk of trying us.** Spherecast gives a 30-day money-back guarantee. No one offers a performance guarantee, which leaves room for us.
- **Avoid what breaks trust.** One sloppy number discounts every honest one. For example:
  - Metreecs puts a precise 92% accuracy claim beside placeholder testimonials.
  - autone labels −80% as an "increase".

**What Priceflag should borrow (also added to the new page below):**

1. A "How we measure" page linked from the results section. It explains the 90-day window, the baseline, the confidence tiers, and what "simulated" means.
2. A UI mock in the hero dense with real merchant numbers, in the style of Corvera and BetterBasket: "$24 → $27 on 12 SKUs. Breakeven: lose up to 11% of orders."
3. A "Priceflag vs Intelligems" comparison page, then one for "vs changing prices in bulk".
4. A Black Friday breakeven page by Nov 1. No company in the sample uses this seasonal hook.
5. Founder access in the CTA ("Talk to a founder"). Only Spherecast has a real founder section; everywhere else, the buyer talks to a sales rep.

## Audit of priceflag.org today

The homepage passes YC's "what is it" test but fails "is it for me", "does it work" and "what do I click". This audit covers the live site and `index.html` in [Priceflag/website](https://github.com/Priceflag/website), checked Oct 13, 2026.

| Area | What's there now | Verdict | Change |
| --- | --- | --- | --- |
| Headline | "Change your store's prices without losing sales." | Good: clear, outcome-led, 8 words | Keep the idea. Test a version that names the buyer. |
| Subhead | "forecasts each price change, rolls it out gradually … reverts it on its own if it stops paying" | Clear, but "reverts on its own" overstates the beta | Say "pauses and alerts you" until automatic rollback ships. |
| Primary CTA | "Get a free price review" (twice) | Right offer, but both link to `#` | Wire to a form or booking link. Add what happens next. |
| Secondary CTA | "See how it works" | Links to `#` | Point to an on-page demo section or a 60-second video. |
| Above the fold | Hero image, no product | Fails "show, don't tell" | Replace with a cropped, readable forecast screen. |
| Buyer | "Works with Shopify & more"; heading "A tool for Shopify & more" | "& more" is vague, and "Works with" and "Shopify" run together | Name the buyer: repeat-purchase Shopify brands. Drop "& more" until it's true. |
| Banner | "AI Pricing: Built for Shopify stores. See it work" | Links to `#`. "AI Pricing" contradicts the no-black-box positioning. | Remove it, or use it for one real announcement. |
| Proof | None: no logos, numbers, testimonials or case studies | The biggest gap for a tool that touches revenue | Add pilot proof and labeled simulation results (see "The new page"). |
| Team | Only a YouTube link ("Team ↗") | The founders don't appear on the page | Add a founder strip with faces, names and one line each. |
| FAQ | Nav link goes to `#`. A `pf-faq.js` section exists but isn't visible on the live page. | Objections go unanswered | Ship the FAQ section (questions in "The new page"). |
| Unused sections | The page loads the `pf-demo`, `pf-workflow`, `pf-compare`, `pf-waitlist` and `pf-hero-logos` scripts, but none shows on the live page | Built work not shipping | Review each; ship the demo, workflow and FAQ, and cut the rest. |
| Footer | Partners, Demo and Home go to `#`. Tagline "Built by Humans in San Francisco, CA" | Dead links hurt trust | Remove or wire every link. |
| Meta | `<title>` is just "Priceflag". The description says "reverts it automatically". | Weak search snippet; the claim overstates the beta | Title: "Priceflag — Change Shopify prices safely". Fix the claim. |
| Images | Hero and summit images have empty `alt` text | Accessibility and SEO miss | Add descriptive alt text. |
| Domain | priceflag.org | YC reviewers once flagged a .org domain on a for-profit company | Low priority. Consider priceflag.com or getpriceflag.com if available. |

## The new page, section by section

Eleven blocks run from the nav to the closing band. One CTA ("Get my free price review") appears four times, and every section has a job. The draft copy describes today's product; the pivot may change the words.

1. **Top bar (nav).**
   - Order: logo, How it works, FAQ, Founders, Sign in, then the CTA button.
   - Drop About, Partners and Demo from the nav until those pages exist.
2. **Hero: what it is, who it's for, and one action.**
   - **Headline:** "Change your Shopify prices without losing sales."
   - **Subhead:** "See a price change's 90-day impact before it goes live. Roll it out a few products at a time, and we pause it the moment it stops paying."
   - **CTA:** "Get my free price review". Under it: "Free. We send your report within 48 hours. No app install needed." Only claim what we deliver.
   - **Secondary text link:** "Talk to a founder"
   - **Visual:** a cropped, readable forecast screen showing the breakeven sentence, the 90-day range and the 25% → 50% → 100% SKU stages. Use realistic numbers (e.g. $24 → $27).
3. **Proof strip.**
   - Pilot store logos if the stores agree; otherwise "Working with 5 Shopify brands in our pilot".
   - If we're accepted to YC, a small badge goes here.
4. **The problem, in merchants' words.** Three short lines:
   - You haven't changed prices in a year because it's scary.
   - When you do, it goes store-wide at once.
   - You find out it hurt weeks later in your P&L.

   Replace these with real quotes from pilot calls.
5. **How it works: 4 steps, one readable screenshot each.**
   1. Connect Shopify (free, 5 minutes).
   2. Propose a price.
   3. See the forecast and the breakeven.
   4. Roll out by SKU cohort, with guardrails set before launch.
6. **The breakeven calculator (feat of strength).** This is the most important new build.
   - **Inputs:** current price, new price, unit cost.
   - **Output:** "You can lose up to 14% of orders and still make the same profit."
   - **Button:** "Get the full forecast for my store", which goes to the review form with the inputs prefilled.
7. **Why Priceflag is different (comparison).** Compare against "price A/B testing" and "changing it all at once" on three points:
   - Every shopper sees the same price, so there are no product-feed mismatches or angry screenshots.
   - It works without weeks of split traffic.
   - Every change is journaled and reversible.

   Link to a full "Priceflag vs Intelligems" page; 10 of 24 YC e-commerce sites run comparison pages.
8. **Results.**
   - One real pilot result, with the store's name and permission.
   - Our [simulation results](https://github.com/nithinaru/priceflag/blob/main/docs/SIMULATION_RESULTS.md), clearly labeled "in simulation": the forecast range held the real outcome in 93% of test rollouts, and demand shocks were caught by day 6 on median.
   - Put the baseline beside each number, and link a "How we measure" page covering the 90-day window, the baseline and the confidence tiers.
9. **Founders.**
   - Photos, names and one line each: Nithin (AI engineering, forecasting models) and Kabir (Shopify merchant work, pricing research).
   - Add "We read every reply" and a direct email.
10. **FAQ (6–8 questions):**
    - Will shoppers see different prices? (No.)
    - Do you change prices automatically? (Not without your approval; in the beta, a tripped guardrail pauses the rollout and alerts you.)
    - What data do you read?
    - How accurate is the forecast?
    - What does it cost?
    - How long does setup take?
    - Can I undo everything?
    - What about subscriptions?
11. **Closing CTA band.** "See what your next price change will do." Same button and same micro-copy as the hero.

**Design rules for the build:**
- At most three type sizes.
- No auto-playing carousels or scroll-jacking.
- Screenshots cropped to the part that matters.
- Motion only where it explains something, such as the rollout stages advancing.

## Fixes to ship this week

None of these depend on the pivot, and together they take about a day. Tick them off as they ship.

**Broken or misleading**

- [ ] Wire both "Get a free price review" buttons to a real form (Tally, a Google Form, or the existing `integrations/waitlist-sheet.gs`) and send a confirmation email.
- [ ] Fix or remove every `#` link: the logo, FAQ, "See how it works", the AI Pricing banner, and Home, Partners and Demo in the footer.
- [ ] Change "reverts it on its own" and "reverts it automatically" (hero and meta description) to "pauses and alerts you" while automatic rollback is off in the beta.
- [ ] Fix "Works withShopify & more": add the missing space, and drop "& more" until a second platform exists.
- [ ] Remove or rewrite the "AI Pricing" banner.

**Search and sharing**

- [ ] Set the `<title>` to "Priceflag — Change Shopify prices safely" (under 60 characters).
- [ ] Use one phrasing ("forecast" or "simulate") across the og:title, the og:image alt text and the on-page copy.
- [ ] Give the meta description and og:description distinct wording, each under 155 characters.
- [ ] Check that `sitemap.xml` lists only live pages.

**Accessibility and speed**

- [ ] Add alt text to `hero-new.png` and `uploads/summit-lime.webp`.
- [ ] Serve the hero as WebP/AVIF at the right size; a YC review flagged heavy hero images on mobile.
- [ ] Check contrast on buttons and small text, and test at 375 px width.
- [ ] Run Lighthouse; target 90+ for mobile performance and accessibility.

**Housekeeping in the repo**

- [ ] Decide on each unused section in `sections/` (demo, workflow, compare, waitlist, hero-logos): ship it or delete it.
- [ ] Move `experiments/` out of the deployed build, or add it to `.vercelignore`.
- [ ] Point the Vercel project at `Priceflag/website` instead of the personal repo, then archive the old one.

## What waits for the pivot

The layout stays; the pivot decides the words in five places. Hold these until the new direction is settled. Ship the fixes list now.

| Decision | Why it matters for the page | Where it lands |
| --- | --- | --- |
| Who the buyer is | YC's first test is "is it for me?" The hero must name them. | Hero headline and subhead, problem section, FAQ |
| The one use case to lead with | One use case per homepage; the rest go to subpages | Hero visual, how-it-works steps |
| The feat of strength | The calculator or demo has to show the hard thing we do best | New page item 6 (calculator) |
| Self-serve or founder-led sales | Decides the CTA: "Install free", "Get my free review" or "Talk to a founder" | Every CTA and its micro-copy |
| Platform scope | "Shopify" vs "Shopify & more" changes the headline and the proof | Hero, proof strip, nav |

Open question: which pivot option are you leaning toward? Send the options over and I'll redraft the hero (item 2), how it works (item 5) and the calculator (item 6) for each.

## Rollout

Ship in three passes over about two weeks, then test with merchants. Judge the result by one number: the share of visitors who request a price review.

1. **Days 1–2: fix what's broken.**
   - Owner: Nithin.
   - Everything in the fixes list.
   - The site starts capturing leads it currently loses to `#` links.
2. **Days 3–7, after the pivot call: rewrite and reshoot.**
   - Owners: Kabir on copy and merchant quotes, Nithin on screenshots and the build.
   - New hero copy, product screenshots, how it works, FAQ and the founder strip.
3. **Days 8–14: build the calculator and add proof.**
   - Owner: Nithin.
   - The breakeven calculator, the comparison block, pilot logos once approved, and labeled simulation results.
4. **Then test it on five people.** This is YC's think-aloud advice.
   - Show the page to five Shopify merchants for 5 seconds.
   - Ask what Priceflag does and who it's for.
   - Fix whatever they get wrong.

**How to measure:**
- Add privacy-friendly analytics (Vercel Web Analytics or Plausible).
- Track four numbers: visitors, CTA clicks, completed review requests, and calculator uses.
- Kevin Hale, speaking at YC, cites roughly 3% visitor-to-signup as average for freemium SaaS; a free review should beat that.
