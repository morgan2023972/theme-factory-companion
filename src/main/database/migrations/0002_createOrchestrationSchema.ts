import type { Migration } from './migrationTypes'

/**
 * Schéma de l'orchestrateur local V1 (ORCH-2.1).
 *
 * Persiste exactement les six entités déjà définies et figées dans
 * `src/shared/orchestration/` (ORCH-1.1) : WorkflowProfile, ValidationCommand
 * (imbriquée), WorkflowRun, WorkflowStep, WorkflowArtifact, WorkflowApproval,
 * CommandExecution. Cette migration ne dépend d'aucun code applicatif : elle
 * reste du SQL pur, comme 0001_createInitialMvpSchema.ts.
 *
 * Décisions de modélisation imposées (voir workflow/prompts/ORCH_2.1_PROMPT.md,
 * section « Décisions imposées, à documenter dans le code ») :
 *
 * 1. workflow_runs.current_step_id n'a pas de contrainte REFERENCES. Une
 *    contrainte stricte créerait une dépendance circulaire avec
 *    workflow_steps.workflow_run_id (chaque table référencerait une table
 *    pas encore créée par rapport à l'autre). Plutôt que de s'appuyer sur la
 *    tolérance de SQLite aux références en avant (comportement correct mais
 *    non évident), la colonne reste un simple TEXT nullable, indexé, dont
 *    l'intégrité (le step référencé appartient bien au même run) est une
 *    responsabilité du futur repository (ORCH-2.2), pas de la base.
 * 2. workflow_runs.phase_id et workflow_runs.profile_id n'ont pas de clause
 *    ON DELETE (comportement par défaut : suppression du parent bloquée tant
 *    qu'une ligne y fait référence), contrairement à project_id qui est
 *    ON DELETE CASCADE. ORCHESTRATOR_V1_SCOPE.md section 5 exige un
 *    historique conservé des étapes, commandes et approbations : supprimer
 *    une phase ou un profil ne doit jamais faire disparaître silencieusement
 *    l'historique d'un workflow qui s'y réfère. Supprimer le projet entier,
 *    en revanche, est déjà traité comme une suppression cascadée totale par
 *    la migration 0001 (phases/tasks sont déjà ON DELETE CASCADE depuis
 *    projects) : workflow_runs.project_id suit la même convention.
 * 3. Des contraintes CHECK composites reproduisent chaque superRefine Zod de
 *    WorkflowRun, WorkflowStep, WorkflowApproval et CommandExecution : la
 *    cohérence statut ↔ dates/exit_code déjà validée côté Zod est également
 *    appliquée en base, en défense en profondeur.
 * 4. workflow_profile_validation_commands.blocking, .position et
 *    command_executions.stdout_truncated/stderr_truncated n'ont
 *    volontairement pas de DEFAULT, contrairement à is_completed/is_reusable
 *    dans 0001_createInitialMvpSchema.ts. ORCH-1.1 a explicitement retiré
 *    .default(true) de ValidationCommand.blocking côté Zod pour qu'une
 *    donnée corrompue ou incomplète soit rejetée plutôt que masquée
 *    silencieusement (voir RAPPORT_CORRECTIONS_REVIEW_ORCH_1.1.md) ; la même
 *    exigence s'applique aux colonnes SQL correspondantes.
 * 5. args (tableaux de chaînes) est stocké en TEXT JSON, sans table enfant
 *    dédiée, par cohérence avec tasks.affected_files/acceptance_criteria
 *    dans 0001_createInitialMvpSchema.ts. WorkflowProfile.validationCommands
 *    (tableau d'objets structurés) reçoit en revanche une table enfant
 *    dédiée, par cohérence avec task_checklist_items.
 * 6. Aucune contrainte UNIQUE sur workflow_artifacts.relative_path :
 *    l'interdiction d'écrasement d'un artefact (section 5 des règles de
 *    sécurité) est une responsabilité du futur service de fichiers
 *    (ORCH-3.2), pas de cette migration.
 */
