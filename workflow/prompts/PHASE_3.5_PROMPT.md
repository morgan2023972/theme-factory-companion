# PHASE 3.5 — Schémas partagés et repository des phases

Tu travailles sur le dépôt **Theme Factory Companion**.

Les phases précédentes sont terminées, validées et commitées, notamment :

* phase 3.1 : schémas Zod et types partagés des projets ;
* phase 3.2 : repository des projets ;
* phase 3.3 : IPC et API preload des projets ;
* phase 3.4 : interface CRUD des projets.

Tu dois maintenant réaliser uniquement la **phase 3.5 — Schémas partagés et repository des phases**.

---

## 1. Objectif

Implémenter la couche métier et la couche SQLite nécessaires à la gestion des phases d’un projet.

Cette phase doit couvrir :

* les statuts et validations Zod partagés des phases ;
* les types TypeScript dérivés des schémas ;
* le repository SQLite des phases ;
* la liste des phases par projet ;
* la lecture d’une phase par identifiant ;
* la création ;
* la modification ;
* la suppression ;
* la gestion minimale des positions ;
* les tests unitaires et relationnels ;
* les relations entre `projects`, `phases` et les tables déjà définies.

Cette phase ne doit pas encore exposer les phases au renderer.

---

## 2. Périmètre strict

Implémenter uniquement :

* les schémas et types partagés des phases ;
* le repository SQLite des phases ;
* les tests associés ;
* les exports strictement nécessaires ;
* le prompt et le rapport de phase.

Ne pas implémenter :

* les canaux IPC des phases ;
* les handlers IPC des phases ;
* l’API preload `window.themeFactoryApi.phases` ;
* une page React des phases ;
* un formulaire React des phases ;
* le CRUD des tâches ;
* un système de glisser-déposer ;
* un moteur complet de réordonnancement ;
* une nouvelle migration sans preuve d’un défaut bloquant du schéma actuel ;
* une nouvelle table ;
* un state manager ;
* une refactorisation générale du dépôt.

Ne pas modifier l’interface CRUD des projets, sauf correction strictement nécessaire et directement liée à une erreur de compilation provoquée par cette phase.

---

## 3. Étape préalable obligatoire

Avant toute modification :

1. lire les documents du dépôt relatifs à l’architecture, au modèle de données et à la roadmap ;
2. inspecter la migration SQLite initiale ;
3. lire précisément la définition SQL de la table `phases` ;
4. relever les noms réels des colonnes ;
5. relever les contraintes `CHECK` ;
6. relever les clés étrangères ;
7. relever les comportements `ON DELETE` ;
8. relever les index existants ;
9. inspecter les schémas partagés des projets ;
10. inspecter `projectsRepository.ts` et ses tests ;
11. inspecter les utilitaires existants pour :

* les UUID ;
* les timestamps ;
* le mapping SQL vers TypeScript ;
* l’ouverture des bases de test ;
* l’application des migrations ;

12. inspecter les conventions de nommage et de tests du dépôt.

Ne suppose aucun champ, statut ou comportement relationnel sans l’avoir vérifié dans le schéma SQL réel.

Présente ensuite un plan court indiquant les fichiers que tu prévois de créer ou modifier.

---

## 4. Fichier du prompt

Vérifie que le présent prompt est enregistré dans :

```text
workflow/prompts/PHASE_3.5_PROMPT.md
```

Ne supprime pas les prompts des phases précédentes.

---

## 5. Schémas et types partagés

Créer un fichier adapté aux conventions existantes, probablement :

```text
src/shared/schemas/phase.ts
```

Le nom exact doit respecter l’organisation actuelle du dépôt.

### 5.1 Statuts

Définir le schéma des statuts de phase à partir des valeurs réellement autorisées par la contrainte SQL de la table `phases`.

Ne pas inventer de nouvelles valeurs.

Exemple de forme, à adapter au schéma réel :

```ts
export const phaseStatusSchema = z.enum([
  'planned',
  'in_progress',
  'completed',
  'cancelled'
])
```

Exporter le type dérivé :

```ts
export type PhaseStatus = z.infer<typeof phaseStatusSchema>
```

