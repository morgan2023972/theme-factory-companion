# Phase 4.1 — Schémas Zod et types partagés des tâches

## Contexte

Tu travailles dans le dépôt **Theme Factory Companion**.

La Phase 3 est terminée, validée, commitée et poussée sur la branche `main`.

État de départ confirmé :

* Git et GitHub opérationnels ;
* dépôt public ;
* branche active : `main` ;
* modules Projets et Phases terminés ;
* 352 tests réussis avant le démarrage de cette phase ;
* architecture Electron / React / TypeScript / Vite / SQLite ;
* séparation stricte entre `main`, `preload`, `renderer` et `shared` ;
* SQLite accessible uniquement depuis le main process ;
* validation des entrées avec Zod ;
* aucune erreur TypeScript ne doit être masquée.

La Phase 4 concerne la gestion des tâches et des checklists.

Cette intervention porte uniquement sur la **Phase 4.1 : schémas Zod et types TypeScript partagés des tâches**.

## Objectif

Créer les constantes, schémas Zod et types TypeScript partagés nécessaires pour représenter, créer et modifier une tâche.

Cette phase ne doit contenir aucune logique SQLite, aucun repository, aucun handler IPC, aucune API preload et aucune interface React.

## Étape préalable obligatoire

Avant toute modification :

1. inspecter l’arborescence du dépôt ;
2. lire les schémas existants des projets et des phases ;
3. lire leurs tests ;
4. lire la migration SQLite qui crée la table `tasks` ;
5. lire la documentation du modèle de données ;
6. identifier précisément :

   * les colonnes actuelles de `tasks` ;
   * les contraintes `NOT NULL` ;
   * les valeurs autorisées par les contraintes `CHECK` ;
   * les valeurs par défaut ;
   * les relations avec `projects` et `phases` ;
   * les champs nullable ;
   * le format des timestamps ;
   * les conventions de nommage déjà utilisées.

Ne suppose aucun champ qui ne serait pas présent dans le schéma SQLite ou dans la documentation validée.

Le contrat partagé doit rester cohérent avec la base existante.

## Périmètre autorisé

Créer ou modifier uniquement les fichiers strictement nécessaires dans la couche `shared`, ainsi que leurs tests.

Emplacements attendus, à confirmer selon l’organisation réelle du dépôt :

```text
src/shared/schemas/task.ts
src/shared/schemas/task.test.ts
```

Un fichier d’export partagé existant peut être ajusté uniquement si cela est nécessaire pour exposer proprement les nouveaux schémas ou types.

Ne pas modifier d’autres couches.

## Travail demandé

### 1. Constante et schéma des statuts

Définir la liste des statuts de tâche en cohérence exacte avec la contrainte SQLite existante.

La roadmap prévoit les statuts suivants :

```text
backlog
ready
in_progress
to_validate
blocked
completed
cancelled
```

Vérifier leur correspondance avec la migration avant de les implémenter.

Créer :

* une constante readonly exploitable par TypeScript ;
* un schéma Zod basé sur cette constante ;
* un type TypeScript inféré.

Conserver une seule source de vérité pour les valeurs autorisées.

### 2. Constante et schéma des priorités

Lire la migration et la documentation pour identifier les priorités réellement autorisées.

Créer :

* une constante readonly ;
* un schéma Zod ;
* un type TypeScript inféré.

Ne pas inventer de valeurs supplémentaires.

### 3. Identifiants

Les identifiants de tâche, projet et phase doivent suivre les conventions déjà utilisées dans les schémas existants.

Réutiliser les schémas partagés existants lorsqu’ils sont déjà adaptés.

Ne pas dupliquer inutilement une validation UUID déjà centralisée.

Le rattachement à un projet doit correspondre à la contrainte réelle de la table.

Le rattachement à une phase doit respecter précisément la nullabilité définie dans SQLite.

### 4. Schéma complet d’une tâche

Créer un schéma représentant une tâche complète telle qu’elle est renvoyée par la couche de persistance.

Il doit refléter exactement les colonnes existantes de la table `tasks`.

Selon le schéma réel, cela peut inclure notamment :

* `id` ;
* `projectId` ;
* `phaseId` ;
* `title` ;
* `description` ;
* `status` ;
* `priority` ;
* `position` ;
* les champs détaillés prévus pour le pilotage du travail ;
* `createdAt` ;
* `updatedAt`.

