# Rapport de corrections — ORCH-2.2.R — Repositories de l'orchestrateur

## 1. Constats corrigés

Les trois constats les plus significatifs de `REVIEW_ORCH_2.2.md` ont été corrigés, ainsi qu'un complément de couverture de test :

- **M1 (majeur)** — Aucun test ORCH-2.2 ne vérifiait la reprise après redémarrage via les repositories eux-mêmes : corrigé par l'ajout d'un test d'intégration dédié (section 3).
- **Mo1 (moyen)** — Appels multiples à `now()` au sein d'une seule mutation : corrigé dans les 6 fonctions concernées (section 2).
- **Mo2 (moyen)** — Aucun test ne vérifiait explicitement le comportement de `updatedAt` : corrigé par l'ajout de 15 tests déterministes (section 4).
- **Complément non numéroté** — Le test de cascade de suppression depuis `projects` ne couvrait pas `workflow_approvals`/`command_executions` : complété (section 5).

Les constats Mi1 (statut du step courant non vérifié), Mi2 (finders de reprise), Mi3 (filtrage des secrets) et Mi4 (`JSON.parse` non protégé) n'ont **pas** été corrigés dans le code, conformément aux instructions : ils sont documentés comme décisions explicitement reportées (section 6).

## 2. Fichiers modifiés

### 2.1 Timestamp unique par mutation (Mo1)

- `src/main/database/repositories/workflowRunsRepository.ts` — `updateStatus` : `const timestamp = now()` capturé une seule fois, réutilisé pour `completed_at` (si terminal) et `updated_at`.
- `src/main/database/repositories/workflowStepsRepository.ts` — `start` : `const timestamp = now()` réutilisé pour `started_at`/`updated_at`. `complete` : réutilisé pour `completed_at`/`updated_at`.
- `src/main/database/repositories/workflowApprovalsRepository.ts` — `decide` : `const timestamp = now()` réutilisé pour `decided_at`/`updated_at`.
- `src/main/database/repositories/commandExecutionsRepository.ts` — `markRunning` : réutilisé pour `started_at`/`updated_at`. `complete` : réutilisé pour `completed_at`/`updated_at`.

