# Phase 3.2 — Repository projects

Tu travailles dans le dépôt **Theme Factory Companion**.

## État du projet

Les phases suivantes sont terminées et validées :

* Phase 0 — cadrage documentaire ;
* Phase 1 — socle Electron et interface générale ;
* Phase 2 — infrastructure SQLite complète ;
* Phase 3.1 — schémas Zod et types partagés pour les projets.

La phase 3.1 a notamment créé :

```text
src/shared/schemas/project.ts
src/shared/schemas/project.test.ts
```

Elle expose notamment :

```ts
PROJECT_STATUSES
projectStatusSchema
projectSchema
createProjectSchema
updateProjectSchema

ProjectStatus
Project
CreateProjectInput
UpdateProjectInput
```

La table SQLite `projects` existe déjà dans la migration initiale avec les colonnes suivantes :

```sql
id TEXT PRIMARY KEY,
name TEXT NOT NULL CHECK (trim(name) <> ''),
description TEXT,
objective TEXT,
status TEXT NOT NULL CHECK (
  status IN ('planning', 'active', 'paused', 'completed', 'archived')
),
repository_path TEXT,
target_technology TEXT,
notes TEXT,
created_at TEXT NOT NULL,
updated_at TEXT NOT NULL
```

Nous commençons maintenant :

# Objectif

Implémenter le repository SQLite du module `projects`.

Le repository doit fournir exclusivement les opérations suivantes :

* `list`
* `getById`
* `create`
* `update`
* `remove`

Il doit utiliser :

* `better-sqlite3` ;
* des requêtes préparées ;
* `crypto.randomUUID()` pour les identifiants ;
* des timestamps ISO ;
* les types partagés créés en phase 3.1 ;
* un mapping explicite entre les colonnes SQL en `snake_case` et les objets TypeScript en `camelCase`.

Cette phase ne doit créer aucun handler IPC, aucune API preload et aucune interface React.

---

# Étape préalable obligatoire

Avant toute modification :

1. inspecte l’architecture actuelle de `src/main/database` ;
2. inspecte la manière dont la connexion `better-sqlite3` est créée et transmise ;
3. inspecte les repositories, helpers ou conventions existants, s’il y en a ;
4. inspecte les tests SQLite déjà présents ;
5. inspecte précisément :

   * `src/shared/schemas/project.ts` ;
   * la migration qui crée la table `projects` ;
   * les scripts disponibles dans `package.json` ;
6. vérifie les conventions de nommage, d’exports et d’organisation du dépôt.

Réutilise les conventions existantes au lieu de créer une architecture parallèle.

Ne modifie pas le moteur de migrations, le schéma SQL ou le cycle d’initialisation de la base sauf incohérence bloquante.

Si une incohérence bloquante est détectée, arrête-toi et rapporte-la sans effectuer de refactorisation hors périmètre.

---

# Emplacement attendu

Crée le repository dans un emplacement cohérent avec l’architecture existante, par exemple :

```text
src/main/database/repositories/projectsRepository.ts
```

Ajoute son fichier de test selon les conventions actuelles, par exemple :

```text
src/main/database/repositories/projectsRepository.test.ts
```

Adapte les chemins si le dépôt utilise déjà une convention différente.

---

# Contrat du repository

Le repository doit recevoir explicitement une connexion SQLite existante.

Il ne doit pas :

* ouvrir lui-même une nouvelle connexion ;
* fermer la connexion reçue ;
* utiliser une variable globale cachée ;
* dépendre d’Electron ;
* accéder au renderer ou au preload.

Une forme acceptable serait une factory ou une classe recevant une instance `Database`, selon les conventions existantes.

Exemples indicatifs :

```ts
createProjectsRepository(database)
```

ou :

```ts
new ProjectsRepository(database)
```

Ne change pas les conventions du dépôt uniquement pour suivre cet exemple.

---

# Mapping SQL vers TypeScript

Le repository doit gérer explicitement la conversion suivante :

