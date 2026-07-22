# ORCH-2.2 — Repositories de l'orchestrateur

## Contexte

Tu travailles dans le dépôt **Theme Factory Companion**.

ORCH-0.1, ORCH-0.2, ORCH-1.1 (schémas partagés), ORCH-1.2 (machine à états) et ORCH-2.1 (migration SQLite `version: 2`, table `0002_createOrchestrationSchema.ts`) sont terminés et commités sur `main`.

État de départ confirmé :

* `src/shared/orchestration/` contient six entités Zod figées (`WorkflowProfile`/`ValidationCommand`, `WorkflowRun`, `WorkflowStep`, `WorkflowArtifact`, `WorkflowApproval`, `CommandExecution`) et une machine à états pure (`workflowStateMachine.ts` : `WORKFLOW_RUN_TRANSITIONS`, `isValidWorkflowRunTransition`, `getAllowedNextWorkflowRunStatuses`).
* `RAPPORT_ORCH_1.1.md` documente explicitement qu'**aucun schéma de création (`createXSchema`) n'existe encore** pour ces six entités, et que cette responsabilité est reportée à ORCH-2.2 (« ces variantes appartiennent aux futures phases de persistance et de logique métier, repositories ORCH-2.2 »).
* `RAPPORT_ORCH_2.1.md`, décision imposée n°1, documente explicitement que l'intégrité de `workflow_runs.current_step_id` (le step référencé appartient bien au même run) n'est **pas** garantie par une contrainte SQL (absence volontaire de `REFERENCES`, pour éviter une dépendance circulaire) et reste « une responsabilité du futur repository (ORCH-2.2) ».
* `src/main/database/repositories/projectsRepository.ts` et `phasesRepository.ts` (+ leurs tests) sont les répertoires de référence à suivre à l'identique pour les conventions : factory `createXRepository(database, options)`, requêtes préparées à la création du repository, type `XRow` interne en `snake_case`, fonction `mapRowToX` qui reconstruit puis **revalide** l'entité via son schéma Zod de lecture (`xSchema.parse(...)`), horloge injectable `options.now` (par défaut `() => new Date().toISOString()`), génération d'`id` via `randomUUID()`, `UPDATABLE_COLUMNS_BY_FIELD` en liste blanche fermée pour toute construction dynamique de `SET`, transactions (`database.transaction(...)`) pour toute opération composée, aucune traduction d'erreur SQLite (elles remontent telles quelles).

Cette intervention porte uniquement sur **ORCH-2.2 : les repositories SQLite des six entités de l'orchestrateur**. Aucun IPC, aucun preload, aucun composant React, aucune logique d'exécution de commande ou de Claude Code ne doit être créé.

## Objectif et périmètre

Implémenter, dans `src/main/database/repositories/`, un repository par entité (6 au total), exposant uniquement les opérations de persistance strictement nécessaires à la suite de la roadmap (ORCH-3.x à ORCH-8.x), sans anticiper de logique métier ou d'orchestration réelle (pas de lancement de commande, pas de gestion de fichiers, pas de canal IPC).

Cette phase :

* ajoute, dans `src/shared/orchestration/*.ts`, uniquement les schémas de **création** (et, pour deux entités, un schéma étroit de **transition**) explicitement listés ci-dessous — rien de plus. Les schémas de lecture, les enums, les `superRefine` existants et `workflowStateMachine.ts` restent strictement inchangés ;
* connecte enfin `isValidWorkflowRunTransition` (ORCH-1.2) à une écriture réelle : `workflowRunsRepository.updateStatus` doit l'appeler avant toute transition, et refuser (sans écrire) toute transition invalide ;
* referme explicitement la décision reportée par ORCH-2.1 (n°1) : `workflowRunsRepository.updateCurrentStepId` doit vérifier que le step ciblé appartient bien au run avant d'écrire, palliant l'absence de contrainte `REFERENCES` sur `current_step_id` ;
* ne modélise aucune limite de cycles de correction, aucun verrou de concurrence, aucun timeout : ce sont des responsabilités d'exécution futures (ORCH-4.x/5.x), hors périmètre ici.

## Étape préalable obligatoire

Avant toute modification :

