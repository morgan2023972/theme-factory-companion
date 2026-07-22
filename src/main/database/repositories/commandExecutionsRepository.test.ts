import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../migrations/runMigrations'
import { createProjectsRepository, type ProjectsRepository } from './projectsRepository'
import { createPhasesRepository, type PhasesRepository } from './phasesRepository'
import { createWorkflowProfilesRepository, type WorkflowProfilesRepository } from './workflowProfilesRepository'
import { createWorkflowRunsRepository, type WorkflowRunsRepository } from './workflowRunsRepository'
import { createCommandExecutionsRepository, type CommandExecutionsRepository } from './commandExecutionsRepository'
import type { WorkflowRun } from '../../../shared/orchestration'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/
const NONEXISTENT_ID = '00000000-0000-4000-8000-000000000099'

let db: Database.Database
let repository: CommandExecutionsRepository
let run: WorkflowRun

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db)

  const projectsRepository: ProjectsRepository = createProjectsRepository(db)
  const phasesRepository: PhasesRepository = createPhasesRepository(db)
  const profilesRepository: WorkflowProfilesRepository = createWorkflowProfilesRepository(db)
  const runsRepository: WorkflowRunsRepository = createWorkflowRunsRepository(db)
  repository = createCommandExecutionsRepository(db)

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

function createExecution() {
  return repository.create({
    workflowRunId: run.id,
    workflowStepId: null,
    executable: 'npm',
    args: ['run', 'typecheck'],
    cwd: 'C:/repo'
  })
}

describe('commandExecutionsRepository.create', () => {
  it('crée une exécution en statut pending, champs dérivés à null/vide', () => {
    const execution = createExecution()

    expect(execution.id).toMatch(UUID_PATTERN)
    expect(execution.status).toBe('pending')
    expect(execution.args).toEqual(['run', 'typecheck'])
    expect(execution.exitCode).toBeNull()
    expect(execution.startedAt).toBeNull()
    expect(execution.completedAt).toBeNull()
    expect(execution.durationMs).toBeNull()
    expect(execution.stdout).toBe('')
    expect(execution.stderr).toBe('')
    expect(execution.stdoutTruncated).toBe(false)
    expect(execution.stderrTruncated).toBe(false)
  })

  it('rejette un workflow_run_id inexistant', () => {
    expect(() =>
      repository.create({ workflowRunId: NONEXISTENT_ID, workflowStepId: null, executable: 'npm', args: [], cwd: 'C:/repo' })
    ).toThrow()
  })
})

describe('commandExecutionsRepository.getById / listByWorkflowRunId', () => {
  it('retourne null si l\'exécution est absente', () => {
    expect(repository.getById(NONEXISTENT_ID)).toBeNull()
  })

  it('liste uniquement les exécutions du run demandé', () => {
    const execution = createExecution()

    const ids = repository.listByWorkflowRunId(run.id).map((e) => e.id)
    expect(ids).toEqual([execution.id])
  })
})

describe('commandExecutionsRepository.markRunning', () => {
  it('passe pending à running avec startedAt renseigné', () => {
    const execution = createExecution()

    const running = repository.markRunning(execution.id)

    expect(running.status).toBe('running')
    expect(running.startedAt).toMatch(ISO_DATETIME_PATTERN)
  })

  it('refuse de démarrer une exécution déjà en cours, sans écrire', () => {
    const execution = createExecution()
    repository.markRunning(execution.id)

    expect(() => repository.markRunning(execution.id)).toThrow()
  })
})

describe('commandExecutionsRepository.complete', () => {
  it('complète avec succès (exitCode 0) une exécution running', () => {
    const execution = createExecution()
    repository.markRunning(execution.id)

    const completed = repository.complete(execution.id, {
      status: 'completed',
      exitCode: 0,
      durationMs: 120,
      stdout: 'ok',
      stderr: '',
      stdoutTruncated: false,
      stderrTruncated: false
    })

    expect(completed.status).toBe('completed')
    expect(completed.exitCode).toBe(0)
    expect(completed.durationMs).toBe(120)
    expect(completed.completedAt).toMatch(ISO_DATETIME_PATTERN)
  })

  it('complète en échec (exitCode non nul) une exécution running', () => {
    const execution = createExecution()
    repository.markRunning(execution.id)

    const completed = repository.complete(execution.id, {
      status: 'failed',
      exitCode: 1,
      durationMs: 50,
      stdout: '',
      stderr: 'erreur',
      stdoutTruncated: false,
      stderrTruncated: false
    })

    expect(completed.status).toBe('failed')
    expect(completed.exitCode).toBe(1)
  })

  it('refuse de compléter une exécution encore pending, sans écrire', () => {
    const execution = createExecution()

    expect(() =>
      repository.complete(execution.id, {
        status: 'completed',
        exitCode: 0,
        durationMs: 10,
        stdout: '',
        stderr: '',
        stdoutTruncated: false,
        stderrTruncated: false
      })
    ).toThrow()
    expect(repository.getById(execution.id)?.status).toBe('pending')
  })
})

