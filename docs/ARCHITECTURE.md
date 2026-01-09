# Architecture

> Complete system architecture for the NEPSE Stock Website.
> This document describes how data flows from external sources to the user's screen.

**Last Updated**: 2026-01-09 (Comprehensive Code Review)

---

## 1. High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL DATA SOURCES                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │ NEPSE Official  │  │   NepAlpha      │  │   Merolagani    │              │
│  │ API (via lib)   │  │ ShareSansar     │  │   (Watchdog)    │              │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘              │
│           │ Primary           │ Fallback           │ Verification           │
└───────────┼───────────────────┼────────────────────┼────────────────────────┘
            │                   │                    │
            ▼                   ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (Node.js/Express)                       │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                     UPDATE SCHEDULER                                │     │
│  │  updateScheduler.js: 10s during market | 1hr when closed           │     │
│  │  Uses external time APIs (WorldTimeAPI, TimeAPI.io) for Nepal time │     │
│  └────────────────────────┬───────────────────────────────────────────┘     │
│                           │                                                  │
│                           ▼                                                  │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                     DATA FETCHER (Orchestrator)                     │     │
│  │  dataFetcher.js (841 lines): Tries sources in priority order        │     │
│  │  1. libraryFetcher (nepse-api-helper) → Official NEPSE API          │     │
│  │  2. proxyFetcher → NepAlpha/ShareSansar APIs                        │     │
│  │  3. customScraper → Direct HTML scraping (fallback)                 │     │
│  │  4. mockFetcher → Dev mode only                                     │     │
│  └────────────────────────┬───────────────────────────────────────────┘     │
│                           │                                                  │
│                           ▼                                                  │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                     DATABASE LAYER                                  │     │
│  │  stockOperations.js: Upsert with LTP preservation logic             │     │
│  │  marketOperations.js: Market summary CRUD                           │     │
│  │  Prisma ORM → SQLite (prisma/dev.db)                                │     │
│  └────────────────────────┬───────────────────────────────────────────┘     │
│                           │                                                  │
│  ┌────────────────────────┴───────────────────────────────────────────┐     │
│  │                     WATCHDOG SERVICE                                │     │
│  │  Runs every 10 mins via node-schedule                               │     │
│  │  Compares local data with Merolagani/NepseAlpha                     │     │
│  │  Auto-corrects zero breadth by fetching previous trading day data  │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                     EXPRESS REST API                                │     │
│  │  /api/stocks      → Stock CRUD, search, top movers                  │     │
│  │  /api/market-*    → Market summary, health, scheduler status        │     │
│  │  /api/ipos        → IPO listings                                    │     │
│  │  /api/watchdog    → Verification trigger and reports                │     │
│  │  /api/trending    → Analytics-based trending stocks                 │     │
│  └────────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React/Vite)                           │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                     API SERVICE LAYER                               │     │
│  │  api.js: Axios instance with response interceptor                   │     │
│  │  Base URL: /api (proxied by Vite in dev, served by Express in prod) │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                     PAGES                                           │     │
│  │  HomePage.jsx: Fetches ALL stocks, client-side filtering/pagination │     │
│  │  StockDetailPage.jsx: Individual stock with market depth            │     │
│  │  TopMoversPage.jsx: Gainers, losers, most traded                    │     │
│  │  IPOPage.jsx: IPO listings with status filtering                    │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                     KEY COMPONENTS                                  │     │
│  │  StockTable.jsx (17KB): Sortable, paginated table with favorites   │     │
│  │  SectorChart.jsx: Recharts bar chart by sector                      │     │
│  │  TrendingBar.jsx: Marquee of trending stocks (analytics-based)      │     │
│  │  SearchBar.jsx: Autocomplete with global search state               │     │
│  └────────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Directory Structure

### Backend (`backend/`)

