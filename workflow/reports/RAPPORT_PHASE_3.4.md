# Rapport — Phase 3.4 : Interface CRUD des projets

## Résumé

- **Objectif** : construire dans le renderer React une interface complète de gestion des projets (liste, création, modification, suppression avec confirmation, sélection d'un projet actif local, gestion des états de chargement/vide/erreur), en n'utilisant que `window.themeFactoryApi.projects`.
- **Résultat obtenu** : l'ensemble des fonctionnalités demandées a été implémenté et testé avec l'outillage disponible (complété par l'ajout minimal et justifié d'un environnement de test React — voir « Limites et écarts »). `npm run typecheck`, `npm run test` et `npm run build` passent tous les trois.
- **Statut final** : **terminé**, prêt pour validation manuelle par l'utilisateur.

> **Note** : une review indépendante a identifié 1 constat bloquant et 3 constats importants après la livraison initiale de cette phase (voir `workflow/reports/REVIEW_PHASE_3.4.md`). Ils ont été corrigés ; le détail des corrections figure dans `workflow/reports/RAPPORT_CORRECTIONS_REVIEW_PHASE_3.4.md`. Le présent rapport a été mis à jour pour refléter l'état corrigé du code et des tests.

## Fichiers créés

- `src/renderer/src/pages/ProjectsPage.tsx` — page conteneur : chargement de la liste, états (chargement/vide/erreur), orchestration création/modification/suppression, sélection locale du projet actif. Corrigé après review (voir « Corrections post-review »).
- `src/renderer/src/pages/ProjectsPage.test.tsx` — 15 tests de comportement (voir section Tests).
- `src/renderer/src/components/projects/ProjectForm.tsx` — formulaire partagé création/modification (`ProjectFormValues` exporté). Corrigé après review (accessibilité du champ Nom, titre de création).
- `src/renderer/src/components/projects/ProjectCard.tsx` — carte d'affichage d'un projet avec ses actions (Sélectionner/Modifier/Supprimer). Corrigé après review (props `disableModify`/`disableDelete`).
- `src/renderer/src/components/projects/projectStatusLabels.ts` — libellés français des statuts (`PROJECT_STATUS_LABELS`), réutilisés par le formulaire et la carte pour éviter toute duplication.
- `src/renderer/src/utils/getErrorMessage.ts` — normalisation locale des erreurs inconnues en message affichable (jamais `[object Object]`).
- `vitest.setup.ts` — enregistre les matchers `@testing-library/jest-dom` pour l'environnement de test (voir justification en section Limites).
- `workflow/reports/RAPPORT_PHASE_3.4.md` — ce rapport.

## Fichiers modifiés

- `src/renderer/src/App.tsx` — la destination de navigation `projects` affiche désormais `<ProjectsPage />` directement (au lieu du `PlaceholderPage` générique, devenu obsolète pour ce module désormais implémenté). Les autres destinations ne sont pas affectées : elles continuent d'utiliser `PlaceholderPage` comme avant.
- `src/renderer/src/styles.css` — ajout des styles strictement nécessaires : barre d'action, grille/liste de projets, cartes (dont l'état actif), formulaire, messages de chargement/erreur/état vide, boutons désactivés. Aucune règle existante n'a été supprimée ni réécrite ; aucun framework CSS ajouté.
- `vitest.config.ts` — ajout du plugin `@vitejs/plugin-react` (nécessaire pour transformer le JSX des fichiers `.tsx` dans les tests, absent du dépôt jusqu'ici puisqu'aucun composant React n'était encore testé) et de `setupFiles: ['./vitest.setup.ts']` ; `include` étendu à `src/**/*.test.tsx`.
- `tsconfig.node.json` / `tsconfig.web.json` — ajout de `vitest.setup.ts` à la liste `include` (nécessaire pour que l'augmentation de types `@testing-library/jest-dom` soit prise en compte par `tsc`).
- `package.json` / `package-lock.json` — ajout de trois dépendances de développement strictement nécessaires aux tests React demandés par cette phase (détail en section Limites) : `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`.

Aucune migration, aucun schéma SQL, aucun handler IPC, aucun canal IPC n'a été modifié ou ajouté.

## Fonctionnalités implémentées

- **Chargement de la liste** : `window.themeFactoryApi.projects.list()` appelé une seule fois au montage (`useEffect` à dépendances stables). État `loading` affiché explicitement (`role="status"`), puis remplacé par la liste ou l'état vide.
- **État vide** : message dédié (« Aucun projet enregistré pour le moment. ») lorsque la liste chargée est vide ; le bouton « Nouveau projet » reste disponible dans tous les cas.
- **Création** : bouton « Nouveau projet » ouvre `ProjectForm` en mode `create` ; validation ergonomique minimale du nom (non vide) côté renderer, la validation Zod IPC restant la source de vérité ; le projet créé est ajouté en tête de liste sans recharger l'ensemble ; le formulaire se ferme après succès ; en cas d'erreur, le formulaire reste ouvert avec les valeurs saisies conservées et un message d'erreur affiché (couvert par un test dédié, voir section Tests).
- **Modification** : bouton « Modifier » sur chaque carte ouvre `ProjectForm` en mode `edit`, pré-rempli avec les valeurs actuelles ; à la soumission, `window.themeFactoryApi.projects.update(id, input)` est appelé avec la signature exacte du contrat ; le projet affiché est remplacé par la version retournée par l'API ; si le projet modifié était le projet actif, sa sélection est conservée (l'identifiant ne change pas). `<ProjectForm>` est rendu avec une `key` dépendant du mode et de l'identifiant du projet ciblé (`edit-${id}` ou `create`), garantissant un remontage complet — donc des champs correctement réinitialisés — à chaque changement de cible. Le bouton « Modifier » de toutes les cartes est en outre désactivé tant qu'un formulaire est déjà ouvert, rendant impossible tout changement de cible sans fermeture préalable. Si `update(...)` retourne `null` (projet supprimé entre-temps), un message d'erreur explicite est affiché, le formulaire reste ouvert avec les valeurs saisies, et la liste n'est pas modifiée comme si l'opération avait réussi.
- **Suppression avec confirmation** : `window.confirm(...)` affiche explicitement le nom du projet ciblé ; une réponse négative n'appelle jamais `remove` ; une confirmation positive désactive le bouton « Supprimer » de **toutes** les cartes (pas seulement celle concernée) pendant l'appel, retire le projet de la liste après succès, et réinitialise la sélection active si ce projet était actif.
- **Projet actif** : géré uniquement en état local (`useState<string | null>`) dans `ProjectsPage`, jamais persisté ; un seul projet actif à la fois (identifié par `aria-current="true"` sur la carte et `aria-pressed` sur le bouton « Sélectionner »/« Actif ») ; réinitialisé automatiquement si le projet actif est supprimé, ou si un rechargement de liste constate que l'identifiant actif n'existe plus.
- **Gestion des erreurs** : `getErrorMessage(error)` normalise toute erreur (Error, string, ou valeur inconnue) en message lisible, jamais `[object Object]` ; chaque appel asynchrone est encadré par `try/catch/finally`, les états `loading`/`isSubmittingForm`/`deletingProjectId` sont systématiquement réinitialisés dans le `finally` (sous garde de montage) ; aucune erreur n'est masquée par un `console.error` silencieux.
- **Opérations en cours** : les états `loading` (chargement initial), `isSubmittingForm` (création/modification), et `deletingProjectId` sont distincts et non ambigus. Le bouton « Nouveau projet » est désactivé pendant une soumission de formulaire ou lorsqu'un formulaire est déjà ouvert. Le bouton « Modifier » de toutes les cartes est désactivé tant qu'un formulaire est ouvert ; le bouton « Supprimer » de toutes les cartes est désactivé tant qu'une suppression est en cours (n'importe laquelle) ou qu'un formulaire est ouvert — plus aucun bouton visuellement actif ne peut produire un clic silencieusement ignoré.

