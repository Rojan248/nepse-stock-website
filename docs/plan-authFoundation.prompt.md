# Plan: Auth Foundation — httpOnly Cookie Rework

The existing auth system stores both access + refresh tokens in `localStorage`, which exposes refresh tokens to XSS attacks. Phase 1 reworks this to store refresh tokens as **httpOnly cookies** (immune to JS access), keep access tokens **in memory only**, and add **login rate limiting** (5 req / 15 min / IP). The CORS middleware already has `credentials: true`, and the Vite proxy handles same-origin cookie passing in dev.

## Steps

### 1. Install `cookie-parser` in backend/package.json
Add `cookie-parser` dependency. This is needed for Express to read `req.cookies.refreshToken`.

### 2. Add `JWT_REFRESH_SECRET` to backend/.env
Add `JWT_REFRESH_SECRET=nepse-dev-jwt-refresh-secret-change-in-production` below the existing `JWT_SECRET` line. This keeps signing secrets separate for access vs refresh (future-proofing if refresh tokens ever become JWTs).

### 3. Wire `cookie-parser` into backend/src/server.js
`require('cookie-parser')` and add `app.use(cookieParser())` right after `express.json()` / `express.urlencoded()` — before any routes.

### 4. Add `loginLimiter` to backend/src/middleware/rateLimiter.js
Create a new `loginLimiter`: `windowMs: 15 * 60 * 1000` (15 min), `max: 5`, with a descriptive message about brute-force protection. Export it alongside the existing limiters.

### 5. Create cookie helper in backend/src/middleware/authMiddleware.js
- Add a `setRefreshCookie(res, token)` function that calls `res.cookie('refreshToken', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/auth', maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000 })`.
- Add a `clearRefreshCookie(res)` function that calls `res.clearCookie('refreshToken', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/auth' })`.
- Export both alongside existing exports.

### 6. Rework backend/src/routes/auth.js — 5 route changes:
- **Import** `loginLimiter` from rateLimiter and `setRefreshCookie` / `clearRefreshCookie` from authMiddleware.
- **POST /register**: After creating the refresh token, call `setRefreshCookie(res, refreshToken)`. Remove `refreshToken` from the JSON response body — only return `{ user, accessToken }`.
- **POST /login**: Apply `loginLimiter` middleware to this route (`router.post('/login', loginLimiter, ...)`). Call `setRefreshCookie(res, refreshToken)`. Remove `refreshToken` from JSON response body.
- **POST /refresh**: Read token from `req.cookies.refreshToken` instead of `req.body.refreshToken`. After token rotation, call `setRefreshCookie(res, newRefreshToken)`. Response returns `{ accessToken }` only (no refresh token in body). Also return user data in the response (`{ accessToken, user: { id, email, displayName, role } }`) so the frontend can hydrate user state on silent refresh.
- **POST /logout**: Read token from `req.cookies.refreshToken` instead of `req.body.refreshToken`. After DB deletion, call `clearRefreshCookie(res)`. Respond with `{ message: 'Logged out' }`.

### 7. Update frontend/src/services/api.js — enable credentials
Add `withCredentials: true` to the axios instance config. This ensures cookies are sent with every request (required for httpOnly cookie flow).

