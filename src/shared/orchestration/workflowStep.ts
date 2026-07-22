import { z } from 'zod'
import { nonNegativeInt } from './common'

/**
 * Les 15 étapes obligatoires du workflow (voir `ORCHESTRATOR_V1_WORKFLOW.md`,
 * section 3), dans leur ordre logique. Cette énumération identifie
 * seulement la *nature* de chaque étape ; l'ordre réel d'une exécution
 * donnée est porté par le champ `position` de `workflowStepSchema`, pas par
 * l'ordre de déclaration ci-dessous.
 */
export const WORKFLOW_STEP_TYPES = [
  'project_and_phase_selection',
  'prompt_preparation',
  'prompt_approval',
  'prompt_file_creation',
  'claude_code_execution',
  'report_retrieval',
  'report_analysis',
  'corrections',
  'automatic_validation',
  'manual_validation',
  'commit_preparation',
  'commit_approval',
  'commit',
  'push_approval',
  'push'
] as const

export const workflowStepTypeSchema = z.enum(WORKFLOW_STEP_TYPES)

export type WorkflowStepType = z.infer<typeof workflowStepTypeSchema>

/**
 * Statuts d'une étape. Distinct du statut global du workflow
 * (`WorkflowRunStatus`) : une étape est un élément d'ordonnancement propre
 * (voir `ORCHESTRATOR_V1_WORKFLOW.md`, section 2 : "structure obligatoire de
 * chaque étape").
 */
export const WORKFLOW_STEP_STATUSES = ['pending', 'in_progress', 'completed', 'failed', 'cancelled', 'skipped'] as const

export const workflowStepStatusSchema = z.enum(WORKFLOW_STEP_STATUSES)

export type WorkflowStepStatus = z.infer<typeof workflowStepStatusSchema>

/**
 * Une étape d'un workflow donné, avec son ordre (`position`, entier non
 * négatif) et son statut. `startedAt`/`completedAt` sont nullable, mais leur
 * nullité est liée au statut par une validation de cohérence (voir
 * `superRefine` ci-dessous) : `pending` exige les deux à `null` ;
 * `in_progress` exige `startedAt` renseigné et `completedAt` à `null` ;
 * `completed`, `failed`, `cancelled` et `skipped` exigent `completedAt`
 * renseigné (leur `startedAt` n'est volontairement pas contraint : une
 * étape `skipped`, par exemple, peut n'avoir jamais démarré).
 */
export const workflowStepSchema = z
  .object({
    id: z.uuid(),
    workflowRunId: z.uuid(),
    type: workflowStepTypeSchema,
    status: workflowStepStatusSchema,
    position: nonNegativeInt('La position doit être un entier positif ou nul.'),
    startedAt: z.iso.datetime().nullable(),
    completedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime()
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.status === 'pending') {
      if (data.startedAt !== null) {
        ctx.addIssue({ code: 'custom', path: ['startedAt'], message: 'Le statut "pending" exige startedAt à null.' })
      }
      if (data.completedAt !== null) {
        ctx.addIssue({ code: 'custom', path: ['completedAt'], message: 'Le statut "pending" exige completedAt à null.' })
      }
      return
    }

    if (data.status === 'in_progress') {
      if (data.startedAt === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['startedAt'],
          message: 'Le statut "in_progress" exige startedAt renseigné.'
        })
      }
      if (data.completedAt !== null) {
        ctx.addIssue({
          code: 'custom',
          path: ['completedAt'],
          message: 'Le statut "in_progress" exige completedAt à null.'
        })
      }
      return
    }

    if (data.completedAt === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['completedAt'],
        message: `Le statut "${data.status}" exige completedAt renseigné.`
      })
    }
  })

export type WorkflowStep = z.infer<typeof workflowStepSchema>

/**
 * Données acceptées pour la création d'une étape (ORCH-2.2). `status`
 * (toujours `'pending'`) et `startedAt`/`completedAt` (toujours `null`) ne
 * sont pas des champs de création : ils sont fixés par le repository.
 * `position` reste un champ de création explicite, fourni par l'appelant
 * (aucun calcul automatique de position n'est ajouté pour cette entité).
 */
export const createWorkflowStepSchema = z
  .object({
    workflowRunId: z.uuid(),
    type: workflowStepTypeSchema,
    position: nonNegativeInt('La position doit être un entier positif ou nul.')
  })
  .strict()

export type CreateWorkflowStepInput = z.infer<typeof createWorkflowStepSchema>
