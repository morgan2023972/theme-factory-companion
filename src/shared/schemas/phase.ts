import { z } from 'zod'

/**
 * Statuts autorisés pour une phase, déduits de la contrainte CHECK SQL sur
 * `phases.status` (voir src/main/database/migrations/0001_createInitialMvpSchema.ts).
 */
export const PHASE_STATUSES = ['pending', 'in_progress', 'completed'] as const

export const phaseStatusSchema = z.enum(PHASE_STATUSES)

export type PhaseStatus = z.infer<typeof phaseStatusSchema>

const nonEmptyTrimmedText = (message: string): z.ZodString =>
  z.string().refine((value) => value.trim().length > 0, { message })

const normalizedRequiredText = (message: string): z.ZodString => z.string().trim().min(1, message)

const normalizedOptionalNullableText = z.string().trim().nullable().optional()

/**
 * `position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0)` : entier
 * positif ou nul. La contrainte `UNIQUE (project_id, position)` de la table
 * n'est pas reproduite ici (c'est une contrainte relationnelle, pas une
 * validation de valeur isolée) ; elle est appliquée par SQLite.
 */
const nonNegativePositionInteger = z.number().int().min(0, 'La position doit être un entier positif ou nul.')

/**
 * Schéma de lecture : reflète exactement les colonnes de la table `phases`.
 * `description` est nullable (colonne TEXT sans NOT NULL) mais toujours
 * présente.
 */
export const phaseSchema = z
  .object({
    id: z.uuid(),
    projectId: z.uuid(),
    name: nonEmptyTrimmedText('Le nom de la phase est obligatoire.'),
    description: z.string().nullable(),
    status: phaseStatusSchema,
    position: nonNegativePositionInteger,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime()
  })
  .strict()

export type Phase = z.infer<typeof phaseSchema>

/**
 * Schéma de création : exclut `id`, `createdAt` et `updatedAt` (générés).
 * `status` a une valeur par défaut applicative ('pending') absente du SQL
 * (pas de DEFAULT sur cette colonne), cohérente avec le premier statut du
 * vocabulaire CHECK et avec la convention déjà retenue pour
 * `projects.status` ('planning' par défaut en phase 3.1).
 * `position` est optionnelle : si absente, le repository calcule la
 * position suivante pour le projet concerné (voir `phasesRepository.ts`).
 * `projectId` est obligatoire : une phase n'existe jamais sans projet
 * parent, et ce parent doit être identifié explicitement par l'appelant.
 */
export const createPhaseSchema = z
  .object({
    projectId: z.uuid(),
    name: normalizedRequiredText('Le nom de la phase est obligatoire.'),
    description: normalizedOptionalNullableText,
    status: phaseStatusSchema.default('pending'),
    position: nonNegativePositionInteger.optional()
  })
  .strict()

/**
 * Type d'entrée du schéma de création (`z.input`), et non le type de
 * sortie : `status` possède une valeur par défaut résolue par Zod lors du
 * `parse()`, donc absente/optionnelle côté appelant (même raisonnement que
 * `CreateProjectInput`, voir src/shared/schemas/project.ts).
 */
export type CreatePhaseInput = z.input<typeof createPhaseSchema>

/**
 * Schéma de mise à jour partielle : mêmes règles de validation que la
 * création pour les champs modifiables, mais tous optionnels, et un objet
 * vide est refusé, de même qu'un objet ne contenant que des clés
 * explicitement à `undefined` (ex. `{ description: undefined }`) :
 * `Object.keys(...).length > 0` aurait accepté ce cas à tort, car une clé
 * Zod présente avec la valeur `undefined` reste une clé propre de l'objet
 * parsé. `Object.values(...).some(...)` exige qu'au moins une valeur soit
 * réellement définie (une valeur `null` explicite compte comme définie et
 * reste donc valide pour effacer `description`). `projectId` est
 * volontairement exclu : cette phase ne permet pas le déplacement d'une
 * phase vers un autre projet (aucune décision existante ne l'autorise
 * explicitement).
 */
export const updatePhaseSchema = z
  .object({
    name: normalizedRequiredText('Le nom de la phase est obligatoire.'),
    description: normalizedOptionalNullableText,
    status: phaseStatusSchema,
    position: nonNegativePositionInteger
  })
  .partial()
  .strict()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'La mise à jour doit contenir au moins un champ.'
  })

export type UpdatePhaseInput = z.infer<typeof updatePhaseSchema>