```text
repository_path  -> repositoryPath
target_technology -> targetTechnology
created_at       -> createdAt
updated_at       -> updatedAt
```

Les autres champs conservent leur nom logique.

Définis un type interne représentant une ligne SQLite, par exemple :

```ts
type ProjectRow = {
  id: string
  name: string
  description: string | null
  objective: string | null
  status: ProjectStatus
  repository_path: string | null
  target_technology: string | null
  notes: string | null
  created_at: string
  updated_at: string
}
```

Ce type doit rester interne au repository sauf convention contraire déjà présente dans le dépôt.

Crée une fonction de mapping unique, testable et non dupliquée.

La valeur retournée par le mapping doit être compatible avec le type partagé `Project`.

Utilise le schéma partagé `projectSchema` pour valider les objets sortant de la base si cela reste cohérent avec les conventions du dépôt et sans introduire une duplication inutile.

Ne fais pas confiance aveuglément à une conversion TypeScript par assertion.

---

# Requêtes préparées

Toutes les requêtes SQL métier doivent être préparées une seule fois lors de la création du repository ou de son initialisation.

Ne construis pas de SQL dynamique avec concaténation de valeurs utilisateur.

Les opérations doivent utiliser les paramètres nommés ou positionnels de `better-sqlite3`.

---

# Méthode `list`

Implémente une méthode qui retourne tous les projets.

Contraintes :

* retourner un tableau de `Project` ;
* mapper toutes les colonnes SQL ;
* utiliser un ordre déterministe.

Ordre recommandé :

```sql
ORDER BY created_at DESC, id DESC
```

Tu peux utiliser un autre ordre uniquement si une convention existante du dépôt le justifie clairement.

Une base vide doit retourner un tableau vide.

---

# Méthode `getById`

Implémente une méthode qui reçoit un identifiant de projet et retourne :

```ts
Project | null
```

Contraintes :

* utiliser une requête préparée ;
* ne pas lever d’erreur lorsque le projet n’existe pas ;
* retourner `null` dans ce cas ;
* mapper et valider la ligne lorsqu’elle existe.

La validation du format UUID par Zod sera principalement effectuée plus tard dans les handlers IPC.

Le repository peut accepter un identifiant de type `string`, sauf convention partagée plus stricte déjà présente.

---

# Méthode `create`

Implémente une méthode recevant un `CreateProjectInput`.

Contraintes :

* générer l’identifiant avec `crypto.randomUUID()` ;
* générer `createdAt` et `updatedAt` au format ISO ;
* utiliser le même timestamp pour les deux champs lors de la création ;
* insérer explicitement toutes les colonnes ;
* convertir les champs absents en `null` pour les colonnes SQL nullable ;
* respecter le statut fourni ou la valeur par défaut définie par le schéma de création ;
* retourner le projet complet inséré ;
* ne jamais accepter d’identifiant ou de timestamp fournis par l’appelant.

Le repository doit valider ou normaliser l’entrée avec `createProjectSchema.parse(...)` avant l’insertion, afin de garantir que les appels internes respectent le même contrat.

Ne duplique pas manuellement la logique de valeur par défaut `planning`.

Après l’insertion, retourne un objet conforme à `projectSchema`.

Tu peux construire cet objet à partir des valeurs insérées ou relire la ligne, selon la convention la plus sûre et la plus simple du dépôt.

---

# Méthode `update`

Implémente une mise à jour partielle d’un projet existant.

Signature attendue conceptuellement :

```ts
update(id: string, input: UpdateProjectInput): Project | null
```

Contraintes :

* valider l’entrée avec `updateProjectSchema.parse(...)` ;
* préserver les champs absents ;
* permettre à une valeur `null` d’effacer un champ nullable ;
* mettre à jour uniquement les champs fournis ;
* ne jamais permettre la modification de :

  * `id`
  * `createdAt`
