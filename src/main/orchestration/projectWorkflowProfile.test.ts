import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadWorkflowProfile } from './workflowProfileLoader'
import { computeWorkflowProfileFingerprint } from './workflowProfileFingerprint'

/**
 * Test d'intégration ORCH-3.1.4 : charge et fingerprinte le **vrai** fichier
 * de profil du projet (`workflow/config/project.workflow.json`) via le vrai
 * loader (ORCH-3.1.2) et le vrai calcul d'empreinte (ORCH-3.1.3). Aucun mock
 * du système de fichiers ni du contenu : le fichier réel créé par cette
 * sous-phase est lu tel quel. Aucune commande déclarée par le profil
 * (`npm run typecheck`, `git diff --check`, etc.) n'est exécutée ici : seul
 * le chargement et le fingerprint sont testés.
 */

const PROJECT_WORKFLOW_PROFILE_PATH = join(__dirname, '../../../workflow/config/project.workflow.json')

describe('project.workflow.json (profil réel du projet)', () => {
  it('se charge avec succès via loadWorkflowProfile', () => {
    const profile = loadWorkflowProfile(PROJECT_WORKFLOW_PROFILE_PATH)

    expect(profile.schemaVersion).toBe(1)
    expect(profile.profileKey).toBe('electron-typescript')
    expect(profile.name).toBe('Electron / TypeScript')
    expect(profile.version).toBe('1.0.0')
  })

  it('déclare les 5 commandes de validation attendues, dans le bon ordre', () => {
    const profile = loadWorkflowProfile(PROJECT_WORKFLOW_PROFILE_PATH)

    expect(profile.validationCommands.map((command) => command.key)).toEqual([
      'typecheck',
      'test',
      'build',
      'git-diff-check',
      'git-status-short'
    ])
  })

  it('sépare chaque commande de ses arguments (aucune commande concaténée)', () => {
    const profile = loadWorkflowProfile(PROJECT_WORKFLOW_PROFILE_PATH)

    expect(profile.validationCommands).toEqual([
      expect.objectContaining({ key: 'typecheck', command: 'npm', args: ['run', 'typecheck'], blocking: true }),
      expect.objectContaining({ key: 'test', command: 'npm', args: ['run', 'test'], blocking: true }),
      expect.objectContaining({ key: 'build', command: 'npm', args: ['run', 'build'], blocking: true }),
      expect.objectContaining({
        key: 'git-diff-check',
        command: 'git',
        args: ['diff', '--check'],
        blocking: true
      }),
      expect.objectContaining({
        key: 'git-status-short',
        command: 'git',
        args: ['status', '--short'],
        blocking: true
      })
    ])
  })

  it('déclare artifactPaths vers workflow/prompts et workflow/reports', () => {
    const profile = loadWorkflowProfile(PROJECT_WORKFLOW_PROFILE_PATH)

    expect(profile.artifactPaths).toEqual({
      promptsDirectory: 'workflow/prompts',
      reportsDirectory: 'workflow/reports'
    })
  })

  it('déclare une checklist manuelle non vide', () => {
    const profile = loadWorkflowProfile(PROJECT_WORKFLOW_PROFILE_PATH)

    expect(profile.manualValidationChecklist.length).toBeGreaterThan(0)
  })

  it('produit une empreinte stable au format sha256:<hex> sur des appels répétés', () => {
    const profile = loadWorkflowProfile(PROJECT_WORKFLOW_PROFILE_PATH)

    const first = computeWorkflowProfileFingerprint(profile)
    const second = computeWorkflowProfileFingerprint(profile)

    expect(first).toBe(second)
    expect(first).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  it('produit la même empreinte pour deux chargements indépendants du même fichier', () => {
    const firstLoad = loadWorkflowProfile(PROJECT_WORKFLOW_PROFILE_PATH)
    const secondLoad = loadWorkflowProfile(PROJECT_WORKFLOW_PROFILE_PATH)

    expect(computeWorkflowProfileFingerprint(firstLoad)).toBe(computeWorkflowProfileFingerprint(secondLoad))
  })

  it('produit une empreinte différente pour une modification en mémoire du profil réel (jamais écrite sur disque)', () => {
    const profile = loadWorkflowProfile(PROJECT_WORKFLOW_PROFILE_PATH)

    const mutatedProfile = {
      ...profile,
      validationCommands: [
        { ...profile.validationCommands[0], blocking: !profile.validationCommands[0].blocking },
        ...profile.validationCommands.slice(1)
      ]
    }

    expect(computeWorkflowProfileFingerprint(mutatedProfile)).not.toBe(computeWorkflowProfileFingerprint(profile))
  })

  it('produit une empreinte différente si validationCommands est réordonné', () => {
    const profile = loadWorkflowProfile(PROJECT_WORKFLOW_PROFILE_PATH)

    const reorderedProfile = {
      ...profile,
      validationCommands: [...profile.validationCommands].reverse()
    }

    expect(computeWorkflowProfileFingerprint(reorderedProfile)).not.toBe(computeWorkflowProfileFingerprint(profile))
  })
})
