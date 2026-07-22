# ORCH-1.2 — Machine à états de l'orchestrateur

## Contexte

Tu travailles dans le dépôt **Theme Factory Companion**.

ORCH-0.1 (spécification), ORCH-0.2 (règles de sécurité) et ORCH-1.1 (schémas partagés) sont terminés, corrigés suite à review, et commités sur `main`.

État de départ confirmé :

* `src/shared/orchestration/` contient six entités Zod finalisées : `WorkflowRun`, `WorkflowStep`, `WorkflowArtifact`, `WorkflowApproval`, `CommandExecution`, `WorkflowProfile` ;
* `workflowRunStatusSchema` définit 17 statuts (`WORKFLOW_RUN_STATUSES` dans `workflowRun.ts`) ; 3 d'entre eux sont terminaux (`completed`, `cancelled`, `failed`), portés par une constante privée `WORKFLOW_RUN_TERMINAL_STATUSES` non exportée ;
* chaque entité porte déjà des invariants locaux de cohérence statut/dates (`superRefine`), mais **aucune règle de transition entre statuts n'existe** — c'est précisément l'objet de cette phase ;
* 243 tests dans `src/shared/orchestration`, 670 tests au total dans le dépôt, `typecheck`/`test`/`build` au vert ;
* les documents `docs/orchestration/ORCHESTRATOR_V1_SCOPE.md`, `ORCHESTRATOR_V1_WORKFLOW.md`, `ORCHESTRATOR_V1_ROADMAP.md`, `ORCHESTRATOR_V1_SAFETY_RULES.md`, `ORCHESTRATOR_V1_SECURITY_MATRIX.md` sont figés et font foi.

Cette intervention porte uniquement sur **ORCH-1.2 : la machine à états du `WorkflowRun`**.

## Objectif et périmètre

Implémenter une machine à états **pure** (aucune I/O, aucun accès disque/réseau/processus/SQLite/Git) qui définit et valide les transitions autorisées entre les 17 valeurs de `WorkflowRunStatus`, conformément aux étapes et conditions décrites dans `ORCHESTRATOR_V1_WORKFLOW.md`.

Cette phase :

* définit **une seule** machine à états, portant sur `WorkflowRun.status` ;
* ne touche pas aux statuts de `WorkflowStep`, `WorkflowApproval`, `CommandExecution` : leurs invariants locaux (déjà posés en ORCH-1.1) restent inchangés et suffisants pour cette phase — leurs propres machines à états, si elles s'avèrent nécessaires, sont explicitement **hors périmètre** et reportées à une phase ultérieure ;
* ne déclenche aucune transition automatiquement : elle expose uniquement une fonction de validation pure, appelée par un code appelant (hors périmètre ORCH-1.2) qui décide quand une transition doit avoir lieu ;
* ne modélise pas de limite numérique de cycles de correction (section 23 des règles de sécurité : valeur non fixée). La machine autorise structurellement des allers-retours `corrections_required → awaiting_approval → validations_in_progress`, sans compteur : l'application d'une limite de cycles est une responsabilité d'exécution future, hors périmètre schéma/état ;
* ne redéfinit aucun des invariants `superRefine` déjà présents dans les six entités ORCH-1.1.

## Étape préalable obligatoire

Avant toute modification :

1. lire intégralement `docs/orchestration/ORCHESTRATOR_V1_WORKFLOW.md`, en particulier les sections 1, 3, 4 et 5 ;
2. lire intégralement `docs/orchestration/ORCHESTRATOR_V1_SAFETY_RULES.md`, en particulier les sections 1, 2 et 20 ;
3. lire `src/shared/orchestration/workflowRun.ts`, `common.ts` et `index.ts` ;
4. lire un fichier de test existant du dossier (`workflowRun.test.ts`) pour t'aligner sur la convention `it.each` déjà en usage.

Ne redéfinis aucune valeur d'énumération : réutilise strictement `WORKFLOW_RUN_STATUSES` et `WorkflowRunStatus` existants, importés depuis `workflowRun.ts`.

## Fichiers autorisés

À créer :

```text
src/shared/orchestration/workflowStateMachine.ts
src/shared/orchestration/workflowStateMachine.test.ts
workflow/reports/RAPPORT_ORCH_1.2.md
```

