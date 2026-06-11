# API Reference

Current REST API reference for the Express backend.

| Item | Value |
| --- | --- |
| Direct backend base URL | `http://localhost:5000/api` |
| Frontend development base URL | `/api` through Vite proxy |
| Response shape | `{ "success": true, "data": ... }` on success |
| Error shape | `{ "success": false, "error": { "message": "..." } }` |
| Admin auth | `x-admin-key` header checked by `requireAdminKey` |
| User auth | Bearer access token plus httpOnly refresh cookie |

## Stocks

Base path: `/api/stocks`

| Method | Path | Purpose | Protection |
| --- | --- | --- | --- |
| GET | `/api/stocks` | Paginated stock list | Global limiter |
| GET | `/api/stocks/search?q=` | Search by symbol/company | Search limiter |
| GET | `/api/stocks/sectors` | List sectors | Global limiter |
| GET | `/api/stocks/top-gainers` | Top positive movers | Global limiter |
| GET | `/api/stocks/top-losers` | Top negative movers | Global limiter |
| GET | `/api/stocks/top-traded` | Top volume/turnover stocks | Global limiter |
| GET | `/api/stocks/unchanged` | Unchanged stocks | Global limiter |
| GET | `/api/stocks/sector/:sector` | Stocks by sector | Global limiter |
| GET | `/api/stocks/recent` | Recently updated stocks | Global limiter |
| GET | `/api/stocks/:symbol` | Single stock detail | Global limiter |
| GET | `/api/stocks/:symbol/history` | Historical OHLC + selected metrics | Global limiter |
| GET | `/api/stocks/:symbol/metrics` | Computed metrics for a stock | Global limiter |
| GET | `/api/stocks/:symbol/depth` | Market depth and floorsheet | Global limiter |
| POST | `/api/stocks/admin/cleanup` | Delete inactive stocks | Admin limiter + admin key |
| POST | `/api/stocks/admin/cleanup-bonds` | Remove non-equity securities | Admin limiter + admin key |
| POST | `/api/stocks/admin/validate` | Remove symbols not present in official NEPSE list | Admin limiter + admin key |

### `GET /api/stocks`

Query parameters:

| Parameter | Default | Notes |
| --- | --- | --- |
| `skip` | `0` | Offset |
| `limit` | `500` | Max rows |
| `sortBy` | `symbol` | Sort field |
| `sortOrder` | `asc` | `asc` or `desc` |
| `compact` | `false` | Compact payload when supported |
| `activeOnly` | `true` | Excludes zero-LTP records by default |

## Market

Mounted through `backend/src/routes/market.js` at `/api`.

| Method | Path | Purpose | Protection |
| --- | --- | --- | --- |
| GET | `/api/market-summary` | Latest market summary plus cumulative changes | Global limiter |
| GET | `/api/market-history` | Market summary history | Global limiter |
| GET | `/api/market-stats` | Aggregate market stats and sector list | Global limiter |
| GET | `/api/market-metrics` | Aggregate computed market metrics | Global limiter |
| GET | `/api/health` | Main health endpoint | No rate limit |
| GET | `/api/health/live` | Liveness probe | Global limiter |
| GET | `/api/health/ready` | Readiness probe, returns `503` when degraded | Global limiter |
| GET | `/api/health/extended` | Extended admin health details | Admin limiter + admin key |
| GET | `/api/scheduler-status` | Scheduler status | Admin limiter + admin key |
| GET | `/api/time-sync-status` | Nepal time sync status | Admin limiter + admin key |
| GET | `/api/trending` | Analytics-based trending symbols | Global limiter |
| POST | `/api/force-update` | Force immediate scheduler update | Admin limiter + admin key |
| POST | `/api/sync-from-web` | Run direct web sync | Admin limiter + admin key |
| GET | `/api/scrape-live` | Debug live scrape without saving | Admin limiter + admin key |

## IPOs

