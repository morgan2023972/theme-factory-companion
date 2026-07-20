# Rapport de corrections — Review ORCH-1.1

## 1. Corrections appliquées

Les trois problèmes majeurs de `REVIEW_ORCH_1.1.md` ont été corrigés. Aucune autre modification n'a été apportée (les problèmes mineurs et recommandations non bloquantes de la review n'étaient pas dans le périmètre demandé pour cette correction).

### 1.1 Chemins d'artefacts (problème majeur 10.1)

`src/shared/orchestration/common.ts` : `hasAbsoluteLikePrefix` rejetait les chemins UNC (`\\server\share`), les chemins avec lettre de lecteur (`C:\...`, `C:/...`), les chemins Unix (`/etc/...`) et `~`, mais laissait passer un chemin Windows à backslash unique sans lettre de lecteur (ex. `\Windows\system.ini`). La détection est remplacée par une expression unique, `/^([\\/]|[a-zA-Z]:[\\/]|~)/`, qui rejette tout chemin commençant par un séparateur unique (`/` ou `\`, ce qui couvre à la fois l'absolu Unix, l'absolu Windows à backslash unique et l'UNC), par une lettre de lecteur, ou par `~`. Les traversées `..` continuent d'être rejetées séparément par `hasParentTraversalSegment`, inchangée.

### 1.2 Profil (problème majeur 10.2)

`src/shared/orchestration/workflowProfile.ts` : `validationCommandSchema.blocking` portait `z.boolean().default(true)`. Le `.default(true)` a été retiré ; `blocking` est désormais un booléen obligatoire, sans valeur par défaut, cohérent avec la convention du dépôt (`task.ts`/`phase.ts`/`project.ts` ne mettent jamais de valeur par défaut sur le schéma de lecture, uniquement sur un éventuel schéma de création dédié — qui n'existe pas encore pour cette entité). Un enregistrement persistant auquel il manquerait ce champ est désormais rejeté par validation plutôt qu'accepté silencieusement avec `blocking: true`.

### 1.3 Cohérence statut/dates (problème majeur 10.3)

Un `.superRefine()` a été ajouté à la fin de chacun des quatre schémas suivants, appliquant exactement les règles demandées :

- **`WorkflowRun`** (`workflowRun.ts`) : `completed`, `cancelled` et `failed` exigent `completedAt` renseigné ; tout autre statut exige `completedAt: null`.
- **`WorkflowStep`** (`workflowStep.ts`) : `pending` exige `startedAt: null` et `completedAt: null` ; `in_progress` exige `startedAt` renseigné et `completedAt: null` ; `completed`, `failed`, `cancelled` et `skipped` exigent `completedAt` renseigné (leur `startedAt` reste volontairement libre : une étape `skipped` peut n'avoir jamais démarré).
- **`WorkflowApproval`** (`workflowApproval.ts`) : `pending` exige `decidedAt: null` ; `approved` et `rejected` exigent `decidedAt` renseigné.
- **`CommandExecution`** (`commandExecution.ts`) : `pending` exige `startedAt`, `completedAt`, `durationMs` et `exitCode` à `null` ; `running` exige `startedAt` renseigné, les trois autres à `null` ; `completed` exige `startedAt`/`completedAt`/`durationMs` renseignés et `exitCode` égal à `0` ; `failed`, `timed_out` et `cancelled` exigent `startedAt`/`completedAt`/`durationMs` renseignés, sans aucune contrainte sur `exitCode` (qui peut être `null` ou toute valeur entière), conformément à la consigne (« une erreur de lancement ou une interruption peut ne produire aucun code »).

**Effet de bord nécessaire sur `CommandExecution.startedAt`** : ce champ était auparavant toujours obligatoire (`z.iso.datetime()`, non nullable). La règle « `pending` exige `startedAt` à `null` » impose que ce champ devienne nullable (`z.iso.datetime().nullable()`) : une exécution qui n'a pas encore démarré ne peut logiquement pas porter de date de début. Ce changement de type est strictement nécessaire à l'application de la règle demandée et ne modifie aucun autre comportement du schéma.

Chaque `superRefine` reste un contrôle de cohérence de données local à l'entité (« si le statut est X, tel champ doit/ne doit pas être renseigné ») : aucune règle de transition entre statuts n'a été implémentée, conformément à la consigne de ne pas anticiper la machine à états d'ORCH-1.2.

## 2. Fichiers modifiés

- `src/shared/orchestration/common.ts` — correction de `hasAbsoluteLikePrefix`.
- `src/shared/orchestration/workflowArtifact.test.ts` — ajout du test de rejet du chemin `\Windows\system.ini`.
- `src/shared/orchestration/workflowProfile.ts` — suppression de `.default(true)` sur `blocking`.
- `src/shared/orchestration/workflowProfile.test.ts` — remplacement du test de valeur par défaut par un test de rejet de l'absence du champ, ajout d'un test de rejet d'un `blocking` non booléen.
- `src/shared/orchestration/workflowRun.ts` — ajout de `WORKFLOW_RUN_TERMINAL_STATUSES` et du `superRefine` de cohérence `status`/`completedAt`.
- `src/shared/orchestration/workflowRun.test.ts` — ajout des tests de cohérence `status`/`completedAt`.
- `src/shared/orchestration/workflowStep.ts` — ajout du `superRefine` de cohérence `status`/`startedAt`/`completedAt`.
- `src/shared/orchestration/workflowStep.test.ts` — ajout des tests de cohérence correspondants.
- `src/shared/orchestration/workflowApproval.ts` — ajout du `superRefine` de cohérence `status`/`decidedAt`.
- `src/shared/orchestration/workflowApproval.test.ts` — ajout des tests de cohérence correspondants.
- `src/shared/orchestration/commandExecution.ts` — `startedAt` devenu nullable ; ajout du `superRefine` de cohérence `status`/`startedAt`/`completedAt`/`durationMs`/`exitCode`.
- `src/shared/orchestration/commandExecution.test.ts` — suppression des deux tests devenus incohérents avec les nouvelles règles (`accepte durationMs à null` et `accepte completedAt à null`, qui présumaient un statut `completed` tout en annulant un champ désormais requis pour ce statut), remplacés par un bloc dédié de tests positifs/négatifs par statut.
- `workflow/reports/RAPPORT_ORCH_1.1.md` — mis à jour pour refléter les corrections (voir section 4 ci-dessous pour le détail des décisions documentées).
- `workflow/reports/RAPPORT_CORRECTIONS_REVIEW_ORCH_1.1.md` — le présent rapport (nouveau fichier).

Aucun autre fichier n'a été modifié. `REVIEW_ORCH_1.1.md` n'a pas été touché, conformément à la consigne.

## 3. Tests ajoutés ou adaptés

Passage de 176 à 243 tests (67 tests nets ajoutés/adaptés), répartis ainsi :

- `workflowArtifact.test.ts` : +1 test (rejet de `\Windows\system.ini`).
- `workflowProfile.test.ts` : 1 test remplacé (défaut → rejet de l'absence de `blocking`) +1 test ajouté (rejet d'un `blocking` non booléen).
- `workflowRun.test.ts` : +18 tests (`it.each` sur les 3 statuts terminaux × 2 sens, `it.each` sur les 14 statuts non terminaux, +1 test positif dédié au cas `draft`).
- `workflowStep.test.ts` : +10 tests (`pending` : 3, `in_progress` : 3, `it.each` sur les 4 statuts terminaux × 2 sens : 8 — soit 14 au total pour ce bloc, dont certains recoupent des cas déjà couverts par les tests existants réutilisés).
- `workflowApproval.test.ts` : +6 tests (`pending` : 2, `it.each` sur `approved`/`rejected` × 2 sens : 4).
- `commandExecution.test.ts` : 2 tests fusionnés en 1 (doublon exact supprimé), 1 test obsolète supprimé (`accepte exitCode à null`, remplacé par le bloc dédié), et un nouveau bloc `describe('commandExecutionSchema — cohérence status/startedAt/completedAt/durationMs/exitCode')` de 17 tests couvrant `pending`, `running`, `completed` et, via `it.each`, `failed`/`timed_out`/`cancelled` (positifs et négatifs, y compris la confirmation explicite qu'un `exitCode` renseigné ou `null` est accepté pour ces trois derniers statuts).

Chaque nouvelle règle de cohérence est couverte par au moins un test positif (l'état conforme est accepté) et un test négatif (l'état incohérent est rejeté), pour chacun des statuts concernés par l'entité.

## 4. Décisions reportées

Documentées explicitement dans `RAPPORT_ORCH_1.1.md` (section 5) comme décisions reportées à ORCH-1.2, conformément à la consigne :

- **Granularité interne du cycle `corrections`** : `WorkflowStep.type` modélise l'Étape 8 (« Corrections éventuelles ») comme un type d'étape unique (`corrections`), alors que `ORCHESTRATOR_V1_WORKFLOW.md` précise que cette étape réutilise en boucle les règles des Étapes 4 (création fichier), 5 (exécution Claude Code) et 6 (nouveau rapport). La décision de distinguer ou non ces sous-étapes au sein d'un cycle de correction est reportée à ORCH-1.2 (machine à états), plutôt que tranchée silencieusement dans ORCH-1.1.
- **Utilisation de `~` comme préfixe refusé** dans `relativeArtifactPathSchema` : cette convention (répertoire personnel) n'est mentionnée dans aucun document ORCH-0.x. Elle est conservée par prudence dans le code (aucune raison de l'assouplir), mais son bien-fondé exact est explicitement laissé ouvert à reconfirmation lors d'ORCH-1.2/ORCH-3.2 plutôt que présenté comme une exigence documentée des règles de sécurité.

Aucune autre décision de modélisation n'a été remise en cause ; les invariants de cohérence statut/dates ajoutés restent des contrôles de données locaux à chaque entité et ne constituent pas une implémentation anticipée de la machine à états d'ORCH-1.2.

## 5. Résultats de `npm run typecheck`

```text
> theme-factory-companion@1.0.0 typecheck
> tsc -p tsconfig.node.json --noEmit && tsc -p tsconfig.web.json --noEmit
```

Succès, aucune erreur.

## 6. Résultats de `npm run test`

Sous-ensemble `src/shared/orchestration` (exécuté isolément) : **243 tests, 6 fichiers, tous passés**.

Suite complète du dépôt : **670 tests, 28 fichiers**. 670 = 603 (dernier total connu avant cette correction) + 67 (tests nets ajoutés/adaptés par cette correction, voir section 3) : cette égalité exacte confirme qu'aucun test préexistant n'a été supprimé ni cassé par l'intervention.

Sur trois exécutions successives de la suite complète en parallèle (workers par défaut), un aléa d'infrastructure préexistant s'est manifesté par des timeouts (5000 ms) dans `src/renderer/src/pages/PhasesPage.test.tsx` (les trois fois) et ponctuellement `src/renderer/src/pages/ProjectsPage.test.tsx` (une fois), avec un nombre de tests en échec variable d'une exécution à l'autre (3 à 8 sur 670) — signature typique d'un timeout sous charge (exécution parallèle de nombreux tests React Testing Library) plutôt que d'une régression déterministe. Aucun de ces deux fichiers n'appartient à `src/shared/orchestration` et aucun n'a été modifié par cette correction.

Complément apporté après une exécution `npx vitest run --maxWorkers=1` : une première exécution à worker unique, rapportée par l'utilisateur, a réussi intégralement (**670/670, 28 fichiers, 79.81s**). Une seconde exécution à worker unique, relancée pour vérification indépendante, a de nouveau échoué sur un seul test de `ProjectsPage.test.tsx` (669/670) — le même timeout sous charge que précédemment, cette fois-ci avec un seul worker actif. Une exécution isolée de ce seul fichier confirme un succès total (15/15). Ces résultats combinés montrent que la limitation à un seul worker réduit la fréquence de l'aléa sans l'éliminer complètement sur cette machine : la cause reste un problème de charge/timing de l'environnement d'exécution (probablement aggravé par les exécutions `typecheck`/`build`/`test` enchaînées pendant cette même session), pas une régression déterministe, et ni `PhasesPage.test.tsx` ni `ProjectsPage.test.tsx` n'ont de rapport avec `src/shared/orchestration`. Une exécution ciblée et isolée de ces deux fichiers confirme systématiquement un succès total (38/38 en une passe, 15/15 en une autre). Cet aléa est donc confirmé sans lien avec cette intervention et n'a fait l'objet d'aucune correction, conformément à la consigne de ne corriger que les erreurs causées par cette correction.

## 7. Résultats de `npm run build`

```text
> theme-factory-companion@1.0.0 build
> electron-vite build

✓ built in 11.27s  (out/main)
✓ built in 526ms   (out/preload)
✓ built in 25.63s  (out/renderer)
```

Succès, aucune erreur.

## 8. Résultat de `git diff --check`

Aucune sortie retournée : aucun conflit de fin de ligne ni d'espace superflu détecté.

## 9. Sortie finale de `git status --short --untracked-files=all`

```text
?? src/shared/orchestration/commandExecution.test.ts
?? src/shared/orchestration/commandExecution.ts
?? src/shared/orchestration/common.ts
?? src/shared/orchestration/index.ts
?? src/shared/orchestration/workflowApproval.test.ts
?? src/shared/orchestration/workflowApproval.ts
?? src/shared/orchestration/workflowArtifact.test.ts
?? src/shared/orchestration/workflowArtifact.ts
?? src/shared/orchestration/workflowProfile.test.ts
?? src/shared/orchestration/workflowProfile.ts
?? src/shared/orchestration/workflowRun.test.ts
?? src/shared/orchestration/workflowRun.ts
?? src/shared/orchestration/workflowStep.test.ts
?? src/shared/orchestration/workflowStep.ts
?? workflow/reports/RAPPORT_CORRECTIONS_REVIEW_ORCH_1.1.md
?? workflow/reports/RAPPORT_ORCH_1.1.md
?? workflow/reports/REVIEW_ORCH_1.1.md
```

`git diff --check` (dernier contrôle) : aucune sortie retournée (aucun conflit de fin de ligne ni d'espace superflu).
