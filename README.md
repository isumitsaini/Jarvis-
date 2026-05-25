# JARVIS CP Dashboard — Full Stack AI Edition

> Competitive Programming intelligence system powered by Codeforces API + Gemini AI.

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Your `.env` file is pre-configured with your Gemini API key:
```
GEMINI_API_KEY=your_key_here
PORT=3000
```

### 3. Run the server
```bash
npm start
# or for development with auto-reload:
npm run dev
```

### 4. Open in browser
```
http://localhost:3000
```

---

## 📁 Project Structure

```
jarvis-cp/
├── server/
│   ├── index.js              # Express entry point
│   ├── routes/
│   │   ├── codeforces.js     # GET /api/codeforces/:handle
│   │   ├── analytics.js      # GET /api/analytics?handle=
│   │   └── ai.js             # POST /api/ai-insights (Gemini)
│   └── utils/
│       └── cfProcessor.js    # CF data processing logic
├── public/
│   ├── index.html            # Home / Dashboard (original)
│   ├── css/
│   │   ├── style.css         # Original JARVIS theme
│   │   └── pages.css         # Extended styles for new pages
│   ├── js/
│   │   ├── app.js            # Original dashboard JS
│   │   ├── api.js            # Shared API client + helpers
│   │   ├── analytics.js      # Analytics page logic
│   │   ├── graphs.js         # Charts page (Chart.js)
│   │   ├── insights.js       # AI Insights page logic
│   │   └── assistant.js      # JARVIS chat + voice
│   └── pages/
│       ├── analytics.html    # Analytics page
│       ├── graphs.html       # Graphs page
│       ├── insights.html     # AI Insights page
│       └── assistant.html    # JARVIS Assistant page
├── .env                      # API key (DO NOT commit)
├── .gitignore
└── package.json
```

---

## 📄 Pages

| Page | URL | Description |
|------|-----|-------------|
| Home | `/` | Original dashboard |
| Analytics | `/pages/analytics.html` | Tag bars, verdict breakdown, monthly trend |
| Graphs | `/pages/graphs.html` | Interactive Chart.js: bar, donut, line, radar |
| AI Insights | `/pages/insights.html` | Gemini-powered strengths, roadmap, suggestions |
| Assistant | `/pages/assistant.html` | Chat UI + Web Speech API voice output |

---

## 🔗 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/codeforces/:handle` | Fetch & process CF stats |
| GET | `/api/analytics?handle=` | Enhanced analytics data |
| POST | `/api/ai-insights` | Gemini AI insights |

All endpoints include **5–10 minute caching** to avoid hammering external APIs.

---

## 🔊 Voice Feature

- Uses **Web Speech API** (no external service)
- Low pitch (0.75) + reduced rate (0.85) = JARVIS-like robotic tone
- Adjustable via sliders on the Assistant page
- Mic button enables voice-to-text input
- Works in Chrome, Edge (Firefox has limited support)

---

## 🔐 Security

- Gemini API key stored in `.env`, never sent to frontend
- All AI calls go through the backend `/api/ai-insights` route
- `.gitignore` excludes `.env` from version control

---

## 🛠 Tech Stack

- **Frontend**: Vanilla JS, GSAP 3, Chart.js 4, Web Speech API
- **Backend**: Node.js, Express, Axios
- **AI**: Google Gemini 1.5 Flash via REST API
- **Data**: Codeforces Public API
- **Caching**: node-cache (in-memory, 5–10 min TTL)
