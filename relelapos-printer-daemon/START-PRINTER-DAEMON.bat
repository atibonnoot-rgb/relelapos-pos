@echo off
title RELEELAPOS Realtime Cloud Thermal Printer Daemon
color 0A
echo.
echo  =============================================================
echo    RELEELAPOS Cloud Thermal Print Daemon - Listening to Vercel
echo    Target Server  : https://relelapos-pos.vercel.app
echo    Thermal Printer: POS-80
echo    Security Token : Secured with x-printer-secret
echo  =============================================================
echo.
echo  Starting... (Keep this window open on this laptop while the store is active)
echo.

cd /d "%~dp0"
node printer_daemon.js

echo.
echo  [!] Daemon stopped. Press any key to restart.
pause
node printer_daemon.js

