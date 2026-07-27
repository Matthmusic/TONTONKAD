# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

<!-- Application de bureau Electron (Windows/Mac/Linux) construite en technologies web
     (HTML/Canvas/JS). Pas de langage de design natif iOS/Android → plateforme `web`. -->

## Users

Projeteurs et ingénieurs électriques de **Conception EA (CEA)**. Ils dimensionnent et
organisent des fourreaux et câbles électriques dans un contenant (tranchée, chemin de
câble, fourreau principal, chambre de tirage) puis produisent les plans associés.

Usage **mixte bureau + chantier** : au bureau d'études pendant la conception, et en
mobilité sur chantier pour dimensionner/vérifier in situ. La lisibilité doit tenir sur
des écrans variés (jusqu'aux petites hauteurs type 1080p).

## Product Purpose

Outil de CAO/DAO spécialisé qui permet d'**organiser visuellement une coupe** de
contenant, d'y placer des fourreaux/câbles, de **calculer automatiquement le taux
d'occupation** (exigence normative) et de **générer des livrables professionnels**
(plans PDF, export DXF/AutoCAD). Il remplace le fait de tout faire à la main dans un
CAD généraliste. Succès = une étude passe du dimensionnement au livrable exploitable
en aval, vite et sans erreur de norme.

## Positioning

**Placement intelligent + livrables.** La combinaison d'un moteur d'optimisation de
placement multi-objectif (minimiser l'emprise en respectant le taux d'occupation et la
stabilité) et d'une base métier intégrée (catalogues CEA, gamme de chambres StradEasy,
suggestion de chambres/tampons compatibles) puis d'un export DXF/PDF — dans un seul
outil dédié — est ce qu'un CAD généraliste ou un produit voisin ne pourrait pas copier
tel quel sans ces données métier et cette logique de placement.

## Operating Context

- **Flux type** : choisir la forme du contenant (boîte rectangulaire, conduit
  circulaire, chemin de câble, chambre de tirage) → régler/choisir les dimensions →
  ajouter des fourreaux/câbles depuis les catalogues → placer (manuel ou grille/auto) →
  vérifier le taux d'occupation → exporter (PDF/DXF) ou sauvegarder le projet.
- **Normes & métier** : lit de pose (marge 40 mm), entraxe (30 mm), taux d'occupation ;
  gamme de chambres de tirage **StradEasy** ; notion de **tampon** (couvercle),
  **pignon** (petit côté) vs **long-pan** (grand côté) ; chambre préformée sinon
  chambre maçonnée sur mesure + tampons.
- **Aval** : les plans DXF/PDF sont repris dans la chaîne CAO (AutoCAD/ZWCAD).

## Capabilities and Constraints

- **Contenants** : boîte rectangulaire, conduit circulaire, chemin de câble (U ouvert),
  chambre de tirage (rectangle fermé, dimensions depuis la gamme StradEasy).
- **Composants** : fourreaux (TPC / IRL / ICTA…) et câbles chargés depuis des CSV ;
  recherche textuelle ; quantités ; inventaire.
- **Calcul & placement** : taux d'occupation ; placement auto / grille ; réduction au
  minimum ; suggestion de **chambres de tirage compatibles** (préformé, sinon maçonné +
  tampons) avec visualisation sur le canvas et sur le PDF.
- **Livrables & persistance** : export DXF/PDF, sauvegarde/chargement de projets,
  undo/redo.
- **Données** : catalogues en **CSV** (`data/*.csv`), dossier de données
  **personnalisable** (dossier réseau partageable par l'équipe) et **fonctionnement
  hors-ligne**.
- **Terminologie métier** (à respecter) : fourreau, chemin de câble, chambre de tirage,
  tampon, pignon, long-pan, entraxe, lit de pose, taux d'occupation, TPC, StradEasy.
- **Pile technique** : Electron ; JavaScript vanilla ; rendu HTML5 Canvas + Konva.js ;
  build Vite (dev) / electron-builder (distribution) ; tests Jest.

## Brand Commitments

- **Nom** : TONTONKAD.
- **Éditeur / contexte** : Conception EA (CEA) ; outil interne diffusé via le
  **CEA App Store** (manifeste `cea-app.json`, releases GitHub) — canal de distribution
  et de mise à jour à préserver.
- **Voix** : français, professionnelle et métier (électricité / CAO).
- L'identité visuelle actuelle (orange CEA `#ff914d`, effet *glassmorphism*, thème
  clair/sombre, logo TONTONKAD) est le **système visuel incumbent** — évidence de
  design, **non déclarée comme contrainte verrouillée** par le porteur du produit. Une
  évolution visuelle future reste donc possible ; elle devra être décidée explicitement
  (new-work), pas supposée.

## Evidence on Hand

- Catalogues réels en CSV : `data/cables.csv`, `data/fourreaux.csv`,
  `data/chemins_de_cable.csv`, `data/chambres_de_tirage.csv` (gamme StradEasy extraite
  d'un tableau catalogue — **dimensions à revalider** par le métier, lecture d'image).
- L'application elle-même (rendu canvas, exports) et le manuel intégré (`manual.js`).
- Pas de témoignages, tarifs, benchmarks ou clients externes : ne rien fabriquer sur ces
  points (outil interne).

## Product Principles

1. **Le métier d'abord.** Respecter sans compromis la terminologie et les normes
   électriques (taux d'occupation, lit de pose, entraxe) : elles priment sur l'esthétique.
2. **Du dimensionnement au livrable.** Toute étude doit aboutir à un plan exportable
   (PDF/DXF) réellement exploitable dans la chaîne CAO aval.
3. **Données maîtrisées et partagées.** Catalogues CSV éditables, hors-ligne, mêmes
   références à jour pour toute l'équipe.
4. **Rapidité guidée, contrôle conservé.** Le placement intelligent et les suggestions
   (chambres/tampons compatibles) accélèrent le travail sans retirer la décision finale
   à l'utilisateur.
5. **Bureau ET chantier.** Rester lisible et utilisable au bureau comme en mobilité,
   sur des écrans de tailles et hauteurs variées.

## Accessibility & Inclusion

Thème clair/sombre pour le confort visuel selon l'environnement (bureau vs extérieur).
Contrainte de lisibilité sur écrans peu hauts (1080p et moins) déjà prise en compte.
Aucun standard d'accessibilité formel n'a été établi comme requis à ce stade.
