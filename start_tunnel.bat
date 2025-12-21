@echo off
setlocal
cd /d "%~dp0"
echo Starting Cloudflare Tunnel...
.\cloudflared.exe --config .\cloudflared\config.yml tunnel run
pause
