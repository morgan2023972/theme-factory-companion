# Roadmap

Ce document décrit les phases envisagées pour le développement de Theme Factory Companion. Chaque phase doit être traitée intégralement, dans l'ordre, en suivant le [cycle de développement](DEVELOPMENT_WORKFLOW.md).

## Phase 0 — Cadrage

**Objectif** : produire le cadre documentaire initial du projet, sans aucun code ni outillage technique.

**Livrables principaux** :
- README, CONTRIBUTING, .gitignore.
- Ensemble des documents du dossier `docs/`.
- Registres de décisions, d'erreurs IA et journal de projet, avec leurs modèles.

**Hors périmètre de la phase** :
- Toute initialisation technique (package.json, code, configuration).

**Condition de sortie** : l'ensemble des documents de cadrage est rédigé et revu manuellement.

## Phase 1 — Socle Electron

**Objectif** : initialiser le socle applicatif Electron, avec séparation `main` / `preload` / `renderer` / `shared`.

**Livrables principaux** :
- Structure de projet Electron minimale.
- Fenêtre applicative fonctionnelle affichant une interface React de base.

**Hors périmètre de la phase** :
- Persistance SQLite.
- Fonctionnalités métier.

**Condition de sortie** : l'application démarre, affiche une interface minimale, et la séparation des zones est en place.

## Phase 2 — SQLite

**Objectif** : intégrer la persistance locale via SQLite et `better-sqlite3` dans le processus principal.

**Livrables principaux** :
- Initialisation de la base SQLite.
- Mécanisme de migrations idempotentes.
- Premiers repositories.

**Hors périmètre de la phase** :
- Exposition de fonctionnalités métier complètes au renderer.

**Condition de sortie** : la base est créée et migrée de façon fiable et reproductible.

## Phase 3 — Projets et phases

**Objectif** : permettre la création et le suivi des projets et de leurs phases.

**Livrables principaux** :
- Modèle de données `projects` et `phases`.
- Interface de création et de consultation des projets et phases.

**Hors périmètre de la phase** :
- Gestion des tâches et checklists.

**Condition de sortie** : un utilisateur peut créer un projet, le découper en phases, et consulter cette structure.

## Phase 4 — Tâches

**Objectif** : permettre la gestion des tâches, checklists, prompts Claude Code et critères d'acceptation.

**Livrables principaux** :
- Modèle de données `tasks` et `task_checklist_items`.
- Interface de gestion des tâches associées à une phase.

**Hors périmètre de la phase** :
- Questions, problèmes et décisions.

**Condition de sortie** : un utilisateur peut créer, suivre et clôturer des tâches au sein d'une phase.

## Phase 5 — Questions, problèmes et décisions

**Objectif** : intégrer le suivi des questions ouvertes, des problèmes rencontrés et des décisions prises.

**Livrables principaux** :
- Modèle de données `questions`, `issues` et `decisions`.
- Interface de gestion associée.

**Hors périmètre de la phase** :
- Tableau de bord global.
- Journal d'activité.

**Condition de sortie** : les questions, problèmes et décisions d'un projet peuvent être créés, consultés et clôturés.

## Phase 6 — Tableau de bord et journal

**Objectif** : offrir une vue d'ensemble de l'activité et un historique chronologique des événements.

**Livrables principaux** :
- Tableau de bord agrégeant l'état des projets.
- Modèle de données `activity_log` et interface de consultation.

**Hors périmètre de la phase** :
- Export de données.

**Condition de sortie** : l'utilisateur dispose d'une vue d'ensemble fiable de l'état de ses projets et de leur historique.

## Phase 7 — Import, export et packaging

**Objectif** : permettre l'export des données au format JSON et Markdown, et préparer le packaging de l'application.

**Livrables principaux** :
- Export JSON et Markdown des projets.
- Packaging de l'application desktop.

**Hors périmètre de la phase** :
- Toute fonctionnalité listée comme exclue dans [docs/MVP_SCOPE.md](MVP_SCOPE.md).

**Condition de sortie** : les données d'un projet peuvent être exportées de façon fiable, et l'application peut être empaquetée pour une utilisation locale.
