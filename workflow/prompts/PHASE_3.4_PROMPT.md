# PHASE 3.4 — Interface CRUD des projets

Tu travailles sur le dépôt **Theme Factory Companion**.

La phase 3.3 est terminée, validée et commitée. L’application dispose maintenant :

* des schémas Zod partagés pour les projets ;
* du repository SQLite `projectsRepository` ;
* des handlers IPC pour les projets ;
* des canaux IPC centralisés ;
* du contrat partagé `themeFactoryApi` ;
* de l’API preload `window.themeFactoryApi.projects` ;
* des tests unitaires et d’intégration associés.

Tu dois maintenant réaliser uniquement la **phase 3.4 — Interface CRUD des projets**.

---

## 1. Objectif

Créer dans le renderer React une interface complète permettant de :

* afficher la liste des projets enregistrés ;
* créer un projet ;
* modifier un projet ;
* supprimer un projet avec confirmation ;
* sélectionner visuellement un projet actif ;
* gérer les états de chargement ;
* gérer l’état vide ;
* gérer les erreurs ;
* empêcher les doubles actions pendant une opération en cours.

L’interface doit utiliser exclusivement :

```ts
window.themeFactoryApi.projects
```

Le renderer ne doit importer directement aucun module appartenant à :

* Electron ;
* Node.js ;
* SQLite ;
* `better-sqlite3` ;
* `src/main` ;
* `src/preload`.

---

## 2. Périmètre strict

Cette phase concerne uniquement l’interface CRUD des projets dans le renderer.

Ne pas implémenter :

* le CRUD des phases ;
* le CRUD des tâches ;
* la persistance globale du projet actif dans SQLite ;
* un nouveau système de préférences ;
* un state manager externe ;
* React Router ;
* une bibliothèque de formulaires ;
* une bibliothèque UI ;
* une bibliothèque de notifications ;
* une nouvelle migration SQLite ;
* de nouveaux handlers IPC, sauf correction strictement nécessaire d’un défaut bloquant déjà existant ;
* de refactorisation générale hors périmètre ;
* de modification cosmétique massive du shell existant.

Ne pas ajouter de dépendance sans nécessité absolue.

---

## 3. Étape préalable obligatoire

Avant toute modification :

1. lire les fichiers de documentation pertinents ;
2. inspecter l’architecture actuelle ;
3. inspecter la page Projets existante ;
4. inspecter les styles du renderer ;
5. lire les contrats et schémas partagés des projets ;
6. lire l’API preload déjà exposée ;
7. vérifier les signatures exactes de :

```ts
window.themeFactoryApi.projects.list
window.themeFactoryApi.projects.getById
window.themeFactoryApi.projects.create
window.themeFactoryApi.projects.update
window.themeFactoryApi.projects.remove
```

8. vérifier les champs exacts du modèle projet et leurs contraintes Zod ;
9. inspecter les conventions de tests déjà présentes dans le dépôt.

Ne suppose aucun nom de fichier ou type sans l’avoir vérifié dans le dépôt.

---

## 4. Fichier de prompt

Créer ou mettre à jour ce fichier avant l’implémentation :

```text
workflow/prompts/PHASE_3.4_PROMPT.md
```

Il doit contenir le présent prompt ou une copie fidèle de ses exigences.

---

## 5. Fonctionnalités attendues

### 5.1 Chargement initial

À l’ouverture de la page Projets :

* appeler `window.themeFactoryApi.projects.list()` ;
* afficher un état de chargement explicite ;
* afficher ensuite la liste des projets ;
* afficher un état vide si aucun projet n’existe ;
* afficher une erreur lisible si le chargement échoue ;
* permettre de relancer le chargement après une erreur si cela reste simple et cohérent avec l’interface actuelle.

Le composant ne doit pas effectuer de mise à jour d’état après démontage.

Évite les appels dupliqués involontaires ou les boucles de rendu.

---

### 5.2 Liste des projets

Chaque projet doit être affiché de manière lisible.

