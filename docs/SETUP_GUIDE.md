# Setup Guide

Complete guide to set up the NEPSE Stock Website for development and production.

## Prerequisites

- **Node.js** 18.x or higher
- **Git** for version control
- **npm** or **yarn** package manager

**Note:** No external database required! Data is stored locally in JSON files.

---

## Development Setup

### Step 1: Clone Repository

```bash
git clone https://github.com/yourusername/nepse-stock-website.git
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

The application uses local JSON file storage (`backend/data/`):

| File | Description |
|------|-------------|
| `stocks.json` | All stock prices and details |
| `marketSummary.json` | NEPSE index and market statistics |
| `marketHistory.json` | Historical index data |
| `ipos.json` | IPO listings |

**Data Persistence:**
- Data auto-saves every 2 seconds when changes occur
- All data saved on graceful shutdown (Ctrl+C)
- Data files created automatically on first run

---

## Production Deployment

### Backend Deployment (Render.com)

1. Push code to GitHub
2. Create Render account
3. New → Web Service → Connect GitHub
4. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Add environment variables:
   - `NODE_ENV=production`
   - `PORT=5000`
6. Deploy

**⚠️ Data Persistence Warning:** Render uses an **ephemeral filesystem** by default—data in `backend/data/` is lost on redeploys and restarts. For production persistence, choose one of:

| Option | Notes |
|--------|-------|
| **Render Persistent Disk** | Single-instance only; specify `mount-path`; disables zero-downtime deploys |
| **Render Managed Datastore** | PostgreSQL or Redis (requires code changes) |
| **External Storage** | S3, external database, or other managed DB service |

### Frontend Deployment (Vercel)

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

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for more solutions.
