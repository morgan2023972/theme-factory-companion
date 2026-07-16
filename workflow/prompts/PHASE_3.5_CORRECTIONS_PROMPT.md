Lis intégralement le rapport de review suivant avant toute modification :

`workflow/reports/REVIEW_PHASE_3.5.md`

Applique uniquement les corrections nécessaires issues de cette review.

## Objectif principal

Corriger le traitement des propriétés de mise à jour explicitement définies à `undefined`.

Le défaut concerne actuellement :

```text
src/shared/schemas/phase.ts
src/main/database/repositories/phasesRepository.ts
```

La review indique que le même défaut préexiste aussi dans :

```text
src/shared/schemas/project.ts
src/main/database/repositories/projectsRepository.ts
```

Corrige les deux modules pour conserver un comportement cohérent entre projets et phases.

Ne réalise aucune refactorisation générale.

---

## 1. Correction des schémas de mise à jour

Inspecte précisément :

```ts
updatePhaseSchema
updateProjectSchema
```

Leur validation actuelle considère probablement qu’un objet comme :

```ts
{ description: undefined }
```

contient un champ valide simplement parce que la clé existe.

Corrige la règle afin qu’une mise à jour ne soit valide que si elle contient au moins une valeur réellement définie.

Principe attendu :

```ts
Object.values(data).some((value) => value !== undefined)
```

Le comportement doit devenir :

```ts
updatePhaseSchema.safeParse({})
// échec

updatePhaseSchema.safeParse({ description: undefined })
// échec

updatePhaseSchema.safeParse({ name: undefined, description: undefined })
// échec

updatePhaseSchema.safeParse({ description: null })
// succès

updatePhaseSchema.safeParse({ name: 'Nouveau nom' })
// succès
```

Applique le même principe à `updateProjectSchema`.

Préserve les règles existantes :

* les champs inconnus restent refusés ;
* `null` reste une valeur valide pour les champs réellement nullables ;
* les champs absents restent préservés ;
* les chaînes sont toujours normalisées conformément aux schémas existants.

---

## 2. Correction des repositories

Inspecte les boucles de construction dynamique des requêtes UPDATE dans :

```text
src/main/database/repositories/phasesRepository.ts
src/main/database/repositories/projectsRepository.ts
```

Une propriété dont la valeur est `undefined` ne doit jamais être ajoutée aux clauses SQL.

Principe attendu :

```ts
if (!(field in data) || data[field] === undefined) {
  continue
}
```

Ne transforme jamais implicitement :

```ts
undefined
```

en :

```ts
null
```

Seul un `null` explicitement fourni par l’appelant doit effacer un champ nullable.

Conserve :

* la liste interne fermée des colonnes autorisées ;
* les valeurs SQL paramétrées ;
* la mise à jour de `updated_at` ;
* la préservation de `created_at` ;
* le retour `null` pour une entité inexistante ;
* les validations Zod déjà présentes.

---

## 3. Tests obligatoires des schémas

Ajoute des tests dans les fichiers appropriés.

### Phases

Tester au minimum :

```ts
updatePhaseSchema.safeParse({ description: undefined })
```

doit échouer.

Tester aussi :

```ts
updatePhaseSchema.safeParse({
  name: undefined,
  description: undefined
})
```

doit échouer.

Confirmer que :

```ts
updatePhaseSchema.safeParse({ description: null })
```

réussit toujours.

### Projets

Ajouter les scénarios équivalents pour `updateProjectSchema`.

Ne supprime ni ne neutralise aucun test existant.

---

## 4. Tests obligatoires des repositories

### Repository des phases

Ajouter un test de non-régression démontrant qu’une clé `undefined` mélangée à une vraie modification est ignorée.

Exemple de scénario :

1. créer une phase avec une description ;
2. appeler `update` avec :

   ```ts
   {
     name: 'Nouveau nom',
     description: undefined
   }
   ```
3. vérifier que :

   * le nom est modifié ;
   * la description initiale est conservée ;
   * aucune valeur `null` involontaire n’est persistée.

Le cast utilisé uniquement pour simuler une entrée JavaScript runtime peut être localisé dans le test et clairement justifié. N’ajoute pas de `any`.

Ajouter également un test confirmant qu’un objet ne contenant que des valeurs `undefined` est rejeté avant toute requête SQL.

### Repository des projets

Ajouter les mêmes tests de non-régression pour `projectsRepository`.

Vérifier notamment qu’un champ nullable existant n’est pas effacé par une propriété `undefined`.

---

## 5. Tests complémentaires recommandés sur les positions

Ajoute les tests mineurs recommandés par la review dans :

`src/main/database/repositories/phasesRepository.test.ts`

### Position explicite élevée

Créer une phase à la position `10`, puis une phase sans position.

