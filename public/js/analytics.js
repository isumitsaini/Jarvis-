/* ─────────────────────────────────────────────────────
   public/js/analytics.js
   Drives the Analytics page: fetches CF data, renders stats
───────────────────────────────────────────────────── */
gsap.registerPlugin(ScrollTrigger);

/* ── Init after loader ─────────────────────────────── */
window.addEventListener('load', () => {
  const loader = document.getElementById('loader');
  gsap.to(loader, {
    opacity: 0, duration: 0.6, delay: 1.8,
    onComplete: () => {
      loader.style.display = 'none';
      initPage();
    }
  });
});

function initPage() {
  initCursorBasic();
  initNavbar();
  animatePageHero();

  const fetchBtn   = document.getElementById('fetch-btn');
  const handleInp  = document.getElementById('handle-input');

  // Restore last handle
  const saved = HandleStore.get();
  if (saved) handleInp.value = saved;

  fetchBtn.addEventListener('click', () => {
    const h = handleInp.value.trim();
    if (!h) return;
    HandleStore.set(h);
    loadAnalytics(h);
  });

  handleInp.addEventListener('keydown', e => {
    if (e.key === 'Enter') fetchBtn.click();
  });

  // Auto-load if saved handle
  if (saved) loadAnalytics(saved);
}

/* ── Load analytics data ───────────────────────────── */
async function loadAnalytics(handle) {
  const grid     = document.getElementById('analytics-grid');
  const statGrid = document.getElementById('stat-grid');
  const loading  = document.getElementById('page-loading');
  const errEl    = document.getElementById('page-error');

  grid.style.display     = 'none';
  statGrid.style.display = 'none';
  errEl.style.display    = 'none';
  loading.style.display  = 'block';

  document.getElementById('fetch-btn').disabled = true;

  try {
    const data = await API.getAnalytics(handle);
    renderStats(data);
    renderTagBars(data.tagDetails || []);
    renderVerdicts(data.submissionBreakdown || {});
    renderTrend(data.monthTrend || []);
    renderContestRanks(data.contestRanks || []);
    renderDiffBars(data.ratingRangeDistribution || {});
    renderStreak(data.currentStreak || 0);

    loading.style.display = 'none';
    statGrid.style.display = 'grid';
    grid.style.display = 'grid';

    // Animate tiles in
    gsap.from('.stat-tile', { y: 30, opacity: 0, stagger: 0.08, duration: 0.6, ease: 'power3.out' });
    gsap.from('.analytics-card', { y: 40, opacity: 0, stagger: 0.12, duration: 0.7, ease: 'power3.out', delay: 0.3 });

    // Animate tag bars after a short delay
    setTimeout(() => {
      document.querySelectorAll('.tag-bar-fill').forEach(f => {
        f.style.width = f.dataset.pct + '%';
      });
      document.querySelectorAll('.verdict-bar-fill').forEach(f => {
        f.style.width = f.dataset.pct + '%';
      });
      document.querySelectorAll('.diff-bar-fill').forEach(f => {
        f.style.width = f.dataset.pct + '%';
      });
    }, 600);

  } catch (err) {
    loading.style.display = 'none';
    errEl.style.display   = 'block';
    errEl.textContent     = `⚠ ${err.message}`;
  }

  document.getElementById('fetch-btn').disabled = false;
}

/* ── Render top stats ──────────────────────────────── */
function renderStats(data) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  set('st-rating',   data.rating   || '—');
  set('st-rank',     formatRank(data.rank));
  set('st-solved',   data.solved   || '—');
  set('st-max',      data.maxRating || '—');
  set('st-max-rank', formatRank(data.maxRank));
  set('st-subs',     data.totalSubmissions || '—');
  set('st-handle',   data.handle);

  // Animated counters
  ['st-rating', 'st-solved', 'st-max', 'st-subs'].forEach(id => {
    const el = document.getElementById(id);
    const val = parseInt(el?.textContent);
    if (el && !isNaN(val)) animateCounter(el, val);
  });
}

/* ── Render tag bars ───────────────────────────────── */
function renderTagBars(tags) {
  const wrap = document.getElementById('tag-bars');
  if (!wrap) return;
  const top = tags.slice(0, 8);
  const max = top[0]?.solved || 1;
  wrap.innerHTML = top.map(t => {
    const pct = Math.round((t.solved / max) * 100);
    return `
      <div class="tag-bar-item">
        <div class="tag-bar-header">
          <span class="tag-bar-name">${t.tag}</span>
          <span class="tag-bar-count">${t.solved} solved</span>
        </div>
        <div class="tag-bar-track">
          <div class="tag-bar-fill" data-pct="${pct}" style="width:0%"></div>
        </div>
      </div>`;
  }).join('');
}

