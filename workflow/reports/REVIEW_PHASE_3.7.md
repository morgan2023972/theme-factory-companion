# REVIEW — Phase 3.7 : Interface de gestion des phases

## Fichiers inspectés

`App.tsx`, `pages/ProjectsPage.tsx`, `pages/ProjectsPage.test.tsx`, `pages/PhasesPage.tsx`, `pages/PhasesPage.test.tsx`, `components/phases/PhaseCard.tsx`, `components/phases/PhaseForm.tsx`, `components/phases/phaseStatusLabels.ts`, `styles.css`, `shared/schemas/phase.ts`, `shared/schemas/project.ts`, `shared/contracts/themeFactoryApi.ts`, `preload/index.ts`, `main/ipc/registerPhasesHandlers.ts`, `main/database/repositories/phasesRepository.ts`, ainsi que `components/projects/ProjectCard.tsx`/`ProjectForm.tsx` comme référence. Le rapport `RAPPORT_PHASE_3.7.md` a été lu intégralement puis chaque affirmation importante vérifiée dans le code réel, pas acceptée telle quelle.

## Résumé du diff

```
git status --short
 M src/renderer/src/App.tsx
 M src/renderer/src/pages/ProjectsPage.test.tsx
 M src/renderer/src/pages/ProjectsPage.tsx
 M src/renderer/src/styles.css
?? RAPPORT_PHASE_3.7.txt
?? src/renderer/src/components/phases/
?? src/renderer/src/pages/PhasesPage.test.tsx
?? src/renderer/src/pages/PhasesPage.tsx
?? workflow/prompts/PHASE_3.7_PROMPT.md
?? workflow/prompts/PHASE_3.7_REVIEW_PROMPT.md
?? workflow/reports/RAPPORT_PHASE_3.7.md
```

`git diff --stat` : 4 fichiers suivis modifiés (120 insertions / 48 suppressions), cohérent avec le rapport. `git diff --check` ne signale aucune erreur d'espacement. `git diff -- package.json package-lock.json` est vide : aucune dépendance ajoutée, conforme au rapport. Aucun fichier modifié non annoncé par le rapport n'a été trouvé.

## Conformité au périmètre

