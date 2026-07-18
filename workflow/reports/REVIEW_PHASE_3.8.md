# REVIEW INDÉPENDANTE — PHASE 3.8

## Périmètre inspecté

Review technique indépendante de la **Phase 3.8 — Validation intégrée Projets + Phases**. Documents lus intégralement : `PHASE_3.8_PROMPT.md`, `RAPPORT_PHASE_3.8.md`, `RAPPORT_PHASE_3.7.md`, ainsi que les rapports de review de la Phase 3.7 (`REVIEW_PHASE_3.7.md` non présent dans le dépôt sous ce nom exact — voir note ci-dessous, `RAPPORT_CORRECTIONS_REVIEW_PHASE_3.7.md`, `REVIEW_CORRECTIONS_PHASE_3.7.md`).

Code inspecté directement (pas seulement via le rapport) :

- **Nouveaux tests** : `src/renderer/src/App.test.tsx` (intégral), `src/main/database/repositories/projectsPhasesCascade.integration.test.ts` (intégral).
- **Câblage renderer réel** : `App.tsx`, `navigation.ts`, `AppSidebar.tsx`, `ProjectsPage.tsx`, `PhasesPage.tsx`, `ProjectCard.tsx`, `PhaseCard.tsx`.
- **Tests existants de comparaison** : `ProjectsPage.test.tsx`, `PhasesPage.test.tsx`, `preload/index.test.ts`.
- **Repositories & SQLite** : `projectsRepository.ts`, `phasesRepository.ts`, `projectsRepository.test.ts`, `phasesRepository.test.ts`, `database.test.ts`, migration `0001_createInitialMvpSchema.ts`, `runMigrations.ts`, `migrations.ts`.
- **IPC & preload & contrats** : `registerProjectsHandlers.integration.test.ts`, `registerPhasesHandlers.integration.test.ts`, `preload/index.ts` (via ses tests), `shared/contracts/themeFactoryApi.ts`.

Validations automatisées ré-exécutées indépendamment (voir section dédiée). Aucun fichier applicatif, test ou documentation n'a été modifié pendant cette review. Seul `workflow/reports/REVIEW_PHASE_3.8.md` (ce fichier) est créé.

> Note documentaire : le prompt de review liste `workflow/reports/REVIEW_PHASE_3.7.md` comme référence, mais ce fichier n'existe pas dans le dépôt (le cycle de la Phase 3.7 a produit `REVIEW_CORRECTIONS_PHASE_3.7.md`, qui joue ce rôle). Sans incidence sur la review de la Phase 3.8.

---

## Vérification du périmètre

Confirmé : la Phase 3.8 se limite strictement à l'ajout de tests et à la documentation.

- `git diff --stat` est **vide** : aucun fichier suivi n'a été modifié. Les seuls changements sont des fichiers **non suivis** : les deux nouveaux fichiers de tests, le prompt, le prompt de review et le rapport de Phase 3.8.
- Aucun code métier, composant, repository, handler IPC, preload, migration ou schéma partagé n'a été touché (vérifié par lecture directe du diff et par comparaison des hash de build, identiques à la Phase 3.7).
- Aucune dépendance modifiée (`package.json`/`package-lock.json` absents du diff).
- Aucune modification de configuration de test destinée à masquer une erreur (pas de `skipLibCheck`, pas de changement de `vitest`/`tsconfig`).
- Aucune trace de tâches, checklists, ou fonctionnalité de Phase 4.

**Aucun écart de périmètre.**

---

## Analyse de `App.test.tsx`

### Montage réel — CONFORME

- Le fichier importe et rend le **vrai** composant `App` (`import App from './App'` ; `render(<App />)`). Aucun harnais de substitution.
- Le state du projet actif est réellement détenu par `App.tsx` (`useState<Project | null>` à la ligne 18 de `App.tsx`), passé en props à `ProjectsPage` (`activeProject` + `onActiveProjectChange`) et à `PhasesPage` (`activeProject`). Le test ne manipule aucun state interne.
- Les vraies pages `ProjectsPage` et `PhasesPage` sont montées via le rendu conditionnel réel d'`App.tsx`.
- La navigation utilise les vrais boutons de la barre latérale (`AppSidebar`) via leurs libellés accessibles (`{ name: 'Projets' }`, `{ name: 'Phases et tâches' }`), exactement comme un utilisateur.
- La sélection du projet actif passe par le vrai bouton « Sélectionner » de `ProjectCard`.