export const createOrchestrationSchemaMigration: Migration = {
  version: 2,
  name: 'create orchestration schema',
  up: (database) => {
    database.exec(`
      CREATE TABLE workflow_profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL CHECK (trim(name) <> ''),
        version TEXT NOT NULL CHECK (trim(version) <> ''),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE workflow_profile_validation_commands (
        id TEXT PRIMARY KEY,
        workflow_profile_id TEXT NOT NULL REFERENCES workflow_profiles(id) ON DELETE CASCADE,
        name TEXT NOT NULL CHECK (trim(name) <> ''),
        command TEXT NOT NULL CHECK (trim(command) <> ''),
        args TEXT NOT NULL,
        blocking INTEGER NOT NULL CHECK (blocking IN (0, 1)),
        position INTEGER NOT NULL CHECK (position >= 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (workflow_profile_id, position)
      );

      CREATE INDEX idx_workflow_profile_validation_commands_profile_id
        ON workflow_profile_validation_commands(workflow_profile_id);

      CREATE TABLE workflow_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        phase_id TEXT NOT NULL REFERENCES phases(id),
        profile_id TEXT NOT NULL REFERENCES workflow_profiles(id),
        profile_fingerprint TEXT NOT NULL CHECK (trim(profile_fingerprint) <> ''),
        status TEXT NOT NULL CHECK (status IN (
          'draft', 'prompt_ready', 'awaiting_approval', 'implementation_in_progress',
          'implementation_completed', 'report_available', 'review_required',
          'corrections_required', 'validations_in_progress', 'validation_failed',
          'manual_validation_required', 'ready_to_commit', 'committed', 'ready_to_push',
          'completed', 'cancelled', 'failed'
        )),
        current_step_id TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (
          (status IN ('completed', 'cancelled', 'failed') AND completed_at IS NOT NULL)
          OR
          (status NOT IN ('completed', 'cancelled', 'failed') AND completed_at IS NULL)
        )
      );

      CREATE INDEX idx_workflow_runs_project_id ON workflow_runs(project_id);
      CREATE INDEX idx_workflow_runs_phase_id ON workflow_runs(phase_id);
      CREATE INDEX idx_workflow_runs_profile_id ON workflow_runs(profile_id);
      CREATE INDEX idx_workflow_runs_status ON workflow_runs(status);
      CREATE INDEX idx_workflow_runs_current_step_id ON workflow_runs(current_step_id);

      CREATE TABLE workflow_steps (
        id TEXT PRIMARY KEY,
        workflow_run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN (
          'project_and_phase_selection', 'prompt_preparation', 'prompt_approval',
          'prompt_file_creation', 'claude_code_execution', 'report_retrieval',
          'report_analysis', 'corrections', 'automatic_validation', 'manual_validation',
          'commit_preparation', 'commit_approval', 'commit', 'push_approval', 'push'
        )),
        status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled', 'skipped')),
        position INTEGER NOT NULL CHECK (position >= 0),
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (workflow_run_id, position),
        CHECK (
          (status = 'pending' AND started_at IS NULL AND completed_at IS NULL)
          OR (status = 'in_progress' AND started_at IS NOT NULL AND completed_at IS NULL)
          OR (status IN ('completed', 'failed', 'cancelled', 'skipped') AND completed_at IS NOT NULL)
        )
      );

      CREATE INDEX idx_workflow_steps_workflow_run_id ON workflow_steps(workflow_run_id);
      CREATE INDEX idx_workflow_steps_status ON workflow_steps(status);

      CREATE TABLE workflow_artifacts (
        id TEXT PRIMARY KEY,
        workflow_run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
        workflow_step_id TEXT REFERENCES workflow_steps(id) ON DELETE SET NULL,
        type TEXT NOT NULL CHECK (type IN (
          'phase_prompt', 'phase_report', 'review_prompt', 'review_report',
          'correction_prompt', 'correction_report', 'validation_report'
        )),
        relative_path TEXT NOT NULL CHECK (trim(relative_path) <> ''),
        created_at TEXT NOT NULL
      );

      CREATE INDEX idx_workflow_artifacts_workflow_run_id ON workflow_artifacts(workflow_run_id);
      CREATE INDEX idx_workflow_artifacts_workflow_step_id ON workflow_artifacts(workflow_step_id);
      CREATE INDEX idx_workflow_artifacts_type ON workflow_artifacts(type);

      CREATE TABLE workflow_approvals (
        id TEXT PRIMARY KEY,
        workflow_run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
        workflow_step_id TEXT REFERENCES workflow_steps(id) ON DELETE SET NULL,
        type TEXT NOT NULL CHECK (type IN ('phase_prompt', 'correction_prompt', 'manual_validation', 'commit', 'push')),
        status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
        requested_at TEXT NOT NULL,
        decided_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (
          (status = 'pending' AND decided_at IS NULL)
          OR (status IN ('approved', 'rejected') AND decided_at IS NOT NULL)
        )
      );

      CREATE INDEX idx_workflow_approvals_workflow_run_id ON workflow_approvals(workflow_run_id);
      CREATE INDEX idx_workflow_approvals_workflow_step_id ON workflow_approvals(workflow_step_id);
      CREATE INDEX idx_workflow_approvals_status ON workflow_approvals(status);

      CREATE TABLE command_executions (
        id TEXT PRIMARY KEY,
        workflow_run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
        workflow_step_id TEXT REFERENCES workflow_steps(id) ON DELETE SET NULL,
        executable TEXT NOT NULL CHECK (trim(executable) <> ''),
        args TEXT NOT NULL,
        cwd TEXT NOT NULL CHECK (trim(cwd) <> ''),
        status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'timed_out', 'cancelled')),
        exit_code INTEGER,
        stdout TEXT NOT NULL,
        stderr TEXT NOT NULL,
        stdout_truncated INTEGER NOT NULL CHECK (stdout_truncated IN (0, 1)),
        stderr_truncated INTEGER NOT NULL CHECK (stderr_truncated IN (0, 1)),
        started_at TEXT,
        completed_at TEXT,
        duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (
          (status = 'pending' AND started_at IS NULL AND completed_at IS NULL AND duration_ms IS NULL AND exit_code IS NULL)
          OR (status = 'running' AND started_at IS NOT NULL AND completed_at IS NULL AND duration_ms IS NULL AND exit_code IS NULL)
          OR (status = 'completed' AND started_at IS NOT NULL AND completed_at IS NOT NULL AND duration_ms IS NOT NULL AND exit_code = 0)
          OR (status IN ('failed', 'timed_out', 'cancelled') AND started_at IS NOT NULL AND completed_at IS NOT NULL AND duration_ms IS NOT NULL)
        )
      );

      CREATE INDEX idx_command_executions_workflow_run_id ON command_executions(workflow_run_id);
      CREATE INDEX idx_command_executions_workflow_step_id ON command_executions(workflow_step_id);
      CREATE INDEX idx_command_executions_status ON command_executions(status);
    `)
  }
}
