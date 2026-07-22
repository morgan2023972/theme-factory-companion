import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../migrations/runMigrations'
import { createProjectsRepository, type ProjectsRepository } from './projectsRepository'
import { createPhasesRepository, type PhasesRepository } from './phasesRepository'
import { createWorkflowProfilesRepository, type WorkflowProfilesRepository } from './workflowProfilesRepository'
import { createWorkflowRunsRepository, type WorkflowRunsRepository } from './workflowRunsRepository'
import { createWorkflowStepsRepository, type WorkflowStepsRepository } from './workflowStepsRepository'
import { createWorkflowArtifactsRepository, type WorkflowArtifactsRepository } from './workflowArtifactsRepository'
import type { WorkflowRun, WorkflowStep } from '../../../shared/orchestration'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/
const NONEXISTENT_ID = '00000000-0000-4000-8000-000000000099'

let db: Database.Database
let repository: WorkflowArtifactsRepository
let run: WorkflowRun
let step: WorkflowStep

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db)

  const projectsRepository: ProjectsRepository = createProjectsRepository(db)
  const phasesRepository: PhasesRepository = createPhasesRepository(db)
  const profilesRepository: WorkflowProfilesRepository = createWorkflowProfilesRepository(db)
  const runsRepository: WorkflowRunsRepository = createWorkflowRunsRepository(db)
  const stepsRepository: WorkflowStepsRepository = createWorkflowStepsRepository(db)
  repository = createWorkflowArtifactsRepository(db)

  const project = projectsRepository.create({ name: 'Projet de test' })
  const phase = phasesRepository.create({ projectId: project.id, name: 'Phase de test' })
  const profile = profilesRepository.create({ name: 'Profil', version: '1', validationCommands: [] })
  run = runsRepository.create({
    projectId: project.id,
    phaseId: phase.id,
    profileId: profile.id,
    profileFingerprint: 'fingerprint-1'
  })
  step = stepsRepository.create({ workflowRunId: run.id, type: 'prompt_file_creation', position: 0 })
})

afterEach(() => {
  db.close()
})

describe('workflowArtifactsRepository.create', () => {
  it('crée un artefact rattaché à un run et un step', () => {
    const artifact = repository.create({
      workflowRunId: run.id,
      workflowStepId: step.id,
      type: 'phase_prompt',
      relativePath: 'workflow/prompts/PHASE_1.1_PROMPT.md'
    })

    expect(artifact.id).toMatch(UUID_PATTERN)
    expect(artifact.workflowRunId).toBe(run.id)
    expect(artifact.workflowStepId).toBe(step.id)
    expect(artifact.type).toBe('phase_prompt')
    expect(artifact.createdAt).toMatch(ISO_DATETIME_PATTERN)
  })

  it('accepte un workflowStepId à null', () => {
    const artifact = repository.create({
      workflowRunId: run.id,
      workflowStepId: null,
      type: 'validation_report',
      relativePath: 'workflow/reports/RAPPORT.md'
    })

    expect(artifact.workflowStepId).toBeNull()
  })

  it('rejette un chemin absolu', () => {
    expect(() =>
      repository.create({
        workflowRunId: run.id,
        workflowStepId: null,
        type: 'phase_prompt',
        relativePath: 'C:\\Windows\\system.ini'
      })
    ).toThrow()
  })

  it('rejette un workflow_run_id inexistant', () => {
    expect(() =>
      repository.create({
        workflowRunId: NONEXISTENT_ID,
        workflowStepId: null,
        type: 'phase_prompt',
        relativePath: 'workflow/prompts/PHASE_1.1_PROMPT.md'
      })
    ).toThrow()
  })
})

describe('workflowArtifactsRepository.listByWorkflowRunId / getById', () => {
  it('retourne null si l\'artefact est absent', () => {
    expect(repository.getById(NONEXISTENT_ID)).toBeNull()
  })

  it('retourne les artefacts du run, dans l\'ordre de création', () => {
    const timestamps = ['2026-01-01T00:00:00.000Z', '2026-01-01T00:00:01.000Z']
    let callIndex = 0
    const clockedRepository = createWorkflowArtifactsRepository(db, { now: () => timestamps[callIndex++] })

    const first = clockedRepository.create({
      workflowRunId: run.id,
      workflowStepId: null,
      type: 'phase_prompt',
      relativePath: 'workflow/prompts/PHASE_1.1_PROMPT.md'
    })
    const second = clockedRepository.create({
      workflowRunId: run.id,
      workflowStepId: null,
      type: 'phase_report',
      relativePath: 'workflow/reports/RAPPORT_PHASE_1.1.md'
    })

    const ids = repository.listByWorkflowRunId(run.id).map((artifact) => artifact.id)
    expect(ids).toEqual([first.id, second.id])
  })
})
