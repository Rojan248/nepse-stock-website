# Complete Project Debrief: NEPSE Stock Website

> Last updated: March 3, 2026

---

## 1. PROJECT OVERVIEW

**Pitch:** A real-time Nepalese Stock Exchange (NEPSE) data platform that scrapes live market data, stores historical records, and presents them through a modern web dashboard with charts, sector analysis, and stock screening tools.

**Who it's for:** Nepali retail investors and traders who want a clean, fast interface to track NEPSE stocks, analyze trends, and screen for opportunities — essentially a local alternative to expensive terminal tools.

**Problem it solves:** NEPSE's official tools are clunky. This gives investors a modern, responsive dashboard with historical data, technical indicators, and portfolio-grade analysis for the Nepali market.

---

## 2. TECH STACK & ARCHITECTURE

| Layer | Tech | Why |
|-------|------|-----|
| **Backend** | Node.js + Express.js | Lightweight API server, JS ecosystem consistency |
| **Frontend** | React 18 + Vite | Fast HMR dev experience, modern SPA |
| **Database** | SQLite via Prisma ORM | Zero-config DB, file-based, perfect for single-server deployment |
| **Styling** | CSS Modules / Custom CSS | No heavy UI framework overhead, custom design system |
| **Scraping** | Custom scrapers (cheerio/axios) | Pull live NEPSE data from multiple sources |
| **Deployment** | PM2 | Process management for Node on VPS |
| **Testing** | Jest (backend) + Vitest (frontend) | Unit/integration tests |

### Architecture

Monorepo with two apps — `backend/` and `frontend/` — communicating via REST API. Classic client-server SPA pattern. Not microservices, not a monolith framework — just a clean two-process setup.

### Non-obvious decisions

- **SQLite instead of Postgres** — intentional for simplicity and single-server deployment. Fine for read-heavy stock data workloads.
- **Multiple scraper sources** — `libraryFetcher`, `depthFetcher`, etc. provide redundancy; if one NEPSE data source is down, others can fill in.
- **Watchdog system** — a monitoring layer that verifies data freshness and integrity after each scrape cycle.
- **`.agent/skills/` directory** — an AI-agent instruction system that documents patterns so AI tools (and new devs) can follow project conventions consistently.

---

## 3. CURRENT STATE

| Status | Area |
|--------|------|
| ✅ **DONE** | Prisma schema & migrations, backend API (stocks/market/IPOs/watchdog), frontend React SPA, scraper pipeline, auth middleware, error handling, rate limiting, security headers, PM2 deployment config, 88 backend + 29 frontend tests passing |
| ✅ **DONE** | Data enrichment pipeline, historical data fetching, scheduler for automated updates |
| ✅ **DONE** | IPO tracking with status filtering, market breadth calculations, sector-level analysis |
| 🟡 **ONGOING** | Code health refactoring (CodeScene-driven complexity reduction across all modules) |
| ⚠️ **WATCH** | Scraper stability — tightly coupled to NEPSE's HTML structure, inherently fragile |

---

## 4. CODEBASE MAP

