# System Architecture

Technical architecture documentation for the NEPSE Stock Website.

## Project Overview

The system is designed as a lightweight, high-performance financial terminal. It uses a Node.js backend to scrape and serve NEPSE data and a React frontend to provide a Stark Minimalism user interface.

## Overview

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   React App     │ ──── │  Express API    │ ──── │  Local JSON     │
│   (Frontend)    │      │   (Backend)     │      │  Storage        │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                 │
                                 ↓
                          ┌─────────────┐
                          │   NEPSE     │
                          │   API       │
                          └─────────────┘
```

---

## Data Flow

### Primary Path (REST API)
```
NEPSE API → Backend Scraper → Local JSON → Express API → React App (Root State)
```
The backend fetches NEPSE data every 10 seconds during market hours, saves to local JSON files, and the React frontend queries via REST API. Search state is managed at the root `App.jsx` level to sync the Header search bar with the HomePage table filters.

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
│   │   └── market.js
│   ├── services/
│   │   ├── scrapers/          # Data fetchers
│   │   │   ├── libraryFetcher.js    # Primary NEPSE API
│   │   │   ├── proxyFetcher.js
│   │   │   └── customScraper.js
│   │   ├── database/          # Storage operations
│   │   │   ├── localStorage.js      # JSON file storage
│   │   │   ├── connection.js        # Connection wrapper
│   │   │   ├── stockOperations.js
│   │   │   ├── ipoOperations.js
│   │   │   └── marketOperations.js
│   │   ├── scheduler/         # Update scheduler
│   │   └── utils/             # Logging, errors
│   └── middleware/            # CORS, error handlers
├── data/                      # JSON data files
│   ├── stocks.json
│   ├── marketSummary.json
│   ├── marketHistory.json
│   └── ipos.json
```

### Data Fetching Strategy

```
Primary: Library Fetcher (nepse-api-helper)
    ↓ (on failure)
Fallback: Proxy Fetcher
    ↓ (on failure)
Fallback: Custom Scraper
    ↓ (on failure)
Retry with exponential backoff
```

### Update Schedule

| Condition | Update Interval |
|-----------|-----------------|
| Market Open (10 AM - 3 PM NST) | 10 seconds |
| Market Closed | 1 hour |

---

## Frontend Architecture

### Components

```
frontend/
├── src/
│   ├── App.jsx               # Routes + layout
│   ├── components/           # Reusable UI
│   │   ├── Header.jsx
│   │   ├── StockCard.jsx
│   │   ├── StockTable.jsx
│   │   └── ...
│   ├── pages/                # Route pages
│   │   ├── HomePage.jsx
│   │   ├── StockDetailPage.jsx
│   │   ├── IPOPage.jsx
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
Local JSON ← Express Route ← API Request
                                    ↓
                               State Update → Re-render
```

---

## Data Schema

### stocks.json
```javascript
{
  "NABIL": {
    symbol: String,
    companyName: String,
    sector: String,
    prices: { open, high, low, close, ltp },
    change: Number,
    changePercent: Number,
    volume: Number,
    turnover: Number,
    previousClose: Number,
    timestamp: ISO Date String
  }
}
```

### marketSummary.json
```javascript
{
  indexValue: Number,
  indexChange: Number,
  indexChangePercent: Number,
  totalTurnover: Number,
  totalVolume: Number,
  totalTransactions: Number,
  advancedCompanies: Number,
  declinedCompanies: Number,
  unchangedCompanies: Number,
  timestamp: ISO Date String
}
```

---

## Data Persistence

### Write Strategy
- **Debounced saves**: Changes trigger saves after 2s delay (batches rapid updates)
- **Immediate saves**: Shutdown triggers immediate save
- **Write locks**: Prevent race conditions during concurrent writes

---

## Security Considerations

1. **SSL Handling**: Custom HTTPS agent for NEPSE API (scoped, not global)
2. **Input Validation**: Stock symbols sanitized before storage
3. **Rate Limiting**: Update interval prevents API abuse
4. **CORS**: Configurable origin whitelist