### 5.2 Schéma de lecture

Créer un schéma représentant une phase complète telle qu’elle est retournée par le repository.

Il doit correspondre exactement aux colonnes SQL réelles.

Il peut notamment inclure, si ces champs existent réellement :

```ts
{
  id: string
  projectId: string
  name: string
  description: string | null
  status: PhaseStatus
  position: number
  createdAt: string
  updatedAt: string
}
```

Contraintes attendues :

* UUID valides ;
* chaînes non vides lorsque nécessaire ;
* valeurs nullables fidèles au SQL ;
* position entière conforme à la contrainte SQL ;
* dates ISO valides ;
* statuts limités aux valeurs autorisées.

Exporter le type :

```ts
export type Phase = z.infer<typeof phaseSchema>
```

### 5.3 Schéma de création

Créer un schéma de création compatible avec le repository.

Le schéma doit distinguer :

* les champs obligatoires ;
* les champs optionnels ;
* les champs auxquels le repository attribue une valeur par défaut ;
* les champs interdits à l’appelant, comme `id`, `createdAt` ou `updatedAt`.

Le projet parent doit être identifié par un UUID valide.

Le nom doit être normalisé avec `trim()` et ne pas accepter une chaîne vide.

La position peut être optionnelle si le repository calcule automatiquement la prochaine position.

Le statut peut être optionnel si la base ou le repository applique une valeur par défaut explicite.

Exporter le type :

```ts
export type CreatePhaseInput = z.infer<typeof createPhaseSchema>
```

### 5.4 Schéma de mise à jour

Créer un schéma permettant une mise à jour partielle.

Il doit conserver la distinction entre :

```ts
{}
```

qui signifie « ne modifier aucun champ », et :

```ts
{ description: null }
```

qui signifie « effacer volontairement la description ».

Empêcher une mise à jour totalement vide, sauf si une convention contraire existe déjà dans le repository des projets.

Le champ `projectId` ne doit pas être modifiable sauf si le modèle et les décisions existantes autorisent explicitement le déplacement d’une phase entre projets. Par défaut, ne pas autoriser ce déplacement pendant cette phase.

Exporter le type :

```ts
export type UpdatePhaseInput = z.infer<typeof updatePhaseSchema>
```

### 5.5 Tests des schémas

Créer des tests ciblés couvrant au minimum :

* phase complète valide ;
* UUID de phase invalide ;
* UUID de projet invalide ;
* nom vide ;
* nom composé uniquement d’espaces ;
* statut valide ;
* statut invalide ;
* position valide ;
* position négative ou invalide selon la contrainte réelle ;
* champs nullables ;
* création minimale valide ;
* création avec tous les champs valides ;
* mise à jour partielle valide ;
* mise à jour avec `description: null` ;
* mise à jour vide refusée si cette règle est retenue ;
* champs inconnus, selon la stratégie Zod existante du dépôt.

---

## 6. Repository des phases

Créer un repository selon les conventions actuelles, probablement :

```text
src/main/database/repositories/phasesRepository.ts
```

Le repository doit utiliser :

* `better-sqlite3` uniquement dans le main process ;
* des requêtes préparées ;
* des paramètres SQL ;
* des UUID générés avec l’outil déjà utilisé par le dépôt ;
* des timestamps ISO ;
* le modèle SQL existant ;
* les transactions uniquement lorsque cela est réellement nécessaire.

Ne pas construire de SQL à partir de valeurs utilisateur non paramétrées.

### API minimale attendue

Adapter les noms aux conventions actuelles, mais couvrir au minimum :

```ts
listByProjectId(projectId: string): Phase[]
getById(id: string): Phase | null
create(input: CreatePhaseInput): Phase
update(id: string, input: UpdatePhaseInput): Phase | null
remove(id: string): boolean
```

Ne pas exposer encore ces méthodes par IPC.

---

## 7. Mapping SQLite vers TypeScript

SQLite utilise probablement des colonnes en `snake_case`, alors que TypeScript utilise du `camelCase`.

Créer ou réutiliser un mapper explicite.

Exemple de principe :

```ts
function mapPhaseRow(row: PhaseRow): Phase {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    status: row.status,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}
```