```
nepse-stock-website/
├── AGENTS.md                        # AI agent instructions
├── ARCHITECTURE.md                  # High-level architecture doc
├── package.json                     # Root package (scripts for both apps)
│
├── backend/                         # Express.js API
│   ├── src/
│   │   ├── server.js                # ← ENTRY POINT (backend)
│   │   ├── routes/
│   │   │   ├── stocks.js            # /api/stocks endpoints
│   │   │   ├── market.js            # /api/market-summary, health, history
│   │   │   ├── ipos.js              # /api/ipos endpoints
│   │   │   └── watchdog.js          # /api/watchdog endpoints (admin)
│   │   ├── middleware/
│   │   │   ├── auth.js              # Admin API key authentication
│   │   │   ├── cors.js              # CORS configuration
│   │   │   ├── errorHandler.js      # Global error handling
│   │   │   └── rateLimiter.js       # Rate limiting
│   │   ├── services/
│   │   │   ├── dataFetcher.js       # Orchestrates data fetching
│   │   │   ├── dataEnricher.js      # Enriches raw scraped data
│   │   │   ├── scheduler.js         # Automated update scheduling
│   │   │   ├── alertService.js      # Alert/notification system
│   │   │   ├── analytics.js         # Analytics tracking
│   │   │   ├── scrapers/            # Data source scrapers
│   │   │   │   ├── libraryFetcher.js
│   │   │   │   └── depthFetcher.js
│   │   │   ├── fetchers/            # Specialized data fetchers
│   │   │   ├── database/            # DB operations layer
│   │   │   └── utils/               # Logger, error utils
│   │   └── data/
│   │       └── nepseStocks.js       # Static stock reference data
│   ├── scripts/
│   │   ├── migrate-json-to-sqlite.js # JSON → SQLite migration
│   │   ├── ops.js                   # Unified verify/diagnostic operations
│   │   ├── seed-ipos.js             # IPO sample data seeding
│   │   ├── backfill-history.js      # Market history backfill
│   │   └── populate-52w.js          # 52-week range enrichment
│   ├── prisma/
│   │   ├── schema.prisma            # ← DATABASE SCHEMA (critical)
│   │   └── migrations/              # Migration history
│   ├── tests/
│   │   ├── unit/                    # Unit tests
│   │   ├── integration/             # Integration tests
│   │   └── performance/             # Perf benchmarks
│   ├── data/                        # JSON data files (legacy/seed)
│   │   ├── stocks.json
│   │   ├── marketSummary.json
│   │   ├── marketHistory.json
│   │   └── ipos.json
│   ├── ecosystem.config.js          # PM2 deployment config
│   └── jest.config.js
│
├── frontend/                        # React + Vite SPA
│   ├── src/
│   │   ├── main.jsx                 # ← ENTRY POINT (frontend)
│   │   ├── App.jsx                  # Root component + routing
│   │   ├── App.css                  # Global styles
│   │   ├── components/              # Reusable UI components
│   │   │   ├── SummaryCard.jsx      # Market summary cards
│   │   │   ├── StockTable.jsx       # Main stock listing table
│   │   │   └── SystemHealthBadge.jsx
│   │   ├── pages/                   # Route-level page components
│   │   ├── hooks/                   # Custom React hooks
│   │   │   └── useFilters.js        # Stock filtering/pagination
│   │   ├── services/                # API call functions
│   │   └── utils/                   # Formatting, constants
│   ├── tests/                       # Frontend test suite
│   ├── vite.config.js
│   └── index.html
│
├── docs/                            # Documentation
│   ├── API.md                       # API endpoint reference
│   ├── ARCHITECTURE.md              # Architecture details
│   ├── SECURITY.md                  # Security considerations
│   ├── SETUP.md                     # Setup instructions
│   ├── WATCHDOG.md                  # Watchdog system docs
│   └── STATE_OF_PROJECT.md          # Project status
│
├── scripts/                         # System-level scripts
│   ├── install-windows-autostart.bat
│   ├── windows-startup.bat
│   └── linux-systemd-setup.sh
│
└── .agent/skills/                   # AI agent skill docs
    ├── nodejs-express/SKILL.md
    ├── react-vite/SKILL.md
    ├── prisma-sqlite/SKILL.md
    ├── testing-jest/SKILL.md
    ├── deployment-pm2/SKILL.md
    ├── css-animations/SKILL.md
    └── ui-ux-patterns/SKILL.md
```

### Key files

- **Entry points:** `backend/src/server.js`, `frontend/src/main.jsx`
- **Core business logic:** `backend/src/services/` — scraping, data processing, scheduling
- **Database schema:** `backend/prisma/schema.prisma`

### ⚠️ Don't touch without understanding first

- `prisma/schema.prisma` — changes cascade to migrations and all queries
- `backend/src/middleware/` — error handling/auth affects every route
- Scraper code (`libraryFetcher.js`, `depthFetcher.js`) — tightly coupled to NEPSE's HTML structure

---

## 5. DATA & STATE

### Storage

SQLite database file, managed by Prisma ORM. Location defined in `backend/.env` as `DATABASE_URL`. Legacy JSON files exist in `backend/data/` for seeding/migration.

### Data Model (key entities in `schema.prisma`)

| Entity | Key Fields | Purpose |
|--------|-----------|---------|
| **Stock** | symbol (PK), companyName, sector, lastTradedPrice, volume, change, percentageChange | Current stock data |
| **MarketHistory** | symbol, date, closePrice, highPrice, lowPrice, volume | Historical price records |
| **MarketSummary** | totalTurnover, totalVolume, advancedCompanies, declinedCompanies | Daily market-level stats |
| **IPO** | symbol (PK), companyName, issueDate, closingDate, price, status | IPO tracking |

### State Flow

1. **Scrapers** pull data from NEPSE sources → write to SQLite via Prisma
2. **Express API** reads from SQLite → serves JSON endpoints
3. **React frontend** calls API → stores in component state / hooks
4. **Charts and tables** render from that state
5. **Scheduler** triggers periodic scrapes during market hours
6. **Watchdog** monitors data quality after each cycle

---

## 6. ENVIRONMENT & CONFIG

### Backend `.env`

```env
DATABASE_URL="file:./prisma/dev.db"    # SQLite file path
PORT=3001                               # API server port
NODE_ENV=development                    # dev/production behavior
ADMIN_API_KEY=<secret>                  # Admin endpoint authentication
LOG_IPS=false                           # Enable anonymized IP logging
LOG_IP_SALT=<optional>                  # Salt for IP anonymization
```

### Frontend `.env`

```env
VITE_API_URL=http://localhost:3001      # Backend API base URL
```

### External Dependencies

- **NEPSE website / data sources** — for scraping. If they change HTML structure, scrapers break.
- **No third-party auth/payment APIs** — self-contained system.

### Environments

- **Development:** Local SQLite, Vite dev server with HMR
- **Production:** PM2-managed Node process, same SQLite, built React assets served statically
- No separate staging environment

