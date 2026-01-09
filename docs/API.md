# API Reference

> Complete REST API documentation based on actual route implementations.
> Generated from: `backend/src/routes/*.js`

**Base URL**: `http://localhost:5000/api`

---

## Stocks (`/api/stocks`)

**Source**: `routes/stocks.js` (301 lines)

### GET /api/stocks
Get all stocks with pagination.

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `skip` | number | 0 | Records to skip |
| `limit` | number | 500 | Max records to return |
| `sortBy` | string | `symbol` | Field to sort by |
| `sortOrder` | string | `asc` | `asc` or `desc` |

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "symbol": "NABIL",
      "companyName": "Nabil Bank Limited",
      "sector": "Commercial Banks",
      "ltp": 1250.00,
      "lastTradedPrice": 1250.00,
      "previousClose": 1245.00,
      "openPrice": 1248.00,
      "highPrice": 1255.00,
      "lowPrice": 1240.00,
      "volume": 15000,
      "totalTrades": 250,
      "turnover": 18750000,
      "change": 5.00,
      "changePercent": 0.40,
      "percentageChange": 0.40,
      "prices": { "ltp": 1250.00, "change": 5.00, "changePercent": 0.40 },
      "trading": { "volume": 15000, "turnover": 18750000, "totalTrades": 250 },
      "updatedAt": "2026-01-09T08:30:00.000Z"
    }
  ],
  "count": 270,
  "pagination": { "skip": 0, "limit": 500, "total": 270 }
}
```

---

### GET /api/stocks/search
Search stocks by symbol or company name.

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query (min 1 char) |

**Response**:
```json
{
  "success": true,
  "data": [...],
  "count": 5,
  "query": "bank"
}
```

---

### GET /api/stocks/sectors
Get all available sectors.

**Response**:
```json
{
  "success": true,
  "data": ["Commercial Banks", "Development Banks", "Finance", "Hydropower", ...],
  "count": 13
}
```

---

### GET /api/stocks/top-gainers
Get stocks with highest positive change.

**Query Parameters**:
| Parameter | Type | Default |
|-----------|------|---------|
| `limit` | number | 10 |

---

### GET /api/stocks/top-losers
Get stocks with highest negative change.

---

### GET /api/stocks/top-traded
Get stocks with highest volume/turnover.

---

### GET /api/stocks/unchanged
Get stocks with zero change.

---

### GET /api/stocks/sector/:sector
Get stocks by sector name.

---

### GET /api/stocks/recent
Get recently updated stocks.

**Query Parameters**:
| Parameter | Type | Default |
|-----------|------|---------|
| `seconds` | number | 30 |

---

### GET /api/stocks/:symbol
Get specific stock by symbol.

**Example**: `GET /api/stocks/NABIL`

**Response**:
```json
{
  "success": true,
  "data": { "symbol": "NABIL", "companyName": "...", ... }
}
```

**Note**: Records a view for analytics/trending calculation.

---

### GET /api/stocks/:symbol/depth
Get market depth (Level 2) data for a stock.

**Response Example**:
```json
{
  "success": true,
  "symbol": "NABIL",
  "data": {
    "bids": [...],
    "asks": [...],
    "floorsheet": [...]
  }
}
```

---

### POST /api/stocks/admin/cleanup
Delete inactive stocks (LTP = 0 or null).

**Response**:
```json
{
  "success": true,
  "message": "Inactive stocks cleanup completed",
  "removed": 15,
  "remaining": 255
}
```

**⚠️ Not Protected**: Requires authentication implementation.

---

### POST /api/stocks/admin/validate
Remove stocks not in official NEPSE list.

Fetches valid symbols from NEPSE API and removes any that don't match.

**Response**:
```json
{
  "success": true,
  "message": "Stock validation completed",
  "validNepseStocks": 270,
  "removed": 5,
  "remaining": 265,
  "removedSymbols": []
}
```

---

## Market (`/api`)

**Source**: `routes/market.js` (379 lines)

### GET /api/market-summary
Get current market summary.

**Response**:
```json
{
  "success": true,
  "data": {
    "indexValue": 2450.75,
    "indexChange": 12.50,
    "indexChangePercent": 0.51,
    "totalTurnover": 2500000000,
    "totalVolume": 5000000,
    "totalTransactions": 25000,
    "activeCompanies": 270,
    "advancedCompanies": 120,
    "declinedCompanies": 100,
    "unchangedCompanies": 50,
    "timestamp": "2026-01-09T08:30:00.000Z"
  }
}
```

---

### GET /api/market-history
Get market summary history.

**Query Parameters**:
| Parameter | Type | Default |
|-----------|------|---------|
| `hours` | number | 24 |

---

### GET /api/market-stats
Get aggregated market statistics.

---

### GET /api/health
Server health check with comprehensive status.

**Response**:
```json
{
  "success": true,
  "status": "healthy",
  "data": {
    "uptime": "2d 5h 30m",
    "uptimeSeconds": 192600,
    "marketState": "CLOSED",
    "lastUpdate": "2026-01-09T08:25:00.000Z",
    "schedulerRunning": true,
    "dataSource": "nepse-api-helper",
    "stockCount": 270,
    "hasMarketData": true,
    "isHealthy": true
  }
}
```

---

### GET /api/health/extended
Extended health metrics for monitoring.

---

### GET /api/scheduler-status
Get detailed scheduler status.

**Response**:
```json
{
  "success": true,
  "data": {
    "isRunning": true,
    "isMarketOpen": false,
    "lastUpdateTime": "2026-01-09T08:25:00.000Z",
    "updateCount": 150,
    "lastError": null,
    "currentNST": "2026-01-09T08:30:00.000Z",
    "marketHours": { "open": "10:00", "close": "15:00" },
    "dataSource": "nepse-api-helper"
  }
}
```

---

### GET /api/time-sync-status
Get time synchronization status.

**Response**:
```json
{
  "success": true,
  "data": {
    "synced": true,
    "lastSyncAge": "45s ago",
    "offsetMs": -2500,
    "offsetSeconds": -3,
    "nepseTime": "08:30:15",
    "nepseDay": "Thursday",
    "marketState": "CLOSED",
    "comparison": {
      "systemTime": "08:30:12",
      "offsetApplied": "-3s"
    }
  }
}
```

---

### GET /api/trending
Get trending stocks based on user activity.

**Query Parameters**:
| Parameter | Type | Default |
|-----------|------|---------|
| `limit` | number | 6 |

**Response**:
```json
{
  "success": true,
  "data": [
    { "symbol": "NABIL", "views": 50, "searches": 25, "score": 100, "stock": {...} }
  ],
  "count": 6
}
```

---

### POST /api/force-update
Force an immediate data refresh.

**Response**:
```json
{
  "success": true,
  "message": "Update triggered successfully",
  "timestamp": "2026-01-09T08:30:00.000Z"
}
```

---

### POST /api/sync-market-data
Sync market data from web scraping.

---

### GET /api/scrape-live
Scrape live market data without saving.

Returns raw scraped data from Merolagani for debugging.

---

## IPOs (`/api/ipos`)

**Source**: `routes/ipos.js` (137 lines)

### GET /api/ipos
Get all IPOs with optional filters.

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `skip` | number | 0 | Pagination offset |
| `limit` | number | 100 | Max records |
| `status` | string | null | Filter by status |

**Response**:
```json
{
  "success": true,
  "data": [...],
  "count": 10,
  "statistics": { "upcoming": 2, "open": 1, "closed": 5, "completed": 2 }
}
```

---

### GET /api/ipos/active
Get currently active/open IPOs.

---

### GET /api/ipos/search
Search IPOs by company name.

---

### GET /api/ipos/counts
Get IPO counts by status.

---

### GET /api/ipos/status/:status
Get IPOs by status.

**Valid Statuses**: `upcoming`, `open`, `closed`, `completed`

---

### GET /api/ipos/:companyName
Get specific IPO by company name.

---

## Watchdog (`/api/watchdog`)

**Source**: `routes/watchdog.js` (40 lines)

### POST /api/watchdog/verify
Trigger a manual data verification.

Compares local database with external sources (Merolagani, NepseAlpha) and auto-corrects discrepancies.

**Response**:
```json
{
  "success": true,
  "data": {
    "timestamp": "2026-01-09T08:30:00.000Z",
    "status": "OK",
    "discrepancies": [],
    "correctionApplied": false,
    "local": {...},
    "external": [...]
  }
}
```

---

### GET /api/watchdog/reports
Get historical verification reports.

Returns last 50 verification reports from `logs/watchdog_verification.json`.

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": {
    "message": "Stock with symbol 'XYZ' not found"
  }
}
```

**HTTP Status Codes**:
| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request (invalid parameters) |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## Rate Limiting

**Current Status**: ⚠️ NOT IMPLEMENTED

Recommendation: Add `express-rate-limit` middleware:
```javascript
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per window
});
app.use('/api/', limiter);
```

---

*Generated from actual route implementations on 2026-01-09*
