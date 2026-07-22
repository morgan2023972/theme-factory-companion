# Rapport — ORCH-2.2 — Repositories de l'orchestrateur

## 1. Résumé

Cette phase a implémenté les six repositories SQLite de l'orchestrateur (`workflowProfilesRepository`, `workflowRunsRepository`, `workflowStepsRepository`, `workflowArtifactsRepository`, `workflowApprovalsRepository`, `commandExecutionsRepository`) dans `src/main/database/repositories/`, suivant strictement les conventions déjà en place (`projectsRepository.ts`/`phasesRepository.ts`). Elle comble le vide explicitement documenté par `RAPPORT_ORCH_1.1.md` (absence de schémas de création) en ajoutant des schémas `createXSchema` (et deux schémas de transition étroits, `decideWorkflowApprovalSchema`/`completeCommandExecutionSchema`) strictement additifs dans `src/shared/orchestration/*.ts`. Elle referme également deux décisions explicitement reportées : `workflowRunsRepository.updateStatus` intègre désormais `isValidWorkflowRunTransition` (ORCH-1.2) avant toute écriture, et `workflowRunsRepository.updateCurrentStepId` vérifie l'appartenance du step au run (garantie que la migration ORCH-2.1 avait volontairement laissée hors contrainte SQL, décision n°1 de `RAPPORT_ORCH_2.1.md`). Aucun IPC, aucun preload, aucun composant React, aucune logique d'exécution de commande n'a été créé.

## 2. Fichiers créés et modifiés

**Créés :**

- `src/main/database/repositories/workflowProfilesRepository.ts` (+ `.test.ts`, 7 tests)
- `src/main/database/repositories/workflowRunsRepository.ts` (+ `.test.ts`, 12 tests)
- `src/main/database/repositories/workflowStepsRepository.ts` (+ `.test.ts`, 11 tests)
- `src/main/database/repositories/workflowArtifactsRepository.ts` (+ `.test.ts`, 6 tests)
- `src/main/database/repositories/workflowApprovalsRepository.ts` (+ `.test.ts`, 7 tests)
- `src/main/database/repositories/commandExecutionsRepository.ts` (+ `.test.ts`, 9 tests)
- `src/main/database/repositories/orchestrationRepositories.integration.test.ts` (2 tests)
- `workflow/reports/RAPPORT_ORCH_2.2.md` — le présent rapport.

**Modifiés**, strictement pour l'ajout des schémas de création/transition listés en section 2.1 (aucun enum, schéma de lecture ou `superRefine` existant n'a été touché) :

- `src/shared/orchestration/workflowProfile.ts` — ajout `createWorkflowProfileSchema` / `CreateWorkflowProfileInput`.
- `src/shared/orchestration/workflowRun.ts` — ajout `createWorkflowRunSchema` / `CreateWorkflowRunInput`.
- `src/shared/orchestration/workflowStep.ts` — ajout `createWorkflowStepSchema` / `CreateWorkflowStepInput`.
- `src/shared/orchestration/workflowArtifact.ts` — ajout `createWorkflowArtifactSchema` / `CreateWorkflowArtifactInput`.
- `src/shared/orchestration/workflowApproval.ts` — ajout `createWorkflowApprovalSchema`/`CreateWorkflowApprovalInput` et `decideWorkflowApprovalSchema`/`DecideWorkflowApprovalInput`.
- `src/shared/orchestration/commandExecution.ts` — ajout `createCommandExecutionSchema`/`CreateCommandExecutionInput` et `completeCommandExecutionSchema`/`CompleteCommandExecutionInput`.
- `src/shared/orchestration/index.ts` — export des 8 nouveaux schémas et de leurs types inférés.

Aucun autre fichier n'a été créé ou modifié. En particulier : `common.ts`, `workflowStateMachine.ts` (utilisé tel quel, jamais modifié), `src/main/database/migrations/**` (0001, 0002, moteur de migration), `projectsRepository.ts`, `phasesRepository.ts` et leurs tests, `src/preload`, `src/renderer`, tout canal IPC, `package.json`.

### 2.1 Détail des schémas ajoutés

Aucune valeur par défaut Zod (`.default(...)`) n'a été introduite sur ces nouveaux schémas — chaque valeur initiale (`status: 'draft'`, `stdout: ''`, etc.) est fixée par le repository, jamais par le schéma.

| Fichier | Schéma | Champs |
|---|---|---|
| `workflowProfile.ts` | `createWorkflowProfileSchema` | `name`, `version`, `validationCommands: ValidationCommand[]` |
| `workflowRun.ts` | `createWorkflowRunSchema` | `projectId`, `phaseId`, `profileId`, `profileFingerprint` |
| `workflowStep.ts` | `createWorkflowStepSchema` | `workflowRunId`, `type`, `position` |
| `workflowArtifact.ts` | `createWorkflowArtifactSchema` | `workflowRunId`, `workflowStepId` (nullable), `type`, `relativePath` |
| `workflowApproval.ts` | `createWorkflowApprovalSchema` | `workflowRunId`, `workflowStepId` (nullable), `type` |
| `workflowApproval.ts` | `decideWorkflowApprovalSchema` | `status: 'approved' \| 'rejected'` |
| `commandExecution.ts` | `createCommandExecutionSchema` | `workflowRunId`, `workflowStepId` (nullable), `executable`, `args`, `cwd` |
| `commandExecution.ts` | `completeCommandExecutionSchema` | `status`, `exitCode`, `durationMs`, `stdout`, `stderr`, `stdoutTruncated`, `stderrTruncated` |

