# NEPSE Backend API Server

Express.js API server for NEPSE (Nepal Stock Exchange) stock data with AI-powered analysis.

## Quick Start

```bash
npm install
cp .env.example .env
npx prisma generate
node src/server.js
```

Server runs on http://localhost:3000

## Key Features

- Automatic stock data scraping every 10 seconds during market hours
- Fallback scraper system (Library -> ShareSansar Proxy -> Mock)
- AI-generated stock and market overviews (Gemini/GitHub Models)
- JWT user authentication with portfolio tracking
- Watchdog data verification service
- SQLite database via Prisma ORM

## Scripts

| Script | Description |
|--------|-------------|
| `node src/server.js` | Start the server |
| `npm run dev` | Development mode with hot reload |
| `node scripts/batch-ai-autonomous.js` | Generate AI overviews |
| `node scripts/check-bad-overviews.js` | Audit AI overview quality |

See [docs/](../docs/) for comprehensive documentation.
