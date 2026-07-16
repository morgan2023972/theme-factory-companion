# Review indépendante — Phase 3.5 : Schémas partagés et repository des phases

Review stricte, en lecture seule (sauf la création de ce fichier), de tous les fichiers créés pour la phase 3.5. Le rapport `workflow/reports/RAPPORT_PHASE_3.5.md` est traité comme une affirmation à vérifier, pas comme une preuve.

## 1. Inspection Git

```powershell
git status --short
```
```
?? src/main/database/repositories/phasesRepository.test.ts
?? src/main/database/repositories/phasesRepository.ts
?? src/shared/schemas/phase.test.ts
?? src/shared/schemas/phase.ts
?? workflow/prompts/PHASE_3.5_PROMPT.md
?? workflow/prompts/PHASE_3.5_REVIEW_PROMPT.md
?? workflow/reports/RAPPORT_PHASE_3.5.md
```

`git diff --stat` et `git diff` sont vides : aucun fichier suivi par Git n'a été modifié par la phase 3.5 (confirme l'affirmation du rapport « aucun fichier modifié »).

Tous les fichiers retournés par `git ls-files --others --exclude-standard` ont été lus intégralement : `src/shared/schemas/phase.ts`, `src/shared/schemas/phase.test.ts`, `src/main/database/repositories/phasesRepository.ts`, `src/main/database/repositories/phasesRepository.test.ts`, `workflow/prompts/PHASE_3.5_PROMPT.md`, `workflow/prompts/PHASE_3.5_REVIEW_PROMPT.md`, `workflow/reports/RAPPORT_PHASE_3.5.md`. Les fichiers de référence ont également été relus intégralement : `src/main/database/migrations/0001_createInitialMvpSchema.ts`, `src/shared/schemas/project.ts`, `src/main/database/repositories/projectsRepository.ts`, `src/main/database/repositories/projectsRepository.test.ts`.

## 2. Validations exécutées pendant la review

### `npm run typecheck`
```
> theme-factory-companion@1.0.0 typecheck
> tsc -p tsconfig.node.json --noEmit && tsc -p tsconfig.web.json --noEmit
```
Aucune erreur. Confirme le rapport.

### `npm run test`
```
> theme-factory-companion@1.0.0 test
> vitest run

 Test Files  16 passed (16)
      Tests  276 passed (276)
```
Confirme exactement le rapport (16 fichiers, 276 tests, tous réussis).

### `npm run build`
```
> theme-factory-companion@1.0.0 build
> electron-vite build

✓ 14 modules transformed. (main)
✓ 3 modules transformed. (preload)
✓ 119 modules transformed. (renderer)
```
Build réussi sans erreur. Confirme le rapport.

### Comptage manuel des tests

- `phase.test.ts` : 4 (statuts) + 14 (`phaseSchema`) + 10 (`createPhaseSchema`) + 10 (`updatePhaseSchema`) = **38 tests**, conforme au rapport.
- `phasesRepository.test.ts` : 1 (FK) + 4 (`listByProjectId`) + 2 (`getById`) + 5 (`create`) + 4 (`create > position automatique`) + 9 (`update`) + 4 (`remove`) + 2 (relations) = **31 tests**, conforme au rapport.
- Total phase 3.5 : 38 + 31 = **69 tests**, conforme au rapport.

## 3. Constat majeur — vérification empirique en direct

Avant de lister les constats classés, un point a été vérifié par exécution réelle (script jetable exécuté puis supprimé, aucune trace laissée — `git status --short` inchangé après coup) car il conditionne la gravité de plusieurs autres points : le comportement de `updatePhaseSchema` et de `phasesRepository.update` face à une clé présente mais explicitement valant `undefined`.

Résultat observé (`npx tsx` sur un script utilisant directement `phasesRepository` réel + SQLite en mémoire) :

```
update({description: undefined}) succeeded, returned: { ..., description: null, ... }
update({name: undefined}) threw: NOT NULL constraint failed: phases.name
```

