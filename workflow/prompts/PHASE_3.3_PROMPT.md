# Phase 3.3 — IPC et API preload pour les projets

Tu travailles dans le dépôt **Theme Factory Companion**.

## État du projet

Les phases suivantes sont terminées, validées et commitées :

* Phase 0 — cadrage documentaire ;
* Phase 1 — socle Electron et interface générale ;
* Phase 2 — infrastructure SQLite ;
* Phase 3.1 — schémas Zod et types partagés pour les projets ;
* Phase 3.2 — repository SQLite `projects`.

Les fichiers déjà disponibles incluent notamment :

```text
src/shared/schemas/project.ts
src/main/database/repositories/projectsRepository.ts
```

Le repository expose :

```ts
list(): Project[]
getById(id: string): Project | null
create(input): Project
update(id: string, input: UpdateProjectInput): Project | null
remove(id: string): boolean
```

Nous commençons maintenant :

# Objectif

Exposer les opérations autorisées du module `projects` au renderer React via une chaîne sécurisée :

```text
renderer
→ window.themeFactoryApi.projects
→ preload
→ IPC autorisé
→ handlers du main process
→ projectsRepository
→ SQLite
```

Cette phase doit ajouter uniquement :

* les canaux IPC autorisés pour les projets ;
* les contrats partagés nécessaires ;
* les handlers IPC du main process ;
* l’enregistrement de ces handlers ;
* l’API preload `window.themeFactoryApi.projects` ;
* les types globaux associés ;
* les tests unitaires des handlers et du contrat preload.

Cette phase ne doit créer aucune interface CRUD React.

---

# Étape préalable obligatoire

Avant toute modification :

1. inspecte l’organisation actuelle de :

   * `src/main/ipc` ;
   * `src/preload` ;
   * `src/shared/contracts` ;
   * les déclarations de `window.themeFactoryApi` ;
2. inspecte les canaux IPC déjà existants ;
3. inspecte le health check déjà exposé au renderer ;
4. inspecte la manière dont les handlers sont enregistrés dans le main process ;
5. inspecte :

   * `src/shared/schemas/project.ts` ;
   * `src/main/database/repositories/projectsRepository.ts` ;
   * les tests IPC et preload existants ;
6. réutilise strictement les conventions actuelles.

Ne crée pas une architecture parallèle.

Si le projet n’a pas encore de structure explicite pour certains éléments, ajoute la structure minimale cohérente avec l’architecture existante.

---

# Contraintes d’architecture

Respecter impérativement :

* SQLite uniquement dans le main process ;
* aucun import de `better-sqlite3` dans le preload ou le renderer ;
* aucun accès direct du renderer à Electron ;
* `contextIsolation` conservé ;
* `nodeIntegration` conservé à `false` ;
* API preload limitée et explicitement définie ;
* canaux IPC explicitement autorisés ;
* validation Zod dans les handlers avant tout appel au repository ;
* aucune donnée non validée transmise au repository ;
* aucune exposition générique de `ipcRenderer`.

Ne pas exposer :

```ts
window.ipcRenderer
window.electron
window.require
```

Le renderer doit uniquement accéder à :

```ts
window.themeFactoryApi.projects
```

---

# Canaux IPC attendus

Ajouter des canaux explicites pour :

```text
projects:list
projects:getById
projects:create
projects:update
projects:remove
```

Centralise les noms de canaux selon la convention actuelle du dépôt.

Exemple indicatif :

```ts
export const IPC_CHANNELS = {
  projects: {
    list: 'projects:list',
    getById: 'projects:getById',
    create: 'projects:create',
    update: 'projects:update',
    remove: 'projects:remove'
  }
} as const
```

Adapte cette forme si un registre de canaux existe déjà.

Ne duplique pas les chaînes littérales dans plusieurs fichiers.

---

# Contrats partagés

Définis les types de l’API projets dans un emplacement partagé cohérent.

L’API exposée au renderer doit conceptuellement fournir :

