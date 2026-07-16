# Rapport — Phase 3.3 : IPC et API preload pour les projets

## 1. Fichiers inspectés

- `src/main/index.ts`
- `src/main/windows/createMainWindow.ts`
- `src/main/windows/navigationPolicy.ts` / `.test.ts`
- `src/main/database/database.ts`
- `src/main/database/repositories/projectsRepository.ts`
- `src/preload/index.ts`
- `src/shared/contracts/themeFactoryApi.ts`
- `src/renderer/src/themeFactoryApi.d.ts`
- `src/renderer/src/pages/DashboardStatus.tsx`
- `src/shared/schemas/project.ts`
- `vitest.config.ts`
- `package.json`

Aucun canal IPC, aucun dossier `src/main/ipc`, et aucune API preload autre que `app.getInfo` n'existaient avant cette phase : `app.getInfo` est calculée directement dans le preload (sans IPC), ce qui confirme qu'il n'y avait pas encore de convention de canaux à respecter — la structure de cette phase est donc la première du genre dans ce dépôt.

## 2. Fichiers créés

- `src/shared/contracts/ipcChannels.ts` — registre unique des canaux IPC.
- `src/main/ipc/registerProjectsHandlers.ts` — handlers IPC du module `projects`.
- `src/main/ipc/registerProjectsHandlers.test.ts` — tests unitaires des handlers (mock `ipcMain` + repository).
- `src/main/ipc/registerProjectsHandlers.integration.test.ts` — test d'intégration ciblé (handler → repository réel → SQLite en mémoire).
- `src/preload/index.test.ts` — tests du contrat preload.

## 3. Fichiers modifiés

