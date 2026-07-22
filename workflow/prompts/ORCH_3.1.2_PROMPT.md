# ORCH-3.1.2 — Chargeur de profil

## Contexte

Cette sous-phase suit le workflow accéléré de développement de l'orchestrateur (voir `docs/orchestration/ORCHESTRATOR_V1_ROADMAP.md`) : objectif unique, tests ciblés, auto-review obligatoire, correction immédiate des défauts certains et rapport consolidé.

État acquis :

- ORCH-3.1.1 est terminée, validée, commitée et poussée.
- Le contrat du fichier de profil existe dans `src/shared/orchestration/workflowProfileConfig.ts`.
- `workflowProfileConfigSchema` et `WorkflowProfileConfig` sont exportés depuis `src/shared/orchestration/index.ts`.
- Aucun fichier réel de profil n'existe encore.
- Aucun fingerprint ne doit être calculé dans cette sous-phase.

## Sources de vérité à lire

- `docs/orchestration/ORCHESTRATOR_V1_SCOPE.md`
- `docs/orchestration/ORCHESTRATOR_V1_WORKFLOW.md`
- `docs/orchestration/ORCHESTRATOR_V1_SAFETY_RULES.md`
- `docs/orchestration/ORCHESTRATOR_V1_ROADMAP.md`
- `docs/CONVENTIONS.md`
- `src/shared/orchestration/workflowProfileConfig.ts`
- `src/shared/orchestration/workflowProfileConfig.test.ts`
- `src/shared/orchestration/index.ts`
- `workflow/reports/RAPPORT_ORCH_3.1.1.md`
- les conventions existantes de gestion d'erreurs et de services sous `src/main`

## Objectif unique

Créer un chargeur synchrone de fichier JSON UTF-8 qui retourne un `WorkflowProfileConfig` entièrement validé ou lève une erreur structurée explicite.

## Fichiers autorisés

- `src/main/orchestration/workflowProfileLoader.ts`
- `src/main/orchestration/workflowProfileLoader.test.ts`
- `workflow/prompts/ORCH_3.1.2_PROMPT.md`
- `workflow/reports/RAPPORT_ORCH_3.1.2.md`

Ne modifier aucun autre fichier sans arrêt humain préalable.

## Fichiers et domaines interdits

- ne pas modifier `workflowProfileConfig.ts` ;
- ne pas modifier `src/shared/orchestration/index.ts` ;
- ne créer aucun fichier sous `workflow/config` ;
- ne calculer aucun fingerprint ;
- ne modifier aucun repository ou migration ;
- ne créer aucun service de prompts ou rapports ;
- ne créer aucun IPC, preload ou renderer ;
- ne modifier aucune dépendance ni `package.json` ;
- aucune action Git.

## API exacte attendue

```ts
export type WorkflowProfileLoadErrorCode =
  | 'FILE_NOT_FOUND'
  | 'FILE_NOT_READABLE'
  | 'EMPTY_FILE'
  | 'INVALID_JSON'
  | 'INVALID_PROFILE'

export class WorkflowProfileLoadError extends Error {
  readonly code: WorkflowProfileLoadErrorCode
  readonly filePath: string
  readonly cause?: unknown
}

export function loadWorkflowProfile(filePath: string): WorkflowProfileConfig
```

## Décisions techniques imposées

1. API synchrone : `readFileSync(filePath, 'utf8')`.
2. Aucun encodage implicite.
3. Ne pas résoudre, canonicaliser ou restreindre `filePath` au dépôt (ORCH-3.2.1).
4. Ne pas tester ici les symlinks ou les traversées de répertoires.
5. Vérifier `filePath` avant lecture : chaîne non vide après trim ; ne pas modifier ou normaliser silencieusement la valeur fournie.
6. Distinguer :
   - `FILE_NOT_FOUND` : fichier ou chemin absent, erreur système `ENOENT`.
   - `FILE_NOT_READABLE` : toute autre erreur de lecture (répertoire, permission refusée, erreur I/O).
   - `EMPTY_FILE` : contenu vide ou uniquement blanc.
   - `INVALID_JSON` : `JSON.parse` lève une `SyntaxError`.
   - `INVALID_PROFILE` : JSON syntaxiquement valide mais refusé par `workflowProfileConfigSchema`.
