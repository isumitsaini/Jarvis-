/* ─────────────────────────────────────────────────────
   public/js/graphs.js
   Renders all Chart.js graphs with GSAP entry animations
───────────────────────────────────────────────────── */
gsap.registerPlugin(ScrollTrigger);

/* ── Chart.js global defaults — JARVIS theme ── */
Chart.defaults.color          = '#4a6a8a';
Chart.defaults.borderColor    = 'rgba(0,212,255,0.08)';
Chart.defaults.font.family    = 'Rajdhani, sans-serif';
Chart.defaults.font.size      = 12;

const BLUE    = '#00d4ff';
const PURPLE  = '#a259ff';
const GREEN   = '#00ffb3';
const ORANGE  = '#f5a623';
const RED     = '#ff5050';

/* Active chart instances (for cleanup on re-render) */
let charts = {};

/* ── Init ── */
window.addEventListener('load', () => {
  const loader = document.getElementById('loader');
  gsap.to(loader, {
    opacity: 0, duration: 0.6, delay: 1.8,
    onComplete: () => { loader.style.display = 'none'; initPage(); }
  });
});

function initPage() {
  initCursorBasic();
  initNavbar();
  animatePageHero();

  const btn = document.getElementById('fetch-btn');
  const inp = document.getElementById('handle-input');
  const saved = HandleStore.get();
  if (saved) inp.value = saved;

  btn.addEventListener('click', () => {
    const h = inp.value.trim();
    if (!h) return;
    HandleStore.set(h);
    loadGraphs(h);
  });

  inp.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click(); });
  if (saved) loadGraphs(saved);
}

/* ── Load & render ── */
async function loadGraphs(handle) {
  const grid    = document.getElementById('graphs-grid');
  const loading = document.getElementById('page-loading');
  const errEl   = document.getElementById('page-error');

  grid.style.display    = 'none';
  errEl.style.display   = 'none';
  loading.style.display = 'block';
  document.getElementById('fetch-btn').disabled = true;

  // Destroy old chart instances
  Object.values(charts).forEach(c => c?.destroy());
  charts = {};

  try {
    const data = await API.getAnalytics(handle);

    loading.style.display = 'none';
    grid.style.display    = 'grid';

    // Animate cards in
    gsap.from('.graph-card', { y: 50, opacity: 0, stagger: 0.15, duration: 0.8, ease: 'power3.out' });

    // Build charts after animation starts
    setTimeout(() => {
      buildTagChart(data.tagDetails || []);
      buildDiffChart(data.ratingRangeDistribution || {}, data.solved || 0);
      buildTrendChart(data.monthTrend || []);
      buildRadarChart(data.tagDetails || []);
    }, 400);

  } catch (err) {
    loading.style.display = 'none';
    errEl.style.display   = 'block';
    errEl.textContent     = `⚠ ${err.message}`;
  }

  document.getElementById('fetch-btn').disabled = false;
}

/* ── Chart 1: Tag Performance (Horizontal Bar) ── */
function buildTagChart(tags) {
  const top = tags.slice(0, 12);
  const ctx = document.getElementById('chart-tags').getContext('2d');

  charts.tags = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top.map(t => t.tag),
      datasets: [
        {
          label: 'Solved',
          data: top.map(t => t.solved),
          backgroundColor: `rgba(0,212,255,0.25)`,
          borderColor: BLUE,
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: 'Wrong Attempts',
          data: top.map(t => t.wrong),
          backgroundColor: `rgba(255,80,80,0.2)`,
          borderColor: RED,
          borderWidth: 1,
          borderRadius: 4
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 1200, easing: 'easeOutQuart' },
      plugins: {
        legend: {
          labels: { color: '#c8d8e8', padding: 20 }
        },
        tooltip: {
          backgroundColor: 'rgba(7,20,40,0.95)',
          borderColor: 'rgba(0,212,255,0.3)',
          borderWidth: 1,
          titleColor: BLUE,
          bodyColor: '#c8d8e8',
          callbacks: {
            afterBody: (items) => {
              const tag = top[items[0].dataIndex];
              return [
                `Success Rate: ${tag.successRate.toFixed(1)}%`,
                `Error Rate: ${tag.errorRate.toFixed(1)}%`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(0,212,255,0.06)' },
          ticks: { color: '#4a6a8a' }
        },
        y: {
          grid: { color: 'rgba(0,212,255,0.04)' },
          ticks: { color: '#c8d8e8', font: { size: 12 } }
        }
      }
    }
  });
}

/* ── Chart 2: Difficulty Donut ── */
function buildDiffChart(distrib, total) {
  const labels = Object.keys(distrib);
  const values = Object.values(distrib);
  const ctx    = document.getElementById('chart-diff').getContext('2d');

  document.getElementById('donut-total').textContent = total;

  // Modern palette (cycled)
  const palette = [BLUE, PURPLE, GREEN, ORANGE, RED];
  const borderColors = labels.map((_, i) => palette[i % palette.length]);
  const bgColors = borderColors.map(c => c + '33');

  charts.diff = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: bgColors,
        borderColor:     borderColors,
        borderWidth: 2,
        hoverBorderWidth: 3,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '68%',
      animation: { animateRotate: true, duration: 1400, easing: 'easeOutQuart' },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#c8d8e8',
            padding: 20,
            font: { size: 12 },
            generateLabels: (chart) => {
              const data = chart.data;
              return data.labels.map((label, i) => ({
                text: `${label}: ${data.datasets[0].data[i]}`,
                fillStyle: data.datasets[0].borderColor[i],
                strokeStyle: data.datasets[0].borderColor[i],
                lineWidth: 0
              }));
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(7,20,40,0.95)',
          borderColor: 'rgba(0,212,255,0.3)',
          borderWidth: 1,
          titleColor: BLUE,
          bodyColor: '#c8d8e8'
        }
      }
    }
  });
}

