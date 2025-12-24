# NEPSE Stock Website

Real-time Nepal Stock Exchange (NEPSE) data visualization platform with automatic updates during market hours.

![NEPSE Stock Website](https://img.shields.io/badge/NEPSE-Stock%20Market-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)

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
| **Styling** | Vanilla CSS with custom design system |

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
NEPSE_UPDATE_INTERVAL=8000
LOG_LEVEL=info
```

### Frontend (.env)
```
VITE_API_URL=/api
```

## Testing

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test
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

**Recommended Platforms:**
- Backend: Render.com, Railway.app (single server, no database needed)
- Frontend: Vercel, Netlify

## Documentation

- [API Documentation](docs/API_DOCUMENTATION.md)
- [Setup Guide](docs/SETUP_GUIDE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Contributing](docs/CONTRIBUTING.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

## Contributing

Contributions welcome! See [CONTRIBUTING.md](docs/CONTRIBUTING.md).

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Acknowledgments

- Data sourced from Nepal Stock Exchange (NEPSE)
- Built for the Nepali investment community

## Recent Updates (Dec 2025)

- **Architecture Redesign**: Migrated search state to root components for a unified header search experience.
- **Data Integrity**: Fixed data mapping for the NEPSE Index and added Market Breadth indicators.
- **UI Polish**: Resolved currency symbol rendering issues (switched to 'Rs') and fixed various layout overlaps. Updated design system to **Stark Minimalism** (Pure Black, Pure White, Green, and Red).
- **Infrastructure**: Stabilized production deployment on `nepse.me` via PM2 and Cloudflare Tunnels.

## Known Issues

- **Historical Charts**: Some historical data points may have gaps due to upstream API maintenance. This does not affect live trading data.

## Roadmap & Upcoming Features

We are constantly working to improve NEPSE Stock Website. Here's what's coming next:

- **AI Integration:** Smart insights and market analysis powered by AI.
- **Stock Suggestions:** Personalized stock recommendations based on market trends.
- **Real-time Graphing:** Enhanced interactive charts with second-by-second updates.


## Production Deployment

For deploying this application to a production server, see:

- [Deployment Guide](./docs/DEPLOYMENT.md) - Build and run in production
- [PM2 Process Management](./docs/DEPLOYMENT.md#running-with-pm2) - Keep the app running
- [Security Best Practices](./docs/SECURITY.md) - Secure your deployment
- [Deployment Checklist](./docs/DEPLOYMENT_CHECKLIST.md) - Pre-launch verification

### Quick Start (Production)

```bash
# Install dependencies and build
npm run deploy

# Start with PM2
cd backend
npm run pm2:start

# Check status
npm run pm2:status

# View logs
npm run pm2:logs
```

### Accessing Your Deployed Site

After deployment:
- **Local access:** `http://localhost:5000`
- **Network access:** `http://<your-server-ip>:5000`


