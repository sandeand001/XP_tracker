/* ═══════════════════════════════════════════════════════════
   Page-Turn Transition — Complete SPA Navigation Controller
   ═══════════════════════════════════════════════════════════
   This script OWNS all [data-page] navigation.  Flow:

   1. User clicks a [data-page] link/button.
   2. We snapshot the current viewport into a fixed clone.
   3. Under the clone (invisible to the user) we:
      a. Clear the OLD page's dynamic content so it looks unloaded.
      b. Swap the active section to the NEW page.
      c. Render the NEW page's content via app.js navigateTo.
   4. Animate the clone peeling away (directionally), revealing
      the fully-rendered new page underneath.
   5. Remove the clone.  Done — no flash, no re-trigger.

   The clone sits at z-index 99995 over EVERYTHING, so
   whatever happens underneath during swap is invisible.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Page ordering for direction ── */
  var NAV_ORDER = ['home','tracker','daily','behavior','leaderboard','currency','log','settings'];

  function pageIndex(p) {
    var i = NAV_ORDER.indexOf(p);
    return i < 0 ? 0 : i;
  }

  var busy = false;

  /* ── Boot ── */
  function init() {
    /* Intercept ALL clicks on [data-page] elements */
    document.addEventListener('click', function (e) {
      var link = e.target.closest('[data-page]');
      if (!link) return;

      /* ALWAYS eat the event so the browser never follows href="#…" */
      e.preventDefault();
      e.stopPropagation();

      if (busy) return;

      var targetPage = link.dataset.page;
      if (!targetPage) return;

      var cur = document.querySelector('.page-content.active');
      var curPage = cur ? cur.dataset.page : 'home';
      if (curPage === targetPage) return;

      busy = true;
      var dir = pageIndex(targetPage) > pageIndex(curPage) ? 'left' : 'right';

      doPageTurn(curPage, targetPage, dir).finally(function () {
        busy = false;
      });
    }, true);   /* ← useCapture so we fire BEFORE any other listeners */
  }

  /* ── Easing ── */
  function ease(t) {
    return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
  }

  /* ── Clear dynamic content on the OLD page so it looks unloaded ── */
  function clearPageContent(page) {
    switch (page) {
      case 'tracker':
        var tb = document.getElementById('tracker-body');
        if (tb) tb.innerHTML = '';
        break;
      case 'daily':
        var db = document.getElementById('daily-body');
        if (db) db.innerHTML = '';
        break;
      case 'behavior':
        var bb = document.getElementById('behavior-body');
        if (bb) bb.innerHTML = '';
        break;
      case 'leaderboard':
        var lc = document.getElementById('leaderboard-container');
        var gs = document.getElementById('guild-summary');
        if (lc) lc.innerHTML = '';
        if (gs) gs.innerHTML = '';
        break;
      case 'currency':
        var cb = document.getElementById('currency-body');
        var sl = document.getElementById('spend-log-body');
        if (cb) cb.innerHTML = '';
        if (sl) sl.innerHTML = '';
        break;
      case 'log':
        var lb = document.getElementById('log-body');
        if (lb) lb.innerHTML = '';
        break;
      /* home & settings are static — nothing to clear */
    }
  }

  /* ── Swap active section + update nav + theme ── */
  function swapToPage(page) {
    if (typeof window.__spaNavigateTo === 'function') {
      window.__spaNavigateTo(page);
    } else {
      /* Fallback — minimal swap */
      document.querySelectorAll('.page-content[data-page]').forEach(function (s) {
        s.classList.toggle('active', s.dataset.page === page);
      });
      document.querySelectorAll('#main-nav .nav-btn[data-page]').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.page === page);
      });
      var isHome = (page === 'home');
      document.body.classList.toggle('landing-body', isHome);
      var m = document.getElementById('app-main');
      if (m) m.classList.toggle('landing-main', isHome);
      var sf = document.getElementById('starfield');
      if (sf) sf.style.display = isHome ? '' : 'none';
      history.replaceState(null, '', '#' + page);
    }
    window.scrollTo(0, 0);
  }

  /* ═══════════════════════════════════════
     Main page-turn sequence
     ═══════════════════════════════════════ */
  function doPageTurn(fromPage, toPage, direction) {
    var W = window.innerWidth;
    var scrollY = window.scrollY;
    var DURATION = 650;

    var fromBg = (fromPage === 'home') ? '#0b0818' : '#ede8d0';
    var toBg   = (toPage   === 'home') ? '#0b0818' : '#ede8d0';

    /* 1. Lock <html> background to current theme */
    document.documentElement.style.background = fromBg;

    /* 2. Snapshot the viewport ─────────────────────────── */
    var clone = document.createElement('div');
    clone.style.cssText =
      'position:fixed;inset:0;z-index:99995;overflow:hidden;' +
      'pointer-events:none;background:' + fromBg + ';will-change:clip-path;';

    var kids = document.body.children;
    for (var i = 0; i < kids.length; i++) {
      var el = kids[i];
      var tag = el.tagName.toLowerCase();
      if (tag === 'script' || tag === 'canvas') continue;
      if (el.id === 'modal-overlay' || el.id === 'toast-container') continue;
      clone.appendChild(el.cloneNode(true));
    }

    /* Match scroll offset */
    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;top:' + (-scrollY) + 'px;';
    while (clone.firstChild) wrap.appendChild(clone.firstChild);
    clone.appendChild(wrap);

    document.body.appendChild(clone);
    /* Clone now covers the ENTIRE screen — user sees the old page frozen. */

    /* 2b. Force the REAL header below the clone's z-index so its
           sticky positioning can't bleed through during the swap.
           Also hide starfield canvas so it doesn't flash. */
    var appHeader = document.getElementById('app-header');
    var starfield = document.getElementById('starfield');
    var savedHeaderZ = appHeader ? appHeader.style.zIndex : '';
    if (appHeader) appHeader.style.zIndex = '-1';
    if (starfield) starfield.style.visibility = 'hidden';

    /* 3. Under the clone: clear old, swap to new, render ─ */
    clearPageContent(fromPage);
    swapToPage(toPage);
    document.documentElement.style.background = toBg;
    window.scrollTo(0, 0);

    /* 3b. Now that the swap is done, restore header z-index so it
           appears correctly as the clone peels away */
    if (appHeader) appHeader.style.zIndex = savedHeaderZ || '';

    /* 4. Shadow & backface effects ─────────────────────── */
    var shadowDir = (direction === 'left') ? 'to left' : 'to right';
    var shadow = document.createElement('div');
    shadow.style.cssText =
      'position:fixed;top:0;bottom:0;width:60px;z-index:99996;' +
      'pointer-events:none;opacity:0;' +
      'background:linear-gradient(' + shadowDir +
        ',rgba(0,0,0,0) 0%,rgba(0,0,0,0.15) 40%,' +
        'rgba(0,0,0,0.25) 50%,rgba(0,0,0,0.15) 60%,rgba(0,0,0,0) 100%);';
    document.body.appendChild(shadow);

    var bfDir = (direction === 'left') ? 'to right' : 'to left';
    var backface = document.createElement('div');
    backface.style.cssText =
      'position:fixed;top:0;bottom:0;width:0;z-index:99994;' +
      'pointer-events:none;' +
      'background:linear-gradient(' + bfDir +
        ',rgba(245,240,225,0.5) 0%,rgba(237,232,209,0.85) 40%,' +
        'rgba(230,225,200,0.6) 100%);';
    document.body.appendChild(backface);

    /* 5. Animate the clone peeling away ────────────────── */
    var t0 = performance.now();

    return new Promise(function (resolve) {
      function frame(now) {
        var raw = Math.min((now - t0) / DURATION, 1);
        var t = ease(raw);
        var sinT = Math.sin(t * Math.PI);
        var skew = sinT * 3;

        if (direction === 'left') {
          var fx = W * (1 - t);
          clone.style.clipPath = 'polygon(0 0,' + fx + 'px 0,' + fx + 'px 100%,0 100%)';
          shadow.style.left  = (fx - 30) + 'px';
          shadow.style.right = 'auto';
          var bw = Math.min(t * W * 0.3, 160);
          backface.style.left  = fx + 'px';
          backface.style.right = 'auto';
          backface.style.width = bw + 'px';
          shadow.style.transform = 'skewY(' + skew + 'deg)';
        } else {
          var fx2 = W * t;
          clone.style.clipPath = 'polygon(' + fx2 + 'px 0,100% 0,100% 100%,' + fx2 + 'px 100%)';
          shadow.style.left  = (fx2 - 30) + 'px';
          shadow.style.right = 'auto';
          var bw2 = Math.min(t * W * 0.3, 160);
          backface.style.right = (W - fx2) + 'px';
          backface.style.left  = 'auto';
          backface.style.width = bw2 + 'px';
          shadow.style.transform = 'skewY(' + (-skew) + 'deg)';
        }
        shadow.style.opacity   = String(sinT * 0.9);
        backface.style.opacity = String(sinT * 0.7);

        if (raw < 1) {
          requestAnimationFrame(frame);
        } else {
          clone.remove();
          shadow.remove();
          backface.remove();
          if (starfield) starfield.style.visibility = '';
          document.documentElement.style.background = '';
          resolve();
        }
      }
      requestAnimationFrame(frame);
    });
  }

  /* ── Start ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
