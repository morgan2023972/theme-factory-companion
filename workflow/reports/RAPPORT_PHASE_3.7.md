# RAPPORT — Phase 3.7 : Interface de gestion des phases

## Résumé

**Objectif** : créer l'interface React permettant de gérer les phases du projet actif (liste ordonnée par position, création, modification, suppression avec confirmation, états chargement/vide/erreur), en s'appuyant exclusivement sur `window.themeFactoryApi.phases` (Phase 3.6).

**Résultat** : `PhasesPage` est opérationnelle, branchée sur la destination de navigation « Phases et tâches », et partage désormais le projet actif avec `ProjectsPage` via un state levé dans `App.tsx` (adaptation minimale explicitement permise par le prompt, section 7 — le mécanisme précédent était un state local à `ProjectsPage`, inaccessible aux autres pages).

**Statut final** : **terminé et validé automatiquement**. `npm run typecheck`, `npm run test` (348/348) et `npm run build` réussissent. `npm run dev` démarre sans erreur dans le processus main. La validation manuelle interactive (parcours utilisateur réel dans la fenêtre Electron) n'a **pas** pu être exécutée par Claude Code lui-même — voir la section « Validation manuelle » pour le détail honnête de ce qui est vérifié vs à confirmer.

## Inspection initiale

- **Projet actif** : avant cette phase, `activeProjectId` était un `useState` interne à `ProjectsPage.tsx`, jamais remonté ni partagé — aucune autre page n'y avait accès. `App.tsx` ne gérait que la navigation (`activeId`) et ne rendait `ProjectsPage` que pour la destination `projects`.
- **Placeholder remplacé** : la destination `phasesAndTasks` (« Phases et tâches ») rendait `PlaceholderPage`. Elle rend désormais `PhasesPage`, sans modifier son libellé ni sa description dans `navigation.ts`.
- **Conventions réutilisées depuis le CRUD des projets** :
  - Structure page (liste + formulaire togglable + toolbar + états chargement/erreur/vide) copiée de `ProjectsPage.tsx`.
  - `PhaseForm`/`PhaseCard` répliquent exactement la structure de `ProjectForm`/`ProjectCard` (mêmes conventions de validation locale, `toOptionalText`, formulaire unique création/édition avec `key` distincte, `isMountedRef`, confirmation `window.confirm` avant suppression, désactivation des actions concurrentes pendant une mutation).
  - Classes CSS existantes (`project-card`, `project-form`, `projects-page__*`) réutilisées via sélecteurs groupés plutôt que dupliquées (voir section Styles).

## Fichiers créés

- `src/renderer/src/pages/PhasesPage.tsx`
- `src/renderer/src/pages/PhasesPage.test.tsx`
- `src/renderer/src/components/phases/PhaseCard.tsx`
- `src/renderer/src/components/phases/PhaseForm.tsx`
- `src/renderer/src/components/phases/phaseStatusLabels.ts`
- `workflow/reports/RAPPORT_PHASE_3.7.md` (ce rapport)

## Fichiers modifiés

