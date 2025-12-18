# Deployment Guide

This guide covers the steps to deploy the NEPSE Stock Website to a self-hosted production environment using Node.js and PM2.

## Prerequisites

- **Node.js**: v18 or higher (LTS recommended)
- **npm**: Included with Node.js
- **Git**: To clone the repository
- **PM2**: Process manager (install globally: `npm install -g pm2`)

## 1. Build & Setup

### A. Clone and Install
```bash
# Clone the repository
git clone <repository-url>
cd nepse-stock-website

# Install all dependencies (frontend & backend)
npm run install:all
```

### B. Configure Environment
Create a `.env` file in the `backend/` directory with production values:

**File: `backend/.env`**
```env
NODE_ENV=production
PORT=5000
# Add your other secrets here (e.g., Google Service Account if used)
```

### C. Build Frontend
Compile the React frontend into static files:
```bash
npm run build:frontend
```
This creates a `frontend/dist` directory which the backend will serve.

## 2. Running in Production

### Option A: Manual Run (Testing)
To verify everything is working without background processes:
```bash
npm run start:prod
```
Access the app at `http://localhost:5000`. Stop with `Ctrl+C`.

### Option B: Using PM2 (Recommended)
Use PM2 to keep the application running in the background, restart on crashes, and manage logs.

#### Start the backend
```bash
cd backend
npm run pm2:start
```

#### Common Commands
| Action | Command |
|--------|---------|
| **Check Status** | `npm run pm2:status` |
| **View Logs** | `npm run pm2:logs` |
| **Restart** | `npm run pm2:restart` |
| **Stop** | `npm run pm2:stop` |
| **Delete** | `npm run pm2:delete` |

## 3. Accessing Your Application

### Local Access
- **On the server**: [http://localhost:5000](http://localhost:5000)
- **On your local network**: `http://<server-local-ip>:5000`
  - Find server IP: `ipconfig` (Windows) or `ip addr` (Linux)

### Public Access (via Cloudflare Tunnel)
If you set up Cloudflare Tunnel:
1. Find your tunnel URL using the methods in [CLOUDFLARE_TUNNEL.md](./CLOUDFLARE_TUNNEL.md#finding-your-tunnel-url)
2. Ensure your `config.yml` and `credentials/` folder are in the project root.
3. Share this URL to access your site from anywhere
4. Example: `https://nepse.yourdomain.com` or `https://random-name.trycloudflare.com`

### Verifying Deployment
Open your public URL and check:
- [ ] Homepage loads with market summary
- [ ] Stock table displays data
- [ ] Navigation works (Top Movers, IPOs, Stock Detail)
- [ ] Search functionality works
- [ ] Market status badge shows correct state
- [ ] Real-time updates work (wait 10 seconds, data should refresh)
- [ ] No errors in browser console (F12 → Console tab)

## 4. Exposing to the Internet

To make your application accessible from anywhere securely without port forwarding:
👉 **[Cloudflare Tunnel Setup Guide](./CLOUDFLARE_TUNNEL.md)**

Alternative methods:
- **Port Forwarding**: Open port 5000 on your router (less secure).
- **Reverse Proxy**: Use Nginx/Apache to proxy requests to port 5000.

## 5. Troubleshooting

**Check Logs**
If the app isn't working, check the live logs:
```bash
cd backend
npm run pm2:logs
```

**Check Process Status**
Ensure the backend is `online`:
```bash
cd backend
npm run pm2:status
```

**Common Issues**
- **Port in use**: Change `PORT` in `backend/.env` if 5000 is taken.
- **Frontend not loading**: Ensure you ran `npm run build:frontend` successfully.
- **Permissions**: Ensure the user has write permissions to the `backend/logs` directory.

## 6. Auto-Start on Boot

Ensure the application starts automatically when the server reboots.

### Windows Setup

1.  **Run the Installer**:
    Double-click `scripts/install-windows-autostart.bat`.
    *This will automatically save your PM2 process list and create a shortcut in your Startup folder.*

2.  **Verify**:
    - Press `Win + R`, type `shell:startup`, and check that `NEPSE_AutoStart` exists.


### Linux Setup

1.  **Run the Setup Script**:
    ```bash
    chmod +x scripts/linux-systemd-setup.sh
    ./scripts/linux-systemd-setup.sh
    ```
    Follow the on-screen instructions to finalize the PM2 startup hook.

### Troubleshooting Auto-Start

**Diagnose Issues**
- **Windows**: Check logs at `logs/startup.log` and `logs/startup-error.log`.
    - Verify script is in Startup: `Win+R` -> `shell:startup`.
    - Validation: Run `scripts/windows-startup.bat` manually to see if it errors.
- **Linux**: Check service status and logs.
    - Status: `systemctl status nepse-backend`
    - Logs: `journalctl -u nepse-backend -f` or `journalctl -u cloudflared-nepse -f`
    - Verify Service: `ls -l /etc/systemd/system/nepse-backend.service`

**Common Problems**
- **PM2 not in PATH**: The script tries to find PM2, but if installed in a custom location, you may need to edit the script.
- **Node.js Missing**: Ensure Node.js is accessible to the user running the script.
- **Environment Variables**: Use absolute paths in `.env` or ensure `EnvironmentFile` is correctly loaded in systemd.
- **"Resurrect" failing**: Run `pm2 save` manually once to create the dump file.

**Disable Auto-Start**
- **Windows**: Remove the shortcut from `shell:startup`.
- **Linux**:
    ```bash
    sudo systemctl disable nepse-backend
    sudo systemctl disable cloudflared-nepse
    ```
