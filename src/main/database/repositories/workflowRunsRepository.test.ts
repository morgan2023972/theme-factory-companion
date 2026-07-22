import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../migrations/runMigrations'
import { createProjectsRepository, type ProjectsRepository } from './projectsRepository'
import { createPhasesRepository, type PhasesRepository } from './phasesRepository'
import { createWorkflowProfilesRepository, type WorkflowProfilesRepository } from './workflowProfilesRepository'
import { createWorkflowStepsRepository, type WorkflowStepsRepository } from './workflowStepsRepository'
import { createWorkflowRunsRepository, type WorkflowRunsRepository } from './workflowRunsRepository'
import type { Phase } from '../../../shared/schemas/phase'
import type { Project } from '../../../shared/schemas/project'
import type { WorkflowProfile } from '../../../shared/orchestration'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/
const NONEXISTENT_ID = '00000000-0000-4000-8000-000000000099'

let db: Database.Database
let projectsRepository: ProjectsRepository
let phasesRepository: PhasesRepository
let profilesRepository: WorkflowProfilesRepository
let stepsRepository: WorkflowStepsRepository
let repository: WorkflowRunsRepository

let project: Project
let phase: Phase
let profile: WorkflowProfile

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  projectsRepository = createProjectsRepository(db)
  phasesRepository = createPhasesRepository(db)
  profilesRepository = createWorkflowProfilesRepository(db)
  stepsRepository = createWorkflowStepsRepository(db)
  repository = createWorkflowRunsRepository(db)

  project = projectsRepository.create({ name: 'Projet de test' })
  phase = phasesRepository.create({ projectId: project.id, name: 'Phase de test' })
  profile = profilesRepository.create({ name: 'Profil de test', version: '1', validationCommands: [] })
})

afterEach(() => {
  db.close()
})

function createRun() {
  return repository.create({
    projectId: project.id,
    phaseId: phase.id,
    profileId: profile.id,
    profileFingerprint: 'fingerprint-1'
  })
}

describe('workflowRunsRepository.create', () => {
  it('crée un run en statut draft, startedAt renseigné, completedAt et currentStepId à null', () => {
    const run = createRun()

    expect(run.id).toMatch(UUID_PATTERN)
    expect(run.status).toBe('draft')
    expect(run.currentStepId).toBeNull()
    expect(run.completedAt).toBeNull()
    expect(run.startedAt).toMatch(ISO_DATETIME_PATTERN)
    expect(run.projectId).toBe(project.id)
    expect(run.phaseId).toBe(phase.id)
    expect(run.profileId).toBe(profile.id)
  })

  it('rejette un projet inexistant (violation de clé étrangère)', () => {
    expect(() =>
      repository.create({
        projectId: NONEXISTENT_ID,
        phaseId: phase.id,
        profileId: profile.id,
        profileFingerprint: 'fingerprint-1'
      })
    ).toThrow()
  })
})

describe('workflowRunsRepository.getById / listByProjectId', () => {
  it('retourne null si le run est absent', () => {
    expect(repository.getById(NONEXISTENT_ID)).toBeNull()
  })

  it('isole les runs par projet', () => {
    const otherProject = projectsRepository.create({ name: 'Autre projet' })
    const otherPhase = phasesRepository.create({ projectId: otherProject.id, name: 'Autre phase' })

    const run = createRun()
    repository.create({
      projectId: otherProject.id,
      phaseId: otherPhase.id,
      profileId: profile.id,
      profileFingerprint: 'fingerprint-2'
    })

    const runs = repository.listByProjectId(project.id)
    expect(runs.map((r) => r.id)).toEqual([run.id])
  })
})

describe('workflowRunsRepository.updateStatus', () => {
  it('accepte une transition valide (draft -> prompt_ready)', () => {
    const run = createRun()

    const updated = repository.updateStatus(run.id, 'prompt_ready')

    expect(updated.status).toBe('prompt_ready')
    expect(updated.completedAt).toBeNull()
  })

  it('refuse une transition invalide (draft -> completed) sans écrire', () => {
    const run = createRun()

    expect(() => repository.updateStatus(run.id, 'completed')).toThrow()
    expect(repository.getById(run.id)?.status).toBe('draft')
  })

  it('renseigne completedAt lors du passage à un statut terminal', () => {
    const run = createRun()
    repository.updateStatus(run.id, 'prompt_ready')
    repository.updateStatus(run.id, 'awaiting_approval')
    const cancelled = repository.updateStatus(run.id, 'cancelled')

    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.completedAt).toMatch(ISO_DATETIME_PATTERN)
  })

  it('lève une erreur pour un run inexistant', () => {
    expect(() => repository.updateStatus(NONEXISTENT_ID, 'prompt_ready')).toThrow()
  })
})

