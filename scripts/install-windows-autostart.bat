@echo off
setlocal
:: install-windows-autostart.bat - Installer for NEPSE Auto-Start

echo Installing NEPSE Auto-Start...

:: -- Resolve Absolute Paths --
set "SCRIPT_DIR=%~dp0"
pushd "%SCRIPT_DIR%.."
set "PROJECT_ROOT=%CD%"
popd

set "TARGET_SCRIPT=%SCRIPT_DIR%windows-startup.bat"
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\NEPSE_AutoStart.lnk"

echo Project Root: "%PROJECT_ROOT%"
echo Target Script: "%TARGET_SCRIPT%"
echo Shortcut Path: "%SHORTCUT_PATH%"

:: -- Save PM2 State (Try to find PM2) --
cd /d "%PROJECT_ROOT%\backend"
echo Saving PM2 state...

:: Try global, then local
call pm2 save --force >nul 2>nul
if errorlevel 1 (
    if exist "node_modules\.bin\pm2.cmd" (
        call node_modules\.bin\pm2.cmd save --force
    ) else (
        echo [WARNING] Could not run 'pm2 save'. Please ensure PM2 is running and installed.
    )
)

:: -- Create Shortcut (PowerShell) --
:: We simply set the Target. The path issue likely came from WorkingDirectory relative resolution in PS.
:: We will pass the ABSOLUTE path for Working Directory.

set "PS_CMD=$WS = New-Object -ComObject WScript.Shell; $S = $WS.CreateShortcut('%SHORTCUT_PATH%'); $S.TargetPath = '%TARGET_SCRIPT%'; $S.WorkingDirectory = '%PROJECT_ROOT%'; $S.Description = 'NEPSE Stock Auto-Start'; $S.Save()"

powershell -Command "%PS_CMD%"

if exist "%SHORTCUT_PATH%" (
    echo.
    echo [SUCCESS] Shortcut created in Startup folder.
    echo.
    echo Testing the startup script now...
    call "%TARGET_SCRIPT%"
) else (
    echo [ERROR] Failed to create shortcut.
)

pause
