# Rapport — Phase 3.5 : Schémas partagés et repository des phases

## Résumé

- **Objectif** : implémenter la couche métier (schémas Zod partagés) et la couche SQLite (repository) nécessaires à la gestion des phases d'un projet — liste par projet, lecture, création, modification, suppression, gestion minimale des positions — sans exposer ces opérations au renderer.
- **Résultat obtenu** : l'ensemble du périmètre demandé a été implémenté et testé. `npm run typecheck`, `npm run test` et `npm run build` passent tous les trois.
- **Statut final** : **terminé**.

> **Note** : une review indépendante (`workflow/reports/REVIEW_PHASE_3.5.md`) a identifié un défaut important après la livraison initiale de cette phase, concernant la mise à jour partielle des phases et des projets. Il a été corrigé ; le détail complet figure dans `workflow/reports/RAPPORT_CORRECTIONS_REVIEW_PHASE_3.5.md`. Le présent rapport a été mis à jour pour refléter l'état corrigé du code et des tests (voir section « Corrections post-review »).

## Schéma SQL observé

Source : `src/main/database/migrations/0001_createInitialMvpSchema.ts` (migration déjà existante, non modifiée).

```sql
CREATE TABLE phases (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (trim(name) <> ''),
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (project_id, position)
);

CREATE INDEX idx_phases_project_id ON phases(project_id);
```

- **Colonnes réelles** : `id`, `project_id`, `name`, `description`, `position`, `status`, `created_at`, `updated_at`.
- **Contraintes** : `name` non vide après `trim()` ; `position` entière `>= 0`, avec `DEFAULT 0` ; `status` limité à `pending`/`in_progress`/`completed` (**pas** `planned`/`cancelled`, valeurs de l'exemple indicatif du prompt, non retenues) ; **`UNIQUE (project_id, position)`** — deux phases d'un même projet ne peuvent jamais partager la même position.
- **Clé étrangère** : `project_id REFERENCES projects(id) ON DELETE CASCADE` — la suppression d'un projet supprime en cascade toutes ses phases.
- **Relation indirecte** : `tasks.phase_id REFERENCES phases(id) ON DELETE SET NULL` (table `tasks`, même migration) — la suppression d'une phase met `phase_id` à `NULL` sur les tâches liées, sans les supprimer.
- **Index** : `idx_phases_project_id` sur `phases(project_id)`.
- **Pas de `DEFAULT`** sur `status` : comme pour `projects.status` en phase 3.1, la valeur par défaut est une décision applicative, pas SQL.

## Fichiers créés

- `src/shared/schemas/phase.ts` — statuts, schéma de lecture, schéma de création, schéma de mise à jour, types dérivés. Corrigé après review (voir « Corrections post-review »).
- `src/shared/schemas/phase.test.ts` — 42 tests unitaires des schémas (38 initiaux + 4 issus de la correction).
- `src/main/database/repositories/phasesRepository.ts` — repository SQLite des phases (`listByProjectId`, `getById`, `create`, `update`, `remove`). Corrigé après review.
- `src/main/database/repositories/phasesRepository.test.ts` — 37 tests unitaires et relationnels du repository (31 initiaux + 6 issus de la correction).

## Fichiers modifiés

Initialement aucun. Après la review indépendante, deux fichiers existants du module `projects` ont été corrigés pour rester cohérents avec `phases` (voir « Corrections post-review ») :

- `src/shared/schemas/project.ts` — correction de `updateProjectSchema` (règle de mise à jour vide).
- `src/main/database/repositories/projectsRepository.ts` — correction de la boucle de construction de l'`UPDATE` dynamique.
- `src/shared/schemas/project.test.ts` — 4 tests ajoutés.
- `src/main/database/repositories/projectsRepository.test.ts` — 2 tests ajoutés.

Aucune migration, aucun fichier IPC/preload/renderer, aucun fichier de l'interface CRUD des projets (React) n'a été touché à aucun moment de cette phase ni de sa correction.

## Schémas Zod et types

### Statuts

```ts
export const PHASE_STATUSES = ['pending', 'in_progress', 'completed'] as const
export const phaseStatusSchema = z.enum(PHASE_STATUSES)
export type PhaseStatus = z.infer<typeof phaseStatusSchema>
```

Valeurs déduites strictement de la contrainte CHECK réelle (aucune valeur inventée).

### Schéma de lecture (`phaseSchema` / `Phase`)

Reflète exactement les colonnes SQL, en camelCase :

```ts
{
  id: string        // z.uuid()
  projectId: string // z.uuid()
  name: string       // non vide après trim (miroir du CHECK SQL)
  description: string | null
  status: PhaseStatus
  position: number   // entier >= 0
  createdAt: string  // z.iso.datetime()
  updatedAt: string  // z.iso.datetime()
}
```

Mode `.strict()`, comme `projectSchema`.

### Schéma de création (`createPhaseSchema` / `CreatePhaseInput`)

- **Obligatoire** : `projectId` (UUID), `name` (texte normalisé `trim()`, non vide).
- **Optionnel** : `description` (nullable, texte normalisé), `status` (valeur par défaut applicative `'pending'` via `.default('pending')`), `position` (optionnelle — si absente, le repository calcule la position suivante).
- **Interdit** : `id`, `createdAt`, `updatedAt` (absents du schéma, `.strict()` refuse tout champ inconnu).
- **Type exporté** : `CreatePhaseInput = z.input<typeof createPhaseSchema>` — type d'*entrée* (et non `z.infer`/sortie), pour que `status` reste optionnel côté appelant malgré sa valeur par défaut résolue par Zod. Même raisonnement que la correction déjà appliquée à `CreateProjectInput` en phase 3.3.

### Schéma de mise à jour (`updatePhaseSchema` / `UpdatePhaseInput`)

- Champs modifiables, tous optionnels : `name`, `description`, `status`, `position`.
- **`projectId` volontairement exclu** : aucune décision existante n'autorise le déplacement d'une phase vers un autre projet ; ce schéma ne l'accepte donc pas (`.strict()` refuse ce champ s'il est fourni).
- Un objet vide `{}` est refusé (`.refine(...)`), comme pour `updateProjectSchema`.
- `{ description: null }` efface volontairement la description ; un champ absent la préserve — distinction garantie par `.partial()` (clé absente ≠ clé présente à `undefined`).