describe('workflowRunsRepository.updateCurrentStepId', () => {
  it('accepte un step appartenant au run', () => {
    const run = createRun()
    const step = stepsRepository.create({ workflowRunId: run.id, type: 'project_and_phase_selection', position: 0 })

    const updated = repository.updateCurrentStepId(run.id, step.id)

    expect(updated.currentStepId).toBe(step.id)
  })

  it('refuse un step appartenant à un autre run', () => {
    const run = createRun()
    const otherRun = createRun()
    const stepOfOtherRun = stepsRepository.create({
      workflowRunId: otherRun.id,
      type: 'project_and_phase_selection',
      position: 0
    })

    expect(() => repository.updateCurrentStepId(run.id, stepOfOtherRun.id)).toThrow()
    expect(repository.getById(run.id)?.currentStepId).toBeNull()
  })

  it('refuse un step inexistant', () => {
    const run = createRun()

    expect(() => repository.updateCurrentStepId(run.id, NONEXISTENT_ID)).toThrow()
  })

  it('accepte la remise à null', () => {
    const run = createRun()
    const step = stepsRepository.create({ workflowRunId: run.id, type: 'project_and_phase_selection', position: 0 })
    repository.updateCurrentStepId(run.id, step.id)

    const updated = repository.updateCurrentStepId(run.id, null)

    expect(updated.currentStepId).toBeNull()
  })
})

describe('workflowRunsRepository — updatedAt (horloge injectée, déterministe)', () => {
  function createClockedRepository(timestamps: string[]) {
    let callIndex = 0
    return createWorkflowRunsRepository(db, { now: () => timestamps[callIndex++] })
  }

  it('updateStatus accepté modifie updatedAt', () => {
    const timestamps = ['2026-01-01T00:00:00.000Z', '2026-01-01T00:00:01.000Z']
    const clockedRepository = createClockedRepository(timestamps)
    const run = clockedRepository.create({
      projectId: project.id,
      phaseId: phase.id,
      profileId: profile.id,
      profileFingerprint: 'fingerprint-1'
    })

    const updated = clockedRepository.updateStatus(run.id, 'prompt_ready')

    expect(run.updatedAt).toBe(timestamps[0])
    expect(updated.updatedAt).toBe(timestamps[1])
    expect(updated.updatedAt).not.toBe(run.updatedAt)
  })

  it('updateStatus refusé conserve updatedAt', () => {
    const timestamps = ['2026-01-01T00:00:00.000Z', '2026-01-01T00:00:01.000Z']
    const clockedRepository = createClockedRepository(timestamps)
    const run = clockedRepository.create({
      projectId: project.id,
      phaseId: phase.id,
      profileId: profile.id,
      profileFingerprint: 'fingerprint-1'
    })

    expect(() => clockedRepository.updateStatus(run.id, 'completed')).toThrow()

    expect(clockedRepository.getById(run.id)?.updatedAt).toBe(run.updatedAt)
  })

  it('updateStatus vers un statut terminal utilise un timestamp unique pour completedAt et updatedAt', () => {
    const timestamps = [
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:01.000Z',
      '2026-01-01T00:00:02.000Z',
      '2026-01-01T00:00:03.000Z'
    ]
    const clockedRepository = createClockedRepository(timestamps)
    const run = clockedRepository.create({
      projectId: project.id,
      phaseId: phase.id,
      profileId: profile.id,
      profileFingerprint: 'fingerprint-1'
    })
    clockedRepository.updateStatus(run.id, 'prompt_ready')
    clockedRepository.updateStatus(run.id, 'awaiting_approval')

    const cancelled = clockedRepository.updateStatus(run.id, 'cancelled')

    expect(cancelled.completedAt).toBe(timestamps[3])
    expect(cancelled.updatedAt).toBe(timestamps[3])
    expect(cancelled.completedAt).toBe(cancelled.updatedAt)
  })

  it('updateCurrentStepId accepté modifie updatedAt', () => {
    const timestamps = ['2026-01-01T00:00:00.000Z', '2026-01-01T00:00:01.000Z']
    const clockedRepository = createClockedRepository(timestamps)
    const run = clockedRepository.create({
      projectId: project.id,
      phaseId: phase.id,
      profileId: profile.id,
      profileFingerprint: 'fingerprint-1'
    })
    const step = stepsRepository.create({ workflowRunId: run.id, type: 'project_and_phase_selection', position: 0 })

    const updated = clockedRepository.updateCurrentStepId(run.id, step.id)

    expect(updated.updatedAt).toBe(timestamps[1])
    expect(updated.updatedAt).not.toBe(run.updatedAt)
  })

  it('updateCurrentStepId refusé conserve updatedAt', () => {
    const timestamps = ['2026-01-01T00:00:00.000Z', '2026-01-01T00:00:01.000Z']
    const clockedRepository = createClockedRepository(timestamps)
    const run = clockedRepository.create({
      projectId: project.id,
      phaseId: phase.id,
      profileId: profile.id,
      profileFingerprint: 'fingerprint-1'
    })

    expect(() => clockedRepository.updateCurrentStepId(run.id, NONEXISTENT_ID)).toThrow()

    expect(clockedRepository.getById(run.id)?.updatedAt).toBe(run.updatedAt)
  })
})
