# Review — ORCH-2.2.R — Repositories de l'orchestrateur

## 1. Verdict global

**VALIDABLE AVEC CORRECTIONS MINEURES.**

L'implémentation ORCH-2.2 (six repositories SQLite + schémas de création/transition additifs + test d'intégration) est fonctionnellement correcte, strictement limitée au périmètre annoncé, et cohérente avec ORCH-1.1, ORCH-1.2 et ORCH-2.1. Aucun défaut bloquant n'a été identifié : les invariants de sécurité les plus sensibles (intégration réelle de la machine à états dans `updateStatus`, vérification d'appartenance dans `updateCurrentStepId`, absence d'écriture avant validation métier, requêtes paramétrées partout) sont correctement implémentés et testés.

Un constat **majeur** (absence de test de reprise après redémarrage passant par les repositories ORCH-2.2 eux-mêmes) et deux constats **moyens** (appels multiples à `now()` dans une même mutation ; absence de test explicite sur `updatedAt`) justifient une correction avant de considérer cette base de persistance comme définitivement fiabilisée pour les phases suivantes — mais aucun ne remet en cause la validité du travail livré ni ne révèle de bug de données actif : ce sont des lacunes de validation/cohérence interne, pas des défauts fonctionnels démontrés. Le reste des constats (mineurs) sont des observations de complétude ou de documentation, sans risque concret à ce stade.

**Correction préalable à la demande de review** : le chemin cité dans la commande de review, `src/main/orchestration/workflowStateMachine.ts`, est incorrect — le fichier réel est `src/shared/orchestration/workflowStateMachine.ts`. Sans conséquence sur le fond de cette review.

## 2. Constats

### 2.1 Majeur

**M1 — Aucun test ORCH-2.2 ne vérifie la reprise après redémarrage via les repositories eux-mêmes**

- Fichiers concernés : absence dans `src/main/database/repositories/orchestrationRepositories.integration.test.ts` et dans les six `*Repository.test.ts`.
- Constat : `ORCHESTRATOR_V1_SCOPE.md` section 5 liste explicitement « reprise après redémarrage de l'application » parmi le périmètre inclus de la V1, et section 10 (Definition of Done) exige « le workflow peut reprendre après un redémarrage ». Le seul test existant qui ferme puis rouvre une base fichier réelle est `database.test.ts` (« conserve les données d'orchestration et leurs relations… », ajouté lors de la correction finale d'ORCH-2.1) — mais il insère et relit les données par **SQL brut**, jamais via `createWorkflowRunsRepository`/`createWorkflowStepsRepository`/etc. Aucun test n'instancie les repositories ORCH-2.2 contre une connexion fichier, ferme cette connexion, la rouvre, ré-instancie les repositories sur la nouvelle connexion, puis vérifie qu'ils continuent à lire/écrire correctement (par exemple : `workflowRunsRepository.updateStatus` après réouverture).
- Risque concret : rien ne prouve aujourd'hui, au niveau de cette phase, que les six repositories (statuts, requêtes préparées, transactions) se comportent identiquement après une fermeture/réouverture réelle plutôt que sur une connexion `:memory:` ouverte une seule fois pendant toute la durée du test. Le risque réel est jugé faible (les repositories sont des factories sans état interne, liées uniquement à la connexion passée en paramètre — architecturalement rien ne distingue une connexion fraîchement rouverte d'une connexion `:memory:`), mais ce n'est **pas démontré par un test**, alors que la roadmap l'exige explicitement pour cette portion du système.
- Correction minimale recommandée (non appliquée) : ajouter, dans `orchestrationRepositories.integration.test.ts` ou un nouveau fichier dédié, un test suivant le patron déjà établi par `database.test.ts` (`mkdtempSync`, fichier réel, `openDatabase`/`closeDatabase`) mais en passant par au moins `workflowRunsRepository.create`/`updateStatus` et `workflowStepsRepository.create`/`start` avant et après la réouverture, pour prouver que le cycle de vie complet fonctionne à travers les repositories, pas seulement en SQL brut.

