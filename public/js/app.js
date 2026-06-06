/* ────────────────────────────────────────────────────────
   JARVIS CP DASHBOARD — app.js
   Handles: loader, cursor, grid canvas, GSAP animations,
            scroll triggers, counter, progress bars,
            filter, AI modal, navbar scroll
─────────────────────────────────────────────────────── */

gsap.registerPlugin(ScrollTrigger, TextPlugin);

/* ═══════════════════════════════════════════════════════
   1. LOADER
═══════════════════════════════════════════════════════ */
window.addEventListener('load', () => {
  const loader = document.getElementById('loader');
  gsap.to(loader, {
    opacity: 0, duration: 0.6, delay: 2.3,
    onComplete: () => {
      loader.style.display = 'none';
      initAll(); // kick off everything after loader
    }
  });
});

/* ═══════════════════════════════════════════════════════
   1b. REAL DATA (remove placeholders)
   Uses saved CF handle from localStorage (set on other pages)
═══════════════════════════════════════════════════════ */
async function loadHomeRealData() {
  if (typeof API === 'undefined' || typeof HandleStore === 'undefined') return;
  const handle = HandleStore.get();
  if (!handle) return;

  try {
    const stats = await API.getAnalytics(handle);

    // Hero quick stats (Codeforces only)
    const heroRating = document.getElementById('hero-cf-rating');
    const heroSolved = document.getElementById('hero-cf-solved');
    if (heroRating) heroRating.textContent = String(stats.rating ?? '—');
    if (heroSolved) heroSolved.textContent = String(stats.solved ?? '—');

    // Dashboard cards (Codeforces only)
    const cfRating = document.getElementById('dash-cf-rating');
    const cfSolved = document.getElementById('dash-cf-solved');
    if (cfRating) {
      cfRating.dataset.target = String(stats.rating || 0);
      cfRating.textContent = '0';
    }
    if (cfSolved) {
      cfSolved.dataset.target = String(stats.solved || 0);
      cfSolved.textContent = '0';
    }
  } catch (e) {
    // Leave "—" if fetch fails
  }
}

/* ═══════════════════════════════════════════════════════
   2. CUSTOM CURSOR
═══════════════════════════════════════════════════════ */
function initCursor() {
  const dot  = document.getElementById('cursor-dot');
  const ring = document.getElementById('cursor-ring');
  let mx = -100, my = -100, rx = -100, ry = -100;

  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    gsap.to(dot, { x: mx, y: my, duration: 0.08, ease: 'power3.out' });
  });

  // ring follows with lag
  (function loopRing() {
    rx += (mx - rx) * 0.12;
    ry += (my - ry) * 0.12;
    gsap.set(ring, { x: rx, y: ry });
    requestAnimationFrame(loopRing);
  })();

  // grow ring on hover elements
  const hovers = document.querySelectorAll('a, button, .dash-card, .prob-card, .sug-chip, #ai-btn, .filter-btn');
  hovers.forEach(el => {
    el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
  });
}