Les noms de propriétés TypeScript doivent respecter les conventions déjà adoptées dans les schémas `project` et `phase`.

Ne pas ajouter un champ uniquement parce qu’il apparaît dans la roadmap si la table SQLite actuelle ne le contient pas.

### 5. Validation des chaînes

Appliquer des validations cohérentes avec les schémas existants.

Au minimum :

* le titre ne doit pas accepter une chaîne vide ou uniquement composée d’espaces ;
* les champs obligatoires doivent être réellement obligatoires ;
* les champs facultatifs ou nullable doivent correspondre au schéma SQLite ;
* ne pas appliquer silencieusement de transformation de données sans convention existante ;
* les limites de longueur éventuelles doivent provenir d’une règle déjà documentée ou existante.

Éviter toute survalidation arbitraire.

### 6. Position

Créer une validation de la position cohérente avec la table et avec le modèle des phases.

La position doit être un entier valide.

Déterminer à partir du code existant si la valeur minimale autorisée est `0` ou `1`.

Ne pas choisir arbitrairement.

### 7. Timestamps

Valider `createdAt` et `updatedAt` selon la même convention que les projets et les phases.

Réutiliser les schémas existants lorsqu’ils sont prévus pour cela.

Les dates doivent rester compatibles avec les timestamps ISO produits par les repositories.

### 8. Schéma de création

Créer un schéma dédié aux données acceptées lors de la création d’une tâche.

Ce schéma doit :

* exclure les champs générés par le système, comme l’identifiant et les timestamps ;
* contenir le rattachement au projet ;
* gérer le rattachement éventuel à une phase ;
* respecter les champs obligatoires et facultatifs ;
* gérer les valeurs par défaut uniquement lorsqu’elles sont explicitement définies par le contrat ou la base ;
* empêcher les propriétés inconnues si telle est la convention des schémas existants.

Ne pas déplacer dans le schéma partagé une responsabilité qui appartient au futur repository.

### 9. Schéma de mise à jour

Créer un schéma dédié à la mise à jour d’une tâche.

Il doit suivre les conventions déjà appliquées aux projets et aux phases.

Contraintes attendues :

* l’identifiant ne doit pas être modifiable dans les données de mise à jour ;
* les timestamps ne doivent pas être modifiables directement ;
* les champs métier modifiables doivent être optionnels ;
* le rattachement à une phase doit pouvoir être supprimé si la base autorise `NULL` ;
* les valeurs invalides doivent être rejetées ;
* un objet de mise à jour vide doit être accepté ou refusé selon la convention déjà retenue dans les modules précédents.

Ne change pas cette convention sans justification.

### 10. Types TypeScript

Exporter des types inférés depuis les schémas Zod.

Les noms doivent suivre les conventions du dépôt.

Prévoir au minimum les équivalents de :

* tâche complète ;
* données de création ;
* données de mise à jour ;
* statut ;
* priorité.

Éviter de maintenir manuellement des interfaces qui dupliquent les schémas Zod.

## Tests obligatoires

Créer des tests unitaires complets avec Vitest.

Les tests doivent couvrir au minimum :

### Statuts

* chaque statut autorisé est accepté ;
* une valeur inconnue est rejetée.

### Priorités

* chaque priorité autorisée est acceptée ;
* une valeur inconnue est rejetée.

### Tâche complète valide

* une tâche complète valide est acceptée ;
* les identifiants respectent le format attendu ;
* les timestamps valides sont acceptés ;
* une phase absente ou nulle est gérée conformément à la base.

### Création

* une création minimale valide est acceptée ;
* une création complète valide est acceptée ;
* un titre vide est rejeté ;
* un titre uniquement composé d’espaces est rejeté ;
* un statut invalide est rejeté ;
* une priorité invalide est rejetée ;
* un identifiant de projet invalide est rejeté ;
* un identifiant de phase invalide est rejeté ;
* une position décimale est rejetée ;
* une position négative est rejetée si elle est interdite ;
* les champs système sont refusés ou ignorés conformément à la convention existante.

### Mise à jour

