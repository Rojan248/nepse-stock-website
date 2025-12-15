# NEPSE Backend API Server

Scraper and API server for NEPSE (Nepal Stock Exchange) stock data.

## Features
- Automatic stock data scraping every 8 seconds (market hours)
- Dual fallback system (Library → Proxy → Custom)
- REST API endpoints for stock and IPO data
- Local JSON file persistence
- Market hours awareness (10 AM - 3 PM NST)

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Create .env file:
   ```
   cp .env.example .env
   ```

3. Start the server:
   ```
   npm run dev
   ```

Server will run on http://localhost:5000

## API Endpoints

- GET /api/stocks - All stocks
- GET /api/stocks/:symbol - Specific stock
- GET /api/ipos - All IPOs
- GET /api/market-summary - Market overview
- GET /api/health - Server health check

## Data Sources
1. Library: surajrimal07/NepseAPI-Unofficial
2. Proxy: nepalstock.onrender.com
3. Custom: Direct NEPSE authentication (backup)

## Data Storage

Data is stored in `data/` directory:
- `stocks.json` - Stock prices and details
- `marketSummary.json` - Market index data
- `marketHistory.json` - Historical data
- `ipos.json` - IPO listings
