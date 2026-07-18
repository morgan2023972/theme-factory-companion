# Revue indépendante — Phase 4.1 : Schémas Zod et types partagés des tâches

## Contexte

Tu travailles dans le dépôt **Theme Factory Companion**.

La Phase 4.1 a été implémentée puis corrigée. Elle concerne uniquement les schémas Zod, les constantes et les types TypeScript partagés des tâches.

État annoncé avant cette revue :

* branche active : `main` ;
* aucun commit ni push effectué pour la Phase 4.1 ;
* `npm run typecheck` réussi ;
* `npm run test` réussi ;
* 22 fichiers de tests réussis ;
* 427 tests réussis ;
* `npm run build` réussi ;
* `git diff --check` sans erreur.

Fichiers actuellement non suivis :

```text
?? src/shared/schemas/task.test.ts
?? src/shared/schemas/task.ts
?? workflow/prompts/PHASE_4.1_CORRECTIONS_PROMPT.md
?? workflow/prompts/PHASE_4.1_PROMPT.md
?? workflow/prompts/PHASE_4.1_REVIEW_PROMPT.md
?? workflow/reports/RAPPORT_PHASE_4.1.md
```

Cette intervention est une **revue indépendante**.

Tu ne dois pas modifier le code pendant cette étape.

## Objectif

Auditer l’implémentation de la Phase 4.1 afin de déterminer si elle peut être validée et commitée telle quelle.

La revue doit rechercher activement :

* les erreurs fonctionnelles ;
* les incohérences entre Zod, TypeScript et SQLite ;
* les écarts au périmètre ;
* les validations insuffisantes ou excessives ;
* les erreurs de nullabilité ;
* les mauvaises valeurs par défaut ;
* les divergences avec les conventions des projets et des phases ;
* les tests manquants ou trompeurs ;
* les erreurs documentaires importantes ;
* les risques pour la future Phase 4.2.

Ne te contente pas de résumer le rapport existant. Vérifie directement le code et les sources de vérité du dépôt.

## Interdictions

Pendant cette revue :

* ne modifie aucun fichier ;
* ne crée aucun fichier avant d’avoir terminé l’audit ;
* ne corrige aucun défaut ;
* ne lance pas de formatage automatique ;
* ne lance pas `git add` ;
* ne lance pas `git commit` ;
* ne lance pas `git push` ;
* ne change pas de branche ;
* ne modifie pas les dépendances ;
* ne modifie pas les scripts npm.

La seule création autorisée à la fin est le rapport de revue demandé.

## Sources à inspecter obligatoirement

Lire au minimum :

```text
src/shared/schemas/task.ts
src/shared/schemas/task.test.ts
src/shared/schemas/project.ts
src/shared/schemas/project.test.ts
src/shared/schemas/phase.ts
src/shared/schemas/phase.test.ts
workflow/prompts/PHASE_4.1_PROMPT.md
workflow/prompts/PHASE_4.1_CORRECTIONS_PROMPT.md
workflow/reports/RAPPORT_PHASE_4.1.md
```

Identifier et lire également :

* la migration qui crée la table `tasks` ;
* les contraintes SQL exactes de `tasks` ;
* la documentation du modèle de données ;
* les éventuels utilitaires ou schémas partagés réutilisés pour les UUID, timestamps ou chaînes ;
* la configuration TypeScript et Vitest uniquement si nécessaire pour interpréter correctement les tests.

## Méthode de revue obligatoire

### 1. Vérifier le périmètre Git

Exécuter :

```bash
git status --short
git diff --check
git diff --stat
```

Puis inspecter les fichiers non suivis de la Phase 4.1.

Vérifier qu’aucun fichier applicatif hors périmètre n’a été créé ou modifié.

### 2. Vérifier le contrat SQLite

Comparer chaque propriété de `taskSchema` avec la table `tasks`.

Contrôler précisément :

* le nombre réel de colonnes ;
* les noms SQL ;
* les noms TypeScript en camelCase ;
* les types ;
* les contraintes `NOT NULL` ;
* les colonnes nullable ;
* les contraintes `CHECK` ;
* les valeurs par défaut SQL ;
* les clés étrangères ;
* les comportements `ON DELETE` ;
* la position ;
* les timestamps.

Signaler toute propriété :

* manquante ;
* ajoutée sans correspondance SQL ;
* incorrectement nullable ;
* incorrectement obligatoire ;
* utilisant une validation incompatible avec SQLite.

### 3. Vérifier les statuts

Confirmer que :

```text
backlog
ready
in_progress
to_validate
blocked
completed
cancelled
```