## Architecture

Confirmé explicitement :

- **SQLite reste dans le main process** : aucun fichier du renderer n'importe `better-sqlite3`, `node:*` ou tout module du dossier `src/main`.
- **Le renderer utilise uniquement `window.themeFactoryApi.projects`** : vérifié par recherche (`grep`) — aucune autre voie d'accès à l'API n'a été utilisée.
- **Aucun accès direct à Electron, Node ou SQLite n'a été ajouté** : recherche explicite de `from 'electron'`, `require('electron')`, `ipcRenderer`, `better-sqlite3`, `from 'node:` dans les nouveaux fichiers renderer — aucune occurrence.
- **Aucun nouveau canal IPC non autorisé n'a été créé** : recherche des chaînes `'projects:` dans `src/renderer` — aucune occurrence (les canaux restent exclusivement définis dans `src/shared/contracts/ipcChannels.ts`, déjà en place depuis la phase 3.3).

## Tests

### Fichiers de tests ajoutés

- `src/renderer/src/pages/ProjectsPage.test.tsx` — 15 tests, environnement `jsdom` (activé via le commentaire `// @vitest-environment jsdom`), `@testing-library/react` + `@testing-library/user-event`. Seul `window.themeFactoryApi.projects` est mocké (via `Object.defineProperty` pour contourner la propriété `readonly` du typage global) ; Electron n'est ni importé ni démarré ; aucune base SQLite réelle n'est sollicitée.

