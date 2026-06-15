/* ─────────────────────────────────────────────────────
   JARVIS CP DASHBOARD — server/index.js
   Express server: serves static frontend + API routes
───────────────────────────────────────────────────── */
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const codeforcesRouter = require('./routes/codeforces');
const analyticsRouter  = require('./routes/analytics');
const aiRouter         = require('./routes/ai');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ── Middleware ── */
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../public')));

/* ── API Routes ── */
app.use('/api/codeforces', codeforcesRouter);
app.use('/api/analytics',  analyticsRouter);
app.use('/api/ai-insights', aiRouter);

/* ── Catch-all: SPA fallback ── */
app.get('*', (req, res) => {
  // Let HTML pages be served directly; only fallback for unknown routes
  res.status(404).json({ error: 'Route not found' });
});

/* ── Global error handler ── */
app.use((err, req, res, next) => {
  console.error('[JARVIS ERROR]', err.message);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`\n  ██╗ █████╗ ██████╗ ██╗   ██╗██╗███████╗`);
    console.log(`  ██║██╔══██╗██╔══██╗██║   ██║██║██╔════╝`);
    console.log(`  ██║███████║██████╔╝██║   ██║██║███████╗`);
    console.log(`  ██║██╔══██║██╔══██╗╚██╗ ██╔╝██║╚════██║`);
    console.log(`  ██║██║  ██║██║  ██║ ╚████╔╝ ██║███████║`);
    console.log(`  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚═╝╚══════╝\n`);
    console.log(`  CP Dashboard running on http://localhost:${PORT}`);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}\n`);
  });
}

module.exports = app;
