# RE-REVIEW CIBLÉE DES CORRECTIONS — PHASE 3.7

Effectue une review indépendante et ciblée des corrections apportées après la review de la **Phase 3.7 — Interface de gestion des phases**.

## Documents à lire

Lis intégralement :

* `workflow/prompts/PHASE_3.7_PROMPT.md`
* `workflow/reports/RAPPORT_PHASE_3.7.md`
* `workflow/prompts/PHASE_3.7_REVIEW_PROMPT.md`
* `workflow/reports/REVIEW_PHASE_3.7.md`
* `workflow/prompts/PHASE_3.7_CORRECTIONS_PROMPT.md`
* `workflow/reports/RAPPORT_CORRECTIONS_REVIEW_PHASE_3.7.md`

Inspecte ensuite directement :

* `src/renderer/src/pages/PhasesPage.tsx`
* `src/renderer/src/pages/PhasesPage.test.tsx`
* `src/renderer/src/App.tsx`
* `src/renderer/src/pages/ProjectsPage.tsx`
* `workflow/reports/RAPPORT_PHASE_3.7.md`

La review doit vérifier les corrections dans le code réel. Ne considère pas le rapport de corrections comme une preuve suffisante.

---

## 1. Périmètre strict

Vérifie que les corrections se limitent à :

* protéger les chargements obsolètes ;
* protéger les mutations obsolètes ;
* réinitialiser les états de mutation au changement de projet ;
* ajouter les tests de non-régression ;
* corriger les inexactitudes documentaires ;
* supprimer le fichier parasite éventuel.

Confirme qu’aucune modification n’a été apportée à :

* preload ;
* handlers IPC ;
* repositories ;
* migrations ;
* schémas partagés ;
* tâches ;
* checklists ;
* Phase 3.8 ;
* Phase 4.

Ne corrige aucun fichier pendant cette review.

---

## 2. Référence du projet actif

Inspecte `activeProjectIdRef`.

Vérifie que :

* elle est initialisée avec l’identifiant courant ou `null` ;
* elle est mise à jour à chaque rendu ;
* elle ne peut pas conserver une valeur ancienne ;
* elle est disponible dans toutes les fermetures asynchrones ;
* elle n’introduit pas de dépendance incorrecte dans les hooks ;
* elle ne remplace pas la source de vérité détenue dans `App.tsx`.

Confirme que cette ref sert uniquement à vérifier la pertinence des opérations asynchrones.

---

## 3. Chargements obsolètes

Inspecte `loadPhases`.

Vérifie que les deux conditions suivantes sont contrôlées après l’attente :

```ts
isMountedRef.current
activeProjectIdRef.current === projectId
```

Contrôle séparément :

* la branche de succès ;
* la branche d’erreur.

Aucune des mises à jour suivantes ne doit être exécutée pour une requête obsolète :

* `setPhases`;
* `setLoadState` en succès ;
* `setLoadState` en erreur ;
* message d’erreur ;
* état vide.

Vérifie également que :

* le chargement de B reste autoritaire si A répond ensuite ;
* une erreur tardive de A ne masque pas le résultat de B ;
* une réponse obsolète est ignorée sans modifier l’interface.

---

## 4. Création obsolète

Inspecte la branche de création.

Vérifie que l’identifiant du projet est capturé avant l’appel API.

Après `await phases.create(...)`, aucune mise à jour ne doit avoir lieu si le projet actif a changé.

Contrôle précisément :

* ajout de la phase dans la liste ;
* tri local ;
* fermeture du formulaire ;
* message d’erreur ;
* état de soumission ;
* bloc `finally`.

Une phase créée pour A ne doit jamais apparaître dans B.

Une ancienne création ne doit jamais fermer un formulaire ouvert ensuite pour B.

Une ancienne erreur ne doit jamais apparaître dans B.

---

## 5. Modification obsolète

Inspecte la branche de modification.

Vérifie les mêmes protections pour :

