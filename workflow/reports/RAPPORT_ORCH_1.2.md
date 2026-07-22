# Rapport — ORCH-1.2 — Machine à états de l'orchestrateur

## 1. Résumé

Cette phase a implémenté une machine à états **pure** (aucune I/O, aucun accès disque/réseau/processus/SQLite/Git) validant les transitions autorisées entre les 17 valeurs de `WorkflowRunStatus`, conformément à `docs/orchestration/ORCHESTRATOR_V1_WORKFLOW.md` et à la table de transitions définie dans `workflow/prompts/ORCH_1.2_PROMPT.md`. Le module expose une table de transitions figée (`Object.freeze`) et deux fonctions pures de consultation/validation ; aucune règle de transition n'est déclenchée automatiquement, aucun invariant `superRefine` d'ORCH-1.1 n'a été modifié, aucune autre entité (`WorkflowStep`, `WorkflowApproval`, `CommandExecution`, `WorkflowArtifact`, `WorkflowProfile`) n'a été touchée.

**Addendum** : ce rapport a été mis à jour suite à une revue qui a identifié 2 problèmes majeurs (comportement non fail-closed sur une valeur runtime invalide, suite de tests complète non validée à 29/29) et 1 problème documentaire (fichier de prompt absent du périmètre déclaré), conformément à `workflow/prompts/ORCH_1.2_CORRECTIONS_PROMPT.md`. Les trois ont été corrigés : `isValidWorkflowRunTransition`/`getAllowedNextWorkflowRunStatuses` sont désormais défensives face à une valeur runtime invalide (section 5), une passe complète 29/29 a été obtenue (section 8), et les fichiers de prompt sont explicitement déclarés (section 2). Les sections ci-dessous reflètent l'état corrigé.

## 2. Fichiers créés

- `src/shared/orchestration/workflowStateMachine.ts` — `WORKFLOW_RUN_TRANSITIONS`, `isValidWorkflowRunTransition`, `getAllowedNextWorkflowRunStatuses`.
- `src/shared/orchestration/workflowStateMachine.test.ts` — 354 tests (350 initiaux + 4 ajoutés lors de la correction, voir section 5).
- `workflow/reports/RAPPORT_ORCH_1.2.md` — le présent rapport.
- `workflow/prompts/ORCH_1.2_PROMPT.md` — le prompt d'implémentation de cette phase, rédigé en amont de l'implémentation. Conservé conformément à la convention déjà en place dans ce dépôt (voir `workflow/prompts/PHASE_4.1_PROMPT.md` et les autres prompts `PHASE_x.y_PROMPT.md`) consistant à archiver chaque prompt d'implémentation sous `workflow/prompts/`. Ce fichier avait été omis de cette section lors de la première rédaction du rapport ; il ne s'agit pas d'un fichier créé pendant l'implémentation elle-même mais d'un artefact amont du même processus de phase, comme c'est déjà le cas pour tous les prompts `PHASE_x.y_PROMPT.md` du dépôt.
- `workflow/prompts/ORCH_1.2_CORRECTIONS_PROMPT.md` — le prompt de correction ayant motivé la présente mise à jour du rapport, conservé selon la même convention (voir par exemple `workflow/prompts/PHASE_4.1_CORRECTIONS_PROMPT.md`).

## 3. Fichiers modifiés

- `src/shared/orchestration/workflowRun.ts` : une seule ligne changée — `WORKFLOW_RUN_TERMINAL_STATUSES` passe de privée (`const`) à exportée (`export const`). Aucune autre ligne du fichier n'a été touchée : ni son `superRefine`, ni ses champs, ni son schéma, ni ses commentaires. Cette exportation évite de dupliquer la liste des 3 statuts terminaux dans `workflowStateMachine.ts` (source de vérité unique), conformément au périmètre autorisé du prompt.
- `src/shared/orchestration/index.ts` : ajout de l'export de `WORKFLOW_RUN_TERMINAL_STATUSES` (désormais public) dans le bloc d'export existant de `workflowRun.ts`, et ajout d'un nouveau bloc d'export pour `workflowStateMachine.ts` (`WORKFLOW_RUN_TRANSITIONS`, `getAllowedNextWorkflowRunStatuses`, `isValidWorkflowRunTransition`). Aucun export préexistant n'a été retiré ou modifié.

Aucun autre fichier n'a été créé ou modifié. Les cinq autres fichiers d'entité (`workflowStep.ts`, `workflowArtifact.ts`, `workflowApproval.ts`, `commandExecution.ts`, `workflowProfile.ts`) et leurs tests, ainsi que `common.ts`, n'ont subi aucune modification.

## 4. Table de transitions implémentée

