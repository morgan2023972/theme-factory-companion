# PHASE 3.7 — INTERFACE DE GESTION DES PHASES

## Contexte

Le projet **Theme Factory Companion** est une application desktop locale développée avec :

* Electron ;
* React ;
* TypeScript ;
* electron-vite ;
* SQLite ;
* better-sqlite3 ;
* Zod ;
* Vitest.

L’architecture impose une séparation stricte entre :

* `src/main` ;
* `src/preload` ;
* `src/renderer` ;
* `src/shared`.

Le renderer React ne doit jamais accéder directement à :

* Electron ;
* Node.js ;
* SQLite ;
* better-sqlite3 ;
* un repository du processus principal.

Toutes les opérations métier accessibles au renderer passent par l’API limitée :

```ts
window.themeFactoryApi
```

## État actuel

Les phases suivantes sont terminées, validées et commitées :

* Phase 3.1 — Schémas Zod et types partagés pour les projets ;
* Phase 3.2 — Repository des projets ;
* Phase 3.3 — IPC et API preload des projets ;
* Phase 3.4 — Interface CRUD des projets ;
* Phase 3.5 — Schémas et repository des phases ;
* Phase 3.6 — IPC et API preload des phases.

La Phase 3.6 expose désormais :

```ts
window.themeFactoryApi.phases
```

avec les opérations suivantes :

```ts
listByProjectId(projectId: string): Promise<Phase[]>
getById(id: string): Promise<Phase | null>
create(input: CreatePhaseInput): Promise<Phase>
update(id: string, input: UpdatePhaseInput): Promise<Phase | null>
remove(id: string): Promise<boolean>
```

Les schémas Zod, les types partagés, le repository, les handlers IPC et le preload constituent la source de vérité.

## Objectif

Créer l’interface React permettant de gérer les phases du projet actif.

L’utilisateur doit pouvoir :

* afficher les phases du projet actif ;
* créer une phase ;
* modifier une phase ;
* supprimer une phase avec confirmation ;
* voir les phases dans l’ordre défini par leur position ;
* gérer les états de chargement, d’erreur et de liste vide ;
* comprendre clairement lorsqu’aucun projet actif n’est sélectionné.

Cette phase ne doit pas implémenter les tâches, les checklists ni un système avancé de réordonnancement par glisser-déposer.

---

# 1. Inspection obligatoire avant modification

Avant toute modification, inspecter précisément :

* `src/renderer/src/App.tsx` ou le routeur/navigation équivalent ;
* `src/renderer/src/pages/ProjectsPage.tsx` ;
* `src/renderer/src/pages/ProjectsPage.test.tsx` ;
* les composants de formulaire utilisés par les projets ;
* les composants partagés existants ;
* les fichiers CSS ou styles associés ;
* le mécanisme de sélection du projet actif ;
* le stockage ou contexte du projet actif ;
* la page temporaire actuelle correspondant à « Phases et tâches » ;
* `src/shared/contracts/themeFactoryApi.ts` ;
* `src/shared/schemas/phase.ts` ;
* `src/shared/schemas/project.ts` ;
* `src/preload/index.ts` ;
* les conventions de tests React existantes.

Identifier notamment :

* comment le projet actif est sélectionné ;
* où son identifiant est conservé ;
* comment les pages accèdent à cet état ;
* comment les formulaires projets gèrent création et édition ;
* comment les erreurs API sont affichées ;
* comment les tests mockent `window.themeFactoryApi`.

Réutiliser les conventions déjà établies.

Ne pas introduire une nouvelle architecture globale de gestion d’état si le projet possède déjà une solution suffisante.

---

# 2. Périmètre fonctionnel

Créer ou compléter une page de gestion des phases, probablement :

```text
src/renderer/src/pages/PhasesPage.tsx
```

Adapter le nom exact aux conventions existantes.

La page doit se baser exclusivement sur :

```ts
window.themeFactoryApi.phases
```

Elle ne doit importer aucun module du processus principal.

## Comportement attendu

### Aucun projet actif

Si aucun projet actif n’est sélectionné :

* ne pas appeler `phases.listByProjectId` ;
* afficher un message clair ;
* inviter l’utilisateur à sélectionner un projet depuis la page Projets ;
* désactiver ou masquer l’action de création d’une phase.

Exemple de message indicatif :

```text
Sélectionnez d’abord un projet actif pour gérer ses phases.
```

