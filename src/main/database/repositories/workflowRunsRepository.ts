import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  WORKFLOW_RUN_TERMINAL_STATUSES,
  createWorkflowRunSchema,
  isValidWorkflowRunTransition,
  workflowRunSchema,
  type CreateWorkflowRunInput,
  type WorkflowRun,
  type WorkflowRunStatus
} from '../../../shared/orchestration'

/**
 * Forme d'une ligne SQLite de la table `workflow_runs` (colonnes en
 * snake_case). Reste interne au repository : le contrat exposé est le type
 * partagé `WorkflowRun`.
 */
type WorkflowRunRow = {
  id: string
  project_id: string
  phase_id: string
  profile_id: string
  profile_fingerprint: string
  status: WorkflowRunStatus
  current_step_id: string | null
  started_at: string
  completed_at: string | null
  created_at: string
  updated_at: string
}

function mapRowToWorkflowRun(row: WorkflowRunRow): WorkflowRun {
  return workflowRunSchema.parse({
    id: row.id,
    projectId: row.project_id,
    phaseId: row.phase_id,
    profileId: row.profile_id,
    profileFingerprint: row.profile_fingerprint,
    status: row.status,
    currentStepId: row.current_step_id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  })
}

export type WorkflowRunsRepository = {
  readonly listByProjectId: (projectId: string) => WorkflowRun[]
  readonly getById: (id: string) => WorkflowRun | null
  readonly create: (input: CreateWorkflowRunInput) => WorkflowRun
  readonly updateStatus: (id: string, status: WorkflowRunStatus) => WorkflowRun
  readonly updateCurrentStepId: (id: string, currentStepId: string | null) => WorkflowRun
}

export type WorkflowRunsRepositoryOptions = {
  /**
   * Fonction d'horloge injectable, utilisée pour générer `createdAt`,
   * `updatedAt`, `startedAt` et `completedAt`. Par défaut
   * `() => new Date().toISOString()`.
   */
  readonly now?: () => string
}

/**
 * Crée le repository SQLite du module `workflow_runs` (ORCH-2.2).
 * Reçoit une connexion `better-sqlite3` déjà ouverte : n'en ouvre ni n'en
 * ferme jamais elle-même.
 */
export function createWorkflowRunsRepository(
  database: Database.Database,
  options: WorkflowRunsRepositoryOptions = {}
): WorkflowRunsRepository {
  const now = options.now ?? (() => new Date().toISOString())

  const SELECT_COLUMNS = `id, project_id, phase_id, profile_id, profile_fingerprint, status, current_step_id, started_at, completed_at, created_at, updated_at`

  const listByProjectStatement = database.prepare(
    `SELECT ${SELECT_COLUMNS}
     FROM workflow_runs
     WHERE project_id = @projectId
     ORDER BY started_at DESC, id DESC`
  )

  const getByIdStatement = database.prepare(
    `SELECT ${SELECT_COLUMNS}
     FROM workflow_runs
     WHERE id = @id`
  )

  const insertStatement = database.prepare(
    `INSERT INTO workflow_runs
       (id, project_id, phase_id, profile_id, profile_fingerprint, status, current_step_id, started_at, completed_at, created_at, updated_at)
     VALUES (@id, @project_id, @phase_id, @profile_id, @profile_fingerprint, @status, @current_step_id, @started_at, @completed_at, @created_at, @updated_at)`
  )

  const updateStatusStatement = database.prepare(
    `UPDATE workflow_runs SET status = @status, completed_at = @completed_at, updated_at = @updated_at WHERE id = @id`
  )

  const updateCurrentStepIdStatement = database.prepare(
    `UPDATE workflow_runs SET current_step_id = @current_step_id, updated_at = @updated_at WHERE id = @id`
  )

  const findStepInRunStatement = database.prepare(
    `SELECT id FROM workflow_steps WHERE id = @stepId AND workflow_run_id = @workflowRunId`
  )

  function findRowById(id: string): WorkflowRunRow | undefined {
    return getByIdStatement.get({ id }) as WorkflowRunRow | undefined
  }

  function getExistingRowOrThrow(id: string): WorkflowRunRow {
    const row = findRowById(id)
    if (!row) {
      throw new Error(`Aucun workflow_run trouvé pour l'identifiant "${id}".`)
    }
    return row
  }

  function listByProjectId(projectId: string): WorkflowRun[] {
    const rows = listByProjectStatement.all({ projectId }) as WorkflowRunRow[]
    return rows.map(mapRowToWorkflowRun)
  }

  function getById(id: string): WorkflowRun | null {
    const row = findRowById(id)
    return row ? mapRowToWorkflowRun(row) : null
  }

  function create(input: CreateWorkflowRunInput): WorkflowRun {
    const data = createWorkflowRunSchema.parse(input)
    const id = randomUUID()
    const timestamp = now()

    insertStatement.run({
      id,
      project_id: data.projectId,
      phase_id: data.phaseId,
      profile_id: data.profileId,
      profile_fingerprint: data.profileFingerprint,
      status: 'draft',
      current_step_id: null,
      started_at: timestamp,
      completed_at: null,
      created_at: timestamp,
      updated_at: timestamp
    })

    return mapRowToWorkflowRun(findRowById(id) as WorkflowRunRow)
  }

  /**
   * Point d'intégration explicite entre ORCH-1.2 (machine à états pure) et
   * ORCH-2.2 (persistance) : toute transition non autorisée par
   * `isValidWorkflowRunTransition` est refusée avant toute écriture. Si le
   * nouveau statut est terminal, `completed_at` est fixé à `now()` ; sinon
   * il reste inchangé (déjà `null`, aucune transition ORCH-1.2 ne ramène un
   * run vers un état non terminal après un état terminal).
   */
  function updateStatus(id: string, status: WorkflowRunStatus): WorkflowRun {
    const existing = getExistingRowOrThrow(id)

    if (!isValidWorkflowRunTransition(existing.status, status)) {
      throw new Error(`Transition de workflow refusée : "${existing.status}" -> "${status}".`)
    }

    const isTerminal = (WORKFLOW_RUN_TERMINAL_STATUSES as readonly WorkflowRunStatus[]).includes(status)
    const timestamp = now()

    updateStatusStatement.run({
      id,
      status,
      completed_at: isTerminal ? timestamp : existing.completed_at,
      updated_at: timestamp
    })

    return mapRowToWorkflowRun(findRowById(id) as WorkflowRunRow)
  }

  /**
   * Garantie d'intégrité reportée par la décision n°1 d'ORCH-2.1 : la
   * colonne `current_step_id` n'a volontairement aucune contrainte
   * `REFERENCES` en base (pour éviter une dépendance circulaire avec
   * `workflow_steps.workflow_run_id`). Ce repository vérifie donc lui-même
   * que le step ciblé existe et appartient bien à ce run avant d'écrire.
   */
  function updateCurrentStepId(id: string, currentStepId: string | null): WorkflowRun {
    getExistingRowOrThrow(id)

    if (currentStepId !== null) {
      const match = findStepInRunStatement.get({ stepId: currentStepId, workflowRunId: id })
      if (!match) {
        throw new Error(
          `Le step "${currentStepId}" n'existe pas ou n'appartient pas au workflow_run "${id}".`
        )
      }
    }

    updateCurrentStepIdStatement.run({ id, current_step_id: currentStepId, updated_at: now() })

    return mapRowToWorkflowRun(findRowById(id) as WorkflowRunRow)
  }

  return { listByProjectId, getById, create, updateStatus, updateCurrentStepId }
}
