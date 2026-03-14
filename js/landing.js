/* ═══════════════════════════════════════════
   Background Engine — Per-theme animated canvas
   Each theme gets its own unique scene.
   ═══════════════════════════════════════════ */
(function () {
  'use strict';

  const canvas = document.getElementById('starfield');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let animationId = null;
  let isRunning = false;
  let currentScene = null;
  let frameTick = 0;

  // ── Canvas sizing ──
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = Math.max(document.documentElement.scrollHeight, window.innerHeight);
  }

  // ══════════════════════════════════════════
  //  SCENES
  // ══════════════════════════════════════════

  // ── 🌌 CELESTIAL VOID — stars, nebulae, shooting stars ──
  function createCelestialVoid() {
    const STAR_COUNT = 260;
    const stars = [];
    const shooters = [];
    const nebulae = [
      { x: 0.2, y: 0.15, rx: 220, ry: 140, color: 'rgba(124,77,255,0.035)' },
      { x: 0.75, y: 0.35, rx: 180, ry: 200, color: 'rgba(41,121,255,0.025)' },
      { x: 0.5, y: 0.65, rx: 260, ry: 160, color: 'rgba(255,121,198,0.02)' },
      { x: 0.3, y: 0.85, rx: 200, ry: 130, color: 'rgba(124,77,255,0.025)' }
    ];
    let shooterTimer = 0;

    function seed() {
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

    return {
      seed,
      draw(tick) {
        // Nebulae
        nebulae.forEach(n => {
          const gx = n.x * canvas.width, gy = n.y * canvas.height;
          const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(n.rx, n.ry));
          grad.addColorStop(0, n.color);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.ellipse(gx, gy, n.rx, n.ry, 0, 0, Math.PI * 2);
          ctx.fill();
        });
        // Stars
        for (const s of stars) {
          const twinkle = Math.sin(tick * s.twinkleSpeed + s.twinkleOffset);
          const alpha = Math.max(0.05, s.baseAlpha + twinkle * 0.25);
          ctx.fillStyle = s.sat > 0
            ? `hsla(${s.hue}, ${s.sat}%, 85%, ${alpha})`
            : `rgba(255,255,255,${alpha})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
        // Shooting stars
        shooterTimer++;
        if (shooterTimer > 240) {
          shooterTimer = 0;
          shooters.push({
            x: Math.random() * canvas.width * 0.8,
            y: Math.random() * canvas.height * 0.4,
            len: Math.random() * 80 + 60,
            speed: Math.random() * 6 + 4,
            angle: Math.PI / 4 + (Math.random() - 0.5) * 0.3,
            alpha: 1, decay: Math.random() * 0.015 + 0.01
          });
        }
        for (let i = shooters.length - 1; i >= 0; i--) {
          const sh = shooters[i];
          const tx = sh.x - Math.cos(sh.angle) * sh.len;
          const ty = sh.y - Math.sin(sh.angle) * sh.len;
          const grad = ctx.createLinearGradient(tx, ty, sh.x, sh.y);
          grad.addColorStop(0, 'rgba(255,255,255,0)');
          grad.addColorStop(1, `rgba(255,255,255,${sh.alpha})`);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(sh.x, sh.y); ctx.stroke();
          sh.x += Math.cos(sh.angle) * sh.speed;
          sh.y += Math.sin(sh.angle) * sh.speed;
          sh.alpha -= sh.decay;
          if (sh.alpha <= 0) shooters.splice(i, 1);
        }
      }
    };
  }

  // ── 🏰 ANCIENT PARCHMENT — floating dust motes, warm haze ──
  function createAncientParchment() {
    const MOTE_COUNT = 120;
    const motes = [];

    function seed() {
      motes.length = 0;
      for (let i = 0; i < MOTE_COUNT; i++) {
        motes.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          r: Math.random() * 2 + 0.5,
          baseAlpha: Math.random() * 0.3 + 0.08,
          driftX: (Math.random() - 0.5) * 0.3,
          driftY: -Math.random() * 0.2 - 0.05,
          wobbleSpeed: Math.random() * 0.02 + 0.005,
          wobbleAmp: Math.random() * 20 + 10,
          phase: Math.random() * Math.PI * 2,
          hue: 35 + Math.random() * 15
        });
      }
    }

    return {
      seed,
      draw(tick) {
        // Warm haze blobs
        const hazes = [
          { x: 0.15, y: 0.2, r: 280, color: 'rgba(160,120,40,0.02)' },
          { x: 0.8, y: 0.4, r: 220, color: 'rgba(140,100,30,0.018)' },
          { x: 0.4, y: 0.75, r: 260, color: 'rgba(180,140,50,0.015)' },
          { x: 0.6, y: 0.1, r: 200, color: 'rgba(120,90,30,0.012)' },
        ];
        hazes.forEach(h => {
          const gx = h.x * canvas.width, gy = h.y * canvas.height;
          const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, h.r);
          grad.addColorStop(0, h.color);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(gx, gy, h.r, 0, Math.PI * 2);
          ctx.fill();
        });
        // Dust motes
        for (const m of motes) {
          m.x += m.driftX + Math.sin(tick * m.wobbleSpeed + m.phase) * 0.3;
          m.y += m.driftY;
          if (m.y < -10) { m.y = canvas.height + 10; m.x = Math.random() * canvas.width; }
          if (m.x < -10) m.x = canvas.width + 10;
          if (m.x > canvas.width + 10) m.x = -10;
          const flicker = Math.sin(tick * 0.02 + m.phase) * 0.15;
          const alpha = Math.max(0.03, m.baseAlpha + flicker);
          ctx.fillStyle = `hsla(${m.hue}, 50%, 70%, ${alpha})`;
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
          ctx.fill();
          if (m.r > 1.5) {
            ctx.fillStyle = `hsla(${m.hue}, 40%, 60%, ${alpha * 0.3})`;
            ctx.beginPath();
            ctx.arc(m.x, m.y, m.r * 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    };
  }

  // ── 🌲 ENCHANTED FOREST — fireflies + drifting leaves ──
  function createEnchantedForest() {
    const FIREFLY_COUNT = 80;
    const LEAF_COUNT = 25;
    const fireflies = [];
    const leaves = [];

    function seed() {
      fireflies.length = 0;
      leaves.length = 0;
      for (let i = 0; i < FIREFLY_COUNT; i++) {
        fireflies.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          baseAlpha: Math.random() * 0.5 + 0.2,
          pulseSpeed: Math.random() * 0.04 + 0.01,
          phase: Math.random() * Math.PI * 2,
          wanderX: Math.random() * 0.5 - 0.25,
          wanderY: Math.random() * 0.3 - 0.15,
          r: Math.random() * 1.5 + 0.8,
          hue: 100 + Math.random() * 60
        });
      }
      for (let i = 0; i < LEAF_COUNT; i++) {
        leaves.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 6 + 3,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.02,
          fallSpeed: Math.random() * 0.4 + 0.15,
          swaySpeed: Math.random() * 0.015 + 0.005,
          swayAmp: Math.random() * 40 + 20,
          phase: Math.random() * Math.PI * 2,
          alpha: Math.random() * 0.2 + 0.05,
          hue: 90 + Math.random() * 50
        });
      }
    }

    return {
      seed,
      draw(tick) {
        // Forest mist
        const mists = [
          { x: 0.2, y: 0.3, r: 300, color: 'rgba(30,160,80,0.02)' },
          { x: 0.7, y: 0.6, r: 250, color: 'rgba(20,140,60,0.018)' },
          { x: 0.5, y: 0.85, r: 280, color: 'rgba(40,180,100,0.015)' },
        ];
        mists.forEach(m => {
          const gx = m.x * canvas.width, gy = m.y * canvas.height;
          const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, m.r);
          grad.addColorStop(0, m.color);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(gx, gy, m.r, 0, Math.PI * 2);
          ctx.fill();
        });
        // Fireflies
        for (const f of fireflies) {
          f.x += f.wanderX + Math.sin(tick * 0.008 + f.phase) * 0.5;
          f.y += f.wanderY + Math.cos(tick * 0.006 + f.phase) * 0.3;
          if (f.x < -20) f.x = canvas.width + 20;
          if (f.x > canvas.width + 20) f.x = -20;
          if (f.y < -20) f.y = canvas.height + 20;
          if (f.y > canvas.height + 20) f.y = -20;
          const pulse = Math.sin(tick * f.pulseSpeed + f.phase);
          const alpha = Math.max(0.05, f.baseAlpha * (0.5 + pulse * 0.5));
          const glowR = f.r * 8;
          const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, glowR);
          grad.addColorStop(0, `hsla(${f.hue}, 80%, 70%, ${alpha * 0.4})`);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(f.x, f.y, glowR, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `hsla(${f.hue}, 90%, 80%, ${alpha})`;
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
          ctx.fill();
        }
        // Falling leaves
        for (const l of leaves) {
          l.y += l.fallSpeed;
          l.x += Math.sin(tick * l.swaySpeed + l.phase) * 0.6;
          l.rotation += l.rotSpeed;
          if (l.y > canvas.height + 20) {
            l.y = -20;
            l.x = Math.random() * canvas.width;
          }
          ctx.save();
          ctx.translate(l.x, l.y);
          ctx.rotate(l.rotation);
          ctx.fillStyle = `hsla(${l.hue}, 50%, 40%, ${l.alpha})`;
          ctx.beginPath();
          ctx.ellipse(0, 0, l.size, l.size * 0.45, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = `hsla(${l.hue}, 40%, 50%, ${l.alpha * 0.6})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(-l.size, 0);
          ctx.lineTo(l.size, 0);
          ctx.stroke();
          ctx.restore();
        }
      }
    };
  }

  // ── 🐉 DRAGON'S EMBER — rising embers, heat shimmer, lava glow ──
  function createDragonsEmber() {
    const EMBER_COUNT = 100;
    const embers = [];

    function seed() {
      embers.length = 0;
      for (let i = 0; i < EMBER_COUNT; i++) {
        embers.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          r: Math.random() * 2.5 + 0.5,
          baseAlpha: Math.random() * 0.6 + 0.15,
          riseSpeed: Math.random() * 0.8 + 0.2,
          wobbleSpeed: Math.random() * 0.02 + 0.008,
          wobbleAmp: Math.random() * 30 + 10,
          phase: Math.random() * Math.PI * 2,
          life: Math.random(),
          decay: Math.random() * 0.001 + 0.0005,
          hue: Math.random() * 40
        });
      }
    }

    function resetEmber(e) {
      e.x = Math.random() * canvas.width;
      e.y = canvas.height + Math.random() * 100;
      e.life = 1;
      e.r = Math.random() * 2.5 + 0.5;
      e.baseAlpha = Math.random() * 0.6 + 0.15;
    }

    return {
      seed,
      draw(tick) {
        // Lava glow from bottom
        const lavaGrad = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - 400);
        lavaGrad.addColorStop(0, 'rgba(200,40,10,0.04)');
        lavaGrad.addColorStop(0.4, 'rgba(180,60,10,0.015)');
        lavaGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = lavaGrad;
        ctx.fillRect(0, canvas.height - 400, canvas.width, 400);

        // Heat shimmer blobs
        const heats = [
          { x: 0.3, y: 0.5, r: 250, color: 'rgba(200,50,20,0.02)' },
          { x: 0.7, y: 0.3, r: 200, color: 'rgba(255,100,30,0.015)' },
          { x: 0.5, y: 0.7, r: 280, color: 'rgba(180,40,10,0.018)' },
        ];
        heats.forEach(h => {
          const gx = h.x * canvas.width, gy = h.y * canvas.height;
          const ox = Math.sin(tick * 0.005) * 20;
          const oy = Math.cos(tick * 0.004) * 15;
          const grad = ctx.createRadialGradient(gx + ox, gy + oy, 0, gx + ox, gy + oy, h.r);
          grad.addColorStop(0, h.color);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(gx + ox, gy + oy, h.r, 0, Math.PI * 2);
          ctx.fill();
        });

        // Embers rising
        for (const e of embers) {
          e.y -= e.riseSpeed;
          e.x += Math.sin(tick * e.wobbleSpeed + e.phase) * 0.8;
          e.life -= e.decay;
          if (e.life <= 0 || e.y < -20) resetEmber(e);
          const alpha = Math.max(0, e.baseAlpha * e.life);
          const glowR = e.r * 6;
          const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, glowR);
          grad.addColorStop(0, `hsla(${e.hue}, 100%, 60%, ${alpha * 0.3})`);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(e.x, e.y, glowR, 0, Math.PI * 2);
          ctx.fill();
          const lightness = 50 + e.life * 30;
          ctx.fillStyle = `hsla(${e.hue}, 100%, ${lightness}%, ${alpha})`;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r * e.life, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };
  }

  // ── 🌊 FROZEN DEPTHS — snowflakes, aurora, ice crystals ──
  function createFrozenDepths() {
    const SNOW_COUNT = 100;
    const CRYSTAL_COUNT = 30;
    const snowflakes = [];
    const crystals = [];
    let auroraPhase = 0;

    function seed() {
      snowflakes.length = 0;
      crystals.length = 0;
      for (let i = 0; i < SNOW_COUNT; i++) {
        snowflakes.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          r: Math.random() * 2 + 0.5,
          fallSpeed: Math.random() * 0.6 + 0.15,
          swaySpeed: Math.random() * 0.01 + 0.003,
          swayAmp: Math.random() * 30 + 15,
          phase: Math.random() * Math.PI * 2,
          alpha: Math.random() * 0.4 + 0.1
        });
      }
      for (let i = 0; i < CRYSTAL_COUNT; i++) {
        crystals.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 3 + 1,
          alpha: Math.random() * 0.15 + 0.03,
          twinkleSpeed: Math.random() * 0.03 + 0.01,
          phase: Math.random() * Math.PI * 2,
          rotation: Math.random() * Math.PI
        });
      }
    }

    return {
      seed,
      draw(tick) {
        auroraPhase += 0.003;

        // Aurora borealis
        for (let band = 0; band < 3; band++) {
          ctx.beginPath();
          const yBase = 60 + band * 50;
          const alpha = 0.015 - band * 0.003;
          const hue = 180 + band * 30;
          ctx.moveTo(0, yBase);
          for (let x = 0; x <= canvas.width; x += 8) {
            const wave = Math.sin(x * 0.003 + auroraPhase + band * 0.8) * 40
                       + Math.sin(x * 0.007 + auroraPhase * 1.3) * 20;
            ctx.lineTo(x, yBase + wave);
          }
          ctx.lineTo(canvas.width, yBase + 120);
          ctx.lineTo(0, yBase + 120);
          ctx.closePath();
          const grad = ctx.createLinearGradient(0, yBase, 0, yBase + 120);
          grad.addColorStop(0, `hsla(${hue}, 80%, 60%, ${alpha})`);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.fill();
        }

        // Snowflakes
        for (const s of snowflakes) {
          s.y += s.fallSpeed;
          s.x += Math.sin(tick * s.swaySpeed + s.phase) * 0.4;
          if (s.y > canvas.height + 10) {
            s.y = -10;
            s.x = Math.random() * canvas.width;
          }
          ctx.fillStyle = `rgba(200,220,255,${s.alpha})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fill();
        }

        // Ice crystals
        for (const c of crystals) {
          const twinkle = Math.sin(tick * c.twinkleSpeed + c.phase);
          const alpha = Math.max(0.02, c.alpha + twinkle * 0.08);
          ctx.save();
          ctx.translate(c.x, c.y);
          ctx.rotate(c.rotation);
          ctx.strokeStyle = `rgba(150,200,255,${alpha})`;
          ctx.lineWidth = 0.5;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(-c.size, 0);
            ctx.lineTo(c.size, 0);
            ctx.stroke();
            ctx.rotate(Math.PI / 3);
          }
          ctx.fillStyle = `rgba(180,220,255,${alpha * 0.5})`;
          ctx.beginPath();
          ctx.arc(0, 0, c.size * 0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    };
  }

  // ── 🏫 SUNMERE ACADEMY — golden sunbeams, dust motes, drifting quill feathers ──
  function createSunmereAcademy() {
    const MOTE_COUNT = 90;
    const FEATHER_COUNT = 12;
    const motes = [];
    const feathers = [];
    let sunbeamPhase = 0;

    function seed() {
      motes.length = 0;
      feathers.length = 0;
      // Golden dust motes floating in sunbeams
      for (let i = 0; i < MOTE_COUNT; i++) {
        motes.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          r: Math.random() * 1.8 + 0.4,
          baseAlpha: Math.random() * 0.35 + 0.1,
          driftX: (Math.random() - 0.5) * 0.15,
          driftY: Math.random() * 0.15 + 0.02,
          wobbleSpeed: Math.random() * 0.015 + 0.004,
          phase: Math.random() * Math.PI * 2,
          hue: 38 + Math.random() * 18 // warm golds 38-56
        });
      }
      // Drifting quill feathers
      for (let i = 0; i < FEATHER_COUNT; i++) {
        feathers.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 10 + 6,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.008,
          fallSpeed: Math.random() * 0.2 + 0.06,
          swaySpeed: Math.random() * 0.008 + 0.003,
          phase: Math.random() * Math.PI * 2,
          alpha: Math.random() * 0.12 + 0.03,
          hue: 30 + Math.random() * 25 // warm browns to golds
        });
      }
    }

    return {
      seed,
      draw(tick) {
        sunbeamPhase += 0.001;

        // Soft warm radial washes — like sunlight pooling through tall windows
        const washes = [
          { x: 0.8, y: 0.05, r: 450, a: 0.06 },
          { x: 0.15, y: 0.35, r: 350, a: 0.035 },
          { x: 0.55, y: 0.6, r: 400, a: 0.04 },
        ];
        washes.forEach(w => {
          const gx = w.x * canvas.width, gy = w.y * canvas.height;
          const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, w.r);
          grad.addColorStop(0, `rgba(255,220,140,${w.a})`);
          grad.addColorStop(0.6, `rgba(255,200,100,${w.a * 0.3})`);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(gx, gy, w.r, 0, Math.PI * 2);
          ctx.fill();
        });

        // Diagonal sunbeams from upper-right — visible on light cream
        for (let beam = 0; beam < 5; beam++) {
          const bx = canvas.width * (0.5 + beam * 0.11);
          const by = 0;
          const angle = Math.PI * 0.38 + Math.sin(sunbeamPhase + beam * 0.6) * 0.015;
          const len = canvas.height * 1.3;
          const width = 60 + beam * 25;

          const grad = ctx.createLinearGradient(bx, by, bx + Math.cos(angle) * len, by + Math.sin(angle) * len);
          const a = 0.055 - beam * 0.008;
          grad.addColorStop(0, `rgba(255,230,160,${a})`);
          grad.addColorStop(0.4, `rgba(255,210,120,${a * 0.4})`);
          grad.addColorStop(1, 'transparent');

          ctx.save();
          ctx.translate(bx, by);
          ctx.rotate(angle);
          ctx.fillStyle = grad;
          ctx.fillRect(-width / 2, 0, width, len);
          ctx.restore();
        }

        // Floating golden dust motes — richer tones for light background
        for (const m of motes) {
          m.x += m.driftX + Math.sin(tick * m.wobbleSpeed + m.phase) * 0.25;
          m.y += m.driftY;
          if (m.y > canvas.height + 10) { m.y = -10; m.x = Math.random() * canvas.width; }
          if (m.x < -10) m.x = canvas.width + 10;
          if (m.x > canvas.width + 10) m.x = -10;
          const flicker = Math.sin(tick * 0.018 + m.phase) * 0.12;
          const alpha = Math.max(0.08, m.baseAlpha * 0.8 + flicker);
          // Rich warm mote — darker gold on cream
          ctx.fillStyle = `hsla(${m.hue}, 65%, 48%, ${alpha})`;
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
          ctx.fill();
          // Warm soft halo
          if (m.r > 1.2) {
            ctx.fillStyle = `hsla(${m.hue}, 55%, 55%, ${alpha * 0.12})`;
            ctx.beginPath();
            ctx.arc(m.x, m.y, m.r * 4, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Drifting quill feathers — warm browns visible on cream
        for (const f of feathers) {
          f.y += f.fallSpeed;
          f.x += Math.sin(tick * f.swaySpeed + f.phase) * 0.4;
          f.rotation += f.rotSpeed;
          if (f.y > canvas.height + 30) {
            f.y = -30;
            f.x = Math.random() * canvas.width;
          }
          ctx.save();
          ctx.translate(f.x, f.y);
          ctx.rotate(f.rotation);
          ctx.globalAlpha = f.alpha * 2.5;
          // Quill shaft
          ctx.strokeStyle = `hsla(${f.hue}, 40%, 38%, 1)`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(-f.size * 0.8, 0);
          ctx.lineTo(f.size * 0.8, 0);
          ctx.stroke();
          // Feather vanes
          ctx.fillStyle = `hsla(${f.hue}, 35%, 42%, 0.6)`;
          ctx.beginPath();
          ctx.ellipse(0, -1, f.size * 0.65, f.size * 0.18, -0.15, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `hsla(${f.hue}, 30%, 36%, 0.45)`;
          ctx.beginPath();
          ctx.ellipse(0, 1.5, f.size * 0.55, f.size * 0.14, 0.1, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.restore();
        }
      }
    };
  }

  // ── Scene registry ──
  const sceneFactories = {
    'celestial-void':     createCelestialVoid,
    'ancient-parchment':  createAncientParchment,
    'enchanted-forest':   createEnchantedForest,
    'dragons-ember':      createDragonsEmber,
    'frozen-depths':      createFrozenDepths,
    'sunmere-academy':    createSunmereAcademy
  };

  function getThemeId() {
    return document.documentElement.getAttribute('data-theme') || 'celestial-void';
  }

  function switchScene() {
    const id = getThemeId();
    const factory = sceneFactories[id] || sceneFactories['celestial-void'];
    currentScene = factory();
    currentScene.seed();
  }

  // ── Main draw loop ──
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frameTick++;
    if (currentScene) currentScene.draw(frameTick);
    animationId = requestAnimationFrame(draw);
  }

  // ── Scroll-driven Bi-directional Fade (home page only) ──
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

  // ── Start ──
  let ro = null;

  function start() {
    if (isRunning) return;
    isRunning = true;
    resize();
    switchScene();
    animationId = requestAnimationFrame(draw);

    ro = new ResizeObserver(() => {
      const newH = Math.max(document.documentElement.scrollHeight, window.innerHeight);
      if (Math.abs(canvas.height - newH) > 50) {
        canvas.height = newH;
        if (currentScene) currentScene.seed();
      }
    });
    ro.observe(document.documentElement);

    fadeSections = document.querySelectorAll('.page-content.active .fade-section');
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    updateFade();
  }

  // ── SPA page changes ──
  window.addEventListener('spa:pageChanged', (e) => {
    if (e.detail.page === 'home') {
      fadeSections = document.querySelectorAll('.page-content.active .fade-section');
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
      updateFade();
    } else {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    }
  });

  // ── Theme changes ──
  window.addEventListener('theme:changed', () => {
    requestAnimationFrame(() => switchScene());
  });

  window.addEventListener('resize', () => {
    if (isRunning) {
      resize();
      if (currentScene) currentScene.seed();
    }
  });

  start();
})();
