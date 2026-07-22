import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../migrations/runMigrations'
import { closeDatabase, isDatabaseOpen, openDatabase } from '../database'
import { createProjectsRepository } from './projectsRepository'
import { createPhasesRepository } from './phasesRepository'
import { createWorkflowProfilesRepository } from './workflowProfilesRepository'
import { createWorkflowRunsRepository } from './workflowRunsRepository'
import { createWorkflowStepsRepository } from './workflowStepsRepository'
import { createWorkflowArtifactsRepository } from './workflowArtifactsRepository'
import { createWorkflowApprovalsRepository } from './workflowApprovalsRepository'
import { createCommandExecutionsRepository } from './commandExecutionsRepository'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
})

afterEach(() => {
  db.close()
})

describe('repositories de l\'orchestrateur — intégration bout en bout', () => {
  it('crée et relie project -> phase -> workflow_profile -> workflow_run -> workflow_step -> artefact/approbation/exécution', () => {
    const projectsRepository = createProjectsRepository(db)
    const phasesRepository = createPhasesRepository(db)
    const profilesRepository = createWorkflowProfilesRepository(db)
    const runsRepository = createWorkflowRunsRepository(db)
    const stepsRepository = createWorkflowStepsRepository(db)
    const artifactsRepository = createWorkflowArtifactsRepository(db)
    const approvalsRepository = createWorkflowApprovalsRepository(db)
    const commandExecutionsRepository = createCommandExecutionsRepository(db)

    const project = projectsRepository.create({ name: 'Theme Factory Companion' })
    const phase = phasesRepository.create({ projectId: project.id, name: 'Phase 1' })
    const profile = profilesRepository.create({
      name: 'Electron/TypeScript',
      version: '1',
      validationCommands: [
        { name: 'typecheck', command: 'npm', args: ['run', 'typecheck'], blocking: true },
        { name: 'test', command: 'npm', args: ['run', 'test'], blocking: true }
      ]
    })

    const run = runsRepository.create({
      projectId: project.id,
      phaseId: phase.id,
      profileId: profile.id,
      profileFingerprint: profile.version
    })
    expect(run.projectId).toBe(project.id)
    expect(run.phaseId).toBe(phase.id)
    expect(run.profileId).toBe(profile.id)

    const step = stepsRepository.create({ workflowRunId: run.id, type: 'prompt_file_creation', position: 0 })
    expect(step.workflowRunId).toBe(run.id)

    const updatedRun = runsRepository.updateCurrentStepId(run.id, step.id)
    expect(updatedRun.currentStepId).toBe(step.id)

    const artifact = artifactsRepository.create({
      workflowRunId: run.id,
      workflowStepId: step.id,
      type: 'phase_prompt',
      relativePath: 'workflow/prompts/PHASE_1.1_PROMPT.md'
    })
    expect(artifact.workflowRunId).toBe(run.id)
    expect(artifact.workflowStepId).toBe(step.id)

    const approval = approvalsRepository.create({ workflowRunId: run.id, workflowStepId: step.id, type: 'phase_prompt' })
    const decided = approvalsRepository.decide(approval.id, { status: 'approved' })
    expect(decided.status).toBe('approved')
    expect(decided.workflowRunId).toBe(run.id)

    const execution = commandExecutionsRepository.create({
      workflowRunId: run.id,
      workflowStepId: step.id,
      executable: 'npm',
      args: ['run', 'typecheck'],
      cwd: 'C:/repo'
    })
    commandExecutionsRepository.markRunning(execution.id)
    const completedExecution = commandExecutionsRepository.complete(execution.id, {
      status: 'completed',
      exitCode: 0,
      durationMs: 500,
      stdout: 'ok',
      stderr: '',
      stdoutTruncated: false,
      stderrTruncated: false
    })
    expect(completedExecution.status).toBe('completed')
    expect(completedExecution.workflowRunId).toBe(run.id)

    // Le run peut désormais progresser jusqu'à un statut terminal via la
    // machine à états intégrée dans updateStatus (ORCH-1.2 <-> ORCH-2.2).
    const finalRun = runsRepository.updateStatus(run.id, 'prompt_ready')
    expect(finalRun.status).toBe('prompt_ready')

    expect(stepsRepository.listByWorkflowRunId(run.id)).toHaveLength(1)
    expect(artifactsRepository.listByWorkflowRunId(run.id)).toHaveLength(1)
    expect(approvalsRepository.listByWorkflowRunId(run.id)).toHaveLength(1)
    expect(commandExecutionsRepository.listByWorkflowRunId(run.id)).toHaveLength(1)
  })

  it('supprime en cascade toute la chaîne d\'orchestration lors de la suppression du projet', () => {
    const projectsRepository = createProjectsRepository(db)
    const phasesRepository = createPhasesRepository(db)
    const profilesRepository = createWorkflowProfilesRepository(db)
    const runsRepository = createWorkflowRunsRepository(db)
    const stepsRepository = createWorkflowStepsRepository(db)
    const artifactsRepository = createWorkflowArtifactsRepository(db)
    const approvalsRepository = createWorkflowApprovalsRepository(db)
    const commandExecutionsRepository = createCommandExecutionsRepository(db)

    const project = projectsRepository.create({ name: 'Projet de test' })
    const phase = phasesRepository.create({ projectId: project.id, name: 'Phase de test' })
    const profile = profilesRepository.create({ name: 'Profil', version: '1', validationCommands: [] })
    const run = runsRepository.create({
      projectId: project.id,
      phaseId: phase.id,
      profileId: profile.id,
      profileFingerprint: 'fingerprint-1'
    })
    const step = stepsRepository.create({ workflowRunId: run.id, type: 'project_and_phase_selection', position: 0 })
    artifactsRepository.create({
      workflowRunId: run.id,
      workflowStepId: step.id,
      type: 'phase_prompt',
      relativePath: 'workflow/prompts/PHASE_1.1_PROMPT.md'
    })
    approvalsRepository.create({ workflowRunId: run.id, workflowStepId: step.id, type: 'phase_prompt' })
    commandExecutionsRepository.create({
      workflowRunId: run.id,
      workflowStepId: step.id,
      executable: 'npm',
      args: ['run', 'typecheck'],
      cwd: 'C:/repo'
    })

    db.prepare('DELETE FROM projects WHERE id = ?').run(project.id)

    expect(runsRepository.getById(run.id)).toBeNull()
    expect(stepsRepository.listByWorkflowRunId(run.id)).toEqual([])
    expect(artifactsRepository.listByWorkflowRunId(run.id)).toEqual([])
    expect(approvalsRepository.listByWorkflowRunId(run.id)).toEqual([])
    expect(commandExecutionsRepository.listByWorkflowRunId(run.id)).toEqual([])
  })
})

