# Theme Factory Companion

## Présentation

**Theme Factory Companion** est une application desktop locale destinée à piloter méthodiquement des projets de création de thèmes Shopify premium.

Elle sert d'outil de suivi et de méthode pour structurer, phase par phase, le travail de conception, de développement et de validation d'un thème Shopify OS 2.0, en gardant une trace claire des tâches, décisions, questions, problèmes et erreurs rencontrées au fil du projet.

## Statut actuel

**Cadrage documentaire uniquement.**

Aucun socle applicatif n'est encore initialisé : il n'existe à ce stade ni `package.json`, ni dépendances, ni code source, ni configuration d'outillage. Ce dépôt contient uniquement la documentation de cadrage nécessaire avant le démarrage du développement.

## Stack technique envisagée

La stack suivante est envisagée pour les phases de développement futures (voir [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)) :

- Electron
- React
- TypeScript
- Vite
- SQLite (via `better-sqlite3`)
- Zod
- Vitest

## Grands modules du MVP

Voir le détail complet dans [docs/MVP_SCOPE.md](docs/MVP_SCOPE.md).

- Tableau de bord
- Projets
- Phases
- Tâches et checklists
- Prompts Claude Code et critères d'acceptation
- Questions, problèmes et décisions
- Registre des erreurs IA
- Opportunités d'automatisation
- Journal d'activité
- Export JSON et Markdown

## Documentation

- [docs/PRODUCT.md](docs/PRODUCT.md) — Contexte, mission et utilisateur cible
- [docs/MVP_SCOPE.md](docs/MVP_SCOPE.md) — Périmètre fonctionnel du MVP
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Architecture technique envisagée
- [docs/DEVELOPMENT_WORKFLOW.md](docs/DEVELOPMENT_WORKFLOW.md) — Cycle de développement obligatoire
- [docs/ROADMAP.md](docs/ROADMAP.md) — Phases du projet
- [docs/DATA_MODEL_DRAFT.md](docs/DATA_MODEL_DRAFT.md) — Modèle de données envisagé
- [docs/CONVENTIONS.md](docs/CONVENTIONS.md) — Conventions initiales
- [docs/VALIDATION_STRATEGY.md](docs/VALIDATION_STRATEGY.md) — Stratégie de validation future
- [docs/AUTOMATION_OPPORTUNITIES.md](docs/AUTOMATION_OPPORTUNITIES.md) — Registre des automatisations potentielles
- [docs/decisions/README.md](docs/decisions/README.md) — Registre des décisions
- [docs/ai-errors/README.md](docs/ai-errors/README.md) — Registre des erreurs IA
- [docs/project-journal/README.md](docs/project-journal/README.md) — Journal du projet

## Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour le workflow de contribution obligatoire.