Base path: `/api/ipos`

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/ipos` | List IPOs with pagination and optional status |
| GET | `/api/ipos/active` | Currently active/open IPOs |
| GET | `/api/ipos/search` | Search IPOs by company |
| GET | `/api/ipos/counts` | Counts by status |
| GET | `/api/ipos/status/:status` | IPOs by status |
| GET | `/api/ipos/:companyName` | Single IPO by company name |

## Auth

Base path: `/api/auth`

| Method | Path | Purpose | Protection |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Process registration generically; creates a user only when public registration is enabled and never issues a session token | Registration limiter |
| POST | `/api/auth/login` | Authenticate user and issue tokens | Login limiter |
| POST | `/api/auth/refresh` | Rotate refresh cookie and return new access token | Refresh cookie |
| POST | `/api/auth/logout` | Delete refresh token and clear cookie | Refresh cookie |
| GET | `/api/auth/me` | Current user profile | Bearer token |

## Watchlists

Base path: `/api/watchlists`

| Method | Path | Purpose | Protection |
| --- | --- | --- | --- |
| GET | `/api/watchlists` | List current user's watchlists | Bearer token |
| POST | `/api/watchlists` | Create watchlist | Bearer token |
| PUT | `/api/watchlists/:id` | Rename watchlist | Bearer token |
| DELETE | `/api/watchlists/:id` | Delete watchlist | Bearer token |
| POST | `/api/watchlists/:id/items` | Add symbol | Bearer token |
| DELETE | `/api/watchlists/:id/items/:symbol` | Remove symbol | Bearer token |
| POST | `/api/watchlists/:id/import` | Bulk import symbols | Bearer token |
| POST | `/api/watchlists/:id/share` | Create public share slug | Bearer token |
| POST | `/api/watchlists/:id/unshare` | Remove public sharing | Bearer token |
| GET | `/api/watchlists/shared/:slug` | Read public shared watchlist | Public |

## Portfolios

Base path: `/api/portfolios`

All portfolio endpoints require a Bearer token and are scoped to the current user.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/portfolios` | List portfolios |
| POST | `/api/portfolios` | Create portfolio |
| DELETE | `/api/portfolios/:id` | Delete portfolio |
| POST | `/api/portfolios/:id/trades` | Add trade |
| DELETE | `/api/portfolios/:id/trades/:tradeId` | Delete trade |
| GET | `/api/portfolios/:id/summary` | Portfolio P/L summary |
| GET | `/api/portfolios/summary` | Aggregate P/L summary |
| GET | `/api/portfolios/:id/holdings` | Computed holdings |

## Alerts

Base path: `/api/alerts`

All alert endpoints require a Bearer token and are scoped to the current user.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/alerts` | List alerts |
| POST | `/api/alerts` | Create alert |
| PUT | `/api/alerts/:id` | Update alert |
| DELETE | `/api/alerts/:id` | Delete alert |

## Watchdog

Base path: `/api/watchdog`

All watchdog endpoints use `adminLimiter` and `requireAdminKey`.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/watchdog/verify` | Manual data verification |
| POST | `/api/watchdog/fix/:symbol` | Targeted re-fetch and correction |
| POST | `/api/watchdog/audit-zero-volume` | Audit zero-volume price anomalies |
| GET | `/api/watchdog/reports` | Verification report history |

## Streams

Base path: `/api/stream`

The stream route is mounted from `backend/src/routes/stream.js` and is used for live frontend updates.

## AI Summaries

Base path: `/api/ai-summaries`

The AI summary subsystem is an optional scaffold and is disabled unless `AI_SUMMARIES_ENABLED=true`.

| Method | Path | Purpose | Protection |
| --- | --- | --- | --- |
| GET | `/api/ai-summaries/status` | Redacted scheduler and summary counts | Global limiter |
| GET | `/api/ai-summaries/stocks/:symbol/latest` | Latest stock summary for period | Global limiter |
| GET | `/api/ai-summaries/stocks/:symbol` | Stock summary history | Global limiter |
| GET | `/api/ai-summaries/market` | Market summaries | Global limiter |
| POST | `/api/ai-summaries/admin/run` | Trigger stock or market summary job | Admin limiter + admin key |

`POST /api/ai-summaries/admin/run` returns `409` while AI summaries are disabled.

## Rate Limiting

Implemented in `backend/src/middleware/rateLimiter.js`.

| Limiter | Scope | Default |
| --- | --- | --- |
| `globalLimiter` | All API routes except `/api/health` | 100 requests/minute/IP |
| `adminLimiter` | Admin endpoints and watchdog endpoints | 5 requests/minute/IP |
| `searchLimiter` | `/api/stocks/search` | 30 requests/minute/IP |
| `loginLimiter` | `/api/auth/login` | 5 attempts/15 minutes/IP |

The current store is in-memory and appropriate for a single backend process. Use a shared store such as Redis before running multiple backend processes.

## Status Codes

| Code | Meaning |
| --- | --- |
| 200 | Success |
| 201 | Created |
| 400 | Bad request |
| 401 | Unauthorized |
| 404 | Not found |
| 409 | Conflict |
| 429 | Rate limited |
| 500 | Server error |
| 503 | Readiness failure |

## Source Links

| Area | Source |
| --- | --- |
| Route mounting | [../backend/src/server.js](../backend/src/server.js) |
| Stock routes | [../backend/src/routes/stocks.js](../backend/src/routes/stocks.js) |
| Market routes | [../backend/src/routes/market.js](../backend/src/routes/market.js) |
| Auth routes | [../backend/src/routes/auth.js](../backend/src/routes/auth.js) |
| Watchlist routes | [../backend/src/routes/watchlists.js](../backend/src/routes/watchlists.js) |
| Portfolio routes | [../backend/src/routes/portfolios.js](../backend/src/routes/portfolios.js) |
| Alert routes | [../backend/src/routes/alerts.js](../backend/src/routes/alerts.js) |
| Watchdog routes | [../backend/src/routes/watchdog.js](../backend/src/routes/watchdog.js) |
| AI summary routes | [../backend/src/routes/aiSummaries.js](../backend/src/routes/aiSummaries.js) |
