# Cloudflare Tunnel Setup Guide

Cloudflare Tunnel (formerly Argo Tunnel) allows you to expose your local NEPSE app to the internet without opening ports on your router. It's free, secure, and includes automatic HTTPS.

## Prerequisites

- A [Cloudflare](https://dash.cloudflare.com/sign-up) account (free).
- A domain name added to Cloudflare.
- Access to your server/computer terminal.

## 1. Install Cloudflared

### Windows
1. Download `cloudflared-windows-amd64.exe` from the [Downloads page](https://github.com/cloudflare/cloudflared/releases).
2. Rename it to `cloudflared.exe`.
3. Move it to a folder (e.g., `C:\cloudflared\`) and add that folder to your System PATH environment variable.
4. Verify installation:
   ```cmd
   cloudflared --version
   ```

### Linux
```bash
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
cloudflared --version
```

## 2. Authenticate

Run this command to login to your Cloudflare account:
```bash
cloudflared tunnel login
```
A browser window will open. Select the domain you want to link.

## 3. Create a Tunnel

Create a new tunnel with a name (e.g., `nepse-tunnel`):
```bash
cloudflared tunnel create nepse-tunnel
```
**Save the Tunnel ID** shown in the output (a long UUID).

## 4. Configure the Tunnel

Create a configuration file named `config.yml` in the project root directory. **Do not commit your credentials file to version control.**

Paste the following content (replace placeholders):

```yaml
tunnel: <YOUR-TUNNEL-ID>
credentials-file: /path/to/your/credentials.json

ingress:
  # Map your chosen subdomain to the local app port
  - hostname: nepse.yourdomain.com
    service: http://localhost:5000
    
  # Catch-all rule (required)
  - service: http_status:404
```

### Security Best Practices
1. **Environment Variables**: You can avoid hardcoding the credentials path by setting the `TUNNEL_CRED_FILE` environment variable.
2. **Secret Management**: Store your credentials in a secure vault (like AWS Secrets Manager or HashiCorp Vault) and inject them at runtime.
3. **Git Ignore**: Ensure `credentials/` and `config.yml` are in your `.gitignore`.
4. **Rotation**: If your credentials are ever exposed, rotate them immediately in the Cloudflare dashboard.

## 5. Route DNS

Tell Cloudflare to send traffic for your subdomain to this tunnel:
```bash
cloudflared tunnel route dns nepse-tunnel nepse.yourdomain.com
```

## 6. Run the Tunnel

Start the tunnel to make your site live:
```bash
cloudflared tunnel run nepse-tunnel
```
Visit `https://nepse.yourdomain.com` to verify.

## 7. Run as a Service (Background)

To keep the tunnel running even after you close the terminal:

### Windows
```cmd
cloudflared service install
```
Open "Services" (Win+R -> `services.msc`) and start "Cloudflare Tunnel agent".

### Linux
```bash
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

## Finding Your Tunnel URL

Your site is permanently configured at:
👉 **[https://nepse.me](https://nepse.me)** *(Note: This is the project's real production URL)*

(The background service `Cloudflared` handles this connection automatically).

### Setup Details (Reference)
- **Tunnel Name**: `nepse-tunnel`
- **Domain**: `nepse.me`
- **Service Name**: `Cloudflared` (Windows Service)
- **Config File**: `./config.yml` (Use placeholders)
- **Credentials**: Managed via environment variables or secure local storage (not committed)

## Troubleshooting

**"Bad Gateway" or 502 Error:**
- Make sure your backend is running: `npm run pm2:status`
- Restart backend: `npm run pm2:restart`

**Tunnel not working:**

#### Windows (PowerShell)
- Check service status: `Get-Service Cloudflared`
- Restart service: `Restart-Service Cloudflared`

#### Linux
- Check service status: `systemctl status cloudflared`
- Restart service: `sudo systemctl restart cloudflared`
