# ORCH-2.1 — Migration SQLite de l'orchestrateur

## Contexte

Tu travailles dans le dépôt **Theme Factory Companion**.

ORCH-0.1, ORCH-0.2, ORCH-1.1 (schémas partagés) et ORCH-1.2 (machine à états) sont terminés et commités sur `main`. `src/shared/orchestration/` contient six entités Zod finalisées et figées : `WorkflowRun`, `WorkflowStep`, `WorkflowArtifact`, `WorkflowApproval`, `CommandExecution`, `WorkflowProfile`.

Le moteur de migration SQLite existe déjà et ne doit pas être modifié :

* `src/main/database/migrations/migrationTypes.ts` définit le type `Migration` (`{ version, name, up }`, sans `down` : les migrations sont uniquement montantes).
* `src/main/database/migrations/migrations.ts` exporte le tableau ordonné `migrations`, actuellement `[createInitialMvpSchemaMigration]` (une seule migration, `version: 1`).
* `src/main/database/migrations/runMigrations.ts` applique chaque migration non encore appliquée dans une transaction (`db.transaction`), enregistre son passage dans `schema_migrations`, s'arrête au premier échec sans exécuter les suivantes, et est idempotent.
* `src/main/database/migrations/0001_createInitialMvpSchema.ts` crée les 8 tables MVP (`projects`, `phases`, `tasks`, `task_checklist_items`, `questions`, `issues`, `decisions`, `activity_log`) via un unique `database.exec(...)` contenant du SQL brut, précédé d'un commentaire documentant les décisions de modélisation non triviales.

Cette intervention porte uniquement sur **ORCH-2.1 : la migration SQLite persistant les six entités de l'orchestrateur**. Aucun repository (ORCH-2.2), aucun IPC, aucune interface ne doit être créé.

## Objectif et périmètre

Créer une deuxième migration (`version: 2`) qui crée les tables SQLite nécessaires pour persister exactement les six entités déjà définies et figées dans `src/shared/orchestration/`, en respectant strictement :

* les conventions SQL déjà en place (`docs/CONVENTIONS.md` et `0001_createInitialMvpSchema.ts`) : tables `snake_case` au pluriel, colonnes `snake_case` au singulier, clés étrangères suffixées `_id`, identifiants UUID (`TEXT PRIMARY KEY`), timestamps ISO 8601 (`TEXT`), énumérations via `CHECK (col IN (...))`, texte obligatoire non vide via `CHECK (trim(col) <> '')`, booléens `INTEGER CHECK (col IN (0, 1))`, position via `INTEGER ... CHECK (position >= 0)` avec `UNIQUE` sur le couple parent/position ;
* les invariants déjà posés par les `superRefine` Zod des six entités (cohérence statut ↔ dates/`exitCode`) : ces invariants doivent être **également** appliqués en base via des contraintes `CHECK` composites, pas seulement documentés — voir section « Contraintes d'intégrité imposées ».

Cette migration ne contient et ne doit contenir :

* aucun repository, aucune fonction TypeScript de lecture/écriture au-delà de la fonction `up` de la migration elle-même ;
* aucun import depuis `src/shared/orchestration` : à l'image de `0001_createInitialMvpSchema.ts` (qui ne valide rien via Zod au moment de la migration), cette migration reste du SQL pur — la validation applicative appartient au futur repository (ORCH-2.2), hors périmètre ici ;
* aucune modification du moteur de migration (`migrationTypes.ts`, `runMigrations.ts`) ni de la migration existante `0001_createInitialMvpSchema.ts`.

## Étape préalable obligatoire

Avant toute modification :

1. lire intégralement `src/main/database/migrations/0001_createInitialMvpSchema.ts` et son fichier de test associé, `0001_createInitialMvpSchema.test.ts` (structure des tests : `PRAGMA table_info`, insertions valides/invalides, idempotence, cascades) ;
2. lire `src/main/database/migrations/runMigrations.ts` et `runMigrations.test.ts` pour comprendre le mécanisme d'application (transaction par migration, tracking `schema_migrations`) ;
3. lire `docs/CONVENTIONS.md` ;
4. relire les six fichiers `src/shared/orchestration/*.ts` (hors `common.ts` et `index.ts`) pour connaître exactement les champs, énumérations et invariants `superRefine` de chaque entité — cette migration doit refléter ces schémas Zod fidèlement, champ par champ, sans en ajouter ni en omettre.

