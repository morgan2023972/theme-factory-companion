# Rapport — ORCH-3.1.2 — Chargeur de profil

## 1. Résumé

Cette sous-phase a créé un chargeur synchrone de fichier de profil (`src/main/orchestration/workflowProfileLoader.ts`) : lecture UTF-8, parsing JSON, validation via `workflowProfileConfigSchema` (ORCH-3.1.1), et une erreur structurée `WorkflowProfileLoadError` distinguant 5 catégories d'échec. Aucune canonicalisation de chemin, aucun calcul d'empreinte, aucun fichier de profil réel n'a été créé — strictement le chargeur, ses tests, le prompt et ce rapport.

## 2. Fichiers créés et modifiés

**Créés :**

- `src/main/orchestration/workflowProfileLoader.ts` — le chargeur.
- `src/main/orchestration/workflowProfileLoader.test.ts` — 17 tests.
- `workflow/prompts/ORCH_3.1.2_PROMPT.md` — le prompt d'implémentation.
- `workflow/reports/RAPPORT_ORCH_3.1.2.md` — le présent rapport.

**Modifié :** aucun fichier existant.

Confirmé par `git status --short --untracked-files=all` : uniquement des fichiers `??` (nouveaux), aucun `M`. `workflowProfileConfig.ts`, `src/shared/orchestration/index.ts`, tout repository, toute migration, `package.json` : tous non touchés.

## 3. API exportée

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
  // `cause` est hérité nativement de `Error` (cible ES2022, voir section 5) —
  // non redéclaré comme champ de classe pour éviter toute redondance/collision
  // avec la déclaration `cause?: unknown` déjà présente dans lib.es2022.error.d.ts.
}

