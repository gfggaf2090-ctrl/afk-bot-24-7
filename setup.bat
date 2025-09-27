@echo off
REM ===========================================
REM Lavamusic Enhanced - Windows Batch Scripts
REM ===========================================

setlocal enabledelayedexpansion

REM Colors (limited in Windows CMD)
set RED=[91m
set GREEN=[92m
set YELLOW=[93m
set BLUE=[94m
set PURPLE=[95m
set CYAN=[96m
set NC=[0m

REM ===========================================
REM Setup Script (setup.bat)
REM ===========================================

:setup
cls
echo %PURPLE%
echo ╔══════════════════════════════════════════╗
echo ║        Lavamusic Enhanced Setup          ║
echo ║     Advanced Discord Music Bot           ║
echo ╚══════════════════════════════════════════╝
echo %NC%

echo %GREEN%[INFO]%NC% Starting Lavamusic Enhanced setup...

REM Check Node.js
echo %BLUE%[INFO]%NC% Checking Node.js version...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo %RED%[ERROR]%NC% Node.js is not installed. Please install Node.js 18.x or higher.
    pause
    exit /b 1
)

echo %GREEN%✅%NC% Node.js is installed

REM Check npm
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo %RED%[ERROR]%NC% npm is not available.
    pause
    exit /b 1
)

REM Check Git
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo %YELLOW%[WARNING]%NC% Git is not available. Some features may not work.
) else (
    echo %GREEN%✅%NC% Git is available
)

REM Install dependencies
echo %BLUE%[INFO]%NC% Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo %RED%[ERROR]%NC% Failed to install dependencies
    pause
    exit /b 1
)

echo %GREEN%✅%NC% Dependencies installed

REM Create directories
echo %BLUE%[INFO]%NC% Creating directories...
if not exist "logs" mkdir logs
if not exist "temp" mkdir temp
if not exist "backups" mkdir backups
if not exist "Lavalink" mkdir Lavalink
if not exist "Lavalink\plugins" mkdir Lavalink\plugins

echo %GREEN%✅%NC% Directories created

REM Setup database
echo %BLUE%[INFO]%NC% Setting up database...
if exist "prisma\schema.prisma" (
    call npm run db:generate
    call npm run db:push
    echo %GREEN%✅%NC% Database setup completed
) else (
    echo %YELLOW%[WARNING]%NC% Prisma schema not found, skipping database setup
)

REM Check for .env file
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo %YELLOW%[WARNING]%NC% Created .env file from .env.example
        echo %CYAN%Please edit .env file with your bot token and settings%NC%
    ) else (
        echo %RED%[ERROR]%NC% No .env.example file found
    )
)

REM Download Lavalink if not exists
if not exist "Lavalink\Lavalink.jar" (
    echo %BLUE%[INFO]%NC% Downloading Lavalink...
    powershell -Command "try { Invoke-WebRequest -Uri 'https://github.com/lavalink-devs/Lavalink/releases/latest/download/Lavalink.jar' -OutFile 'Lavalink\Lavalink.jar' } catch { Write-Host 'Failed to download Lavalink' }"
    if exist "Lavalink\Lavalink.jar" (
        echo %GREEN%✅%NC% Lavalink downloaded
    ) else (
        echo %YELLOW%[WARNING]%NC% Failed to download Lavalink automatically
        echo Please download Lavalink.jar manually and place it in Lavalink folder
    )
)

echo.
echo %GREEN%🎉 Setup completed successfully!%NC%
echo.
echo %CYAN%Next steps:%NC%
echo 1. Edit .env file with your bot token and settings
echo 2. Run start-lavalink.bat to start Lavalink
echo 3. Run start.bat to start the bot
echo.
pause
goto :eof

REM ===========================================
REM Start Bot (start.bat)
REM ===========================================

:start
cls
echo %PURPLE%Starting Lavamusic Enhanced...%NC%

REM Check if .env exists
if not exist ".env" (
    echo %RED%[ERROR]%NC% .env file not found. Please run setup.bat first.
    pause
    exit /b 1
)

REM Start the bot
call npm start

goto :eof

REM ===========================================
REM Start Development (start-dev.bat)
REM ===========================================

:start-dev
cls
echo %PURPLE%Starting Lavamusic Enhanced in Development Mode...%NC%

set NODE_ENV=development
call npm run dev

goto :eof

REM ===========================================
REM Start Lavalink (start-lavalink.bat)
REM ===========================================

:start-lavalink
cls
echo %PURPLE%Starting Lavalink...%NC%

if not exist "Lavalink\Lavalink.jar" (
    echo %RED%[ERROR]%NC% Lavalink.jar not found. Please run setup.bat first.
    pause
    exit /b 1
)

REM Check Java
java -version >nul 2>&1
if %errorlevel% neq 0 (
    echo %RED%[ERROR]%NC% Java is not installed. Please install Java 11 or higher.
    pause
    exit /b 1
)

echo %GREEN%[INFO]%NC% Starting Lavalink server...
cd Lavalink
java -jar Lavalink.jar
cd ..

goto :eof

REM ===========================================
REM Deploy Commands (deploy-commands.bat)
REM ===========================================

:deploy-commands
cls
echo %PURPLE%Deploying Slash Commands...%NC%

if not exist ".env" (
    echo %RED%[ERROR]%NC% .env file not found.
    pause
    exit /b 1
)

call npm run deploy:commands

pause
goto :eof

REM ===========================================
REM Update Bot (update.bat)
REM ===========================================

:update
cls
echo %PURPLE%Updating Lavamusic Enhanced...%NC%

echo %BLUE%[INFO]%NC% Pulling latest changes...
git pull origin main

echo %BLUE%[INFO]%NC% Installing dependencies...
call npm ci

echo %BLUE%[INFO]%NC% Updating database...
call npm run db:push

echo %GREEN%✅ Bot updated successfully!%NC%
pause
goto :eof

REM ===========================================
REM Health Check (health-check.bat)
REM ===========================================

:health-check
cls
echo %PURPLE%Lavamusic Enhanced - Health Check%NC%
echo.

echo %BLUE%[INFO]%NC% Checking bot process...
tasklist /FI "IMAGENAME eq node.exe" | find "node.exe" >nul
if %errorlevel% equ 0 (
    echo %GREEN%✅ Bot process is running%NC%
) else (
    echo %RED%❌ Bot process not found%NC%
)

echo %BLUE%[INFO]%NC% Checking Lavalink process...
tasklist /FI "IMAGENAME eq java.exe" | find "java.exe" >nul
if %errorlevel% equ 0 (
    echo %GREEN%✅ Java process is running (likely Lavalink)%NC%
) else (
    echo %RED%❌ Java process not found%NC%
)

echo %BLUE%[INFO]%NC% Checking HTTP endpoint...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 5; if ($response.StatusCode -eq 200) { Write-Host '✅ HTTP endpoint responding' } else { Write-Host '❌ HTTP endpoint error: ' $response.StatusCode } } catch { Write-Host '❌ HTTP endpoint not responding' }"

