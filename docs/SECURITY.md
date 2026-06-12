# Security Architecture & Analysis

> Current security posture, active mitigations, and hardening implementation details.
> Based on: Full-stack security audit and hardening completed on June 6, 2026.

---

## 1. Security Overview

The NEPSE Stock Website is designed with a defense-in-depth security model to protect the backend Express API and the React frontend.

| Security Area | Status | Details |
|------|--------|---------|
| **Data Exposure** | ✅ Safe | All displayed market data is public NEPSE information. |
| **XSS Protection** | ✅ Secure | React escapes rendered content by default. Input sanitization applied to `displayName` (HTML tag stripping). |
| **SQL Injection** | ✅ Secure | Prisma ORM parameterizes all database queries. No raw SQL concatenation. |
| **Path Traversal** | ✅ Secure | Filesystem access is strictly controlled with no user-input interpolation. |
| **CORS** | ✅ Hardened | Whitelist-based CORS configuration. Permissive wildcard origins are banned. |
| **Rate Limiting** | ✅ Tiered | Global limiters, specific login limits, registration limits, and token refresh limits are in place. |
| **Authentication** | ✅ Secure | Short-lived access tokens (15m) + secure rotating httpOnly Refresh Cookies. |
| **Data Protection** | ✅ Encrypted | Passwords hashed with bcrypt (12 rounds). Refresh tokens stored as SHA-256 hashes in SQLite. |
| **Account Protection** | ✅ Lockout | Brute-force lockout blocks accounts after 10 failed login attempts for 30 minutes. |
| **DoS Mitigation** | ✅ Clamped | Query parameters (`skip`, `limit`, `days`, `hours`) clamped to reasonable maximums. Max JSON body size is capped at 1MB. |

---

## 2. Hardening Configurations

### 2.1 Password and Input Policies (V9, V12)
- **Password Complexity**: Enforces 12-72 bytes, requiring at least 1 uppercase letter, 1 lowercase letter, and 1 digit. The 72-byte ceiling avoids bcrypt's input truncation edge case.
- **Display Name Sanitization**: Rejects/strips HTML tags and restricts the length of the `displayName` field to 80 characters to prevent database bloating or stored XSS.

### 2.2 Token Protection (V2, V3, V8, V13)
- **Token Storage**: Access tokens are kept in-memory (React refs) and never saved to persistent storage. Refresh tokens are kept in secure, httpOnly cookies.
- **No LocalStorage PII**: LocalStorage only stores minimal user data (`id` and `displayName`). Privileges (`role`) and PII (`email`) are retrieved in-memory via `/api/auth/me`.
- **Database Refresh Hashing**: SQLite database stores a SHA-256 hash of the refresh token. If the SQLite database file is stolen, the attacker cannot regenerate sessions.
- **Token Flooding Cap**: Active sessions are capped at 5 per user. Any login beyond 5 deletes the oldest active session.
- **Host-Prefixed Production Cookie**: Production refresh cookies use `__Host-refreshToken` with `Secure`, `HttpOnly`, `SameSite=Strict`, and `Path=/`. Production refresh/logout handlers intentionally ignore the legacy unprefixed cookie name to prevent sibling-domain cookie tossing.
- **Public Share Hardening**: New public watchlist share links use 128-bit random slugs, and unauthenticated shared-watchlist lookups have a dedicated throttle to reduce brute-force probing.

### 2.3 Rate Limiting & DoS Clamps (V4, V5, V10, V11)
- **Global Limiter**: 100 requests/minute/IP.
- **Login Limiter**: 5 attempts per 15 minutes/IP.
- **Registration Limiter**: 3 accounts per hour/IP.
- **Refresh Limiter**: 10 refreshes per 15 minutes/IP.
- **Proxy Trust**: `TRUST_PROXY` defaults to `false`. Enable it only behind a trusted reverse proxy so clients cannot spoof `X-Forwarded-For` and bypass IP limiters.
- **Payload Clamping**: `express.json()` request body sizes are capped at 1MB (reduced from 10MB) to mitigate memory exhaustion.
- **Query Parameter Clamping**: `clampInt` utility sanitizes and bounds query parameters:
  - `limit` → clamped between 1 and 500
  - `skip` → clamped between 0 and 10,000
  - `days` → clamped between 1 and 365
  - `hours` → clamped between 1 and 720

### 2.4 Account Lockout Mechanism (V17)
To prevent distributed credential-stuffing attacks:
- The user schema maintains `failedLoginAttempts` (Int), `lockedUntil` (DateTime), and `accessTokenVersion` (Int).
- 10 consecutive password failures will lock the account for 30 minutes.
- The lockout countdown resets completely upon successful login.
- Logout and lockout increment `accessTokenVersion`, causing older access tokens to fail server-side validation before their JWT expiry.

---

## 3. Environment Variable Security

### Required in Backend `.env`
Ensure all production environments contain secure, cryptographically random keys:
```env
PORT=5000
NODE_ENV=production
DATABASE_URL="file:./prisma/dev.db"

# Minimum 32-character secure strings
ADMIN_API_KEY=your-random-api-key-here
JWT_SECRET=your-jwt-signing-secret-here
```

### Validate at Startup
The application automatically halts in production if `ADMIN_API_KEY` or `JWT_SECRET` is missing, matches known defaults, or falls below the minimum length of 32 characters. In development, provided weak values are still rejected so accidental insecure local deployments fail fast.

---

## 4. HTTPS & Production Deployments

Always run the node server behind a secure reverse proxy (e.g., Nginx, Cloudflare) that enforces TLS 1.3, HSTS headers, and drops overly large HTTP payloads.

---

*Security documentation updated: June 6, 2026*