### Mock API — CONFORME

- `window.themeFactoryApi` est mockée via un objet typé `ThemeFactoryApi` ; les sous-APIs `projects` et `phases` sont présentes, chaque méthode étant un `vi.fn()`. Le cast `as unknown as ThemeFactoryApi['...']` est le même procédé que celui déjà utilisé dans `ProjectsPage.test.tsx`/`PhasesPage.test.tsx` — acceptable et cohérent avec la convention du dépôt.
- Mocks réinitialisés entre chaque test : `beforeEach(installThemeFactoryApi)` recrée des `vi.fn()` neufs ; `afterEach(cleanup + vi.restoreAllMocks)`.
- `listByProjectId` utilise `mockImplementation((projectId) => Promise.resolve(projectId === projectA.id ? [phaseA] : [phaseB]))` : les jeux de données de A et B sont **réellement distincts** (noms différents « Phase du projet A » / « Phase du projet B »).

### Scénario changement de projet — FIABLE

Les 11 étapes attendues sont réellement démontrées, dans l'ordre : chargement des projets → sélection de A → navigation Phases → appel `listByProjectId(A)` → phases de A affichées → retour Projets → sélection de B → retour Phases → appel `listByProjectId(B)` → disparition des phases de A → affichage des phases de B.

**Résistance aux faux positifs** : les assertions ne pourraient pas réussir avec un câblage incorrect :
- Si `activeProject` n'était pas partagé depuis `App.tsx`, la navigation vers Phases afficherait « Sélectionnez d'abord un projet actif… » et `findByText('Projet actif : Projet A')` échouerait.
- L'assertion `findByText('Projet actif : Projet B')` (issue du rendu réel de `PhasesPage`) confirme que le nom du projet actif affiché correspond bien à B.
- `queryByText(/Phase du projet A/)).toBeNull()` vérifie la **disparition réelle** des données précédentes.
- Les noms distincts empêchent qu'un mock renvoyant les mêmes données quel que soit l'id ne masque une erreur.

**Observation (non bloquante)** : le test s'appuie sur `toHaveBeenCalledWith(projectB.id)` (les appels s'accumulant, cette assertion resterait vraie tant que B a été appelé au moins une fois) plutôt que sur l'ordre exact des appels via `mock.calls`. La robustesse est néanmoins assurée par la combinaison des assertions visuelles (phase B présente, phase A absente, en-tête « Projet actif : Projet B »). Un renforcement possible — non nécessaire — serait d'asserter l'index de l'appel B postérieur à la sélection de B.

### Scénario suppression du projet actif — FIABLE

Les étapes clés sont démontrées : sélection de A → navigation Phases (phases de A affichées) → retour Projets → suppression confirmée (`window.confirm` mocké à `true`) → appel réel `projects.remove(A)` (mock `mockResolvedValue(true)`) → `activeProject` remis à `null` via `onActiveProjectChange(null)` dans `handleDelete` → retour Phases → affichage de l'état « Sélectionnez d'abord un projet actif… » → **absence** de nouvel appel `listByProjectId` (vérifiée après `mockClear`).

- `window.confirm` est correctement restauré (via `vi.restoreAllMocks()` dans `afterEach`, la mock étant posée par `vi.spyOn`).
- L'assertion `expect(phasesApi.listByProjectId).not.toHaveBeenCalled()` après `mockClear` est un vrai garde-fou : si `activeProject` n'était pas remis à `null`, la navigation rechargerait les phases de A et l'assertion échouerait.

**Observation** : ce test ne contient qu'un seul projet (A) ; il ne vérifie donc pas que B « reste disponible » après suppression de A. Ce point est toutefois **déjà couvert ailleurs** — dans le nouveau test de cascade SQLite (préservation réelle de B et de sa phase) et dans `ProjectsPage.test.tsx` (« réinitialise la sélection active si le projet actif est supprimé, sans laisser un autre projet actif par erreur »). Aucune lacune réelle.

---

## Analyse de la cascade SQLite

Fichier : `projectsPhasesCascade.integration.test.ts`, premier `describe`.