Attendu :

```ts
next.position === 11
```

### Collision de position lors d’un update

Créer deux phases aux positions `0` et `1`.

Tenter de modifier la première avec :

```ts
{
  name: 'Nom modifié',
  position: 1
}
```

Vérifier :

* que l’opération échoue ;
* que le nom initial reste inchangé ;
* que la position initiale reste `0`.

### Collision de position lors d’une création

Créer une phase à la position `0`.

Tenter une seconde création à la position `0` dans le même projet.

Vérifier que l’opération échoue et qu’aucune phase supplémentaire n’est créée.

### Position explicite zéro

Créer une phase existante à une position supérieure, par exemple `5`.

Créer ensuite une autre phase avec :

```ts
position: 0
```

Vérifier que la position `0` est respectée et n’est pas confondue avec une position absente.

---

## 6. Améliorations mineures autorisées

Tu peux également appliquer les corrections documentaires ou de tests suivantes si elles restent locales.

### Test ON DELETE SET NULL

Dans le test relationnel des tâches :

* vérifier explicitement que la tâche existe toujours ;
* puis vérifier que `phase_id` vaut `null`.

Évite un accès direct à une ligne potentiellement `undefined`.

### Transaction de création

Ne supprime pas la transaction.

Reformule uniquement le commentaire dans le code et le rapport afin de ne pas prétendre qu’elle protège contre l’entrelacement de plusieurs handlers IPC dans le même processus synchrone.

Présente-la plutôt comme une garantie d’atomicité de l’opération composée :

```text
calcul de la prochaine position
+
insertion
```

et comme une protection contre une écriture partielle en cas d’échec.

---

## 7. Périmètre à respecter

Ne modifie pas :

* les migrations ;
* les handlers IPC ;
* le preload ;
* les contrats partagés IPC ;
* le renderer ;
* les dépendances ;
* l’interface CRUD des projets.

Les modifications autorisées concernent uniquement :

```text
src/shared/schemas/phase.ts
src/shared/schemas/phase.test.ts
src/main/database/repositories/phasesRepository.ts
src/main/database/repositories/phasesRepository.test.ts

src/shared/schemas/project.ts
src/shared/schemas/project.test.ts
src/main/database/repositories/projectsRepository.ts
src/main/database/repositories/projectsRepository.test.ts

workflow/reports/RAPPORT_PHASE_3.5.md
workflow/reports/RAPPORT_CORRECTIONS_REVIEW_PHASE_3.5.md
```

Adapte cette liste uniquement si les noms exacts diffèrent dans le dépôt.

---

## 8. Validations obligatoires

Exécute d’abord les tests ciblés concernés, puis la validation complète :

```powershell
npm run typecheck
npm run test
npm run build
```

Ne masque aucune erreur.

N’utilise pas :

```text
any
@ts-ignore
@ts-expect-error
skipLibCheck
```

Ne désactive aucun test.

---

## 9. Mise à jour du rapport de phase

Mets à jour :

`workflow/reports/RAPPORT_PHASE_3.5.md`

Le rapport doit désormais mentionner :

* le défaut identifié par la review ;
* son origine commune avec le repository des projets ;
* la correction appliquée ;
* la distinction explicite entre clé absente, `undefined` et `null` ;
* les nouveaux tests ajoutés ;
* le nombre final réel de tests ;
* la justification corrigée de la transaction ;
* les résultats finaux du typecheck, des tests et du build.

Ne conserve aucune affirmation devenue obsolète.

---

## 10. Rapport de correction

Crée :

`workflow/reports/RAPPORT_CORRECTIONS_REVIEW_PHASE_3.5.md`

Ce rapport doit contenir :

* le constat important corrigé ;
* les fichiers concernés ;
* le comportement avant correction ;
* le comportement après correction ;
* les tests de non-régression ajoutés ;
* les tests complémentaires de positions ajoutés ;
* les corrections mineures traitées ;
* les constats non traités, avec justification ;
* les commandes exécutées ;
* les résultats exacts ;
* le nombre final de tests ;
* un verdict clair :

  * prêt pour validation technique ;
  * ou corrections encore nécessaires.

---

## 11. Vérification Git finale

À la fin, exécute :

```powershell
git status --short
git diff --stat
git diff
git ls-files --others --exclude-standard
```

Attention : plusieurs fichiers de la phase 3.5 sont encore non suivis et ne figureront pas dans `git diff`.

Lis explicitement les fichiers non suivis avant de conclure.

Ne lance ni :

```powershell
git add
```

ni commit Git.

Propose simplement le message de commit :

```text
feat: add phases schemas and repository
```

Commence par relire `workflow/reports/REVIEW_PHASE_3.5.md`, puis confirme brièvement les corrections que tu vas appliquer.
