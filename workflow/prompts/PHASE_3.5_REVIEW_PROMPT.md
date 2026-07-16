Effectue maintenant une **review indépendante, stricte et en lecture seule** de tous les fichiers créés ou modifiés pour la phase 3.5 de Theme Factory Companion.

Le rapport :

`workflow/reports/RAPPORT_PHASE_3.5.md`

est un rapport d’implémentation. Ne considère aucune de ses affirmations comme prouvée avant de l’avoir vérifiée dans le code, la migration et les tests.

## 1. Inspection Git obligatoire

Commence par exécuter :

```powershell
git status --short
git diff --stat
git diff
git ls-files --others --exclude-standard
```

Attention : les fichiers de la phase 3.5 sont probablement encore non suivis et n’apparaîtront donc pas dans `git diff`.

Lis intégralement chaque fichier retourné par :

```powershell
git ls-files --others --exclude-standard
```

Inspecte au minimum :

```text
src/shared/schemas/phase.ts
src/shared/schemas/phase.test.ts
src/main/database/repositories/phasesRepository.ts
src/main/database/repositories/phasesRepository.test.ts
workflow/prompts/PHASE_3.5_PROMPT.md
workflow/reports/RAPPORT_PHASE_3.5.md
```

Lis également les fichiers existants servant de référence ou de source de vérité :

```text
src/main/database/migrations/0001_createInitialMvpSchema.ts
src/shared/schemas/project.ts
src/main/database/repositories/projectsRepository.ts
```

ainsi que leurs tests et les utilitaires de base de données utilisés par les tests.

Ne te limite pas aux fichiers cités si l’implémentation en référence d’autres.

## 2. Règle de cette première passe

Ne modifie aucun fichier.

Ne corrige rien pendant cette review.

Ne crée pas encore de rapport de correction.

Tu dois uniquement :

* inspecter ;
* analyser ;
* identifier les défauts ;
* vérifier les affirmations du rapport ;
* proposer des corrections précises ;
* rendre un verdict.

Ne fais aucun commit Git.

## 3. Vérification des schémas Zod

Vérifie précisément `phase.ts`.

### Statuts

Confirme que :

* `PHASE_STATUSES` correspond exactement au `CHECK` SQL ;
* aucune valeur autorisée par SQLite n’est oubliée ;
* aucune valeur non autorisée n’est ajoutée ;
* le statut par défaut applicatif `pending` est cohérent et explicitement appliqué.

### Schéma de lecture

Vérifie que `phaseSchema` reflète exactement :

* les noms des propriétés TypeScript ;
* les nullabilités SQL ;
* la contrainte du nom ;
* la position entière et non négative ;
* les UUID ;
* les timestamps ;
* le statut.

Vérifie si l’emploi de `z.iso.datetime()` est cohérent avec le format exact généré par le repository et les conventions du dépôt.

### Schéma de création et type d’entrée

Le rapport indique :

```ts
export type CreatePhaseInput = z.input<typeof createPhaseSchema>
```

Vérifie attentivement :

* si `create()` appelle réellement `createPhaseSchema.parse(input)` avant d’utiliser les données ;
* si le résultat parsé, incluant le statut par défaut et les valeurs normalisées par `trim()`, est bien utilisé ;
* si le repository n’utilise pas accidentellement l’objet d’entrée original après validation ;
* si `status` peut réellement être absent chez l’appelant sans produire `undefined` dans l’insertion SQL ;
* si une propriété optionnelle explicitement présente avec `undefined` est correctement traitée ;
* si les champs inconnus sont véritablement refusés à l’exécution, pas uniquement au niveau TypeScript.

Recherche toute divergence entre :

```ts
z.input<typeof createPhaseSchema>
```

et :

```ts
z.output<typeof createPhaseSchema>
```

qui pourrait provoquer un défaut runtime.

### Schéma de mise à jour

Vérifie notamment :

* qu’un objet réellement vide est refusé ;
* si `{ name: undefined }` ou `{ description: undefined }` est considéré à tort comme une mise à jour non vide ;
* si une clé présente avec `undefined` peut produire une colonne SQL avec une valeur incorrecte ;
* que `description: null` efface volontairement la description ;
* qu’une clé absente préserve la valeur existante ;
* que `projectId`, `id`, `createdAt` et `updatedAt` sont refusés ;
* que les champs inconnus sont refusés ;
* que les transformations Zod sont effectivement utilisées par le repository.

Détermine si le `.refine()` vérifie seulement le nombre de clés ou la présence d’au moins une valeur réellement modifiable.

## 4. Vérification du repository

Inspecte chaque méthode :

```ts
listByProjectId(projectId)
getById(id)
create(input)
update(id, input)
remove(id)
```

### Validation des entrées

Vérifie si le repository valide lui-même :

