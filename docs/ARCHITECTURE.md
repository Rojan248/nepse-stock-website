# System Architecture

Technical architecture documentation for the NEPSE Stock Website.

## Overview

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   React App     │ ──── │  Express API    │ ──── │   Firestore     │
│   (Frontend)    │      │   (Backend)     │      │   (Database)    │
└─────────────────┘      └─────────────────┘      └─────────────────┘
        │                        │
        │ (optional)             │
        └────────────────────────┴───────────────┐
                                                 ↓
                                          ┌─────────────┐
                                          │   NEPSE     │
                                          │   Data      │
                                          └─────────────┘
```

---

## Data Flow Paths

### Primary Path (REST API)
```
NEPSE → Backend Scraper → Firestore → Express API → React App
```
This is the main data flow. The backend scrapes NEPSE data every 8 seconds during market hours, saves to Firestore, and the React frontend queries via REST API.

### Optional Path (Direct Firestore)
```
React App → Firebase Client SDK → Firestore (read-only)
```
For experimental real-time subscriptions, the frontend can read directly from Firestore using the optional `firestoreClient.js` service.

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
│   │   │   ├── libraryFetcher.js
│   │   │   ├── proxyFetcher.js
│   │   │   └── customScraper.js
│   │   ├── database/          # Firestore operations
│   │   │   ├── firebase.js          # Firebase Admin SDK
│   │   │   ├── connection.js        # Connection wrapper
│   │   │   ├── stockOperations.js
│   │   │   ├── ipoOperations.js
│   │   │   └── marketOperations.js
│   │   ├── scheduler/         # Update scheduler
│   │   └── utils/             # Logging, errors
│   └── middleware/            # CORS, error handlers
```

### Data Fetching Strategy

```
Primary: Library Fetcher
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
| Market Open (10 AM - 3 PM NST) | 8 seconds |
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
│   ├── firebase/             # Firebase client (optional)
│   │   └── clientApp.js
│   ├── services/
│   │   ├── api.js            # REST API client (primary)
│   │   └── firestoreClient.js # Direct Firestore (optional)
│   └── utils/                # Helpers
```

### Data Flow

```
User Action → React Component → Custom Hook → API Service
                                    ↓
Firestore ← Express Route ← API Request
                                    ↓
                              State Update → Re-render
```

### Optional: Real-time Subscriptions

```
React Component → firestoreClient.js → Firestore (onSnapshot)
                        ↓
                  State Update → Re-render
```

---

## Database Schema (Firestore)

### stocks (collection)
Document ID: Stock symbol (e.g., "NABIL")
```javascript
{
  symbol: String,
  companyName: String,
  sector: String,
  prices: { open, high, low, close, ltp },
  change: Number,
  changePercent: Number,
  volume: Number,
  timestamp: String (ISO)
}
```

### ipos (collection)
Document ID: Company name (sanitized)
```javascript
{
  companyName: String,
  sector: String,
  status: 'upcoming' | 'open' | 'closed' | 'completed',
  priceRange: { min, max },
  dates: { announcement, open, close, result },
  subscriptionRatio: Number
}
```

### marketSummary (collection)
Document ID: "current"
```javascript
{
  indexValue: Number,
  indexChange: Number,
  totalTransactions: Number,
  totalTurnover: Number,
  timestamp: String (ISO)
}
```

---

## Deployment Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Vercel    │     │   Render    │     │  Firebase   │
│  (Frontend) │ ──► │  (Backend)  │ ──► │  Firestore  │
└─────────────┘     └─────────────┘     └─────────────┘
        │                                      ↑
        └──────────────(optional)──────────────┘
```

---

## Performance Considerations

- **Database**: Firestore indexes on queried fields
- **API**: Response compression, caching headers
- **Frontend**: Code splitting, lazy loading routes
- **Data**: Batch writes for bulk operations
- **Real-time**: Optional Firestore subscriptions for instant updates
