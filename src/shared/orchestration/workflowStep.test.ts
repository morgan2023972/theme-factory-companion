import { describe, expect, it } from 'vitest'
import {
  WORKFLOW_STEP_STATUSES,
  WORKFLOW_STEP_TYPES,
  type WorkflowStep,
  workflowStepSchema,
  workflowStepStatusSchema,
  workflowStepTypeSchema
} from './workflowStep'

const VALID_ID = '123e4567-e89b-12d3-a456-426614174000'
const VALID_RUN_ID = '00000000-0000-4000-8000-000000000001'
const VALID_TIMESTAMP = '2026-07-20T10:00:00.000Z'

const validStep: WorkflowStep = {
  id: VALID_ID,
  workflowRunId: VALID_RUN_ID,
  type: 'prompt_preparation',
  status: 'pending',
  position: 0,
  startedAt: null,
  completedAt: null,
  createdAt: VALID_TIMESTAMP,
  updatedAt: VALID_TIMESTAMP
}

describe('WORKFLOW_STEP_TYPES / workflowStepTypeSchema', () => {
  it.each(WORKFLOW_STEP_TYPES)('accepte le type autorisé "%s"', (type) => {
    expect(workflowStepTypeSchema.safeParse(type).success).toBe(true)
  })

  it('refuse un type inconnu', () => {
    expect(workflowStepTypeSchema.safeParse('unknown').success).toBe(false)
  })
})

describe('WORKFLOW_STEP_STATUSES / workflowStepStatusSchema', () => {
  it.each(WORKFLOW_STEP_STATUSES)('accepte le statut autorisé "%s"', (status) => {
    expect(workflowStepStatusSchema.safeParse(status).success).toBe(true)
  })

  it('refuse un statut inconnu', () => {
    expect(workflowStepStatusSchema.safeParse('unknown').success).toBe(false)
  })
})

describe('workflowStepSchema', () => {
  it('accepte une étape complète valide', () => {
    expect(workflowStepSchema.safeParse(validStep).success).toBe(true)
  })

  it("refuse un id qui n'est pas un UUID", () => {
    expect(workflowStepSchema.safeParse({ ...validStep, id: 'not-a-uuid' }).success).toBe(false)
  })

  it("refuse un workflowRunId qui n'est pas un UUID", () => {
    expect(workflowStepSchema.safeParse({ ...validStep, workflowRunId: 'not-a-uuid' }).success).toBe(false)
  })

  it('refuse un type invalide', () => {
    expect(workflowStepSchema.safeParse({ ...validStep, type: 'unknown' }).success).toBe(false)
  })

  it('refuse un statut invalide', () => {
    expect(workflowStepSchema.safeParse({ ...validStep, status: 'unknown' }).success).toBe(false)
  })

  it('accepte une position valide (0)', () => {
    expect(workflowStepSchema.safeParse({ ...validStep, position: 0 }).success).toBe(true)
  })

  it('refuse une position négative', () => {
    expect(workflowStepSchema.safeParse({ ...validStep, position: -1 }).success).toBe(false)
  })

  it('refuse une position non entière', () => {
    expect(workflowStepSchema.safeParse({ ...validStep, position: 1.5 }).success).toBe(false)
  })

  it('accepte startedAt/completedAt à null (étape pas encore démarrée)', () => {
    expect(workflowStepSchema.safeParse({ ...validStep, startedAt: null, completedAt: null }).success).toBe(true)
  })

  it('accepte startedAt renseigné et completedAt null (étape en cours)', () => {
    expect(
      workflowStepSchema.safeParse({ ...validStep, status: 'in_progress', startedAt: VALID_TIMESTAMP, completedAt: null })
        .success
    ).toBe(true)
  })

  it('refuse un startedAt invalide (et non null)', () => {
    expect(workflowStepSchema.safeParse({ ...validStep, startedAt: 'not-a-date' }).success).toBe(false)
  })

  it('refuse un completedAt invalide (et non null)', () => {
    expect(workflowStepSchema.safeParse({ ...validStep, completedAt: 'not-a-date' }).success).toBe(false)
  })

  it('refuse un createdAt invalide', () => {
    expect(workflowStepSchema.safeParse({ ...validStep, createdAt: 'not-a-date' }).success).toBe(false)
  })

  it('refuse un updatedAt invalide', () => {
    expect(workflowStepSchema.safeParse({ ...validStep, updatedAt: 'not-a-date' }).success).toBe(false)
  })

  it('refuse un champ obligatoire absent (position)', () => {
    const { position: _position, ...rest } = validStep
    expect(workflowStepSchema.safeParse(rest).success).toBe(false)
  })

  it('refuse un champ inconnu', () => {
    expect(workflowStepSchema.safeParse({ ...validStep, unknownField: 'x' }).success).toBe(false)
  })
})

describe('workflowStepSchema — cohérence status/startedAt/completedAt', () => {
  it('accepte "pending" avec startedAt et completedAt à null', () => {
    expect(
      workflowStepSchema.safeParse({ ...validStep, status: 'pending', startedAt: null, completedAt: null }).success
    ).toBe(true)
  })

  it('refuse "pending" avec startedAt renseigné', () => {
    expect(
      workflowStepSchema.safeParse({ ...validStep, status: 'pending', startedAt: VALID_TIMESTAMP, completedAt: null })
        .success
    ).toBe(false)
  })

  it('refuse "pending" avec completedAt renseigné', () => {
    expect(
      workflowStepSchema.safeParse({ ...validStep, status: 'pending', startedAt: null, completedAt: VALID_TIMESTAMP })
        .success
    ).toBe(false)
  })

  it('accepte "in_progress" avec startedAt renseigné et completedAt à null', () => {
    expect(
      workflowStepSchema.safeParse({
        ...validStep,
        status: 'in_progress',
        startedAt: VALID_TIMESTAMP,
        completedAt: null
      }).success
    ).toBe(true)
  })

  it('refuse "in_progress" avec startedAt à null', () => {
    expect(
      workflowStepSchema.safeParse({ ...validStep, status: 'in_progress', startedAt: null, completedAt: null }).success
    ).toBe(false)
  })

  it('refuse "in_progress" avec completedAt renseigné', () => {
    expect(
      workflowStepSchema.safeParse({
        ...validStep,
        status: 'in_progress',
        startedAt: VALID_TIMESTAMP,
        completedAt: VALID_TIMESTAMP
      }).success
    ).toBe(false)
  })

  it.each(['completed', 'failed', 'cancelled', 'skipped'] as const)(
    'accepte le statut "%s" avec completedAt renseigné',
    (status) => {
      expect(
        workflowStepSchema.safeParse({
          ...validStep,
          status,
          startedAt: VALID_TIMESTAMP,
          completedAt: VALID_TIMESTAMP
        }).success
      ).toBe(true)
    }
  )

  it.each(['completed', 'failed', 'cancelled', 'skipped'] as const)(
    'refuse le statut "%s" avec completedAt à null',
    (status) => {
      expect(
        workflowStepSchema.safeParse({ ...validStep, status, startedAt: VALID_TIMESTAMP, completedAt: null }).success
      ).toBe(false)
    }
  )
})
