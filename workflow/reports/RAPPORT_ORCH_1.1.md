# Rapport — ORCH-1.1 — Schémas partagés de l'orchestrateur

## 1. Résumé

Cette phase a créé les schémas Zod, types TypeScript inférés et tests unitaires des six entités V1 de l'orchestrateur (`WorkflowRun`, `WorkflowStep`, `WorkflowArtifact`, `WorkflowApproval`, `CommandExecution`, `WorkflowProfile`) sous `src/shared/orchestration/`, conformément à `ORCHESTRATOR_V1_SCOPE.md`, `ORCHESTRATOR_V1_WORKFLOW.md`, `ORCHESTRATOR_V1_ROADMAP.md` et aux règles de `ORCHESTRATOR_V1_SAFETY_RULES.md` / `ORCHESTRATOR_V1_SECURITY_MATRIX.md`. Aucune machine à états (ORCH-1.2) ni logique système ou métier d'exécution n'a été implémentée : uniquement des schémas de données sérialisables en JSON.

**Addendum** : ce rapport a été mis à jour suite à `REVIEW_ORCH_1.1.md`, qui a identifié 3 problèmes majeurs (validation de chemin incomplète, valeur par défaut masquant une donnée corrompue, absence de cohérence statut/dates). Les trois ont été corrigés dans `src/shared/orchestration/**` ; le détail exhaustif de l'intervention (fichiers modifiés, tests ajoutés/adaptés, décisions reportées) figure dans `workflow/reports/RAPPORT_CORRECTIONS_REVIEW_ORCH_1.1.md`. Les sections ci-dessous reflètent l'état corrigé.

## 2. Fichiers créés

