import { describe, expect, it } from 'vitest'
import {
  COMMAND_EXECUTION_STATUSES,
  type CommandExecution,
  commandExecutionSchema,
  commandExecutionStatusSchema
} from './commandExecution'

const VALID_ID = '123e4567-e89b-12d3-a456-426614174000'
const VALID_RUN_ID = '00000000-0000-4000-8000-000000000001'
const VALID_STEP_ID = '00000000-0000-4000-8000-000000000002'
const VALID_TIMESTAMP = '2026-07-20T10:00:00.000Z'

const validExecution: CommandExecution = {
  id: VALID_ID,
  workflowRunId: VALID_RUN_ID,
  workflowStepId: VALID_STEP_ID,
  executable: 'npm',
  args: ['run', 'typecheck'],
  cwd: 'C:\\repos\\theme-factory-companion',
  status: 'completed',
  exitCode: 0,
  stdout: 'ok',
  stderr: '',
  stdoutTruncated: false,
  stderrTruncated: false,
  startedAt: VALID_TIMESTAMP,
  completedAt: VALID_TIMESTAMP,
  durationMs: 1200,
  createdAt: VALID_TIMESTAMP,
  updatedAt: VALID_TIMESTAMP
}

describe('COMMAND_EXECUTION_STATUSES / commandExecutionStatusSchema', () => {
  it.each(COMMAND_EXECUTION_STATUSES)('accepte le statut autorisé "%s"', (status) => {
    expect(commandExecutionStatusSchema.safeParse(status).success).toBe(true)
  })

  it('refuse un statut inconnu', () => {
    expect(commandExecutionStatusSchema.safeParse('unknown').success).toBe(false)
  })
})

describe('commandExecutionSchema', () => {
  it('accepte une exécution complète valide', () => {
    expect(commandExecutionSchema.safeParse(validExecution).success).toBe(true)
  })

  it("refuse un id qui n'est pas un UUID", () => {
    expect(commandExecutionSchema.safeParse({ ...validExecution, id: 'not-a-uuid' }).success).toBe(false)
  })

  it("refuse un workflowRunId qui n'est pas un UUID", () => {
    expect(commandExecutionSchema.safeParse({ ...validExecution, workflowRunId: 'not-a-uuid' }).success).toBe(false)
  })

  it('accepte workflowStepId à null', () => {
    expect(commandExecutionSchema.safeParse({ ...validExecution, workflowStepId: null }).success).toBe(true)
  })

  it('refuse un exécutable vide', () => {
    expect(commandExecutionSchema.safeParse({ ...validExecution, executable: '' }).success).toBe(false)
  })

  it('conserve exécutable et arguments séparément (jamais une chaîne concaténée)', () => {
    const result = commandExecutionSchema.safeParse(validExecution)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.executable).toBe('npm')
      expect(result.data.args).toEqual(['run', 'typecheck'])
    }
  })

  it('refuse args non-tableau (chaîne concaténée)', () => {
    expect(
      commandExecutionSchema.safeParse({ ...validExecution, args: 'run typecheck' }).success
    ).toBe(false)
  })

  it('accepte un tableau args vide', () => {
    expect(commandExecutionSchema.safeParse({ ...validExecution, args: [] }).success).toBe(true)
  })

  it('refuse un cwd vide', () => {
    expect(commandExecutionSchema.safeParse({ ...validExecution, cwd: '' }).success).toBe(false)
  })

  it('refuse un statut invalide', () => {
    expect(commandExecutionSchema.safeParse({ ...validExecution, status: 'unknown' }).success).toBe(false)
  })

  it('refuse un exitCode non entier', () => {
    expect(commandExecutionSchema.safeParse({ ...validExecution, exitCode: 1.5 }).success).toBe(false)
  })

  it('accepte stdout/stderr vides', () => {
    expect(commandExecutionSchema.safeParse({ ...validExecution, stdout: '', stderr: '' }).success).toBe(true)
  })

  it('refuse stdoutTruncated non booléen', () => {
    expect(commandExecutionSchema.safeParse({ ...validExecution, stdoutTruncated: 'true' }).success).toBe(false)
  })

  it('accepte une troncature explicitement signalée', () => {
    expect(
      commandExecutionSchema.safeParse({ ...validExecution, stdoutTruncated: true, stderrTruncated: true }).success
    ).toBe(true)
  })

  it('refuse une durée négative', () => {
    expect(commandExecutionSchema.safeParse({ ...validExecution, durationMs: -1 }).success).toBe(false)
  })

  it('refuse une durée non entière', () => {
    expect(commandExecutionSchema.safeParse({ ...validExecution, durationMs: 1.5 }).success).toBe(false)
  })

  it('accepte durationMs/completedAt à null pour une exécution "running" (non terminée)', () => {
    expect(
      commandExecutionSchema.safeParse({
        ...validExecution,
        status: 'running',
        completedAt: null,
        durationMs: null,
        exitCode: null
      }).success
    ).toBe(true)
  })

  it('refuse un startedAt invalide', () => {
    expect(commandExecutionSchema.safeParse({ ...validExecution, startedAt: 'not-a-date' }).success).toBe(false)
  })

  it('refuse un createdAt invalide', () => {
    expect(commandExecutionSchema.safeParse({ ...validExecution, createdAt: 'not-a-date' }).success).toBe(false)
  })

  it('refuse un updatedAt invalide', () => {
    expect(commandExecutionSchema.safeParse({ ...validExecution, updatedAt: 'not-a-date' }).success).toBe(false)
  })

  it('refuse un champ obligatoire absent (cwd)', () => {
    const { cwd: _cwd, ...rest } = validExecution
    expect(commandExecutionSchema.safeParse(rest).success).toBe(false)
  })

  it('refuse un champ inconnu', () => {
    expect(commandExecutionSchema.safeParse({ ...validExecution, unknownField: 'x' }).success).toBe(false)
  })
})

