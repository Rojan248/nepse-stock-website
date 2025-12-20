@echo off
cd /d "%~dp0backend"
npx pm2 start ecosystem.config.js