### 8. Rework frontend/src/hooks/useAuth.jsx — in-memory token storage:
- **Remove** `REFRESH_KEY` constant and all `localStorage.getItem/setItem/removeItem` calls for refresh tokens.
- **Access token storage**: Keep access token in a `useRef` (not state, to avoid unnecessary re-renders; not localStorage, to avoid XSS exposure). Expose via a getter so the interceptor can read it.
- **User state**: Keep in `useState` + `localStorage` (same as now) for initial hydration hint, but always verify via silent refresh on mount.
- **Request interceptor**: Read access token from the ref instead of localStorage.
- **Response interceptor (401 handler)**: On 401, call `POST /api/auth/refresh` with **no body** (cookie sends automatically via `withCredentials`). Extract `accessToken` + `user` from response. Update ref and user state. Retry original request.
- **On mount verification**: Instead of calling `/auth/me`, call `/auth/refresh` (silent refresh). If the cookie is valid, this returns a fresh `accessToken` + `user`. If it fails (no cookie or expired), log out. This handles page refreshes seamlessly.
- **`login()` / `register()`**: Store returned `accessToken` in ref (not localStorage). No `refreshToken` to handle — it's in the cookie.
- **`logout()`**: Call `POST /api/auth/logout` (cookie sent automatically). Clear the ref and user state. No localStorage cleanup for tokens.
- **Proactive refresh timer**: Optionally set a `setTimeout` for ~14 minutes (access token TTL is 15m) to silently refresh before expiry, reducing 401 retries.

### 9. Update frontend/src/pages/LoginPage.jsx and RegisterPage.jsx
No changes needed since they call `useAuth.login()` / `useAuth.register()` which are updated in step 8. Verify they still work correctly.

### 10. Update frontend/src/pages/HomePage.jsx
Verify watchlist sync still works. The watchlist API calls already use the axios instance which will now send cookies + Bearer token. No code changes expected.

### 11. Backward compatibility for existing tests:
- Review backend/tests/ for any tests that send `refreshToken` in request body — update them to use cookies (e.g., set `Cookie` header in test requests).
- The `security_headers.test.js` and `watchdog_security.test.js` likely don't test auth flow — verify and leave as-is if unaffected.

## Verification

- **Manual test 1**: Register a new user → inspect response (no `refreshToken` in JSON body). Check browser DevTools → Application → Cookies: `refreshToken` cookie should exist on `/api/auth` path, marked `HttpOnly`.
- **Manual test 2**: Close tab, reopen app → user should still be logged in (silent refresh via cookie on mount).
- **Manual test 3**: Wait 15+ minutes (or temporarily set access token expiry to 30s) → make an API call → should auto-refresh transparently.
- **Manual test 4**: Hit login endpoint 6 times rapidly → 6th request should return 429 rate limit error.
- **Manual test 5**: Open DevTools → Console → `document.cookie` should NOT contain `refreshToken` (httpOnly).
- **Run `npm test`** in both backend and frontend to verify no regressions.

## Decisions

- **Refresh tokens remain opaque DB-stored tokens** (not JWTs) — the `JWT_REFRESH_SECRET` env var is added for future use but current implementation keeps the more secure random-token-with-DB-lookup approach.
- **`sameSite: 'lax'`** chosen over `strict` — `strict` would break navigation from external links that need auth. `lax` is sufficient since the cookie path is scoped to `/api/auth`.
- **`secure: false` in dev** — localhost doesn't support HTTPS by default; this flag is `true` only in production.
- **Access token in `useRef`** rather than `useState` — avoids unnecessary re-renders when token rotates. User data stays in `useState` for UI reactivity.
- **Silent refresh on mount** replaces the current `/auth/me` call — one request instead of two, and it also renews the access token.


IMPORTANT — API KEY HANDLING:

Never hardcode any API keys, secrets, or credentials anywhere in the codebase.

All sensitive values must be stored in backend/.env:
  GEMINI_API_KEY= AIzaSyAjZ__oocPjz33OGO0MQWUEe66JmqWwTOEn 
  GEMINI_MODEL=gemini-2.5-flash
  GEMINI_MODEL_FALLBACK=gemini-2.0-flash
  JWT_SECRET=generate_random_256bit
  JWT_REFRESH_SECRET=generate_random_256bit
  ADMIN_API_KEY=your_existing_key
  AI_OVERVIEW_COOLDOWN_MINUTES=30

Rules:
- Access all keys via process.env.KEY_NAME only
- If a required env variable is missing at startup, throw a clear error:
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is required in .env')
- Add all new env variable names (without values) to backend/.env.example
- Never log env variable values, even in debug mode
- The .env file must never be committed — verify .gitignore includes it