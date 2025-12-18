@echo off
cd /d "%~dp0"
cloudflared.exe --config config.yml tunnel run