Afficher au minimum les informations pertinentes déjà disponibles dans le modèle, par exemple selon les champs réellement présents :

* nom ;
* description ;
* objectif ;
* statut ;
* technologie cible ;
* chemin local du dépôt ;
* notes ;
* dates de création et de modification.

Ne force pas l’affichage de champs absents du modèle réel.

Pour chaque projet, proposer des actions claires :

* sélectionner ;
* modifier ;
* supprimer.

Les boutons doivent être de vrais éléments `<button>` accessibles.

Les actions doivent rester utilisables au clavier.

Les informations secondaires peuvent être masquées ou simplifiées lorsqu’elles sont vides, mais aucune valeur ne doit produire `undefined` dans l’interface.

---

### 5.3 Projet actif

La phase demande une sélection du projet actif.

Pour cette sous-phase, gérer cette sélection uniquement dans l’état local du renderer, sauf si une mécanique équivalente existe déjà dans le dépôt.

Comportement attendu :

* un seul projet peut être actif visuellement ;
* le projet actif est clairement identifiable ;
* cliquer sur « Sélectionner » ou sur une action équivalente définit ce projet comme actif ;
* la sélection ne doit pas déclencher de modification SQLite du projet ;
* si le projet actif est supprimé, la sélection active doit être réinitialisée ;
* si la liste est rechargée et que le projet actif n’existe plus, la sélection doit être réinitialisée.

Ne crée pas encore de table, de préférence persistante ou de nouveau contrat IPC pour cette sélection.

---

### 5.4 Création d’un projet

Ajouter une action claire permettant d’ouvrir un formulaire de création.

Le formulaire doit :

* utiliser les champs correspondant au schéma réel de création ;
* fournir des labels associés aux champs ;
* utiliser des types de champs adaptés ;
* gérer les champs obligatoires ;
* permettre l’annulation ;
* empêcher la soumission multiple ;
* appeler `window.themeFactoryApi.projects.create(...)` ;
* afficher une erreur si l’opération échoue ;
* ajouter le projet créé à l’interface ou recharger proprement la liste ;
* fermer ou réinitialiser le formulaire après succès ;
* conserver autant que possible les valeurs saisies en cas d’erreur.

Ne duplique pas manuellement des règles incompatibles avec les schémas Zod partagés.

Le renderer peut effectuer une validation ergonomique minimale, mais la validation IPC existante reste la source de vérité.

---

### 5.5 Modification d’un projet

Chaque projet doit proposer une action de modification.

Le formulaire de modification doit :

* reprendre les valeurs actuelles du projet ;
* utiliser le schéma réel de mise à jour ;
* appeler `window.themeFactoryApi.projects.update(...)` avec la signature exacte définie dans le contrat ;
* permettre l’annulation ;
* empêcher la double soumission ;
* afficher les erreurs ;
* mettre à jour l’interface après succès ;
* conserver la sélection active si le projet modifié était actif ;
* ne pas écraser involontairement des valeurs avec `undefined`, des chaînes vides ou des valeurs par défaut non souhaitées.

Si les formulaires de création et de modification ont une structure très proche, créer un composant partagé simple, par exemple :

```text
ProjectForm
```

Le nom exact peut être adapté aux conventions existantes.

Évite cependant une abstraction excessive.

---

### 5.6 Suppression

Chaque projet doit proposer une action de suppression.

Avant la suppression :

* demander une confirmation explicite ;
* afficher clairement le nom du projet concerné ;
* permettre d’annuler ;
* ne pas utiliser une suppression immédiate sans confirmation.

Une utilisation simple de `window.confirm` est acceptable si elle reste cohérente avec le niveau actuel du projet. Un composant de confirmation local est également acceptable, mais ne crée pas de système modal générique complexe.

Après confirmation :

* appeler `window.themeFactoryApi.projects.remove(...)` avec la signature exacte ;
* désactiver les actions concernées pendant la suppression ;
* retirer le projet de la liste ou recharger la liste ;
* réinitialiser le projet actif s’il a été supprimé ;
* afficher une erreur si la suppression échoue.

