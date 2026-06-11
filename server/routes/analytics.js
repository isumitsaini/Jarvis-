/* ─────────────────────────────────────────────────────
   server/routes/analytics.js
   GET /api/analytics?handle=:handle
   Returns processed analytics data derived from CF stats
───────────────────────────────────────────────────── */
const express   = require('express');
const axios     = require('axios');
const NodeCache = require('node-cache');
const { buildStats } = require('../utils/cfProcessor');

const router = express.Router();
const cache  = new NodeCache({ stdTTL: 300 });
const CF_BASE = 'https://codeforces.com/api';

/* ── GET /api/analytics?handle=xyz ── */
router.get('/', async (req, res) => {
  const { handle } = req.query;

  if (!handle) {
    return res.status(400).json({ error: 'handle query parameter required' });
  }

  const cacheKey = `analytics_${handle.toLowerCase()}`;
  const cached   = cache.get(cacheKey);
  if (cached) return res.json({ ...cached, cached: true });

  try {
    const [infoRes, subsRes, ratingRes] = await Promise.all([
      axios.get(`${CF_BASE}/user.info?handles=${handle}`, { timeout: 8000 }),
      axios.get(`${CF_BASE}/user.status?handle=${handle}&from=1&count=2000`, { timeout: 15000 }),
      axios.get(`${CF_BASE}/user.rating?handle=${handle}`, { timeout: 12000 }).catch(() => ({ data: { status: 'FAILED', result: [] } }))
    ]);

    if (infoRes.data.status !== 'OK') {
      return res.status(404).json({ error: 'User not found' });
    }

    const stats = buildStats(infoRes.data.result, subsRes.data.result);
    const contestRanks = buildContestRanks(ratingRes.data?.status === 'OK' ? ratingRes.data.result : []);

    // Build enhanced analytics object
    const analytics = {
      ...stats,

      // Submission success/fail breakdown
      submissionBreakdown: buildSubmissionBreakdown(subsRes.data.result),

      // Top-10 tags by solved count for chart
      topTags: stats.tagDetails.slice(0, 10),

      // Difficulty percentages
      // Percentages over rating-range buckets
      difficultyPercent: buildDifficultyPercent(stats.ratingRangeDistribution),

      // Weekly activity heatmap (last 52 weeks)
      activityHeatmap: buildActivityHeatmap(subsRes.data.result),

      // Streak
      currentStreak: buildStreak(subsRes.data.result),

      // Contest-wise rank details
      contestRanks
    };

    cache.set(cacheKey, analytics);
    res.json(analytics);

  } catch (err) {
    console.error('[ANALYTICS]', err.message);
    res.status(500).json({ error: 'Analytics fetch failed', detail: err.message });
  }
});

/* ── Helpers ── */
function buildSubmissionBreakdown(subs) {
  const counts = { OK: 0, WRONG_ANSWER: 0, TIME_LIMIT_EXCEEDED: 0, COMPILATION_ERROR: 0, OTHER: 0 };
  subs.forEach(s => {
    if (s.verdict in counts) counts[s.verdict]++;
    else counts.OTHER++;
  });
  return counts;
}

function buildDifficultyPercent(distrib) {
  const safe = distrib || {};
  const total = Object.values(safe).reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(
    Object.entries(safe).map(([k, v]) => [k, Math.round((v / total) * 100)])
  );
}

function buildActivityHeatmap(subs) {
  const map = {};
  const cutoff = Date.now() - 52 * 7 * 24 * 3600 * 1000;
  subs.forEach(s => {
    if (s.verdict === 'OK' && s.creationTimeSeconds * 1000 > cutoff) {
      const d = new Date(s.creationTimeSeconds * 1000);
      const key = d.toISOString().split('T')[0];
      map[key] = (map[key] || 0) + 1;
    }
  });
  return map;
}

function buildStreak(subs) {
  const days = new Set();
  subs.filter(s => s.verdict === 'OK').forEach(s => {
    const d = new Date(s.creationTimeSeconds * 1000).toISOString().split('T')[0];
    days.add(d);
  });
  const sorted = Array.from(days).sort().reverse();
  let streak = 0;
  const today = new Date().toISOString().split('T')[0];
  for (let i = 0; i < sorted.length; i++) {
    const expected = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
    if (sorted[i] === expected) streak++;
    else break;
  }
  return streak;
}

function buildContestRanks(ratings) {
  // ratings from CF: { contestId, contestName, handle, rank, ratingUpdateTimeSeconds, oldRating, newRating }
  const items = Array.isArray(ratings) ? ratings : [];
  return items
    .slice()
    .sort((a, b) => (b.ratingUpdateTimeSeconds || 0) - (a.ratingUpdateTimeSeconds || 0))
    .slice(0, 25)
    .map(r => ({
      contestId: r.contestId,
      contestName: r.contestName,
      rank: r.rank,
      date: new Date((r.ratingUpdateTimeSeconds || 0) * 1000).toISOString().slice(0, 10),
      oldRating: r.oldRating,
      newRating: r.newRating,
      delta: (r.newRating ?? 0) - (r.oldRating ?? 0)
    }));
}

module.exports = router;
