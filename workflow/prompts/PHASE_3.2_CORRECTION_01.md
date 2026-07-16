Corrige uniquement le test d’ordre déterministe de la phase 3.2.

Problème observé :

Dans `projectsRepository.test.ts`, le test :

```ts
it('retourne les projets dans un ordre déterministe (created_at DESC, id DESC)', ...)
```

crée deux projets avec l’horloge réelle puis suppose que le second sera toujours le premier.

Les deux créations peuvent avoir le même `created_at`. Dans ce cas, l’ordre secondaire dépend de `id DESC`, alors que les UUID sont aléatoires. Le test est donc potentiellement intermittent.

Correction attendue :

* injecter dans ce test une horloge déterministe produisant deux timestamps ISO distincts ;
* créer un repository local avec `createProjectsRepository(db, { now: ... })` ;
* vérifier que le projet ayant le timestamp le plus récent apparaît en premier ;
* conserver la requête SQL actuelle `ORDER BY created_at DESC, id DESC` ;
* ne modifier aucun autre comportement ;
* ne refactoriser aucun autre fichier.

Ajoute également, si cela reste simple, un test distinct du critère secondaire `id DESC` en insérant directement deux lignes ayant le même `created_at` et des identifiants déterministes compatibles avec `projectSchema`.

Attention : `projectSchema` impose des UUID valides. Utilise donc deux UUID valides dont l’ordre lexical est connu.

Après correction, exécute :

```bash
npm run typecheck
npm run test
npm run build
git status --short
```

Mets ensuite à jour :

```text
workflow/reports/RAPPORT_PHASE_3.2.md
```

pour indiquer la correction du test d’ordre et les nouveaux résultats exacts.

Ne réalise aucun commit Git.
