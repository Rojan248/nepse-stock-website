# Data Directory

This directory contains local JSON storage files for the NEPSE stock website.

## Files

| File | Description |
|------|-------------|
| `stocks.json` | All stock data fetched from NEPSE API |
| `marketSummary.json` | Current market summary/index data |
| `marketHistory.json` | Historical market summary records |
| `ipos.json` | IPO (Initial Public Offering) data |

## Data Notes

### `totalMarketCap: 0` in Market Data

The `totalMarketCap` field is set to `0` because:

1. **API Limitation**: The NEPSE API market summary endpoint does not provide total market capitalization data
2. **Calculation Not Feasible**: Calculating market cap requires `shares outstanding × current price` for every listed company, which would require additional API calls and data that isn't readily available
3. **Placeholder Value**: The `0` serves as a placeholder indicating "not available" rather than actual zero market cap

If NEPSE adds market cap to their API in the future, this field will be populated automatically.

### Data Persistence

- Data is saved with debouncing (2-second delay) to reduce disk writes
- Immediate saves occur on shutdown (SIGINT/SIGTERM)
- Files are loaded into memory on startup for fast access

### File Format

All files are pretty-printed JSON with 2-space indentation and POSIX-compliant trailing newlines.