1. lire intégralement `src/main/database/repositories/projectsRepository.ts`, `phasesRepository.ts` et leurs tests (`projectsRepository.test.ts`, `phasesRepository.test.ts`, `projectsPhasesCascade.integration.test.ts`) ;
2. relire `src/main/database/migrations/0002_createOrchestrationSchema.ts` (schéma SQL exact des 7 tables, contraintes `CHECK`, `ON DELETE`) et `RAPPORT_ORCH_2.1.md` ;
3. relire les six fichiers `src/shared/orchestration/*.ts` (hors `common.ts`, `index.ts`) et `workflowStateMachine.ts` ;
4. relire `docs/orchestration/ORCHESTRATOR_V1_SAFETY_RULES.md`, section 18 (approbations : décision explicite, non réutilisable) et section 7 (code de sortie, capture systématique).

## Fichiers autorisés

À créer :

```text
src/main/database/repositories/workflowProfilesRepository.ts
src/main/database/repositories/workflowProfilesRepository.test.ts
src/main/database/repositories/workflowRunsRepository.ts
src/main/database/repositories/workflowRunsRepository.test.ts
src/main/database/repositories/workflowStepsRepository.ts
src/main/database/repositories/workflowStepsRepository.test.ts
src/main/database/repositories/workflowArtifactsRepository.ts
src/main/database/repositories/workflowArtifactsRepository.test.ts
src/main/database/repositories/workflowApprovalsRepository.ts
src/main/database/repositories/workflowApprovalsRepository.test.ts
src/main/database/repositories/commandExecutionsRepository.ts
src/main/database/repositories/commandExecutionsRepository.test.ts
src/main/database/repositories/orchestrationRepositories.integration.test.ts
workflow/reports/RAPPORT_ORCH_2.2.md
```

À modifier, strictement pour ajouter les schémas listés en section « Ajouts aux schémas partagés » :

```text
src/shared/orchestration/workflowProfile.ts
src/shared/orchestration/workflowRun.ts
src/shared/orchestration/workflowStep.ts
src/shared/orchestration/workflowArtifact.ts
src/shared/orchestration/workflowApproval.ts
src/shared/orchestration/commandExecution.ts
src/shared/orchestration/index.ts
```

Aucun autre fichier ne doit être créé ou modifié, en particulier :

* `src/shared/orchestration/common.ts` et `workflowStateMachine.ts` (utilisé tel quel, jamais modifié) ;
* tout enum, schéma de lecture ou `superRefine` déjà existant dans les six fichiers ci-dessus (ajout strictement additif) ;
* `src/main/database/migrations/**` (0001, 0002, moteur de migration) ;
* `projectsRepository.ts`, `phasesRepository.ts` et leurs tests ;
* `src/preload`, `src/renderer`, tout canal IPC ;
* `package.json`.

## Ajouts aux schémas partagés

Ajouter, dans chacun des six fichiers, exactement les schémas suivants (aucun autre), exportés ensuite via `index.ts` :

