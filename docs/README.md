# NEPSE Stock Website Documentation

> Central index for all project documentation.

---

## Project Overview

**NEPSE Stock Website** is a real-time dashboard for Nepal Stock Exchange (NEPSE) data with AI-powered analysis. It fetches data from official and unofficial sources, stores it in SQLite, generates AI overviews, and presents it through a modern React frontend.

| | |
|---|---|
| **Tech Stack** | Node.js/Express + React/Vite + SQLite/Prisma |
| **Repository** | `Rojan248/nepse-stock-website` |
| **License** | MIT |

---

## Documentation Index

| Document | Description |
|----------|-------------|
| **[ARCHITECTURE.md](../ARCHITECTURE.md)** | System design, data flow, directory structure, database schema, and design decisions |
| **[API.md](./API.md)** | REST API reference with endpoints, parameters, and response examples |
| **[SETUP.md](./SETUP.md)** | Development and production setup guide |
| **[SECURITY.md](./SECURITY.md)** | Security analysis and hardening recommendations |
| **[WATCHDOG.md](./WATCHDOG.md)** | Watchdog data integrity service documentation |
| **[PROJECT_DEBRIEF.md](./PROJECT_DEBRIEF.md)** | Full project context, status, and tech debt |
| **[START_GUIDE.md](../START_GUIDE.md)** | Quick start reference for getting the site online |

---

## Quick Start

```powershell
# Backend
cd D:\nepse-stock-website\backend
node src/server.js

# Frontend (new terminal)
cd D:\nepse-stock-website\frontend
npm run dev
```

- **Backend**: http://localhost:3000
- **Frontend**: http://localhost:3001

---

## Key Features

| Feature | Endpoint/Component |
|---------|-------------------|
| Stock Dashboard | `HomePage.jsx` |
| AI Stock Analysis | `GET /api/stocks/:symbol/overview` |
| AI Market Overview | `GET /api/market-overview` |
| Market Summary | `GET /api/market-summary` |
| Top Movers | `GET /api/stocks/top-gainers`, `/top-losers` |
| Search | `GET /api/stocks/search?q=` |
| IPO Listings | `GET /api/ipos` |
| User Auth | `POST /api/auth/login`, `/register` |
| Data Verification | `POST /api/watchdog/verify` |

---

## Data Update Schedule

| When | Interval |
|------|----------|
| Market OPEN (10:00-15:00 NST, Sun-Thu) | Every 10 seconds |
| Market CLOSED | Every 1 hour |
| Watchdog Verification | Every 10 minutes |

---

*Documentation last updated: 2026-03-06*