```ts
projects: {
  list(): Promise<Project[]>
  getById(id: string): Promise<Project | null>
  create(input: CreateProjectInput): Promise<Project>
  update(id: string, input: UpdateProjectInput): Promise<Project | null>
  remove(id: string): Promise<boolean>
}
```

Attention au type de création.

Le schéma `createProjectSchema` possède une valeur par défaut pour `status`. Le type d’entrée doit donc permettre :

```ts
{ name: 'Projet minimal' }
```

Utilise le type d’entrée Zod approprié si le type partagé actuel inféré en sortie rend `status` obligatoire.

Évite de redéfinir manuellement des types déjà dérivables depuis Zod.

Tu peux ajouter dans `project.ts` un type partagé d’entrée explicite, par exemple :

```ts
export type CreateProjectInput = z.input<typeof createProjectSchema>
export type CreatedProject = z.output<typeof createProjectSchema>
```

uniquement si cela améliore réellement la cohérence du contrat global.

Si tu modifies un type partagé existant, vérifie tous ses usages et conserve la compatibilité du repository.

Ne crée pas de duplication locale supplémentaire entre repository, handlers, preload et renderer.

---

# Validation des identifiants

Créer ou réutiliser un schéma Zod strict pour les identifiants de projet :

```ts
z.uuid()
```

Les handlers suivants doivent valider l’identifiant avant d’appeler le repository :

* `getById`
* `update`
* `remove`

Une chaîne invalide doit produire une erreur Zod et le repository ne doit pas être appelé.

Ne laisse pas le repository être le premier niveau de validation pour les données IPC.

---

# Handlers IPC du main process

Créer un module cohérent, par exemple :

```text
src/main/ipc/registerProjectsHandlers.ts
```

ou selon les conventions existantes.

Le module doit recevoir explicitement les dépendances nécessaires, en particulier le repository.

Exemple conceptuel :

```ts
registerProjectsHandlers(projectsRepository)
```

ou :

```ts
registerProjectsHandlers({
  ipcMain,
  projectsRepository
})
```

Privilégie une injection permettant des tests unitaires sans ouvrir une base SQLite réelle.

Les handlers doivent utiliser exclusivement `ipcMain.handle`.

Ne pas utiliser `ipcMain.on` pour ces opérations asynchrones de type requête/réponse.

## `projects:list`

* aucun argument ;
* appelle `repository.list()` ;
* retourne `Project[]`.

## `projects:getById`

* reçoit un identifiant ;
* valide l’identifiant avec Zod ;
* appelle `repository.getById(id)` ;
* retourne `Project | null`.

## `projects:create`

* reçoit un payload de création ;
* valide et normalise avec `createProjectSchema.parse(...)` ;
* appelle `repository.create(...)` avec les données validées ;
* retourne le projet créé.

Évite une divergence entre le schéma utilisé par le handler et celui utilisé par le repository.

La double validation handler + repository est acceptable : le handler protège la frontière IPC et le repository protège son contrat interne.

## `projects:update`

Le payload IPC doit avoir une forme claire et stricte, par exemple :

```ts
{
  id: string
  input: UpdateProjectInput
}
```

ou deux arguments distincts si c’est la convention du dépôt.

Principes :

* valider l’identifiant ;
* valider `input` avec `updateProjectSchema` ;
* refuser un objet vide ;
* appeler `repository.update(id, input)` ;
* retourner `Project | null`.

## `projects:remove`

* valide l’identifiant ;
* appelle `repository.remove(id)` ;
* retourne `boolean`.

---

# Enregistrement des handlers

Intègre `registerProjectsHandlers` au cycle d’initialisation actuel du main process.

Contraintes :

* utiliser la connexion SQLite déjà ouverte ;
* créer le repository à partir de cette connexion ;
* ne pas ouvrir une deuxième connexion ;
* ne pas enregistrer plusieurs fois les mêmes handlers lors d’un même cycle de vie ;
* conserver l’ordre d’initialisation actuel :

  * ouverture de la base ;
  * migrations ;
  * health check ;
  * création du repository ;
  * enregistrement des handlers ;
  * création de la fenêtre, selon les conventions existantes.

