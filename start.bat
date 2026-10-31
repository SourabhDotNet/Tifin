@echo off
echo =========================================
echo  Tiffin ^& Refreshment Billing System
echo =========================================
echo.

SET BACKEND_DIR=%~dp0backend
SET FRONTEND_DIR=%~dp0frontend

echo [1/2] Starting backend server on port 5000...
start "Backend Server" cmd /k "cd /d %BACKEND_DIR% && node server.js"

echo [2/2] Waiting for server to start...
timeout /t 3 /nobreak >nul

echo.
echo =========================================
echo  App is running at: http://localhost:5000
echo =========================================
echo.
echo Opening browser...
start "" "http://localhost:5000"
echo.
echo Press any key to stop this window (server continues running).
pause >nul
