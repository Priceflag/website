# M1 requirements (from docs/OVERHAUL_PROMPT.md "M1: fixes" and docs/OVERHAUL_PLAN.md "Fixes to ship this week")

- CTA: wire every CTA to a working form. If no endpoint works, use a mailto: fallback and log it. Say what happens next.
- Dead links: remove or wire every `#` link (logo, FAQ, "See how it works", the AI Pricing banner, Home, Partners and Demo in the footer).
- Honesty: change "reverts it on its own" / "reverts it automatically" (hero and meta description, and anywhere else) to "pauses and alerts you". Rollouts are by SKU cohort 25% → 50% → all, never by visitor.
- Typo: fix "Works withShopify & more"; drop "& more".
- Banner: remove the "AI Pricing" banner.
- Meta: `<title>` "Priceflag — Change Shopify prices safely" (< 60 chars); one phrasing ("forecast" or "simulate") across og:title, og:image alt and on-page copy; meta description and og:description distinct, each < 155 chars.
- Accessibility: alt text on hero-new.png (now uploads/hero-*.webp) and uploads/summit-lime.webp.
- Serve the hero as WebP/AVIF at the right size. Check contrast on buttons and small text; test at 375 px. Lighthouse mobile 90+ for perf and a11y (DoD: all 4 categories, every changed page).
- Sitemap: lists only live pages.
- Deploy hygiene: `experiments/` in `.vercelignore`.
- Housekeeping: decide on each unused section in sections/ (ship or delete).
- Plus the full Definition of Done in docs/OVERHAUL_PROMPT.md.
- Known environment limit: Playwright Firefox cannot launch on this machine (see OVERHAUL_LOG.md); verify the claim yourself.
