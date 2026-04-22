@echo off
title FaidaKomori - Serveur
color 0A
cd /d "%~dp0"
echo.
echo  ================================================
echo   FAIDAKOMORI - Serveur actif
echo   Acces : http://localhost:3001
echo   Admin : admin@faidakomori.km
echo   Mdp   : Admin@FK2024!
echo   Ctrl+C pour arreter.
echo  ================================================
echo.
node server.js
echo.
echo  [ARRETE] Le serveur a quitte.
pause