La table ci-dessous est reproduite telle qu'implémentée dans `WORKFLOW_RUN_TRANSITIONS` (`workflowStateMachine.ts`). Elle correspond exactement, terme à terme, à la table définie dans `workflow/prompts/ORCH_1.2_PROMPT.md` — aucune ligne n'a été ajoutée, retirée ou modifiée par rapport au prompt.

| De | Vers (autorisé) |
|---|---|
| `draft` | `prompt_ready`, `cancelled`, `failed` |
| `prompt_ready` | `awaiting_approval`, `cancelled` |
| `awaiting_approval` | `implementation_in_progress`, `prompt_ready`, `cancelled` |
| `implementation_in_progress` | `implementation_completed`, `cancelled` |
| `implementation_completed` | `report_available`, `implementation_in_progress`, `failed`, `cancelled` |
| `report_available` | `review_required`, `cancelled` |
| `review_required` | `validations_in_progress`, `corrections_required`, `failed`, `cancelled` |
| `corrections_required` | `awaiting_approval`, `failed`, `cancelled` |
| `validations_in_progress` | `manual_validation_required`, `validation_failed`, `cancelled` |
| `validation_failed` | `corrections_required`, `failed`, `cancelled` |
| `manual_validation_required` | `ready_to_commit`, `corrections_required`, `cancelled` |
| `ready_to_commit` | `committed`, `cancelled` |
| `committed` | `ready_to_push`, `cancelled` |
| `ready_to_push` | `completed`, `committed`, `cancelled` |
| `completed` | *(aucune)* |
| `cancelled` | *(aucune)* |
| `failed` | *(aucune)* |

Soit 14 statuts non terminaux (chacun avec au moins une transition sortante) et 3 statuts terminaux (`completed`, `cancelled`, `failed`, chacun sans transition sortante), pour un total de 39 transitions valides sur 289 paires possibles (17 × 17).

**Ajout non explicitement listé dans le prompt, mais couvert par sa section « Invariants »** : la table (`WORKFLOW_RUN_TRANSITIONS`) et chacun de ses tableaux de statuts sont gelés via `Object.freeze` (voir `workflowStateMachine.ts`, commentaire au-dessus de la constante). Le prompt laissait ce choix ouvert (« ne pas ajouter `Object.freeze` sauf si tu juges cela nécessaire … à documenter dans le rapport si ajouté ») : il a été ajouté pour que la non-mutabilité soit une garantie réelle à l'exécution, et non uniquement une garantie de typage (`readonly`) contournable par un cast. Deux tests dédiés (section 6, catégorie 7) vérifient qu'une tentative de mutation lève effectivement une `TypeError`.

## 5. Décisions volontairement hors périmètre

- **Limite numérique de cycles de correction** (section 23 des règles de sécurité, `ORCHESTRATOR_V1_WORKFLOW.md` Étape 8) : non modélisée. La table autorise structurellement des allers-retours `corrections_required → awaiting_approval → (implementation_in_progress → … → review_required) → corrections_required`, etc., sans compteur ni plafond. L'application d'une limite numérique de cycles est une responsabilité d'exécution future (probablement au niveau d'un futur module d'orchestration exécutant la machine à états, hors périmètre schéma/état de cette phase), pas de la machine à états elle-même.
- **Machine à états pour `WorkflowStep`, `WorkflowApproval`, `CommandExecution`** : non implémentée. Ces trois entités conservent leurs seuls invariants locaux de cohérence statut/dates (`superRefine`, ORCH-1.1), sans règle de transition entre leurs statuts respectifs. Si une telle machine s'avère nécessaire pour une phase ultérieure (par exemple pour empêcher qu'une étape `pending` passe directement à `completed` sans transiter par `in_progress`), elle devra être ajoutée dans un module dédié, distinct de `workflowStateMachine.ts`.
- **Application effective des transitions (effet de bord)** : `workflowStateMachine.ts` ne fait que répondre « telle transition est-elle autorisée ? ». Aucune fonction ne modifie un `WorkflowRun`, ne persiste un nouveau statut, ni ne déclenche une action liée à une transition (notification, écriture SQLite, etc.). Cette responsabilité appartient aux phases d'exécution futures (ORCH-2.x et suivantes).
- **Validation de forme runtime** : les fonctions du module attendent des valeurs `WorkflowRunStatus` déjà validées au sens du type TypeScript ; cette validation de forme reste une responsabilité amont (`workflowRunStatusSchema`, déjà couverte par les tests ORCH-1.1) et n'est pas dupliquée dans ce module. En revanche, si une valeur non validée parvenait malgré tout à l'exécution (contournement du typage, source externe non fiable), les deux fonctions publiques restent défensives plutôt que de lever une exception : voir la correction ci-dessous.

