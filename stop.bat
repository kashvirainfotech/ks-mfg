@echo off
setlocal enabledelayedexpansion
echo ===================================================
echo Stopping KS-MFG Development Servers
echo ===================================================

echo [1/3] Terminating Node.js server listening on Backend port 3000...
for /f "tokens=2,4,5" %%a in ('netstat -aon ^| findstr /i "LISTENING"') do (
    set "LOCAL_ADDR=%%a#"
    set "STATE=%%b"
    set "PID_VAL=%%c"
    if /i "!STATE!"=="LISTENING" (
        if not "!LOCAL_ADDR::3000#=!"=="!LOCAL_ADDR!" (
            for /f "tokens=1" %%i in ('tasklist /FI "PID eq !PID_VAL!" /FI "IMAGENAME eq node.exe" /NH 2^>nul') do (
                if /i "%%i"=="node.exe" (
                    echo   - Stopping Backend node.exe ^(PID: !PID_VAL!^)
                    taskkill /F /PID !PID_VAL! >nul 2>&1
                )
            )
        )
    )
)

echo [2/3] Terminating Node.js server listening on Frontend port 5173...
for /f "tokens=2,4,5" %%a in ('netstat -aon ^| findstr /i "LISTENING"') do (
    set "LOCAL_ADDR=%%a#"
    set "STATE=%%b"
    set "PID_VAL=%%c"
    if /i "!STATE!"=="LISTENING" (
        if not "!LOCAL_ADDR::5173#=!"=="!LOCAL_ADDR!" (
            for /f "tokens=1" %%i in ('tasklist /FI "PID eq !PID_VAL!" /FI "IMAGENAME eq node.exe" /NH 2^>nul') do (
                if /i "%%i"=="node.exe" (
                    echo   - Stopping Frontend node.exe ^(PID: !PID_VAL!^)
                    taskkill /F /PID !PID_VAL! >nul 2>&1
                )
            )
        )
    )
)

echo [3/3] Closing KS-MFG console windows...
taskkill /FI "IMAGENAME eq cmd.exe" /FI "WINDOWTITLE eq KS-MFG-Backend*" /F >nul 2>&1
taskkill /FI "IMAGENAME eq cmd.exe" /FI "WINDOWTITLE eq KS-MFG-Frontend*" /F >nul 2>&1
taskkill /FI "IMAGENAME eq cmd.exe" /FI "WINDOWTITLE eq Administrator:  KS-MFG-Backend*" /F >nul 2>&1
taskkill /FI "IMAGENAME eq cmd.exe" /FI "WINDOWTITLE eq Administrator:  KS-MFG-Frontend*" /F >nul 2>&1

echo ===================================================
echo KS-MFG Backend and Frontend have been stopped safely.
echo ===================================================
timeout /t 2 >nul
