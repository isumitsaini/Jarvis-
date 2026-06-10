/* ─────────────────────────────────────────────────────
   server/routes/codeforces.js
   GET /api/codeforces/:handle
   Fetches user info + submissions, processes into stats
───────────────────────────────────────────────────── */
const express  = require('express');
const axios    = require('axios');
const NodeCache = require('node-cache');
const { buildStats } = require('../utils/cfProcessor');

const router = express.Router();
const cache  = new NodeCache({ stdTTL: 300 }); // 5-min cache

const CF_BASE = 'https://codeforces.com/api';

/* ── GET /api/codeforces/:handle ── */
router.get('/:handle', async (req, res) => {
  const { handle } = req.params;

  if (!handle || !/^[a-zA-Z0-9_.-]{3,24}$/.test(handle)) {
    return res.status(400).json({ error: 'Invalid Codeforces handle' });
  }

  // Return cached data if available
  const cached = cache.get(handle.toLowerCase());
  if (cached) {
    console.log(`[CF] Cache hit: ${handle}`);
    return res.json({ ...cached, cached: true });
  }

  try {
    console.log(`[CF] Fetching data for: ${handle}`);

    // Parallel fetch: user info + submissions
    const [infoRes, subsRes] = await Promise.all([
      axios.get(`${CF_BASE}/user.info?handles=${handle}`, { timeout: 8000 }),
      axios.get(`${CF_BASE}/user.status?handle=${handle}&from=1&count=2000`, { timeout: 15000 })
    ]);

    if (infoRes.data.status !== 'OK') {
      return res.status(404).json({ error: 'User not found on Codeforces' });
    }

    const stats = buildStats(infoRes.data.result, subsRes.data.result);

    // Cache the result
    cache.set(handle.toLowerCase(), stats);

    console.log(`[CF] Success: ${handle} — ${stats.solved} solved`);
    res.json(stats);

  } catch (err) {
    if (err.response?.status === 400) {
      return res.status(404).json({ error: 'Codeforces user not found' });
    }
    if (err.code === 'ECONNABORTED') {
      return res.status(504).json({ error: 'Codeforces API timeout. Try again.' });
    }
    console.error('[CF] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch Codeforces data', detail: err.message });
  }
});

/* ── DELETE /api/codeforces/:handle/cache ── (bust cache) */
router.delete('/:handle/cache', (req, res) => {
  const { handle } = req.params;
  cache.del(handle.toLowerCase());
  res.json({ message: `Cache cleared for ${handle}` });
});

module.exports = router;