/* ── Chart 3: Monthly Trend Line ── */
function buildTrendChart(trend) {
  const ctx  = document.getElementById('chart-trend').getContext('2d');
  const last = trend.slice(-12);

  const gradient = ctx.createLinearGradient(0, 0, 0, 260);
  gradient.addColorStop(0, 'rgba(0,212,255,0.3)');
  gradient.addColorStop(1, 'rgba(0,212,255,0)');

  charts.trend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: last.map(m => {
        const d = new Date(m.month + '-01');
        return d.toLocaleDateString('en-US', { month: 'short' });
      }),
      datasets: [{
        label: 'Problems Solved',
        data: last.map(m => m.count),
        borderColor: BLUE,
        backgroundColor: gradient,
        borderWidth: 2,
        pointBackgroundColor: BLUE,
        pointBorderColor: '#03050d',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 8,
        fill: true,
        tension: 0.35
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 1400, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(7,20,40,0.95)',
          borderColor: 'rgba(0,212,255,0.3)',
          borderWidth: 1,
          titleColor: BLUE,
          bodyColor: '#c8d8e8'
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(0,212,255,0.06)' },
          ticks: { color: '#4a6a8a' }
        },
        y: {
          grid: { color: 'rgba(0,212,255,0.06)' },
          ticks: { color: '#4a6a8a', stepSize: 1 },
          beginAtZero: true
        }
      }
    }
  });
}

/* ── Chart 4: Success Rate Radar ── */
function buildRadarChart(tags) {
  const top = tags.slice(0, 8);
  const ctx = document.getElementById('chart-radar').getContext('2d');

  charts.radar = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: top.map(t => t.tag),
      datasets: [
        {
          label: 'Success Rate %',
          data: top.map(t => Math.round(t.successRate)),
          backgroundColor: 'rgba(0,212,255,0.1)',
          borderColor: BLUE,
          borderWidth: 2,
          pointBackgroundColor: BLUE,
          pointRadius: 4
        },
        {
          label: 'Error Rate %',
          data: top.map(t => Math.round(t.errorRate)),
          backgroundColor: 'rgba(255,80,80,0.08)',
          borderColor: RED,
          borderWidth: 2,
          pointBackgroundColor: RED,
          pointRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 1400, easing: 'easeOutQuart' },
      plugins: {
        legend: {
          labels: { color: '#c8d8e8', padding: 20 }
        },
        tooltip: {
          backgroundColor: 'rgba(7,20,40,0.95)',
          borderColor: 'rgba(0,212,255,0.3)',
          borderWidth: 1,
          titleColor: BLUE,
          bodyColor: '#c8d8e8'
        }
      },
      scales: {
        r: {
          grid:       { color: 'rgba(0,212,255,0.1)' },
          angleLines: { color: 'rgba(0,212,255,0.1)' },
          pointLabels:{ color: '#c8d8e8', font: { size: 11 } },
          ticks: {
            display: true,
            color: '#4a6a8a',
            backdropColor: 'transparent',
            stepSize: 25
          },
          min: 0, max: 100
        }
      }
    }
  });
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
