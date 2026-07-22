import { z } from 'zod'
import { relativeArtifactPathSchema } from './common'

/**
 * Types d'artefacts Markdown produits par le workflow (voir
 * `ORCHESTRATOR_V1_SCOPE.md`, section 9). Le journal des commandes et le
 * journal des approbations n'en font pas partie : ce sont des entités
 * distinctes (`CommandExecution`, `WorkflowApproval`), pas des fichiers
 * d'artefact. De même, le hash de commit et le résultat du push ne sont pas
 * modélisés comme des artefacts fichier ici : ce sont des propriétés de
 * l'exécution Git concernée (hors périmètre ORCH-1.1, à modéliser lors des
 * phases Git contrôlées, ORCH-7.x).
 */
export const WORKFLOW_ARTIFACT_TYPES = [
  'phase_prompt',
  'phase_report',
  'review_prompt',
  'review_report',
  'correction_prompt',
  'correction_report',
  'validation_report'
] as const

export const workflowArtifactTypeSchema = z.enum(WORKFLOW_ARTIFACT_TYPES)

export type WorkflowArtifactType = z.infer<typeof workflowArtifactTypeSchema>

/**
 * Un artefact associé à un workflow. `workflowStepId` est nullable : un
 * artefact peut être conservé sans être rattaché à une étape précise (par
 * exemple un rapport de validation consolidé). `relativePath` est toujours
 * relatif au dépôt déclaré du projet (voir `common.ts` et
 * `ORCHESTRATOR_V1_SAFETY_RULES.md`, section 4).
 * Aucun `updatedAt` : l'écrasement d'un artefact est interdit en V1 (section
 * 5 des règles de sécurité) — toute nouvelle version est un nouvel artefact,
 * sous un nouveau chemin, jamais une mise à jour du même enregistrement.
 */
export const workflowArtifactSchema = z
  .object({
    id: z.uuid(),
    workflowRunId: z.uuid(),
    workflowStepId: z.uuid().nullable(),
    type: workflowArtifactTypeSchema,
    relativePath: relativeArtifactPathSchema,
    createdAt: z.iso.datetime()
  })
  .strict()

export type WorkflowArtifact = z.infer<typeof workflowArtifactSchema>

/**
 * Données acceptées pour la création d'un artefact (ORCH-2.2). `createdAt`
 * n'est pas un champ de création : il est généré par le repository. Aucun
 * champ de mise à jour n'existe pour cette entité : un artefact est
 * immuable après création (voir `workflowArtifactSchema` ci-dessus).
 */
export const createWorkflowArtifactSchema = z
  .object({
    workflowRunId: z.uuid(),
    workflowStepId: z.uuid().nullable(),
    type: workflowArtifactTypeSchema,
    relativePath: relativeArtifactPathSchema
  })
  .strict()

export type CreateWorkflowArtifactInput = z.infer<typeof createWorkflowArtifactSchema>
