/* Priceflag hero mock: steps the rollout stage 25% -> 50% -> 100% once, to show how a rollout advances (M3).
   Vanilla, no deps, defer-safe, no globals. The HTML already shows the final state (100%), which is what
   people see with JS off or with prefers-reduced-motion. With JS on it starts at 25% and advances once, the first time the mock is half in view,
   about 700ms per step, then stops. No scroll listeners, no loops. */
(function () {
  'use strict';
  var mock = document.querySelector('[data-pf-mock]');
  if (!mock || !('IntersectionObserver' in window)) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var list = mock.querySelector('.pf-mock-stages');
  var status = mock.querySelector('[data-pf-mock-status]');
  if (!list) return;
  var items = list.querySelectorAll('li[data-step]');
  var finalText = status ? status.textContent : '';
  var skus = { '25': 3, '50': 6, '100': 12 };
  var STEP_MS = 700;

  function show(step) {
    list.setAttribute('data-stage', step);
    for (var i = 0; i < items.length; i++) {
      if (items[i].getAttribute('data-step') === step) items[i].setAttribute('aria-current', 'step');
      else items[i].removeAttribute('aria-current');
    }
    if (status) {
      status.textContent = step === '100' ? finalText : 'Live on ' + skus[step] + ' of 12 SKUs. Every shopper sees the same price.';
    }
  }

  var timers = [];
  function finish() {
    for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
    show('100');
  }

  var io = new IntersectionObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      if (!entries[i].isIntersecting) continue;
      io.disconnect();
      timers.push(setTimeout(function () { show('50'); }, STEP_MS));
      timers.push(setTimeout(finish, STEP_MS * 2));
      // Never leave the mock mid-sequence if the tab is hidden while it runs.
      document.addEventListener('visibilitychange', function onVis() {
        if (document.hidden) { finish(); document.removeEventListener('visibilitychange', onVis); }
      });
      return;
    }
  }, { threshold: 0.5 });
  // Start at the first stage before the mock has been seen, so the sequence never jumps backwards on screen.
  show('25');
  io.observe(mock);
})();
