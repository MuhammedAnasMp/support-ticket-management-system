@echo off
setlocal

REM Go to project directory
cd /d C:\inetpub\wwwroot\support-ticket-management-system

echo.
echo ==========================================
echo Pulling latest code from Git
echo ==========================================
git pull

if errorlevel 1 (
    echo ERROR: git pull failed.
    exit /b 1
)

echo.
echo ==========================================
echo Building frontend
echo ==========================================
cd /d frontend
call npm run build

if errorlevel 1 (
    echo ERROR: npm build failed.
    exit /b 1
)

echo.
echo ==========================================
echo Collecting Django static files
echo ==========================================
cd /d ..\backend
python manage.py collectstatic --noinput

if errorlevel 1 (
    echo ERROR: Django collectstatic failed.
    exit /b 1
)

echo.
echo ==========================================
echo Restarting mtracker service
echo ==========================================
powershell -NoProfile -Command "Stop-Service mtracker -Force"
powershell -NoProfile -Command "Start-Service mtracker"

if errorlevel 1 (
    echo ERROR: Failed to restart mtracker service.
    exit /b 1
)

echo.
echo ==========================================
echo Deployment completed successfully!
echo ==========================================
pause