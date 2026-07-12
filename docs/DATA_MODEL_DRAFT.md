# Modèle de données envisagé

**Important : ce document présente une ébauche du modèle de données. Il ne s'agit pas d'une migration SQL définitive et aucun schéma n'est encore implémenté.**

## Entités envisagées

### `projects`

Représente un projet de création de thème Shopify. Entité racine de l'application : toutes les autres entités listées ci-dessous en dépendent directement ou indirectement.

### `phases`

Représente une étape structurante d'un projet (voir [docs/ROADMAP.md](ROADMAP.md) pour un exemple de découpage en phases). Une phase appartient à un projet et regroupe un ensemble de tâches.

### `tasks`

Représente une unité de travail concrète, rattachée à une phase. Une tâche peut être associée à un prompt Claude Code, des critères d'acceptation et des commandes de validation.

### `task_checklist_items`

Représente un élément de vérification associé à une tâche. Une tâche peut comporter plusieurs éléments de checklist.

### `questions`

Représente une question ouverte relative à un projet, une phase ou une tâche.

### `issues`

Représente un problème rencontré au cours du projet, avec sa résolution éventuelle.

### `decisions`

Représente une décision structurante prise au cours du projet (voir [docs/decisions/](decisions/)).

### `activity_log`

Représente un événement du journal d'activité du projet (voir [docs/project-journal/](project-journal/)).

## Relations envisagées

- Un projet possède plusieurs phases.
- Une phase possède plusieurs tâches.
- Une tâche possède plusieurs éléments de checklist.
- Les questions, problèmes et décisions peuvent être rattachés à un projet, et potentiellement à une phase ou une tâche.
- Le journal d'activité enregistre des événements liés à un projet, et potentiellement à une phase ou une tâche.

## Points restant à décider

- **Cardinalités** : certaines relations (questions, problèmes, décisions vis-à-vis des phases et tâches) doivent-elles être obligatoires ou optionnelles ?
- **Règles de suppression** : que devient une phase, une tâche ou un élément associé lorsque son parent est supprimé (suppression en cascade, blocage, archivage) ?
- **Ordre des phases et tâches** : comment représenter et maintenir un ordre explicite (champ d'ordre numérique, liste chaînée, autre) ?
- **Stockage des listes de fichiers et commandes** : les fichiers concernés par une tâche et les commandes de validation doivent-ils être stockés sous forme de texte libre, de liste structurée, ou de table dédiée ?
- **Stratégie des timestamps** : quels timestamps conserver (création, mise à jour, clôture) et selon quel format exact (voir [docs/CONVENTIONS.md](CONVENTIONS.md)) ?
- **Format du journal** : le journal d'activité doit-il être généré automatiquement à partir des changements de statut, saisi manuellement, ou les deux ?
- **Gestion des statuts** : quels statuts possibles pour chaque entité (projet, phase, tâche, question, problème, décision), et quelles transitions sont autorisées ?
- **Tags** : faut-il prévoir, dès la conception initiale, la possibilité d'ajouter des tags aux entités, même si cette fonctionnalité n'est pas encore implémentée ?

Ces points devront être arbitrés et consignés dans le [registre des décisions](decisions/) avant toute implémentation du modèle de données.
