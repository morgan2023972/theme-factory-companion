# REVIEW INDÉPENDANTE — PHASE 3.7

Effectue une review technique indépendante de la **Phase 3.7 — Interface de gestion des phases** du projet Theme Factory Companion.

## Documents de référence

Lis intégralement :

* `workflow/prompts/PHASE_3.7_PROMPT.md`
* `workflow/reports/RAPPORT_PHASE_3.7.md`

Inspecte ensuite directement le code réel et les tests.

Le rapport d’implémentation constitue une déclaration de résultat, pas une preuve suffisante. Vérifie chacune de ses affirmations importantes dans le dépôt.

## Fichiers à inspecter au minimum

* `src/renderer/src/App.tsx`
* `src/renderer/src/pages/ProjectsPage.tsx`
* `src/renderer/src/pages/ProjectsPage.test.tsx`
* `src/renderer/src/pages/PhasesPage.tsx`
* `src/renderer/src/pages/PhasesPage.test.tsx`
* `src/renderer/src/components/phases/PhaseCard.tsx`
* `src/renderer/src/components/phases/PhaseForm.tsx`
* `src/renderer/src/components/phases/phaseStatusLabels.ts`
* `src/renderer/src/styles.css`
* `src/shared/schemas/phase.ts`
* `src/shared/schemas/project.ts`
* `src/shared/contracts/themeFactoryApi.ts`
* `src/preload/index.ts`
* `src/main/ipc/registerPhasesHandlers.ts`
* `src/main/database/repositories/phasesRepository.ts`
* les composants projets utilisés comme référence ;
* la configuration et les utilitaires de tests React.

Inspecte aussi le diff Git complet afin d’identifier tout fichier modifié non annoncé.

---

# 1. Règles de la review

Pendant cette première review :

* ne corrige aucun fichier applicatif ;
* ne modifie aucun test ;
* ne modifie aucun style ;
* ne crée aucune fonctionnalité ;
* ne commence ni la Phase 3.8 ni la Phase 4 ;
* ne crée aucun commit.

La seule création autorisée est :

`workflow/reports/REVIEW_PHASE_3.7.md`

Si un défaut est trouvé, décris la correction minimale à effectuer dans une étape ultérieure séparée.

---

# 2. Vérification du périmètre

Confirme que la Phase 3.7 se limite à :

* partager le projet actif de manière minimale ;
* afficher les phases du projet actif ;
* créer une phase ;
* modifier une phase ;
* supprimer une phase avec confirmation ;
* gérer les états chargement, vide et erreur ;
* ajouter les tests React correspondants ;
* adapter uniquement les styles nécessaires.

Vérifie l’absence de :

* tâches ;
* checklists ;
* réordonnancement avancé ;
* drag-and-drop ;
* journal d’activité ;
* tableau de bord ;
* nouvelle dépendance ;
* nouvelle bibliothèque de formulaire ;
* nouvelle bibliothèque de gestion d’état ;
* accès direct à Electron, Node.js ou SQLite depuis le renderer.

Signale toute modification hors périmètre, même si elle semble utile.

---

# 3. État du projet actif

Inspecte précisément la modification de `App.tsx` et de `ProjectsPage.tsx`.

Vérifie que :

* `App.tsx` constitue désormais l’unique source de vérité du projet actif ;
* `ProjectsPage` ne conserve pas une deuxième valeur locale concurrente ;
* `PhasesPage` reçoit exactement le projet actif détenu par `App.tsx` ;
* la sélection d’un projet est propagée correctement ;
* la modification du projet actif actualise aussi son nom et ses autres données ;
* la suppression du projet actif remet la valeur à `null` ;
* la disparition d’un projet de la liste provoque une réconciliation correcte ;
* aucune boucle de rendu ou de chargement n’est créée ;
* les dépendances des `useEffect`, `useCallback` et refs sont cohérentes ;
* `activeProjectRef` ne peut pas devenir désynchronisée avec la prop réelle ;
* le démontage et remontage des pages lors de la navigation ne provoquent pas de perte fonctionnelle inattendue.

Compare le comportement actuel de `ProjectsPage` avec celui d’avant la Phase 3.7 à partir du diff Git.

Signale toute régression possible du CRUD projets.

---

# 4. Chargement des phases

Inspecte le chargement dans `PhasesPage`.