Ne masque aucune erreur.

---

## 6. Gestion des états

L’interface doit distinguer au minimum :

* chargement initial ;
* liste vide ;
* liste chargée ;
* formulaire de création ouvert ;
* formulaire de modification ouvert ;
* soumission en cours ;
* suppression en cours ;
* erreur de chargement ;
* erreur de création ;
* erreur de modification ;
* erreur de suppression.

Évite un unique booléen ambigu utilisé pour plusieurs opérations incompatibles.

Les actions susceptibles d’entrer en conflit doivent être désactivées pendant une mutation.

Ne bloque pas toute l’application si seule une carte projet est en cours de suppression.

---

## 7. Accessibilité minimale

Respecter au minimum les règles suivantes :

* labels associés aux champs de formulaire ;
* boutons natifs ;
* textes d’erreur compréhensibles ;
* indication accessible de l’état actif ;
* `aria-current`, `aria-pressed` ou attribut équivalent lorsque pertinent ;
* focus clavier visible ;
* aucun clic obligatoire sur un simple `<div>` ;
* titres structurés ;
* confirmation de suppression compréhensible ;
* champs désactivés pendant la soumission si nécessaire.

Ne dégrade pas l’accessibilité déjà mise en place dans le shell.

---

## 8. Styles

Réutiliser autant que possible les conventions CSS existantes.

Ajouter uniquement les styles nécessaires pour :

* la barre d’actions de la page ;
* la liste ou grille de projets ;
* les cartes ou lignes de projet ;
* le projet actif ;
* les formulaires ;
* les messages de chargement, d’erreur et d’état vide ;
* les actions de création, modification et suppression ;
* les états désactivés.

L’interface doit rester cohérente avec le shell desktop actuel.

Ne pas refaire entièrement la direction artistique.

Ne pas ajouter de framework CSS.

---

## 9. Organisation du code

Privilégier des composants petits et lisibles.

Une organisation possible, à adapter au dépôt réel :

```text
src/renderer/src/pages/ProjectsPage.tsx
src/renderer/src/components/projects/ProjectForm.tsx
src/renderer/src/components/projects/ProjectCard.tsx
```

Ne crée les composants séparés que s’ils réduisent réellement la complexité.

Évite :

* un composant monolithique difficile à tester ;
* une fragmentation excessive ;
* un hook générique prématuré ;
* un store global inutile ;
* la duplication du modèle partagé.

Importer les types de projet depuis `src/shared` selon les conventions et alias existants.

---

## 10. Gestion des erreurs

Les appels preload peuvent échouer.

Pour chaque appel asynchrone :

* utiliser `try/catch` ;
* normaliser proprement les erreurs inconnues ;
* afficher un message compréhensible ;
* ne pas afficher `[object Object]` ;
* ne pas faire uniquement un `console.error` ;
* réinitialiser correctement les états `loading` ou `mutating` dans un `finally` ;
* ne pas masquer l’erreur par un fallback silencieux.

Une petite fonction locale de normalisation est acceptable, par exemple :

```ts
function getErrorMessage(error: unknown): string
```

Ne crée pas un système global d’erreurs pour cette seule phase.

---

## 11. Tests attendus

Ajouter des tests renderer ciblés pour les comportements principaux, selon l’infrastructure de test réellement disponible.

Tester au minimum, lorsque l’environnement React de test existant le permet :

1. affichage de l’état de chargement ;
2. affichage de l’état vide ;
3. affichage de projets chargés ;
4. création d’un projet ;
5. ouverture et annulation du formulaire ;
6. modification d’un projet ;
7. confirmation de suppression ;
8. suppression annulée ;
9. suppression confirmée ;
10. gestion d’une erreur d’appel API ;
11. sélection d’un projet actif ;
12. réinitialisation de la sélection après suppression du projet actif.

Mocker uniquement :

```ts
window.themeFactoryApi.projects
```