* `projectId` dans `listByProjectId` ;
* `id` dans `getById`, `update` et `remove` ;
* les données de création ;
* les données de mise à jour.

Distingue clairement :

* ce qui doit être garanti par les futurs handlers IPC ;
* ce qui est déjà garanti par le repository ;
* ce qui pourrait être appelé directement depuis le main process avec une entrée invalide.

Ne signale pas automatiquement l’absence de validation UUID comme un bug si elle suit une convention cohérente de l’architecture, mais analyse le risque réel et la cohérence avec `projectsRepository`.

### Requêtes préparées

Confirme que :

* les requêtes statiques sont préparées une seule fois ;
* toutes les valeurs utilisateur sont paramétrées ;
* aucune donnée utilisateur n’est interpolée dans le SQL ;
* les colonnes de l’UPDATE dynamique proviennent uniquement d’une table interne fermée ;
* aucun champ non autorisé ne peut devenir un nom de colonne SQL.

### Mapping SQLite

Vérifie :

* le type exact de `PhaseRow` ;
* l’absence de `any` ou de cast injustifié ;
* le mapping `snake_case` vers `camelCase` ;
* l’appel réel à `phaseSchema.parse()` ;
* le comportement si SQLite retourne une ligne incohérente ;
* le typage du résultat des méthodes `better-sqlite3`.

Vérifie si un cast comme :

```ts
as PhaseRow
```

masque potentiellement une ligne `undefined` ou une forme incorrecte.

### Création et transaction

Le rapport affirme que le calcul de la prochaine position et l’insertion sont atomiques.

Confirme réellement que :

* les deux opérations sont dans la même transaction `better-sqlite3` ;
* la fonction transactionnelle est correctement créée et appelée ;
* le résultat parsé du schéma est utilisé ;
* la position explicite `0` n’est pas confondue avec une position absente par l’emploi incorrect de `||` au lieu de `??` ;
* la prochaine position est calculée uniquement pour le projet concerné ;
* la première position obtenue est bien `0` ;
* une erreur d’insertion provoque bien le rollback de la transaction ;
* aucune transaction imbriquée ou réutilisation incorrecte n’introduit un comportement inattendu.

Analyse également la portée réelle de l’affirmation selon laquelle cette transaction protège contre plusieurs appels rapides. Avec une connexion SQLite unique et synchrone, vérifie si le commentaire est exact, exagéré ou trompeur.

### Contrainte UNIQUE des positions

Vérifie le comportement de :

```sql
UNIQUE (project_id, position)
```

Confirme que :

* les collisions entre deux phases du même projet échouent ;
* une même position est autorisée dans deux projets différents ;
* une création avec une position explicite supérieure au maximum influence correctement la prochaine position automatique ;
* les trous de positions sont gérés conformément à la stratégie annoncée ;
* le calcul `MAX(position) + 1` est bien le comportement réellement souhaité ;
* aucun test ne suppose une réindexation qui n’existe pas.

### Mise à jour dynamique

Vérifie très attentivement :

* la construction des clauses `SET` ;
* l’ordre et les noms des paramètres ;
* la mise à jour systématique de `updated_at` ;
* la préservation de `created_at` ;
* le retour `null` quand l’identifiant n’existe pas ;
* l’absence de modification partielle avant une erreur ;
* le comportement sur collision de position ;
* la distinction champ absent / `undefined` / `null` ;
* la normalisation du nom et de la description ;
* la conservation des champs non fournis.

Vérifie si `updated_at` peut rester identique à l’ancienne valeur en production lorsque deux opérations surviennent dans la même milliseconde. Classe ce point selon son risque réel, sans créer un faux défaut si la convention ISO actuelle est déjà acceptée pour les projets.

### Suppression

Confirme que :

* `remove()` retourne `true` uniquement lorsqu’une ligne est supprimée ;
* il retourne `false` pour un identifiant absent ;
* il laisse SQLite appliquer les comportements relationnels ;
* aucune suppression manuelle redondante des tâches ou phases n’est réalisée.

## 5. Vérification des relations SQL

Compare directement le code et les tests à la migration.

Confirme :

* `phases.project_id → projects.id ON DELETE CASCADE` ;
* `tasks.phase_id → phases.id ON DELETE SET NULL` ;
* l’activation réelle de `PRAGMA foreign_keys = ON` dans les tests ;
* le refus réel d’une phase orpheline ;
* la suppression en cascade des phases ;
* la conservation d’une tâche avec `phase_id = NULL` après suppression de sa phase.

Pour le test qui insère directement une tâche, vérifie :

* qu’il utilise toutes les colonnes obligatoires réelles ;
* qu’il n’est pas couplé à une hypothèse incorrecte sur la migration ;
* qu’il contrôle que la tâche existe toujours après suppression de la phase ;
* qu’il ne vérifie pas seulement `phase_id` sur une ligne qui aurait pu disparaître ;
* qu’il ferme correctement la base même en cas d’échec du test.

