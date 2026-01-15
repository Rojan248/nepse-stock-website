# State of the Project

> Comprehensive status report based on actual codebase analysis.
> Generated: 2026-01-09

---

## 1. Project Identity

| Field | Value |
|-------|-------|
| **Name** | NEPSE Stock Website |
| **Repository** | `Rojan248/nepse-stock-website` |
| **Current Branch** | `master` |
| **Latest Commit** | `4281114` - "feat: Enhance market summary, fix sector chart, and add EOD snapshot" |
| **License** | MIT |

---

## 2. Git History (Last 10 Commits)

```
4281114 feat: Enhance market summary, fix sector chart, and add EOD snapshot
19b33a8 Cleanup and Optimization: Remove Cloudflare, optimize scraper, stop tracking dev.db
0cff41d Fix Market Structure chart aesthetic: Update black bars to premium blue gradient
3fa8805 Add watchdog service and monitoring infrastructure
97ec6d7 chore: remove cloudflare integration and update documentation
91972f8 feat: implement market depth, floorsheet, and trending stocks system
3c5b550 UI Fix: Implement custom dropdown for alignment and overflow fixes
7b0ff89 Final Polish: Remove old dark theme meta tag, fix UI assets
05b6f6b chore: remove stale dist folder from git
9ff0126 feat: Global Upgrade & Trending Stocks Intelligence System
```

---

## 3. Version Information

| Component | Version | Last Updated |
|-----------|---------|--------------|
| **Backend** | 1.0.0 | 2026-01-09 |
| **Frontend** | 1.0.0 | 2026-01-09 |
| **Prisma** | 5.14.0 | 2026-01-09 |
| **Node.js Required** | 18+ | - |

### Backend Dependencies
```json
{
  "@prisma/client": "^5.14.0",
  "axios": "^1.6.2",
  "cheerio": "^1.1.2",
  "cors": "^2.8.5",
  "dotenv": "^16.3.1",
  "express": "^4.18.2",
  "nepse-api-helper": "^2.6.0",
  "node-cron": "^3.0.3",
  "node-schedule": "^2.1.1",
  "winston": "^3.11.0"
}
```

### Frontend Dependencies
```json
{
  "axios": "^1.6.2",
  "lucide-react": "^0.562.0",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.21.1",
  "recharts": "^3.6.0"
}
```

---

## 4. Codebase Statistics

### File Counts
| Directory | Files | Total Size |
|-----------|-------|------------|
| `backend/src/` | 31 files | ~150 KB |
| `backend/scripts/` | 52 files | ~80 KB |
| `frontend/src/` | 55 files | ~180 KB |
| **Total Source** | ~140 files | ~410 KB |

### Key File Sizes
| File | Lines | Bytes | Purpose |
|------|-------|-------|---------|
| `dataFetcher.js` | 841 | 33,360 | Core orchestrator |
| `localStorage.js` | 600+ | 24,908 | Legacy fallback storage |
| `libraryFetcher.js` | 519 | 19,452 | NEPSE API wrapper |
| `stockOperations.js` | 481 | 16,717 | Database CRUD |
| `HomePage.jsx` | 482 | 22,176 | Main frontend page |
| `StockTable.jsx` | 400+ | 17,285 | Data table component |

---

## 5. Feature Status

### ✅ Fully Implemented

| Feature | Location | Notes |
|---------|----------|-------|
| **Stock Dashboard** | `HomePage.jsx` | Real-time table with all ~270 stocks |
| **Market Summary** | `routes/market.js` | NEPSE Index, turnover, volume, breadth |
| **Sector Chart** | `SectorChart.jsx` | Recharts bar chart with gradient styling |
| **Top Movers** | `TopMoversPage.jsx` | Gainers, losers, most traded |
| **Global Search** | `SearchBar.jsx` | Autocomplete across all stocks |
| **Favorites/Watchlist** | `useLocalStorage.js` | Browser localStorage persistence |
| **IPO Listings** | `IPOPage.jsx` | Status filtering (upcoming, open, closed) |
| **Stock Detail** | `StockDetailPage.jsx` | Individual stock view |
| **Market Depth** | `depthFetcher.js` | Level 2 order book data |
| **Trending Stocks** | `analytics.js` | Views + searches with decay |
| **Watchdog Service** | `WatchdogService.js` | Auto-corrects zero data |
| **Time Sync** | `marketTime.js` | External Nepal time sync |
| **EOD Snapshot** | `snapshotDailyMarket()` | Historical data capture |

### 🟡 Partial/Needs Improvement

| Feature | Status | Details |
|---------|--------|---------|
| **0 stocks null LTP** | Resolved | All active stocks have valid price data |
| **Price History Charts** | Data exists | `MarketHistory` model populated, charts not built |
| **Admin UI** | Endpoints Protected | `/api/stocks/admin/*` protected by Key, no dashboard UI |
| **HTTPS** | External | Must configure nginx/reverse proxy |

