@echo off
setlocal enabledelayedexpansion
echo ===================================================
echo Stopping KS-MFG Development Servers
echo ===================================================

echo [1/3] Closing KS-MFG console windows...
taskkill /FI "WINDOWTITLE eq KS-MFG-Backend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq KS-MFG-Frontend*" /T /F >nul 2>&1

echo [2/3] Checking and terminating process on Backend port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r ":3000[ ]"') do (
    if not "%%a"=="" if not "%%a"=="0" (
        echo   - Terminating Backend PID: %%a
        taskkill /F /PID %%a >nul 2>&1
    )
)

echo [3/3] Checking and terminating process on Frontend port 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r ":5173[ ]"') do (
    if not "%%a"=="" if not "%%a"=="0" (
        echo   - Terminating Frontend PID: %%a
        taskkill /F /PID %%a >nul 2>&1
    )
)

echo ===================================================
echo KS-MFG Backend and Frontend have been stopped.
echo ===================================================
timeout /t 2 >nul
