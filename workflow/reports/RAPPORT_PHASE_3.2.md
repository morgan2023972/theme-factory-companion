# Rapport — Phase 3.2 : Repository projects

## 1. Fichiers inspectés

- `src/main/database/database.ts`
- `src/main/database/database.test.ts`
- `src/main/database/databaseHealth.ts`
- `src/main/database/databasePath.ts`
- `src/main/database/databasePath.test.ts`
- `src/main/database/migrations/migrationTypes.ts`
- `src/main/database/migrations/runMigrations.ts`
- `src/main/database/migrations/migrations.ts`
- `src/main/database/migrations/0001_createInitialMvpSchema.ts`
- `src/main/database/migrations/0001_createInitialMvpSchema.test.ts`
- `src/shared/schemas/project.ts`
- `src/shared/schemas/project.test.ts`
- `package.json`

## 2. Fichiers créés

- `src/main/database/repositories/projectsRepository.ts`
- `src/main/database/repositories/projectsRepository.test.ts`
- `workflow/reports/RAPPORT_PHASE_3.2.md` (ce rapport)

## 3. Fichiers modifiés

Aucun fichier existant n'a été modifié. Aucune migration, aucun schéma SQL, aucun fichier hors périmètre n'a été touché.

## 4. Forme du repository retenue

- **Factory de fonctions**, pas de classe : `createProjectsRepository(database, options?)`, cohérente avec le style déjà utilisé dans `database.ts` (`openDatabase`, `getDatabase`, etc.) et `databaseHealth.ts` (fonctions pures, pas de classes).
- **Injection de la connexion SQLite** : la connexion `better-sqlite3` (`Database.Database`) est reçue explicitement en premier argument. Le repository ne l'ouvre ni ne la ferme jamais.
- Un second argument optionnel `options: { now?: () => string }` permet d'injecter une horloge déterministe (voir section 9), sans introduire de mécanisme générique de gestion du temps.

## 5. Requêtes préparées ajoutées

Préparées une seule fois à la création du repository :

- `listStatement` — `SELECT ... FROM projects ORDER BY created_at DESC, id DESC`
- `getByIdStatement` — `SELECT ... FROM projects WHERE id = @id` (réutilisée en interne par `getById`, `create` et `update` pour relire une ligne)
- `insertStatement` — `INSERT INTO projects (...) VALUES (@id, @name, ...)`
- `deleteStatement` — `DELETE FROM projects WHERE id = @id`

**Exception documentée** : la requête `UPDATE` est construite dynamiquement à l'intérieur de `update()`, une fois par combinaison de champs fournis, car le nombre de champs à modifier varie selon l'entrée. Cette construction n'utilise jamais de nom de colonne fourni par l'appelant : elle provient exclusivement de la table interne fermée `UPDATABLE_COLUMNS_BY_FIELD` (clé TypeScript → colonne SQL autorisée), conformément à la stratégie explicitement autorisée par les instructions de la phase ("préparer une requête par combinaison utile"). Aucune concaténation de valeur utilisateur dans le SQL : toutes les valeurs passent par des paramètres nommés (`@colonne`).

## 6. Mapping snake_case → camelCase

Effectué dans une fonction unique `mapRowToProject(row: ProjectRow): Project`, utilisée par `list`, `getById`, `create` et `update` :

```text
repository_path   -> repositoryPath
target_technology -> targetTechnology
created_at        -> createdAt
updated_at        -> updatedAt
(autres colonnes : même nom)
```

`mapRowToProject` valide systématiquement l'objet obtenu avec `projectSchema.parse(...)` avant de le retourner : aucune assertion de type (`as Project`) n'est utilisée pour faire confiance aveuglément à la conversion. Seul le cast `as ProjectRow` est utilisé sur le résultat brut `better-sqlite3` (nécessaire, `better-sqlite3` retournant `unknown`/`any`), immédiatement suivi de la validation Zod.

Le type `ProjectRow` (colonnes SQL en snake_case) reste interne au fichier du repository, non exporté.

## 7. Signatures exactes