describe('commandExecutionSchema — cohérence status/startedAt/completedAt/durationMs/exitCode', () => {
  const pendingExecution = {
    ...validExecution,
    status: 'pending' as const,
    startedAt: null,
    completedAt: null,
    durationMs: null,
    exitCode: null
  }

  const runningExecution = {
    ...validExecution,
    status: 'running' as const,
    startedAt: VALID_TIMESTAMP,
    completedAt: null,
    durationMs: null,
    exitCode: null
  }

  it('accepte "pending" avec startedAt/completedAt/durationMs/exitCode à null', () => {
    expect(commandExecutionSchema.safeParse(pendingExecution).success).toBe(true)
  })

  it('refuse "pending" avec startedAt renseigné', () => {
    expect(commandExecutionSchema.safeParse({ ...pendingExecution, startedAt: VALID_TIMESTAMP }).success).toBe(false)
  })

  it('refuse "pending" avec exitCode renseigné', () => {
    expect(commandExecutionSchema.safeParse({ ...pendingExecution, exitCode: 0 }).success).toBe(false)
  })

  it('accepte "running" avec startedAt renseigné et completedAt/durationMs/exitCode à null', () => {
    expect(commandExecutionSchema.safeParse(runningExecution).success).toBe(true)
  })

  it('refuse "running" avec startedAt à null', () => {
    expect(commandExecutionSchema.safeParse({ ...runningExecution, startedAt: null }).success).toBe(false)
  })

  it('refuse "running" avec completedAt renseigné', () => {
    expect(commandExecutionSchema.safeParse({ ...runningExecution, completedAt: VALID_TIMESTAMP }).success).toBe(
      false
    )
  })

  it('accepte "completed" avec startedAt/completedAt/durationMs renseignés et exitCode: 0', () => {
    expect(commandExecutionSchema.safeParse(validExecution).success).toBe(true)
  })

  it('refuse "completed" avec exitCode différent de 0', () => {
    expect(commandExecutionSchema.safeParse({ ...validExecution, exitCode: 1 }).success).toBe(false)
  })

  it('refuse "completed" avec exitCode à null', () => {
    expect(commandExecutionSchema.safeParse({ ...validExecution, exitCode: null }).success).toBe(false)
  })

  it('refuse "completed" avec completedAt à null', () => {
    expect(commandExecutionSchema.safeParse({ ...validExecution, completedAt: null }).success).toBe(false)
  })

  it('refuse "completed" avec durationMs à null', () => {
    expect(commandExecutionSchema.safeParse({ ...validExecution, durationMs: null }).success).toBe(false)
  })

  it.each(['failed', 'timed_out', 'cancelled'] as const)(
    'accepte le statut "%s" avec startedAt/completedAt/durationMs renseignés et exitCode à null',
    (status) => {
      expect(
        commandExecutionSchema.safeParse({ ...validExecution, status, exitCode: null }).success
      ).toBe(true)
    }
  )

  it.each(['failed', 'timed_out', 'cancelled'] as const)(
    'accepte le statut "%s" avec un exitCode non nul renseigné (pas de contrainte sur sa valeur)',
    (status) => {
      expect(commandExecutionSchema.safeParse({ ...validExecution, status, exitCode: 127 }).success).toBe(true)
    }
  )

  it.each(['failed', 'timed_out', 'cancelled'] as const)(
    'refuse le statut "%s" avec startedAt à null',
    (status) => {
      expect(commandExecutionSchema.safeParse({ ...validExecution, status, startedAt: null }).success).toBe(false)
    }
  )

  it.each(['failed', 'timed_out', 'cancelled'] as const)(
    'refuse le statut "%s" avec completedAt à null',
    (status) => {
      expect(commandExecutionSchema.safeParse({ ...validExecution, status, completedAt: null }).success).toBe(false)
    }
  )

  it.each(['failed', 'timed_out', 'cancelled'] as const)(
    'refuse le statut "%s" avec durationMs à null',
    (status) => {
      expect(commandExecutionSchema.safeParse({ ...validExecution, status, durationMs: null }).success).toBe(false)
    }
  )
})
