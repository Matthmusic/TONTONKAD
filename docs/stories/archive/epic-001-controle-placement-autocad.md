# Epic 001 : Système de contrôle de placement AutoCAD-like

---

## Métadonnées

- **Epic ID** : EPIC-001
- **Titre** : Système de contrôle de placement AutoCAD-like
- **Statut** : 📋 Planifié
- **Priorité** : P0 (Critique)
- **Owner** : Matthieu MAUREL
- **Créé le** : 2026-06-25
- **Version cible** : v2.5
- **Estimation totale** : 6-8 jours (3 stories)

---

## 🎯 Vue d'ensemble

### Problème

Le système de placement actuel de TontonKAD souffre de deux incohérences majeures :

1. **Gravité toujours active** : les fourreaux "tombent" en permanence, ce qui est inadapté au placement précis et professionnel. Les électriciens veulent poser un fourreau et le voir rester exactement là où ils l'ont placé.

2. **Pas de contraintes de déplacement** : il n'existe aucun mécanisme d'accroche géométrique (type OSNAP AutoCAD) ni de contrainte orthogonale (type ORTHO AutoCAD), ce qui rend l'alignement manuel fastidieux et imprécis.

### Solution

Introduire un **système de contrôle de placement inspiré d'AutoCAD** avec :
- **Toggle gravité** : OFF par défaut (placement stable), ON à la demande (simulation physique)
- **F8 / Mode ORTHO** : contraindre le déplacement horizontal ou vertical seulement
- **F3 / Mode OSNAP** : accroche magnétique aux points géométriques des fourreaux existants

### Proposition de valeur

**Pour** les électriciens et bureaux d'études utilisant TontonKAD
**Qui** ont besoin de placer des fourreaux avec précision dans des multitubulaires
**Le** nouveau système de contrôle AutoCAD-like
**Est un** ensemble de modes de placement précis
**Qui** permet d'aligner, accrocher et contraindre les mouvements comme dans un logiciel de CAO
**Contrairement à** l'interface actuelle où la gravité perturbe le placement et l'alignement est manuel
**Notre solution** offre un contrôle professionnel avec des raccourcis clavier standards (F3/F8) connus des utilisateurs AutoCAD.

---

## 🏗️ Architecture technique

### Fichiers impactés

| Fichier | Type de modification |
|---------|---------------------|
| `src/renderer/script.js` | Ajout flag `gravityEnabled`, modifier `stepPhysics()`, `onMove()`, raccourcis clavier |
| `src/renderer/konva-fourreaux.js` | Extension `showGuides()` pour ORTHO et OSNAP visuels |
| `src/renderer/index.html` | Boutons toolbar + indicateurs de mode dans statusbar |
| `src/renderer/style.css` | Styles pour indicateurs F3/F8/gravité actifs |

### État actuel du système de physique (contexte dev)

- `stepPhysics()` — lignes 6428-6474 de `script.js`
- Flag `frozen` par objet — empêche la physique sur cet objet uniquement
- `GRAVITY = 0.25` — ligne 13, constante (ne pas modifier, juste conditionner)
- Boucle `tick()` — ligne 6476 : `stepPhysics()` → `redraw()` → `rAF`
- `snapToGrid` actif → nouveaux fourreaux posés avec `frozen = true` (ligne 1652)

---

## 📋 Stories

| Story | Titre | Estimation | Priorité | Statut |
|-------|-------|------------|----------|--------|
| [1.1](1.1.gravity-toggle.md) | Toggle gravité + mode placement précis par défaut | 2 jours | P0 | 📋 À faire |
| [1.2](1.2.f8-ortho-mode.md) | Mode ORTHO F8 — contrainte de déplacement orthogonal | 2 jours | P0 | 📋 À faire |
| [1.3](1.3.f3-osnap-mode.md) | Mode OSNAP F3 — accroche géométrique sur fourreaux | 3 jours | P0 | 📋 À faire |

**Total : 7 jours**

---

## 🎯 Jalons & Critères de succès

### Fin Story 1.1 — Gravité toggle

- ✅ Par défaut, un fourreau posé reste à sa position (pas de chute)
- ✅ Le mode gravité s'active/désactive via bouton et raccourci `G`
- ✅ Le passage gravité ON → unfreeze tous les objets
- ✅ Le passage gravité OFF → freeze tous les objets + reset vx/vy
- ✅ Indicateur visuel clair de l'état actif dans l'interface

### Fin Story 1.2 — ORTHO F8

- ✅ Pendant un drag, `F8` contraint le mouvement à H ou V depuis le point de départ
- ✅ Guide visuel coloré (vert) pendant le mode ORTHO
- ✅ Indicateur dans statusbar "ORTHO ON/OFF"

### Fin Story 1.3 — OSNAP F3

- ✅ `F3` active l'accroche aux centres des fourreaux existants
- ✅ `F3` active l'accroche aux quadrants (N/S/E/W) des fourreaux
- ✅ Icône de type d'accroche affichée près du curseur
- ✅ Rayon d'accroche configurable (défaut 15px)

---

## ⚠️ Points d'attention

| Risque | Mitigation |
|--------|------------|
| Incompatibilité F8/F3 avec mode gravité ON | Désactiver F3/F8 quand gravité ON — modes exclusifs |
| `frozen` par objet vs `gravityEnabled` global | Story 1.1 doit distinguer "frozen manuel" (X) de "frozen par mode placement" |
| Konva `showGuides()` à étendre sans casser l'existant | Passer un paramètre `mode` à `showGuides()` |
| `F3`/`F8` interceptés par le navigateur (mode web) | Utiliser `e.preventDefault()` sur ces touches |

---

## 📅 Séquence recommandée

```
Story 1.1 (gravité toggle)   ← fondation, doit être done en premier
    ↓
Story 1.2 (F8 ORTHO)         ← s'appuie sur dragStart mémorisé en 1.1
    ↓
Story 1.3 (F3 OSNAP)         ← s'appuie sur l'infrastructure snap de 1.1/1.2
```

---

**Epic créé le** : 2026-06-25
**Dernière mise à jour** : 2026-06-25
**Statut** : 📋 Planifié — Story 1.1 prête à démarrer
