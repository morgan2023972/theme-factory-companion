import { z } from 'zod'

/**
 * Points d'approbation humaine obligatoires (voir
 * `ORCHESTRATOR_V1_SAFETY_RULES.md`, section 18).
 */
export const WORKFLOW_APPROVAL_TYPES = [
  'phase_prompt',
  'correction_prompt',
  'manual_validation',
  'commit',
  'push'
] as const

export const workflowApprovalTypeSchema = z.enum(WORKFLOW_APPROVAL_TYPES)

export type WorkflowApprovalType = z.infer<typeof workflowApprovalTypeSchema>

/**
 * Une approbation ne peut être que demandée, accordée ou refusée (section
 * 18 : "est explicite, une action positive de l'utilisateur, jamais déduite
 * d'une absence de refus"). Il n'existe volontairement aucun statut
 * implicite d'expiration ou d'approbation automatique.
 */
export const WORKFLOW_APPROVAL_STATUSES = ['pending', 'approved', 'rejected'] as const

export const workflowApprovalStatusSchema = z.enum(WORKFLOW_APPROVAL_STATUSES)

export type WorkflowApprovalStatus = z.infer<typeof workflowApprovalStatusSchema>

/**
 * Une approbation humaine associée à un workflow et, le cas échéant, à une
 * étape précise (`workflowStepId` nullable : une approbation peut concerner
 * le workflow dans son ensemble). `decidedAt` est nullable, mais sa nullité
 * est liée au statut par une validation de cohérence (voir `superRefine`
 * ci-dessous) : `pending` exige `decidedAt` à `null` ; `approved` et
 * `rejected` exigent `decidedAt` renseigné.
 */
export const workflowApprovalSchema = z
  .object({
    id: z.uuid(),
    workflowRunId: z.uuid(),
    workflowStepId: z.uuid().nullable(),
    type: workflowApprovalTypeSchema,
    status: workflowApprovalStatusSchema,
    requestedAt: z.iso.datetime(),
    decidedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime()
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.status === 'pending' && data.decidedAt !== null) {
      ctx.addIssue({ code: 'custom', path: ['decidedAt'], message: 'Le statut "pending" exige decidedAt à null.' })
    }
    if (data.status !== 'pending' && data.decidedAt === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['decidedAt'],
        message: `Le statut "${data.status}" exige decidedAt renseigné.`
      })
    }
  })

export type WorkflowApproval = z.infer<typeof workflowApprovalSchema>

/**
 * Données acceptées pour la création d'une approbation (ORCH-2.2). `status`
 * (toujours `'pending'`) et `decidedAt` (toujours `null`) ne sont pas des
 * champs de création. `requestedAt` non plus : sa valeur est générée par le
 * repository via son horloge injectée, la création d'une `WorkflowApproval`
 * correspondant exactement à l'instant de sa demande (même raisonnement que
 * `WorkflowRun.startedAt`).
 */
export const createWorkflowApprovalSchema = z
  .object({
    workflowRunId: z.uuid(),
    workflowStepId: z.uuid().nullable(),
    type: workflowApprovalTypeSchema
  })
  .strict()

export type CreateWorkflowApprovalInput = z.infer<typeof createWorkflowApprovalSchema>

/**
 * Données acceptées pour décider d'une approbation en attente (ORCH-2.2).
 * Schéma de décision étroit, distinct d'un `updateXSchema` générique : une
 * approbation ne peut être décidée qu'une seule fois (section 18 des règles
 * de sécurité), `decidedAt` est généré par le repository.
 */
export const decideWorkflowApprovalSchema = z
  .object({
    status: z.enum(['approved', 'rejected'])
  })
  .strict()

export type DecideWorkflowApprovalInput = z.infer<typeof decideWorkflowApprovalSchema>