```ts
export type ProjectsRepositoryOptions = {
  readonly now?: () => string
}

export function createProjectsRepository(
  database: Database.Database,
  options?: ProjectsRepositoryOptions
): ProjectsRepository

export type ProjectsRepository = {
  readonly list: () => Project[]
  readonly getById: (id: string) => Project | null
  readonly create: (input: CreateProjectPayload) => Project
  readonly update: (id: string, input: UpdateProjectInput) => Project | null
  readonly remove: (id: string) => boolean
}
```

Où `CreateProjectPayload = z.input<typeof createProjectSchema>` (voir section 12 pour la justification de ce choix par rapport au type partagé `CreateProjectInput`).

## 8. Stratégie de génération des UUID

`crypto.randomUUID()` (module `node:crypto`), appelé une fois par `create()`, avant l'insertion. Aucune dépendance externe ajoutée.

## 9. Stratégie de génération des timestamps

- Une fonction d'horloge `now: () => string` (par défaut `() => new Date().toISOString()`), injectable via `options.now` à la création du repository.
- `create()` appelle `now()` une seule fois et utilise la même valeur pour `created_at` et `updated_at`.
- `update()` appelle `now()` une seule fois pour produire le nouveau `updated_at` ; `created_at` n'est jamais réécrit (absent de `UPDATABLE_COLUMNS_BY_FIELD`).
- Cette injection reste locale au repository (un seul paramètre optionnel), sans architecture générale de gestion du temps, conformément à la contrainte de périmètre. Elle est utilisée dans un seul test (`met à jour ... updatedAt`) pour garantir deux timestamps distincts de façon déterministe, sans dépendre d'un délai réel entre deux opérations dans la même milliseconde.

## 10. Stratégie choisie pour les mises à jour partielles

1. `updateProjectSchema.parse(input)` — lève une erreur Zod avant toute écriture si l'entrée est invalide ou vide.
2. Lecture de la ligne existante (`findRowById`) — retourne `null` immédiatement si absente, sans toucher à la base.
3. Construction de la liste `assignments`/`params` uniquement à partir des clés réellement présentes dans l'objet validé par Zod (`field in data`), ce qui permet de distinguer un champ absent (non inclus dans `data`, donc non modifié) d'un champ fourni à `null` (inclus dans `data` avec la valeur `null`, donc explicitement écrit en base pour les colonnes nullable).
4. `updated_at` est toujours ajouté aux `assignments`.
5. La requête `UPDATE ... SET <assignments> WHERE id = @id` est préparée et exécutée avec des paramètres nommés.
6. Relecture de la ligne mise à jour via `findRowById` puis `mapRowToProject` pour retourner un `Project` validé.

## 11. Comportement exact en cas de projet absent

- `getById(id)` : retourne `null`, ne lève aucune erreur.
- `update(id, input)` : valide d'abord `input` avec Zod (une entrée invalide lève toujours, même si `id` est absent) ; si l'entrée est valide mais qu'aucune ligne ne correspond à `id`, retourne `null` sans exécuter d'`UPDATE`.
- `remove(id)` : retourne `false` si aucune ligne n'a été supprimée (`result.changes === 0`), ne lève aucune erreur pour une absence normale.

## 12. Validations Zod utilisées

- `createProjectSchema.parse(input)` dans `create()` — normalise (`trim`), applique la valeur par défaut `status: 'planning'`, rejette toute entrée invalide ou tout champ technique non autorisé (schéma `.strict()`).
- `updateProjectSchema.parse(input)` dans `update()` — mêmes règles de normalisation, rejette un objet vide et les champs techniques.
- `projectSchema.parse(...)` dans `mapRowToProject(...)` — valide chaque ligne SQL convertie en camelCase avant de la retourner à l'appelant, pour ne jamais faire confiance à une conversion non vérifiée.

