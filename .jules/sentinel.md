## 2026-02-19 - Testing Architecture Gap Hides Vulnerabilities
**Vulnerability:** Global middleware (Helix, Rate Limiting) was completely missing from `backend/src/server.js`, despite dependencies being present.
**Learning:** Existing integration tests created their own express app instances and mounted routers directly, completely bypassing `server.js` and its middleware configuration. This created a false sense of security as tests passed but the production server was vulnerable.
**Prevention:** Always include at least one test that imports the actual application entry point (`server.js` or `app.js`) to verify global middleware configuration, rather than just testing isolated routers.
