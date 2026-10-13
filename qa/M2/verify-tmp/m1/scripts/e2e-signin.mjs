#!/usr/bin/env node
/* =============================================================================
   e2e-signin.mjs — end-to-end checks for signin.html

   Run with plain node (no test runner):

       node scripts/e2e-signin.mjs               # local + live
       node scripts/e2e-signin.mjs --local-only  # hermetic browser suite only
       node scripts/e2e-signin.mjs --live-only   # request-level prod probes only

   LOCAL SUITE: serves the repo directory over a loopback HTTP server, drives a
   headless Chromium via Playwright, and intercepts every request the page makes.
   Nothing leaves the machine: a catch-all route aborts anything that is not the
   loopback server, and the magic-link endpoint is fulfilled from a stub. No real
   POST can ever reach dashboard.priceflag.org from this suite, by construction.

   LIVE SUITE: probes of the deployed hosts. fetch() first; when the edge
   answers with a Vercel Security Checkpoint (403 + x-vercel-mitigated:
   challenge — bot filtering, seen live on 2026-08-13), the probe retries in a
   real headless Chromium, which can run the checkpoint's JS and land on the
   actual page. Each probe reports PASS / FAIL / BLOCKED — BLOCKED meaning the
   infrastructure is not there yet (DNS missing, rewrite not deployed,
   protection on, or a challenge that will not resolve headlessly), which is
   not a failure of the page. The live suite NEVER posts an email address
   anywhere; the send flow is only exercised locally against the stub.

   Exit code: 0 iff there are no FAILs. BLOCKED does not fail the run.
   ========================================================================== */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* ---------------------------------------------------------------------------
   Playwright import. `playwright` is not installed in this repo and the bare
   specifier does not resolve from here, so fall back to the machine's known
   global copy (the dev-browser tool's bundled playwright, chromium already
   downloaded). First candidate that imports wins.
   ------------------------------------------------------------------------ */
async function loadPlaywright() {
  const candidates = [
    'playwright',
    '/opt/homebrew/lib/node_modules/dev-browser/node_modules/playwright/index.mjs',
  ];
  const errors = [];
  for (const spec of candidates) {
    try {
      return await import(spec);
    } catch (err) {
      errors.push(`  ${spec}: ${err.message}`);
    }
  }
  throw new Error('Could not import playwright from any candidate:\n' + errors.join('\n'));
}

/* ---------------------------------------------------------------------------
   Result collection and reporting
   ------------------------------------------------------------------------ */
const results = []; // { name, status: 'PASS'|'FAIL'|'BLOCKED', detail }

function record(name, status, detail = '') {
  results.push({ name, status, detail });
}

