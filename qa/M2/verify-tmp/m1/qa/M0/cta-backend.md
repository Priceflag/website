# M0 — CTA backend: can "Get my free price review" submit for real?

Date of investigation: 2026-10-13 (all times UTC). Branch `overhaul`. No site files edited.

## TL;DR

- **Yes, a working endpoint exists.** It is the Google Apps Script web app wired into `sections/pf-waitlist.js` (`T.SHEET_ENDPOINT`):
  `https://script.google.com/macros/s/AKfycbwihER5l9u8XY81Q55RYJh626QOXCIFI0LJDeQGBt84BFtSIdI4AAfox--A1MptpMZtnw/exec`
- It is live (`GET` → `{"ok":true,"alive":true}`). One real POST from a browser at `http://localhost:8902` wrote a row and returned `{"ok":true}`.
- **CORS: the response can be read.** With `Content-Type: text/plain` (a "simple" request, so no preflight), `fetch()` follows the 302 to `script.googleusercontent.com`, gets `200 application/json` with `Access-Control-Allow-Origin: *`, and the page can read the body. You do not need `mode:'no-cors'`, so success can be confirmed. Sending `Content-Type: application/json` breaks it: the preflight fails with `TypeError: Failed to fetch`.
- **Gaps in the deployed script:** it stores only `email, price, cost, testPrice, uplift, low, high, page, ua`. It **drops** `name`, `store`, `message` and any honeypot field. It has **no confirmation email**. It **dedups by email**: a second request from the same address returns `{"ok":true,"duplicate":true}` and writes nothing. That would silently lose a returning visitor's second review request.
- **Recommendation:** POST directly from the browser to the existing Apps Script endpoint (option a), using the exact `text/plain` JSON shape below. Show a real success or error state, with a `mailto:hello@priceflag.org` fallback that is prefilled with everything the visitor typed. This works **today with zero new credentials**. Until the owner updates and redeploys the `.gs`, pack `store`/`name`/`message` into the `page` field so they are not lost (see the stopgap below). Then apply the small `.gs` patch below (new columns, honeypot, optional confirmation email, no dedup for review requests) and redeploy to the same deployment.

## 1. `integrations/waitlist-sheet.gs` (server half)

| Aspect | Behaviour |
|---|---|
| Deploy | Web app, Execute as: Me, Access: Anyone. No secret or token by design (comment: a secret in public JS is public). |
| `doGet` | `{"ok":true,"alive":true}`. Health check only. |
| `doPost` input | `e.postData.contents` parsed with `JSON.parse`. Any content type works server-side, but the client must send `text/plain` to avoid a CORS preflight, which Apps Script does not answer. |
| Guards | (1) `page` must start with `https://priceflag.org`, `https://www.priceflag.org`, `http://localhost`, or `http://127.0.0.1`, else `{"ok":false,"error":"bad page"}`. **Vercel preview URLs (`*.vercel.app`) are rejected.** (2) Global rate limit: 30 rows per 600 s via ScriptCache, else `rate limited`. (3) Email regex and a 254-character cap, else `invalid email`. (4) LockService with a 20 s wait, else `busy`. (5) Dedup on the Email column (case-insensitive), which returns `{"ok":true,"duplicate":true}` and does not append. |
| Writes | Bound spreadsheet (`SHEET_ID` blank), tab `Waitlist`. Columns: `Timestamp, Email, Price, Cost, Test price, Uplift (90d), Low, High, Page, User agent`. Numbers go through `num_()`. Page and UA are truncated to 300 characters. |
| Confirmation email | **None.** There are no MailApp or GmailApp calls. |
| Response | `ContentService` JSON. The `/exec` URL answers `302` to `script.googleusercontent.com/macros/echo?...`, which answers `200 application/json; charset=utf-8` with `access-control-allow-origin: *`. |
| Honeypot | **None.** Unknown fields are ignored. |

## 2. Client code in the repo

