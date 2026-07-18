# RAPPORT — Phase 4.1 : Schémas Zod et types partagés des tâches

## 1. Résumé de l'implémentation

**Objectif** : créer, dans la couche `shared`, les constantes, schémas Zod et types TypeScript inférés nécessaires pour représenter, créer et modifier une tâche — sans aucune logique SQLite, repository, handler IPC, API preload ou interface React.

**Démarche** : inspection préalable de `src/shared/schemas/project.ts`, `src/shared/schemas/phase.ts` et de leurs tests (conventions de nommage, gestion des champs nullable, schémas de création/mise à jour), de la migration `0001_createInitialMvpSchema.ts` (colonnes réelles de `tasks`, contraintes `NOT NULL`/`CHECK`/`DEFAULT`, relations `ON DELETE CASCADE`/`SET NULL`), et de `docs/DATA_MODEL_DRAFT.md` (documentation encore au stade de points ouverts pour les tâches, non normative sur les colonnes exactes — la migration reste la seule source de vérité utilisée).

**Résultat** : `src/shared/schemas/task.ts` reflète exactement les 17 colonnes de la table `tasks`, avec un schéma de lecture strict, un schéma de création et un schéma de mise à jour, suivant scrupuleusement les conventions déjà établies par `project.ts`/`phase.ts`. Aucun champ n'a été inventé au-delà de ce que porte la table SQLite réelle.

**Correction ciblée post-review** : `createTaskSchema` appliquait initialement `taskStatusSchema.default('backlog')`, une valeur par défaut déduite par analogie avec `projects.status`/`phases.status` alors qu'aucune base ni aucun contrat métier ne la définit explicitement pour `tasks.status` (colonne `NOT NULL` sans `DEFAULT` SQL). Cette valeur par défaut a été retirée : `status` est désormais **obligatoire** à la création, comme `priority`. Le rapport et les tests ont été mis à jour en conséquence (voir sections dédiées).

**Statut final** : terminé et validé automatiquement, corrections ciblées incluses. `npm run typecheck`, `npm run test` (427/427) et `npm run build` réussissent. Aucun commit ni push effectué.

## 2. Fichiers créés

- `src/shared/schemas/task.ts`
- `src/shared/schemas/task.test.ts`

## 3. Fichiers modifiés

Aucun. Aucun fichier d'export partagé (barrel/index) n'existe pour `src/shared/schemas/` — `project.ts` et `phase.ts` sont déjà importés directement par leurs consommateurs, sans point d'agrégation central. `task.ts` suit la même convention : aucun ajustement d'export n'était nécessaire.

## 4. Statuts retenus

```ts
export const TASK_STATUSES = [
  'backlog', 'ready', 'in_progress', 'to_validate', 'blocked', 'completed', 'cancelled'
] as const
```

Correspondance exacte avec la contrainte `CHECK (status IN ('backlog', 'ready', 'in_progress', 'to_validate', 'blocked', 'completed', 'cancelled'))` de la migration `0001` — vérifiée avant implémentation, identique à la liste fournie par la roadmap du prompt. Une seule source de vérité (`TASK_STATUSES`), dont `taskStatusSchema` (`z.enum`) et le type `TaskStatus` sont dérivés.

## 5. Priorités retenues

```ts
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const
```

Correspondance exacte avec la contrainte `CHECK (priority IN ('low', 'medium', 'high', 'critical'))` de la migration. Aucune valeur supplémentaire inventée. Même principe de source unique (`TASK_PRIORITIES` → `taskPrioritySchema` → `TaskPriority`).

## 6. Champs exacts du schéma complet (`taskSchema`)

Reflet strict des **17 colonnes** de `tasks` (migration `0001`, lignes 54-74), en `camelCase` :

