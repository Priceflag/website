/* Priceflag nav: narrow-screen menu disclosure (M3). Vanilla, no deps, defer-safe, no globals.
   Without this script the menu list renders as a wrapped row and the Menu button stays hidden.
   Non-modal: no focus trap. Closes on Esc (focus returns to the button), on a click outside the nav,
   on a link click inside the menu, when focus leaves the nav, and when the viewport widens to desktop. */
(function () {
  'use strict';
  var nav = document.querySelector('[data-pf-nav]');
  if (!nav) return;
  var btn = nav.querySelector('.pf-nav-toggle');
  var menu = btn && document.getElementById(btn.getAttribute('aria-controls'));
  if (!btn || !menu) return;

  var desktop = window.matchMedia('(min-width: 768px)');

  function isOpen() { return btn.getAttribute('aria-expanded') === 'true'; }

  function setOpen(open, returnFocus) {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) nav.setAttribute('data-open', ''); else nav.removeAttribute('data-open');
    if (!open && returnFocus) btn.focus();
  }

  btn.hidden = false;
  nav.setAttribute('data-pf-nav', 'ready');

  btn.addEventListener('click', function () { setOpen(!isOpen(), false); });

  // On the document, not the nav: Safari does not focus a button on click, so focus may be on <body> while the menu is open.
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Escape' || e.key === 'Esc') && isOpen()) {
      e.preventDefault();
      setOpen(false, true);
    }
  });

  menu.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('a') && isOpen()) setOpen(false, false);
  });

  document.addEventListener('pointerdown', function (e) {
    if (isOpen() && !nav.contains(e.target)) setOpen(false, false);
  });

  nav.addEventListener('focusout', function (e) {
    if (isOpen() && e.relatedTarget && !nav.contains(e.relatedTarget)) setOpen(false, false);
  });

  function onWidth() { if (desktop.matches && isOpen()) setOpen(false, false); }
  if (desktop.addEventListener) desktop.addEventListener('change', onWidth);
  else if (desktop.addListener) desktop.addListener(onWidth);
})();