---

## 7. HOW TO RUN IT

### Step-by-step

```powershell
# 1. Install backend dependencies
cd d:\nepse-stock-website\backend
npm install

# 2. Set up the database
npx prisma generate
npx prisma migrate dev

# 3. Create .env if it doesn't exist
# (copy from .env.example or create manually with values above)

# 4. Start the backend
npm run dev

# 5. In a NEW terminal — install & start frontend
cd d:\nepse-stock-website\frontend
npm install
npm run dev

# 6. Open browser to http://localhost:5173 (Vite default)
```

### Gotchas

- **`npx prisma generate` MUST run before the backend starts** — it generates the client code. Skip this and you get cryptic import errors.
- **SQLite file permissions** — if `dev.db` gets locked (another process has it open), writes fail silently or throw.
- **CORS** — if frontend port doesn't match what the backend allows, API calls fail. Check `backend/src/middleware/cors.js`.
- **Node version** — use Node 18+. Prisma + Vite need it.
- **ADMIN_API_KEY** — must be set in `.env` for watchdog and admin health endpoints to work.

### Running Tests

```powershell
# Backend (Jest) — 88 tests
cd backend
npx jest

# Frontend (Vitest) — 29 tests
cd frontend
npx vitest run
```

Tests are reliable as of the latest commit. All 117 tests pass.

---

## 8. ACTIVE TASKS & NEXT STEPS

### What was being worked on

CodeScene-driven code health refactoring — systematically reducing cyclomatic complexity, eliminating code duplication, and decomposing complex methods across the codebase. Recent commits:

- Extracted `migrateCollection()` to eliminate duplication between `migrateStocks`/`migrateIpos`
- Added per-item error resilience in migration loop
- Reduced complexity in `SummaryCard`, `useFilters`, `errorHandler`
- Table-driven patterns replacing if-else chains throughout

### Most important next step

Continue CodeScene-flagged issues if any remain, or shift to feature work. Check CodeScene dashboard for remaining code health items.

### Half-finished changes

None — all changes were committed and pushed. Clean working tree as of last push (`21e3945`).

---

## 9. LANDMINES & TECH DEBT

| Risk | Why It Matters |
|------|---------------|
| **Scrapers are fragile** | If NEPSE changes their HTML, scraping breaks silently. Always validate scraped data before writing to DB. |
| **SQLite concurrency** | SQLite handles one writer at a time. If scraping and API writes overlap, you can get `SQLITE_BUSY`. |
| **No user authentication** | API endpoints are open (except admin ones). If this goes public-facing, rate limiting is the only protection. |
| **Prisma migrations in SQLite** | SQLite doesn't support all `ALTER TABLE` operations. Some schema changes require table recreation — Prisma handles this but it can lose data in dev. Always back up `dev.db` before migrating. |
| **CSS without a framework** | Custom CSS is flexible but can diverge. Follow patterns in `.agent/skills/ui-ux-patterns/SKILL.md`. |
| **JSON data files** | `backend/data/*.json` are legacy seed files. The source of truth is now SQLite. Don't rely on these being current. |

---

## 10. OPEN QUESTIONS

- **Scraper scheduling** — is the current `scheduler.js` interval optimal for NEPSE's rate limits? Has it ever been throttled/blocked?
- **Historical data backfill** — how far back does the market history go? Is there a one-time import process needed?
- **Deployment target** — is this currently deployed? Where? Who manages the VPS?
- **Mobile responsiveness** — frontend has mobile card views (`StockTable.benchmark.test.jsx` tests both views), but how complete is the mobile UX?

### Answered Questions

#### alertService.js — wired into sync status

Only the evolved `backend/src/services/utils/alertService.js` remains. `dataFetcher.js` records sync success/failure through it, while webhook delivery is controlled by `ALERT_ENABLED` and `WEBHOOK_URL`.

**Next hardening step:** Route scheduler/watchdog critical failures through `sendAlert` so operational alerts cover both scrape failures and integrity failures.

#### Watchlists / Portfolio — API-backed user features

- **Backend:** `User`, `Watchlist`, `WatchlistItem`, `Portfolio`, and trade models exist in Prisma, with Express routes mounted at `/api/watchlists` and `/api/portfolios`.
- **Frontend:** Favorites can migrate from local browser storage into the server watchlist flow, and portfolio pages consume the API-backed summary data.
- **Remaining risk:** Keep auth/session behavior covered by integration tests because these routes are user-scoped and stateful.

---

## Quick Start Checklist

```
[ ] Read the relevant .agent/skills/ SKILL.md files
[ ] Check git log and git status
[ ] Read backend/prisma/schema.prisma
[ ] Read backend/.env (create if missing)
[ ] npm install in both backend/ and frontend/
[ ] npx prisma generate && npx prisma migrate dev
[ ] Start both servers
[ ] Open browser, click around, see what works
[ ] Run tests: npx jest (backend), npx vitest run (frontend)
```