Adapter le texte au style de l’application.

### Projet actif disponible

Lorsqu’un projet actif est disponible :

* charger ses phases avec `listByProjectId(projectId)` ;
* afficher le nom du projet actif si cette information est déjà facilement disponible ;
* afficher les phases dans l’ordre retourné par l’API ;
* ne pas refaire un tri arbitraire si l’API garantit déjà l’ordre par position.

---

# 3. Liste des phases

Chaque phase affichée doit présenter au minimum :

* son nom ;
* sa description si elle existe ;
* son statut ;
* sa position ;
* ses actions de modification et de suppression.

Utiliser les noms de propriétés réels définis dans :

```text
src/shared/schemas/phase.ts
```

Ne pas inventer de champs.

## Statut

Afficher le statut avec un libellé lisible.

Utiliser les valeurs exactes définies dans le schéma partagé.

Si des badges de statut existent déjà dans le module Projets, réutiliser leur logique visuelle lorsque cela reste simple.

Ne pas créer une bibliothèque complète de design system pendant cette phase.

## Position

La position doit être visible ou compréhensible dans l’ordre d’affichage.

Éviter d’afficher directement un index technique incompréhensible si la valeur commence à zéro.

Une présentation comme « Phase 1 », « Phase 2 » peut être utilisée visuellement, tout en conservant la valeur réelle en base.

Ne pas modifier la position en base uniquement pour l’affichage.

---

# 4. Formulaire de phase

Créer si nécessaire un composant dédié, probablement :

```text
src/renderer/src/components/PhaseForm.tsx
```

ou dans l’emplacement cohérent avec les composants actuels.

Le même formulaire peut être utilisé pour :

* la création ;
* la modification.

## Champs

Le formulaire doit exposer uniquement les champs réellement autorisés par les schémas partagés.

Cela peut inclure selon le schéma existant :

* nom ou titre ;
* description ;
* statut ;
* position ;
* notes ou autres champs présents dans le modèle.

Inspecter le schéma réel avant d’implémenter.

Ne pas ajouter de champ qui n’existe pas dans `CreatePhaseInput` ou `UpdatePhaseInput`.

## Validation renderer

Le renderer doit fournir une validation ergonomique minimale avant l’envoi :

* champs obligatoires ;
* valeurs vides ;
* sélection d’un statut valide ;
* position valide si elle est modifiable.

La validation de sécurité reste assurée côté IPC avec Zod.

Réutiliser si possible les schémas Zod partagés dans le renderer, sans importer de code main.

Ne pas dupliquer manuellement toutes les règles si les schémas sont déjà compatibles avec le renderer.

## Création

Lors de la création :

* rattacher obligatoirement la phase au projet actif ;
* ne jamais demander à l’utilisateur de saisir manuellement `projectId` ;
* appeler `window.themeFactoryApi.phases.create(...)` ;
* utiliser le résultat réel retourné par l’API ;
* rafraîchir ou mettre à jour la liste de manière cohérente ;
* fermer ou réinitialiser le formulaire après succès ;
* conserver le formulaire ouvert avec un message en cas d’échec.

Ne pas générer d’UUID ou de timestamps dans le renderer.

## Modification

Lors de la modification :

* préremplir le formulaire avec les données de la phase ;
* envoyer uniquement les champs autorisés ;
* ne pas envoyer `projectId` dans la mise à jour si le schéma l’interdit ;
* appeler `window.themeFactoryApi.phases.update(id, input)` ;
* gérer le cas où l’API retourne `null` ;
* remettre la liste à jour après succès ;
* permettre d’annuler l’édition.

Ne pas remplacer une mise à jour partielle par un objet contenant des valeurs artificielles ou des champs non modifiés, sauf si le formulaire existant suit déjà une convention explicite de remplacement complet compatible avec le schéma.

---

# 5. Suppression

Chaque phase doit pouvoir être supprimée.

Avant l’appel API :

* demander une confirmation explicite ;
* afficher le nom de la phase dans la confirmation si possible ;
* permettre d’annuler sans effet.

Après confirmation :

* appeler `window.themeFactoryApi.phases.remove(id)` ;
* gérer le retour booléen réel ;
* retirer ou recharger la phase après succès ;
* afficher une erreur si la suppression échoue ou retourne `false`.

Ne pas implémenter de suppression optimiste irréversible avant la confirmation du résultat API.

