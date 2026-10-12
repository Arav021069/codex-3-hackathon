@echo off
setlocal enabledelayedexpansion
title GuardSaaB ^& Northstar Works — Hackathon Demo Launcher
cd /d "%~dp0"

echo ======================================================================
echo           GUARDSAAB AGENT SECURITY GATEWAY ^& NORTHSTAR WORKS
echo                    Hackathon Live Presentation Demo
echo ======================================================================
echo.

:: 1. Check Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not found in PATH.
    echo Please install Node.js 20 or higher to run GuardSaaB.
    pause
    exit /b 1
)

for /f "tokens=1 delims=v." %%a in ('node -v') do set NODE_VER=%%a
echo [✓] Node.js detected: 
node -v

:: 2. Check Port 9000
netstat -ano | findstr :9000 >nul 2>nul
if not errorlevel 1 (
    echo [!] Port 9000 is currently occupied.
    echo If a GuardSaaB engine is already running, you can connect directly.
)

:: 3. Optional Docker PostgreSQL check
echo.
echo [*] Checking local PostgreSQL database (Docker)...
docker info >nul 2>nul
if not errorlevel 1 (
    echo [✓] Docker is running. Starting local PostgreSQL container...
    docker compose up -d --wait postgres >nul 2>nul
    if not errorlevel 1 (
        echo [✓] PostgreSQL ready on port 54329 (tamper-evident audit chain enabled).
        set USE_LOCAL_DB=1
    ) else (
        echo [!] Docker compose failed. Falling back to local in-memory storage.
        set USE_LOCAL_DB=0
    )
) else (
    echo [i] Docker Desktop is offline. Using local in-memory storage mode.
    echo     (Zero-dependency fallback active - all login ^& policies work!)
    set USE_LOCAL_DB=0
)

echo.
echo ======================================================================
echo  ACCESS URLS:
echo  - GuardSaaB Governance Console:    http://127.0.0.1:5174/  (or /guardsaab)
echo  - Northstar Works Company App:  http://127.0.0.1:5173/
echo  - Combined Engine Gateway:      http://127.0.0.1:9000/
echo.
echo  LOCAL ACCOUNT CREDENTIALS:
echo  See credentials.txt in the GuardSaaB repository. Keep that file private.
echo ======================================================================
echo.
echo Starting GuardSaaB Engine...
if "%USE_LOCAL_DB%"=="1" (
    npm run engine:local
) else (
    npm run engine
)

pause
