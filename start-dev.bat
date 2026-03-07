@echo off
title NEPSE Stock Website - Dev Launcher
color 0A

echo.
echo  ============================================
echo   NEPSE Stock Website - Local Dev Launcher
echo  ============================================
echo.

:: Resolve project root from script location
set "PROJECT_ROOT=%~dp0"
:: Remove trailing backslash
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"

:: Check node is installed
where node >nul 2>nul
if errorlevel 1 (
    color 0C
    echo  [ERROR] Node.js is not installed or not in PATH.
    echo  Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

:: Check if dependencies are installed
if not exist "%PROJECT_ROOT%\backend\node_modules" (
    echo  [!] Backend dependencies not found. Installing...
    cd /d "%PROJECT_ROOT%\backend"
    call npm install
    echo.
)

if not exist "%PROJECT_ROOT%\frontend\node_modules" (
    echo  [!] Frontend dependencies not found. Installing...
    cd /d "%PROJECT_ROOT%\frontend"
    call npm install
    echo.
)

echo  Starting Backend  (Express API)  ...
echo  Starting Frontend (Vite React)   ...
echo.
echo  -----------------------------------------------
echo   Backend  : http://localhost:3000
echo   Frontend : http://localhost:5173
echo  -----------------------------------------------
echo.
echo  Press Ctrl+C in either window to stop.
echo.

:: Start backend in a new terminal window
start "NEPSE Backend" cmd /k "cd /d ""%PROJECT_ROOT%\backend"" && npm run dev"

:: Small delay so windows don't fight over output
timeout /t 2 /nobreak >nul

:: Start frontend in a new terminal window
start "NEPSE Frontend" cmd /k "cd /d ""%PROJECT_ROOT%\frontend"" && npm run dev"

echo  Both servers launched in separate windows.
echo  You can close this window.
timeout /t 3 /nobreak >nul
