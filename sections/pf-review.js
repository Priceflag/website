/* Priceflag: "Get a free price review" form.
   Posts to the Google Apps Script web app behind the waitlist (see
   integrations/waitlist-sheet.gs and qa/M0/cta-backend.md). The body must be a
   JSON string sent as text/plain: application/json triggers a preflight the
   script never answers, and no-cors hides whether the row was written.
   Every failure keeps the visitor's input and offers a prefilled email.
   Without this script the form still works: it posts to a mail client. */
(function () {
  'use strict';

  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbwihER5l9u8XY81Q55RYJh626QOXCIFI0LJDeQGBt84BFtSIdI4AAfox--A1MptpMZtnw/exec';
  var FALLBACK_EMAIL = 'hello@priceflag.org';
  var TIMEOUT_MS = 15000;
  var FIELD_MAX = 300;    // the deployed script keeps 300 characters of `page` and of `ua`
  var MAILTO_MAX = 1800;  // past ~2000 characters some mail handlers truncate or refuse the link
  var SENT_KEY = 'pf-review-sent';
  // No spaces, one @, no empty or doubled dot-separated parts, a 2+ letter ending.
  var EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/;
  // A bare domain or a URL: optional scheme, labels in any script, a letter or
  // punycode ending, optional port, then any path, query or hash.
  var STORE_RE = /^(https?:\/\/)?([^\s\/?#:.@]+\.)+(xn--[a-z0-9-]+|[^\s\/?#:.@\d,;<>"'()]{2,})(:\d{1,5})?([\/?#]\S*)?$/i;
  // Stripped from email and store only: in names and notes these characters
  // are meaningful (Persian ZWNJ, emoji ZWJ sequences).
  var INVISIBLE_RE = /[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g;
  var PENDING_KEY = 'pf-review-pending';

  // Work in whole characters: slicing a UTF-16 string can split an emoji, and
  // encodeURIComponent throws on a lone surrogate.
  function chars(v) { return Array.from ? Array.from(v || '') : String(v || '').split(''); }
  function enc(v) {
    try { return encodeURIComponent(v || ''); }
    catch (e) { return encodeURIComponent(String(v).replace(/[\uD800-\uDFFF]/g, '�')); }
  }

  // Encode as many whole characters of `text` as fit in `room` encoded characters.
  function fitEncoded(text, room) {
    var out = '';
    var list = chars(text);
    for (var i = 0; i < list.length; i++) {
      var next = enc(list[i]);
      if (out.length + next.length > room) return { text: out, cut: true, used: i };
      out += next;
    }
    return { text: out, cut: false, used: list.length };
  }

  function fitPlain(list, start, room) {
    var out = '';
    var i = start;
    while (i < list.length && out.length + list[i].length <= room) { out += list[i]; i++; }
    return { text: out, used: i };
  }

  // Store, name, host and as much of the note as fits, across the two columns.
  function pack(d) {
    var store = fitEncoded(d.store, 110);
    var name = fitEncoded(d.name, 50);
    var head = 'https://priceflag.org' + location.pathname + '#review?' + (d.hp ? 'hp=1&' : '') +
      'host=' + enc(location.host).slice(0, 40) + '&store=' + store.text + '&name=' + name.text + '&msg=';
    var note = chars(d.message);
    var inPage = fitEncoded(d.message, FIELD_MAX - head.length);
    var rest = fitPlain(note, inPage.used, FIELD_MAX - 6);
    var ua = rest.used > inPage.used ? 'note: ' + rest.text : (navigator.userAgent || '').slice(0, FIELD_MAX);
    return {
      page: head + inPage.text,
      ua: ua,
      noteCut: rest.used < note.length,
      otherCut: store.cut || name.cut
    };
  }

  function mailtoHref(d) {
    var lines = ['Email: ' + d.email, 'Store: ' + d.store];
    if (d.name) lines.push('Name: ' + d.name);
    if (d.price) lines.push('Current price: ' + d.price);
    if (d.newPrice) lines.push('New price: ' + d.newPrice);
    if (d.cost) lines.push('Unit cost: ' + d.cost);
    if (d.message) lines.push('', d.message);
    var body = lines.join('\n');
    var base = 'mailto:' + FALLBACK_EMAIL + '?subject=' + enc('Free price review: ' + chars(d.store).slice(0, 80).join('')) + '&body=';
    if ((base + enc(body)).length <= MAILTO_MAX) return base + enc(body);
    // Too long for a mail link: shorten the body and say so in the email itself.
    var tail = '\n\n[Note shortened. Paste the rest of it here.]';
    var list = chars(body);
    var lo = 0, hi = list.length;
    while (lo < hi) {
      var mid = Math.ceil((lo + hi) / 2);
      if ((base + enc(list.slice(0, mid).join('') + tail)).length <= MAILTO_MAX) lo = mid; else hi = mid - 1;
    }
    return base + enc(list.slice(0, lo).join('') + tail);
  }

  function num(v) {
    var n = parseFloat(String(v || '').replace(/[$,\s]/g, ''));
    return isFinite(n) ? n : '';
  }

  function init(form) {
    var status = form.querySelector('[data-pf-status]');
    var live = form.querySelector('[data-pf-live]');
    var again = form.querySelector('[data-pf-again]');
    var button = form.querySelector('button[type="submit"]');
    var buttonLabel = button.textContent;
    var busy = false;

    // The script handles validation and sending; the markup's mail-client
    // fallback keeps native validation and disabled extras for when it can't.
    form.noValidate = true;
    var hpInput = form.elements.pf_hp_field;
    if (hpInput) hpInput.disabled = false;

    function field(name) { return form.elements[name]; }
    function value(name) { var f = field(name); return f ? f.value.trim() : ''; }
    function clean(name) { return value(name).replace(INVISIBLE_RE, ''); }

    function setError(name, msg) {
      var input = field(name);
      var err = form.querySelector('[data-pf-error="' + name + '"]');
      if (msg) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
      if (err) err.textContent = msg || '';
    }

    function setStatus(kind, html) {
      status.setAttribute('data-kind', kind);
      status.innerHTML = html;
    }

    function announce(text) { if (live) live.textContent = text; }

    function read() {
      return {
        email: clean('email'),
        store: clean('store'),
        name: value('name'),
        message: value('message'),
        price: value('price'),
        newPrice: value('newPrice'),
        cost: value('cost'),
        hp: hpInput ? hpInput.value : ''
      };
    }

    function validate(d) {
      var emailMsg = !d.email ? 'Enter your email so we can send the review.'
        : (!EMAIL_RE.test(d.email) || d.email.length > 254) ? 'Enter a full email address, like you@yourstore.com.' : '';
      var storeMsg = !d.store ? 'Enter your store address.'
        : d.store.length > 300 ? 'That address is too long. Enter just the store domain, like yourstore.com.'
        : !STORE_RE.test(d.store) ? 'Enter your store address, like yourstore.com.' : '';
      setError('email', emailMsg);
      setError('store', storeMsg);
      return emailMsg ? 'email' : storeMsg ? 'store' : null;
    }

    ['email', 'store'].forEach(function (name) {
      field(name).addEventListener('input', function () {
        if (field(name).getAttribute('aria-invalid') === 'true') validate(read());
      });
    });

    function fail(d, why) {
      var link = '';
      try { link = mailtoHref(d); } catch (e) { link = 'mailto:' + FALLBACK_EMAIL; }
      setStatus('error', why + ' Your details are still here. Try again, or <a href="' + link + '">email them to ' + FALLBACK_EMAIL + '</a> instead.');
      status.focus();
    }

    function store(fn) { try { return fn(window.sessionStorage); } catch (e) { return null; } }

    function showSent(email, html) {
      form.setAttribute('data-state', 'sent');
      setStatus('ok', html);
      var strong = status.querySelector('strong');
      if (strong) strong.textContent = email;
      if (again) again.hidden = false;
    }

    // Coming back after a successful request (Back, reload): show that it
    // went through instead of an invitation to send it twice.
    function restoreSent() {
      var email = store(function (ss) { return ss.getItem(SENT_KEY); });
      if (email) showSent(email, 'We already have your request from <strong></strong>. We will email you within 48 hours.');
    }

    if (again) again.addEventListener('click', function () {
      store(function (ss) { ss.removeItem(SENT_KEY); });
      form.removeAttribute('data-state');
      setStatus('info', '');
      again.hidden = true;
      field('store').value = '';
      field('message').value = '';
      (value('email') ? field('store') : field('email')).focus();
    });

    restoreSent();
    // Left or reloaded while a request was in flight: it may have arrived.
    if (!form.hasAttribute('data-state') && store(function (ss) { return ss.getItem(PENDING_KEY); })) {
      store(function (ss) { ss.removeItem(PENDING_KEY); });
      setStatus('info', 'Your last request may already have reached us. If you don’t hear back within 48 hours, send it again.');
    }
    window.addEventListener('pageshow', function (e) { if (e.persisted) restoreSent(); });

    // A reload or navigation aborts the request in flight; keep the pending
    // flag then, so the next visit can say the request may have arrived.
    var leaving = false;
    window.addEventListener('pagehide', function () { leaving = true; });
    window.addEventListener('pageshow', function () { leaving = false; });

    function finish() {
      busy = false;
      if (!leaving) store(function (ss) { ss.removeItem(PENDING_KEY); });
      button.removeAttribute('aria-disabled');
      button.textContent = buttonLabel;
      announce('');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      var d = read();
      var bad = validate(d);
      if (bad) {
        setStatus('error', 'Check the highlighted fields.');
        field(bad).focus();
        return;
      }
      if (navigator.onLine === false) {
        fail(d, 'You look to be offline, so nothing was sent.');
        return;
      }

      // Not `disabled`: that would drop keyboard focus to the page while sending.
      busy = true;
      button.setAttribute('aria-disabled', 'true');
      button.textContent = 'Sending…';
      setStatus('info', '');
      announce('Sending your request.');
      store(function (ss) { ss.setItem(PENDING_KEY, '1'); });

      var timer = null;
      try {
        // The deployed script keeps email, the price numbers, `page` and `ua`,
        // and only accepts pages on priceflag.org. Until it is patched the
        // store, name, note and honeypot flag ride in `page` and `ua`.
        var packed = pack(d);
        var payload = {
          email: d.email, page: packed.page, ua: packed.ua, source: 'price-review',
          store: d.store, name: d.name, message: d.message,
          price: num(d.price), testPrice: num(d.newPrice), cost: num(d.cost)
        };
        // A filled honeypot is still sent, flagged, so an autofilled real
        // visitor is never thanked for a request that went nowhere.
        if (d.hp) payload.hp = 1;

        var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
        timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, TIMEOUT_MS);

        fetch(form.getAttribute('data-endpoint') || ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
          signal: ctrl ? ctrl.signal : undefined
        }).then(function (r) {
          if (!r.ok) throw new Error('unconfirmed');
          return r.json().catch(function () { throw new Error('unconfirmed'); });
        }).then(function (res) {
          if (!res) throw new Error('unconfirmed');
          if (res.ok !== true) throw new Error('rejected');
          var msg = 'Thanks. We have your request and will email <strong></strong> within 48 hours.';
          if (packed.noteCut) msg += ' Your note was longer than our form can store, so please <a href="' + mailtoHref(d) + '">email us the full note</a>.';
          else if (packed.otherCut) msg += ' Your store address or name was longer than our form keeps, so please <a href="' + mailtoHref(d) + '">email us the details</a>.';
          if (res.duplicate) msg = 'Thanks. We already had a request from <strong></strong>. If this one is for a different store, <a href="' + mailtoHref(d) + '">email us the details</a>.';
          store(function (ss) { ss.setItem(SENT_KEY, d.email); });
          finish();
          showSent(d.email, msg);
          status.focus();
          window.dispatchEvent(new CustomEvent('pf:review-submitted'));
        }).catch(function (err) {
          finish();
          var why = err && err.name === 'AbortError' ? 'The request timed out, so we can’t be sure it arrived.'
            : err && err.message === 'rejected' ? 'Our server turned the request down, so it was not saved.'
            : 'We couldn’t confirm your request arrived.';
          fail(d, why);
        }).then(function () { clearTimeout(timer); });
      } catch (err) {
        clearTimeout(timer);
        finish();
        fail(d, 'Something went wrong on our side and your request was not sent.');
      }
    });
  }

  function boot() {
    var forms = document.querySelectorAll('form[data-pf-review]');
    for (var i = 0; i < forms.length; i++) init(forms[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
