# NEPSE Frontend

React + Vite application for browsing NEPSE stock market data.

## Quick Start

```bash
npm install
npm run dev
```

App runs on `http://localhost:3000` and proxies `/api` to the backend on `http://localhost:5000`.

## Key Features

- Real-time stock dashboard with live price updates
- Optional AI summary infrastructure is present on the backend, but no AI summary UI is active by default
- User authentication with portfolio tracking
- IPO tracking and filtering
- Global search by symbol or company name
- Top gainers/losers/most traded
- Responsive design for desktop and mobile

## Build

```bash
npm run build    # Production build to dist/
npm run preview  # Preview production build
npm test         # Run tests with Vitest
```

See [docs/](../docs/) and [ARCHITECTURE.md](../ARCHITECTURE.md) for comprehensive documentation.
