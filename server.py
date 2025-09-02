#!/usr/bin/env python3
"""
Serveur de développement simple pour TontonKAD
Usage: python server.py
"""
import http.server
import socketserver
import webbrowser
import os
from pathlib import Path

PORT = 8000
HOST = "localhost"

def main():
    # Se placer dans le dossier app
    app_dir = Path(__file__).parent / "app"
    if not app_dir.exists():
        print("Erreur: Le dossier 'app' n'existe pas")
        return
    
    os.chdir(app_dir)
    
    print(f"Demarrage du serveur TontonKAD")
    print(f"Dossier: {app_dir}")
    print(f"URL: http://{HOST}:{PORT}")
    print(f"Arret: Ctrl+C")
    print()

    # Handler avec CORS pour les CSV
    class CORSHandler(http.server.SimpleHTTPRequestHandler):
        def end_headers(self):
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', '*')
            super().end_headers()

    try:
        with socketserver.TCPServer((HOST, PORT), CORSHandler) as httpd:
            print(f"Serveur demarre sur http://{HOST}:{PORT}")
            
            # Ouvrir le navigateur
            try:
                webbrowser.open(f"http://{HOST}:{PORT}")
                print("Navigateur ouvert automatiquement")
            except:
                print("Ouvrez manuellement votre navigateur")
            
            print("\n" + "="*50)
            httpd.serve_forever()
            
    except OSError as e:
        if e.errno == 10048:  # Port occupé
            print(f"Port {PORT} deja utilise")
            print("   Modifiez PORT dans server.py ou fermez l'autre serveur")
        else:
            print(f"Erreur: {e}")
        input("Appuyez sur Entree...")
    except KeyboardInterrupt:
        print("\nServeur arrete")

if __name__ == "__main__":
    main()