Aucune autre ligne de logique métier modifiée dans ces quatre fichiers (transitions autorisées, messages d'erreur, ordre des vérifications : inchangés).

### 2.2 Tests ajoutés ou complétés

- `src/main/database/repositories/workflowRunsRepository.test.ts` — 5 tests `updatedAt`.
- `src/main/database/repositories/workflowStepsRepository.test.ts` — 4 tests `updatedAt`.
- `src/main/database/repositories/workflowApprovalsRepository.test.ts` — 2 tests `updatedAt`.
- `src/main/database/repositories/commandExecutionsRepository.test.ts` — 4 tests `updatedAt`.
- `src/main/database/repositories/orchestrationRepositories.integration.test.ts` — 1 nouveau test de reprise après redémarrage (M1) ; test de cascade existant complété (2 assertions supplémentaires, aucun nouveau test).

`workflowProfilesRepository.ts`/`.test.ts` et `workflowArtifactsRepository.ts`/`.test.ts` n'ont subi aucune modification : ces deux repositories n'exposent aucune méthode de transition (`create`/lecture uniquement), donc aucun des constats Mo1/Mo2 ne les concernait.

Aucun repository supplémentaire, aucune migration, aucun IPC/preload/renderer, aucune dépendance, aucun changement de `workflowStateMachine.ts` n'a été introduit.

## 3. Scénario exact du test de reprise après redémarrage (M1)

Ajouté dans `orchestrationRepositories.integration.test.ts`, nouveau bloc `describe('reprise après redémarrage via les repositories (ORCH-2.2.R, M1)')` :

1. création d'un répertoire temporaire réel (`mkdtempSync`) et d'un chemin de fichier SQLite dans ce répertoire ;
2. ouverture via le helper de production `openDatabase(dbPath)` (importé depuis `../database`) — active `PRAGMA foreign_keys`, exécute `runMigrations()` avec la liste de production, exécute le health check ;
3. instanciation des huit repositories (`projects`, `phases`, `workflowProfiles`, `workflowRuns`, `workflowSteps`, `workflowArtifacts`, `workflowApprovals`, `commandExecutions`) sur cette première connexion ;
4. création, exclusivement via les repositories, d'un projet, d'une phase, d'un profil, d'un run, de **deux** steps, d'un artefact, d'une approbation et d'une exécution de commande ;
5. au moins une mutation avant fermeture : `stepsRepository.start(firstStep.id)`, `commandExecutionsRepository.markRunning(execution.id)`, `runsRepository.updateCurrentStepId(run.id, firstStep.id)` ;
6. fermeture propre (`closeDatabase()`), avec vérification explicite `isDatabaseOpen() === false` ;
7. réouverture du **même** fichier via `openDatabase(dbPath)`, dans un bloc `try` dont le `finally` appelle `closeDatabase()` ;
8. réinstanciation de tous les repositories nécessaires sur la nouvelle connexion (aucune réutilisation de l'instance précédente) ;
9. vérification que `schema_migrations` contient exactement `[{ version: 1 }, { version: 2 }]` (aucune duplication) ;
10. relecture des données antérieures **exclusivement via les repositories** (`getById`, jamais de SQL brut pour les assertions métier) : run (`currentStepId`, `projectId`, `phaseId`, `profileId`, `status`), premier step (`status: 'in_progress'`), artefact, approbation (`status: 'pending'`), exécution (`status: 'running'`) ;
11. poursuite du workflow après réouverture : `stepsRepository.complete(firstStep.id, 'completed')`, `approvalsRepository.decide(approval.id, { status: 'approved' })`, `commandExecutionsRepository.complete(execution.id, { status: 'completed', ... })`, `runsRepository.updateCurrentStepId(run.id, secondStep.id)`, `runsRepository.updateStatus(run.id, 'prompt_ready')` ;
12. vérification finale que les nouvelles mutations sont persistées et que les relations entre entités restent cohérentes (`finalRun.currentStepId === secondStep.id`, les deux steps listés avec leurs statuts respectifs `completed`/`pending`) ;
13. nettoyage : `afterEach` du bloc ferme la connexion et supprime le répertoire temporaire (`rmSync`, `recursive: true, force: true`), y compris en cas d'échec du test.

## 4. Assertions ajoutées sur `updatedAt` (Mo2)

Pour chacun des quatre repositories portant des méthodes de transition, deux catégories de tests ont été ajoutées avec une horloge injectée à valeurs ISO fixes (jamais l'horloge réelle) :

- **`workflowRunsRepository`** (5 tests) : `updateStatus` accepté modifie `updatedAt` ; `updateStatus` refusé conserve `updatedAt` ; passage à un statut terminal (`draft → prompt_ready → awaiting_approval → cancelled`) où `completedAt` et `updatedAt` sont **strictement identiques** (`expect(cancelled.completedAt).toBe(cancelled.updatedAt)`), prouvant qu'un seul appel à `now()` a eu lieu ; `updateCurrentStepId` accepté modifie `updatedAt` ; `updateCurrentStepId` refusé conserve `updatedAt`.
- **`workflowStepsRepository`** (4 tests) : `start` accepté modifie `updatedAt` avec `startedAt === updatedAt` ; `start` refusé conserve `updatedAt` ; `complete` accepté modifie `updatedAt` avec `completedAt === updatedAt` ; `complete` refusé conserve `updatedAt`.
- **`workflowApprovalsRepository`** (2 tests) : `decide` accepté modifie `updatedAt` avec `decidedAt === updatedAt` ; seconde décision refusée conserve `updatedAt`.
- **`commandExecutionsRepository`** (4 tests) : `markRunning` accepté modifie `updatedAt` avec `startedAt === updatedAt` ; `markRunning` refusé conserve `updatedAt` ; `complete` accepté modifie `updatedAt` avec `completedAt === updatedAt` ; `complete` refusé (encore `pending`) conserve `updatedAt`.

Chaque test utilise un tableau de timestamps ISO fixes consommés séquentiellement (`now: () => timestamps[callIndex++]`), à l'image de la convention déjà établie dans `projectsRepository.test.ts`. Cette approche a directement validé la correction de la section 2 : avant correction, ces mêmes tests auraient échoué (deux appels à `now()` auraient consommé deux valeurs du tableau au lieu d'une, désynchronisant les indices et produisant des valeurs différentes pour la date métier et `updatedAt`).

## 5. Complément du test de cascade

Dans `orchestrationRepositories.integration.test.ts`, le test « supprime en cascade toute la chaîne d'orchestration lors de la suppression du projet » a été complété : ajout de la création d'une `workflow_approval` et d'une `command_execution` rattachées au step, puis ajout de `expect(approvalsRepository.listByWorkflowRunId(run.id)).toEqual([])` et `expect(commandExecutionsRepository.listByWorkflowRunId(run.id)).toEqual([])` après la suppression du projet. Aucune autre couverture dupliquée n'a été ajoutée (le comportement `SET NULL` sur suppression d'un step reste couvert uniquement au niveau de la migration, comme documenté dans `REVIEW_ORCH_2.2.md`, Mi5).

## 6. Décisions explicitement reportées (non corrigées dans le code)

Conformément aux instructions, les constats suivants ne sont **pas** corrigés à ce stade et sont documentés ici comme des reports volontaires :

- **Statut du step courant (Mi1)** : `workflowRunsRepository.updateCurrentStepId` n'est **pas** restreint aux steps `pending`/`in_progress`. ORCH-2.2 garantit uniquement que le step désigné appartient bien au run ciblé (décision n°1 d'ORCH-2.1). La validité métier du statut du step courant (interdire ou non de désigner un step déjà terminal/annulé) est explicitement laissée à une future couche de service/orchestration, qui disposera du contexte nécessaire pour trancher cette question en connaissance de cause.
- **Finders de reprise (Mi2)** : aucune méthode dédiée n'a été ajoutée pour retrouver « le run actif d'un projet », « les approbations en attente d'un run » ou « les commandes non terminées d'un run ». Ces requêtes de haut niveau sont reportées à une future couche d'orchestration (ORCH-4.x/5.x), qui les construira à partir des `listByXId` génériques déjà exposés par les six repositories.
- **Filtrage des secrets stdout/stderr (Mi3)** : `commandExecutionsRepository.complete` continue de persister `stdout`/`stderr` tels que fournis par l'appelant, sans filtrage. Cette responsabilité (section 13 des règles de sécurité) devra être assurée par le futur exécuteur de commandes (ORCH-4.1) **avant** l'appel à `commandExecutionsRepository.complete`, jamais après : le repository n'a et n'aura aucune connaissance du contenu au-delà de ce qui lui est transmis.
- **Diagnostic `JSON.parse` (Mi4)** : le parsing JSON des colonnes `args` (`workflowProfilesRepository.ts`, `commandExecutionsRepository.ts`) n'a pas été modifié. Le comportement actuel reste fail-closed (une colonne corrompue lève une exception plutôt que de masquer la donnée) ; seule la clarté du message d'erreur est perfectible. Cette amélioration est reportée à une future phase de durcissement (cohérente avec ORCH-8.2 de la roadmap).

Conformément aux instructions, aucun document de spécification (`ORCHESTRATOR_V1_*.md`, `ORCH_2.2_PROMPT.md`) n'a été modifié pour enregistrer ces reports : ils sont consignés uniquement dans le présent rapport de corrections.

## 7. Nouveau nombre de tests

- Sous-ensemble `src/main/database/repositories` (exécuté isolément) : **151 tests, 10 fichiers, tous passés** (135 avant correction + 16 nouveaux : 15 tests `updatedAt` + 1 test de reprise après redémarrage).
- Suite complète du dépôt : **1150 tests, 37 fichiers** (1134 avant correction + 16 nouveaux), correspondance exacte.

## 8. Résultats finaux des validations

**`npm run typecheck`** :

```text
> theme-factory-companion@1.0.0 typecheck
> tsc -p tsconfig.node.json --noEmit && tsc -p tsconfig.web.json --noEmit
```

Succès, aucune erreur.

**`npx vitest run src/main/database/repositories --maxWorkers=1`** :

```text
Test Files  10 passed (10)
     Tests  151 passed (151)
```

Succès intégral.

**`npx vitest run --maxWorkers=1`** (suite complète) :

```text
Test Files  37 passed (37)
     Tests  1150 passed (1150)
```

Succès intégral **dès la première tentative** — aucun aléa d'infrastructure (timeout de worker) rencontré cette fois, une seconde tentative n'a donc pas été nécessaire.

**`npm run build`** :

```text
✓ built in 3.94s   (out/main)
✓ built in 2.15s   (out/preload)
✓ built in 13.19s  (out/renderer)
```

Succès, aucune erreur.

**`git diff --check`** : exit code 0. Seuls des avertissements informatifs `LF will be replaced by CRLF` (conversion `core.autocrlf` propre à cet environnement Windows), sans rapport avec le contenu.

## 9. Résultat de `git status --short --untracked-files=all`

Capturé après l'exécution de toutes les validations, avant la rédaction du présent rapport :

```text
 M src/shared/orchestration/commandExecution.ts
 M src/shared/orchestration/index.ts
 M src/shared/orchestration/workflowApproval.ts
 M src/shared/orchestration/workflowArtifact.ts
 M src/shared/orchestration/workflowProfile.ts
 M src/shared/orchestration/workflowRun.ts
 M src/shared/orchestration/workflowStep.ts
?? src/main/database/repositories/commandExecutionsRepository.test.ts
?? src/main/database/repositories/commandExecutionsRepository.ts
?? src/main/database/repositories/orchestrationRepositories.integration.test.ts
?? src/main/database/repositories/workflowApprovalsRepository.test.ts
?? src/main/database/repositories/workflowApprovalsRepository.ts
?? src/main/database/repositories/workflowArtifactsRepository.test.ts
?? src/main/database/repositories/workflowArtifactsRepository.ts
?? src/main/database/repositories/workflowProfilesRepository.test.ts
?? src/main/database/repositories/workflowProfilesRepository.ts
?? src/main/database/repositories/workflowRunsRepository.test.ts
?? src/main/database/repositories/workflowRunsRepository.ts
?? src/main/database/repositories/workflowStepsRepository.test.ts
?? src/main/database/repositories/workflowStepsRepository.ts
?? workflow/prompts/ORCH_2.2_PROMPT.md
?? workflow/reports/RAPPORT_ORCH_2.2.md
?? workflow/reports/REVIEW_ORCH_2.2.md
```

(Le présent fichier, `RAPPORT_CORRECTIONS_ORCH_2.2.md`, n'apparaît pas encore dans cette capture puisqu'il est créé juste après.)

Les 7 fichiers modifiés sous `src/shared/orchestration/**` correspondent exactement aux ajouts de schémas déjà effectués en ORCH-2.2 (non retouchés par cette correction, seul le contenu des repositories a changé — or les repositories `workflowRunsRepository.ts`/`workflowStepsRepository.ts`/`workflowApprovalsRepository.ts`/`commandExecutionsRepository.ts` sont des fichiers **non trackés** par Git, donc les corrections de la section 2 qu'ils contiennent n'apparaissent pas comme des modifications séparées — elles font partie du contenu de ces fichiers déjà non suivis).

## 10. Confirmation

- Aucune migration, aucun moteur de migration modifié.
- Aucun nouveau repository créé.
- Aucun IPC, preload, renderer, service d'orchestration, command runner introduit.
- Aucune dépendance ajoutée.
- Aucun changement apporté à `src/shared/orchestration/workflowStateMachine.ts`.
- `workflowRunsRepository.updateCurrentStepId` n'a pas été restreint aux steps `pending`/`in_progress`, conformément à la décision de report explicite (section 6).
- Aucun `git add`, `git commit` ou `git push` n'a été exécuté à aucun moment de cette intervention.
