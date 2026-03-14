/* ═══════════════════════════════════════════
   Landing Page — Starfield + Scroll Fade (SPA)
   ═══════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Full-page Starfield ─────────────────── */
  const canvas = document.getElementById('starfield');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const stars = [];
  const STAR_COUNT = 260;
  const SHOOTING_INTERVAL = 4000;   // ms between shooting stars

  let animationId = null;
  let shooterInterval = null;
  let isRunning = false;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = Math.max(document.documentElement.scrollHeight, window.innerHeight);
  }
  window.addEventListener('resize', () => { if (isRunning) { resize(); seedStars(); } });

  function seedStars() {
    stars.length = 0;
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.6 + 0.3,
        baseAlpha: Math.random() * 0.6 + 0.25,
        twinkleSpeed: Math.random() * 0.003 + 0.001,
        twinkleOffset: Math.random() * Math.PI * 2,
        hue: Math.random() < 0.15 ? 45 : Math.random() < 0.3 ? 260 : 0,
        sat: Math.random() < 0.3 ? 40 : 0
      });
    }
  }

  /* Shooting stars */
  const shooters = [];
  function spawnShooter() {
    shooters.push({
      x: Math.random() * canvas.width * 0.8,
      y: Math.random() * canvas.height * 0.4,
      len: Math.random() * 80 + 60,
      speed: Math.random() * 6 + 4,
      angle: Math.PI / 4 + (Math.random() - 0.5) * 0.3,
      alpha: 1,
      decay: Math.random() * 0.015 + 0.01
    });
  }

  /* Nebula blobs — soft colour washes */
  const nebulae = [
    { x: 0.2, y: 0.15, rx: 220, ry: 140, color: 'rgba(124,77,255,0.035)' },
    { x: 0.75, y: 0.35, rx: 180, ry: 200, color: 'rgba(41,121,255,0.025)' },
    { x: 0.5, y: 0.65, rx: 260, ry: 160, color: 'rgba(255,121,198,0.02)' },
    { x: 0.3, y: 0.85, rx: 200, ry: 130, color: 'rgba(124,77,255,0.025)' }
  ];

  function drawNebulae() {
    nebulae.forEach(n => {
      const gx = n.x * canvas.width;
      const gy = n.y * canvas.height;
      const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(n.rx, n.ry));
      grad.addColorStop(0, n.color);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(gx, gy, n.rx, n.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  let frameTick = 0;
  function drawStars() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    /* Nebulae */
    drawNebulae();

    /* Stars */
    frameTick++;
    for (const s of stars) {
      const twinkle = Math.sin(frameTick * s.twinkleSpeed + s.twinkleOffset);
      const alpha = s.baseAlpha + twinkle * 0.25;
      if (s.sat > 0) {
        ctx.fillStyle = `hsla(${s.hue}, ${s.sat}%, 85%, ${Math.max(0.05, alpha)})`;
      } else {
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0.05, alpha)})`;
      }
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    /* Shooting stars */
    for (let i = shooters.length - 1; i >= 0; i--) {
      const sh = shooters[i];
      const tailX = sh.x - Math.cos(sh.angle) * sh.len;
      const tailY = sh.y - Math.sin(sh.angle) * sh.len;
      const grad = ctx.createLinearGradient(tailX, tailY, sh.x, sh.y);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(1, `rgba(255,255,255,${sh.alpha})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(sh.x, sh.y);
      ctx.stroke();

      sh.x += Math.cos(sh.angle) * sh.speed;
      sh.y += Math.sin(sh.angle) * sh.speed;
      sh.alpha -= sh.decay;
      if (sh.alpha <= 0) shooters.splice(i, 1);
    }

    animationId = requestAnimationFrame(drawStars);
  }

  /* Re-size canvas when content changes height */
  let ro = null;

  /* ── Scroll-driven Bi-directional Fade ──── */
  let fadeSections = [];
  let ticking = false;

  function updateFade() {
    const vh = window.innerHeight;
    const sweetTop = vh * 0.15;
    const sweetBot = vh * 0.85;

    fadeSections.forEach(el => {
      const rect = el.getBoundingClientRect();
      const center = rect.top + rect.height / 2;

      let opacity;
      if (center < sweetTop) {
        opacity = Math.max(0, center / sweetTop);
      } else if (center > sweetBot) {
        opacity = Math.max(0, (vh - center) / (vh - sweetBot));
      } else {
        opacity = 1;
      }

      const translate = (1 - opacity) * 18;
      el.style.opacity = opacity.toFixed(3);
      el.style.transform = `translateY(${translate.toFixed(1)}px)`;
    });
  }

  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(() => { updateFade(); ticking = false; });
      ticking = true;
    }
  }

  /* ── Start / Stop ──────────────────────── */
  function startStarfield() {
    if (isRunning) return;
    isRunning = true;
    resize();
    seedStars();
    animationId = requestAnimationFrame(drawStars);
    shooterInterval = setInterval(spawnShooter, SHOOTING_INTERVAL);

    ro = new ResizeObserver(() => {
      const newH = Math.max(document.documentElement.scrollHeight, window.innerHeight);
      if (Math.abs(canvas.height - newH) > 50) {
        canvas.height = newH;
        seedStars();
      }
    });
    ro.observe(document.documentElement);

    // Reinitialize scroll fade for home section
    fadeSections = document.querySelectorAll('.page-content.active .fade-section');
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    updateFade();
  }

  function stopStarfield() {
    if (!isRunning) return;
    isRunning = false;
    if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
    if (shooterInterval) { clearInterval(shooterInterval); shooterInterval = null; }
    if (ro) { ro.disconnect(); ro = null; }
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    shooters.length = 0;
  }

  /* ── Listen for SPA page changes ──────── */
  window.addEventListener('spa:pageChanged', (e) => {
    if (e.detail.page === 'home') {
      startStarfield();
    } else {
      stopStarfield();
    }
  });

  // Start immediately if we're on the home page
  const initialSection = document.querySelector('.page-content.active');
  if (initialSection && initialSection.dataset.page === 'home') {
    startStarfield();
  }

})();
