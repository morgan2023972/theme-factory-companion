# REVIEW — Phase 3.6 : IPC et API preload des phases

## 0. Remarque préalable sur le prompt de review

`workflow/prompts/PHASE_3.6_REVIEW_PROMPT.md` ne contient, sur le dépôt réel, qu'un renvoi circulaire vers lui-même (9 lignes : « lis et applique strictement `workflow/prompts/PHASE_3.6_REVIEW_PROMPT.md` »), sans détailler de critères propres à la Phase 3.6 — contrairement à `PHASE_3.5_REVIEW_PROMPT.md`, qui listait des points de contrôle précis. En l'absence de critères spécifiques dans ce fichier, cette review reprend la méthodologie indépendante déjà appliquée aux phases 3.4 et 3.5 (inspection Git d'abord, vérification de chaque affirmation du rapport dans le code réel, exécution des validations, classement des constats par gravité, verdict unique), adaptée au périmètre IPC/preload de la Phase 3.6. Ce point est signalé comme observation, pas comme défaut de la phase elle-même.

## 1. Inspection Git

```bash
git status --short
```
```
 M src/main/index.ts
 M src/preload/index.test.ts
 M src/preload/index.ts
 M src/renderer/src/pages/ProjectsPage.test.tsx
 M src/shared/contracts/ipcChannels.ts
 M src/shared/contracts/themeFactoryApi.ts
?? RAPPORT_PHASE_3.6.txt
?? src/main/ipc/registerPhasesHandlers.integration.test.ts
?? src/main/ipc/registerPhasesHandlers.test.ts
?? src/main/ipc/registerPhasesHandlers.ts
?? workflow/prompts/PHASE_3.6_PROMPT.md
?? workflow/prompts/PHASE_3.6_REVIEW_PROMPT.md
?? workflow/reports/RAPPORT_PHASE_3.6.md
```

`git diff --stat` : 6 fichiers suivis modifiés, 97 insertions / 1 suppression — conforme à ce qu'annonce `RAPPORT_PHASE_3.6.md`. `git diff -- package.json package-lock.json` est vide : aucune dépendance ajoutée, conforme à l'affirmation du rapport.

Tous les fichiers non suivis ont été lus intégralement (`registerPhasesHandlers.ts`, ses deux fichiers de tests, et les fichiers de référence `registerProjectsHandlers.ts`/`.test.ts`/`.integration.test.ts`, `phase.ts`, `phasesRepository.ts`).

## 2. Vérification des canaux IPC et du contrat partagé

- `IPC_CHANNELS.phases` (`src/shared/contracts/ipcChannels.ts`) ajoute exactement 5 canaux (`listByProjectId`, `getById`, `create`, `update`, `remove`), tous préfixés `phases:`, cohérents avec le préfixe `projects:` existant. Aucune chaîne de canal n'est dupliquée ailleurs : `grep -rn "'phases:" src` en dehors de `ipcChannels.ts` ne retourne rien.
- `ThemeFactoryPhasesApi` (`src/shared/contracts/themeFactoryApi.ts`) est construit exclusivement à partir des types déjà exportés par `phase.ts` (`Phase`, `CreatePhaseInput`, `UpdatePhaseInput`) — aucune interface manuelle dupliquant ces champs.
- `ThemeFactoryApi.phases` est correctement ajouté comme propriété `readonly` obligatoire, au même niveau que `projects`.

Aucun défaut trouvé sur cette section.

## 3. Vérification des handlers IPC (`registerPhasesHandlers.ts`)

- `phaseIdSchema = phaseSchema.shape.id` réutilise le schéma UUID déjà défini pour `Phase.id`, sans duplication — même stratégie que `projectIdSchema` dans `registerProjectsHandlers.ts`.
- `projectId` (identifiant isolé, sans schéma partagé équivalent) est validé par un `z.uuid()` local minimal, exactement comme le prompt l'autorisait explicitement (« s'il n'existe pas encore de schéma partagé adapté... utiliser une validation Zod locale minimale »). Ce n'est pas une abstraction générique excessive : une seule ligne, un seul usage.
- Les 5 handlers valident systématiquement leurs entrées avant tout appel au repository (`.parse(...)` avant `phasesRepository.*`), ne font jamais confiance à une donnée brute du renderer, et retournent directement le résultat du repository sans transformation — conforme aux exigences des sections 3 et suivantes du prompt d'implémentation.
- Le handler `update` utilise `updatePhasePayloadSchema = z.object({ id: phaseIdSchema, input: updatePhaseSchema }).strict()`, qui réutilise `updatePhaseSchema` tel quel : la distinction absente/`undefined`/`null` établie et corrigée en Phase 3.5 est donc automatiquement respectée sans nouveau code à risque. Vérifié par exécution réelle (tests `accepte null pour effacer un champ nullable`, `conserve les mises à jour partielles`).
- `projectId` reste exclu de `updatePhaseSchema` (hérité de 3.5) : un payload de mise à jour contenant `projectId` est bien rejeté comme champ inconnu — vérifié par le test dédié et par lecture du schéma strict.
- Aucun `any`, `@ts-ignore`, `@ts-expect-error` dans le fichier. `IpcMainLike`/`IpcHandleListener` sont réutilisés par import de type depuis `registerProjectsHandlers.ts`, évitant une duplication de ces types utilitaires.
- Redondance de validation constatée mais non nouvelle : le handler `create` appelle `createPhaseSchema.parse(rawInput)` puis transmet le résultat à `phasesRepository.create`, qui ré-exécute lui-même `createPhaseSchema.parse(input)` en interne (`phasesRepository.ts` ligne ~146). Ce double parsing existe déjà à l'identique dans le couple `registerProjectsHandlers.ts`/`projectsRepository.ts` (Phase 3.3/3.2) : ce n'est donc pas un défaut introduit par cette phase, seulement une redondance héritée et cohérente avec l'architecture actuelle (voir SUGGESTION #1).

## 4. Vérification de l'enregistrement dans `src/main/index.ts`

- Une seule connexion SQLite (`database`) est ouverte ; `phasesRepository` est créé sur cette même connexion, comme `projectsRepository`. Aucune seconde connexion, aucune seconde instance indépendante.
- `registerPhasesHandlers({ ipcMain, phasesRepository })` est appelé une seule fois, après `registerProjectsHandlers`, avant `createMainWindow()` — respecte l'ordre d'initialisation imposé (ouverture DB → migrations/health check déjà en place → repositories → handlers IPC → fenêtre).
- Aucun double enregistrement possible : `app.whenReady().then(...)` ne s'exécute qu'une fois par démarrage.

## 5. Vérification du preload (`src/preload/index.ts`)

- Chaque méthode `phases.*` appelle `ipcRenderer.invoke` avec un canal exclusivement issu de `IPC_CHANNELS.phases`, jamais de chaîne littérale.
- `update(id, input)` construit `{ id, input }`, cohérent avec la structure attendue côté handler (`updatePhasePayloadSchema`).
- Aucune méthode générique `invoke`/`send`/`on`, aucun objet `ipcRenderer` brut exposé — vérifié par lecture et par le test dédié (`n'expose aucun objet ipcRenderer brut...`).
- Le typage de retour (`as Promise<Phase[]>`, etc.) est un simple assertion de type sur la valeur retournée par `ipcRenderer.invoke` (qui retourne `Promise<any>` côté Electron) — pattern strictement identique à celui déjà utilisé pour `projects`, non spécifique à cette phase et déjà accepté précédemment.

## 6. Vérification des tests

### `registerPhasesHandlers.test.ts` (26 tests, recomptés par `grep -c "  it("`)

Couvre : enregistrement des 5 canaux (une fois chacun, aucun canal inattendu), et pour chaque opération au moins un cas valide et un cas de rejet sans appel au repository. Les assertions vérifient des valeurs concrètes (`toHaveBeenCalledWith(...)`, `toEqual(...)`), pas seulement `toBeDefined()` — pas de test tautologique repéré. Le test « conserve les mises à jour partielles sans les transformer en remplacement complet » vérifie explicitement que `repository.update` reçoit `{ position: 3 }` et non un objet fusionné avec d'autres champs.

### `registerPhasesHandlers.integration.test.ts` (1 test)

Scénario réel avec SQLite `:memory:`, vraies migrations, vrai `phasesRepository` et vrai `projectsRepository` : création d'un projet, création de deux phases (vérifiant que la seconde obtient `position: 1`), vérification de l'ordre retourné par `listByProjectId` via les identifiants (`[created.id, secondCreated.id]`, pas seulement une longueur), modification réelle persistée (vérifiée en relisant directement via `phasesRepository.getById`, pas seulement via le retour du handler), suppression, puis re-vérification de la liste restante. La base est fermée dans `afterEach`. Couvre bien le parcours minimal demandé par le prompt d'implémentation (section 9), y compris la vérification d'ordre liée aux positions.

### `preload/index.test.ts` (+6 tests, 15 au total)

Couvre les 5 méthodes `phases.*` (canal + arguments transmis), l'absence de méthode générique sur `api.phases`, et la surface figée (`Object.keys(api.phases)` strictement égale aux 5 méthodes attendues). Les tests `projects.*` existants n'ont subi aucune modification ni suppression — non-régression confirmée par re-exécution.

### `ProjectsPage.test.tsx`

Seul changement : ajout d'un stub `phases` typé (`ThemeFactoryApi['phases']`) au mock local de l'API, rendu nécessaire par l'ajout de la propriété obligatoire `phases` à l'interface partagée. Aucun scénario de test existant n'a été modifié ou affaibli ; re-exécution confirmée sans régression.

### Recomptage global

`Test Files 18 passed (18)` / `Tests 325 passed (325)` — recompté par exécution réelle pendant cette review (résultat identique à celui annoncé dans le rapport). 292 (Phase 3.5) + 26 + 1 + 6 = 325 : l'arithmétique du rapport est exacte.

## 7. Vérification du périmètre architectural

- Aucune migration modifiée (`src/main/database/migrations/` absent de `git diff --stat`).
- Aucun schéma ni repository métier modifié (`phase.ts`, `phasesRepository.ts`, `project.ts`, `projectsRepository.ts` absents du diff).
- Aucune page ou composant renderer fonctionnel modifié — seul un fichier de test renderer, pour une raison de typage strict, sans impact sur les scénarios testés.
- Aucune dépendance ajoutée (diff `package.json`/`package-lock.json` vide).
- Aucun `any`, `@ts-ignore`, `@ts-expect-error`, `.skip`, `.only` dans les fichiers créés ou modifiés de cette phase, ni ailleurs dans le dépôt (`grep` négatif).
- Aucune interface React de gestion des phases, aucun formulaire, aucun réordonnancement, aucune tâche/checklist/tableau de bord/journal — confirmé par lecture du diff complet.
- `npm run typecheck`, `npm run test`, `npm run build` ré-exécutés indépendamment pendant cette review, résultats identiques à ceux du rapport.
- `npm run dev` : les processus Electron réels démarrent (main, GPU, réseau, renderer visibles dans la liste des processus du système), aucune exception dans le log du processus main après `starting electron app...`. Une variable d'environnement `ELECTRON_RUN_AS_NODE=1` déjà positionnée dans le shell de review empêchait un premier lancement (`TypeError: ... reading 'whenReady'`) — confirmé comme un artefact d'environnement du terminal, sans rapport avec le code, en relançant avec `env -u ELECTRON_RUN_AS_NODE npm run dev`, qui démarre normalement. Le rapport documentait déjà correctement ce point.

## 8. Vérification des affirmations du rapport

| Affirmation du rapport | Vérifiée | Détail |
|---|---|---|
| 5 canaux IPC `phases:*` centralisés | ✅ | Confirmé dans `ipcChannels.ts`, aucune chaîne dispersée. |
| API finale `window.themeFactoryApi.phases` avec les 5 signatures annoncées | ✅ | Confirmé dans `themeFactoryApi.ts` et `preload/index.ts`. |
| Aucune seconde connexion SQLite | ✅ | Confirmé dans `main/index.ts` : un seul `openDatabase(...)`. |
| Distinction absente/`undefined`/`null` respectée pour `update` | ✅ | Héritée directement de `updatePhaseSchema` (Phase 3.5), aucun nouveau code de mapping introduit dans le handler. |
| 325/325 tests, 18 fichiers | ✅ | Recompté et ré-exécuté, identique. |
| Aucune dépendance ajoutée | ✅ | `git diff -- package.json package-lock.json` vide. |
| Ajustement de `ProjectsPage.test.tsx` limité au mock, sans modification de scénario | ✅ | Confirmé par lecture du diff exact (7 lignes ajoutées, 1 modifiée). |
| `npm run dev` : démarrage propre, aucune erreur IPC | ✅ | Confirmé par ré-exécution indépendante ; l'incident `ELECTRON_RUN_AS_NODE` est bien un artefact d'environnement documenté, pas un défaut caché. |

Aucune affirmation fausse, exagérée ou non prouvée trouvée dans `RAPPORT_PHASE_3.6.md`.

## 9. Constats

Aucun défaut **BLOQUANT** ni **IMPORTANT** identifié.

**MINEUR**

Aucun.

**SUGGESTION**

1. **Couplage de type entre modules IPC** — `src/main/ipc/registerPhasesHandlers.ts:10` importe `IpcMainLike` (type) depuis `registerProjectsHandlers.ts`, plutôt que depuis un fichier de types partagé dédié (ex. `src/main/ipc/types.ts`). Fonctionnellement inoffensif (import de type uniquement, effacé à la compilation, aucun risque de cycle runtime), mais crée une dépendance directionnelle arbitraire : un futur renommage ou une suppression de `registerProjectsHandlers.ts` casserait la compilation de `registerPhasesHandlers.ts` sans lien logique évident. Correction suggérée, non bloquante : extraire `IpcMainLike`/`IpcHandleListener` dans un petit fichier neutre partagé par les deux modules, lors d'une prochaine intervention sur l'un des deux fichiers. Aucun test de non-régression requis pour une suggestion de cette nature.
2. **Double validation Zod création** — `registerPhasesHandlers.ts` (`create`) et `projectsRepository`/`phasesRepository` valident chacun leur payload de création avec le même schéma (`createPhaseSchema.parse`/`createProjectSchema.parse` exécuté deux fois par appel). Redondance héritée de la Phase 3.3, non introduite ici, sans coût fonctionnel mesurable (validation Zod légère) ; mentionné pour mémoire, aucune action requise dans le cadre de cette phase.

## 10. Conclusion

**Verdict : prêt pour validation technique et commit.**

Aucun défaut bloquant ou important. Les deux points listés en SUGGESTION sont des observations d'architecture mineures, sans impact fonctionnel démontré, et n'appellent aucune correction avant commit. Les trois validations automatisées (`typecheck`, `test` 325/325, `build`) et la validation manuelle (`npm run dev`) ont toutes été ré-exécutées indépendamment pendant cette review et confirment exactement les résultats annoncés dans `RAPPORT_PHASE_3.6.md`.