## 3. API exacte des six repositories

### `workflowProfilesRepository`
- `create(input): WorkflowProfile` — transaction : insère le profil puis chaque `validationCommands[i]` avec `position = i`.
- `getById(id): WorkflowProfile | null`
- `list(): WorkflowProfile[]` — `ORDER BY created_at DESC, id DESC`.
- Aucune fonction `update`/`remove` (décision imposée n°5).

### `workflowRunsRepository`
- `create(input): WorkflowRun` — `status: 'draft'`, `currentStepId: null`, `startedAt: now()`, `completedAt: null`.
- `getById(id): WorkflowRun | null`
- `listByProjectId(projectId): WorkflowRun[]` — `ORDER BY started_at DESC, id DESC`.
- `updateStatus(id, status): WorkflowRun` — lève une erreur si le run est introuvable ou si `isValidWorkflowRunTransition(existing.status, status)` est `false` (aucune écriture dans ce cas) ; renseigne `completedAt = now()` si `status` est terminal.
- `updateCurrentStepId(id, currentStepId): WorkflowRun` — lève une erreur si `currentStepId` non nul ne correspond à aucun step du run ciblé.

### `workflowStepsRepository`
- `create(input): WorkflowStep` — `status: 'pending'`, `startedAt`/`completedAt: null`.
- `getById(id): WorkflowStep | null`
- `listByWorkflowRunId(workflowRunId): WorkflowStep[]` — `ORDER BY position ASC, id ASC`.
- `start(id): WorkflowStep` — autorisé uniquement depuis `'pending'`.
- `complete(id, status): WorkflowStep` — autorisé depuis `'pending'` ou `'in_progress'`, statut cible parmi `'completed' | 'failed' | 'cancelled' | 'skipped'`.

### `workflowArtifactsRepository`
- `create(input): WorkflowArtifact` — `createdAt: now()`.
- `getById(id): WorkflowArtifact | null`
- `listByWorkflowRunId(workflowRunId): WorkflowArtifact[]` — `ORDER BY created_at ASC, id ASC`.
- Aucune fonction `update`/`remove` (immuable, décision imposée n°5).

### `workflowApprovalsRepository`
- `create(input): WorkflowApproval` — `status: 'pending'`, `requestedAt: now()`, `decidedAt: null`.
- `getById(id): WorkflowApproval | null`
- `listByWorkflowRunId(workflowRunId): WorkflowApproval[]` — `ORDER BY requested_at ASC, id ASC`.
- `decide(id, input): WorkflowApproval` — autorisé uniquement depuis `'pending'`.

### `commandExecutionsRepository`
- `create(input): CommandExecution` — `status: 'pending'`, tous champs dérivés à `null`/`''`/`false`.
- `getById(id): CommandExecution | null`
- `listByWorkflowRunId(workflowRunId): CommandExecution[]` — `ORDER BY created_at ASC, id ASC`.
- `markRunning(id): CommandExecution` — autorisé uniquement depuis `'pending'`.
- `complete(id, input): CommandExecution` — autorisé uniquement depuis `'running'`.

Toutes les erreurs de règle métier (transition refusée, décision déjà prise, step étranger au run, entité introuvable) sont des `Error` explicites levées avant toute écriture SQL. Toute violation de contrainte SQLite (CHECK/UNIQUE/FK) remonte sans traduction.

## 4. Confirmation des 6 décisions imposées

1. **Dates de cycle de vie générées par `now()` au moment de l'appel** — confirmé pour les 6 repositories ; aucune date de cycle de vie métier n'est acceptée en entrée.
2. **`workflowRunsRepository.updateStatus` appelle `isValidWorkflowRunTransition` avant toute écriture** — confirmé (voir section 5).
3. **`workflowRunsRepository.updateCurrentStepId` vérifie l'appartenance du step au run avant d'écrire** — confirmé (voir section 5).
4. **Aucune limite de cycles de correction, aucun verrou de concurrence, aucun timeout modélisé** — confirmé, aucun repository ne contient une telle logique.
5. **`workflowProfilesRepository`/`workflowArtifactsRepository` n'exposent aucune fonction `update`/`remove`** — confirmé.
6. **Chaque transition métier vérifie le statut courant avant d'écrire** — confirmé pour `start`/`complete` (steps), `markRunning`/`complete` (commandes), `decide` (approbations), `updateStatus` (runs) ; tous couverts par un test négatif dédié (section 6).

## 5. Intégration ORCH-1.2 ↔ ORCH-2.2