/* ── Render verdict breakdown ──────────────────────── */
function renderVerdicts(breakdown) {
  const wrap = document.getElementById('verdict-list');
  if (!wrap) return;

  const colors = {
    OK:                   '#00ffb3',
    WRONG_ANSWER:         '#ff5050',
    TIME_LIMIT_EXCEEDED:  '#f5a623',
    COMPILATION_ERROR:    '#a259ff',
    OTHER:                '#4a6a8a'
  };
  const labels = {
    OK:                   'Accepted',
    WRONG_ANSWER:         'Wrong Answer',
    TIME_LIMIT_EXCEEDED:  'Time Limit Exceeded',
    COMPILATION_ERROR:    'Compilation Error',
    OTHER:                'Other'
  };

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0) || 1;

  wrap.innerHTML = Object.entries(breakdown).map(([verdict, count]) => {
    const pct = Math.round((count / total) * 100);
    return `
      <div class="verdict-row">
        <div class="verdict-dot" style="background:${colors[verdict] || '#4a6a8a'}"></div>
        <span class="verdict-name">${labels[verdict] || verdict}</span>
        <div class="verdict-bar-wrap">
          <div class="verdict-bar-fill" data-pct="${pct}"
               style="background:${colors[verdict] || '#4a6a8a'};width:0%"></div>
        </div>
        <span class="verdict-count">${count}</span>
      </div>`;
  }).join('');
}

/* ── Render monthly trend ──────────────────────────── */
function renderTrend(trend) {
  const tbody = document.querySelector('#trend-table tbody');
  if (!tbody) return;

  const sorted = [...trend].slice(-12).reverse();
  tbody.innerHTML = sorted.map(m => {
    const date = new Date(m.month + '-01');
    const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const bar = '█'.repeat(Math.min(m.count, 20));
    return `
      <tr>
        <td>${label}</td>
        <td>${bar}</td>
        <td>${m.count}</td>
      </tr>`;
  }).join('');
}

/* ── Render contest ranks ───────────────────────────── */
function renderContestRanks(items) {
  const tbody = document.querySelector('#contest-table tbody');
  if (!tbody) return;

  const rows = (items || []).slice(0, 25);
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="color:var(--clr-muted);padding:12px 8px">No contest rank data found.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const delta = Number(r.delta || 0);
    const dCol = delta >= 0 ? 'var(--clr-green)' : '#ff5050';
    const contestLabel = `${r.contestName || 'Contest'} · ${r.contestId || ''}`.trim();
    return `
      <tr>
        <td>${r.date || '—'}</td>
        <td>${contestLabel}</td>
        <td>#${r.rank ?? '—'}</td>
        <td style="color:${dCol};font-family:var(--font-display)">${delta >= 0 ? '+' : ''}${delta}</td>
      </tr>`;
  }).join('');
}

/* ── Render difficulty bars ────────────────────────── */
function renderDiffBars(distrib) {
  const wrap = document.getElementById('diff-bars');
  if (!wrap) return;

  const palette = ['#00d4ff', '#a259ff', '#00ffb3', '#f5a623', '#ff5050'];
  const total  = Object.values(distrib).reduce((a, b) => a + b, 0) || 1;

  wrap.innerHTML = Object.entries(distrib).map(([level, count], i) => {
    const pct = Math.round((count / total) * 100);
    const color = palette[i % palette.length];
    return `
      <div class="tag-bar-item">
        <div class="tag-bar-header">
          <span class="tag-bar-name" style="color:${color}">${level}</span>
          <span class="tag-bar-count">${count} (${pct}%)</span>
        </div>
        <div class="tag-bar-track">
          <div class="diff-bar-fill" data-pct="${pct}"
               style="height:100%;width:0%;background:${color};border-radius:4px;box-shadow:0 0 8px ${color};transition:width 1.4s cubic-bezier(0.4,0,0.2,1)"></div>
        </div>
      </div>`;
  }).join('');
}

/* ── Render streak ─────────────────────────────────── */
function renderStreak(streak) {
  const el = document.getElementById('streak-num');
  if (!el) return;
  animateCounter(el, streak);
}

/* ── Shared: basic cursor ──────────────────────────── */
function initCursorBasic() {
  const dot  = document.getElementById('cursor-dot');
  const ring = document.getElementById('cursor-ring');
  let mx = -100, my = -100, rx = -100, ry = -100;
  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    gsap.to(dot, { x: mx, y: my, duration: 0.08, ease: 'power3.out' });
  });
  (function loop() {
    rx += (mx - rx) * 0.12; ry += (my - ry) * 0.12;
    gsap.set(ring, { x: rx, y: ry });
    requestAnimationFrame(loop);
  })();
}

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

function animatePageHero() {
  gsap.from('.page-eyebrow', { y: 20, opacity: 0, duration: 0.7 });
  gsap.from('.page-title',   { y: 30, opacity: 0, duration: 0.8, delay: 0.2 });
  gsap.from('.page-sub',     { y: 20, opacity: 0, duration: 0.6, delay: 0.4 });
  gsap.from('.handle-search', { y: 20, opacity: 0, duration: 0.6, delay: 0.6 });
}
