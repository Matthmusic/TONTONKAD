@echo off
title TontonKAD - Simulateur Multitubulaires
color 0A

echo.
echo  ================================================
echo   TontonKAD - Simulateur de Multitubulaires
echo  ================================================
echo.

REM Vérifier si Python est installé
echo [1/3] Verification de Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo ❌ ERREUR: Python n'est pas installe ou pas dans le PATH
    echo.
    echo Solutions:
    echo - Installer Python depuis https://python.org
    echo - Ajouter Python au PATH systeme
    echo.
    pause
    exit /b 1
)

REM Afficher la version Python
for /f "tokens=*" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo    ✅ %PYTHON_VERSION% detecte

echo [2/3] Verification des fichiers...
if not exist "server.py" (
    echo    ❌ ERREUR: server.py introuvable dans %CD%
    echo.
    pause
    exit /b 1
)
echo    ✅ server.py trouve

echo [3/3] Demarrage du serveur...
echo.
echo ⏳ Lancement en cours...
echo 🌐 URL: http://localhost:8000
echo 🛑 Arret: Ctrl+C
echo.
echo ================================================
echo.

python server.py

echo.
echo ================================================
echo 🛑 Serveur arrete
pause