Ne redéfinis aucune valeur d'énumération de ta propre initiative : les listes `CHECK (col IN (...))` ci-dessous reproduisent exactement les constantes déjà exportées (`WORKFLOW_RUN_STATUSES`, `WORKFLOW_STEP_TYPES`, `WORKFLOW_STEP_STATUSES`, `WORKFLOW_ARTIFACT_TYPES`, `WORKFLOW_APPROVAL_TYPES`, `WORKFLOW_APPROVAL_STATUSES`, `COMMAND_EXECUTION_STATUSES`).

## Fichiers autorisés

À créer :

```text
src/main/database/migrations/0002_createOrchestrationSchema.ts
src/main/database/migrations/0002_createOrchestrationSchema.test.ts
workflow/reports/RAPPORT_ORCH_2.1.md
```

À modifier, strictement pour ce qui suit :

* `src/main/database/migrations/migrations.ts` : ajouter l'import de la nouvelle migration et l'ajouter au tableau `migrations`, après `createInitialMvpSchemaMigration`. Ne rien retirer ni réordonner.

Aucun autre fichier ne doit être créé ou modifié, en particulier :

* `src/main/database/migrations/0001_createInitialMvpSchema.ts` et son test ;
* `src/main/database/migrations/migrationTypes.ts`, `runMigrations.ts` et son test ;
* `src/main/database/database.ts`, `databaseHealth.ts` ;
* tout repository existant (`projectsRepository.ts`, `phasesRepository.ts`) ;
* `src/shared/orchestration/**` (déjà figé depuis ORCH-1.2) ;
* tout fichier sous `src/preload`, `src/renderer` ;
* tout canal IPC ;
* `package.json` ;
* tout document `docs/orchestration/*.md`.

## Travail demandé

### 1. Nouvelle migration

Créer `0002_createOrchestrationSchema.ts`, `version: 2`, `name: 'create orchestration schema'`, suivant exactement la structure de `0001_createInitialMvpSchema.ts` : un objet `Migration` exporté, un unique `database.exec(...)` contenant tout le SQL, précédé d'un bloc de commentaire documentant les décisions de modélisation non triviales (voir section « Décisions imposées, à documenter dans le code »).

Les 7 tables ci-dessous doivent être créées **dans cet ordre** (chaque table ne référence que des tables déjà créées avant elle — aucune référence circulaire, aucune référence en avant) :

#### `workflow_profiles` (entité `WorkflowProfile`)

```sql
CREATE TABLE workflow_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (trim(name) <> ''),
  version TEXT NOT NULL CHECK (trim(version) <> ''),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

#### `workflow_profile_validation_commands` (entité `ValidationCommand`, imbriquée dans `WorkflowProfile.validationCommands`)

Modélisée comme une table enfant à l'image de `task_checklist_items` (précédent du dépôt pour un tableau d'objets structurés, par opposition à un tableau de primitives stocké en JSON) :

```sql
CREATE TABLE workflow_profile_validation_commands (
  id TEXT PRIMARY KEY,
  workflow_profile_id TEXT NOT NULL REFERENCES workflow_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (trim(name) <> ''),
  command TEXT NOT NULL CHECK (trim(command) <> ''),
  args TEXT NOT NULL,
  blocking INTEGER NOT NULL CHECK (blocking IN (0, 1)),
  position INTEGER NOT NULL CHECK (position >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (workflow_profile_id, position)
);

CREATE INDEX idx_workflow_profile_validation_commands_profile_id
  ON workflow_profile_validation_commands(workflow_profile_id);
```

`args` : tableau de chaînes (`string[]`), stocké en `TEXT` JSON — même convention que `tasks.affected_files`/`acceptance_criteria` dans `0001_createInitialMvpSchema.ts` (tableau de primitives, pas de table enfant dédiée). `blocking` et `position` n'ont **volontairement pas** de `DEFAULT` (voir décisions imposées).

#### `workflow_runs` (entité `WorkflowRun`)

```sql
CREATE TABLE workflow_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_id TEXT NOT NULL REFERENCES phases(id),
  profile_id TEXT NOT NULL REFERENCES workflow_profiles(id),
  profile_fingerprint TEXT NOT NULL CHECK (trim(profile_fingerprint) <> ''),
  status TEXT NOT NULL CHECK (status IN (
    'draft', 'prompt_ready', 'awaiting_approval', 'implementation_in_progress',
    'implementation_completed', 'report_available', 'review_required',
    'corrections_required', 'validations_in_progress', 'validation_failed',
    'manual_validation_required', 'ready_to_commit', 'committed', 'ready_to_push',
    'completed', 'cancelled', 'failed'
  )),
  current_step_id TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (status IN ('completed', 'cancelled', 'failed') AND completed_at IS NOT NULL)
    OR
    (status NOT IN ('completed', 'cancelled', 'failed') AND completed_at IS NULL)
  )
);

