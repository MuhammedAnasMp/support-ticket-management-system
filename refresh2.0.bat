@echo off
setlocal

REM ==========================================
REM Project directory
REM ==========================================
cd /d C:\inetpub\wwwroot\support-ticket-management-system

if errorlevel 1 (
    echo ERROR: Failed to access project directory.
    exit /b 1
)

REM ==========================================
REM Pull latest code from Git
REM ==========================================
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
REM Backend - Update Python packages
REM ==========================================
echo.
echo ==========================================
echo Updating Python packages
echo ==========================================

cd /d C:\inetpub\wwwroot\support-ticket-management-system\backend

if errorlevel 1 (
    echo ERROR: Failed to access backend directory.
    exit /b 1
)

venv\Scripts\python.exe -m pip install -r requirements.txt

if errorlevel 1 (
    echo ERROR: pip install failed.
    exit /b 1
)

REM ==========================================
REM Django - Make migrations
REM ==========================================
echo.
echo ==========================================
echo Creating Django migrations
echo ==========================================

venv\Scripts\python.exe manage.py makemigrations

if errorlevel 1 (
    echo ERROR: makemigrations failed.
    exit /b 1
)

REM ==========================================
REM Django - Apply migrations
REM ==========================================
echo.
echo ==========================================
echo Applying Django migrations
echo ==========================================

venv\Scripts\python.exe manage.py migrate

if errorlevel 1 (
    echo ERROR: migrate failed.
    exit /b 1
)

REM ==========================================
REM Generate permissions JSON
REM ==========================================
echo.
echo ==========================================
echo Generating default_permissions.json
echo ==========================================

venv\Scripts\python.exe manage.py permissions

if errorlevel 1 (
    echo ERROR: Permissions generation failed.
    exit /b 1
)

REM ==========================================
REM Build frontend
REM ==========================================
echo.
echo ==========================================
echo Installing frontend packages and building
echo ==========================================

cd /d C:\inetpub\wwwroot\support-ticket-management-system\frontend

if errorlevel 1 (
    echo ERROR: Failed to access frontend directory.
    exit /b 1
)

call npm install

if errorlevel 1 (
    echo ERROR: npm install failed.
    exit /b 1
)

call npm run build

if errorlevel 1 (
    echo ERROR: npm build failed.
    exit /b 1
)

REM ==========================================
REM Django - Collect static files
REM ==========================================
echo.
echo ==========================================
echo Collecting Django static files
echo ==========================================

cd /d C:\inetpub\wwwroot\support-ticket-management-system\backend

if errorlevel 1 (
    echo ERROR: Failed to access backend directory.
    exit /b 1
)

venv\Scripts\python.exe manage.py collectstatic --noinput

if errorlevel 1 (
    echo ERROR: Django collectstatic failed.
    exit /b 1
)

REM ==========================================
REM Stop mtracker service
REM ==========================================
echo.
echo ==========================================
echo Stopping mtracker service
echo ==========================================

sc stop mtracker

REM ==========================================
REM Wait until service stops
REM ==========================================
echo.
echo Waiting for mtracker service to stop...

:WAIT_STOP
sc query mtracker | findstr /i "STOPPED" >nul

if not errorlevel 1 goto SERVICE_STOPPED

sc query mtracker | findstr /i "STOP_PENDING" >nul

if not errorlevel 1 (
    timeout /t 2 /nobreak >nul
    goto WAIT_STOP
)

echo ERROR: mtracker service did not stop correctly.
exit /b 1

:SERVICE_STOPPED

echo mtracker service has stopped successfully.

REM ==========================================
REM Start mtracker service
REM ==========================================
echo.
echo ==========================================
echo Starting mtracker service
echo ==========================================

sc start mtracker

if errorlevel 1 (
    echo ERROR: Failed to start mtracker service.
    exit /b 1
)

REM ==========================================
REM Wait until service is running
REM ==========================================
echo.
echo Waiting for mtracker service to start...

:WAIT_START
sc query mtracker | findstr /i "RUNNING" >nul

if not errorlevel 1 goto SERVICE_RUNNING

sc query mtracker | findstr /i "START_PENDING" >nul

if not errorlevel 1 (
    timeout /t 2 /nobreak >nul
    goto WAIT_START
)

echo ERROR: mtracker service did not start correctly.
exit /b 1

:SERVICE_RUNNING

echo.
echo ==========================================
echo mtracker service is running.
echo Deployment completed successfully!
echo ==========================================

pause
endlocal
