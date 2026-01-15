# NEPSE Stock Website

Real-time Nepal Stock Exchange (NEPSE) data visualization platform with automatic updates during market hours.

![NEPSE Stock Website](https://img.shields.io/badge/NEPSE-Stock%20Market-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)

## Project Overview

The NEPSE Stock Website is a high-performance financial dashboard designed to provide real-time stock market data from the Nepal Stock Exchange. 

### Design System: Stark Minimalism
The application utilizes a **Stark Minimalism** design philosophy to ensure clarity and focus on financial data:
- **Core Palette**: Pure White (`#FFFFFF`) backgrounds and Pure Black (`#000000`) text.
- **Financial Indicators**: High-contrast Green (`#22c55e`) for gains/advanced stocks and Red (`#ef4444`) for losses/declined stocks.
- **Typography**: Inter for general UI and JetBrains Mono for tabular financial figures to ensure alignment and readability.
- **UX**: Unified global search and real-time market breadth indicators (Advanced/Declined/Unchanged).

## Features

- 📊 **Real-time Stock Data** - Live prices, changes, and volumes
- 🔍 **Unified Global Search** - Search stocks by symbol or name from anywhere in the app
- 🔄 **Auto Updates** - 10-second refresh during market hours (10 AM - 3 PM NST)
- 📈 **Market Breadth** - Track Advanced, Declined, and Unchanged counts at a glance
- 📈 **Top Gainers/Losers** - Track best and worst performers
- 🆕 **IPO Tracking** - Browse upcoming, open, and completed IPOs
- 🛡️ **Watchdog Service** - Automatic data verification and self-correction
- 📱 **Responsive Design** - Optimized for desktop, tablet, and mobile
- 🌙 **Dark Theme** - Modern, eye-friendly interface

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, Vite, React Router, Axios |
| **Backend** | Node.js, Express |
| **Database** | SQLite (via Prisma ORM), JSON fallback |
| **Styling** | Vanilla CSS with Stark Minimalism design system |

## Quick Start

### Prerequisites
- Node.js 18+

### Installation

```bash
# Clone repository
git clone https://github.com/Rojan248/nepse-stock-website.git
cd nepse-stock-website

# Backend setup
cd backend
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npm run dev

# Frontend setup (new terminal)
cd frontend
npm install
npm run dev
```

Visit **http://localhost:3000**

## Project Structure

```
nepse-stock-website/
├── backend/               # Express API server
│   ├── src/
│   │   ├── routes/        # API endpoints
│   │   ├── services/      # Business logic
│   │   │   ├── database/  # Data operations (Prisma + JSON)
│   │   │   ├── scrapers/  # Data fetchers
│   │   │   └── watchdog/  # Data verification service
│   │   └── middleware/    # Express middleware
│   ├── prisma/            # Database schema & migrations
│   └── data/              # JSON fallback storage
├── frontend/              # React application
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   └── services/      # API client
└── docs/                  # Documentation
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/stocks` | All stocks with pagination |
| `GET /api/stocks/:symbol` | Single stock details |
| `GET /api/stocks/search?q=` | Search stocks |
| `GET /api/ipos` | IPO listings |
| `GET /api/market-summary` | NEPSE index data |
| `GET /api/watchdog/status` | Watchdog service status |
| `GET /api/health` | Server status |

## Environment Variables

### Backend (.env)
```
PORT=5000
NODE_ENV=development
DATABASE_URL="file:./prisma/dev.db"
NEPSE_UPDATE_INTERVAL=10000
LOG_LEVEL=info
```

### Frontend (.env)
```
VITE_API_URL=/api
```

## Data Storage

### Primary: SQLite Database
Stock data is stored in SQLite via Prisma ORM (`backend/prisma/dev.db`):
- `Stock` - Stock prices and metadata
- `MarketSummary` - NEPSE index and market stats
- `MarketHistory` - Historical data
- `Ipo` - IPO listings

### Fallback: JSON Files
Legacy JSON storage in `backend/data/` for backward compatibility.

Data persists automatically on graceful shutdown (Ctrl+C).

## Watchdog Service

The built-in Watchdog service ensures data integrity:
- **Verification**: Compares local data with external sources (Merolagani, NepseAlpha)
- **Auto-Correction**: Automatically fixes discrepancies
- **Stale Detection**: Warns when data is outdated
- **Logging**: Maintains audit trail in `backend/logs/`

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed deployment instructions.

### Quick Deploy
```bash
# Build frontend
npm run build:frontend

# Setup database
cd backend && npx prisma migrate deploy

# Start with PM2
npm run pm2:start
```

## Documentation

| Document | Description |
|----------|-------------|
| [SETUP.md](docs/SETUP.md) | Complete setup and deployment instructions |
| [API.md](docs/API.md) | API reference |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture |
| [SECURITY.md](docs/SECURITY.md) | Security best practices |

## Recent Updates (Jan 2026)

- **Watchdog Service**: Added data verification with auto-correction using external providers
- **Prisma/SQLite**: Migrated from JSON-only to SQLite database with Prisma ORM
- **Simplified Deployment**: Removed Cloudflare integration, focused on self-hosted setup
- **Data Integrity**: Fixed inflated stock counts and improved sector classification
- **Architecture Redesign**: Migrated search state to root components for unified UX

## License

MIT License - see [LICENSE](./LICENSE) for details.
