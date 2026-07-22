# ORCH-1.2 — Corrections

## Contexte

L'implémentation d'ORCH-1.2 (`src/shared/orchestration/workflowStateMachine.ts` et `workflowStateMachine.test.ts`) est fonctionnellement complète : `typecheck`, `build` et le sous-ensemble `src/shared/orchestration` (593/593) sont au vert. `workflow/reports/RAPPORT_ORCH_1.2.md` documente le travail réalisé.

Une revue de ce rapport a identifié **2 problèmes majeurs** et **1 problème documentaire**, détaillés ci-dessous. Cette intervention corrige exclusivement ces trois points. Aucune autre modification n'est autorisée.

## Fichiers autorisés

* `src/shared/orchestration/workflowStateMachine.ts`
* `src/shared/orchestration/workflowStateMachine.test.ts`
* `workflow/reports/RAPPORT_ORCH_1.2.md`

Aucun autre fichier ne doit être créé ou modifié. En particulier, ne pas toucher à `workflowRun.ts`, `index.ts`, ou tout autre fichier d'entité ORCH-1.1.

## Corrections demandées

### 1. Comportement fail-closed sur une valeur `from` runtime invalide (majeur)

Actuellement, `isValidWorkflowRunTransition` et `getAllowedNextWorkflowRunStatuses` indexent directement `WORKFLOW_RUN_TRANSITIONS[from]` en supposant que `from` est toujours une valeur valide de `WorkflowRunStatus`. Si une valeur invalide parvient malgré tout à l'exécution (par exemple une chaîne lue depuis une source externe et castée sans passer par `workflowRunStatusSchema`), `WORKFLOW_RUN_TRANSITIONS[from]` vaut `undefined`, et l'appel `.includes(...)` lève une `TypeError` — ce qui contredit le principe fail-closed déjà énoncé dans le prompt d'origine (« ne lance jamais d'exception ; ne suppose jamais qu'une paire inconnue est valide »).

Corriger les deux fonctions pour qu'elles restent défensives même face à une valeur `from` qui n'est pas une clé connue de `WORKFLOW_RUN_TRANSITIONS` :