Si les handlers existants sont enregistrés ailleurs, suis cette organisation.

Ne refactorise pas globalement le bootstrap Electron.

---

# API preload

Étendre l’API existante :

```ts
window.themeFactoryApi.projects
```

Méthodes attendues :

```ts
list()
getById(id)
create(input)
update(id, input)
remove(id)
```

Chaque méthode doit appeler uniquement son canal autorisé avec `ipcRenderer.invoke`.

Exemple conceptuel :

```ts
projects: {
  list: () => ipcRenderer.invoke(IPC_CHANNELS.projects.list),
  getById: (id) => ipcRenderer.invoke(IPC_CHANNELS.projects.getById, id),
  create: (input) => ipcRenderer.invoke(IPC_CHANNELS.projects.create, input),
  update: (id, input) =>
    ipcRenderer.invoke(IPC_CHANNELS.projects.update, { id, input }),
  remove: (id) => ipcRenderer.invoke(IPC_CHANNELS.projects.remove, id)
}
```

Ne pas exposer directement `ipcRenderer`.

Ne pas ajouter de méthode générique du type :

```ts
invoke(channel, ...args)
send(channel, ...args)
on(channel, callback)
```

---

# Typage global du renderer

Mettre à jour la déclaration TypeScript de :

```ts
window.themeFactoryApi
```

afin que les futures interfaces React bénéficient d’un typage complet.

Les types doivent être importés depuis `shared`.

Aucun type `any` ne doit être ajouté.

Le typecheck renderer doit garantir que :

```ts
window.themeFactoryApi.projects.list()
```

retourne bien :

```ts
Promise<Project[]>
```

---

# Gestion des erreurs

Ne crée pas encore de format global complexe de réponse IPC.

Les handlers peuvent laisser remonter :

* les erreurs Zod ;
* les erreurs SQLite inattendues ;
* les erreurs internes du repository.

Les absences normales restent représentées par :

```ts
null
```

pour `getById` et `update`, et :

```ts
false
```

pour `remove`.

Ne transforme pas toutes les erreurs en `{ success, error }` sans convention existante.

Ne masque aucune erreur.

---

# Tests obligatoires des handlers

Créer des tests unitaires sans démarrer Electron réellement.

Mocker ou injecter :

* une version minimale de `ipcMain.handle` ;
* un repository `projects`.

Capturer les callbacks enregistrés pour chaque canal, puis les appeler directement.

Couvrir au minimum :

## Enregistrement

* les cinq canaux sont enregistrés ;
* chaque canal est enregistré une seule fois ;
* aucun canal inattendu n’est enregistré.

## `list`

* appelle `repository.list()` une fois ;
* retourne sa valeur.

## `getById`

* accepte un UUID valide ;
* appelle le repository avec l’UUID validé ;
* retourne un projet ;
* retourne `null` si le repository retourne `null` ;
* refuse un UUID invalide ;
* n’appelle pas le repository si l’UUID est invalide.

## `create`

* accepte un payload minimal `{ name }` ;
* applique le statut par défaut `planning` avant l’appel au repository si le contrat choisi le prévoit ;
* normalise les chaînes avec Zod ;
* transmet uniquement les données validées ;
* retourne le projet créé ;
* refuse un nom vide ;
* refuse un statut invalide ;
* refuse les champs inconnus ;
* n’appelle pas le repository lorsque la validation échoue.

## `update`

* valide l’identifiant ;
* valide le payload partiel ;
* accepte une mise à jour valide ;
* accepte `null` pour effacer un champ nullable ;
* refuse un objet vide ;
* refuse un nom vide ;
* refuse un UUID invalide ;
* refuse les champs techniques ou inconnus ;
* n’appelle pas le repository si la validation échoue ;
* retourne `null` si le repository retourne `null`.

## `remove`

* valide l’identifiant ;
* retourne `true` lorsque le repository retourne `true` ;
* retourne `false` lorsque le repository retourne `false` ;
* refuse un UUID invalide ;
* n’appelle pas le repository si l’identifiant est invalide.

---

# Tests obligatoires du preload

