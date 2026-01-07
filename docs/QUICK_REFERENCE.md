# Quick Reference Guide

## Common Commands

### Development
```bash
# Install all dependencies
npm run install:all

# Run backend (development)
cd backend && npm run dev

# Run frontend (development)
cd frontend && npm run dev
```

### Production
```bash
# Build frontend
npm run build:frontend

# Setup database
cd backend && npx prisma generate && npx prisma migrate deploy

# Start backend with PM2
cd backend && npm run pm2:start

# Check PM2 status
npm run pm2:status

# View logs
npm run pm2:logs

# Restart backend
npm run pm2:restart

# Stop backend
npm run pm2:stop
```

### Database (Prisma)
```bash
# Generate Prisma client
npx prisma generate

# Apply migrations
npx prisma migrate deploy

# Create new migration
npx prisma migrate dev --name <migration-name>

# Open Prisma Studio (database viewer)
npx prisma studio
```

### Watchdog Service
```bash
# Check watchdog status
curl http://localhost:5000/api/watchdog/status

# Trigger manual verification
curl -X POST http://localhost:5000/api/watchdog/verify
```

## Important URLs

- **Local backend:** http://localhost:5000
- **Local frontend (dev):** http://localhost:3000
- **PM2 Web UI:** `pm2 web` (then open http://localhost:9615)
- **Prisma Studio:** `npx prisma studio` (opens in browser)
- **Production URL:** https://nepse.me

## File Locations

| File | Location |
|------|----------|
| Backend logs | `backend/logs/` |
| PM2 logs | `backend/logs/pm2-*.log` |
| Environment file | `backend/.env` |
| SQLite Database | `backend/prisma/dev.db` |
| Prisma Schema | `backend/prisma/schema.prisma` |
| Watchdog logs | `backend/logs/watchdog_verification.json` |
| Built frontend | `frontend/dist/` |
| JSON data (fallback) | `backend/data/` |

## Troubleshooting Quick Checks

**Site not loading:**
1. Is backend running? `npm run pm2:status`
2. Check logs: `npm run pm2:logs`
3. Test locally: `curl http://localhost:5000`
4. Check database: `npx prisma studio`

**Data not updating:**
1. Check backend logs for errors
2. Verify NEPSE API is responding
3. Check market status (market closed on Fri/Sat)
4. Run watchdog verification: `curl -X POST http://localhost:5000/api/watchdog/verify`

**Database issues:**
1. Check if database exists: `backend/prisma/dev.db`
2. Apply pending migrations: `npx prisma migrate deploy`
3. Regenerate client: `npx prisma generate`
4. Check Prisma Studio for data: `npx prisma studio`
