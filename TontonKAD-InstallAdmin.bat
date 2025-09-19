@echo off
title TontonKAD - Installation Admin

REM Vérifier si on est déjà administrateur
openfiles >nul 2>&1
if %errorlevel% equ 0 (
    REM Déjà administrateur - lancer directement
    goto :RunInstaller
) else (
    REM Pas administrateur - demander élévation
    echo 🔒 Elevation des privileges necessaire...
    echo    Cliquez "Oui" dans la fenetre UAC qui va s'ouvrir
    echo.

    REM Relancer en tant qu'administrateur
    powershell -Command "Start-Process cmd -ArgumentList '/c cd /d \"%~dp0\" && TontonKAD-AutoInstall.bat' -Verb RunAs"
    exit /b 0
)

:RunInstaller
REM On est administrateur - lancer l'installateur
echo ✅ Privileges administrateur obtenus
echo.
call TontonKAD-AutoInstall.bat
pause