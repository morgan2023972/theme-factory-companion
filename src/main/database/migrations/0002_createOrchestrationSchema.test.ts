import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from './runMigrations'
import { createInitialMvpSchemaMigration } from './0001_createInitialMvpSchema'
import { createOrchestrationSchemaMigration } from './0002_createOrchestrationSchema'

const ALL_MIGRATIONS = [createInitialMvpSchemaMigration, createOrchestrationSchemaMigration]

const ORCHESTRATION_TABLES = [
  'workflow_profiles',
  'workflow_profile_validation_commands',
  'workflow_runs',
  'workflow_steps',
  'workflow_artifacts',
  'workflow_approvals',
  'command_executions'
]

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
})

afterEach(() => {
  db.close()
})

function getTableNames(): string[] {
  return (
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all() as Array<{ name: string }>
  ).map((row) => row.name)
}

function getColumnNames(table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((row) => row.name)
}

function getIndexNames(): string[] {
  return (
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'").all() as Array<{
      name: string
    }>
  ).map((row) => row.name)
}

function nowIso(): string {
  return new Date().toISOString()
}

function insertProject(id: string, overrides: Partial<Record<string, unknown>> = {}) {
  const timestamp = nowIso()
  db.prepare(
    `INSERT INTO projects (id, name, status, created_at, updated_at)
     VALUES (@id, @name, @status, @created_at, @updated_at)`
  ).run({ id, name: 'Projet de test', status: 'planning', created_at: timestamp, updated_at: timestamp, ...overrides })
}

function insertPhase(id: string, projectId: string, overrides: Partial<Record<string, unknown>> = {}) {
  const timestamp = nowIso()
  db.prepare(
    `INSERT INTO phases (id, project_id, name, position, status, created_at, updated_at)
     VALUES (@id, @project_id, @name, @position, @status, @created_at, @updated_at)`
  ).run({
    id,
    project_id: projectId,
    name: 'Phase de test',
    position: 0,
    status: 'pending',
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides
  })
}

function insertWorkflowProfile(id: string, overrides: Partial<Record<string, unknown>> = {}) {
  const timestamp = nowIso()
  db.prepare(
    `INSERT INTO workflow_profiles (id, name, version, created_at, updated_at)
     VALUES (@id, @name, @version, @created_at, @updated_at)`
  ).run({ id, name: 'Profil de test', version: '1', created_at: timestamp, updated_at: timestamp, ...overrides })
}

function insertValidationCommand(
  id: string,
  profileId: string,
  position: number,
  overrides: Partial<Record<string, unknown>> = {}
) {
  const timestamp = nowIso()
  db.prepare(
    `INSERT INTO workflow_profile_validation_commands
       (id, workflow_profile_id, name, command, args, blocking, position, created_at, updated_at)
     VALUES (@id, @workflow_profile_id, @name, @command, @args, @blocking, @position, @created_at, @updated_at)`
  ).run({
    id,
    workflow_profile_id: profileId,
    name: 'typecheck',
    command: 'npm',
    args: JSON.stringify(['run', 'typecheck']),
    blocking: 1,
    position,
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides
  })
}

function insertWorkflowRun(
  id: string,
  projectId: string,
  phaseId: string,
  profileId: string,
  overrides: Partial<Record<string, unknown>> = {}
) {
  const timestamp = nowIso()
  db.prepare(
    `INSERT INTO workflow_runs
       (id, project_id, phase_id, profile_id, profile_fingerprint, status, current_step_id, started_at, completed_at, created_at, updated_at)
     VALUES (@id, @project_id, @phase_id, @profile_id, @profile_fingerprint, @status, @current_step_id, @started_at, @completed_at, @created_at, @updated_at)`
  ).run({
    id,
    project_id: projectId,
    phase_id: phaseId,
    profile_id: profileId,
    profile_fingerprint: 'fingerprint-1',
    status: 'draft',
    current_step_id: null,
    started_at: timestamp,
    completed_at: null,
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides
  })
}

