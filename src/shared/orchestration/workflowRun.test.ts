import { describe, expect, it } from 'vitest'
import { WORKFLOW_RUN_STATUSES, type WorkflowRun, workflowRunSchema, workflowRunStatusSchema } from './workflowRun'

const VALID_ID = '123e4567-e89b-12d3-a456-426614174000'
const VALID_PROJECT_ID = '00000000-0000-4000-8000-000000000001'
const VALID_PHASE_ID = '00000000-0000-4000-8000-000000000002'
const VALID_PROFILE_ID = '00000000-0000-4000-8000-000000000003'
const VALID_STEP_ID = '00000000-0000-4000-8000-000000000004'
const VALID_TIMESTAMP = '2026-07-20T10:00:00.000Z'

const validRun: WorkflowRun = {
  id: VALID_ID,
  projectId: VALID_PROJECT_ID,
  phaseId: VALID_PHASE_ID,
  profileId: VALID_PROFILE_ID,
  profileFingerprint: 'sha256:abcdef',
  status: 'draft',
  currentStepId: null,
  startedAt: VALID_TIMESTAMP,
  completedAt: null,
  createdAt: VALID_TIMESTAMP,
  updatedAt: VALID_TIMESTAMP
}

describe('WORKFLOW_RUN_STATUSES / workflowRunStatusSchema', () => {
  it.each(WORKFLOW_RUN_STATUSES)('accepte le statut autorisé "%s"', (status) => {
    expect(workflowRunStatusSchema.safeParse(status).success).toBe(true)
  })

  it('refuse un statut inconnu', () => {
    expect(workflowRunStatusSchema.safeParse('unknown').success).toBe(false)
  })
})

describe('workflowRunSchema', () => {
  it('accepte un workflow complet valide', () => {
    expect(workflowRunSchema.safeParse(validRun).success).toBe(true)
  })

  it("refuse un id qui n'est pas un UUID", () => {
    expect(workflowRunSchema.safeParse({ ...validRun, id: 'not-a-uuid' }).success).toBe(false)
  })

  it("refuse un projectId qui n'est pas un UUID", () => {
    expect(workflowRunSchema.safeParse({ ...validRun, projectId: 'not-a-uuid' }).success).toBe(false)
  })

  it("refuse un phaseId qui n'est pas un UUID", () => {
    expect(workflowRunSchema.safeParse({ ...validRun, phaseId: 'not-a-uuid' }).success).toBe(false)
  })

  it("refuse un profileId qui n'est pas un UUID", () => {
    expect(workflowRunSchema.safeParse({ ...validRun, profileId: 'not-a-uuid' }).success).toBe(false)
  })

  it('refuse une empreinte de profil vide', () => {
    expect(workflowRunSchema.safeParse({ ...validRun, profileFingerprint: '' }).success).toBe(false)
  })

  it('refuse un statut invalide', () => {
    expect(workflowRunSchema.safeParse({ ...validRun, status: 'unknown' }).success).toBe(false)
  })

  it('accepte currentStepId à null (workflow sans étape courante)', () => {
    expect(workflowRunSchema.safeParse({ ...validRun, currentStepId: null }).success).toBe(true)
  })

  it('accepte currentStepId renseigné', () => {
    expect(workflowRunSchema.safeParse({ ...validRun, currentStepId: VALID_STEP_ID }).success).toBe(true)
  })

  it("refuse currentStepId qui n'est pas un UUID (et n'est pas null)", () => {
    expect(workflowRunSchema.safeParse({ ...validRun, currentStepId: 'not-a-uuid' }).success).toBe(false)
  })

  it('accepte completedAt à null (workflow non terminé)', () => {
    expect(workflowRunSchema.safeParse({ ...validRun, completedAt: null }).success).toBe(true)
  })

  it('refuse un completedAt invalide (et non null)', () => {
    expect(workflowRunSchema.safeParse({ ...validRun, completedAt: 'not-a-date' }).success).toBe(false)
  })

  it('refuse un startedAt invalide', () => {
    expect(workflowRunSchema.safeParse({ ...validRun, startedAt: 'not-a-date' }).success).toBe(false)
  })

  it('refuse un createdAt invalide', () => {
    expect(workflowRunSchema.safeParse({ ...validRun, createdAt: 'not-a-date' }).success).toBe(false)
  })

  it('refuse un updatedAt invalide', () => {
    expect(workflowRunSchema.safeParse({ ...validRun, updatedAt: 'not-a-date' }).success).toBe(false)
  })

  it('refuse un champ obligatoire absent (profileFingerprint)', () => {
    const { profileFingerprint: _profileFingerprint, ...rest } = validRun
    expect(workflowRunSchema.safeParse(rest).success).toBe(false)
  })

  it('refuse un champ inconnu', () => {
    expect(workflowRunSchema.safeParse({ ...validRun, unknownField: 'x' }).success).toBe(false)
  })
})

describe('workflowRunSchema — cohérence status/completedAt', () => {
  it.each(['completed', 'cancelled', 'failed'] as const)(
    'refuse le statut terminal "%s" avec completedAt à null',
    (status) => {
      expect(workflowRunSchema.safeParse({ ...validRun, status, completedAt: null }).success).toBe(false)
    }
  )

  it.each(['completed', 'cancelled', 'failed'] as const)(
    'accepte le statut terminal "%s" avec completedAt renseigné',
    (status) => {
      expect(workflowRunSchema.safeParse({ ...validRun, status, completedAt: VALID_TIMESTAMP }).success).toBe(true)
    }
  )

  it.each([
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
    'ready_to_push'
  ] as const)('refuse le statut non terminal "%s" avec completedAt renseigné', (status) => {
    expect(workflowRunSchema.safeParse({ ...validRun, status, completedAt: VALID_TIMESTAMP }).success).toBe(false)
  })

  it('accepte un statut non terminal (draft) avec completedAt à null', () => {
    expect(workflowRunSchema.safeParse({ ...validRun, status: 'draft', completedAt: null }).success).toBe(true)
  })
})
