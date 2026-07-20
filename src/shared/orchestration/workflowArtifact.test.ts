import { describe, expect, it } from 'vitest'
import {
  WORKFLOW_ARTIFACT_TYPES,
  type WorkflowArtifact,
  workflowArtifactSchema,
  workflowArtifactTypeSchema
} from './workflowArtifact'

const VALID_ID = '123e4567-e89b-12d3-a456-426614174000'
const VALID_RUN_ID = '00000000-0000-4000-8000-000000000001'
const VALID_STEP_ID = '00000000-0000-4000-8000-000000000002'
const VALID_TIMESTAMP = '2026-07-20T10:00:00.000Z'

const validArtifact: WorkflowArtifact = {
  id: VALID_ID,
  workflowRunId: VALID_RUN_ID,
  workflowStepId: VALID_STEP_ID,
  type: 'phase_prompt',
  relativePath: 'workflow/prompts/PROMPT_ORCH_1.1.md',
  createdAt: VALID_TIMESTAMP
}

describe('WORKFLOW_ARTIFACT_TYPES / workflowArtifactTypeSchema', () => {
  it.each(WORKFLOW_ARTIFACT_TYPES)('accepte le type autorisé "%s"', (type) => {
    expect(workflowArtifactTypeSchema.safeParse(type).success).toBe(true)
  })

  it('refuse un type inconnu', () => {
    expect(workflowArtifactTypeSchema.safeParse('unknown').success).toBe(false)
  })
})

describe('workflowArtifactSchema', () => {
  it('accepte un artefact complet valide', () => {
    expect(workflowArtifactSchema.safeParse(validArtifact).success).toBe(true)
  })

  it("refuse un id qui n'est pas un UUID", () => {
    expect(workflowArtifactSchema.safeParse({ ...validArtifact, id: 'not-a-uuid' }).success).toBe(false)
  })

  it("refuse un workflowRunId qui n'est pas un UUID", () => {
    expect(workflowArtifactSchema.safeParse({ ...validArtifact, workflowRunId: 'not-a-uuid' }).success).toBe(false)
  })

  it('accepte workflowStepId à null (artefact non rattaché à une étape)', () => {
    expect(workflowArtifactSchema.safeParse({ ...validArtifact, workflowStepId: null }).success).toBe(true)
  })

  it("refuse workflowStepId qui n'est pas un UUID (et n'est pas null)", () => {
    expect(workflowArtifactSchema.safeParse({ ...validArtifact, workflowStepId: 'not-a-uuid' }).success).toBe(false)
  })

  it('refuse un type invalide', () => {
    expect(workflowArtifactSchema.safeParse({ ...validArtifact, type: 'unknown' }).success).toBe(false)
  })

  it('refuse un chemin vide', () => {
    expect(workflowArtifactSchema.safeParse({ ...validArtifact, relativePath: '' }).success).toBe(false)
  })

  it('refuse un chemin absolu Unix', () => {
    expect(
      workflowArtifactSchema.safeParse({ ...validArtifact, relativePath: '/etc/passwd' }).success
    ).toBe(false)
  })

  it('refuse un chemin absolu Windows', () => {
    expect(
      workflowArtifactSchema.safeParse({ ...validArtifact, relativePath: 'C:\\Windows\\system.ini' }).success
    ).toBe(false)
  })

  it('refuse un chemin UNC', () => {
    expect(
      workflowArtifactSchema.safeParse({ ...validArtifact, relativePath: '\\\\server\\share\\file.md' }).success
    ).toBe(false)
  })

  it('refuse un chemin absolu Windows à backslash unique (sans lettre de lecteur)', () => {
    expect(
      workflowArtifactSchema.safeParse({ ...validArtifact, relativePath: '\\Windows\\system.ini' }).success
    ).toBe(false)
  })

  it('refuse une traversée `..` au début du chemin', () => {
    expect(
      workflowArtifactSchema.safeParse({ ...validArtifact, relativePath: '../outside.md' }).success
    ).toBe(false)
  })

  it('refuse une traversée `..` au milieu du chemin', () => {
    expect(
      workflowArtifactSchema.safeParse({ ...validArtifact, relativePath: 'workflow/../../../etc/passwd' }).success
    ).toBe(false)
  })

  it('accepte un chemin relatif imbriqué valide', () => {
    expect(
      workflowArtifactSchema.safeParse({ ...validArtifact, relativePath: 'workflow/reports/RAPPORT_ORCH_1.1.md' })
        .success
    ).toBe(true)
  })

  it('refuse un createdAt invalide', () => {
    expect(workflowArtifactSchema.safeParse({ ...validArtifact, createdAt: 'not-a-date' }).success).toBe(false)
  })

  it('refuse un champ obligatoire absent (relativePath)', () => {
    const { relativePath: _relativePath, ...rest } = validArtifact
    expect(workflowArtifactSchema.safeParse(rest).success).toBe(false)
  })

  it("refuse un champ updatedAt (les artefacts ne sont jamais mis à jour, seulement recréés)", () => {
    expect(
      workflowArtifactSchema.safeParse({ ...validArtifact, updatedAt: VALID_TIMESTAMP }).success
    ).toBe(false)
  })

  it('refuse un champ inconnu', () => {
    expect(workflowArtifactSchema.safeParse({ ...validArtifact, unknownField: 'x' }).success).toBe(false)
  })
})
