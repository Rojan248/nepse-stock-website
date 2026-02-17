## 2026-02-17 - [Missing Security Middleware Implementation]
**Vulnerability:** The Express server lacked basic security headers (Helmet) and global rate limiting despite having the dependencies installed.
**Learning:** Presence of security dependencies in `package.json` does not guarantee their usage. Always verify implementation in the server entry point.
**Prevention:** Implement automated integration tests that check for required security headers on health/status endpoints.