* une mise à jour valide d’un seul champ est acceptée ;
* une mise à jour de plusieurs champs est acceptée ;
* une valeur invalide est rejetée ;
* la suppression du rattachement à une phase est testée si elle est autorisée ;
* l’objet vide est testé selon la convention existante ;
* l’identifiant et les timestamps ne peuvent pas être modifiés.

### Propriétés inconnues

Tester explicitement le comportement retenu pour les propriétés inconnues afin qu’il reste cohérent avec les autres schémas partagés.

## Contraintes techniques

* utiliser Zod ;
* utiliser l’inférence TypeScript de Zod ;
* conserver une seule source de vérité pour les enums ;
* ne pas utiliser `any` ;
* ne pas utiliser de cast destiné uniquement à faire taire TypeScript ;
* ne pas ajouter `skipLibCheck` ;
* ne pas modifier les contraintes SQLite ;
* ne pas créer de migration ;
* ne pas ajouter de dépendance ;
* ne pas modifier les scripts npm ;
* ne pas modifier le main process ;
* ne pas modifier le preload ;
* ne pas modifier le renderer ;
* ne pas créer de repository ;
* ne pas créer de handler IPC ;
* ne pas anticiper les checklists ;
* ne pas effectuer de refactorisation hors périmètre.

## Cohérence avec l’existant

Prendre les fichiers des projets et des phases comme références principales pour :

* la structure des exports ;
* le nom des constantes ;
* le nom des schémas ;
* le nom des types ;
* les validations UUID ;
* les validations ISO datetime ;
* le comportement des schémas de mise à jour ;
* le comportement envers les clés inconnues ;
* l’organisation des tests.

Privilégier la cohérence du dépôt plutôt qu’une préférence personnelle.

## Validation obligatoire

Après l’implémentation, exécuter dans cet ordre :

```bash
npm run typecheck
npm run test
npm run build
```

Ne pas masquer une erreur.

Si une commande échoue :

1. analyser la cause exacte ;
2. appliquer uniquement une correction liée à la Phase 4.1 ;
3. relancer la commande concernée ;
4. relancer ensuite toute la chaîne de validation.

Les 352 tests existants doivent continuer à réussir, auxquels s’ajouteront les nouveaux tests de cette phase.

## Vérification Git

À la fin, exécuter :

```bash
git status --short
git diff --check
git diff --stat
```

Ne pas committer.

Ne pas pousser.

Ne pas modifier la branche.

## Rapport attendu

Créer le fichier :

```text
workflow/reports/RAPPORT_PHASE_4.1.md
```

Le rapport doit contenir :

1. un résumé de l’implémentation ;
2. les fichiers créés ;
3. les fichiers modifiés ;
4. les statuts retenus ;
5. les priorités retenues ;
6. les champs exacts du schéma complet ;
7. la nullabilité de `phaseId` ;
8. les choix concernant les valeurs par défaut ;
9. le comportement du schéma de mise à jour vide ;
10. le comportement envers les propriétés inconnues ;
11. les tests ajoutés ;
12. les résultats exacts du typecheck, des tests et du build ;
13. le nombre final de fichiers et de tests Vitest réussis ;
14. les éventuels écarts entre la roadmap et le schéma SQLite réel ;
15. les limites ou points à surveiller pour la Phase 4.2 ;
16. le résultat de `git status --short` ;
17. la confirmation qu’aucun commit et aucun push n’ont été effectués.

## Critères d’acceptation

La Phase 4.1 est considérée comme terminée uniquement si :

* les statuts de tâche sont définis et testés ;
* les priorités sont définies et testées ;
* le schéma complet reflète exactement la table SQLite ;
* le schéma de création est disponible ;
* le schéma de mise à jour est disponible ;
* les types TypeScript sont inférés depuis Zod ;
* les relations projet et phase sont correctement validées ;
* la position est correctement validée ;
* la nullabilité correspond à SQLite ;
* les timestamps respectent les conventions existantes ;
* les tests couvrent les cas valides et invalides ;
* aucun `any` ni contournement TypeScript n’est introduit ;
* aucune modification hors périmètre n’est réalisée ;
* `npm run typecheck` réussit ;
* `npm run test` réussit ;
* `npm run build` réussit ;
* le rapport de phase est créé ;
* aucun commit n’est effectué.
