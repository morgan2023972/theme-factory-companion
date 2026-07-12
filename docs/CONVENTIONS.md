# Conventions initiales

Ce document fixe des conventions initiales pour guider les futures phases de développement. Il ne met en place aucune configuration automatique (linting, formatage) : ces conventions sont, à ce stade, des règles à appliquer manuellement.

## Noms de fichiers

- Documents Markdown de cadrage : `MAJUSCULES_SNAKE_CASE.md` (ex. `MVP_SCOPE.md`), à l'image des documents déjà présents dans `docs/`.
- Futurs fichiers de code source : `kebab-case` pour les fichiers utilitaires, `PascalCase` pour les composants React.

## Noms TypeScript futurs

- Types et interfaces : `PascalCase` (ex. `Project`, `TaskChecklistItem`).
- Variables et fonctions : `camelCase`.
- Constantes globales : `UPPER_SNAKE_CASE`.
- Fichiers de schémas Zod : suffixe `.schema.ts`.

## Noms SQL futurs

- Noms de tables : `snake_case`, au pluriel (ex. `projects`, `task_checklist_items`).
- Noms de colonnes : `snake_case`, au singulier (ex. `project_id`, `created_at`).
- Clés étrangères : suffixe `_id` (ex. `phase_id`).

## Identifiants

- Les identifiants d'entités utilisent le format **UUID**.

## Timestamps

- Les timestamps sont stockés au format **ISO 8601** (ex. `2026-07-12T14:30:00Z`).

## Commits Git

- Les commits doivent être **petits et ciblés**, correspondant à une seule intention (fonctionnalité, correction, ou refactoring — pas un mélange des trois sans justification, voir [CONTRIBUTING.md](../CONTRIBUTING.md)).
- Les **messages de commit** doivent être clairs, au présent, et décrire l'intention du changement plutôt que son détail technique (ex. `Ajoute le suivi des phases d'un projet` plutôt que `Modifie phases.ts`).

## Documentation des décisions

- Toute décision structurante doit être documentée dans [docs/decisions/](decisions/), en suivant le [modèle de décision](decisions/DECISION_TEMPLATE.md).

## Absence de changements hors périmètre

- Toute contribution doit rester strictement dans le périmètre défini par le plan ou la tâche en cours (voir [CONTRIBUTING.md](../CONTRIBUTING.md)).

## Statut de ces conventions

Ces conventions sont des règles de départ, destinées à évoluer. Tout changement significatif de convention devra être consigné dans le [registre des décisions](decisions/).
