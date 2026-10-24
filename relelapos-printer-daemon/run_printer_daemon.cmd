@echo off
title RELELAPOS Realtime POS Printer Daemon
color 0A
cls

echo ===============================================================
echo            RELELAPOS REALTIME POS PRINTER DAEMON
echo            Diamond-Precision Automatic Order Printing
echo ===============================================================
echo.

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js is not installed or not in your PATH!
    echo.
    echo To install Node.js on this laptop:
    echo 1. Open PowerShell and run:  winget install OpenJS.NodeJS
    echo    OR download from:          https://nodejs.org
    echo 2. Restart this command window after installation.
    echo.
    pause
    exit /b 1
)

:: Change working directory to this script folder
cd /d "%~dp0"

echo [OK] Node.js detected:
node -v
echo.
echo Starting RELELAPOS POS Printer Daemon...
echo.

node printer_daemon.js

if %errorlevel% neq 0 (
    echo.
    echo [NOTICE] Daemon exited with error code %errorlevel%.
    pause
)