* `isValidWorkflowRunTransition(from, to)` doit retourner `false` (jamais lever d'exception) si `from` n'est pas une clé de `WORKFLOW_RUN_TRANSITIONS` ;
* `getAllowedNextWorkflowRunStatuses(from)` doit retourner `[]` (jamais lever d'exception) dans le même cas.

Utiliser une vérification explicite d'appartenance à la table (par exemple via `Object.prototype.hasOwnProperty.call(WORKFLOW_RUN_TRANSITIONS, from)`, ou toute approche équivalente qui ne repose pas uniquement sur le typage statique) avant d'indexer la table. Ne pas modifier la signature publique des deux fonctions (elles restent typées `(from: WorkflowRunStatus, to: WorkflowRunStatus)` ou `(from: WorkflowRunStatus)` : la défense porte sur le comportement à l'exécution, pas sur un élargissement du type accepté). La validation de forme en amont (`workflowRunStatusSchema`) reste nécessaire et n'est pas dupliquée ici ; ce correctif ne fait que garantir qu'une violation de cette garantie de typage (contournement runtime) ne casse jamais le module au lieu de refuser proprement.

Ajouter dans `workflowStateMachine.test.ts` des tests dédiés à ce comportement, en simulant une valeur runtime invalide via un cast explicite (`'not_a_status' as WorkflowRunStatus` ou équivalent), pour chacune des deux fonctions :

* `isValidWorkflowRunTransition(invalide, 'draft')` retourne `false`, ne lève pas d'exception ;
* `isValidWorkflowRunTransition('draft', invalide)` retourne `false`, ne lève pas d'exception (le `to` invalide doit aussi être couvert : `WORKFLOW_RUN_TRANSITIONS[from].includes(to)` ne lève pas pour un `to` inconnu, mais un test explicite doit le confirmer) ;
* `getAllowedNextWorkflowRunStatuses(invalide)` retourne `[]`, ne lève pas d'exception.

### 2. Suite complète de tests non validée à 29/29 (majeur)

La dernière exécution de `npm run test` n'a compté que 28 fichiers sur 29 réellement présents sur le disque, `src/renderer/src/App.test.tsx` ayant subi un timeout de démarrage de worker Vitest (aléa d'infrastructure déjà documenté par ailleurs, non lié à cette phase). Une passe complète et réussie sur les 29 fichiers est requise avant de considérer la phase validée.

Exécuter :

```powershell
npx vitest run --maxWorkers=1
```

Si cette exécution échoue à nouveau à cause du même aléa d'infrastructure (indépendant de `src/shared/orchestration` et non lié à cette phase), relancer une seconde fois. Si l'aléa persiste malgré `--maxWorkers=1`, exécuter en complément une vérification ciblée du fichier concerné en isolation (`npx vitest run src/renderer/src/App.test.tsx`) pour démontrer l'absence de régression réelle, et documenter précisément ce qui a été tenté.

Ne pas modifier `App.test.tsx` ni tout autre fichier de test hors périmètre pour tenter de « corriger » cet aléa : il est hors périmètre de cette intervention.

### 3. `ORCH_1.2_PROMPT.md` absent du périmètre déclaré du rapport (documentaire)

`workflow/prompts/ORCH_1.2_PROMPT.md` existe dans le dépôt (convention du projet : les prompts d'implémentation sont conservés sous `workflow/prompts/`) mais n'est mentionné ni dans la section « Fichiers créés » du rapport, ni dans sa section « Confirmation du périmètre », qui affirme à tort que « seuls les fichiers listés en sections 2 et 3 ont été créés ou modifiés ».

Corriger `RAPPORT_ORCH_1.2.md` :

* ajouter `workflow/prompts/ORCH_1.2_PROMPT.md` à la section « Fichiers créés », en précisant qu'il a été créé en amont de l'implémentation (rédaction du prompt) et conservé conformément à la convention du dépôt consistant à archiver chaque prompt d'implémentation sous `workflow/prompts/` ;
* ajuster la section « Confirmation du périmètre » pour que l'affirmation sur les fichiers créés/modifiés reste exacte compte tenu de cet ajout.

## Validation obligatoire

Après application des trois corrections :

```bash
npm run typecheck
npx vitest run --maxWorkers=1
npm run build
```

Ne pas masquer une erreur. Les 1020 tests du dépôt (1018 + 2 précédemment non comptés) doivent tous passer en une seule exécution complète et réussie.

## Vérification Git

```bash
git status --short --untracked-files=all
git diff --check
```

**Ne pas committer. Ne pas pousser. Aucun `git add` ne doit être exécuté.**

## Rapport de corrections attendu

Mettre à jour `workflow/reports/RAPPORT_ORCH_1.2.md` directement (pas de nouveau fichier séparé), en :

1. corrigeant le comportement documenté des fonctions publiques face à une valeur runtime invalide (section 5 ou section dédiée) ;
2. remplaçant les résultats de `npm run test` par ceux de la passe complète 29/29 réellement obtenue (préciser la commande exacte utilisée, `--maxWorkers=1`, et le nombre exact de tentatives si plus d'une a été nécessaire) ;
3. ajoutant `ORCH_1.2_PROMPT.md` à la liste des fichiers créés et en corrigeant la section « Confirmation du périmètre » en conséquence ;
4. mettant à jour le nombre total de tests si de nouveaux tests ont été ajoutés au point 1 ;
5. capturant à nouveau, en toute fin d'intervention, `git status --short --untracked-files=all` (incluant le rapport corrigé lui-même).

## Critères d'acceptation

* `isValidWorkflowRunTransition` et `getAllowedNextWorkflowRunStatuses` ne lèvent jamais d'exception, y compris pour une valeur `from`/`to` runtime invalide ;
* des tests couvrent explicitement ce comportement pour les deux fonctions ;
* `npx vitest run --maxWorkers=1` réussit intégralement sur les 29 fichiers (1020 tests, en comptant les nouveaux tests du point 1) ;
* `npm run typecheck` et `npm run build` réussissent ;
* `RAPPORT_ORCH_1.2.md` déclare explicitement `ORCH_1.2_PROMPT.md` parmi les fichiers créés et ne contient plus d'affirmation de périmètre inexacte ;
* aucun fichier hors périmètre autorisé n'a été créé ou modifié ;
* aucun commit ni push n'a été effectué.
