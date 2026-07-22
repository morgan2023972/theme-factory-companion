import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  createWorkflowArtifactSchema,
  workflowArtifactSchema,
  type CreateWorkflowArtifactInput,
  type WorkflowArtifact,
  type WorkflowArtifactType
} from '../../../shared/orchestration'

/**
 * Forme d'une ligne SQLite de la table `workflow_artifacts` (colonnes en
 * snake_case). Reste interne au repository : le contrat exposé est le type
 * partagé `WorkflowArtifact`.
 */
type WorkflowArtifactRow = {
  id: string
  workflow_run_id: string
  workflow_step_id: string | null
  type: WorkflowArtifactType
  relative_path: string
  created_at: string
}

function mapRowToWorkflowArtifact(row: WorkflowArtifactRow): WorkflowArtifact {
  return workflowArtifactSchema.parse({
    id: row.id,
    workflowRunId: row.workflow_run_id,
    workflowStepId: row.workflow_step_id,
    type: row.type,
    relativePath: row.relative_path,
    createdAt: row.created_at
  })
}

export type WorkflowArtifactsRepository = {
  readonly listByWorkflowRunId: (workflowRunId: string) => WorkflowArtifact[]
  readonly getById: (id: string) => WorkflowArtifact | null
  readonly create: (input: CreateWorkflowArtifactInput) => WorkflowArtifact
}

export type WorkflowArtifactsRepositoryOptions = {
  /**
   * Fonction d'horloge injectable, utilisée pour générer `createdAt`. Par
   * défaut `() => new Date().toISOString()`.
   */
  readonly now?: () => string
}

/**
 * Crée le repository SQLite du module `workflow_artifacts` (ORCH-2.2).
 * Reçoit une connexion `better-sqlite3` déjà ouverte : n'en ouvre ni n'en
 * ferme jamais elle-même. Aucune fonction `update`/`remove` : un artefact
 * est immuable après création (ORCH-1.1, ORCH-2.1 décision n°6, section 5
 * des règles de sécurité).
 */
export function createWorkflowArtifactsRepository(
  database: Database.Database,
  options: WorkflowArtifactsRepositoryOptions = {}
): WorkflowArtifactsRepository {
  const now = options.now ?? (() => new Date().toISOString())

  const listByRunStatement = database.prepare(
    `SELECT id, workflow_run_id, workflow_step_id, type, relative_path, created_at
     FROM workflow_artifacts
     WHERE workflow_run_id = @workflowRunId
     ORDER BY created_at ASC, id ASC`
  )

  const getByIdStatement = database.prepare(
    `SELECT id, workflow_run_id, workflow_step_id, type, relative_path, created_at
     FROM workflow_artifacts
     WHERE id = @id`
  )

  const insertStatement = database.prepare(
    `INSERT INTO workflow_artifacts (id, workflow_run_id, workflow_step_id, type, relative_path, created_at)
     VALUES (@id, @workflow_run_id, @workflow_step_id, @type, @relative_path, @created_at)`
  )

  function findRowById(id: string): WorkflowArtifactRow | undefined {
    return getByIdStatement.get({ id }) as WorkflowArtifactRow | undefined
  }

  function listByWorkflowRunId(workflowRunId: string): WorkflowArtifact[] {
    const rows = listByRunStatement.all({ workflowRunId }) as WorkflowArtifactRow[]
    return rows.map(mapRowToWorkflowArtifact)
  }

  function getById(id: string): WorkflowArtifact | null {
    const row = findRowById(id)
    return row ? mapRowToWorkflowArtifact(row) : null
  }

  function create(input: CreateWorkflowArtifactInput): WorkflowArtifact {
    const data = createWorkflowArtifactSchema.parse(input)
    const id = randomUUID()

    insertStatement.run({
      id,
      workflow_run_id: data.workflowRunId,
      workflow_step_id: data.workflowStepId,
      type: data.type,
      relative_path: data.relativePath,
      created_at: now()
    })

    return mapRowToWorkflowArtifact(findRowById(id) as WorkflowArtifactRow)
  }

  return { listByWorkflowRunId, getById, create }
}