À modifier, et strictement seulement pour ce qui suit :

* `src/shared/orchestration/workflowRun.ts` : exporter la constante déjà existante `WORKFLOW_RUN_TERMINAL_STATUSES` (actuellement privée). Aucune autre ligne de ce fichier ne doit changer : ni son `superRefine`, ni ses champs, ni son schéma. Cette exportation évite de dupliquer la liste des statuts terminaux dans la machine à états (source de vérité unique).
* `src/shared/orchestration/index.ts` : ajouter les exports publics du nouveau module (voir « Travail demandé »), et l'export de `WORKFLOW_RUN_TERMINAL_STATUSES` désormais public.

Aucun autre fichier ne doit être créé ou modifié, en particulier :

* aucun des cinq autres fichiers d'entité (`workflowStep.ts`, `workflowArtifact.ts`, `workflowApproval.ts`, `commandExecution.ts`, `workflowProfile.ts`) ni leurs tests ;
* `common.ts` ;
* aucun fichier sous `src/main`, `src/preload`, `src/renderer` ;
* aucune migration SQLite ;
* aucun canal IPC ;
* `package.json` ou tout fichier de configuration ;
* aucun document `docs/orchestration/*.md`.

## Travail demandé

### 1. Table de transitions

Dans `workflowStateMachine.ts`, définir une table exhaustive et typée (`Record<WorkflowRunStatus, readonly WorkflowRunStatus[]>`, garantissant à la compilation la présence des 17 clés) nommée `WORKFLOW_RUN_TRANSITIONS`, appliquant exactement la correspondance suivante entre statuts et étapes de `ORCHESTRATOR_V1_WORKFLOW.md`. Cette table fait foi ; ne la modifie pas et ne la ré-invente pas.

