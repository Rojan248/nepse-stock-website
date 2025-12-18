# Quick Reference Guide

## Common Commands

### Development
```bash
# Install all dependencies
npm run install:all

# Run backend (development)
cd backend && npm run dev

# Run frontend (development)
cd frontend && npm run dev
```

### Production
```bash
# Build frontend
npm run build:frontend

# Start backend with PM2
cd backend && npm run pm2:start

# Check PM2 status
npm run pm2:status

# View logs
npm run pm2:logs

# Restart backend
npm run pm2:restart

# Stop backend
npm run pm2:stop
```

### Cloudflare Tunnel
```bash
# Run tunnel (foreground)
cloudflared tunnel run nepse-tunnel

# Run tunnel (background - Windows)
Start-Process cloudflared -ArgumentList "tunnel", "run", "nepse-tunnel" -WindowStyle Hidden

# Check tunnel info
cloudflared tunnel info nepse-tunnel

# List all tunnels
cloudflared tunnel list
```

## Important URLs

- **Local backend:** http://localhost:5000
- **Local frontend (dev):** http://localhost:3000
- **PM2 Web UI:** `pm2 web` (then open http://localhost:9615)
- **Cloudflare Dashboard:** https://one.dash.cloudflare.com/
- **Your public URL:** [Find it here](./CLOUDFLARE_TUNNEL.md#finding-your-tunnel-url)

## File Locations

| File | Location |
|------|----------|
| Backend logs | `backend/logs/` |
| PM2 logs | `backend/logs/pm2-*.log` |
| Environment file | `backend/.env` |
| Cloudflare config | `./config.yml` (Template) |
| Tunnel Credentials | Managed via environment variables |
| Built frontend | `frontend/dist/` |

## Troubleshooting Quick Checks

**Site not loading:**
1. Is backend running? `npm run pm2:status`
2. Check logs: `npm run pm2:logs`
3. Test locally: `curl http://localhost:5000`

**Cloudflare Tunnel not working:**
1. Is tunnel running? Check cloudflared terminal
2. Is backend running? Check PM2 status
3. Check tunnel URL in Cloudflare dashboard

**Data not updating:**
1. Check backend logs for errors
2. Verify NEPSE API is responding
3. Check market status (market closed on Fri/Sat)
