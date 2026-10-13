/* ===========================================================================
   Priceflag — waitlist → Google Sheet
   ===========================================================================

   Paste this whole file into Apps Script (Extensions → Apps Script) on the
   Sheet you want the addresses to land in, then Deploy → New deployment →
   Web app, with:

       Execute as:        Me
       Who has access:    Anyone

   Copy the /exec URL it gives you and put it in sections/pf-waitlist.js as
   T.SHEET_ENDPOINT. That is the only wiring step on the site side.

   Notes on the choices here, since they are not obvious:

   - The web app is deployed "Anyone" because the browser posts to it with no
     credentials. Anyone who finds the URL can append a row. There is
     deliberately NO shared secret: a secret shipped in public JS is public,
     so checking one here was security theater. Instead the guards below stop
     drive-by junk — a page-prefix check, strict payload validation, dedup,
     and a rate limit. None of that is authentication; a determined attacker
     can still append rows. Do not put anything sensitive in this Sheet.
   - Apps Script does not expose request headers to doPost, so a real Origin
     check is impossible here. PAGE_PREFIXES filters on the client-reported
     page URL instead — a soft guard, same threat model as everything else.
   - LockService serialises appends. Two people submitting in the same second
     would otherwise be able to write the same row index and lose one.
   - The response is JSON with CORS allowed, so the site can tell the user
     truthfully whether the row landed instead of guessing.
   =========================================================================== */

/* Submissions whose reported page does not start with one of these are
   junk by definition. Localhost is allowed so the section can be tested. */
var PAGE_PREFIXES = [
  'https://priceflag.org',
  'https://www.priceflag.org',
  'http://localhost',
  'http://127.0.0.1'
];

/* At most this many rows may land in any RATE_WINDOW_SECONDS window,
   across all visitors. The waitlist is low-traffic; a burst past this is a
   script, not a launch. */
var RATE_MAX = 30;
var RATE_WINDOW_SECONDS = 600;

/* Leave blank to use the Sheet this script is bound to. */
var SHEET_ID = '';
var TAB_NAME = 'Waitlist';

var HEADERS = [
  'Timestamp', 'Email', 'Price', 'Cost', 'Test price',
  'Uplift (90d)', 'Low', 'High', 'Page', 'User agent'
];

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json({ ok: false, error: 'busy' });
  }

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json({ ok: false, error: 'empty request' });
    }

    var d = JSON.parse(e.postData.contents);

    var page = String(d.page || '');
    var pageOk = false;
    for (var p = 0; p < PAGE_PREFIXES.length; p++) {
      if (page.indexOf(PAGE_PREFIXES[p]) === 0) { pageOk = true; break; }
    }
    if (!pageOk) {
      return json({ ok: false, error: 'bad page' });
    }

    if (!rateOk_()) {
      return json({ ok: false, error: 'rate limited' });
    }

    var email = String(d.email || '').trim();
    /* Validate again here. Never trust the client — this endpoint is public. */
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
      return json({ ok: false, error: 'invalid email' });
    }

    var sheet = getSheet_();

    /* Skip duplicates rather than collecting the same address repeatedly. */
    var existing = sheet.getLastRow() > 1
      ? sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues()
      : [];
    for (var i = 0; i < existing.length; i++) {
      if (String(existing[i][0]).toLowerCase() === email.toLowerCase()) {
        return json({ ok: true, duplicate: true });
      }
    }

    sheet.appendRow([
      new Date(),
      email,
      num_(d.price),
      num_(d.cost),
      num_(d.testPrice),
      num_(d.uplift),
      num_(d.low),
      num_(d.high),
      String(d.page || '').slice(0, 300),
      String(d.ua || '').slice(0, 300)
    ]);

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/* A GET is handy for checking the deployment is alive from a browser. */
function doGet() {
  return json({ ok: true, alive: true });
}

/* Sliding-window-ish rate limit on ScriptCache. The counter resets when the
   cache entry expires; that coarseness is fine for a junk filter. Errors in
   CacheService fail open — a broken cache should not take the waitlist down. */
function rateOk_() {
  try {
    var cache = CacheService.getScriptCache();
    var n = Number(cache.get('wl-rate') || 0) + 1;
    if (n > RATE_MAX) return false;
    cache.put('wl-rate', String(n), RATE_WINDOW_SECONDS);
    return true;
  } catch (err) {
    return true;
  }
}

function getSheet_() {
  var ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID)
                    : SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TAB_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(TAB_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function num_(v) {
  var n = Number(v);
  return isFinite(n) ? n : '';
}

function json(o) {
  return ContentService
    .createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}
