/* Priceflag how-it-works: advances the step-4 rollout stages (25%, 50%, all) once, the first time they scroll into view.
   Explanatory motion only. No motion under prefers-reduced-motion; with JS off (or no IntersectionObserver)
   the stages simply show their final state. No globals. */
(function () {
  'use strict';
  var el = document.querySelector('[data-pf-rollout]');
  if (!el || !('IntersectionObserver' in window) || !window.matchMedia) return;
  var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (mq.matches) return;
  // Already on screen when the script runs: leave the final state rather than snap it back to empty.
  if (el.getBoundingClientRect().top < window.innerHeight) return;

  var timer = 0;
  var STEP_MS = 900; // longer than --pf-dur-slow (700ms) so each stage finishes before the next starts
  function finish() {
    clearTimeout(timer);
    el.removeAttribute('data-stage');
  }
  el.setAttribute('data-stage', '0');

  var io = new IntersectionObserver(function (entries) {
    if (!entries.some(function (e) { return e.isIntersecting; })) return;
    io.disconnect();
    var stage = 0;
    (function next() {
      stage += 1;
      if (stage >= 3) { finish(); return; }
      el.setAttribute('data-stage', String(stage));
      timer = setTimeout(next, STEP_MS);
    })();
  }, { threshold: 0.6 });
  io.observe(el);

  // If the visitor turns on reduced motion mid-way, jump to the final state.
  var onChange = function (e) { if (e.matches) { io.disconnect(); finish(); } };
  if (mq.addEventListener) mq.addEventListener('change', onChange);
  else if (mq.addListener) mq.addListener(onChange);
})();
