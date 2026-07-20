import { z } from 'zod'
import { nonEmptyTrimmedText } from './common'

/**
 * États fonctionnels indicatifs d'un workflow (voir
 * `ORCHESTRATOR_V1_WORKFLOW.md`, section 5). Cette énumération reprend tels
 * quels les états qui y sont listés ; elle ne définit aucune règle de
 * transition entre eux (aucune machine à états n'est implémentée ici, voir
 * ORCH-1.2).
 */
export const WORKFLOW_RUN_STATUSES = [
  'draft',
  'prompt_ready',
  'awaiting_approval',
  'implementation_in_progress',
  'implementation_completed',
  'report_available',
  'review_required',
  'corrections_required',
  'validations_in_progress',
  'validation_failed',
  'manual_validation_required',
  'ready_to_commit',
  'committed',
  'ready_to_push',
  'completed',
  'cancelled',
  'failed'
] as const

export const workflowRunStatusSchema = z.enum(WORKFLOW_RUN_STATUSES)

export type WorkflowRunStatus = z.infer<typeof workflowRunStatusSchema>

/**
 * Statuts terminaux d'un workflow : un workflow qui les atteint exige une
 * date de fin (`completedAt`) renseignée. Cette liste ne définit aucune
 * règle de transition (elle ne dit pas comment on atteint ces statuts,
 * seulement l'invariant de données qui doit être vrai une fois qu'on y est) :
 * la machine à états proprement dite reste hors périmètre (ORCH-1.2).
 */
const WORKFLOW_RUN_TERMINAL_STATUSES: readonly WorkflowRunStatus[] = ['completed', 'cancelled', 'failed']

/**
 * Une exécution de workflow pour un projet et une phase donnés (voir
 * `ORCHESTRATOR_V1_SCOPE.md`, section 5 : "un workflow actif par projet").
 * `phaseId` référence la phase de projet existante (voir
 * `src/shared/schemas/phase.ts`) sélectionnée à l'Étape 1 du workflow —
 * il ne s'agit pas d'une sous-phase de la roadmap de l'orchestrateur
 * (ORCH-x.x), qui n'est pas une entité persistée.
 * `profileId` référence le profil utilisé (voir `workflowProfile.ts`).
 * `profileFingerprint` est l'empreinte du profil actif capturée au
 * démarrage du workflow (section 6 des règles de sécurité) : toute
 * modification du profil détectée en cours de route (empreinte différente)
 * doit bloquer la progression — cette comparaison est une responsabilité
 * d'exécution future (hors périmètre ORCH-1.1), le champ se contente ici de
 * conserver la valeur capturée.
 * `currentStepId` est nullable : un workflow tout juste créé n'a pas encore
 * d'étape courante tant que la première étape n'a pas démarré.
 * `completedAt` est lié au statut par une validation de cohérence (voir
 * `superRefine` ci-dessous) : un statut terminal (`completed`, `cancelled`,
 * `failed`) exige `completedAt` renseigné, tout autre statut exige
 * `completedAt` à `null`. Cette validation reste un simple contrôle de
 * cohérence de données, pas une règle de transition entre statuts.
 */
export const workflowRunSchema = z
  .object({
    id: z.uuid(),
    projectId: z.uuid(),
    phaseId: z.uuid(),
    profileId: z.uuid(),
    profileFingerprint: nonEmptyTrimmedText("L'empreinte du profil actif est obligatoire."),
    status: workflowRunStatusSchema,
    currentStepId: z.uuid().nullable(),
    startedAt: z.iso.datetime(),
    completedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime()
  })
  .strict()
  .superRefine((data, ctx) => {
    const isTerminal = WORKFLOW_RUN_TERMINAL_STATUSES.includes(data.status)
    if (isTerminal && data.completedAt === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['completedAt'],
        message: `Le statut "${data.status}" exige un completedAt renseigné.`
      })
    }
    if (!isTerminal && data.completedAt !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['completedAt'],
        message: `Le statut "${data.status}" exige completedAt à null.`
      })
    }
  })

export type WorkflowRun = z.infer<typeof workflowRunSchema>
