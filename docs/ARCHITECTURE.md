# System Architecture

Technical architecture documentation for the NEPSE Stock Website.

## Project Overview

The system is designed as a lightweight, high-performance financial terminal. It uses a Node.js backend to scrape and serve NEPSE data and a React frontend to provide a Stark Minimalism user interface.

## Overview

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   React App     │ ──── │  Express API    │ ──── │  SQLite + JSON  │
│   (Frontend)    │      │   (Backend)     │      │  Storage        │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ↓            ↓            ↓
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │  NEPSE   │ │Merolagani│ │NepseAlpha│
              │  API     │ │  (Watch) │ │  (Watch) │
              └──────────┘ └──────────┘ └──────────┘
```

---

## Data Flow

### Primary Path (REST API)
```
NEPSE API → Backend Scraper → SQLite/JSON → Express API → React App (Root State)
```
The backend fetches NEPSE data every 10 seconds during market hours, saves to SQLite database (via Prisma) and local JSON files as fallback. The React frontend queries via REST API. Search state is managed at the root `App.jsx` level to sync the Header search bar with the HomePage table filters.

### Watchdog Path (Data Verification)
```
Local Data ←→ WatchdogService ←→ External Providers (Merolagani, NepseAlpha)
                    ↓
              Auto-Correction
```
The Watchdog service periodically verifies local data against external sources and applies auto-corrections when discrepancies are detected.

---

## Backend Architecture

### Components

```
backend/
├── src/
│   ├── server.js              # Express app entry
│   ├── routes/                # API endpoints
│   │   ├── stocks.js
│   │   ├── ipos.js
│   │   ├── market.js
│   │   └── watchdog.js        # Watchdog verification endpoints
│   ├── services/
│   │   ├── scrapers/          # Data fetchers
│   │   │   ├── libraryFetcher.js    # Primary NEPSE API
│   │   │   ├── proxyFetcher.js
│   │   │   ├── mockFetcher.js       # Testing/fallback
│   │   │   └── customScraper.js
│   │   ├── database/          # Storage operations
│   │   │   ├── localStorage.js      # JSON file storage
│   │   │   ├── connection.js        # Connection wrapper
│   │   │   ├── prismaClient.js      # Prisma ORM client
│   │   │   ├── stockOperations.js
│   │   │   ├── ipoOperations.js
│   │   │   └── marketOperations.js
│   │   ├── watchdog/          # Data verification service
│   │   │   ├── WatchdogService.js   # Main verification logic
│   │   │   └── providers/
│   │   │       ├── MerolaganiProvider.js
│   │   │       └── NepseAlphaProvider.js
│   │   ├── scheduler/         # Update scheduler
│   │   ├── analytics.js       # Market analytics
│   │   ├── dataFetcher.js     # Main data orchestrator
│   │   └── depthFetcher.js    # Market depth data
│   ├── utils/                 # Logging, errors
│   └── middleware/            # CORS, error handlers
├── prisma/                    # Prisma ORM
│   ├── schema.prisma          # Database schema
│   └── migrations/            # Database migrations
├── data/                      # JSON data files (fallback)
│   ├── stocks.json
│   ├── marketSummary.json
│   ├── marketHistory.json
│   └── ipos.json
└── logs/                      # Application logs
    └── watchdog_verification.json
```

### Data Fetching Strategy

```
Primary: Library Fetcher (nepse-api-helper)
    ↓ (on failure)
Fallback: Proxy Fetcher
    ↓ (on failure)
Fallback: Mock Fetcher (cached data)
    ↓ (on failure)
Retry with exponential backoff
```

### Watchdog Service

The Watchdog service ensures data integrity by:
1. **Verification**: Comparing local data with external sources (Merolagani, NepseAlpha)
2. **Auto-Correction**: Automatically fixing discrepancies when detected
3. **Stale Data Detection**: Warning when data is older than 24 hours on trading days
4. **Logging**: Maintaining verification reports for auditing

### Update Schedule

| Condition | Update Interval |
|-----------|-----------------|
| Market Open (10 AM - 3 PM NST) | 10 seconds |
| Market Closed | 1 hour |

**Trading Days:** Sunday to Thursday (Nepal trading week)

---

## Frontend Architecture

### Components

```
frontend/
├── src/
│   ├── App.jsx               # Routes + layout
│   ├── components/           # Reusable UI (35+ components)
│   │   ├── Header.jsx
│   │   ├── StockCard.jsx
│   │   ├── StockTable.jsx
│   │   ├── SectorChart.jsx
│   │   └── ...
│   ├── pages/                # Route pages
│   │   ├── HomePage.jsx
│   │   ├── StockDetailPage.jsx
│   │   ├── IPOPage.jsx
│   │   ├── TopMoversPage.jsx
│   │   └── SearchResultsPage.jsx
│   ├── hooks/                # Custom hooks
│   │   ├── useStocks.js
│   │   └── useIPOs.js
│   ├── services/
│   │   └── api.js            # REST API client
│   └── utils/                # Helpers
```

### Data Flow

```
User Action (Header Search) → App.jsx (State Change) → HomePage.jsx (Filter Update)
                                    ↓
SQLite/JSON ← Express Route ← API Request
                                    ↓
                               State Update → Re-render
```

---

## Data Storage

### Primary: SQLite (via Prisma ORM)

The application uses SQLite with Prisma ORM for structured data storage:

| Model | Description |
|-------|-------------|
| `Stock` | Stock symbols, prices, and metadata |
| `MarketHistory` | Historical price data per symbol |
| `MarketSummary` | NEPSE index and market statistics |
| `Ipo` | IPO listings and details |

### Fallback: JSON Files

Legacy JSON file storage in `backend/data/` for backward compatibility:
- `stocks.json` - All stock prices and details
- `marketSummary.json` - NEPSE index and market stats
- `marketHistory.json` - Historical index data
- `ipos.json` - IPO listings

### Write Strategy
- **Debounced saves**: Changes trigger saves after 2s delay (batches rapid updates)
- **Immediate saves**: Shutdown triggers immediate save
- **Write locks**: Prevent race conditions during concurrent writes
- **Transaction support**: Prisma handles database transactions for data integrity

---

## Security Considerations

1. **SSL Handling**: Custom HTTPS agent for NEPSE API (scoped, not global)
2. **Input Validation**: Stock symbols sanitized before storage
3. **Rate Limiting**: Update interval prevents API abuse
4. **CORS**: Configurable origin whitelist
5. **No Authentication Required**: Public data dashboard (removed Firebase auth)

---

## Deployment Architecture

The application is self-hosted with PM2 process management:

```
┌────────────────────────────────────────────────────┐
│                 Production Server                   │
│                                                    │
│  ┌──────────────┐  ┌──────────────┐               │
│  │   PM2        │  │   Express    │               │
│  │   (Process   │──│   Backend    │               │
│  │   Manager)   │  │   :5000      │               │
│  └──────────────┘  └──────────────┘               │
│                           │                        │
│                    ┌──────────────┐               │
│                    │   SQLite     │               │
│                    │   Database   │               │
│                    └──────────────┘               │
└────────────────────────────────────────────────────┘
                           │
                    (Port Forwarding or
                     Reverse Proxy)
                           │
                    ┌──────────────┐
                    │   Internet   │
                    │  nepse.me    │
                    └──────────────┘
```
