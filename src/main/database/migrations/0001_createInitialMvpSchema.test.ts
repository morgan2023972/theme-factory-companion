import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from './runMigrations'
import { createInitialMvpSchemaMigration } from './0001_createInitialMvpSchema'

const MVP_MIGRATIONS = [createInitialMvpSchemaMigration]

const BUSINESS_TABLES = [
  'projects',
  'phases',
  'tasks',
  'task_checklist_items',
  'questions',
  'issues',
  'decisions',
  'activity_log'
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
  ).run({
    id,
    name: 'Projet de test',
    status: 'planning',
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides
  })
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

function insertTask(id: string, projectId: string, overrides: Partial<Record<string, unknown>> = {}) {
  const timestamp = nowIso()
  db.prepare(
    `INSERT INTO tasks (id, project_id, phase_id, title, status, priority, position, created_at, updated_at)
     VALUES (@id, @project_id, @phase_id, @title, @status, @priority, @position, @created_at, @updated_at)`
  ).run({
    id,
    project_id: projectId,
    phase_id: null,
    title: 'Tâche de test',
    status: 'backlog',
    priority: 'medium',
    position: 0,
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides
  })
}

describe('migration 0001 — schéma initial du MVP', () => {
  it('applique la migration version 1', () => {
    const result = runMigrations(db, MVP_MIGRATIONS)

    expect(result.applied).toHaveLength(1)
    expect(result.applied[0]).toMatchObject({ version: 1, name: 'create initial mvp schema' })
  })

  it('crée les huit tables métier', () => {
    runMigrations(db, MVP_MIGRATIONS)

    const tableNames = getTableNames()
    for (const table of BUSINESS_TABLES) {
      expect(tableNames).toContain(table)
    }
  })

  it('crée la table schema_migrations', () => {
    runMigrations(db, MVP_MIGRATIONS)

    expect(getTableNames()).toContain('schema_migrations')
  })

  it('enregistre la migration version 1 dans schema_migrations', () => {
    runMigrations(db, MVP_MIGRATIONS)

    const row = db.prepare('SELECT version, name, applied_at FROM schema_migrations WHERE version = 1').get() as
      | { version: number; name: string; applied_at: string }
      | undefined

    expect(row).toBeDefined()
    expect(row?.name).toBe('create initial mvp schema')
    expect(typeof row?.applied_at).toBe('string')
  })

  it('est idempotente lors d\'une deuxième exécution', () => {
    const first = runMigrations(db, MVP_MIGRATIONS)
    const second = runMigrations(db, MVP_MIGRATIONS)

    expect(first.applied).toHaveLength(1)
    expect(second.applied).toHaveLength(0)

    const rows = db.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: number }>
    expect(rows).toHaveLength(1)

    for (const table of BUSINESS_TABLES) {
      const count = (db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count
      expect(count).toBe(0)
    }
  })

  it('colonnes principales de projects', () => {
    runMigrations(db, MVP_MIGRATIONS)

    expect(getColumnNames('projects')).toEqual(
      expect.arrayContaining([
        'id',
        'name',
        'description',
        'objective',
        'status',
        'repository_path',
        'target_technology',
        'notes',
        'created_at',
        'updated_at'
      ])
    )
  })

  it('colonnes principales de phases', () => {
    runMigrations(db, MVP_MIGRATIONS)

    expect(getColumnNames('phases')).toEqual(
      expect.arrayContaining([
        'id',
        'project_id',
        'name',
        'description',
        'position',
        'status',
        'created_at',
        'updated_at'
      ])
    )
  })

  it('colonnes principales de tasks', () => {
    runMigrations(db, MVP_MIGRATIONS)

    expect(getColumnNames('tasks')).toEqual(
      expect.arrayContaining([
        'id',
        'project_id',
        'phase_id',
        'title',
        'description',
        'status',
        'priority',
        'claude_prompt',
        'affected_files',
        'acceptance_criteria',
        'validation_commands',
        'validation_results',
        'notes',
        'git_commit',
        'position',
        'created_at',
        'updated_at'
      ])
    )
  })

  it('colonnes principales de task_checklist_items', () => {
    runMigrations(db, MVP_MIGRATIONS)

    expect(getColumnNames('task_checklist_items')).toEqual(
      expect.arrayContaining(['id', 'task_id', 'label', 'is_completed', 'position', 'created_at', 'updated_at'])
    )
  })

  it('colonnes principales de questions', () => {
    runMigrations(db, MVP_MIGRATIONS)

    expect(getColumnNames('questions')).toEqual(
      expect.arrayContaining([
        'id',
        'project_id',
        'task_id',
        'title',
        'details',
        'status',
        'answer',
        'created_at',
        'updated_at'
      ])
    )
  })

  it('colonnes principales de issues', () => {
    runMigrations(db, MVP_MIGRATIONS)

    expect(getColumnNames('issues')).toEqual(
      expect.arrayContaining([
        'id',
        'project_id',
        'task_id',
        'symptom',
        'context',
        'severity',
        'cause',
        'solution',
        'commands_used',
        'modified_files',
        'prevention',
        'recurrence_risk',
        'automation_potential',
        'status',
        'created_at',
        'updated_at'
      ])
    )
  })

  it('colonnes principales de decisions', () => {
    runMigrations(db, MVP_MIGRATIONS)

    expect(getColumnNames('decisions')).toEqual(
      expect.arrayContaining([
        'id',
        'project_id',
        'task_id',
        'question_id',
        'context',
        'decision',
        'alternatives',
        'rationale',
        'consequences',
        'is_reusable',
        'automation_potential',
        'created_at',
        'updated_at'
      ])
    )
  })

  it('colonnes principales de activity_log', () => {
    runMigrations(db, MVP_MIGRATIONS)

    expect(getColumnNames('activity_log')).toEqual(
      expect.arrayContaining(['id', 'project_id', 'entity_type', 'entity_id', 'action', 'details', 'created_at'])
    )
  })

  it('refuse un statut de tâche invalide', () => {
    runMigrations(db, MVP_MIGRATIONS)
    insertProject('project-1')

    expect(() => insertTask('task-1', 'project-1', { status: 'not-a-status' })).toThrow()
  })

  it('refuse une priorité de tâche invalide', () => {
    runMigrations(db, MVP_MIGRATIONS)
    insertProject('project-1')

    expect(() => insertTask('task-1', 'project-1', { priority: 'urgent' })).toThrow()
  })

  it('refuse un booléen de checklist différent de 0 ou 1', () => {
    runMigrations(db, MVP_MIGRATIONS)
    insertProject('project-1')
    insertTask('task-1', 'project-1')

    expect(() =>
      db
        .prepare(
          `INSERT INTO task_checklist_items (id, task_id, label, is_completed, position, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run('item-1', 'task-1', 'Étape', 2, 0, nowIso(), nowIso())
    ).toThrow()
  })

  it('refuse une référence project_id inexistante', () => {
    runMigrations(db, MVP_MIGRATIONS)

    expect(() => insertPhase('phase-1', 'projet-inexistant')).toThrow()
  })

  it('supprime les phases en cascade lors de la suppression du projet', () => {
    runMigrations(db, MVP_MIGRATIONS)
    insertProject('project-1')
    insertPhase('phase-1', 'project-1')

    db.prepare('DELETE FROM projects WHERE id = ?').run('project-1')

    const remaining = db.prepare('SELECT COUNT(*) AS count FROM phases').get() as { count: number }
    expect(remaining.count).toBe(0)
  })

  it('met phase_id à NULL sur les tâches lors de la suppression de leur phase', () => {
    runMigrations(db, MVP_MIGRATIONS)
    insertProject('project-1')
    insertPhase('phase-1', 'project-1')
    insertTask('task-1', 'project-1', { phase_id: 'phase-1' })

    db.prepare('DELETE FROM phases WHERE id = ?').run('phase-1')

    const task = db.prepare('SELECT phase_id FROM tasks WHERE id = ?').get('task-1') as { phase_id: string | null }
    expect(task.phase_id).toBeNull()
  })

  it('supprime les checklist items en cascade lors de la suppression de la tâche', () => {
    runMigrations(db, MVP_MIGRATIONS)
    insertProject('project-1')
    insertTask('task-1', 'project-1')
    db.prepare(
      `INSERT INTO task_checklist_items (id, task_id, label, is_completed, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run('item-1', 'task-1', 'Étape', 0, 0, nowIso(), nowIso())

    db.prepare('DELETE FROM tasks WHERE id = ?').run('task-1')

    const remaining = db.prepare('SELECT COUNT(*) AS count FROM task_checklist_items').get() as { count: number }
    expect(remaining.count).toBe(0)
  })

  it('met à NULL les relations optionnelles lors de la suppression de la tâche ou de la question liées', () => {
    runMigrations(db, MVP_MIGRATIONS)
    insertProject('project-1')
    insertTask('task-1', 'project-1')

    const timestamp = nowIso()
    db.prepare(
      `INSERT INTO questions (id, project_id, task_id, title, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run('question-1', 'project-1', 'task-1', 'Question ?', 'open', timestamp, timestamp)

    db.prepare(
      `INSERT INTO decisions (id, project_id, task_id, question_id, decision, is_reusable, automation_potential, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('decision-1', 'project-1', 'task-1', 'question-1', 'Décision prise', 0, 'none', timestamp, timestamp)

    db.prepare('DELETE FROM tasks WHERE id = ?').run('task-1')

    const questionAfterTaskDelete = db.prepare('SELECT task_id FROM questions WHERE id = ?').get('question-1') as {
      task_id: string | null
    }
    expect(questionAfterTaskDelete.task_id).toBeNull()

    const decisionAfterTaskDelete = db.prepare('SELECT task_id FROM decisions WHERE id = ?').get('decision-1') as {
      task_id: string | null
    }
    expect(decisionAfterTaskDelete.task_id).toBeNull()

    db.prepare('DELETE FROM questions WHERE id = ?').run('question-1')

    const decisionAfterQuestionDelete = db
      .prepare('SELECT question_id FROM decisions WHERE id = ?')
      .get('decision-1') as { question_id: string | null }
    expect(decisionAfterQuestionDelete.question_id).toBeNull()
  })

  it("n'insère aucune donnée d'exemple", () => {
    runMigrations(db, MVP_MIGRATIONS)

    for (const table of BUSINESS_TABLES) {
      const count = (db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count
      expect(count).toBe(0)
    }
  })

  it('crée les index principaux', () => {
    runMigrations(db, MVP_MIGRATIONS)

    const indexNames = getIndexNames()
    expect(indexNames).toEqual(
      expect.arrayContaining([
        'idx_phases_project_id',
        'idx_tasks_project_id',
        'idx_tasks_phase_id',
        'idx_tasks_status',
        'idx_task_checklist_items_task_id',
        'idx_questions_project_id',
        'idx_questions_task_id',
        'idx_questions_status',
        'idx_issues_project_id',
        'idx_issues_task_id',
        'idx_issues_severity',
        'idx_issues_status',
        'idx_decisions_project_id',
        'idx_decisions_task_id',
        'idx_decisions_question_id',
        'idx_activity_log_project_id',
        'idx_activity_log_created_at',
        'idx_activity_log_entity'
      ])
    )
  })

  it('permet d\'insérer un jeu minimal valide dans chaque table', () => {
    runMigrations(db, MVP_MIGRATIONS)

    const timestamp = nowIso()

    insertProject('project-1')
    insertPhase('phase-1', 'project-1')
    insertTask('task-1', 'project-1', { phase_id: 'phase-1' })

    db.prepare(
      `INSERT INTO task_checklist_items (id, task_id, label, is_completed, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run('item-1', 'task-1', 'Étape', 0, 0, timestamp, timestamp)

    db.prepare(
      `INSERT INTO questions (id, project_id, task_id, title, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run('question-1', 'project-1', 'task-1', 'Question ?', 'open', timestamp, timestamp)

    db.prepare(
      `INSERT INTO issues (id, project_id, task_id, symptom, severity, recurrence_risk, automation_potential, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('issue-1', 'project-1', 'task-1', 'Symptôme observé', 'low', 'low', 'none', 'open', timestamp, timestamp)

    db.prepare(
      `INSERT INTO decisions (id, project_id, task_id, question_id, decision, is_reusable, automation_potential, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('decision-1', 'project-1', 'task-1', 'question-1', 'Décision prise', 0, 'none', timestamp, timestamp)

    db.prepare(
      `INSERT INTO activity_log (id, project_id, entity_type, entity_id, action, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run('log-1', 'project-1', 'task', 'task-1', 'created', null, timestamp)

    for (const table of BUSINESS_TABLES) {
      const count = (db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count
      expect(count).toBe(1)
    }
  })

  it('effectue un rollback complet si la migration échoue (table déjà existante)', () => {
    db.exec('CREATE TABLE projects (id TEXT PRIMARY KEY)')

    expect(() => runMigrations(db, MVP_MIGRATIONS)).toThrow()

    const migrationRows = db.prepare('SELECT * FROM schema_migrations WHERE version = 1').all()
    expect(migrationRows).toHaveLength(0)

    for (const table of BUSINESS_TABLES) {
      if (table === 'projects') {
        continue
      }
      const exists = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
        .get(table)
      expect(exists).toBeUndefined()
    }
  })
})