- `sections/pf-waitlist.js` (the one loaded by `index.html:112`): `T.SUBMIT` POSTs to `T.SHEET_ENDPOINT` with `headers: {'Content-Type':'text/plain;charset=utf-8'}`, body `JSON.stringify({email, price, cost, testPrice, uplift, low, high, page, ua})`, then `r.json()`. It reports success only when `j.ok`. Otherwise, or on a network error, it shows "That did not save. Try again, or email us." It deliberately avoids `no-cors`. It has no timeout or AbortController. The mailto fallback (`hello@priceflag.org`) is used only when `SHEET_ENDPOINT` is blank. The Formspree snippet in its comment is a placeholder (`XXXXXXXX`) and is not live.
- `sections/pf-waitlist-b.js`: by default it opens a mailto to `hello@priceflag.org`. Its `/api/waitlist` snippet is commentary only. **There is no `/api` directory**, so that route does not exist.
- `contact.html`: **no form.** It has only two `mailto:` "Say hi" links (`nithin@priceflag.org`, `kabir@priceflag.org`).
- `legal.html` and `about.html`: the public contact address is **`hello@priceflag.org`**.
- `signin.html` posts to dashboard.priceflag.org. It was not touched or tested.
- `index.html` has no CSP meta tag, and `vercel.json` sets a CSP only for `/signin.html`. Nothing blocks `connect-src` to script.google.com on the marketing pages.
- Repo-wide grep (`script.google.com|macros/s/|formspree|tally|getform|fetch(|action=|mailto:|@priceflag`): no other endpoints.

## 3. Request contract (as deployed)

```
POST <EXEC_URL>
Content-Type: text/plain;charset=utf-8          <- must be text/plain (no preflight)
Body: JSON string
  email     string, required, valid, <=254
  page      string, required, must start with an allowed prefix (<=300 kept)
  price, cost, testPrice, uplift, low, high   numbers (optional; non-numeric -> blank)
  ua        string (<=300 kept)
  (anything else is accepted but ignored)

-> 302 Location: https://script.googleusercontent.com/macros/echo?user_content_key=...
-> 200 application/json, Access-Control-Allow-Origin: *
   {"ok":true} | {"ok":true,"duplicate":true} |
   {"ok":false,"error":"bad page"|"rate limited"|"invalid email"|"busy"|"empty request"|"<exception>"}
```

The status code is always 200, including on errors. Success must be read from `ok` in the body. Latency observed: about 1.6–2.9 s.

## 4. Test results

Scripts: `qa/M0/cta-tests/browser-cors.mjs` (Playwright, Chromium headless, page served by `python3 -m http.server 8902`, server killed afterwards) and `qa/M0/cta-tests/server-forward.mjs` (Node fetch, which simulates a server-side forwarder). Raw browser output is in `qa/M0/cta-tests/browser-cors.out.json`.

**Rows written: exactly 1.** No other request could write a row: they were dedup hits or rejected page prefixes.

| # | Time (UTC) | Context | Request | Result |
|---|---|---|---|---|
| 0 | 20:14:46 | curl | `GET /exec` | 302 (ACAO `*`) → 200 `{"ok":true,"alive":true}` |
| **A** | **20:15:28** | browser, origin `http://localhost:8902` | text/plain POST, test payload | `type:"cors"`, 200, redirected, body **readable**: `{"ok":true}`. **Row written.** |
| B | 20:15:31 | browser | same payload again | 200 `{"ok":true,"duplicate":true}`. No row (dedup). |
| C | 20:15:32 | browser | `mode:'no-cors'`, page `https://not-allowed.example/` | `type:"opaque"`, status 0, empty body. Shows that no-cors cannot tell success from failure. No row. |
| D | 20:15:32 | browser | `Content-Type: application/json` | `TypeError: Failed to fetch` (preflight not answered). No row. |
| E | 20:15:32 | browser | POST to dead `http://localhost:9/` | `TypeError: Failed to fetch`. This is the offline or endpoint-down path. |
| F | 20:15:45 | Node (server-side) | page `https://not-allowed.example/` | 200 `{"ok":false,"error":"bad page"}`. Node fetch follows the 302 correctly. No row. |
| G | 20:15:48 | Node | test email again | 200 `{"ok":true,"duplicate":true}`. No row. |
| H | 20:15:48 | curl `-X POST` (no `-L`) | bad page | 302 to googleusercontent. No row. |

Note: in the browser, `r.headers.get('access-control-allow-origin')` returns `null`. JS is not allowed to read that header. CORS success is shown by `type:"cors"` and the readable body.

### The test row to delete from the sheet (tab `Waitlist`)

