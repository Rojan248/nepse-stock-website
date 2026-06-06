# NEPSE Stock Website Documentation

Central documentation index for the NEPSE stock platform.

## Project Overview

NEPSE Stock Website is a real-time dashboard for Nepal Stock Exchange data. It fetches current market data, stores it in SQLite through Prisma, verifies data quality with a watchdog service, and presents stocks, market metrics, IPOs, watchlists, portfolios, and alerts through a React/Vite frontend.

| Area | Value |
| --- | --- |
| Stack | Node.js/Express, React/Vite, SQLite/Prisma |
| Local frontend | `http://localhost:3000` |
| Local backend | `http://localhost:5000` |
| API base in development | Frontend uses `/api` through the Vite proxy |
| Repository | `Rojan248/nepse-stock-website` |
| License | MIT |

## Documentation Index

| Document | Description |
| --- | --- |
| [../ARCHITECTURE.md](../ARCHITECTURE.md) | Current system architecture, data flow, route map, database groups, frontend map |
| [CODEBASE_MAP.md](CODEBASE_MAP.md) | Agent-oriented retrieval map with detailed module links and change entry points |
| [API.md](API.md) | REST API reference |
| [SETUP.md](SETUP.md) | Development and production setup guide |
| [SECURITY.md](SECURITY.md) | Security posture and hardening notes |
| [WATCHDOG.md](WATCHDOG.md) | Watchdog data integrity service documentation |
| [PROJECT_DEBRIEF.md](PROJECT_DEBRIEF.md) | Broader project context and historical notes |
| [../START_GUIDE.md](../START_GUIDE.md) | Practical runbook for local and production startup |

## Quick Start

```powershell
cd D:\nepse-stock-website\backend
npm run dev
```

```powershell
cd D:\nepse-stock-website\frontend
npm run dev
```

Open `http://localhost:3000`. The Vite server proxies `/api` to the backend at `http://localhost:5000`.

## Key Features

| Feature | Main route/component |
| --- | --- |
| Stock dashboard | [../frontend/src/pages/HomePage.jsx](../frontend/src/pages/HomePage.jsx) |
| Stock detail, history, metrics, depth | [../frontend/src/pages/StockDetailPage.jsx](../frontend/src/pages/StockDetailPage.jsx), `GET /api/stocks/:symbol/*` |
| Market summary and health | `GET /api/market-summary`, `GET /api/health`, `GET /api/health/ready` |
| Top movers | [../frontend/src/pages/TopMoversPage.jsx](../frontend/src/pages/TopMoversPage.jsx) |
| Search | `GET /api/stocks/search?q=` |
| IPO listings | `GET /api/ipos` |
| User auth | `POST /api/auth/login`, `POST /api/auth/register` |
| Watchlists and public shares | `GET /api/watchlists`, `/w/:slug` |
| Portfolios | `GET /api/portfolios`, `GET /api/portfolios/:id/summary` |
| Alerts | `GET /api/alerts` |
| Data verification | `POST /api/watchdog/verify` |
| Optional AI summary scaffold | `GET /api/ai-summaries/status`; disabled unless `AI_SUMMARIES_ENABLED=true` |

## Data Update Schedule

| Market state | Behavior |
| --- | --- |
| Open market | Scheduler refreshes at the configured `NEPSE_UPDATE_INTERVAL` |
| Closed market | Scheduler slows down |
| Weekend/holiday | Scheduler skips or delays unnecessary fetches |
| Watchdog | Verifies data integrity through provider comparison and report history |

## Maintenance Notes

1. Keep secrets in `.env` or ignored local config only.
2. Do not commit Cloudflare tunnel tokens, database files, runtime JSON data, or logs.
3. Update [../ARCHITECTURE.md](../ARCHITECTURE.md), [CODEBASE_MAP.md](CODEBASE_MAP.md), and [API.md](API.md) when routes, storage, or module ownership changes.
4. AI summaries are optional infrastructure only. There is no active AI summary frontend.
