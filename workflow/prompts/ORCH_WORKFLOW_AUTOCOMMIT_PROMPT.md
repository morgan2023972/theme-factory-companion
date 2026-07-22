# Prompt Claude Code — ORCH-WORKFLOW-AUTOCOMMIT — Commit local automatique

## Contexte

Le workflow de développement de l'orchestrateur (défini dans `docs/orchestration/ORCHESTRATOR_V1_ROADMAP.md`, section « Workflow de développement applicable à l'orchestrateur ») se terminait jusqu'ici par une étape manuelle : après validation finale d'une sous-phase, l'utilisateur vérifiait lui-même l'état Git, puis committait et poussait.

Cette intervention introduit le commit local automatique par Claude Code après une sous-phase réussie, tout en conservant le push strictement manuel. Il s'agit d'une intervention **documentaire uniquement** : aucune modification de code applicatif, de test, de migration, de repository, d'IPC, de preload, de renderer, de dépendance ou de `package.json`.

## Objectif

Mettre à jour uniquement la documentation et les conventions nécessaires pour que ce nouveau workflow devienne la règle officielle des prochaines sous-phases de l'orchestrateur.

## Sources de vérité à lire

- `docs/orchestration/ORCHESTRATOR_V1_SCOPE.md`
- `docs/orchestration/ORCHESTRATOR_V1_WORKFLOW.md`
- `docs/orchestration/ORCHESTRATOR_V1_SAFETY_RULES.md`
- `docs/orchestration/ORCHESTRATOR_V1_ROADMAP.md`
- `docs/CONVENTIONS.md`
- les derniers prompts ORCH-3.1.x (`workflow/prompts/`)
- les derniers rapports ORCH-3.1.x (`workflow/reports/`)

## Fichiers autorisés

Modification autorisée, uniquement si réellement nécessaire :

- `docs/orchestration/ORCHESTRATOR_V1_WORKFLOW.md`
- `docs/orchestration/ORCHESTRATOR_V1_SAFETY_RULES.md`
- `docs/orchestration/ORCHESTRATOR_V1_ROADMAP.md`
- `docs/CONVENTIONS.md`

Création obligatoire :

- `workflow/prompts/ORCH_WORKFLOW_AUTOCOMMIT_PROMPT.md` (ce fichier)
- `workflow/reports/RAPPORT_ORCH_WORKFLOW_AUTOCOMMIT.md`

Analyse préalable : `ORCHESTRATOR_V1_WORKFLOW.md` et `ORCHESTRATOR_V1_SAFETY_RULES.md` décrivent le comportement du **futur moteur applicatif** de l'orchestrateur (Étapes 11-15, sections 15-18) — un produit distinct du processus actuel de développement de l'orchestrateur mené directement via Claude Code dans ce dépôt. Le nouveau workflow d'auto-commit ne s'applique qu'à ce second processus (la section « Workflow de développement applicable à l'orchestrateur » de `ORCHESTRATOR_V1_ROADMAP.md`) : il ne modifie ni ne contredit les règles du futur moteur, qui conservent commit et push soumis à approbation humaine explicite dans le produit final. En conséquence, seule `ORCHESTRATOR_V1_ROADMAP.md` est modifiée ; `ORCHESTRATOR_V1_WORKFLOW.md`, `ORCHESTRATOR_V1_SAFETY_RULES.md` et `docs/CONVENTIONS.md` restent inchangés, aucune modification n'y étant nécessaire pour cet objectif.

## Règle générale à documenter

Le commit local automatique par Claude Code est autorisé uniquement si toutes les conditions suivantes sont réunies :

1. l'auto-review Claude Code est explicitement réussie ;
2. aucun défaut non résolu n'est présent ;
3. aucune correction supplémentaire n'est nécessaire ;
4. toutes les validations ciblées exigées par la sous-phase sont vertes ;
5. `git diff --check` réussit ;
6. la liste exacte des fichiers de la sous-phase est connue ;
7. tous les fichiers modifiés appartiennent au périmètre autorisé ;
8. aucun fichier sensible n'est détecté ;
9. aucune modification préexistante non liée n'est présente ;
10. aucun conflit, merge, rebase ou état Git ambigu n'est en cours ;
11. le rapport de sous-phase a été créé ;
12. le message de commit est défini dans le prompt de la sous-phase ;
13. aucune décision humaine n'est en attente.

Procédure Git obligatoire avant commit : `git status --short`, `git diff --check`, `git diff --stat`, `git diff`, puis comparaison avec la liste de fichiers autorisés du prompt de sous-phase.

Conditions d'arrêt avant staging (liste complète), règles de staging (jamais `git add .` / `git add -A` / `git commit -a`), procédure de commit (message exact du prompt, jamais d'amend), et interdiction stricte et absolue du push (`git push`, `git push --force`, `git push --force-with-lease`) : voir le détail intégral dans `docs/orchestration/ORCHESTRATOR_V1_ROADMAP.md`, section « Commit local automatique après une sous-phase réussie ».

## Format exigé pour les futurs prompts de sous-phase

Chaque prompt de sous-phase doit désormais contenir :

```text
Fichiers autorisés pour le commit :
- liste exacte des chemins

Message de commit :
- message exact

Commit local automatique :
- autorisé uniquement si auto-review réussie et validations vertes

Push :
- strictement interdit
```

et préciser que toute anomalie entraîne un arrêt humain sans commit.

## Auto-review obligatoire de cette intervention

1. relire le diff complet ;
2. vérifier qu'aucune règle ajoutée ne permet un push automatique ;
3. vérifier que le commit automatique reste strictement conditionnel (13 conditions) ;
4. vérifier que `git add .` et `git add -A` sont explicitement interdits ;
5. vérifier que la présence de fichiers hors périmètre impose un arrêt ;
6. vérifier que les validations et l'auto-review sont des prérequis explicites au commit ;
7. vérifier que le push manuel reste le dernier contrôle humain ;
8. corriger tout défaut certain et non ambigu ;
9. ne modifier aucun fichier applicatif, test, migration, repository, IPC, preload, renderer, dépendance ou `package.json`.

## Validations à exécuter

```powershell
git diff --check
git status --short --untracked-files=all
git diff --stat
```

## Commit de cette intervention

Fichiers autorisés pour le commit :
- `docs/orchestration/ORCHESTRATOR_V1_ROADMAP.md`
- `workflow/prompts/ORCH_WORKFLOW_AUTOCOMMIT_PROMPT.md`
- `workflow/reports/RAPPORT_ORCH_WORKFLOW_AUTOCOMMIT.md`

Message de commit :
- `docs: intègre le commit local automatique au workflow de développement de l'orchestrateur`

Commit local automatique :
- autorisé uniquement si auto-review réussie, aucune modification hors périmètre détectée, et `git diff --check` réussi.

Push :
- strictement interdit.

## Rapport

Créer `workflow/reports/RAPPORT_ORCH_WORKFLOW_AUTOCOMMIT.md`, contenant : résumé du nouveau workflow, fichiers documentaires modifiés, règles d'autorisation du commit, conditions d'arrêt, commandes interdites, format exigé pour les futurs prompts, confirmation du push manuel, résultats des validations, `git status` final, confirmation qu'aucun push n'a été exécuté.