/* Run an assertion body; any thrown error becomes a FAIL with the message. */
async function check(name, fn) {
  try {
    await fn();
    record(name, 'PASS');
  } catch (err) {
    record(name, 'FAIL', err.message);
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function printSummary() {
  const width = Math.max(...results.map((r) => r.name.length)) + 2;
  console.log('\n' + '='.repeat(width + 40));
  console.log('SUMMARY');
  console.log('='.repeat(width + 40));
  for (const r of results) {
    const tag = r.status === 'PASS' ? 'PASS   ' : r.status === 'FAIL' ? 'FAIL   ' : 'BLOCKED';
    const line = `${r.name.padEnd(width)} ${tag}`;
    console.log(r.detail ? `${line} ${r.detail}` : line);
  }
  const fails = results.filter((r) => r.status === 'FAIL').length;
  const blocked = results.filter((r) => r.status === 'BLOCKED').length;
  const passes = results.filter((r) => r.status === 'PASS').length;
  console.log('-'.repeat(width + 40));
  console.log(`${passes} passed, ${fails} failed, ${blocked} blocked`);
  return fails;
}

/* ---------------------------------------------------------------------------
   Tiny static file server for the worktree, so signin.html loads over http://
   (URLSearchParams + fetch + history.replaceState behave realistically; file://
   would not do). Ephemeral port, loopback only.
   ------------------------------------------------------------------------ */
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

function startServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let filePath = path.normalize(path.join(ROOT, urlPath));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end();
      return;
    }
    if (urlPath === '/') filePath = path.join(ROOT, 'index.html');
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, { 'content-type': MIME[path.extname(filePath)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/* ===========================================================================
   LOCAL SUITE
   ======================================================================== */

const MAGIC_LINK = 'https://dashboard.priceflag.org/api/auth/magic-link';

async function runLocalSuite() {
  const { chromium } = await loadPlaywright();
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });

  /* Open signin.html with the given query string in a fresh context.
     Every context gets:
       - a catch-all route that aborts anything not on our loopback server,
         so no request from the page can ever reach the real network;
       - a magic-link route (registered last, so it takes precedence) that
         records the request and fulfills it from `respond` (default 200 ok).
     `posts` collects every request that hit the magic-link route, so tests can
     assert both "exactly one POST" and "no POST at all". */
  async function open(query = '', respond = null) {
    const context = await browser.newContext();
    const posts = [];
    await context.route('**/*', (route) => {
      if (route.request().url().startsWith(base)) return route.continue();
      return route.abort(); // fonts, hero image, anything external: dropped
    });
    await context.route(MAGIC_LINK, async (route) => {
      posts.push({
        method: route.request().method(),
        headers: route.request().headers(),
        body: route.request().postData(),
      });
      if (respond) return respond(route);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });
    const page = await context.newPage();
    await page.goto(`${base}/signin.html${query}`, { waitUntil: 'domcontentloaded' });
    return { context, page, posts };
  }

  /* Fill the email field and submit, then wait for the page to settle by
     waiting for either the sent state or an error message to be visible. */
  async function submitEmail(page, address) {
    await page.fill('#pf-email', address);
    await page.click('#pf-submit');
    await page.waitForSelector('#pf-sent:not([hidden]), #pf-error:not([hidden])', { timeout: 5000 });
  }

  /* ---- (a) page loads, heading, form visible ---------------------------- */
  await check('local: page loads with heading and visible form', async () => {
    const { context, page } = await open();
    const h1 = (await page.textContent('h1')).trim();
    assert(h1 === 'Sign in to Priceflag', `unexpected h1: ${JSON.stringify(h1)}`);
    assert(await page.isVisible('#pf-form'), 'form is not visible');
    assert(await page.isHidden('#pf-sent'), 'sent state should start hidden');
    assert(await page.isHidden('#pf-error'), 'error box should start hidden');
    await context.close();
  });

  /* ---- (b) client-side validation, no network --------------------------- */
  await check('local: empty submit shows validation error, no request', async () => {
    const { context, page, posts } = await open();
    await page.click('#pf-submit');
    await page.waitForSelector('#pf-error:not([hidden])', { timeout: 5000 });
    const msg = (await page.textContent('#pf-error')).trim();
    assert(msg.length > 0, 'error box is empty');
    assert(posts.length === 0, `expected no request, saw ${posts.length}`);
    await context.close();
  });

  for (const bad of ['foo', 'foo@bar']) {
    await check(`local: bad email ${JSON.stringify(bad)} rejected client-side, no request`, async () => {
      const { context, page, posts } = await open();
      await submitEmail(page, bad);
      assert(await page.isVisible('#pf-error'), 'error box not shown');
      assert(await page.isHidden('#pf-sent'), 'sent state must not show for a bad address');
      assert(posts.length === 0, `expected no request, saw ${posts.length}`);
      await context.close();
    });
  }

  /* ---- (c) happy path: one POST, correct shape, sent state, pf-again ---- */
  await check('local: valid email sends exactly one well-formed POST', async () => {
    const { context, page, posts } = await open();
    await submitEmail(page, 'test@example.com');
    assert(posts.length === 1, `expected 1 request, saw ${posts.length}`);
    const req = posts[0];
    assert(req.method === 'POST', `method was ${req.method}`);
    assert(
      (req.headers['content-type'] || '').includes('application/json'),
      `content-type was ${req.headers['content-type']}`
    );
    const body = JSON.parse(req.body);
    assert(body.email === 'test@example.com', `email in body was ${JSON.stringify(body.email)}`);
    assert(!('next' in body), 'body must not contain next when ?next= was absent');

    // sent state replaces the form and echoes the address
    assert(await page.isHidden('#pf-form'), 'form should hide after success');
    assert(await page.isVisible('#pf-sent'), 'sent state should show after success');
    const shown = (await page.textContent('#pf-sent-address')).trim();
    assert(shown === 'test@example.com', `sent address shows ${JSON.stringify(shown)}`);

    // "Use a different address" returns to a cleared form
    await page.click('#pf-again');
    assert(await page.isVisible('#pf-form'), 'form should return after pf-again');
    assert(await page.isHidden('#pf-sent'), 'sent state should hide after pf-again');
    assert((await page.inputValue('#pf-email')) === '', 'email field should be cleared');
    await context.close();
  });

  /* ---- (d) valid ?next= is forwarded as pathname+search ------------------ */
  await check('local: valid ?next=/settings?tab=billing forwarded in body', async () => {
    const { context, page, posts } = await open('?next=%2Fsettings%3Ftab%3Dbilling');
    await submitEmail(page, 'test@example.com');
    assert(posts.length === 1, `expected 1 request, saw ${posts.length}`);
    const body = JSON.parse(posts[0].body);
    assert(body.next === '/settings?tab=billing', `next was ${JSON.stringify(body.next)}`);
    await context.close();
  });

  /* ---- (e) malicious ?next= values are dropped ---------------------------
     These all RESOLVE (per WHATWG URL, which treats backslash like slash) to
     an origin other than dashboard.priceflag.org, so the page must omit next
     from the POST body entirely. */
  const evilNexts = [
    'https://evil.com/x', // absolute other-origin
    '//evil.com',         // protocol-relative
    '/\\evil.com',        // backslash trick: resolves to https://evil.com/
    'http://dashboard.priceflag.org.evil.com/', // lookalike host
  ];
  for (const evil of evilNexts) {
    await check(`local: hostile ?next=${JSON.stringify(evil)} omitted from body`, async () => {
      const { context, page, posts } = await open('?next=' + encodeURIComponent(evil));
      await submitEmail(page, 'test@example.com');
      assert(posts.length === 1, `expected 1 request, saw ${posts.length}`);
      const body = JSON.parse(posts[0].body);
      assert(!('next' in body), `next leaked into body: ${JSON.stringify(body.next)}`);
      await context.close();
    });
  }

  /* A single leading backslash is NOT an escape: WHATWG resolves "\evil.com"
     against the app origin to https://dashboard.priceflag.org/evil.com — same
     origin — so the page forwards the harmless same-origin path "/evil.com".
     This documents that the backslash cannot smuggle a foreign host. */
  await check('local: ?next=%5Cevil.com normalizes to same-origin path /evil.com', async () => {
    const { context, page, posts } = await open('?next=%5Cevil.com');
    await submitEmail(page, 'test@example.com');
    assert(posts.length === 1, `expected 1 request, saw ${posts.length}`);
    const body = JSON.parse(posts[0].body);
    assert(body.next === '/evil.com', `next was ${JSON.stringify(body.next)} (expected the same-origin path)`);
    await context.close();
  });

  /* ---- (f) ?error= codes, unknown fallback, ?signed_out=1 ---------------- */
  const KNOWN_CODES = [
    'link_expired',
    'link_invalid',
    'link_missing',
    'link_unbound',
    'auth_not_configured',
    'sign_in_required',
  ];
  const GENERIC = 'We could not sign you in. Enter your email to try again.';
  const seenMessages = new Map();

  for (const code of KNOWN_CODES) {
    await check(`local: ?error=${code} renders its own message`, async () => {
      const { context, page } = await open(`?error=${code}`);
      assert(await page.isVisible('#pf-error'), 'error box not shown');
      const msg = (await page.textContent('#pf-error')).trim();
      assert(msg.length > 0, 'error message is empty');
      assert(msg !== GENERIC, `code ${code} fell through to the generic fallback`);
      seenMessages.set(code, msg);
      await context.close();
    });
  }

  await check('local: the six error messages are all distinct', async () => {
    const unique = new Set(seenMessages.values());
    assert(
      unique.size === KNOWN_CODES.length,
      `only ${unique.size} distinct messages for ${KNOWN_CODES.length} codes`
    );
  });

  await check('local: unknown ?error= code renders the generic fallback', async () => {
    const { context, page } = await open('?error=some_future_code');
    assert(await page.isVisible('#pf-error'), 'error box not shown');
    const msg = (await page.textContent('#pf-error')).trim();
    assert(msg === GENERIC, `unexpected fallback text: ${JSON.stringify(msg)}`);
    await context.close();
  });

  await check('local: ?signed_out=1 renders the info box, not an error', async () => {
    const { context, page } = await open('?signed_out=1');
    assert(await page.isVisible('#pf-info'), 'info box not shown');
    const msg = (await page.textContent('#pf-info')).trim();
    assert(msg === 'You are signed out.', `unexpected info text: ${JSON.stringify(msg)}`);
    assert(await page.isHidden('#pf-error'), 'error box must stay hidden for signed_out');
    await context.close();
  });

  /* ---- (g) server error and network failure re-enable the form ----------- */
  await check('local: 429 error response shows server message, form re-enabled', async () => {
    const { context, page, posts } = await open('', (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'rate_limited', message: 'Slow down.' } }),
      })
    );
    await submitEmail(page, 'test@example.com');
    assert(posts.length === 1, `expected 1 request, saw ${posts.length}`);
    const msg = (await page.textContent('#pf-error')).trim();
    assert(msg === 'Slow down.', `expected the server message, got ${JSON.stringify(msg)}`);
    assert(await page.isVisible('#pf-form'), 'form should still be visible after an error');
    assert(await page.isHidden('#pf-sent'), 'sent state must not show after an error');
    assert(!(await page.isDisabled('#pf-submit')), 'submit should be re-enabled');
    assert(!(await page.isDisabled('#pf-email')), 'email input should be re-enabled');
    const label = (await page.textContent('#pf-submit-label')).trim();
    assert(label === 'Email me a sign-in link', `button label stuck at ${JSON.stringify(label)}`);
    await context.close();
  });

  await check('local: network failure shows an error, form re-enabled', async () => {
    const { context, page } = await open('', (route) => route.abort('failed'));
    await submitEmail(page, 'test@example.com');
    const msg = (await page.textContent('#pf-error')).trim();
    /* fetch() rejects with TypeError("Failed to fetch"); the page detects the
       TypeError and substitutes its own connection message rather than
       surfacing the browser argot. */
    assert(msg.indexOf('could not reach Priceflag') !== -1,
      `expected the page's connection message, got ${JSON.stringify(msg)}`);
    assert(await page.isVisible('#pf-form'), 'form should still be visible');
    assert(!(await page.isDisabled('#pf-submit')), 'submit should be re-enabled');
    assert(!(await page.isDisabled('#pf-email')), 'email input should be re-enabled');
    await context.close();
  });

  /* ---- (h) query string is stripped after being read ---------------------- */
  await check('local: location.search stripped via history.replaceState', async () => {
    const { context, page } = await open('?error=link_expired&next=%2Fsettings');
    const search = await page.evaluate(() => location.search);
    assert(search === '', `location.search is still ${JSON.stringify(search)}`);
    // the message read from the stripped query must still be on screen
    assert(await page.isVisible('#pf-error'), 'error message should survive the strip');
    await context.close();
  });

  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