Ne pas modifier manuellement les positions des autres phases dans le renderer après suppression, sauf si le repository et le contrat existants l’exigent explicitement.

---

# 6. États de l’interface

La page doit gérer explicitement :

## Chargement initial

Afficher un état de chargement pendant la récupération des phases.

Éviter de présenter brièvement un faux état vide avant la fin du chargement.

## Liste vide

Si le projet actif ne contient aucune phase :

* afficher un état vide clair ;
* proposer l’action de créer la première phase.

## Erreur de chargement

Afficher un message visible et compréhensible.

Prévoir une possibilité simple de réessayer si cela correspond aux conventions existantes.

## Mutation en cours

Pendant une création, modification ou suppression :

* empêcher les doubles soumissions ;
* désactiver les actions incompatibles ;
* afficher un libellé ou état approprié.

## Erreur de mutation

Conserver l’interface utilisable.

Ne pas vider le formulaire après une erreur de création ou de modification.

---

# 7. Projet actif et navigation

La page des phases doit utiliser le mécanisme existant de projet actif.

Ne pas créer une seconde source de vérité indépendante.

Vérifier que :

* sélectionner un projet sur la page Projets permet ensuite de consulter ses phases ;
* changer de projet actif recharge les phases correspondantes ;
* aucun résultat de l’ancien projet ne reste affiché pendant le nouveau chargement ;
* supprimer le projet actif ou perdre sa sélection ramène la page à l’état « aucun projet actif ».

Si le mécanisme actuel ne rend pas facilement le projet actif accessible entre les pages, réaliser uniquement l’adaptation minimale nécessaire.

Toute modification du mécanisme de projet actif doit être limitée, clairement testée et documentée.

---

# 8. Position des phases

Le repository de la Phase 3.5 gère déjà la position des phases.

La Phase 3.7 doit respecter le comportement existant.

## Exigences minimales

* afficher les phases dans l’ordre renvoyé par `listByProjectId` ;
* permettre la saisie ou la modification de la position uniquement si le schéma et l’API le prévoient ;
* utiliser une valeur par défaut cohérente lors de la création si le repository la calcule automatiquement ;
* ne pas recréer une logique de collision ou de réindexation dans le renderer.

## Hors périmètre

Ne pas développer pendant cette phase :

* drag-and-drop ;
* boutons complexes monter/descendre avec transactions ;
* réordonnancement global ;
* gestion avancée des collisions de position.

Le réordonnancement transactionnel complet est prévu dans une phase ultérieure.

---

# 9. Tests React

Créer les tests nécessaires, probablement :

```text
src/renderer/src/pages/PhasesPage.test.tsx
```

et éventuellement :

```text
src/renderer/src/components/PhaseForm.test.tsx
```

Adapter les chemins à l’organisation existante.

Les tests doivent utiliser un mock strictement typé de :

```ts
window.themeFactoryApi
```

Ne pas contourner le contrat avec `any`.

## Scénarios minimums

### Aucun projet actif

* affiche un message demandant de sélectionner un projet ;
* n’appelle pas `phases.listByProjectId` ;
* ne permet pas de créer une phase.

### Chargement

* affiche l’état de chargement ;
* ne montre pas immédiatement l’état vide.

### Liste vide

* appelle `listByProjectId` avec le bon identifiant ;
* affiche l’état vide après résolution ;
* permet d’ouvrir le formulaire de création.

### Liste existante

* affiche les phases retournées ;
* respecte l’ordre retourné par l’API ;
* affiche les statuts et actions attendues.

### Création

* ouvre le formulaire ;
* valide les champs obligatoires ;
* appelle `phases.create` avec le `projectId` actif ;
* transmet les champs attendus ;
* empêche la double soumission ;
* ajoute ou recharge la phase après succès ;
* affiche une erreur et conserve le formulaire en cas d’échec.

### Modification

* ouvre un formulaire prérempli ;
* appelle `phases.update` avec l’identifiant correct ;
* ne transmet pas de champ interdit ;
* met à jour l’affichage après succès ;
* gère un retour `null` ;
* permet l’annulation.

### Suppression

* demande confirmation ;
* n’appelle pas l’API après annulation ;
* appelle `phases.remove` après confirmation ;
* met à jour la liste après succès ;
* gère un retour `false` ou une exception.

### Changement de projet actif

