# ORCH-3.1.1 — Contrat exact du profil Electron/TypeScript

## Contexte

Cette sous-phase utilise le nouveau workflow de développement de l'orchestrateur (voir `docs/orchestration/ORCHESTRATOR_V1_ROADMAP.md`, section « Workflow de développement applicable à l'orchestrateur ») : objectif unique, tests ciblés, auto-review obligatoire, correction immédiate des défauts certains, puis rapport consolidé.

État acquis :

- ORCH-0.1 et ORCH-0.2 sont terminées.
- ORCH-1.1 et ORCH-1.2 sont terminées, validées et poussées.
- ORCH-2.1 et ORCH-2.2 sont terminées, corrigées, validées et poussées.
- Les entités SQLite et repositories de l'orchestrateur existent déjà.
- `workflowProfile.ts` contient le modèle persistant existant.
- `createWorkflowProfileSchema` existe déjà pour l'entrée du repository.
- Cette sous-phase ne doit modifier ni ce modèle persistant ni la base SQLite.

## Sources de vérité à lire avant toute modification

- `docs/orchestration/ORCHESTRATOR_V1_SCOPE.md`
- `docs/orchestration/ORCHESTRATOR_V1_WORKFLOW.md`
- `docs/orchestration/ORCHESTRATOR_V1_SAFETY_RULES.md`
- `docs/orchestration/ORCHESTRATOR_V1_ROADMAP.md`
- `docs/CONVENTIONS.md`
- `src/shared/orchestration/workflowProfile.ts`
- `src/shared/orchestration/common.ts`
- `src/shared/orchestration/index.ts`
- les tests existants de `src/shared/orchestration`
- `workflow/reports/RAPPORT_ORCH_2.2.md`
- `workflow/reports/RAPPORT_CORRECTIONS_ORCH_2.2.md`

## Objectif unique

Créer le contrat Zod partagé du fichier de configuration d'un profil de workflow Electron/TypeScript.

Le contrat de configuration doit être distinct de l'entité SQLite `WorkflowProfile`.

## Fichiers autorisés

- `src/shared/orchestration/workflowProfileConfig.ts`
- `src/shared/orchestration/workflowProfileConfig.test.ts`
- `src/shared/orchestration/index.ts`
- `workflow/prompts/ORCH_3.1.1_PROMPT.md`
- `workflow/reports/RAPPORT_ORCH_3.1.1.md`

Toute modification d'un autre fichier impose un arrêt et une demande d'approbation, sauf création strictement nécessaire du rapport ou du prompt prévu ci-dessus.

## Fichiers et domaines interdits

- ne pas modifier `workflowProfile.ts` ;
- ne modifier aucun repository ;
- ne modifier aucune migration ;
- ne créer aucun fichier sous `workflow/config` ;
- ne créer aucun chargeur de fichier ;
- ne calculer aucun fingerprint ;
- ne créer aucun service de fichiers ;
- ne modifier aucun IPC, preload ou renderer ;
- ne modifier aucune dépendance ;
- ne modifier aucun `package.json` ;
- aucune action Git.

## API exacte attendue

Créer dans `src/shared/orchestration/workflowProfileConfig.ts` :

1. `workflowProfileCommandConfigSchema`
2. type `WorkflowProfileCommandConfig` dérivé avec `z.infer`
3. `workflowArtifactPathsConfigSchema`
4. type `WorkflowArtifactPathsConfig`
5. `workflowProfileConfigSchema`
6. type `WorkflowProfileConfig`

Exporter ces six éléments depuis `src/shared/orchestration/index.ts`.

## Structure exacte du profil

```json
{
  "schemaVersion": 1,
  "profileKey": "string",
  "name": "string",
  "version": "string",
  "validationCommands": [],
  "artifactPaths": {
    "promptsDirectory": "string",
    "reportsDirectory": "string"
  },
  "manualValidationChecklist": []
}
```

## Décisions techniques imposées