/* ===========================================================================
   LIVE SUITE — request-level probes of the deployed hosts. Never posts an
   email address. BLOCKED = infrastructure not there yet, not a page bug.
   ======================================================================== */

async function probe(url, options = {}) {
  return fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
    headers: { 'user-agent': 'priceflag-e2e-signin (request-level check)' },
    ...options,
  });
}

/* Vercel's bot filter answers suspicious requests with a "Security Checkpoint"
   interstitial instead of the page: 403, x-vercel-mitigated: challenge, and a
   JS proof-of-work that plain fetch can never run. */
function isChallenge(status, headers) {
  return status === 403 && (headers.get('x-vercel-mitigated') || '') === 'challenge';
}

/* One shared browser for the whole live suite, launched only if a challenge is
   actually met (the common path stays browserless). */
let liveBrowserPromise = null;
function getLiveBrowser() {
  if (!liveBrowserPromise) {
    liveBrowserPromise = loadPlaywright().then((pw) => pw.chromium.launch());
  }
  return liveBrowserPromise;
}
async function closeLiveBrowser() {
  if (liveBrowserPromise) {
    const b = await liveBrowserPromise;
    await b.close();
    liveBrowserPromise = null;
  }
}

/* Load the URL in a real page and give the checkpoint time to solve itself and
   navigate on. Returns the same shape as a fetch-based probe result. */