Vérifie que :

* aucun appel à `listByProjectId` n’est fait sans projet actif ;
* l’identifiant transmis est celui du projet actif courant ;
* un changement de projet déclenche un nouveau chargement ;
* les phases de l’ancien projet sont retirées immédiatement ou masquées pendant le nouveau chargement ;
* l’état vide n’est pas affiché avant la résolution du chargement ;
* une erreur de chargement affiche un message compréhensible ;
* le bouton de nouvelle tentative relance le bon projet ;
* une réponse tardive correspondant à l’ancien projet ne peut pas remplacer les phases du nouveau projet ;
* une erreur tardive correspondant à l’ancien projet ne peut pas remplacer l’état du nouveau projet ;
* le composant ne met pas à jour son état après démontage.

Teste mentalement et dans les tests le scénario suivant :

1. le projet A est actif ;
2. son chargement est lent ;
3. le projet B devient actif ;
4. le chargement de B se termine ;
5. la réponse de A arrive ensuite.

Détermine si l’interface peut afficher les phases de A alors que B est actif.

Ce point doit être classé au minimum **Important** s’il n’existe aucune protection effective contre les réponses obsolètes.

---

# 5. Création d’une phase

Inspecte la construction exacte du payload de création.

Vérifie que :

* `projectId` provient exclusivement du projet actif ;
* aucun identifiant n’est saisi par l’utilisateur ;
* aucun UUID ou timestamp n’est généré dans le renderer ;
* `name` respecte la normalisation attendue ;
* les champs optionnels vides sont omis ou convertis selon le schéma partagé ;
* `description` utilise correctement `undefined` ou `null` selon le contrat ;
* `position` est omise lorsqu’elle n’est pas renseignée ;
* une valeur `0` reste valide et n’est pas considérée comme vide ;
* les nombres négatifs, décimaux, non finis ou invalides sont rejetés si le schéma les interdit ;
* le statut transmis appartient à `PHASE_STATUSES` ;
* le résultat retourné par l’API est utilisé comme source de vérité ;
* une création réussie ferme et réinitialise le formulaire ;
* une création échouée conserve les valeurs saisies ;
* une double soumission ne peut pas créer deux phases.

Vérifie aussi qu’un changement de projet actif pendant la création ne peut pas :

* insérer la phase créée dans la liste du nouveau projet ;
* fermer le formulaire du nouveau contexte ;
* afficher une erreur liée à l’ancien projet dans le nouveau contexte.

---

# 6. Modification d’une phase

Inspecte le formulaire en mode édition et le payload transmis à :

`window.themeFactoryApi.phases.update(id, input)`

Vérifie que :

* le formulaire est prérempli avec la bonne phase ;
* l’identifiant transmis correspond à la phase éditée ;
* `projectId` n’est jamais transmis ;
* les champs interdits tels que `id`, `createdAt` ou `updatedAt` ne sont jamais transmis ;
* les champs optionnels sont gérés conformément à `updatePhaseSchema` ;
* une description effacée peut réellement être mise à `null` si le modèle le permet ;
* une position laissée vide ne devient ni `0`, ni `NaN`, ni une chaîne vide ;
* une position explicitement définie à `0` reste transmise ;
* la mise à jour ne fabrique pas de valeurs artificielles ;
* le retour `null` est correctement géré sans fermer le formulaire ;
* le résultat retourné est utilisé pour actualiser la liste ;
* l’annulation ne déclenche aucun appel API ;
* les erreurs conservent le formulaire et les valeurs utilisateur.

Vérifie la stabilité lorsque la phase éditée disparaît de la liste ou lorsque le projet actif change pendant l’appel asynchrone.

---

# 7. Gestion des positions et ordre d’affichage

Le rapport indique que la page respecte l’ordre de l’API, mais trie localement les résultats après création et modification.

Inspecte ce comportement avec attention.

Vérifie que :

* le chargement initial conserve exactement l’ordre renvoyé par l’API ;
* le tri local utilise bien une copie et ne mute pas directement l’état précédent ;
* le tri est déterministe en cas de positions identiques ;
* le tri local reproduit exactement l’ordre garanti par le repository ;
* aucune position n’est recalculée dans le renderer ;
* le rang visuel « Phase 1 », « Phase 2 » correspond uniquement à l’ordre affiché ;
* la valeur technique `position` n’est pas confondue avec le rang visuel ;
* une modification de position replace correctement la phase ;
* une collision de position ne laisse pas l’interface dans un état incohérent ;
* une erreur SQLite brute n’est pas affichée de façon dangereuse ou incompréhensible.

