# PHASE 3.8 — VALIDATION INTÉGRÉE PROJETS + PHASES

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

Le renderer React accède aux données uniquement par :

```ts
window.themeFactoryApi
```

SQLite et les repositories restent exclusivement dans le processus principal Electron.

## État actuel

Les sous-phases suivantes sont terminées, validées et commitées :

* Phase 3.1 — Schémas Zod et types partagés des projets ;
* Phase 3.2 — Repository des projets ;
* Phase 3.3 — IPC et API preload des projets ;
* Phase 3.4 — Interface CRUD des projets ;
* Phase 3.5 — Schémas et repository des phases ;
* Phase 3.6 — IPC et API preload des phases ;
* Phase 3.7 — Interface de gestion des phases.

Les interfaces projets et phases sont opérationnelles.

Le projet actif est partagé depuis `App.tsx`.

La page des phases permet :

* l’affichage des phases du projet actif ;
* la création ;
* la modification ;
* la suppression ;
* la gestion des états vide, chargement et erreur ;
* la protection contre les réponses asynchrones obsolètes ;
* la protection contre les mutations obsolètes lors d’un changement de projet.

Le dernier état validé comprend :

* `npm run typecheck` réussi ;
* `npm run test` réussi avec 348 tests ;
* `npm run build` réussi ;
* validation manuelle de la Phase 3.7 réussie ;
* Phase 3.7 commitée.

---

# Objectif

Valider de manière intégrée l’ensemble du module **Projets + Phases**.

Cette phase ne doit pas ajouter de nouvelle fonctionnalité métier importante.

Elle doit principalement :

* inspecter les parcours complets ;
* compléter les tests d’intégration manquants ;
* vérifier la persistance réelle ;
* vérifier les suppressions en cascade ;
* vérifier la navigation et le projet actif ;
* vérifier les états vides et les erreurs ;
* corriger uniquement les défauts détectés ;
* documenter la clôture de la Phase 3.

La Phase 3.8 est une phase de validation, de consolidation et de correction limitée.

Elle ne doit pas commencer le développement des tâches.

---

# 1. Inspection obligatoire avant modification

Avant toute modification, inspecter intégralement :

## Renderer

* `src/renderer/src/App.tsx`
* `src/renderer/src/pages/ProjectsPage.tsx`
* `src/renderer/src/pages/ProjectsPage.test.tsx`
* `src/renderer/src/pages/PhasesPage.tsx`
* `src/renderer/src/pages/PhasesPage.test.tsx`
* `src/renderer/src/components/projects/`
* `src/renderer/src/components/phases/`
* `src/renderer/src/navigation.ts`
* `src/renderer/src/styles.css`

## Contrats partagés

* `src/shared/contracts/ipcChannels.ts`
* `src/shared/contracts/themeFactoryApi.ts`
* `src/shared/schemas/project.ts`
* `src/shared/schemas/phase.ts`

## Main process

* `src/main/index.ts`
* `src/main/ipc/registerProjectsHandlers.ts`
* `src/main/ipc/registerProjectsHandlers.integration.test.ts`
* `src/main/ipc/registerPhasesHandlers.ts`
* `src/main/ipc/registerPhasesHandlers.integration.test.ts`
* `src/main/database/repositories/projectsRepository.ts`
* `src/main/database/repositories/projectsRepository.test.ts`
* `src/main/database/repositories/phasesRepository.ts`
* `src/main/database/repositories/phasesRepository.test.ts`
* les migrations définissant `projects` et `phases`

## Preload

* `src/preload/index.ts`
* `src/preload/index.test.ts`

## Documentation

* tous les prompts et rapports des Phases 3.1 à 3.7 ;
* les décisions ou conventions pertinentes du dépôt.

Commencer par dresser un état précis de la couverture existante avant d’ajouter des tests.

Ne pas dupliquer des tests déjà suffisamment couverts.

---

# 2. Périmètre de validation

