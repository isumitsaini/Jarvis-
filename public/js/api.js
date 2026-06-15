/* ─────────────────────────────────────────────────────
   public/js/api.js
   Shared API client — all fetch calls to the backend
   Used by: analytics.js, graphs.js, insights.js, assistant.js
───────────────────────────────────────────────────── */

const API = (() => {
  const BASE = ''; // same-origin; backend serves on /api/*

  /* Internal: fetch with error handling */
  async function _fetch(url, options = {}) {
    const res = await fetch(BASE + url, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    const text = await res.text();

let data;
try {
  data = JSON.parse(text);
} catch (e) {
  console.error('Non-JSON response:', text);

  throw new Error(
    text.startsWith('The page')
      ? 'Backend route not found or server is not running.'
      : 'Server returned invalid JSON.'
  );
}

if (!res.ok) {
  throw new Error(data.error || `HTTP ${res.status}`);
}

return data;
  }

  return {
    /* Fetch full Codeforces stats for a handle */
    getCFStats: (handle) => _fetch(`/api/codeforces/${handle}`),

    /* Fetch processed analytics data */
    getAnalytics: (handle) => _fetch(`/api/analytics?handle=${handle}`),

    /* Request AI insights (POST with stats payload) */
    getInsights: (handle, stats) => _fetch('/api/ai-insights', {
      method: 'POST',
      body: JSON.stringify({ handle, stats })
    }),

    /* Ask JARVIS assistant a question */
    askJarvis: (question, context) => _fetch('/api/ai-insights', {
      method: 'POST',
      body: JSON.stringify({
        handle: context?.handle || 'user',
        stats: {
          ...context,
          // Inject question as override for the prompt
          _question: question
        }
      })
    })
  };
})();

/* ── Shared UI helpers ─────────────────────────────── */

/** Show loading state in a container */
function showLoading(containerId, message = 'PROCESSING') {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `
    <div class="loading-overlay visible" style="display:flex">
      <div class="loading-spinner"></div>
      <p class="loading-text">${message}...</p>
    </div>`;
}

/** Show error in a container */
function showError(containerId, message) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `
    <div class="error-box visible" style="display:block">
      ⚠ ${message}
    </div>`;
}

/** Animate a number counter with GSAP */
function animateCounter(el, target, prefix = '', suffix = '') {
  if (!el || typeof gsap === 'undefined') return;
  gsap.to({ val: 0 }, {
    val: target,
    duration: 1.8,
    ease: 'power2.out',
    onUpdate: function () {
      el.textContent = prefix + Math.round(this.targets()[0].val).toLocaleString() + suffix;
    }
  });
}

/** Fade-in elements with GSAP stagger */
function fadeInStagger(selector, options = {}) {
  if (typeof gsap === 'undefined') return;
  gsap.from(selector, {
    y: 30, opacity: 0, duration: 0.7,
    stagger: options.stagger || 0.1,
    ease: 'power3.out',
    delay: options.delay || 0,
    ...options
  });
}

/** Get/set handle from localStorage */
const HandleStore = {
  get: () => localStorage.getItem('jarvis_handle') || '',
  set: (h) => localStorage.setItem('jarvis_handle', h),
  clear: () => localStorage.removeItem('jarvis_handle')
};

/** Format rank name nicely */
function formatRank(rank) {
  if (!rank) return 'Unrated';
  return rank.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