**Décision technique notable** : le type partagé `CreateProjectInput` (`z.infer<typeof createProjectSchema>`, donc le type de *sortie* du schéma) rend `status` obligatoire, car la valeur par défaut y est déjà résolue par Zod. Utiliser ce type tel quel comme paramètre de `create()` aurait empêché tout appel « minimal » (`{ name }`) de typechecker, alors que ce scénario est le comportement normal attendu (statut par défaut `planning`). Le paramètre de `create()` utilise donc `z.input<typeof createProjectSchema>` (type d'entrée du schéma, où `status` reste optionnel), défini localement dans le repository sous le nom `CreateProjectPayload`. Aucune modification n'a été apportée à `src/shared/schemas/project.ts` : c'est un ajustement de typage strictement local au repository, la validation runtime restant strictement identique (`createProjectSchema.parse`).

## 13. Tests ajoutés (`projectsRepository.test.ts`)

40 tests (après correction, voir section 19), organisés par méthode :

- **`list`** (6) : base vide → `[]` ; plusieurs projets retournés ; ordre déterministe par `created_at DESC` (horloge injectée, timestamps distincts) ; critère de tri secondaire `id DESC` à `created_at` identique (insertion directe, deux UUID déterministes) ; conversion snake_case → camelCase ; champs nullable conservés à `null`.
- **`getById`** (3) : projet existant retourné ; identifiant absent → `null` ; conformité au contrat `Project`.
- **`create`** (14) : données minimales ; UUID valide ; timestamps ISO valides ; `createdAt === updatedAt` à la création ; statut par défaut `planning` ; tous les champs renseignés ; normalisation `trim()` ; champs optionnels absents → `null` ; statut explicite respecté ; deux créations → deux identifiants différents ; nom vide refusé ; statut inconnu refusé ; aucun enregistrement créé après échec de validation.
- **`update`** (13) : un seul champ ; plusieurs champs ; champs absents préservés ; remise à `null` d'un champ nullable ; normalisation `trim()` ; `createdAt` inchangé ; `updatedAt` modifié (horloge injectée) ; `id` inchangé ; statut modifié ; projet inexistant → `null` ; objet vide refusé ; nom vide refusé ; aucune modification enregistrée après échec de validation.
- **`remove`** (4) : suppression réussie → `true` ; projet inaccessible après suppression ; identifiant absent → `false` ; les autres projets ne sont pas supprimés.
- **Persistance** (1) : insertion via une première connexion sur fichier temporaire, fermeture, réouverture d'une nouvelle connexion sur le même fichier, recréation du repository, relecture du projet — projet toujours présent et identique. Le répertoire temporaire est supprimé après le test (`rmSync` en `afterEach`).

## 14. Résultat du test de persistance après réouverture

Test `projectsRepository — persistance sur fichier SQLite réel > conserve un projet inséré après fermeture puis réouverture de la connexion` : **passant**. Le projet créé via la première connexion (fichier temporaire réel, migrations appliquées) est retrouvé à l'identique (`toEqual`) via une seconde connexion ouverte après fermeture de la première, en recréant le repository à chaque fois.

## 15. Résultats exacts de la validation

### `npm run typecheck`
```
> theme-factory-companion@1.0.0 typecheck
> tsc -p tsconfig.node.json --noEmit && tsc -p tsconfig.web.json --noEmit
```
Aucune erreur.

### `npm run test`
```
> theme-factory-companion@1.0.0 test
> vitest run

 Test Files  10 passed (10)
      Tests  159 passed (159)
```

### `npm run build`
```
> theme-factory-companion@1.0.0 build
> electron-vite build

✓ 10 modules transformed. (main)
out/main/index.js  14.43 kB
✓ 2 modules transformed. (preload)
out/preload/index.js  0.72 kB
✓ 34 modules transformed. (renderer)
../../out/renderer/index.html                 0.41 kB
../../out/renderer/assets/index-ClcV5aD7.css  2.87 kB
../../out/renderer/assets/index-pDMmlTAk.js   560.85 kB
```
Build réussi sans erreur.

## 16. Limites ou décisions techniques

- **`CreateProjectPayload` local (`z.input`)** : voir section 12. Choix documenté pour préserver le comportement « statut par défaut » sans modifier le contrat partagé de la phase 3.1.
- **`UPDATE` non préparé une seule fois de façon statique** : construction dynamique contrôlée par une table interne fermée de colonnes autorisées, comme explicitement permis par les instructions de cette phase (section « Construction de la requête d'update »).
- **Horloge injectable (`options.now`)** : ajout minimal et local au repository, uniquement pour fiabiliser un test d'égalité de timestamps ; aucune architecture générale de gestion du temps n'a été introduite.
- **Pas d'incohérence bloquante détectée** entre le schéma SQL de `projects`, les schémas Zod de la phase 3.1 et les besoins du repository. La migration, le moteur de migrations et le cycle d'ouverture de la base n'ont pas été modifiés.
- **`getById` en interne** : les méthodes `create` et `update` relisent la ligne après écriture (`findRowById`) plutôt que de reconstruire l'objet retourné à la main, pour garantir que la valeur retournée reflète exactement ce qui est en base et passe par la même validation Zod que `list`/`getById`.

## 19. Correction — PHASE_3.2_CORRECTION_01

**Problème corrigé** : le test `list` d'ordre déterministe créait deux projets via l'horloge réelle (`repository.create(...)` sans `now` injecté) puis supposait que le second projet apparaîtrait toujours en premier. Comme les deux créations pouvaient obtenir le même `created_at` (résolution à la milliseconde), l'ordre secondaire dépendait alors de `id DESC`, portant sur des UUID aléatoires — le test était donc potentiellement intermittent.

**Correction appliquée** (dans `projectsRepository.test.ts`, uniquement ce test et l'ajout d'un test complémentaire — aucun autre fichier touché) :

- Le test `retourne les projets dans un ordre déterministe` crée désormais un repository local via `createProjectsRepository(db, { now: ... })`, avec une horloge injectée renvoyant deux timestamps ISO distincts (`2026-01-01T00:00:00.000Z` puis `2026-01-01T00:00:01.000Z`), garantissant que le second projet a un `created_at` strictement postérieur et doit donc apparaître en premier.
- La requête SQL `ORDER BY created_at DESC, id DESC` du repository n'a **pas été modifiée**.
- Un test distinct a été ajouté pour couvrir explicitement le critère de tri secondaire : `utilise id DESC comme critère de tri secondaire quand created_at est identique`. Il insère directement deux lignes dans `projects` (contournant `repository.create` pour maîtriser précisément `created_at`), avec le même timestamp et deux UUID valides et déterministes dont l'ordre lexical est connu (`00000000-0000-4000-8000-000000000001` et `...002`), puis vérifie que `list()` retourne l'UUID le plus grand en premier.
- Aucun autre comportement du repository n'a été modifié ; aucun autre fichier n'a été refactorisé.

**Nouveaux résultats après correction** :

- `npm run typecheck` → OK, aucune erreur.
- `npm run test` → OK, 10 fichiers de test, **159 tests passants** (+1 par rapport au rapport initial : le nouveau test de critère secondaire).
- `npm run build` → OK, build main/preload/renderer réussi sans erreur (mêmes tailles de bundle qu'à l'origine).
- `git status --short` :
  ```
  ?? src/main/database/repositories/
  ?? workflow/
  ```
  (inchangé : toujours uniquement le nouveau dossier `repositories/` et `workflow/`, aucun fichier suivi modifié).

Aucun commit Git n'a été effectué.

## 17. Sortie exacte de `git status --short`

```
?? src/main/database/repositories/
?? workflow/
```

(`workflow/` était déjà untracked avant cette phase : seul `workflow/prompts/PHASE_3.2_PROMPT.md` — non modifié — y existait ; `workflow/reports/RAPPORT_PHASE_3.2.md` y a été ajouté par cette phase.)

## 18. Confirmation d'enregistrement du rapport

Ce rapport a été enregistré en UTF-8 à l'emplacement :

```text
workflow/reports/RAPPORT_PHASE_3.2.md
```

Aucun autre rapport n'a été écrasé. Aucun commit Git n'a été effectué.
