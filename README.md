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
- 📱 **Responsive Design** - Optimized for desktop, tablet, and mobile
- 🌙 **Dark Theme** - Modern, eye-friendly interface

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, Vite, React Router, Axios |
| **Backend** | Node.js, Express |
| **Storage** | Local JSON Files (no external database required) |
| **Styling** | Vanilla CSS with Stark Minimalism design system |

## Quick Start

### Prerequisites
- Node.js 18+

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/nepse-stock-website.git
cd nepse-stock-website

# Backend setup
cd backend
npm install
cp .env.example .env
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
│   │   └── middleware/    # Express middleware
│   └── tests/             # Backend tests
├── frontend/              # React application
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   └── services/      # API client
│   └── tests/             # Frontend tests
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
| `GET /api/health` | Server status |

## Environment Variables

### Backend (.env)
```
PORT=5000
NODE_ENV=development
NEPSE_UPDATE_INTERVAL=10000
LOG_LEVEL=info
```

### Frontend (.env)
```
VITE_API_URL=/api
```

## Data Storage

Stock data is stored locally in `backend/data/`:
- `stocks.json` - All stock prices and details
- `marketSummary.json` - NEPSE index and market stats  
- `marketHistory.json` - Historical index data
- `ipos.json` - IPO listings

Data persists automatically on graceful shutdown (Ctrl+C).

## Deployment

See [SETUP_GUIDE.md](docs/SETUP_GUIDE.md) for detailed deployment instructions.

## Recent Updates (Dec 2025)

- **Architecture Redesign**: Migrated search state to root components for a unified header search experience.
- **Data Integrity**: Fixed data mapping for the NEPSE Index and added Market Breadth indicators.
- **UI Polish**: Switched to **Stark Minimalism** color palette (Pure Black/White). Resolved currency symbol rendering issues (switched to 'Rs').
- **Infrastructure**: Stabilized production deployment on `nepse.me` via PM2 and Cloudflare Tunnels.

## License

MIT License - see [LICENSE](./LICENSE) for details.
