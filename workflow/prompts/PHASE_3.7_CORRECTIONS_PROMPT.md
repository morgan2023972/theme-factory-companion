# CORRECTIONS APRÈS REVIEW — PHASE 3.7

Corrige uniquement les défauts confirmés par la review indépendante de la **Phase 3.7 — Interface de gestion des phases**.

## Documents obligatoires à lire

Lis intégralement :

* `workflow/prompts/PHASE_3.7_PROMPT.md`
* `workflow/reports/RAPPORT_PHASE_3.7.md`
* `workflow/prompts/PHASE_3.7_REVIEW_PROMPT.md`
* `workflow/reports/REVIEW_PHASE_3.7.md`

Inspecte ensuite directement :

* `src/renderer/src/pages/PhasesPage.tsx`
* `src/renderer/src/pages/PhasesPage.test.tsx`
* `src/renderer/src/App.tsx`
* `src/renderer/src/pages/ProjectsPage.tsx`
* `src/shared/schemas/phase.ts`

## Verdict de la review

La review a conclu :

**Verdict C — CORRECTIONS REQUISES**

Deux défauts importants doivent être corrigés avant commit :

1. les réponses tardives de `listByProjectId` peuvent afficher les phases d’un ancien projet ;
2. les mutations en vol peuvent modifier l’état visuel après un changement de projet actif.

La correction doit rester limitée à ces problèmes et à leurs tests de non-régression.

Ne commence pas la Phase 3.8.

---

# 1. Protection contre les chargements obsolètes

## Défaut

Le scénario suivant est actuellement possible :

1. le projet A est actif ;
2. `listByProjectId(A)` démarre et reste en attente ;
3. le projet B devient actif ;
4. `listByProjectId(B)` démarre et se résout ;
5. les phases de B sont affichées ;
6. la réponse de A arrive ensuite ;
7. les phases de A remplacent incorrectement celles de B.

`isMountedRef` protège uniquement contre le démontage du composant. Il ne protège pas contre un changement de projet actif lorsque `PhasesPage` reste monté.

## Correction attendue

Ajouter dans `PhasesPage.tsx` une référence contenant l’identifiant courant du projet actif.

Exemple conceptuel :

```ts
const activeProjectIdRef = useRef<string | null>(activeProject?.id ?? null)
activeProjectIdRef.current = activeProject?.id ?? null
```

Adapter le code aux conventions du composant.

Pour chaque appel de chargement lancé pour un `projectId`, avant toute mise à jour d’état après l’opération asynchrone, vérifier que :

```ts
activeProjectIdRef.current === projectId
```

Cette vérification doit être effectuée :

* avant `setPhases(...)` ;
* avant le passage à l’état `loaded` ;
* avant l’affichage d’une erreur ;
* avant toute autre mise à jour provenant de cette requête.

Une réponse ou erreur obsolète doit être ignorée silencieusement.

Conserver également la protection `isMountedRef`.

## Contraintes

* ne pas annuler artificiellement une requête IPC si l’API actuelle ne le permet pas ;
* ne pas ajouter de dépendance ;
* ne pas ajouter de gestionnaire global de requêtes ;
* ne pas modifier le preload ou les handlers IPC ;
* ne pas refondre entièrement le chargement.

---

# 2. Protection contre les mutations obsolètes

## Défaut

Une création, modification ou suppression lancée pour le projet A peut se terminer après le passage au projet B.

Cela peut notamment :

* insérer dans la liste de B une phase créée pour A ;
* fermer un formulaire ouvert pour B ;
* afficher dans B une erreur appartenant à A ;
* conserver `isSubmittingForm` actif dans B jusqu’à la résolution de l’opération de A ;
* modifier des états de suppression appartenant à l’ancien contexte.

## Principe obligatoire

Chaque mutation doit capturer l’identifiant du projet actif au moment de son démarrage.

Après chaque `await`, avant toute mise à jour d’état, vérifier simultanément :

```ts
isMountedRef.current
```

et :

```ts
activeProjectIdRef.current === mutationProjectId
```

Si le projet actif ne correspond plus au projet de la mutation :

* ne pas modifier `phases` ;
* ne pas fermer le formulaire courant ;
* ne pas afficher d’erreur ;
* ne pas modifier un état appartenant au nouveau projet ;
* terminer silencieusement le traitement obsolète.