Détermine si le tri local est nécessaire ou si un rechargement depuis l’API aurait été plus sûr. Ne demande pas une modification si le comportement actuel est exact et suffisamment couvert.

---

# 8. Suppression

Vérifie que :

* la confirmation contient le nom de la phase ;
* annuler n’appelle jamais l’API ;
* confirmer appelle `remove` une seule fois avec le bon identifiant ;
* le retour `true` retire uniquement la phase concernée ;
* le retour `false` conserve la phase et affiche une erreur ;
* une exception conserve la phase et affiche une erreur ;
* les actions incompatibles sont désactivées pendant la suppression ;
* la suppression d’une phase actuellement éditée est impossible ou correctement gérée ;
* un changement de projet pendant la suppression ne retire pas une phase de la liste du nouveau projet.

Inspecte la dépendance à `window.confirm` et vérifie que les tests la restaurent correctement entre les scénarios.

---

# 9. Gestion des mutations concurrentes

Analyse les mécanismes `isMountedRef`, états de mutation et fermetures asynchrones.

Vérifie que :

* les doubles clics sont réellement bloqués avant le second appel ;
* une mutation empêche les actions incompatibles ;
* les boutons sont réactivés après succès et après échec ;
* aucune promesse tardive ne peut modifier le mauvais projet ;
* `isMountedRef` protège bien contre le démontage ;
* le mécanisme protège aussi, ou non, contre un changement de projet actif sans démontage ;
* l’état de mutation est réinitialisé lors d’un changement de projet ;
* une mutation ancienne ne peut pas annuler cet état réinitialisé dans le nouveau contexte.

Le rapport identifie lui-même un risque de mutation en vol lors d’un changement de projet actif. Vérifie s’il s’agit :

* d’une simple observation théorique ;
* d’un défaut reproductible ;
* d’un défaut important nécessitant correction avant commit.

Construis, si nécessaire, un test ciblé temporaire dans ton raisonnement, mais ne modifie pas les fichiers pendant la review.

---

# 10. Formulaire et validation locale

Inspecte `PhaseForm.tsx`.

Vérifie :

* les types des props ;
* les valeurs initiales création/édition ;
* la synchronisation lors d’un changement de `initialPhase` ;
* les labels associés aux champs ;
* les messages de validation ;
* le fonctionnement clavier ;
* le bouton de soumission ;
* le bouton d’annulation ;
* la désactivation pendant soumission ;
* la transformation des chaînes optionnelles ;
* la conversion de la position ;
* l’absence de `any`, de cast dangereux ou d’assertion non justifiée ;
* la cohérence avec `createPhaseSchema` et `updatePhaseSchema`.

Teste particulièrement :

* nom composé uniquement d’espaces ;
* description vide ;
* description effacée pendant une édition ;
* position vide ;
* position `0` ;
* position négative ;
* position décimale ;
* saisie non numérique ;
* statut invalide injecté artificiellement.

Le renderer ne remplace pas la validation IPC, mais il ne doit pas envoyer sciemment des valeurs invalides lorsque celles-ci peuvent être détectées simplement.

---

# 11. Carte et accessibilité

Inspecte `PhaseCard.tsx`.

Vérifie que :

* le nom est affiché ;
* la description est conditionnelle ;
* le statut possède un libellé lisible ;
* le rang visuel est compréhensible ;
* les boutons Modifier et Supprimer sont distinguables pour chaque phase ;
* les `aria-label` contiennent correctement le nom de la phase ;
* les boutons sont accessibles au clavier ;
* les états désactivés sont cohérents ;
* aucun contenu utilisateur n’est injecté de manière dangereuse ;
* aucune propriété inexistante du schéma n’est utilisée.

---

# 12. Styles

Inspecte le diff de `styles.css`.

Vérifie que :

* les sélecteurs groupés ne modifient pas involontairement l’apparence des projets ;
* les styles phases n’écrasent pas des règles existantes ;
* aucun style global excessif n’est ajouté ;
* les formulaires restent lisibles ;
* les états chargement, erreur, vide et aucun projet actif sont distincts ;
* les boutons désactivés restent compréhensibles ;
* l’interface reste raisonnablement utilisable avec une fenêtre étroite ;
* les ajouts restent limités au périmètre.

