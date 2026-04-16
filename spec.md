# NEPSE Stock Platform MVP Specification (V1.0.0-MVP)

## 1. Project Overview
The NEPSE Stock Platform is a comprehensive stock analysis and portfolio management system for the Nepal Stock Exchange. It provides high-frequency data updates, technical metrics, interactive charting, and real-time price alerts without relying on brittle HTML scraping for its core pipeline.

## 2. Core Architecture
- **Backend:** Node.js Express API.
- **Database:** Prisma ORM with SQLite (persistent file-based storage).
- **Frontend:** React + Vite (Single Page Application).
- **Communication:** RESTful JSON API with JWT Authentication.

## 3. Data Pipeline & Harvesting
The platform utilizes a robust fallback strategy to ensure data availability:
1. **Mock Fetcher:** Used for development and testing environments.
2. **Library Fetcher (`nepse-api-helper`):** Primary production source using NEPSE's React-app JSON endpoints.
3. **Proxy Fetcher:** Secondary source for resilience.
4. **Custom Scraper:** Emergency fallback using regex-based extraction to avoid brittle DOM dependencies.
5. **Enrichment:** Data is automatically normalized and enriched with company names and metadata from a local JSON registry (`nepseStocks.json`).

## 4. Technical Metrics Engine
Computed asynchronously after every successful data sync:
- **Moving Averages:** MA20, MA50, MA120 (External), MA180 (External).
- **Indicators:** RSI (Relative Strength Index).
- **Relative Performance:** Comparison against Sector Average and Market Performance.
- **Liquidity & Volume:** 30-day average volume and turnover metrics.

## 5. Portfolio & P&L Logic
- **Precision:** All financial calculations utilize `@prisma/client.Decimal` to prevent floating-point rounding errors.
- **Features:** Supports multiple portfolios, trade history tracking, and realized/unrealized P&L calculations.
- **Standardization:** Utilizes a centralized `portfolioCalculator.js` to ensure consistency across the API and UI.

## 6. Alert Engine
- **Asynchronous Execution:** Scans all price thresholds in the background post-sync to prevent API blocking.
- **Conditions:** Supports "Above Price" and "Below Price" triggers.
- **Delivery:** Records delivery timestamps and status to prevent duplicate notifications within the same update cycle.

## 7. AI Services (Gemini Integration)
- **Market Narratives:** Provides AI-generated summaries of market trends and stock performance using Google Gemini 1.5 Flash.
- **Budget Control:** Implements usage tracking to prevent exceeding daily token quotas.

## 8. Security & Resilience
- **Auth:** JWT-based stateless authentication with secure refresh token rotation.
- **Admin Security:** Constant-time comparison for sensitive `ADMIN_API_KEY` verification.
- **Rate Limiting:** IP-based request throttling to prevent API abuse.
- **Watchdog:** Periodic automated checks for data integrity, source health, and system uptime.
- **Concurrency:** Implements a distributed lock (`Lock` table) to prevent race conditions during data syncs.

## 9. API Reference Highlights
- `GET /api/stocks`: Paginated list of all securities.
- `GET /api/stocks/:symbol/metrics`: Detailed technical indicators.
- `GET /api/market-summary`: Real-time index and turnover snapshots.
- `POST /api/alerts`: Create price threshold triggers.
- `GET /api/portfolios/:id/summary`: Personalized valuation and P&L.

## 10. Design System & UI
- **Aesthetics:** High-contrast dark mode (`#111` background) with vibrant success/danger indicators.
- **Responsiveness:** Mobile-first design for all tables and charts.
- **Interactive:** Real-time flashing updates using a custom `useLiveData` hook and CSS keyframe animations.

## 11. Testing & Validation
- **Backend Integrity:** 83 integrated tests covering security, pipelines, and logic.
- **Frontend Verification:** 29 Vitest components and hook tests.
- **Automation:** Support for CI mode (`--run`) to ensure non-blocking verification.

## 12. Deployment
- **Containerization:** Production-ready `Dockerfile` and `docker-compose.yml` for multi-stage deployments.
- **Production Server:** Optimized for PM2 or Docker execution on low-resource environments.

---

## 17. Feature Status Matrix (V1.0.0-MVP)

| Layer | Feature | Status |
| :--- | :--- | :--- |
| **Data** | Multi-source Sync Fallback | **VERIFIED** |
| **Data** | Historical Time-Series OHLC | **VERIFIED** |
| **Logic** | Technical Indicators (MA/RSI) | **VERIFIED** |
| **Logic** | Precision P&L Engine (Decimal) | **VERIFIED** |
| **API** | Secure JWT Authentication | **VERIFIED** |
| **Engine** | Asynchronous Price Alerts | **VERIFIED** |
| **UI** | Dark-Mode Dashboard | **VERIFIED** |
| **UI** | Interactive Technical Charts | **VERIFIED** |
| **Service** | Platform Watchdog & Health Check | **VERIFIED** |
| **Scripts** | Regex-based Secondary Scraper | **VERIFIED** |

---

## 18. Final Execution Log (Audit 2026-04-15)
- **Step 1:** Full test sweep completed. All 112 tests (83 Backend, 29 Frontend) passed.
- **Step 2:** Eliminated all direct `console.log` instances in `src/`, replacing them with a standardized Winston `logger`.
- **Step 3:** Removed `cheerio` dependency from legacy scripts, porting them to robust Regex-based extraction.
- **Step 4:** Verified `schema.prisma` financial fields use `Decimal` for 100% precision.
- **Step 5:** Final documentation rebuild completed.
