@echo off
setlocal

REM ==========================================
REM Project directory
REM ==========================================
set "PROJECT_DIR=C:\inetpub\wwwroot\support-ticket-management-system"
set "LOG_FILE=%PROJECT_DIR%\deployment.log"

cd /d "%PROJECT_DIR%"

REM ==========================================
REM Start deployment logging
REM ==========================================
echo. 
echo ==========================================
echo Deployment started
echo ==========================================
echo Log file: %LOG_FILE%
echo.

echo ========================================== >> "%LOG_FILE%"
echo Deployment started >> "%LOG_FILE%"
echo Date: %date% >> "%LOG_FILE%"
echo Time: %time% >> "%LOG_FILE%"
echo ========================================== >> "%LOG_FILE%"

REM ==========================================
REM Pull latest code from Git
REM ==========================================
echo.
echo ==========================================
echo Pulling latest code from Git
echo ==========================================

echo. >> "%LOG_FILE%"
echo ========================================== >> "%LOG_FILE%"
echo Pulling latest code from Git >> "%LOG_FILE%"
echo ========================================== >> "%LOG_FILE%"

git pull >> "%LOG_FILE%" 2>&1

if errorlevel 1 (
    echo ERROR: git pull failed.
    echo ERROR: git pull failed. >> "%LOG_FILE%"
    exit /b 1
)

REM ==========================================
REM Backend - Update Python packages
REM ==========================================
echo.
echo ==========================================
echo Updating Python packages
echo ==========================================

echo. >> "%LOG_FILE%"
echo ========================================== >> "%LOG_FILE%"
echo Updating Python packages >> "%LOG_FILE%"
echo ========================================== >> "%LOG_FILE%"

cd /d "%PROJECT_DIR%\backend"

venv\Scripts\python.exe -m pip install -r requirements.txt >> "%LOG_FILE%" 2>&1

if errorlevel 1 (
    echo ERROR: pip install failed.
    echo ERROR: pip install failed. >> "%LOG_FILE%"
    exit /b 1
)

REM ==========================================
REM Django - Make migrations
REM ==========================================
echo.
echo ==========================================
echo Creating Django migrations
echo ==========================================

echo. >> "%LOG_FILE%"
echo ========================================== >> "%LOG_FILE%"
echo Creating Django migrations >> "%LOG_FILE%"
echo ========================================== >> "%LOG_FILE%"

venv\Scripts\python.exe manage.py makemigrations >> "%LOG_FILE%" 2>&1

if errorlevel 1 (
    echo ERROR: makemigrations failed.
    echo ERROR: makemigrations failed. >> "%LOG_FILE%"
    exit /b 1
)

REM ==========================================
REM Django - Apply migrations
REM ==========================================
echo.
echo ==========================================
echo Applying Django migrations
echo ==========================================

echo. >> "%LOG_FILE%"
echo ========================================== >> "%LOG_FILE%"
echo Applying Django migrations >> "%LOG_FILE%"
echo ========================================== >> "%LOG_FILE%"

venv\Scripts\python.exe manage.py migrate >> "%LOG_FILE%" 2>&1

if errorlevel 1 (
    echo ERROR: migrate failed.
    echo ERROR: migrate failed. >> "%LOG_FILE%"
    exit /b 1
)

REM ==========================================
REM Generate permissions JSON
REM ==========================================
echo.
echo ==========================================
echo Generating default_permissions.json
echo ==========================================

echo. >> "%LOG_FILE%"
echo ========================================== >> "%LOG_FILE%"
echo Generating default_permissions.json >> "%LOG_FILE%"
echo ========================================== >> "%LOG_FILE%"

venv\Scripts\python.exe manage.py permissions >> "%LOG_FILE%" 2>&1

if errorlevel 1 (
    echo ERROR: Permissions generation failed.
    echo ERROR: Permissions generation failed. >> "%LOG_FILE%"
    exit /b 1
)

REM ==========================================
REM Build frontend
REM ==========================================
echo.
echo ==========================================
echo Building frontend
echo ==========================================

echo. >> "%LOG_FILE%"
echo ========================================== >> "%LOG_FILE%"
echo Building frontend >> "%LOG_FILE%"
echo ========================================== >> "%LOG_FILE%"

cd /d "%PROJECT_DIR%\frontend"

call npm run build >> "%LOG_FILE%" 2>&1

if errorlevel 1 (
    echo ERROR: npm build failed.
    echo ERROR: npm build failed. >> "%LOG_FILE%"
    exit /b 1
)

REM ==========================================
REM Django collectstatic
REM ==========================================
echo.
echo ==========================================
echo Collecting Django static files
echo ==========================================

echo. >> "%LOG_FILE%"
echo ========================================== >> "%LOG_FILE%"
echo Collecting Django static files >> "%LOG_FILE%"
echo ========================================== >> "%LOG_FILE%"

cd /d "%PROJECT_DIR%\backend"

venv\Scripts\python.exe manage.py collectstatic --noinput >> "%LOG_FILE%" 2>&1

if errorlevel 1 (
    echo ERROR: Django collectstatic failed.
    echo ERROR: Django collectstatic failed. >> "%LOG_FILE%"
    exit /b 1
)

REM ==========================================
REM Restart mtracker
REM ==========================================
echo.
echo ==========================================
echo Restarting mtracker service
echo ==========================================

echo. >> "%LOG_FILE%"
echo ========================================== >> "%LOG_FILE%"
echo Restarting mtracker service >> "%LOG_FILE%"
echo ========================================== >> "%LOG_FILE%"

powershell -NoProfile -Command "Stop-Service mtracker -Force" >> "%LOG_FILE%" 2>&1

if errorlevel 1 (
    echo ERROR: Failed to stop mtracker service.
    echo ERROR: Failed to stop mtracker service. >> "%LOG_FILE%"
    exit /b 1
)

powershell -NoProfile -Command "Start-Service mtracker" >> "%LOG_FILE%" 2>&1

if errorlevel 1 (
    echo ERROR: Failed to start mtracker service.
    echo ERROR: Failed to start mtracker service. >> "%LOG_FILE%"
    exit /b 1
)

REM ==========================================
REM Deployment completed
REM ==========================================
echo. >> "%LOG_FILE%"
echo ========================================== >> "%LOG_FILE%"
echo Deployment completed successfully! >> "%LOG_FILE%"
echo Date: %date% >> "%LOG_FILE%"
echo Time: %time% >> "%LOG_FILE%"
echo ========================================== >> "%LOG_FILE%"

echo.
echo ==========================================
echo Deployment completed successfully!
echo ==========================================
echo.
echo Deployment log:
echo %LOG_FILE%
echo.

pause