Un changement CSS affectant les projets doit être considéré comme une possible régression et vérifié explicitement.

---

# 13. Tests de `PhasesPage`

Inspecte les 18 tests annoncés.

Vérifie qu’ils testent réellement :

* absence de projet actif ;
* absence d’appel API ;
* chargement ;
* absence d’état vide prématuré ;
* état vide ;
* ordre des phases ;
* erreur de chargement ;
* nouvelle tentative ;
* création ;
* payload exact ;
* omission de la position vide ;
* prévention de double soumission ;
* erreur de création ;
* préremplissage de modification ;
* payload exact de modification ;
* absence de `projectId` ;
* retour `null` ;
* annulation ;
* suppression annulée ;
* suppression réussie ;
* retour `false` ;
* exception ;
* changement de projet ;
* absence de fuite visuelle de l’ancien projet ;
* retour à l’état sans projet ;
* accessibilité des actions.

Ne te limite pas au nom des tests.

Vérifie que :

* les promesses contrôlées sont réellement en attente au moment des assertions ;
* les assertions attendent les mises à jour React nécessaires ;
* les tests ne passent pas grâce à une absence d’attente ;
* les mocks sont réinitialisés ;
* `window.confirm` est restauré ;
* aucun test n’utilise `any` ;
* aucun `.skip` ou `.only` n’existe ;
* les requêtes utilisent autant que possible rôles et labels accessibles ;
* le changement de projet est produit par un rerender réaliste ;
* un test protège contre une réponse obsolète de l’ancien projet ;
* un test couvre ou non une mutation en vol suivie d’un changement de projet.

L’absence de test sur une réponse obsolète doit être rapprochée de l’implémentation réelle avant d’être classée comme défaut.

---

# 14. Non-régression de `ProjectsPage`

Inspecte le harnais ajouté dans `ProjectsPage.test.tsx`.

Vérifie que :

* il reproduit fidèlement le state levé dans `App.tsx` ;
* il ne masque pas une différence entre le vrai parent et le harnais ;
* les 26 tests existants gardent les mêmes assertions ;
* aucun scénario n’a été supprimé ou affaibli ;
* le composant contrôlé fonctionne avec une prop `activeProject` mise à jour ;
* les callbacks du harnais provoquent les rerenders attendus ;
* le test ne donne pas artificiellement un comportement que `App.tsx` n’a pas.

Inspecte également si des tests de `App.tsx` existent.

S’ils existent, vérifie qu’ils couvrent le passage de la sélection des projets vers la page des phases.

S’ils n’existent pas, évalue si l’absence de test d’intégration renderer entre `App`, `ProjectsPage` et `PhasesPage` laisse un risque important non couvert.

---

# 15. Contrat API et séparation architecturale

Vérifie que `PhasesPage`, `PhaseForm` et `PhaseCard` :

* n’importent aucun module `main` ;
* n’importent pas Electron ;
* n’importent pas Node.js ;
* n’importent pas SQLite ;
* utilisent exclusivement `window.themeFactoryApi.phases` pour les mutations ;
* utilisent les types et constantes partagés sans dupliquer le modèle ;
* n’appellent pas `getById` inutilement ;
* ne contournent pas le preload.

Recherche dans les fichiers modifiés :

* `any`
* `unknown as`
* `@ts-ignore`
* `@ts-expect-error`
* `eslint-disable`
* `.skip`
* `.only`
* accès direct à `ipcRenderer`
* import depuis `src/main`

---

# 16. Validation automatisée indépendante

Exécute sans modifier le code :

```bash
npm run typecheck
npm run test
npm run build
```

Reporte les résultats exacts :

* statut ;
* nombre de fichiers de tests ;
* nombre total de tests ;
* éventuels avertissements ;
* tailles de build si elles sont pertinentes.

Compare les résultats au rapport de Phase 3.7.

Signale toute différence.

---

# 17. État Git

Exécute :

```bash
git status --short
git diff --stat
git diff --check
git diff
```

Vérifie notamment :