La Phase 3.8 doit valider les parcours suivants :

## Projets

* état vide ;
* création ;
* modification ;
* suppression annulée ;
* suppression confirmée ;
* sélection du projet actif ;
* perte ou suppression du projet actif ;
* persistance après redémarrage.

## Phases

* état sans projet actif ;
* état vide pour un projet actif ;
* création ;
* modification ;
* suppression annulée ;
* suppression confirmée ;
* ordre par position ;
* changement de projet actif ;
* absence de fuite de données entre projets ;
* persistance après redémarrage.

## Intégration projets + phases

* sélectionner un projet puis afficher ses phases ;
* changer de projet et charger les bonnes phases ;
* supprimer le projet actif ;
* vérifier que ses phases sont supprimées en cascade ;
* vérifier que l’interface revient à l’état sans projet actif ;
* vérifier que les phases des autres projets restent intactes ;
* vérifier le comportement après redémarrage.

---

# 3. Tests d’intégration renderer

Évaluer la nécessité de créer un test d’intégration autour de `App.tsx`.

Le rapport de re-review de la Phase 3.7 signalait l’absence d’un test couvrant le câblage réel :

```text
App.tsx → ProjectsPage → projet actif → PhasesPage
```

Créer si pertinent :

```text
src/renderer/src/App.test.tsx
```

ou un fichier de test d’intégration renderer au nom cohérent avec le dépôt.

## Scénario minimum attendu

Le test doit utiliser l’application ou le composant racine réel autant que possible.

Il doit vérifier :

1. rendre l’application ;
2. ouvrir la page Projets ;
3. charger une liste contenant au moins deux projets ;
4. sélectionner le projet A ;
5. naviguer vers « Phases et tâches » ;
6. vérifier que `phases.listByProjectId` est appelé avec l’identifiant de A ;
7. afficher les phases de A ;
8. revenir vers Projets ;
9. sélectionner le projet B ;
10. revenir vers Phases ;
11. vérifier que l’API est appelée avec B ;
12. vérifier que les phases de A ne sont plus visibles ;
13. vérifier que les phases de B sont affichées.

Le test doit utiliser le vrai câblage de `App.tsx`.

Ne pas reconstruire artificiellement le state partagé dans un harnais si l’objectif est précisément de tester son intégration réelle.

## Suppression du projet actif

Ajouter un scénario si cela reste raisonnable :

1. sélectionner le projet A ;
2. ouvrir ses phases ;
3. revenir sur Projets ;
4. supprimer A ;
5. vérifier que le projet actif est remis à `null` ;
6. revenir sur Phases ;
7. vérifier l’état demandant de sélectionner un projet ;
8. vérifier qu’aucun appel de liste des phases n’est fait sans projet actif.

Éviter de rendre ce test excessivement dépendant du HTML interne.

Utiliser les rôles, libellés et textes accessibles.

---

# 4. Tests d’intégration main et SQLite

Analyser les tests d’intégration existants des projets et des phases.

Créer ou compléter un test d’intégration couvrant conjointement les repositories et la cascade SQLite.

Le scénario doit utiliser :

* une vraie base SQLite temporaire ou en mémoire ;
* les migrations réelles ;
* le vrai repository des projets ;
* le vrai repository des phases.

## Scénario de cascade obligatoire

1. créer deux projets : A et B ;
2. créer plusieurs phases pour A ;
3. créer au moins une phase pour B ;
4. vérifier les listes initiales ;
5. supprimer le projet A via le repository projets ou le handler IPC réel, selon la stratégie d’intégration existante ;
6. vérifier que le projet A n’existe plus ;
7. vérifier que toutes les phases de A ont disparu ;
8. vérifier que le projet B existe toujours ;
9. vérifier que les phases de B sont intactes.

Ce test doit démontrer réellement la contrainte :

```sql
ON DELETE CASCADE
```

Ne pas simuler la cascade avec des mocks.

## Persistance