Si l’architecture de test le permet simplement :

* recharge les phases avec le nouvel identifiant ;
* n’affiche plus les phases de l’ancien projet.

## Qualité des tests

Les tests doivent :

* tester des comportements utilisateur ;
* éviter de dépendre excessivement de la structure HTML interne ;
* utiliser les rôles, labels et textes accessibles ;
* réinitialiser les mocks ;
* ne contenir ni `.skip` ni `.only` ;
* ne pas reconstruire manuellement la logique testée.

---

# 10. Accessibilité minimale

Les éléments interactifs doivent avoir :

* des libellés explicites ;
* des boutons accessibles au clavier ;
* des labels associés aux champs ;
* des messages d’erreur compréhensibles ;
* une confirmation de suppression utilisable au clavier.

Les boutons « Modifier », « Supprimer », « Annuler » et « Enregistrer » doivent être identifiables avec le nom de la phase lorsque plusieurs lignes existent, par exemple avec un `aria-label`.

Ne pas introduire une dépendance d’accessibilité supplémentaire.

---

# 11. Styles

Respecter l’apparence existante de l’application.

Réutiliser :

* les classes ;
* les espacements ;
* les boutons ;
* les cartes ;
* les formulaires ;
* les badges ;
* les messages d’état déjà présents dans le module Projets.

Ajouter uniquement les styles nécessaires à la lisibilité de la page des phases.

Ne pas effectuer de refonte globale.

Ne pas modifier l’identité visuelle de l’application.

---

# 12. Non-régression

La Phase 3.7 ne doit pas casser :

* le CRUD des projets ;
* la sélection du projet actif ;
* les handlers IPC des projets ;
* les handlers IPC des phases ;
* le preload ;
* les repositories ;
* les migrations ;
* le health check ;
* le démarrage Electron ;
* la navigation générale ;
* les tests précédemment validés.

Les tests du module Projets doivent continuer à réussir.

---

# 13. Périmètre interdit

Ne pas implémenter :

* les tâches ;
* les checklists ;
* la vue détaillée d’une tâche ;
* les prompts Claude Code associés aux tâches ;
* le drag-and-drop ;
* un système avancé de réordonnancement ;
* le journal d’activité ;
* le tableau de bord réel ;
* les questions ;
* les problèmes ;
* les décisions ;
* une refonte de la navigation ;
* une nouvelle bibliothèque de formulaire ;
* une nouvelle bibliothèque de gestion d’état ;
* une nouvelle dépendance sans nécessité absolue ;
* un accès direct à Electron, Node ou SQLite depuis le renderer ;
* une fonctionnalité de Phase 3.8 ou de Phase 4.

---

# 14. Qualité attendue

Le code doit respecter :

* TypeScript strict ;
* aucune erreur masquée ;
* aucun `any` injustifié ;
* aucun cast dangereux ;
* aucune duplication inutile des types partagés ;
* composants React lisibles ;
* états explicites ;
* effets React correctement nettoyés ;
* absence de mise à jour d’état obsolète après un changement de projet ;
* tests déterministes ;
* interface accessible ;
* changements limités au périmètre de la Phase 3.7.

Éviter les composants excessivement longs.

Extraire un composant uniquement lorsqu’il améliore réellement la lisibilité ou la testabilité.

---

# 15. Commandes de validation

À la fin de l’implémentation, exécuter dans cet ordre :

```bash
npm run typecheck
npm run test
npm run build
```

Si une commande échoue :

1. analyser la cause réelle ;
2. corriger le code ou les tests ;
3. relancer la commande concernée ;
4. relancer ensuite la séquence complète.

Interdictions :

* `skipLibCheck` ;
* `@ts-ignore` ;
* `@ts-expect-error` injustifié ;
* `.skip` ;
* `.only` ;
* désactivation d’un test ;
* assouplissement artificiel des schémas ;
* modification de configuration uniquement pour masquer une erreur.

Après les validations automatisées, lancer :

```bash
npm run dev
```

---

# 16. Validation manuelle obligatoire

La validation manuelle doit être réalisée avec un projet de test.

Vérifier au minimum :