correspondent exactement à la migration.

Vérifier :

* la constante readonly ;
* `z.enum` ;
* le type inféré ;
* l’absence de duplication inutile ;
* les tests de chaque valeur autorisée ;
* le rejet des valeurs inconnues.

### 4. Vérifier les priorités

Confirmer que :

```text
low
medium
high
critical
```

correspondent exactement à la migration.

Vérifier les mêmes points que pour les statuts.

### 5. Vérifier le schéma complet

Auditer `taskSchema`.

Contrôler notamment :

* `id` ;
* `projectId` ;
* `phaseId` ;
* `title` ;
* `description` ;
* `status` ;
* `priority` ;
* `claudePrompt` ;
* `affectedFiles` ;
* `acceptanceCriteria` ;
* `validationCommands` ;
* `validationResults` ;
* `notes` ;
* `gitCommit` ;
* `position` ;
* `createdAt` ;
* `updatedAt`.

Vérifier que les **17 propriétés** correspondent exactement aux **17 colonnes** de la table.

Contrôler également :

* la validation UUID ;
* la validation ISO datetime ;
* le caractère strict du schéma ;
* le traitement des champs texte nullable ;
* le titre vide ;
* le titre composé uniquement d’espaces ;
* la position entière et non négative.

### 6. Vérifier le schéma de création

Auditer `createTaskSchema`.

Confirmer que :

* `id` est exclu ;
* `createdAt` est exclu ;
* `updatedAt` est exclu ;
* `projectId` est obligatoire ;
* `phaseId` est optionnel et nullable si SQLite l’autorise ;
* `title` est obligatoire ;
* `status` est obligatoire ;
* `priority` est obligatoire ;
* aucune valeur par défaut non contractuelle n’est appliquée ;
* `position` est optionnelle uniquement si cela est cohérent avec le `DEFAULT 0` SQL ou la convention existante ;
* les champs texte nullable sont correctement représentés ;
* les propriétés inconnues sont rejetées.

Vérifier particulièrement qu’aucun `.default('backlog')` ne subsiste.

### 7. Vérifier le schéma de mise à jour

Auditer `updateTaskSchema`.

Confirmer que :

* seuls les champs métier réellement modifiables sont présents ;
* `id` est interdit ;
* `projectId` est interdit si le déplacement entre projets n’est pas prévu ;
* `createdAt` et `updatedAt` sont interdits ;
* `phaseId: null` permet de détacher une tâche de sa phase ;
* les autres champs sont optionnels ;
* un objet vide est refusé ;
* un objet ne contenant que des valeurs `undefined` est refusé ;
* une mise à jour contenant au moins une valeur définie est acceptée ;
* les propriétés inconnues sont rejetées.

Vérifier si la logique `.partial().refine(...)` présente un cas limite ou un comportement inattendu.

### 8. Vérifier les types TypeScript

Contrôler les types exportés.

Ils doivent être inférés depuis Zod et couvrir au minimum :

* tâche complète ;
* création ;
* mise à jour ;
* statut ;
* priorité.

Vérifier :

* l’absence d’interfaces manuelles redondantes ;
* l’absence de `any` ;
* l’absence de casts injustifiés ;
* la pertinence de `z.infer` ou `z.input` selon les transformations et valeurs par défaut réellement présentes ;
* la cohérence des noms avec `project.ts` et `phase.ts`.

### 9. Auditer les tests

Ne pas se limiter au nombre de tests.

Vérifier que les tests prouvent réellement le comportement attendu.

Rechercher notamment :

* des tests qui passent pour une mauvaise raison ;
* plusieurs invalidités présentes dans le même payload, masquant la cause réelle du rejet ;
* des assertions trop faibles ;
* des tests dupliqués sans valeur ;
* des branches non couvertes ;
* des divergences entre le nom du test et ce qui est réellement testé.

Contrôler au minimum la couverture de :

* tous les statuts ;
* toutes les priorités ;
* tâche complète valide ;
* `phaseId` UUID et `null` ;
* création minimale valide ;
* création complète valide ;
* absence de `status` ;
* absence de `priority` ;
* titre vide ;
* titre composé d’espaces ;
* UUID invalides ;
* statuts et priorités invalides ;
* position négative ;
* position décimale ;
* timestamps invalides ;
* propriétés inconnues ;
* champs système à la création ;
* mise à jour partielle ;
* mise à jour vide ;
* mise à jour uniquement avec `undefined` ;
* détachement de phase avec `null` ;
* tentative de modification de `projectId` ;
* tentative de modification de `id` et des timestamps.