echo.
pause
goto :eof

REM ===========================================
REM View Logs (logs.bat)
REM ===========================================

:logs
cls
echo %PURPLE%Lavamusic Enhanced - Logs%NC%
echo.

if exist "logs\lavamusic.log" (
    echo %GREEN%[INFO]%NC% Showing latest log entries...
    echo.
    powershell -Command "Get-Content 'logs\lavamusic.log' -Tail 50"
) else (
    echo %YELLOW%[WARNING]%NC% No log file found
)

echo.
pause
goto :eof

REM ===========================================
REM Clean Logs (clean-logs.bat)
REM ===========================================

:clean-logs
cls
echo %PURPLE%Cleaning old log files...%NC%

if exist "logs\*.log" (
    forfiles /p logs /s /m *.log /d -7 /c "cmd /c del @path" 2>nul
    echo %GREEN%✅ Old logs cleaned%NC%
) else (
    echo %BLUE%[INFO]%NC% No log files found
)

pause
goto :eof

REM ===========================================
REM Install Service (install-service.bat) - Run as Administrator
REM ===========================================

:install-service
echo %PURPLE%Installing Lavamusic Enhanced as Windows Service...%NC%

REM Check if running as administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo %RED%[ERROR]%NC% This script requires administrator privileges.
    echo Please run as administrator.
    pause
    exit /b 1
)

