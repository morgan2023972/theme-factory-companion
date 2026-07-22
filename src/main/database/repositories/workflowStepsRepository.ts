import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  createWorkflowStepSchema,
  workflowStepSchema,
  type CreateWorkflowStepInput,
  type WorkflowStep,
  type WorkflowStepStatus,
  type WorkflowStepType
} from '../../../shared/orchestration'

/**
 * Forme d'une ligne SQLite de la table `workflow_steps` (colonnes en
 * snake_case). Reste interne au repository : le contrat exposé est le type
 * partagé `WorkflowStep`.
 */
type WorkflowStepRow = {
  id: string
  workflow_run_id: string
  type: WorkflowStepType
  status: WorkflowStepStatus
  position: number
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

/** Statuts terminaux (au sens de cette entité) acceptés par `complete`. */
const COMPLETABLE_STEP_STATUSES = ['completed', 'failed', 'cancelled', 'skipped'] as const
type CompletableStepStatus = (typeof COMPLETABLE_STEP_STATUSES)[number]

function mapRowToWorkflowStep(row: WorkflowStepRow): WorkflowStep {
  return workflowStepSchema.parse({
    id: row.id,
    workflowRunId: row.workflow_run_id,
    type: row.type,
    status: row.status,
    position: row.position,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  })
}

export type WorkflowStepsRepository = {
  readonly listByWorkflowRunId: (workflowRunId: string) => WorkflowStep[]
  readonly getById: (id: string) => WorkflowStep | null
  readonly create: (input: CreateWorkflowStepInput) => WorkflowStep
  readonly start: (id: string) => WorkflowStep
  readonly complete: (id: string, status: CompletableStepStatus) => WorkflowStep
}

export type WorkflowStepsRepositoryOptions = {
  /**
   * Fonction d'horloge injectable, utilisée pour générer `createdAt`,
   * `updatedAt`, `startedAt` et `completedAt`. Par défaut
   * `() => new Date().toISOString()`.
   */
  readonly now?: () => string
}

/**
 * Crée le repository SQLite du module `workflow_steps` (ORCH-2.2).
 * Reçoit une connexion `better-sqlite3` déjà ouverte : n'en ouvre ni n'en
 * ferme jamais elle-même.
 */
export function createWorkflowStepsRepository(
  database: Database.Database,
  options: WorkflowStepsRepositoryOptions = {}
): WorkflowStepsRepository {
  const now = options.now ?? (() => new Date().toISOString())

  const SELECT_COLUMNS = `id, workflow_run_id, type, status, position, started_at, completed_at, created_at, updated_at`

  const listByRunStatement = database.prepare(
    `SELECT ${SELECT_COLUMNS}
     FROM workflow_steps
     WHERE workflow_run_id = @workflowRunId
     ORDER BY position ASC, id ASC`
  )

  const getByIdStatement = database.prepare(
    `SELECT ${SELECT_COLUMNS}
     FROM workflow_steps
     WHERE id = @id`
  )

  const insertStatement = database.prepare(
    `INSERT INTO workflow_steps (id, workflow_run_id, type, status, position, started_at, completed_at, created_at, updated_at)
     VALUES (@id, @workflow_run_id, @type, @status, @position, @started_at, @completed_at, @created_at, @updated_at)`
  )

  const startStatement = database.prepare(
    `UPDATE workflow_steps SET status = 'in_progress', started_at = @started_at, updated_at = @updated_at WHERE id = @id`
  )

  const completeStatement = database.prepare(
    `UPDATE workflow_steps SET status = @status, completed_at = @completed_at, updated_at = @updated_at WHERE id = @id`
  )

  function findRowById(id: string): WorkflowStepRow | undefined {
    return getByIdStatement.get({ id }) as WorkflowStepRow | undefined
  }

  function getExistingRowOrThrow(id: string): WorkflowStepRow {
    const row = findRowById(id)
    if (!row) {
      throw new Error(`Aucun workflow_step trouvé pour l'identifiant "${id}".`)
    }
    return row
  }

  function listByWorkflowRunId(workflowRunId: string): WorkflowStep[] {
    const rows = listByRunStatement.all({ workflowRunId }) as WorkflowStepRow[]
    return rows.map(mapRowToWorkflowStep)
  }

  function getById(id: string): WorkflowStep | null {
    const row = findRowById(id)
    return row ? mapRowToWorkflowStep(row) : null
  }

  function create(input: CreateWorkflowStepInput): WorkflowStep {
    const data = createWorkflowStepSchema.parse(input)
    const id = randomUUID()
    const timestamp = now()

    insertStatement.run({
      id,
      workflow_run_id: data.workflowRunId,
      type: data.type,
      status: 'pending',
      position: data.position,
      started_at: null,
      completed_at: null,
      created_at: timestamp,
      updated_at: timestamp
    })

    return mapRowToWorkflowStep(findRowById(id) as WorkflowStepRow)
  }

  function start(id: string): WorkflowStep {
    const existing = getExistingRowOrThrow(id)

    if (existing.status !== 'pending') {
      throw new Error(`Impossible de démarrer le step "${id}" : statut courant "${existing.status}" (attendu "pending").`)
    }

    const timestamp = now()
    startStatement.run({ id, started_at: timestamp, updated_at: timestamp })

    return mapRowToWorkflowStep(findRowById(id) as WorkflowStepRow)
  }

  /**
   * Autorisé depuis `pending` ou `in_progress` : un step `skipped` peut
   * n'avoir jamais démarré (ORCH-1.1). Refusé si le step est déjà dans un
   * statut terminal.
   */
  function complete(id: string, status: CompletableStepStatus): WorkflowStep {
    const existing = getExistingRowOrThrow(id)

    if (existing.status !== 'pending' && existing.status !== 'in_progress') {
      throw new Error(
        `Impossible de compléter le step "${id}" : statut courant "${existing.status}" (attendu "pending" ou "in_progress").`
      )
    }

    const timestamp = now()
    completeStatement.run({ id, status, completed_at: timestamp, updated_at: timestamp })

    return mapRowToWorkflowStep(findRowById(id) as WorkflowStepRow)
  }

  return { listByWorkflowRunId, getById, create, start, complete }
}
