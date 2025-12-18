@echo off
setlocal enabledelayedexpansion
:: windows-startup.bat - Auto-start script for NEPSE Stock Website
:: Place shortcut to this file in shell:startup

:: -- Resolve Paths --
:: %~dp0 includes a trailing backslash
set "SCRIPT_DIR=%~dp0"
:: Resolve Project Root (removing 'scripts\')
pushd "%SCRIPT_DIR%.."
set "PROJECT_ROOT=%CD%"
popd

set "LOG_DIR=%PROJECT_ROOT%\logs"
set "LOG_FILE=%LOG_DIR%\startup.log"
set "ERR_FILE=%LOG_DIR%\startup-error.log"

:: -- Initialize Logging --
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
echo ================================================== >> "%LOG_FILE%"
echo [%DATE% %TIME%] Starting NEPSE Auto-Start Script >> "%LOG_FILE%"
echo Script Dir: "%SCRIPT_DIR%" >> "%LOG_FILE%"
echo Project Root: "%PROJECT_ROOT%" >> "%LOG_FILE%"
echo User: %USERNAME% >> "%LOG_FILE%"

:: -- Change Directory --
cd /d "%PROJECT_ROOT%"
if errorlevel 1 (
    echo [%DATE% %TIME%] FATAL: Failed to navigate to project root. >> "%ERR_FILE%"
    echo Failed to navigate to project root.
    pause
    exit /b 1
)

:: -- Find PM2 --
set "PM2_CMD=pm2"
where pm2 >nul 2>nul
if errorlevel 1 (
    echo [WARNING] Global PM2 not found, checking local... >> "%LOG_FILE%"
    if exist "%PROJECT_ROOT%\backend\node_modules\.bin\pm2.cmd" (
        set "PM2_CMD=%PROJECT_ROOT%\backend\node_modules\.bin\pm2.cmd"
        echo [INFO] Using local PM2: !PM2_CMD! >> "%LOG_FILE%"
    ) else (
        echo [ERROR] PM2 not found anywhere! >> "%ERR_FILE%"
        echo PM2 not found. Please install dependencies.
        pause
        exit /b 1
    )
)

:: -- Wait for System Initialization --
:: Only wait if we are running at boot (hard to detect, but safe to keep short)
echo Waiting for system... >> "%LOG_FILE%"
timeout /t 5 /nobreak >nul

:: -- Start Backend --
cd backend
echo Starting PM2... >> "%LOG_FILE%"
call "%PM2_CMD%" resurrect >> "%LOG_FILE%" 2>> "%ERR_FILE%"
if errorlevel 1 (
    echo [WARNING] Resurrect failed, trying manual start... >> "%ERR_FILE%"
    call "%PM2_CMD%" start ecosystem.config.js >> "%LOG_FILE%" 2>> "%ERR_FILE%"
)

:: -- Start Tunnel --
cd ..
if exist "config.yml" (
    where cloudflared >nul 2>nul
    if errorlevel 1 (
        echo [ERROR] cloudflared not found on PATH! >> "%ERR_FILE%"
        echo [ERROR] cloudflared not found on PATH!
        pause
        exit /b 1
    )
    echo Starting Cloudflare Tunnel... >> "%LOG_FILE%"
    set "TUNNEL_CRED_FILE=%PROJECT_ROOT%\credentials\tunnel-credentials.json"
    start "" /B cmd /c "cloudflared --config config.yml --credentials-file \"%TUNNEL_CRED_FILE%\" tunnel run >> \"%LOG_DIR%\tunnel.log\" 2>&1"
)

:: -- Save State --
cd backend
call "%PM2_CMD%" save --force >> "%LOG_FILE%" 2>> "%ERR_FILE%"

echo Startup Complete. >> "%LOG_FILE%"
endlocal
