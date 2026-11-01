@echo off
rem Register Slide Editor in "Open with" (current user). Use "install.bat -Uninstall" to remove.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
pause