Ne pas utiliser `any`.

Définir un type interne représentant exactement les colonnes retournées par SQLite.

Valider ou typer précisément les statuts.

Ne pas exposer les noms SQL dans les types partagés du renderer.

---

## 8. Liste des phases par projet

Implémenter une méthode :

```ts
listByProjectId(projectId: string): Phase[]
```

Elle doit :

* filtrer strictement sur `project_id` ;
* utiliser une requête préparée ;
* retourner uniquement les phases du projet demandé ;
* trier les phases par position croissante ;
* appliquer un second critère stable en cas d’égalité, par exemple la date de création ou l’identifiant ;
* retourner un tableau vide si le projet n’a aucune phase.

Exemple SQL à adapter :

```sql
SELECT ...
FROM phases
WHERE project_id = ?
ORDER BY position ASC, created_at ASC
```

Ne pas lister toutes les phases de tous les projets puis filtrer en JavaScript.

---

## 9. Lecture par identifiant

Implémenter :

```ts
getById(id: string): Phase | null
```

Comportement attendu :

* retourner la phase si elle existe ;
* retourner `null` si elle n’existe pas ;
* ne pas lever une erreur artificielle pour une absence normale ;
* mapper correctement toutes les colonnes.

---

## 10. Création d’une phase

Implémenter :

```ts
create(input: CreatePhaseInput): Phase
```

La méthode doit :

1. générer un UUID ;
2. générer les timestamps ISO ;
3. utiliser le projet indiqué par `projectId` ;
4. appliquer le statut par défaut conforme au schéma SQL ou à la convention métier ;
5. calculer la position si elle n’est pas fournie ;
6. insérer la phase avec une requête préparée ;
7. relire ou retourner la phase créée sous la forme TypeScript complète.

### Projet parent

La création d’une phase pour un projet inexistant doit échouer grâce à la clé étrangère SQLite.

Ne contourne pas la contrainte relationnelle.

Ne crée pas automatiquement un projet parent.

### Position automatique

Si aucune position n’est fournie, ajouter la phase à la fin des phases du même projet.

Le calcul doit être limité au projet concerné.

Exemple de principe :

```sql
SELECT COALESCE(MAX(position), -1) + 1
FROM phases
WHERE project_id = ?
```

Adapte la valeur initiale à la convention de positions existante :

* position à partir de `0` ;
* ou position à partir de `1`.

Ne décide pas arbitrairement sans vérifier les données et conventions existantes.

La position des phases d’un autre projet ne doit jamais influencer le calcul.

### Concurrence et atomicité

Évalue si le calcul de position et l’insertion doivent être regroupés dans une transaction.

Dans une application desktop locale mono-utilisateur, une transaction courte peut néanmoins être pertinente pour garantir la cohérence.

Ne complexifie pas excessivement cette phase, mais documente la décision.

---

## 11. Modification d’une phase

Implémenter :

```ts
update(id: string, input: UpdatePhaseInput): Phase | null
```

La mise à jour doit :

* accepter les champs réellement modifiables ;
* ne modifier que les champs présents dans l’entrée ;
* préserver les champs absents ;
* permettre l’effacement volontaire d’un champ nullable avec `null` ;
* mettre à jour `updated_at` ;
* conserver `created_at` ;
* retourner la phase mise à jour ;
* retourner `null` si la phase n’existe pas.

Ne transforme pas automatiquement :

```ts
undefined
```

en :

```ts
null
```

La construction dynamique de la requête doit rester maîtrisée :

* noms de colonnes provenant uniquement d’une liste interne autorisée ;
* valeurs toujours paramétrées ;
* aucune interpolation directe d’une donnée utilisateur.

Réutilise la stratégie de `projectsRepository` si elle est correcte et adaptée.

---

## 12. Suppression d’une phase

Implémenter :

```ts
remove(id: string): boolean
```

Comportement attendu :

* retourner `true` si une ligne a été supprimée ;
* retourner `false` si aucune phase ne correspond à l’identifiant ;
* respecter les relations définies dans le schéma SQL ;
* ne pas supprimer manuellement des données liées si la base gère déjà le comportement via `CASCADE` ou `SET NULL`.

