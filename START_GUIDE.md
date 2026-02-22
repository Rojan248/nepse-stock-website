# nepse.me — Start Guide

Quick reference to get **nepse.me** back online from scratch.

---

## Prerequisites

- Node.js 18+ installed
- `cloudflared.exe` present at `nepse-stock-website\cloudflared.exe`
- Backend dependencies installed (`nepse-stock-website\backend\node_modules`)
- Frontend already built (`nepse-stock-website\frontend\dist`)

---

## Step 1 — Start the Backend Server

Open a terminal in the workspace root (`C:\Users\Rojan\Desktop\nepse-stock-website`):

```powershell
cd nepse-stock-website\backend
$env:PORT='3000'
$env:NODE_ENV='production'
node src/server.js
```

Wait until you see `Server running on http://0.0.0.0:3000`.

> **Verify:** `http://localhost:3000` should show the website.  
> **Health check:** `http://localhost:3000/api/health` should return `{"success":true, ...}`.

---

## Step 2 — Start the Cloudflare Tunnel

Open a **second** terminal in the workspace root:

```powershell
cd C:\Users\Rojan\Desktop\nepse-stock-website
.\nepse-stock-website\cloudflared.exe tunnel run --token eyJhIjoiYjI3M2E4YzM3NjUxZDk4YWNhMjY1YWZlOWIyM2RjYTkiLCJ0IjoiYjA5NmFlMzQtNTEyYi00MTlmLThhOWQtMzUyZGExOWU2YTA0IiwicyI6Ik1EY3haamRpTXpJdE5EQmtNQzAwTm1VM0xUbG1OekV0TWpWa09EVTRZekV3WW1RMiJ9
```

Wait for `Registered tunnel connection` messages (4 connections = fully online).

> The `cert.pem` warning is **normal** in token-based mode — ignore it.

---

## Step 3 — Verify nepse.me

Open a browser or run:

```powershell
(Invoke-WebRequest -Uri "https://nepse.me" -UseBasicParsing -TimeoutSec 20).StatusCode
# Expected: 200
```

---

## One-Liner (Quick Start)

Run both in the same PowerShell (server backgrounds, tunnel foreground):

```powershell
cd C:\Users\Rojan\Desktop\nepse-stock-website
Start-Process -NoNewWindow powershell -ArgumentList "-Command", "cd nepse-stock-website\backend; `$env:PORT='3000'; `$env:NODE_ENV='production'; node src/server.js"
.\nepse-stock-website\cloudflared.exe tunnel run --token eyJhIjoiYjI3M2E4YzM3NjUxZDk4YWNhMjY1YWZlOWIyM2RjYTkiLCJ0IjoiYjA5NmFlMzQtNTEyYi00MTlmLThhOWQtMzUyZGExOWU2YTA0IiwicyI6Ik1EY3haamRpTXpJdE5EQmtNQzAwTm1VM0xUbG1OekV0TWpWa09EVTRZekV3WW1RMiJ9
```

---

## Shutdown

```powershell
Get-Process -Name node -EA SilentlyContinue | Stop-Process -Force
Get-Process -Name cloudflared -EA SilentlyContinue | Stop-Process -Force
```

---

## Rebuild Frontend (if source changes)

```powershell
cd nepse-stock-website\frontend
npm run build
```

Then restart the backend (Step 1).

---

## Architecture

```
Browser → nepse.me → Cloudflare Tunnel → localhost:3000 → Express (serves frontend + API)
```

| Component       | Port | Notes                              |
|-----------------|------|------------------------------------|
| Backend/Express | 3000 | Serves static frontend + REST API  |
| Cloudflare      | —    | Token-based tunnel to nepse.me     |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Blank white page | Rebuild frontend: `cd frontend && npm run build`, restart backend |
| 502 Bad Gateway | Backend not running — start Step 1 first |
| CORS errors in console | Backend `.env` should have `CORS_ORIGIN=*` |
| `cert.pem` warning | Normal for token auth — safe to ignore |