/* ═══════════════════════════════════════════════════════
   3. ANIMATED GRID CANVAS (hero background)
═══════════════════════════════════════════════════════ */
function initGrid() {
  const canvas = document.getElementById('grid-canvas');
  const ctx    = canvas.getContext('2d');
  let W, H, t = 0;

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  function draw() {
    ctx.clearRect(0, 0, W, H);

    const COLS = 24, ROWS = 14;
    const cw = W / COLS, rh = H / ROWS;

    ctx.strokeStyle = 'rgba(0,212,255,0.18)';
    ctx.lineWidth = 0.5;

    // vertical lines with wave
    for (let c = 0; c <= COLS; c++) {
      const x = c * cw;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    // horizontal lines
    for (let r = 0; r <= ROWS; r++) {
      const y = r * rh;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // moving glowing dots at grid intersections
    const dotCount = 8;
    for (let i = 0; i < dotCount; i++) {
      const phase = (t * 0.4 + i * 137.5) % 360;
      const gx = ((Math.sin(phase * Math.PI / 180 * 0.7 + i) * 0.5 + 0.5)) * W;
      const gy = ((Math.cos(phase * Math.PI / 180 * 0.5 + i * 2) * 0.5 + 0.5)) * H;
      const r = 2 + Math.sin(t * 0.05 + i) * 1;
      const alpha = 0.4 + Math.sin(t * 0.03 + i) * 0.3;

      const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, r * 12);
      grad.addColorStop(0, `rgba(0,212,255,${alpha})`);
      grad.addColorStop(1, 'rgba(0,212,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(gx, gy, r * 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(0,212,255,${alpha + 0.2})`;
      ctx.beginPath();
      ctx.arc(gx, gy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    t++;
    requestAnimationFrame(draw);
  }
  draw();
}

/* ═══════════════════════════════════════════════════════
   4. TYPED TEXT HERO
═══════════════════════════════════════════════════════ */
function initTyped() {
  const el    = document.getElementById('typed-name');
  const words = ['Programmer', 'Coder', 'Champion', 'Problem Solver'];
  let wi = 0;

  function typeWord(word) {
    gsap.to(el, {
      duration: word.length * 0.08,
      text: { value: word, delimiter: '' },
      ease: 'none',
      onComplete: () => {
        gsap.delayedCall(2.2, () => {
          gsap.to(el, {
            duration: word.length * 0.04,
            text: { value: '', delimiter: '' },
            ease: 'none',
            onComplete: () => {
              wi = (wi + 1) % words.length;
              typeWord(words[wi]);
            }
          });
        });
      }
    });
  }

  gsap.delayedCall(0.8, () => typeWord(words[0]));
}

/* ═══════════════════════════════════════════════════════
   5. NAVBAR SCROLL EFFECT
═══════════════════════════════════════════════════════ */
function initNavbar() {
  const nav = document.getElementById('navbar');
  function onScroll() {
    const y = window.scrollY || 0;
    nav.classList.toggle('scrolled', y > 20);
    const t = Math.max(0, Math.min(1, y / 320));
    nav.style.setProperty('--navBlur', `${8 + 16 * t}px`);
    nav.style.setProperty('--navAlpha', `${0.35 + 0.55 * t}`);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ═══════════════════════════════════════════════════════
   6. HERO SECTION ANIMATIONS
═══════════════════════════════════════════════════════ */
function initHeroAnimations() {
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  tl.from('.hero-eyebrow',    { y: 20, opacity: 0, duration: 0.7 })
    .from('.hero-title',      { y: 40, opacity: 0, duration: 0.9 }, '-=0.3')
    .from('.hero-sub',        { y: 20, opacity: 0, duration: 0.7 }, '-=0.5')
    .from('.hero-cta-row .btn', { y: 20, opacity: 0, stagger: 0.15, duration: 0.6 }, '-=0.4')
    .from('.hero-stat',       { y: 20, opacity: 0, stagger: 0.12, duration: 0.6 }, '-=0.3')
    .from('.hero-stat-divider', { scaleY: 0, opacity: 0, stagger: 0.1, duration: 0.4 }, '-=0.5')
    .from('.hero-orb-wrap',   { scale: 0.8, opacity: 0, duration: 1.2, ease: 'elastic.out(1,0.8)' }, '-=1.2')
    .from('.scroll-cue',      { opacity: 0, duration: 0.8 }, '-=0.4');
}

/* ═══════════════════════════════════════════════════════
   7. SECTION REVEAL (ScrollTrigger)
═══════════════════════════════════════════════════════ */
function initScrollAnimations() {
  // Section headers
  gsap.utils.toArray('.section-header').forEach(el => {
    gsap.from(el.children, {
      y: 40, opacity: 0, stagger: 0.15, duration: 0.8, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 80%' }
    });
  });

  // Dashboard cards
  gsap.utils.toArray('.dash-card').forEach((card, i) => {
    gsap.from(card, {
      y: 50, opacity: 0, duration: 0.7, ease: 'power3.out',
      delay: i * 0.07,
      scrollTrigger: { trigger: card, start: 'top 88%' }
    });
  });

  // Counter cards
  gsap.utils.toArray('[data-target]').forEach(el => {
    const target = parseInt(el.dataset.target);
    const prefix = el.dataset.prefix || '';
    ScrollTrigger.create({
      trigger: el, start: 'top 85%', once: true,
      onEnter: () => {
        gsap.to({ val: 0 }, {
          val: target, duration: 1.6, ease: 'power2.out',
          onUpdate: function() {
            el.textContent = prefix + Math.round(this.targets()[0].val).toLocaleString();
          }
        });
      }
    });
  });

  // Rank bar
  ScrollTrigger.create({
    trigger: '.rank-bar', start: 'top 85%', once: true,
    onEnter: () => {
      document.querySelectorAll('.rank-bar').forEach(bar => {
        bar.style.width = bar.style.getPropertyValue('--pct') ||
          getComputedStyle(bar).getPropertyValue('--pct');
        bar.style.width = '94%';
      });
    }
  });

  // Progress bars (animate width on scroll)
  gsap.utils.toArray('.prog-fill').forEach(fill => {
    const pct = fill.style.getPropertyValue('--pct');
    fill.style.setProperty('--pct', pct);
    ScrollTrigger.create({
      trigger: fill, start: 'top 88%', once: true,
      onEnter: () => { fill.style.width = pct; }
    });
  });

  // SVG circular rings
  gsap.utils.toArray('.circ-ring').forEach(ring => {
    const target = parseInt(ring.dataset.target);
    ScrollTrigger.create({
      trigger: ring, start: 'top 85%', once: true,
      onEnter: () => {
        gsap.to(ring, {
          strokeDashoffset: 314 - target,
          duration: 1.5, ease: 'power2.out'
        });
      }
    });
  });

  // Problem cards stagger
  gsap.utils.toArray('.prob-card').forEach((card, i) => {
    gsap.from(card, {
      x: -30, opacity: 0, duration: 0.6, ease: 'power3.out',
      delay: i * 0.06,
      scrollTrigger: { trigger: card, start: 'top 90%' }
    });
  });

  // Parallax on hero orb
  gsap.to('.hero-orb-wrap', {
    y: -60, ease: 'none',
    scrollTrigger: {
      trigger: '#hero', start: 'top top', end: 'bottom top',
      scrub: 1
    }
  });

  // Parallax on grid canvas
  gsap.to('#grid-canvas', {
    y: 80, ease: 'none',
    scrollTrigger: {
      trigger: '#hero', start: 'top top', end: 'bottom top',
      scrub: 1.5
    }
  });

  // Filter buttons reveal
  gsap.from('.filter-btn', {
    y: 20, opacity: 0, stagger: 0.08, duration: 0.5, ease: 'power3.out',
    scrollTrigger: { trigger: '.tracker-filters', start: 'top 85%' }
  });

  // Progress circles scale in
  gsap.utils.toArray('.circ-card').forEach((card, i) => {
    gsap.from(card, {
      scale: 0.8, opacity: 0, duration: 0.7, ease: 'back.out(1.5)',
      delay: i * 0.15,
      scrollTrigger: { trigger: card, start: 'top 85%' }
    });
  });
}

/* ═══════════════════════════════════════════════════════
   8. PROBLEM FILTER
═══════════════════════════════════════════════════════ */
function initFilter() {
  const btns  = document.querySelectorAll('.filter-btn');
  const cards = document.querySelectorAll('.prob-card');

  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('filter-btn--active'));
      btn.classList.add('filter-btn--active');

      const f = btn.dataset.filter;

      cards.forEach(card => {
        const diff   = card.dataset.diff;
        const status = card.querySelector('.prob-status');
        const isTodo = status.classList.contains('prob-status--todo');
        let show = false;

        if (f === 'all')                          show = true;
        else if (f === 'todo' && isTodo)          show = true;
        else if (f === diff && !isTodo)           show = true;
        else if (f === 'easy' && diff === 'easy') show = true;
        else if (f === 'medium' && diff === 'medium') show = true;
        else if (f === 'hard'   && diff === 'hard')   show = true;

        gsap.to(card, {
          opacity: show ? 1 : 0.15,
          scale:   show ? 1 : 0.97,
          duration: 0.3
        });
      });
    });
  });
}

/* ═══════════════════════════════════════════════════════
   9. AI MODAL
═══════════════════════════════════════════════════════ */
function initModal() {
  const modal = document.getElementById('ai-modal');
  const btn   = document.getElementById('ai-btn');
  const close = document.getElementById('modal-close');

  btn.addEventListener('click', () => modal.classList.add('open'));
  close.addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });

  // chips auto-fill
  document.querySelectorAll('.sug-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const input = document.querySelector('.modal-input');
      input.value = chip.textContent;
      input.focus();
    });
  });
}

/* ═══════════════════════════════════════════════════════
   10. BOOT — run everything
═══════════════════════════════════════════════════════ */
function initAll() {
  initCursor();
  initGrid();
  initNavbar();
  initHeroAnimations();
  initTyped();
  initScrollAnimations();
  initFilter();
  initModal();
  loadHomeRealData();
}
