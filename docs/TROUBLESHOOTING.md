# Troubleshooting Guide

Common issues and their solutions for the NEPSE Stock Website.

---

## Backend Issues

### MongoDB Connection Fails

**Symptoms:** Server doesn't start, "MongoNetworkError" in logs

**Solutions:**
1. Verify MongoDB is running: `mongosh`
2. Check `MONGODB_URI` in `.env`
3. For Atlas: Verify IP whitelist and credentials
4. Check network connectivity

---

### API Returns 500 Error

**Symptoms:** All endpoints return server error

**Solutions:**
1. Check server logs: `logs/error.log`
2. Verify database connection
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
1. Check if stocks exist in database
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

## Database Issues

### Duplicate Key Error

**Symptoms:** "E11000 duplicate key error"

**Solutions:**
1. Clear test data: `db.stocks.deleteMany({})`
2. Check for duplicate symbols in data
3. Verify unique indexes

---

### Slow Queries

**Symptoms:** API responses take >1 second

**Solutions:**
1. Verify indexes exist on queried fields
2. Use `.lean()` for read-only queries
3. Add pagination to large result sets
4. Profile queries with `.explain()`

---

## Quick Fixes

| Problem | Command |
|---------|---------|
| Clear node_modules | `rm -rf node_modules && npm install` |
| Reset database | `mongosh nepse --eval "db.dropDatabase()"` |
| Force data update | `curl -X POST localhost:5000/api/force-update` |
| View logs | `tail -f backend/logs/combined.log` |

---

## Still Stuck?

1. Check [GitHub Issues](https://github.com/yourusername/nepse-stock-website/issues)
2. Search error message online
3. Open new issue with details
