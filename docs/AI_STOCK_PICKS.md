# AI Stock Picks

> Rule-based stock scoring engine that surfaces the most promising NEPSE stocks using technical analysis.

**Location**: Displayed on the HomePage between the Trending Bar and All Stocks table.

---

## How It Works

Every stock with pre-computed metrics is scored **0–100** across 7 technical factors. The top picks are displayed as recommendation cards with plain-English reasoning.

### Scoring Breakdown (100 points total)

| Factor | Weight | What It Measures |
|--------|--------|-----------------|
| **Trend** | 20 pts | MA20/MA50 alignment, bullish/bearish trend, golden/death cross |
| **Momentum** | 20 pts | RSI-14 in healthy zone (40–65), positive ROC (10d, 30d) |
| **Price Position** | 15 pts | Distance from 52-week high (10–40% below = sweet spot), winning streaks |
| **Liquidity** | 15 pts | Liquidity score, volume spikes, average daily volume |
| **Sector Performance** | 10 pts | Outperformance vs sector average |
| **Signal Patterns** | 10 pts | Bullish momentum, volume breakout, post-bonus penalty |
| **Medium-Term** | 10 pts | Monthly price change, price vs MA180 |

### Score Tiers

| Score | Tier | Badge Color |
|-------|------|-------------|
| 75–100 | **Strong** | 🟢 Green |
| 60–74 | **Good** | 🔵 Blue |
| 45–59 | **Moderate** | 🟡 Yellow |
| 0–44 | **Neutral** | ⚪ Gray |

### Penalties

- **Post-bonus adjusted** stocks: −2 signal score (uncertain price action)
- **Low liquidity** stocks: −2 signal score (hard to trade)
- **Death cross** detected: −3 trend score
- **Consecutive down days** (3+): −3 price position score

---

## API

### `GET /api/stock-picks`

Returns AI-scored stock picks sorted by score (descending).

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 10 | Number of picks to return |

**Example**: `GET /api/stock-picks?limit=5`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "symbol": "NICA",
      "companyName": "NIC Asia Bank Ltd.",
      "sector": "Commercial Banks",
      "ltp": 366,
      "change": 21,
      "changePercent": 6.09,
      "volume": 250000,
      "score": 65,
      "scoreBreakdown": {
        "trend": 15,
        "momentum": 12,
        "pricePosition": 10,
        "liquidity": 10,
        "sector": 7,
        "signals": 6,
        "mediumTerm": 5
      },
      "reasons": [
        "Price is in an uptrend, trading above key averages",
        "About 15% below its highest price this year — room to grow"
      ]
    }
  ],
  "count": 5,
  "timestamp": "2026-03-21T18:00:00.000Z"
}
```

**Authentication**: Required — Must include valid Admin API Key or Bearer token (public access is disabled pending legal sign-off).
**Compliance**: *Endpoint restricted*. Requires explicit feature flag (`ENABLE_STOCK_PICKS=true`) set in the environment to protect against unapproved public dissemination of financial advice. Rate limiting and request logging/consent capture must be active.

---

## Architecture

```
Backend                                  Frontend
────────────────────                     ──────────────────
stockPicks.js                            AIPicks.jsx
  ├─ scoreTrend()                          ├─ Fetches /api/stock-picks
  ├─ scoreMomentum()                       ├─ Renders card grid
  ├─ scorePricePosition()                  ├─ Score badges (color-coded)
  ├─ scoreLiquidity()                      ├─ Reasoning bullets
  ├─ scoreSector()                         └─ Click → StockDetailPage
  ├─ scoreSignals()
  ├─ scoreMediumTerm()
  └─ buildReasons()          api.js
                               └─ getAIStockPicks()
market.js
  └─ GET /api/stock-picks    HomePage.jsx
                               └─ <AIPicks /> component
```

### Data Flow

1. **Metrics are pre-computed** by `metricsOrchestrator.js` during each data update cycle
2. **`stockPicks.js`** reads from `StockMetrics` + `Stock` tables (no external API calls)
3. **Scoring runs instantly** — no Gemini API, no rate limits, no quota
4. **Frontend** fetches top picks on page load and renders cards

---

## Files

| File | Purpose |
|------|---------|
| `backend/src/services/stockPicks.js` | Scoring engine + reason builder |
| `backend/src/routes/market.js` | API endpoint (`GET /api/stock-picks`) |
| `frontend/src/components/AIPicks.jsx` | Card grid component |
| `frontend/src/components/AIPicks.css` | Styles (gradient cards, badges, responsive) |
| `frontend/src/services/api.js` | `getAIStockPicks()` function |
| `frontend/src/pages/HomePage.jsx` | Integration point |

---

## Customization

### Change number of picks shown

In `AIPicks.jsx`, line 31:
```js
getAIStockPicks(8)  // Change 8 to desired count
```

### Adjust scoring weights

In `stockPicks.js`, modify the individual `score*()` functions. Each returns points within its weight cap (e.g., `scoreTrend` returns 0–20).

### Add new scoring factors

1. Add a new `scoreNewFactor()` function returning 0–N points
2. Include it in `scoreStock()` total
3. Add reasoning in `buildReasons()`
4. Update the score cap accordingly

---

*Feature added: 2026-03-21*  

# ⚠️ Legal & Compliance Disclaimer

> **[FLAGGED FOR LEGAL REVIEW: DO NOT PUBLISH WITHOUT SEBON COMPLIANCE APPROVAL]**

The stock recommendations ("AI Stock Picks") provided by this endpoint and application are for informational and educational purposes only and do not constitute financial, investment, or trading advice. 
- **No Guarantee of Accuracy or Returns**: We make no representations or warranties regarding the accuracy, completeness, or reliability of the AI-generated scores. Past performance is not indicative of future results.
- **Risk Warning**: Investing in securities involves significant risk, including the possible loss of principal. You should not make any financial decisions based solely on these automated technical analysis scores.
- **Consult a Professional**: We strongly recommend consulting with a licensed financial advisor or broker registered with the Securities Board of Nepal (SEBON) before executing any trades.
- **Limitation of Liability**: By using this service, you acknowledge and agree that the developers, operators, and affiliates of this application shall not be held liable for any financial losses, damages, or decisions made based on this information.