Selon les conventions existantes, ajoute des tests couvrant le contrat preload.

Mocke :

```ts
contextBridge.exposeInMainWorld
ipcRenderer.invoke
```

Vérifie au minimum :

* l’API est exposée sous le nom exact `themeFactoryApi` ;
* l’API existante reste disponible ;
* `projects.list()` utilise uniquement `projects:list` ;
* `projects.getById(id)` transmet correctement l’identifiant ;
* `projects.create(input)` transmet correctement le payload ;
* `projects.update(id, input)` transmet la structure attendue ;
* `projects.remove(id)` transmet correctement l’identifiant ;
* aucun objet `ipcRenderer` brut n’est exposé ;
* aucun canal arbitraire ne peut être fourni par le renderer.

Ne transforme pas le preload en couche de validation métier : la validation reste dans les handlers.

---

# Tests d’intégration ciblés

Ajoute uniquement si l’architecture actuelle permet un test simple sans lancer une vraie fenêtre Electron.

Un test ciblé peut vérifier :

```text
handler IPC
→ repository réel en mémoire
→ SQLite
```

pour un parcours simple :

```text
create
→ list
→ getById
→ update
→ remove
```

Ce test est recommandé mais ne doit pas entraîner une infrastructure de test Electron lourde.

Les tests unitaires des handlers et du preload restent obligatoires.

---

# Contraintes strictes de périmètre

Ne crée pas dans cette phase :

* d’interface React CRUD ;
* de page Projects fonctionnelle ;
* de formulaire ;
* de sélection de projet actif ;
* de navigation supplémentaire ;
* de repository pour les phases ;
* de journal d’activité ;
* de nouvelle migration ;
* de modification du schéma SQLite ;
* d’API IPC générique ;
* de système global de sérialisation d’erreurs ;
* de système de notifications ;
* de refactorisation générale du main process ;
* de commit Git.

Ne modifie aucun fichier sans lien direct avec cette phase.

Ne désactive aucun test.

Ne masque aucune erreur TypeScript.

N’ajoute pas `skipLibCheck`.

N’ajoute pas de dépendance sans nécessité stricte et documentée.

---

# Validation obligatoire

Après l’implémentation, exécute dans cet ordre :

```bash
npm run typecheck
npm run test
npm run build
```

Corrige toute erreur liée à cette phase.

Exécute ensuite :

```bash
git status --short
```

Ne réalise aucun commit.

---

# Archivage automatique du rapport

À la fin de la phase :

1. affiche le rapport complet dans le chat Claude Code ;
2. enregistre exactement le même rapport dans :

```text
workflow/reports/RAPPORT_PHASE_3.3.md
```

Le fichier doit être encodé en UTF-8.

N’écrase aucun autre rapport.

Ne modifie pas :

```text
workflow/prompts/PHASE_3.3_PROMPT.md
```

---

# Rapport final attendu

Le rapport doit contenir :

1. les fichiers inspectés ;
2. les fichiers créés ;
3. les fichiers modifiés ;
4. les canaux IPC ajoutés ;
5. la structure des payloads IPC ;
6. les schémas Zod utilisés dans chaque handler ;
7. la forme de `registerProjectsHandlers` ;
8. la manière dont le repository est injecté ;
9. la manière dont les handlers sont enregistrés dans le main process ;
10. le contrat exact de `window.themeFactoryApi.projects` ;
11. les types partagés ajoutés ou modifiés ;
12. les éventuelles modifications apportées à `CreateProjectInput` et leur justification ;
13. les tests unitaires des handlers ;
14. les tests du preload ;
15. les éventuels tests d’intégration ;
16. le nombre total de tests ajoutés ;
17. les résultats exacts de :

    * `npm run typecheck`
    * `npm run test`
    * `npm run build`
18. les limites ou décisions techniques ;
19. la sortie exacte de :

```bash
git status --short
```

20. la confirmation d’enregistrement du rapport dans :

```text
workflow/reports/RAPPORT_PHASE_3.3.md
```

Arrête-toi après le rapport et attends la validation manuelle.