Vérifier précisément le comportement des tâches liées à une phase selon la migration actuelle, sans implémenter le repository des tâches.

---

## 13. Gestion minimale des positions

Cette phase doit préparer les positions sans implémenter un moteur complet de réordonnancement.

Couvrir uniquement :

* position entière ;
* contrainte de position conforme au SQL ;
* tri par position ;
* position automatique à la fin lors de la création ;
* calcul indépendant pour chaque projet ;
* modification explicite de la position si le schéma d’update l’autorise ;
* comportement stable en cas d’égalité de positions.

Ne pas implémenter maintenant :

* drag-and-drop ;
* déplacement haut/bas ;
* décalage automatique de toutes les autres phases ;
* résolution complète des collisions ;
* réordonnancement transactionnel global.

Le réordonnancement approfondi est prévu plus tard dans la roadmap.

Documenter clairement cette limite dans le rapport.

---

## 14. Tests du repository

Créer des tests selon les conventions existantes, probablement :

```text
src/main/database/repositories/phasesRepository.test.ts
```

Utiliser une base SQLite isolée :

* en mémoire ;
* ou temporaire ;

selon les utilitaires actuels du dépôt.

Toujours :

* activer `foreign_keys` ;
* appliquer les migrations ;
* fermer la base après les tests ;
* isoler les données entre les tests.

### Tests minimaux attendus

#### Liste vide

* créer un projet sans phase ;
* vérifier que `listByProjectId(project.id)` retourne `[]`.

#### Création minimale

* créer un projet ;
* créer une phase avec les champs minimaux ;
* vérifier l’UUID ;
* vérifier le rattachement au projet ;
* vérifier les valeurs par défaut ;
* vérifier les timestamps ;
* vérifier la position calculée.

#### Création complète

* créer une phase avec tous les champs autorisés ;
* vérifier que toutes les valeurs sont persistées.

#### Projet inexistant

* tenter de créer une phase avec un UUID de projet inexistant ;
* vérifier que l’opération échoue ;
* vérifier qu’aucune phase orpheline n’est insérée.

#### Isolation entre projets

Créer :

```text
Projet A → Phase A1, Phase A2
Projet B → Phase B1
```

Puis vérifier que :

```ts
listByProjectId(projectA.id)
```

retourne uniquement A1 et A2.

#### Tri par position

Créer plusieurs phases avec des positions non ordonnées dans l’ordre d’insertion.

Vérifier que la liste est retournée dans l’ordre des positions.

#### Position automatique par projet

Créer plusieurs phases dans deux projets différents.

Vérifier que la prochaine position d’un projet dépend uniquement des phases de ce projet.

#### Lecture par identifiant

* phase existante : retourne la phase ;
* phase inexistante : retourne `null`.

#### Mise à jour partielle

Modifier un seul champ.

Vérifier que :

* ce champ change ;
* les autres champs sont préservés ;
* `updatedAt` change ;
* `createdAt` reste identique.

Attention : si les timestamps peuvent être identiques à la milliseconde dans un test rapide, utiliser une stratégie déterministe ou vérifier correctement sans test fragile.

#### Effacement d’un champ nullable

Mettre :

```ts
{ description: null }
```

Vérifier que la description est réellement effacée.

#### Modification de position

Modifier la position d’une phase et vérifier :

* sa persistance ;
* le nouvel ordre retourné par `listByProjectId`.

Ne pas attendre de réindexation automatique des autres phases si elle n’est pas implémentée dans cette phase.

#### Mise à jour inexistante

Vérifier que la mise à jour d’un UUID inexistant retourne `null`.

#### Suppression

* supprimer une phase existante ;
* vérifier le retour `true` ;
* vérifier que `getById` retourne `null` ;
* supprimer une seconde fois ;
* vérifier le retour `false`.

---

## 15. Tests relationnels

Ajouter des tests vérifiant réellement les contraintes entre les tables.

### Suppression du projet parent

Créer :

* un projet ;
* plusieurs phases liées.

Supprimer ensuite le projet via le repository des projets.