export function loadWorkflowProfile(filePath: string): WorkflowProfileConfig
```

## 4. Catégories d'erreurs

| Code | Déclencheur | Cause conservée |
|---|---|---|
| `FILE_NOT_FOUND` | `filePath` vide/blanc après trim (vérifié avant lecture) **ou** `readFileSync` échoue avec `error.code === 'ENOENT'` | Aucune pour le cas « chemin vide » (pas d'erreur système sous-jacente) ; l'erreur `ENOENT` d'origine pour le cas fichier absent |
| `FILE_NOT_READABLE` | Toute autre erreur de `readFileSync` (répertoire, permission refusée, erreur I/O — ex. `EISDIR`) | L'erreur système d'origine |
| `EMPTY_FILE` | Contenu du fichier vide ou uniquement blanc après trim | Aucune (pas d'erreur système sous-jacente) |
| `INVALID_JSON` | `JSON.parse` lève une exception | La `SyntaxError` d'origine |
| `INVALID_PROFILE` | `workflowProfileConfigSchema.safeParse` échoue | Le `ZodError` (`result.error`) |

**Décision documentée** : le prompt ne précisait pas explicitement quel code utiliser pour un `filePath` vide/blanc (seule la vérification « avant lecture » était imposée, sans lister de code dédié parmi les 5). `FILE_NOT_FOUND` a été retenu : un chemin vide n'identifie aucun fichier, ce qui correspond sémantiquement à ce code, et c'est également le code que produirait naturellement `readFileSync('')` côté Node (`ENOENT`) si la vérification préalable n'existait pas. Ce choix n'a pas été jugé suffisamment ambigu pour justifier un arrêt humain ; il est documenté ici pour traçabilité.

## 5. Stratégie de lecture et validation

1. Vérification de `filePath` (non vide après trim) **avant** toute lecture, sans jamais modifier la valeur réellement transmise à `readFileSync`.
2. `readFileSync(filePath, 'utf8')` — encodage explicite, aucune détection automatique.
3. Distinction `ENOENT` (→ `FILE_NOT_FOUND`) vs toute autre erreur (→ `FILE_NOT_READABLE`) via une garde `isErrnoException` (`value instanceof Error && 'code' in value`).
4. Contenu vide/blanc après trim → `EMPTY_FILE`, avant toute tentative de parsing.
5. `JSON.parse(rawContent)` dans un `try/catch` dédié → `INVALID_JSON` en cas d'échec.
6. `workflowProfileConfigSchema.safeParse(parsedJson)` — **aucune duplication** de la logique de validation : le schéma partagé ORCH-3.1.1 fait foi. En cas d'échec → `INVALID_PROFILE`.
7. Seule `result.data` (jamais `parsedJson` brut) est retournée en cas de succès : aucune valeur partiellement validée ne peut être renvoyée.
8. `WorkflowProfileLoadError` étend nativement `Error` (cible `ES2022`, confirmée dans `tsconfig.node.json` — le paramètre `cause` du constructeur natif d'`Error` est disponible sans polyfill) : `super(message, { cause })` porte la cause, `this.name`/`this.code`/`this.filePath` sont assignés explicitement, `Object.setPrototypeOf` ajouté par défensivité (sans effet réel à cette cible, `class extends Error` fonctionnant déjà correctement en ES2022).
9. Aucun contenu de fichier (JSON brut, objet parsé) n'apparaît dans un message d'erreur : seul `filePath` y figure.

## 6. Tests ajoutés

17 tests dans `workflowProfileLoader.test.ts`, répartis en 5 blocs `describe`, avec répertoire temporaire réel (`mkdtempSync`) créé dans un `beforeEach` et supprimé (`rmSync`, `recursive: true, force: true`) dans un `afterEach` — donc nettoyé même en cas d'échec :

1. **Cas valides** — 5 tests : profil minimal ; profil complet (3 commandes) ; ordre des `validationCommands` préservé ; `args`/checklist préservés ; fichier avec espaces/retours à la ligne autour du JSON.
2. **Entrée `filePath`** — 3 tests : chaîne vide refusée (`FILE_NOT_FOUND`) ; chaîne uniquement espaces refusée (`FILE_NOT_FOUND`) ; chemin conservé tel quel dans `error.filePath` (non modifié silencieusement).
3. **Erreurs de lecture** — 2 tests : fichier absent → `FILE_NOT_FOUND` (cause + `filePath` vérifiés) ; répertoire → `FILE_NOT_READABLE` (cause + `filePath` vérifiés).
4. **Erreurs de contenu** — 6 tests : fichier vide ; fichier uniquement blanc ; JSON invalide (cause `SyntaxError` vérifiée) ; objet incomplet (cause `ZodError` vérifiée) ; propriété inconnue à la racine ; commande de validation invalide (`command` avec espace).
5. **Forme de l'erreur** — 1 test : `instanceof WorkflowProfileLoadError`/`instanceof Error`, `name` exact, `code` exact, message non vide contenant `filePath`.

Conformément à la consigne, les 44 tests détaillés du schéma ORCH-3.1.1 ne sont pas dupliqués : seuls quelques cas représentatifs (objet incomplet, propriété inconnue, commande invalide) confirment que le chargeur délègue correctement au schéma partagé.

## 7. Auto-review effectuée

Les 9 points de l'auto-review obligatoire ont été vérifiés :

1. Diff complet relu (`git status` : uniquement 3 fichiers nouveaux dans le périmètre autorisé, aucune modification).
2. Les 5 catégories d'erreur sont réellement distinguées par des branches de code séparées et chacune couverte par au moins un test dédié.
3. Causes techniques conservées : vérifié par lecture (`{ cause: error }`/`{ cause: result.error }`) et confirmé par 3 tests dédiés (`cause` défini pour `FILE_NOT_FOUND`/`FILE_NOT_READABLE`, `instanceof SyntaxError` pour `INVALID_JSON`, `instanceof ZodError` pour `INVALID_PROFILE`).
4. Aucun message d'erreur n'inclut le contenu du fichier (JSON brut ou objet parsé) : tous les messages ne référencent que `filePath`.
5. Encodage UTF-8 explicite confirmé (`readFileSync(filePath, 'utf8')`).
6. Validation déléguée intégralement à `workflowProfileConfigSchema.safeParse` : aucune règle de validation dupliquée dans le chargeur.
7. Aucune responsabilité d'ORCH-3.1.3 (fingerprint), ORCH-3.1.4 (profil réel du projet) ou ORCH-3.2.1 (canonicalisation/restriction au dépôt) introduite : `filePath` est transmis tel quel à `readFileSync`, sans résolution ni vérification d'appartenance au dépôt.
8. **Un incident d'infrastructure a été rencontré et corrigé par une simple relance** (non un défaut de code) : la première exécution ciblée de Vitest a échoué avec « Vitest failed to find the runner » (0 test exécuté), un problème d'environnement lié à un chevauchement avec une commande `typecheck` lancée juste avant en arrière-plan. Une relance immédiate et isolée a donné 17/17 sans aucune modification de code. Aucun défaut certain n'a par ailleurs été trouvé dans l'implémentation elle-même lors de cette auto-review.
9. Aucun choix architectural non prévu introduit (pas de résolution de chemin, pas de fingerprint, pas de nouveau service).

## 8. Responsabilités explicitement reportées

- La **canonicalisation réelle du chemin**, sa résolution par rapport au dépôt, la détection de traversées de répertoires et la gestion des liens symboliques sont hors périmètre, reportées à ORCH-3.2.1.
- Le **calcul d'une empreinte stable** (fingerprint) du profil chargé est hors périmètre, reporté à ORCH-3.1.3.
- La **création du profil réel du projet** (`workflow/config/project.workflow.json`) est hors périmètre, reportée à ORCH-3.1.4.

## 9. Résultats des validations ciblées

**`npm run typecheck`** :

```text
> theme-factory-companion@1.0.0 typecheck
> tsc -p tsconfig.node.json --noEmit && tsc -p tsconfig.web.json --noEmit
```

Succès, aucune erreur.

**`npx vitest run src/main/orchestration/workflowProfileLoader.test.ts --maxWorkers=1`** :

- 1ʳᵉ tentative : échec d'infrastructure (« Vitest failed to find the runner », 0 test exécuté), sans rapport avec le code produit — voir section 7, point 8.
- 2ᵉ tentative (isolée) : `Test Files 1 passed (1)`, `Tests 17 passed (17)`. Succès intégral.

**`git diff --check`** : exit code 0, aucune sortie.

Conformément aux instructions, la suite Vitest complète et `npm run build` n'ont pas été exécutés à ce stade : réservés à ORCH-3.1.V.

## 10. Résultat de `git status --short --untracked-files=all`

Capturé après l'exécution des validations ciblées, avant la rédaction du présent rapport :

```text
?? src/main/orchestration/workflowProfileLoader.test.ts
?? src/main/orchestration/workflowProfileLoader.ts
?? workflow/prompts/ORCH_3.1.2_PROMPT.md
```

(Le présent rapport, `RAPPORT_ORCH_3.1.2.md`, n'apparaît pas encore dans cette capture puisqu'il est créé juste après.)

## 11. Confirmation

- Aucun fichier hors du périmètre autorisé n'a été créé ou modifié.
- `workflowProfileConfig.ts` et `src/shared/orchestration/index.ts` n'ont subi aucune modification.
- Aucun repository, aucune migration, aucun IPC/preload/renderer, aucune dépendance, aucun `package.json` n'a été modifié.
- Aucun `git add`, `git commit` ou `git push` n'a été exécuté à aucun moment de cette intervention.
