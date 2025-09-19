@echo off
title TontonKAD - Auto-Installer
color 0B

echo.
echo  ===============================================
echo   TontonKAD - Installation Automatique
echo  ===============================================
echo.
echo  Ce script va:
echo   1. Verifier si Python est installe
echo   2. Telecharger et installer Python si necessaire
echo   3. Lancer TontonKAD automatiquement
echo.
echo  ⚠️  Droits administrateur requis pour installation
echo.
echo  ===============================================
echo.

REM Vérifier si PowerShell est disponible
powershell -Command "Write-Host 'PowerShell OK'" >nul 2>&1
if errorlevel 1 (
    echo ❌ PowerShell non detecte
    echo    Ce script necessite PowerShell
    pause
    exit /b 1
)

REM Lancer le script PowerShell avec politique d'exécution
echo 🚀 Lancement de l'auto-installateur...
echo.

powershell -ExecutionPolicy Bypass -File "TontonKAD-Launcher.ps1"

if errorlevel 1 (
    echo.
    echo ❌ Erreur lors de l'execution du script PowerShell
    echo.
    echo Solutions:
    echo - Executer en tant qu'administrateur
    echo - Autoriser l'execution de scripts PowerShell
    echo.
    pause
)

echo.
echo Script termine.
pause