1. Tous les objets Zod créés dans cette phase doivent utiliser `.strict()`.
2. Aucun `.default()`, aucune coercition, aucun `.catch()`.
3. `schemaVersion` est le littéral numérique `1`.
4. `profileKey` : trim ; non vide ; regex kebab-case stricte `^[a-z0-9]+(?:-[a-z0-9]+)*$`.
5. `name` : trim ; non vide.
6. `version` : trim ; regex `^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$` ; ne pas accepter le préfixe `v` ; ne pas accepter de prerelease ou build metadata dans cette V1.
7. Chaque commande de validation contient exactement : `key`, `name`, `command`, `args`, `blocking`, `timeoutMs`.
8. `key` : kebab-case avec la même regex que `profileKey` ; unique dans `validationCommands`.
9. `name` et `command` : trim ; non vides.
10. `command` représente un exécutable unique, pas une ligne shell. Refuser au minimum les commandes contenant : espaces, tabulations, retours à la ligne, opérateurs shell évidents (`&&`, `||`, `;`, `|`, `>`, `<`). Ne pas créer un parseur shell général.
11. `args` : tableau de chaînes ; tableau vide accepté ; chaque argument non vide après trim ; conserver la chaîne fournie, sans concaténation en commande unique.
12. `blocking` : booléen obligatoire ; aucune valeur par défaut.
13. `timeoutMs` : entier obligatoire ; minimum 1000 ; maximum 1800000 ; aucune valeur par défaut.
14. `validationCommands` : tableau non vide ; clés uniques ; ordre conservé ; aucun champ `position` dans le fichier de configuration.
15. `artifactPaths` contient exactement : `promptsDirectory`, `reportsDirectory`.
16. Chaque chemin déclaré : non vide ; uniquement `/` comme séparateur ; relatif ; ne commence ni ne finit par `/` ; aucun segment vide ; aucun segment `.` ou `..` ; ne commence pas par un lecteur Windows (ex. `C:`) ; n'est pas un chemin UNC ; ne contient aucun backslash. Cette validation est syntaxique — la canonicalisation réelle, la vérification du dépôt et les symlinks appartiennent à ORCH-3.2.1.
17. `manualValidationChecklist` : tableau non vide ; chaque élément non vide après trim ; doublons après trim refusés ; ordre conservé.
18. Ne pas réutiliser directement `workflowProfileSchema` ou `createWorkflowProfileSchema` comme schéma racine du fichier de configuration. Le modèle persistant et le contrat de configuration doivent rester distincts.

## Tests obligatoires

Créer `src/shared/orchestration/workflowProfileConfig.test.ts`, couvrant au minimum :

**Cas valides** : profil minimal complet valide ; plusieurs commandes avec ordre conservé ; commande avec `args` vide ; timeout exactement 1000 ; timeout exactement 1800000 ; chemins `workflow/prompts` et `workflow/reports` ; checklist de plusieurs éléments.

**Cas invalides** : propriété inconnue à la racine ; propriété inconnue dans une commande ; `schemaVersion` différent de 1 ; `profileKey` vide ; `profileKey` non kebab-case ; `version` vide ; `version` non SemVer V1 ; préfixe `v` ; prerelease ; `validationCommands` vide ; clés de commandes dupliquées ; `key` invalide ; `name` vide ; `command` vide ; `command` contenant des espaces ; `command` contenant un opérateur shell ; argument vide ; `blocking` absent ; `timeoutMs` absent ; `timeoutMs` non entier ; `timeoutMs` inférieur à 1000 ; `timeoutMs` supérieur à 1800000 ; chemin absolu Unix ; chemin absolu Windows ; chemin UNC ; chemin contenant `..` ; chemin contenant `.` comme segment ; chemin contenant un backslash ; chemin commençant ou finissant par `/` ; checklist vide ; élément vide ; doublon après trim.

## Qualité attendue

- Messages Zod suffisamment explicites pour identifier le champ en erreur.
- Pas de dépendance externe supplémentaire.
- Pas de duplication évitable des validateurs internes.
- Les helpers privés locaux sont autorisés dans `workflowProfileConfig.ts`.
- Ne pas créer une abstraction générique prématurée dans `common.ts`.

## Auto-review obligatoire

Après l'implémentation et les tests ciblés :

1. relire le diff complet ;
2. vérifier que le contrat est distinct du modèle persistant ;
3. vérifier les objets stricts ;
4. vérifier l'absence de défauts ou coercions ;
5. vérifier l'unicité des clés de commandes ;
6. vérifier les règles de chemins Windows et Unix ;
7. vérifier que les tests couvrent réellement les bornes et cas négatifs ;
8. corriger immédiatement tout défaut certain et non ambigu découvert ;
9. ne pas appliquer de choix architectural non prévu.

## Conditions d'arrêt humain

Arrêter l'intervention sans appliquer de solution si :

- les schémas existants rendent ce contrat incompatible sans modifier `workflowProfile.ts` ;
- une contradiction existe entre les documents ;
- une modification d'un modèle persistant, repository ou migration semble nécessaire ;
- une dépendance supplémentaire semble nécessaire ;
- une règle demandée présente une ambiguïté architecturale importante.

Dans ce cas, expliquer : le blocage, les options, les impacts, la recommandation, la décision attendue.

## Validations à exécuter après la dernière modification

```bash
npm run typecheck
npx vitest run src/shared/orchestration/workflowProfileConfig.test.ts --maxWorkers=1
git diff --check
git status --short --untracked-files=all
```

Ne pas lancer la suite Vitest complète ni `npm run build` : ils seront exécutés lors d'ORCH-3.1.V, sauf si une modification imprévue plus large les rend nécessaires.

## Rapport consolidé

Créer `workflow/reports/RAPPORT_ORCH_3.1.1.md`, contenant :

1. résumé ;
2. fichiers créés et modifiés ;
3. API exportée ;
4. contrat exact implémenté ;
5. décisions techniques appliquées ;
6. tests ajoutés et nombre total ;
7. auto-review effectuée et éventuelles corrections autonomes ;
8. responsabilités explicitement reportées ;
9. résultats des validations ciblées ;
10. git status final ;
11. confirmation qu'aucun `git add`, `commit` ou `push` n'a été exécuté.

## Interdictions Git

- Aucun `git add`.
- Aucun commit.
- Aucun push.
