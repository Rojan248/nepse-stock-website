# Security Analysis

> Security posture, vulnerabilities, and hardening recommendations.
> Based on: Comprehensive code review of `backend/src/routes/*.js`, `server.js`, and middleware.

---

## 1. Current Security Status

| Area | Status | Details |
|------|--------|---------|
| **Data Exposure** | ✅ Safe | All displayed data is public NEPSE information |
| **XSS Protection** | ✅ Protected | React escapes by default |
| **SQL Injection** | ✅ Protected | Prisma uses parameterized queries |
| **Path Traversal** | ✅ Protected | No user-controlled file paths |
| **CORS** | ⚠️ Permissive | `corsMiddleware` may need tightening |
| **Rate Limiting** | ❌ Missing | No request throttling |
| **Authentication** | ❌ Missing | Admin endpoints unprotected |
| **HTTPS** | ❌ External | Must configure nginx/reverse proxy |

---

## 2. Vulnerability Assessment

### 2.1 Unprotected Admin Endpoints (HIGH)

**Location**: `routes/stocks.js` lines 235-298

**Vulnerable Endpoints**:
```
POST /api/stocks/admin/cleanup     # Deletes inactive stocks
POST /api/stocks/admin/validate    # Removes invalid stocks
POST /api/force-update             # Forces data refresh
POST /api/watchdog/verify          # Triggers verification
```

**Risk**: Anyone can call these endpoints and:
- Delete stock data
- Trigger excessive API calls to NEPSE
- Manipulate Watchdog behavior

**Recommended Fix**:
```javascript
// backend/src/middleware/adminAuth.js
const adminAuth = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    
    if (!process.env.ADMIN_API_KEY) {
        console.warn('ADMIN_API_KEY not set - rejecting admin request');
        return res.status(503).json({ error: 'Admin access not configured' });
    }
    
    if (apiKey !== process.env.ADMIN_API_KEY) {
        return res.status(401).json({ error: 'Invalid API key' });
    }
    
    next();
};

module.exports = { adminAuth };
```

**Apply to routes**:
```javascript
const { adminAuth } = require('../middleware/adminAuth');

router.post('/admin/cleanup', adminAuth, async (req, res) => { ... });
router.post('/admin/validate', adminAuth, async (req, res) => { ... });
```

---

### 2.2 No Rate Limiting (MEDIUM)

**Risk**: 
- API exhaustion via rapid requests
- NEPSE API rate limit triggering
- Server resource depletion

**Recommended Fix**:
```bash
npm install express-rate-limit
```

```javascript
// backend/src/server.js
const rateLimit = require('express-rate-limit');

// General API limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per IP
    message: { success: false, error: 'Too many requests' }
});

// Stricter limiter for write operations
const strictLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 requests per minute
    message: { success: false, error: 'Rate limit exceeded' }
});

app.use('/api/', apiLimiter);
app.use('/api/force-update', strictLimiter);
app.use('/api/watchdog/verify', strictLimiter);
```

---

### 2.3 CORS Configuration (LOW)

**Current** (`middleware/cors.js`):
Most likely using:
```javascript
const cors = require('cors');
module.exports = { corsMiddleware: cors() }; // Allows all origins
```

**Hardened Configuration**:
```javascript
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://nepse.me', 'https://www.nepse.me']
        : true, // Allow all in development
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'X-API-Key'],
    credentials: false
};

module.exports = { corsMiddleware: cors(corsOptions) };
```

---

### 2.4 Watchdog Data Manipulation (LOW)

**Location**: `services/watchdog/WatchdogService.js`

**Concern**: Watchdog auto-corrects data based on external sources. If those sources are compromised or return bad data, it could overwrite valid local data.

**Current Mitigations**:
- Uses 1% tolerance threshold for discrepancy detection
- Only corrects when breadth is zero (clear anomaly)
- Logs all corrections