REM Install PM2 globally
call npm install -g pm2
call npm install -g pm2-windows-service

REM Create PM2 service
pm2 start index.js --name "lavamusic-enhanced" --node-args="--max-old-space-size=2048"
pm2 startup
pm2 save

echo %GREEN%✅ Service installed successfully!%NC%
echo Use 'pm2 list' to check status
echo Use 'pm2 restart lavamusic-enhanced' to restart
echo Use 'pm2 stop lavamusic-enhanced' to stop

pause
goto :eof

REM ===========================================
REM Uninstall Service (uninstall-service.bat) - Run as Administrator
REM ===========================================

:uninstall-service
echo %PURPLE%Uninstalling Lavamusic Enhanced Windows Service...%NC%

REM Check if running as administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo %RED%[ERROR]%NC% This script requires administrator privileges.
    echo Please run as administrator.
    pause
    exit /b 1
)

pm2 delete lavamusic-enhanced
pm2 unstartup

echo %GREEN%✅ Service uninstalled successfully!%NC%
pause
goto :eof

REM ===========================================
REM Main Menu (menu.bat)
REM ===========================================

:menu
cls
echo %PURPLE%
echo ╔══════════════════════════════════════════╗
echo ║        Lavamusic Enhanced Menu           ║
echo ║     Advanced Discord Music Bot           ║
echo ╚══════════════════════════════════════════╝
echo %NC%

echo.
echo %CYAN%Select an option:%NC%
echo.
echo %GREEN%1.%NC% Setup (First time installation)
echo %GREEN%2.%NC% Start Bot
echo %GREEN%3.%NC% Start Development Mode
echo %GREEN%4.%NC% Start Lavalink
echo %GREEN%5.%NC% Deploy Slash Commands
echo %GREEN%6.%NC% Update Bot
echo %GREEN%7.%NC% Health Check
echo %GREEN%8.%NC% View Logs
echo %GREEN%9.%NC% Clean Old Logs
echo %GREEN%10.%NC% Install as Windows Service (Admin required)
echo %GREEN%11.%NC% Uninstall Windows Service (Admin required)
echo %GREEN%0.%NC% Exit
echo.

set /p choice=%YELLOW%Enter your choice (0-11): %NC%

if "%choice%"=="1" goto setup
if "%choice%"=="2" goto start
if "%choice%"=="3" goto start-dev
if "%choice%"=="4" goto start-lavalink
if "%choice%"=="5" goto deploy-commands
if "%choice%"=="6" goto update
if "%choice%"=="7" goto health-check
if "%choice%"=="8" goto logs
if "%choice%"=="9" goto clean-logs
if "%choice%"=="10" goto install-service
if "%choice%"=="11" goto uninstall-service
if "%choice%"=="0" exit /b 0

echo %RED%Invalid choice. Please try again.%NC%
timeout /t 2 >nul
goto menu

REM ===========================================
REM Entry Point
REM ===========================================

REM Check which script is being called
if "%~n0"=="setup" goto setup
if "%~n0"=="start" goto start
if "%~n0"=="start-dev" goto start-dev
if "%~n0"=="start-lavalink" goto start-lavalink
if "%~n0"=="deploy-commands" goto deploy-commands
if "%~n0"=="update" goto update
if "%~n0"=="health-check" goto health-check
if "%~n0"=="logs" goto logs
if "%~n0"=="clean-logs" goto clean-logs
if "%~n0"=="install-service" goto install-service
if "%~n0"=="uninstall-service" goto uninstall-service

REM Default to menu if no specific script name
goto menu
