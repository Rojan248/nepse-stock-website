# Production Deployment Checklist

Use this checklist to ensure a successful and secure deployment.

## Pre-Deployment
- [ ] **Code**: All changes committed and pushed to Git.
- [ ] **Clean Install**: `node_modules` are clean (`npm run install:all`).
- [ ] **Build**: `npm run build:frontend` completes without errors.
- [ ] **Environment**: `backend/.env` created with `NODE_ENV=production`.
- [ ] **Port**: Confirmed `PORT=5000` (or custom) is free.

## Server Setup
- [ ] **Prerequisites**: Node.js LTS, npm, Git, PM2 installed.
- [ ] **Firewall**: Configured to block unnecessary ports.
- [ ] **User**: Running as a standard user (not root/admin) if possible.
- [ ] **Logs**: `backend/logs` directory exists and is writable.

## Process Management
- [ ] **PM2 Config**: `ecosystem.config.js` is present in `backend/`.
- [ ] **Start**: Application starts with `npm run pm2:start`.
- [ ] **Status**: `npm run pm2:status` shows status `online` and 0 restarts initially.
- [ ] **Persistence**: (Optional) Run `pm2 save` to dump process list for auto-resurrection.

## Internet Exposure
- [ ] **Cloudflare Tunnel**: Tunnel installed and authenticated.
- [ ] **Config**: `config.yml` points to `localhost:5000`.
- [ ] **DNS**: Route created for `nepse.yourdomain.com`.
- [ ] **Service**: Cloudflared running as a service (daemon).

## Post-Deployment Verification
- [ ] **Access**: Site loads at the public URL (https://...).
- [ ] **API**: Stock data loads correctly on the dashboard.
- [ ] **Navigation**: Clicking links works (Client-side routing).
- [ ] **Refresh**: Refreshing a sub-page (e.g., `/stock/NABIL`) keeps you on that page (Server catch-all works).
- [ ] **Real-time**: Data updates automatically (check network calls or UI).
- [ ] **Error Logs**: `npm run pm2:logs` shows no critical errors.

## Emergency & Maintenance
- [ ] **Monitoring**: Set up a simple uptime monitor (e.g., UptimeRobot).
- [ ] **Backup**: Schedule defined for `backend/data`.
- [ ] **Updates**: Plan for monthly `npm audit` and OS updates.