Ne pas importer ou démarrer Electron dans les tests renderer.

Ne pas accéder à une vraie base SQLite dans les tests de composant.

Si l’infrastructure actuelle ne permet pas raisonnablement certains tests React sans ajouter une dépendance importante, ne modifie pas massivement l’outillage. Dans ce cas :

* ajoute les tests réalisables avec l’outillage existant ;
* documente précisément les limites ;
* ne prétends pas qu’un scénario est testé s’il ne l’est pas.

Les tests existants doivent continuer à passer.

---

## 12. Vérifications architecturales obligatoires

Avant de terminer, vérifier explicitement :

* aucun import Electron dans le renderer ;
* aucun import Node dans le renderer ;
* aucun accès SQLite dans le renderer ;
* aucun appel `ipcRenderer` dans React ;
* aucun canal IPC sous forme de chaîne dupliquée dans le renderer ;
* utilisation exclusive de `window.themeFactoryApi.projects` ;
* utilisation des types partagés existants ;
* aucune modification de migration ;
* aucune nouvelle dépendance injustifiée ;
* aucune erreur TypeScript masquée ;
* aucun `any` ajouté sans justification stricte ;
* aucun `@ts-ignore` ;
* aucun `@ts-expect-error` injustifié ;
* aucun test supprimé ou neutralisé.

---

## 13. Commandes de validation

Identifier d’abord les scripts exacts du `package.json`, puis exécuter au minimum :

```powershell
npm run typecheck
npm run test
npm run build
```

Si un script diffère, utiliser le script réellement défini et l’indiquer dans le rapport.

Ne pas lancer automatiquement un commit Git.

Ne pas utiliser :

```powershell
git add .
```

Ne pas modifier la configuration TypeScript pour masquer une erreur.

Ne pas utiliser `skipLibCheck` comme correction.

Ne pas supprimer un test en échec.

---

## 14. Validation manuelle à préparer

Préparer une checklist de validation manuelle comprenant au minimum :

### État vide

* ouvrir l’application avec aucun projet ;
* vérifier le message d’état vide ;
* vérifier que l’action de création est disponible.

### Création

* créer un projet avec les champs obligatoires ;
* vérifier son apparition dans la liste ;
* redémarrer l’application ;
* vérifier sa persistance.

### Annulation

* ouvrir le formulaire de création ;
* saisir des valeurs ;
* annuler ;
* vérifier qu’aucun projet n’a été créé.

### Modification

* modifier un projet existant ;
* vérifier les valeurs affichées ;
* redémarrer l’application ;
* vérifier la persistance.

### Sélection active

* sélectionner un projet ;
* vérifier son état visuel actif ;
* sélectionner un autre projet ;
* vérifier qu’un seul projet reste actif.

### Suppression annulée

* demander la suppression ;
* annuler la confirmation ;
* vérifier que le projet existe toujours.

### Suppression confirmée

* confirmer la suppression ;
* vérifier la disparition du projet ;
* redémarrer l’application ;
* vérifier qu’il ne réapparaît pas.

### Projet actif supprimé

* sélectionner un projet ;
* supprimer ce projet ;
* vérifier que la sélection active est réinitialisée.

### Erreurs

* vérifier qu’une erreur API simulée ou provoquée affiche un message lisible ;
* vérifier que l’interface ne reste pas bloquée en chargement.

### Navigation

* quitter la page Projets ;
* revenir sur la page ;
* vérifier que la liste est correctement rechargée ou conservée selon l’architecture retenue.

---

## 15. Rapport obligatoire

Créer à la fin :

```text
workflow/reports/RAPPORT_PHASE_3.4.md
```

Le rapport doit contenir :

### Résumé

* objectif de la phase ;
* résultat obtenu ;
* statut final : terminé, partiellement terminé ou bloqué.

### Fichiers créés

Lister chaque fichier créé avec son rôle.

### Fichiers modifiés

Lister chaque fichier modifié avec un résumé précis.

### Fonctionnalités implémentées

Préciser notamment :