## Création

Lors du lancement de la création :

* capturer l’identifiant du projet actif ;
* conserver cet identifiant dans le payload de création ;
* après résolution, ajouter la phase à l’état local uniquement si ce même projet est encore actif ;
* après erreur, afficher l’erreur uniquement si ce même projet est encore actif ;
* fermer le formulaire uniquement si ce même projet est encore actif.

Une phase créée pour A ne doit jamais être ajoutée à la liste affichée pour B.

## Modification

Lors du lancement de la modification :

* capturer l’identifiant du projet actif ;
* après résolution, mettre à jour la liste uniquement si ce projet est encore actif ;
* fermer le formulaire uniquement si ce projet est encore actif ;
* afficher un retour `null` ou une exception uniquement dans le contexte correspondant.

Même si les UUID empêchent généralement de modifier une phase de B par erreur, la fermeture d’un formulaire ou l’affichage d’une erreur obsolète doit aussi être empêché.

## Suppression

Lors du lancement de la suppression :

* capturer l’identifiant du projet actif ;
* retirer la phase de la liste uniquement si ce projet est encore actif ;
* afficher `false` ou une exception uniquement dans le contexte correspondant ;
* ne pas écraser l’état de suppression du nouveau projet.

---

# 3. Réinitialisation lors du changement de projet

Dans l’effet exécuté lorsque le projet actif change, vérifier que tous les états appartenant à l’ancien contexte sont réinitialisés de façon cohérente.

Cela comprend au minimum :

* `phases` ;
* l’état de chargement ;
* le formulaire ;
* les erreurs du formulaire ;
* les erreurs de suppression ;
* l’identifiant de phase en cours de suppression ;
* `isSubmittingForm`.

Ajouter explicitement :

```ts
setIsSubmittingForm(false)
```

si cet état n’est actuellement pas remis à zéro.

Le nouveau projet ne doit pas hériter d’un état de mutation appartenant à l’ancien projet.

## Attention au `finally`

Une ancienne mutation peut exécuter son bloc `finally` après le changement de projet.

Le `finally` ne doit pas modifier les états du nouveau contexte sans vérifier que le projet de la mutation est toujours actif.

Ne pas se contenter de remettre `isSubmittingForm` à `false` sans contrôle après chaque promesse : la mise à jour doit rester contextualisée.

---

# 4. Tests de non-régression obligatoires

Compléter :

`src/renderer/src/pages/PhasesPage.test.tsx`

Ne pas créer un deuxième fichier de test sauf nécessité réelle.

Utiliser des promesses contrôlées manuellement afin de maîtriser l’ordre de résolution.

## Test 1 — Réponse de chargement obsolète

Créer un scénario avec deux projets A et B :

1. rendre `PhasesPage` avec A ;
2. conserver `listByProjectId(A)` en attente ;
3. rerendre avec B ;
4. conserver ou résoudre `listByProjectId(B)` ;
5. résoudre B en premier avec une phase B ;
6. vérifier que la phase B est affichée ;
7. résoudre ensuite A avec une phase A ;
8. vérifier que la phase B reste affichée ;
9. vérifier que la phase A n’apparaît jamais ;
10. vérifier que l’en-tête indique toujours B.

Ce test doit échouer sur l’implémentation précédant la correction.

## Test 2 — Erreur de chargement obsolète

Ajouter, si cela reste raisonnablement compact, un scénario dans lequel :

1. A charge ;
2. le projet actif passe à B ;
3. B se charge correctement ;
4. A échoue ensuite ;
5. l’erreur de A n’est pas affichée dans le contexte de B ;
6. les phases de B restent visibles.

Ce test peut être séparé ou regroupé avec le test précédent uniquement si les assertions restent claires.

## Test 3 — Création en vol suivie d’un changement de projet

Créer le scénario suivant :

1. afficher A ;
2. ouvrir le formulaire de création ;
3. soumettre une création dont la promesse reste en attente ;
4. vérifier que la soumission est en cours ;
5. rerendre avec B avant la résolution ;
6. vérifier que l’état de B est chargé correctement ;
7. vérifier que le bouton « Nouvelle phase » de B n’est pas bloqué par la mutation de A ;
8. résoudre tardivement la création de A ;
9. vérifier que la phase créée pour A n’apparaît pas dans la liste de B ;
10. vérifier qu’aucun formulaire ou message de B n’est fermé ou remplacé par la résolution de A.

