@echo off
setlocal
title FaidaKomori - Lanceur
color 0A
echo.
echo  ================================================
echo   FAIDAKOMORI - Demarrage
echo  ================================================
echo.

node --version >nul 2>&1
if errorlevel 1 (
    color 0C
    echo  [ERREUR] Node.js n est pas installe.
    echo  Telechargez-le : https://nodejs.org
    echo.
    pause
    exit /b 1
)
echo  [OK] Node.js detecte.

if not exist "%~dp0backend\server.js" (
    color 0C
    echo  [ERREUR] backend\server.js introuvable.
    pause
    exit /b 1
)
echo  [OK] Backend trouve.

if not exist "%~dp0backend\node_modules" (
    echo  [INFO] Installation npm...
    cd /d "%~dp0backend"
    npm install
    if errorlevel 1 (
        echo  [ERREUR] npm install a echoue.
        pause
        exit /b 1
    )
    echo  [OK] Modules installes.
)

echo.
echo  [INFO] Liberation port 3001...
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr ":3001 " ^| findstr "LISTENING"') do taskkill /F /PID %%p >nul 2>&1
timeout /t 1 /nobreak >nul

echo  [INFO] Demarrage du serveur...
start "" "%~dp0backend\_serveur.bat"

echo  [INFO] Attente 4 secondes...
timeout /t 4 /nobreak >nul

echo  [INFO] Ouverture du navigateur...
start "" http://localhost:3001

echo.
echo  ================================================
echo   SITE EN LIGNE : http://localhost:3001
echo   Admin : admin@faidakomori.km
echo   Mdp   : Admin@FK2024!
echo  ================================================
echo.
echo  Ne fermez pas la fenetre noire du serveur.
echo.
pause