* chargement de la liste ;
* état vide ;
* création ;
* modification ;
* suppression ;
* confirmation ;
* projet actif ;
* gestion des erreurs ;
* gestion des opérations en cours.

### Architecture

Confirmer explicitement :

* SQLite reste dans le main process ;
* le renderer utilise uniquement `window.themeFactoryApi.projects` ;
* aucun accès direct à Electron, Node ou SQLite n’a été ajouté ;
* aucun nouveau canal IPC non autorisé n’a été créé.

### Tests

Indiquer :

* les fichiers de tests ajoutés ou modifiés ;
* les scénarios couverts ;
* le nombre de fichiers de tests ;
* le nombre de tests exécutés ;
* le nombre de tests réussis et échoués.

### Commandes exécutées

Reporter les commandes exactes et leurs résultats :

```text
npm run typecheck
npm run test
npm run build
```

### Validation manuelle

Fournir la checklist précise à exécuter par l’utilisateur.

Ne pas déclarer la validation manuelle comme réussie tant que l’utilisateur ne l’a pas réellement effectuée.

### Limites et écarts

Documenter :

* tests non réalisables ;
* contraintes de l’outillage ;
* décisions temporaires ;
* éventuels écarts au prompt ;
* points à reprendre plus tard.

### Git

Afficher à la fin :

```powershell
git status --short
git diff --stat
```

Ne pas committer.

Proposer un message de commit, par exemple :

```text
feat: add projects CRUD interface
```

Le commit sera réalisé uniquement après validation manuelle par l’utilisateur.

---

## 16. Critères d’acceptation

La phase 3.4 est techniquement prête pour validation manuelle si :

* la page Projets affiche les projets persistés ;
* l’état de chargement est visible ;
* l’état vide est visible ;
* un projet peut être créé ;
* un projet peut être modifié ;
* une suppression exige une confirmation ;
* une suppression confirmée fonctionne ;
* une suppression annulée ne modifie rien ;
* un projet peut être sélectionné comme actif ;
* un seul projet est actif à la fois ;
* supprimer le projet actif réinitialise la sélection ;
* les erreurs sont visibles et lisibles ;
* les doubles soumissions sont empêchées ;
* les contrôles sont accessibles au clavier ;
* le renderer utilise uniquement l’API preload autorisée ;
* aucun accès direct à Electron, Node ou SQLite n’existe dans React ;
* les types partagés existants sont réutilisés ;
* `npm run typecheck` réussit ;
* `npm run test` réussit ;
* `npm run build` réussit ;
* le prompt est présent dans `workflow/prompts/PHASE_3.4_PROMPT.md` ;
* le rapport est présent dans `workflow/reports/RAPPORT_PHASE_3.4.md` ;
* aucune modification hors périmètre n’a été introduite ;
* aucun commit n’a été effectué automatiquement.

---

## 17. Ordre d’exécution obligatoire

Procède dans cet ordre :

1. inspecter le dépôt et les contrats existants ;
2. créer `workflow/prompts/PHASE_3.4_PROMPT.md` ;
3. présenter un plan court des fichiers à créer ou modifier ;
4. implémenter le chargement et l’affichage de la liste ;
5. implémenter l’état vide et les erreurs ;
6. implémenter le formulaire partagé ;
7. implémenter la création ;
8. implémenter la modification ;
9. implémenter la suppression avec confirmation ;
10. implémenter la sélection locale du projet actif ;
11. ajouter les styles strictement nécessaires ;
12. ajouter les tests ciblés ;
13. exécuter le typecheck ;
14. exécuter les tests ;
15. exécuter le build ;
16. corriger toute erreur sans la masquer ;
17. créer `workflow/reports/RAPPORT_PHASE_3.4.md` ;
18. afficher `git status --short` et `git diff --stat` ;
19. arrêter sans commit afin de laisser la validation manuelle à l’utilisateur.

Commence par inspecter le dépôt. Ne modifie aucun fichier avant d’avoir vérifié les contrats et les conventions existants.
