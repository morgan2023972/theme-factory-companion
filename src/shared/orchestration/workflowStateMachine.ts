import type { WorkflowRunStatus } from './workflowRun'

/**
 * Machine à états pure du `WorkflowRun` (ORCH-1.2). Définit et valide les
 * transitions autorisées entre les 17 valeurs de `WorkflowRunStatus`,
 * conformément à `docs/orchestration/ORCHESTRATOR_V1_WORKFLOW.md`. Aucune
 * I/O, aucun accès disque/réseau/processus/SQLite/Git : ce module ne fait
 * que répondre à la question « telle transition est-elle autorisée ? »,
 * jamais « déclenche cette transition ».
 *
 * Ne couvre que `WorkflowRun.status`. Les statuts de `WorkflowStep`,
 * `WorkflowApproval` et `CommandExecution` restent régis par leurs seuls
 * invariants locaux (`superRefine`, ORCH-1.1) ; une éventuelle machine à
 * états dédiée à ces entités est hors périmètre ORCH-1.2.
 *
 * La table ci-dessous fait foi (voir `workflow/prompts/ORCH_1.2_PROMPT.md`,
 * section « Table de transitions », pour la justification étape par étape
 * de chaque ligne). Le nombre maximal de cycles de correction n'est
 * volontairement pas modélisé ici (section 23 des règles de sécurité,
 * valeur non fixée) : les allers-retours structurels
 * `corrections_required → awaiting_approval → validations_in_progress`
 * restent possibles sans compteur, l'application d'une limite étant une
 * responsabilité d'exécution future.
 *
 * L'objet et chacun de ses tableaux sont gelés (`Object.freeze`) : au-delà
 * du typage `readonly` (garantie purement compile-time), toute tentative de
 * mutation à l'exécution (ajout/suppression d'entrée, modification d'un
 * tableau de statuts autorisés) échoue réellement, conformément au principe
 * fail-closed de `ORCHESTRATOR_V1_SAFETY_RULES.md` section 2.
 */
const rawWorkflowRunTransitions: Record<WorkflowRunStatus, readonly WorkflowRunStatus[]> = {
  draft: ['prompt_ready', 'cancelled', 'failed'],
  prompt_ready: ['awaiting_approval', 'cancelled'],
  awaiting_approval: ['implementation_in_progress', 'prompt_ready', 'cancelled'],
  implementation_in_progress: ['implementation_completed', 'cancelled'],
  implementation_completed: ['report_available', 'implementation_in_progress', 'failed', 'cancelled'],
  report_available: ['review_required', 'cancelled'],
  review_required: ['validations_in_progress', 'corrections_required', 'failed', 'cancelled'],
  corrections_required: ['awaiting_approval', 'failed', 'cancelled'],
  validations_in_progress: ['manual_validation_required', 'validation_failed', 'cancelled'],
  validation_failed: ['corrections_required', 'failed', 'cancelled'],
  manual_validation_required: ['ready_to_commit', 'corrections_required', 'cancelled'],
  ready_to_commit: ['committed', 'cancelled'],
  committed: ['ready_to_push', 'cancelled'],
  ready_to_push: ['completed', 'committed', 'cancelled'],
  completed: [],
  cancelled: [],
  failed: []
}

for (const status of Object.keys(rawWorkflowRunTransitions) as WorkflowRunStatus[]) {
  Object.freeze(rawWorkflowRunTransitions[status])
}

export const WORKFLOW_RUN_TRANSITIONS: Readonly<Record<WorkflowRunStatus, readonly WorkflowRunStatus[]>> =
  Object.freeze(rawWorkflowRunTransitions)

/**
 * `from` est déjà connu de la table (clé propre, non héritée) : garde
 * défensive utilisée par les deux fonctions publiques ci-dessous. Le
 * typage `WorkflowRunStatus` garantit normalement cette appartenance, mais
 * une valeur non validée par `workflowRunStatusSchema` en amont (contournée
 * par un cast, ou provenant d'une source externe non fiable) doit être
 * refusée proprement plutôt que de provoquer une exception à l'indexation
 * de la table — fail-closed, voir `ORCHESTRATOR_V1_SAFETY_RULES.md` section 2.
 */
const isKnownWorkflowRunStatus = (value: WorkflowRunStatus): boolean =>
  Object.prototype.hasOwnProperty.call(WORKFLOW_RUN_TRANSITIONS, value)

/**
 * Vérifie si la transition `from → to` est autorisée. Liste blanche
 * stricte, fail-closed : retourne `false` pour toute paire non explicitement
 * présente dans `WORKFLOW_RUN_TRANSITIONS`, y compris une transition
 * identité (`from === to`), une transition dont `from` est un statut
 * terminal, ou une valeur `from`/`to` qui n'est pas une clé connue de la
 * table (valeur runtime invalide ayant contourné le typage statique). Ne
 * lance jamais d'exception ; ne suppose jamais qu'une paire inconnue est
 * valide.
 */
export const isValidWorkflowRunTransition = (from: WorkflowRunStatus, to: WorkflowRunStatus): boolean =>
  isKnownWorkflowRunStatus(from) && WORKFLOW_RUN_TRANSITIONS[from].includes(to)

/**
 * Retourne la liste des statuts vers lesquels une transition est autorisée
 * depuis `from`. Tableau vide pour les 3 statuts terminaux
 * (`completed`, `cancelled`, `failed`) ainsi que pour toute valeur `from`
 * qui n'est pas une clé connue de la table (valeur runtime invalide) : ne
 * lance jamais d'exception.
 */
export const getAllowedNextWorkflowRunStatuses = (from: WorkflowRunStatus): readonly WorkflowRunStatus[] =>
  isKnownWorkflowRunStatus(from) ? WORKFLOW_RUN_TRANSITIONS[from] : []