Si les tests existants utilisent uniquement `:memory:`, évaluer l’ajout d’un test avec un fichier SQLite temporaire :

1. créer une base temporaire ;
2. exécuter les migrations ;
3. créer un projet et ses phases ;
4. fermer correctement la base ;
5. rouvrir le même fichier ;
6. relancer les migrations ;
7. vérifier que le projet et ses phases existent toujours ;
8. supprimer le fichier temporaire à la fin.

Ce test doit rester déterministe et correctement nettoyer :

* le fichier principal ;
* les éventuels fichiers `-wal` ;
* les éventuels fichiers `-shm`.

Ne pas créer un test lourd si une couverture équivalente existe déjà. Documenter honnêtement la décision.

---

# 5. Validation des états vides

Vérifier les états suivants dans les tests et dans l’application :

## Aucun projet

* la page Projets affiche un état vide ;
* la page Phases demande de sélectionner un projet ;
* aucune méthode `phases.listByProjectId` n’est appelée.

## Projet sans phase

* le projet actif est clairement affiché ;
* la page affiche un état vide spécifique aux phases ;
* l’action de création est disponible.

## Projet supprimé

Après suppression du projet actif :

* le projet actif passe à `null` ;
* aucune ancienne phase ne reste affichée ;
* aucune nouvelle requête n’est faite avec l’ancien identifiant ;
* revenir sur la page Phases affiche l’état sans projet actif.

---

# 6. Validation des erreurs

Inspecter les tests existants avant d’ajouter de nouveaux cas.

Vérifier au minimum :

## Projets

* erreur de chargement ;
* erreur de création ;
* erreur de modification ;
* suppression retournant `false` ;
* exception de suppression.

## Phases

* erreur de chargement ;
* erreur de création ;
* mise à jour retournant `null` ;
* suppression retournant `false` ;
* exception de suppression.

## Intégration

Vérifier qu’une erreur sur les phases :

* ne désélectionne pas le projet actif ;
* ne casse pas la navigation ;
* ne supprime pas les données déjà affichées sans raison ;
* permet une nouvelle tentative.

Ne pas ajouter des dizaines de tests unitaires redondants si les cas sont déjà couverts.

Ajouter seulement les scénarios transversaux manquants.

---

# 7. Validation de l’ordre des phases

Vérifier que l’ordre est cohérent sur toute la chaîne :

```text
SQLite
→ phasesRepository
→ handler IPC
→ preload
→ PhasesPage
```

Confirmer que :

* le repository trie selon la règle définie ;
* le handler ne retrie pas ;
* le preload ne transforme pas ;
* le chargement initial du renderer conserve l’ordre ;
* le tri local après création ou modification est cohérent ;
* l’ordre persiste après redémarrage.

Ajouter un test intégré uniquement si la chaîne complète n’est pas déjà suffisamment démontrée par les tests existants.

Ne pas implémenter de drag-and-drop ou de réordonnancement transactionnel.

---

# 8. Validation du projet actif

Vérifier dans `App.tsx` et les tests que :

* le projet actif est unique ;
* il est partagé entre les pages ;
* son objet complet est actualisé après modification ;
* sa suppression le remet à `null` ;
* sa disparition après rechargement le remet à `null` ;
* changer d’onglet ne sélectionne pas un autre projet ;
* changer de projet recharge les bonnes phases ;
* aucune réponse asynchrone obsolète ne peut réafficher les phases précédentes.

Ne pas introduire de Context React ou de nouvelle bibliothèque de state management.

---

# 9. Corrections autorisées

Si un défaut réel est détecté pendant la validation, effectuer uniquement une correction minimale.

Corrections autorisées :

* garde asynchrone oubliée ;
* état non réinitialisé ;
* mauvais identifiant transmis ;
* erreur de navigation ;
* cascade non respectée à cause d’une erreur existante ;
* test manquant révélant un vrai défaut ;
* message d’état incorrect ;
* petite incohérence de typage ;
* nettoyage incorrect d’une base temporaire de test.

