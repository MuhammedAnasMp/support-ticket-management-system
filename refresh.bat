@echo off
setlocal

REM ==========================================
REM Remote Server Configuration (Referenced from backend/pull_db.bat)
REM ==========================================
set "SERVER=Administrator@104.237.6.167"
set "REMOTE_PATH=C:\inetpub\wwwroot\support-ticket-management-system"

echo.
echo ==========================================
echo Connecting to %SERVER% via SSH
echo Running refresh2.0.bat on remote server...
echo ==========================================
echo.

ssh -t %SERVER% "cd /d %REMOTE_PATH% && call refresh2.0.bat"

if errorlevel 1 (
    echo.
    echo ==========================================
    echo ERROR: Remote deployment script failed.
    echo ==========================================
    pause
    exit /b 1
)

echo.
echo ==========================================
echo Remote deployment completed successfully!
echo ==========================================
pause
exit /b 0