```
backend/
├── package.json                    # nepse-backend v1.0.0
├── ecosystem.config.js             # PM2 configuration
├── .env                            # DATABASE_URL, PORT, NODE_ENV
│
├── prisma/
│   ├── schema.prisma               # 4 models: Stock, MarketHistory, MarketSummary, Ipo
│   ├── migrations/                 # SQL migration files
│   └── dev.db                      # SQLite database (runtime, gitignored)
│
├── scripts/                        # 52 utility scripts
│   ├── auditData.js                # Check for zero LTP, stale data
│   ├── runEOD.js                   # Trigger end-of-day snapshot
│   ├── migrate-json-to-sqlite.js   # One-time migration
│   ├── fix-zero-stocks.js          # Data repair tool
│   └── [various debug scripts]
│
└── src/
    ├── server.js                   # Express app entry (171 lines)
    │
    ├── routes/
    │   ├── stocks.js               # 301 lines: /api/stocks/*
    │   ├── market.js               # 379 lines: /api/market-*, /api/health
    │   ├── ipos.js                 # 137 lines: /api/ipos/*
    │   └── watchdog.js             # 40 lines: /api/watchdog/*
    │
    ├── services/
    │   ├── dataFetcher.js          # 841 lines: Main orchestrator
    │   ├── analytics.js            # 202 lines: Trending calculation
    │   ├── depthFetcher.js         # Market depth (Level 2)
    │   │
    │   ├── scrapers/
    │   │   ├── libraryFetcher.js   # 519 lines: nepse-api-helper wrapper
    │   │   ├── proxyFetcher.js     # 15KB: NepAlpha/ShareSansar
    │   │   ├── customScraper.js    # 16KB: Direct HTML scraping
    │   │   └── mockFetcher.js      # 3KB: Development mock data
    │   │
    │   ├── scheduler/
    │   │   └── updateScheduler.js  # 252 lines: Interval-based updates
    │   │
    │   ├── database/
    │   │   ├── prismaClient.js     # Prisma singleton
    │   │   ├── connection.js       # connectDB/disconnectDB
    │   │   ├── stockOperations.js  # 481 lines: Stock CRUD with LTP preservation
    │   │   ├── marketOperations.js # Market summary CRUD
    │   │   ├── ipoOperations.js    # IPO CRUD
    │   │   └── localStorage.js     # 25KB: Legacy JSON fallback
    │   │
    │   ├── watchdog/
    │   │   ├── WatchdogService.js  # 209 lines: Data verification
    │   │   └── providers/
    │   │       ├── MerolaganiProvider.js
    │   │       └── NepseAlphaProvider.js
    │   │
    │   └── utils/
    │       ├── marketTime.js       # 301 lines: External time sync
    │       └── logger.js           # Winston configuration
    │
    └── data/
        └── nepseStocks.js          # Static symbol → name/sector mapping
```

### Frontend (`frontend/src/`)

```
frontend/src/
├── main.jsx                        # React DOM render
├── App.jsx                         # 34 lines: Routes + global search state
├── App.css                         # 7.7KB: CSS design system
│
├── pages/
│   ├── HomePage.jsx                # 482 lines: Main dashboard
│   ├── StockDetailPage.jsx         # 12KB: Stock detail + depth
│   ├── TopMoversPage.jsx           # 6KB: Gainers/losers/traded
│   ├── IPOPage.jsx                 # 3.5KB: IPO listings
│   └── SearchResultsPage.jsx       # 3KB: Search results
│
├── components/
│   ├── StockTable.jsx              # 17KB: Main data table
│   ├── SectorChart.jsx             # 3.6KB: Recharts bar chart
│   ├── Header.jsx                  # 5KB: Sticky header with search
│   ├── SearchBar.jsx               # 4KB: Autocomplete search
│   ├── SummaryCard.jsx             # 3.2KB: Market metric cards
│   ├── TrendingBar.jsx             # 2.4KB: Trending stocks marquee
│   ├── AnimatedValue.jsx           # Value change animations
│   ├── depth/                      # Market depth components
│   └── ui/                         # Button, Select, Card, etc.
│
├── hooks/
│   ├── useLocalStorage.js          # Favorites persistence
│   └── [other hooks]
│
├── services/
│   └── api.js                      # 349 lines: Axios wrapper
│
└── utils/
    ├── formatting.js               # formatNumber, formatPercent
    └── constants.js                # ITEMS_PER_PAGE = 20
```

---

## 3. Data Flow (Step by Step)

| Step | File | What Happens |
|------|------|--------------|
| **1** | `updateScheduler.js` | Checks market state via `marketTime.js`. If OPEN (10:00-15:00 NST, Sun-Thu), schedules update every 10s. If CLOSED, every 1 hour. |
| **2** | `marketTime.js` | Fetches accurate Nepal time from WorldTimeAPI or TimeAPI.io. Calculates offset to correct system clock. |
| **3** | `dataFetcher.js` | `fetchLatestData()` tries scrapers in order. First success wins. |
| **4** | `libraryFetcher.js` | Uses `nepse-api-helper` npm package. Calls `/api/nots/securityDailyTradeStat/58` (Sector 58 = all stocks). Gets ~270 stocks. |
| **5** | `dataFetcher.js` | `enrichStocksWithNames()` maps symbols to company names from `nepseStocks.js`. `calculateMarketSummary()` computes breadth from stock data. |
| **6** | `stockOperations.js` | `saveStocks()` upserts into SQLite. **Critical**: If incoming LTP=0 and existing LTP>0, preserves existing price. |
| **7** | `marketOperations.js` | `upsertMarketSummary()` stores NEPSE Index, turnover, volume, breadth. |
| **8** | `WatchdogService.js` | Every 10 mins: compares local data with Merolagani. If breadth is zero, fetches previous trading day data to restore. |
| **9** | `routes/stocks.js` | `GET /api/stocks` calls `stockOperations.getAllStocks()`, returns JSON. |
| **10** | `api.js` (frontend) | Axios calls `/api/stocks`, response interceptor unwraps `data`. |
| **11** | `HomePage.jsx` | `fetchAllStocks()` loops through pages (100 per page) until no more. Stores all ~270 in state. |
| **12** | `HomePage.jsx` | `filteredStocks` computed via `useMemo`: filters by sector, search query, favorites, status. |
| **13** | `StockTable.jsx` | Renders paginated, sortable table. Highlights price changes. |