* mettre systématiquement `updatedAt` à un nouveau timestamp ISO lorsqu’une mise à jour réussit ;
* retourner le projet mis à jour ;
* retourner `null` si l’identifiant n’existe pas ;
* éviter toute mise à jour partielle silencieuse en cas d’erreur.

## Construction de la requête d’update

Le schéma de mise à jour possède un nombre limité et connu de champs.

Privilégie une approche claire, sûre et déterministe.

Une requête préparée statique avec `COALESCE` ne doit pas être utilisée si elle empêche de distinguer :

* un champ absent ;
* un champ fourni avec `null`.

Tu peux :

* préparer une requête par combinaison utile ;
* utiliser une construction SQL contrôlée uniquement à partir d’une liste interne de colonnes autorisées ;
* ou utiliser une autre stratégie sûre et lisible.

Il est interdit d’insérer directement un nom de champ fourni par l’utilisateur dans le SQL.

Toute construction dynamique doit provenir exclusivement d’une table interne fermée de correspondance entre propriétés TypeScript et colonnes SQL autorisées.

Si l’entrée est invalide ou vide, laisse Zod lever son erreur avant toute modification de la base.

---

# Méthode `remove`

Implémente une méthode supprimant un projet par identifiant.

Retour recommandé :

```ts
boolean
```

Sémantique :

* `true` si une ligne a été supprimée ;
* `false` si aucun projet ne correspondait à l’identifiant.

Utilise le nombre de changements retourné par `better-sqlite3`.

Ne masque pas les erreurs SQLite, notamment les erreurs de contraintes de clés étrangères qui pourraient être pertinentes plus tard.

---

# Gestion des erreurs

Ne crée pas de couche d’erreurs complexe dans cette phase.

Principes :

* laisser remonter les erreurs Zod ;
* laisser remonter les erreurs SQLite inattendues ;
* retourner `null` uniquement pour une absence normale dans `getById` et `update` ;
* retourner `false` uniquement lorsque `remove` ne supprime aucune ligne ;
* ne pas utiliser de `try/catch` vide ;
* ne pas transformer toutes les erreurs en messages génériques.

---

# Tests obligatoires

Les tests doivent utiliser une base SQLite isolée.

Privilégie une base en mémoire :

```ts
new Database(':memory:')
```

Applique les migrations existantes ou reproduis le chemin d’initialisation prévu par les tests du dépôt.

Ne recrée pas manuellement une version divergente de la table `projects` si les helpers de migration permettent d’utiliser le schéma réel.

Chaque test doit rester déterministe et indépendant.

Ferme la connexion SQLite après chaque test selon les conventions actuelles.

## Tests de `list`

Couvre au minimum :

* une base vide retourne `[]` ;
* plusieurs projets sont retournés ;
* l’ordre est déterministe ;
* les colonnes SQL sont correctement transformées en camelCase ;
* les champs nullable restent `null`.

## Tests de `getById`

Couvre au minimum :

* un projet existant est retourné ;
* un identifiant absent retourne `null` ;
* le projet retourné respecte le contrat partagé.

## Tests de `create`

Couvre au minimum :

* création avec les données minimales ;
* génération d’un UUID valide ;
* génération de timestamps ISO valides ;
* `createdAt` et `updatedAt` sont identiques à la création ;
* statut par défaut `planning` ;
* création avec tous les champs ;
* normalisation Zod des champs texte ;
* champs optionnels absents enregistrés en `null` ;
* statut explicite respecté ;
* deux créations produisent deux identifiants différents ;
* données invalides refusées ;
* aucun enregistrement n’est créé lorsque la validation échoue.

Évite les assertions fragiles basées sur une heure exacte.

## Tests de `update`

Couvre au minimum :

* mise à jour d’un seul champ ;
* mise à jour de plusieurs champs ;
* préservation des champs absents ;
* possibilité de remettre un champ nullable à `null` ;
* normalisation des chaînes ;
* `createdAt` reste inchangé ;
* `updatedAt` est modifié ;
* l’identifiant reste inchangé ;
* statut modifié correctement ;
* projet inexistant retourne `null` ;
* objet vide refusé ;
* entrée invalide refusée ;
* aucune modification n’est enregistrée lorsque la validation échoue.

