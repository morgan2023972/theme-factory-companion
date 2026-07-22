import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../migrations/runMigrations'
import { createProjectsRepository, type ProjectsRepository } from './projectsRepository'
import { createPhasesRepository, type PhasesRepository } from './phasesRepository'
import { createWorkflowProfilesRepository, type WorkflowProfilesRepository } from './workflowProfilesRepository'
import { createWorkflowRunsRepository, type WorkflowRunsRepository } from './workflowRunsRepository'
import { createWorkflowStepsRepository, type WorkflowStepsRepository } from './workflowStepsRepository'
import type { WorkflowRun } from '../../../shared/orchestration'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/
const NONEXISTENT_ID = '00000000-0000-4000-8000-000000000099'

let db: Database.Database
let repository: WorkflowStepsRepository
let run: WorkflowRun

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db)

  const projectsRepository: ProjectsRepository = createProjectsRepository(db)
  const phasesRepository: PhasesRepository = createPhasesRepository(db)
  const profilesRepository: WorkflowProfilesRepository = createWorkflowProfilesRepository(db)
  const runsRepository: WorkflowRunsRepository = createWorkflowRunsRepository(db)
  repository = createWorkflowStepsRepository(db)

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

describe('workflowStepsRepository.create', () => {
  it('crée un step en statut pending, startedAt/completedAt à null', () => {
    const step = repository.create({ workflowRunId: run.id, type: 'project_and_phase_selection', position: 0 })

    expect(step.id).toMatch(UUID_PATTERN)
    expect(step.status).toBe('pending')
    expect(step.startedAt).toBeNull()
    expect(step.completedAt).toBeNull()
    expect(step.position).toBe(0)
  })

  it('rejette un workflow_run_id inexistant', () => {
    expect(() =>
      repository.create({ workflowRunId: NONEXISTENT_ID, type: 'project_and_phase_selection', position: 0 })
    ).toThrow()
  })

  it('rejette deux steps à la même position pour le même run', () => {
    repository.create({ workflowRunId: run.id, type: 'project_and_phase_selection', position: 0 })

    expect(() => repository.create({ workflowRunId: run.id, type: 'prompt_preparation', position: 0 })).toThrow()
  })
})

describe('workflowStepsRepository.listByWorkflowRunId / getById', () => {
  it('retourne null si le step est absent', () => {
    expect(repository.getById(NONEXISTENT_ID)).toBeNull()
  })

  it('trie les steps par position croissante', () => {
    const second = repository.create({ workflowRunId: run.id, type: 'prompt_preparation', position: 1 })
    const first = repository.create({ workflowRunId: run.id, type: 'project_and_phase_selection', position: 0 })

    const ids = repository.listByWorkflowRunId(run.id).map((step) => step.id)
    expect(ids).toEqual([first.id, second.id])
  })
})

describe('workflowStepsRepository.start', () => {
  it('passe un step pending à in_progress avec startedAt renseigné', () => {
    const step = repository.create({ workflowRunId: run.id, type: 'project_and_phase_selection', position: 0 })

    const started = repository.start(step.id)

    expect(started.status).toBe('in_progress')
    expect(started.startedAt).toMatch(ISO_DATETIME_PATTERN)
    expect(started.completedAt).toBeNull()
  })

  it("refuse de démarrer un step déjà en cours, sans écrire", () => {
    const step = repository.create({ workflowRunId: run.id, type: 'project_and_phase_selection', position: 0 })
    repository.start(step.id)

    expect(() => repository.start(step.id)).toThrow()
  })

  it('lève une erreur pour un step inexistant', () => {
    expect(() => repository.start(NONEXISTENT_ID)).toThrow()
  })
})

describe('workflowStepsRepository.complete', () => {
  it('complète un step in_progress avec completedAt renseigné', () => {
    const step = repository.create({ workflowRunId: run.id, type: 'project_and_phase_selection', position: 0 })
    repository.start(step.id)

    const completed = repository.complete(step.id, 'completed')

    expect(completed.status).toBe('completed')
    expect(completed.completedAt).toMatch(ISO_DATETIME_PATTERN)
  })

  it('accepte un step skipped directement depuis pending (jamais démarré)', () => {
    const step = repository.create({ workflowRunId: run.id, type: 'project_and_phase_selection', position: 0 })

    const skipped = repository.complete(step.id, 'skipped')

    expect(skipped.status).toBe('skipped')
    expect(skipped.startedAt).toBeNull()
    expect(skipped.completedAt).toMatch(ISO_DATETIME_PATTERN)
  })

  it('refuse de compléter un step déjà terminal, sans écrire', () => {
    const step = repository.create({ workflowRunId: run.id, type: 'project_and_phase_selection', position: 0 })
    repository.complete(step.id, 'completed')

    expect(() => repository.complete(step.id, 'failed')).toThrow()
    expect(repository.getById(step.id)?.status).toBe('completed')
  })
})

describe('workflowStepsRepository — updatedAt (horloge injectée, déterministe)', () => {
  function createClockedRepository(timestamps: string[]) {
    let callIndex = 0
    return createWorkflowStepsRepository(db, { now: () => timestamps[callIndex++] })
  }

  it('start accepté modifie updatedAt, avec startedAt strictement identique à updatedAt', () => {
    const timestamps = ['2026-01-01T00:00:00.000Z', '2026-01-01T00:00:01.000Z']
    const clockedRepository = createClockedRepository(timestamps)
    const step = clockedRepository.create({ workflowRunId: run.id, type: 'project_and_phase_selection', position: 0 })

    const started = clockedRepository.start(step.id)

    expect(started.updatedAt).toBe(timestamps[1])
    expect(started.updatedAt).not.toBe(step.updatedAt)
    expect(started.startedAt).toBe(started.updatedAt)
  })

  it('start refusé conserve updatedAt', () => {
    const timestamps = ['2026-01-01T00:00:00.000Z', '2026-01-01T00:00:01.000Z']
    const clockedRepository = createClockedRepository(timestamps)
    const step = clockedRepository.create({ workflowRunId: run.id, type: 'project_and_phase_selection', position: 0 })
    clockedRepository.start(step.id)
    const startedOnce = clockedRepository.getById(step.id)

    expect(() => clockedRepository.start(step.id)).toThrow()

    expect(clockedRepository.getById(step.id)?.updatedAt).toBe(startedOnce?.updatedAt)
  })

  it('complete accepté modifie updatedAt, avec completedAt strictement identique à updatedAt', () => {
    const timestamps = ['2026-01-01T00:00:00.000Z', '2026-01-01T00:00:01.000Z']
    const clockedRepository = createClockedRepository(timestamps)
    const step = clockedRepository.create({ workflowRunId: run.id, type: 'project_and_phase_selection', position: 0 })

    const completed = clockedRepository.complete(step.id, 'skipped')

    expect(completed.updatedAt).toBe(timestamps[1])
    expect(completed.updatedAt).not.toBe(step.updatedAt)
    expect(completed.completedAt).toBe(completed.updatedAt)
  })

  it('complete refusé conserve updatedAt', () => {
    const timestamps = ['2026-01-01T00:00:00.000Z', '2026-01-01T00:00:01.000Z']
    const clockedRepository = createClockedRepository(timestamps)
    const step = clockedRepository.create({ workflowRunId: run.id, type: 'project_and_phase_selection', position: 0 })
    clockedRepository.complete(step.id, 'completed')
    const completedOnce = clockedRepository.getById(step.id)

    expect(() => clockedRepository.complete(step.id, 'failed')).toThrow()

    expect(clockedRepository.getById(step.id)?.updatedAt).toBe(completedOnce?.updatedAt)
  })
})
