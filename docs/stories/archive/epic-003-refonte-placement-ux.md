# Epic 003 : Refonte UX placement — Hub inventaire, panel propositions & fondations

---

## Métadonnées

- **Epic ID** : EPIC-003
- **Titre** : Refonte UX placement — Hub inventaire, panel propositions & fondations
- **Statut** : 📋 Planifié
- **Priorité** : P1 (Critique)
- **Owner** : Matthieu MAUREL
- **Créé le** : 2026-06-26
- **Source** : [Brainstorming session 2026-06-26](brainstorming-session-results.md)
- **Version cible** : v2.6
- **Estimation totale** : 8-12 jours (5 stories)

---

## 🎯 Vue d'ensemble

### Contexte

L'Epic 002 expose les variantes de placement via un panel de cards. En parallèle, une session de brainstorming (2026-06-26) a révélé trois lacunes majeures dans l'UX de placement :

1. **L'inventaire n'est pas un hub** : les fourreaux sont ajoutés un à un par clic molette, sans vision quantitative ni compteur placés/total.
2. **Le moteur favorise la hauteur** : les configurations générées tendent à être plus hautes que larges, à l'inverse de la logique tranchée métier (creuser large > profond).
3. **Le bouton "Redimensionner" est trop abstrait** : l'utilisateur ne voit pas les options disponibles ni l'impact avant d'appliquer.
4. **Ctrl+Z incomplet** : les déplacements par drag et les redimensionnements de boîte ne sont pas annulables.

### Problème

L'UX de placement force l'utilisateur à raisonner à l'envers : il place d'abord sans vision globale, puis redimensionne sans alternatives visuelles. Le moteur ne respecte pas l'invariant métier tranchée (largeur ≥ hauteur). Le Ctrl+Z crée une fausse confiance — il couvre les ajouts/suppressions mais pas les déplacements ni les redimensionnements.

### Solution

Trois axes complémentaires issus du brainstorming :

- **Fondations Ctrl+Z** : couvrir tous les cas manquants (drag, redim boîte, dimensions)
- **Scorer tranchée** : encoder la préférence largeur > hauteur comme invariant métier dans `MultiObjectiveScorer`
- **Hub inventaire** : l'inventaire devient le point de départ avec quantités +/-, compteur placés/total, et 3 modes de placement contextuels (A/B/C) déclenchés automatiquement selon le contexte
- **Panel 3 cards** : remplacer le bouton "Redimensionner" par des propositions visuelles cliquables avec redimensionnement automatique

---

## 🏗️ Architecture technique

### Fichiers impactés

| Fichier | Type de modification |
|---------|---------------------|
| `src/renderer/script.js` | Fix Ctrl+Z drag + redim, logique modes A/B/C, resizeTrayToFit() |
| `src/renderer/placement-engine.js` | MultiObjectiveScorer : logique tranchée + seuil 80% |
| `src/renderer/index.html` | Hub inventaire +/- quantité, panel 3 cards, sélecteur quantité |
| `src/renderer/style.css` | Styles inventaire hub, cards panel, animation pulse |

### Architecture des 3 modes de placement

```
Sélecteur fourreau
│
├── Type sélectionné + clic direct canvas
│   → Mode A : gravité, placement immédiat (ADN actuel conservé)
│   → Ajoute automatiquement à l'inventaire
│
└── Type sélectionné + quantité + bouton "Ajouter"
    → Pulse feedback sur l'inventaire
    → Apparaît dans la liste avec compteur [0/N placés]
    ├── Clic sur type dans inventaire → Mode C : grille guidée + osnap
    └── Bouton ⚡ PLACEMENT AUTO → Mode B : auto + panel propositions
```

### Sélecteur fourreau étendu

```
┌──────────────────────────────────────────────┐
│  [TPC 200 ▼]    [−] 4 [+]    [+ Ajouter]   │
└──────────────────────────────────────────────┘
```

### Inventaire fourreaux (hub central)

```
┌─────────────────────────────────────────────┐
│ INVENTAIRE FOURREAUX                        │
│                                             │
│ TPC 200  [−] 3 [+]   ░░░ 1 placé / 3      │
│ TPC 125  [−] 6 [+]   ░░░ 6 placés ✓        │
│ TPC 63   [−] 4 [+]   ░░░ 0 placés / 4      │
│                                             │
│  [⚡ PLACEMENT AUTO]    [✋ MANUEL]         │
└─────────────────────────────────────────────┘
```

### Panel de propositions (remplace "Redimensionner")

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   COMPACT        │  │ ⭐ OPTIMISÉ  ✨  │  │   RECTANGLE      │
│                  │  │ ░░░░░░░░░░░░░░░ │  │                  │
│ Placement actuel │  │ Meilleur score   │  │ Grille type 4×3  │
│ boîte serrée     │  │ + redim auto     │  │ (si score > 80%) │
│   [Appliquer]    │  │   [Appliquer]    │  │   [Appliquer]    │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

### État du Ctrl+Z — diagnostic

