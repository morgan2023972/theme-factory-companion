# Rapport — ORCH-2.1 — Migration SQLite de l'orchestrateur

## 1. Résumé

Cette phase a créé la migration SQLite `version: 2` (`0002_createOrchestrationSchema.ts`) persistant exactement les six entités figées de `src/shared/orchestration/` (ORCH-1.1/1.2) : `WorkflowProfile` (+ `ValidationCommand` imbriqué), `WorkflowRun`, `WorkflowStep`, `WorkflowArtifact`, `WorkflowApproval`, `CommandExecution`, sous 7 tables SQL. La migration suit strictement les conventions déjà en place (`docs/CONVENTIONS.md`, `0001_createInitialMvpSchema.ts`) et applique en base, via des contraintes `CHECK` composites, les mêmes invariants statut ↔ dates/`exitCode` que les `superRefine` Zod déjà existants. Aucun repository, aucun IPC, aucune interface n'a été créé — strictement la migration, son enregistrement, ses tests et ce rapport.

**Écart par rapport au périmètre initialement prévu** : l'ajout de la migration 2 au registre de production (`migrations.ts`) a mécaniquement cassé 4 tests préexistants dans `src/main/database/database.test.ts` et `src/main/database/databaseHealth.test.ts`, qui codaient en dur l'hypothèse « une seule migration, version 1 » (nombre de lignes dans `schema_migrations`, `currentMigrationVersion`, et un test simulant une « migration future inconnue » avec la valeur `2`, désormais réellement occupée). Ces deux fichiers n'étaient pas dans la liste des « fichiers autorisés » du prompt initial, mais leur correction est une conséquence directe et nécessaire de cette phase, indispensable au respect de l'exigence « tous les tests existants doivent continuer à réussir » — voir section 2.