function insertWorkflowStep(
  id: string,
  workflowRunId: string,
  position: number,
  overrides: Partial<Record<string, unknown>> = {}
) {
  const timestamp = nowIso()
  db.prepare(
    `INSERT INTO workflow_steps
       (id, workflow_run_id, type, status, position, started_at, completed_at, created_at, updated_at)
     VALUES (@id, @workflow_run_id, @type, @status, @position, @started_at, @completed_at, @created_at, @updated_at)`
  ).run({
    id,
    workflow_run_id: workflowRunId,
    type: 'project_and_phase_selection',
    status: 'pending',
    position,
    started_at: null,
    completed_at: null,
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides
  })
}

function insertWorkflowArtifact(id: string, workflowRunId: string, overrides: Partial<Record<string, unknown>> = {}) {
  const timestamp = nowIso()
  db.prepare(
    `INSERT INTO workflow_artifacts (id, workflow_run_id, workflow_step_id, type, relative_path, created_at)
     VALUES (@id, @workflow_run_id, @workflow_step_id, @type, @relative_path, @created_at)`
  ).run({
    id,
    workflow_run_id: workflowRunId,
    workflow_step_id: null,
    type: 'phase_prompt',
    relative_path: 'workflow/prompts/PHASE_1.1_PROMPT.md',
    created_at: timestamp,
    ...overrides
  })
}

function insertWorkflowApproval(id: string, workflowRunId: string, overrides: Partial<Record<string, unknown>> = {}) {
  const timestamp = nowIso()
  db.prepare(
    `INSERT INTO workflow_approvals
       (id, workflow_run_id, workflow_step_id, type, status, requested_at, decided_at, created_at, updated_at)
     VALUES (@id, @workflow_run_id, @workflow_step_id, @type, @status, @requested_at, @decided_at, @created_at, @updated_at)`
  ).run({
    id,
    workflow_run_id: workflowRunId,
    workflow_step_id: null,
    type: 'phase_prompt',
    status: 'pending',
    requested_at: timestamp,
    decided_at: null,
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides
  })
}

function insertCommandExecution(id: string, workflowRunId: string, overrides: Partial<Record<string, unknown>> = {}) {
  const timestamp = nowIso()
  db.prepare(
    `INSERT INTO command_executions
       (id, workflow_run_id, workflow_step_id, executable, args, cwd, status, exit_code, stdout, stderr,
        stdout_truncated, stderr_truncated, started_at, completed_at, duration_ms, created_at, updated_at)
     VALUES (@id, @workflow_run_id, @workflow_step_id, @executable, @args, @cwd, @status, @exit_code, @stdout, @stderr,
             @stdout_truncated, @stderr_truncated, @started_at, @completed_at, @duration_ms, @created_at, @updated_at)`
  ).run({
    id,
    workflow_run_id: workflowRunId,
    workflow_step_id: null,
    executable: 'npm',
    args: JSON.stringify(['run', 'typecheck']),
    cwd: 'C:/repo',
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
    updated_at: timestamp,
    ...overrides
  })
}

/** Prépare un jeu minimal valide : projet, phase, profil, run. */
function seedRunContext() {
  insertProject('project-1')
  insertPhase('phase-1', 'project-1')
  insertWorkflowProfile('profile-1')
  insertWorkflowRun('run-1', 'project-1', 'phase-1', 'profile-1')
}