Toute correction doit :

* être documentée ;
* être couverte par un test de non-régression ;
* rester dans le périmètre projets + phases ;
* ne pas anticiper la Phase 4.

---

# 10. Périmètre interdit

Ne pas implémenter :

* les tâches ;
* les checklists ;
* les prompts Claude Code associés aux tâches ;
* les critères d’acceptation des tâches ;
* les commandes de validation des tâches ;
* le drag-and-drop ;
* le réordonnancement transactionnel avancé ;
* les questions ;
* les problèmes ;
* les décisions ;
* le tableau de bord réel ;
* le journal d’activité ;
* les exports ;
* une nouvelle architecture de navigation ;
* un Context React global ;
* Redux, Zustand ou autre gestionnaire d’état ;
* React Query ou bibliothèque équivalente ;
* de nouvelle dépendance sans nécessité absolue ;
* une refonte visuelle ;
* une modification du schéma SQLite sans défaut démontré ;
* une fonctionnalité de Phase 4.

---

# 11. Qualité des tests

Les tests ajoutés doivent :

* être déterministes ;
* utiliser des données clairement identifiées ;
* nettoyer leurs ressources ;
* ne pas dépendre de délais réels ;
* utiliser des promesses contrôlées si nécessaire ;
* éviter les assertions faibles ;
* vérifier les appels exacts ;
* vérifier l’absence d’appel lorsque nécessaire ;
* ne contenir ni `.skip` ni `.only` ;
* ne masquer aucun avertissement React ;
* ne pas utiliser `any` injustifié ;
* ne pas recréer artificiellement l’implémentation testée.

Privilégier quelques tests intégrés à forte valeur plutôt qu’un grand nombre de tests redondants.

---

# 12. Validation automatisée

À la fin, exécuter dans cet ordre :

```bash
npm run typecheck
npm run test
npm run build
```

Si une commande échoue :

1. analyser la cause réelle ;
2. corriger uniquement ce qui est nécessaire ;
3. relancer la commande concernée ;
4. relancer ensuite toute la séquence.

Interdictions :

* `skipLibCheck` ;
* `@ts-ignore` ;
* `@ts-expect-error` injustifié ;
* `.skip` ;
* `.only` ;
* suppression ou affaiblissement de tests ;
* changement de configuration destiné à masquer une erreur.

---

# 13. Validation manuelle obligatoire

Lancer :

```bash
npm run dev
```

Puis préparer une validation manuelle complète.

L’utilisateur doit vérifier dans l’application réelle :

## Parcours projets

1. démarrer avec l’application ;
2. constater l’état actuel des projets ;
3. créer un projet A ;
4. créer un projet B ;
5. modifier le projet A ;
6. sélectionner A comme projet actif ;
7. vérifier l’indication visuelle du projet actif.

## Parcours phases

8. ouvrir « Phases et tâches » ;
9. vérifier l’état vide de A ;
10. créer deux phases pour A ;
11. modifier une phase ;
12. vérifier leur ordre ;
13. revenir sur Projets ;
14. sélectionner B ;
15. revenir sur Phases ;
16. vérifier que les phases de A ne sont pas affichées ;
17. créer une phase pour B.

## Cascade

18. revenir sur Projets ;
19. supprimer le projet A ;
20. confirmer la suppression ;
21. vérifier que le projet actif est remis à zéro si A était actif ;
22. vérifier que les phases de A ne sont plus accessibles ;
23. vérifier que le projet B et sa phase existent toujours.

## Persistance

24. fermer complètement l’application ;
25. relancer l’application ;
26. vérifier que B existe ;
27. vérifier que la phase de B existe ;
28. vérifier que A et ses phases restent supprimés.

## Consoles

29. vérifier l’absence d’erreur dans la console du main process ;
30. vérifier l’absence d’erreur dans la console renderer.