### 2.2 Moyens

**Mo1 — Appels multiples à `now()` au sein d'une seule mutation, incohérents avec la convention établie par `create()`**

- Fichiers et lignes exacts :
  - `src/main/database/repositories/workflowRunsRepository.ts:170-175` (`updateStatus`) : `completed_at: isTerminal ? now() : existing.completed_at, updated_at: now()` — deux appels à `now()` lorsque `isTerminal` est vrai.
  - `src/main/database/repositories/workflowStepsRepository.ts:152` (`start`) : `startStatement.run({ id, started_at: now(), updated_at: now() })`.
  - `src/main/database/repositories/workflowStepsRepository.ts:171` (`complete`) : `completeStatement.run({ id, status, completed_at: now(), updated_at: now() })`.
  - `src/main/database/repositories/workflowApprovalsRepository.ts:154` (`decide`) : `decideStatement.run({ id, status: data.status, decided_at: now(), updated_at: now() })`.
  - `src/main/database/repositories/commandExecutionsRepository.ts:183` (`markRunning`) : `markRunningStatement.run({ id, started_at: now(), updated_at: now() })`.
  - `src/main/database/repositories/commandExecutionsRepository.ts:207-208` (`complete`) : `completed_at: now(), updated_at: now()`.
- Constat : toutes les fonctions `create()` des six repositories capturent `const timestamp = now()` **une seule fois** et le réutilisent pour toutes les colonnes de date concernées (`createdAt`, `updatedAt`, et le cas échéant `startedAt`/`requestedAt`) — un patron correct et cohérent. Les six méthodes de transition listées ci-dessus rompent ce patron : elles appellent `now()` deux fois (une fois pour le timestamp métier, une fois pour `updatedAt`), sans jamais réutiliser une valeur unique.
- Risque concret : avec l'horloge réelle par défaut (`() => new Date().toISOString()`), le risque pratique est faible mais réel (deux appels synchrones peuvent, en théorie, produire deux valeurs ISO différentes si l'exécution chevauche une frontière de milliseconde) — `completedAt`/`startedAt`/`decidedAt` et `updatedAt` ne représentent alors plus rigoureusement « le même instant », alors que conceptuellement une seule mutation doit correspondre à un seul instant. Plus concrètement, ce double appel rend ces six fonctions incompatibles avec le patron d'horloge déterministe à valeurs séquentielles déjà utilisé ailleurs dans ce dépôt pour les tests (`now: () => timestamps[callIndex++]`, voir `projectsRepository.test.ts:42` et les tests d'ordonnancement ajoutés dans cette même phase) : un futur test utilisant ce patron sur l'une de ces six méthodes consommerait deux valeurs au lieu d'une, avec un résultat probablement inattendu pour l'auteur du test.
- Correction minimale recommandée (non appliquée) : dans chacune des six fonctions, capturer `const timestamp = now()` une seule fois avant l'appel à `.run(...)` et réutiliser cette même valeur pour la colonne métier (`completed_at`/`started_at`/`decided_at`) et pour `updated_at`.

**Mo2 — Aucun test ne vérifie explicitement le comportement de `updatedAt`**