### Scénarios couverts (les 12 demandés, tous testés explicitement)

1. affichage de l'état de chargement — ✅ (`ProjectsPage — chargement > affiche un état de chargement puis la liste des projets`)
2. affichage de l'état vide — ✅ (`affiche un état vide quand aucun projet n'existe`)
3. affichage de projets chargés — ✅ (même test que 1, vérifie l'affichage après résolution)
4. création d'un projet — ✅ (`ouvre le formulaire, crée un projet et l'ajoute à la liste`)
5. ouverture et annulation du formulaire — ✅ (`permet d'annuler le formulaire de création sans appeler create`)
6. modification d'un projet — ✅ (`pré-remplit le formulaire et met à jour le projet affiché`)
7. confirmation de suppression — ✅ (`demande une confirmation et annule la suppression si elle est refusée`, vérifie l'appel à `window.confirm`)
8. suppression annulée — ✅ (même test que 7 : `remove` non appelé, projet toujours affiché)
9. suppression confirmée — ✅ (`supprime le projet après confirmation`)
10. gestion d'une erreur d'appel API — ✅ **couverte pour les trois opérations** : erreur de chargement avec réessai, **erreur de création testée explicitement** (`affiche une erreur si la création échoue, conserve les valeurs saisies et réactive la soumission` — vérifie que `create` n'est appelé qu'une fois, qu'un message lisible s'affiche, que le formulaire reste ouvert, que la valeur saisie est conservée, que le bouton redevient actif, et qu'aucun projet n'est ajouté), et erreur de suppression explicite (`affiche une erreur si la suppression échoue`).
11. sélection d'un projet actif — ✅ (`sélectionne un seul projet actif à la fois`)
12. réinitialisation de la sélection après suppression du projet actif — ✅ (`réinitialise la sélection active si le projet actif est supprimé, sans laisser un autre projet actif par erreur` — renforcé avec deux projets pour prouver qu'aucun projet restant n'est marqué actif, pas seulement que la liste est vide)

### Tests supplémentaires issus de la review (régressions ciblées)

- `ProjectsPage — modification > affiche une erreur et garde le formulaire ouvert si le projet n'existe plus (update renvoie null)`.
- `ProjectsPage — modification > ne soumet jamais les valeurs d'un projet A avec l'identifiant d'un projet B après un changement de cible`.
- `ProjectsPage — suppression > désactive le bouton Supprimer des autres cartes pendant qu'une suppression est en cours (aucun clic mort)`.

### Nombre de fichiers de tests et résultats

- 1 fichier de test pour la page Projects (`ProjectsPage.test.tsx`), **15 tests, 15 réussis, 0 échoué**.
- Suite complète du dépôt après corrections : **14 fichiers de test, 207 tests, 207 réussis, 0 échoué**.

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

 Test Files  14 passed (14)
      Tests  207 passed (207)
```

### `npm run build`
```
> theme-factory-companion@1.0.0 build
> electron-vite build

✓ 14 modules transformed. (main)
out/main/index.js  21.02 kB
✓ 3 modules transformed. (preload)
out/preload/index.js  1.37 kB
✓ 119 modules transformed. (renderer)
../../out/renderer/index.html                 0.41 kB
../../out/renderer/assets/index-Db_lNiml.css  6.06 kB
../../out/renderer/assets/index-CzbluyZ-.js   700.27 kB
```
Build réussi sans erreur.

## Corrections post-review

Une review indépendante (`workflow/reports/REVIEW_PHASE_3.4.md`) a identifié 4 constats bloquant/importants après la livraison initiale de cette phase. Ils ont tous été corrigés ; détail complet dans `workflow/reports/RAPPORT_CORRECTIONS_REVIEW_PHASE_3.4.md`. Résumé :

1. **Formulaire non remonté lors d'un changement de cible** (bloquant) : `<ProjectForm>` reçoit désormais une `key` dépendant du mode/de l'identifiant ciblé, forçant un remontage complet à chaque changement de cible ; le bouton « Modifier » de toutes les cartes est en outre désactivé tant qu'un formulaire est ouvert.
2. **`update(...) === null` fermait silencieusement le formulaire** (important) : un message d'erreur explicite est désormais affiché et le formulaire reste ouvert avec les valeurs saisies si le projet édité n'existe plus.
3. **Clics morts sur « Supprimer » pendant une suppression en cours** (important) : le bouton « Supprimer » de toutes les cartes est désormais désactivé tant qu'une suppression est en cours, quelle que soit la carte concernée.
4. **Aucun test ne couvrait l'échec de création** (important) : un test dédié a été ajouté (voir section Tests) ; l'affirmation erronée « implicitement couverte » a été retirée de ce rapport.

Trois corrections mineures ont également été appliquées : `aria-invalid`/`aria-describedby` sur le champ Nom en cas d'erreur, renommage du titre du formulaire de création (« Créer un projet »), et renforcement du test de réinitialisation de sélection active (deux projets au lieu d'un seul).

Les trois scripts utilisés sont exactement ceux définis dans `package.json` (`typecheck`, `test`, `build`) ; aucun script alternatif n'a été nécessaire.

## Validation manuelle

Cette checklist doit être exécutée manuellement par l'utilisateur ; **elle n'est pas déclarée comme validée par cette implémentation**.

### État vide
- [ ] Ouvrir l'application avec aucun projet enregistré.
- [ ] Vérifier le message d'état vide (« Aucun projet enregistré pour le moment. »).
- [ ] Vérifier que le bouton « Nouveau projet » est disponible.

### Création
- [ ] Créer un projet en renseignant au minimum le nom.
- [ ] Vérifier son apparition immédiate dans la liste.
- [ ] Redémarrer l'application.
- [ ] Vérifier que le projet créé est toujours présent (persistance SQLite).

### Annulation
- [ ] Ouvrir le formulaire de création.
- [ ] Saisir des valeurs dans plusieurs champs.
- [ ] Cliquer sur « Annuler ».
- [ ] Vérifier qu'aucun projet n'a été créé.

### Modification
- [ ] Modifier un projet existant (nom et un autre champ).
- [ ] Vérifier que les valeurs affichées après enregistrement sont correctes.
- [ ] Redémarrer l'application.
- [ ] Vérifier la persistance des valeurs modifiées.

### Sélection active
- [ ] Sélectionner un projet (« Sélectionner »).
- [ ] Vérifier son état visuel actif (bordure/mise en avant, bouton devenu « Actif »).
- [ ] Sélectionner un autre projet.
- [ ] Vérifier qu'un seul projet reste actif à la fois.

### Suppression annulée
- [ ] Cliquer sur « Supprimer » pour un projet.
- [ ] Annuler la boîte de confirmation.
- [ ] Vérifier que le projet existe toujours dans la liste.

### Suppression confirmée
- [ ] Cliquer sur « Supprimer », confirmer.
- [ ] Vérifier la disparition immédiate du projet.
- [ ] Redémarrer l'application.
- [ ] Vérifier qu'il ne réapparaît pas.

### Projet actif supprimé
- [ ] Sélectionner un projet.
- [ ] Supprimer ce même projet (avec confirmation).
- [ ] Vérifier que la sélection active est réinitialisée (plus aucun bouton « Actif » affiché).

### Erreurs
- [ ] Provoquer une erreur d'appel (ex. couper temporairement l'accès à la base, ou simuler via les DevTools) et vérifier qu'un message lisible s'affiche (pas de `[object Object]`, pas de blocage silencieux).
- [ ] Vérifier que l'interface ne reste pas bloquée en état « Chargement » indéfiniment.

### Navigation
- [ ] Quitter la page Projets (aller sur une autre destination du menu).
- [ ] Revenir sur la page Projets.
- [ ] Vérifier que la liste est rechargée depuis la base (le composant étant démonté puis remonté, un nouvel appel `list()` est effectué à chaque retour — comportement volontaire, voir « Limites »).

## Limites et écarts

- **Dépendances de test ajoutées** : `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom` et `jsdom` ont été ajoutées en devDependencies. Aucune de ces bibliothèques n'existait dans le dépôt avant cette phase (aucun composant React n'y était encore testé). Le prompt demandait explicitement de couvrir des scénarios de rendu et d'interaction (chargement, état vide, création, annulation, modification, confirmation/annulation/suppression, erreurs, sélection) qui ne sont pas raisonnablement testables sans moteur DOM ni utilitaires de rendu React ; il autorisait aussi explicitement à ajouter les tests réalisables et à documenter les limites plutôt que d'alourdir massivement l'outillage. Ce choix a été jugé comme l'ajout minimal strictement nécessaire (une seule paire « moteur DOM + utilitaires de test React », standard dans l'écosystème, sans framework de test alternatif ni bibliothèque de mock supplémentaire) plutôt qu'une extension massive de l'outillage.
- **`@vitejs/plugin-react` requis dans `vitest.config.ts`** : ce plugin était déjà une dépendance du dépôt (utilisé par `electron.vite.config.ts` pour le build du renderer) mais n'était pas configuré pour les tests Vitest, qui utilisent une configuration Vite distincte. Sans lui, la transformation JSX échouait (`ReferenceError: React is not defined`) faute de configuration explicite du runtime JSX automatique pour l'exécution des tests. Aucune nouvelle dépendance n'a été nécessaire pour cette correction, seulement une configuration.
- **Rechargement de la liste à chaque navigation** : `ProjectsPage` recharge systématiquement la liste des projets à chaque montage (donc à chaque retour sur la page, puisque `App.tsx` démonte le composant en changeant de destination). C'est un choix volontaire et simple, cohérent avec l'absence de state manager externe demandée par le périmètre de cette phase ; aucune mise en cache n'a été introduite.
- **Sélection active non persistée** : conformément au périmètre strict de cette phase, la sélection du projet actif reste un état local du composant `ProjectsPage`, perdue à chaque démontage (navigation ou redémarrage). Aucune table, aucune préférence persistante, aucun nouveau contrat IPC n'a été créé pour cette sélection.
- **Mise à jour « champ par champ » vs remplacement complet** : le formulaire de modification envoie systématiquement l'ensemble des champs éditables (et non uniquement les champs modifiés) à `update(id, input)`. Les champs textuels laissés vides sont envoyés comme `null` (jamais comme chaîne vide), ce qui respecte la contrainte « ne pas écraser involontairement avec une chaîne vide » tout en restant une stratégie de remplacement complet plutôt qu'un diff champ par champ — plus simple et suffisant pour cette phase, sans dépendre d'un suivi de « champs modifiés ».
- **Aucun test n'a été supprimé ou neutralisé** ; les 192 tests existants avant cette phase continuent de passer sans modification.
- **Aucun écart non documenté au prompt** n'a été identifié : le périmètre strict (pas de CRUD phases/tâches, pas de persistance du projet actif, pas de state manager, pas de React Router, pas de bibliothèque de formulaire/UI/notifications, pas de nouvelle migration, pas de nouveau handler IPC) a été respecté intégralement.

## Git

```powershell
git status --short
```
```
 M package-lock.json
 M package.json
 M src/renderer/src/App.tsx
 M src/renderer/src/styles.css
 M tsconfig.node.json
 M tsconfig.web.json
 M vitest.config.ts
?? src/renderer/src/components/projects/
?? src/renderer/src/pages/ProjectsPage.test.tsx
?? src/renderer/src/pages/ProjectsPage.tsx
?? src/renderer/src/utils/
?? vitest.setup.ts
?? workflow/prompts/PHASE_3.4_PROMPT.md
?? workflow/reports/RAPPORT_CORRECTIONS_REVIEW_PHASE_3.4.md
?? workflow/reports/REVIEW_PHASE_3.4.md
```

(`src/renderer/src/pages/ProjectsPage.tsx`, `ProjectsPage.test.tsx`, `ProjectCard.tsx` et `ProjectForm.tsx` restent non suivis puisqu'ils ont été créés dans cette même phase, non encore commitée ; les corrections post-review y sont donc incluses sans ligne de diff Git séparée.)

```powershell
git diff --stat
```
```
 package-lock.json           | 784 +++++++++++++++++++++++++++++++++++++++++++-
 package.json                |   4 +
 src/renderer/src/App.tsx    |  11 +-
 src/renderer/src/styles.css | 174 ++++++++++
 tsconfig.node.json          |   3 +-
 tsconfig.web.json           |   2 +-
 vitest.config.ts            |   5 +-
 7 files changed, 976 insertions(+), 7 deletions(-)
```

Aucun commit n'a été effectué.

Message de commit proposé :

```text
feat: add projects CRUD interface
```

Le commit sera réalisé uniquement après validation manuelle par l'utilisateur.