Claude Code ne doit pas déclarer cette validation interactive réussie sans confirmation explicite de l’utilisateur.

---

# 14. Rapport obligatoire

Créer :

```text
workflow/reports/RAPPORT_PHASE_3.8.md
```

Le rapport doit contenir :

## Résumé

* objectif ;
* périmètre ;
* résultat ;
* statut.

## Inspection initiale

* couverture existante ;
* lacunes identifiées ;
* tests finalement ajoutés ;
* tests jugés inutiles car déjà couverts.

## Tests d’intégration renderer

Décrire :

* le câblage `App.tsx` ;
* la sélection du projet actif ;
* la navigation vers les phases ;
* le changement de projet ;
* la suppression du projet actif.

## Tests SQLite

Décrire :

* cascade ;
* persistance ;
* ordre ;
* nettoyage des ressources temporaires.

## Corrections éventuelles

Pour chaque correction :

* défaut ;
* impact ;
* fichier ;
* correction minimale ;
* test de non-régression.

S’il n’y a aucune correction, l’indiquer clairement.

## Résultats automatisés

Reporter les résultats exacts de :

```bash
npm run typecheck
npm run test
npm run build
```

Inclure :

* nombre de fichiers de tests ;
* nombre total de tests ;
* avertissements éventuels ;
* résultat du build.

## Validation manuelle

Distinguer :

* ce que Claude Code a vérifié techniquement ;
* ce que l’utilisateur doit confirmer ;
* les résultats communiqués par l’utilisateur.

## État final de la Phase 3

Indiquer si :

* les projets sont validés ;
* les phases sont validées ;
* l’intégration est validée ;
* la Phase 3 peut être clôturée ;
* la Phase 4 peut être préparée.

## Git

Ne créer aucun commit.

Afficher :

```bash
git status --short
git diff --stat
git diff --check
```

---

# 15. Revue finale éventuelle

Si des fichiers applicatifs sont modifiés ou si des tests importants sont ajoutés, recommander une review indépendante avant commit.

Si la phase ne fait qu’ajouter des tests d’intégration et qu’aucun défaut n’est détecté, une review courte reste recommandée pour confirmer la couverture et l’état Git.

Ne créer aucun prompt de Phase 4 pendant cette implémentation.

---

# 16. Livrable final Claude Code

À la fin, afficher :

1. le statut de la Phase 3.8 ;
2. les fichiers créés et modifiés ;
3. les lacunes de couverture identifiées ;
4. les tests intégrés ajoutés ;
5. les éventuels défauts corrigés ;
6. le résultat exact du typecheck ;
7. le résultat exact des tests ;
8. le résultat exact du build ;
9. le résultat technique de `npm run dev` ;
10. la checklist manuelle restant à confirmer ;
11. le chemin du rapport ;
12. l’état Git ;
13. la confirmation qu’aucun commit n’a été créé ;
14. la recommandation concernant une review avant commit.

Ne commence pas la Phase 4.

---

# Critères d’acceptation

La Phase 3.8 est acceptée uniquement si :

* le parcours intégré projets → phases est testé ou validé ;
* le projet actif est correctement partagé ;
* changer de projet charge les bonnes phases ;
* supprimer le projet actif remet l’état à `null` ;
* la suppression d’un projet supprime ses phases en cascade ;
* les autres projets et phases restent intacts ;
* la persistance après fermeture/réouverture est validée ;
* l’ordre des phases reste cohérent ;
* les états vides sont corrects ;
* les erreurs ne cassent pas la navigation ;
* aucun accès direct à SQLite n’est ajouté au renderer ;
* aucune fonctionnalité de Phase 4 n’est développée ;
* tous les tests réussissent ;
* le typecheck réussit ;
* le build réussit ;
* l’application démarre ;
* la validation manuelle est documentée honnêtement ;
* `workflow/reports/RAPPORT_PHASE_3.8.md` est créé ;
* aucun commit n’est créé automatiquement.