- `src/shared/schemas/project.ts` — `CreateProjectInput` change de `z.infer` (type de sortie) à `z.input` (type d'entrée). Voir section 12 pour la justification complète.
- `src/main/database/repositories/projectsRepository.ts` — suppression du type local `CreateProjectPayload` (contournement de la phase 3.2), remplacé par le type partagé `CreateProjectInput` désormais correct. Aucun changement de comportement.
- `src/main/index.ts` — création du repository `projects` à partir de la connexion déjà ouverte et enregistrement des handlers IPC, dans l'ordre d'initialisation existant.
- `src/preload/index.ts` — ajout de l'API `projects` (`list`, `getById`, `create`, `update`, `remove`) via `ipcRenderer.invoke`.
- `src/shared/contracts/themeFactoryApi.ts` — ajout de l'interface `ThemeFactoryProjectsApi` et extension de `ThemeFactoryApi` avec `projects`.

Aucune migration, aucun schéma SQL, aucune interface React CRUD n'a été touchée.

## 4. Canaux IPC ajoutés

Dans `src/shared/contracts/ipcChannels.ts` :

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

Ce registre est l'unique source des chaînes de canal : handlers, preload et tests l'importent tous, aucune chaîne littérale n'est dupliquée ailleurs.

## 5. Structure des payloads IPC

- `projects:list` — aucun argument.
- `projects:getById` — un seul argument : `id: string` (validé `z.uuid()`).
- `projects:create` — un seul argument : le payload de création brut (`unknown` côté handler, validé par `createProjectSchema`).
- `projects:update` — un seul argument, objet strict `{ id: string; input: UpdateProjectInput }` (validé par un schéma Zod composite, voir section 6).
- `projects:remove` — un seul argument : `id: string` (validé `z.uuid()`).

## 6. Schémas Zod utilisés dans chaque handler

- `projects:list` — aucune validation nécessaire (aucun argument).
- `projects:getById` / `projects:remove` — `projectIdSchema`, qui **réutilise** `projectSchema.shape.id` (donc exactement le même `z.uuid()` que le schéma de lecture partagé, sans redéfinition).
- `projects:create` — `createProjectSchema.parse(rawInput)` (le schéma partagé de la phase 3.1, identique à celui utilisé ensuite par le repository — pas de divergence).
- `projects:update` — un schéma composite local et strict :
  ```ts
  const updateProjectPayloadSchema = z
    .object({ id: projectIdSchema, input: updateProjectSchema })
    .strict()
  ```
  `updateProjectSchema` est le schéma partagé de la phase 3.1 (mêmes règles : objet vide refusé, champs techniques refusés).

## 7. Forme de `registerProjectsHandlers`

Factory-fonction (pas de classe, cohérent avec le style du repository et de `database.ts`) :

```ts
export function registerProjectsHandlers(
  { ipcMain, projectsRepository }: RegisterProjectsHandlersDependencies
): void
```

## 8. Manière dont le repository est injecté

Le repository est reçu explicitement dans l'objet de dépendances `RegisterProjectsHandlersDependencies { ipcMain, projectsRepository }`, jamais créé ni importé globalement par le module. `ipcMain` est également injecté, typé via une interface locale minimale `IpcMainLike` (`{ readonly handle: (channel, listener) => void }`) plutôt que le type complet `Electron.IpcMain`. Ce découplage volontaire permet :

- de tester les handlers avec un faux `ipcMain` (`Map` de canaux → listeners) sans démarrer Electron ;
- de tester avec un vrai repository SQLite en mémoire (test d'intégration) sans jamais toucher Electron ;
- au vrai `ipcMain` d'Electron de satisfaire structurellement `IpcMainLike` sans cast, donc aucune divergence de type en production (confirmé par `npm run typecheck`).

## 9. Manière dont les handlers sont enregistrés dans le main process

Dans `src/main/index.ts`, à l'intérieur de `app.whenReady().then(...)`, immédiatement après l'ouverture réussie de la base et avant la création de la fenêtre :

```ts
const projectsRepository = createProjectsRepository(database)
registerProjectsHandlers({ ipcMain, projectsRepository })

createMainWindow()
```

Ordre respecté (inchangé par rapport à l'existant, uniquement complété) :
1. ouverture de la base (`openDatabase`, qui applique déjà migrations + health check en interne) ;
2. création du repository à partir de **cette même connexion** (aucune deuxième connexion ouverte) ;
3. enregistrement des handlers ;
4. création de la fenêtre principale.

`app.whenReady().then(...)` ne s'exécute qu'une fois par cycle de vie de l'application (contrairement à `app.on('activate', ...)`, qui ne fait que recréer la fenêtre) : les handlers ne sont donc enregistrés qu'une seule fois.

## 10. Contrat exact de `window.themeFactoryApi.projects`

Dans `src/shared/contracts/themeFactoryApi.ts` :

```ts
export interface ThemeFactoryProjectsApi {
  readonly list: () => Promise<Project[]>
  readonly getById: (id: string) => Promise<Project | null>
  readonly create: (input: CreateProjectInput) => Promise<Project>
  readonly update: (id: string, input: UpdateProjectInput) => Promise<Project | null>
  readonly remove: (id: string) => Promise<boolean>
}

export interface ThemeFactoryApi {
  readonly app: { readonly getInfo: () => ThemeFactoryAppInfo }
  readonly projects: ThemeFactoryProjectsApi
}
```

Implémenté dans `src/preload/index.ts` avec `ipcRenderer.invoke` exclusivement (un seul appel par méthode, aucune méthode générique `invoke`/`send`/`on` exposée). Le typage global `Window.themeFactoryApi` (`src/renderer/src/themeFactoryApi.d.ts`) référence déjà `ThemeFactoryApi` : aucune modification n'y était nécessaire, l'extension du contrat partagé suffit à propager le typage complet côté renderer (vérifié par `npm run typecheck`, qui inclut `tsconfig.web.json`).

## 11. Types partagés ajoutés ou modifiés

- Ajouté : `ThemeFactoryProjectsApi` (`src/shared/contracts/themeFactoryApi.ts`).
- Modifié : `ThemeFactoryApi` — ajout du champ `projects: ThemeFactoryProjectsApi`.
- Modifié : `CreateProjectInput` (`src/shared/schemas/project.ts`) — voir section 12.
- Ajouté : `IPC_CHANNELS` (valeur constante, pas un type, mais nouveau contrat partagé structurant les canaux).
- Ajouté (dans `registerProjectsHandlers.ts`, non partagé au-delà du module IPC) : `IpcHandleListener`, `IpcMainLike`, `RegisterProjectsHandlersDependencies`.

## 12. Modification de `CreateProjectInput` et justification

**Avant** (phase 3.1) : `export type CreateProjectInput = z.infer<typeof createProjectSchema>` — c'est le type de *sortie* de Zod, dans lequel `status` est résolu par `.default('planning')` et donc **obligatoire**.

**Problème concret** : la phase 3.2 avait déjà buté sur cette même incohérence et l'avait contournée localement dans le repository avec un type dupliqué `CreateProjectPayload = z.input<typeof createProjectSchema>`. Cette phase demandait explicitement d'utiliser `CreateProjectInput` pour le contrat `window.themeFactoryApi.projects.create(input: CreateProjectInput)` — avec le type de sortie, un appel de création minimal `{ name: 'Projet minimal' }` (comportement explicitement requis par le prompt) n'aurait pas typechecké.

**Correction appliquée** : `CreateProjectInput` devient `z.input<typeof createProjectSchema>` — le type d'*entrée* du schéma, où `status` reste optionnel (résolu par Zod au `parse()`). C'est exactement la solution suggérée par les instructions de cette phase.

**Vérification des usages** (tous compatibles, aucune régression) :
- `src/shared/schemas/project.test.ts` (phase 3.1) : n'utilise pas `CreateProjectInput` comme annotation de type, seulement `createProjectSchema` directement — inchangé, toujours vert.
- `src/main/database/repositories/projectsRepository.ts` : utilisait un type local équivalent (`CreateProjectPayload`) ; remplacé directement par `CreateProjectInput` désormais correct, suppression de la duplication. Le corps de `create()` est inchangé (`createProjectSchema.parse(input)` reste la validation runtime).
- `src/preload/index.ts` et `src/shared/contracts/themeFactoryApi.ts` (nouveaux usages de cette phase) : `create(input: CreateProjectInput)` accepte bien `{ name: 'Projet minimal' }`.

Aucune autre partie du code ne référençait `CreateProjectInput` avant cette phase.

## 13. Tests unitaires des handlers (`registerProjectsHandlers.test.ts`)

23 tests, avec un faux `ipcMain` (Map de canaux → listeners capturés) et un faux repository (`vi.fn()` par méthode) :

- **Enregistrement** (3) : les cinq canaux sont enregistrés ; chaque canal une seule fois ; aucun canal inattendu.
- **`list`** (1) : appelle `repository.list()` une fois, retourne sa valeur.
- **`getById`** (3) : UUID valide → repository appelé avec cet id ; `null` du repository → `null` retourné ; UUID invalide → rejet sans appeler le repository.
- **`create`** (6) : payload minimal `{ name }` accepté ; statut par défaut `planning` appliqué avant l'appel repository ; normalisation `trim()` vérifiée ; nom vide refusé ; statut invalide refusé ; champs inconnus (`id`) refusés — dans les trois cas de refus, le repository n'est jamais appelé.
- **`update`** (7) : id + payload valides → `repository.update(id, input)` appelé avec exactement ces valeurs ; `null` explicite sur champ nullable accepté ; objet `input` vide refusé ; nom vide refusé ; UUID invalide refusé ; champs techniques (`createdAt`) refusés ; `null` du repository → `null` retourné.
- **`remove`** (3) : UUID valide → `true` retourné et repository appelé avec l'id ; `false` du repository → `false` retourné ; UUID invalide → rejet sans appel au repository.

## 14. Tests du preload (`src/preload/index.test.ts`)

9 tests, `electron` mocké via `vi.mock('electron', ...)` (`contextBridge.exposeInMainWorld` et `ipcRenderer.invoke` remplacés par des `vi.fn()`), module preload réimporté à chaque test (`vi.resetModules()` + `import('./index')`) :

- l'API est exposée sous le nom exact `'themeFactoryApi'` ;
- `app.getInfo` reste disponible et fonctionnelle ;
- aucun objet `ipcRenderer` brut ni méthode générique `invoke`/`send`/`on` n'est exposée (vérifié à la racine de l'API et sous `projects`) ;
- `projects.list()` invoque uniquement `projects:list`, sans argument ;
- `projects.getById(id)` transmet `(projects:getById, id)` ;
- `projects.create(input)` transmet `(projects:create, input)` ;
- `projects.update(id, input)` transmet `(projects:update, { id, input })` ;
- `projects.remove(id)` transmet `(projects:remove, id)` ;
- la surface de `projects` est figée aux cinq méthodes attendues (`create`, `getById`, `list`, `remove`, `update`), aucun canal arbitraire n'est accessible depuis le renderer.

## 15. Test d'intégration ciblé (`registerProjectsHandlers.integration.test.ts`)

1 test : handler IPC (faux `ipcMain` minimal) → `createProjectsRepository` réel → base SQLite `:memory:` migrée. Parcours complet `create → list → getById → update → remove` :
- `create` avec `{ name: 'Projet intégration' }` → projet créé avec `status: 'planning'` ;
- `list` → tableau de longueur 1 ;
- `getById` → projet identique à celui créé ;
- `update` avec `{ status: 'active' }` → `status` mis à jour ;
- `remove` → `true`, puis `getById` sur le même id → `null`.

Aucune fenêtre Electron réelle n'est démarrée ; seul `ipcMain.handle` est remplacé par un registre local.

## 16. Nombre total de tests ajoutés

- `registerProjectsHandlers.test.ts` : 23 tests
- `registerProjectsHandlers.integration.test.ts` : 1 test
- `preload/index.test.ts` : 9 tests

**Total : 33 nouveaux tests.**

## 17. Résultats exacts de la validation

### `npm run typecheck`
```
> theme-factory-companion@1.0.0 typecheck
> tsc -p tsconfig.node.json --noEmit && tsc -p tsconfig.web.json --noEmit
```
Aucune erreur (renderer inclus : `window.themeFactoryApi.projects.list()` type bien `Promise<Project[]>`).

### `npm run test`
```
> theme-factory-companion@1.0.0 test
> vitest run

 Test Files  13 passed (13)
      Tests  192 passed (192)
```
(159 tests précédents + 33 nouveaux de cette phase.)

### `npm run build`
```
> theme-factory-companion@1.0.0 build
> electron-vite build

✓ 14 modules transformed. (main)
out/main/index.js  21.02 kB
✓ 3 modules transformed. (preload)
out/preload/index.js  1.37 kB
✓ 34 modules transformed. (renderer)
../../out/renderer/index.html                 0.41 kB
../../out/renderer/assets/index-ClcV5aD7.css  2.87 kB
../../out/renderer/assets/index-pDMmlTAk.js   560.85 kB
```
Build réussi sans erreur.

## 18. Limites ou décisions techniques

- **`CreateProjectInput` redéfini** (section 12) : changement volontaire et documenté d'un type partagé déjà commité en phase 3.1, explicitement anticipé et autorisé par les instructions de cette phase, avec vérification de tous les usages existants.
- **`IpcMainLike` plutôt que `Electron.IpcMain`** : type d'injection volontairement minimal (une seule méthode `handle`), pour permettre des tests unitaires sans dépendance à Electron réel. Le vrai `ipcMain` d'Electron satisfait cette interface structurellement (confirmé par le typecheck), donc aucun cast n'est nécessaire côté production.
- **Réutilisation de `projectSchema.shape.id`** pour la validation UUID des handlers (`getById`, `update`, `remove`), plutôt qu'un nouveau schéma dupliqué : une seule source de vérité pour le format d'identifiant.
- **Double validation `create`** : le handler valide avec `createProjectSchema.parse` avant d'appeler `repository.create`, qui revalide en interne avec le même schéma. Redondant en apparence mais explicitement jugé acceptable par les instructions de cette phase (le handler protège la frontière IPC, le repository protège son contrat interne) ; aucune divergence de schéma entre les deux niveaux.
- **Pas de format global d'erreur IPC** : les erreurs Zod et SQLite remontent telles quelles via le rejet de la promesse `ipcMain.handle`/`ipcRenderer.invoke`, conformément à la contrainte de ne pas introduire de couche `{ success, error }` non demandée.
- **Aucune dépendance ajoutée** : `zod` était déjà présent depuis la phase 3.1 ; aucune nouvelle dépendance n'a été nécessaire pour cette phase.
- **Aucune incohérence bloquante détectée** entre le repository, les schémas partagés et l'architecture IPC/preload existante, hormis le point déjà documenté en section 12 (résolu dans le périmètre de cette phase).

## 19. Sortie exacte de `git status --short`

```
 M src/main/database/repositories/projectsRepository.ts
 M src/main/index.ts
 M src/preload/index.ts
 M src/shared/contracts/themeFactoryApi.ts
 M src/shared/schemas/project.ts
?? src/main/ipc/
?? src/preload/index.test.ts
?? src/shared/contracts/ipcChannels.ts
?? workflow/prompts/PHASE_3.3_PROMPT.md
```

(Les phases précédentes, y compris leurs rapports, ont été commitées entre-temps en dehors de cette phase ; seuls les fichiers ci-dessus reflètent le travail de la phase 3.3. `workflow/prompts/PHASE_3.3_PROMPT.md` n'a pas été modifié par cette implémentation.)

## 20. Confirmation d'enregistrement du rapport

Ce rapport a été enregistré en UTF-8 à l'emplacement :

```text
workflow/reports/RAPPORT_PHASE_3.3.md
```

Aucun autre rapport n'a été écrasé. Aucun commit Git n'a été effectué.