- `src/renderer/src/App.tsx` — state `activeProject: Project | null` levé ; branchement de `PhasesPage` sur la destination `phasesAndTasks` ; `ProjectsPage` reçoit désormais `activeProject`/`onActiveProjectChange` en props.
- `src/renderer/src/pages/ProjectsPage.tsx` — devient un composant contrôlé pour le projet actif (props au lieu d'un `useState` interne) ; la logique de réconciliation (reset si le projet actif disparaît de la liste), de synchronisation après modification, et de reset après suppression est conservée à l'identique mais pilotée via `onActiveProjectChange` et une ref (`activeProjectRef`) pour éviter de faire dépendre `loadProjects` de la valeur changeante.
- `src/renderer/src/pages/ProjectsPage.test.tsx` — ajout d'un harnais `ProjectsPageHarness` reproduisant localement le state désormais levé dans `App.tsx`, pour que les 15 tests existants conservent exactement le même comportement observable. Aucun scénario de test modifié.
- `src/renderer/src/styles.css` — sélecteurs CSS étendus (groupés avec les règles `.project-*`/`.projects-page__*` existantes) pour couvrir `.phase-card`, `.phase-form` et `.phases-page__*`, plus deux nouvelles règles propres aux phases (`.phases-page__active-project`, `.phases-page__no-active-project`).

## Interface réalisée

- **Aucun projet actif** : message « Sélectionnez d'abord un projet actif pour gérer ses phases. », aucun appel à `phases.listByProjectId`, bouton « Nouvelle phase » absent du DOM (pas seulement désactivé).
- **Projet actif disponible** : nom du projet actif affiché (« Projet actif : {nom} ») ; chargement via `listByProjectId(projectId)` ; liste affichée dans l'ordre exact retourné par l'API, sans retri côté renderer.
- **Liste** : chaque carte affiche nom, description (si présente), statut (libellé lisible via `PHASE_STATUS_LABELS`), un rang d'affichage convivial (« Phase 1 », « Phase 2 »… déduit de l'ordre déjà renvoyé, pas de la valeur brute `position`), et les actions Modifier/Supprimer.
- **Formulaire** (`PhaseForm`, création et modification) : champs nom (obligatoire), description (optionnelle, nullable), statut (select sur `PHASE_STATUSES`), position (nombre optionnel — laissé vide, il est omis de l'appel API : le repository calcule alors la position suivante à la création, ou conserve la position actuelle à la modification ; jamais de valeur artificielle envoyée).
- **Création** : rattache automatiquement `projectId` du projet actif (jamais saisi par l'utilisateur) ; insertion locale triée par `position` après succès (pas de rechargement complet, cohérent avec la convention déjà utilisée par `ProjectsPage`) ; formulaire fermé après succès, conservé ouvert avec message d'erreur en cas d'échec.
- **Modification** : formulaire préempli avec les valeurs réelles de la phase ; `projectId` jamais transmis (le schéma `updatePhaseSchema` l'interdit) ; gère le retour `null` (phase supprimée entre-temps) en conservant le formulaire ouvert avec message explicite ; permet l'annulation sans appel API.
- **Suppression** : confirmation `window.confirm` nommant la phase ; annulation sans effet ; gère `true` (retrait de la liste), `false` (message d'erreur explicite) et une exception (message d'erreur, phase conservée).
- **États** : chargement (`role="status"`, jamais d'état vide affiché prématurément puisque `phases` est réinitialisé à `[]` avant tout chargement et l'état vide n'est rendu que lorsque `loadState.status === 'loaded'`), vide (avec incitation à créer la première phase), erreur (message + bouton Réessayer), mutation en cours (soumission désactivée pendant l'appel, boutons Modifier/Supprimer désactivés sur les autres lignes pendant qu'une action est en cours).
- **Position** : aucune logique de collision, de réordonnancement ou de glisser-déposer implémentée ; le tri local après création/modification utilise uniquement le champ `position` déjà autoritaire renvoyé par le repository, jamais une valeur recalculée côté renderer.
- **Concurrence** : chaque chargement et chaque mutation (création/modification/suppression) capture l'identifiant du projet actif au moment de son lancement et le compare, après l'attente asynchrone, à l'identifiant actif courant (`activeProjectIdRef`) avant toute mise à jour d'état ; une réponse ou une erreur devenue obsolète suite à un changement de projet actif est ignorée silencieusement. Le changement de projet réinitialise aussi explicitement `isSubmittingForm`. Détail complet dans `workflow/reports/RAPPORT_CORRECTIONS_REVIEW_PHASE_3.7.md`.

## API utilisée

Méthodes réellement appelées sur `window.themeFactoryApi.phases` :

- `listByProjectId(projectId)` — au montage et à chaque changement de projet actif, ainsi que sur « Réessayer ».
- `create(input)` — à la soumission du formulaire en mode création (`{ projectId, name, description, status, position? }`).
- `update(id, input)` — à la soumission du formulaire en mode édition (`{ name, description, status, position? }`, jamais `projectId`).
- `remove(id)` — après confirmation de suppression.

`getById` n'est pas utilisé par cette page (non nécessaire : la liste fournit déjà les objets `Phase` complets utilisés pour préremplir le formulaire d'édition).

## Tests

### Fichiers créés

- `src/renderer/src/pages/PhasesPage.test.tsx` — **23 tests** (18 initiaux + 5 ajoutés lors des corrections post-review) : aucun projet actif (message, pas d'appel API, pas de bouton création) ; chargement (état de chargement, ordre de la liste, état vide, erreur + réessai) ; création (ajout à la liste, position omise si vide, double soumission empêchée, erreur conservant le formulaire) ; modification (préremplissage, appel avec le bon id, pas de `projectId` transmis, retour `null`, annulation) ; suppression (confirmation refusée, succès, retour `false`, exception) ; changement de projet actif (rechargement, aucune fuite de l'ancien projet, retour à l'état « aucun projet actif ») ; accessibilité (boutons Modifier/Supprimer identifiables par nom de phase avec plusieurs lignes) ; **concurrence** (réponse de chargement obsolète ignorée avec résolution inversée B avant A, erreur de chargement obsolète ignorée, création en vol ne bloquant pas le nouveau projet et n'y insérant jamais la phase de l'ancien, erreur de mutation obsolète non affichée dans le nouveau contexte, suppression en vol pour A ne réactivant pas prématurément une suppression en cours pour B). Détail dans `workflow/reports/RAPPORT_CORRECTIONS_REVIEW_PHASE_3.7.md`.

### Fichiers modifiés

- `src/renderer/src/pages/ProjectsPage.test.tsx` — ajout du harnais `ProjectsPageHarness` ; les 15 tests existants sont inchangés dans leur logique, seul le point de montage change (`<ProjectsPageHarness />` au lieu de `<ProjectsPage />`).

### Résultat global

19 fichiers de tests exécutés, **348 tests réussis / 348**. Base correcte avant la Phase 3.7 : **18 fichiers, 325 tests** (confirmé par `workflow/reports/REVIEW_PHASE_3.6.md`). La Phase 3.7 ajoute 1 fichier (`PhasesPage.test.tsx`) et, après les corrections post-review, 23 tests dans ce fichier (18 + 5) : 325 + 23 = 348. `ProjectsPage.test.tsx` contient 15 tests (et non 26, chiffre erroné dans une version antérieure de ce rapport, corrigé lors de la review).

## Validation automatisée

```bash
npm run typecheck
```
→ **Succès**, aucune erreur (après correction d'un rétrécissement de type perdu dans une fermeture async — voir Écarts).

```bash
npm run test
```
→ **Succès** : `Test Files 19 passed (19)` / `Tests 348 passed (348)` (après les corrections post-review documentées dans `RAPPORT_CORRECTIONS_REVIEW_PHASE_3.7.md`).

```bash
npm run build
```
→ **Succès** : main (27.49 kB), preload (2.03 kB), renderer (`index-B7L9SDfN.js`, 729.18 kB, `index-DzsytAJr.css`, 6.89 kB).

## Validation manuelle

**Ce que Claude Code a pu vérifier techniquement** :
- `npm run dev` démarre : les processus Electron réels (main + GPU + réseau + renderer) sont lancés après le rebuild natif, confirmés par la liste des processus système.
- Aucune exception n'apparaît dans la sortie du processus main après `starting electron app...` (démarrage propre, ouverture DB, migrations, health check, enregistrement des handlers IPC projets et phases — hérités des phases précédentes et non modifiés ici).
- L'intégralité des scénarios fonctionnels décrits ci-dessus (aucun projet actif, chargement, liste ordonnée, création, modification, suppression, retours `null`/`false`, double soumission, changement de projet actif, accessibilité, concurrence lors d'un changement de projet) est vérifiée par les 23 tests automatisés de `PhasesPage.test.tsx`, exécutés contre un mock strictement typé de `window.themeFactoryApi.phases` (aucun `any`).

**Ce qui nécessite une confirmation visuelle et interactive de l'utilisateur** — Claude Code n'a pas de contrôle interactif sur la fenêtre Electron réelle (clics, saisie, observation visuelle) dans cet environnement ; les 18 points de la checklist du prompt (section 16) n'ont donc **pas** été exécutés manuellement par Claude Code et restent à confirmer par l'utilisateur avec un projet de test réel :
1. Ouvrir l'application et naviguer vers « Phases et tâches » sans projet actif → vérifier le message.
2. Sélectionner/créer un projet depuis la page Projets, revenir sur Phases → vérifier l'état vide.
3. Créer une première puis une seconde phase → vérifier l'affichage et l'ordre.
4. Modifier un champ, annuler une modification → vérifier l'absence de changement.
5. Supprimer une phase (annuler puis confirmer réellement).
6. Redémarrer l'application → vérifier la persistance SQLite réelle de la phase restante.
7. Changer de projet actif → vérifier le rechargement et l'absence de résidu visuel de l'ancien projet.
8. Vérifier l'absence d'erreur dans les consoles main et renderer pendant ces interactions.

**Parcours réellement confirmés par Claude Code** : uniquement le démarrage propre de l'application (aucune erreur au lancement) et l'ensemble des comportements couverts par les tests automatisés listés ci-dessus. Aucune interaction manuelle dans la fenêtre Electron n'a été effectuée ni ne peut être déclarée validée sur cette seule base.

## Écarts

- **Lever `activeProject` dans `App.tsx`** : changement du mécanisme de projet actif, explicitement anticipé et autorisé par la section 7 du prompt (« si le mécanisme actuel ne rend pas facilement le projet actif accessible entre les pages, réaliser uniquement l'adaptation minimale nécessaire »). Limité à : un nouveau `useState<Project | null>` dans `App.tsx`, `ProjectsPage` devenu composant contrôlé pour cette seule valeur (le reste de son état — liste, formulaire, suppression — reste local et inchangé), et un harnais de test reproduisant ce state pour ne pas perdre de couverture. Aucune nouvelle bibliothèque de gestion d'état introduite.
- **Correction de typage non fonctionnelle** : dans `PhasesPage.tsx`, une fonction déclarée (`function handleSubmitForm`) définie après un contrôle `if (!activeProject) return`, appelée dans une fermeture async, ne bénéficiait pas du rétrécissement de type TypeScript (limite connue du compilateur pour les déclarations de fonction, par opposition aux expressions de fonction/fléchées). Correction : liaison d'une constante `const project = activeProject` juste après le contrôle, utilisée dans les fermetures. Aucun `as`, aucun `!` non-null, aucun `any`.
- Aucun autre écart : aucune tâche, checklist, glisser-déposer, tableau de bord, journal d'activité, ni fonctionnalité de Phase 3.8/4 implémentée ; aucune nouvelle dépendance ; aucun accès direct à Electron/Node/SQLite depuis le renderer ; aucune refonte visuelle (styles ajoutés par extension des sélecteurs existants).

## Risques et points pour la Phase 3.8

- **Persistance** : non vérifiée manuellement dans cette session (voir Validation manuelle) — à confirmer par l'utilisateur en redémarrant l'application après création/suppression.
- **Cascades** : la suppression d'un projet actif entraîne déjà (Phase 3.5, `ON DELETE CASCADE`) la suppression de ses phases côté base ; côté renderer, si l'utilisateur supprime le projet actif depuis `ProjectsPage` pendant que `PhasesPage` affiche ses phases, `activeProject` repasse à `null` (via `onActiveProjectChange(null)` dans `handleDelete`), ce qui bascule immédiatement `PhasesPage` sur l'état « aucun projet actif » — comportement couvert par le test « revient à l'état aucun projet actif quand le projet actif est désélectionné », mais non revérifié manuellement avec le vrai flux de suppression de projet.
- **Navigation** : changer d'onglet puis revenir sur « Phases et tâches » conserve l'état de `PhasesPage` uniquement si le composant reste monté (actuellement, `App.tsx` démonte/remonte la page à chaque changement de destination puisque `activeDestination.id === ...` conditionne le rendu) — chaque retour sur la page recharge donc les phases depuis l'API, ce qui est correct mais génère un appel réseau à chaque va-et-vient ; à surveiller si la Phase 3.8 introduit une navigation plus fréquente entre modules.
- **Positions** : aucune gestion de collision ni de réordonnancement transactionnel n'est implémentée ici (hors périmètre, prévu ultérieurement) ; une collision de position lors d'une modification manuelle du champ Position remonte l'erreur SQLite brute du repository (Phase 3.5) telle quelle dans le message d'erreur du formulaire — acceptable pour cette phase mais probablement à améliorer (message plus explicite) lors de l'implémentation du réordonnancement complet.
- **Changement de projet actif pendant une mutation en cours** : ce risque, initialement documenté ici comme un cas limite non couvert, a été confirmé comme un défaut réel par la review indépendante (`workflow/reports/REVIEW_PHASE_3.7.md`, constats IMPORTANT #1 et #2) puis corrigé : voir `workflow/reports/RAPPORT_CORRECTIONS_REVIEW_PHASE_3.7.md` pour le détail de la protection ajoutée (`activeProjectIdRef`, réinitialisation de `isSubmittingForm`) et des 5 tests de non-régression associés.

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
?? workflow/prompts/PHASE_3.7_PROMPT.md
```

```bash
git diff --stat
```
```
 src/renderer/src/App.tsx                     | 11 +++-
 src/renderer/src/pages/ProjectsPage.test.tsx  | 42 +++++++++------
 src/renderer/src/pages/ProjectsPage.tsx       | 35 ++++++++----
 src/renderer/src/styles.css                   | 80 ++++++++++++++++++++--------
 4 files changed, 120 insertions(+), 48 deletions(-)
```
