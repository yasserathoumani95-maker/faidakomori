@echo off
setlocal
title FaidaKomori - Publication GitHub
color 0B
echo.
echo  ================================================
echo   FAIDAKOMORI - Synchronisation GitHub
echo  ================================================
echo.

cd /d "%~dp0"

echo  [INFO] Verification des modifications..
git status --short
echo.

git add -A

set /p MSG="  Entrez un message de commit (ou Entree pour message auto): "
if "!MSG!"=="" set MSG=Mise a jour - %date% %time%

git commit -m "!MSG!" 2>nul
if errorlevel 1 (
    echo  [INFO] Rien de nouveau a publier.
    goto :fin
)

echo.
echo  [INFO] Publication sur GitHub..
git push origin master
if errorlevel 1 (
    color 0C
    echo  [ERREUR] Echec du push. Verifiez votre connexion.
    goto :fin
)

echo.
echo  ================================================
echo   PUBLIE sur GitHub avec succes !
echo   https://github.com/yasserathoumani95-maker/faidakomori
echo  ================================================

:fin
echo.
pause
