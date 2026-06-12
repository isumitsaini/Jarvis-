/* ─────────────────────────────────────────────────────
   server/routes/ai.js
   POST /api/ai-insights
   Calls Gemini API with CF stats → returns structured insights
   API key is read from process.env — never exposed to client
───────────────────────────────────────────────────── */
const express   = require('express');
const axios     = require('axios');
const NodeCache = require('node-cache');

const router = express.Router();
const cache  = new NodeCache({ stdTTL: 600 }); // 10-min cache per handle

// Default to a currently supported text model; allow override via env.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/* ── POST /api/ai-insights ── */
router.post('/', async (req, res) => {
  const { handle, stats } = req.body;

  if (!stats || !handle) {
    return res.status(400).json({ error: 'handle and stats are required' });
  }

  // Include question in cache key to avoid returning unrelated cached insights.
  const qKey = String(stats._question || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  const cacheKey = `ai_${handle.toLowerCase()}_${stats.solved}_${qKey}`;
  const cached   = cache.get(cacheKey);
  if (cached) {
    console.log(`[AI] Cache hit for ${handle}`);
    return res.json({ ...cached, cached: true });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'AI service not configured' });
  }

  // Build the Gemini prompt
  const prompt = buildPrompt(stats);

  try {
    console.log(`[AI] Generating insights for ${handle}`);

    const geminiRes = await axios.post(
      `${GEMINI_URL}?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
          topP: 0.85
        }
      },
      { timeout: 20000 }
    );

    const raw = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!raw) {
      return res.status(500).json({ error: 'Empty response from AI' });
    }

    // Parse structured sections from response
    const insights = parseInsights(raw);

    cache.set(cacheKey, insights);
    console.log(`[AI] Insights generated for ${handle}`);
    res.json(insights);

  } catch (err) {
    if (err.response?.status === 429) {
      return res.status(429).json({ error: 'AI rate limit reached. Try again shortly.' });
    }
    console.error('[AI] Gemini error:', err.response?.data || err.message);
    res.status(500).json({ error: 'AI insights generation failed', detail: err.message });
  }
});

/* ── Build structured Gemini prompt ── */
function buildPrompt(stats) {
  const question = String(stats._question || '').trim();
  return `You are a competitive programming coach AI. Analyze this programmer's data and provide specific, actionable insights.

PROGRAMMER DATA:
- Handle: ${stats.handle}
- Current Rating: ${stats.rating} (${stats.rank})
- Max Rating: ${stats.maxRating} (${stats.maxRank})
- Total Problems Solved: ${stats.solved}
- Strong Topics (high success rate): ${(stats.strongTags || []).join(', ') || 'N/A'}
- Weak Topics (low success rate): ${(stats.weakTags || []).join(', ') || 'N/A'}
- Error-Heavy Topics: ${(stats.errorTags || []).join(', ') || 'N/A'}
- Rating Range Distribution: ${Object.entries(stats.ratingRangeDistribution || {}).map(([k, v]) => `${k}=${v}`).slice(0, 12).join(', ') || 'N/A'}
- Monthly Trend (last months): ${(stats.monthTrend || []).slice(-3).map(m => `${m.month}: ${m.count}`).join(', ')}
${question ? `\nUSER QUESTION:\n${question}\n` : ''}

Respond in EXACTLY this format with these 4 section headers:

## STRENGTHS
(3 specific bullet points about what they do well)

## WEAKNESSES
(3 specific bullet points about areas needing improvement)

## IMPROVEMENT ROADMAP
(4 numbered steps, ordered by priority)

## PRACTICE SUGGESTIONS
(5 specific topics or problem types to practice this week, with brief reason)

Keep responses concise, technical, and directly tied to their data. Avoid generic advice.`;
}

/* ── Parse raw text into structured sections ── */
function parseInsights(raw) {
  const sections = {
    strengths: [],
    weaknesses: [],
    roadmap: [],
    suggestions: [],
    raw
  };

  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  let current = null;

  lines.forEach(line => {
    if (line.includes('STRENGTHS'))            current = 'strengths';
    else if (line.includes('WEAKNESSES'))      current = 'weaknesses';
    else if (line.includes('IMPROVEMENT ROADMAP') || line.includes('ROADMAP')) current = 'roadmap';
    else if (line.includes('PRACTICE SUGGESTIONS') || line.includes('SUGGESTIONS')) current = 'suggestions';
    else if (current && (line.startsWith('-') || line.startsWith('•') || /^\d+\./.test(line))) {
      const clean = line.replace(/^[-•\d.]+\s*/, '').trim();
      if (clean) sections[current].push(clean);
    }
  });

  return sections;
}

module.exports = router;