**Correction finale appliquée** : la roadmap ORCH-2.1 exige explicitement de démontrer la reprise après redémarrage (persistance et cohérence relationnelle des données d'orchestration à travers une fermeture puis une réouverture réelle du fichier SQLite). Cette exigence n'était pas encore couverte par un test dédié : elle l'est désormais par un nouveau test ajouté dans `src/main/database/database.test.ts` — voir section 5 bis pour le détail du scénario, et section 6 pour les résultats finaux des cinq validations demandées.

## 2. Fichiers créés et modifiés

**Créés :**

- `src/main/database/migrations/0002_createOrchestrationSchema.ts` — la migration.
- `src/main/database/migrations/0002_createOrchestrationSchema.test.ts` — 55 tests.
- `workflow/reports/RAPPORT_ORCH_2.1.md` — le présent rapport.

**Modifiés :**

- `src/main/database/migrations/migrations.ts` — ajout de l'import et de `createOrchestrationSchemaMigration` au tableau `migrations`, après `createInitialMvpSchemaMigration`. Aucun autre changement.
- `src/main/database/database.test.ts` (hors périmètre initial, correction nécessaire) :
  - `expect(migrationRows).toEqual([{ version: 1 }])` → `[{ version: 1 }, { version: 2 }]` (le test ouvre/referme une base réelle et lit `schema_migrations` en entier ; il y a désormais 2 migrations appliquées, pas 1).
  - `expect(migrationRows).toHaveLength(1)` → `toHaveLength(2)`, même raison.
  - Le test « ferme automatiquement la connexion si le health check échoue... » simulait une migration future inconnue de l'application en insérant manuellement `schema_migrations` avec `version: 2`. La version 2 étant désormais une migration réelle de production, cette insertion violait `UNIQUE constraint failed: schema_migrations.version` avant même d'atteindre l'assertion testée. La valeur simulée est passée à `version: 3` (prochaine version non utilisée), ce qui préserve exactement l'intention du test (une version supérieure à tout ce que l'application connaît) sans rien changer à sa structure.
  - **Correction finale** : ajout d'un nouveau test, « conserve les données d'orchestration et leurs relations à travers une fermeture puis une réouverture (reprise après redémarrage, ORCH-2.1) », dans le même bloc `describe` que le test de persistance MVP déjà existant — voir section 5 bis pour le détail complet du scénario.
- `src/main/database/databaseHealth.test.ts` (hors périmètre initial, correction nécessaire) :
  - `expect(report.currentMigrationVersion).toBe(1)` → `toBe(2)`.
  - `expect(report.appliedMigrationCount).toBe(1)` → `toBe(2)`.
  - Ce test exécute `runMigrations(db)` avec la liste de production réelle (par défaut de `checkDatabaseHealth`), donc `currentMigrationVersion`/`appliedMigrationCount` reflètent désormais 2 migrations appliquées, pas 1. Les autres tests de ce fichier utilisent des `knownMigrations` construits localement (fixtures isolées, non liées à la liste de production) et n'étaient pas affectés.

Aucun autre fichier n'a été créé ou modifié. En particulier : `0001_createInitialMvpSchema.ts` et son test, `migrationTypes.ts`, `runMigrations.ts` et son test, `database.ts`, `databaseHealth.ts`, tout repository, `src/shared/orchestration/**`, `src/preload`, `src/renderer`, tout canal IPC, `package.json`, tout document `docs/orchestration/*.md`.

## 3. Schéma des 7 tables

Reproduit tel qu'implémenté dans `0002_createOrchestrationSchema.ts` ; confirmé identique, colonne par colonne, contrainte par contrainte, à la DDL du prompt `workflow/prompts/ORCH_2.1_PROMPT.md`.

### `workflow_profiles`
`id TEXT PRIMARY KEY`, `name TEXT NOT NULL CHECK (trim(name) <> '')`, `version TEXT NOT NULL CHECK (trim(version) <> '')`, `created_at TEXT NOT NULL`, `updated_at TEXT NOT NULL`.

### `workflow_profile_validation_commands`
`id TEXT PRIMARY KEY`, `workflow_profile_id TEXT NOT NULL REFERENCES workflow_profiles(id) ON DELETE CASCADE`, `name TEXT NOT NULL CHECK (trim(name) <> '')`, `command TEXT NOT NULL CHECK (trim(command) <> '')`, `args TEXT NOT NULL`, `blocking INTEGER NOT NULL CHECK (blocking IN (0, 1))`, `position INTEGER NOT NULL CHECK (position >= 0)`, `created_at TEXT NOT NULL`, `updated_at TEXT NOT NULL`, `UNIQUE (workflow_profile_id, position)`. Index : `idx_workflow_profile_validation_commands_profile_id`.

### `workflow_runs`
`id TEXT PRIMARY KEY`, `project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE`, `phase_id TEXT NOT NULL REFERENCES phases(id)` (pas de `ON DELETE`), `profile_id TEXT NOT NULL REFERENCES workflow_profiles(id)` (pas de `ON DELETE`), `profile_fingerprint TEXT NOT NULL CHECK (trim(...) <> '')`, `status TEXT NOT NULL CHECK (IN 17 valeurs)`, `current_step_id TEXT` (sans `REFERENCES`), `started_at TEXT NOT NULL`, `completed_at TEXT`, `created_at`/`updated_at TEXT NOT NULL`, `CHECK` composite statut ↔ `completed_at`. Index : `project_id`, `phase_id`, `profile_id`, `status`, `current_step_id`.

### `workflow_steps`
`id TEXT PRIMARY KEY`, `workflow_run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE`, `type TEXT NOT NULL CHECK (IN 15 valeurs)`, `status TEXT NOT NULL CHECK (IN 6 valeurs)`, `position INTEGER NOT NULL CHECK (position >= 0)`, `started_at TEXT`, `completed_at TEXT`, `created_at`/`updated_at TEXT NOT NULL`, `UNIQUE (workflow_run_id, position)`, `CHECK` composite statut ↔ `started_at`/`completed_at`. Index : `workflow_run_id`, `status`.

### `workflow_artifacts`
`id TEXT PRIMARY KEY`, `workflow_run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE`, `workflow_step_id TEXT REFERENCES workflow_steps(id) ON DELETE SET NULL`, `type TEXT NOT NULL CHECK (IN 7 valeurs)`, `relative_path TEXT NOT NULL CHECK (trim(...) <> '')`, `created_at TEXT NOT NULL` (pas de `updated_at`). Index : `workflow_run_id`, `workflow_step_id`, `type`.

### `workflow_approvals`
`id TEXT PRIMARY KEY`, `workflow_run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE`, `workflow_step_id TEXT REFERENCES workflow_steps(id) ON DELETE SET NULL`, `type TEXT NOT NULL CHECK (IN 5 valeurs)`, `status TEXT NOT NULL CHECK (IN 3 valeurs)`, `requested_at TEXT NOT NULL`, `decided_at TEXT`, `created_at`/`updated_at TEXT NOT NULL`, `CHECK` composite statut ↔ `decided_at`. Index : `workflow_run_id`, `workflow_step_id`, `status`.

### `command_executions`
`id TEXT PRIMARY KEY`, `workflow_run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE`, `workflow_step_id TEXT REFERENCES workflow_steps(id) ON DELETE SET NULL`, `executable TEXT NOT NULL CHECK (trim(...) <> '')`, `args TEXT NOT NULL`, `cwd TEXT NOT NULL CHECK (trim(...) <> '')`, `status TEXT NOT NULL CHECK (IN 6 valeurs)`, `exit_code INTEGER`, `stdout`/`stderr TEXT NOT NULL`, `stdout_truncated`/`stderr_truncated INTEGER NOT NULL CHECK (IN (0,1))`, `started_at TEXT`, `completed_at TEXT`, `duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0)`, `created_at`/`updated_at TEXT NOT NULL`, `CHECK` composite statut ↔ `started_at`/`completed_at`/`duration_ms`/`exit_code`. Index : `workflow_run_id`, `workflow_step_id`, `status`.

Ordre de création respecté (chaque table ne référence que des tables déjà créées) : `workflow_profiles` → `workflow_profile_validation_commands` → `workflow_runs` → `workflow_steps` → `workflow_artifacts` → `workflow_approvals` → `command_executions`. Aucune référence circulaire ni en avant.

## 4. Décisions imposées — confirmation d'application

Les 6 décisions imposées par le prompt sont appliquées telles quelles, sans divergence :

1. **`workflow_runs.current_step_id` sans `REFERENCES`** — confirmé (colonne `TEXT` simple, indexée). Test dédié (section 5, catégorie 9) confirme qu'une valeur ne correspondant à aucun `workflow_step` est acceptée.
2. **`phase_id`/`profile_id` sans `ON DELETE`, `project_id` en `ON DELETE CASCADE`** — confirmé. Tests dédiés (section 5, catégorie « cascades ») confirment que la suppression d'une phase ou d'un profil référencé échoue, tandis que la suppression du projet cascade jusqu'aux `command_executions`.
3. **`CHECK` composites reproduisant chaque `superRefine`** — confirmé pour les 4 entités concernées (`workflow_runs`, `workflow_steps`, `workflow_approvals`, `command_executions`), avec au moins un cas positif et un cas négatif par statut représentatif testés.
4. **Pas de `DEFAULT` sur `blocking`, `position` (table de commandes de validation) et `stdout_truncated`/`stderr_truncated`** — confirmé, aucune de ces colonnes ne porte de clause `DEFAULT` dans la migration.
5. **`args` en `TEXT` JSON, `validationCommands` en table enfant dédiée** — confirmé.
6. **Aucune contrainte `UNIQUE` sur `workflow_artifacts.relative_path`** — confirmé.

## 5. Tests ajoutés

55 tests dans `0002_createOrchestrationSchema.test.ts`, répartis ainsi :

1. **Application de la migration** — 2 tests : version 2 enregistrée après `createInitialMvpSchemaMigration` ; les 7 tables existent en plus des 8 tables MVP.
2. **Idempotence** — 1 test.
3. **Colonnes** — 7 tests (un par table).
4. **Index** — 1 test (les 17 index attendus).
5. **Énumérations `CHECK`** — 7 tests (un par colonne d'énumération).
6. **Cohérence statut ↔ dates/`exitCode`** — 20 tests : `workflow_runs` (4), `workflow_steps` (5), `workflow_approvals` (4), `command_executions` (7, dont les deux cas `failed` avec `exit_code` `null`/renseigné, confirmant l'absence de contrainte sur ce champ pour ce statut).
7. **Champs texte obligatoires non vides** — 7 tests.
8. **Contraintes `UNIQUE`** — 2 tests (`workflow_steps`, `workflow_profile_validation_commands`).
9. **Cascades et restrictions** — 6 tests : cascade projet → run → enfants ; restriction phase référencée ; restriction profil référencé ; cascade profil non référencé → commandes de validation ; `SET NULL` sur suppression de step ; cascade run → enfants.
10. **`current_step_id` non contraint** — 1 test.
11. **Insertion minimale valide dans chaque table** — 1 test (mirroir du test équivalent de `0001_createInitialMvpSchema.test.ts`).

Total : 2 + 1 + 7 + 1 + 7 + 20 + 7 + 2 + 6 + 1 + 1 = 55.

## 5 bis. Correction finale — test de reprise après redémarrage

La roadmap ORCH-2.1 exige de démontrer que les données de l'orchestrateur survivent à une fermeture puis une réouverture réelle de la base (reprise après redémarrage de l'application). Un test dédié a été ajouté dans `src/main/database/database.test.ts`, au sein du bloc `describe('database — persistance et idempotence sur base fichier réelle (Phase 2.5)')` déjà existant (mêmes `beforeEach`/`afterEach` : répertoire temporaire créé avant chaque test, connexion fermée et répertoire supprimé après chaque test — y compris en cas d'échec, via `afterEach`) :

**Nom du test** : « conserve les données d'orchestration et leurs relations à travers une fermeture puis une réouverture (reprise après redémarrage, ORCH-2.1) ».

**Scénario exact couvert** :

1. ouverture d'un fichier SQLite réel via `openDatabase(dbPath)` (helper déjà existant du dépôt, qui active `PRAGMA foreign_keys` et exécute `runMigrations()` avec la liste de production réelle — aucune activation ni exécution de migration séparée n'a donc été nécessaire) ;
2. insertion d'un jeu minimal et relationnellement cohérent : un `project`, une `phase` rattachée, un `workflow_profile`, un `workflow_run` rattaché au projet/à la phase/au profil, un `workflow_step` rattaché au run, et un `workflow_artifact` rattaché au run et au step (entité enfant supplémentaire) ;
3. fermeture propre de la première connexion (`closeDatabase()`), avec vérification explicite que `isDatabaseOpen()` retourne `false` ;
4. réouverture du même fichier SQLite (`openDatabase(dbPath)`), qui réexécute `runMigrations()` de façon idempotente sur la liste de production ;
5. dans un bloc `try`/`finally` (la seconde connexion est fermée dans le `finally`, garantissant sa fermeture même si une assertion échoue) :
   - vérification que le `workflow_run`, le `workflow_step` et le `workflow_artifact` insérés sont toujours présents ;
   - vérification que leurs relations sont intactes (`workflow_run.project_id`/`phase_id`/`profile_id`, `workflow_step.workflow_run_id`, `workflow_artifact.workflow_run_id`/`workflow_step_id` correspondent exactement aux identifiants insérés) ;
   - vérification que `schema_migrations` contient exactement `[{ version: 1 }, { version: 2 }]`, chaque version une seule fois ;
   - vérification qu'aucune table (`projects`, `phases`, `workflow_profiles`, `workflow_runs`, `workflow_steps`, `workflow_artifacts`) ne contient plus d'une ligne (absence de duplication) ;
   - `checkDatabaseHealth(second).ok` vaut `true`.

Le fichier et le répertoire temporaires sont supprimés par l'`afterEach` déjà existant du bloc `describe`, qui s'exécute même si le test échoue.

`database.test.ts` compte désormais **17 tests** (16 précédents + ce nouveau test), tous passés — voir section 6.

## 6. Résultats de `npm run typecheck`

```text
> theme-factory-companion@1.0.0 typecheck
> tsc -p tsconfig.node.json --noEmit && tsc -p tsconfig.web.json --noEmit
```

Succès, aucune erreur. Résultat de la validation finale, exécutée après l'ajout du test de reprise après redémarrage (section 5 bis).

## 7. Résultats de `npx vitest run --maxWorkers=1`

Historique complet des passes (dans l'ordre chronologique de cette phase, corrections incluses) :

- Test ciblé initial de la migration seule (isolé) : 55 tests, 1 fichier, tous passés.
- **1ʳᵉ passe complète**, avant correction des tests cassés par l'enregistrement de la migration 2 : `Test Files 2 failed | 28 passed (30)`, `Tests 4 failed | 1075 passed (1079)` — 4 échecs déterministes dans `database.test.ts`/`databaseHealth.test.ts` (voir section 2), sans rapport avec un aléa d'infrastructure.
- **2ᵉ passe complète**, après correction de ces deux fichiers : `Test Files 30 passed (30)`, `Tests 1079 passed (1079)`, succès intégral.
- `database.test.ts` réexécuté isolément après l'ajout du test de reprise après redémarrage (section 5 bis) : **17 tests, 1 fichier, tous passés**.
- **Passe complète finale** (validation demandée par cette correction) : **`Test Files 30 passed (30)`, `Tests 1080 passed (1080)`** (1079 + 1 nouveau test), succès intégral dès la première tentative — aucun aléa d'infrastructure rencontré.

**Résultat final retenu pour la clôture de la phase : 30/30 fichiers, 1080/1080 tests.**

## 8. Résultats de `npm run build`

Résultat de la validation finale (exécutée après l'ajout du test de reprise après redémarrage) :

```text
✓ built in 14.04s  (out/main)
✓ built in 684ms   (out/preload)
✓ built in 12.60s  (out/renderer)
```

Succès, aucune erreur. Le build n'inclut pas les fichiers `*.test.ts` : il n'est affecté par aucune des corrections apportées aux tests au cours de cette phase.

## 9. Résultat de `git diff --check` et `git status --short --untracked-files=all`

Capturés en toute fin d'intervention, après la correction finale et la mise à jour du présent rapport — ce sont les résultats définitifs de la phase ORCH-2.1 :

`git diff --check` : aucun conflit de fin de ligne ni espace superflu signalé dans le contenu du diff ; seuls des avertissements informatifs `LF will be replaced by CRLF` (conversion `core.autocrlf` propre à cet environnement Windows) ont été émis (exit code 0).

```text
 M src/main/database/database.test.ts
 M src/main/database/databaseHealth.test.ts
 M src/main/database/migrations/migrations.ts
?? src/main/database/migrations/0002_createOrchestrationSchema.test.ts
?? src/main/database/migrations/0002_createOrchestrationSchema.ts
?? workflow/prompts/ORCH_2.1_PROMPT.md
?? workflow/reports/RAPPORT_ORCH_2.1.md
```

(`workflow/prompts/ORCH_2.1_CORRECTIONS_PROMPT.md` n'existe pas pour cette correction : elle a été demandée directement en conversation, sans fichier de prompt dédié conservé sous `workflow/prompts/`.)

## 10. Confirmation

- Aucun fichier sous `src/shared/orchestration`, `src/preload`, `src/renderer` n'a été modifié.
- Aucun canal IPC, aucun repository, aucune migration existante (`0001_createInitialMvpSchema.ts`), aucun moteur de migration (`migrationTypes.ts`, `runMigrations.ts`) n'a été modifié.
- `package.json` non modifié ; aucune dépendance installée.
- Les seuls fichiers touchés au-delà du périmètre initial (`database.test.ts`, `databaseHealth.test.ts`) l'ont été strictement pour corriger des assertions rendues fausses par l'enregistrement de la migration 2, puis pour ajouter le test de reprise après redémarrage explicitement demandé (`database.test.ts` uniquement) — voir section 2 et section 5 bis pour le détail exhaustif de chaque changement.
- Aucun repository n'a été créé pour le test de reprise après redémarrage ; il utilise exclusivement du SQL brut et les helpers déjà existants (`openDatabase`/`closeDatabase`/`isDatabaseOpen`, `checkDatabaseHealth`).
- Aucun schéma partagé ORCH-1.1 (`src/shared/orchestration/**`), aucune migration existante (`0001_createInitialMvpSchema.ts`), aucun moteur de migration (`migrationTypes.ts`, `runMigrations.ts`) n'a été modifié à l'occasion de cette correction finale.
- Aucun canal IPC, aucun fichier `src/preload`/`src/renderer` créé ou modifié.
- Aucun `git add`, `git commit` ou `git push` n'a été exécuté à aucun moment de cette intervention, y compris lors de cette correction finale.