### Base et migrations — CONFORME

- Vraie base `better-sqlite3` (`new Database(':memory:')`).
- `PRAGMA foreign_keys = ON` effectivement posé avant les migrations (ligne `db.pragma('foreign_keys = ON')`).
- Migrations réelles via `runMigrations(db)` (migration `0001` créant `projects` et `phases`).
- Vrais repositories instanciés (`createProjectsRepository`, `createPhasesRepository`), aucun mock.
- La suppression passe réellement par `projectsRepository.remove(projectA.id)`.

### Scénario cascade — FIABLE

Crée réellement 2 projets (A, B), 3 phases pour A, 1 phase pour B ; vérifie les listes initiales avant suppression ; supprime A ; puis vérifie : A introuvable (`getById` → `null`), les 3 phases de A introuvables (`getById` de chacune → `null`), `listByProjectId(A)` vide, **comptage SQL direct** `SELECT COUNT(*) FROM phases WHERE project_id = ?` égal à `0`, B toujours présent, la phase de B toujours présente et correctement rattachée (`toEqual([phaseB1])`).

**Cascade réellement assurée par SQLite** : la lecture de `projectsRepository.remove` (lignes 188-191 de `projectsRepository.ts`) confirme qu'il exécute uniquement `DELETE FROM projects WHERE id = @id` — **aucune suppression explicite des phases**. La disparition des phases de A ne peut donc provenir que de la contrainte SQL `phases.project_id REFERENCES projects(id) ON DELETE CASCADE` (migration `0001`, ligne 42). La cascade n'est ni simulée par le test ni par le repository.

**Valeur réelle du test** — il échouerait effectivement dans chacun des cas ciblés :
- Absence de `ON DELETE CASCADE` : les phases de A resteraient → `listByProjectId(A)` non vide → échec.
- `foreign_keys` désactivé : la cascade ne se déclencherait pas → phases orphelines conservées → échec.
- Suppression manuelle incomplète : idem, détectée par le comptage à zéro.
- Erreur de rattachement des phases : les assertions initiales (listes avant suppression) échoueraient.
- Suppression accidentelle des phases de B : `toEqual([phaseB1])` après suppression échouerait.

Test **non trivial et à forte valeur**.

---

## Analyse de la persistance combinée

Fichier : `projectsPhasesCascade.integration.test.ts`, second `describe`.

### Conformité

- Vrai fichier SQLite temporaire (`mkdtempSync(join(tmpdir(), 'tfc-cascade-persist-'))` + `join(tempDir, 'lifecycle.sqlite')`), **chemin unique par test** (mkdtemp dans `beforeEach`).
- Première connexion : `new Database(dbPath)` + `pragma foreign_keys = ON` + `runMigrations` + repositories réels ; crée un projet et 2 phases ; puis `firstConnection.close()`.
- Seconde connexion **indépendante** ouverte sur le même fichier ; données relues via de **nouvelles instances** des repositories (`createProjectsRepository(secondConnection)`, `createPhasesRepository(secondConnection)`) — aucune donnée conservée en mémoire depuis la première instance.
- Propriétés comparées : `getById(project.id)` `toEqual(project)` (objet complet), `listByProjectId(project.id)` `toEqual([first, second])`.

### Observations (non bloquantes)

