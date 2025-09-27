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
    ) else