* tous les fichiers créés et modifiés ;
* l’existence de `workflow/prompts/PHASE_3.7_PROMPT.md` ;
* l’existence de `workflow/reports/RAPPORT_PHASE_3.7.md` ;
* l’absence de fichier `.txt` parasite à la racine ;
* l’absence de fichier généré ou temporaire ;
* l’absence de modification de dépendances ;
* l’absence d’erreur d’espacement signalée par `git diff --check`.

Rappelle que `git diff --stat` n’affiche pas les fichiers non suivis.

Compare l’état réel avec celui annoncé dans le rapport.

---

# 18. Validation manuelle

Ne considère pas les tests automatisés comme une validation visuelle complète.

Évalue la checklist manuelle du prompt de Phase 3.7.

Indique clairement les vérifications que l’utilisateur doit encore réaliser :

1. état sans projet actif ;
2. sélection d’un projet ;
3. état vide ;
4. création de deux phases ;
5. ordre visuel ;
6. modification ;
7. annulation de modification ;
8. annulation de suppression ;
9. suppression confirmée ;
10. persistance après redémarrage ;
11. changement de projet ;
12. absence de résidu visuel ;
13. absence d’erreur dans les consoles.

La review ne doit pas déclarer la Phase 3.7 prête à committer si la validation manuelle requise par le prompt n’a pas encore été confirmée par l’utilisateur, sauf si le verdict distingue explicitement :

* validation technique du code ;
* validation fonctionnelle manuelle restant à effectuer.

---

# 19. Classification des constats

Classe chaque constat dans une catégorie :

* **Bloquant** : empêche la validation technique ou révèle un risque de corruption/incohérence sérieuse ;
* **Important** : correction requise avant commit ou avant la Phase 3.8 ;
* **Mineur** : amélioration utile, non bloquante ;
* **Observation** : information ou risque futur sans action nécessaire immédiate.

Pour chaque constat, indique :

* fichier ;
* fonction ou zone ;
* problème précis ;
* scénario permettant de le reproduire ;
* impact ;
* correction minimale recommandée.

Ne propose pas de refonte générale.

---

# 20. Verdict

Termine par un seul verdict parmi :

## Verdict A — VALIDÉE TECHNIQUEMENT ET PRÊTE À COMMITTER

À utiliser uniquement si :

* aucun défaut bloquant ou important n’est présent ;
* les validations automatisées réussissent ;
* la validation manuelle obligatoire a été confirmée par l’utilisateur.

## Verdict B — VALIDÉE TECHNIQUEMENT, VALIDATION MANUELLE REQUISE

À utiliser si :

* aucun défaut bloquant ou important n’est présent ;
* les validations automatisées réussissent ;
* la checklist interactive n’a pas encore été confirmée.

Dans ce cas, ne déclare pas encore la phase définitivement clôturée.

## Verdict C — CORRECTIONS REQUISES

À utiliser si au moins un défaut bloquant ou important est identifié.

## Verdict D — REVIEW IMPOSSIBLE

À utiliser uniquement si des fichiers ou résultats indispensables sont absents.

Indique explicitement :

* si une correction applicative est nécessaire ;
* si une validation manuelle utilisateur est nécessaire ;
* si le commit peut être créé immédiatement.

---

# 21. Rapport obligatoire

Créer uniquement :

`workflow/reports/REVIEW_PHASE_3.7.md`

Le rapport doit contenir :

* fichiers inspectés ;
* résumé du diff ;
* conformité au périmètre ;
* analyse du projet actif ;
* analyse du chargement asynchrone ;
* analyse des mutations ;
* analyse des formulaires et positions ;
* analyse de la suppression ;
* analyse de l’accessibilité ;
* analyse des styles ;
* analyse des tests ;
* non-régression des projets ;
* résultats exacts de typecheck, tests et build ;
* état Git ;
* constats classés ;
* checklist manuelle restante ;
* verdict final ;
* décision explicite concernant le commit.

Ne modifie aucun autre fichier.

Ne crée aucun commit.

À la fin, affiche :

```bash
git status --short
git diff --stat
```

Puis fournis une synthèse avec :

1. le verdict ;
2. les défauts bloquants ou importants ;
3. les constats mineurs ;
4. les résultats des validations ;
5. la checklist manuelle restante ;
6. le chemin du rapport ;
7. la décision concernant le commit ;
8. la confirmation qu’aucun commit n’a été créé.
