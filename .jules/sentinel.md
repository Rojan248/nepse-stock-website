## 2026-02-17 - [Missing Security Middleware Implementation]
**Vulnerability:** The Express server lacked basic security headers (Helmet) and global rate limiting despite having the dependencies installed.
**Learning:** Presence of security dependencies in `package.json` does not guarantee their usage. Always verify implementation in the server entry point.
**Prevention:** Implement automated integration tests that check for required security headers on health/status endpoints.

## 2026-02-19 - [Testing Architecture Gap Hides Vulnerabilities]
**Vulnerability:** Global middleware (Helmet, Rate Limiting) was completely missing from `backend/src/server.js`, despite dependencies being present.
**Learning:** Existing integration tests created their own express app instances and mounted routers directly, completely bypassing `server.js` and its middleware configuration. This created a false sense of security as tests passed but the production server was vulnerable.
**Prevention:** Always include at least one test that imports the actual application entry point (`server.js` or `app.js`) to verify global middleware configuration, rather than just testing isolated routers.

## 2026-02-20 - [Misleading Security Comments] ✅ RESOLVED
**Vulnerability:** The Admin API key validation explicitly commented on preventing timing attacks but used vulnerable string comparison (`===`) instead of constant-time comparison.
**Learning:** Security comments can be misleading. Always verify the implementation matches the intent described in comments. Code reviews should specifically check that security claims in comments are actually implemented.
**Prevention:** Use `crypto.timingSafeEqual` for all secret comparisons. **Important caveat:** `timingSafeEqual` throws a `TypeError` if buffers have different byte lengths, and the length check itself is not constant-time (an attacker can learn whether the input length matched). Two safe patterns exist:
  1. **SHA-256 hashing (preferred, used in this codebase):** Hash both inputs with `crypto.createHash('sha256')` before comparing. SHA-256 digests are always 32 bytes, eliminating the length mismatch entirely and leaking zero information about the original input length. See `backend/src/middleware/auth.js` — `requireAdminKey`.
  2. **Buffer padding/normalization:** Convert both to Buffers, and if `byteLength` differs, perform a dummy `timingSafeEqual(input, Buffer.alloc(input.byteLength))` before returning `false`. This prevents timing leakage but is less clean than hashing.
**Resolution (2026-02-24):** Fixed by merging `sentinel-auth-timing-attack-fix` and `sentinel-auth-timing-fix` branches. The admin key validation in `backend/src/middleware/auth.js` now uses SHA-256 hashing + `crypto.timingSafeEqual`, with defensive `try/catch` error handling.
