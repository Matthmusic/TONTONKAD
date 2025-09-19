@echo off
title TontonKAD - Lancement Simple
color 0A

echo.
echo  ===============================================
echo   TontonKAD - Lancement Simple
echo  ===============================================
echo.

REM Vérification rapide de Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python non detecte
    echo.
    echo Solutions:
    echo  1. Utiliser TontonKAD-InstallAdmin.bat pour auto-installation
    echo  2. Installer Python manuellement depuis https://python.org
    echo.
    pause
    exit /b 1
)

REM Afficher la version Python
for /f "tokens=*" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo ✅ %PYTHON_VERSION% detecte
echo 🌐 URL: http://localhost:8000
echo 🛑 Arret: Ctrl+C
echo.
echo ===============================================
echo.

python server.py

echo.
echo 🛑 Serveur arrete
pause