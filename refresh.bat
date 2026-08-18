@echo off
setlocal

REM ==========================================
REM Project directory
REM ==========================================
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

REM ==========================================
REM Generate permissions JSON
REM ==========================================
echo.
echo ==========================================
echo Generating default_permissions.json
echo ==========================================
cd /d C:\inetpub\wwwroot\support-ticket-management-system\backend
call venv\Scripts\python.exe manage.py permissions

if errorlevel 1 (
    echo ERROR: Permissions generation failed.
    exit /b 1
)

REM ==========================================
REM Build frontend
REM ==========================================
echo.
echo ==========================================
echo Building frontend
echo ==========================================
cd /d C:\inetpub\wwwroot\support-ticket-management-system\frontend

call npm run build

if errorlevel 1 (
    echo ERROR: npm build failed.
    exit /b 1
)

REM ==========================================
REM Backend
REM ==========================================
echo.
echo ==========================================
echo Updating Python packages
echo ==========================================

cd /d C:\inetpub\wwwroot\support-ticket-management-system\backend

venv\Scripts\python.exe -m pip install -r requirements.txt

if errorlevel 1 (
    echo ERROR: pip install failed.
    exit /b 1
)



venv\Scripts\python.exe manage.py makemigrations

if errorlevel 1 (
    echo ERROR: makemigrations failed.
    exit /b 1
)

venv\Scripts\python.exe manage.py migrate

if errorlevel 1 (
    echo ERROR: migrate failed.
    exit /b 1
)


REM ==========================================
REM Django collectstatic
REM ==========================================
echo.
echo ==========================================
echo Collecting Django static files
echo ==========================================

venv\Scripts\python.exe manage.py collectstatic --noinput

if errorlevel 1 (
    echo ERROR: Django collectstatic failed.
    exit /b 1
)

REM ==========================================
REM Restart mtracker
REM ==========================================
echo.
echo ==========================================
echo Restarting mtracker service
echo ==========================================

powershell -NoProfile -Command "Stop-Service mtracker -Force"

if errorlevel 1 (
    echo ERROR: Failed to stop mtracker service.
    exit /b 1
)

powershell -NoProfile -Command "Start-Service mtracker"

if errorlevel 1 (
    echo ERROR: Failed to start mtracker service.
    exit /b 1
)

echo.
echo ==========================================
echo Deployment completed successfully!
echo ==========================================

pause