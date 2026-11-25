@echo off
REM ============================================================================
REM  Publication d'une version TONTONKAD / nodial sur GitHub (Windows, cmd)
REM
REM  Usage :   scripts\publier-release.bat 2.9.2
REM
REM  Relançable sans risque : chaque étape vérifie ce qui existe déjà et
REM  réessaie (jusqu'à 6 fois, 20 s d'attente) quand GitHub répond en erreur.
REM    1. main à jour et version du package.json = version demandée
REM    2. tag vX.Y.Z sur GitHub (tag simple, sur main)
REM    3. installeur : artefact du workflow GitHub, sinon compilation locale
REM    4. release GitHub créée (notes tirées du changelog de cea-app.json)
REM    5. installeur + latest.yml + blockmap envoyés sur la release
REM  Prérequis : git, node/npm, GitHub CLI (gh) connecté : gh auth status
REM ============================================================================
setlocal EnableExtensions EnableDelayedExpansion

set "V=%~1"
if "%V%"=="" (
  echo Usage : scripts\publier-release.bat 2.9.2
  exit /b 1
)
set "TAG=v%V%"
set "REPO=Matthmusic/TONTONKAD"
set "DOSSIER=dist-release-%V%"
set "EXE=TONTONKAD-Setup-%V%.exe"

cd /d "%~dp0.."
echo.
echo === Publication de %TAG% sur %REPO% ===
echo.