1. ouvrir l’application ;
2. aller sur la page des phases sans projet actif ;
3. vérifier le message demandant de sélectionner un projet ;
4. sélectionner ou créer un projet depuis la page Projets ;
5. revenir sur la page des phases ;
6. vérifier l’état vide ;
7. créer une première phase ;
8. vérifier son affichage ;
9. créer une seconde phase ;
10. vérifier leur ordre ;
11. modifier le nom, la description ou le statut d’une phase ;
12. annuler une modification et vérifier qu’aucune donnée n’a changé ;
13. supprimer une phase puis annuler la confirmation ;
14. supprimer réellement une phase ;
15. redémarrer l’application ;
16. vérifier la persistance de la phase restante ;
17. changer de projet actif et vérifier le rechargement correct ;
18. vérifier qu’aucune erreur n’apparaît dans les consoles main et renderer.

Claude Code peut préparer et lancer l’application, mais la validation visuelle et interactive doit être confirmée honnêtement.

Ne pas déclarer une interaction validée uniquement parce qu’aucune erreur n’apparaît dans les logs.

---

# 17. Rapport obligatoire

Créer :

```text
workflow/reports/RAPPORT_PHASE_3.7.md
```

Le rapport doit contenir :

## Résumé

* objectif ;
* résultat ;
* statut.

## Inspection initiale

* mécanisme existant du projet actif ;
* page ou placeholder remplacé ;
* conventions réutilisées depuis le CRUD des projets.

## Fichiers créés

Liste exacte.

## Fichiers modifiés

Liste exacte.

## Interface réalisée

Décrire :

* état sans projet actif ;
* liste ;
* formulaire ;
* création ;
* modification ;
* suppression ;
* chargement ;
* erreurs ;
* état vide ;
* gestion des positions.

## API utilisée

Lister les méthodes réellement appelées sur :

```ts
window.themeFactoryApi.phases
```

## Tests

Indiquer :

* fichiers créés ou modifiés ;
* scénarios couverts ;
* nombre de fichiers de tests ;
* nombre total de tests réussis.

## Validation automatisée

Reporter les résultats exacts de :

```bash
npm run typecheck
npm run test
npm run build
```

## Validation manuelle

Distinguer clairement :

* ce que Claude Code a pu vérifier techniquement ;
* ce qui nécessite une confirmation visuelle de l’utilisateur ;
* les parcours réellement confirmés.

## Écarts

Mentionner tout écart au prompt et sa justification.

## Risques et points pour la Phase 3.8

Identifier notamment :

* persistance ;
* cascades ;
* navigation ;
* changement de projet actif ;
* gestion des erreurs ;
* positions.

## Git

Ne créer aucun commit automatiquement.

Afficher :

```bash
git status --short
git diff --stat
```

---

# 18. Livrable final dans Claude Code

À la fin, afficher une synthèse comprenant :

1. le statut de la Phase 3.7 ;
2. les fichiers créés et modifiés ;
3. le fonctionnement de la page des phases ;
4. les méthodes API utilisées ;
5. les tests ajoutés ;
6. le résultat exact du typecheck ;
7. le résultat exact des tests ;
8. le résultat exact du build ;
9. les éléments de validation manuelle réalisés ;
10. les éléments restant à confirmer par l’utilisateur ;
11. le chemin du rapport ;
12. les éventuels écarts ;
13. la confirmation qu’aucun commit n’a été créé.

Ne commencer ni la Phase 3.8 ni la Phase 4.

---

# Critères d’acceptation

La Phase 3.7 est terminée uniquement si :

* la page des phases utilise le projet actif existant ;
* aucun appel de liste n’est effectué sans projet actif ;
* les phases du projet actif sont chargées via le preload ;
* la liste respecte l’ordre retourné par l’API ;
* la création fonctionne ;
* la modification fonctionne ;
* la suppression demande confirmation ;
* les retours `null` et `false` sont gérés ;
* les états chargement, vide et erreur sont visibles ;
* les doubles soumissions sont empêchées ;
* aucune donnée interdite n’est transmise ;
* aucun accès direct à Electron, Node ou SQLite n’est ajouté ;
* les tests React couvrent les principaux parcours ;
* le module Projets ne régresse pas ;
* `npm run typecheck` réussit ;
* `npm run test` réussit ;
* `npm run build` réussit ;
* l’application démarre ;
* la validation manuelle est documentée honnêtement ;
* aucune fonctionnalité de Phase 3.8 ou de Phase 4 n’est implémentée ;
* `workflow/reports/RAPPORT_PHASE_3.7.md` est créé ;
* aucun commit n’est créé automatiquement.
