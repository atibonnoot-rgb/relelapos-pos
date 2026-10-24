@echo off
title RELEELA POS DAEMON – Instant Thermal Printer
color 0A
echo.
echo  ============================================
echo    RELEELA POS DAEMON – Instant Print Engine
echo    Thermal Printer: POS-80
echo    Print API : http://localhost:5001/api/print
echo  ============================================
echo.
echo  Starting... (Keep this window open while the store is running)
echo.

cd /d "%~dp0"
node pos-daemon.js

echo.
echo  [!] Daemon stopped. Press any key to restart.
pause
node pos-daemon.js
