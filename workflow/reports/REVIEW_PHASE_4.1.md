# REVUE INDÉPENDANTE — Phase 4.1 : Schémas Zod et types partagés des tâches

## 1. Verdict

## VALIDÉE

Aucun constat bloquant, majeur ni mineur significatif. Le contrat partagé des tâches (`src/shared/schemas/task.ts`) reflète exactement les 17 colonnes de la table `tasks`, avec une nullabilité et des contraintes fidèles à la migration `0001`, dans le respect strict des conventions établies par `project.ts`/`phase.ts`. La correction ciblée (retrait de la valeur par défaut `'backlog'` sur `status`) est correctement appliquée : aucun `.default('backlog')` ne subsiste. `npm run typecheck`, `npm run test` (427/427) et `npm run build` réussissent, réexécutés indépendamment. Périmètre strictement respecté (couche `shared` uniquement). **Prêt à committer.**

## 2. Résumé exécutif

La Phase 4.1 crée `taskSchema`, `createTaskSchema`, `updateTaskSchema`, les constantes `TASK_STATUSES`/`TASK_PRIORITIES`, les schémas d'enum associés et les types inférés — sans aucune logique SQLite, repository, IPC, preload ou renderer. La revue a vérifié directement le code et la migration (source de vérité), et non le seul rapport.

Points forts confirmés :
- 17 propriétés ↔ 17 colonnes, correspondance exacte des noms `snake_case` → `camelCase`.
- Nullabilité exacte : `phaseId` nullable (SET NULL), 8 champs texte nullable, `title`/`status`/`priority`/`position` obligatoires.
- Statuts et priorités identiques aux contraintes `CHECK`, source unique (constante `as const` → `z.enum` → type inféré).
- Correction bien appliquée : `status` et `priority` obligatoires à la création, aucune valeur par défaut non contractuelle ; `position` reste optionnelle (justifié par le `DEFAULT 0` SQL réel).
- Tests de haute qualité : chaque test de rejet isole une seule cause d'invalidité (les corrections ont explicitement ajouté `status: 'backlog'` aux payloads pour éviter qu'une absence de `status` masque la cause réelle du rejet).

Aucun défaut fonctionnel, aucune incohérence Zod/TypeScript/SQLite détectée.

## 3. Périmètre réellement inspecté

Lus intégralement : `task.ts`, `task.test.ts`, `project.ts`, `project.test.ts` (extraits), `phase.ts`, `phase.test.ts`, `PHASE_4.1_PROMPT.md`, `PHASE_4.1_CORRECTIONS_PROMPT.md`, `RAPPORT_PHASE_4.1.md`, la migration `0001_createInitialMvpSchema.ts` (définition réelle de `tasks`), `docs/DATA_MODEL_DRAFT.md`. Validations automatiques réexécutées. Aucun fichier modifié pendant la revue.

**Note sur l'état Git** : le rapport de corrections `RAPPORT_CORRECTIONS_PHASE_4.1.md` créé lors de l'étape précédente n'est plus présent sur le disque (supprimé depuis) — cohérent avec la consigne du prompt de correction de ne pas produire de rapport de correction séparé, et avec l'état Git annoncé par le présent prompt de revue. Sans impact sur le code audité.

## 4. Comparaison avec la table SQLite

Table `tasks` (migration `0001`, lignes 54-74) — **17 colonnes** :

| # | Colonne SQLite | Contrainte SQL | Propriété `taskSchema` | Validation Zod | Correspondance |
|---|---|---|---|---|---|
| 1 | `id` | `TEXT PRIMARY KEY` (NOT NULL implicite) | `id` | `z.uuid()` | ✅ |
| 2 | `project_id` | `TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE` | `projectId` | `z.uuid()` | ✅ |
| 3 | `phase_id` | `TEXT REFERENCES phases(id) ON DELETE SET NULL` (nullable) | `phaseId` | `z.uuid().nullable()` | ✅ |
| 4 | `title` | `TEXT NOT NULL CHECK (trim(title) <> '')` | `title` | non vide (refine) | ✅ |
| 5 | `description` | `TEXT` (nullable) | `description` | `z.string().nullable()` | ✅ |
| 6 | `status` | `TEXT NOT NULL CHECK (...)` | `status` | `taskStatusSchema` | ✅ |
| 7 | `priority` | `TEXT NOT NULL CHECK (...)` | `priority` | `taskPrioritySchema` | ✅ |
| 8 | `claude_prompt` | `TEXT` | `claudePrompt` | `z.string().nullable()` | ✅ |
| 9 | `affected_files` | `TEXT` (JSON) | `affectedFiles` | `z.string().nullable()` | ✅ |
| 10 | `acceptance_criteria` | `TEXT` (JSON) | `acceptanceCriteria` | `z.string().nullable()` | ✅ |
| 11 | `validation_commands` | `TEXT` (JSON) | `validationCommands` | `z.string().nullable()` | ✅ |
| 12 | `validation_results` | `TEXT` (JSON) | `validationResults` | `z.string().nullable()` | ✅ |
| 13 | `notes` | `TEXT` | `notes` | `z.string().nullable()` | ✅ |
| 14 | `git_commit` | `TEXT` | `gitCommit` | `z.string().nullable()` | ✅ |
| 15 | `position` | `INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0)` | `position` | `int().min(0)` | ✅ |
| 16 | `created_at` | `TEXT NOT NULL` | `createdAt` | `z.iso.datetime()` | ✅ |
| 17 | `updated_at` | `TEXT NOT NULL` | `updatedAt` | `z.iso.datetime()` | ✅ |