**Recommendations**:
1. Add alerting for large corrections
2. Store correction audit trail in database (not just JSON log)
3. Consider a "dry run" mode for verification

---

### 2.5 External Time Dependency (LOW)

**Location**: `services/utils/marketTime.js`

**Concern**: System relies on external time APIs (WorldTimeAPI, TimeAPI.io). If these return incorrect time, market state detection fails.

**Current Mitigations**:
- Multiple fallback sources
- 24-hour max offset sanity check
- Falls back to system time

**Recommendation**: Log time sync failures and alert if multiple consecutive failures occur.

---

## 3. Dependency Security

### Check Vulnerabilities

```bash
cd backend && npm audit
cd frontend && npm audit
```

### Known Issues

**Frontend** (as of last check):
- 7 vulnerabilities in dev dependencies
- Most are in test/build tools, not production code

**Remediation**:
```bash
npm audit fix          # Safe fixes only
npm audit fix --force  # All fixes (may break things)
```

---

## 4. Environment Variable Security

### Required for Production

```env
# backend/.env (NEVER commit this file)
PORT=5000
NODE_ENV=production
DATABASE_URL="file:./prisma/dev.db"
ADMIN_API_KEY=<random-32-character-string>
```

### Generate Secure API Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Ensure .gitignore Contains

```
.env
.env.*
!.env.example
prisma/dev.db
logs/
```

---

## 5. Security Headers

**Recommended**: Add Helmet.js for security headers.

```bash
npm install helmet
```

```javascript
// backend/src/server.js
const helmet = require('helmet');

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:"]
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true
    }
}));
```

---

## 6. HTTPS Configuration

The Express server does not handle HTTPS directly. Use a reverse proxy.

### Nginx Example

```nginx
server {
    listen 443 ssl;
    server_name nepse.me;
    
    ssl_certificate /etc/letsencrypt/live/nepse.me/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nepse.me/privkey.pem;
    
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

server {
    listen 80;
    server_name nepse.me;
    return 301 https://$server_name$request_uri;
}
```

---

## 7. Security Checklist

### Immediate Actions
| Task | Status | Priority |
|------|--------|----------|
| Add API key to admin endpoints | ⬜ | HIGH |
| Implement rate limiting | ⬜ | HIGH |
| Restrict CORS in production | ⬜ | MEDIUM |

### Short-term Actions
| Task | Status | Priority |
|------|--------|----------|
| Add Helmet.js security headers | ⬜ | MEDIUM |
| Run `npm audit fix` | ⬜ | MEDIUM |
| Configure HTTPS via nginx | ⬜ | MEDIUM |

### Ongoing Actions
| Task | Frequency |
|------|-----------|
| Run `npm audit` | Weekly |
| Review Watchdog logs | Daily |
| Check rate limit metrics | Weekly |
| Update dependencies | Monthly |

---

## 8. Logging for Security

### Current Logging (`services/utils/logger.js`)

Uses Winston with:
- Console transport
- File transport (if configured)

### Recommended Additions

1. **Log admin actions**:
```javascript
logger.info(`[ADMIN] ${req.ip} called ${req.path}`);
```

2. **Log failed API key attempts**:
```javascript
logger.warn(`[AUTH] Invalid API key from ${req.ip}`);
```

3. **Log rate limit hits**:
```javascript
logger.warn(`[RATE] ${req.ip} hit rate limit on ${req.path}`);
```

---

## 9. Security Incident Response

### If Suspicious Activity Detected

1. Check logs: `backend/logs/` or `pm2 logs nepse-backend`
2. Look for patterns:
   - Many requests from single IP
   - Repeated admin endpoint calls
   - Unusual data changes

### If Data Integrity Compromised

1. Stop the server: `npm run pm2:stop`
2. Backup current database: `cp prisma/dev.db prisma/dev.db.backup`
3. Check Watchdog logs: `backend/logs/watchdog_verification.json`
4. Restore from known good backup if available

---

*Security analysis generated on 2026-01-09 from comprehensive code review*