- `src/shared/orchestration/common.ts` — helpers privés partagés (texte non vide, entier non négatif, validation de chemin relatif d'artefact), non exportés via `index.ts`.
- `src/shared/orchestration/workflowProfile.ts` — `validationCommandSchema`, `workflowProfileSchema`.
- `src/shared/orchestration/workflowProfile.test.ts`
- `src/shared/orchestration/workflowRun.ts` — `workflowRunStatusSchema`, `workflowRunSchema`.
- `src/shared/orchestration/workflowRun.test.ts`
- `src/shared/orchestration/workflowStep.ts` — `workflowStepTypeSchema`, `workflowStepStatusSchema`, `workflowStepSchema`.
- `src/shared/orchestration/workflowStep.test.ts`
- `src/shared/orchestration/workflowArtifact.ts` — `workflowArtifactTypeSchema`, `workflowArtifactSchema`.
- `src/shared/orchestration/workflowArtifact.test.ts`
- `src/shared/orchestration/workflowApproval.ts` — `workflowApprovalTypeSchema`, `workflowApprovalStatusSchema`, `workflowApprovalSchema`.
- `src/shared/orchestration/workflowApproval.test.ts`
- `src/shared/orchestration/commandExecution.ts` — `commandExecutionStatusSchema`, `commandExecutionSchema`.
- `src/shared/orchestration/commandExecution.test.ts`
- `src/shared/orchestration/index.ts` — API publique (schémas, enums, types ; `common.ts` volontairement exclu).
- `workflow/reports/RAPPORT_ORCH_1.1.md` — le présent rapport.

## 3. Fichiers modifiés

Aucun fichier existant modifié. Tous les fichiers ci-dessus sont nouveaux.

## 4. Schémas et enums ajoutés

- `WORKFLOW_RUN_STATUSES` / `workflowRunStatusSchema` — 17 valeurs reprenant les états fonctionnels indicatifs de `ORCHESTRATOR_V1_WORKFLOW.md` (section 5) : `draft`, `prompt_ready`, `awaiting_approval`, `implementation_in_progress`, `implementation_completed`, `report_available`, `review_required`, `corrections_required`, `validations_in_progress`, `validation_failed`, `manual_validation_required`, `ready_to_commit`, `committed`, `ready_to_push`, `completed`, `cancelled`, `failed`.
- `workflowRunSchema` — `id`, `projectId`, `phaseId`, `profileId`, `profileFingerprint`, `status`, `currentStepId` (nullable), `startedAt`, `completedAt` (nullable), `createdAt`, `updatedAt`.
- `WORKFLOW_STEP_TYPES` / `workflowStepTypeSchema` — les 15 étapes obligatoires de `ORCHESTRATOR_V1_WORKFLOW.md` (section 3).
- `WORKFLOW_STEP_STATUSES` / `workflowStepStatusSchema` — `pending`, `in_progress`, `completed`, `failed`, `cancelled`, `skipped`.
- `workflowStepSchema` — `id`, `workflowRunId`, `type`, `status`, `position` (entier non négatif), `startedAt`/`completedAt` (nullable), `createdAt`, `updatedAt`.
- `WORKFLOW_ARTIFACT_TYPES` / `workflowArtifactTypeSchema` — `phase_prompt`, `phase_report`, `review_prompt`, `review_report`, `correction_prompt`, `correction_report`, `validation_report` (artefacts Markdown de la section 9 de `ORCHESTRATOR_V1_SCOPE.md`).
- `workflowArtifactSchema` — `id`, `workflowRunId`, `workflowStepId` (nullable), `type`, `relativePath` (validé, relatif, sans traversée), `createdAt` (pas de `updatedAt`, voir section 5).
- `WORKFLOW_APPROVAL_TYPES` / `workflowApprovalTypeSchema` — `phase_prompt`, `correction_prompt`, `manual_validation`, `commit`, `push` (section 18 des règles de sécurité).
- `WORKFLOW_APPROVAL_STATUSES` / `workflowApprovalStatusSchema` — `pending`, `approved`, `rejected`.
- `workflowApprovalSchema` — `id`, `workflowRunId`, `workflowStepId` (nullable), `type`, `status`, `requestedAt`, `decidedAt` (nullable), `createdAt`, `updatedAt`.
- `COMMAND_EXECUTION_STATUSES` / `commandExecutionStatusSchema` — `pending`, `running`, `completed`, `failed`, `timed_out`, `cancelled`.
- `commandExecutionSchema` — `id`, `workflowRunId`, `workflowStepId` (nullable), `executable`, `args` (tableau, séparé de `executable`), `cwd`, `status`, `exitCode` (nullable), `stdout`, `stderr`, `stdoutTruncated`, `stderrTruncated`, `startedAt`, `completedAt` (nullable), `durationMs` (nullable, entier non négatif), `createdAt`, `updatedAt`.
- `validationCommandSchema` — `name`, `command`, `args` (tableau), `blocking` (booléen, obligatoire, sans valeur par défaut).
- `workflowProfileSchema` — `id`, `name`, `version`, `validationCommands` (tableau de `validationCommandSchema`), `createdAt`, `updatedAt`. Aucun champ ne permet de définir une commande Git ou Claude Code interne.

Tous les identifiants sont validés par `z.uuid()`, toutes les dates persistées par `z.iso.datetime()`, tous les objets sont `.strict()` (rejet de tout champ inconnu), aucun `any` n'est utilisé.

## 5. Décisions de modélisation

- **`WorkflowRun.status`** reprend telle quelle la liste des « états fonctionnels indicatifs » de `ORCHESTRATOR_V1_WORKFLOW.md` (section 5), qui précise explicitement ne pas figer le modèle TypeScript définitif. Cette énumération ne définit ici aucune règle de transition entre états ; elle reste un simple vocabulaire de valeurs, la machine à états proprement dite étant hors périmètre (ORCH-1.2).
- **`WorkflowStep.type`** reprend les 15 étapes obligatoires du document de workflow, dans l'ordre où elles y sont décrites. Le champ `position` (entier non négatif) porte l'ordre réel d'une exécution donnée ; l'ordre de déclaration de l'enum ne fait pas foi.
- **`WorkflowRun.phaseId`** référence l'entité `Phase` déjà existante (`src/shared/schemas/phase.ts`), c'est-à-dire la phase de projet sélectionnée à l'Étape 1 du workflow (« sélectionner un projet, sélectionner une phase »), et non une sous-phase numérotée de la roadmap de l'orchestrateur lui-même (ORCH-x.x), qui n'est pas une entité persistée.
- **`WorkflowRun.profileFingerprint`** (chaîne non vide) matérialise l'exigence de la section 6 des règles de sécurité : « une empreinte (ou version) du profil actif est capturée et conservée au démarrage de chaque workflow ». Ce champ est distinct de `WorkflowProfile.version` (identifiant de version déclaré par le profil lui-même) : la comparaison entre empreinte capturée et profil courant, qui doit bloquer le workflow en cas de divergence, est une logique d'exécution hors périmètre ORCH-1.1 — seul le champ de stockage est défini ici.
- **`CommandExecution.status`** utilise deux valeurs distinctes pour les interruptions (`timed_out`, `cancelled`) plutôt qu'un seul statut générique « interrompu », afin de conserver la cause de l'interruption tout en respectant le principe de la section 12 des règles de sécurité (statut distinct d'un succès/échec classique) : les deux restent séparées de `completed`/`failed`.
- **`WorkflowArtifact` n'a pas de champ `updatedAt`** : conformément à la section 5 des règles de sécurité (interdiction d'écraser un prompt, plus généralement aucun écrasement silencieux), un artefact n'est jamais modifié après création ; toute nouvelle version est un nouvel artefact avec un nouveau `relativePath`. Un test dédié vérifie qu'un `updatedAt` fourni est rejeté (`.strict()`).
- **`ValidationCommand.blocking` est obligatoire, sans valeur par défaut** (corrigé suite à `REVIEW_ORCH_1.1.md`, problème majeur 10.2 : un `z.boolean().default(true)` sur ce schéma de lecture aurait pu masquer silencieusement une commande de validation persistée de façon incomplète ou corrompue). La règle de la section 7 des règles de sécurité (« un code de sortie non nul est considéré comme un échec par défaut, sauf exception explicitement documentée dans le profil ») reste respectée : c'est à l'appelant de fournir explicitement `blocking: false` pour une commande non bloquante, jamais une valeur implicite du schéma.
- **`WorkflowProfile` ne contient aucun champ Git ou Claude Code** : ce n'est pas une simple omission mais une décision de modélisation directe de la section 6 des règles de sécurité (les commandes internes proviennent exclusivement d'une liste blanche interne, jamais du profil). Un test vérifie explicitement l'ensemble exact des clés du schéma.
- **Aucun schéma de création/mise à jour partiel (`createXSchema`/`updateXSchema`)** n'a été ajouté pour ces six entités, contrairement aux schémas existants (`task.ts`, `phase.ts`, `project.ts`). Ces variantes appartiennent aux futures phases de persistance et de logique métier (repositories ORCH-2.2, machine à états ORCH-1.2) ; ORCH-1.1 se limite au schéma de lecture complet de chaque entité, conformément à la consigne « ne pas ajouter de logique système ou métier d'exécution ».
- **`CommandExecution.cwd` et `WorkflowArtifact.relativePath`** : `cwd` reste une chaîne non vide générique (le répertoire de travail réel, absolu, du dépôt validé — sa validation d'appartenance au dépôt est une responsabilité d'exécution, hors périmètre schéma), tandis que `relativePath` est strictement contraint (relatif, sans traversée), car c'est un chemin destiné à être combiné à la racine du dépôt déclaré (section 4 des règles de sécurité).
- **`relativeArtifactPathSchema` rejette tout chemin commençant par `/` ou `\`, y compris un backslash Windows unique sans lettre de lecteur** (corrigé suite à `REVIEW_ORCH_1.1.md`, problème majeur 10.1 : la version initiale ne couvrait que l'UNC à double backslash, pas le cas à backslash unique de type `\Windows\system.ini`). La détection tient désormais en une seule expression (`/^([\\/]|[a-zA-Z]:[\\/]|~)/`) : tout chemin commençant par un séparateur unique (`/` ou `\`, ce qui couvre à la fois l'absolu Unix, l'absolu Windows relatif au lecteur courant et l'UNC), par une lettre de lecteur, ou par `~`, est refusé.
- **Cohérence statut/dates/`exitCode`, ajoutée via `superRefine`, sans machine à états** (corrigé suite à `REVIEW_ORCH_1.1.md`, problème majeur 10.3) : `WorkflowRun`, `WorkflowStep`, `WorkflowApproval` et `CommandExecution` portent désormais chacun une validation croisée entre leur `status` et leurs champs nullable liés (dates, durée, code de sortie). Cette validation reste un simple contrôle de cohérence de données (« si le statut est X, alors tel champ doit/ne doit pas être renseigné ») et ne définit aucune règle de transition entre statuts : elle n'anticipe pas ORCH-1.2, elle empêche seulement qu'un objet dans un état manifestement incohérent (ex. `completed` avec `completedAt: null`) soit accepté par validation. Le détail des règles par entité figure dans le code (commentaires au-dessus de chaque `superRefine`) et dans `RAPPORT_CORRECTIONS_REVIEW_ORCH_1.1.md`.
  - Conséquence directe pour `CommandExecution.startedAt` : ce champ, auparavant toujours obligatoire, est devenu nullable, car le statut `pending` (exécution pas encore lancée) exige désormais `startedAt: null`.
- **Décisions reportées à ORCH-1.2 (documentées explicitement suite à la review)** :
  - la granularité interne du cycle de corrections (Étape 8 de `ORCHESTRATOR_V1_WORKFLOW.md`) : `WorkflowStep.type` modélise `corrections` comme un type d'étape unique, alors que le document de workflow précise que cette étape réutilise en boucle les règles des Étapes 4 (création fichier), 5 (exécution Claude Code) et 6 (nouveau rapport). Distinguer ces sous-étapes au sein d'un cycle de correction, si nécessaire, est reporté à ORCH-1.2 ;
  - l'utilisation de `~` comme préfixe de chemin refusé par `relativeArtifactPathSchema` : cette convention (répertoire personnel) n'est mentionnée dans aucun document ORCH-0.x ; elle est conservée par prudence mais son bien-fondé est à reconfirmer lors d'ORCH-1.2/ORCH-3.2 (services de fichiers).

## 6. Tests ajoutés

243 tests répartis sur 6 fichiers (un fichier de test par entité/module ; 176 tests initiaux + 67 tests ajoutés ou adaptés lors de la correction suite à `REVIEW_ORCH_1.1.md`, voir `RAPPORT_CORRECTIONS_REVIEW_ORCH_1.1.md` pour le détail), couvrant pour chaque entité :

- un objet valide accepté ;
- chaque champ obligatoire (absence → rejet) ;
- les UUID invalides (`id` et toutes les références) ;
- les dates ISO invalides (`createdAt`, `updatedAt`, et les dates spécifiques à chaque entité) ;
- les valeurs d'enum invalides (statuts et types) ;
- les chaînes obligatoires vides ;
- les nombres négatifs et non entiers interdits (`position`, `durationMs`, `exitCode`) ;
- les champs nullable/optionnels pertinents (`currentStepId`, `completedAt`, `workflowStepId`, `exitCode`, `durationMs`, `startedAt`/`completedAt` d'étape, `decidedAt`) ;
- le rejet de tout champ inconnu (`.strict()`).

Tests spécifiques supplémentaires :

- `commandExecution.test.ts` / `workflowProfile.test.ts` : vérifient que `executable`/`command` et `args` restent deux champs strictement séparés (jamais une chaîne concaténée), y compris le rejet d'un `args` fourni comme chaîne.
- `workflowProfile.test.ts` : rejet d'un profil dont une commande de validation imbriquée est invalide ; vérification explicite que l'ensemble des clés du schéma ne contient aucun champ permettant de définir une commande Git ou Claude Code interne ; rejet de l'absence du champ `blocking` (plus de valeur par défaut) et rejet d'un `blocking` non booléen.
- `workflowArtifact.test.ts` : rejet des chemins absolus Unix (`/etc/passwd`), Windows avec lettre de lecteur (`C:\Windows\...`), Windows à backslash unique sans lettre de lecteur (`\Windows\system.ini`), UNC (`\\server\share\...`), et des traversées `..` en début ou au milieu du chemin ; acceptation d'un chemin relatif imbriqué valide ; rejet d'un `updatedAt` fourni (artefacts non modifiables).
- `workflowApproval.test.ts` / `commandExecution.test.ts` : vérification que les statuts sont strictement limités aux valeurs prévues via `it.each` sur les constantes exportées, et rejet explicite de valeurs plausibles mais non prévues (`auto_approved`).
- `workflowRun.test.ts` : pour chaque statut terminal (`completed`, `cancelled`, `failed`), rejet de `completedAt: null` et acceptation de `completedAt` renseigné ; pour chaque statut non terminal (les 14 autres), rejet de `completedAt` renseigné et acceptation de `completedAt: null`.
- `workflowStep.test.ts` : pour `pending`, rejet de `startedAt` ou `completedAt` renseigné, acceptation des deux à `null` ; pour `in_progress`, rejet de `startedAt: null` et de `completedAt` renseigné, acceptation de `startedAt` renseigné avec `completedAt: null` ; pour `completed`/`failed`/`cancelled`/`skipped`, rejet de `completedAt: null`, acceptation de `completedAt` renseigné.
- `workflowApproval.test.ts` : pour `pending`, rejet de `decidedAt` renseigné, acceptation de `decidedAt: null` ; pour `approved`/`rejected`, rejet de `decidedAt: null`, acceptation de `decidedAt` renseigné.
- `commandExecution.test.ts` : pour `pending`, rejet de `startedAt` ou `exitCode` renseigné, acceptation des quatre champs (`startedAt`, `completedAt`, `durationMs`, `exitCode`) à `null` ; pour `running`, rejet de `startedAt: null` et de `completedAt` renseigné, acceptation de `startedAt` renseigné avec les trois autres à `null` ; pour `completed`, rejet d'un `exitCode` différent de `0` ou à `null`, et rejet de `completedAt`/`durationMs` à `null` ; pour `failed`/`timed_out`/`cancelled`, rejet de `startedAt`/`completedAt`/`durationMs` à `null`, mais acceptation aussi bien d'un `exitCode` à `null` que d'un `exitCode` renseigné (127) — confirmant qu'aucune contrainte n'est imposée sur sa valeur pour ces trois statuts.

## 7. Résultats de `npm run typecheck`

```text
> theme-factory-companion@1.0.0 typecheck
> tsc -p tsconfig.node.json --noEmit && tsc -p tsconfig.web.json --noEmit
```

Succès, aucune erreur.

## 8. Résultats de `npm run test`

Sous-ensemble `src/shared/orchestration` (exécuté isolément) : **243 tests, 6 fichiers, tous passés** (176 initiaux + 67 issus de la correction, voir `RAPPORT_CORRECTIONS_REVIEW_ORCH_1.1.md`).

Suite complète du dépôt : **670 tests, 28 fichiers** (603 + 67 nouveaux tests, exactement la différence attendue — aucune autre régression). Sur plusieurs exécutions de la suite complète, seuls des tests préexistants de `src/renderer/src/pages/PhasesPage.test.tsx` (et ponctuellement `ProjectsPage.test.tsx`) échouent par timeout sous charge ; ni l'un ni l'autre n'a été modifié par cette phase ou sa correction, et leur ré-exécution isolée confirme un succès total (38/38). Voir `RAPPORT_CORRECTIONS_REVIEW_ORCH_1.1.md`, section 6, pour le détail complet de cet aléa d'infrastructure.

## 9. Résultats de `npm run build`

```text
> theme-factory-companion@1.0.0 build
> electron-vite build

