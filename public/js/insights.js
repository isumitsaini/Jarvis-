/* ─────────────────────────────────────────────────────
   public/js/insights.js
   Drives AI Insights page: fetches CF stats → Gemini API
───────────────────────────────────────────────────── */
gsap.registerPlugin(ScrollTrigger);

let currentStats   = null;
let currentHandle  = null;
let currentInsights = null;

window.addEventListener('load', () => {
  const loader = document.getElementById('loader');
  gsap.to(loader, {
    opacity: 0, duration: 0.6, delay: 1.8,
    onComplete: () => { loader.style.display = 'none'; initPage(); }
  });
});

/* ── Init page ── */
function initPage() {
  initCursorBasic();
  initNavbar();
  animatePageHero();

  const fetchBtn  = document.getElementById('fetch-btn');
  const regenBtn  = document.getElementById('regen-btn');
  const copyBtn   = document.getElementById('copy-btn');
  const handleInp = document.getElementById('handle-input');
  const saved     = HandleStore.get();

  if (saved) handleInp.value = saved;

  fetchBtn.addEventListener('click', () => {
    const h = handleInp.value.trim();
    if (!h) return;
    HandleStore.set(h);
    currentHandle = h;
    loadInsights(h);
  });

  handleInp.addEventListener('keydown', e => { if (e.key === 'Enter') fetchBtn.click(); });

  regenBtn?.addEventListener('click', () => {
    if (currentHandle && currentStats) {
      // Clear cache cue by changing solved count slightly (backend uses it for cache key)
      generateInsights(currentHandle, currentStats, true);
    }
  });

  copyBtn?.addEventListener('click', () => {
    if (!currentInsights) return;
    const text = buildPlainText(currentInsights);
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.textContent = '✓ COPIED!';
      setTimeout(() => {
        copyBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="#a259ff" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>COPY TO CLIPBOARD`;
      }, 2000);
    });
  });

  if (saved) { currentHandle = saved; loadInsights(saved); }
}

/* ── Step 1: Fetch CF stats → then generate insights ── */
async function loadInsights(handle) {
  setUIState('loading');

  try {
    const stats = await API.getCFStats(handle);
    currentStats = stats;
    renderProfileStrip(stats);
    await generateInsights(handle, stats, false);
  } catch (err) {
    setUIState('error', err.message);
  }
}

/* ── Step 2: Call Gemini via backend ── */
async function generateInsights(handle, stats, force) {
  if (!force) setUIState('loading');

  // If forced regen, add timestamp noise to bust cache
  const payload = force ? { ...stats, _ts: Date.now() } : stats;

  try {
    const insights = await API.getInsights(handle, payload);
    currentInsights = insights;
    renderInsights(insights);
    setUIState('done');
  } catch (err) {
    setUIState('error', err.message);
  }
}

/* ── Render insights cards ── */
function renderInsights(ins) {
  fillList('list-strengths',   ins.strengths   || [], 'No strength data returned.');
  fillList('list-weaknesses',  ins.weaknesses  || [], 'No weakness data returned.');
  fillRoadmap('list-roadmap',  ins.roadmap     || []);
  fillList('list-suggestions', ins.suggestions || [], 'No suggestions returned.');
}

function fillList(id, items, fallback) {
  const ul = document.getElementById(id);
  if (!ul) return;
  if (!items.length) {
    ul.innerHTML = `<li style="color:var(--clr-muted)">${fallback}</li>`;
    return;
  }
  ul.innerHTML = items.map(item => `<li>${item}</li>`).join('');
}

function fillRoadmap(id, items) {
  const ol = document.getElementById(id);
  if (!ol) return;
  if (!items.length) {
    ol.innerHTML = `<li class="roadmap-item"><span style="color:var(--clr-muted)">No roadmap generated.</span></li>`;
    return;
  }
  ol.innerHTML = items.map((item, i) => `
    <li class="roadmap-item">
      <div class="roadmap-num">${i + 1}</div>
      <span class="roadmap-text">${item}</span>
    </li>`).join('');
}

/* ── Render profile strip ── */
function renderProfileStrip(data) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  set('ps-handle', data.handle);
  set('ps-rank',   formatRank(data.rank));

  const ratingEl = document.getElementById('ps-rating');
  const solvedEl = document.getElementById('ps-solved');
  if (ratingEl) animateCounter(ratingEl, data.rating || 0);
  if (solvedEl) animateCounter(solvedEl, data.solved  || 0);

  const strongEl = document.getElementById('ps-strong');
  const weakEl   = document.getElementById('ps-weak');
  if (strongEl) {
    strongEl.innerHTML = (data.strongTags || []).map(t =>
      `<span style="padding:3px 10px;background:rgba(0,255,179,0.08);border:1px solid rgba(0,255,179,0.2);border-radius:4px;font-size:11px;color:#00ffb3">${t}</span>`
    ).join('');
  }
  if (weakEl) {
    weakEl.innerHTML = (data.weakTags || []).map(t =>
      `<span style="padding:3px 10px;background:rgba(255,80,80,0.08);border:1px solid rgba(255,80,80,0.2);border-radius:4px;font-size:11px;color:#ff5050">${t}</span>`
    ).join('');
  }
}

/* ── UI state machine ── */
function setUIState(state, errorMsg) {
  const loading = document.getElementById('page-loading');
  const errEl   = document.getElementById('page-error');
  const grid    = document.getElementById('insights-grid');
  const regen   = document.getElementById('regen-row');
  const strip   = document.getElementById('profile-strip');

  loading.style.display = 'none';
  errEl.style.display   = 'none';
  grid.style.display    = 'none';
  regen.style.display   = 'none';
  strip.style.display   = 'none';

  if (state === 'loading') {
    loading.style.display = 'block';
  } else if (state === 'error') {
    errEl.style.display   = 'block';
    errEl.textContent     = `⚠ ${errorMsg}`;
  } else if (state === 'done') {
    grid.style.display   = 'grid';
    regen.style.display  = 'flex';
    strip.style.display  = 'block';

    // Animate insight cards
    gsap.from('.insight-card', { y: 40, opacity: 0, stagger: 0.15, duration: 0.8, ease: 'power3.out' });
    gsap.from('.roadmap-item', { x: -20, opacity: 0, stagger: 0.1, duration: 0.6, ease: 'power3.out', delay: 0.5 });
    gsap.from('.regen-btn',    { y: 20, opacity: 0, stagger: 0.1, duration: 0.5, ease: 'power3.out', delay: 0.8 });
  }
}

/* ── Build plain text for clipboard ── */
function buildPlainText(ins) {
  const sections = [
    ['STRENGTHS',             ins.strengths],
    ['WEAKNESSES',            ins.weaknesses],
    ['IMPROVEMENT ROADMAP',   ins.roadmap],
    ['PRACTICE SUGGESTIONS',  ins.suggestions]
  ];
  return sections.map(([title, items]) =>
    `## ${title}\n${(items || []).map((item, i) => `${i + 1}. ${item}`).join('\n')}`
  ).join('\n\n');
}

/* ── Shared helpers ── */
function initCursorBasic() {
  const dot = document.getElementById('cursor-dot');
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
  gsap.from('.handle-search',{ y: 20, opacity: 0, duration: 0.6, delay: 0.6 });
}
