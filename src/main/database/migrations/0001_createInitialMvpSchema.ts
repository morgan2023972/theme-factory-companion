import type { Migration } from './migrationTypes'

/**
 * Schéma initial du MVP (Phase 2.3).
 *
 * Décisions prises pour lever les ambiguïtés de docs/DATA_MODEL_DRAFT.md
 * (voir RAPPORT_PHASE_2.3.txt pour le détail) :
 * - phases.name (et non "title"), par cohérence avec projects.name.
 * - tasks.phase_id est nullable, avec ON DELETE SET NULL : la documentation
 *   liste la cascade de suppression d'une phase comme un point ouvert ;
 *   SET NULL évite une suppression destructive et implicite des tâches.
 * - affected_files, acceptance_criteria, validation_commands et
 *   validation_results sont stockés en TEXT JSON : aucune table
 *   relationnelle dédiée n'est prévue pour ces listes dans le MVP.
 * - phases.status utilise un vocabulaire minimal ('pending', 'in_progress',
 *   'completed'), non documenté explicitement ailleurs.
 * - issues.severity / recurrence_risk et decisions/issues.automation_potential
 *   utilisent un vocabulaire fermé minimal, faute de convention documentée.
 * - activity_log n'a pas de colonne updated_at : une entrée de journal est
 *   immuable une fois créée.
 */
export const createInitialMvpSchemaMigration: Migration = {
  version: 1,
  name: 'create initial mvp schema',
  up: (database) => {
    database.exec(`
      CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL CHECK (trim(name) <> ''),
        description TEXT,
        objective TEXT,
        status TEXT NOT NULL CHECK (status IN ('planning', 'active', 'paused', 'completed', 'archived')),
        repository_path TEXT,
        target_technology TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE phases (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL CHECK (trim(name) <> ''),
        description TEXT,
        position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
        status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (project_id, position)
      );

      CREATE INDEX idx_phases_project_id ON phases(project_id);

      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        phase_id TEXT REFERENCES phases(id) ON DELETE SET NULL,
        title TEXT NOT NULL CHECK (trim(title) <> ''),
        description TEXT,
        status TEXT NOT NULL CHECK (
          status IN ('backlog', 'ready', 'in_progress', 'to_validate', 'blocked', 'completed', 'cancelled')
        ),
        priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
        claude_prompt TEXT,
        affected_files TEXT,
        acceptance_criteria TEXT,
        validation_commands TEXT,
        validation_results TEXT,
        notes TEXT,
        git_commit TEXT,
        position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX idx_tasks_project_id ON tasks(project_id);
      CREATE INDEX idx_tasks_phase_id ON tasks(phase_id);
      CREATE INDEX idx_tasks_status ON tasks(status);

      CREATE TABLE task_checklist_items (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        label TEXT NOT NULL CHECK (trim(label) <> ''),
        is_completed INTEGER NOT NULL DEFAULT 0 CHECK (is_completed IN (0, 1)),
        position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX idx_task_checklist_items_task_id ON task_checklist_items(task_id);

      CREATE TABLE questions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
        title TEXT NOT NULL CHECK (trim(title) <> ''),
        details TEXT,
        status TEXT NOT NULL CHECK (
          status IN ('open', 'to_research', 'answered', 'converted_to_decision', 'abandoned')
        ),
        answer TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX idx_questions_project_id ON questions(project_id);
      CREATE INDEX idx_questions_task_id ON questions(task_id);
      CREATE INDEX idx_questions_status ON questions(status);

      CREATE TABLE issues (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
        symptom TEXT NOT NULL CHECK (trim(symptom) <> ''),
        context TEXT,
        severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
        cause TEXT,
        solution TEXT,
        commands_used TEXT,
        modified_files TEXT,
        prevention TEXT,
        recurrence_risk TEXT NOT NULL CHECK (recurrence_risk IN ('low', 'medium', 'high')),
        automation_potential TEXT NOT NULL CHECK (automation_potential IN ('none', 'possible', 'recommended')),
        status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'resolved', 'wont_fix')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX idx_issues_project_id ON issues(project_id);
      CREATE INDEX idx_issues_task_id ON issues(task_id);
      CREATE INDEX idx_issues_severity ON issues(severity);
      CREATE INDEX idx_issues_status ON issues(status);

      CREATE TABLE decisions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
        question_id TEXT REFERENCES questions(id) ON DELETE SET NULL,
        context TEXT,
        decision TEXT NOT NULL CHECK (trim(decision) <> ''),
        alternatives TEXT,
        rationale TEXT,
        consequences TEXT,
        is_reusable INTEGER NOT NULL DEFAULT 0 CHECK (is_reusable IN (0, 1)),
        automation_potential TEXT NOT NULL CHECK (automation_potential IN ('none', 'possible', 'recommended')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX idx_decisions_project_id ON decisions(project_id);
      CREATE INDEX idx_decisions_task_id ON decisions(task_id);
      CREATE INDEX idx_decisions_question_id ON decisions(question_id);

      CREATE TABLE activity_log (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        entity_type TEXT NOT NULL CHECK (trim(entity_type) <> ''),
        entity_id TEXT,
        action TEXT NOT NULL CHECK (trim(action) <> ''),
        details TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX idx_activity_log_project_id ON activity_log(project_id);
      CREATE INDEX idx_activity_log_created_at ON activity_log(created_at);
      CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);
    `)
  }
}