describe('reprise après redémarrage via les repositories (ORCH-2.2.R, M1)', () => {
  let tempDir: string
  let dbPath: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'tfc-orch-reopen-'))
    dbPath = join(tempDir, 'orchestration.sqlite')
  })

  afterEach(() => {
    closeDatabase()
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('conserve les données d\'orchestration et poursuit le workflow à travers une fermeture puis une réouverture réelle, exclusivement via les repositories', () => {
    const first = openDatabase(dbPath)

    const projectsRepository = createProjectsRepository(first)
    const phasesRepository = createPhasesRepository(first)
    const profilesRepository = createWorkflowProfilesRepository(first)
    const runsRepository = createWorkflowRunsRepository(first)
    const stepsRepository = createWorkflowStepsRepository(first)
    const artifactsRepository = createWorkflowArtifactsRepository(first)
    const approvalsRepository = createWorkflowApprovalsRepository(first)
    const commandExecutionsRepository = createCommandExecutionsRepository(first)

    const project = projectsRepository.create({ name: 'Projet de reprise' })
    const phase = phasesRepository.create({ projectId: project.id, name: 'Phase de reprise' })
    const profile = profilesRepository.create({ name: 'Profil de reprise', version: '1', validationCommands: [] })
    const run = runsRepository.create({
      projectId: project.id,
      phaseId: phase.id,
      profileId: profile.id,
      profileFingerprint: 'fingerprint-reprise'
    })
    const firstStep = stepsRepository.create({
      workflowRunId: run.id,
      type: 'project_and_phase_selection',
      position: 0
    })
    const secondStep = stepsRepository.create({ workflowRunId: run.id, type: 'prompt_preparation', position: 1 })
    const artifact = artifactsRepository.create({
      workflowRunId: run.id,
      workflowStepId: firstStep.id,
      type: 'phase_prompt',
      relativePath: 'workflow/prompts/PHASE_1.1_PROMPT.md'
    })
    const approval = approvalsRepository.create({
      workflowRunId: run.id,
      workflowStepId: firstStep.id,
      type: 'phase_prompt'
    })
    const execution = commandExecutionsRepository.create({
      workflowRunId: run.id,
      workflowStepId: firstStep.id,
      executable: 'npm',
      args: ['run', 'typecheck'],
      cwd: 'C:/repo'
    })

    // Au moins une mutation avant fermeture.
    stepsRepository.start(firstStep.id)
    commandExecutionsRepository.markRunning(execution.id)
    runsRepository.updateCurrentStepId(run.id, firstStep.id)

    closeDatabase()
    expect(isDatabaseOpen()).toBe(false)

    let second: Database.Database | undefined
    try {
      // Rouvre exactement le même fichier via le cycle d'ouverture normal
      // (active foreign_keys, réexécute runMigrations() de façon
      // idempotente, exécute le health check).
      second = openDatabase(dbPath)

      // Réinstancie tous les repositories nécessaires avec la nouvelle connexion.
      const reopenedRunsRepository = createWorkflowRunsRepository(second)
      const reopenedStepsRepository = createWorkflowStepsRepository(second)
      const reopenedArtifactsRepository = createWorkflowArtifactsRepository(second)
      const reopenedApprovalsRepository = createWorkflowApprovalsRepository(second)
      const reopenedCommandExecutionsRepository = createCommandExecutionsRepository(second)

      // Les migrations 1 et 2 ne sont pas dupliquées.
      const migrationRows = second.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all() as Array<{
        version: number
      }>
      expect(migrationRows).toEqual([{ version: 1 }, { version: 2 }])

      // Les données antérieures sont conservées, relues exclusivement via les repositories.
      const reloadedRun = reopenedRunsRepository.getById(run.id)
      expect(reloadedRun?.currentStepId).toBe(firstStep.id)
      expect(reloadedRun?.projectId).toBe(project.id)
      expect(reloadedRun?.phaseId).toBe(phase.id)
      expect(reloadedRun?.profileId).toBe(profile.id)
      expect(reloadedRun?.status).toBe('draft')

      const reloadedFirstStep = reopenedStepsRepository.getById(firstStep.id)
      expect(reloadedFirstStep?.status).toBe('in_progress')
      expect(reloadedFirstStep?.workflowRunId).toBe(run.id)

      const reloadedArtifact = reopenedArtifactsRepository.getById(artifact.id)
      expect(reloadedArtifact?.workflowRunId).toBe(run.id)
      expect(reloadedArtifact?.workflowStepId).toBe(firstStep.id)

      const reloadedApproval = reopenedApprovalsRepository.getById(approval.id)
      expect(reloadedApproval?.status).toBe('pending')
      expect(reloadedApproval?.workflowRunId).toBe(run.id)

      const reloadedExecution = reopenedCommandExecutionsRepository.getById(execution.id)
      expect(reloadedExecution?.status).toBe('running')
      expect(reloadedExecution?.workflowRunId).toBe(run.id)

      // Poursuit le workflow après réouverture, exclusivement via les repositories.
      const completedFirstStep = reopenedStepsRepository.complete(firstStep.id, 'completed')
      expect(completedFirstStep.status).toBe('completed')

      const decidedApproval = reopenedApprovalsRepository.decide(approval.id, { status: 'approved' })
      expect(decidedApproval.status).toBe('approved')

      const completedExecution = reopenedCommandExecutionsRepository.complete(execution.id, {
        status: 'completed',
        exitCode: 0,
        durationMs: 250,
        stdout: 'ok',
        stderr: '',
        stdoutTruncated: false,
        stderrTruncated: false
      })
      expect(completedExecution.status).toBe('completed')

      const runWithNewStep = reopenedRunsRepository.updateCurrentStepId(run.id, secondStep.id)
      expect(runWithNewStep.currentStepId).toBe(secondStep.id)

      const transitionedRun = reopenedRunsRepository.updateStatus(run.id, 'prompt_ready')
      expect(transitionedRun.status).toBe('prompt_ready')

      // Vérifie que les nouvelles mutations sont bien persistées et que les
      // relations entre entités restent cohérentes après reprise.
      const finalRun = reopenedRunsRepository.getById(run.id)
      expect(finalRun?.status).toBe('prompt_ready')
      expect(finalRun?.currentStepId).toBe(secondStep.id)

      const finalSteps = reopenedStepsRepository.listByWorkflowRunId(run.id)
      expect(finalSteps.map((s) => s.id).sort()).toEqual([firstStep.id, secondStep.id].sort())
      expect(finalSteps.find((s) => s.id === firstStep.id)?.status).toBe('completed')
      expect(finalSteps.find((s) => s.id === secondStep.id)?.status).toBe('pending')
    } finally {
      closeDatabase()
    }
  })
})