| Colonne SQLite | Propriété TypeScript | Type Zod | Nullable |
|---|---|---|---|
| `id` | `id` | `z.uuid()` | non |
| `project_id` | `projectId` | `z.uuid()` | non (`NOT NULL`) |
| `phase_id` | `phaseId` | `z.uuid().nullable()` | **oui** (`REFERENCES phases(id) ON DELETE SET NULL`, sans `NOT NULL`) |
| `title` | `title` | texte non vide (trim) | non (`NOT NULL CHECK (trim(title) <> '')`) |
| `description` | `description` | `z.string().nullable()` | oui |
| `status` | `status` | `taskStatusSchema` | non |
| `priority` | `priority` | `taskPrioritySchema` | non |
| `claude_prompt` | `claudePrompt` | `z.string().nullable()` | oui |
| `affected_files` | `affectedFiles` | `z.string().nullable()` | oui |
| `acceptance_criteria` | `acceptanceCriteria` | `z.string().nullable()` | oui |
| `validation_commands` | `validationCommands` | `z.string().nullable()` | oui |
| `validation_results` | `validationResults` | `z.string().nullable()` | oui |
| `notes` | `notes` | `z.string().nullable()` | oui |
| `git_commit` | `gitCommit` | `z.string().nullable()` | oui |
| `position` | `position` | entier ≥ 0 | non (`NOT NULL DEFAULT 0 CHECK (position >= 0)`) |
| `created_at` | `createdAt` | `z.iso.datetime()` | non |
| `updated_at` | `updatedAt` | `z.iso.datetime()` | non |

Schéma `.strict()` : toute propriété non listée est rejetée, comme `projectSchema`/`phaseSchema`.

**Note sur les champs JSON** : `affected_files`, `acceptance_criteria`, `validation_commands` et `validation_results` sont stockés en `TEXT` (JSON sérialisé) côté SQLite, d'après le commentaire de la migration `0001`. Leur désérialisation en structure (tableau, objet) n'a **pas** été anticipée ici : ce sont de simples chaînes nullable, fidèles à la colonne réelle. Décider de leur forme structurée appartient au futur repository (Phase 4.2), conformément à l'interdiction du prompt d'anticiper une responsabilité de couche inférieure.

## 7. Nullabilité de `phaseId`

`phaseId` est **nullable** dans les trois schémas :

- **Lecture** (`taskSchema`) : `z.uuid().nullable()` — reflet direct de `phase_id TEXT REFERENCES phases(id) ON DELETE SET NULL` (pas de `NOT NULL`). Une tâche existante peut donc ne pas avoir de phase (`null`), notamment après la suppression de sa phase parente (`ON DELETE SET NULL`).
- **Création** (`createTaskSchema`) : `z.uuid().nullable().optional()` — une tâche peut être créée sans indiquer de phase (champ omis) ou explicitement sans phase (`null`).
- **Mise à jour** (`updateTaskSchema`) : `z.uuid().nullable()` rendu optionnel par `.partial()` — permet de détacher une tâche de sa phase en envoyant `phaseId: null`, ou de la rattacher à une autre phase du même projet en envoyant un nouvel UUID. `projectId` reste en revanche exclu de la mise à jour (même convention que `updatePhaseSchema` : aucun déplacement de tâche vers un autre projet).

## 8. Choix concernant les valeurs par défaut

- **`status`** : **aucune valeur par défaut** dans `createTaskSchema` — `status` est **obligatoire** à la création. La colonne SQL `tasks.status` est `NOT NULL` sans `DEFAULT`, et aucun contrat métier ne lui définit explicitement de valeur par défaut. *Correction ciblée* : la version initiale de cette phase appliquait `taskStatusSchema.default('backlog')`, déduit par analogie avec `projects.status` (`'planning'`) et `phases.status` (`'pending'`) — cette analogie a été jugée insuffisante et retirée, car ni la base ni le contrat de cette phase ne définissent explicitement une valeur par défaut pour `tasks.status`. `TASK_STATUSES` et `taskStatusSchema` restent inchangés : seule l'obligation de fournir `status` à la création a changé.
- **`priority`** : **aucune valeur par défaut**, inchangé. La colonne SQL `priority` ne porte pas de `DEFAULT`, et aucun champ analogue n'existe dans `projects`/`phases` pour établir une convention de valeur par défaut applicative pour une priorité. `priority` est donc **obligatoire** dans `createTaskSchema`, comme `status`.
- **`position`** : optionnelle dans `createTaskSchema` (`nonNegativePositionInteger.optional()`), cohérent avec le `DEFAULT 0` réellement présent sur la colonne SQL et avec la convention retenue pour `phases.position` — la valeur suivante sera calculée par le futur repository si elle est omise. Seul champ pour lequel une valeur par défaut applicative reste justifiée, car explicitement présente côté SQL.

