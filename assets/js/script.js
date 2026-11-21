/* ==========================================================================
   lenadlm.github.io — script.js
   Plain vanilla JS: live clock in the nav + scroll-triggered reveal for
   panels. No jQuery / Bootstrap JS bundle required.
   ========================================================================== */

(function () {
  'use strict';

  // ---- Nav clock ----
  function tick() {
    var el = document.getElementById('clock');
    if (!el) return;
    var d = new Date();
    var h = d.getHours();
    var m = d.getMinutes();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    var mm = m < 10 ? '0' + m : m;
    el.textContent = h + ':' + mm + ' ' + ampm;
  }
  tick();
  setInterval(tick, 1000 * 30);

  // ---- Scroll reveal for .panel elements marked with .reveal ----
  function initReveal() {
    var targets = document.querySelectorAll('.reveal');
    if (!targets.length) return;

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15 });

      targets.forEach(function (el) { observer.observe(el); });
    } else {
      targets.forEach(function (el) { el.classList.add('is-visible'); });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReveal);
  } else {
    initReveal();
  }
})();
