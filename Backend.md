# Backend Documentation

The server-side half of the S&P 500 Intelligence Platform. It holds the scoring
engine, keeps the Finnhub API key off the browser, exposes a scoring API, and
runs the daily data jobs that used to be GitHub Actions.

---

## Contents

1. [What the backend is for](#1-what-the-backend-is-for)
2. [File-by-file](#2-file-by-file)
3. [API endpoints](#3-api-endpoints)
4. [Environment variables](#4-environment-variables)
5. [Running it](#5-running-it)
6. [The daily jobs](#6-the-daily-jobs)
7. [How the frontend connects](#7-how-the-frontend-connects)
8. [AI generation (scout picks + insights)](#8-ai-generation-scout-picks--insights)
9. [Known limitations](#9-known-limitations)

---

## 1. What the backend is for

Before this backend, the browser did everything: it held the scoring formula,
called Finnhub directly, and carried the API key in page source. That created
three problems — an exposed key, the formula duplicated across six files, and a
per-visitor API budget.

This backend fixes all three. It is a small Node/Express server that:

- Holds the **one** copy of the scoring engine
- Reads the Finnhub key from the **environment**, never exposing it
- Answers scoring requests over a simple HTTP API
- Runs the daily `report.json` / `scout-data.json` builds on its own timer
- Is packaged in **Docker** so it runs identically anywhere

---

## 2. File-by-file

```
backend/
├── server.js            entry point — starts everything
├── scoring.js           the single source of truth for scoring
├── finnhub.js           all Finnhub access + caching, key lives here
├── routes/
│   └── score.js         the /api/score and /api/scan endpoints
├── jobs/
│   └── daily.js         builds report.json + scout-data.json on a timer
├── package.json         dependencies (express, cors, dotenv)
├── .env                 secrets — gitignored, never committed
├── .env.example         template showing which vars are needed
├── Dockerfile           recipe to build the container image
├── docker-compose.yml   one-command build + run
├── .gitignore           excludes node_modules, .env, data
├── .dockerignore        keeps those out of the image too
└── README.md            quick-start
```

### server.js
The entry point — the file `npm start` and Docker run. It:
- Starts the Express web server on `PORT` (default 3000)
- Enables CORS so the frontend origin can call it
- Mounts the scoring routes under `/api`
- Serves generated JSON files from `/data/:file`
- On startup, runs the daily job once if no data files exist yet
- Arms the daily scheduler

### scoring.js
The scoring engine, ported verbatim from the original so scores are unchanged.
Exports three things:
- `WEIGHTS` — the per-sector signal weights (each row sums to 100)
- `SECTORS` — the 11 sector ETFs and their constituent tickers (~360 stocks)
- `calcScore(quote, earnings, rec, target, etf)` — returns `{ total, signals }`

This is the file that ended the six-copy duplication. Everything imports from
here.

### finnhub.js
All Finnhub access, server-side. The key comes from `process.env.FINNHUB_KEY`
and never leaves the server. Includes:
- A 60-second in-memory cache, so repeated requests for the same symbol don't
  each spend a Finnhub call (the shared budget the old per-visitor setup lacked)
- 429 rate-limit handling with the `Retry-After` header
- Typed helpers: `quote`, `earnings`, `rec`, `target`, `profile`, `metric`,
  `companyNews`

### routes/score.js
Defines the two live endpoints the browser calls. Both score using
`calcScore` and fetch via `finnhub.js`. See the API section below.

### jobs/daily.js
Replaces the GitHub Actions. Builds both data files and writes them to
`DATA_DIR`, where `server.js` serves them. Runs on a self-managed timer that
checks every 15 minutes and fires once at ~9:00 AM ET on weekdays. Also
callable on demand via `POST /api/rebuild`.

---

## 3. API endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness check — returns `{ok:true, ts}` |
| GET | `/api/score/:symbol?etf=XLK` | Score one stock |
| GET | `/api/scan/:etf` | Score a whole sector, ranked high-to-low |
| GET | `/data/report.json` | Latest market report (from the daily job) |
| GET | `/data/scout-data.json` | Latest scout rankings (from the daily job) |
| POST | `/api/rebuild` | Force-regenerate both data files now |

### GET /api/score/:symbol

Query param `etf` sets the sector context for weighting (default `XLK`).

```
GET /api/score/NVDA?etf=XLK
```
```json
{
  "sym": "NVDA",
  "etf": "XLK",
  "dp": 2.03,
  "c": 193.87,
  "o": 192.35,
  "pc": 190.01,
  "score": 44,
  "signals": {
    "beatMag":    { "score": 9,  "max": 39, "detail": "3.0%" },
    "beatStreak": { "score": 17, "max": 17, "detail": "4Q" },
    "momentum":   { "score": 18, "max": 39, "detail": "+2.03%" },
    "analyst":    { "score": 0,  "max": 5,  "detail": "Sell" },
    "target":     { "score": 0,  "max": 0,  "detail": "No data" }
  }
}
```

Returns `404` if the symbol has no price data.

### GET /api/scan/:etf

Scores every stock in the sector, sorted highest first. Takes ~30–60s because
it batches requests to respect the rate limit.

```
GET /api/scan/XLK
```
```json
{
  "etf": "XLK",
  "name": "Information Technology",
  "count": 19,
  "stocks": [ { "sym": "...", "score": 89, "dp": 3.4, "signals": {} } ]
}
```

Returns `404` for an unknown ETF.

### Error shape

On failure, endpoints return the appropriate status with:
```json
{ "error": "message", "retryAfter": 5 }
```
`retryAfter` (seconds) is present on 429 rate-limit responses.

---

## 4. Environment variables

Set in `.env` locally, or injected by the host in production. Template is in
`.env.example`.

| Variable | Default | Purpose |
|---|---|---|
| `FINNHUB_KEY` | *(required)* | Finnhub API key. Server-side only. |
| `PORT` | `3000` | Port the server listens on |
| `DATA_DIR` | `./data` | Where generated JSON files are written/served |
| `FRONTEND_ORIGIN` | `*` | CORS origin. Lock to your site URL in production. |

`.env` is gitignored and dockerignored — it is never committed or baked into
the image. In production the host injects these through its own secret
management.

---

## 5. Running it

### Locally, without Docker

```bash
npm install
cp .env.example .env      # then edit .env, add your real FINNHUB_KEY
npm start
```
Visit http://localhost:3000/health → `{"ok":true}`

### With Docker

Docker Desktop (or the Docker engine) must be running.

```bash
# .env must exist with FINNHUB_KEY set — compose reads it
docker compose up --build     # first time (builds the image)
docker compose up             # subsequent times (fast)
```
Same URL. Stop with Ctrl+C, then `docker compose down`.

**Note:** compose reads `.env` from the folder you run the command in. If you
see `WARN: FINNHUB_KEY not set`, the `.env` isn't in that folder.

### Quick verification

```
http://localhost:3000/health                  → {"ok":true}
http://localhost:3000/api/score/AAPL?etf=XLK   → a scored stock
http://localhost:3000/api/scan/XLK             → a ranked sector
```

The API key appears in none of these responses — that's the security win.

---

## 6. The daily jobs

`jobs/daily.js` builds the same two files the old GitHub Actions produced:

- **`scout-data.json`** — top 5 per sector, `dp > 0` pre-filter
- **`report.json`** — sector performance aggregates + overall top signals

Timing: the scheduler checks every 15 minutes and fires once at ~9:00 AM ET on
weekdays. It also runs once on startup if no data files exist yet. To force a
rebuild any time:

```bash
curl -X POST http://localhost:3000/api/rebuild
```

Output is written to `DATA_DIR` and served at `/data/<file>`.

---

## 7. How the frontend connects

The frontend has a switch in `app-config.js`:

```js
const BACKEND_URL = '';   // empty = call Finnhub directly (old behaviour)
                          // set   = call this backend instead
```

- **Empty** — pages call Finnhub directly with the embedded key (keeps the live
  GitHub Pages site working while the backend has no public host)
- **Set to the backend URL** — pages call `/api/score` and `/api/scan`; the key
  stays server-side and each score costs the browser one request instead of four

All four pages (Scanner, Scout, Watchlist, Report) already check this flag and
fall back gracefully. Flipping the whole site to backend mode is a one-line
change — once the backend has a reachable URL.

---

## 8. AI generation (scout picks + insights)

The backend can generate the AI files that the local scripts used to produce:

- **`ai-scout.json`** — the AI's independent top-5 picks with reasoning and
  confirmed/unexplained/divergent labels
- **`ai-insights.json`** — news context for those picks (Option 1: insights are
  generated for the scout picks, so no watchlist credentials are needed)

This runs as part of the daily job, right after the sector scan, using the
fresh scout data. Relevant files: `jobs/ai.js` (the logic) and `llm.js` (model
server access).

### The reachability gate

The AI job calls the model server at `LLM_BASE` (default
`http://10.200.210.26:8080/v1`). That address is on the office LAN. So:

- **Backend deployed on the office network** → the job runs, AI files generate
  automatically each day. No more manual `update-ai.sh`.
- **Backend deployed anywhere else** (a cloud host, your laptop off-network) →
  the job detects the server is unreachable, logs a notice, and **skips**. The
  rest of the backend runs normally. Nothing breaks.

This is why the job is safe to ship everywhere: it self-checks reachability
before doing anything.

### Required environment variables

| Variable | Default | Purpose |
|---|---|---|
| `LLM_KEY` | *(required for AI)* | Bearer token for the model server |
| `LLM_BASE` | `http://10.200.210.26:8080/v1` | Model server URL |
| `LLM_MODEL` | `gpt-5.4-mini` | Model name |

Whoever deploys the backend must inject `LLM_KEY` the same way they inject
`FINNHUB_KEY`. Without it, the AI job simply skips.

### Manual trigger

```bash
curl -X POST http://localhost:3000/api/rebuild-ai
```

Regenerates just the AI files. Returns `{skipped:true}` if the model server
isn't reachable from the host.

### Frontend

No frontend change is needed. The Scout and Report pages already read
`ai-scout.json` and `ai-insights.json` and show an age tag. Once the backend
serves fresh copies daily, those age tags stay green automatically.

---

## 9. Known limitations

- **Finnhub free tier is ~300 calls/day.** A full daily scan of ~360 stocks
  exceeds this, so `scout-data.json` may be partial on the free tier. A paid
  data source removes this ceiling.
- **The backend is not yet deployed.** It runs on `localhost`; the live site
  can't reach it until it's hosted somewhere container-capable (GitHub Pages
  cannot run containers).
- **The `target` signal is always 0** — its Finnhub endpoint is premium-only.
  Its weight is redistributed across the other four signals.
- **The stock universe is ~360 hardcoded tickers**, not the full S&P 500 —
  live constituent data also needs a premium endpoint.

---

**Everything here produces momentum signal rankings from historical patterns.
Not predictions. Not financial advice.**