CREATE INDEX idx_workflow_runs_project_id ON workflow_runs(project_id);
CREATE INDEX idx_workflow_runs_phase_id ON workflow_runs(phase_id);
CREATE INDEX idx_workflow_runs_profile_id ON workflow_runs(profile_id);
CREATE INDEX idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX idx_workflow_runs_current_step_id ON workflow_runs(current_step_id);
```

`phase_id` et `profile_id` n'ont **volontairement pas** de clause `ON DELETE` (comportement par défaut SQLite : la suppression du parent échoue tant qu'une ligne référencée existe). `current_step_id` n'a **volontairement pas** de contrainte `REFERENCES` (voir décisions imposées).

#### `workflow_steps` (entité `WorkflowStep`)

```sql
CREATE TABLE workflow_steps (
  id TEXT PRIMARY KEY,
  workflow_run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'project_and_phase_selection', 'prompt_preparation', 'prompt_approval',
    'prompt_file_creation', 'claude_code_execution', 'report_retrieval',
    'report_analysis', 'corrections', 'automatic_validation', 'manual_validation',
    'commit_preparation', 'commit_approval', 'commit', 'push_approval', 'push'
  )),
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled', 'skipped')),
  position INTEGER NOT NULL CHECK (position >= 0),
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (workflow_run_id, position),
  CHECK (
    (status = 'pending' AND started_at IS NULL AND completed_at IS NULL)
    OR (status = 'in_progress' AND started_at IS NOT NULL AND completed_at IS NULL)
    OR (status IN ('completed', 'failed', 'cancelled', 'skipped') AND completed_at IS NOT NULL)
  )
);

CREATE INDEX idx_workflow_steps_workflow_run_id ON workflow_steps(workflow_run_id);
CREATE INDEX idx_workflow_steps_status ON workflow_steps(status);
```

#### `workflow_artifacts` (entité `WorkflowArtifact`)

```sql
CREATE TABLE workflow_artifacts (
  id TEXT PRIMARY KEY,
  workflow_run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  workflow_step_id TEXT REFERENCES workflow_steps(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN (
    'phase_prompt', 'phase_report', 'review_prompt', 'review_report',
    'correction_prompt', 'correction_report', 'validation_report'
  )),
  relative_path TEXT NOT NULL CHECK (trim(relative_path) <> ''),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_workflow_artifacts_workflow_run_id ON workflow_artifacts(workflow_run_id);
CREATE INDEX idx_workflow_artifacts_workflow_step_id ON workflow_artifacts(workflow_step_id);
CREATE INDEX idx_workflow_artifacts_type ON workflow_artifacts(type);
```

Pas de colonne `updated_at` : un artefact n'est jamais modifié après création (même principe que `activity_log` dans `0001_createInitialMvpSchema.ts`, et cohérent avec `WorkflowArtifact` côté Zod). Aucune contrainte `UNIQUE` sur `relative_path` : l'interdiction d'écrasement est une responsabilité du futur service de fichiers (ORCH-3.2), hors périmètre ici — ne pas l'anticiper au niveau SQL.

#### `workflow_approvals` (entité `WorkflowApproval`)

```sql
CREATE TABLE workflow_approvals (
  id TEXT PRIMARY KEY,
  workflow_run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  workflow_step_id TEXT REFERENCES workflow_steps(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('phase_prompt', 'correction_prompt', 'manual_validation', 'commit', 'push')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TEXT NOT NULL,
  decided_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (status = 'pending' AND decided_at IS NULL)
    OR (status IN ('approved', 'rejected') AND decided_at IS NOT NULL)
  )
);

CREATE INDEX idx_workflow_approvals_workflow_run_id ON workflow_approvals(workflow_run_id);
CREATE INDEX idx_workflow_approvals_workflow_step_id ON workflow_approvals(workflow_step_id);
CREATE INDEX idx_workflow_approvals_status ON workflow_approvals(status);
```

#### `command_executions` (entité `CommandExecution`)

```sql
CREATE TABLE command_executions (
  id TEXT PRIMARY KEY,
  workflow_run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  workflow_step_id TEXT REFERENCES workflow_steps(id) ON DELETE SET NULL,
  executable TEXT NOT NULL CHECK (trim(executable) <> ''),
  args TEXT NOT NULL,
  cwd TEXT NOT NULL CHECK (trim(cwd) <> ''),
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'timed_out', 'cancelled')),
  exit_code INTEGER,
  stdout TEXT NOT NULL,
  stderr TEXT NOT NULL,
  stdout_truncated INTEGER NOT NULL CHECK (stdout_truncated IN (0, 1)),
  stderr_truncated INTEGER NOT NULL CHECK (stderr_truncated IN (0, 1)),
  started_at TEXT,
  completed_at TEXT,
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (status = 'pending' AND started_at IS NULL AND completed_at IS NULL AND duration_ms IS NULL AND exit_code IS NULL)
    OR (status = 'running' AND started_at IS NOT NULL AND completed_at IS NULL AND duration_ms IS NULL AND exit_code IS NULL)
    OR (status = 'completed' AND started_at IS NOT NULL AND completed_at IS NOT NULL AND duration_ms IS NOT NULL AND exit_code = 0)
    OR (status IN ('failed', 'timed_out', 'cancelled') AND started_at IS NOT NULL AND completed_at IS NOT NULL AND duration_ms IS NOT NULL)
  )
);

