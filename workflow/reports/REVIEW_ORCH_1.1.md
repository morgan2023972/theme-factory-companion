# Review — ORCH-1.1 — Schémas partagés de l'orchestrateur

## 1. Verdict

**CORRECTIONS REQUISES**

## 2. Résumé de la review

Les six entités demandées (`WorkflowRun`, `WorkflowStep`, `WorkflowArtifact`, `WorkflowApproval`, `CommandExecution`, `WorkflowProfile`) sont toutes présentes sous `src/shared/orchestration/`, modélisées en Zod avec types inférés, `.strict()`, UUID, dates ISO, entiers non négatifs et séparation exécutable/arguments. Le périmètre est respecté : aucune machine à états, aucune logique système, aucun fichier hors `src/shared/orchestration/**` et `workflow/reports/RAPPORT_ORCH_1.1.md` n'a été touché. `npm run typecheck`, `npm run test` (603/603, 28 fichiers, aucune erreur), `npm run build` et `git diff --check` sont tous au vert.

La review relève cependant **3 problèmes majeurs** non bloquants pour le build/les tests mais correspondant directement à des critères explicitement demandés dans la review (chemin absolu contournable, valeur par défaut pouvant masquer une donnée corrompue, statuts et dates incohérents représentables) et non documentés comme limitations connues dans `RAPPORT_ORCH_1.1.md`. Aucun de ces problèmes n'empêche la phase de fonctionner, mais ils justifient une correction ou, a minima, une documentation explicite avant de considérer la phase définitivement close.

## 3. Conformité fonctionnelle

- Les six entités correspondent aux besoins fonctionnels de `ORCHESTRATOR_V1_SCOPE.md` (section 9, artefacts) et `ORCHESTRATOR_V1_WORKFLOW.md` (structure des étapes, section 2-3).
- `WORKFLOW_RUN_STATUSES` (17 valeurs) reproduit exactement la liste des « états fonctionnels indicatifs » de `ORCHESTRATOR_V1_WORKFLOW.md` section 5 — vérifié terme à terme, aucun état manquant ni ajouté.
- `WORKFLOW_STEP_TYPES` (15 valeurs) reproduit exactement les 15 étapes obligatoires de la section 3 du même document, dans l'ordre où elles y sont décrites.
- `WORKFLOW_ARTIFACT_TYPES` (7 valeurs) correspond aux artefacts Markdown de la section 9 de `ORCHESTRATOR_V1_SCOPE.md` ; le hash de commit et le résultat du push en sont exclus à raison (ce ne sont pas des fichiers).
- `WORKFLOW_APPROVAL_TYPES` (5 valeurs) correspond exactement aux points d'approbation de la section 18 des règles de sécurité.
- `WorkflowRun.phaseId` référence l'entité `Phase` existante (`src/shared/schemas/phase.ts`), cohérent avec « sélectionner un projet, sélectionner une phase » (ORCH_V1_SCOPE section 3).
- Aucune règle de transition d'état (ORCH-1.2) n'a été implémentée, conformément à la roadmap.

Voir cependant point 5.3 et 9.3 ci-dessous pour une nuance sur `WorkflowStep.type` et la couverture réelle du couple statut/dates.

## 4. Conformité sécurité et périmètre