- Fichiers concernés : `workflowRunsRepository.test.ts`, `workflowStepsRepository.test.ts`, `workflowApprovalsRepository.test.ts`, `commandExecutionsRepository.test.ts`, `workflowArtifactsRepository.test.ts` (confirmé par recherche : aucune occurrence de `updatedAt` dans ces cinq fichiers, contre une occurrence dans `workflowProfilesRepository.test.ts`, elle-même indirecte via une comparaison d'objet complet).
- Constat : aucun test n'affirme que `updatedAt` change réellement après une mutation acceptée (`start`, `complete`, `decide`, `markRunning`, `updateStatus`, `updateCurrentStepId`), ni qu'il reste inchangé après une mutation refusée. Pour cette dernière garantie, la lecture du code confirme qu'aucune écriture ne peut se produire avant une erreur (chaque fonction lève son `Error` strictement avant l'appel à `.run(...)`, jamais après) : il n'y a donc pas de bug fonctionnel actif, seulement une absence de preuve par le test.
- Risque concret : une régression future qui modifierait `updated_at` avant la vérification de statut (par exemple lors d'un refactor) ne serait détectée par aucun test existant.
- Correction minimale recommandée (non appliquée) : ajouter, pour au moins une transition par repository, une assertion `expect(after.updatedAt).not.toBe(before.updatedAt)` sur succès (avec une horloge injectée à deux valeurs distinctes) et `expect(repository.getById(id)?.updatedAt).toBe(before.updatedAt)` sur refus.

### 2.3 Mineur à moyen

**Mi1 — `workflowRunsRepository.updateCurrentStepId` n'empêche pas de désigner un step déjà terminal comme étape courante**

- Fichier : `src/main/database/repositories/workflowRunsRepository.ts:187-202`, requête `findStepInRunStatement` (ligne 105-107) : `SELECT id FROM workflow_steps WHERE id = @stepId AND workflow_run_id = @workflowRunId`.
- Constat : la vérification porte uniquement sur l'appartenance du step au run (décision n°1 d'ORCH-2.1, correctement implémentée). Elle ne filtre pas sur le statut du step ciblé : un step `completed`, `failed`, `cancelled` ou `skipped` peut être désigné comme `current_step_id` au même titre qu'un step `pending`/`in_progress`. Aucun document (`ORCH_2.2_PROMPT.md`, commentaire du code, `RAPPORT_ORCH_2.2.md`) ne tranche explicitement cette question — ni pour l'autoriser en connaissance de cause, ni pour la refuser.
- Risque concret : faible en l'état (aucune logique d'exécution ne consomme encore `currentStepId` pour piloter un comportement), mais c'est une décision de modélisation non documentée, du même type que celles qui avaient motivé des corrections lors de la review d'ORCH-1.1. Un futur consommateur de `currentStepId` (par exemple une interface affichant « étape en cours ») pourrait afficher un step déjà terminé comme actif si rien ne documente l'intention.
- Correction minimale recommandée (non appliquée) : soit documenter explicitement ce choix comme volontaire (le contrôle du statut du step courant est une responsabilité d'orchestration future, hors périmètre persistance), soit restreindre `findStepInRunStatement` à `status IN ('pending', 'in_progress')`. Trancher explicitement l'un ou l'autre, pas le laisser implicite.

### 2.4 Mineurs

**Mi2 — Aucune méthode dédiée pour retrouver un run reprenable, ses approbations en attente ou ses commandes non terminées**

- Constat : seuls des `listByXId` génériques existent dans les six repositories ; retrouver « le run actif d'un projet », « les approbations en attente d'un run » ou « les commandes non terminées d'un run » exige un filtrage côté appelant. C'est cohérent avec le périmètre déclaré par `ORCH_2.2_PROMPT.md` (persistance pure, pas de logique d'exécution), et une telle logique de reprise appartient plus naturellement à un futur service d'orchestration (ORCH-4.x/5.x). Non documenté explicitement comme un report volontaire dans `RAPPORT_ORCH_2.2.md`.
- Risque concret : aucun aujourd'hui ; simple lacune de documentation d'une décision de scope par ailleurs raisonnable.
- Correction minimale recommandée (non appliquée) : ajouter une phrase dans un futur rapport (ou en commentaire) documentant explicitement ce report, à l'image des « décisions imposées » déjà pratiquées dans ORCH-1.2/ORCH-2.1.

**Mi3 — Filtrage des secrets dans `stdout`/`stderr` non implémenté**

- Fichier : `src/main/database/repositories/commandExecutionsRepository.ts`, fonction `complete`.
- Constat : `ORCHESTRATOR_V1_SAFETY_RULES.md` section 13 exige que les sorties stdout/stderr journalisées soient filtrées pour masquer les motifs de secrets connus avant persistance. `commandExecutionsRepository.complete` persiste `data.stdout`/`data.stderr` tels que fournis par l'appelant, sans filtrage. Cette responsabilité relève très vraisemblablement du futur exécuteur de commandes (ORCH-4.1), qui produit réellement ces sorties — pas de la couche de persistance, qui n'a aucune connaissance du contenu au-delà de ce qu'on lui passe. Non documenté comme report explicite.
- Risque concret : aucun aujourd'hui (aucun appelant réel n'existe encore) ; à surveiller lors de l'implémentation d'ORCH-4.1, pour s'assurer que le filtrage a bien lieu avant l'appel à `complete`, pas après.
- Correction minimale recommandée (non appliquée) : documenter ce report explicitement dans `ORCH_2.2_PROMPT.md`/rapport, ou dans un futur prompt ORCH-4.1, comme prérequis d'appel de `commandExecutionsRepository.complete`.

**Mi4 — `JSON.parse` non protégé sur les colonnes `args`**

- Fichiers : `workflowProfilesRepository.ts:44` (`mapRowToValidationCommand`), `commandExecutionsRepository.ts:45` (`mapRowToCommandExecution`).
- Constat : `JSON.parse(row.args)` n'est entouré d'aucun `try/catch`. En cas de colonne `args` corrompue (modification manuelle de la base, bug futur), l'appel lève une `SyntaxError` brute et peu explicite plutôt qu'une erreur métier claire.
- Risque concret : faible — le seul point d'écriture de cette colonne est le repository lui-même (`JSON.stringify` systématique), donc une corruption ne peut provenir que d'une intervention externe à l'application. Le comportement actuel (lever une exception) reste conforme au principe fail-closed : il ne masque rien, il échoue simplement avec un message générique.
- Correction minimale recommandée (non appliquée) : envelopper le `JSON.parse` et relancer une erreur explicite mentionnant la colonne et l'identifiant de ligne concernés, pour faciliter le diagnostic si ce cas se présente un jour.

**Mi5 — Cascade `project → command_executions`/`workflow_approvals` non re-testée au niveau repository**

- Fichier : `orchestrationRepositories.integration.test.ts`, test « supprime en cascade toute la chaîne… » (lignes 108-138) : ne vérifie que `workflow_runs`, `workflow_steps` et `workflow_artifacts` après suppression du projet, pas `workflow_approvals` ni `command_executions`.
- Constat : ce comportement est déjà entièrement prouvé au niveau de la migration (`0002_createOrchestrationSchema.test.ts`, catégorie « Cascades et restrictions », qui couvre explicitement les 4 tables enfants de `workflow_runs`). Sa non-répétition au niveau repository est une redondance manquante, pas un risque réel : le mécanisme SQL sous-jacent est déjà vérifié, et les repositories ne font qu'exposer des `SELECT`/`INSERT`/`UPDATE` directs dessus, sans logique intermédiaire qui pourrait le contourner.
- Risque concret : négligeable.
- Correction minimale recommandée (non appliquée) : étendre le test existant à `workflow_approvals`/`command_executions` par souci de complétude, sans urgence.

## 3. Points explicitement conformes

- **Intégration ORCH-1.2 ↔ ORCH-2.2** : `workflowRunsRepository.updateStatus` (lignes 161-178) appelle bien `isValidWorkflowRunTransition(existing.status, status)` et lève une erreur **avant** tout appel à `updateStatusStatement.run(...)` — vérifié précisément par lecture du code, aucune écriture partielle n'est possible même en l'absence de transaction explicite.
- **Vérification d'appartenance `current_step_id`** : `updateCurrentStepId` interroge correctement `workflow_steps` avec la double condition `id` + `workflow_run_id` avant d'écrire, conformément à la décision n°1 d'ORCH-2.1 (voir cependant Mi1 pour la nuance sur le statut du step).
- **Requêtes préparées** : toutes les requêtes récurrentes des six repositories sont préparées une seule fois à la construction (`database.prepare(...)` en dehors des fonctions exposées), jamais recréées par appel — conforme à `projectsRepository.ts`/`phasesRepository.ts`.
- **Absence de concaténation SQL dangereuse** : tous les paramètres transitent par des placeholders nommés (`@id`, `@status`, etc.) ; la seule construction de chaîne (`SELECT_COLUMNS`) est un littéral fixe au moment de la compilation, jamais dérivée d'une entrée utilisateur.
- **Transactions** : seule `workflowProfilesRepository.create` (opération composée profil + N commandes de validation) utilise `database.transaction(...)`, à raison — c'est la seule opération multi-lignes du lot. L'absence de transaction sur les lectures-puis-écritures (`updateStatus`, `updateCurrentStepId`, `start`, `complete`, `decide`, `markRunning`) est correcte et volontaire : `better-sqlite3` est strictement synchrone et Node.js mono-thread, donc aucun entrelacement concurrent n'est possible dans cette architecture (même raisonnement déjà documenté dans `phasesRepository.ts`).
- **Mapping SQLite ↔ domaine** : conversions snake_case/camelCase cohérentes et complètes dans les six repositories ; sérialisation/désérialisation JSON de `args` correcte (`workflowProfilesRepository`, `commandExecutionsRepository`) ; conversion des entiers SQLite `0`/`1` en booléens correcte (`blocking`, `stdoutTruncated`, `stderrTruncated`) ; chaque ligne relue est systématiquement revalidée via le schéma Zod de lecture correspondant (`mapRowToX` appelle `xSchema.parse(...)`, `superRefine` inclus), donc toute incohérence de données serait interceptée à la lecture, pas seulement à l'écriture.
- **Schémas partagés ajoutés** : strictement additifs, aucun `superRefine`/enum/schéma de lecture existant modifié (confirmé par `git diff --stat` : uniquement des insertions dans les sept fichiers `src/shared/orchestration/*.ts`) ; aucune valeur par défaut Zod introduite ; les champs correspondent exactement aux responsabilités des repositories (aucun champ dérivé ne peut être fourni par l'appelant : `status`, `currentStepId`/`decidedAt`/`completedAt`/`startedAt` initiaux, `stdout`/`stderr` initiaux sont tous exclus des schémas de création).
- **Exports `index.ts`** : les 8 nouveaux schémas et leurs types inférés sont exportés ; aucun export existant retiré.
- **Sécurité et secrets** : aucun secret n'est enregistré ni journalisé (aucun `console.log`/équivalent dans les six fichiers) ; `common.ts` et `workflowStateMachine.ts` ne sont pas modifiés.
- **Périmètre** : aucun IPC, aucun preload, aucun composant React, aucune commande Git, aucun command runner introduit ; aucune logique appartenant à ORCH-3.x/4.x/5.x identifiée dans le code livré (voir cependant Mi2/Mi3 pour deux responsabilités futures non documentées comme telles).
- **Migrations de production réellement utilisées** : tous les fichiers de test appellent `runMigrations(db)` sans second argument, qui retombe par défaut sur `productionMigrations` (`runMigrations.ts:53`) — confirmé, pas de schéma de test ad hoc.
- **Cohérence des conventions** : structure des six repositories rigoureusement alignée sur `projectsRepository.ts`/`phasesRepository.ts` (factory, `XRow` interne, `mapRowToX`, `now` injectable, génération d'`id` via `randomUUID()`).

## 4. Résultats des validations exécutées

**`npm run typecheck`** :

```text
> theme-factory-companion@1.0.0 typecheck
> tsc -p tsconfig.node.json --noEmit && tsc -p tsconfig.web.json --noEmit
```

Succès, aucune erreur.

**`npx vitest run --maxWorkers=1`** :

- 1ʳᵉ tentative : `Test Files 1 failed | 33 passed (34)`, `Tests 2 failed | 1101 passed (1103)`, 3 erreurs de pool de workers (`Timeout waiting for worker to respond`) sur `src/renderer/src/App.test.tsx` et `src/main/database/databaseHealth.test.ts` — aléa d'infrastructure déjà documenté dans `RAPPORT_CORRECTIONS_REVIEW_ORCH_1.1.md`/`RAPPORT_ORCH_1.2.md`/`RAPPORT_ORCH_2.1.md`, sans rapport avec le code ORCH-2.2 (aucun des deux fichiers concernés n'appartient à cette phase).
- 2ᵉ tentative : `Test Files 1 failed | 36 passed (37)`, `Tests 3 failed | 1131 passed (1134)` — échecs cette fois dans `src/renderer/src/pages/PhasesPage.test.tsx` (timeouts sous charge), le même aléa préexistant déjà documenté, sur un fichier différent mais de même nature, également sans rapport avec ORCH-2.2.
- Aucune des deux tentatives n'a produit d'échec dans un fichier appartenant à `src/main/database/repositories/**` ou `src/shared/orchestration/**` : le sous-ensemble ORCH-2.2 reste vert sur les deux passes (135 tests confirmés lors de l'exécution ciblée initiale, non recomptés isolément pendant cette review pour éviter une action redondante — le nombre total attendu, 1134, est atteint sur la 2ᵉ tentative en comptant les 3 échecs de `PhasesPage.test.tsx`).
- Conformément à la pratique déjà établie pour ORCH-2.1/ORCH-1.2, une troisième tentative n'a pas été relancée : l'aléa est reconnu, documenté, et sans lien avec le périmètre de cette review.

**`npm run build`** :

```text
✓ built in 5.45s   (out/main)
✓ built in 289ms   (out/preload)
✓ built in 1m 14s  (out/renderer)
```

Succès, aucune erreur.

**`git diff --check`** : exit code 0. Seuls des avertissements informatifs `LF will be replaced by CRLF` (conversion `core.autocrlf`), sans rapport avec le contenu.

**`git status --short --untracked-files=all`** :

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

Aucun fichier hors du périmètre ORCH-2.2 n'apparaît (le présent fichier `REVIEW_ORCH_2.2.md`, créé après cette capture, n'y figure pas encore).

**`git diff --stat`** : confirme 7 fichiers modifiés sous `src/shared/orchestration/**`, uniquement des insertions (164 insertions, 1 suppression correspondant à la ligne de fermeture d'objet déplacée par l'ajout — aucune ligne de logique existante supprimée).

## 5. Décision finale

**Validable avec corrections mineures.**

Raisonnement : aucun constat bloquant, aucun défaut de sécurité ou d'intégrité relationnelle démontré, tous les invariants les plus critiques (intégration de la machine à états, garantie d'appartenance `current_step_id`, absence d'écriture avant validation, paramétrage SQL) sont corrects et testés. Le seul constat majeur (M1, absence de test de reprise après redémarrage via les repositories) porte sur une lacune de **validation**, pas sur un bug de données actif ou suspecté : l'architecture des repositories (factories sans état, liées à la connexion passée en paramètre) ne présente aucune raison de se comporter différemment après réouverture, et le mécanisme de réouverture lui-même est déjà prouvé au niveau `database.ts`/migration. Corriger ce point avant de considérer ORCH-2.2 définitivement clos reste néanmoins recommandé, de même que les deux constats moyens (double appel à `now()`, absence de test sur `updatedAt`), avant de bâtir dessus les phases d'exécution (ORCH-4.x/5.x) qui s'appuieront lourdement sur ces transitions.