## 6. Vérification des tests

Lis les 38 tests des schémas et les 31 tests du repository, sans te fier aux titres.

Recherche notamment :

* des tests qui ne vérifient pas réellement le comportement annoncé ;
* des assertions trop faibles ;
* des tests passant même si le code est incorrect ;
* des mocks ou horloges mal réinitialisés ;
* une fuite de base SQLite entre les tests ;
* l’absence de fermeture de connexion ;
* un ordre de tests implicite ;
* des tests dépendant d’une date réelle ;
* des assertions trop dépendantes du texte exact des erreurs SQLite ;
* des tests de rejet qui acceptent n’importe quelle erreur sans vérifier sa cause ;
* des tests relationnels ne contrôlant pas l’état final complet ;
* des scénarios annoncés dans le rapport mais absents du code.

Vérifie précisément l’affirmation :

```text
38 tests de schémas + 31 tests repository = 69 tests de phase 3.5
16 fichiers de test, 276 tests réussis
```

Compte ou vérifie les tests réels, et indique toute divergence.

### Tests supplémentaires à rechercher

Vérifie si les scénarios suivants sont réellement couverts :

1. même position autorisée dans deux projets différents ;
2. position explicite élevée, puis création automatique à `MAX + 1` ;
3. collision lors d’une mise à jour sans altération des autres champs ;
4. objet d’update contenant uniquement une clé à `undefined` ;
5. statut absent à la création et valeur `pending` réellement persistée ;
6. chaîne avec espaces normalisée avant insertion ;
7. échec d’une création invalide sans consommation visible d’une position ;
8. tâche toujours existante après `ON DELETE SET NULL`.

L’absence d’un de ces tests n’est pas automatiquement bloquante. Classe-la selon le risque du code associé.

## 7. Vérification du périmètre architectural

Confirme par lecture et recherche :

* aucune migration modifiée ;
* aucun fichier IPC ajouté ou modifié ;
* aucun contrat preload modifié ;
* aucun fichier renderer modifié ;
* aucune dépendance ajoutée ;
* aucun import de `better-sqlite3` dans `shared` ;
* aucun import du repository dans le renderer ;
* aucun `any` injustifié ;
* aucun `@ts-ignore` ;
* aucun `@ts-expect-error` injustifié ;
* aucun test supprimé ou désactivé ;
* aucun code de réordonnancement complet hors périmètre.

## 8. Vérification du rapport

Compare chaque affirmation importante de :

`workflow/reports/RAPPORT_PHASE_3.5.md`

avec le code réel.

Vérifie notamment :

* les signatures annoncées ;
* le statut par défaut ;
* la transaction ;
* le nombre de tests ;
* les scénarios relationnels ;
* les fichiers créés et modifiés ;
* l’absence de modifications hors périmètre ;
* les résultats de validation ;
* les limites annoncées sur le réordonnancement.

Signale toute formulation :

* fausse ;
* imprécise ;
* exagérée ;
* non prouvée ;
* contradictoire avec le code ou les tests.

## 9. Exécution des validations

Après la lecture du code, exécute :

```powershell
npm run typecheck
npm run test
npm run build
```

Tu peux également exécuter les tests ciblés de la phase 3.5 afin de confirmer ou isoler un constat.

Ne modifie pas les fichiers pour faire passer les commandes.

Indique les résultats exacts observés pendant la review, même s’ils diffèrent du rapport initial.

## 10. Format des constats

Classe les constats par gravité :

1. **BLOQUANT**
2. **IMPORTANT**
3. **MINEUR**
4. **SUGGESTION**

Pour chaque constat, indique obligatoirement :

* le fichier ;
* la ligne ou la zone concernée ;
* le problème précis ;
* un scénario concret permettant de le reproduire ;
* le risque réel ;
* la correction recommandée ;
* le test de non-régression à ajouter ou modifier lorsque pertinent.

Ne transforme pas une préférence stylistique en défaut bloquant.

Ne recommande pas de refactorisation générale lorsque la correction peut rester locale.

## 11. Conclusion obligatoire

Termine avec un verdict unique parmi :

* **prêt pour validation technique et commit** ;
* **corrections nécessaires avant validation** ;
* **bloqué**.

S’il n’existe aucun défaut bloquant ou important, indique-le explicitement, tout en listant les limites de couverture ou suggestions éventuelles.

## 12. Rapport de review

Enregistre le résultat complet de cette review dans :

```text
workflow/reports/REVIEW_PHASE_3.5.md
```

La création de ce rapport est la seule modification autorisée pendant cette passe.

Après sa création, affiche :

```powershell
git status --short
git diff --stat
git ls-files --others --exclude-standard
```

Ne modifie aucun fichier métier ou test.

Ne lance ni `git add`, ni commit Git.