Vérifier le comportement exact prévu par la clé étrangère de `phases.project_id`, probablement la suppression en cascade si le schéma l’impose.

Ne devine pas le comportement : lis d’abord la migration.

### Suppression d’une phase liée à une tâche

Inspecter la clé étrangère éventuelle :

```text
tasks.phase_id
```

Créer directement les données minimales nécessaires dans le test uniquement si l’infrastructure et le schéma rendent ce test raisonnable sans implémenter le repository des tâches.

Vérifier le comportement SQL réel :

* `SET NULL` ;
* `CASCADE` ;
* ou restriction.

Ne modifie pas la migration pour adapter le résultat à une hypothèse.

Si ce test n’est pas raisonnablement réalisable dans le périmètre, documenter précisément pourquoi.

### Foreign keys activées

Ajouter au moins une vérification démontrant que les clés étrangères sont actives dans les tests.

Un test qui accepte silencieusement une phase orpheline est invalide.

---

## 16. Exports et intégration

Ajouter uniquement les exports nécessaires selon l’organisation actuelle.

Ne crée pas un nouvel index central si le dépôt n’en utilise pas.

Ne modifie pas encore :

* les contrats IPC ;
* `themeFactoryApi` ;
* le preload ;
* les handlers du main process ;
* le renderer.

Le repository peut être utilisé directement uniquement par le main process et les tests à ce stade.

---

## 17. Qualité et architecture

Vérifier explicitement :

* SQLite reste exclusivement dans le main process ;
* les schémas Zod sont dans `shared` ;
* aucun import de `better-sqlite3` dans `shared` ;
* aucun import du repository dans le renderer ;
* aucun canal IPC ajouté ;
* aucune chaîne SQL construite avec des valeurs utilisateur non paramétrées ;
* les requêtes fréquemment utilisées sont préparées ;
* les types de lignes SQLite sont explicites ;
* aucun `any` injustifié ;
* aucun `@ts-ignore` ;
* aucun `@ts-expect-error` injustifié ;
* aucune erreur TypeScript masquée ;
* aucune migration modifiée sans justification bloquante ;
* aucune dépendance ajoutée sans nécessité absolue ;
* aucun test supprimé ou neutralisé.

---

## 18. Commandes de validation

Inspecter d’abord les scripts du `package.json`, puis exécuter au minimum :

```powershell
npm run typecheck
npm run test
npm run build
```

Corriger toutes les erreurs sans les masquer.

Tu peux également exécuter un fichier de test ciblé pendant l’implémentation, mais la suite complète doit être exécutée avant la fin.

Ne pas lancer automatiquement l’application Electron sauf si cela est nécessaire pour diagnostiquer une erreur. La validation de cette phase est principalement automatisée, car aucune interface utilisateur nouvelle n’est créée.

---

## 19. Rapport obligatoire

Créer à la fin :

```text
workflow/reports/RAPPORT_PHASE_3.5.md
```

Le rapport doit contenir les sections suivantes.

### Résumé

* objectif ;
* résultat ;
* statut final :

  * terminé ;
  * partiellement terminé ;
  * bloqué.

### Schéma SQL observé

Documenter précisément :

* colonnes réelles de `phases` ;
* contraintes ;
* valeurs de statut ;
* valeur par défaut ;
* convention de position ;
* clés étrangères ;
* comportements de suppression ;
* index pertinents.

### Fichiers créés

Lister chaque fichier avec son rôle.

### Fichiers modifiés

Lister chaque fichier avec la raison exacte.

### Schémas Zod et types

Documenter :

* statut ;
* schéma de lecture ;
* schéma de création ;
* schéma de mise à jour ;
* champs obligatoires ;
* champs optionnels ;
* champs nullables ;
* règle des mises à jour vides.

### Repository

Documenter les méthodes réellement implémentées :

```text
listByProjectId
getById
create
update
remove
```

Préciser les signatures exactes.

### Positions

Documenter :

* position initiale ;
* calcul automatique ;
* isolation par projet ;
* tri ;
* égalités éventuelles ;
* limites du réordonnancement.

### Relations

Documenter les résultats des tests concernant :

