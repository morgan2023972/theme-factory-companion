import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  createWorkflowApprovalSchema,
  decideWorkflowApprovalSchema,
  workflowApprovalSchema,
  type CreateWorkflowApprovalInput,
  type DecideWorkflowApprovalInput,
  type WorkflowApproval,
  type WorkflowApprovalStatus,
  type WorkflowApprovalType
} from '../../../shared/orchestration'

/**
 * Forme d'une ligne SQLite de la table `workflow_approvals` (colonnes en
 * snake_case). Reste interne au repository : le contrat exposé est le type
 * partagé `WorkflowApproval`.
 */
type WorkflowApprovalRow = {
  id: string
  workflow_run_id: string
  workflow_step_id: string | null
  type: WorkflowApprovalType
  status: WorkflowApprovalStatus
  requested_at: string
  decided_at: string | null
  created_at: string
  updated_at: string
}

function mapRowToWorkflowApproval(row: WorkflowApprovalRow): WorkflowApproval {
  return workflowApprovalSchema.parse({
    id: row.id,
    workflowRunId: row.workflow_run_id,
    workflowStepId: row.workflow_step_id,
    type: row.type,
    status: row.status,
    requestedAt: row.requested_at,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  })
}

export type WorkflowApprovalsRepository = {
  readonly listByWorkflowRunId: (workflowRunId: string) => WorkflowApproval[]
  readonly getById: (id: string) => WorkflowApproval | null
  readonly create: (input: CreateWorkflowApprovalInput) => WorkflowApproval
  readonly decide: (id: string, input: DecideWorkflowApprovalInput) => WorkflowApproval
}

export type WorkflowApprovalsRepositoryOptions = {
  /**
   * Fonction d'horloge injectable, utilisée pour générer `createdAt`,
   * `updatedAt`, `requestedAt` et `decidedAt`. Par défaut
   * `() => new Date().toISOString()`.
   */
  readonly now?: () => string
}

/**
 * Crée le repository SQLite du module `workflow_approvals` (ORCH-2.2).
 * Reçoit une connexion `better-sqlite3` déjà ouverte : n'en ouvre ni n'en
 * ferme jamais elle-même.
 */
export function createWorkflowApprovalsRepository(
  database: Database.Database,
  options: WorkflowApprovalsRepositoryOptions = {}
): WorkflowApprovalsRepository {
  const now = options.now ?? (() => new Date().toISOString())

  const SELECT_COLUMNS = `id, workflow_run_id, workflow_step_id, type, status, requested_at, decided_at, created_at, updated_at`

  const listByRunStatement = database.prepare(
    `SELECT ${SELECT_COLUMNS}
     FROM workflow_approvals
     WHERE workflow_run_id = @workflowRunId
     ORDER BY requested_at ASC, id ASC`
  )

  const getByIdStatement = database.prepare(
    `SELECT ${SELECT_COLUMNS}
     FROM workflow_approvals
     WHERE id = @id`
  )

  const insertStatement = database.prepare(
    `INSERT INTO workflow_approvals
       (id, workflow_run_id, workflow_step_id, type, status, requested_at, decided_at, created_at, updated_at)
     VALUES (@id, @workflow_run_id, @workflow_step_id, @type, @status, @requested_at, @decided_at, @created_at, @updated_at)`
  )

  const decideStatement = database.prepare(
    `UPDATE workflow_approvals SET status = @status, decided_at = @decided_at, updated_at = @updated_at WHERE id = @id`
  )

  function findRowById(id: string): WorkflowApprovalRow | undefined {
    return getByIdStatement.get({ id }) as WorkflowApprovalRow | undefined
  }

  function getExistingRowOrThrow(id: string): WorkflowApprovalRow {
    const row = findRowById(id)
    if (!row) {
      throw new Error(`Aucune workflow_approval trouvée pour l'identifiant "${id}".`)
    }
    return row
  }

  function listByWorkflowRunId(workflowRunId: string): WorkflowApproval[] {
    const rows = listByRunStatement.all({ workflowRunId }) as WorkflowApprovalRow[]
    return rows.map(mapRowToWorkflowApproval)
  }

  function getById(id: string): WorkflowApproval | null {
    const row = findRowById(id)
    return row ? mapRowToWorkflowApproval(row) : null
  }

  function create(input: CreateWorkflowApprovalInput): WorkflowApproval {
    const data = createWorkflowApprovalSchema.parse(input)
    const id = randomUUID()
    const timestamp = now()

    insertStatement.run({
      id,
      workflow_run_id: data.workflowRunId,
      workflow_step_id: data.workflowStepId,
      type: data.type,
      status: 'pending',
      requested_at: timestamp,
      decided_at: null,
      created_at: timestamp,
      updated_at: timestamp
    })

    return mapRowToWorkflowApproval(findRowById(id) as WorkflowApprovalRow)
  }

  /**
   * Autorisé uniquement depuis `pending` : une approbation n'est jamais
   * réutilisable pour une décision ultérieure (section 18 des règles de
   * sécurité).
   */
  function decide(id: string, input: DecideWorkflowApprovalInput): WorkflowApproval {
    const data = decideWorkflowApprovalSchema.parse(input)
    const existing = getExistingRowOrThrow(id)

    if (existing.status !== 'pending') {
      throw new Error(
        `Impossible de décider l'approbation "${id}" : statut courant "${existing.status}" (attendu "pending").`
      )
    }

    const timestamp = now()
    decideStatement.run({ id, status: data.status, decided_at: timestamp, updated_at: timestamp })

    return mapRowToWorkflowApproval(findRowById(id) as WorkflowApprovalRow)
  }

  return { listByWorkflowRunId, getById, create, decide }
}