✓ built in 11.27s  (out/main)
✓ built in 526ms   (out/preload)
✓ built in 25.63s  (out/renderer)
```

Succès, aucune erreur.

## 10. Résultat de `git diff --check`

Aucune sortie retournée : aucun conflit de fin de ligne ni d'espace superflu détecté.

## 11. Confirmation du périmètre

- Seuls des fichiers sous `src/shared/orchestration/**` et `workflow/reports/RAPPORT_ORCH_1.1.md`/`workflow/reports/RAPPORT_CORRECTIONS_REVIEW_ORCH_1.1.md` ont été créés ou modifiés (création initiale, puis correction suite à `REVIEW_ORCH_1.1.md`).
- `REVIEW_ORCH_1.1.md` n'a pas été modifié.
- Aucun fichier sous `src/main`, `src/preload` ou `src/renderer` n'a été modifié.
- Aucune migration SQLite modifiée ou créée.
- Aucun canal IPC modifié.
- `package.json` non modifié ; aucune dépendance installée.
- Aucun document `ORCH-0.x` modifié.
- Aucun schéma existant (`src/shared/schemas/*`) modifié.
- Aucun `git add`, `git commit` ou `git push` exécuté.

## 12. Sortie finale de `git status --short --untracked-files=all`

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

## 13. Risques ou points ouverts

- La comparaison effective entre `WorkflowRun.profileFingerprint` capturé et l'état courant du profil (pour détecter une modification en cours de workflow, section 6 des règles de sécurité) n'est pas implémentée : seul le champ de stockage existe. Cette logique appartient à une phase d'exécution ultérieure.
- `CommandExecution.cwd` n'est pas validé comme appartenant au dépôt déclaré du projet (contrairement à `WorkflowArtifact.relativePath`) : cette vérification dépend du contexte d'exécution réel (racine de dépôt du projet actif), non disponible au niveau d'un schéma de données isolé — à traiter lors du command runner (ORCH-4.1).
- Le nombre maximal de cycles de correction (section 8 du workflow, section 23 des règles de sécurité) n'est pas modélisé dans `WorkflowRun`/`WorkflowStep` : sa valeur n'est pas encore fixée par la documentation (laissée ouverte jusqu'à ORCH-1.2 au plus tard) et son application est une logique de transition, hors périmètre schéma.
- La granularité interne du cycle `corrections` (`WorkflowStep.type`) et le statut du préfixe `~` dans `relativeArtifactPathSchema` sont désormais explicitement documentés comme décisions reportées à ORCH-1.2 (voir section 5) plutôt que des choix silencieux.
- Les invariants de cohérence statut/dates ajoutés (section 5) restent des contrôles de données locaux à chaque entité ; ils ne remplacent pas la machine à états d'ORCH-1.2, qui devra définir les transitions autorisées entre statuts (au-delà du simple « tel champ est-il cohérent avec le statut courant »).
- Un aléa d'infrastructure du pool de workers Vitest (timeouts sous charge, indépendants de cette phase) a de nouveau été observé lors d'une exécution de la suite complète sur des fichiers de tests renderer préexistants (`PhasesPage.test.tsx`, `ProjectsPage.test.tsx`), non modifiés par cette phase ni par sa correction ; leur ré-exécution isolée confirme un succès total (38/38). Voir section 8 pour le détail.
