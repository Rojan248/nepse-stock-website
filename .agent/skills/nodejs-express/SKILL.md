---
name: Node.js Express API
description: Patterns for building REST APIs with Node.js and Express, including middleware, error handling, and background job scheduling
---

# Node.js Express API Skill

## REST API Patterns

### Route Structure
Organize routes by resource (e.g., `/api/stocks`, `/api/market`, `/api/health`).

```javascript
// routes/stocks.js
const express = require('express');
const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const data = await stockService.getAll();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
```

### Error Handling Middleware
Always use centralized error handling:

```javascript
// middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
};
```

## Middleware Patterns

### Request Validation
```javascript
const validateRequest = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  next();
};
```

### Rate Limiting
```javascript
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100
});
app.use('/api/', limiter);
```

## Background Job Scheduling

### Using node-cron
```javascript
const cron = require('node-cron');

// Run every 5 minutes during market hours (10 AM - 3 PM Nepal time)
cron.schedule('*/5 10-15 * * 0-4', async () => {
  await updateStockData();
}, { timezone: 'Asia/Kathmandu' });
```

### Using node-schedule
```javascript
const schedule = require('node-schedule');

// Run at specific times
const job = schedule.scheduleJob('0 10 * * 0-4', async () => {
  await marketOpenTasks();
});
```

## Best Practices

1. **Use async/await** - Always wrap async handlers in try-catch
2. **Validate input** - Never trust user input
3. **Log everything** - Use Winston or similar for structured logging
4. **Use environment variables** - Never hardcode secrets
5. **Implement health checks** - `/api/health` endpoint for monitoring
