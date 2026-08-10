# Documentation

Reference documentation for the S&P 500 Intelligence Platform.

## Contents

| File | What it covers |
|---|---|
| [BACKEND.md](BACKEND.md) · [BACKEND.pdf](BACKEND.pdf) | The backend server — scoring API, daily jobs, AI generation, how to run it locally and in Docker |
| [FRONTEND-REQUESTS.md](FRONTEND-REQUESTS.md) | Every page's load sequence and network requests, traced request-by-request |
| [SDK.md](SDK.md) | The client SDK that wraps the backend API — build steps, methods, examples |
| [API-REFERENCE.md](API-REFERENCE.md) | Full technical reference — Finnhub endpoints, Supabase schema, the model server, all JSON file shapes, the scoring engine |
| [SCORING-METHODOLOGY.pdf](SCORING-METHODOLOGY.pdf) | How the momentum score is calculated |
| [GITHUB-ACTIONS-SETUP.md](GITHUB-ACTIONS-SETUP.md) | Setting up the scheduled data jobs on GitHub Actions |
| [GITHUB-ACTIONS-TROUBLESHOOTING.md](GITHUB-ACTIONS-TROUBLESHOOTING.md) | Diagnosing when the scheduled jobs don't run |

## Where to start

- **Understanding the whole system** → API-REFERENCE.md
- **How the GUI works, click by click** → FRONTEND-REQUEST-FLOWS.md
- **Running or deploying the backend** → BACKEND.md (or the PDF)
- **Building something against the backend** → SDK.md
- **The scheduled jobs on GitHub** → the two GITHUB-ACTIONS files

## A note on the architecture

The platform is a static frontend (GitHub Pages) plus a containerized backend.
The backend holds the scoring engine, keeps the API key server-side, runs the
daily data jobs, and — when deployed on the office network — generates the AI
reports automatically. Until the backend is publicly hosted, the frontend falls
back to calling data sources directly; see BACKEND.md section 7 for the switch.

---

*Everything here produces momentum signal rankings from historical patterns.
Not predictions. Not financial advice.*