describe('migration 0002 — schéma de l\'orchestrateur', () => {
  it('applique la migration version 2 à la suite de la version 1', () => {
    const result = runMigrations(db, ALL_MIGRATIONS)

    expect(result.applied).toHaveLength(2)
    expect(result.applied[1]).toMatchObject({ version: 2, name: 'create orchestration schema' })
  })

  it('crée les sept tables de l\'orchestrateur, en plus des huit tables MVP', () => {
    runMigrations(db, ALL_MIGRATIONS)

    const tableNames = getTableNames()
    for (const table of ORCHESTRATION_TABLES) {
      expect(tableNames).toContain(table)
    }
    expect(tableNames).toContain('projects')
  })

  it('est idempotente lors d\'une deuxième exécution', () => {
    const first = runMigrations(db, ALL_MIGRATIONS)
    const second = runMigrations(db, ALL_MIGRATIONS)

    expect(first.applied).toHaveLength(2)
    expect(second.applied).toHaveLength(0)

    for (const table of ORCHESTRATION_TABLES) {
      const count = (db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count
      expect(count).toBe(0)
    }
  })

  describe('colonnes', () => {
    it('workflow_profiles', () => {
      runMigrations(db, ALL_MIGRATIONS)
      expect(getColumnNames('workflow_profiles')).toEqual(
        expect.arrayContaining(['id', 'name', 'version', 'created_at', 'updated_at'])
      )
    })

    it('workflow_profile_validation_commands', () => {
      runMigrations(db, ALL_MIGRATIONS)
      expect(getColumnNames('workflow_profile_validation_commands')).toEqual(
        expect.arrayContaining([
          'id',
          'workflow_profile_id',
          'name',
          'command',
          'args',
          'blocking',
          'position',
          'created_at',
          'updated_at'
        ])
      )
    })

    it('workflow_runs, avec current_step_id, completed_at nullable', () => {
      runMigrations(db, ALL_MIGRATIONS)
      expect(getColumnNames('workflow_runs')).toEqual(
        expect.arrayContaining([
          'id',
          'project_id',
          'phase_id',
          'profile_id',
          'profile_fingerprint',
          'status',
          'current_step_id',
          'started_at',
          'completed_at',
          'created_at',
          'updated_at'
        ])
      )
    })

    it('workflow_steps, avec started_at/completed_at nullable', () => {
      runMigrations(db, ALL_MIGRATIONS)
      expect(getColumnNames('workflow_steps')).toEqual(
        expect.arrayContaining([
          'id',
          'workflow_run_id',
          'type',
          'status',
          'position',
          'started_at',
          'completed_at',
          'created_at',
          'updated_at'
        ])
      )
    })

    it('workflow_artifacts, avec workflow_step_id nullable, sans updated_at', () => {
      runMigrations(db, ALL_MIGRATIONS)
      const columns = getColumnNames('workflow_artifacts')
      expect(columns).toEqual(
        expect.arrayContaining(['id', 'workflow_run_id', 'workflow_step_id', 'type', 'relative_path', 'created_at'])
      )
      expect(columns).not.toContain('updated_at')
    })

    it('workflow_approvals, avec workflow_step_id et decided_at nullable', () => {
      runMigrations(db, ALL_MIGRATIONS)
      expect(getColumnNames('workflow_approvals')).toEqual(
        expect.arrayContaining([
          'id',
          'workflow_run_id',
          'workflow_step_id',
          'type',
          'status',
          'requested_at',
          'decided_at',
          'created_at',
          'updated_at'
        ])
      )
    })

    it('command_executions, avec exit_code/started_at/completed_at/duration_ms nullable', () => {
      runMigrations(db, ALL_MIGRATIONS)
      expect(getColumnNames('command_executions')).toEqual(
        expect.arrayContaining([
          'id',
          'workflow_run_id',
          'workflow_step_id',
          'executable',
          'args',
          'cwd',
          'status',
          'exit_code',
          'stdout',
          'stderr',
          'stdout_truncated',
          'stderr_truncated',
          'started_at',
          'completed_at',
          'duration_ms',
          'created_at',
          'updated_at'
        ])
      )
    })
  })

  it('crée les index attendus', () => {
    runMigrations(db, ALL_MIGRATIONS)

    expect(getIndexNames()).toEqual(
      expect.arrayContaining([
        'idx_workflow_profile_validation_commands_profile_id',
        'idx_workflow_runs_project_id',
        'idx_workflow_runs_phase_id',
        'idx_workflow_runs_profile_id',
        'idx_workflow_runs_status',
        'idx_workflow_runs_current_step_id',
        'idx_workflow_steps_workflow_run_id',
        'idx_workflow_steps_status',
        'idx_workflow_artifacts_workflow_run_id',
        'idx_workflow_artifacts_workflow_step_id',
        'idx_workflow_artifacts_type',
        'idx_workflow_approvals_workflow_run_id',
        'idx_workflow_approvals_workflow_step_id',
        'idx_workflow_approvals_status',
        'idx_command_executions_workflow_run_id',
        'idx_command_executions_workflow_step_id',
        'idx_command_executions_status'
      ])
    )
  })

  describe('énumérations CHECK', () => {
    it('refuse un workflow_runs.status invalide', () => {
      runMigrations(db, ALL_MIGRATIONS)
      insertProject('project-1')
      insertPhase('phase-1', 'project-1')
      insertWorkflowProfile('profile-1')

      expect(() => insertWorkflowRun('run-1', 'project-1', 'phase-1', 'profile-1', { status: 'not-a-status' })).toThrow()
    })

    it('refuse un workflow_steps.type invalide', () => {
      runMigrations(db, ALL_MIGRATIONS)
      seedRunContext()

      expect(() => insertWorkflowStep('step-1', 'run-1', 0, { type: 'not-a-type' })).toThrow()
    })

    it('refuse un workflow_steps.status invalide', () => {
      runMigrations(db, ALL_MIGRATIONS)
      seedRunContext()

      expect(() => insertWorkflowStep('step-1', 'run-1', 0, { status: 'not-a-status' })).toThrow()
    })

    it('refuse un workflow_artifacts.type invalide', () => {
      runMigrations(db, ALL_MIGRATIONS)
      seedRunContext()

      expect(() => insertWorkflowArtifact('artifact-1', 'run-1', { type: 'not-a-type' })).toThrow()
    })

    it('refuse un workflow_approvals.type invalide', () => {
      runMigrations(db, ALL_MIGRATIONS)
      seedRunContext()

      expect(() => insertWorkflowApproval('approval-1', 'run-1', { type: 'not-a-type' })).toThrow()
    })

    it('refuse un workflow_approvals.status invalide', () => {
      runMigrations(db, ALL_MIGRATIONS)
      seedRunContext()

      expect(() => insertWorkflowApproval('approval-1', 'run-1', { status: 'not-a-status' })).toThrow()
    })

    it('refuse un command_executions.status invalide', () => {
      runMigrations(db, ALL_MIGRATIONS)
      seedRunContext()

      expect(() => insertCommandExecution('cmd-1', 'run-1', { status: 'not-a-status' })).toThrow()
    })
  })

  describe('cohérence statut ↔ dates/exit_code (CHECK composites)', () => {
    it('workflow_runs : accepte draft avec completed_at à null', () => {
      runMigrations(db, ALL_MIGRATIONS)
      insertProject('project-1')
      insertPhase('phase-1', 'project-1')
      insertWorkflowProfile('profile-1')

      expect(() =>
        insertWorkflowRun('run-1', 'project-1', 'phase-1', 'profile-1', { status: 'draft', completed_at: null })
      ).not.toThrow()
    })

    it('workflow_runs : accepte completed avec completed_at renseigné', () => {
      runMigrations(db, ALL_MIGRATIONS)
      insertProject('project-1')
      insertPhase('phase-1', 'project-1')
      insertWorkflowProfile('profile-1')

      expect(() =>
        insertWorkflowRun('run-1', 'project-1', 'phase-1', 'profile-1', {
          status: 'completed',
          completed_at: nowIso()
        })
      ).not.toThrow()
    })

    it('workflow_runs : refuse completed avec completed_at à null', () => {
      runMigrations(db, ALL_MIGRATIONS)
      insertProject('project-1')
      insertPhase('phase-1', 'project-1')
      insertWorkflowProfile('profile-1')

      expect(() =>
        insertWorkflowRun('run-1', 'project-1', 'phase-1', 'profile-1', { status: 'completed', completed_at: null })
      ).toThrow()
    })

    it('workflow_runs : refuse draft avec completed_at renseigné', () => {
      runMigrations(db, ALL_MIGRATIONS)
      insertProject('project-1')
      insertPhase('phase-1', 'project-1')
      insertWorkflowProfile('profile-1')

      expect(() =>
        insertWorkflowRun('run-1', 'project-1', 'phase-1', 'profile-1', { status: 'draft', completed_at: nowIso() })
      ).toThrow()
    })

    it('workflow_steps : accepte pending avec started_at/completed_at à null', () => {
      runMigrations(db, ALL_MIGRATIONS)
      seedRunContext()

      expect(() => insertWorkflowStep('step-1', 'run-1', 0, { status: 'pending' })).not.toThrow()
    })

    it('workflow_steps : accepte in_progress avec started_at renseigné et completed_at à null', () => {
      runMigrations(db, ALL_MIGRATIONS)
      seedRunContext()

      expect(() =>
        insertWorkflowStep('step-1', 'run-1', 0, { status: 'in_progress', started_at: nowIso(), completed_at: null })
      ).not.toThrow()
    })

    it('workflow_steps : accepte completed avec completed_at renseigné', () => {
      runMigrations(db, ALL_MIGRATIONS)
      seedRunContext()

      expect(() =>
        insertWorkflowStep('step-1', 'run-1', 0, {
          status: 'completed',
          started_at: nowIso(),
          completed_at: nowIso()
        })
      ).not.toThrow()
    })

    it('workflow_steps : refuse pending avec started_at renseigné', () => {
      runMigrations(db, ALL_MIGRATIONS)
      seedRunContext()

      expect(() => insertWorkflowStep('step-1', 'run-1', 0, { status: 'pending', started_at: nowIso() })).toThrow()
    })

    it('workflow_steps : refuse completed avec completed_at à null', () => {
      runMigrations(db, ALL_MIGRATIONS)
      seedRunContext()

      expect(() => insertWorkflowStep('step-1', 'run-1', 0, { status: 'completed', completed_at: null })).toThrow()
    })

    it('workflow_approvals : accepte pending avec decided_at à null', () => {
      runMigrations(db, ALL_MIGRATIONS)
      seedRunContext()

      expect(() => insertWorkflowApproval('approval-1', 'run-1', { status: 'pending', decided_at: null })).not.toThrow()
    })

    it('workflow_approvals : accepte approved avec decided_at renseigné', () => {
      runMigrations(db, ALL_MIGRATIONS)
      seedRunContext()

      expect(() =>
        insertWorkflowApproval('approval-1', 'run-1', { status: 'approved', decided_at: nowIso() })
      ).not.toThrow()
    })

    it('workflow_approvals : refuse pending avec decided_at renseigné', () => {
      runMigrations(db, ALL_MIGRATIONS)
      seedRunContext()

      expect(() =>
        insertWorkflowApproval('approval-1', 'run-1', { status: 'pending', decided_at: nowIso() })
      ).toThrow()
    })

    it('workflow_approvals : refuse rejected avec decided_at à null', () => {
      runMigrations(db, ALL_MIGRATIONS)
      seedRunContext()

      expect(() => insertWorkflowApproval('approval-1', 'run-1', { status: 'rejected', decided_at: null })).toThrow()
    })

    it('command_executions : accepte pending avec tous les champs dérivés à null', () => {
      runMigrations(db, ALL_MIGRATIONS)
      seedRunContext()

      expect(() => insertCommandExecution('cmd-1', 'run-1', { status: 'pending' })).not.toThrow()
    })

    it('command_executions : accepte running avec started_at renseigné, le reste à null', () => {
      runMigrations(db, ALL_MIGRATIONS)
      seedRunContext()

      expect(() =>
        insertCommandExecution('cmd-1', 'run-1', {
          status: 'running',
          started_at: nowIso(),
          completed_at: null,
          duration_ms: null,
          exit_code: null
        })
      ).not.toThrow()
    })

    it('command_executions : accepte completed avec exit_code à 0', () => {
      runMigrations(db, ALL_MIGRATIONS)
      seedRunContext()

      expect(() =>
        insertCommandExecution('cmd-1', 'run-1', {
          status: 'completed',
          started_at: nowIso(),
          completed_at: nowIso(),
          duration_ms: 100,
          exit_code: 0
        })
      ).not.toThrow()
    })

    it('command_executions : refuse completed avec exit_code différent de 0', () => {
      runMigrations(db, ALL_MIGRATIONS)
      seedRunContext()

      expect(() =>
        insertCommandExecution('cmd-1', 'run-1', {
          status: 'completed',
          started_at: nowIso(),
          completed_at: nowIso(),
          duration_ms: 100,
          exit_code: 1
        })
      ).toThrow()
    })

    it('command_executions : refuse pending avec started_at renseigné', () => {
      runMigrations(db, ALL_MIGRATIONS)
      seedRunContext()

      expect(() => insertCommandExecution('cmd-1', 'run-1', { status: 'pending', started_at: nowIso() })).toThrow()
    })

    it('command_executions : accepte failed avec exit_code à null (aucune contrainte sur exit_code pour ce statut)', () => {
      runMigrations(db, ALL_MIGRATIONS)
      seedRunContext()

      expect(() =>
        insertCommandExecution('cmd-1', 'run-1', {
          status: 'failed',
          started_at: nowIso(),
          completed_at: nowIso(),
          duration_ms: 50,
          exit_code: null
        })
      ).not.toThrow()
    })

    it('command_executions : accepte failed avec exit_code renseigné (127)', () => {
      runMigrations(db, ALL_MIGRATIONS)
      seedRunContext()

      expect(() =>
        insertCommandExecution('cmd-1', 'run-1', {
          status: 'failed',
          started_at: nowIso(),
          completed_at: nowIso(),
          duration_ms: 50,
          exit_code: 127
        })
      ).not.toThrow()
    })
  })

  describe('champs texte obligatoires non vides', () => {
    it('refuse workflow_profiles.name vide', () => {
      runMigrations(db, ALL_MIGRATIONS)
      expect(() => insertWorkflowProfile('profile-1', { name: '   ' })).toThrow()
    })

    it('refuse workflow_profile_validation_commands.name vide', () => {
      runMigrations(db, ALL_MIGRATIONS)
      insertWorkflowProfile('profile-1')
      expect(() => insertValidationCommand('cmd-1', 'profile-1', 0, { name: '' })).toThrow()
    })

    it('refuse workflow_profile_validation_commands.command vide', () => {
      runMigrations(db, ALL_MIGRATIONS)
      insertWorkflowProfile('profile-1')
      expect(() => insertValidationCommand('cmd-1', 'profile-1', 0, { command: '  ' })).toThrow()
    })

    it('refuse workflow_runs.profile_fingerprint vide', () => {
      runMigrations(db, ALL_MIGRATIONS)
      insertProject('project-1')
      insertPhase('phase-1', 'project-1')
      insertWorkflowProfile('profile-1')
      expect(() =>
        insertWorkflowRun('run-1', 'project-1', 'phase-1', 'profile-1', { profile_fingerprint: '' })
      ).toThrow()
    })

    it('refuse workflow_artifacts.relative_path vide', () => {
      runMigrations(db, ALL_MIGRATIONS)
      seedRunContext()
      expect(() => insertWorkflowArtifact('artifact-1', 'run-1', { relative_path: '   ' })).toThrow()
    })

    it('refuse command_executions.executable vide', () => {
      runMigrations(db, ALL_MIGRATIONS)
      seedRunContext()
      expect(() => insertCommandExecution('cmd-1', 'run-1', { executable: '' })).toThrow()
    })

    it('refuse command_executions.cwd vide', () => {
      runMigrations(db, ALL_MIGRATIONS)
      seedRunContext()
      expect(() => insertCommandExecution('cmd-1', 'run-1', { cwd: '   ' })).toThrow()
    })
  })

  describe('contraintes UNIQUE', () => {
    it('refuse deux workflow_steps à la même position pour le même run', () => {
      runMigrations(db, ALL_MIGRATIONS)
      seedRunContext()
      insertWorkflowStep('step-1', 'run-1', 0)

      expect(() => insertWorkflowStep('step-2', 'run-1', 0)).toThrow()
    })

    it('refuse deux commandes de validation à la même position pour le même profil', () => {
      runMigrations(db, ALL_MIGRATIONS)
      insertWorkflowProfile('profile-1')
      insertValidationCommand('cmd-1', 'profile-1', 0)

      expect(() => insertValidationCommand('cmd-2', 'profile-1', 0)).toThrow()
    })
  })

  describe('cascades et restrictions', () => {
    it('supprime en cascade workflow_runs (et ses enfants) lors de la suppression du projet', () => {
      runMigrations(db, ALL_MIGRATIONS)
      seedRunContext()
      insertWorkflowStep('step-1', 'run-1', 0)
      insertWorkflowArtifact('artifact-1', 'run-1', { workflow_step_id: 'step-1' })
      insertWorkflowApproval('approval-1', 'run-1', { workflow_step_id: 'step-1' })
      insertCommandExecution('cmd-1', 'run-1', { workflow_step_id: 'step-1' })

      db.prepare('DELETE FROM projects WHERE id = ?').run('project-1')

      for (const table of ['workflow_runs', 'workflow_steps', 'workflow_artifacts', 'workflow_approvals', 'command_executions']) {
        const count = (db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count
        expect(count).toBe(0)
      }
    })

    it('refuse la suppression d\'une phase référencée par un workflow_run', () => {
      runMigrations(db, ALL_MIGRATIONS)
      seedRunContext()

      expect(() => db.prepare('DELETE FROM phases WHERE id = ?').run('phase-1')).toThrow()
    })

    it('refuse la suppression d\'un profil référencé par un workflow_run', () => {
      runMigrations(db, ALL_MIGRATIONS)
      seedRunContext()

      expect(() => db.prepare('DELETE FROM workflow_profiles WHERE id = ?').run('profile-1')).toThrow()
    })

    it('supprime un profil non référencé, en cascade avec ses commandes de validation', () => {
      runMigrations(db, ALL_MIGRATIONS)
      insertWorkflowProfile('profile-1')
      insertValidationCommand('cmd-1', 'profile-1', 0)

      db.prepare('DELETE FROM workflow_profiles WHERE id = ?').run('profile-1')

      const remaining = db
        .prepare('SELECT COUNT(*) AS count FROM workflow_profile_validation_commands')
        .get() as { count: number }
      expect(remaining.count).toBe(0)
    })

    it('met workflow_step_id à NULL sur artefacts/approbations/commandes lors de la suppression du step', () => {
      runMigrations(db, ALL_MIGRATIONS)
      seedRunContext()
      insertWorkflowStep('step-1', 'run-1', 0)
      insertWorkflowArtifact('artifact-1', 'run-1', { workflow_step_id: 'step-1' })
      insertWorkflowApproval('approval-1', 'run-1', { workflow_step_id: 'step-1' })
      insertCommandExecution('cmd-1', 'run-1', { workflow_step_id: 'step-1' })

      db.prepare('DELETE FROM workflow_steps WHERE id = ?').run('step-1')

      const artifact = db.prepare('SELECT workflow_step_id FROM workflow_artifacts WHERE id = ?').get('artifact-1') as {
        workflow_step_id: string | null
      }
      const approval = db.prepare('SELECT workflow_step_id FROM workflow_approvals WHERE id = ?').get('approval-1') as {
        workflow_step_id: string | null
      }
      const command = db.prepare('SELECT workflow_step_id FROM command_executions WHERE id = ?').get('cmd-1') as {
        workflow_step_id: string | null
      }

      expect(artifact.workflow_step_id).toBeNull()
      expect(approval.workflow_step_id).toBeNull()
      expect(command.workflow_step_id).toBeNull()
    })

    it('supprime en cascade steps/artefacts/approbations/commandes lors de la suppression du workflow_run', () => {
      runMigrations(db, ALL_MIGRATIONS)
      seedRunContext()
      insertWorkflowStep('step-1', 'run-1', 0)
      insertWorkflowArtifact('artifact-1', 'run-1', { workflow_step_id: 'step-1' })
      insertWorkflowApproval('approval-1', 'run-1', { workflow_step_id: 'step-1' })
      insertCommandExecution('cmd-1', 'run-1', { workflow_step_id: 'step-1' })

      db.prepare('DELETE FROM workflow_runs WHERE id = ?').run('run-1')

      for (const table of ['workflow_steps', 'workflow_artifacts', 'workflow_approvals', 'command_executions']) {
        const count = (db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count
        expect(count).toBe(0)
      }
    })
  })

  it('current_step_id accepte une valeur ne correspondant à aucun workflow_step (absence de contrainte REFERENCES)', () => {
    runMigrations(db, ALL_MIGRATIONS)
    insertProject('project-1')
    insertPhase('phase-1', 'project-1')
    insertWorkflowProfile('profile-1')

    expect(() =>
      insertWorkflowRun('run-1', 'project-1', 'phase-1', 'profile-1', { current_step_id: 'step-inexistant' })
    ).not.toThrow()
  })

  it('permet d\'insérer un jeu minimal valide dans chaque table', () => {
    runMigrations(db, ALL_MIGRATIONS)
    seedRunContext()
    insertWorkflowStep('step-1', 'run-1', 0)
    insertValidationCommand('cmd-profile-1', 'profile-1', 0)
    insertWorkflowArtifact('artifact-1', 'run-1', { workflow_step_id: 'step-1' })
    insertWorkflowApproval('approval-1', 'run-1', { workflow_step_id: 'step-1' })
    insertCommandExecution('cmd-1', 'run-1', { workflow_step_id: 'step-1' })

    for (const table of ORCHESTRATION_TABLES) {
      const count = (db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count
      expect(count).toBeGreaterThan(0)
    }
  })
})
