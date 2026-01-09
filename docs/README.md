# NEPSE Stock Website Documentation

> Central index for all project documentation.
> All documents are based on comprehensive codebase analysis (2026-01-09).

---

## Project Overview

**NEPSE Stock Website** is a real-time dashboard for Nepal Stock Exchange (NEPSE) data. It scrapes data from official and unofficial sources, stores it in SQLite, and presents it through a modern React frontend.

| | |
|---|---|
| **Tech Stack** | Node.js/Express + React/Vite + SQLite/Prisma |
| **Repository** | `Rojan248/nepse-stock-website` |
| **Latest Commit** | `4281114` on `master` branch |
| **License** | MIT |

---

## Documentation Index

| Document | Description |
|----------|-------------|
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | Complete system design, data flow diagrams, directory structure, database schema, and key design decisions |
| **[API.md](./API.md)** | Full REST API reference with all endpoints, parameters, and response examples |
| **[SETUP.md](./SETUP.md)** | Development and production setup guide with all npm scripts documented |
| **[SECURITY.md](./SECURITY.md)** | Security analysis, vulnerability assessment, and hardening recommendations |
| **[STATE_OF_PROJECT.md](./STATE_OF_PROJECT.md)** | Current status report with feature status, known issues, and next steps |

---

## Quick Start

### Development

```bash
# Clone
git clone https://github.com/Rojan248/nepse-stock-website.git
cd nepse-stock-website

# Backend
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev  # Port 5000

# Frontend (new terminal)
cd frontend
npm install
npm run dev  # Port 3000
```

### Access

- **Frontend**: http://localhost:3000
- **API**: http://localhost:5000/api
- **Health Check**: http://localhost:5000/api/health

---

## Key Features

| Feature | Endpoint/Component |
|---------|-------------------|
| Stock Dashboard | `HomePage.jsx` |
| Market Summary | `GET /api/market-summary` |
| Top Movers | `GET /api/stocks/top-gainers`, `/top-losers` |
| Search | `GET /api/stocks/search?q=` |
| Sector Chart | `SectorChart.jsx` |
| IPO Listings | `GET /api/ipos` |
| Trending Stocks | `GET /api/trending` |
| Data Verification | `POST /api/watchdog/verify` |

---

## Architecture Summary

```
NEPSE API → libraryFetcher → dataFetcher → Prisma/SQLite → Express API → React Frontend
                                 ↓
                         Watchdog (verification)
                                 ↓
                    Merolagani/NepseAlpha (cross-check)
```

---

## Data Update Schedule

| When | Interval |
|------|----------|
| Market OPEN (10:00-15:00 NST, Sun-Thu) | Every 10 seconds |
| Market CLOSED | Every 1 hour |
| Watchdog Verification | Every 10 minutes |
| Analytics Decay | Every 1 hour |

---

## Contact

For issues or contributions, please use the GitHub repository.

---

*Documentation last updated: 2026-01-09*
