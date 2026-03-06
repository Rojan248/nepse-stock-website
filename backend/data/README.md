# Data Directory

Legacy JSON storage files. The primary data store is **SQLite via Prisma ORM** (`prisma/dev.db`).

These JSON files serve as fallback storage and are gitignored.

## Files

| File | Description |
|------|-------------|
| `stocks.json` | All stock data fetched from NEPSE API |
| `marketSummary.json` | Current market summary/index data |
| `marketHistory.json` | Historical market summary records |
| `ipos.json` | IPO listings |
| `topMovers.json` | Cached top gainers/losers/volume lists |
