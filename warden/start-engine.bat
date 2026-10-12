@echo off
title GuardSaaB Local Engine
cd /d "%~dp0"
echo.
echo   Starting local PostgreSQL for GuardSaaB...
docker compose up -d --wait postgres
if errorlevel 1 (
  echo Docker Desktop must be running. Start Docker Desktop and retry.
  pause
  exit /b 1
)
echo   GuardSaaB engine  -  http://127.0.0.1:9000/
echo   Close this window (or press Ctrl+C) to stop the engine.
echo.
npm run engine:local
echo.
echo Engine stopped. Press any key to close...
pause >nul
