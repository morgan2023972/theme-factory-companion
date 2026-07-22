/**
 * API publique des schémas partagés de l'orchestrateur local V1 (ORCH-1.1).
 * Statut : schémas et types uniquement, aucune logique système ou métier
 * d'exécution (voir `docs/orchestration/ORCHESTRATOR_V1_ROADMAP.md`).
 * `common.ts` (helpers internes) est volontairement exclu de cette API
 * publique.
 */

export {
  COMMAND_EXECUTION_STATUSES,
  commandExecutionSchema,
  commandExecutionStatusSchema,
  completeCommandExecutionSchema,
  createCommandExecutionSchema,
  type CommandExecution,
  type CommandExecutionStatus,
  type CompleteCommandExecutionInput,
  type CreateCommandExecutionInput
} from './commandExecution'

export {
  WORKFLOW_ARTIFACT_TYPES,
  createWorkflowArtifactSchema,
  workflowArtifactSchema,
  workflowArtifactTypeSchema,
  type CreateWorkflowArtifactInput,
  type WorkflowArtifact,
  type WorkflowArtifactType
} from './workflowArtifact'

export {
  WORKFLOW_APPROVAL_STATUSES,
  WORKFLOW_APPROVAL_TYPES,
  createWorkflowApprovalSchema,
  decideWorkflowApprovalSchema,
  workflowApprovalSchema,
  workflowApprovalStatusSchema,
  workflowApprovalTypeSchema,
  type CreateWorkflowApprovalInput,
  type DecideWorkflowApprovalInput,
  type WorkflowApproval,
  type WorkflowApprovalStatus,
  type WorkflowApprovalType
} from './workflowApproval'

export {
  createWorkflowProfileSchema,
  validationCommandSchema,
  workflowProfileSchema,
  type CreateWorkflowProfileInput,
  type ValidationCommand,
  type WorkflowProfile
} from './workflowProfile'

export {
  WORKFLOW_RUN_STATUSES,
  WORKFLOW_RUN_TERMINAL_STATUSES,
  createWorkflowRunSchema,
  workflowRunSchema,
  workflowRunStatusSchema,
  type CreateWorkflowRunInput,
  type WorkflowRun,
  type WorkflowRunStatus
} from './workflowRun'

export {
  WORKFLOW_STEP_STATUSES,
  WORKFLOW_STEP_TYPES,
  createWorkflowStepSchema,
  workflowStepSchema,
  workflowStepStatusSchema,
  workflowStepTypeSchema,
  type CreateWorkflowStepInput,
  type WorkflowStep,
  type WorkflowStepStatus,
  type WorkflowStepType
} from './workflowStep'

export {
  WORKFLOW_RUN_TRANSITIONS,
  getAllowedNextWorkflowRunStatuses,
  isValidWorkflowRunTransition
} from './workflowStateMachine'

export {
  workflowArtifactPathsConfigSchema,
  workflowProfileCommandConfigSchema,
  workflowProfileConfigSchema,
  type WorkflowArtifactPathsConfig,
  type WorkflowProfileCommandConfig,
  type WorkflowProfileConfig
} from './workflowProfileConfig'