- **`workflowRunsRepository.updateStatus`** : lit d'abord la ligne existante (lève une erreur si absente), puis appelle `isValidWorkflowRunTransition(existing.status, status)` importée depuis `../../../shared/orchestration`. Si `false`, lève une erreur explicite (`Transition de workflow refusée : "X" -> "Y"`) sans exécuter la moindre requête `UPDATE`. Si la transition est autorisée, écrit le nouveau statut et — uniquement si `status` appartient à `WORKFLOW_RUN_TERMINAL_STATUSES` — renseigne `completed_at = now()` ; sinon `completed_at` reste inchangé (déjà `null`, aucune transition ORCH-1.2 ne ramenant un run non terminal après un run terminal). Testé par `workflowRunsRepository.test.ts` (transition valide, transition invalide sans écriture, `completedAt` renseigné au passage à un statut terminal) et par le test d'intégration.
- **`workflowRunsRepository.updateCurrentStepId`** : si `currentStepId` n'est pas `null`, exécute `SELECT id FROM workflow_steps WHERE id = @stepId AND workflow_run_id = @workflowRunId` avant d'écrire ; absence de résultat ⇒ erreur explicite, aucune écriture. C'est exactement la garantie que la décision n°1 de `RAPPORT_ORCH_2.1.md` avait reportée à ce repository, en l'absence de contrainte `REFERENCES` sur `current_step_id` (pour éviter une dépendance circulaire avec `workflow_steps.workflow_run_id`). Testé par 4 cas dédiés (step du run accepté, step d'un autre run refusé, step inexistant refusé, remise à `null` acceptée).

## 6. Tests ajoutés

54 tests répartis sur 7 fichiers :

- `workflowProfilesRepository.test.ts` — 7 tests (création avec/sans commandes, ordre des commandes conservé, rejet nom vide, `getById`/`list` avec tri).
- `workflowRunsRepository.test.ts` — 12 tests (création, rejet FK invalide, isolation par projet, transition valide/invalide via la vraie `isValidWorkflowRunTransition`, `completedAt` sur statut terminal, `updateCurrentStepId` : step valide/étranger/inexistant/remise à null).
- `workflowStepsRepository.test.ts` — 11 tests (création, rejet FK, rejet doublon de position, tri, `start`/`complete` valides et invalides, cas `skipped` sans démarrage).
- `workflowArtifactsRepository.test.ts` — 6 tests (création avec/sans step, rejet chemin absolu, rejet FK, `getById`/liste ordonnée).
- `workflowApprovalsRepository.test.ts` — 7 tests (création, rejet FK, isolation par run, `decide` valide, refus d'une seconde décision, refus sur approbation inexistante).
- `commandExecutionsRepository.test.ts` — 9 tests (création, rejet FK, `markRunning` valide/invalide, `complete` succès/échec/refus depuis `pending`).
- `orchestrationRepositories.integration.test.ts` — 2 tests (chaîne complète `project → phase → workflow_profile → workflow_run → workflow_step → artefact/approbation/exécution` à travers les six repositories + `updateStatus`/`updateCurrentStepId` ; suppression cascadée depuis `projects`).

Total : 7 + 12 + 11 + 6 + 7 + 9 + 2 = 54.

## 7. Résultats de `npm run typecheck`

```text
> theme-factory-companion@1.0.0 typecheck
> tsc -p tsconfig.node.json --noEmit && tsc -p tsconfig.web.json --noEmit
```

Succès, aucune erreur.

## 8. Résultats de `npx vitest run --maxWorkers=1`

Sous-ensemble `src/main/database/repositories` (exécuté isolément) : **135 tests, 10 fichiers, tous passés** dès la première tentative.

Suite complète du dépôt : **`Test Files 37 passed (37)`, `Tests 1134 passed (1134)`**, succès intégral dès la première tentative — aucun aléa d'infrastructure rencontré (contrairement à ORCH-2.1, aucune relance n'a été nécessaire).

Cohérence des totaux : 1080 (dernier total connu, après ORCH-2.1) + 54 (nouveaux tests de cette phase) = 1134, correspondance exacte.

## 9. Résultats de `npm run build`

```text
✓ built in 11.60s  (out/main)
✓ built in 891ms   (out/preload)
✓ built in 18.41s  (out/renderer)
```

Succès, aucune erreur.

## 10. Résultat de `git status --short --untracked-files=all`

Capturé après la rédaction du présent rapport :

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
```

`git diff --check` : aucun conflit de fin de ligne ni espace superflu signalé dans le contenu du diff ; seuls des avertissements informatifs `LF will be replaced by CRLF` (conversion `core.autocrlf` propre à cet environnement Windows) ont été émis (exit code 0).

## 11. Confirmation

- Aucun fichier sous `src/main/database/migrations/**`, `projectsRepository.ts`, `phasesRepository.ts`, `common.ts`, `workflowStateMachine.ts` n'a été modifié.
- Aucun enum, schéma de lecture ou `superRefine` existant dans `src/shared/orchestration/*.ts` n'a été modifié ; tous les ajouts sont strictement additifs.
- Aucun fichier sous `src/preload`, `src/renderer` n'a été créé ou modifié ; aucun canal IPC.
- `package.json` non modifié ; aucune dépendance installée.
- Aucun `git add`, `git commit` ou `git push` n'a été exécuté à aucun moment de cette intervention.