### 🔴 Not Implemented

| Feature | Notes |
|---------|-------|
| **User Authentication** | By design - public dashboard |
| **Email Alerts** | Not planned |
| **Mobile App** | Not planned |
| **Watchlist Sync** | Currently localStorage only |

---

## 6. Database Status

### Schema Models
| Model | Records | Status |
|-------|---------|--------|
| **Stock** | ~396 | Active (includes inactive symbols) |
| **MarketHistory** | ~284 | Growing daily |
| **MarketSummary** | Variable | Latest used, old cleaned |
| **Ipo** | 0 | No IPO data populated |

### Migrations Applied
1. `20260102061535_init` - Initial schema
2. `20260109024021_update_market_summary` - Added index fields

### Data Quality Issues
- **~100 stocks with null LTP**: These are inactive/suspended stocks or new listings without trading activity
- **Breadth occasionally zero**: Watchdog auto-corrects from previous trading day

---

## 7. Scheduler Status

| Scheduler | Interval | Condition |
|-----------|----------|-----------|
| **Stock Update** | 10 seconds | Market OPEN (10:00-15:00 NST, Sun-Thu) |
| **Stock Update** | 1 hour | Market CLOSED |
| **Watchdog Verification** | 10 minutes | Always |
| **Daily Cleanup** | Midnight | Always (removes old summaries) |
| **Analytics Decay** | 1 hour | Always (10% score reduction) |

---

## 8. External Dependencies Status

| Service | Purpose | Risk |
|---------|---------|------|
| **NEPSE Official API** | Primary data source | Rate limits possible |
| **NepAlpha** | Fallback data | May change API structure |
| **ShareSansar** | Fallback data | May change API structure |
| **Merolagani** | Watchdog verification | HTML scraping fragile |
| **WorldTimeAPI** | Nepal time sync | May have downtime |
| **TimeAPI.io** | Nepal time sync | Fallback for WorldTimeAPI |

---

## 9. Known Technical Debt

### High Priority
1. **Missing Indices** - Market Summary only showing 4/17 indices

### Medium Priority
2. **Legacy localStorage.js** (25KB) - Still exists as fallback, could be removed
3. **No TypeScript** - Entire codebase is JavaScript
5. **Frontend npm audit warnings** - 7 vulnerabilities in dev dependencies

### Low Priority
6. **Hardcoded sector IDs** - In `libraryFetcher.js` lines 29-45
7. **Debug console.log statements** - In `HomePage.jsx`

---

## 10. Test Coverage

### Backend
- **Framework**: Jest + Supertest
- **Location**: `backend/tests/`
- **Coverage**: Unit tests exist, integration tests partial

### Frontend
- **Framework**: Vitest + Testing Library
- **Location**: `frontend/tests/`
- **Coverage**: Basic setup, needs expansion

---

## 11. Deployment Notes

### Development
```bash
# Backend
cd backend && npm run dev  # Port 5000

# Frontend
cd frontend && npm run dev  # Port 3000 (proxies to 5000)
```

### Production
```bash
# Build frontend
cd frontend && npm run build

# Start backend with PM2
cd backend && npm run pm2:start

# Backend serves frontend/dist on port 5000
```

### Required Environment Variables
```env
# backend/.env
PORT=5000
NODE_ENV=production
DATABASE_URL="file:./prisma/dev.db"
NEPSE_UPDATE_INTERVAL=10000  # Optional, default 10s
```

---

## 12. Recommended Next Steps

### Immediate (Security)
1. Add `express-rate-limit` middleware
2. Protect admin endpoints with API key
3. Restrict CORS to production domain only

### Short-term (Data Quality)
4. Investigate null LTP stocks - run `node scripts/auditData.js`
5. Implement proper error handling for Watchdog failures

### Medium-term (Features)
6. Build price history charts using `MarketHistory` data
7. Add admin dashboard UI
8. Implement server-side watchlist sync

### Long-term (Architecture)
9. Consider migrating to TypeScript
10. Add Redis for caching frequently accessed data
11. Set up external monitoring (UptimeRobot, etc.)

---

## 13. Project File Structure Summary

```
nepse-stock-website/
├── backend/                    # 108 files
│   ├── prisma/                 # Database schema + migrations
│   ├── scripts/                # 52 utility scripts
│   ├── src/                    # 31 source files
│   └── tests/                  # 7 test files
│
├── frontend/                   # 62 files
│   ├── src/                    # 55 source files
│   └── tests/                  # 3 test files
│
├── docs/                       # 6 documentation files
├── scripts/                    # 3 root-level scripts
├── ARCHITECTURE.md             # Legacy root doc (21KB)
├── README.md                   # Project readme (6KB)
└── package.json                # Root package (workspace orchestration)
```

---

*Document generated from comprehensive codebase analysis on 2026-01-09*
