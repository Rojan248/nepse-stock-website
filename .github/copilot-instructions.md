# Copilot Instructions

This repository is the NEPSE Stock Website, not a Python/uvicorn service.

Before changing code, read:

1. [../AGENTS.md](../AGENTS.md)
2. [../ARCHITECTURE.md](../ARCHITECTURE.md)
3. [../docs/CODEBASE_MAP.md](../docs/CODEBASE_MAP.md)

## Project Shape

| Area | Path |
| --- | --- |
| Backend API | `backend/` |
| Backend entry point | `backend/src/server.js` |
| Database schema | `backend/prisma/schema.prisma` |
| Frontend app | `frontend/` |
| Frontend route shell | `frontend/src/App.jsx` |
| Frontend API client | `frontend/src/services/api.js` |

## Local Verification

Use the narrowest verification that matches the change:

```powershell
cd backend
npm test
```

```powershell
cd frontend
npm test -- --run
npm run build
```

```powershell
cd D:\nepse-stock-website
npm run verify
```

## Safety Rules

1. Do not commit `.env`, database files, logs, Cloudflare tokens, API keys, or generated runtime JSON.
2. Keep admin mutations behind `adminLimiter` and `requireAdminKey`.
3. Keep user-owned reads and writes scoped by `req.user.userId`.
4. Keep AI summaries disabled unless the owner intentionally enables and reviews them.
5. Update architecture and API docs when route shape, storage, or module ownership changes.
