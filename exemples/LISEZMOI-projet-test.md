# Projet de test complet

`projet-test-complet.json` : à ouvrir avec **Projet → Ouvrir** (ou glisser dans l'app).
Généré par l'application elle-même (BIG BRAIN réel, catalogue `data/`), donc au format exact.

## Le réseau

```
TGBT ──20 m── C1 ──45 m── C2 ──8 m── CF2 Parking
               │            │
             12 m        (sans longueur)
               │            │
          CF1 Atelier   S1 Éclairage
```

| Liaison | Câbles | Chemin |
|---|---|---|
| L1 TGBT → CF1 Atelier | 2 × (3 × 1x240 + N 1x240 + PE 1x120) U1000 AR2V | TGBT → C1 → CF1 |
| L2 TGBT → CF2 Parking | U1000 R2V 4x95 | TGBT → C1 → C2 → CF2 |
| L3 TGBT → S1 Éclairage | U1000 R2V 4x16 | TGBT → C1 → C2 → S1 |
| L4 TGBT → Attente future | U1000 R2V 4x35 | TGBT → C1 (s'arrête) |
| Réserve | TPC 160 | 2 sur TGBT → C1, 1 sur C1 → C2 |

- **C1** : modèle automatique (catalogue) — traversées droites et en angle.
- **C2** : chambre **maçonnée**, paroi 200 mm, tampon 800 × 800 D400, chaussée.
- **TGBT** : tableau 1200 × 600 ; **CF1** : coffret 400 × 200 (volontairement trop petit) ; **CF2** : 600 × 300.

## Ce qu'il faut voir (cas testés exprès)

1. **Synoptique** (2D et isométrique) : 6 éléments, 5 tronçons, fourreaux par ligne (Ø), distances.
2. **Continuité** : « TGBT -> Attente future s'interrompt dans C1 » (L4 volontaire).
3. **Métré** : 275 m de fourreaux sur 85 m de tranchée ; « Longueur manquante : C2 → S1 Éclairage ».
4. **Coffret CF1** (sélectionner) : la nappe NE PASSE PAS dans 400 × 200.
5. **Chambre C1** : modèle catalogue choisi seul, 3 traversées droites, 1 en angle (L1 vers CF1), L4 s'arrête.
6. **Chambre C2** : maçonnée 1000 × 800, tampon dessiné, traversée en angle vers S1, la réserve s'arrête.
   Passer la classe en B125 → alerte « D400 minimum (à valider) ».
7. **Répartition** : sélectionner C1 → CF1, boutons « + Ø… » repris de TGBT → C1.
8. **Double-clic** sur une face de chambre → sa coupe ; flèches → chambre suivante.
9. **Export PDF** (case 3D cochée) : pages coupe, 3D, chambres, synoptique.
10. **Variantes** de placement sur une coupe (bouton du rail droit).

Valeurs normatives et de chambre maçonnée : **à valider**.
