import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  commandExecutionSchema,
  completeCommandExecutionSchema,
  createCommandExecutionSchema,
  type CommandExecution,
  type CommandExecutionStatus,
  type CompleteCommandExecutionInput,
  type CreateCommandExecutionInput
} from '../../../shared/orchestration'

/**
 * Forme d'une ligne SQLite de la table `command_executions` (colonnes en
 * snake_case). Reste interne au repository : le contrat exposé est le type
 * partagé `CommandExecution`. `args` est stocké en TEXT JSON (convention
 * posée en ORCH-2.1).
 */
type CommandExecutionRow = {
  id: string
  workflow_run_id: string
  workflow_step_id: string | null
  executable: string
  args: string
  cwd: string
  status: CommandExecutionStatus
  exit_code: number | null
  stdout: string
  stderr: string
  stdout_truncated: 0 | 1
  stderr_truncated: 0 | 1
  started_at: string | null
  completed_at: string | null
  duration_ms: number | null
  created_at: string
  updated_at: string
}

function mapRowToCommandExecution(row: CommandExecutionRow): CommandExecution {
  return commandExecutionSchema.parse({
    id: row.id,
    workflowRunId: row.workflow_run_id,
    workflowStepId: row.workflow_step_id,
    executable: row.executable,
    args: JSON.parse(row.args) as string[],
    cwd: row.cwd,
    status: row.status,
    exitCode: row.exit_code,
    stdout: row.stdout,
    stderr: row.stderr,
    stdoutTruncated: row.stdout_truncated === 1,
    stderrTruncated: row.stderr_truncated === 1,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationMs: row.duration_ms,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  })
}

export type CommandExecutionsRepository = {
  readonly listByWorkflowRunId: (workflowRunId: string) => CommandExecution[]
  readonly getById: (id: string) => CommandExecution | null
  readonly create: (input: CreateCommandExecutionInput) => CommandExecution
  readonly markRunning: (id: string) => CommandExecution
  readonly complete: (id: string, input: CompleteCommandExecutionInput) => CommandExecution
}

export type CommandExecutionsRepositoryOptions = {
  /**
   * Fonction d'horloge injectable, utilisée pour générer `createdAt`,
   * `updatedAt`, `startedAt` et `completedAt`. Par défaut
   * `() => new Date().toISOString()`.
   */
  readonly now?: () => string
}

/**
 * Crée le repository SQLite du module `command_executions` (ORCH-2.2).
 * Reçoit une connexion `better-sqlite3` déjà ouverte : n'en ouvre ni n'en
 * ferme jamais elle-même.
 */
export function createCommandExecutionsRepository(
  database: Database.Database,
  options: CommandExecutionsRepositoryOptions = {}
): CommandExecutionsRepository {
  const now = options.now ?? (() => new Date().toISOString())

  const SELECT_COLUMNS = `id, workflow_run_id, workflow_step_id, executable, args, cwd, status, exit_code, stdout, stderr, stdout_truncated, stderr_truncated, started_at, completed_at, duration_ms, created_at, updated_at`

  const listByRunStatement = database.prepare(
    `SELECT ${SELECT_COLUMNS}
     FROM command_executions
     WHERE workflow_run_id = @workflowRunId
     ORDER BY created_at ASC, id ASC`
  )

  const getByIdStatement = database.prepare(
    `SELECT ${SELECT_COLUMNS}
     FROM command_executions
     WHERE id = @id`
  )

  const insertStatement = database.prepare(
    `INSERT INTO command_executions
       (id, workflow_run_id, workflow_step_id, executable, args, cwd, status, exit_code, stdout, stderr,
        stdout_truncated, stderr_truncated, started_at, completed_at, duration_ms, created_at, updated_at)
     VALUES (@id, @workflow_run_id, @workflow_step_id, @executable, @args, @cwd, @status, @exit_code, @stdout, @stderr,
             @stdout_truncated, @stderr_truncated, @started_at, @completed_at, @duration_ms, @created_at, @updated_at)`
  )

  const markRunningStatement = database.prepare(
    `UPDATE command_executions SET status = 'running', started_at = @started_at, updated_at = @updated_at WHERE id = @id`
  )

  const completeStatement = database.prepare(
    `UPDATE command_executions
     SET status = @status, exit_code = @exit_code, duration_ms = @duration_ms, stdout = @stdout, stderr = @stderr,
         stdout_truncated = @stdout_truncated, stderr_truncated = @stderr_truncated, completed_at = @completed_at,
         updated_at = @updated_at
     WHERE id = @id`
  )

  function findRowById(id: string): CommandExecutionRow | undefined {
    return getByIdStatement.get({ id }) as CommandExecutionRow | undefined
  }

  function getExistingRowOrThrow(id: string): CommandExecutionRow {
    const row = findRowById(id)
    if (!row) {
      throw new Error(`Aucune command_execution trouvée pour l'identifiant "${id}".`)
    }
    return row
  }

  function listByWorkflowRunId(workflowRunId: string): CommandExecution[] {
    const rows = listByRunStatement.all({ workflowRunId }) as CommandExecutionRow[]
    return rows.map(mapRowToCommandExecution)
  }

  function getById(id: string): CommandExecution | null {
    const row = findRowById(id)
    return row ? mapRowToCommandExecution(row) : null
  }

  function create(input: CreateCommandExecutionInput): CommandExecution {
    const data = createCommandExecutionSchema.parse(input)
    const id = randomUUID()
    const timestamp = now()

    insertStatement.run({
      id,
      workflow_run_id: data.workflowRunId,
      workflow_step_id: data.workflowStepId,
      executable: data.executable,
      args: JSON.stringify(data.args),
      cwd: data.cwd,
      status: 'pending',
      exit_code: null,
      stdout: '',
      stderr: '',
      stdout_truncated: 0,
      stderr_truncated: 0,
      started_at: null,
      completed_at: null,
      duration_ms: null,
      created_at: timestamp,
      updated_at: timestamp
    })

    return mapRowToCommandExecution(findRowById(id) as CommandExecutionRow)
  }

  function markRunning(id: string): CommandExecution {
    const existing = getExistingRowOrThrow(id)

    if (existing.status !== 'pending') {
      throw new Error(
        `Impossible de démarrer la command_execution "${id}" : statut courant "${existing.status}" (attendu "pending").`
      )
    }

    const timestamp = now()
    markRunningStatement.run({ id, started_at: timestamp, updated_at: timestamp })

    return mapRowToCommandExecution(findRowById(id) as CommandExecutionRow)
  }

  function complete(id: string, input: CompleteCommandExecutionInput): CommandExecution {
    const data = completeCommandExecutionSchema.parse(input)
    const existing = getExistingRowOrThrow(id)

    if (existing.status !== 'running') {
      throw new Error(
        `Impossible de compléter la command_execution "${id}" : statut courant "${existing.status}" (attendu "running").`
      )
    }

    const timestamp = now()
    completeStatement.run({
      id,
      status: data.status,
      exit_code: data.exitCode,
      duration_ms: data.durationMs,
      stdout: data.stdout,
      stderr: data.stderr,
      stdout_truncated: data.stdoutTruncated ? 1 : 0,
      stderr_truncated: data.stderrTruncated ? 1 : 0,
      completed_at: timestamp,
      updated_at: timestamp
    })

    return mapRowToCommandExecution(findRowById(id) as CommandExecutionRow)
  }

  return { listByWorkflowRunId, getById, create, markRunning, complete }
}