Pour éviter un test temporel instable, utilise une stratégie déterministe si nécessaire, par exemple une injection interne de fonction d’horloge, uniquement si elle reste petite et locale au repository.

N’ajoute pas une architecture générale de gestion du temps hors périmètre.

## Tests de `remove`

Couvre au minimum :

* suppression d’un projet existant retourne `true` ;
* le projet n’est plus accessible après suppression ;
* suppression d’un identifiant absent retourne `false` ;
* les autres projets ne sont pas supprimés.

## Test de persistance

Ajoute au moins un test d’intégration simple démontrant qu’un projet inséré dans un fichier SQLite temporaire est encore présent après :

1. fermeture de la première connexion ;
2. réouverture d’une nouvelle connexion sur le même fichier ;
3. recréation du repository.

Supprime proprement le fichier temporaire après le test.

Réutilise les utilitaires temporaires existants du dépôt s’ils existent.

---

# Contraintes strictes de périmètre

Ne crée pas dans cette phase :

* de handler IPC ;
* de canal IPC ;
* d’API preload ;
* de modification de `window.themeFactoryApi` ;
* d’interface React ;
* de page Projects ;
* de formulaire ;
* de sélection de projet actif ;
* de repository pour les phases ;
* de journal d’activité ;
* de nouvelle migration ;
* de modification du schéma SQLite ;
* de système générique abstrait de repository ;
* de refactorisation globale de la base de données.

Ne modifie aucun fichier sans lien direct avec cette phase.

N’ajoute pas de dépendance sans nécessité démontrée.

Ne masque aucune erreur TypeScript.

N’ajoute pas `skipLibCheck`.

Ne désactive, ne saute et ne supprime aucun test existant.

Ne lance pas automatiquement `git commit`.

---

# Validation obligatoire

Après l’implémentation, exécute dans cet ordre :

```bash
npm run typecheck
npm run test
npm run build
```

Corrige toutes les erreurs liées à cette phase avant de terminer.

Exécute ensuite :

```bash
git status --short
```

Ne committe rien.

---

# Archivage automatique du rapport

À la fin de la phase, produis un rapport complet dans le chat Claude Code.

Enregistre également exactement le même rapport dans :

```text
workflow/reports/RAPPORT_PHASE_3.2.md
```

Crée le dossier parent s’il n’existe pas.

Le rapport doit être encodé en UTF-8.

N’écrase aucun autre rapport.

Le fichier `workflow/prompts/PHASE_3.2_PROMPT.md` contient les instructions de travail et ne doit pas être modifié par l’implémentation.

---

# Rapport final attendu

Le rapport doit contenir :

1. les fichiers inspectés ;
2. les fichiers créés ;
3. les fichiers modifiés ;
4. la forme du repository retenue :

   * classe ou factory ;
   * mode d’injection de la connexion SQLite ;
5. les requêtes préparées ajoutées ;
6. le mapping `snake_case` vers `camelCase` ;
7. la signature exacte de :

   * `list`
   * `getById`
   * `create`
   * `update`
   * `remove`
8. la stratégie de génération des UUID ;
9. la stratégie de génération des timestamps ;
10. la stratégie choisie pour les mises à jour partielles ;
11. le comportement exact en cas de projet absent ;
12. les validations Zod utilisées ;
13. les tests ajoutés ;
14. le résultat du test de persistance après réouverture ;
15. les résultats exacts de :

    * `npm run typecheck`
    * `npm run test`
    * `npm run build`
16. les éventuelles limites ou décisions techniques ;
17. la sortie exacte de :

```bash
git status --short
```

18. la confirmation que le rapport a été enregistré dans :

```text
workflow/reports/RAPPORT_PHASE_3.2.md
```

Arrête-toi après le rapport et attends la validation manuelle.