* phase liée à un projet existant ;
* refus d’une phase orpheline ;
* suppression du projet parent ;
* comportement des tâches lors de la suppression d’une phase, si testé.

### Tests

Indiquer :

* fichiers de tests ajoutés ou modifiés ;
* scénarios couverts ;
* nombre total de fichiers de tests ;
* nombre total de tests ;
* nombre de tests réussis ;
* nombre de tests échoués.

### Commandes exécutées

Reporter les commandes exactes et leurs résultats :

```text
npm run typecheck
npm run test
npm run build
```

### Limites et écarts

Documenter :

* tests non réalisés ;
* décisions temporaires ;
* éventuels écarts au prompt ;
* absence volontaire de réordonnancement complet ;
* points réservés aux phases 3.6, 3.7 ou 4.8.

### Validation manuelle

Cette phase ne crée pas d’interface utilisateur.

Proposer seulement une validation technique courte, par exemple :

* vérifier le rapport ;
* vérifier les résultats des tests ;
* vérifier le diff ;
* vérifier qu’aucun fichier IPC/preload/renderer n’a été modifié hors nécessité.

Ne pas déclarer cette validation comme effectuée par l’utilisateur.

### Git

À la fin, afficher :

```powershell
git status --short
git diff --stat
git diff
git ls-files --others --exclude-standard
```

Ne pas exécuter :

```powershell
git add .
```

Ne pas committer.

Proposer comme message de commit :

```text
feat: add phases schemas and repository
```

---

## 20. Critères d’acceptation

La phase 3.5 est prête pour review si :

* les statuts correspondent au SQL réel ;
* les schémas Zod des phases existent ;
* les types sont dérivés des schémas ;
* la création valide les données ;
* la mise à jour partielle distingue champ absent et `null` ;
* `listByProjectId` retourne uniquement les phases du projet demandé ;
* la liste est triée par position ;
* `getById` retourne une phase ou `null` ;
* `create` génère UUID et timestamps ;
* la position automatique est calculée par projet ;
* une phase orpheline est refusée ;
* `update` préserve les champs absents ;
* `update` retourne `null` pour une phase inexistante ;
* `remove` retourne un booléen cohérent ;
* la suppression du projet parent respecte la clé étrangère ;
* les positions sont indépendantes entre projets ;
* aucun IPC n’a été ajouté ;
* aucune interface React n’a été ajoutée ;
* aucune migration n’a été modifiée sans justification ;
* les requêtes utilisent des paramètres ;
* `npm run typecheck` réussit ;
* `npm run test` réussit ;
* `npm run build` réussit ;
* le prompt est enregistré dans `workflow/prompts/PHASE_3.5_PROMPT.md` ;
* le rapport est enregistré dans `workflow/reports/RAPPORT_PHASE_3.5.md` ;
* aucun commit n’a été effectué automatiquement.

---

## 21. Ordre d’exécution obligatoire

Procède dans cet ordre :

1. inspecter la documentation ;
2. inspecter la migration et la table `phases` ;
3. inspecter les schémas des projets ;
4. inspecter `projectsRepository` et ses tests ;
5. confirmer le plan et les fichiers concernés ;
6. vérifier le fichier du prompt ;
7. créer les schémas et types partagés des phases ;
8. ajouter les tests des schémas ;
9. créer le repository des phases ;
10. implémenter le mapping SQLite ;
11. implémenter `listByProjectId` ;
12. implémenter `getById` ;
13. implémenter `create` et la position automatique ;
14. implémenter `update` ;
15. implémenter `remove` ;
16. ajouter les tests du repository ;
17. ajouter les tests relationnels ;
18. exécuter les tests ciblés ;
19. exécuter le typecheck complet ;
20. exécuter la suite complète de tests ;
21. exécuter le build ;
22. corriger toute erreur sans la masquer ;
23. créer `workflow/reports/RAPPORT_PHASE_3.5.md` ;
24. afficher l’état Git et le diff ;
25. s’arrêter sans commit.

Commence maintenant par inspecter le dépôt et la définition SQL réelle de la table `phases`. Ne modifie aucun fichier métier avant d’avoir confirmé les colonnes, contraintes et relations existantes.
