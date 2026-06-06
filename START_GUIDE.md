# nepse.me Start Guide

Quick reference for running the NEPSE stock platform locally and in production.

## Local Development

Start the backend:

```powershell
cd D:\nepse-stock-website\backend
npm run dev
```

Start the frontend in a second terminal:

```powershell
cd D:\nepse-stock-website\frontend
npm run dev
```

Open `http://localhost:3000`.

| Service | Default URL | Notes |
| --- | --- | --- |
| Frontend | `http://localhost:3000` | Vite dev server |
| Backend API | `http://localhost:5000/api` | Express server |
| API health | `http://localhost:5000/api/health` | Direct backend health endpoint |

The frontend proxies `/api` to `http://localhost:5000`, so browser calls can stay relative.

## Prerequisites

1. Node.js 18 or newer.
2. Backend dependencies installed in `backend/node_modules`.
3. Frontend dependencies installed in `frontend/node_modules`.
4. `backend/.env` created from [backend/.env.example](backend/.env.example).
5. Prisma client generated with `cd backend && npx prisma generate`.

## Production Single-Process Mode

Build the frontend:

```powershell
cd D:\nepse-stock-website\frontend
npm run build
```

Start the backend so it serves both `frontend/dist` and the API:

```powershell
cd D:\nepse-stock-website\backend
$env:PORT='3000'
$env:NODE_ENV='production'
node src/server.js
```

Verify:

```powershell
(Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 20).StatusCode
```

Expected status: `200`.

## Cloudflare Tunnel

Do not put tunnel tokens in tracked files. Store them in an environment variable or ignored local config.

```powershell
cd D:\nepse-stock-website
$env:CLOUDFLARED_TOKEN='paste-token-from-local-secret-store'
.\cloudflared.exe tunnel run --token $env:CLOUDFLARED_TOKEN
```

If you prefer a config file, keep it under an ignored path such as `cloudflared/config.yml`.

## One-Terminal Production Helper

This starts the backend in a background PowerShell window and keeps the tunnel in the foreground:

```powershell
cd D:\nepse-stock-website
Start-Process -WindowStyle Hidden powershell -ArgumentList "-Command", "cd D:\nepse-stock-website\backend; `$env:PORT='3000'; `$env:NODE_ENV='production'; node src/server.js"
.\cloudflared.exe tunnel run --token $env:CLOUDFLARED_TOKEN
```

## Shutdown

```powershell
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
```

## Verification

```powershell
cd D:\nepse-stock-website
npm run verify
```

For broader running-server checks:

```powershell
cd D:\nepse-stock-website\backend
npm run stable
```

## Optional AI Summary Scaffold

AI summaries are disabled by default. The backend exposes scaffold endpoints under `/api/ai-summaries`, but no frontend summary UI is active.

To enable later, configure the backend intentionally:

```powershell
$env:AI_SUMMARIES_ENABLED='true'
$env:AI_SUMMARIES_PROVIDER='deepseek'
$env:DEEPSEEK_API_KEY='read-from-local-secret-store'
```

Review cost limits, compliance, and output quality before exposing any AI-generated market text to users.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Frontend shows API errors | Backend is running on `5000`; Vite proxy is active |
| `502 Bad Gateway` from `nepse.me` | Production backend is not running on the tunnel target port |
| Blank page in production | Rebuild `frontend/dist`, restart backend |
| Admin endpoint returns `500` | `ADMIN_API_KEY` is missing in backend environment |
| Admin endpoint returns `401` | Send the configured key in `x-admin-key` |
| Database/client error | Run `cd backend && npx prisma generate` |
| Cloudflare token exposed | Rotate the token immediately, remove it from Git, then purge old refs if it was pushed |

## Architecture Shortcut

```text
Browser -> Vite dev server -> /api proxy -> Express -> Prisma -> SQLite
Browser -> nepse.me -> Cloudflare Tunnel -> Express production process -> frontend/dist + API
```

Read [ARCHITECTURE.md](ARCHITECTURE.md) and [docs/CODEBASE_MAP.md](docs/CODEBASE_MAP.md) for the full linked map.