| Opération | Avant Epic 003 | Après Epic 003 |
|-----------|---------------|----------------|
| Ajout fourreau/câble | ✅ Annulable | ✅ Conservé |
| Suppression | ✅ Annulable | ✅ Conservé |
| Rotation boîte | ⚠️ Partiel (positions ok, dims non) | ✅ Annulable |
| **Drag/move** | ❌ Non annulable | ✅ Annulable |
| **Redim boîte** | ❌ Non annulable | ✅ Annulable |
| **Placement auto** | ❌ Non annulable | ✅ Annulable |

---

## 📋 Stories

| Story | Titre | Estimation | Priorité | Statut |
|-------|-------|------------|----------|--------|
| [3.1](3.1.ctrl-z-complet.md) | Ctrl+Z complet — drag, redim boîte, dimensions | 1-2 jours | P0 | ✅ Done |
| [3.2](3.2.scorer-tranchee.md) | Scorer logique tranchée + seuil 80% 3ème card | 1 jour | P1 | 🔍 Ready for Review |
| [3.3](3.3.panel-propositions.md) | Panel 3 cards — remplace bouton Redimensionner | 2-3 jours | P1 | 🔍 Ready for Review |
| [3.4](3.4.hub-inventaire.md) | Hub inventaire — sélecteur quantité + modes A/B/C | 3-4 jours | P1 | 🔍 Ready for Review |
| [3.5](3.5.remplissage-vides.md) | Remplissage intelligent vides (N petits / 1 grand) | 2-3 jours | P2 | 🔍 Ready for Review |

**Total estimé : 9-13 jours**

---

## 🎯 Jalons & Critères de succès

### Fin Story 3.1 — Ctrl+Z complet
- ✅ Ctrl+Z annule un drag/move de fourreau ou câble
- ✅ Ctrl+Z annule un redimensionnement manuel de la boîte
- ✅ Ctrl+Z annule une rotation de boîte (positions + dimensions)
- ✅ Ctrl+Z annule un placement auto (avant d'appliquer une config)
- ✅ Aucune régression sur les cas existants (ajout, suppression)

### Fin Story 3.2 — Scorer tranchée
- ✅ Les configurations générées favorisent largeur ≥ hauteur
- ✅ La 3ème card (Rectangle) n'apparaît que si son score > 80%
- ✅ Tests unitaires sur `MultiObjectiveScorer` mis à jour

### Fin Story 3.3 — Panel 3 cards
- ✅ Le bouton "Redimensionner" est remplacé par le panel
- ✅ Card COMPACT : applique le placement actuel + serre la boîte au lit de pose
- ✅ Card OPTIMISÉ ⭐ : applique la config optimale + redim auto + animation pulse
- ✅ Card RECTANGLE : affichée uniquement si score > 80%
- ✅ Clic sur une card → redimensionne la boîte automatiquement
- ✅ Toutes les cards respectent : entraxe + lit de pose + axes verrouillés

### Fin Story 3.4 — Hub inventaire
- ✅ Le sélecteur fourreau inclut [−][+] quantité + bouton "Ajouter"
- ✅ L'inventaire affiche le compteur [placés/total] par type
- ✅ Mode A déclenché par clic direct canvas (comportement actuel conservé)
- ✅ Mode C déclenché par clic sur un type dans l'inventaire (grille visuelle existante activée)
- ✅ Mode B déclenché par bouton ⚡ PLACEMENT AUTO
- ✅ Ajout en Mode A alimente automatiquement l'inventaire

### Fin Story 3.5 — Remplissage vides
- ✅ Le moteur détecte les espaces où N petits fourreaux peuvent remplacer 1 grand
- ✅ Une proposition de remplissage est soumise à validation utilisateur (pas automatique)
- ✅ La validation respecte entraxe + lit de pose

---

## ⚠️ Points d'attention

| Risque | Mitigation |
|--------|------------|
| `saveStateToHistory()` ne capture pas les dimensions boîte | Étendre le snapshot pour inclure `WORLD_W_MM`, `WORLD_H_MM`, `lockWidth`, `lockHeight` — Story 3.1 |
| `startDrag()` ne sauvegarde pas avant déplacement | Ajouter `saveStateToHistory()` en début de `startDrag()` ([script.js:6083](../../src/renderer/script.js#L6083)) — Story 3.1 |
| Remplissage N petits / 1 grand peut surprendre l'utilisateur | Toujours soumettre à validation explicite — Story 3.5 |
| Hub inventaire change l'ADN du placement (clic molette) | Mode A conservé à l'identique pour ne pas désorienter les utilisateurs existants |
| Panel 3 cards coexiste avec Epic 002 panel variantes | Clarifier quelle UI prend le dessus — à trancher en Story 3.3 |

---

## 🔗 Dépendances

- **Epic 002** (v2.5) doit être livré avant Epic 003 — le panel propositions s'appuie sur `PlacementOrchestrator`
- **Branche sauvegarde** : créer `backup/placement-engine-pre-003` avant de démarrer Story 3.2

---

**Epic créé le** : 2026-06-26
**Statut** : 📋 Planifié — Story 3.1 prête à démarrer
