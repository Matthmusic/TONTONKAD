# TontonKAD Auto-Installer & Launcher
# Ce script verifie Python, l'installe si necessaire, et lance TontonKAD

param(
    [switch]$Force  # Force la reinstallation de Python
)

# Configuration
$pythonMinVersion = "3.8"
$pythonDownloadUrl = "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe"
$pythonInstaller = "python-installer.exe"

# Couleurs pour PowerShell
function Write-ColorHost {
    param(
        [string]$Text,
        [string]$Color = "White"
    )
    Write-Host $Text -ForegroundColor $Color
}

function Write-Header {
    Clear-Host
    Write-ColorHost "===============================================" "Cyan"
    Write-ColorHost "   TontonKAD - Simulateur de Multitubulaires" "Yellow"
    Write-ColorHost "        Installation & Lancement Automatique" "Yellow"
    Write-ColorHost "===============================================" "Cyan"
    Write-Host ""
}

function Test-PythonInstalled {
    try {
        $pythonVersion = python --version 2>$null
        if ($pythonVersion -match "Python (\d+\.\d+)") {
            $version = [version]$matches[1]
            $minVersion = [version]$pythonMinVersion

            if ($version -ge $minVersion) {
                Write-ColorHost "✅ Python $($matches[1]) detecte et compatible" "Green"
                return $true
            } else {
                Write-ColorHost "⚠️  Python $($matches[1]) detecte mais trop ancien (minimum: $pythonMinVersion)" "Yellow"
                return $false
            }
        }
    } catch {
        Write-ColorHost "❌ Python non detecte" "Red"
        return $false
    }
    return $false
}

function Install-Python {
    Write-ColorHost "📥 Telechargement de Python..." "Yellow"

    try {
        # Telecharger Python
        Invoke-WebRequest -Uri $pythonDownloadUrl -OutFile $pythonInstaller -UseBasicParsing
        Write-ColorHost "✅ Python telecharge avec succes" "Green"

        # Installer Python silencieusement
        Write-ColorHost "🔧 Installation de Python en cours..." "Yellow"
        Write-ColorHost "   (Cela peut prendre quelques minutes)" "Gray"

        $installArgs = @(
            "/quiet",
            "InstallAllUsers=1",
            "PrependPath=1",
            "Include_test=0",
            "Include_doc=0",
            "Include_dev=0",
            "Include_debug=0",
            "Include_launcher=1",
            "InstallLauncherAllUsers=1"
        )

        Start-Process -FilePath $pythonInstaller -ArgumentList $installArgs -Wait -NoNewWindow

        # Nettoyer le fichier d'installation
        Remove-Item $pythonInstaller -ErrorAction SilentlyContinue

        # Actualiser les variables d'environnement
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

        Write-ColorHost "✅ Python installe avec succes !" "Green"
        Write-Host ""
        Write-ColorHost "⚠️  IMPORTANT: Vous devrez peut-etre redemarrer votre ordinateur" "Yellow"
        Write-ColorHost "   ou fermer/rouvrir cette fenetre pour que Python soit detecte." "Yellow"
        Write-Host ""

        return $true

    } catch {
        Write-ColorHost "❌ Erreur lors de l'installation de Python: $($_.Exception.Message)" "Red"
        return $false
    }
}

function Start-TontonKAD {
    Write-ColorHost "🚀 Demarrage de TontonKAD..." "Green"

    # Verifier que server.py existe
    if (-not (Test-Path "server.py")) {
        Write-ColorHost "❌ Fichier server.py introuvable dans le dossier actuel" "Red"
        Write-ColorHost "   Dossier actuel: $(Get-Location)" "Gray"
        Write-Host ""
        Write-ColorHost "Assurez-vous d'executer ce script depuis le dossier TontonKAD" "Yellow"
        return $false
    }

    Write-ColorHost "📂 Dossier: $(Get-Location)" "Gray"
    Write-ColorHost "🌐 URL: http://localhost:8000" "Cyan"
    Write-ColorHost "🛑 Arret: Ctrl+C" "Gray"
    Write-Host ""
    Write-ColorHost "===============================================" "Cyan"
    Write-Host ""

    try {
        # Lancer le serveur Python
        python server.py
    } catch {
        Write-ColorHost "❌ Erreur lors du lancement: $($_.Exception.Message)" "Red"
        return $false
    }

    return $true
}

function Main {
    Write-Header

    # Verifier les permissions administrateur
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

    if (-not $isAdmin) {
        Write-ColorHost "⚠️  Ce script necessite des droits administrateur pour installer Python" "Yellow"
        Write-ColorHost "   Relancez PowerShell en tant qu'administrateur ou installez Python manuellement" "Gray"
        Write-Host ""
    }

    Write-ColorHost "[1/3] Verification de Python..." "Cyan"

    if ((Test-PythonInstalled) -and (-not $Force)) {
        Write-Host ""
        Write-ColorHost "[2/3] Python OK - Passage au lancement" "Cyan"
        Write-ColorHost "[3/3] Lancement de TontonKAD..." "Cyan"
        Write-Host ""

        if (Start-TontonKAD) {
            Write-ColorHost "✅ TontonKAD lance avec succes !" "Green"
        } else {
            Write-ColorHost "❌ Echec du lancement de TontonKAD" "Red"
        }
    } else {
        Write-Host ""
        Write-ColorHost "[2/3] Installation de Python..." "Cyan"

        if ($isAdmin) {
            if (Install-Python) {
                Write-Host ""
                Write-ColorHost "[3/3] Test du lancement..." "Cyan"

                # Reessayer la detection de Python
                if (Test-PythonInstalled) {
                    Write-Host ""
                    if (Start-TontonKAD) {
                        Write-ColorHost "✅ Installation et lancement reussis !" "Green"
                    } else {
                        Write-ColorHost "❌ Python installe mais echec du lancement" "Red"
                    }
                } else {
                    Write-ColorHost "⚠️  Python installe mais non detecte" "Yellow"
                    Write-ColorHost "   Redemarrez votre ordinateur et relancez ce script" "Gray"
                }
            } else {
                Write-ColorHost "❌ Echec de l'installation de Python" "Red"
            }
        } else {
            Write-ColorHost "❌ Droits administrateur requis pour installer Python" "Red"
            Write-Host ""
            Write-ColorHost "Solutions:" "Yellow"
            Write-ColorHost "1. Relancer PowerShell en tant que administrateur" "Gray"
            Write-ColorHost "2. Installer Python manuellement depuis https://python.org" "Gray"
            Write-ColorHost "3. Utiliser le Windows Store (Python 3.11)" "Gray"
        }
    }

    Write-Host ""
    Write-ColorHost "===============================================" "Cyan"
    Write-Host "Appuyez sur une touche pour fermer..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# Execution du script principal
Main