**Aucune propriété manquante, aucune propriété ajoutée sans correspondance SQL, aucune erreur de nullabilité, aucune validation incompatible.** Les 4 colonnes JSON (`affected_files`, `acceptance_criteria`, `validation_commands`, `validation_results`) sont modélisées comme de simples chaînes nullable — choix correct pour un contrat partagé, la désérialisation étant reportée au repository (Phase 4.2). La contrainte `UNIQUE (project_id, position)` de `phases` n'existe **pas** sur `tasks` (vérifié dans la migration) : sa non-reproduction est donc exacte, et non une omission.

## 5. Statuts et priorités

**Statuts** — `TASK_STATUSES = ['backlog', 'ready', 'in_progress', 'to_validate', 'blocked', 'completed', 'cancelled']` : correspondance **exacte** (valeurs et ordre) avec `CHECK (status IN (...))` de la migration. Constante `as const` (readonly), `taskStatusSchema = z.enum(TASK_STATUSES)`, `TaskStatus = z.infer<...>` — source unique, aucune duplication. Tests : chaque valeur acceptée (via `it.each`), valeur inconnue rejetée. ✅

**Priorités** — `TASK_PRIORITIES = ['low', 'medium', 'high', 'critical']` : correspondance **exacte** avec `CHECK (priority IN (...))`. Même structure (constante → `z.enum` → type inféré). Tests : chaque valeur acceptée, valeur inconnue rejetée. ✅

## 6. Revue de `taskSchema`

Schéma de lecture `.strict()`, 17 propriétés. `id`/`projectId` en `z.uuid()` non-null, `phaseId` en `z.uuid().nullable()`. `title` via `nonEmptyTrimmedText` (refine, sans transformation — identique à `projectSchema`/`phaseSchema`). Champs texte nullable en `z.string().nullable()` (sans trim, correct pour un schéma de lecture reflétant la base telle quelle). `position` entière ≥ 0. Timestamps en `z.iso.datetime()`. Caractère strict confirmé et testé (« refuse un champ inconnu »). Titre vide et titre d'espaces rejetés. Position négative et décimale rejetées. Timestamps invalides rejetés. **Conforme.**

## 7. Revue de `createTaskSchema`