- `shell: false`/séparation commande-arguments : `executable`/`command` et `args` sont bien deux champs distincts dans `commandExecutionSchema` et `validationCommandSchema` (jamais une chaîne concaténée), avec test dédié dans les deux fichiers.
- `WorkflowProfile` ne contient aucun champ permettant de définir une commande Git ou Claude Code interne (vérifié par lecture du schéma et par le test `ne permet pas de définir une commande Git ou Claude Code interne`, qui contrôle l'ensemble exact des clés).
- Aucun secret n'est modélisé nulle part (pas de champ token/clé).
- `relativeArtifactPathSchema` (voir `common.ts`) rejette les chemins absolus Unix, UNC, drive-letter Windows et les traversées `..` — **à l'exception d'un cas non couvert, voir 9.1 (majeur)**.
- Périmètre respecté : seuls des fichiers sous `src/shared/orchestration/**` et le rapport de phase existent en untracked ; aucun fichier sous `src/main`, `src/preload`, `src/renderer`, aucune migration, aucun `package.json`, aucun document ORCH-0.x, aucun schéma existant (`src/shared/schemas/*`) n'a été modifié.
- Aucune machine à états, aucune logique d'exécution, aucun accès disque/réseau/processus dans les fichiers relus.

## 5. Analyse des schémas

- Tous les identifiants sont `z.uuid()`, toutes les dates persistées `z.iso.datetime()`, tous les objets `.strict()` (rejet des champs inconnus vérifié par test dans les six fichiers). Aucun `any` (vérifié par recherche exhaustive dans `src/shared/orchestration/*.ts` hors tests : aucune occurrence).
- Tous les types sont exportés via `z.infer`, cohérent avec la convention du dossier `src/shared/schemas`.
- `nonEmptyTrimmedText`/`nonNegativeInt`/`relativeArtifactPathSchema` sont correctement privés à `common.ts`, non réexportés par `index.ts`.
- Les schémas restent strictement des littéraux JSON-sérialisables (chaînes, nombres, booléens, `null`, tableaux, objets imbriqués) : aucune date native `Date`, aucune fonction, aucun objet non sérialisable.
- **5.1 (majeur)** — `validationCommandSchema.blocking` porte `z.boolean().default(true)` (`workflowProfile.ts:28`) au sein même du schéma « de lecture » de l'entité (il n'existe pas de schéma de création séparé pour cette phase). Dans tous les schémas existants du dépôt (`task.ts`, `phase.ts`, `project.ts`), les valeurs par défaut Zod n'apparaissent que dans les schémas `createXSchema` dédiés ; le schéma de lecture (`taskSchema`, `phaseSchema`, `projectSchema`) reste toujours strictement fidèle à ce qui est réellement stocké, sans normalisation implicite. Ici, un enregistrement persistant réellement corrompu ou partiellement migré (ex. colonne `blocking` absente suite à un bug) serait accepté silencieusement avec `blocking: true` au lieu d'être rejeté comme donnée invalide — c'est exactement le cas « valeur par défaut masquant une erreur » à rechercher explicitement dans cette review.
  - **Impact** : une incohérence de persistance sur `blocking` ne serait jamais détectée par validation, et pourrait involontairement rendre bloquante (ou non bloquante) une commande de validation du profil sans que personne ne s'en aperçoive.
  - **Correction minimale recommandée** : retirer `.default(true)` de `validationCommandSchema` (rendre `blocking` obligatoire dans le schéma de lecture), et réserver la valeur par défaut à un futur schéma de création dédié (`createValidationCommandSchema`), à l'image de la convention déjà en place pour `phase.ts`/`project.ts`.
