# Icônes PWA - Optimisation future

## État actuel
- **SVG unique** : `TONTONKAD.svg` (13.8kb) utilisé pour toutes les tailles
- **Fonctionnel** : Compatible tous navigateurs PWA

## Optimisation recommandée
Générer des PNG optimisées pour de meilleures performances :

```bash
# À partir de TONTONKAD.svg, générer :
- icon-192.png (192x192)
- icon-512.png (512x512)
- icon-maskable-192.png (192x192 avec padding)
```

## Manifest.json optimisé
```json
"icons": [
  {
    "src": "TONTONKAD.svg",
    "sizes": "any",
    "type": "image/svg+xml",
    "purpose": "any"
  },
  {
    "src": "icon-192.png",
    "sizes": "192x192",
    "type": "image/png",
    "purpose": "any"
  },
  {
    "src": "icon-512.png",
    "sizes": "512x512",
    "type": "image/png",
    "purpose": "any"
  },
  {
    "src": "icon-maskable-192.png",
    "sizes": "192x192",
    "type": "image/png",
    "purpose": "maskable"
  }
]
```

## Note développeur
L'actuel SVG fonctionne parfaitement. Cette optimisation est optionnelle pour améliorer les performances sur mobile.