## Test 4 — Erreur de mutation obsolète

Ajouter au minimum un scénario démontrant qu’une erreur tardive d’une création effectuée pour A ne s’affiche pas après le passage à B.

Le test doit vérifier que :

* le message d’erreur de A est absent ;
* B reste utilisable ;
* le bouton « Nouvelle phase » de B est actif.

## Tests modification et suppression

Il n’est pas obligatoire de créer un test complet séparé pour chaque mutation si la protection utilisée est centralisée, claire et identique.

Cependant, inspecter et tester suffisamment le code pour garantir que :

* modification ;
* suppression ;
* création

utilisent toutes la vérification du projet courant avant leurs mises à jour d’état.

Si la logique reste répétée dans chaque handler, ajouter au moins un test ciblé supplémentaire sur modification ou suppression afin d’éviter qu’une branche soit oubliée.

---

# 5. Préservation des comportements existants

Les 18 tests existants de `PhasesPage` doivent continuer à réussir.

Ne pas affaiblir ou supprimer leurs assertions.

Les tests doivent continuer à couvrir :

* absence de projet actif ;
* chargement ;
* état vide ;
* création ;
* modification ;
* suppression ;
* retour `null` ;
* retour `false` ;
* accessibilité ;
* changement normal de projet.

Les tests de `ProjectsPage` doivent également continuer à réussir.

---

# 6. Correction documentaire du rapport de Phase 3.7

Corriger dans :

`workflow/reports/RAPPORT_PHASE_3.7.md`

la section relative au nombre de tests.

La base correcte avant la Phase 3.7 était :

* 18 fichiers de tests ;
* 325 tests réussis.

La Phase 3.7 ajoute :

* 1 fichier de test ;
* 18 tests.

Le total correct est donc :

* 19 fichiers ;
* 343 tests.

`ProjectsPage.test.tsx` contient 15 tests, pas 26.

Corriger uniquement les phrases inexactes. Ne réécrire pas inutilement tout le rapport.

Après les corrections, actualiser aussi les sections pertinentes pour indiquer :

* la protection contre les réponses obsolètes ;
* la protection contre les mutations obsolètes ;
* les nouveaux tests de concurrence ;
* le nouveau nombre total de tests.

---

# 7. Fichier parasite à la racine

Inspecter :

`RAPPORT_PHASE_3.7.txt`

La structure documentaire prévue pour ce projet place les rapports dans :

`workflow/reports/`

Sauf règle explicite réellement trouvée dans les documents du dépôt imposant une copie `.txt` à la racine, supprimer ce fichier parasite.

Ne pas inventer une convention non documentée.

Après suppression, vérifier qu’aucun autre rapport `.txt` temporaire ou parasite lié à la Phase 3.7 n’existe à la racine.

---

# 8. Rapport de corrections

Créer :

`workflow/reports/RAPPORT_CORRECTIONS_REVIEW_PHASE_3.7.md`

Le rapport doit contenir :

## Résumé

* défauts corrigés ;
* approche choisie ;
* statut final.

## Fichiers modifiés

Liste exacte.

## Protection des chargements

Expliquer :

* la référence utilisée pour identifier le projet courant ;
* les vérifications réalisées après les opérations asynchrones ;
* le comportement d’une réponse obsolète.

## Protection des mutations

Expliquer séparément :

* création ;
* modification ;
* suppression ;
* réinitialisation des états lors d’un changement de projet.

## Tests ajoutés

Décrire les scénarios de concurrence ajoutés :

* résolution inversée A/B ;
* erreur de chargement obsolète ;
* création en vol ;
* erreur de mutation obsolète ;
* éventuel test modification ou suppression.

## Documentation

Mentionner la correction du nombre de tests dans `RAPPORT_PHASE_3.7.md`.

## Fichier parasite

Indiquer si `RAPPORT_PHASE_3.7.txt` a été supprimé et sur quelle base.

## Validation

Reporter les résultats exacts de :

```bash
npm run typecheck
npm run test
npm run build
```

## Validation manuelle

Indiquer clairement que la validation interactive utilisateur reste obligatoire après les corrections.

