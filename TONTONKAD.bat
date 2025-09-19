@echo off
title TontonKAD
color 0F

echo.
echo  ================================================
echo   TontonKAD - Simulateur de Multitubulaires
echo  ================================================
echo.

REM Verifier si Python est installe
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python non detecte
    echo.
    echo 📥 Telechargement et installation de Python...
    echo    Cela va prendre quelques minutes
    echo.

    REM Telecharger Python depuis python.org
    echo    Telechargement en cours...
    powershell -Command "& {Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe' -OutFile 'python-installer.exe'}"

    if exist python-installer.exe (
        echo    ✅ Telechargement termine
        echo.
        echo    Installation en cours...
        echo    ^(Une fenetre d'installation va s'ouvrir^)

        REM Installer Python avec les bonnes options
        python-installer.exe /quiet InstallAllUsers=1 PrependPath=1 Include_launcher=1

        REM Nettoyer
        del python-installer.exe

        echo    ✅ Installation terminee
        echo.
        echo    ⚠️  Redemarrez cette fenetre ou votre PC
        echo       puis relancez TONTONKAD.bat
        echo.
        pause
        exit
    ) else (
        echo    ❌ Echec du telechargement
        echo.
        echo    Installez Python manuellement:
        echo    https://www.python.org/downloads/
        echo.
        pause
        exit
    )
)

REM Python detecte - afficher la version
for /f "tokens=*" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo ✅ %PYTHON_VERSION% detecte
echo.

REM Verifier que server.py existe
if not exist "server.py" (
    echo ❌ Fichier server.py introuvable
    echo    Assurez-vous d'etre dans le bon dossier
    pause
    exit
)

echo 🚀 Lancement de TontonKAD...
echo 🌐 URL: http://localhost:8000
echo 🛑 Arret: Ctrl+C
echo.
echo ================================================
echo.

python server.py

echo.
echo 🛑 TontonKAD arrete
pause