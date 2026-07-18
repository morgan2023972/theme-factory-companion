# RAPPORT — Corrections après review de la Phase 3.7

## Résumé

**Défauts corrigés** : les deux défauts **IMPORTANT** confirmés par `workflow/reports/REVIEW_PHASE_3.7.md` — (1) une réponse tardive de `listByProjectId` pouvait afficher les phases d'un ancien projet actif ; (2) une mutation en vol (création/modification/suppression) pouvait modifier l'état visuel du nouveau projet après un changement de projet actif, avec un symptôme concret : le bouton « Nouvelle phase » du nouveau projet restait bloqué tant qu'une mutation de l'ancien projet n'était pas résolue.

**Approche choisie** : capturer, pour chaque opération asynchrone (chargement ou mutation), l'identifiant du projet actif au moment de son lancement, et le comparer — après chaque `await`, avant toute mise à jour d'état — à l'identifiant actif courant lu via une référence mutable (`activeProjectIdRef`), à l'image du mécanisme déjà utilisé par `activeProjectRef` dans `ProjectsPage.tsx`. Toute réponse ou erreur devenue obsolète est ignorée silencieusement. Le changement de projet actif réinitialise en plus explicitement `isSubmittingForm`, qui ne l'était pas.

**Statut final** : corrections appliquées, testées et validées automatiquement. `npm run typecheck`, `npm run test` (348/348) et `npm run build` réussissent. `npm run dev` démarre sans erreur. La validation manuelle interactive reste obligatoire et n'a pas été effectuée par Claude Code (voir section dédiée).

## Fichiers modifiés

- `src/renderer/src/pages/PhasesPage.tsx` — protection contre les réponses/mutations obsolètes (voir sections suivantes).
- `src/renderer/src/pages/PhasesPage.test.tsx` — 5 tests de non-régression ajoutés (23 tests au total, était 18).
- `workflow/reports/RAPPORT_PHASE_3.7.md` — inexactitudes documentaires corrigées (nombre de tests, section Position/Concurrence, section Risques).
- `workflow/reports/RAPPORT_CORRECTIONS_REVIEW_PHASE_3.7.md` — ce rapport (nouveau).

Fichier supprimé : `RAPPORT_PHASE_3.7.txt` (voir section « Fichier parasite »).

Aucun autre fichier touché : ni `src/preload/index.ts`, ni `src/main/ipc/registerPhasesHandlers.ts`, ni `src/main/database/repositories/phasesRepository.ts`, ni aucune migration.

## Protection des chargements

**Référence utilisée** : `activeProjectIdRef`, un `useRef<string | null>` réassigné de façon inconditionnelle à chaque rendu (`activeProjectIdRef.current = activeProjectId`), avant toute utilisation dans un effet ou une fermeture — exactement le même schéma que `activeProjectRef` dans `ProjectsPage.tsx` (Phase 3.7 initiale), qui ne peut donc pas se désynchroniser de la prop réelle.

**Vérifications ajoutées** : dans `loadPhases(projectId)`, après l'attente de `listByProjectId(projectId)`, la condition existante `if (!isMountedRef.current)` devient `if (!isMountedRef.current || activeProjectIdRef.current !== projectId)`, appliquée identiquement dans la branche de succès (avant `setPhases`/`setLoadState('loaded')`) et dans la branche d'erreur (avant `setLoadState('error')`).

