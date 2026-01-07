# Troubleshooting Guide

Common issues and their solutions for the NEPSE Stock Website.

---

## Backend Issues

### Server Fails to Start

**Symptoms:** "Cannot find module" or startup errors

**Solutions:**
1. Delete `node_modules` and reinstall: `npm install`
2. Check Node.js version: `node --version` (requires 18+)
3. Verify all files exist in `src/` directory
4. Check for syntax errors in logs
5. Ensure Prisma client is generated: `npx prisma generate`

---

### API Returns 500 Error

**Symptoms:** All endpoints return server error

**Solutions:**
1. Check server logs: `logs/error.log`
2. Verify database exists: `backend/prisma/dev.db`
3. Check environment variables in `.env`
4. Restart server: `npm run dev`
5. Regenerate Prisma client: `npx prisma generate`

---

### Database Errors

**Symptoms:** Prisma errors, "table not found", migration issues

**Solutions:**
1. Apply pending migrations: `npx prisma migrate deploy`
2. Regenerate client: `npx prisma generate`
3. Check database file exists: `backend/prisma/dev.db`
4. Reset database (development only): `npx prisma migrate reset`
5. View database with Prisma Studio: `npx prisma studio`

---

### No Data from NEPSE

**Symptoms:** Empty arrays, null market summary

**Solutions:**
1. Check internet connectivity
2. Verify during NEPSE market hours (10 AM - 3 PM NST, Sun-Thu)
3. Check console for fetch errors
4. Force update: `POST /api/force-update`
5. Run watchdog verification: `POST /api/watchdog/verify`

---

### Data Not Persisting

**Symptoms:** Data lost after restart

**Solutions:**
1. Use graceful shutdown (Ctrl+C), not force kill
2. Check write permissions for `backend/prisma/` directory
3. Look for error logs during shutdown
4. Verify database file isn't corrupted
5. Check JSON files in `backend/data/` for fallback data

---

### Scheduler Not Running

**Symptoms:** Data not updating automatically

**Solutions:**
1. Check `/api/scheduler-status`
2. Verify `NEPSE_UPDATE_INTERVAL` in `.env`
3. Restart server
4. Check logs for scheduler errors
5. Verify market hours (data only updates during trading hours)

---

### Watchdog Issues

**Symptoms:** Verification failing, auto-correction not working

**Solutions:**
1. Check watchdog status: `GET /api/watchdog/status`
2. Review logs: `backend/logs/watchdog_verification.json`
3. Verify external providers are accessible (Merolagani, NepseAlpha)
4. Check for network connectivity issues
5. Manually trigger verification: `POST /api/watchdog/verify`

---

## Frontend Issues

### Page Shows "No Data"

**Symptoms:** Components show loading or empty state

**Solutions:**
1. Confirm backend is running on port 5000
2. Check browser console for errors
3. Check Network tab for failed requests
4. Verify proxy configuration in `vite.config.js`

---

### CORS Errors

**Symptoms:** "Access-Control-Allow-Origin" errors in console

**Solutions:**
1. Check `CORS_ORIGIN` in backend `.env`
2. Verify frontend URL is whitelisted
3. Restart backend after changes

---

### Search Not Working

**Symptoms:** No results, errors when searching

**Solutions:**
1. Check if stocks exist in database
2. Verify search endpoint: `/api/stocks/search?q=test`
3. Clear browser cache
4. Check for JavaScript errors

---

### Build Fails

**Symptoms:** `npm run build` errors

**Solutions:**
1. Delete `node_modules` and reinstall
2. Check for TypeScript/ESLint errors
3. Verify all imports are correct
4. Update dependencies: `npm update`

---

## Data Issues

### Corrupted Database

**Symptoms:** Server fails to start, Prisma errors

**Solutions:**
1. Check SQLite file: `backend/prisma/dev.db`
2. Delete and recreate: `rm dev.db && npx prisma migrate dev`
3. Check disk space
4. Review logs for write errors
5. Restore from backup if available

---

### Corrupted JSON Files

**Symptoms:** JSON parse errors

**Solutions:**
1. Check `backend/data/*.json` files for valid JSON
2. Delete corrupted file (will fall back to database)
3. Check disk space
4. Review logs for write errors

---

### Missing Stock Data

**Symptoms:** Some stocks not showing

**Solutions:**
1. Force a data refresh: `POST /api/force-update`
2. Check NEPSE API availability
3. Verify stock exists on NEPSE website
4. Check logs for fetch errors
5. Run watchdog verification to check data integrity

---

### Inflated Stock Count

**Symptoms:** Dashboard shows 500+ stocks instead of ~250

**Solutions:**
1. Run watchdog verification: `POST /api/watchdog/verify`
2. Check if indices are being counted as stocks
3. Verify data source is filtering correctly
4. Check database for duplicate entries

---

## Quick Fixes

| Problem | Command |
|---------|---------|
| Clear node_modules | `rm -rf node_modules && npm install` |
| Reset database | `npx prisma migrate reset` (dev only) |
| Regenerate Prisma | `npx prisma generate` |
| Force data update | `curl -X POST localhost:5000/api/force-update` |
| Run watchdog | `curl -X POST localhost:5000/api/watchdog/verify` |
| View logs | `npm run pm2:logs` |
| View database | `npx prisma studio` |

---

## Still Stuck?

1. Check [GitHub Issues](https://github.com/Rojan248/nepse-stock-website/issues)
2. Search error message online
3. Open new issue with details