async function browserProbe(url) {
  const browser = await getLiveBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();
  let lastDoc = null; // last main-frame document response = the page we ended on
  page.on('response', (r) => {
    const req = r.request();
    if (req.isNavigationRequest() && req.frame() === page.mainFrame()) lastDoc = r;
  });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    try {
      /* Runs in an isolated world, so the page's CSP does not block it. */
      await page.waitForFunction(
        () => !document.title.includes('Vercel Security Checkpoint'),
        { timeout: 25000 }
      );
      await page.waitForLoadState('domcontentloaded');
    } catch {
      /* Checkpoint never resolved headlessly; report what we ended on. */
    }
    const html = await page.content();
    const headers = lastDoc ? await lastDoc.allHeaders() : {};
    return {
      status: lastDoc ? lastDoc.status() : 0,
      html,
      headers: { get: (k) => headers[k.toLowerCase()] ?? null },
      via: 'browser',
      challenged: html.includes('Vercel Security Checkpoint'),
    };
  } finally {
    await context.close();
  }
}

/* fetch() first; on a bot challenge, retry in the real browser. Network errors
   propagate so callers keep their "unreachable → BLOCKED" handling. */
async function smartProbe(url) {
  const res = await probe(url);
  if (!isChallenge(res.status, res.headers)) {
    return {
      status: res.status,
      html: await res.text(),
      headers: res.headers,
      via: 'fetch',
      challenged: false,
    };
  }
  return browserProbe(url);
}