**Comportement d'une réponse obsolète** : si le projet actif a changé entre le lancement de l'appel et sa résolution, la fonction retourne immédiatement sans toucher à `phases` ni à `loadState` — la réponse (ou l'erreur) est ignorée silencieusement, sans effet visuel, sans log ni notification (conforme à la demande : « une réponse ou erreur obsolète doit être ignorée silencieusement »).

## Protection des mutations

**Principe commun** : chaque handler de mutation capture `const mutationProjectId = project.id` au moment de son déclenchement (avant tout `await`), et définit une fonction locale `isStillRelevant()` retournant `isMountedRef.current && activeProjectIdRef.current === mutationProjectId`. Cette fonction est appelée avant chaque mise à jour d'état consécutive à une opération asynchrone, y compris dans le bloc `catch` et dans le bloc `finally`.

### Création

Après `phases.create(...)` : `isStillRelevant()` est vérifié avant `setPhases` (ajout de la phase créée) et avant `setFormState({mode:'closed'})`. Si le projet actif a changé, la phase créée pour l'ancien projet n'est jamais ajoutée à la liste du nouveau, et le formulaire éventuellement ouvert pour le nouveau projet n'est pas fermé.

### Modification

Même schéma après `phases.update(...)` : la mise à jour de `phases` et la fermeture du formulaire ne s'appliquent que si le projet de la mutation est toujours actif. Le retour `null` (phase supprimée entre-temps) n'affiche `formErrorMessage` que dans ce même cas.

### Suppression

Même schéma après `phases.remove(...)` : le retrait de la phase de `phases`, l'affichage d'un message d'erreur (`false` ou exception) sont conditionnés à `isStillRelevant()`.

### Réinitialisation lors du changement de projet

L'effet déclenché par `activeProjectId` réinitialise désormais explicitement `setIsSubmittingForm(false)` en plus des réinitialisations déjà présentes (`formState`, `formErrorMessage`, `deleteErrorMessage`, `deletingPhaseId`, `phases`). Le nouveau projet démarre donc toujours avec un bouton « Nouvelle phase » actif, quel que soit l'état de soumission de l'ancien projet au moment du changement.

### Attention au `finally`

Les blocs `finally` de `handleSubmitForm` (remise à `false` de `isSubmittingForm`) et de `handleDelete` (remise à `null` de `deletingPhaseId`) sont désormais conditionnés à `isStillRelevant()` plutôt qu'à `isMountedRef.current` seul. Cela évite qu'un `finally` tardif appartenant à l'ancien projet ne réinitialise un état de mutation appartenant à une opération légitimement en cours pour le nouveau projet (scénario couvert par le test de suppression concurrente, voir plus bas).

## Tests ajoutés

Tous ajoutés dans `src/renderer/src/pages/PhasesPage.test.tsx`, nouvelle section `describe('PhasesPage — concurrence lors d'un changement de projet actif')`, en utilisant exclusivement des promesses contrôlées manuellement (`new Promise((resolve) => { resolveX = resolve })`) pour maîtriser précisément l'ordre de résolution :

1. **Résolution inversée A/B** (« ignore une réponse listByProjectId obsolète... ») : rend `PhasesPage` avec A (promesse en attente), rerend avec B (promesse en attente), résout B en premier (phase B affichée), résout A ensuite et vérifie que la phase A n'apparaît jamais et que l'en-tête affiche toujours « Projet actif : Projet B ».
2. **Erreur de chargement obsolète** : A échoue après que B se soit chargé avec succès ; vérifie qu'aucune alerte n'apparaît et que les phases de B restent affichées.
3. **Création en vol** : ouvre le formulaire pour A, soumet une création à réponse différée, rerend avec B avant résolution, vérifie que le bouton « Nouvelle phase » de B n'est pas bloqué et qu'aucun formulaire résiduel n'est affiché, résout tardivement la création de A et vérifie que sa phase n'apparaît jamais dans la liste de B.
4. **Erreur de mutation obsolète** : même scénario que 3 mais avec un rejet tardif ; vérifie l'absence de message d'erreur et que le bouton « Nouvelle phase » de B reste actif.
5. **Test ciblé suppression** (« une suppression en vol pour A ne réactive pas prématurément... ») : démarre une suppression pour A, change vers B, démarre une suppression pour B (bouton désactivé), résout tardivement la suppression de A et vérifie que le bouton de B reste désactivé (protection du `finally` contextualisé), puis résout la suppression de B et vérifie le retrait effectif de la phase.

**Vérification de non-trivialité** : les 4 premiers tests ont été exécutés contre une version temporairement dégradée du code (guards de concurrence neutralisés, restaurée immédiatement après) pour confirmer qu'ils échouent réellement sans la correction — confirmé : 4 échecs exacts sur les défauts ciblés. Le 5ᵉ test (erreur de mutation obsolète) passait déjà sans la correction spécifique du `finally`, car son scénario ne sollicite pas cette branche précise ; il reste néanmoins une vérification légitime du comportement attendu.

Les 18 tests existants de `PhasesPage.test.tsx` et les 15 tests de `ProjectsPage.test.tsx` n'ont subi aucune modification d'assertion.

## Documentation

`workflow/reports/RAPPORT_PHASE_3.7.md` corrigé :
- Section « Fichiers modifiés » : « 26 tests existants » → « 15 tests existants » (`ProjectsPage.test.tsx`).
- Section « Interface réalisée » : ajout d'un paragraphe « Concurrence » décrivant la protection ajoutée.
- Section « Tests » : nombre de tests de `PhasesPage.test.tsx` mis à jour (18 → 23, avec description des scénarios de concurrence) ; section « Résultat global » corrigée (base réelle avant la Phase 3.7 = 18 fichiers / 325 tests, et non 292 ; total correct 325 + 23 = 348, et non l'ancien calcul erroné basé sur « 26 tests ProjectsPage »).
- Section « Validation automatisée » et « Validation manuelle » : nombre de tests mis à jour (348, 23 tests `PhasesPage`).
- Section « Risques et points pour la Phase 3.8 » : le paragraphe sur les mutations en vol pendant un changement de projet actif, initialement documenté comme un risque non couvert, renvoie désormais vers ce rapport de corrections.

## Fichier parasite

`RAPPORT_PHASE_3.7.txt` a été **supprimé**. Vérification effectuée avant suppression : aucun fichier `CLAUDE.md` n'existe dans ce dépôt, et aucune recherche dans `workflow/` n'a fait apparaître de règle documentée imposant une copie `.txt` des rapports à la racine. Cette pratique provenait uniquement d'une préférence mémorisée par l'assistant lors d'une session antérieure, non d'une règle du dépôt — conformément à l'instruction de ne pas « inventer une convention non documentée », elle a été abandonnée. Aucun autre fichier `.txt` parasite lié à la Phase 3.7 n'existe à la racine (`ls *.txt` ne retourne plus rien).

## Validation

```bash
npm run typecheck
```
→ **Succès**, aucune erreur.

```bash
npm run test
```
→ **Succès** : `Test Files 19 passed (19)` / `Tests 348 passed (348)` (325 avant la Phase 3.7 + 23 tests de `PhasesPage.test.tsx`, dont 5 nouveaux issus de ces corrections).

```bash
npm run build
```
→ **Succès** : main (`out/main/index.js`, 27.49 kB), preload (`out/preload/index.js`, 2.03 kB), renderer (`index-B7L9SDfN.js`, 729.18 kB, `index-DzsytAJr.css`, 6.89 kB).

```bash
npm run dev
```
→ Démarrage vérifié techniquement : les processus Electron réels (main, GPU, réseau, renderer — 4 processus observés dans la liste des processus système) sont lancés après le rebuild natif et le build de développement ; aucune exception n'apparaît dans la sortie du processus main après `starting electron app...`.

## Validation manuelle

**Ce qui a été vérifié techniquement par Claude Code** : démarrage propre de l'application (aucune erreur dans le processus main), et l'intégralité des scénarios de concurrence décrits ci-dessus via les 5 nouveaux tests automatisés (avec confirmation qu'ils échouent sans la correction).

**Ce qui reste obligatoirement à confirmer par l'utilisateur, de façon interactive** (aucune des interactions suivantes n'a été réalisée par Claude Code dans cette session, qui n'a pas de contrôle interactif sur la fenêtre Electron réelle) :
1. Créer ou sélectionner le projet A, ouvrir la page des phases.
2. Créer et modifier des phases pour A.
3. Changer vers un projet B et vérifier que les phases affichées correspondent toujours au projet réellement actif.
4. Vérifier que le bouton « Nouvelle phase » n'est jamais bloqué après un changement normal de projet (sans mutation en vol).
5. Vérifier la création, la modification et la suppression de phases dans l'interface réelle.
6. Redémarrer l'application et vérifier la persistance SQLite des phases créées.
7. Vérifier l'absence d'erreur dans les consoles main et renderer pendant l'ensemble de ces interactions.

Ces points recoupent la checklist manuelle de 13 points déjà identifiée par `workflow/reports/REVIEW_PHASE_3.7.md` (état sans projet actif, sélection, état vide, création de deux phases, ordre visuel, modification, annulation de modification, annulation de suppression, suppression confirmée, persistance après redémarrage, changement de projet, absence de résidu visuel, absence d'erreur console) — aucun de ces points n'a été exécuté interactivement par Claude Code, ni avant ni après ces corrections.

## Git

Aucun commit n'a été créé.

```bash
git status --short
```
```
 M src/renderer/src/App.tsx
 M src/renderer/src/pages/ProjectsPage.test.tsx
 M src/renderer/src/pages/ProjectsPage.tsx
 M src/renderer/src/styles.css
?? src/renderer/src/components/phases/
?? src/renderer/src/pages/PhasesPage.test.tsx
?? src/renderer/src/pages/PhasesPage.tsx
?? workflow/prompts/PHASE_3.7_CORRECTIONS_PROMPT.md
?? workflow/prompts/PHASE_3.7_PROMPT.md
?? workflow/prompts/PHASE_3.7_REVIEW_PROMPT.md
?? workflow/reports/RAPPORT_CORRECTIONS_REVIEW_PHASE_3.7.md
?? workflow/reports/RAPPORT_PHASE_3.7.md
?? workflow/reports/REVIEW_PHASE_3.7.md
```

```bash
git diff --stat
```
```
 src/renderer/src/App.tsx                     | 11 +++-
 src/renderer/src/pages/ProjectsPage.test.tsx | 42 +++++++++------
 src/renderer/src/pages/ProjectsPage.tsx      | 35 ++++++++----
 src/renderer/src/styles.css                  | 80 ++++++++++++++++++++--------
 4 files changed, 120 insertions(+), 48 deletions(-)
```

```bash
git diff --check
```
Aucune sortie : aucune erreur d'espacement signalée.

Note : `src/renderer/src/pages/PhasesPage.tsx` et `src/renderer/src/pages/PhasesPage.test.tsx`, contenant les corrections de cette session, sont des fichiers non suivis (créés pendant la Phase 3.7 initiale) : ils n'apparaissent donc pas dans `git diff --stat` (qui ne compare que les fichiers déjà suivis), conformément à la remarque de `REVIEW_PHASE_3.7.md`.
