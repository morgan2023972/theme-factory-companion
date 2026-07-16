import { z } from 'zod'

/**
 * Statuts autorisés pour un projet, déduits de la contrainte CHECK SQL sur
 * `projects.status` (voir src/main/database/migrations/0001_createInitialMvpSchema.ts).
 */
export const PROJECT_STATUSES = ['planning', 'active', 'paused', 'completed', 'archived'] as const

export const projectStatusSchema = z.enum(PROJECT_STATUSES)

export type ProjectStatus = z.infer<typeof projectStatusSchema>

const nonEmptyTrimmedText = (message: string): z.ZodString =>
  z.string().refine((value) => value.trim().length > 0, { message })

const normalizedRequiredText = (message: string): z.ZodString => z.string().trim().min(1, message)

const normalizedOptionalNullableText = z.string().trim().nullable().optional()

/**
 * Schéma de lecture : reflète exactement les colonnes de la table `projects`.
 * `description`, `objective`, `repositoryPath`, `targetTechnology` et `notes`
 * sont nullable (colonnes TEXT sans NOT NULL) mais toujours présents.
 */
export const projectSchema = z
  .object({
    id: z.uuid(),
    name: nonEmptyTrimmedText('Le nom du projet est obligatoire.'),
    description: z.string().nullable(),
    objective: z.string().nullable(),
    status: projectStatusSchema,
    repositoryPath: z.string().nullable(),
    targetTechnology: z.string().nullable(),
    notes: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime()
  })
  .strict()

export type Project = z.infer<typeof projectSchema>

/**
 * Schéma de création : exclut `id`, `createdAt` et `updatedAt` (générés).
 * `status` a une valeur par défaut applicative ('planning') absente du SQL
 * (pas de DEFAULT sur cette colonne) mais cohérente avec un flux de création
 * classique où un nouveau projet démarre en planification.
 */
export const createProjectSchema = z
  .object({
    name: normalizedRequiredText('Le nom du projet est obligatoire.'),
    description: normalizedOptionalNullableText,
    objective: normalizedOptionalNullableText,
    status: projectStatusSchema.default('planning'),
    repositoryPath: normalizedOptionalNullableText,
    targetTechnology: normalizedOptionalNullableText,
    notes: normalizedOptionalNullableText
  })
  .strict()

export type CreateProjectInput = z.infer<typeof createProjectSchema>

/**
 * Schéma de mise à jour partielle : mêmes règles de validation que la
 * création, mais tous les champs sont optionnels et `id`/`createdAt`/
 * `updatedAt` restent exclus. Un objet vide est refusé.
 */
export const updateProjectSchema = z
  .object({
    name: normalizedRequiredText('Le nom du projet est obligatoire.'),
    description: normalizedOptionalNullableText,
    objective: normalizedOptionalNullableText,
    status: projectStatusSchema,
    repositoryPath: normalizedOptionalNullableText,
    targetTechnology: normalizedOptionalNullableText,
    notes: normalizedOptionalNullableText
  })
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'La mise à jour doit contenir au moins un champ.'
  })

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