* résultat valide ;
* retour `null` ;
* exception ;
* fermeture du formulaire ;
* mise à jour de la liste ;
* remise à zéro de l’état de soumission.

Le fait que les UUID soient uniques ne constitue pas une protection suffisante. Les mises à jour d’interface doivent être explicitement contextualisées.

---

## 6. Suppression obsolète

Inspecte la branche de suppression.

Vérifie que :

* l’identifiant du projet est capturé avant l’appel ;
* le retour `true` ne retire une phase que dans le bon projet ;
* le retour `false` ne crée pas d’erreur dans un nouveau contexte ;
* une exception obsolète est ignorée ;
* le `finally` ne réinitialise pas la suppression en cours du nouveau projet ;
* `deletingPhaseId` reste correct lorsque deux suppressions se succèdent sur des projets différents.

---

## 7. Changement de projet

Inspecte l’effet déclenché par `activeProjectId`.

Vérifie qu’il réinitialise :

* les phases ;
* le chargement ;
* le formulaire ;
* l’erreur du formulaire ;
* l’erreur de suppression ;
* la phase en suppression ;
* `isSubmittingForm`.

Le changement vers B doit rendre son interface immédiatement utilisable, même si une opération de A reste en attente.

Contrôle qu’une ancienne promesse ne peut pas annuler cette réinitialisation par son bloc `finally`.

---

## 8. Fonction de pertinence

Si une fonction locale telle que `isStillRelevant()` est utilisée, vérifie qu’elle teste exactement :

```ts
isMountedRef.current &&
activeProjectIdRef.current === mutationProjectId
```

Elle doit être utilisée avant chaque mise à jour d’état postérieure à un `await`.

Recherche explicitement toutes les occurrences de :

* `await window.themeFactoryApi.phases`
* `setPhases`
* `setFormState`
* `setFormErrorMessage`
* `setDeleteErrorMessage`
* `setIsSubmittingForm`
* `setDeletingPhaseId`

Confirme qu’aucune branche asynchrone n’a été oubliée.

---

## 9. Tests de concurrence

Inspecte les 5 tests ajoutés.

### Chargement inversé

Vérifie que :

* A reste réellement en attente ;
* B démarre avant la résolution de A ;
* B est résolu en premier ;
* A est résolu ensuite ;
* la phase de B reste visible ;
* la phase de A reste absente ;
* le nom du projet actif reste B.

### Erreur obsolète

Vérifie que :

* B s’affiche correctement ;
* A échoue après ;
* aucune erreur de A n’est visible ;
* les phases de B restent affichées.

### Création en vol

Vérifie que :

* la création de A est réellement en attente ;
* le composant passe à B avant résolution ;
* le bouton « Nouvelle phase » de B est actif ;
* la création tardive de A ne contamine pas B ;
* aucun formulaire de B n’est fermé par A.

### Erreur de mutation obsolète

Vérifie que :

* le rejet a lieu après le passage à B ;
* aucun message de A n’est affiché ;
* B reste utilisable.

### Suppressions concurrentes

Vérifie que :

* une suppression de A reste en attente ;
* une suppression de B commence ensuite ;
* la résolution de A ne réinitialise pas l’état de suppression de B ;
* B reste désactivé jusqu’à la résolution de sa propre suppression ;
* la phase de B n’est retirée qu’après la résolution de B.

Les tests doivent contrôler un véritable ordre asynchrone, pas seulement des rerenders séquentiels après résolution.

---

## 10. Non-régression des tests existants

Vérifie que :

* les 18 tests initiaux de `PhasesPage` n’ont pas été supprimés ;
* aucune assertion existante n’a été affaiblie ;
* les 15 tests de `ProjectsPage` restent inchangés dans leur logique ;
* aucun `.skip` ou `.only` n’existe ;
* aucun test ne dépend d’un délai réel ou d’un timing fragile ;
* les promesses contrôlées sont toujours résolues ou rejetées proprement ;
* aucun warning React `act(...)` n’est masqué.

