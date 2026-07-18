# Corrections ciblées — Phase 4.1

## Contexte

La Phase 4.1 a créé :

* `src/shared/schemas/task.ts`
* `src/shared/schemas/task.test.ts`
* `workflow/prompts/PHASE_4.1_PROMPT.md`
* `workflow/reports/RAPPORT_PHASE_4.1.md`

La validation actuelle réussit avec :

* typecheck réussi ;
* 22 fichiers de tests réussis ;
* 425 tests réussis ;
* build réussi.

Aucun commit ni push n’a été effectué.

L’état Git actuel confirmé est :

```text
?? src/shared/schemas/task.test.ts
?? src/shared/schemas/task.ts
?? workflow/prompts/PHASE_4.1_PROMPT.md
?? workflow/reports/RAPPORT_PHASE_4.1.md
```

Effectuer uniquement les corrections ciblées décrites ci-dessous.

## 1. Retirer la valeur par défaut applicative du statut

Le rapport indique que la colonne SQLite `tasks.status` :

* est obligatoire ;
* ne possède aucun `DEFAULT` SQL ;
* ne dispose d’aucune valeur par défaut explicitement définie par le contrat métier.

Pourtant, `createTaskSchema` applique actuellement :

```ts
taskStatusSchema.default('backlog')
```

Cette valeur par défaut a été déduite par analogie avec les projets et les phases, alors que le prompt initial demandait de ne gérer des valeurs par défaut que lorsqu’elles étaient explicitement définies par la base ou le contrat.

Corriger `createTaskSchema` afin que `status` soit obligatoire :

```ts
status: taskStatusSchema
```

Ne modifier ni la liste des statuts ni `taskStatusSchema`.

Ne créer aucune nouvelle décision d’architecture et ne modifier aucune migration.

## 2. Adapter les tests

Mettre à jour les tests de `createTaskSchema`.

Ils doivent maintenant vérifier que :

* une création minimale valide inclut obligatoirement `status` et `priority` ;
* une création sans `status` est rejetée ;
* une création sans `priority` reste rejetée ;
* une création avec `status: 'backlog'` est acceptée ;
* une création complète valide reste acceptée ;
* tous les autres comportements déjà couverts restent inchangés.

Supprimer ou modifier tout test affirmant que `'backlog'` est automatiquement injecté.

Ne réduire aucune autre couverture existante.

## 3. Corriger le nombre de colonnes dans le rapport

Le rapport affirme actuellement que la table et le schéma complet comportent 16 colonnes, alors que la liste présentée en contient 17 :

1. `id`
2. `projectId`
3. `phaseId`
4. `title`
5. `description`
6. `status`
7. `priority`
8. `claudePrompt`
9. `affectedFiles`
10. `acceptanceCriteria`
11. `validationCommands`
12. `validationResults`
13. `notes`
14. `gitCommit`
15. `position`
16. `createdAt`
17. `updatedAt`

Corriger toutes les occurrences concernées dans :

```text
workflow/reports/RAPPORT_PHASE_4.1.md
```

Le rapport doit indiquer **17 colonnes**.

## 4. Corriger la section sur les valeurs par défaut

Mettre à jour le rapport pour préciser :

* `status` ne possède aucune valeur par défaut dans `createTaskSchema` ;
* `status` est obligatoire à la création ;
* `priority` reste obligatoire et sans valeur par défaut ;
* `position` reste optionnelle, conformément au `DEFAULT 0` SQL et à la responsabilité future du repository.

Supprimer l’ancienne justification fondée sur l’analogie avec les projets et les phases.

## 5. Corriger la section Git du rapport

La sortie réelle confirmée de `git status --short` est exactement :

```text
?? src/shared/schemas/task.test.ts
?? src/shared/schemas/task.ts
?? workflow/prompts/PHASE_4.1_PROMPT.md
?? workflow/reports/RAPPORT_PHASE_4.1.md
```

Mettre à jour le rapport avec cette sortie.

Supprimer toute phrase affirmant que des fichiers des Phases 3.8 sont encore non suivis.

Ne pas ajouter le présent prompt de correction à la sortie Git historique du rapport, puisque cette section doit documenter l’état observé avant la correction.

## Périmètre strict

Ne modifier que :

```text
src/shared/schemas/task.ts
src/shared/schemas/task.test.ts
workflow/reports/RAPPORT_PHASE_4.1.md
```

Le fichier du prompt de correction est créé manuellement par l’utilisateur et ne doit pas être réécrit.

Ne modifier aucun autre fichier.

En particulier :

* aucune migration ;
* aucun repository ;
* aucun handler IPC ;
* aucun contrat preload ;
* aucun composant React ;
* aucune dépendance ;
* aucun script npm ;
* aucune refactorisation hors périmètre.

## Validation obligatoire

Exécuter dans cet ordre :

```bash
npm run typecheck
npm run test
npm run build
```

Puis exécuter :

```bash
git diff --check
git status --short
git diff --stat
```

Tous les tests existants doivent continuer à réussir.

Le nombre total de tests peut rester identique ou évoluer légèrement selon l’adaptation des cas, mais aucune couverture métier importante ne doit être supprimée.

## Mise à jour du rapport

Mettre à jour `workflow/reports/RAPPORT_PHASE_4.1.md` avec :

* la nouvelle obligation de fournir `status` à la création ;
* les tests corrigés ;
* les résultats exacts de validation ;
* le nombre final exact de tests ;
* les 17 colonnes ;
* la sortie Git correcte ;
* la confirmation qu’aucun commit et aucun push n’ont été effectués.

Ne créer aucun nouveau rapport de correction.

## Interdictions Git

Ne pas exécuter :

* `git add`
* `git commit`
* `git push`

Ne pas changer de branche.