REM ---------------------------------------------------------------- prérequis
where gh >nul 2>&1 || ( echo [ERREUR] GitHub CLI ^(gh^) introuvable. & exit /b 1 )
gh auth status >nul 2>&1 || ( echo [ERREUR] gh n'est pas connecte : lance "gh auth login". & exit /b 1 )

REM ------------------------------------------------- 1. main et numéro de version
echo [1/5] Branche main...
git checkout main || ( echo [ERREUR] impossible de passer sur main ^(fichiers modifies ?^) & exit /b 1 )
git pull origin main || ( echo [ERREUR] git pull origin main a echoue & exit /b 1 )
for /f "usebackq delims=" %%v in (`node -p "require('./package.json').version"`) do set "VPKG=%%v"
if not "!VPKG!"=="%V%" (
  REM passage à la nouvelle version ; si la version actuelle n'a jamais eu de
  REM release (ex. 2.9.1 bloquée par GitHub), son changelog est repris tel quel
  set "REMPLACE="
  gh release view v!VPKG! --repo %REPO% >nul 2>&1 || set "REMPLACE=--remplace"
  echo       Passage de !VPKG! a %V% !REMPLACE!...
  node scripts\version.js %V% !REMPLACE! || ( echo [ERREUR] changement de version impossible & exit /b 1 )
  git add package.json package-lock.json cea-app.json scripts\version.js scripts\publier-release.bat
  git commit -m "Version %V%" || ( echo [ERREUR] commit de version impossible & exit /b 1 )
)
for /f "usebackq delims=" %%v in (`node -p "require('./cea-app.json').app.version"`) do set "VCEA=%%v"
if not "!VCEA!"=="%V%" echo [ATTENTION] cea-app.json est en version !VCEA! ^(le CEA App Store affichera cette version^).
git log --oneline origin/main..main | findstr . >nul && (
  echo       main a des commits non pousses : envoi...
  call :reessayer git push origin main || exit /b 1
)
echo       OK : main en %V%, a jour sur GitHub.

REM ------------------------------------------------------------- 2. tag sur GitHub
echo [2/5] Tag %TAG%...
git ls-remote --tags origin %TAG% | findstr /C:"refs/tags/%TAG%" >nul
if errorlevel 1 (
  git tag -d %TAG% >nul 2>&1
  git tag %TAG% main
  call :reessayer git push origin %TAG% || exit /b 1
  echo       Tag pousse : le workflow de compilation demarre sur GitHub.
) else (
  echo       Tag deja present sur GitHub.
)

REM ------------------------------------------------------------ 3. l'installeur
echo [3/5] Installeur...
if exist "%DOSSIER%\%EXE%" if exist "%DOSSIER%\latest.yml" (
  echo       Deja present dans %DOSSIER%.
  goto :release
)
if exist "%DOSSIER%" rmdir /s /q "%DOSSIER%"
set "RUN="
set /a ATTENTE=0
:chercher_run
for /f "usebackq delims=" %%r in (`gh run list --repo %REPO% --workflow build.yml --branch %TAG% --limit 1 --json databaseId --jq ".[0].databaseId" 2^>nul`) do set "RUN=%%r"
if not defined RUN if !ATTENTE! LSS 9 (
  REM juste après le push du tag, GitHub met quelques secondes à créer le workflow
  set /a ATTENTE+=1
  timeout /t 10 /nobreak >nul
  goto :chercher_run
)
if defined RUN (
  echo       Workflow GitHub no !RUN! : attente de la fin de la compilation...
  gh run watch !RUN! --repo %REPO% --exit-status >nul 2>&1
  echo       Recuperation de l'installeur compile par GitHub...
  gh run download !RUN! --repo %REPO% -n windows-build -D "%DOSSIER%" >nul 2>&1
)
if not exist "%DOSSIER%\%EXE%" (
  echo       Pas d'artefact GitHub utilisable : compilation locale ^(quelques minutes^)...
  call npm ci || ( echo [ERREUR] npm ci a echoue & exit /b 1 )
  call npx electron-builder --win --publish never || ( echo [ERREUR] la compilation a echoue & exit /b 1 )
  mkdir "%DOSSIER%" 2>nul
  copy /y "dist\%EXE%" "%DOSSIER%\" >nul
  copy /y "dist\%EXE%.blockmap" "%DOSSIER%\" >nul
  copy /y "dist\latest.yml" "%DOSSIER%\" >nul
)
if not exist "%DOSSIER%\%EXE%" ( echo [ERREUR] %EXE% introuvable. & exit /b 1 )
if not exist "%DOSSIER%\latest.yml" ( echo [ERREUR] latest.yml introuvable : indispensable a la mise a jour automatique. & exit /b 1 )
echo       OK : %DOSSIER%\%EXE%

:release
REM ------------------------------------------------------------ 4. la release
echo [4/5] Release GitHub...
gh release view %TAG% --repo %REPO% >nul 2>&1
if errorlevel 1 (
  node -e "const c=require('./cea-app.json').changelog['%V%'];console.log(c?c.changes.map(x=>'- '+x).join('\n'):'Version %V%')" > "%DOSSIER%\notes.md"
  call :reessayer gh release create %TAG% --repo %REPO% --title "TONTONKAD %V%" --notes-file "%DOSSIER%\notes.md" --verify-tag || exit /b 1
  echo       Release creee.
) else (
  echo       Release deja creee.
)

REM ------------------------------------------------------------ 5. les fichiers
echo [5/5] Envoi des fichiers sur la release...
set "FICHIERS="%DOSSIER%\%EXE%" "%DOSSIER%\latest.yml""
if exist "%DOSSIER%\%EXE%.blockmap" set "FICHIERS=!FICHIERS! "%DOSSIER%\%EXE%.blockmap""
call :reessayer gh release upload %TAG% --repo %REPO% --clobber !FICHIERS! || exit /b 1

echo.
gh release view %TAG% --repo %REPO%
echo.
echo === %TAG% publiee. Les postes en version precedente verront la mise a jour au demarrage. ===
exit /b 0

REM ---------------------------------------------------------------------------
REM  :reessayer <commande...>  : jusqu'à 6 essais, 20 s entre chaque
REM ---------------------------------------------------------------------------
:reessayer
set /a ESSAI=1
:reessayer_boucle
%*
if not errorlevel 1 exit /b 0
if !ESSAI! GEQ 6 (
  echo [ERREUR] echec apres !ESSAI! essais : %*
  echo          GitHub a peut-etre un incident : https://www.githubstatus.com
  echo          Relance ce script plus tard, il reprendra la ou il s'est arrete.
  exit /b 1
)
echo       GitHub ne repond pas correctement ^(essai !ESSAI!/6^), nouvel essai dans 20 s...
timeout /t 20 /nobreak >nul
set /a ESSAI+=1
goto :reessayer_boucle