Confirmé par lecture complète du diff : ni tâches, ni checklists, ni glisser-déposer, ni réordonnancement avancé, ni journal d'activité, ni tableau de bord, aucune nouvelle dépendance, aucune nouvelle bibliothèque de formulaire/état, aucun accès direct à Electron/Node/SQLite depuis le renderer (`grep` négatif sur `from 'electron'`, `from 'node:`, `ipcRenderer` dans les fichiers de phases). Le partage du projet actif est bien limité à un `useState` supplémentaire dans `App.tsx` et à la conversion de `ProjectsPage` en composant contrôlé pour cette seule valeur — aucune bibliothèque de state management introduite.

## Analyse du projet actif

`App.tsx` détient désormais l'unique `useState<Project | null>` pour `activeProject`, transmis en lecture à `PhasesPage` et en contrôle à `ProjectsPage`. `ProjectsPage` ne conserve aucune deuxième valeur locale concurrente (l'ancien `useState<string | null>` a bien été supprimé, vérifié par `git diff`). `activeProjectRef` (l.37-38 de `ProjectsPage.tsx`) est réassigné de façon inconditionnelle à chaque rendu, avant tout retour anticipé et avant toute fermeture : il ne peut pas se désynchroniser de la prop réelle. La sélection, la modification (le nom du projet actif est bien resynchronisé via `onActiveProjectChange(updated)` si `activeProjectRef.current?.id === updated.id`, l.109-111), la suppression (`onActiveProjectChange(null)`, l.154-156) et la réconciliation après un rechargement de liste (l.49-52) sont toutes correctement propagées. Aucune boucle de rendu : `loadProjects` ne dépend que de `onActiveProjectChange` (identité stable, fonction `useState` setter), pas de `activeProject`, donc changer de sélection ne redéclenche pas un rechargement de la liste des projets. Aucune régression du CRUD projets identifiée : les 15 tests de `ProjectsPage.test.tsx` (voir section Tests) couvrent exactement les mêmes scénarios qu'avant la Phase 3.7.

## Analyse du chargement asynchrone (PhasesPage) — DÉFAUT CONFIRMÉ

Le scénario demandé par le prompt de review a été tracé intégralement dans le code de `PhasesPage.tsx` :

1. Projet A actif → l'effet (l.60-69) appelle `loadPhases(A)`.
2. `loadPhases` (l.40-55) attend `listByProjectId(A)`, lentement.
3. Projet B devient actif (nouveau rendu, `activeProjectId` change) → l'effet se redéclenche, remet `phases` à `[]`, appelle `loadPhases(B)`. Les deux appels (`A` et `B`) sont désormais concurrents, chacun avec son propre `await` indépendant.
4. La promesse de B se résout en premier → `setPhases(resultB)`, `setLoadState({status:'loaded'})`.
5. La promesse de A se résout ensuite → **aucune vérification n'existe pour savoir si `A` est toujours le projet affiché** ; le seul garde-fou est `isMountedRef.current`, qui protège contre un démontage réel du composant, pas contre un changement de `activeProjectId` à composant toujours monté. `setPhases(resultA)` écrase donc silencieusement les phases de B avec celles de A.

Aucune protection (pas de jeton de requête, pas de comparaison `projectId === activeProjectIdActuel` après l'`await`) n'existe dans `loadPhases`. C'est exactement le défaut que le prompt de review demande de classer au minimum **IMPORTANT** en l'absence de protection — voir constat **IMPORTANT #1**.

## Analyse des mutations (création/modification/suppression) — DÉFAUT CONFIRMÉ

Les fermetures `run()` de `handleSubmitForm` et `handleDelete` capturent `project`/`phase` au moment du clic, mais leur reprise après `await` ne vérifie que `isMountedRef.current`, jamais si le projet actif a changé entre-temps. Traçage précis :

- **Création** (l.117-129) : si le projet actif passe de A à B pendant l'attente de `phases.create(...)`, au retour, `setPhases((current) => sortByPosition([...current, created]))` s'exécute **sans condition** sur `current`, qui contient déjà les phases de B (remises à jour par l'effet de changement de projet) : la phase nouvellement créée pour A est directement insérée dans la liste visuellement affichée pour B. `setFormState({ mode: 'closed' })` s'exécute aussi sans condition : si l'utilisateur avait déjà rouvert un formulaire de création pour B, celui-ci se referme silencieusement à la place. En cas d'échec de la création de A après le changement de projet, `setFormErrorMessage(getErrorMessage(error))` afficherait de la même façon une erreur relative à A dans le contexte de B.
- **Modification** : par chance, comme les identifiants de phase sont des UUID globalement uniques entre projets, le `.map` de mise à jour (l.141) ne trouve jamais de correspondance dans la liste de B et n'altère donc pas visuellement les données de B — mais `setFormState({ mode: 'closed' })` s'exécute quand même sans condition, ce qui peut fermer un formulaire que l'utilisateur vient d'ouvrir pour B.
- **Suppression** : la même absence de garde existe, mais le filtre par `id` (l.184) est également sans effet visuel sur la liste de B pour la même raison d'unicité des identifiants ; en revanche un échec tardif de la suppression de A afficherait `deleteErrorMessage` dans le contexte de B.
- **Confirmé par lecture directe et reproductible sans ambiguïté** (pas seulement une hypothèse théorique) : l'effet de changement de projet actif (l.60-69) réinitialise `formState`, `formErrorMessage`, `deleteErrorMessage` et `deletingPhaseId`, **mais n'inclut pas `setIsSubmittingForm(false)`**. Conséquence concrète et facilement reproductible : si l'utilisateur soumet une création pour le projet A puis change de projet actif avant que la promesse ne se résolve, le bouton toolbar « Nouvelle phase » du projet B reste désactivé (`disabled={formState.mode !== 'closed' || isSubmittingForm}`) jusqu'à ce que la promesse de A se résolve ou échoue — ce qui peut prendre un temps arbitraire (ou ne jamais se produire en cas de blocage réseau), bloquant l'utilisateur sur le nouveau projet sans aucune indication visuelle de la cause.

Ce point est un **défaut reproductible**, pas une simple observation théorique : aucun test actuel ne combine une mutation en vol avec un changement de projet actif (vérifié par recherche de `rerender` dans `PhasesPage.test.tsx` : les deux tests utilisant `rerender` — changement de projet et retour à « aucun projet » — n'ont aucune mutation en cours au moment du changement). Voir constat **IMPORTANT #2**.

## Formulaire et validation locale (PhaseForm)

Vérifié champ par champ : nom composé uniquement d'espaces → rejeté (`trim() === ''`) ; description vide → convertie en `null` (`toOptionalText`) ; description effacée en édition → `null` transmis correctement (le modèle l'autorise, `description` étant nullable) ; position vide → `null`, omise de l'appel (ni création ni modification n'envoient de valeur artificielle) ; position `'0'` → correctement distinguée de « vide » (`trimmedPosition !== ''`, pas de test de vérité sur `0`) et transmise ; position négative → rejetée avec message explicite avant tout appel API ; position décimale (`Number.isInteger`) → rejetée ; saisie non numérique → `NaN`, rejetée. Le statut est contraint par un `<select>` sur `PHASE_STATUSES`, aucune valeur hors énumération n'est atteignable via l'UI normale. Aucun `any`, aucun cast dangereux dans ce fichier. Cohérent avec `createPhaseSchema`/`updatePhaseSchema`.

## Gestion des positions et ordre d'affichage

Le chargement initial (`setPhases(result)`, l.47) conserve l'ordre exact renvoyé par l'API, sans retri. Le tri local après création/modification (`sortByPosition`) construit une copie (`[...phases].sort(...)`) avant de trier : aucune mutation directe de l'état précédent. Le tri local n'utilise que `position` comme clé, alors que le repository trie par `position ASC, created_at ASC, id ASC` — mais la contrainte `UNIQUE(project_id, position)` (Phase 3.5) garantit qu'aucune égalité de position ne peut exister pour un même projet dans un état valide : les clés secondaires du repository ne peuvent donc jamais entrer en jeu, et le tri local à clé unique reproduit exactement l'ordre garanti par le repository. Ce point est vérifié correct, aucune correction requise ici (conforme à l'instruction de ne pas signaler de défaut sur un comportement exact). Le rang visuel « Phase N » (`displayPosition`, dérivé de l'index d'affichage) n'est jamais confondu avec `phase.position` dans le code — les deux valeurs restent distinctes. Une collision de position (modification manuelle du champ vers une valeur déjà utilisée) remonte l'erreur SQLite brute de `phasesRepository` telle quelle dans `formErrorMessage` ; ce n'est pas dangereux (pas d'injection, texte simplement peu clair pour un utilisateur non technique) — voir **MINEUR #1**.

## Suppression

Confirmation via `window.confirm` nommant la phase (`Supprimer définitivement la phase « ${phase.name} »`) ; annulation ne déclenche aucun appel (`if (!confirmed) return`) ; confirmation appelle `remove` une seule fois avec le bon identifiant (`deletingPhaseId !== null` empêche un second clic pendant l'appel) ; retour `true` retire uniquement la phase concernée (`filter` par id) ; retour `false` conserve la phase et affiche un message explicite ; une exception fait de même. Les actions incompatibles sont désactivées pendant la suppression (`disableModify`/`disableDelete` sur les autres cartes). La suppression d'une phase en cours d'édition n'est pas directement empêchée par un garde dédié, mais elle est de fait rendue impossible via l'UI : `disableDelete={formState.mode !== 'closed' || deletingPhaseId !== null}` désactive déjà le bouton Supprimer de toute carte dès qu'un formulaire est ouvert, y compris pour la carte en cours d'édition elle-même. Le comportement lors d'un changement de projet pendant une suppression est sûr pour la liste affichée (voir section précédente) mais partage le même défaut d'attribution d'erreur que les autres mutations (IMPORTANT #2).

## Accessibilité (PhaseCard)

Nom affiché, description conditionnelle, statut avec libellé lisible (`PHASE_STATUS_LABELS`), rang visuel comprehensible (« Phase N — nom »). Les boutons Modifier/Supprimer portent un `aria-label` incluant le nom réel de la phase (`Modifier la phase ${phase.name}`, `Supprimer la phase ${phase.name}`), vérifiés distincts entre plusieurs lignes par le test dédié. Boutons natifs (`<button type="button">`), accessibles au clavier sans code additionnel. Aucune injection dangereuse : React échappe le texte, `aria-label` reste un attribut de chaîne simple. Aucune propriété inexistante du schéma `Phase` utilisée.

## Styles

Le diff de `styles.css` n'utilise que des sélecteurs groupés (`.projects-page, .phases-page { ... }`, etc.) : les corps de règles pour les sélecteurs `.project-*`/`.projects-page__*` existants restent identiques caractère pour caractère, seuls des sélecteurs `.phase-*`/`.phases-page__*` supplémentaires sont ajoutés aux mêmes blocs. Aucune régression visuelle possible sur le module Projets par construction (union de sélecteurs, pas de redéfinition). Deux règles réellement nouvelles et propres aux phases (`.phases-page__active-project`, `.phases-page__no-active-project`). Les états chargement/erreur/vide/aucun-projet-actif restent visuellement distincts (mêmes classes que Projets, plus un message dédié pour l'absence de projet). Aucun style global excessif ajouté.

## Analyse des tests de `PhasesPage`

18 tests confirmés (recomptés par grep, indépendamment du rapport). Les scénarios annoncés sont réellement couverts : absence de projet actif + absence d'appel API + absence de bouton création ; chargement avec promesse contrôlée manuellement (pas de résolution immédiate masquant l'état de chargement) ; état vide résolu après la promesse ; ordre des phases vérifié explicitement sur le texte des deux `<h3>` (pas seulement sur la présence des deux noms) ; erreur de chargement + réessai ; création avec vérification du payload exact (`projectId` inclus, position omise si vide — vérifié avec `expect(payload).not.toHaveProperty('position')`, pas seulement `toBeUndefined()`, ce qui est la vérification la plus stricte) ; double soumission bloquée avec une promesse contrôlée manuellement (le bouton est vérifié désactivé **avant** résolution) ; erreur de création conservant le formulaire et les valeurs ; modification avec vérification explicite de l'absence de `projectId` dans le payload (`not.toHaveProperty('projectId')`) ; retour `null` ; annulation sans appel ; suppression annulée/réussie/`false`/exception ; changement de projet actif via `rerender` réaliste ; retour à l'état « aucun projet actif ». `window.confirm` est bien restauré entre les tests via `vi.restoreAllMocks()` dans `afterEach`. Aucun `.skip`/`.only`. Requêtes basées sur rôles et labels accessibles dans la quasi-totalité des cas.

**Lacune confirmée** : aucun test ne combine une mutation en vol (création/modification/suppression) avec un changement de projet actif pendant cette mutation, et aucun test ne force une résolution **inversée** des deux appels `listByProjectId` lors d'un changement de projet (les deux tests `rerender` existants attendent la résolution du premier appel via `await screen.findByText(...)` avant de déclencher le second changement, donc les deux appels ne sont jamais réellement concurrents dans les tests actuels). Cette absence de test est cohérente avec l'implémentation réelle : elle n'est pas séparée du défaut lui-même, elle en est la conséquence directe (le code ne protège rien, donc aucun test ne peut démontrer une protection qui n'existe pas). Elle est rattachée aux constats IMPORTANT #1 et #2 plutôt que comptée comme un défaut de test indépendant.

Les casts `as unknown as ThemeFactoryApi['phases']` / `['projects']` dans les fichiers de test (nouveau et préexistant) sont confinés aux mocks de test, pas du code applicatif, et suivent une convention déjà établie en Phase 3.4 — non retenu comme défaut.

## Non-régression de `ProjectsPage`

Le harnais `ProjectsPageHarness` (l.10-19 du fichier de test) reproduit exactement la même invocation que `App.tsx` (`<ProjectsPage activeProject={activeProject} onActiveProjectChange={setActiveProject} />` avec un `useState<Project | null>(null)` local), vérifié par comparaison directe ligne à ligne — aucune divergence entre le harnais et le vrai parent. Les 15 tests existants (et non 26, voir **MINEUR #2**) n'ont subi aucune modification d'assertion : seul le point de montage (`render(<ProjectsPage />)` → `render(<ProjectsPageHarness />)`) a changé, confirmé par `git diff` sur l'intégralité du fichier. Aucun scénario supprimé ni affaibli.

`App.tsx` ne possède aucun fichier de test dédié. L'absence d'un test d'intégration renderer couvrant explicitement le passage “sélection d'un projet sur ProjectsPage → affichage de ses phases sur PhasesPage” constitue un risque de couverture, mais un risque limité : le contrat de props entre `App.tsx` et chaque page est réduit (2-3 props), et toute erreur de câblage (props manquantes ou mal nommées) serait immédiatement détectée par `npm run typecheck` puisque `ProjectsPageProps.onActiveProjectChange` et `PhasesPageProps.activeProject` sont des props obligatoires non optionnelles. Classé **MINEUR**, pas Important.

## Contrat API et séparation architecturale

`PhasesPage`, `PhaseForm`, `PhaseCard` n'importent ni Electron, ni Node.js, ni SQLite, ni aucun module de `src/main` (recherche `grep` négative). Les mutations passent exclusivement par `window.themeFactoryApi.phases`. Les types (`Phase`, `CreatePhaseInput`, `UpdatePhaseInput`, `PhaseStatus`, `PHASE_STATUSES`) sont importés depuis `shared/schemas/phase.ts`, jamais redéfinis. `getById` n'est pas appelé (non nécessaire, la liste fournit déjà les objets complets). Aucun accès direct à `ipcRenderer`. Recherche explicite de `any`, `unknown as` (hors mocks de test), `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `.skip`, `.only` : aucune occurrence dans les fichiers applicatifs de la Phase 3.7.