## 9. Comportement du schéma de mise à jour vide

`updateTaskSchema` **refuse un objet vide**, ainsi qu'un objet ne contenant que des clés explicitement à `undefined` (via `.refine((data) => Object.values(data).some((value) => value !== undefined), ...)`), à l'identique de `updateProjectSchema` et `updatePhaseSchema`. Cette convention n'a pas été modifiée : le prompt demandait explicitement de ne pas la changer sans justification, et aucune n'a été identifiée.

## 10. Comportement envers les propriétés inconnues

Les trois schémas (`taskSchema`, `createTaskSchema`, `updateTaskSchema`) utilisent `.strict()` : toute propriété non déclarée est rejetée par Zod (`safeParse(...).success === false`), à l'identique des schémas `project`/`phase`. Testé explicitement pour `taskSchema` et `createTaskSchema` (« refuse un champ inconnu »).

## 11. Tests ajoutés

`src/shared/schemas/task.test.ts` — **75 tests** (73 initiaux + 2 nets ajoutés par les corrections ciblées de cette section) :

- `TASK_STATUSES`/`taskStatusSchema` : chaque statut autorisé (7, via `it.each`) + un statut inconnu rejeté (8 tests). Inchangé par les corrections.
- `TASK_PRIORITIES`/`taskPrioritySchema` : chaque priorité autorisée (4, via `it.each`) + une priorité inconnue rejetée (5 tests). Inchangé par les corrections.
- `taskSchema` : tâche complète valide, identifiants UUID (tâche/projet/phase, y compris phase `null`), titre vide/espaces, description nullable, statut/priorité invalides, les 7 champs texte nullable (`claudePrompt`, `affectedFiles`, `acceptanceCriteria`, `validationCommands`, `validationResults`, `notes`, `gitCommit`) à `null` et renseignés, position (valide, négative, décimale), timestamps invalides, champ obligatoire absent, champ inconnu (25 tests). Inchangé par les corrections (ce schéma de lecture n'a pas de valeur par défaut).
- `createTaskSchema` (**18 tests**, était 16) : création minimale — vérifie désormais que `status` **doit être fourni explicitement** (`'backlog'`) et n'est plus injecté par défaut ; `phaseId`/`position` restent omis. Nouveaux/adaptés : **refuse une création sans `status`** (nouveau test dédié, remplace l'ancienne assertion « `status` par défaut ») ; **refuse une création sans `priority`** (déjà présent, reformulé pour miroir exact avec `status`) ; **accepte une création avec `status: 'backlog'` fourni explicitement** (nouveau test). Le reste (création complète, `phaseId` explicite à `null`, normalisation des espaces, titre vide/espaces, statut/priorité invalides, identifiants projet/phase invalides, position décimale/négative, `description: null` accepté, champs système refusés, champ inconnu refusé) a été conservé à l'identique, chaque appel `safeParse` incluant désormais explicitement `status: 'backlog'` pour rester valide (ou continuer à isoler la seule cause de rejet testée).
- `updateTaskSchema` : mise à jour partielle (un champ, plusieurs champs), `description`/`phaseId` remis à `null`, rattachement à une autre phase, priorité/position seules modifiées, objet vide refusé, titre vide refusé, statut/priorité invalides, `phaseId` invalide, position négative, champs système refusés, `projectId` non modifiable, clé(s) `undefined` équivalent à un objet vide, mélange clé `undefined` + clé définie (19 tests). Inchangé par les corrections (la mise à jour n'a jamais eu de valeur par défaut sur `status`).

Aucune couverture métier existante n'a été supprimée : les corrections n'ont fait qu'ajouter deux tests nets et adapter les payloads des tests déjà présents pour continuer à isoler la cause de rejet réellement testée (chaque test de rejet fournit maintenant un `status` valide sauf lorsque `status` est précisément la valeur testée).

## 12. Résultats exacts du typecheck, des tests et du build

```bash
npm run typecheck
```
→ **Succès**, aucune erreur (`tsc -p tsconfig.node.json --noEmit && tsc -p tsconfig.web.json --noEmit`).

```bash
npm run test
```
→ **Succès** : `Test Files 22 passed (22)` / `Tests 427 passed (427)`.

```bash
npm run build
```
→ **Succès** : main 27.49 kB, preload 2.03 kB, renderer `index-B7L9SDfN.js` 729.18 kB / `index-DzsytAJr.css` 6.89 kB — hash et tailles **identiques** aux Phases 3.7/3.8 (le renderer n'importe pas encore `task.ts`, cohérent avec le périmètre strictement `shared` de cette phase).

## 13. Nombre final de fichiers et de tests Vitest réussis

**22 fichiers de tests, 427 tests réussis** (352 issus de la Phase 3.8 + 75 dans `task.test.ts`, après les corrections ciblées de cette section).

## 14. Écarts entre la roadmap et le schéma SQLite réel

- La roadmap du prompt (section 1) donne la liste des statuts sans préciser leur ordre d'apparition dans la contrainte SQL ; l'ordre retenu dans `TASK_STATUSES` respecte exactement l'ordre de la contrainte `CHECK` de la migration (`backlog, ready, in_progress, to_validate, blocked, completed, cancelled`), identique à celui fourni par la roadmap — aucun écart.
- Le prompt évoque des « champs détaillés prévus pour le pilotage du travail » sans les nommer : ils correspondent exactement aux colonnes réelles `claude_prompt`, `affected_files`, `acceptance_criteria`, `validation_commands`, `validation_results`, `notes`, `git_commit`. Aucun champ supplémentaire n'a été ajouté au-delà de ces colonnes réellement présentes dans la migration.
- `docs/DATA_MODEL_DRAFT.md` ne documente aucune structure précise pour `tasks` (le fichier liste les entités et renvoie les décisions de détail à un registre de décisions non encore rempli pour cette table) : la migration SQL a donc servi de seule source de vérité structurelle, conformément à la consigne de ne rien supposer hors du schéma SQLite validé.
- Aucune contrainte `UNIQUE (project_id, position)` n'existe sur `tasks` (contrairement à `phases`) : non reproduite dans le schéma Zod, qui ne valide que des propriétés isolées, pas des contraintes relationnelles inter-lignes.

## 15. Limites ou points à surveiller pour la Phase 4.2

- Le futur repository devra décider de la forme exacte (structure, format JSON) sous laquelle `affectedFiles`, `acceptanceCriteria`, `validationCommands` et `validationResults` sont exposés au-delà de la simple chaîne TEXT actuelle — ce choix n'a volontairement pas été anticipé ici.
- Le calcul de la position par défaut à la création (absente du payload) devra suivre la même logique que `phasesRepository.create` (position suivante par regroupement), à adapter selon que le regroupement pertinent soit le projet, la phase, ou les deux.
- Aucune contrainte d'unicité de position n'existe sur `tasks` : le futur repository devra décider si une politique de collision est nécessaire (contrairement aux phases, où `UNIQUE (project_id, position)` la impose déjà au niveau SQL).
- Le comportement de `ON DELETE SET NULL` sur `phase_id` signifie qu'une tâche peut se retrouver avec `phaseId: null` après suppression de sa phase, sans notification particulière : à garder en tête lors de la conception de l'interface de gestion des tâches.
- Aucun repository, handler IPC ni composant renderer n'existe encore pour les tâches : ce schéma partagé n'est utilisé par aucun code applicatif à ce stade (cohérent avec le périmètre strict de la Phase 4.1).

## 16. `git status --short`

État observé avant la présente correction ciblée (état de référence confirmé par le prompt de correction) :

```
?? src/shared/schemas/task.test.ts
?? src/shared/schemas/task.ts
?? workflow/prompts/PHASE_4.1_PROMPT.md
?? workflow/reports/RAPPORT_PHASE_4.1.md
```

`git diff --stat` : vide (aucun fichier suivi modifié). `git diff --check` : aucune erreur d'espacement.

## 17. Confirmation

**Aucun commit et aucun push n'ont été effectués.** La branche active n'a pas été modifiée.
