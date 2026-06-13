/* ─────────────────────────────────────────────────────
   server/utils/cfProcessor.js
   Processes raw Codeforces API data into structured stats
───────────────────────────────────────────────────── */

/**
 * Process raw CF submissions into analytics-ready format
 */
function processSubmissions(submissions) {
  const solvedSet   = new Set();
  const tagMap      = {};   // tag → { solved, wrong } where wrong = error submissions count
  const ratingMap   = {};   // bucket → count of AC problems
  const wrongMap    = {};   // problemId → total non-OK submissions (used for per-problem tracking)
  const monthMap    = {};   // YYYY-MM → solved count

  submissions.forEach(sub => {
    const pid = `${sub.problem.contestId}-${sub.problem.index}`;
    const tags = sub.problem.tags || [];
    const rating = sub.problem.rating;
    const verdict = sub.verdict;
    const date = new Date(sub.creationTimeSeconds * 1000);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    // Count error submissions per tag (even if problem never gets solved)
    if (verdict !== 'OK') {
      tags.forEach(tag => {
        if (!tagMap[tag]) tagMap[tag] = { solved: 0, wrong: 0 };
        tagMap[tag].wrong++;
      });
      wrongMap[pid] = (wrongMap[pid] || 0) + 1;
    }

    if (verdict === 'OK') {
      if (!solvedSet.has(pid)) {
        solvedSet.add(pid);

        // Month trend
        monthMap[month] = (monthMap[month] || 0) + 1;

        // Rating distribution
        if (rating) {
          const bucket = getDifficultyBucket(rating);
          ratingMap[bucket] = (ratingMap[bucket] || 0) + 1;
        }

        // Tag stats — AC
        tags.forEach(tag => {
          if (!tagMap[tag]) tagMap[tag] = { solved: 0, wrong: 0 };
          tagMap[tag].solved++;
        });
      }
    }
  });

  return { solvedSet, tagMap, ratingMap, monthMap, wrongMap };
}

/**
 * Bucket a CF problem rating into rating ranges (e.g. 800–999, 1000–1199)
 */
function getDifficultyBucket(rating) {
  const bucketSize = 200;
  const r = Number(rating);
  if (!Number.isFinite(r)) return 'Unrated';
  if (r < 800) return '<800';
  const low = Math.floor(r / bucketSize) * bucketSize;
  const high = low + bucketSize - 1;
  return `${low}–${high}`;
}

/**
 * Derive strong/weak/error-heavy tags from tagMap
 */
function classifyTags(tagMap) {
  const tags = Object.entries(tagMap)
    .filter(([, v]) => v.solved + v.wrong > 0)
    .map(([tag, v]) => {
      const total     = v.solved + v.wrong;
      const successRate = total > 0 ? (v.solved / total) * 100 : 0;
      const errorRate   = total > 0 ? (v.wrong / total) * 100 : 0;
      return { tag, solved: v.solved, wrong: v.wrong, total, successRate, errorRate };
    })
    .sort((a, b) => b.solved - a.solved);

  const strongTags = tags.filter(t => t.successRate >= 70 && t.solved >= 3)
                         .slice(0, 5).map(t => t.tag);
  const weakTags   = tags.filter(t => t.successRate < 50 && t.solved >= 1)
                         .slice(0, 5).map(t => t.tag);
  const errorTags  = tags.sort((a, b) => b.errorRate - a.errorRate)
                         .slice(0, 5).map(t => t.tag);

  return { strongTags, weakTags, errorTags, tagDetails: tags };
}

/**
 * Build sorted monthly trend (last 12 months)
 */
function buildMonthTrend(monthMap) {
  const entries = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12);
  return entries.map(([month, count]) => ({ month, count }));
}

/**
 * Full pipeline: raw API response → structured stats
 */
function buildStats(userInfo, submissions) {
  const info = userInfo[0];
  const { solvedSet, tagMap, ratingMap, monthMap } = processSubmissions(submissions);
  const { strongTags, weakTags, errorTags, tagDetails } = classifyTags(tagMap);
  const monthTrend = buildMonthTrend(monthMap);

  const maxRating = info.maxRating || info.rating || 0;

  return {
    handle:    info.handle,
    rating:    info.rating    || 0,
    maxRating,
    rank:      info.rank      || 'unrated',
    maxRank:   info.maxRank   || 'unrated',
    avatar:    info.titlePhoto || '',
    solved:    solvedSet.size,
    strongTags,
    weakTags,
    errorTags,
    tagDetails: tagDetails.slice(0, 20),
    ratingRangeDistribution: ratingMap,
    monthTrend,
    totalSubmissions: submissions.length,
    lastFetched: new Date().toISOString()
  };
}

module.exports = { buildStats, getDifficultyBucket };