**Correction appliquée suite à revue — comportement fail-closed sur une valeur runtime invalide (majeur)** : la version initiale de ce module indexait directement `WORKFLOW_RUN_TRANSITIONS[from]` sans vérifier que `from` était réellement une clé connue de la table. Une valeur runtime invalide (par exemple un cast `'not_a_status' as WorkflowRunStatus`, contournant la garantie de typage statique) provoquait alors `WORKFLOW_RUN_TRANSITIONS[from]` égal à `undefined`, et l'appel `.includes(...)` levait une `TypeError` — un comportement contraire au principe fail-closed déjà énoncé dans le prompt d'origine (« ne lance jamais d'exception »).

Une garde défensive privée, `isKnownWorkflowRunStatus`, a été ajoutée dans `workflowStateMachine.ts` (`Object.prototype.hasOwnProperty.call(WORKFLOW_RUN_TRANSITIONS, value)`), utilisée par les deux fonctions publiques avant toute indexation de la table :

- `isValidWorkflowRunTransition(from, to)` retourne désormais `false` (jamais d'exception) si `from` n'est pas une clé connue de `WORKFLOW_RUN_TRANSITIONS` ; un `to` invalide était déjà géré sans risque (`Array.prototype.includes` ne lève jamais pour une valeur absente), un test dédié le confirme explicitement ;
- `getAllowedNextWorkflowRunStatuses(from)` retourne désormais `[]` (jamais d'exception) dans le même cas.

Les signatures publiques des deux fonctions restent inchangées (`WorkflowRunStatus` en paramètre) : la défense porte sur le comportement à l'exécution face à une violation de cette garantie de typage, pas sur un élargissement du type accepté.

## 6. Tests ajoutés

354 tests dans `workflowStateMachine.test.ts` (350 initiaux + 4 ajoutés lors de la correction du comportement fail-closed, voir section 5), répartis en 9 blocs `describe` :

1. **Exhaustivité des clés** — 1 test : `Object.keys(WORKFLOW_RUN_TRANSITIONS)` correspond exactement, en ensemble, à `WORKFLOW_RUN_STATUSES`.
2. **Statuts terminaux** — 17 tests : `it.each` sur les 3 statuts terminaux (tableau vide) et sur les 14 statuts non terminaux (au moins une transition sortante).
3. **Transitions valides** — 39 tests : un test par paire `(from, to)` réellement présente dans la table (`it.each` généré programmatiquement à partir de `WORKFLOW_RUN_TRANSITIONS`, pas listé à la main).
4. **Transitions refusées, exhaustif** — 251 tests : 1 test de couverture (39 valides + 250 invalides = 289 = 17²) + 250 tests `it.each`, un par paire absente de la table, dérivés par produit cartésien programmatique de `WORKFLOW_RUN_STATUSES` (aucune paire listée à la main, la liste des paires invalides est calculée en retirant les paires valides de l'ensemble complet).
5. **Transitions identité** — 17 tests : `it.each` sur les 17 statuts, `isValidWorkflowRunTransition(status, status)` toujours `false`.
6. **`getAllowedNextWorkflowRunStatuses`** — 20 tests : `it.each` sur les 17 statuts (résultat strictement égal à `WORKFLOW_RUN_TRANSITIONS[status]`) + `it.each` sur les 3 statuts terminaux (tableau vide, redondant avec le test générique mais explicite).
7. **Non-mutabilité** — 2 tests : tentative de réaffectation d'une clé de `WORKFLOW_RUN_TRANSITIONS` (lève `TypeError`) et tentative de `push` sur un tableau de transitions autorisées (lève `TypeError`), les deux vérifiant en complément que la valeur d'origine reste inchangée après l'exception.

Bloc supplémentaire, non explicitement demandé par la liste des 7 catégories mais couvrant le même invariant (« un statut terminal n'a aucune transition sortante ») via la fonction publique plutôt que via la table brute :

8. **Statuts terminaux comme origine** — 3 tests : pour chacun des 3 statuts terminaux, boucle interne sur les 17 statuts cibles vérifiant que `isValidWorkflowRunTransition` retourne toujours `false`.
9. **Valeur runtime invalide (fail-closed)** — 4 tests, ajoutés lors de la correction : `isValidWorkflowRunTransition` avec un `from` invalide, avec un `to` invalide, et avec les deux invalides (3 tests, chacun vérifiant à la fois l'absence d'exception via `expect(() => …).not.toThrow()` et la valeur de retour `false`) ; `getAllowedNextWorkflowRunStatuses` avec un `from` invalide (1 test, absence d'exception et retour `[]`).

Total : 1 + 17 + 39 + 251 + 17 + 20 + 2 + 3 + 4 = 354.

## 7. Résultats de `npm run typecheck`

```text
> theme-factory-companion@1.0.0 typecheck
> tsc -p tsconfig.node.json --noEmit && tsc -p tsconfig.web.json --noEmit
```

Succès, aucune erreur.

## 8. Résultats de `npm run test`

**Correction appliquée suite à revue — passe complète non validée à 29/29 (majeur)** : le rapport initial se basait sur une exécution parallèle par défaut n'ayant compté que 28 fichiers sur 29 (timeout de démarrage d'un worker Vitest sur `src/renderer/src/App.test.tsx`), ce qui ne constituait pas une preuve suffisante d'une suite complète et réussie. Conformément à `ORCH_1.2_CORRECTIONS_PROMPT.md`, la commande `npx vitest run --maxWorkers=1` a été exécutée à la place :

- **1ʳᵉ tentative** : `Test Files 1 failed | 28 passed (29)`, `Tests 8 failed | 1016 passed (1024)`. Les 8 échecs proviennent exclusivement de `src/renderer/src/pages/PhasesPage.test.tsx` (`Test timed out in 5000ms`), un aléa d'infrastructure déjà documenté dans `RAPPORT_CORRECTIONS_REVIEW_ORCH_1.1.md` (timeouts Vitest sous charge sur ce même fichier). Ce fichier n'appartient pas à `src/shared/orchestration` et n'a pas été modifié par cette phase ni par sa correction.
- **2ᵉ tentative** (relance, conformément à la procédure prévue par le prompt de correction en cas d'aléa d'infrastructure connu) : **`Test Files 29 passed (29)`, `Tests 1024 passed (1024)`**, succès intégral, aucun échec.

Sous-ensemble `src/shared/orchestration` (exécuté isolément au cours de l'implémentation initiale) : 593 tests, 7 fichiers, tous passés (243 issus d'ORCH-1.1 + 350 tests initiaux de cette phase) ; ce total est désormais de 597 après ajout des 4 tests de la correction (voir section 6), inclus dans les 1024 tests de la passe complète ci-dessus.

Cohérence des totaux : 670 (dernier total connu avant ORCH-1.2) − 243 (ancien sous-ensemble `orchestration`) + 597 (nouveau sous-ensemble `orchestration`, après correction) = 1024, exactement le total obtenu lors de la 2ᵉ passe complète réussie.

## 9. Résultats de `npm run build`

Résultat de l'implémentation initiale (build ré-exécuté à l'identique après la correction, sans changement de résultat) :

```text
> theme-factory-companion@1.0.0 build
> electron-vite build

✓ built in 4.61s   (out/main)
✓ built in 169ms   (out/preload)
✓ built in 14.07s  (out/renderer)
```

Ré-exécuté après application des corrections :

```text
✓ built in 23.04s  (out/main)
✓ built in 3.34s   (out/preload)
✓ built in 2m 9s   (out/renderer)
```

Succès, aucune erreur, dans les deux cas (les temps de build varient selon la charge de la machine, sans rapport avec cette phase).

## 10. Résultat de `git status --short --untracked-files=all`

Capturé après application des trois corrections et mise à jour du présent rapport (état réellement final de l'intervention) :

```text
 M src/shared/orchestration/index.ts
 M src/shared/orchestration/workflowRun.ts
?? src/shared/orchestration/workflowStateMachine.test.ts
?? src/shared/orchestration/workflowStateMachine.ts
?? workflow/prompts/ORCH_1.2_CORRECTIONS_PROMPT.md
?? workflow/prompts/ORCH_1.2_PROMPT.md
?? workflow/reports/RAPPORT_ORCH_1.2.md
```

`git diff --check` : aucun conflit de fin de ligne ni espace superflu signalé dans le contenu du diff ; seuls des avertissements informatifs `LF will be replaced by CRLF` (conversion `core.autocrlf` propre à cet environnement Windows) ont été émis, sans rapport avec un problème de contenu (exit code 0, confirmé à nouveau après les corrections).

## 11. Confirmation du périmètre

- Seuls les fichiers listés en sections 2 et 3 ont été créés ou modifiés.
- `src/shared/orchestration/workflowRun.ts` n'a subi qu'un seul changement (export d'une constante déjà existante) ; son `superRefine`, ses champs et son schéma sont strictement inchangés.
- Aucun des cinq autres fichiers d'entité ORCH-1.1 (`workflowStep.ts`, `workflowArtifact.ts`, `workflowApproval.ts`, `commandExecution.ts`, `workflowProfile.ts`) ni leurs tests n'a été modifié.
- `common.ts` n'a pas été modifié.
- Aucun fichier sous `src/main`, `src/preload` ou `src/renderer` n'a été modifié.
- Aucune migration SQLite créée ou modifiée.
- Aucun canal IPC créé ou modifié.
- `package.json` non modifié ; aucune dépendance installée.
- Aucun document `docs/orchestration/*.md` modifié.
- Aucun `git add`, `git commit` ou `git push` n'a été exécuté à aucun moment de cette intervention.
