# Setup Guide

Complete guide to set up the NEPSE Stock Website for development and production.

## Prerequisites

- **Node.js** 18.x or higher
- **Git** for version control
- **npm** package manager

**Note:** The application uses SQLite as the primary database (via Prisma ORM), with JSON files as fallback. No external database server required!

---

## Development Setup

### Step 1: Clone Repository

```bash
git clone https://github.com/Rojan248/nepse-stock-website.git
cd nepse-stock-website
```

### Step 2: Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

**Minimum .env configuration:**
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="file:./prisma/dev.db"
```

**Initialize database:**
```bash
npx prisma generate
npx prisma migrate dev
```

**Start backend:**
```bash
npm run dev
```

Backend runs on **http://localhost:5000**

### Step 3: Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend runs on **http://localhost:3000**

---

## Data Storage

### Primary: SQLite Database (via Prisma)

The application uses SQLite with Prisma ORM for structured data:

| Model | Description |
|-------|-------------|
| `Stock` | Stock symbols, prices, sectors |
| `MarketHistory` | Historical price data |
| `MarketSummary` | NEPSE index and market stats |
| `Ipo` | IPO listings |

Database file location: `backend/prisma/dev.db`

### Fallback: JSON Files

Legacy JSON storage in `backend/data/`:

| File | Description |
|------|-------------|
| `stocks.json` | All stock prices and details |
| `marketSummary.json` | NEPSE index and market statistics |
| `marketHistory.json` | Historical index data |
| `ipos.json` | IPO listings |

**Data Persistence:**
- Data auto-saves every 2 seconds when changes occur
- All data saved on graceful shutdown (Ctrl+C)
- Database and JSON files created automatically on first run

---

## Production Deployment

### Self-Hosted (Recommended)

1. **Build frontend:**
   ```bash
   npm run build:frontend
   ```

2. **Setup database:**
   ```bash
   cd backend
   npx prisma generate
   npx prisma migrate deploy
   ```

3. **Configure environment:**
   ```env
   NODE_ENV=production
   PORT=5000
   DATABASE_URL="file:./prisma/dev.db"
   ```

4. **Start with PM2:**
   ```bash
   cd backend
   npm run pm2:start
   ```

### Cloud Deployment (Render.com)

1. Push code to GitHub
2. Create Render account
3. New → Web Service → Connect GitHub
4. Configure:
   - **Build Command:** `npm install && npx prisma generate`
   - **Start Command:** `npm start`
5. Add environment variables:
   - `NODE_ENV=production`
   - `PORT=5000`
   - `DATABASE_URL=file:./prisma/dev.db`
6. Deploy

**⚠️ Data Persistence Warning:** Render uses an **ephemeral filesystem** by default—database and data files are lost on redeploys. For production persistence:

| Option | Notes |
|--------|-------|
| **Render Persistent Disk** | Single-instance only; mount to `/opt/render/project/src/backend/prisma` |
| **External Database** | PostgreSQL (requires schema changes) |
| **SQLite on mounted disk** | Best for single-instance deployments |

### Frontend-Only Deployment (Vercel)

1. Push code to GitHub
2. Import to Vercel
3. Set environment variable:
   - `VITE_API_URL=https://your-backend-url.com/api`
4. Deploy

---

## Testing

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| CORS errors | Verify CORS_ORIGIN in backend .env |
| No data showing | Ensure backend is running, check network tab |
| Build fails | Delete node_modules and reinstall |
| Data not persisting | Ensure graceful shutdown (Ctrl+C, not kill) |
| Database errors | Run `npx prisma migrate dev --name fix` |
| Prisma client missing | Run `npx prisma generate` |

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for more solutions.