describe('commandExecutionsRepository — updatedAt (horloge injectée, déterministe)', () => {
  function createClockedRepository(timestamps: string[]) {
    let callIndex = 0
    return createCommandExecutionsRepository(db, { now: () => timestamps[callIndex++] })
  }

  it('markRunning accepté modifie updatedAt, avec startedAt strictement identique à updatedAt', () => {
    const timestamps = ['2026-01-01T00:00:00.000Z', '2026-01-01T00:00:01.000Z']
    const clockedRepository = createClockedRepository(timestamps)
    const execution = clockedRepository.create({
      workflowRunId: run.id,
      workflowStepId: null,
      executable: 'npm',
      args: [],
      cwd: 'C:/repo'
    })

    const running = clockedRepository.markRunning(execution.id)

    expect(running.updatedAt).toBe(timestamps[1])
    expect(running.updatedAt).not.toBe(execution.updatedAt)
    expect(running.startedAt).toBe(running.updatedAt)
  })

  it('markRunning refusé conserve updatedAt', () => {
    const timestamps = ['2026-01-01T00:00:00.000Z', '2026-01-01T00:00:01.000Z']
    const clockedRepository = createClockedRepository(timestamps)
    const execution = clockedRepository.create({
      workflowRunId: run.id,
      workflowStepId: null,
      executable: 'npm',
      args: [],
      cwd: 'C:/repo'
    })
    clockedRepository.markRunning(execution.id)
    const runningOnce = clockedRepository.getById(execution.id)

    expect(() => clockedRepository.markRunning(execution.id)).toThrow()

    expect(clockedRepository.getById(execution.id)?.updatedAt).toBe(runningOnce?.updatedAt)
  })

  it('complete accepté modifie updatedAt, avec completedAt strictement identique à updatedAt', () => {
    const timestamps = ['2026-01-01T00:00:00.000Z', '2026-01-01T00:00:01.000Z', '2026-01-01T00:00:02.000Z']
    const clockedRepository = createClockedRepository(timestamps)
    const execution = clockedRepository.create({
      workflowRunId: run.id,
      workflowStepId: null,
      executable: 'npm',
      args: [],
      cwd: 'C:/repo'
    })
    const running = clockedRepository.markRunning(execution.id)

    const completed = clockedRepository.complete(execution.id, {
      status: 'completed',
      exitCode: 0,
      durationMs: 100,
      stdout: 'ok',
      stderr: '',
      stdoutTruncated: false,
      stderrTruncated: false
    })

    expect(completed.updatedAt).toBe(timestamps[2])
    expect(completed.updatedAt).not.toBe(running.updatedAt)
    expect(completed.completedAt).toBe(completed.updatedAt)
  })

  it('complete refusé (encore pending) conserve updatedAt', () => {
    const timestamps = ['2026-01-01T00:00:00.000Z', '2026-01-01T00:00:01.000Z']
    const clockedRepository = createClockedRepository(timestamps)
    const execution = clockedRepository.create({
      workflowRunId: run.id,
      workflowStepId: null,
      executable: 'npm',
      args: [],
      cwd: 'C:/repo'
    })

    expect(() =>
      clockedRepository.complete(execution.id, {
        status: 'completed',
        exitCode: 0,
        durationMs: 10,
        stdout: '',
        stderr: '',
        stdoutTruncated: false,
        stderrTruncated: false
      })
    ).toThrow()

    expect(clockedRepository.getById(execution.id)?.updatedAt).toBe(execution.updatedAt)
  })
})