---

## 4. Database Schema

```prisma
model Stock {
  id               Int       @id @default(autoincrement())
  symbol           String    @unique
  companyName      String
  sector           String?
  lastTradedPrice  Float?    // LTP - main price field
  previousClose    Float?
  openPrice        Float?
  highPrice        Float?
  lowPrice         Float?
  volume           Float?
  totalTrades      Int?
  turnover         Float?
  change           Float?
  percentageChange Float?
  updatedAt        DateTime  @updatedAt
  history          MarketHistory[]
}

model MarketHistory {
  id               Int      @id @default(autoincrement())
  symbol           String
  date             DateTime
  closePrice       Float?
  highPrice        Float?
  lowPrice         Float?
  volume           Float?
  turnover         Float?
  change           Float?
  percentageChange Float?
  stock            Stock?   @relation(fields: [symbol], references: [symbol], onDelete: Cascade)
  @@index([symbol, date])
}

model MarketSummary {
  id                 Int      @id @default(autoincrement())
  indexValue         Float?   // NEPSE Index value
  indexChange        Float?   // Points change
  indexChangePercent Float?   // Percent change
  totalTurnover      Float?
  totalVolume        Float?
  totalTransactions  Float?
  activeCompanies    Int?     // Scrips traded
  advancedCompanies  Int?     // Stocks that went up
  declinedCompanies  Int?     // Stocks that went down
  unchangedCompanies Int?     // Stocks with no change
  timestamp          DateTime @default(now())
}

model Ipo {
  id           Int       @id @default(autoincrement())
  symbol       String    @unique
  companyName  String
  sector       String?
  issueDate    DateTime?
  closingDate  DateTime?
  price        Float?
  units        Int?
  status       String?   // upcoming, open, closed, completed
  issueManager String?
}
```

---

## 5. Key Design Decisions

### 1. LTP Preservation
```javascript
// stockOperations.js lines 109-116
if (existingLtp && existingLtp > 0 && newLtp === 0) {
    logger.debug(`[${data.symbol}] Preserving existing LTP=${existingLtp} (incoming LTP=0)`);
    return prisma.stock.update({
        where: { symbol: data.symbol },
        data: { updatedAt: new Date() }
    });
}
```
**Why**: NEPSE API sometimes returns LTP=0 for actively traded stocks. This prevents data corruption.

### 2. External Time Synchronization
**File**: `marketTime.js`
**Why**: The host machine's clock may be wrong. The scheduler needs accurate Nepal time (UTC+5:45) to determine market open/close.
**Sources**: WorldTimeAPI → TimeAPI.io → System time (fallback)

### 3. Client-Side Filtering
**File**: `HomePage.jsx`
**Why**: All ~270 stocks are fetched upfront. Filtering by sector/search/status happens in JavaScript via `useMemo`. This enables instant filtering without server round-trips.

### 4. Watchdog Auto-Correction
**File**: `WatchdogService.js`
**Why**: When the live feed resets (zeroed breadth), the watchdog fetches previous trading day data from NEPSE's `securityDailyTradeStat` endpoint and restores it.

### 5. Analytics-Based Trending
**File**: `analytics.js`
**Mechanism**: Records views and searches. Score = views + (searches × 2). Applies 10% hourly decay. Persists to `analytics.json`.

### 6. Single Sector Fetch Optimization
**File**: `libraryFetcher.js` line 175-186
**Why**: Instead of fetching all 17 sectors separately (which triggers NEPSE's rate-limiting), we fetch only Sector 58 (NEPSE Index) which contains all traded securities.

---

## 6. Critical Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `nepse-api-helper` | ^2.6.0 | Official NEPSE API client with WAFv2 token handling |
| `@prisma/client` | ^5.14.0 | SQLite ORM |
| `express` | ^4.18.2 | HTTP server |
| `axios` | ^1.6.2 | HTTP client for scrapers |
| `node-schedule` | ^2.1.1 | Cron-style scheduling |
| `node-cron` | ^3.0.3 | Additional scheduling |
| `winston` | ^3.11.0 | Structured logging |
| `cheerio` | ^1.1.2 | HTML parsing for scraping |
| `react` | ^18.2.0 | UI framework |
| `recharts` | ^3.6.0 | Charting library |
| `lucide-react` | ^0.562.0 | Icons |

---

## 7. File Size Summary

| File | Lines | Size | Complexity |
|------|-------|------|------------|
| `dataFetcher.js` | 841 | 33KB | High - main orchestrator |
| `libraryFetcher.js` | 519 | 19KB | High - NEPSE API integration |
| `localStorage.js` | 600+ | 25KB | Medium - legacy fallback |
| `stockOperations.js` | 481 | 17KB | Medium - CRUD with preservation |
| `StockTable.jsx` | 400+ | 17KB | High - complex UI |
| `HomePage.jsx` | 482 | 22KB | High - main dashboard |
| `api.js` | 349 | 10KB | Low - wrapper functions |
| `marketTime.js` | 301 | 10KB | Medium - time sync logic |