### 10. Vérifier le rapport de phase

Comparer `workflow/reports/RAPPORT_PHASE_4.1.md` avec le code réel et les sorties de commandes.

Contrôler :

* les 17 colonnes ;
* les statuts ;
* les priorités ;
* la nullabilité de `phaseId` ;
* l’absence de valeur par défaut pour `status` ;
* l’absence de valeur par défaut pour `priority` ;
* le traitement de `position` ;
* le nombre réel de tests ;
* le nombre réel de fichiers de tests ;
* l’état Git ;
* l’absence de commit et de push ;
* les limites annoncées pour la Phase 4.2.

Toute erreur documentaire doit être classée selon son impact réel.

## Validation automatique

Après l’inspection statique, exécuter :

```bash
npm run typecheck
npm run test
npm run build
```

Puis :

```bash
git diff --check
git status --short
git diff --stat
```

Ne corrige rien si une commande échoue.

Documente précisément l’échec dans le rapport de revue.

## Classification des constats

Classer chaque constat dans une des catégories suivantes :

### Bloquant

Empêche la validation ou le commit de la Phase 4.1.

Exemples :

* contrat partagé incompatible avec SQLite ;
* erreur TypeScript ;
* test en échec ;
* build en échec ;
* champ obligatoire mal modélisé ;
* nullabilité incorrecte ;
* valeur par défaut métier inventée ;
* modification hors périmètre importante.

### Majeur

Doit normalement être corrigé avant le commit, même si les validations automatiques réussissent.

Exemples :

* comportement métier incorrect non détecté par les tests ;
* test important manquant ;
* schéma de mise à jour permettant une opération interdite ;
* type exporté incorrect ;
* documentation trompeuse sur le contrat.

### Mineur

Correction souhaitable mais ne remettant pas en cause le fonctionnement principal.

Exemples :

* nom peu clair ;
* commentaire imprécis ;
* test redondant ;
* petite erreur documentaire sans impact contractuel.

### Suggestion

Amélioration facultative, non nécessaire pour clôturer la phase.

Ne transforme pas une préférence stylistique en défaut.

## Verdict attendu

Le rapport doit conclure par un verdict unique parmi :

```text
VALIDÉE
VALIDÉE AVEC RÉSERVES MINEURES
CORRECTIONS REQUISES
REJETÉE
```

Règles :

* `VALIDÉE` : aucun défaut bloquant, majeur ou mineur significatif ;
* `VALIDÉE AVEC RÉSERVES MINEURES` : uniquement des défauts mineurs ne nécessitant pas de nouvelle implémentation substantielle ;
* `CORRECTIONS REQUISES` : au moins un défaut bloquant ou majeur corrigeable dans le périmètre ;
* `REJETÉE` : implémentation fondamentalement non conforme ou validations essentielles impossibles.

Ne recommande pas un commit si le verdict est `CORRECTIONS REQUISES` ou `REJETÉE`.

## Rapport à créer

Créer uniquement :

```text
workflow/reports/REVIEW_PHASE_4.1.md
```

Le rapport doit contenir :

1. le verdict ;
2. un résumé exécutif ;
3. le périmètre réellement inspecté ;
4. la comparaison avec la table SQLite ;
5. la revue des statuts et priorités ;
6. la revue de `taskSchema` ;
7. la revue de `createTaskSchema` ;
8. la revue de `updateTaskSchema` ;
9. la revue des types exportés ;
10. la revue détaillée des tests ;
11. la revue du rapport de phase ;
12. les constats classés par sévérité ;
13. les résultats exacts de :

    * `npm run typecheck`
    * `npm run test`
    * `npm run build`
    * `git diff --check`
14. le nombre exact de fichiers et tests réussis ;
15. la sortie exacte de `git status --short` ;
16. les risques éventuels pour la Phase 4.2 ;
17. la recommandation finale :

    * prêt à committer ;
    * corrections ciblées nécessaires ;
    * reprise plus large nécessaire.

Pour chaque défaut, fournir :

* la sévérité ;
* le fichier ;
* la zone ou le symbole concerné ;
* le comportement observé ;
* le comportement attendu ;
* l’impact ;
* la correction minimale recommandée.

## Sortie finale dans le terminal

À la fin, afficher un résumé court contenant :

* le verdict ;
* le nombre de constats bloquants ;
* le nombre de constats majeurs ;
* le nombre de constats mineurs ;
* le résultat des validations ;
* le chemin du rapport créé ;
* la confirmation qu’aucun fichier applicatif n’a été modifié ;
* la confirmation qu’aucun commit ni push n’a été effectué.
