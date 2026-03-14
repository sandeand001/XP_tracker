/* ═══════════════════════════════════════════════════════════
   Page-Turn Transition — Custom canvas page curl
   ═══════════════════════════════════════════════════════════
   On nav click:
   1. Capture the current page as an image (html2canvas-lite
      via an offscreen clone rendered to a canvas).
   2. Fetch the destination page, render its content into
      a background layer.
   3. Animate the current-page image peeling/curling away
      with a realistic fold, revealing the destination below.
   4. After animation → navigate to the real URL.

   The curl is rendered on a <canvas> using a clipping region
   that simulates a page being turned from the right edge.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function init() {
    /* ARRIVAL: if we came from a page turn, fade the body in smoothly.
       The <head> script already set body to opacity:0 before first paint. */
    if (sessionStorage.getItem('ptArrival')) {
      sessionStorage.removeItem('ptArrival');
      // Wait for the page to be fully rendered before fading in
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.body.classList.add('pt-fade-in');
        });
      });
    }

    let navigating = false;

    document.addEventListener('click', (e) => {
      if (navigating) return;
      const link = e.target.closest('a.nav-btn, a.btn-quest, a.tool-row');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript')) return;
      if (link.classList.contains('active')) { e.preventDefault(); return; }

      e.preventDefault();
      navigating = true;
      runPageTurn(href).catch(() => {
        window.location.href = href;
      });
    });
  }

  /* ── Easing ── */
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /* ────────────────────────────────────────────────────
     Core: snapshot current page, fetch dest, animate
     ──────────────────────────────────────────────────── */
  async function runPageTurn(href) {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const scrollY = window.scrollY;

    /* 1. Fetch destination HTML */
    let destHTML;
    try {
      const resp = await fetch(href, { cache: 'default' });
      destHTML = await resp.text();
    } catch (_) {
      window.location.href = href;
      return;
    }
    const parser = new DOMParser();
    const destDoc = parser.parseFromString(destHTML, 'text/html');

    /* 2. Build DESTINATION layer (sits behind everything) */
    const destLayer = document.createElement('div');
    destLayer.id = 'pt-dest';
    destLayer.style.cssText = `
      position:fixed; inset:0; z-index:99990;
      overflow:hidden; pointer-events:none;
    `;
    const destIsLanding = destDoc.body.classList.contains('landing-body');
    destLayer.style.background = destIsLanding
      ? '#0b0818'
      : 'linear-gradient(135deg, #f5f0e1 0%, #e8e0cc 50%, #f0ead6 100%)';

    Array.from(destDoc.body.children).forEach(el => {
      const tag = el.tagName.toLowerCase();
      if (tag === 'script' || tag === 'canvas') return;
      const clone = el.cloneNode(true);
      if (clone.querySelectorAll) {
        clone.querySelectorAll('.fade-section').forEach(fs => {
          fs.style.opacity = '1';
          fs.style.transform = 'none';
        });
      }
      destLayer.appendChild(clone);
    });
    document.body.appendChild(destLayer);

    /* 3. Build CURRENT PAGE clone (sits on top, will be clipped) */
    const cloneLayer = document.createElement('div');
    cloneLayer.id = 'pt-clone';
    cloneLayer.style.cssText = `
      position:fixed; inset:0; z-index:99995;
      overflow:hidden; pointer-events:none;
    `;
    const bodyBg = getComputedStyle(document.body).background ||
                   getComputedStyle(document.body).backgroundColor || '#fbf7e9';
    cloneLayer.style.background = bodyBg;

    Array.from(document.body.children).forEach(el => {
      const tag = el.tagName.toLowerCase();
      if (tag === 'script' || tag === 'iframe' || tag === 'canvas') return;
      if (el.id === 'pt-dest' || el.id === 'pt-clone' || el.id === 'pt-shadow') return;
      cloneLayer.appendChild(el.cloneNode(true));
    });
    // Offset for current scroll position
    const inner = document.createElement('div');
    inner.style.cssText = `position:relative; top:${-scrollY}px;`;
    while (cloneLayer.firstChild) inner.appendChild(cloneLayer.firstChild);
    cloneLayer.appendChild(inner);

    document.body.appendChild(cloneLayer);

    /* 4. Build fold-shadow element */
    const shadow = document.createElement('div');
    shadow.id = 'pt-shadow';
    shadow.style.cssText = `
      position:fixed; top:0; bottom:0; width:60px;
      z-index:99996; pointer-events:none; opacity:0;
      background: linear-gradient(to left,
        rgba(0,0,0,0)    0%,
        rgba(0,0,0,0.12) 30%,
        rgba(0,0,0,0.25) 50%,
        rgba(0,0,0,0.12) 70%,
        rgba(0,0,0,0)   100%
      );
    `;
    document.body.appendChild(shadow);

    /* 5. Build back-of-page highlight (the curling page's underside) */
    const backface = document.createElement('div');
    backface.id = 'pt-backface';
    backface.style.cssText = `
      position:fixed; top:0; bottom:0; width:0;
      z-index:99994; pointer-events:none;
      background: linear-gradient(to right,
        rgba(245,240,225,0.6) 0%,
        rgba(237,232,209,0.9) 40%,
        rgba(230,225,200,0.7) 100%
      );
      right:0;
    `;
    document.body.appendChild(backface);

    /* 6. Animate the page turning from right to left */
    const DURATION = 800; // ms
    const t0 = performance.now();

    return new Promise((resolve) => {
      function frame(now) {
        const elapsed = now - t0;
        const rawT = Math.min(elapsed / DURATION, 1);
        const t = easeInOutCubic(rawT);

        /* The fold line moves from right edge (W) to left (0) */
        const foldX = W * (1 - t);

        /* Clip the current-page clone: only show left of the fold */
        cloneLayer.style.clipPath = `polygon(0 0, ${foldX}px 0, ${foldX}px 100%, 0 100%)`;

        /* Position fold shadow at the fold line */
        shadow.style.left = (foldX - 30) + 'px';
        shadow.style.opacity = String(Math.sin(t * Math.PI) * 0.9);

        /* Back-of-page: shows a sliver to the right of the fold
           simulating the turned page's underside with a gradient */
        const backW = Math.min(t * W * 0.35, 180);
        backface.style.left = foldX + 'px';
        backface.style.width = backW + 'px';
        backface.style.opacity = String(Math.sin(t * Math.PI) * 0.7);

        /* Add a subtle curl effect: skew the fold shadow */
        const skewDeg = Math.sin(t * Math.PI) * 3;
        shadow.style.transform = `skewY(${skewDeg}deg)`;

        if (rawT < 1) {
          requestAnimationFrame(frame);
        } else {
          /* Clean up and navigate */
          cloneLayer.remove();
          shadow.remove();
          backface.remove();
          /* Small delay so user sees the destination fully revealed */
          setTimeout(() => {
            destLayer.remove();
            sessionStorage.setItem('ptArrival', '1');
            window.location.href = href;
            resolve();
          }, 120);
        }
      }

      requestAnimationFrame(frame);
    });
  }

  /* ── Boot ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
