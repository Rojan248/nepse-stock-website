# NEPSE API Documentation

## Base URL

**Development:** `http://localhost:5000/api`  
**Production:** `https://your-api-domain.com/api`

## Response Format

All endpoints return JSON with this structure:

```json
{
  "success": true,
  "data": { ... },
  "count": 100
}
```

Error responses:
```json
{
  "success": false,
  "error": {
    "code": 404,
    "message": "Resource not found"
  }
}
```

---

## Stock Endpoints

### GET /api/stocks
Get all stocks with pagination.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| skip | number | 0 | Records to skip |
| limit | number | 500 | Max records to return |
| sortBy | string | symbol | Sort field |
| sortOrder | string | asc | Sort direction (asc/desc) |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "symbol": "NABIL",
      "companyName": "Nabil Bank Limited",
      "sector": "Commercial Banks",
      "prices": {
        "open": 1200,
        "high": 1250,
        "low": 1180,
        "close": 1230,
        "ltp": 1230
      },
      "change": 30,
      "changePercent": 2.5,
      "volume": 50000
    }
  ],
  "count": 250
}
```

---

### GET /api/stocks/:symbol
Get single stock by symbol.

**Response:** Single stock object or 404.

---

### GET /api/stocks/search
Search stocks by symbol or company name.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| q | string | Yes | Search query |

---

### GET /api/stocks/sector/:sector
Get stocks by sector.

---

### GET /api/stocks/top-gainers
Get top gaining stocks.

| Parameter | Type | Default |
|-----------|------|---------|
| limit | number | 10 |

---

### GET /api/stocks/top-losers
Get top losing stocks.

---

## IPO Endpoints

### GET /api/ipos
Get all IPOs with optional status filter.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter: upcoming, open, closed, completed |

---

### GET /api/ipos/active
Get currently open IPOs.

---

### GET /api/ipos/status/:status
Get IPOs by specific status.

---

### GET /api/ipos/:companyName
Get single IPO by company name.

---

## Market Endpoints

### GET /api/market-summary
Get latest NEPSE market summary.

**Response:**
```json
{
  "success": true,
  "data": {
    "indexValue": 2500.50,
    "indexChange": 25.30,
    "indexChangePercent": 1.02,
    "totalTransactions": 50000,
    "totalTurnover": 5000000000,
    "advancedCompanies": 120,
    "declinedCompanies": 60
  }
}
```

---

### GET /api/health
Server health check.

**Response:**
```json
{
  "success": true,
  "status": "running",
  "server": {
    "uptime": 3600,
    "environment": "production"
  },
  "market": {
    "isOpen": true
  },
  "data": {
    "source": "proxy",
    "stockCount": 250
  }
}
```

---

## Rate Limiting

No rate limiting implemented. For production, consider adding:
- 100 requests/minute per IP
- 1000 requests/hour per IP

## Error Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request |
| 404 | Not Found |
| 500 | Server Error |
| 503 | Service Unavailable |