CREATE INDEX idx_command_executions_workflow_run_id ON command_executions(workflow_run_id);
CREATE INDEX idx_command_executions_workflow_step_id ON command_executions(workflow_step_id);
CREATE INDEX idx_command_executions_status ON command_executions(status);
```

`args` : même convention JSON `TEXT` que pour `workflow_profile_validation_commands.args`. `exit_code` reste nullable et non contraint pour `failed`/`timed_out`/`cancelled` (aucune valeur imposée), conformément au schéma Zod.

### 2. Enregistrement dans le registre des migrations

Dans `src/main/database/migrations/migrations.ts`, importer `createOrchestrationSchemaMigration` depuis le nouveau fichier et l'ajouter au tableau `migrations`, à la suite de `createInitialMvpSchemaMigration` :

```ts
export const migrations: readonly Migration[] = [createInitialMvpSchemaMigration, createOrchestrationSchemaMigration]
```

## Décisions imposées, à documenter dans le code

Ces décisions ne sont pas laissées à ton appréciation ; elles doivent être appliquées telles quelles et expliquées dans le bloc de commentaire en tête de `0002_createOrchestrationSchema.ts`, à l'image du bloc de décisions de `0001_createInitialMvpSchema.ts` :

1. **`workflow_runs.current_step_id` n'a pas de contrainte `REFERENCES`.** Une contrainte stricte créerait une dépendance circulaire avec `workflow_steps.workflow_run_id` (chaque table référencerait une table pas encore créée par rapport à l'autre). Plutôt que de s'appuyer sur la tolérance de SQLite aux références en avant (comportement correct mais non évident), la colonne reste un simple `TEXT` nullable, indexé, dont l'intégrité (le step référencé appartient bien au même run) est une responsabilité du futur repository (ORCH-2.2), pas de la base.
2. **`workflow_runs.phase_id` et `workflow_runs.profile_id` n'ont pas de clause `ON DELETE`** (comportement par défaut : suppression du parent bloquée tant qu'une ligne y fait référence), contrairement à `project_id` qui est `ON DELETE CASCADE`. Justification : `ORCHESTRATOR_V1_SCOPE.md` section 5 exige un historique conservé des étapes, commandes et approbations ; supprimer une phase ou un profil ne doit jamais faire disparaître silencieusement l'historique d'un workflow qui s'y réfère. Supprimer le projet entier, en revanche, est déjà traité comme une suppression cascadée totale par la migration 0001 (`phases`/`tasks` sont déjà `ON DELETE CASCADE` depuis `projects`) : `workflow_runs.project_id` suit la même convention par cohérence.
3. **Contraintes `CHECK` composites reproduisant chaque `superRefine`** de `WorkflowRun`, `WorkflowStep`, `WorkflowApproval` et `CommandExecution` (voir DDL ci-dessus) : la cohérence statut ↔ dates/`exitCode` déjà validée côté Zod est **également** appliquée en base, en défense en profondeur — une insertion ou une future migration de données ne peut pas produire silencieusement une ligne dans un état incohérent, même en contournant la couche applicative.
4. **`workflow_profile_validation_commands.blocking`, `.position` et `command_executions.stdout_truncated`/`stderr_truncated` n'ont volontairement pas de `DEFAULT`**, contrairement à `is_completed`/`is_reusable` dans `0001_createInitialMvpSchema.ts` qui ont `DEFAULT 0`. Justification : ORCH-1.1 a explicitement retiré `.default(true)` de `ValidationCommand.blocking` côté Zod pour qu'une donnée corrompue ou incomplète soit rejetée plutôt que masquée silencieusement (voir `RAPPORT_CORRECTIONS_REVIEW_ORCH_1.1.md`) ; la même exigence s'applique à la colonne SQL correspondante — le futur repository (ORCH-2.2) doit toujours fournir explicitement ces valeurs.
5. **`args` (tableaux de chaînes) est stocké en `TEXT` JSON**, sans table enfant dédiée, par cohérence avec `tasks.affected_files`/`acceptance_criteria`/`validation_commands`/`validation_results` dans `0001_createInitialMvpSchema.ts`. **`WorkflowProfile.validationCommands` (tableau d'objets structurés) reçoit en revanche une table enfant dédiée**, par cohérence avec `task_checklist_items`, précédent du dépôt pour un tableau d'objets plutôt que de primitives.
6. **Aucune contrainte `UNIQUE` sur `workflow_artifacts.relative_path`** : l'interdiction d'écrasement d'un artefact (section 5 des règles de sécurité) est une responsabilité du futur service de fichiers (ORCH-3.2), pas de cette migration.

## Tests obligatoires

Créer `0002_createOrchestrationSchema.test.ts`, suivant la structure de `0001_createInitialMvpSchema.test.ts` (`new Database(':memory:')`, `db.pragma('foreign_keys = ON')` dans `beforeEach`, helpers `getTableNames()`/`getColumnNames(table)`/`getIndexNames()` via `PRAGMA table_info`/`PRAGMA index_list`, helpers d'insertion minimale par table). Couverture minimale :

1. **Application de la migration** : version 2 enregistrée dans `schema_migrations` après application ; les 7 nouvelles tables existent, en plus des 8 tables déjà créées par la migration 1 (les deux migrations doivent s'appliquer l'une après l'autre sans erreur, dans l'ordre).
2. **Idempotence** : ré-application du tableau `migrations` complet sans effet (aucune erreur, aucune ligne dupliquée).
3. **Colonnes** : pour chacune des 7 tables, vérifier la présence exacte des colonnes attendues (`PRAGMA table_info`), en particulier la nullabilité de `current_step_id`, `completed_at`, `started_at`, `workflow_step_id`, `exit_code`, `duration_ms`.
4. **Énumérations `CHECK`** : pour chaque colonne d'énumération (`workflow_runs.status`, `workflow_steps.type`, `workflow_steps.status`, `workflow_artifacts.type`, `workflow_approvals.type`, `workflow_approvals.status`, `command_executions.status`), une insertion avec une valeur hors liste lève une erreur SQLite (`CHECK constraint failed`).
5. **Cohérence statut ↔ dates/`exitCode`** : pour chacune des 4 tables portant un `CHECK` composite (`workflow_runs`, `workflow_steps`, `workflow_approvals`, `command_executions`), au moins un cas positif (ligne cohérente acceptée) et un cas négatif par statut représentatif (ligne incohérente rejetée) — a minima le même niveau de couverture que les tests `superRefine` Zod déjà existants pour ces quatre entités, sans nécessairement reproduire l'exhaustivité complète (289 combinaisons, etc.) déjà assurée côté schémas partagés.
6. **Champs texte obligatoires non vides** : `CHECK (trim(...) <> '')` rejette une chaîne vide ou uniquement composée d'espaces, pour chaque colonne concernée.
7. **`UNIQUE`** : `workflow_steps(workflow_run_id, position)` et `workflow_profile_validation_commands(workflow_profile_id, position)` rejettent un doublon.
8. **Cascades et restrictions Git-like** :
   - supprimer un `project` supprime en cascade ses `workflow_runs` (et transitivement `workflow_steps`, `workflow_artifacts`, `workflow_approvals`, `command_executions`) ;
   - supprimer une `phase` référencée par un `workflow_run` échoue (contrainte par défaut, pas de `CASCADE`) ;
   - supprimer un `workflow_profile` référencé par un `workflow_run` échoue ; supprimer un `workflow_profile` non référencé réussit et supprime en cascade ses `workflow_profile_validation_commands` ;
   - supprimer un `workflow_step` référencé par un `workflow_artifact`/`workflow_approval`/`command_execution` met leur `workflow_step_id` à `NULL` (`ON DELETE SET NULL`), sans erreur ;
   - supprimer un `workflow_run` supprime en cascade ses `workflow_steps`, `workflow_artifacts`, `workflow_approvals`, `command_executions`.
9. **`current_step_id` non contraint** : insérer un `workflow_run` avec un `current_step_id` ne correspondant à aucune ligne de `workflow_steps` doit réussir (confirme explicitement la décision imposée n°1 : absence de contrainte `REFERENCES` sur cette colonne).

## Contraintes techniques

* suivre exactement la structure de fichier de `0001_createInitialMvpSchema.ts` (un seul `database.exec(...)`, pas de `db.prepare`/logique JS dans `up`) ;
* aucune dépendance nouvelle installée ;
* aucun import depuis `src/shared/orchestration` dans le fichier de migration ;
* ne pas modifier le moteur de migration ni la migration 0001 ;
* respecter strictement les conventions déjà en place (`docs/CONVENTIONS.md`).

## Validation obligatoire

Après l'implémentation, exécuter dans cet ordre :

```bash
npm run typecheck
npx vitest run --maxWorkers=1
npm run build
```

Ne pas masquer une erreur. Utiliser `--maxWorkers=1` directement (un aléa d'infrastructure connu, documenté dans `RAPPORT_CORRECTIONS_REVIEW_ORCH_1.1.md` et `RAPPORT_ORCH_1.2.md`, provoque des timeouts sous exécution parallèle par défaut sur certains fichiers de test renderer sans rapport avec cette phase). Si l'aléa se manifeste malgré tout, relancer une seconde fois et documenter les deux tentatives dans le rapport, sans tenter de le corriger.

Tous les tests existants doivent continuer à réussir, en plus des nouveaux tests de cette migration.

## Vérification Git

```bash
git status --short --untracked-files=all
git diff --check
git diff --stat
```

**Ne pas committer. Ne pas pousser. Ne pas modifier la branche. Aucun `git add` ne doit être exécuté.**

## Rapport attendu

Créer `workflow/reports/RAPPORT_ORCH_2.1.md`, contenant :

1. un résumé de l'implémentation ;
2. les fichiers créés et modifiés ;
3. le schéma exact des 7 tables (colonnes, types, contraintes) tel qu'implémenté, avec confirmation qu'il correspond exactement à celui de ce prompt ;
4. les 6 décisions imposées, reproduites et confirmées comme appliquées telles quelles (ou toute divergence justifiée, le cas échéant) ;
5. les tests ajoutés, avec le nombre de cas par catégorie (section « Tests obligatoires ») ;
6. les résultats exacts de `npm run typecheck`, `npx vitest run --maxWorkers=1` (en précisant le nombre de tentatives si plus d'une a été nécessaire), `npm run build` ;
7. le nombre final de fichiers et de tests Vitest réussis (total dépôt) ;
8. le résultat de `git status --short --untracked-files=all` capturé après la rédaction du rapport lui-même (le rapport doit se lister lui-même) ;
9. la confirmation explicite qu'aucun `git add`, `git commit` ou `git push` n'a été exécuté.

## Critères d'acceptation

* les 7 tables sont créées, avec exactement les colonnes, types, `CHECK`, `UNIQUE`, index et clés étrangères spécifiés dans ce prompt ;
* les 6 décisions imposées sont appliquées telles quelles et documentées dans le commentaire de tête du fichier de migration ;
* les 4 `CHECK` composites reproduisent fidèlement les invariants `superRefine` déjà présents côté Zod ;
* la migration s'applique proprement à la suite de la migration 0001, de façon idempotente ;
* `migrations.ts` référence la nouvelle migration, sans autre changement ;
* aucun fichier hors périmètre autorisé n'a été créé ou modifié ;
* `npm run typecheck` réussit ;
* `npx vitest run --maxWorkers=1` réussit intégralement ;
* `npm run build` réussit ;
* le rapport de phase est créé et complet ;
* aucun commit ni push n'a été effectué.