| De | Vers (autorisé) | Justification (étape du workflow) |
|---|---|---|
| `draft` | `prompt_ready`, `cancelled`, `failed` | Étape 1 réussie → Étape 2 ; annulation possible à tout moment ; échec Étape 1 (projet/chemin/profil invalide) |
| `prompt_ready` | `awaiting_approval`, `cancelled` | présentation du prompt à l'utilisateur, Étape 3 |
| `awaiting_approval` | `implementation_in_progress`, `prompt_ready`, `cancelled` | Étape 3 : approuvé → Étape 4/5 ; modification demandée → retour Étape 2 ; refus/annulation |
| `implementation_in_progress` | `implementation_completed`, `cancelled` | Étape 5 : exécution terminée (succès ou échec, le détail est porté par `CommandExecution`, pas par `WorkflowRun.status`) → Étape 6 ; annulation utilisateur de l'exécution |
| `implementation_completed` | `report_available`, `implementation_in_progress`, `failed`, `cancelled` | Étape 6 : rapport présent et non vide → Étape 7 ; rapport absent/vide ou Claude Code en échec → relance manuelle (retour à `implementation_in_progress`) ; abandon après échecs répétés → `failed` ; annulation |
| `report_available` | `review_required`, `cancelled` | Étape 7 démarre |
| `review_required` | `validations_in_progress`, `corrections_required`, `failed`, `cancelled` | Étape 7 : approuvée → Étape 9 ; corrections requises → Étape 8 ; rapport incohérent/incompréhensible → `failed` (condition d'échec explicite Étape 7) ; annulation |
| `corrections_required` | `awaiting_approval`, `failed`, `cancelled` | Étape 8 : nouvelle approbation obligatoire avant toute relance (réutilise l'état `awaiting_approval`, l'entité `WorkflowApproval.type = correction_prompt` distingue le contexte) ; nombre maximal de cycles atteint → `failed` (condition d'échec explicite Étape 8) ; refus utilisateur → `cancelled` |
| `validations_in_progress` | `manual_validation_required`, `validation_failed`, `cancelled` | Étape 9 : toutes commandes bloquantes réussissent → Étape 10 ; une commande bloquante échoue → `validation_failed` |
| `validation_failed` | `corrections_required`, `failed`, `cancelled` | retour Étape 8 (décision de corriger) ; blocage définitif assumé par l'utilisateur → `failed` |
| `manual_validation_required` | `ready_to_commit`, `corrections_required`, `cancelled` | Étape 10 : accord explicite → Étape 11 ; refus/régression constatée → retour Étape 8 |
| `ready_to_commit` | `committed`, `cancelled` | Étape 11-13 : commit exécuté avec succès après autorisation (Étape 12) |
| `committed` | `ready_to_push`, `cancelled` | Étape 14 : demande d'autorisation de push |
| `ready_to_push` | `completed`, `committed`, `cancelled` | Étape 15 : push accepté → clôture (`completed`) ; push refusé ou rejeté/erreur réseau → retour à `committed` (« état commité mais non poussé », stable, non considéré comme un échec) |
| `completed` | *(aucune)* | terminal |
| `cancelled` | *(aucune)* | terminal |
| `failed` | *(aucune)* | terminal |

### 2. Fonctions publiques

Exporter, depuis `workflowStateMachine.ts` puis via `index.ts` :

* `WORKFLOW_RUN_TRANSITIONS` — la table ci-dessus, `as const`, en lecture seule.
* `isValidWorkflowRunTransition(from: WorkflowRunStatus, to: WorkflowRunStatus): boolean` — fonction pure, retourne `true` uniquement si `to` figure dans `WORKFLOW_RUN_TRANSITIONS[from]`.
* `getAllowedNextWorkflowRunStatuses(from: WorkflowRunStatus): readonly WorkflowRunStatus[]` — retourne exactement `WORKFLOW_RUN_TRANSITIONS[from]` (tableau vide pour un statut terminal).

Aucune fonction ne doit lancer d'exception : une transition invalide retourne `false` (ou un tableau vide), jamais un `throw`. C'est à l'appelant futur (hors périmètre ORCH-1.2) de décider comment réagir à un refus.

Ne pas ajouter de fonction supplémentaire non demandée (pas de fonction d'application de transition avec effet de bord, pas de sérialisation, pas de gestion d'historique : ce sont des responsabilités d'exécution futures).

## Transitions autorisées et refusées

* **Autorisées** : uniquement les paires `(from, to)` explicitement listées dans `WORKFLOW_RUN_TRANSITIONS` ci-dessus.
* **Refusées, sans exception** :
  * toute paire `(from, to)` absente de la table, y compris si elle semble plausible ;
  * toute transition identité `(X, X)` — rester dans le même statut n'est jamais une « transition » validée par ce module, y compris pour les 3 statuts terminaux ;
  * toute transition dont `from` est un statut terminal (`completed`, `cancelled`, `failed`), quelle que soit la valeur de `to` — y compris `cancelled → cancelled` ou `failed → completed` ;
  * toute transition inverse non explicitement listée (le fait que `X → Y` soit autorisé n'implique jamais que `Y → X` le soit).

## Invariants

* La table `WORKFLOW_RUN_TRANSITIONS` possède exactement les 17 clés de `WORKFLOW_RUN_STATUSES`, ni plus ni moins (garanti à la compilation par le typage `Record`, vérifié à nouveau par un test d'exhaustivité des clés).
* Les trois statuts terminaux (`WORKFLOW_RUN_TERMINAL_STATUSES`, désormais exportée depuis `workflowRun.ts`) sont exactement les clés dont la valeur associée est un tableau vide — aucune autre clé ne doit avoir un tableau vide, aucun statut terminal ne doit avoir une valeur non vide.
* Chaque statut non terminal possède au moins une transition sortante (aucun état non terminal ne doit être un cul-de-sac silencieux).
* Le module ne dépend d'aucune autre entité que `WorkflowRunStatus`/`WORKFLOW_RUN_STATUSES`/`WORKFLOW_RUN_TERMINAL_STATUSES` importées depuis `workflowRun.ts`. Aucune dépendance vers `workflowStep.ts`, `workflowApproval.ts`, `commandExecution.ts`, `workflowProfile.ts` ou `workflowArtifact.ts`.
* Le module est un ensemble de constantes et de fonctions pures : aucun état mutable de module, aucun singleton, aucun effet de bord, aucun `console.log`.

## Comportement fail-closed

Conformément à `ORCHESTRATOR_V1_SAFETY_RULES.md` section 1 (« en cas de doute, ne pas exécuter ») et section 2 (« refus par défaut : toute action non explicitement autorisée est refusée ») :

* la validation d'une transition est une **liste blanche stricte** : `isValidWorkflowRunTransition` doit retourner `false` pour toute paire non explicitement présente dans `WORKFLOW_RUN_TRANSITIONS`, sans heuristique, sans approximation, sans transition implicite déduite d'un ordre logique quelconque ;
* il ne doit exister aucun chemin de code qui contourne la table (pas de cas particulier codé en dur en dehors de `WORKFLOW_RUN_TRANSITIONS`, pas de `if (to === 'cancelled') return true` générique en dehors de ce que la table décrit déjà) ;
* si une valeur reçue par les fonctions n'appartient pas au type `WorkflowRunStatus` (ce que le typage TypeScript empêche normalement, mais qui peut survenir avec une valeur non validée en amont, par exemple lue depuis SQLite sans passer par `workflowRunStatusSchema`), le comportement attendu est celui d'un accès à une clé absente de la table : aucun `as` ni élargissement de type n'est autorisé pour masquer ce cas ; documenter explicitement dans le rapport que la validation de forme (`workflowRunStatusSchema`) reste une responsabilité amont, non dupliquée ici.

## Gestion des états terminaux

* `completed`, `cancelled` et `failed` n'ont, dans `WORKFLOW_RUN_TRANSITIONS`, aucune transition sortante (tableau vide).
* Un workflow parvenu à un statut terminal ne peut plus, par construction de cette machine à états, être ramené à un statut non terminal, ni transiter vers un autre statut terminal (pas de `cancelled → failed`, pas de `failed → cancelled`).
* Ce caractère définitif est une propriété purement structurelle de la table : ne pas ajouter de commentaire, paramètre ou flag permettant de la contourner (pas de mode « admin », pas de fonction `forceTransition`).

## Tests obligatoires

Créer `workflowStateMachine.test.ts` avec Vitest, suivant la convention `it.each` déjà utilisée dans `workflowRun.test.ts`. Couverture minimale :

1. **Exhaustivité des clés** : `Object.keys(WORKFLOW_RUN_TRANSITIONS)` correspond exactement, en ensemble, à `WORKFLOW_RUN_STATUSES` (aucune clé manquante, aucune clé en trop).
2. **Statuts terminaux** : pour chacun des 3 statuts de `WORKFLOW_RUN_TERMINAL_STATUSES`, vérifier que `WORKFLOW_RUN_TRANSITIONS[status]` est un tableau vide, et qu'aucune autre clé n'a un tableau vide.
3. **Transitions valides** : générer par `it.each` la liste complète des paires `(from, to)` issues de la table (une entrée par transition listée dans le tableau ci-dessus) et vérifier que `isValidWorkflowRunTransition(from, to)` retourne `true` pour chacune.
4. **Transitions refusées, exhaustif** : générer par produit cartésien programmatique l'ensemble des 17 × 17 = 289 paires possibles, en retirer les paires valides du point 3, et vérifier par `it.each` que `isValidWorkflowRunTransition(from, to)` retourne `false` pour chacune des paires restantes (ne pas lister ces paires à la main : les dériver de `WORKFLOW_RUN_STATUSES` et `WORKFLOW_RUN_TRANSITIONS` dans le test lui-même, pour que le test reste correct si la table évolue).
5. **Transitions identité** : pour chacun des 17 statuts, `isValidWorkflowRunTransition(status, status)` retourne `false` (ce cas est déjà couvert par le point 4, mais un test dédié et explicite est attendu pour la lisibilité de l'intention).
6. **`getAllowedNextWorkflowRunStatuses`** : pour chaque statut, retourne un tableau dont le contenu (même ensemble de valeurs, même ordre) est strictement identique à `WORKFLOW_RUN_TRANSITIONS[status]` ; pour les 3 statuts terminaux, retourne un tableau vide.
7. **Non-mutabilité** : `WORKFLOW_RUN_TRANSITIONS` et les tableaux qu'elle contient sont en lecture seule au niveau du typage (`readonly`) ; un test peut vérifier qu'une tentative de mutation à l'exécution (si elle n'est pas interceptée par `Object.freeze`) n'est pas silencieusement encouragée — ne pas ajouter `Object.freeze` sauf si tu juges cela nécessaire pour respecter cet objectif, à documenter dans le rapport si ajouté.

## Contraintes techniques

* utiliser TypeScript strict, aucun `any`, aucun cast destiné à contourner le typage ;
* aucune dépendance nouvelle installée ;
* aucune logique d'exécution, de persistance, d'IPC ou d'accès disque/réseau/processus dans `workflowStateMachine.ts` ;
* ne pas modifier `superRefine` ou tout autre invariant des six entités ORCH-1.1 ;
* ne pas introduire de machine à états pour `WorkflowStep`, `WorkflowApproval` ou `CommandExecution` ;
* ne pas ajouter de schéma Zod dans ce module : `workflowStateMachine.ts` manipule uniquement des types déjà inférés, pas de nouvelle validation de forme ;
* respecter la convention de nommage et d'organisation déjà en place dans `src/shared/orchestration/*.ts`.

## Validation obligatoire

Après l'implémentation, exécuter dans cet ordre :

```bash
npm run typecheck
npm run test
npm run build
```

Ne pas masquer une erreur. Si une commande échoue :

1. analyser la cause exacte ;
2. appliquer uniquement une correction liée à ORCH-1.2 ;
3. relancer la commande concernée, puis toute la chaîne de validation.

Les 670 tests existants doivent continuer à réussir, auxquels s'ajoutent les nouveaux tests de cette phase. Si un aléa d'infrastructure déjà documenté (timeouts Vitest sous charge sur `PhasesPage.test.tsx`/`ProjectsPage.test.tsx`, voir `RAPPORT_CORRECTIONS_REVIEW_ORCH_1.1.md`) se manifeste à nouveau, le documenter dans le rapport sans tenter de le corriger (hors périmètre, non lié à cette phase).

## Vérification Git

À la fin, exécuter uniquement des commandes de lecture :

```bash
git status --short
git diff --check
git diff --stat
```

**Ne pas committer. Ne pas pousser. Ne pas modifier la branche. Aucun `git add` ne doit être exécuté.**

## Rapport attendu

Créer le fichier :

```text
workflow/reports/RAPPORT_ORCH_1.2.md
```

Le rapport doit contenir :

1. un résumé de l'implémentation ;
2. les fichiers créés ;
3. les fichiers modifiés (en particulier la justification de l'export de `WORKFLOW_RUN_TERMINAL_STATUSES`) ;
4. la table de transitions reproduite telle qu'implémentée, avec confirmation qu'elle correspond exactement à celle de ce prompt ;
5. le détail des décisions volontairement hors périmètre (limite de cycles de correction non modélisée, absence de machine à états pour `WorkflowStep`/`WorkflowApproval`/`CommandExecution`) ;
6. les tests ajoutés, avec le nombre exact de cas couverts par chacune des 7 catégories de la section « Tests obligatoires » ;
7. les résultats exacts de `npm run typecheck`, `npm run test`, `npm run build` ;
8. le nombre final de fichiers et de tests Vitest réussis (total dépôt) ;
9. tout aléa d'infrastructure rencontré et non lié à cette phase ;
10. le résultat de `git status --short --untracked-files=all` ;
11. la confirmation explicite qu'aucun `git add`, `git commit` ou `git push` n'a été exécuté.

## Critères d'acceptation

ORCH-1.2 est considérée comme terminée uniquement si :

* `workflowStateMachine.ts` existe, exporte `WORKFLOW_RUN_TRANSITIONS`, `isValidWorkflowRunTransition`, `getAllowedNextWorkflowRunStatuses` ;
* la table de transitions correspond exactement à celle définie dans ce prompt, sans ajout ni omission ;
* les 3 statuts terminaux n'ont aucune transition sortante ;
* toute transition identité est refusée ;
* toute paire absente de la table est refusée, vérifié de façon exhaustive (289 paires possibles, testées programmatiquement) ;
* aucun fichier hors du périmètre autorisé n'a été créé ou modifié ;
* aucun invariant existant (`superRefine` des six entités ORCH-1.1) n'a été altéré ;
* `npm run typecheck` réussit ;
* `npm run test` réussit (670 tests existants + nouveaux tests) ;
* `npm run build` réussit ;
* le rapport de phase est créé et complet ;
* aucun commit ni push n'a été effectué.
