const CACHE_NAME = 'tontonkad-dev-v1.0.3';
const urlsToCache = [
  './',
  './index.html',
  './script.js',
  './style.css',
  './TONTONKAD.svg',
  './manifest.json',
  './dimension-button-handler.js',
  './data/cables.csv',
  './data/fourreaux.csv',
  './data/chemins_de_cable.csv'
];

// Installation du service worker - mise en cache des ressources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        return self.skipWaiting(); // Active immédiatement le nouveau SW
      })
      .catch((error) => {
        console.error('❌ Erreur lors de la mise en cache:', error);
      })
  );
});

// Activation du service worker - nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim(); // Prend le contrôle immédiatement
    })
  );
});

// Interception des requêtes - stratégie Cache First pour l'offline
self.addEventListener('fetch', (event) => {
  // Ignorer les requêtes non-HTTP
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // En développement (servi depuis localhost), toujours aller chercher sur le réseau pour éviter les problèmes de cache.
  if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Retourner la réponse du cache si disponible
        if (response) {
          return response;
        }

        // Sinon, récupérer depuis le réseau
        return fetch(event.request).then((response) => {
          // Vérifier si la réponse est valide
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Cloner la réponse pour la mettre en cache
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return response;
        }).catch(() => {
          // En cas d'échec réseau, afficher une page d'erreur basique
          if (event.request.destination === 'document') {
            return new Response(`
              <!DOCTYPE html>
              <html>
              <head>
                <title>TontonKAD - Hors ligne</title>
                <meta charset="utf-8">
                <style>
                  body { font-family: Arial; text-align: center; padding: 50px; }
                  .offline { color: #666; }
                </style>
              </head>
              <body>
                <h1>🔌 TontonKAD</h1>
                <p class="offline">Application disponible hors ligne</p>
                <p>Vérifiez votre connexion internet pour charger les dernières données.</p>
              </body>
              </html>
            `, {
              headers: { 'Content-Type': 'text/html' }
            });
          }
        });
      })
  );
});

// Gestion des messages depuis l'application principale
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});