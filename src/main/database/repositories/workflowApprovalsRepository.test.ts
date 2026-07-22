import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../migrations/runMigrations'
import { createProjectsRepository, type ProjectsRepository } from './projectsRepository'
import { createPhasesRepository, type PhasesRepository } from './phasesRepository'
import { createWorkflowProfilesRepository, type WorkflowProfilesRepository } from './workflowProfilesRepository'
import { createWorkflowRunsRepository, type WorkflowRunsRepository } from './workflowRunsRepository'
import { createWorkflowApprovalsRepository, type WorkflowApprovalsRepository } from './workflowApprovalsRepository'
import type { WorkflowRun } from '../../../shared/orchestration'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/
const NONEXISTENT_ID = '00000000-0000-4000-8000-000000000099'

let db: Database.Database
let repository: WorkflowApprovalsRepository
let run: WorkflowRun

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db)

  const projectsRepository: ProjectsRepository = createProjectsRepository(db)
  const phasesRepository: PhasesRepository = createPhasesRepository(db)
  const profilesRepository: WorkflowProfilesRepository = createWorkflowProfilesRepository(db)
  const runsRepository: WorkflowRunsRepository = createWorkflowRunsRepository(db)
  repository = createWorkflowApprovalsRepository(db)

  const project = projectsRepository.create({ name: 'Projet de test' })
  const phase = phasesRepository.create({ projectId: project.id, name: 'Phase de test' })
  const profile = profilesRepository.create({ name: 'Profil', version: '1', validationCommands: [] })
  run = runsRepository.create({
    projectId: project.id,
    phaseId: phase.id,
    profileId: profile.id,
    profileFingerprint: 'fingerprint-1'
  })
})

afterEach(() => {
  db.close()
})

describe('workflowApprovalsRepository.create', () => {
  it('crée une approbation en statut pending, requestedAt renseigné, decidedAt à null', () => {
    const approval = repository.create({ workflowRunId: run.id, workflowStepId: null, type: 'phase_prompt' })

    expect(approval.id).toMatch(UUID_PATTERN)
    expect(approval.status).toBe('pending')
    expect(approval.decidedAt).toBeNull()
    expect(approval.requestedAt).toMatch(ISO_DATETIME_PATTERN)
  })

  it('rejette un workflow_run_id inexistant', () => {
    expect(() =>
      repository.create({ workflowRunId: NONEXISTENT_ID, workflowStepId: null, type: 'phase_prompt' })
    ).toThrow()
  })
})

describe('workflowApprovalsRepository.getById / listByWorkflowRunId', () => {
  it('retourne null si l\'approbation est absente', () => {
    expect(repository.getById(NONEXISTENT_ID)).toBeNull()
  })

  it('liste uniquement les approbations du run demandé', () => {
    const other = repository.create({ workflowRunId: run.id, workflowStepId: null, type: 'commit' })
    const approval = repository.create({ workflowRunId: run.id, workflowStepId: null, type: 'phase_prompt' })

    const ids = repository.listByWorkflowRunId(run.id).map((a) => a.id)
    expect(ids.sort()).toEqual([approval.id, other.id].sort())
  })
})

describe('workflowApprovalsRepository.decide', () => {
  it('accepte une décision depuis pending', () => {
    const approval = repository.create({ workflowRunId: run.id, workflowStepId: null, type: 'phase_prompt' })

    const decided = repository.decide(approval.id, { status: 'approved' })

    expect(decided.status).toBe('approved')
    expect(decided.decidedAt).toMatch(ISO_DATETIME_PATTERN)
  })

  it('refuse une seconde décision (approbation non réutilisable), sans écrire', () => {
    const approval = repository.create({ workflowRunId: run.id, workflowStepId: null, type: 'phase_prompt' })
    repository.decide(approval.id, { status: 'approved' })

    expect(() => repository.decide(approval.id, { status: 'rejected' })).toThrow()
    expect(repository.getById(approval.id)?.status).toBe('approved')
  })

  it('lève une erreur pour une approbation inexistante', () => {
    expect(() => repository.decide(NONEXISTENT_ID, { status: 'approved' })).toThrow()
  })
})

describe('workflowApprovalsRepository — updatedAt (horloge injectée, déterministe)', () => {
  function createClockedRepository(timestamps: string[]) {
    let callIndex = 0
    return createWorkflowApprovalsRepository(db, { now: () => timestamps[callIndex++] })
  }

  it('decide accepté modifie updatedAt, avec decidedAt strictement identique à updatedAt', () => {
    const timestamps = ['2026-01-01T00:00:00.000Z', '2026-01-01T00:00:01.000Z']
    const clockedRepository = createClockedRepository(timestamps)
    const approval = clockedRepository.create({ workflowRunId: run.id, workflowStepId: null, type: 'phase_prompt' })

    const decided = clockedRepository.decide(approval.id, { status: 'approved' })

    expect(decided.updatedAt).toBe(timestamps[1])
    expect(decided.updatedAt).not.toBe(approval.updatedAt)
    expect(decided.decidedAt).toBe(decided.updatedAt)
  })

  it('seconde décision refusée conserve updatedAt', () => {
    const timestamps = ['2026-01-01T00:00:00.000Z', '2026-01-01T00:00:01.000Z']
    const clockedRepository = createClockedRepository(timestamps)
    const approval = clockedRepository.create({ workflowRunId: run.id, workflowStepId: null, type: 'phase_prompt' })
    clockedRepository.decide(approval.id, { status: 'approved' })
    const decidedOnce = clockedRepository.getById(approval.id)

    expect(() => clockedRepository.decide(approval.id, { status: 'rejected' })).toThrow()

    expect(clockedRepository.getById(approval.id)?.updatedAt).toBe(decidedOnce?.updatedAt)
  })
})
