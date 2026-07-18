# RE-REVIEW CIBLÉE DES CORRECTIONS — PHASE 3.7

## Périmètre inspecté

Documents lus intégralement : `PHASE_3.7_PROMPT.md`, `RAPPORT_PHASE_3.7.md`, `PHASE_3.7_REVIEW_PROMPT.md`, `REVIEW_PHASE_3.7.md`, `PHASE_3.7_CORRECTIONS_PROMPT.md`, `RAPPORT_CORRECTIONS_REVIEW_PHASE_3.7.md`. Code inspecté directement (pas seulement via les rapports) : `src/renderer/src/pages/PhasesPage.tsx` (intégral, 305 lignes), `src/renderer/src/pages/PhasesPage.test.tsx` (intégral, en particulier la nouvelle section de tests l.418-620), `src/renderer/src/App.tsx`, `src/renderer/src/pages/ProjectsPage.tsx`.

**Confirmation du périmètre strict** : `git diff -- package.json package-lock.json src/preload src/main/ipc src/main/database/repositories src/main/database/migrations src/shared/schemas` est vide — aucune modification de preload, handlers IPC, repositories, migrations, schémas partagés ou dépendances. Aucune trace de tâches, checklists, ou de fonctionnalité de Phase 3.8/4 dans le diff. Les seuls fichiers tracés modifiés (`App.tsx`, `ProjectsPage.tsx`, `ProjectsPage.test.tsx`, `styles.css`) sont identiques à ceux déjà présents avant cette passe de corrections (confirmé par comparaison avec `REVIEW_PHASE_3.7.md`) : aucun n'a été retouché pendant les corrections, conforme à l'annonce du rapport de corrections.

## Vérification de `activeProjectIdRef`

Ligne 44-45 de `PhasesPage.tsx` :
```ts
const activeProjectIdRef = useRef(activeProjectId)
activeProjectIdRef.current = activeProjectId
```
Initialisée avec l'identifiant courant (ou `null`), réassignée de façon inconditionnelle à chaque rendu, avant toute utilisation dans un effet ou une fermeture — donc jamais désynchronisée. Elle n'est lue nulle part comme source de vérité de rendu (le rendu utilise toujours `activeProject`/`project`, jamais `activeProjectIdRef.current`) : elle sert exclusivement à vérifier la pertinence d'une opération asynchrone après un `await`, conforme à l'exigence. Aucune dépendance de hook incorrecte : `loadPhases` (`useCallback(..., [])`) ne la liste pas dans ses dépendances, ce qui est correct puisqu'une ref n'a pas besoin de déclencher de re-création de callback.

## Vérification des chargements obsolètes

Dans `loadPhases` (l.47-62) :
```ts
if (!isMountedRef.current || activeProjectIdRef.current !== projectId) {
  return
}
```
présent identiquement dans la branche de succès (l.51, avant `setPhases`/`setLoadState('loaded')`) et dans la branche d'erreur (l.57, avant `setLoadState('error')`). Aucune mise à jour d'état n'est exécutée pour une requête obsolète dans les deux branches. Confirmé par les tests 1 et 2 (voir plus bas) : le chargement de B reste autoritaire même si A répond après, et une erreur tardive de A ne masque jamais le résultat de B.

## Vérification des trois mutations

Principe commun vérifié dans `handleSubmitForm` (l.112-185) et `handleDelete` (l.187-235) : `const mutationProjectId = project.id` capturé avant tout `await`, puis une fonction locale `isStillRelevant()` définie exactement comme demandé :
```ts
function isStillRelevant(): boolean {
  return isMountedRef.current && activeProjectIdRef.current === mutationProjectId
}
```