### Règle des mises à jour vides (corrigée après review)

Un objet sans aucune clé est rejeté par un `.refine()` explicite, comme pour `updateProjectSchema`. **Ce `.refine()` a été corrigé après la review indépendante** : il testait initialement `Object.keys(data).length > 0`, ce qui comptait les clés *présentes* et non les clés *dont la valeur est réellement définie*. Or, avec Zod, une clé fournie explicitement à `undefined` (ex. `{ description: undefined }`, obtenu couramment par étalement d'un objet partiel comme `{ ...changes }`) reste une clé propre de l'objet parsé — `Object.keys(...)` la comptait donc à tort comme une modification réelle. La règle est désormais `Object.values(data).some((value) => value !== undefined)`, qui exige qu'au moins une valeur soit réellement définie. `null` reste une valeur définie (donc toujours valide pour effacer un champ nullable) ; seul `undefined` est désormais correctement ignoré. Voir « Corrections post-review » pour le détail complet, la reproduction du défaut et les tests ajoutés.

## Repository

Fichier : `src/main/database/repositories/phasesRepository.ts`. Factory-fonction `createPhasesRepository(database, options?)`, même forme que `createProjectsRepository` (connexion `better-sqlite3` injectée, jamais ouverte/fermée par le repository ; `options.now` pour une horloge injectable en tests).

Signatures exactes :

```ts
listByProjectId(projectId: string): Phase[]
getById(id: string): Phase | null
create(input: CreatePhaseInput): Phase
update(id: string, input: UpdatePhaseInput): Phase | null
remove(id: string): boolean
```

- **Mapping** : `mapRowToPhase(row: PhaseRow): Phase` convertit `project_id → projectId`, `created_at → createdAt`, `updated_at → updatedAt`, valide via `phaseSchema.parse(...)` (aucune confiance aveugle en une conversion non vérifiée, aucun `any`).
- **Requêtes préparées** une fois à la création du repository : `listByProjectStatement`, `getByIdStatement`, `nextPositionStatement`, `insertStatement`, `deleteStatement`. Seul `update` construit dynamiquement sa requête, en réutilisant exactement la stratégie déjà validée de `projectsRepository` (`UPDATABLE_COLUMNS_BY_FIELD`, table fermée de correspondance champ → colonne, jamais de nom de colonne fourni par l'appelant).
- **`create`** est enveloppé dans une transaction courte (`database.transaction(...)`) regroupant le calcul de la position suivante et l'insertion — décision documentée ci-dessous (section Positions).
- **Projet parent inexistant** : aucune vérification applicative ; la clé étrangère SQLite (`ON DELETE CASCADE` implique la présence de la contrainte de référence) fait échouer l'insertion nativement, testé explicitement.

## Positions

- **Position initiale** : `0` (première phase d'un projet), conforme au `DEFAULT 0` du SQL.
- **Calcul automatique** : `SELECT COALESCE(MAX(position), -1) + 1 FROM phases WHERE project_id = @projectId` — ajoute la nouvelle phase à la fin des phases *du même projet*.
- **Isolation par projet** : le calcul filtre strictement sur `project_id` ; testé explicitement (position 0 dans un nouveau projet même si un autre projet a déjà des phases à des positions élevées).
- **Tri** : `ORDER BY position ASC, created_at ASC, id ASC`. Le critère principal (`position`) suffit en pratique grâce à `UNIQUE (project_id, position)` — deux phases du même projet ne peuvent jamais avoir la même position — mais les critères secondaires sont conservés par défensivité et lisibilité (documenté en commentaire dans le code).
- **Égalités** : structurellement impossibles au sein d'un même projet grâce à la contrainte `UNIQUE`. Une tentative de `create` ou `update` avec une position déjà occupée dans le même projet lève une erreur SQLite (`UNIQUE constraint failed`), qui remonte telle quelle sans être masquée — testé explicitement (`refuse de déplacer la position vers une position déjà occupée...`).
- **Limites du réordonnancement (volontaires, hors périmètre de cette phase)** : aucun décalage automatique des autres phases n'est implémenté ; modifier explicitement la position d'une phase vers une valeur déjà utilisée par une autre phase du même projet échoue au lieu de réorganiser les positions existantes. Le drag-and-drop, le déplacement haut/bas, la résolution de collisions et le réordonnancement transactionnel global sont explicitement réservés à une phase ultérieure de la roadmap.
- **Atomicité de la création (justification corrigée après review)** : le calcul de la position suivante et l'insertion sont regroupés dans une transaction `better-sqlite3` courte, qui garantit l'atomicité de l'opération composée « calcul de la prochaine position + insertion » — si `insertStatement.run` échoue après un calcul de position par ailleurs correct (par ex. une contrainte violée), la transaction évite qu'une écriture partielle ne persiste. **La justification initiale (« protège contre plusieurs appels rapides depuis plusieurs handlers IPC ») a été corrigée** après la review indépendante, qui a démontré qu'elle était trompeuse : `better-sqlite3` est strictement synchrone et Node.js exécute ce code sur un seul thread, si bien qu'un appel à `create()` s'exécute intégralement avant qu'un autre (même déclenché par un futur handler IPC distinct) puisse commencer — ce scénario de concurrence n'existe donc pas dans cette architecture. La transaction reste conservée (elle est correcte et utile pour la raison réelle exposée ci-dessus), seule sa justification documentée a été reformulée, dans le code (commentaire au-dessus de `runCreate`) et dans ce rapport.

## Relations

Résultats des tests relationnels (tous verts) :

- **Phase liée à un projet existant** : `create` réussit et persiste `project_id` correctement (`crée une phase avec les champs minimaux`, vérifie `phase.projectId === project.id`).
- **Refus d'une phase orpheline** : `create({ projectId: <uuid inexistant>, name: ... })` lève une erreur SQLite (contrainte de clé étrangère) ; vérifié qu'aucune ligne n'est insérée dans `phases` malgré la tentative (`échoue si le projet parent n'existe pas, sans insérer de phase orpheline`).
- **Suppression du projet parent** : `projectsRepository.remove(project.id)` supprime en cascade toutes les phases du projet (`ON DELETE CASCADE` lu dans la migration, jamais supposé) ; vérifié via `getById` (retourne `null` pour chaque phase) et `listByProjectId` (retourne `[]`) (`supprime en cascade les phases lors de la suppression du projet parent`).
- **Comportement des tâches lors de la suppression d'une phase** : testé directement (insertion SQL minimale d'une ligne `tasks` référençant la phase, en réutilisant les colonnes exactes de la migration, sans implémenter le repository des tâches) — après `phasesRepository.remove(phase.id)`, `tasks.phase_id` de la tâche liée est bien `NULL` (`ON DELETE SET NULL`, confirmé par lecture de la migration, jamais deviné).
- **Clés étrangères actives** : vérifié explicitement par `db.pragma('foreign_keys', { simple: true })` → `1`, en plus de la preuve pratique apportée par le test de refus de phase orpheline (qui échouerait silencieusement si les clés étrangères étaient désactivées).

## Tests

### Fichiers de tests ajoutés (ou complétés après review)

- `src/shared/schemas/phase.test.ts` — 42 tests (38 initiaux + 4 ajoutés lors de la correction).
- `src/main/database/repositories/phasesRepository.test.ts` — 37 tests (31 initiaux + 6 ajoutés lors de la correction).
- `src/shared/schemas/project.test.ts` — 4 tests ajoutés lors de la correction (fichier préexistant, phase 3.1).
- `src/main/database/repositories/projectsRepository.test.ts` — 2 tests ajoutés lors de la correction (fichier préexistant, phase 3.2).

### Scénarios couverts

**Schémas** (`phase.test.ts`) : chaque statut autorisé accepté + statut inconnu refusé ; phase complète valide ; UUID de phase invalide ; UUID de projet invalide ; nom vide / uniquement espaces ; description nullable (`null` et renseignée) ; position valide (0), négative refusée, non entière refusée ; `createdAt`/`updatedAt` invalides refusés ; champ obligatoire absent refusé ; création minimale (statut par défaut `pending`, position absente) ; création complète ; normalisation `trim()` ; id de projet invalide en création ; nom vide en création ; statut/position invalides en création ; champs techniques et champs inconnus refusés en création ; mise à jour partielle simple et multiple ; effacement de `description` à `null` ; modification de `position` seule ; objet vide refusé ; nom vide refusé ; statut/position invalides refusés ; champs techniques refusés ; `projectId` refusé en mise à jour (déplacement entre projets non autorisé) ; **une clé unique à `undefined` refusée ; plusieurs clés à `undefined` refusées ; `{ description: null }` toujours accepté ; un objet mêlant une clé `undefined` et une clé réellement définie accepté, la clé `undefined` restant `undefined` dans la sortie parsée** (4 tests issus de la correction).

**Repository** (`phasesRepository.test.ts`) : clés étrangères actives ; liste vide ; isolation entre projets (deux projets, phases strictement filtrées) ; tri par position croissante ; indépendance du contenu/tri par rapport aux autres projets ; lecture par identifiant (existant/absent) ; création minimale (UUID, rattachement, statut par défaut, timestamps identiques à la création, position calculée) ; création complète ; normalisation `trim()` ; refus d'une phase orpheline sans insertion ; refus d'une création invalide sans insertion ; position automatique (première phase à 0, phase suivante en fin de liste, indépendance entre projets, position explicite respectée) ; mise à jour d'un seul champ ; préservation des champs absents ; `createdAt` inchangé / `updatedAt` modifié (horloge injectée, même stratégie que `projectsRepository`) ; effacement de description ; modification de position reflétée dans `listByProjectId` ; refus d'une position en collision (`UNIQUE`) ; mise à jour d'une phase inexistante → `null` ; objet vide refusé ; aucune modification enregistrée si la validation échoue ; suppression (succès, invisibilité après suppression, `false` pour identifiant absent, `false` en seconde suppression) ; cascade de suppression des phases à la suppression du projet ; `SET NULL` sur les tâches liées à la suppression d'une phase (assertion `expect(task).toBeDefined()` ajoutée avant l'accès à `phase_id`). **Ajoutés lors de la correction (6 tests)** : une clé `undefined` mélangée à une vraie modification est ignorée sans effacer la valeur existante ; un objet ne contenant que des clés `undefined` est refusé avant toute requête SQL ; le calcul automatique reprend correctement après une position explicite élevée (`MAX+1`) ; une création avec une position explicite déjà occupée dans le même projet échoue sans créer de phase supplémentaire ; une position explicite à `0` est respectée même si le projet a déjà des phases à des positions plus élevées ; une collision de position lors d'un `update` ne modifie aucun champ de la ligne existante.

### Nombre total de fichiers de tests et résultats

- Phase 3.5 (schémas + repository des phases) après correction : **79 tests** (42 + 37, contre 69 initialement).
- Corrections apportées au module `projects` (phases 3.1/3.2) : **6 tests supplémentaires** (4 + 2).
- Suite complète du dépôt après correction : **16 fichiers de test, 292 tests, 292 réussis, 0 échoué** (contre 276 avant correction).

## Commandes exécutées

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

 Test Files  16 passed (16)
      Tests  292 passed (292)
```

### `npm run build`
```
> theme-factory-companion@1.0.0 build
> electron-vite build

✓ 14 modules transformed. (main)
out/main/index.js  21.07 kB
✓ 3 modules transformed. (preload)
out/preload/index.js  1.37 kB
✓ 119 modules transformed. (renderer)
../../out/renderer/index.html                 0.41 kB
../../out/renderer/assets/index-Db_lNiml.css  6.06 kB
../../out/renderer/assets/index-YRXr7EKw.js   700.29 kB
```
Build réussi sans erreur.

## Corrections post-review

Une review indépendante (`workflow/reports/REVIEW_PHASE_3.5.md`) a identifié un défaut **IMPORTANT**, confirmé par exécution réelle (pas seulement par lecture), détaillé intégralement dans `workflow/reports/RAPPORT_CORRECTIONS_REVIEW_PHASE_3.5.md`. Résumé :

**Défaut** : dans `updatePhaseSchema` et `updateProjectSchema`, la règle rejetant les mises à jour vides testait `Object.keys(data).length > 0`, qui compte les clés *présentes* et non les clés *dont la valeur est définie*. Une clé fournie explicitement à `undefined` (ex. `{ description: undefined }`, un motif courant en JavaScript lors d'un étalement d'objet partiel `{ ...changes }`) passait donc ce contrôle. Ensuite, dans `phasesRepository.update`/`projectsRepository.update`, la garde de boucle `if (!(field in data)) continue` laissait passer cette même clé (l'opérateur `in` teste la présence, pas la valeur), et `data[field] ?? null` transformait `undefined` en `null` avant l'écriture SQL — effaçant silencieusement un champ nullable existant, ou provoquant une erreur SQLite brute (`NOT NULL constraint failed`) pour un champ obligatoire.

**Correction appliquée** (identique dans les deux modules pour rester cohérente) :
- `updatePhaseSchema`/`updateProjectSchema` : le `.refine()` teste désormais `Object.values(data).some((value) => value !== undefined)`.
- `phasesRepository.update`/`projectsRepository.update` : la garde de boucle est désormais `if (!(field in data) || data[field] === undefined) continue`.

**Distinction clé absente / `undefined` / `null` après correction** :
- **Clé absente** de l'objet de mise à jour → champ préservé (comportement inchangé).
- **Clé présente avec `undefined`** → désormais **ignorée comme si elle était absente** (comportement corrigé : ne provoque plus ni écrasement ni erreur).
- **Clé présente avec `null`** (sur un champ nullable) → efface volontairement le champ (comportement inchangé, toujours la seule façon d'effacer une valeur).

Les tests de non-régression ajoutés, le nombre final de tests et les résultats complets figurent dans `workflow/reports/RAPPORT_CORRECTIONS_REVIEW_PHASE_3.5.md`.

## Limites et écarts

- **Défaut de mise à jour identifié et corrigé après review** : voir section « Corrections post-review » ci-dessus. Ce défaut préexistait à l'identique dans `projectsRepository`/`updateProjectSchema` depuis la phase 3.2 (jamais signalé jusqu'à la review de cette phase) ; il a été corrigé dans les deux modules pour rester cohérent.
- **Aucun test non réalisé parmi ceux explicitement demandés** : tous les scénarios listés dans les sections 5.5, 14 et 15 du prompt initial, ainsi que les tests complémentaires demandés par la review, ont été implémentés.
- **Réordonnancement complet volontairement absent** : conforme au périmètre strict (section 13 du prompt). Modifier la position d'une phase vers une valeur déjà occupée par une autre phase du même projet échoue (contrainte `UNIQUE`) plutôt que de décaler automatiquement les autres phases. Le drag-and-drop, le déplacement haut/bas et la résolution de collisions sont réservés à une phase ultérieure de la roadmap (probablement 3.6 ou une phase dédiée au réordonnancement).
- **Aucune migration modifiée** : le schéma SQL existant est resté strictement inchangé, aucune incohérence bloquante n'a été détectée entre le schéma réel et les besoins de cette phase.
- **Aucun handler IPC, aucune API preload, aucune interface React** n'a été ajouté, conformément au périmètre strict — le repository n'est utilisable qu'en interne au main process et par les tests à ce stade.
- **Décision temporaire documentée** : le statut par défaut `'pending'` en création est une convention applicative (pas de `DEFAULT` SQL sur cette colonne), choisie par cohérence avec le premier statut du vocabulaire CHECK et avec la logique déjà retenue pour `projects.status`. Cette décision est identique dans son principe à celle déjà actée pour les projets en phase 3.1.
- **Points réservés aux phases suivantes** : exposition IPC/preload des phases, interface React de gestion des phases, moteur de réordonnancement complet, repository des tâches — tous explicitement hors périmètre de cette phase 3.5.

## Validation manuelle

Cette phase ne crée aucune interface utilisateur ; la validation manuelle proposée est purement technique et n'a **pas** été effectuée par l'utilisateur à ce stade (à réaliser après lecture de ce rapport) :

- vérifier ce rapport (`workflow/reports/RAPPORT_PHASE_3.5.md`) ainsi que `workflow/reports/REVIEW_PHASE_3.5.md` et `workflow/reports/RAPPORT_CORRECTIONS_REVIEW_PHASE_3.5.md` ;
- vérifier les résultats de `npm run typecheck`, `npm run test` (292/292) et `npm run build` ci-dessus ;
- vérifier le diff (`git status --short`, `git diff --stat`, `git diff` ci-dessous) : des fichiers nouveaux dans `src/shared/schemas/`, `src/main/database/repositories/`, `workflow/`, ainsi que des modifications de `src/shared/schemas/project.ts` et `src/main/database/repositories/projectsRepository.ts` (correction du défaut hérité), doivent apparaître ;
- confirmer qu'aucun fichier `src/main/ipc/*`, `src/preload/*`, `src/shared/contracts/*`, `src/renderer/*` ou de migration n'a été modifié.

## Git

```powershell
git status --short
```
```
 M src/main/database/repositories/projectsRepository.test.ts
 M src/main/database/repositories/projectsRepository.ts
 M src/shared/schemas/project.test.ts
 M src/shared/schemas/project.ts
?? src/main/database/repositories/phasesRepository.test.ts
?? src/main/database/repositories/phasesRepository.ts
?? src/shared/schemas/phase.test.ts
?? src/shared/schemas/phase.ts
?? workflow/prompts/PHASE_3.5_CORRECTIONS_PROMPT.md
?? workflow/prompts/PHASE_3.5_PROMPT.md
?? workflow/prompts/PHASE_3.5_REVIEW_PROMPT.md
?? workflow/reports/RAPPORT_PHASE_3.5.md
?? workflow/reports/REVIEW_PHASE_3.5.md
```

Les quatre fichiers modifiés (`M`) correspondent exclusivement à la correction du défaut IMPORTANT identifié par la review (voir « Corrections post-review »), appliquée par cohérence au module `projects` préexistant.

```powershell
git diff --stat
```
```
 .../repositories/projectsRepository.test.ts        | 29 ++++++++++++++++++++++
 .../database/repositories/projectsRepository.ts    |  7 +++++-
 src/shared/schemas/project.test.ts                 | 21 ++++++++++++++++
 src/shared/schemas/project.ts                      | 11 ++++++--
 4 files changed, 65 insertions(+), 3 deletions(-)
```

```powershell
git ls-files --others --exclude-standard
```
```
src/main/database/repositories/phasesRepository.test.ts
src/main/database/repositories/phasesRepository.ts
src/shared/schemas/phase.test.ts
src/shared/schemas/phase.ts
workflow/prompts/PHASE_3.5_CORRECTIONS_PROMPT.md
workflow/prompts/PHASE_3.5_PROMPT.md
workflow/prompts/PHASE_3.5_REVIEW_PROMPT.md
workflow/reports/RAPPORT_PHASE_3.5.md
workflow/reports/REVIEW_PHASE_3.5.md
```

(`workflow/reports/RAPPORT_CORRECTIONS_REVIEW_PHASE_3.5.md` s'ajoute à cette liste une fois créé, voir ce fichier pour le rapport de correction détaillé.)

Aucun commit n'a été effectué.

Message de commit proposé :

```text
feat: add phases schemas and repository
```