7. `WorkflowProfileLoadError` étend `Error`, expose `code`/`filePath`, conserve la cause originale quand elle existe, message explicite et stable, `name = 'WorkflowProfileLoadError'`.
8. `FILE_NOT_FOUND`/`FILE_NOT_READABLE` : conserver l'erreur système comme cause.
9. `INVALID_JSON` : conserver la `SyntaxError` comme cause.
10. `INVALID_PROFILE` : conserver la `ZodError` comme cause.
11. Ne jamais retourner de valeur partiellement validée.
12. Ne pas ajouter de valeur par défaut.
13. Ne pas corriger ou normaliser le JSON chargé.
14. Ne pas exposer le contenu complet du fichier dans le message d'erreur.
15. Messages suffisamment explicites pour distinguer lecture impossible / fichier vide / JSON invalide / profil invalide.
16. Aucune dépendance sur Electron, SQLite ou le renderer.

## Tests obligatoires

Créer `src/main/orchestration/workflowProfileLoader.test.ts`, avec répertoire temporaire réel nettoyé systématiquement (même en cas d'échec). Couvrir au minimum :

**Cas valides** : profil minimal ; profil complet ; ordre des `validationCommands` préservé ; `args`/checklist préservés ; fichier UTF-8 avec espaces/retours à la ligne autour du JSON.

**Entrée `filePath`** : chaîne vide refusée ; chaîne uniquement espaces refusée ; chemin non modifié silencieusement.

**Erreurs de lecture** : fichier absent → `FILE_NOT_FOUND` ; répertoire/autre erreur → `FILE_NOT_READABLE` ; cause système conservée ; `filePath` conservé.

**Contenu** : fichier vide → `EMPTY_FILE` ; fichier uniquement espaces → `EMPTY_FILE` ; JSON invalide → `INVALID_JSON` (cause `SyntaxError` conservée) ; objet invalide/propriété inconnue/commande invalide → `INVALID_PROFILE` (cause `ZodError` conservée).

**Type d'erreur** : `instanceof WorkflowProfileLoadError` ; `name` exact ; `code` exact ; message non vide et explicite.

Ne pas dupliquer les 44 tests détaillés du schéma ORCH-3.1.1 : tester seulement que le chargeur délègue correctement la validation au schéma partagé.

## Qualité attendue

Code petit et lisible ; aucune abstraction générique prématurée ; aucune duplication du schéma ; aucun accès réseau ; aucune dépendance externe ; nettoyage fiable des fixtures temporaires ; messages d'erreur stables mais pas inutilement détaillés.

## Auto-review obligatoire

1. relire le diff complet ;
2. vérifier que chaque catégorie d'erreur est réellement distinguée ;
3. vérifier que les causes techniques sont conservées ;
4. vérifier qu'aucun contenu sensible du fichier n'est inclus dans les messages ;
5. vérifier l'encodage UTF-8 explicite ;
6. vérifier que la validation utilise le schéma partagé ;
7. vérifier qu'aucune responsabilité ORCH-3.1.3, ORCH-3.1.4 ou ORCH-3.2.1 n'a été introduite ;
8. corriger immédiatement tout défaut certain et non ambigu ;
9. ne pas prendre de décision architecturale non prévue.

## Conditions d'arrêt humain

Arrêter sans appliquer de solution si : le contrat ORCH-3.1.1 doit être modifié ; une nouvelle dépendance semble nécessaire ; les conventions existantes imposent une API incompatible ; une canonicalisation/restriction du chemin semble indispensable ; un autre fichier de production doit être modifié. Expliquer alors le blocage, les options, les impacts, la recommandation, la décision attendue.

## Validations ciblées

```bash
npm run typecheck
npx vitest run src/main/orchestration/workflowProfileLoader.test.ts --maxWorkers=1
git diff --check
git status --short --untracked-files=all
```

Ne pas lancer la suite Vitest complète ni `npm run build` : réservés à ORCH-3.1.V.

## Rapport consolidé

Créer `workflow/reports/RAPPORT_ORCH_3.1.2.md`, contenant : résumé ; fichiers créés et modifiés ; API exportée ; catégories d'erreurs ; stratégie de lecture et validation ; tests ajoutés et total ; auto-review et corrections autonomes éventuelles ; responsabilités reportées ; résultats des validations ciblées ; git status final ; confirmation qu'aucun `git add`, commit ou push n'a été exécuté.

## Interdictions Git

- Aucun `git add`.
- Aucun commit.
- Aucun push.
