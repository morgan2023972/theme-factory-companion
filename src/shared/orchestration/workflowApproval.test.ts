import { describe, expect, it } from 'vitest'
import {
  WORKFLOW_APPROVAL_STATUSES,
  WORKFLOW_APPROVAL_TYPES,
  type WorkflowApproval,
  workflowApprovalSchema,
  workflowApprovalStatusSchema,
  workflowApprovalTypeSchema
} from './workflowApproval'

const VALID_ID = '123e4567-e89b-12d3-a456-426614174000'
const VALID_RUN_ID = '00000000-0000-4000-8000-000000000001'
const VALID_STEP_ID = '00000000-0000-4000-8000-000000000002'
const VALID_TIMESTAMP = '2026-07-20T10:00:00.000Z'

const validApproval: WorkflowApproval = {
  id: VALID_ID,
  workflowRunId: VALID_RUN_ID,
  workflowStepId: VALID_STEP_ID,
  type: 'phase_prompt',
  status: 'pending',
  requestedAt: VALID_TIMESTAMP,
  decidedAt: null,
  createdAt: VALID_TIMESTAMP,
  updatedAt: VALID_TIMESTAMP
}

describe('WORKFLOW_APPROVAL_TYPES / workflowApprovalTypeSchema', () => {
  it.each(WORKFLOW_APPROVAL_TYPES)('accepte le type autorisé "%s"', (type) => {
    expect(workflowApprovalTypeSchema.safeParse(type).success).toBe(true)
  })

  it('refuse un type inconnu', () => {
    expect(workflowApprovalTypeSchema.safeParse('unknown').success).toBe(false)
  })
})

describe('WORKFLOW_APPROVAL_STATUSES / workflowApprovalStatusSchema', () => {
  it.each(WORKFLOW_APPROVAL_STATUSES)('accepte le statut autorisé "%s"', (status) => {
    expect(workflowApprovalStatusSchema.safeParse(status).success).toBe(true)
  })

  it('refuse un statut inconnu (ex. "auto_approved")', () => {
    expect(workflowApprovalStatusSchema.safeParse('auto_approved').success).toBe(false)
  })

  it('refuse un statut inconnu quelconque', () => {
    expect(workflowApprovalStatusSchema.safeParse('unknown').success).toBe(false)
  })
})

describe('workflowApprovalSchema', () => {
  it('accepte une approbation complète valide', () => {
    expect(workflowApprovalSchema.safeParse(validApproval).success).toBe(true)
  })

  it("refuse un id qui n'est pas un UUID", () => {
    expect(workflowApprovalSchema.safeParse({ ...validApproval, id: 'not-a-uuid' }).success).toBe(false)
  })

  it("refuse un workflowRunId qui n'est pas un UUID", () => {
    expect(workflowApprovalSchema.safeParse({ ...validApproval, workflowRunId: 'not-a-uuid' }).success).toBe(false)
  })

  it('accepte workflowStepId à null', () => {
    expect(workflowApprovalSchema.safeParse({ ...validApproval, workflowStepId: null }).success).toBe(true)
  })

  it("refuse workflowStepId qui n'est pas un UUID (et n'est pas null)", () => {
    expect(workflowApprovalSchema.safeParse({ ...validApproval, workflowStepId: 'not-a-uuid' }).success).toBe(false)
  })

  it('refuse un type invalide', () => {
    expect(workflowApprovalSchema.safeParse({ ...validApproval, type: 'unknown' }).success).toBe(false)
  })

  it('refuse un statut invalide', () => {
    expect(workflowApprovalSchema.safeParse({ ...validApproval, status: 'unknown' }).success).toBe(false)
  })

  it('accepte decidedAt à null (approbation encore en attente)', () => {
    expect(workflowApprovalSchema.safeParse({ ...validApproval, decidedAt: null }).success).toBe(true)
  })

  it('accepte une approbation accordée avec decidedAt renseigné', () => {
    expect(
      workflowApprovalSchema.safeParse({ ...validApproval, status: 'approved', decidedAt: VALID_TIMESTAMP }).success
    ).toBe(true)
  })

  it('refuse un decidedAt invalide (et non null)', () => {
    expect(workflowApprovalSchema.safeParse({ ...validApproval, decidedAt: 'not-a-date' }).success).toBe(false)
  })

  it('refuse un requestedAt invalide', () => {
    expect(workflowApprovalSchema.safeParse({ ...validApproval, requestedAt: 'not-a-date' }).success).toBe(false)
  })

  it('refuse un createdAt invalide', () => {
    expect(workflowApprovalSchema.safeParse({ ...validApproval, createdAt: 'not-a-date' }).success).toBe(false)
  })

  it('refuse un updatedAt invalide', () => {
    expect(workflowApprovalSchema.safeParse({ ...validApproval, updatedAt: 'not-a-date' }).success).toBe(false)
  })

  it('refuse un champ obligatoire absent (requestedAt)', () => {
    const { requestedAt: _requestedAt, ...rest } = validApproval
    expect(workflowApprovalSchema.safeParse(rest).success).toBe(false)
  })

  it('refuse un champ inconnu', () => {
    expect(workflowApprovalSchema.safeParse({ ...validApproval, unknownField: 'x' }).success).toBe(false)
  })
})

describe('workflowApprovalSchema — cohérence status/decidedAt', () => {
  it('accepte "pending" avec decidedAt à null', () => {
    expect(workflowApprovalSchema.safeParse({ ...validApproval, status: 'pending', decidedAt: null }).success).toBe(
      true
    )
  })

  it('refuse "pending" avec decidedAt renseigné', () => {
    expect(
      workflowApprovalSchema.safeParse({ ...validApproval, status: 'pending', decidedAt: VALID_TIMESTAMP }).success
    ).toBe(false)
  })

  it.each(['approved', 'rejected'] as const)('accepte le statut "%s" avec decidedAt renseigné', (status) => {
    expect(
      workflowApprovalSchema.safeParse({ ...validApproval, status, decidedAt: VALID_TIMESTAMP }).success
    ).toBe(true)
  })

  it.each(['approved', 'rejected'] as const)('refuse le statut "%s" avec decidedAt à null', (status) => {
    expect(workflowApprovalSchema.safeParse({ ...validApproval, status, decidedAt: null }).success).toBe(false)
  })
})
