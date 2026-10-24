@echo off
title RELELAPOS Printer Test
color 0B
cls

cd /d "%~dp0"
node test_print.js
echo.
pause
