import { z } from 'zod'

/**
 * Statuts autorisés pour une tâche, déduits de la contrainte CHECK SQL sur
 * `tasks.status` (voir src/main/database/migrations/0001_createInitialMvpSchema.ts).
 */
export const TASK_STATUSES = [
  'backlog',
  'ready',
  'in_progress',
  'to_validate',
  'blocked',
  'completed',
  'cancelled'
] as const

export const taskStatusSchema = z.enum(TASK_STATUSES)

export type TaskStatus = z.infer<typeof taskStatusSchema>

/**
 * Priorités autorisées pour une tâche, déduites de la contrainte CHECK SQL
 * sur `tasks.priority` (même migration).
 */
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const

export const taskPrioritySchema = z.enum(TASK_PRIORITIES)

export type TaskPriority = z.infer<typeof taskPrioritySchema>

const nonEmptyTrimmedText = (message: string): z.ZodString =>
  z.string().refine((value) => value.trim().length > 0, { message })

const normalizedRequiredText = (message: string): z.ZodString => z.string().trim().min(1, message)

const normalizedOptionalNullableText = z.string().trim().nullable().optional()

/**
 * `position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0)` : même règle
 * que `phases.position` (voir src/shared/schemas/phase.ts). Aucune contrainte
 * `UNIQUE (project_id, position)` n'existe sur `tasks` (contrairement à
 * `phases`) : non reproduite ici, ce serait de toute façon une contrainte
 * relationnelle et non une validation de valeur isolée.
 */
const nonNegativePositionInteger = z.number().int().min(0, 'La position doit être un entier positif ou nul.')

/**
 * Schéma de lecture : reflète exactement les colonnes de la table `tasks`.
 * `description`, `claudePrompt`, `affectedFiles`, `acceptanceCriteria`,
 * `validationCommands`, `validationResults`, `notes` et `gitCommit` sont
 * nullable (colonnes TEXT sans NOT NULL) mais toujours présents. `phaseId`
 * est nullable (`phase_id TEXT REFERENCES phases(id) ON DELETE SET NULL`,
 * sans NOT NULL) : une tâche peut exister sans être rattachée à une phase.
 * `affectedFiles`, `acceptanceCriteria`, `validationCommands` et
 * `validationResults` sont stockés en TEXT JSON côté SQLite (voir le
 * commentaire de la migration 0001) : leur désérialisation éventuelle en
 * structure (tableau, objet) est une responsabilité du futur repository
 * (Phase 4.2), pas de ce contrat partagé — modélisés ici comme de simples
 * chaînes nullable, fidèles à la colonne réelle.
 */
export const taskSchema = z
  .object({
    id: z.uuid(),
    projectId: z.uuid(),
    phaseId: z.uuid().nullable(),
    title: nonEmptyTrimmedText('Le titre de la tâche est obligatoire.'),
    description: z.string().nullable(),
    status: taskStatusSchema,
    priority: taskPrioritySchema,
    claudePrompt: z.string().nullable(),
    affectedFiles: z.string().nullable(),
    acceptanceCriteria: z.string().nullable(),
    validationCommands: z.string().nullable(),
    validationResults: z.string().nullable(),
    notes: z.string().nullable(),
    gitCommit: z.string().nullable(),
    position: nonNegativePositionInteger,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime()
  })
  .strict()

export type Task = z.infer<typeof taskSchema>

/**
 * Schéma de création : exclut `id`, `createdAt` et `updatedAt` (générés).
 * `status` et `priority` n'ont **aucune valeur par défaut** ici : la colonne
 * SQL `tasks.status` est `NOT NULL` sans `DEFAULT`, tout comme
 * `tasks.priority`, et aucun contrat métier ne leur définit explicitement de
 * valeur par défaut (contrairement à `position`, qui porte un `DEFAULT 0`
 * réel côté SQL). Une analogie avec `projects.status`/`phases.status`
 * (valeur par défaut applicative malgré l'absence de `DEFAULT` SQL) avait été
 * envisagée puis écartée : rien dans la base ni dans le contrat de cette
 * phase ne la justifie pour les tâches. `status` et `priority` sont donc
 * tous deux **obligatoires** à la création.
 * `position` est optionnelle : si absente, le futur repository calculera la
 * position suivante pour le regroupement concerné, à l'image de
 * `phasesRepository.ts` (la colonne porte `DEFAULT 0` côté SQL).
 * `projectId` est obligatoire : une tâche n'existe jamais sans projet
 * parent. `phaseId` est nullable et optionnel : une tâche peut être créée
 * sans phase (omis ou `null`), ou directement rattachée à une phase
 * existante.
 */
export const createTaskSchema = z
  .object({
    projectId: z.uuid(),
    phaseId: z.uuid().nullable().optional(),
    title: normalizedRequiredText('Le titre de la tâche est obligatoire.'),
    description: normalizedOptionalNullableText,
    status: taskStatusSchema,
    priority: taskPrioritySchema,
    claudePrompt: normalizedOptionalNullableText,
    affectedFiles: normalizedOptionalNullableText,
    acceptanceCriteria: normalizedOptionalNullableText,
    validationCommands: normalizedOptionalNullableText,
    validationResults: normalizedOptionalNullableText,
    notes: normalizedOptionalNullableText,
    gitCommit: normalizedOptionalNullableText,
    position: nonNegativePositionInteger.optional()
  })
  .strict()

/**
 * Type d'entrée du schéma de création (`z.input`). Contrairement à
 * `CreateProjectInput`/`CreatePhaseInput`, aucun champ de `createTaskSchema`
 * ne porte de valeur par défaut Zod (voir la justification ci-dessus pour
 * `status`/`priority`) : `z.input` et `z.infer` coïncident donc ici, mais
 * `z.input` est conservé pour rester cohérent avec la convention des autres
 * schémas de création du dépôt.
 */
export type CreateTaskInput = z.input<typeof createTaskSchema>

/**
 * Schéma de mise à jour partielle : mêmes règles de validation que la
 * création pour les champs modifiables, mais tous optionnels, et un objet
 * vide est refusé, de même qu'un objet ne contenant que des clés
 * explicitement à `undefined` (même comportement que
 * `updateProjectSchema`/`updatePhaseSchema`, voir leurs commentaires
 * respectifs). `projectId` est volontairement exclu : comme pour les
 * phases, aucune décision existante n'autorise le déplacement d'une tâche
 * vers un autre projet. `phaseId` reste modifiable (y compris à `null`,
 * pour détacher explicitement la tâche de sa phase — la colonne SQL
 * l'autorise) : rien n'interdit en revanche de rattacher une tâche à une
 * autre phase du même projet.
 */
export const updateTaskSchema = z
  .object({
    phaseId: z.uuid().nullable(),
    title: normalizedRequiredText('Le titre de la tâche est obligatoire.'),
    description: normalizedOptionalNullableText,
    status: taskStatusSchema,
    priority: taskPrioritySchema,
    claudePrompt: normalizedOptionalNullableText,
    affectedFiles: normalizedOptionalNullableText,
    acceptanceCriteria: normalizedOptionalNullableText,
    validationCommands: normalizedOptionalNullableText,
    validationResults: normalizedOptionalNullableText,
    notes: normalizedOptionalNullableText,
    gitCommit: normalizedOptionalNullableText,
    position: nonNegativePositionInteger
  })
  .partial()
  .strict()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'La mise à jour doit contenir au moins un champ.'
  })

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
