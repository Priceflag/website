/* Priceflag breakeven calculator: page behaviour. Needs sections/pf-calc-math.js loaded first (window.PfCalc).
   Without JavaScript the server-rendered example answer shows and the button is a plain link to #review.
   - Live update while typing (150ms debounce) and immediately on Enter.
   - Errors show only once a field was typed in (format problems), left empty after a blur, or on Enter.
   - "Get the full forecast for my store" fills the review form (hidden price/newPrice/cost and, if empty,
     the note), scrolls to it and focuses the email field.
   - Fires window 'pf:calc-used' {detail:{direction}} once per new result. No numbers or PII in the event. */
(function () {
  'use strict';
  var Calc = window.PfCalc;
  var root = document.querySelector('[data-pf-calc]');
  if (!Calc || !root) return;

  var KEYS = ['price', 'newPrice', 'cost'];
  var NAMES = { price: 'the current price', newPrice: 'the new price', cost: 'the unit cost' };
  var DEBOUNCE_MS = 150;

  var inputs = {}, errs = {}, typed = {}, left = {};
  KEYS.forEach(function (k) {
    inputs[k] = root.querySelector('[data-pf-calc-field="' + k + '"]');
    errs[k] = root.querySelector('[data-pf-calc-err="' + k + '"]');
  });
  if (KEYS.some(function (k) { return !inputs[k]; })) return;

  var answer = root.querySelector('[data-pf-calc-answer]');
  var support = root.querySelector('[data-pf-calc-support]');
  var note = root.querySelector('[data-pf-calc-note]');
  var cta = root.querySelector('[data-pf-calc-cta]');

  var submitted = false, timer = null, lastSig = null, lastWritten = null;

  KEYS.forEach(function (k) { inputs[k].removeAttribute('readonly'); });
  if (note) note.textContent = 'These are example numbers. Type your own.';

  function fieldMessage(k, f) {
    if (f.code === 'empty') return 'Enter ' + NAMES[k] + '.';
    if (k !== 'cost' && (f.code === 'negative' || f.code === 'zero')) return Calc.MESSAGES.zero;
    if (k === 'cost' && f.code === 'negative') return 'Enter a unit cost of $0 or more.';
    return f.message;
  }

  function showsError(k, f) {
    if (f.ok) return false;
    if (submitted) return true;
    return f.code === 'empty' ? !!left[k] : !!typed[k];
  }

  function setAnswer(lead, figure, tail) {
    var prev = answer.querySelector('[data-pf-calc-figure]');
    var prevText = prev ? prev.textContent : '';
    answer.textContent = '';
    if (figure) {
      answer.appendChild(document.createTextNode(lead));
      var strong = document.createElement('strong');
      strong.className = 'pf-calc-figure';
      strong.setAttribute('data-pf-calc-figure', '');
      // Very large figures ("9,999,999,800%") may break after a thousands comma, never mid-group.
      figure.split(',').forEach(function (part, i) {
        if (i) { strong.appendChild(document.createTextNode(',')); strong.appendChild(document.createElement('wbr')); }
        strong.appendChild(document.createTextNode(part));
      });
      answer.appendChild(strong);
      answer.appendChild(document.createTextNode(tail));
      if (figure !== prevText) {
        strong.classList.add('is-fresh');
        strong.addEventListener('animationend', function () { strong.classList.remove('is-fresh'); }, { once: true });
      }
    } else {
      answer.textContent = lead;
    }
  }

  function render(silent) {
    clearTimeout(timer);
    var ev = Calc.evaluate(inputs.price.value, inputs.newPrice.value, inputs.cost.value);
    var anyError = false;
    KEYS.forEach(function (k) {
      var f = ev.fields[k];
      var show = showsError(k, f);
      if (show) anyError = true;
      var msg = show ? fieldMessage(k, f) : '';
      if (errs[k] && errs[k].textContent !== msg) errs[k].textContent = msg;
      if (show) inputs[k].setAttribute('aria-invalid', 'true');
      else inputs[k].removeAttribute('aria-invalid');
    });

    var sig, direction = null;
    if (ev.ok) {
      var t = ev.text;
      sig = 'ok|' + t.sentence + '|' + t.support;
      direction = ev.result.direction;
      if (sig !== lastSig && answer.textContent !== t.sentence) setAnswer(t.figure ? t.lead : t.sentence, t.figure, t.tail);
      if (support.textContent !== t.support) support.textContent = t.support;
    } else {
      var prompt = anyError ? 'Fix the highlighted number to see your breakeven.' : 'Enter all three numbers to see your breakeven.';
      sig = 'no|' + prompt;
      if (anyError) direction = 'invalid';
      if (answer.textContent !== prompt) setAnswer(prompt);
      if (support.textContent) support.textContent = '';
    }

    if (!silent && sig !== lastSig && direction) {
      try {
        window.dispatchEvent(new CustomEvent('pf:calc-used', { detail: { direction: direction } }));
      } catch (e) { /* very old browsers: no CustomEvent constructor */ }
    }
    lastSig = sig;
    return ev;
  }

  root.addEventListener('input', function (e) {
    var k = e.target && e.target.getAttribute('data-pf-calc-field');
    if (!k) return;
    typed[k] = true;
    if (note) note.hidden = true; // the numbers are theirs now, not the example
    clearTimeout(timer);
    timer = setTimeout(function () { render(false); }, DEBOUNCE_MS);
  });
  root.addEventListener('focusout', function (e) {
    var k = e.target && e.target.getAttribute('data-pf-calc-field');
    if (!k) return;
    left[k] = true;
    // Leaving a field to press the button: the click handler renders. Rendering now would move the
    // button between mousedown and click (the answer and errors change height) and the click would miss.
    if (pressing) return;
    render(false);
  });
  root.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || !e.target.getAttribute('data-pf-calc-field')) return;
    e.preventDefault();
    submitted = true;
    render(false);
  });

  // ---------- "Get the full forecast for my store": prefill the review form ----------
  var pressing = false;
  if (cta) {
    cta.addEventListener('pointerdown', function () { pressing = true; });
    document.addEventListener('pointerup', function () { setTimeout(function () { pressing = false; }, 0); }, true);
  }
  if (cta) cta.addEventListener('click', function (e) {
    var form = document.querySelector('form[data-pf-review]');
    var target = document.getElementById('review');
    if (!form || !target) return; // plain link
    var ev = render(false);
    var f = ev.fields;
    KEYS.forEach(function (k) {
      var hidden = form.querySelector('input[type="hidden"][name="' + k + '"]');
      if (!hidden) return;
      if (f[k].ok) { hidden.value = Calc.plainMoney(f[k].cents); hidden.disabled = false; }
      else { hidden.value = ''; hidden.disabled = true; }
    });
    var msg = form.querySelector('#rv-message');
    if (msg && ev.ok) {
      var line = 'Current price ' + Calc.formatMoney(f.price.cents) + ', new price ' + Calc.formatMoney(f.newPrice.cents) +
        ', unit cost ' + Calc.formatMoney(f.cost.cents) + '.';
      // Only into an empty note, or one that still holds exactly the line we wrote last time.
      if (msg.value.trim() === '' || msg.value === lastWritten) { msg.value = line; lastWritten = line; }
    }

    e.preventDefault();
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    try { if (history.pushState && location.hash !== '#review') history.pushState(null, '', '#review'); } catch (err) {}
    try { target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); }
    catch (err) { target.scrollIntoView(true); }
    var email = form.querySelector('#rv-email');
    if (email && email.offsetParent !== null) {
      try { email.focus({ preventScroll: true }); } catch (err) { email.focus(); }
    }
  });

  render(true);
})();
