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
3. Move it to the project root.

## 2. Authenticate

Run this command to login to your Cloudflare account:
```bash
.\cloudflared.exe tunnel login
```
A browser window will open. Select the domain you want to link.

## 3. Create a Tunnel

Create a new tunnel with a name (e.g., `nepse-prod-v2`):
```bash
.\cloudflared.exe tunnel create nepse-prod-v2
```

## 4. Configure the Tunnel

Create a configuration file named `config.yml` in the `cloudflared/` directory.

```yaml
tunnel: <YOUR-TUNNEL-ID>
credentials-file: cloudflared/<YOUR-TUNNEL-ID>.json

ingress:
  - hostname: nepse.me
    service: http://localhost:5000
  - hostname: api.nepse.me
    service: http://localhost:5000
  - service: http_status:404
```

## 5. Route DNS

```bash
.\cloudflared.exe tunnel route dns nepse-prod-v2 nepse.me
.\cloudflared.exe tunnel route dns nepse-prod-v2 api.nepse.me
```

## 6. Run the Tunnel

```bash
.\cloudflared.exe --config .\cloudflared\config.yml tunnel run
```

## 7. Run as a Service (Background)

### Windows
```cmd
.\cloudflared.exe --config .\cloudflared\config.yml service install
```
Open "Services" (Win+R -> `services.msc`) and start "Cloudflare Tunnel agent".

## Finding Your Tunnel URL

Your site is configured at:
👉 **[https://nepse.me](https://nepse.me)**