- `id`, `createdAt`, `updatedAt` exclus (et rejetés par `.strict()` s'ils sont fournis) ✅
- `projectId` obligatoire ✅ ; `title` obligatoire ✅
- `status` **obligatoire, sans valeur par défaut** — `taskStatusSchema` seul, **aucun `.default('backlog')`** (vérifié ligne 110) ✅
- `priority` obligatoire, sans valeur par défaut ✅
- `phaseId` `z.uuid().nullable().optional()` — omissible ou `null` (conforme à la nullabilité SQL) ✅
- champs texte nullable via `normalizedOptionalNullableText` (trim + nullable + optional), cohérent avec `createProjectSchema`/`createPhaseSchema` ✅
- `position` `.optional()` — cohérent avec le `DEFAULT 0` SQL réel et la convention `createPhaseSchema` ✅
- `.strict()` : propriétés inconnues rejetées ✅

La correction demandée est **pleinement appliquée**. Aucune valeur par défaut non contractuelle ne subsiste.

## 8. Revue de `updateTaskSchema`

- Construit sur `.partial().strict().refine(...)`, comme `updateProjectSchema`/`updatePhaseSchema`.
- Champs métier modifiables uniquement ; `id`, `createdAt`, `updatedAt` absents (rejetés par `.strict()`) ✅
- `projectId` **absent** → déplacement entre projets interdit, cohérent avec `updatePhaseSchema` ✅ (testé)
- `phaseId: z.uuid().nullable()` → après `.partial()`, accepte omission, `null` (détachement) ou UUID (rattachement) ✅ (les trois testés)
- Objet vide refusé, objet uniquement `undefined` refusé, mélange `undefined` + valeur définie accepté — logique `refine((data) => Object.values(data).some((v) => v !== undefined))` identique aux autres modules, testée pour chaque cas.
- Propriétés inconnues rejetées ✅

**Cas limite `.partial().refine(...)`** : examiné. `{}` → `Object.values([]).some(...)` = `false` → rejeté. `{ description: undefined }` → la clé subsiste après parse mais sa valeur `undefined` fait échouer le `some(...)` → rejeté. `{ phaseId: null }` → `null !== undefined` → accepté (détachement voulu). `{ title: '' }` → échoue sur `min(1)` avant même le refine. Aucun comportement inattendu. **Conforme.**

## 9. Revue des types exportés

Cinq types, tous inférés depuis Zod, aucun `any`, aucune interface manuelle redondante, aucun cast injustifié :
- `Task = z.infer<typeof taskSchema>`
- `CreateTaskInput = z.input<typeof createTaskSchema>`
- `UpdateTaskInput = z.infer<typeof updateTaskSchema>`
- `TaskStatus = z.infer<typeof taskStatusSchema>`
- `TaskPriority = z.infer<typeof taskPrioritySchema>`

**Pertinence de `z.input` vs `z.infer`** : après le retrait du `.default('backlog')`, aucun champ de `createTaskSchema` ne porte de valeur par défaut ni de transformation → `z.input` et `z.infer` coïncident désormais. L'usage de `z.input` reste néanmoins correct et le commentaire l'explicite honnêtement, en cohérence avec `CreateProjectInput`/`CreatePhaseInput` (qui, eux, ont un vrai écart input/output à cause de leur `status` par défaut). Choix cohérent avec les conventions du dépôt, non un défaut. Noms alignés sur `project.ts`/`phase.ts`. **Conforme.**

## 10. Revue détaillée des tests

**75 tests** dans `task.test.ts`, tous verts (exécution isolée `--reporter=verbose` confirmée). Répartition : 8 (statuts) + 5 (priorités) + 25 (`taskSchema`) + 18 (`createTaskSchema`) + 19 (`updateTaskSchema`).

**Qualité — aucun test passant pour une mauvaise raison** :
- Les tests de `taskSchema` partent tous de `validTask` (objet pleinement valide) et n'altèrent qu'un champ → cause d'invalidité isolée.
- Les tests de rejet de `createTaskSchema` fournissent désormais explicitement `status: 'backlog'` (et les autres champs obligatoires) pour n'isoler que la seule invalidité visée (ex. « refuse un id de phase invalide » : seul `phaseId` est erroné). C'est précisément l'amélioration apportée par la correction — vérifié ligne par ligne.
- Les tests d'absence (`refuse une création sans status`, `refuse une création sans priority`) ne fournissent respectivement pas `status` / pas `priority`, tout le reste étant valide → prouvent réellement l'obligation.

**Couverture attendue par le prompt (section 9)** — intégralement présente : tous les statuts, toutes les priorités, tâche complète valide, `phaseId` UUID et `null`, création minimale, création complète, absence de `status`, absence de `priority`, titre vide, titre d'espaces, UUID invalides (id/projet/phase), statuts/priorités invalides, position négative, position décimale, timestamps invalides, propriétés inconnues, champs système à la création, mise à jour partielle, mise à jour vide, mise à jour uniquement `undefined`, détachement `null`, tentative de modification de `projectId`, tentative de modification de `id`/timestamps.

Aucune assertion trop faible, aucun test dupliqué sans valeur, aucun écart entre nom de test et comportement testé.

## 11. Revue du rapport de phase (`RAPPORT_PHASE_4.1.md`)

Confronté au code et aux sorties réelles :

| Élément à vérifier | Rapport | Réel | Verdict |
|---|---|---|---|
| Nombre de colonnes | 17 | 17 | ✅ |
| Statuts | 7 valeurs exactes | idem | ✅ |
| Priorités | 4 valeurs exactes | idem | ✅ |
| Nullabilité `phaseId` | nullable (3 schémas) | idem | ✅ |
| Valeur par défaut `status` | aucune, obligatoire | idem | ✅ |
| Valeur par défaut `priority` | aucune, obligatoire | idem | ✅ |
| Traitement `position` | optionnelle (create), `DEFAULT 0` SQL | idem | ✅ |
| Nombre de tests | 427 (dont 75 task) | 427 / 75 | ✅ |
| Nombre de fichiers de tests | 22 | 22 | ✅ |
| Build (hash/tailles) | `index-B7L9SDfN.js` 729.18 kB / CSS 6.89 kB | idem | ✅ |
| Absence de commit/push | confirmée | confirmée | ✅ |
| Limites Phase 4.2 | JSON, position par défaut, unicité, SET NULL | pertinentes | ✅ |

Le rapport est exact et honnête, y compris sur la correction (section 8 réécrite, section 11 détaillant les +2 tests nets). La section 16 (« git status ») est explicitement présentée comme l'**état observé avant la correction ciblée** ; elle ne liste donc pas `PHASE_4.1_CORRECTIONS_PROMPT.md`/`PHASE_4.1_REVIEW_PROMPT.md` apparus depuis — cadrage assumé et correct, pas une erreur documentaire.

## 12. Constats classés par sévérité

**Bloquants : 0.**

**Majeurs : 0.**

**Mineurs : 0.**

**Observations / Suggestions (facultatives, non nécessaires pour clôturer)** :

- *Observation 1* — La section 16 du rapport (état Git) est un instantané antérieur à cette étape (ne mentionne pas les prompts de correction/revue) ; c'est explicitement assumé comme « état de référence avant correction ». Aucune action requise.
- *Suggestion 1* — Aucun test n'asserte explicitement le round-trip d'un `phaseId` UUID ou d'un `status`/`priority` fourni à la création (leur préservation est couverte indirectement par « création complète valide »). Ajout facultatif, sans valeur contractuelle réelle. Ne pas traiter comme un défaut.

Aucune modification de code ou de test n'est requise avant commit.

## 13. Résultats exacts des validations (réexécutées indépendamment)

```bash
npm run typecheck
```
→ **Succès**, aucune erreur (`tsc -p tsconfig.node.json --noEmit && tsc -p tsconfig.web.json --noEmit`).

```bash
npm run test
```
→ **Succès** : `Test Files 22 passed (22)` / `Tests 427 passed (427)`. Exécution isolée de `task.test.ts` : **75/75** réussis, aucun avertissement.

```bash
npm run build
```
→ **Succès** : main 27.49 kB, preload 2.03 kB, renderer `index-B7L9SDfN.js` **729.18 kB** / `index-DzsytAJr.css` **6.89 kB** (hash inchangés — le renderer ne consomme pas encore `task.ts`).

```bash
git diff --check
```
→ Aucune erreur d'espacement.

## 14. Nombre exact de fichiers et de tests réussis

**22 fichiers de tests, 427 tests réussis.** Dont **75** dans `src/shared/schemas/task.test.ts` (les 352 autres sont les tests des phases précédentes, inchangés).

## 15. Sortie exacte de `git status --short`

```
?? src/shared/schemas/task.test.ts
?? src/shared/schemas/task.ts
?? workflow/prompts/PHASE_4.1_CORRECTIONS_PROMPT.md
?? workflow/prompts/PHASE_4.1_PROMPT.md
?? workflow/prompts/PHASE_4.1_REVIEW_PROMPT.md
?? workflow/reports/RAPPORT_PHASE_4.1.md
```

`git diff --stat` : vide (aucun fichier suivi modifié). Aucun fichier applicatif hors périmètre (`main`, `preload`, `renderer`, migrations, repositories, IPC) créé ou modifié. Aucune dépendance ni script npm touché.

## 16. Risques éventuels pour la Phase 4.2

- **Champs JSON** : `affectedFiles`/`acceptanceCriteria`/`validationCommands`/`validationResults` sont de simples chaînes ici ; le repository devra décider de leur (dé)sérialisation et, s'il expose des structures, veiller à la cohérence du contrat partagé (potentielle évolution du schéma en 4.2).
- **Position** : aucune contrainte d'unicité SQL sur `tasks.position` (contrairement à `phases`) ; le repository devra définir sa politique de calcul de position par défaut (par projet ? par phase ?) et de collision éventuelle.
- **`ON DELETE SET NULL` sur `phase_id`** : une tâche peut passer à `phaseId: null` après suppression de sa phase ; à intégrer dans la logique repository/UI de 4.2.
- **`z.input` vs `z.infer`** : si un `default`/transform est introduit ultérieurement sur `createTaskSchema`, `CreateTaskInput` (déjà en `z.input`) restera correct sans changement — bonne anticipation.

Aucun de ces points n'est un défaut de la Phase 4.1 ; ce sont des décisions à prendre en 4.2.

## 17. Recommandation finale

**Prêt à committer.** Aucune correction ciblée ni reprise nécessaire. Le contrat partagé des tâches est complet, exact vis-à-vis de SQLite, cohérent avec les conventions du dépôt, et couvert par des tests fiables. Le commit peut être créé tel quel (les fichiers non suivis `task.ts`, `task.test.ts`, `RAPPORT_PHASE_4.1.md` et les prompts associés).

---

### Synthèse

- **Verdict** : VALIDÉE
- **Bloquants** : 0 · **Majeurs** : 0 · **Mineurs** : 0 (2 observations/suggestions facultatives)
- **Validations** : typecheck ✅, test 427/427 (22 fichiers) ✅, build ✅, `git diff --check` ✅
- **Rapport de revue** : `workflow/reports/REVIEW_PHASE_4.1.md`
- Aucun fichier applicatif modifié ; aucun commit ni push effectué.
