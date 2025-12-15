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

---

### API Returns 500 Error

**Symptoms:** All endpoints return server error

**Solutions:**
1. Check server logs: `logs/error.log`
2. Verify data files exist in `backend/data/`
3. Check environment variables
4. Restart server: `npm run dev`

---

### No Data from NEPSE

**Symptoms:** Empty arrays, null market summary

**Solutions:**
1. Check internet connectivity
2. Verify during NEPSE market hours (10 AM - 3 PM NST)
3. Check console for fetch errors
4. Force update: `POST /api/force-update`

---

### Data Not Persisting

**Symptoms:** Data lost after restart

**Solutions:**
1. Use graceful shutdown (Ctrl+C), not force kill
2. Check write permissions for `backend/data/` directory
3. Look for error logs during shutdown
4. Verify JSON files aren't corrupted

---

### Scheduler Not Running

**Symptoms:** Data not updating automatically

**Solutions:**
1. Check `/api/scheduler-status`
2. Verify `NEPSE_UPDATE_INTERVAL` in `.env`
3. Restart server
4. Check logs for scheduler errors

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
1. Check if stocks exist in data files
2. Verify search endpoint: `/api/stocks/search?q=test`
3. Clear browser cache
4. Check for JavaScript errors

---

### Build Fails

**Symptoms:** `npm run build` errors

**Solutions:**
1. Delete `node_modules` and reinstall
2. Check for TypeScript errors
3. Verify all imports are correct
4. Update dependencies: `npm update`

---

## Data Issues

### Corrupted JSON Files

**Symptoms:** Server fails to start, JSON parse errors

**Solutions:**
1. Check `backend/data/*.json` files for valid JSON
2. Delete corrupted file (will be recreated on startup)
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

---

## Quick Fixes

| Problem | Command |
|---------|---------|
| Clear node_modules | `rm -rf node_modules && npm install` |
| Reset data | `rm backend/data/*.json` (will be recreated) |
| Force data update | `curl -X POST localhost:5000/api/force-update` |
| View logs | `tail -f backend/logs/combined.log` |

---

## Still Stuck?

1. Check [GitHub Issues](https://github.com/yourusername/nepse-stock-website/issues)
2. Search error message online
3. Open new issue with details