**Création** (l.138-150) : `isStillRelevant()` vérifié avant `setPhases` (ajout + tri local) et avant `setFormState({mode:'closed'})`. Une phase créée pour A ne peut jamais apparaître dans la liste de B (confirmé par test 3) ; une création tardive de A ne peut jamais fermer un formulaire ouvert pour B (le formulaire de B n'existe déjà plus par l'effet de reset au moment où la mutation de A se termine, protection redondante mais correcte — voir MINEUR #2 sur la couverture de test de ce point précis).

**Modification** (l.151-167) : même garde unique avant le bloc `if (updated) {...} else {...}` — couvre à la fois le résultat valide (mise à jour de liste + fermeture) et le retour `null` (message d'erreur) dans un seul point de contrôle, conforme à la demande de contextualiser les deux cas. L'unicité des UUID n'est pas invoquée comme seule protection : la vérification `activeProjectIdRef.current === mutationProjectId` s'applique indépendamment de la structure des données.

**Suppression** (l.211-232) : identifiant capturé avant l'appel (l.202, avant `window.themeFactoryApi.phases.remove`) ; retour `true` ne retire la phase que si `isStillRelevant()` (l.214-218) ; retour `false` n'affiche l'erreur que dans ce même cas (l.219-220) ; exception obsolète ignorée (l.222-226).

## Vérification des blocs `catch` et `finally`

Chaque `catch` (l.168, l.222) est gardé par `isStillRelevant()` avant `setFormErrorMessage`/`setDeleteErrorMessage`. Chaque `finally` (l.173-181, l.227-231) est également gardé par `isStillRelevant()` — et non plus par `isMountedRef.current` seul comme avant correction — avant `setIsSubmittingForm(false)`/`setDeletingPhaseId(null)`. Recherche exhaustive de toutes les occurrences de `await window.themeFactoryApi.phases`, `setPhases`, `setFormState`, `setFormErrorMessage`, `setDeleteErrorMessage`, `setIsSubmittingForm`, `setDeletingPhaseId` dans le fichier : chaque mise à jour d'état consécutive à un `await` est gardée ; les seules mises à jour non gardées sont soit synchrones (ouverture de formulaire, clic sur bouton), soit la réinitialisation inconditionnelle et volontaire de l'effet de changement de projet (l.69-79). Aucune branche asynchrone oubliée.

## Vérification du changement de projet actif

L'effet (l.69-79) réinitialise `formState`, `formErrorMessage`, `deleteErrorMessage`, `deletingPhaseId`, **`isSubmittingForm`** (ajout confirmé, absent avant la correction) et `phases`. Le chargement (`loadState`) n'est pas remis à `'loading'` explicitement dans cet effet, mais l'est systématiquement par `loadPhases` lorsqu'un nouveau projet est actif (l.48) ; lorsque le nouveau projet actif est `null`, `loadState` n'est jamais affiché (retour anticipé l.81-89) — ce comportement est donc sans effet visible, cohérent avec l'analyse déjà faite dans la review initiale. Un `finally` tardif ne peut pas annuler cette réinitialisation : il est lui-même conditionné par `isStillRelevant()`, qui compare au projet actif **courant**, donc à la valeur déjà mise à jour par cet effet.

## Analyse des 5 tests de concurrence

Les 5 tests (l.418-620 de `PhasesPage.test.tsx`) utilisent exclusivement des promesses contrôlées manuellement (`new Promise((resolve) => { resolveX = resolve })`), jamais de résolution automatique immédiate pour les scénarios concurrents : un véritable ordre asynchrone est contrôlé, pas de simples rerenders séquentiels après résolution.

| Test | Vérifications attendues (section 9 du prompt) | Constat |
|---|---|---|
| 1. Chargement inversé | A en attente réelle, B démarre avant résolution de A, B résolu en premier, A résolu ensuite, phase B visible, phase A absente, nom du projet actif reste B | ✅ toutes vérifiées, y compris l'en-tête « Projet actif : Projet B » (l.463) |
| 2. Erreur obsolète | B s'affiche correctement, A échoue après, aucune erreur de A visible, phases de B affichées | ✅ toutes vérifiées |
| 3. Création en vol | Création de A réellement en attente, passage à B avant résolution, bouton actif pour B, contamination absente, formulaire de B non fermé | ✅ pour les 4 premiers points ; **le dernier point (« aucun formulaire de B n'est fermé par A ») n'est pas testé dans le cas où B possède réellement un formulaire ouvert au moment de la résolution tardive de A** — le test vérifie seulement l'absence de formulaire résiduel juste après le changement de projet (garanti trivialement par l'effet de reset), pas la survie d'un formulaire de B ouvert *après* ce changement — voir **MINEUR #2** |
| 4. Erreur de mutation obsolète | Rejet après passage à B, aucun message de A affiché, B utilisable | ✅ toutes vérifiées |
| 5. Suppressions concurrentes | Suppression de A en attente, suppression de B démarrée ensuite, résolution de A ne réinitialise pas l'état de B, B désactivé jusqu'à sa propre résolution, phase de B retirée seulement après sa résolution | ✅ toutes vérifiées explicitement, y compris la protection du `finally` (l.606-612) |

**Vérification de non-trivialité** (déjà effectuée par la session de corrections, revérifiée par lecture du rapport et par la cohérence du code) : le rapport de corrections indique que 4 des 5 tests échouent sur une version dégradée du code, ce qui est cohérent avec l'analyse structurelle ci-dessus (le 5ᵉ test, sur l'erreur de mutation obsolète, ne sollicite pas spécifiquement la branche `finally` contextualisée, donc peut réussir même sans cette protection précise — le rapport le reconnaît lui-même).

## Non-régression des tests existants

Structure des `describe` confirmée par recherche directe : les 6 blocs originaux (`aucun projet actif`, `chargement`, `création`, `modification`, `suppression`, `changement de projet actif`) et le bloc `accessibilité des lignes multiples` sont tous présents, dans le même ordre, avec le nouveau bloc `concurrence lors d'un changement de projet actif` inséré entre les deux derniers — aucune suppression, aucun déplacement de contenu existant. Recherche de `.skip`/`.only`/`@ts-ignore`/`@ts-expect-error` dans `PhasesPage.tsx` et `PhasesPage.test.tsx` : aucune occurrence. Exécution complète de `PhasesPage.test.tsx` : 23/23 réussis, aucun avertissement `act(...)` dans la sortie capturée (vérifié explicitement par recherche dans le log complet de test). Toutes les promesses contrôlées manuellement sont résolues ou rejetées à l'intérieur de `act(async () => {...})`.

## Vérification documentaire

`workflow/reports/RAPPORT_PHASE_3.7.md` a bien été corrigé sur plusieurs points (base 325 confirmée, 15 tests `ProjectsPage` à la ligne 33, section « Résultat global » recalculée correctement à 348 avec le détail 325+23). Cependant, **trois occurrences n'ont pas été corrigées** malgré la même inexactitude que celle déjà signalée par la review initiale :

- Ligne 9 (Résumé/Statut final) : « `npm run test` (**343/343**) » — non mis à jour vers 348/343.
- Ligne 68 (section Tests → Fichiers modifiés) : « les **26** tests existants sont inchangés dans leur logique » — la même phrase avait pourtant été corrigée en « 15 tests existants » à la ligne 33 (section Fichiers modifiés générale), mais pas ici, dans la sous-section Tests qui répète la même affirmation.
- Ligne 89 (Validation automatisée) : tailles/hash de build encore ceux d'avant les corrections (`index-3J4d3fn-.js`, 728.63 kB) alors que le build réel après corrections produit `index-B7L9SDfN.js`, 729.18 kB (confirmé par deux exécutions indépendantes de `npm run build` pendant cette re-review et par le rapport de corrections lui-même).

Le reste des affirmations vérifiées est exact : la protection de concurrence est bien décrite (nouveau paragraphe « Concurrence » et renvoi vers `RAPPORT_CORRECTIONS_REVIEW_PHASE_3.7.md`), et le risque de mutation en vol n'est plus présenté comme non corrigé (paragraphe final de la section Risques mis à jour en conséquence). Aucune nouvelle affirmation incorrecte n'a été introduite — les trois points ci-dessus sont des oublis de mise à jour, pas des erreurs nouvelles.

## Fichier parasite

`RAPPORT_PHASE_3.7.txt` n'existe plus à la racine (`ls *.txt` ne retourne aucun résultat). Aucun `REVIEW_PHASE_3.7.txt`, aucun fichier temporaire, aucune copie de rapport hors `workflow/reports/` détectée à la racine du dépôt. La justification donnée dans `RAPPORT_CORRECTIONS_REVIEW_PHASE_3.7.md` (absence de `CLAUDE.md` et absence de règle documentée dans `workflow/`) a été revérifiée de façon indépendante pendant cette re-review : confirmée exacte.

## Validations automatisées (exécutées indépendamment)

```bash
npm run typecheck
```
→ Succès, aucune erreur.

```bash
npm run test
```
→ `Test Files 19 passed (19)` / `Tests 348 passed (348)` — conforme au résultat attendu.

```bash
npm run build
```
→ Succès : main 27.49 kB, preload 2.03 kB, renderer `index-B7L9SDfN.js` 729.18 kB / `index-DzsytAJr.css` 6.89 kB. Identique au build annoncé par `RAPPORT_CORRECTIONS_REVIEW_PHASE_3.7.md`, différent de celui encore documenté dans `RAPPORT_PHASE_3.7.md` (voir MINEUR #1).

Aucune différence avec les résultats attendus (19 fichiers, 348 tests, typecheck et build sans erreur).

## État Git

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
?? workflow/prompts/PHASE_3.7_CORRECTIONS_REVIEW_PROMPT.md
?? workflow/prompts/PHASE_3.7_PROMPT.md
?? workflow/prompts/PHASE_3.7_REVIEW_PROMPT.md
?? workflow/reports/RAPPORT_CORRECTIONS_REVIEW_PHASE_3.7.md
?? workflow/reports/RAPPORT_PHASE_3.7.md
?? workflow/reports/REVIEW_PHASE_3.7.md
```

`git diff --stat` : identique à l'état précédent la correction (4 fichiers suivis, 120 insertions / 48 suppressions) — confirmé qu'aucun de ces 4 fichiers n'a été retouché pendant les corrections. `git diff --check` ne signale aucune erreur d'espacement. Rappel appliqué : `PhasesPage.tsx`/`PhasesPage.test.tsx`, contenant les corrections réelles, sont non suivis et n'apparaissent donc pas dans `git diff --stat`. Aucun fichier parasite, aucune modification de dépendance.

## Constats classés

Aucun défaut **BLOQUANT** ni **IMPORTANT**.

**MINEUR #1** — Trois chiffres non actualisés dans `workflow/reports/RAPPORT_PHASE_3.7.md` (ligne 9 : 343/343 au lieu de 348/348 ; ligne 68 : « 26 tests existants » au lieu de 15 ; ligne 89 : hash/taille de build antérieurs aux corrections). Impact : purement documentaire, aucun risque fonctionnel, le code et les résultats de tests réels restent corrects et vérifiés indépendamment. Correction minimale recommandée : remplacer ces trois valeurs par les nombres corrects (348/348, 15, `index-B7L9SDfN.js`/729.18 kB) lors d'une prochaine intervention sur ce rapport.

**MINEUR #2** — `src/renderer/src/pages/PhasesPage.test.tsx`, test « une création en vol pour A ne bloque pas... » (l.498-531) : ne vérifie pas explicitement qu'un formulaire *réellement ouvert* pour B survit à la résolution tardive de la création de A (le test vérifie seulement l'absence de formulaire résiduel juste après le changement de projet, garanti trivialement par l'effet de reset, pas par la garde `isStillRelevant()` sur `setFormState`). La protection correspondante dans le code est néanmoins vérifiée correcte par lecture directe (garde uniforme avant tout `setFormState`), et le test 5 (suppression) démontre le même schéma de protection sur un état analogue. Correction minimale recommandée (non bloquante) : ajouter, dans une prochaine itération, un scénario ouvrant un formulaire de création ou d'édition pour B avant de résoudre tardivement une mutation de A, puis vérifiant que ce formulaire reste ouvert et intact.

**OBSERVATION** — Le `loadState` n'est pas explicitement remis à un état neutre par l'effet de changement de projet lorsque le nouveau projet actif est `null` ; ce n'est pas un défaut car ce state n'est jamais rendu dans cette branche (retour anticipé avant toute utilisation de `loadState`), vérifié par lecture directe.

## Checklist manuelle restante

Aucun des points suivants n'a été exécuté de façon interactive par cette re-review (analyse strictement statique + tests automatisés) :

1. État sans projet actif.
2. Sélection ou création du projet A.
3. Ouverture de la page des phases, création et modification de phases pour A.
4. Changement vers un projet B et vérification que les phases affichées correspondent toujours au projet réellement actif.
5. Vérification que le bouton « Nouvelle phase » n'est jamais bloqué après un changement normal de projet.
6. Suppression (annulée puis confirmée).
7. Redémarrage de l'application et vérification de la persistance SQLite.
8. Absence d'erreur dans les consoles main et renderer pendant l'ensemble de ces interactions.

## Verdict

## Verdict A — CORRECTIONS VALIDÉES, VALIDATION MANUELLE REQUISE

Aucun défaut bloquant ou important ne subsiste : les deux défauts IMPORTANT de la review initiale (réponses de chargement obsolètes, mutations en vol non protégées) sont corrigés de façon cohérente et systématique dans tout `PhasesPage.tsx` (chargement, création, modification, suppression, `catch`, `finally`), vérifiée par lecture exhaustive de chaque mise à jour d'état consécutive à un `await`. Les 5 tests de concurrence ajoutés sont fiables : ils contrôlent un véritable ordre asynchrone inversé et couvrent la quasi-totalité des scénarios demandés (à l'exception du point mineur de couverture noté en MINEUR #2). `npm run typecheck`, `npm run test` (348/348) et `npm run build` réussissent tous les trois, réexécutés indépendamment. Seuls des constats MINEUR (inexactitudes documentaires résiduelles, une lacune de couverture de test non bloquante) subsistent.

**Décision explicite** :
- Aucune nouvelle correction applicative n'est nécessaire avant commit.
- Les deux constats MINEUR peuvent être traités lors d'une prochaine intervention sans bloquer la suite ; ils ne remettent pas en cause la fiabilité des corrections.
- La validation manuelle interactive de l'utilisateur reste **obligatoire** avant de considérer la Phase 3.7 définitivement close (les 8 points de la checklist ci-dessus, aucun n'ayant encore été exécuté par un humain).
- Le commit ne doit être créé qu'après cette validation manuelle, conformément à la consigne de ne pas valider définitivement la Phase 3.7 avant confirmation utilisateur.
