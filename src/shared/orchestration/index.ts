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
  type CommandExecution,
  type CommandExecutionStatus
} from './commandExecution'

export {
  WORKFLOW_ARTIFACT_TYPES,
  workflowArtifactSchema,
  workflowArtifactTypeSchema,
  type WorkflowArtifact,
  type WorkflowArtifactType
} from './workflowArtifact'

export {
  WORKFLOW_APPROVAL_STATUSES,
  WORKFLOW_APPROVAL_TYPES,
  workflowApprovalSchema,
  workflowApprovalStatusSchema,
  workflowApprovalTypeSchema,
  type WorkflowApproval,
  type WorkflowApprovalStatus,
  type WorkflowApprovalType
} from './workflowApproval'

export {
  validationCommandSchema,
  workflowProfileSchema,
  type ValidationCommand,
  type WorkflowProfile
} from './workflowProfile'

export {
  WORKFLOW_RUN_STATUSES,
  WORKFLOW_RUN_TERMINAL_STATUSES,
  workflowRunSchema,
  workflowRunStatusSchema,
  type WorkflowRun,
  type WorkflowRunStatus
} from './workflowRun'

export {
  WORKFLOW_STEP_STATUSES,
  WORKFLOW_STEP_TYPES,
  workflowStepSchema,
  workflowStepStatusSchema,
  workflowStepTypeSchema,
  type WorkflowStep,
  type WorkflowStepStatus,
  type WorkflowStepType
} from './workflowStep'

export {
  WORKFLOW_RUN_TRANSITIONS,
  getAllowedNextWorkflowRunStatuses,
  isValidWorkflowRunTransition
} from './workflowStateMachine'