---

## 11. Documentation

Inspecte `workflow/reports/RAPPORT_PHASE_3.7.md`.

Vérifie que :

* la base avant Phase 3.7 est correctement indiquée comme 325 tests ;
* `PhasesPage.test.tsx` contient désormais 23 tests ;
* le total final est 348 ;
* `ProjectsPage.test.tsx` est correctement indiqué comme contenant 15 tests ;
* les protections de concurrence sont documentées ;
* le risque ancien de mutation en vol n’est plus présenté comme non corrigé ;
* aucune nouvelle affirmation incorrecte n’a été introduite.

---

## 12. Fichier parasite

Vérifie que :

```text
RAPPORT_PHASE_3.7.txt
```

n’existe plus à la racine.

Vérifie également l’absence de :

* `REVIEW_PHASE_3.7.txt`
* fichiers temporaires ;
* copies de rapports hors `workflow/reports`.

Ne considère pas une mémoire ou préférence d’assistant comme une règle documentaire du dépôt.

---

## 13. Validations automatisées

Exécute :

```bash
npm run typecheck
npm run test
npm run build
```

Reporte les résultats exacts.

Le résultat attendu annoncé est :

* 19 fichiers de tests ;
* 348 tests réussis ;
* typecheck sans erreur ;
* build sans erreur.

Signale toute différence.

---

## 14. Git

Exécute :

```bash
git status --short
git diff --stat
git diff --check
git diff
```

Rappelle que les fichiers non suivis ne figurent pas dans `git diff --stat`.

Vérifie :

* tous les fichiers annoncés ;
* l’absence de fichier parasite ;
* l’absence de modification hors périmètre ;
* l’absence de changement de dépendance ;
* l’absence d’erreur d’espacement.

---

## 15. Classification

Classe chaque constat en :

* **Bloquant** ;
* **Important** ;
* **Mineur** ;
* **Observation**.

Pour chaque défaut éventuel, indique :

* fichier ;
* fonction ;
* scénario de reproduction ;
* impact ;
* correction minimale.

Ne propose pas de refonte.

---

## 16. Verdict

Termine par un verdict unique :

### Verdict A — CORRECTIONS VALIDÉES, VALIDATION MANUELLE REQUISE

À utiliser si :

* aucun défaut bloquant ou important ne subsiste ;
* les tests ciblés sont fiables ;
* typecheck, tests et build réussissent ;
* seule la validation interactive utilisateur reste à effectuer.

### Verdict B — CORRECTIONS INCOMPLÈTES

À utiliser si un défaut important ou bloquant subsiste.

### Verdict C — REVIEW IMPOSSIBLE

À utiliser uniquement si des fichiers nécessaires sont absents.

Indique clairement :

* si une nouvelle correction est nécessaire ;
* si la validation manuelle doit être effectuée ;
* si le commit doit attendre cette validation manuelle.

---

## 17. Rapport de re-review

Créer uniquement :

`workflow/reports/REVIEW_CORRECTIONS_PHASE_3.7.md`

Le rapport doit contenir :

* périmètre inspecté ;
* vérification des chargements ;
* vérification des trois mutations ;
* vérification des blocs `finally` ;
* analyse des 5 tests ;
* vérification documentaire ;
* résultats des validations ;
* état Git ;
* constats classés ;
* verdict ;
* checklist manuelle restante ;
* décision concernant le commit.

Ne modifie aucun autre fichier.

Ne crée aucun commit.

À la fin, affiche :

```bash
git status --short
git diff --stat
```

Puis résume :

1. le verdict ;
2. les défauts restants ;
3. le résultat des 5 tests ciblés ;
4. le résultat de la suite complète ;
5. la checklist manuelle ;
6. le chemin du rapport ;
7. la décision concernant le commit ;
8. la confirmation qu’aucun commit n’a été créé.