const CHALLENGE_NOTE =
  'Vercel bot challenge did not resolve headlessly — state unknown, verify in a real browser';

async function runLiveSuite() {
  /* Each probe distinguishes:
       PASS    — the deployed thing behaves as specified
       FAIL    — it is reachable but behaves wrongly
       BLOCKED — unreachable / not deployed / protected, with the reason */

  let signinRes = null;

  await (async () => {
    const name = 'live: signin.priceflag.org serves signin page';
    try {
      signinRes = await smartProbe('https://signin.priceflag.org/');
      if (signinRes.challenged) {
        record(name, 'BLOCKED', CHALLENGE_NOTE);
      } else if (signinRes.status !== 200) {
        record(name, 'BLOCKED', `status ${signinRes.status} — host not serving the page yet`);
      } else if (!signinRes.html.includes('id="pf-form"')) {
        record(name, 'BLOCKED', '200 but no pf-form — rewrite to signin.html not deployed yet (serving another page)');
      } else if (!/<title>[^<]*Sign in[^<]*<\/title>/.test(signinRes.html)) {
        record(name, 'FAIL', 'pf-form present but <title> does not contain "Sign in"');
      } else {
        record(name, 'PASS', signinRes.via === 'browser' ? 'via browser (bot challenge passed)' : '');
      }
    } catch (err) {
      record(name, 'BLOCKED', `unreachable: ${err.cause?.code || err.message}`);
    }
  })();

  await (async () => {
    const name = 'live: priceflag.org/signin.html serves signin page';
    try {
      const res = await smartProbe('https://priceflag.org/signin.html');
      const html = res.html;
      if (res.challenged) {
        record(name, 'BLOCKED', CHALLENGE_NOTE);
        return;
      }
      if (res.status !== 200) {
        record(name, 'BLOCKED', `status ${res.status} — not deployed yet`);
        return;
      }
      if (!html.includes('id="pf-form"')) {
        record(name, 'FAIL', '200 but the response is not signin.html');
        return;
      }
      const problems = [];
      if (!html.includes('rel="canonical"') || !html.includes('href="https://signin.priceflag.org/"')) {
        problems.push('missing canonical to https://signin.priceflag.org/');
      }
      if (!/name="robots"[^>]*content="[^"]*noindex/.test(html)) {
        problems.push('missing noindex robots meta');
      }
      if (problems.length) record(name, 'FAIL', problems.join('; '));
      else record(name, 'PASS');
    } catch (err) {
      record(name, 'BLOCKED', `unreachable: ${err.cause?.code || err.message}`);
    }
  })();

  await (async () => {
    const name = 'live: security headers on signin.priceflag.org';
    if (!signinRes || signinRes.status !== 200 || !signinRes.html.includes('id="pf-form"')) {
      record(name, 'BLOCKED', 'signin host not serving the page yet, headers unverifiable');
      return;
    }
    const csp = signinRes.headers.get('content-security-policy') || '';
    const xcto = (signinRes.headers.get('x-content-type-options') || '').toLowerCase();
    const problems = [];
    if (!csp) problems.push('no Content-Security-Policy header');
    else if (!/connect-src[^;]*https:\/\/dashboard\.priceflag\.org/.test(csp)) {
      problems.push('CSP lacks connect-src https://dashboard.priceflag.org');
    }
    if (xcto !== 'nosniff') problems.push('X-Content-Type-Options is not nosniff');
    if (problems.length) record(name, 'FAIL', problems.join('; '));
    else record(name, 'PASS');
  })();

  await (async () => {
    const name = 'live: magic-link endpoint reachable';
    try {
      /* OPTIONS only: harmless, no body, no email, nothing sent or stored. */
      const res = await probe('https://dashboard.priceflag.org/api/auth/magic-link', { method: 'OPTIONS' });
      const wwwAuth = (res.headers.get('www-authenticate') || '').toLowerCase();
      if (isChallenge(res.status, res.headers)) {
        record(name, 'BLOCKED', '403 bot challenge on the API host — endpoint state unknown (a browser fallback cannot OPTIONS)');
      } else if (res.status === 401 && wwwAuth.includes('basic')) {
        record(name, 'BLOCKED', '401 + WWW-Authenticate: Basic — Vercel Deployment Protection still enabled');
      } else if (res.status === 404) {
        record(name, 'BLOCKED', '404 — the API route is not deployed yet');
      } else {
        record(name, 'PASS', `responds with status ${res.status}`);
      }
    } catch (err) {
      record(name, 'BLOCKED', `unreachable: ${err.cause?.code || err.message}`);
    }
  })();

  /* Deliberately NOT automated: POSTing to the live endpoint. Even an invalid
     body exercises production rate limits, and a real address would send real
     email. The local suite already proves the page's side of the contract. */
  record(
    'live: end-to-end magic-link send',
    'BLOCKED',
    'not automated — requires a human with a test inbox; page side covered by the local suite'
  );

  await closeLiveBrowser();
}

/* ===========================================================================
   Entry point
   ======================================================================== */
const args = process.argv.slice(2);
const localOnly = args.includes('--local-only');
const liveOnly = args.includes('--live-only');

try {
  if (!liveOnly) {
    console.log('Running local behavioral suite (hermetic, no real network)...');
    await runLocalSuite();
  }
  if (!localOnly) {
    console.log('Running live suite (request-level probes, nothing posted)...');
    await runLiveSuite();
  }
} catch (err) {
  record('suite: unexpected crash', 'FAIL', err.message);
}

const fails = printSummary();
process.exit(fails > 0 ? 1 : 0);