- **5.2 (majeur)** — Absence de cohérence croisée statut ↔ dates/`exitCode` dans les quatre entités qui en portent (`WorkflowRun`, `WorkflowStep`, `WorkflowApproval`, `CommandExecution`). Aucun `.refine()` n'empêche par exemple :
  - `workflowRunSchema` : `status: 'completed'` avec `completedAt: null`, ou `status: 'draft'` avec `completedAt` renseigné ;
  - `workflowStepSchema` : `status: 'completed'` avec `startedAt: null` et `completedAt: null` ;
  - `workflowApprovalSchema` : `status: 'approved'` ou `'rejected'` avec `decidedAt: null` ;
  - `commandExecutionSchema` : `status: 'completed'` avec `exitCode: null`, ou `status: 'pending'` avec `exitCode` renseigné.
  - Ces combinaisons sont acceptées par `safeParse` (vérifié manuellement : aucun test des six fichiers ne les rejette, voir section 6). C'est exactement la « possibilité de représenter un état invalide évident » et la « relation incohérente entre dates et statuts » demandées explicitement en critères de review.
  - **Impact** : un futur repository ou une future machine à états (ORCH-1.2) pourrait persister ou lire des états incohérents sans qu'aucune validation ne les intercepte, repoussant la détection d'un bug de logique à l'exécution plutôt qu'à la validation des données.
  - **Correction minimale recommandée** : soit ajouter un `.refine()` léger par entité liant statut terminal ⇒ date de fin non nulle (et `exitCode` non nul pour `CommandExecution`), soit, si cela est jugé prématuré avant ORCH-1.2, documenter explicitement ce choix comme limitation connue dans `RAPPORT_ORCH_1.1.md` (ce qui n'est actuellement pas fait, voir section 8).
- **5.3 (mineur)** — `WorkflowStep.type` modélise `corrections` (Étape 8 du workflow) comme un type d'étape unique, alors que `ORCHESTRATOR_V1_WORKFLOW.md` précise que cette étape réutilise « mêmes règles qu'à l'Étape 4 » (création fichier), « mêmes règles qu'à l'Étape 5 » (exécution Claude Code) et « mêmes règles qu'à l'Étape 6 » (nouveau rapport) en boucle. Le schéma actuel ne permet donc pas de distinguer, au sein d'un cycle de correction, la sous-étape en cours (création du prompt de correction vs exécution vs rapport) via `WorkflowStep.type` seul. Ce n'est pas incorrect, mais c'est une simplification non documentée dans les décisions de modélisation du rapport.
- **5.4 (mineur)** — `hasAbsoluteLikePrefix` (`common.ts:19-20`) traite également un chemin commençant par `~` comme absolu-like ; cette convention (expansion de répertoire personnel) n'est mentionnée nulle part dans `ORCHESTRATOR_V1_SAFETY_RULES.md`/`ORCHESTRATOR_V1_SECURITY_MATRIX.md`. Sans danger, mais une extension non demandée et non documentée.
- **5.5 (mineur)** — `args: z.array(z.string())` (dans `commandExecutionSchema` et `validationCommandSchema`) n'interdit pas les éléments chaîne vide (`['']`). Non exigé par le prompt, mais laisse passer un argument vraisemblablement erroné.

## 6. Analyse des tests

176 tests, 6 fichiers, tous passés (vérifié à nouveau lors de cette review). La couverture par champ (UUID invalide, date invalide, enum invalide, chaîne vide, nombre négatif/non entier, champ inconnu, champ obligatoire absent, nullable) est systématique et cohérente avec la convention de `task.test.ts`/`phase.test.ts`/`project.test.ts`.

Tests spécifiques de qualité notable :
- Rejet des chemins absolus Unix/Windows/UNC et des traversées `..` (début et milieu) dans `workflowArtifact.test.ts` — bonne couverture, mais **ne teste pas le cas du chemin à backslash unique non-UNC** (voir 9.1), qui est justement le cas qui passe à travers.
- Vérification explicite de l'ensemble des clés de `workflowProfileSchema` pour prouver l'absence de champ Git/Claude Code (`workflowProfile.test.ts:124-129`) — bon réflexe de test « négatif » plutôt qu'une simple absence non vérifiée.
- Aucun test ne vérifie les combinaisons statut/dates incohérentes évoquées en 5.2 — la suite ne peut donc pas détecter une régression sur ce point tant qu'aucun `.refine()` n'existe.

**6.1 (mineur)** — `workflowApproval.test.ts:43-49` contient deux tests quasiment redondants (« refuse un statut inconnu (ex. "auto_approved") » et « refuse un statut inconnu quelconque ») qui vérifient la même chose (rejet d'une valeur d'enum invalide) sans ajouter de signal distinct l'un de l'autre ; le second est déjà couvert par la boucle `it.each` au-dessus. Non nuisible, mais un des deux pourrait être retiré sans perte de couverture.

## 7. Analyse des exports publics

`index.ts` exporte, pour chacune des six entités, exactement : la ou les constantes d'enum, le(s) schéma(s) Zod, le(s) type(s) inférés — rien de plus, rien de moins. `common.ts` (helpers internes : `nonEmptyTrimmedText`, `nonNegativeInt`, `relativeArtifactPathSchema`) est correctement exclu de l'API publique, conformément à l'intention documentée en tête de fichier. Aucun export manquant identifié parmi les six entités demandées ; aucun export superflu identifié.

## 8. Divergences avec le rapport de phase

- Le rapport (section 4, 5, 6) décrit fidèlement les champs, enums et tests réellement présents dans le code : aucune divergence factuelle relevée sur le contenu déclaré (comptage de 176 tests confirmé exact, six entités confirmées présentes, absence de champ Git/Claude Code confirmée).
- **Omission** : la section 13 (« Risques ou points ouverts ») du rapport ne mentionne ni le comportement de `blocking` par défaut (5.1), ni l'absence de cohérence statut/dates (5.2), ni la lacune de `relativeArtifactPathSchema` sur les chemins à backslash unique (9.1) — alors que ce sont des limites réelles et prévisibles du code livré, directement dans le champ des critères de review demandés explicitement pour cette phase. Le rapport présente ces zones comme non problématiques par leur silence, alors qu'elles méritaient au moins une mention en points ouverts.
- Les résultats `npm run typecheck`/`npm run test`/`npm run build`/`git diff --check` rapportés en sections 7 à 10 du rapport de phase sont cohérents avec ceux obtenus en review (build et typecheck identiques ; tests : 580/27 rapportés en fin de phase 1 contre 603/28 constatés ensuite et lors de cette review — écart cohérent avec l'ajout ultérieur du fichier `RAPPORT_ORCH_1.1.md` lui-même ne changeant pas le compte de tests ; l'écart provient vraisemblablement de fichiers de test ajoutés entre les deux mesures dans le dépôt, hors périmètre de cette phase — non anormal, simplement à noter).

## 9. Problèmes bloquants

Aucun.

## 10. Problèmes majeurs

1. **Validation de chemin incomplète (contournement possible d'un chemin absolu Windows)**
   - Sévérité : majeur
   - Fichier / emplacement : `src/shared/orchestration/common.ts:19-20` (`hasAbsoluteLikePrefix`), utilisé par `relativeArtifactPathSchema` (ligne 32-41), lui-même utilisé par `workflowArtifactSchema.relativePath` (`workflowArtifact.ts:44`).
   - Constat : la regex `^([a-zA-Z]:[\\/]|\/\/|\\\\|\/|~)` rejette les chemins UNC (`\\server\share`), les chemins avec lettre de lecteur (`C:\...`, `C:/...`), les chemins Unix (`/etc/...`) et les chemins `~`, mais **n'intercepte pas un chemin commençant par un seul backslash sans lettre de lecteur** (ex. `\Windows\system.ini`), qui est un chemin absolu relatif à la racine du lecteur courant sous Windows. Vérifié directement par exécution de `relativeArtifactPathSchema.safeParse('\\Windows\\system.ini')` : le résultat est un succès (`success: true`), alors qu'il devrait être un échec.
   - Impact : un tel chemin, bien que rejeté visuellement comme « relatif » par le schéma, n'est pas un chemin relatif au dépôt déclaré ; s'il était un jour combiné naïvement à une racine de dépôt (ex. `path.join(repoRoot, relativePath)` sous Node, qui sur Windows peut se comporter de façon surprenante avec un chemin de ce type selon le contexte), il contourne l'intention de la section 4 de `ORCHESTRATOR_V1_SAFETY_RULES.md` (« tout chemin dont la résolution absolue sort de la racine du dépôt déclaré est rejeté »). Aucun test des six fichiers ne couvre ce cas, donc aucune régression ne serait détectée si le comportement se dégradait davantage.
   - Correction minimale recommandée : élargir la détection à tout chemin commençant par un unique séparateur, par exemple en remplaçant la regex par quelque chose d'équivalent à `/^[\\/]|^[a-zA-Z]:[\\/]|^~/` (un chemin commençant par `\` ou `/`, seul ou en lettre de lecteur, ou par `~`, est absolu-like) — ce qui couvre aussi bien le cas UNC (`\\`) que le cas à backslash unique, sans avoir besoin d'une alternative dédiée à `\\\\`.

2. **Valeur par défaut dans un schéma de lecture pouvant masquer une donnée corrompue**
   - Sévérité : majeur
   - Fichier / emplacement : `src/shared/orchestration/workflowProfile.ts:28` (`blocking: z.boolean().default(true)`), au sein de `validationCommandSchema`.
   - Constat : contrairement à la convention déjà en place dans `src/shared/schemas/task.ts`, `phase.ts` et `project.ts` (où `.default()` n'apparaît que dans les schémas `createXSchema` dédiés, jamais dans le schéma de lecture `taskSchema`/`phaseSchema`/`projectSchema`), `validationCommandSchema` est le seul et unique schéma de cette entité (aucun schéma de création séparé n'a été créé pour ORCH-1.1) et porte pourtant une valeur par défaut. Un objet persistant auquel il manquerait le champ `blocking` (données corrompues, migration partielle, édition manuelle du profil) serait donc accepté silencieusement avec `blocking: true` au lieu d'être rejeté par la validation.
   - Impact : une commande de validation critique pourrait se retrouver bloquante ou non bloquante par défaut sans qu'aucune erreur de validation ne le signale, ce qui est en tension directe avec le principe fail-closed de `ORCHESTRATOR_V1_SAFETY_RULES.md` section 2 (« en cas de doute, ne pas exécuter »), appliqué ici à la validation de la donnée elle-même plutôt qu'à une commande.
   - Correction minimale recommandée : retirer `.default(true)` de `validationCommandSchema` (le rendre obligatoire), et si une valeur par défaut est nécessaire pour un flux de création future, l'introduire dans un schéma de création dédié à ce moment-là (comme le fait déjà `createPhaseSchema`/`createProjectSchema`).

3. **Absence de cohérence croisée statut ↔ dates/exitCode (état invalide représentable), non documentée**
   - Sévérité : majeur
   - Fichier / emplacement : `src/shared/orchestration/workflowRun.ts` (`status`/`completedAt`), `workflowStep.ts` (`status`/`startedAt`/`completedAt`), `workflowApproval.ts` (`status`/`decidedAt`), `commandExecution.ts` (`status`/`exitCode`/`completedAt`).
   - Constat : aucun `.refine()` ne lie le statut au caractère renseigné ou non des dates/`exitCode` correspondants. Des combinaisons manifestement incohérentes (ex. `status: 'completed'` avec `completedAt: null` et/ou `exitCode: null`) sont acceptées par validation. Aucun des 176 tests ne rejette ce type de combinaison, et le rapport de phase ne documente ce choix nulle part (ni dans les décisions de modélisation, ni dans les risques ouverts).
   - Impact : une future implémentation (repositories ORCH-2.2, machine à états ORCH-1.2) pourrait persister ou consommer un enregistrement dans un état incohérent sans qu'aucune validation de schéma ne l'intercepte en amont.
   - Correction minimale recommandée : a minima, ajouter une phrase dans `RAPPORT_ORCH_1.1.md` documentant explicitement ce choix comme limitation connue reportée à ORCH-1.2 ; idéalement, ajouter un `.refine()` léger par entité (statut terminal ⇒ date de fin/`exitCode` non nul), qui reste un simple contrôle de cohérence de données et non une machine à états.

## 11. Problèmes mineurs

1. **Sévérité** : mineur — **Fichier** : `src/shared/orchestration/workflowStep.ts` (enum `WORKFLOW_STEP_TYPES`, valeur `corrections`) — **Constat** : un seul type d'étape pour l'Étape 8 (« Corrections éventuelles »), qui selon `ORCHESTRATOR_V1_WORKFLOW.md` réutilise en boucle les règles des Étapes 4, 5 et 6 — **Impact** : granularité potentiellement insuffisante pour distinguer la sous-étape en cours d'un cycle de correction, non documentée comme décision — **Correction minimale recommandée** : soit documenter explicitement ce choix de simplification dans le rapport, soit envisager de réutiliser `prompt_file_creation`/`claude_code_execution`/`report_retrieval` pour les cycles de correction plutôt qu'un type `corrections` unique (à trancher lors d'ORCH-1.2).
2. **Sévérité** : mineur — **Fichier** : `src/shared/orchestration/common.ts:20` (`hasAbsoluteLikePrefix`, alternative `~`) — **Constat** : extension non demandée par les documents ORCH-0.x (aucune mention de `~` dans les règles de sécurité) — **Impact** : aucun (comportement plus restrictif que nécessaire, sans risque), mais non documentée — **Correction minimale recommandée** : mentionner ce choix dans les décisions de modélisation, ou le retirer si jugé hors-scope.
3. **Sévérité** : mineur — **Fichier** : `src/shared/orchestration/commandExecution.ts:41` et `workflowProfile.ts:20` (`args: z.array(z.string())`) — **Constat** : n'interdit pas les éléments chaîne vide dans `args` — **Impact** : un argument de commande vide et vraisemblablement erroné pourrait passer la validation — **Correction minimale recommandée** : envisager `z.array(z.string().min(1))` si jugé pertinent (non bloquant, aucune exigence explicite du prompt ne l'impose).
4. **Sévérité** : mineur — **Fichier** : `src/shared/orchestration/workflowApproval.test.ts:43-49` — **Constat** : deux tests quasiment redondants pour le rejet d'un statut d'enum invalide — **Impact** : aucun (couverture déjà assurée par ailleurs), légère duplication — **Correction minimale recommandée** : fusionner ou retirer l'un des deux tests.

## 12. Recommandations non bloquantes

- Ajouter un `.refine()` léger de cohérence statut/dates par entité (ou documenter explicitement l'absence de ce contrôle) avant ORCH-1.2, pour éviter que ce point ne soit oublié.
- Simplifier `hasAbsoluteLikePrefix` en une expression couvrant en un seul passage les préfixes `\`, `/`, lettre de lecteur, et `~`, ce qui aurait évité le contournement décrit en 10.1.
- Envisager, lors d'ORCH-2.2 (repositories), d'ajouter des schémas `createXSchema`/`updateXSchema` pour ces six entités si des flux de création/mise à jour partielle s'avèrent nécessaires, en respectant la convention déjà en place (`phase.ts`/`project.ts`/`task.ts`) de réserver les valeurs par défaut à ces schémas dédiés.
- Ajouter, dans une future itération, des tests couvrant explicitement le chemin Windows à backslash unique une fois la correction de 10.1 appliquée, pour garantir la non-régression.

## 13. Résultats typecheck, tests et build

**`npm run typecheck`** :

```text
> theme-factory-companion@1.0.0 typecheck
> tsc -p tsconfig.node.json --noEmit && tsc -p tsconfig.web.json --noEmit
```

Succès, aucune erreur.

**`npm run test`** :

```text
Test Files  28 passed (28)
     Tests  603 passed (603)
```

Succès, aucune erreur non gérée (conforme à la dernière exécution connue : 28 fichiers, 603 tests).

**`npm run build`** :

```text
✓ built in 5.33s   (out/main)
✓ built in 388ms   (out/preload)
✓ built in 9.60s   (out/renderer)
```

Succès, aucune erreur.

## 14. Résultat de `git diff --check`

Aucune sortie retournée : aucun conflit de fin de ligne ni d'espace superflu détecté.

## 15. Sortie finale de `git status --short --untracked-files=all`

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
?? workflow/reports/RAPPORT_ORCH_1.1.md
?? workflow/reports/REVIEW_ORCH_1.1.md
```

`git diff --check` : aucune sortie retournée (aucun conflit de fin de ligne ni d'espace superflu).

## 16. Conclusion

L'implémentation ORCH-1.1 est fonctionnellement complète et conforme au périmètre demandé : les six entités existent, sont validées par Zod, typées par `z.infer`, testées de façon systématique (176 tests dédiés), sérialisables en JSON, et respectent les interdictions structurelles (pas de commande Git/Claude Code configurable dans le profil, exécutable et arguments séparés, aucun `any`, aucune machine à états). Toutes les validations automatiques (typecheck, tests, build, `git diff --check`) sont au vert.

Trois problèmes majeurs — une lacune de validation de chemin sur un cas Windows non-UNC, une valeur par défaut risquant de masquer une donnée corrompue, et l'absence de cohérence croisée statut/dates non documentée — justifient une correction avant de considérer cette base de schémas totalement fiable pour les phases suivantes (ORCH-1.2, ORCH-2.x), sans pour autant remettre en cause la validité globale du travail livré.
