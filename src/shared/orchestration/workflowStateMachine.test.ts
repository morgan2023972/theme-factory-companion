import { describe, expect, it } from 'vitest'
import { WORKFLOW_RUN_STATUSES, WORKFLOW_RUN_TERMINAL_STATUSES, type WorkflowRunStatus } from './workflowRun'
import {
  WORKFLOW_RUN_TRANSITIONS,
  getAllowedNextWorkflowRunStatuses,
  isValidWorkflowRunTransition
} from './workflowStateMachine'

const validTransitionPairs: Array<[WorkflowRunStatus, WorkflowRunStatus]> = WORKFLOW_RUN_STATUSES.flatMap((from) =>
  WORKFLOW_RUN_TRANSITIONS[from].map((to): [WorkflowRunStatus, WorkflowRunStatus] => [from, to])
)

const allPairs: Array<[WorkflowRunStatus, WorkflowRunStatus]> = WORKFLOW_RUN_STATUSES.flatMap((from) =>
  WORKFLOW_RUN_STATUSES.map((to): [WorkflowRunStatus, WorkflowRunStatus] => [from, to])
)

const isValidPair = (from: WorkflowRunStatus, to: WorkflowRunStatus): boolean =>
  validTransitionPairs.some(([validFrom, validTo]) => validFrom === from && validTo === to)

const invalidTransitionPairs = allPairs.filter(([from, to]) => !isValidPair(from, to))

describe('WORKFLOW_RUN_TRANSITIONS — exhaustivité des clés', () => {
  it('possède exactement les 17 statuts de WORKFLOW_RUN_STATUSES, ni plus ni moins', () => {
    const keys = Object.keys(WORKFLOW_RUN_TRANSITIONS).sort()
    const expected = [...WORKFLOW_RUN_STATUSES].sort()
    expect(keys).toEqual(expected)
  })
})

describe('WORKFLOW_RUN_TRANSITIONS — statuts terminaux', () => {
  it.each(WORKFLOW_RUN_TERMINAL_STATUSES)('"%s" (terminal) n\'a aucune transition sortante', (status) => {
    expect(WORKFLOW_RUN_TRANSITIONS[status]).toEqual([])
  })

  const nonTerminalStatuses = WORKFLOW_RUN_STATUSES.filter(
    (status) => !WORKFLOW_RUN_TERMINAL_STATUSES.includes(status)
  )

  it.each(nonTerminalStatuses)('"%s" (non terminal) possède au moins une transition sortante', (status) => {
    expect(WORKFLOW_RUN_TRANSITIONS[status].length).toBeGreaterThan(0)
  })
})

describe('isValidWorkflowRunTransition — transitions valides', () => {
  it.each(validTransitionPairs)('accepte %s -> %s', (from, to) => {
    expect(isValidWorkflowRunTransition(from, to)).toBe(true)
  })
})

describe('isValidWorkflowRunTransition — transitions refusées (exhaustif, fail-closed)', () => {
  it('couvre bien les 289 paires possibles (17 x 17), valides + invalides', () => {
    expect(validTransitionPairs.length + invalidTransitionPairs.length).toBe(
      WORKFLOW_RUN_STATUSES.length * WORKFLOW_RUN_STATUSES.length
    )
  })

  it.each(invalidTransitionPairs)('refuse %s -> %s', (from, to) => {
    expect(isValidWorkflowRunTransition(from, to)).toBe(false)
  })
})

describe('isValidWorkflowRunTransition — transitions identité', () => {
  it.each(WORKFLOW_RUN_STATUSES)('refuse %s -> %s (identité)', (status) => {
    expect(isValidWorkflowRunTransition(status, status)).toBe(false)
  })
})

describe('isValidWorkflowRunTransition — statuts terminaux comme origine', () => {
  it.each(WORKFLOW_RUN_TERMINAL_STATUSES)('refuse toute transition dont "%s" est l\'origine', (from) => {
    for (const to of WORKFLOW_RUN_STATUSES) {
      expect(isValidWorkflowRunTransition(from, to)).toBe(false)
    }
  })
})

describe('getAllowedNextWorkflowRunStatuses', () => {
  it.each(WORKFLOW_RUN_STATUSES)('retourne exactement WORKFLOW_RUN_TRANSITIONS["%s"]', (status) => {
    expect(getAllowedNextWorkflowRunStatuses(status)).toEqual(WORKFLOW_RUN_TRANSITIONS[status])
  })

  it.each(WORKFLOW_RUN_TERMINAL_STATUSES)('retourne un tableau vide pour le statut terminal "%s"', (status) => {
    expect(getAllowedNextWorkflowRunStatuses(status)).toEqual([])
  })
})

describe('isValidWorkflowRunTransition / getAllowedNextWorkflowRunStatuses — valeur runtime invalide (fail-closed)', () => {
  const invalidStatus = 'not_a_status' as WorkflowRunStatus

  it('isValidWorkflowRunTransition ne lève pas d\'exception pour un "from" invalide et retourne false', () => {
    expect(() => isValidWorkflowRunTransition(invalidStatus, 'draft')).not.toThrow()
    expect(isValidWorkflowRunTransition(invalidStatus, 'draft')).toBe(false)
  })

  it('isValidWorkflowRunTransition ne lève pas d\'exception pour un "to" invalide et retourne false', () => {
    expect(() => isValidWorkflowRunTransition('draft', invalidStatus)).not.toThrow()
    expect(isValidWorkflowRunTransition('draft', invalidStatus)).toBe(false)
  })

  it('isValidWorkflowRunTransition ne lève pas d\'exception quand "from" et "to" sont invalides et retourne false', () => {
    expect(() => isValidWorkflowRunTransition(invalidStatus, invalidStatus)).not.toThrow()
    expect(isValidWorkflowRunTransition(invalidStatus, invalidStatus)).toBe(false)
  })

  it('getAllowedNextWorkflowRunStatuses ne lève pas d\'exception pour un "from" invalide et retourne []', () => {
    expect(() => getAllowedNextWorkflowRunStatuses(invalidStatus)).not.toThrow()
    expect(getAllowedNextWorkflowRunStatuses(invalidStatus)).toEqual([])
  })
})

describe('WORKFLOW_RUN_TRANSITIONS — non-mutabilité à l\'exécution', () => {
  it('refuse la mutation d\'une entrée existante (objet gelé)', () => {
    const mutableRef = WORKFLOW_RUN_TRANSITIONS as unknown as Record<string, unknown>
    expect(() => {
      mutableRef.draft = []
    }).toThrow(TypeError)
    expect(WORKFLOW_RUN_TRANSITIONS.draft).toEqual(['prompt_ready', 'cancelled', 'failed'])
  })

  it('refuse la mutation d\'un tableau de transitions autorisées (tableau gelé)', () => {
    const mutableArray = WORKFLOW_RUN_TRANSITIONS.draft as unknown as WorkflowRunStatus[]
    expect(() => {
      mutableArray.push('completed')
    }).toThrow(TypeError)
    expect(WORKFLOW_RUN_TRANSITIONS.draft).toEqual(['prompt_ready', 'cancelled', 'failed'])
  })
})
