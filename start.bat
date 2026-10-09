@echo off
setlocal
echo ===================================================
echo Starting KS-MFG Development Servers
echo ===================================================

cd /d "%~dp0"

echo [1/2] Starting Backend (NestJS on port 3000)...
start "KS-MFG-Backend" cmd /k "title KS-MFG-Backend && cd /d "%~dp0backend" && npm run start:dev"

echo [2/2] Starting Frontend (Vite on port 5173)...
start "KS-MFG-Frontend" cmd /k "title KS-MFG-Frontend && cd /d "%~dp0frontend" && npm run dev"

echo ===================================================
echo Both servers have been launched in separate terminal windows:
echo   - Backend:  http://localhost:3000 (Swagger: /api/docs)
echo   - Frontend: http://localhost:5173
echo.
echo Use stop.bat to stop both development servers.
echo ===================================================
