# priceflag-website

Static site deployed on Vercel. No build step: the files in this repo are the files that
get served.

## Why the notes live here and not in `vercel.json`

`vercel.json` is validated against <https://openapi.vercel.sh/vercel.json>, and that schema
sets `"additionalProperties": false` at the top level *and* on each entry of a
`headers[].headers[]` array. A `"//"` comment key in either place is rejected at deploy time
with `should NOT have additional property '//'`, so the explanations that used to sit in the
config are written down here instead. JSON comments (`//`, `/* */`) are not accepted either.

## `vercel.json`

### The sign-in host

`signin.priceflag.org` is served from this same static project rather than a second one: the
sign-in screen shares the marketing site's fonts, palette and images, and splitting it out
would mean keeping two copies of all of that in step for one HTML file.

The host-conditional rewrite is what makes the split work: the root of
`signin.priceflag.org` renders `signin.html`, while `priceflag.org` keeps its own
`index.html` untouched.

**Verify this on a preview deployment before relying on it.** The Vercel docs state, of
`rewrites`, that "precedence is given to the filesystem prior to rewrites being applied" —
and `/` already resolves to `index.html` from the filesystem on a static project. If
`signin.priceflag.org/` comes back with the marketing page, the filesystem won a
`source: "/"` rewrite, and the rule has to move into a top-level `routes` entry
(`{ "src": "/", "has": [...], "dest": "/signin.html" }`), which is evaluated ahead of the
filesystem.

### The security headers

The CSP says: the page loads Google Fonts and one image, and talks to the app. Nothing else,
and it may not be framed — a sign-in screen inside somebody else's iframe is a phishing
surface. `form-action 'none'` is intentional: the form is submitted with `fetch`, so a
scripting failure fails closed rather than posting the address somewhere.

The block is declared twice, once for `source: "/signin.html"` and once for `source: "/"`
conditioned on the sign-in host. `headers` match the *incoming* request path, so a visit to
`signin.priceflag.org/` never sees a rule written against `/signin.html`; the direct
`priceflag.org/signin.html` URL needs the first rule. Keep the two `value` strings identical.

## Verifying the sign-in seam

### The e2e harness (no npm install needed)

`scripts/e2e-signin.mjs` exercises the sign-in page end-to-end. It is a plain node
script, not a test-runner project — there is no `package.json` and nothing to install:

```bash
node scripts/e2e-signin.mjs
```

`--local-only` runs just the hermetic browser suite; `--live-only` runs just the
deployed-site checks. The local suite serves the working tree over loopback, drives it
with Playwright, and **aborts every non-loopback request** — the magic-link POST is
intercepted and stubbed, so no request ever reaches the real endpoint and no email is
ever sent. It asserts: form validation, the exact POST body (including `?next=`
forwarding and the rejection of host-escaping `next` values), all six `?error=` messages,
the `?signed_out=1` notice, server-error and network-failure recovery, and the
query-string strip.

Playwright comes from the globally available copy (the script falls back to the
`dev-browser` bundle under `/opt/homebrew/lib/node_modules` when bare `playwright` does
not resolve); Chromium is already in `~/Library/Caches/ms-playwright`.

The live suite is request-level (no browser): it checks that `signin.priceflag.org/`
actually serves `signin.html` (not `index.html` — see the filesystem-precedence note
above), that `priceflag.org/signin.html` carries its canonical + noindex, that the CSP
lands on the wire, and that the app's magic-link endpoint is reachable. Checks whose
infrastructure is not up yet report `BLOCKED` with a reason rather than failing.

### What only a human can verify

Requesting a magic link sends a real email through Supabase, so the last mile is a
manual walk-through — see the checklist in the section below. Run it once against a
mailbox you own after any change to this page, the `vercel.json` routing, or the app's
auth callback.

### Full-flow smoke checklist (human, real mailbox)

1. Open `https://signin.priceflag.org/` in a normal browser window. Confirm the
   sign-in page renders (not the marketing page), the padlock is clean, and the
   browser console shows no CSP violations.
2. Enter a mailbox you own, submit, and confirm the "Check your email" state shows
   the address you typed.
3. Open the email, confirm the sender and that the link points at
   `dashboard.priceflag.org`, and click it **in the same browser** — you should land
   signed in.
4. Repeat, but open the link in a **different browser** (or a private window): you
   should land back on the sign-in page with the "different browser" explanation
   (`link_unbound`), not signed in.
5. Click the same link a second time in the original browser: expired/used message
   (`link_invalid` or `link_expired`), not signed in.
6. Start from `https://signin.priceflag.org/?next=/settings`, complete sign-in, and
   confirm you land on `/settings` on the dashboard.
7. Visit a protected dashboard page while signed out and confirm the redirect back to
   the sign-in page shows "Please sign in to open that page."

## Indexing

`signin.html` carries `noindex, follow` and is deliberately absent from `sitemap.xml`.
`robots.txt` allows crawling, which is required — a `Disallow` would stop crawlers from
fetching the page and therefore from ever seeing the `noindex`.