| Column | Value |
|---|---|
| Timestamp | 2026-10-13 ≈20:15:26–28 UTC (shown in the script owner's timezone) |
| Email | `qa-test+m0@priceflag.org` |
| Price / Cost / Test price | 48 / 19 / 53.76 |
| Uplift / Low / High | 0 / 0 / 0 |
| Page | `http://localhost:8902/index.html#qa-test-m0` |
| User agent | starts with `QA TEST overhaul M0 — Mozilla/5.0 ...` |

The payload also carried name `QA TEST — please delete (overhaul M0)`, store `qa-test.example`, and message `QA TEST ENTRY, safe to delete`. The script dropped all three, so they are not in the sheet. **Delete this row.** As long as it exists, that email will keep deduping.

## 5. Options compared

| Option | Works today, no new creds? | Success confirmable? | Keeps all fields? | Confirmation email | Notes |
|---|---|---|---|---|---|
| **(a) Browser to Apps Script direct** | **Yes** | **Yes** (readable JSON, `text/plain`) | Not until the `.gs` is patched. Stopgap: pack fields into `page`. | Not until the `.gs` adds `MailApp.sendEmail` (free, no API key, runs as owner; consumer quota about 100/day) | Must not use `no-cors` or `application/json`. Vercel preview domains are rejected by `PAGE_PREFIXES`. |
| (b) `api/review.js` Vercel function forwarding to Apps Script | Yes (plain Node function, no build step; Node fetch follows the 302, verified in F) | Yes | Same `.gs` limitation | Same | Adds a second hop (+ cold start). Its benefits: it could verify the real `Origin` header, hide the exec URL, and rate-limit per IP. Not needed for correctness, because CORS already works. Email via Resend/Postmark etc. needs an API key we do not have. |
| (c) `mailto:hello@priceflag.org` only | Yes | No (we cannot detect whether the mail client opened) | Yes (in the body) | n/a | Use it only as the fallback when (a) fails, never as the main path. |

**Recommended:** (a), with (c) as the fallback on every failure path. Consider (b) later if spam shows up.

### Recommended `.gs` patch (owner must apply, then Deploy → Manage deployments → edit → New version, so the URL stays the same)

1. Append to `HEADERS`: `'Name','Store','Message','Source'`, and write `d.name`, `d.store`, `d.message`, `d.source`, each truncated with `.slice(0, 500)`. Because headers are written only when the tab is empty, also type the 4 new header cells into row 1 by hand.
2. Honeypot: `if (d.company_website) return json({ ok: true });`. This is a silent accept.
3. Skip the email dedup when `d.source === 'price-review'`. A review request is not the same as a waitlist signup.
4. Optional confirmation email: `MailApp.sendEmail({ to: email, replyTo: 'hello@priceflag.org', name: 'Priceflag', subject: 'We got your price review request', body: '...' })` inside a try/catch so a mail failure never fails the row. The first deploy needs re-authorisation for the `script.send_mail` scope. Also consider `MailApp.sendEmail('hello@priceflag.org', 'New price review: ' + d.store, JSON.stringify(d, null, 2))` as an owner notification.
5. Optionally add `https://priceflag-*.vercel.app` (or the project's preview pattern) to `PAGE_PREFIXES` if previews should be able to submit.

### Stopgap while the `.gs` is not yet patched

The deployed script keeps `page` (up to 300 characters), so put the extra fields there:
`page = location.origin + location.pathname + '#review?store=' + enc(store) + '&name=' + enc(name) + '&msg=' + enc(message.slice(0,120))`.
It starts with an allowed prefix, so it passes the guard. The message may be truncated, but the mailto fallback always carries everything. The dedup problem stays until the patch: a repeat email returns `duplicate:true`. Treat that as success in the UI (we already have the address) but tell the visitor to also email if the request is new. The snippet below does this.

## 6. Client snippet (vanilla JS, no deps)

```html
<form id="pf-review" novalidate>
  <input name="email" type="email" required autocomplete="email">
  <input name="store" type="text" required inputmode="url" placeholder="yourstore.com">
  <input name="name" type="text" autocomplete="name">
  <input name="price" type="number" step="0.01"><input name="newPrice" type="number" step="0.01">
  <input name="cost" type="number" step="0.01">
  <textarea name="message"></textarea>
  <!-- honeypot: visually hidden, not display:none -->
  <div aria-hidden="true" style="position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden">
    <label>Company website <input name="company_website" tabindex="-1" autocomplete="off"></label>
  </div>
  <button type="submit">Get my free price review</button>
  <p class="pf-review-status" role="status" aria-live="polite"></p>
</form>
<script>
(function () {
  var EXEC = 'https://script.google.com/macros/s/AKfycbwihER5l9u8XY81Q55RYJh626QOXCIFI0LJDeQGBt84BFtSIdI4AAfox--A1MptpMZtnw/exec';
  var MAIL_TO = 'hello@priceflag.org';
  var TIMEOUT_MS = 15000;
  var form = document.getElementById('pf-review');
  var btn = form.querySelector('button[type=submit]');
  var status = form.querySelector('.pf-review-status');
  var busy = false;

  function val(n) { var el = form.elements[n]; return el ? String(el.value || '').trim() : ''; }
  function num(n) { var v = parseFloat(val(n)); return isFinite(v) ? v : ''; }

  function mailtoHref(d) {
    var body = 'Free price review request\n\nEmail: ' + d.email + '\nStore: ' + d.store +
      (d.name ? '\nName: ' + d.name : '') +
      '\nCurrent price: ' + d.price + '\nNew price: ' + d.newPrice + '\nUnit cost: ' + d.cost +
      (d.message ? '\n\n' + d.message : '');
    return 'mailto:' + MAIL_TO + '?subject=' + encodeURIComponent('Free price review: ' + d.store) +
      '&body=' + encodeURIComponent(body);
  }

  function show(kind, text, d) {                     // pass d to append a prefilled mailto link
    form.setAttribute('data-state', kind);            // 'pending' | 'ok' | 'error'
    status.textContent = text;
    if (d) {                                           // real, clickable fallback; inputs are untouched
      var a = document.createElement('a');
      a.href = mailtoHref(d); a.textContent = 'Email it to ' + MAIL_TO + ' instead';
      status.appendChild(document.createTextNode(' ')); status.appendChild(a);
    }
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (busy) return;                                  // double-submit guard
    var d = {
      email: val('email'), store: val('store'), name: val('name'), message: val('message'),
      price: num('price'), newPrice: num('newPrice'), cost: num('cost')
    };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) { show('error', 'Check your email address.'); form.elements.email.focus(); return; }
    if (!d.store) { show('error', 'Add your store URL.'); form.elements.store.focus(); return; }
    if (val('company_website')) { show('ok', 'Thanks, we have it.'); return; }   // honeypot: pretend success

    var enc = encodeURIComponent;
    var payload = {
      source: 'price-review',
      email: d.email, name: d.name, store: d.store, message: d.message,   // kept once the .gs is patched
      price: d.price, testPrice: d.newPrice, cost: d.cost,
      // stopgap: deployed script only keeps `page` (300 chars) — carry the extra fields there
      page: (location.origin + location.pathname + '#review?store=' + enc(d.store) +
             '&name=' + enc(d.name) + '&msg=' + enc(d.message.slice(0, 120))).slice(0, 300),
      ua: navigator.userAgent || ''
    };

    busy = true; btn.disabled = true; btn.setAttribute('aria-busy', 'true');
    show('pending', 'Sending...');

    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, TIMEOUT_MS);

    fetch(EXEC, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },  // MUST stay text/plain (no preflight)
      body: JSON.stringify(payload),
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        if (j && j.ok) {
          if (j.duplicate) {                           // pre-patch dedup: row NOT written, keep input + mailto
            show('ok', 'We already have your address. If this is a new request, email us the details too.', d);
          } else {
            show('ok', 'Got it. We will send your price review to ' + d.email + '.');
            form.reset();
          }
        } else {
          var why = j && j.error === 'rate limited' ? 'We are getting a lot of requests right now.'
                  : j && j.error === 'invalid email' ? 'That email address was rejected.'
                  : 'That did not save.';
          show('error', why, d);
        }
      })
      .catch(function (e) {
        var offline = typeof navigator.onLine === 'boolean' && !navigator.onLine;
        show('error', offline ? 'You look offline. Nothing was sent.'
                 : (e && e.name === 'AbortError') ? 'That took too long, so we cannot confirm it saved.'
                 : 'That did not send.', d);
      })
      .then(function () {
        clearTimeout(timer);
        busy = false; btn.disabled = false; btn.removeAttribute('aria-busy');
      });
  });
})();
</script>
```

Behaviour: inputs are never cleared except on a confirmed `ok`. Every failure (offline, timeout, endpoint down, `ok:false`) shows the reason plus a prefilled mailto link. The button is disabled while the request is in flight. Do not switch to `mode:'no-cors'` or `Content-Type: application/json`: tests C and D show why.

## 7. Open items for the owner

1. Delete the test row (`qa-test+m0@priceflag.org`) from the `Waitlist` tab.
2. Apply the `.gs` patch (§5) and redeploy as a new version of the existing deployment, so the URL is unchanged.
3. Decide whether Vercel preview domains should be allowed to submit (`PAGE_PREFIXES`).
