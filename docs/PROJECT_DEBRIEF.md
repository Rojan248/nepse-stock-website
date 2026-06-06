# Project Debrief

Last updated: 2026-06-05

This is the short human/agent handoff. The detailed maps are:

| Need | Link |
| --- | --- |
| Full architecture | [../ARCHITECTURE.md](../ARCHITECTURE.md) |
| Agent retrieval map | [CODEBASE_MAP.md](CODEBASE_MAP.md) |
| API reference | [API.md](API.md) |
| Startup runbook | [../START_GUIDE.md](../START_GUIDE.md) |
| Security notes | [SECURITY.md](SECURITY.md) |

## Product

NEPSE Stock Website is a local-first stock dashboard for Nepal Stock Exchange data. It provides live stock tables, stock detail pages, market summary metrics, IPO listings, authenticated watchlists, portfolios, alerts, and data-health verification.

## Current Architecture

| Layer | Current implementation |
| --- | --- |
| Backend | Express app in [../backend/src/server.js](../backend/src/server.js) |
| Frontend | React/Vite app in [../frontend/src/App.jsx](../frontend/src/App.jsx) |
| Database | SQLite through Prisma, schema in [../backend/prisma/schema.prisma](../backend/prisma/schema.prisma) |
| Dev ports | Frontend `3000`, backend `5000`; frontend proxies `/api` |
| Production mode | Backend can serve `frontend/dist` and API from one process |
| Scheduler | [updateScheduler.js](../backend/src/services/scheduler/updateScheduler.js) |
| Data ingestion | [dataFetcher.js](../backend/src/services/dataFetcher.js) plus [scrapers](../backend/src/services/scrapers) |
| Data verification | [WatchdogService.js](../backend/src/services/watchdog/WatchdogService.js) |
| Optional AI summaries | Disabled scaffold under `/api/ai-summaries` |

## Current Status

| Area | Status |
| --- | --- |
| Core API | Implemented |
| React frontend | Implemented |
| Prisma schema/migrations | Implemented |
| User auth | Implemented with JWT access tokens and httpOnly refresh cookies |
| Watchlists/portfolios/alerts | Implemented and user-scoped |
| Admin endpoints | Protected with `adminLimiter` and `x-admin-key` |
| Rate limiting | Implemented |
| Watchdog | Implemented |
| AI summaries | Infrastructure present, disabled by default, no active summary UI |
| Old AI stock picks | Removed as unused/stale |

## Feature Map

| Feature | Backend | Frontend |
| --- | --- | --- |
| Stocks | [stocks.js](../backend/src/routes/stocks.js) | [HomePage.jsx](../frontend/src/pages/HomePage.jsx), [StockTable.jsx](../frontend/src/components/StockTable.jsx) |
| Stock detail | [stocks.js](../backend/src/routes/stocks.js) | [StockDetailPage.jsx](../frontend/src/pages/StockDetailPage.jsx) |
| Market summary | [market.js](../backend/src/routes/market.js) | [MarketSummarySection.jsx](../frontend/src/components/MarketSummarySection.jsx) |
| IPOs | [ipos.js](../backend/src/routes/ipos.js) | [IPOPage.jsx](../frontend/src/pages/IPOPage.jsx) |
| Auth | [auth.js](../backend/src/routes/auth.js) | [useAuth.jsx](../frontend/src/hooks/useAuth.jsx), [LoginPage.jsx](../frontend/src/pages/LoginPage.jsx), [RegisterPage.jsx](../frontend/src/pages/RegisterPage.jsx) |
| Watchlists | [watchlists.js](../backend/src/routes/watchlists.js) | [SharedWatchlistPage.jsx](../frontend/src/pages/SharedWatchlistPage.jsx), [SharedWatchlistView.jsx](../frontend/src/components/SharedWatchlistView.jsx) |
| Portfolio | [portfolios.js](../backend/src/routes/portfolios.js) | [PortfolioPage.jsx](../frontend/src/pages/PortfolioPage.jsx) |
| Alerts | [alerts.js](../backend/src/routes/alerts.js) | [AlertsPage.jsx](../frontend/src/pages/AlertsPage.jsx) |
| Watchdog/health | [watchdog.js](../backend/src/routes/watchdog.js), [market.js](../backend/src/routes/market.js) | [SystemHealthBadge.jsx](../frontend/src/components/SystemHealthBadge.jsx) |

## Important Risks

1. Scraper reliability depends on external NEPSE/public-source behavior.
2. SQLite is fine for a single-process/single-writer deployment; use care before scaling to multiple writers.
3. In-memory rate limiting is single-process only.
4. Cloudflare tokens, `.env` values, database files, logs, and generated runtime JSON must stay out of Git.
5. AI-generated market text should remain disabled until cost, quality, and compliance are reviewed.

## Verification

| Scope | Command |
| --- | --- |
| Backend tests | `cd backend && npm test` |
| Backend verification | `cd backend && npm run verify` |
| Frontend tests | `cd frontend && npm test -- --run` |
| Frontend build | `cd frontend && npm run build` |
| Full repository verification | `npm run verify` |
| Running-server stability | `cd backend && npm run stable` |

## Recent Cleanup Notes

1. Replaced stale architecture/API docs with current linked maps.
2. Removed a committed Cloudflare tunnel token from the startup runbook; use `CLOUDFLARED_TOKEN` from a local secret store.
3. Removed unused stock-pick scorer helper files and stale stock-pick documentation.
4. Replaced unrelated `.github/copilot-instructions.md` content with this project's actual instructions.
5. Cleaned the root package scripts and aligned the package license with the MIT license file.