## Validation automatisée indépendante

```bash
npm run typecheck
```
→ Succès, aucune erreur (ré-exécuté indépendamment).

```bash
npm run test
```
→ `Test Files 19 passed (19)` / `Tests 343 passed (343)` — identique au rapport.

```bash
npm run build
```
→ Succès : main 27.49 kB, preload 2.03 kB, renderer `index-3J4d3fn-.js` 728.63 kB / `index-DzsytAJr.css` 6.89 kB — tailles identiques à celles annoncées dans le rapport. Aucune différence constatée entre cette exécution et celle du rapport.

## État Git

`git status --short`, `git diff --stat` et `git diff --check` ré-exécutés (voir section « Résumé du diff ») : conformes au rapport. `workflow/prompts/PHASE_3.7_PROMPT.md` et `workflow/reports/RAPPORT_PHASE_3.7.md` existent bien. **Un fichier `.txt` existe à la racine** (`RAPPORT_PHASE_3.7.txt`), copie du rapport — ce n'est pas un fichier généré accidentellement mais une convention documentée du dépôt (mémoire projet : toujours dupliquer chaque rapport de fin de tâche en `.txt` à la racine). Signalé ici car explicitement demandé par le prompt de review, sans le considérer comme une erreur d'implémentation — voir **OBSERVATION #1**.