Confirmé également au niveau du schéma seul (Node/zod isolé) :
```js
updatePhaseSchema-like.safeParse({ description: undefined })
// → { success: true, data: {} }  (JSON.stringify masque la clé, mais :)
Object.keys(parsed) // → ['description']   ('description' in parsed) // → true
```

Voir constat **IMPORTANT #1** ci-dessous pour l'analyse complète.

## 4. Constats classés par gravité

### BLOQUANT

Aucun constat bloquant identifié.

---

### IMPORTANT

#### IMPORTANT #1 — Une clé présente avec la valeur `undefined` est traitée comme une valeur réelle à écrire, effaçant silencieusement les champs nullable et faisant échouer brutalement les champs `NOT NULL`

**Fichiers** :
- `src/shared/schemas/phase.ts:84-95` (`updatePhaseSchema`, en particulier le `.refine((data) => Object.keys(data).length > 0, ...)`)
- `src/main/database/repositories/phasesRepository.ts:176-205` (`update`, en particulier `if (!(field in data)) continue` ligne 191 et `params[column] = data[field] ?? null` ligne 196)

**Problème précis** : `Object.keys(data).length > 0` compte les clés *présentes*, pas les clés *dont la valeur est définie*. Avec Zod (`.partial()`), une clé fournie à `undefined` dans l'entrée reste une clé propre de l'objet parsé (valeur `undefined`), même si `JSON.stringify` la masque. Le `.refine()` ne rejette donc pas `{ description: undefined }` ni `{ name: undefined }` comme des mises à jour vides. Ensuite, dans le repository, `field in data` vaut `true` pour cette clé (l'opérateur `in` teste la présence de la clé, pas sa valeur), et `data[field] ?? null` transforme la valeur `undefined` en `null` avant de l'écrire en SQL.

**Scénario concret de reproduction** (exécuté réellement pendant cette review, voir section 3) :
```ts
const phase = phasesRepository.create({ projectId: project.id, name: 'Phase repro', description: 'Description initiale' })
phasesRepository.update(phase.id, { description: undefined })
// → réussit silencieusement, phase.description devient null en base
phasesRepository.update(phase.id, { name: undefined })
// → lève une erreur SQLite brute : "NOT NULL constraint failed: phases.name"
```

**Risque réel** : pour les champs nullable (`description`), c'est une **perte de donnée silencieuse et réussie**. N'importe quel appelant construisant un objet de mise à jour par assemblage programmatique (par ex. un futur handler IPC ou un formulaire React envoyant `{ ...changes }` où un champ non touché vaut `undefined` en JavaScript) effacera ce champ sans le vouloir, sans erreur, sans avertissement. Pour les champs `NOT NULL` (`name`, `status`, `position`), le risque est moindre en pratique (l'écriture échoue), mais l'erreur qui remonte est une erreur SQLite brute et peu lisible (« NOT NULL constraint failed: phases.name ») au lieu d'un rejet Zod propre — ce qui contredit l'intention affichée du `.refine()` (rejeter une mise à jour qui ne modifie rien).

**Ce défaut n'est pas nouveau ni spécifique à la phase 3.5** : il est vérifié à l'identique dans `updateProjectSchema`/`projectsRepository.ts` (phase 3.2), dont la phase 3.5 a délibérément réutilisé la stratégie (« Réutilise la stratégie de `projectsRepository` si elle est correcte et adaptée », instruction du prompt). Le défaut est donc hérité, pas introduit ici — mais il n'a jamais été signalé lors des reviews précédentes, et cette phase avait l'occasion de le corriger ou, à défaut, de le documenter comme limite connue. Aucune des deux choses n'a été faite.

**Correction recommandée** (à appliquer idéalement aux deux repositories pour rester cohérent) :
- Dans `updatePhaseSchema` (et `updateProjectSchema`), remplacer le `.refine()` par une vérification qui ignore les clés à `undefined` :
  ```ts
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'La mise à jour doit contenir au moins un champ.'
  })
  ```
- Dans `phasesRepository.update` (et `projectsRepository.update`), changer la garde de boucle :
  ```ts
  if (!(field in data) || data[field] === undefined) {
    continue
  }
  ```

**Test de non-régression à ajouter** (`phasesRepository.test.ts`, describe `update`) :
```ts
it("ignore une clé explicitement undefined comme si elle était absente (ne l'efface pas)", () => {
  const project = createTestProject()
  const created = phasesRepository.create({ projectId: project.id, name: 'Phase', description: 'Description initiale' })

  const updated = phasesRepository.update(created.id, { name: 'Nouveau nom', description: undefined } as never)

  expect(updated?.description).toBe('Description initiale')
})
```
Et un test schéma dans `phase.test.ts` (`updatePhaseSchema`) :
```ts
it('refuse un objet ne contenant que des clés à undefined (équivalent à une mise à jour vide)', () => {
  expect(updatePhaseSchema.safeParse({ name: undefined, description: undefined }).success).toBe(false)
})
```

---

### MINEUR

#### MINEUR #1 — Justification de la transaction de `create` exagérée par rapport à ce que `better-sqlite3` peut réellement produire comme risque

**Fichiers** : `src/main/database/repositories/phasesRepository.ts:130-139` (commentaire au-dessus de `runCreate`) ; `workflow/reports/RAPPORT_PHASE_3.5.md`, section « Positions », paragraphe « Concurrence/atomicité ».

**Problème précis** : le commentaire et le rapport justifient la transaction par la nécessité d'éviter une incohérence « si cette méthode est un jour appelée plusieurs fois rapidement... depuis plusieurs handlers IPC ». Or `better-sqlite3` est strictement synchrone, et Node.js exécute tout le code JavaScript d'un même process sur un seul thread : un appel à `create()` s'exécute entièrement, de façon bloquante, avant qu'un autre appel (même déclenché par un autre handler IPC) puisse commencer. Il n'existe donc, dans ce contexte précis, aucun scénario réel où deux appels à `create()` pourraient s'entrelacer entre le calcul de la position et l'insertion — avec ou sans transaction. La transaction n'est donc pas fausse (elle est inoffensive et garantit correctement qu'aucune écriture partielle ne persiste si `insertStatement.run` échouait après le calcul de position), mais sa justification par un risque de concurrence « handlers IPC multiples » est trompeuse : ce risque n'existe pas avec l'architecture synchrone actuelle.

**Risque réel** : aucun risque fonctionnel (la transaction reste inoffensive et légèrement bénéfique). Le risque est uniquement de désinformer un futur lecteur ou mainteneur qui pourrait croire, à tort, que ce genre de garde est nécessaire pour la sécurité des données dans ce contexte synchrone, ou au contraire retirer la transaction en pensant qu'elle ne sert à rien, alors qu'elle protège légitimement (mais pour une autre raison) contre une écriture partielle en cas d'échec de l'insertion.

**Correction recommandée** : reformuler le commentaire (et le paragraphe correspondant du rapport) pour justifier la transaction par l'atomicité lecture-puis-écriture en cas d'échec de l'insertion (ex. contrainte violée après un calcul de position par ailleurs correct), plutôt que par un risque de concurrence multi-appels qui n'existe pas avec une connexion `better-sqlite3` synchrone mono-thread.

#### MINEUR #2 — Absence de test couvrant une position explicite élevée suivie d'une création automatique

**Fichier** : `src/main/database/repositories/phasesRepository.test.ts`, describe `create > position automatique`.

**Problème** : aucun test ne vérifie qu'après une création avec une position explicite élevée (par ex. `10`), une création suivante sans position explicite obtient bien `11` (`MAX(position) + 1`) et non une valeur incohérente. La requête SQL (`COALESCE(MAX(position), -1) + 1`) interroge la table à chaque appel, donc la logique est correcte par construction — vérifié par lecture du code, pas par un défaut réel — mais ce scénario explicitement demandé par le prompt de review n'est pas testé.

**Test à ajouter** :
```ts
it('reprend le calcul automatique après une position explicite élevée', () => {
  const project = createTestProject()
  phasesRepository.create({ projectId: project.id, name: 'Phase haute', position: 10 })
  const next = phasesRepository.create({ projectId: project.id, name: 'Phase suivante' })

  expect(next.position).toBe(11)
})
```

#### MINEUR #3 — Absence de test vérifiant qu'une collision de position lors d'un `update` n'altère aucun autre champ

**Fichier** : `src/main/database/repositories/phasesRepository.test.ts:243-249` (test `refuse de déplacer la position vers une position déjà occupée...`).

**Problème** : le test vérifie uniquement `.toThrow()`, pas l'état de la ligne après l'échec. Le comportement réel a été vérifié empiriquement pendant cette review (script `better-sqlite3` direct, section démontrant qu'une `UPDATE` multi-colonnes échouant sur `UNIQUE` ne modifie aucune colonne de la ligne, conformément à l'atomicité par instruction de SQLite) : **le code est correct**, seule la preuve par un test explicite manque.

**Test à ajouter** :
```ts
it('ne modifie aucun champ si la collision de position fait échouer la mise à jour', () => {
  const project = createTestProject()
  const first = phasesRepository.create({ projectId: project.id, name: 'Première', position: 0 })
  phasesRepository.create({ projectId: project.id, name: 'Deuxième', position: 1 })

  expect(() => phasesRepository.update(first.id, { name: 'Renommée', position: 1 })).toThrow()

  const stillFirst = phasesRepository.getById(first.id)
  expect(stillFirst?.name).toBe('Première')
  expect(stillFirst?.position).toBe(0)
})
```

#### MINEUR #4 — Absence de test pour une collision de position lors de la création (chemin `create`, pas seulement `update`)

**Fichier** : `src/main/database/repositories/phasesRepository.test.ts`, describe `create`.

**Problème** : seule la collision lors d'un `update` est testée (ligne 243-249). Aucun test ne vérifie qu'un `create` avec une `position` explicite déjà utilisée par une autre phase du même projet échoue également (comportement quasi certainement correct, la contrainte `UNIQUE` s'appliquant à l'`INSERT` comme à l'`UPDATE`, mais non démontré).

**Test à ajouter** :
```ts
it('refuse une création avec une position explicite déjà occupée dans le même projet', () => {
  const project = createTestProject()
  phasesRepository.create({ projectId: project.id, name: 'Première', position: 0 })

  expect(() => phasesRepository.create({ projectId: project.id, name: 'Collision', position: 0 })).toThrow()
})
```

#### MINEUR #5 — Aucun test ne garantit explicitement qu'une position explicite `0` n'est pas confondue avec une position absente

**Fichier** : `src/main/database/repositories/phasesRepository.test.ts:177-182` (`respecte une position explicite fournie`, utilise `position: 7`).

**Problème** : le code source utilise correctement `??` (vérifié ligne 145-147 de `phasesRepository.ts` : `data.position ?? (nextPositionStatement.get(...))`), qui traite bien `0` comme une valeur définie (contrairement à `||`, qui l'aurait traitée comme falsy et aurait déclenché le calcul automatique à tort). **Le code est correct.** Mais le seul test de « position explicite respectée » utilise `7` (valeur non nulle), qui ne distinguerait pas un futur bug `??` → `||` d'un comportement correct, puisque `7 || calcul` produirait aussi `7`.

**Test à ajouter** (piège spécifique à `0`) :
```ts
it('respecte une position explicite à 0 même si le projet a déjà des phases positionnées plus loin', () => {
  const project = createTestProject()
  phasesRepository.create({ projectId: project.id, name: 'Phase existante', position: 5 })
  const phase = phasesRepository.create({ projectId: project.id, name: 'Nouvelle phase à 0', position: 0 })

  expect(phase.position).toBe(0)
})
```

---

### SUGGESTION

#### SUGGESTION #1 — Assertion implicite dans le test `ON DELETE SET NULL`

**Fichier** : `src/main/database/repositories/phasesRepository.test.ts:314-338`.

Le test récupère la tâche après suppression de la phase et accède directement à `task.phase_id`. Si la tâche avait été supprimée par erreur (régression hypothétique d'un comportement `CASCADE` au lieu de `SET NULL`), `db.prepare(...).get(...)` renverrait `undefined`, et `task.phase_id` lèverait une `TypeError` — le test échouerait bien, mais avec un message confus plutôt qu'une assertion claire. Ajouter `expect(task).toBeDefined()` avant d'accéder à `task.phase_id` rendrait l'intention et l'échec plus lisibles. Non bloquant : le test actuel échouerait déjà si le comportement était incorrect.

#### SUGGESTION #2 — Assertions `.toThrow()` génériques sans vérification de la cause

**Fichiers** : plusieurs tests de `phasesRepository.test.ts` (ex. ligne 136, 145, 248, 259, 266).

Les tests de rejet utilisent `.toThrow()` sans vérifier le message ou la cause de l'erreur (ex. le test « projet inexistant » passerait aussi si l'échec provenait d'un bug non lié à la contrainte de clé étrangère). C'est une convention déjà en place et acceptée dans `projectsRepository.test.ts` (même style partout) : ce n'est donc pas un défaut introduit par cette phase, seulement une marge d'amélioration générale, à traiter uniformément si le dépôt décide un jour de renforcer ces assertions (non spécifique à la phase 3.5).

#### SUGGESTION #3 — Cast `as PhaseRow` après relecture post-écriture

**Fichier** : `src/main/database/repositories/phasesRepository.ts:160, 204`.

`findRowById(id) as PhaseRow` suppose que la ligne existe forcément juste après une insertion/mise à jour réussie dans la même connexion synchrone — hypothèse raisonnable et jamais mise en défaut en pratique, mais un cast plutôt qu'une vérification explicite. Exactement le même motif existe déjà, à l'identique, dans `projectsRepository.ts` (déjà accepté lors des reviews précédentes) : cohérence maintenue, pas une régression.

## 5. Vérification des affirmations du rapport (`RAPPORT_PHASE_3.5.md`)

| Affirmation du rapport | Vérifiée | Détail |
|---|---|---|
| Statuts `pending`/`in_progress`/`completed`, aucune valeur inventée | ✅ | Conforme au `CHECK` SQL de la migration, ligne 46. |
| `CreatePhaseInput = z.input<typeof createPhaseSchema>` | ✅ | Confirmé ligne 75 de `phase.ts`, même raisonnement que `CreateProjectInput`. |
| `create()` valide via `createPhaseSchema.parse(input)` puis n'utilise que le résultat parsé | ✅ | Confirmé, aucune référence à `input` après le `parse`. |
| Position initiale à `0`, calcul par `MAX(position)+1` scopé au projet | ✅ | Confirmé par lecture et par tests (`attribue la position 0…`, `calcule la position suivante indépendamment…`). |
| Transaction courte regroupant calcul de position + insertion | ✅ (fait), ⚠️ (justification) | La transaction existe bien (`database.transaction(...)`, ligne 140), mais sa justification par un risque de concurrence multi-handlers est exagérée dans ce contexte synchrone — voir MINEUR #1. |
| Suppression en cascade des phases à la suppression du projet | ✅ | Confirmé par lecture de la migration (`ON DELETE CASCADE`, ligne 42) et par test. |
| `tasks.phase_id` mis à `NULL` à la suppression d'une phase | ✅ | Confirmé par lecture de la migration (`ON DELETE SET NULL`, ligne 57 de la migration) et par test. |
| 38 + 31 = 69 tests, 16 fichiers de test, 276 tests réussis au total | ✅ | Recompté manuellement et ré-exécuté pendant cette review, résultat identique. |
| Aucun fichier modifié, aucune migration touchée, aucune dépendance ajoutée | ✅ | Confirmé par `git diff` (vide) et `git diff -- package.json` (vide). |
| « Réutilise la stratégie de `projectsRepository` si elle est correcte et adaptée » (prompt) suivi sans réserve | ⚠️ | La stratégie réutilisée (boucle `field in data` + `.refine()` sur le nombre de clés) contient un défaut préexistant hérité tel quel — voir IMPORTANT #1. Le rapport ne mentionne pas cette limite. |

Aucune affirmation manifestement fausse, contradictoire ou non prouvée n'a été trouvée dans le rapport, à l'exception de l'angle mort commun à IMPORTANT #1 (non mentionné) et de la formulation optimiste sur la transaction (MINEUR #1).

## 6. Vérification du périmètre architectural

- Aucune migration modifiée (`git diff -- src/main/database/migrations` vide).
- Aucun fichier IPC ajouté ou modifié (`src/main/ipc/` inchangé).
- Aucun contrat preload modifié (`src/preload/` inchangé).
- Aucun fichier renderer modifié (`src/renderer/` inchangé).
- Aucune dépendance ajoutée (`git diff -- package.json` vide).
- Aucun import de `better-sqlite3` dans `src/shared` (`grep` négatif).
- Aucun import de `phasesRepository` dans `src/renderer`, `src/preload` ou `src/main/ipc` (`grep` négatif).
- Aucun `any`, `@ts-ignore`, `@ts-expect-error` dans les fichiers de la phase (`grep` négatif).
- Aucun test désactivé ou neutralisé (`grep` négatif sur `.skip`/`.only`).
- Aucun code de réordonnancement complet hors périmètre (drag-and-drop, décalage automatique, résolution de collision) : confirmé absent, les collisions échouent simplement par contrainte SQL.

## 7. Conclusion

**Verdict : corrections nécessaires avant validation.**

Aucun défaut bloquant : le repository et les schémas fonctionnent correctement pour tous les chemins déjà exercés par les 69 tests de cette phase, et `npm run typecheck`, `npm run test` (276/276) et `npm run build` réussissent tous les trois, comme annoncé dans le rapport.

Un défaut **IMPORTANT** a cependant été confirmé par exécution réelle (pas seulement par lecture) : une clé de mise à jour explicitement fournie à `undefined` (ex. `{ description: undefined }`) contourne le `.refine()` censé rejeter les mises à jour vides, puis est traitée par le repository comme une valeur à écrire, effaçant silencieusement un champ nullable en base ou provoquant une erreur SQLite brute pour un champ `NOT NULL`. Ce défaut est hérité à l'identique de `projectsRepository`/`updateProjectSchema` (phase 3.2), donc non introduit par la phase 3.5, mais reconduit sans correction ni mention alors que cette phase avait l'occasion de le traiter. Il n'est aujourd'hui déclenché par aucun appelant existant dans le dépôt (aucun IPC n'expose encore les phases ni les projets à ce niveau de risque), mais deviendra probablement exploitable dès qu'un futur handler IPC ou formulaire React assemblera un objet de mise à jour par copie/étalement (`{ ...changes }`), un motif très courant.

Les autres constats (MINEUR #1 à #5, SUGGESTION #1 à #3) sont des lacunes de couverture de tests ou des imprécisions documentaires, sans impact fonctionnel démontré — le code sous-jacent a été vérifié correct pour MINEUR #2, #3, #4 et #5 par lecture et/ou exécution directe.

**Recommandation** : corriger IMPORTANT #1 (idéalement dans `phasesRepository`/`phase.ts` et, par cohérence, dans `projectsRepository`/`project.ts`), ajouter le test de non-régression associé, puis ajouter au moins les tests MINEUR #2 à #5 avant de considérer la phase 3.5 prête pour commit. Aucune de ces corrections ne nécessite de refactorisation générale : toutes restent locales aux fichiers déjà concernés.
