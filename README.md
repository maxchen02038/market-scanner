# S&P 500 Intelligence Platform

A market-intelligence web app that scores S&P 500 stocks on momentum signals,
tracks a personal watchlist, and layers AI analysis on top. Built as a static
frontend plus a containerized backend.

**Live site:** https://maxchen02038.github.io/market-scanner/

---

## What it does

- **Sector Scanner** — scores ~360 stocks across 11 sector ETFs on momentum
- **Stock Scout** — pre-computed rankings, live single-stock scoring, and an AI
  agent that independently picks and explains stocks
- **Watchlist** — save stocks, auto re-scored, with an opt-in live mode
- **Daily Report** — a personal brief: each saved stock scored, charted since you
  saved it, with AI news context, plus sector performance
- **Login** — email/password accounts (via Supabase)

Scores are **momentum signal rankings from historical patterns — not predictions,
not financial advice.**

---

## Repository layout

```
/                         Frontend — served by GitHub Pages
├── index.html            Sector Scanner
├── scout.html            Stock Scout
├── watchlist.html        Watchlist
├── report.html           Daily Report
├── login.html            Auth
├── styles.css            All styling (one file)
├── app-config.js         BACKEND_URL switch (frontend → backend)
├── supabase-config.js    Shared auth + watchlist helpers
│
├── backend/              The API server (Node/Express, Dockerized)
│   ├── server.js         Entry point
│   ├── scoring.js        The scoring engine (single source of truth)
│   ├── finnhub.js        Finnhub access + cache (key server-side)
│   ├── llm.js            Model-server access (AI)
│   ├── routes/score.js   /api/score, /api/scan
│   ├── jobs/daily.js     Builds report.json + scout-data.json on a timer
│   ├── jobs/ai.js        Builds ai-scout.json + ai-insights.json
│   ├── openapi.yaml      API specification (load into Swagger)
│   ├── Dockerfile        Container image recipe
│   └── docker-compose.yml
│
├── sdk/                  JavaScript client library for the backend API
├── database/            Supabase table setup (SQL)
├── scripts/            GitHub Actions data-build scripts (legacy path)
├── .github/workflows/  The scheduled Action (legacy path)
├── local-scripts/      Manual AI generation (office-network fallback)
└── docs/               Full documentation (start with docs/README.md)
```

---

## Architecture in one picture

```
Frontend (GitHub Pages, static)
   │  calls
   ├─────────────► Backend API  ──► Finnhub (market data)
   │                    │        ──► Model server (AI, office LAN only)
   │                    └──► writes report/scout/ai JSON files
   ├─────────────► Supabase (auth + watchlist)
   └─────────────► static JSON files (the cache layer)
```

The frontend is static and always up. The **backend** holds the scoring engine,
keeps the API key server-side, and runs the daily jobs. Until the backend is
publicly hosted, the frontend falls back to calling Finnhub directly (see the
`BACKEND_URL` switch in `app-config.js`).

---

## Running it

### Frontend
It's static — open the HTML files in a browser, or serve the folder. In
production it's hosted on GitHub Pages.

### Backend
```bash
cd backend
npm install
cp .env.example .env      # then add your real keys (see below)
npm start                 # → http://localhost:3000
```

Or with Docker:
```bash
cd backend
docker compose up --build
```

Verify: `http://localhost:3000/health` → `{"ok":true}`

### SDK
```bash
cd sdk
npm install
npm run build             # produces dist/
npm test
```

---

## Keys and secrets

**No keys are committed to this repo** — they live in `backend/.env`, which is
gitignored. To run the backend you need:

| Variable | What it's for | Where it goes |
|---|---|---|
| `FINNHUB_KEY` | Market data | `backend/.env` |
| `LLM_KEY` | AI model server (optional) | `backend/.env` |
| `SUPABASE` anon key | Auth/watchlist | already in `supabase-config.js` (safe to expose) |

The Supabase **anon** key is safe in the frontend (it respects row-level
security). The Finnhub and model-server keys must stay server-side.

> **Note on the frontend Finnhub key:** the current frontend pages and the
> `local-scripts/` still contain a Finnhub key inline — this is the pre-backend
> setup, and it's a free read-only key already public on the live site. Once the
> frontend is switched to call the backend (`BACKEND_URL` in `app-config.js`),
> that inline key can be removed entirely, since scoring then happens
> server-side. The backend itself never hardcodes any key.

---

## Status

- Frontend: **live** on GitHub Pages
- Backend: **built, containerized, tested — not yet deployed**
- AI features: automatic **once the backend is deployed on a host that can reach
  the office network**; otherwise generated manually via `local-scripts/`

### Known limitations
- Finnhub free tier caps at ~300 calls/day; a full daily scan exceeds it
- The backend needs a container-capable host (GitHub Pages can't run it)
- The AI model server is only reachable on the office LAN

---

## Documentation

Full docs are in [`docs/`](docs/README.md):

- **BACKEND.md** — the server, its API, how to run and deploy it
- **SDK.md** — the client library
- **API-REFERENCE.md** — everything: Finnhub, Supabase, JSON shapes, scoring
- **FRONTEND-REQUESTS.md** — every page's requests, traced
- **SCORING-METHODOLOGY.pdf** — how the score is calculated

---

*Not affiliated with S&P. Data via Finnhub. For educational purposes only.
Not financial advice.*
