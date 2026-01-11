# NEPSE Watchdog Service - Technical Documentation

## Overview

The **Watchdog Service** is an autonomous data integrity monitor that ensures the accuracy of your NEPSE stock data by cross-referencing it against external sources.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        WATCHDOG SERVICE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────────┐                     ┌──────────────────┐    │
│   │  Local DB    │ ◄─── Compare ───►   │  External APIs   │    │
│   │  (Prisma)    │                     │  • Merolagani    │    │
│   └──────────────┘                     │  • NepseAlpha    │    │
│          │                             └──────────────────┘    │
│          ▼                                                      │
│   ┌──────────────┐        ┌─────────────────────────┐          │
│   │ Generate     │ ───►   │  Status Report          │          │
│   │ Report       │        │  OK / WARNING / CRITICAL│          │
│   └──────────────┘        └─────────────────────────┘          │
│          │                                                      │
│          ▼                                                      │
│   ┌──────────────────────────────────────────┐                 │
│   │  Auto-Correction (if issues detected)    │                 │
│   │  • Restore previous day's breadth data   │                 │
│   │  • Uses mutex lock to prevent conflicts  │                 │
│   └──────────────────────────────────────────┘                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## How It Works

### 1. Verification Cycle (Runs Every 10 Minutes)

```javascript
// Triggered by scheduler or manually via API
await watchdogService.verify();
```

**Steps:**
1. **Fetch Local Data** - Get latest market summary from SQLite database
2. **Fetch External Data** - Query Merolagani and NepseAlpha for their market data
3. **Compare** - Check if local data matches external sources (within 1% tolerance)
4. **Auto-Correct** - If issues found, attempt automatic fix
5. **Log** - Save report to `logs/watchdog_verification.json`

### 2. External Data Providers

| Provider | What It Fetches | How |
|----------|-----------------|-----|
| **Merolagani** | Total Turnover, Transactions | Regex parsing of HTML |
| **NepseAlpha** | Market summary (fallback) | API/scraping |

### 3. Discrepancy Detection

The watchdog flags issues when:
- Local turnover differs from Merolagani by **>1%**
- Local transactions differ from Merolagani by **>1%**
- Local breadth is **zeroed out** (0 advanced, 0 declined)
- Data is **stale** (>24 hours old on a trading day)

### 4. Auto-Correction Logic

When the watchdog detects **zeroed breadth data** (common after market close when live feed resets):

```javascript
// Automatically fetches previous trading day's data
const previousData = await dataFetcher.fetchPreviousTradingDayData();

// Updates the market summary with correct values
await prisma.marketSummary.update({
    data: {
        advancedCompanies: previousData.advanced,
        declinedCompanies: previousData.declined,
        unchangedCompanies: previousData.unchanged
    }
});
```

---

## Mutex Lock System

To prevent the **Scheduler** and **Watchdog** from overwriting each other's data:

```
Watchdog starts correction
        │
        ▼
┌───────────────────┐
│  acquireLock()    │ ◄── 60-second lock
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Correct data     │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  releaseLock()    │
└───────────────────┘
        │
        ▼
Scheduler can resume
```

If the Scheduler tries to update while Watchdog has the lock, it **skips that cycle**.

---

## Report Status Levels

| Status | Meaning | Action Taken |
|--------|---------|--------------|
| **OK** | All data matches external sources | None |
| **WARNING** | Minor discrepancy or stale data | Logged for review |
| **CRITICAL** | No local data or major mismatch | Auto-correction attempted |

---

## API Endpoints

### Manual Trigger
```http
POST /api/watchdog/verify
Headers: x-admin-key: <your-key>
```

### View Reports
```http
GET /api/watchdog/reports
Headers: x-admin-key: <your-key>
```

Returns the last 50 verification reports.

---

## File Structure

```
backend/src/services/watchdog/
├── WatchdogService.js        # Main service class
└── providers/
    ├── MerolaganiProvider.js # Scrapes merolagani.com
    └── NepseAlphaProvider.js # Scrapes nepsealpha.com

backend/logs/
└── watchdog_verification.json  # Report history (last 50)
```

---

## Configuration

The watchdog runs automatically via the scheduler:

```javascript
// In updateScheduler.js
schedule.scheduleJob('*/10 * * * *', async () => {
    await watchdogService.verify();
});
```

This runs **every 10 minutes**, 24/7.

---

## Example Report

```json
{
  "timestamp": "2026-01-11T07:45:00.000Z",
  "status": "OK",
  "discrepancies": [],
  "local": {
    "source": "Local Database",
    "data": {
      "nepseIndex": 2620.92,
      "totalTurnover": 5234567890,
      "totalTransactions": 45678,
      "breadth": {
        "advanced": 150,
        "declined": 80,
        "unchanged": 31
      }
    }
  },
  "external": [
    {
      "source": "Merolagani",
      "data": {
        "totalTurnover": 5234567890,
        "totalTransactions": 45678
      }
    }
  ],
  "correctionApplied": false
}
```

---

## Why This Matters

The NEPSE live data feed often **resets to zeros** after market close. Without the watchdog:
- Users would see "0 gainers, 0 losers" instead of the actual closing data
- Market breadth charts would be useless

The watchdog **automatically restores** the last valid trading day's data, ensuring your website always shows meaningful information.
