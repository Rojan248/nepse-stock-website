#!/bin/bash
# linux-systemd-setup.sh - Setup Systemd services for NEPSE Stock Website

# Exit on error
set -e

# Configuration
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
USER_NAME=$(whoami)
PM2_PATH=$(which pm2 || echo "/usr/local/bin/pm2")
CLOUDFLARED_PATH=$(which cloudflared || echo "/usr/local/bin/cloudflared")

# Verify PM2 installation
if ! command -v pm2 &> /dev/null && [ ! -x "$PM2_PATH" ]; then
    echo "ERROR: PM2 is not installed or not found at $PM2_PATH"
    echo "Please install PM2 globally: npm install -g pm2"
    exit 1
fi

echo "Setting up Auto-Start for NEPSE Stock Website..."
echo "App Directory: $APP_DIR"
echo "User: $USER_NAME"
echo "PM2 Path: $PM2_PATH"

# 1. Create Backend Service
echo "Creating /etc/systemd/system/nepse-backend.service..."

sudo bash -c "cat > /etc/systemd/system/nepse-backend.service <<EOF
[Unit]
Description=NEPSE Stock Backend (PM2)
After=network-online.target
Wants=network-online.target

[Service]
Type=forking
User=$USER_NAME
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
EnvironmentFile=-$APP_DIR/backend/.env
ExecStart=$PM2_PATH start $APP_DIR/backend/ecosystem.config.js --env production
ExecReload=$PM2_PATH reload all
ExecStop=$PM2_PATH stop all
Restart=always

[Install]
WantedBy=multi-user.target
EOF"

sudo chmod 644 /etc/systemd/system/nepse-backend.service

# 2. Create Cloudflare Tunnel Service (if config exists)
if [ -f "$APP_DIR/config.yml" ]; then
    echo "Config detected. Checking for cloudflared..."
    
    # Detect cloudflared path
    if command -v cloudflared &> /dev/null; then
        CLOUDFLARED_PATH=$(which cloudflared)
    elif [ ! -x "$CLOUDFLARED_PATH" ]; then
        echo "ERROR: cloudflared binary not found. Please install cloudflared."
        exit 1
    fi

    echo "Creating /etc/systemd/system/cloudflared-nepse.service..."
    sudo bash -c "cat > /etc/systemd/system/cloudflared-nepse.service <<EOF
[Unit]
Description=Cloudflare Tunnel for NEPSE
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$USER_NAME
WorkingDirectory=$APP_DIR
Environment=TUNNEL_CRED_FILE=$APP_DIR/credentials/tunnel-credentials.json
ExecStart=$CLOUDFLARED_PATH --config $APP_DIR/config.yml tunnel run
Restart=always
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF"
    sudo chmod 644 /etc/systemd/system/cloudflared-nepse.service
else
    echo "No config.yml found. Skipping Cloudflare Tunnel service."
fi

# 3. Enable and Start Services
echo "Reloading systemd..."
sudo systemctl daemon-reload

echo "Enabling nepse-backend.service..."
sudo systemctl enable nepse-backend.service
sudo systemctl start nepse-backend.service

if [ -f "$APP_DIR/config.yml" ]; then
    echo "Enabling cloudflared-nepse.service..."
    sudo systemctl enable cloudflared-nepse.service
    sudo systemctl start cloudflared-nepse.service
fi

# 4. PM2 Startup Hook Verification
echo ""
echo "----------------------------------------------------------------"
echo "IMPORTANT: PM2 Startup Hook"
echo "To ensure PM2 itself resurrects properly, run the following:"
echo ""
echo "1. Run this command to generate the startup hook:"
echo "   pm2 startup systemd -u $USER_NAME --hp $HOME"
echo ""
echo "2. Copy/Paste the command output by the above step and run it."
echo ""
echo "3. Finally, save the current process list:"
echo "   pm2 save"
echo "----------------------------------------------------------------"
echo "Setup Complete!"