1. **Migrations non rejouées à la réouverture** : la seconde connexion n'appelle pas `runMigrations` — elle s'appuie sur le fichier déjà migré. C'est **cohérent avec la convention du test de persistance existant** (`projectsRepository.test.ts` fait exactement pareil). En revanche, le cycle réel de l'application (`openDatabase`) exécute `runMigrations` de façon idempotente à **chaque** ouverture. Le test contourne donc l'étape « migrations à la réouverture » du cycle réel. Sans incidence sur ce qu'il vérifie (persistance des données), mais la formulation du rapport « cohérent avec le comportement déjà démontré par `database.test.ts` » est légèrement imprécise : `database.test.ts` démontre la **non-réapplication** des migrations via `openDatabase` (qui les rejoue et constate l'idempotence), alors que le nouveau test les **omet** purement. Constat documentaire mineur.

2. **Portée de l'assertion d'ordre** : les 2 phases sont créées avec attribution automatique de position (0 puis 1), donc dans l'ordre d'insertion = ordre attendu. L'assertion `toEqual([first, second])` démontre donc la **persistance** de l'ordre, mais ne prouve pas indépendamment le tri `position ASC` (il faudrait insérer des positions dans le désordre). Ce tri est déjà démontré ailleurs de façon non triviale (`phasesRepository.test.ts` insère les positions 2, 0, 1 et asserte l'ordre trié). Constat mineur / observation, conforme à la nuance déjà anticipée par la section 9 du prompt de review.

---

## Analyse du nettoyage

- **Cascade (`:memory:`)** : `afterEach(() => db.close())`. Aucune ressource fichier. Correct.
- **Persistance (fichier)** : `afterEach(() => rmSync(tempDir, { recursive: true, force: true }))`. `afterEach` s'exécute même en cas d'échec d'un `it`, donc le répertoire temporaire est supprimé dans tous les cas.
- **Fichiers `-wal`/`-shm`** : le test ouvre la base via `new Database(dbPath)` **directement** (et non `openDatabase`), donc le mode WAL n'est **pas** activé (journal par défaut `delete`/rollback). Aucun fichier `-wal`/`-shm` persistant n'est créé ; de toute façon la suppression récursive du répertoire les couvrirait. Pas de fichier parasite possible.
- **Robustesse (observation mineure)** : les deux connexions du test de persistance sont fermées **à l'intérieur** du `it`, sans `try/finally`. Si une assertion échouait avant `secondConnection.close()`, la connexion resterait ouverte ; sous Windows, un verrou de fichier `better-sqlite3` pourrait alors faire échouer le `rmSync` de l'`afterEach` (malgré `force: true`, qui ne contourne pas un verrou). Ce risque ne se matérialise que si le test **échoue** déjà, et il reproduit exactement le pattern des tests de persistance existants (`projectsRepository.test.ts`). Amélioration possible (non requise) : entourer les opérations d'un `try/finally` fermant les connexions. Non bloquant.
- **Concurrence de chemins** : `mkdtempSync` garantit un répertoire unique par exécution, y compris en cas d'exécution parallèle des tests. Aucun risque de collision de chemin.

---

## Comparaison avec la couverture existante

Vérification des affirmations de non-redondance du rapport :

| Affirmation du rapport | Vérdict | Preuve |
|---|---|---|
| Persistance d'un projet seul déjà couverte | **CONFIRMÉ** | `projectsRepository.test.ts` → « persistance sur fichier SQLite réel » |
| Persistance des phases avec leur projet non couverte | **CONFIRMÉ** | `phasesRepository.test.ts` n'utilise que `:memory:` ; aucun test fichier pour les phases avant la Phase 3.8 |
| Cascade réelle non couverte | **CONFIRMÉ** | Aucun test préexistant ne supprimait un projet ayant des phases via les repos ; `registerPhasesHandlers.integration.test.ts` supprime des phases mais jamais un projet parent |
| Câblage réel `App.tsx` non couvert | **CONFIRMÉ** | `ProjectsPage.test.tsx` utilise `ProjectsPageHarness` (state reconstruit) ; `PhasesPage.test.tsx` rend `PhasesPage` isolément avec prop `activeProject` contrôlée |
| Ordre des phases déjà suffisamment couvert | **CONFIRMÉ** | `phasesRepository.test.ts` (tri 2/0/1) + `registerPhasesHandlers.integration.test.ts` (positions successives) + `PhasesPage.test.tsx` (ordre d'affichage) |

Les **4 nouveaux tests apportent une valeur réelle et non redondante**. Aucune duplication importante. Aucune lacune nouvelle introduite. Les scénarios déjà couverts (états vides, erreurs, concurrence obsolète) n'ont pas été re-testés inutilement — décision conforme à l'esprit du prompt (« privilégier quelques tests intégrés à forte valeur »).

---

## Résultats des validations (ré-exécutées indépendamment)

```bash
npm run typecheck
```
→ **Succès**, aucune erreur.

```bash
npm run test
```
→ **`Test Files 21 passed (21)` / `Tests 352 passed (352)`**. Aucun avertissement `act(...)` ni warning React observé.

Exécution isolée des deux nouveaux fichiers (`--reporter=verbose`) :
→ `App.test.tsx` : 2/2 réussis. `projectsPhasesCascade.integration.test.ts` : 2/2 réussis. **4 tests, 2 fichiers, aucun warning.**

```bash
npm run build
```
→ **Succès** : main 27.49 kB, preload 2.03 kB, renderer `index-B7L9SDfN.js` **729.18 kB** / `index-DzsytAJr.css` **6.89 kB**.

**Conformité totale avec les chiffres annoncés** (21 fichiers, 352 tests, typecheck OK, build OK). Le hash et la taille du bundle renderer sont **identiques** à la Phase 3.7, ce qui confirme qu'aucun code applicatif n'a été modifié.

---

## Inspection Git

```bash
git status --short
```
```
?? src/main/database/repositories/projectsPhasesCascade.integration.test.ts
?? src/renderer/src/App.test.tsx
?? workflow/prompts/PHASE_3.8_PROMPT.md
?? workflow/prompts/PHASE_3.8_REVIEW_PROMPT.md
?? workflow/reports/RAPPORT_PHASE_3.8.md
```
(`REVIEW_PHASE_3.8.md` s'ajoute à cette liste après création de ce rapport.)

- `git diff --stat` : **vide** (aucun fichier suivi modifié).
- `git diff --check` : aucune erreur d'espacement.
- Présence exacte des deux nouveaux fichiers de tests : **confirmée**.
- Présence du prompt et du rapport de Phase 3.8 : **confirmée** ; `RAPPORT_PHASE_3.8.md` apparaît bien dans l'état Git réel.
- Aucun fichier `.txt` parasite, aucun fichier `.sqlite`/`-wal`/`-shm`, aucun répertoire temporaire, aucun snapshot ou fichier généré, aucune modification de dépendance, aucune modification applicative. (Recherche ciblée effectuée : « aucun fichier parasite ».)

---

## Vérification du rapport de Phase 3.8

Chaque affirmation importante confrontée au code et aux résultats réels :

| Affirmation | Vérdict |
|---|---|
| 2 nouveaux fichiers | **EXACT** |
| 4 nouveaux tests | **EXACT** |
| Total 352 tests / 21 fichiers | **EXACT** (ré-exécuté) |
| Aucune correction applicative | **EXACT** (`git diff --stat` vide) |
| Aucune modification de code existant | **EXACT** |
| Test réel de `App.tsx` | **EXACT** |
| Cascade réelle (non simulée) | **EXACT** |
| Persistance sur fichier réel | **EXACT** |
| Nettoyage des ressources temporaires | **EXACT** (avec réserve mineure sur l'absence de `try/finally`, voir Nettoyage) |
| Build inchangé (hash identiques) | **EXACT** |
| État Git annoncé | **EXACT** |
| Honnêteté sur `npm run dev` | **EXACT** — le rapport documente correctement l'échec du 1ᵉʳ essai dû à `ELECTRON_RUN_AS_NODE=1` (environnement sandbox, sans rapport avec le code) puis le démarrage propre après désactivation de cette variable |
| Validation manuelle non effectuée | **EXACT** — clairement distinguée comme restant à la charge de l'utilisateur |

**Constats documentaires mineurs** :
- La phrase du rapport sur la persistance « sans rejouer les migrations, cohérent avec le comportement déjà démontré par `database.test.ts` » est légèrement imprécise : le test **omet** `runMigrations` à la réouverture, alors que `database.test.ts` démontre leur **non-réapplication** via `openDatabase` (deux choses distinctes). Sans incidence fonctionnelle.
- L'expression « ordre inclus » (section Inspection) surestime marginalement la portée de l'assertion d'ordre du test de persistance (voir Analyse de la persistance, observation 2).

Aucune affirmation incorrecte majeure. Aucune sur-déclaration de validation manuelle.

---

## Constats classés

**Aucun constat Bloquant.**

**Aucun constat Important.**

**Mineur #1** — `RAPPORT_PHASE_3.8.md` : formulation imprécise sur la persistance (« cohérent avec le comportement déjà démontré par `database.test.ts` » alors que le test omet `runMigrations` à la réouverture au lieu de démontrer leur idempotence). *Impact* : documentaire uniquement. *Correction minimale recommandée* (non appliquée) : reformuler en « la seconde connexion relit le fichier déjà migré sans réexécuter les migrations, ce qui suffit à vérifier la persistance ».

**Mineur #2** — `projectsPhasesCascade.integration.test.ts`, test de persistance : les connexions sont fermées dans le corps du `it` sans `try/finally` ; un échec d'assertion pourrait laisser une connexion ouverte et, sous Windows, faire échouer le `rmSync` de l'`afterEach`. *Impact* : uniquement en cas de test déjà en échec ; reproduit le pattern des tests de persistance existants. *Correction minimale recommandée* (non appliquée) : entourer d'un `try/finally` fermant les connexions.

**Observation #1** — Le test de persistance crée les phases dans l'ordre de position croissant (0, 1), donc son assertion d'ordre démontre la persistance mais pas le tri `position ASC` de façon indépendante. Le tri est déjà démontré ailleurs. Aucune action requise.

**Observation #2** — Le scénario de suppression d'`App.test.tsx` ne comporte qu'un projet et ne vérifie donc pas la préservation d'un projet B ; couvert par ailleurs (cascade SQLite + `ProjectsPage.test.tsx`). Aucune action requise.

**Observation #3** — Le scénario de changement de projet s'appuie sur `toHaveBeenCalledWith` (cumulatif) plutôt que sur l'ordre exact des appels ; la robustesse reste assurée par les assertions visuelles. Renforcement possible mais non nécessaire.

**Observation #4** — Le prompt de review référence `REVIEW_PHASE_3.7.md`, absent du dépôt (remplacé par `REVIEW_CORRECTIONS_PHASE_3.7.md`). Sans incidence.

---

## Checklist manuelle restante

La validation interactive utilisateur n'a **pas** été effectuée et reste obligatoire avant de clore définitivement la Phase 3. Checklist compacte à exécuter dans l'application réelle :

1. Créer les projets A et B.
2. Sélectionner A comme projet actif (vérifier l'indication « Actif »).
3. Ouvrir « Phases et tâches » : créer puis modifier des phases pour A ; vérifier leur ordre.
4. Revenir sur Projets, sélectionner B, revenir sur Phases.
5. Vérifier l'**absence de fuite** des phases de A ; créer une phase pour B.
6. Revenir sur Projets, supprimer A et confirmer.
7. Vérifier la **cascade visible** : les phases de A ne sont plus accessibles ; si A était actif, l'état revient à « aucun projet actif ».
8. Vérifier la **conservation de B** et de sa phase.
9. Fermer complètement l'application, la relancer.
10. Vérifier la **persistance** de B et de ses phases ; A et ses phases restent supprimés.
11. Vérifier l'**absence d'erreur** dans les consoles main et renderer pendant l'ensemble du parcours.

---

## Verdict

## Verdict A — VALIDÉE TECHNIQUEMENT, VALIDATION MANUELLE REQUISE

- Aucun défaut **Bloquant** ni **Important**.
- Les 4 nouveaux tests sont **fiables et à forte valeur** : le test `App.tsx` exerce le vrai câblage du projet actif (résistant aux faux positifs), le test de cascade démontre réellement `ON DELETE CASCADE` (échouerait sans la contrainte ou sans `foreign_keys`), le test de persistance combinée relit projet + phases depuis un fichier réel via de nouvelles instances.
- `npm run typecheck`, `npm run test` (352/352) et `npm run build` réussissent, ré-exécutés indépendamment ; hash de build identiques à la Phase 3.7 (aucune modification applicative).
- Seuls subsistent 2 constats **Mineurs** (documentaires / robustesse de nettoyage) et 4 **Observations**, aucun ne remettant en cause la fiabilité des tests.

### Décisions explicites

- **Aucune correction applicative ou de test n'est requise** avant la validation manuelle. Les 2 constats Mineurs peuvent être traités lors d'une prochaine intervention sans bloquer.
- **Une correction documentaire mineure est optionnelle** (Mineur #1) mais non bloquante.
- **La validation manuelle interactive peut commencer** (checklist ci-dessus).
- **Le commit doit attendre** la confirmation de cette validation manuelle par l'utilisateur, conformément à la consigne de ne pas clore définitivement la Phase 3 avant confirmation.

Aucun commit n'a été créé pendant cette review.