| Fichier | Schéma à ajouter | Champs | Exclusions volontaires |
|---|---|---|---|
| `workflowProfile.ts` | `createWorkflowProfileSchema` | `name`, `version`, `validationCommands: z.array(validationCommandSchema)` | `id`, `createdAt`, `updatedAt` (générés par le repository) |
| `workflowRun.ts` | `createWorkflowRunSchema` | `projectId`, `phaseId`, `profileId`, `profileFingerprint` | `id`, `status` (toujours `'draft'` à la création), `currentStepId` (toujours `null`), `startedAt` (généré par le repository — la création d'un `WorkflowRun` correspond exactement à l'Étape 1 du workflow, il n'y a pas de distinction entre instant de création et instant de démarrage), `completedAt` (toujours `null`), `createdAt`, `updatedAt` |
| `workflowStep.ts` | `createWorkflowStepSchema` | `workflowRunId`, `type`, `position` | `id`, `status` (toujours `'pending'`), `startedAt`/`completedAt` (toujours `null`), `createdAt`, `updatedAt` |
| `workflowArtifact.ts` | `createWorkflowArtifactSchema` | `workflowRunId`, `workflowStepId` (nullable), `type`, `relativePath` | `id`, `createdAt` (généré par le repository) |
| `workflowApproval.ts` | `createWorkflowApprovalSchema` | `workflowRunId`, `workflowStepId` (nullable), `type` | `id`, `status` (toujours `'pending'`), `requestedAt` (généré par le repository, même raisonnement que `WorkflowRun.startedAt`), `decidedAt` (toujours `null`), `createdAt`, `updatedAt` |
| `workflowApproval.ts` | `decideWorkflowApprovalSchema` | `status: z.enum(['approved', 'rejected'])` | tout le reste — schéma de décision étroit, pas un `updateXSchema` générique |
| `commandExecution.ts` | `createCommandExecutionSchema` | `workflowRunId`, `workflowStepId` (nullable), `executable`, `args`, `cwd` | `id`, `status` (toujours `'pending'`), `exitCode`/`startedAt`/`completedAt`/`durationMs` (toujours `null`), `stdout`/`stderr` (toujours `''`), `stdoutTruncated`/`stderrTruncated` (toujours `false`), `createdAt`, `updatedAt` |
| `commandExecution.ts` | `completeCommandExecutionSchema` | `status: z.enum(['completed', 'failed', 'timed_out', 'cancelled'])`, `exitCode` (nullable), `durationMs`, `stdout`, `stderr`, `stdoutTruncated`, `stderrTruncated` | tout le reste — schéma de complétion étroit, appelé uniquement par `commandExecutionsRepository.complete` |

Chaque schéma est `.strict()`, réutilise les helpers déjà existants (`nonEmptyTrimmedText`, `nonNegativeInt`, `relativeArtifactPathSchema` importés depuis `./common`) et les enums déjà exportés. N'introduis aucune valeur par défaut Zod (`.default(...)`) sur ces nouveaux schémas : c'est le repository, pas le schéma, qui fixe les valeurs initiales (`status: 'draft'`, `stdout: ''`, etc.), conformément à la même logique que la suppression de `.default(true)` sur `ValidationCommand.blocking` en ORCH-1.1.

Exporter, en plus de chaque schéma, son type inféré (`CreateWorkflowProfileInput`, `CreateWorkflowRunInput`, `CreateWorkflowStepInput`, `CreateWorkflowArtifactInput`, `CreateWorkflowApprovalInput`, `DecideWorkflowApprovalInput`, `CreateCommandExecutionInput`, `CompleteCommandExecutionInput`) via `index.ts`.

## Travail demandé — les six repositories

Convention commune à respecter partout : `createXRepository(database: Database.Database, options: XRepositoryOptions = {}): XRepository`, avec `options.now?: () => string`. `args` (tableaux de chaînes) est sérialisé en JSON (`JSON.stringify`) à l'écriture et désérialisé (`JSON.parse`) à la lecture, conformément à la convention SQL posée en ORCH-2.1. Toute violation de contrainte SQLite (CHECK, UNIQUE, FK) remonte sans traduction. Toute violation de règle métier détectée avant l'écriture (transition invalide, décision déjà prise, step étranger au run) lève un `Error` explicite, sans écriture partielle.

### `workflowProfilesRepository`

* `create(input: CreateWorkflowProfileInput): WorkflowProfile` — transaction : insère le profil puis chaque `validationCommands[i]` avec `position = i` (l'ordre du tableau fourni définit l'ordre persisté ; aucun champ `position` n'existe côté `ValidationCommand` Zod, c'est un ordinal SQL uniquement).
* `getById(id): WorkflowProfile | null` — assemble le profil et ses commandes de validation (`ORDER BY position ASC`).
* `list(): WorkflowProfile[]` — `ORDER BY created_at DESC, id DESC`.

Aucune fonction `update`/`remove` : la gestion des profils (versionnement, modification) est explicitement hors périmètre ORCH-2.2, reportée à ORCH-3.1.

### `workflowRunsRepository`

* `create(input: CreateWorkflowRunInput): WorkflowRun` — `status: 'draft'`, `currentStepId: null`, `startedAt: now()`, `completedAt: null`.
* `getById(id): WorkflowRun | null`.
* `listByProjectId(projectId): WorkflowRun[]` — `ORDER BY started_at DESC, id DESC`.
* `updateStatus(id, status: WorkflowRunStatus): WorkflowRun` — lit le run existant (404 métier : lève une erreur si absent) ; appelle `isValidWorkflowRunTransition(existing.status, status)` (import depuis `../../../shared/orchestration`) ; lève une erreur explicite si la transition est refusée, **sans écriture** ; si `status` fait partie de `WORKFLOW_RUN_TERMINAL_STATUSES`, écrit `completed_at = now()` ; sinon laisse `completed_at` inchangé (déjà `null`, aucune transition ORCH-1.2 ne ramène un run vers un état non terminal après un état terminal).
* `updateCurrentStepId(id, currentStepId: string | null): WorkflowRun` — si `currentStepId` n'est pas `null`, vérifie d'abord (requête dédiée sur `workflow_steps`) qu'un step avec cet `id` existe **et** appartient à ce `workflow_run_id` ; lève une erreur explicite sinon, sans écriture. C'est la garantie d'intégrité que la migration ORCH-2.1 a explicitement reportée à ce repository (absence volontaire de `REFERENCES` sur `current_step_id`).

### `workflowStepsRepository`

* `create(input: CreateWorkflowStepInput): WorkflowStep` — `status: 'pending'`, `startedAt: null`, `completedAt: null`.
* `getById(id): WorkflowStep | null`.
* `listByWorkflowRunId(workflowRunId): WorkflowStep[]` — `ORDER BY position ASC, id ASC`.
* `start(id): WorkflowStep` — autorisé uniquement depuis `'pending'` ; sinon lève une erreur explicite. Écrit `status: 'in_progress'`, `started_at: now()`.
* `complete(id, status: 'completed' | 'failed' | 'cancelled' | 'skipped'): WorkflowStep` — autorisé depuis `'pending'` ou `'in_progress'` (un step `skipped` peut n'avoir jamais démarré, conformément à ORCH-1.1) ; refusé si déjà dans un statut terminal. Écrit le `status` fourni et `completed_at: now()`.

### `workflowArtifactsRepository`

* `create(input: CreateWorkflowArtifactInput): WorkflowArtifact` — `createdAt: now()`.
* `getById(id): WorkflowArtifact | null`.
* `listByWorkflowRunId(workflowRunId): WorkflowArtifact[]` — `ORDER BY created_at ASC, id ASC`.

Aucune fonction `update`/`remove` : un artefact est immuable après création (ORCH-1.1, ORCH-2.1 décision n°6, section 5 des règles de sécurité).

### `workflowApprovalsRepository`

* `create(input: CreateWorkflowApprovalInput): WorkflowApproval` — `status: 'pending'`, `requestedAt: now()`, `decidedAt: null`.
* `getById(id): WorkflowApproval | null`.
* `listByWorkflowRunId(workflowRunId): WorkflowApproval[]` — `ORDER BY requested_at ASC, id ASC`.
* `decide(id, input: DecideWorkflowApprovalInput): WorkflowApproval` — autorisé uniquement depuis `'pending'` ; lève une erreur explicite si l'approbation a déjà été décidée (section 18 des règles de sécurité : une approbation n'est jamais réutilisable). Écrit `status` et `decided_at: now()`.

### `commandExecutionsRepository`

* `create(input: CreateCommandExecutionInput): CommandExecution` — `status: 'pending'`, `exitCode: null`, `stdout: ''`, `stderr: ''`, `stdoutTruncated: false`, `stderrTruncated: false`, `startedAt: null`, `completedAt: null`, `durationMs: null`.
* `getById(id): CommandExecution | null`.
* `listByWorkflowRunId(workflowRunId): CommandExecution[]` — `ORDER BY created_at ASC, id ASC`.
* `markRunning(id): CommandExecution` — autorisé uniquement depuis `'pending'` ; sinon lève une erreur explicite. Écrit `status: 'running'`, `started_at: now()`.
* `complete(id, input: CompleteCommandExecutionInput): CommandExecution` — autorisé uniquement depuis `'running'` ; sinon lève une erreur explicite. Écrit `status`, `completed_at: now()`, `exit_code`, `duration_ms`, `stdout`, `stderr`, `stdout_truncated`, `stderr_truncated` fournis par `input`.

## Décisions imposées, à documenter dans le code

1. **Toutes les dates de cycle de vie métier (`startedAt`, `completedAt`, `requestedAt`, `decidedAt`) sont générées par le repository via `now()` au moment de l'appel, jamais fournies par l'appelant.** Chaque méthode de transition (`start`, `complete`, `markRunning`, `decide`, `updateStatus`) est appelée exactement au moment où l'évènement réel se produit (le futur exécuteur de commandes appelle `markRunning()` au moment où il lance réellement le processus) : `now()` au moment de l'appel est donc la donnée réelle, pas une approximation. Ceci écarte toute divergence possible entre une date fournie par l'appelant et une date de persistance.
2. **`workflowRunsRepository.updateStatus` doit obligatoirement appeler `isValidWorkflowRunTransition`** avant toute écriture : c'est le point d'intégration explicite entre ORCH-1.2 (validation pure) et ORCH-2.2 (persistance). Une transition refusée ne doit produire aucune écriture, même partielle.
3. **`workflowRunsRepository.updateCurrentStepId` doit vérifier l'appartenance du step au run avant d'écrire** : c'est la garantie reportée par la décision n°1 d'ORCH-2.1 (absence de `REFERENCES` sur `current_step_id` pour éviter une dépendance circulaire).
4. **Aucun repository ne modélise de limite de cycles de correction, de verrou de concurrence entre workflows, ni de timeout d'exécution.** Ce sont des responsabilités d'exécution futures (ORCH-4.x/5.x), pas de la couche de persistance.
5. **`workflowProfilesRepository` et `workflowArtifactsRepository` n'exposent aucune fonction `update`/`remove`** — un profil n'est pas modifiable dans cette phase (reporté à ORCH-3.1), un artefact ne l'est jamais (immuable par nature).
6. **Chaque transition métier explicite (`start`, `complete`, `markRunning`, `decide`, `updateStatus`) vérifie le statut courant de la ligne avant d'écrire**, et lève une erreur explicite en cas de transition non autorisée — jamais une écriture silencieusement acceptée puis rejetée seulement par la contrainte `CHECK` en base (qui reste un filet de sécurité en profondeur, pas le seul mécanisme de contrôle).

## Tests obligatoires

Pour chacun des six repositories, suivre la structure de `phasesRepository.test.ts` (base `:memory:`, `runMigrations(db)`, `db.pragma('foreign_keys = ON')`, régulateurs UUID/ISO datetime, isolation entre workflows/projets différents). Couverture minimale par repository :

* chaque fonction de lecture (`getById`, `listByXId`) : cas trouvé, cas absent (`null` ou tableau vide), isolation (n'affiche pas les lignes d'un autre run/projet) ;
* `create` : cas valide accepté et relu à l'identique ; violation de clé étrangère (parent inexistant) propagée telle quelle ; validation Zod du schéma de création rejetée si champ invalide/manquant ;
* pour `workflowProfilesRepository.create` : ordre des `validationCommands` fidèlement conservé (`position` croissante) ;
* pour chaque méthode de transition (`start`/`complete`/`markRunning`/`decide`/`updateStatus`) : au moins un cas valide accepté, et au moins un cas invalide explicitement refusé (erreur levée, aucune écriture constatée en relisant la ligne après l'appel refusé) ;
* pour `workflowRunsRepository.updateStatus` : au moins une transition valide et une transition invalide réellement vérifiées via la vraie fonction `isValidWorkflowRunTransition` (pas une réimplémentation locale du test) ; vérifier que `completedAt` est renseigné après passage à un statut terminal, et reste `null` après une transition non terminale ;
* pour `workflowRunsRepository.updateCurrentStepId` : step appartenant au run (accepté), step appartenant à un autre run (refusé), step inexistant (refusé), remise à `null` (acceptée) ;
* pour `commandExecutionsRepository.complete` : au moins un cas `status: 'completed'` avec `exitCode: 0`, et un cas `status: 'failed'` avec `exitCode` non nul, tous deux relus avec succès (confirmant que le résultat final passe la revalidation Zod, `superRefine` inclus).

Ajouter en complément `orchestrationRepositories.integration.test.ts` (mirroir de `projectsPhasesCascade.integration.test.ts`) : un scénario de bout en bout instanciant les six repositories (+ `projectsRepository`/`phasesRepository`) sur la même connexion, créant la chaîne complète `project → phase → workflow_profile → workflow_run → workflow_step → workflow_artifact/workflow_approval/command_execution`, et vérifiant que toutes les relations sont lisibles et cohérentes à travers les six repositories.

## Contraintes techniques

* TypeScript strict, aucun `any`, aucun cast destiné à contourner le typage ;
* aucune dépendance nouvelle installée ;
* aucune logique d'exécution de commande, de fichier, de Git ou de Claude Code dans les repositories ;
* respecter strictement les conventions déjà en place (`projectsRepository.ts`/`phasesRepository.ts`) ;
* ne pas modifier `workflowStateMachine.ts`, ni aucun `superRefine`/enum/schéma de lecture existant.

## Validation obligatoire

Après l'implémentation, exécuter dans cet ordre :

```bash
npm run typecheck
npx vitest run --maxWorkers=1
npm run build
```

Ne pas masquer une erreur. Utiliser `--maxWorkers=1` directement (aléa d'infrastructure connu, documenté dans `RAPPORT_CORRECTIONS_REVIEW_ORCH_1.1.md`, `RAPPORT_ORCH_1.2.md` et `RAPPORT_ORCH_2.1.md`). Si l'aléa se manifeste malgré tout, relancer une seconde fois et documenter les deux tentatives dans le rapport, sans tenter de le corriger. Si l'ajout de fichiers dans `src/main/database/repositories/` ou de schémas dans `src/shared/orchestration/` fait apparaître un échec dans un test préexistant sans rapport avec cette phase, analyser la cause exacte et documenter toute correction strictement nécessaire, comme cela a été fait en ORCH-2.1.

Tous les tests existants doivent continuer à réussir, en plus des nouveaux tests de cette phase.

## Vérification Git

```bash
git status --short --untracked-files=all
git diff --check
git diff --stat
```

**Ne pas committer. Ne pas pousser. Ne pas modifier la branche. Aucun `git add` ne doit être exécuté.**

## Rapport attendu

Créer `workflow/reports/RAPPORT_ORCH_2.2.md`, contenant :

1. un résumé de l'implémentation ;
2. les fichiers créés et modifiés (y compris le détail des schémas ajoutés à `src/shared/orchestration/*.ts`) ;
3. l'API exacte de chacun des six repositories (fonctions, comportement, erreurs levées) ;
4. les 6 décisions imposées, confirmées comme appliquées telles quelles ;
5. le détail de l'intégration `isValidWorkflowRunTransition` dans `updateStatus`, et de la vérification d'appartenance dans `updateCurrentStepId` ;
6. les tests ajoutés, avec le nombre de cas par repository et pour le test d'intégration ;
7. les résultats exacts de `npm run typecheck`, `npx vitest run --maxWorkers=1` (nombre de tentatives si plus d'une), `npm run build` ;
8. le nombre final de fichiers et de tests Vitest réussis (total dépôt) ;
9. le résultat de `git status --short --untracked-files=all` capturé après la rédaction du rapport lui-même (le rapport doit se lister lui-même) ;
10. la confirmation explicite qu'aucun `git add`, `git commit` ou `git push` n'a été exécuté.

## Critères d'acceptation

* les six repositories exposent exactement l'API décrite dans ce prompt, ni plus ni moins ;
* les schémas de création/décision/complétion ajoutés à `src/shared/orchestration/*.ts` sont strictement additifs, sans `.default()` ;
* `workflowRunsRepository.updateStatus` refuse toute transition non autorisée par `isValidWorkflowRunTransition`, sans écriture ;
* `workflowRunsRepository.updateCurrentStepId` refuse tout step n'appartenant pas au run ciblé ;
* aucune fonction `update`/`remove` n'existe pour `workflowProfilesRepository`/`workflowArtifactsRepository` ;
* chaque méthode de transition refuse un état de départ invalide, sans écriture partielle ;
* aucun fichier hors périmètre autorisé n'a été créé ou modifié ;
* `npm run typecheck` réussit ;
* `npx vitest run --maxWorkers=1` réussit intégralement ;
* `npm run build` réussit ;
* le rapport de phase est créé et complet ;
* aucun commit ni push n'a été effectué.
