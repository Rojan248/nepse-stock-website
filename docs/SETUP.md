# Setup Guide

> Complete setup instructions based on actual project configuration.
> Generated from: `package.json`, `vite.config.js`, `ecosystem.config.js`

---

## Prerequisites

- **Node.js**: v18 or higher
- **npm**: v9 or higher
- **Git**: For cloning the repository

---

## 1. Clone the Repository

```bash
git clone https://github.com/Rojan248/nepse-stock-website.git
cd nepse-stock-website
```

---

## 2. Backend Setup

### Install Dependencies

```bash
cd backend
npm install
```

### Configure Environment

Create a `.env` file in `backend/`:

```env
# Server
PORT=5000
NODE_ENV=development

# Database (SQLite via Prisma)
DATABASE_URL="file:./prisma/dev.db"

# Data Update Settings
NEPSE_UPDATE_INTERVAL=8000
MARKET_OPEN_HOUR=10
MARKET_CLOSE_HOUR=15

# Security
# Generate secrets with:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Key for protected Admin endpoints (/force-update, /admin/cleanup)
ADMIN_API_KEY=
JWT_SECRET=

# CORS (comma-separated origins)
CORS_ORIGIN=http://localhost:3000

# Reverse proxy trust. Keep false unless the API is behind a trusted proxy.
TRUST_PROXY=false

# Logging
LOG_LEVEL=info
```

### Initialize Database

```bash
# Generate Prisma client from schema
npm run prisma:generate

# Apply database migrations
npm run prisma:migrate

# Optional: Migrate existing JSON data to SQLite
npm run migrate:json
```

### Start Development Server

```bash
npm run dev
```

Backend runs at `http://localhost:5000`

**Dev mode features**:
- Hot reload via nodemon
- Ignores `data/` and `logs/` directories

---

## 3. Frontend Setup

### Install Dependencies

```bash
cd frontend
npm install
```

### Configure Environment (Optional)

Create a `.env` file in `frontend/`:

```env
# API URL (optional, Vite proxies /api to localhost:5000 in dev)
VITE_API_URL=/api
```

### Start Development Server

```bash
npm run dev
```

Frontend runs at `http://localhost:3000`

**Vite Configuration** (`vite.config.js`):
- Proxies `/api` requests to `http://localhost:5000`
- Opens browser automatically
- Source maps enabled

---

## 4. Running Both Services

### Option 1: Two Terminals

**Terminal 1 (Backend)**:
```bash
cd backend && npm run dev
```

**Terminal 2 (Frontend)**:
```bash
cd frontend && npm run dev
```

### Option 2: Windows Batch Script

```bash
./start_backend.bat
```

---

## 5. Available NPM Scripts

### Backend (`backend/package.json`)

| Script | Command | Description |
|--------|---------|-------------|
| `start` | `node src/server.js` | Production mode |
| `dev` | `nodemon --ignore data/ --ignore logs/ src/server.js` | Development with hot reload |
| `prisma:init` | `npx prisma init --datasource-provider sqlite` | Initialize Prisma |
| `prisma:generate` | `npx prisma generate` | Generate Prisma client |
| `prisma:migrate` | `npx prisma migrate dev --name init` | Run migrations |
| `migrate:json` | `node scripts/migrate-json-to-sqlite.js` | Import JSON data |
| `test` | `jest --config jest.config.js` | Run tests |
| `test:watch` | `jest --watch` | Tests in watch mode |
| `test:coverage` | `jest --coverage` | Test coverage report |
| `pm2:start` | `pm2 start ecosystem.config.js` | Start with PM2 |
| `pm2:stop` | `pm2 stop nepse-backend` | Stop PM2 process |
| `pm2:restart` | `pm2 restart nepse-backend` | Restart PM2 process |
| `pm2:logs` | `pm2 logs nepse-backend` | View PM2 logs |
| `pm2:status` | `pm2 status` | Check PM2 status |

### Frontend (`frontend/package.json`)

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `vite` | Development server |
| `build` | `vite build` | Production build |
| `preview` | `vite preview` | Preview production build |
| `test` | `vitest` | Run tests |
| `test:ui` | `vitest --ui` | Tests with UI |
| `test:coverage` | `vitest --coverage` | Coverage report |

---

## 6. Utility Scripts

Located in `backend/scripts/`:

### Data Audit
Check recent market snapshots and market breadth:
```bash
cd backend
npm run ops -- summary --take 2
npm run ops -- breadth
```

### End-of-Day Snapshot
Manually trigger historical data capture:
```bash
npm run ops -- eod
```

### Run Watchdog
Manually trigger data verification:
```bash
npm run ops -- watchdog
```

---

## 7. Production Deployment

### Build Frontend

```bash
cd frontend
npm run build
```

Creates `dist/` folder with static files.

### Configure Backend for Production

Update `backend/.env`:

```env
NODE_ENV=production
PORT=5000
DATABASE_URL="file:./prisma/dev.db"
```

### Start with PM2

```bash
cd backend
npm run pm2:start
```

The Express server will:
1. Serve the frontend from `frontend/dist/`
2. Handle API requests at `/api/*`
3. Route all other requests to `index.html` (SPA routing)

### PM2 Configuration (`ecosystem.config.js`)

```javascript
module.exports = {
  apps: [{
    name: 'nepse-backend',
    script: 'src/server.js',
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    }
  }]
};
```

---

## 8. Troubleshooting

### "Cannot find module '@prisma/client'"

```bash
cd backend
npm run prisma:generate
```

### "Database is locked"

Only one process can access SQLite at a time. Stop running servers before running scripts:
```bash
npm run pm2:stop  # If using PM2
# Or Ctrl+C on dev server
```

### "NEPSE data not updating"

1. Check health: `curl http://localhost:5000/api/health`
2. Check scheduler: `curl -H "x-admin-key: <your-admin-key>" http://localhost:5000/api/scheduler-status`
3. Verify market hours (10:00-15:00 NST, Sun-Thu)
4. Check logs: `backend/logs/` or `npm run pm2:logs`

### Frontend shows no data

1. Verify backend is running: `curl http://localhost:5000/api/stocks`
2. Check browser console for CORS errors
3. Ensure Vite proxy is configured (dev) or frontend is built (prod)

### Time sync issues

Check time status:
```bash
curl -H "x-admin-key: <your-admin-key>" http://localhost:5000/api/time-sync-status
```

If offset is extreme, verify system clock or check external time API availability.

---

## 9. Directory Structure After Setup

```
nepse-stock-website/
├── backend/
│   ├── node_modules/
│   ├── prisma/
│   │   ├── dev.db          # SQLite database (gitignored)
│   │   ├── migrations/
│   │   └── schema.prisma
│   ├── logs/               # Runtime logs
│   ├── src/
│   └── .env                # Environment variables (gitignored)
│
├── frontend/
│   ├── node_modules/
│   ├── dist/               # Production build (after npm run build)
│   ├── src/
│   └── .env                # Optional env vars
│
└── docs/
```

---

*Generated from actual project configuration on 2026-01-09*