## Git

Afficher :

```bash
git status --short
git diff --stat
git diff --check
```

Ne créer aucun commit.

---

# 9. Validation automatisée

Exécuter dans cet ordre :

```bash
npm run typecheck
npm run test
npm run build
```

Si une commande échoue :

1. identifier la cause réelle ;
2. corriger uniquement ce qui est nécessaire ;
3. relancer la commande ;
4. relancer ensuite toute la séquence.

Interdictions :

* `any` injustifié ;
* `@ts-ignore` ;
* `@ts-expect-error` injustifié ;
* `skipLibCheck` ;
* `.skip` ;
* `.only` ;
* suppression ou affaiblissement de tests ;
* modification de configuration destinée à masquer une erreur.

---

# 10. Validation manuelle après corrections

Lancer :

```bash
npm run dev
```

Claude Code doit uniquement confirmer ce qu’il peut réellement observer techniquement.

La validation interactive doit ensuite être réalisée par l’utilisateur, notamment :

1. créer ou sélectionner le projet A ;
2. ouvrir la page des phases ;
3. créer et modifier des phases ;
4. changer vers un projet B ;
5. vérifier que les phases affichées correspondent toujours au projet actif ;
6. vérifier que le bouton « Nouvelle phase » n’est jamais bloqué après un changement normal de projet ;
7. vérifier création, modification et suppression ;
8. redémarrer l’application ;
9. vérifier la persistance ;
10. vérifier l’absence d’erreur dans les consoles.

Ne pas déclarer ces interactions validées uniquement grâce aux tests.

---

# 11. Périmètre interdit

Ne pas profiter de cette correction pour :

* ajouter les tâches ;
* ajouter les checklists ;
* ajouter du drag-and-drop ;
* implémenter le réordonnancement transactionnel ;
* refondre `App.tsx` ;
* introduire un contexte React global ;
* ajouter une bibliothèque de requêtes ;
* modifier le preload ;
* modifier les handlers IPC ;
* modifier les repositories ;
* modifier les migrations ;
* traiter les fonctionnalités de Phase 3.8 ;
* effectuer une refonte CSS.

Le message d’erreur SQLite brut sur collision de position est un constat mineur. Ne le corriger que si cela peut être fait en quelques lignes, sans fragilité et sans élargir le périmètre. Il peut rester documenté pour une phase future.

---

# 12. Critères d’acceptation

Les corrections sont acceptées uniquement si :

* une réponse tardive de A ne peut plus remplacer les phases de B ;
* une erreur tardive de A ne peut plus apparaître dans B ;
* une création tardive pour A ne peut plus ajouter une phase dans B ;
* une mutation ancienne ne peut plus fermer un formulaire de B ;
* une mutation ancienne ne peut plus afficher une erreur dans B ;
* changer de projet réinitialise correctement `isSubmittingForm` ;
* le bouton « Nouvelle phase » du nouveau projet n’est pas bloqué par une mutation de l’ancien projet ;
* les protections couvrent création, modification et suppression ;
* les tests reproduisent réellement les résolutions inversées ;
* les tests reproduisent réellement une mutation en vol suivie d’un changement de projet ;
* les anciens tests restent intacts ;
* le rapport de Phase 3.7 contient les nombres corrects ;
* le fichier `.txt` parasite est supprimé sauf règle contraire réellement prouvée ;
* `npm run typecheck` réussit ;
* `npm run test` réussit ;
* `npm run build` réussit ;
* le rapport de corrections est créé ;
* aucun commit n’est créé.

---

# 13. Livrable final Claude Code

À la fin, afficher :

1. les deux défauts importants corrigés ;
2. la stratégie utilisée contre les réponses obsolètes ;
3. la stratégie utilisée contre les mutations obsolètes ;
4. les tests ajoutés ;
5. le nouveau total de tests ;
6. le résultat exact du typecheck ;
7. le résultat exact des tests ;
8. le résultat exact du build ;
9. le traitement de `RAPPORT_PHASE_3.7.txt` ;
10. le chemin du rapport de corrections ;
11. la checklist manuelle restante ;
12. `git status --short` ;
13. `git diff --stat` ;
14. la confirmation qu’aucun commit n’a été créé.

Ne commence pas la Phase 3.8.