## Constats classés

### IMPORTANT #1 — Réponse tardive de `listByProjectId` pouvant afficher les phases du mauvais projet

- **Fichier** : `src/renderer/src/pages/PhasesPage.tsx`, fonction `loadPhases` (l.40-55) et effet de changement de projet (l.60-69).
- **Problème** : aucune vérification que le projet actif au moment de la résolution de la promesse est toujours celui pour lequel l'appel a été lancé. Seul `isMountedRef.current` est vérifié (protège du démontage, pas du changement de contexte).
- **Scénario de reproduction** : projet A actif, `listByProjectId(A)` lent ; l'utilisateur sélectionne le projet B (rapide) ; la réponse de B s'affiche ; la réponse de A arrive ensuite et écrase silencieusement l'affichage avec les phases de A alors que B est actif dans l'en-tête et dans `ProjectsPage`.
- **Impact** : incohérence visuelle trompeuse (l'utilisateur peut agir — modifier, supprimer — sur des phases qu'il croit appartenir au projet affiché alors que ce sont celles d'un autre projet). Aucune corruption de données persistées (SQLite reste correct), mais un risque réel d'erreur utilisateur.
- **Correction minimale recommandée** : dans `loadPhases`, comparer `projectId` (paramètre) à la valeur courante de `activeProjectId` (lue via une ref, à l'image de `activeProjectRef` dans `ProjectsPage`) juste avant chaque `setPhases`/`setLoadState` ; ignorer silencieusement une résolution dont le `projectId` ne correspond plus au projet actif courant.
- **Test de non-régression à ajouter** : un scénario avec deux promesses contrôlées manuellement (comme le fait déjà le test de chargement), résolues dans l'ordre inversé (B avant A), vérifiant que les phases affichées restent celles de B.

### IMPORTANT #2 — Mutations en vol non protégées contre un changement de projet actif

- **Fichier** : `src/renderer/src/pages/PhasesPage.tsx`, `handleSubmitForm` (l.102-160) et effet de changement de projet (l.60-69).
- **Problèmes précis** :
  1. Une création en vol pour le projet A, si le projet actif passe à B avant résolution, insère la phase créée directement dans la liste affichée de B (`setPhases` sans condition sur le projet courant).
  2. Le formulaire ouvert pour B peut se fermer silencieusement (`setFormState({mode:'closed'})` sans condition) suite à la résolution tardive d'une mutation de A.
  3. Une erreur tardive de A (création, modification ou suppression) s'affiche dans le contexte de B (`setFormErrorMessage`/`setDeleteErrorMessage` sans condition).
  4. **Symptôme le plus facilement reproductible** : l'effet de réinitialisation au changement de projet (l.60-69) ne réinitialise pas `isSubmittingForm`. Si une création/modification est en vol pour A au moment du changement vers B, le bouton « Nouvelle phase » de B reste désactivé jusqu'à la résolution (ou l'échec) de la promesse de A — un blocage visible et facilement démontrable sans dépendre d'un timing de réseau précis (le simple fait de ne jamais résoudre la promesse mockée suffit à le démontrer).
- **Scénario de reproduction** : ouvrir le formulaire de création pour le projet A, soumettre avec une réponse API volontairement retardée, changer immédiatement de projet actif vers B — le bouton « Nouvelle phase » de B reste grisé tant que la promesse de A n'est pas résolue.
- **Impact** : blocage fonctionnel temporaire de l'interface sur le nouveau projet, et risque de contamination visuelle des données entre projets (symptôme 1).
- **Correction minimale recommandée** : ajouter `setIsSubmittingForm(false)` à la liste des réinitialisations de l'effet de changement de projet (l.61-65) ; et, dans `handleSubmitForm`/`handleDelete`, comparer le projet/l'identifiant capturé au projet actif courant (via une ref dédiée, même mécanisme que IMPORTANT #1) avant d'appliquer `setPhases`/`setFormState`/`setFormErrorMessage`/`setDeleteErrorMessage`, en plus du garde `isMountedRef` déjà présent.
- **Test de non-régression à ajouter** : un scénario avec une création à réponse contrôlée manuellement, suivi d'un `rerender` vers un autre projet avant résolution, vérifiant (a) que le bouton de création du nouveau projet redevient actif immédiatement après le changement, (b) qu'aucune phase de l'ancien projet n'apparaît dans la liste du nouveau après résolution tardive.

### MINEUR #1 — Message d'erreur SQLite brut affiché sur collision de position

- **Fichier** : `src/renderer/src/pages/PhasesPage.tsx` (`handleSubmitForm`, catch), en amont `src/main/database/repositories/phasesRepository.ts`.
- **Problème** : une collision de position (`UNIQUE(project_id, position)`) remonte le message d'erreur natif du driver SQLite tel quel dans le formulaire, peu compréhensible pour un utilisateur non technique.
- **Impact** : gêne d'usage, aucun risque de sécurité ni de donnée incorrecte.
- **Correction recommandée (non bloquante)** : détecter ce cas précis (ex. message contenant `UNIQUE constraint failed`) et afficher un message dédié du type « Cette position est déjà utilisée par une autre phase de ce projet. », lors d'une prochaine itération sur la gestion des positions.

### MINEUR #2 — Inexactitude dans la section « Tests » du rapport d'implémentation

- **Fichier** : `workflow/reports/RAPPORT_PHASE_3.7.md`, section « Tests » / « Résultat global ».
- **Problème** : le rapport affirme « 292 avant cette phase + 18 nouveaux pour PhasesPage + les 26 tests ProjectsPage désormais exécutés via le harnais ». Or le nombre de tests avant la Phase 3.7 était **325** (confirmé par `REVIEW_PHASE_3.6.md`), pas 292 (chiffre de la Phase 3.5) ; et `ProjectsPage.test.tsx` contient **15** tests, pas 26 (recompté par lecture directe des blocs `it(`). L'arithmétique correcte est 325 + 18 = 343, ce qui correspond bien au total final annoncé et vérifié.
- **Impact** : aucun impact fonctionnel ; erreur de documentation uniquement, le résultat final (19 fichiers / 343 tests) reste exact et vérifié indépendamment.
- **Correction recommandée (non bloquante)** : corriger la phrase explicative dans `RAPPORT_PHASE_3.7.md` lors d'une prochaine mise à jour du rapport.

### OBSERVATION #1 — Fichier `.txt` à la racine

`RAPPORT_PHASE_3.7.txt` existe à la racine du dépôt. Il s'agit d'une convention documentée du projet (dupliquer chaque rapport en `.txt`), pas d'un fichier généré par erreur. Signalé car explicitement demandé par le prompt de review ; aucune action recommandée.

### OBSERVATION #2 — Absence de test d'intégration `App.tsx`

Aucun test ne couvre le câblage réel entre `App.tsx`, `ProjectsPage` et `PhasesPage`. Risque limité par le typage strict des props obligatoires (`npm run typecheck` détecterait un câblage manquant ou mal nommé). Recommandation pour une phase future : un test de rendu de `App.tsx` couvrant « sélectionner un projet sur Projets → afficher ses phases sur Phases ».

### OBSERVATION #3 — Tri local par position vérifié correct

Le tri local après création/modification (`sortByPosition`, clé unique `position`) est vérifié équivalent à l'ordre garanti par le repository (`position ASC, created_at ASC, id ASC`), grâce à la contrainte `UNIQUE(project_id, position)` qui rend les clés secondaires inatteignables en pratique. Aucune correction nécessaire.

## Checklist manuelle restant à confirmer par l'utilisateur

Aucun des 13 points suivants n'a été exécuté de façon interactive par cette review (analyse strictement statique du code + tests automatisés) :

1. État sans projet actif.
2. Sélection d'un projet depuis la page Projets.
3. État vide de la page Phases.
4. Création de deux phases.
5. Ordre visuel des phases créées.
6. Modification d'une phase.
7. Annulation d'une modification (aucune donnée changée).
8. Annulation d'une suppression.
9. Suppression confirmée.
10. Persistance après redémarrage de l'application.
11. Changement de projet actif.
12. Absence de résidu visuel de l'ancien projet après changement.
13. Absence d'erreur dans les consoles main et renderer.

## Verdict

## Verdict C — CORRECTIONS REQUISES

Deux défauts **IMPORTANT** sont confirmés par lecture directe du code (pas seulement une hypothèse) : l'absence de protection contre une réponse `listByProjectId` obsolète (IMPORTANT #1) et l'absence de protection des mutations en vol contre un changement de projet actif, avec un symptôme facilement démontrable (bouton de création bloqué après changement de projet, IMPORTANT #2). Ces deux points doivent être corrigés — avec leurs tests de non-régression associés — avant de considérer la Phase 3.7 prête pour un commit.

Indépendamment de ces corrections applicatives, la checklist manuelle interactive du prompt (13 points ci-dessus) n'a pas encore été confirmée par l'utilisateur et resterait de toute façon nécessaire même après correction du code.

**Décision explicite** :
- Une correction applicative est **nécessaire** (IMPORTANT #1 et #2) avant tout commit.
- Une validation manuelle utilisateur est **nécessaire**, indépendamment des corrections ci-dessus.
- Le commit **ne doit pas** être créé immédiatement.

`npm run typecheck`, `npm run test` (343/343) et `npm run build` réussissent tous les trois de façon indépendante — la validation technique automatisée est donc autrement propre ; seuls les deux constats IMPORTANT ci-dessus, relatifs à des scénarios de concurrence non couverts par les tests existants, motivent ce verdict.
