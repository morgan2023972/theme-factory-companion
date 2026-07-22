import { describe, expect, it } from 'vitest'
import type { WorkflowProfileConfig } from '../../shared/orchestration'
import { computeWorkflowProfileFingerprint } from './workflowProfileFingerprint'

function buildConfig(overrides: Partial<WorkflowProfileConfig> = {}): WorkflowProfileConfig {
  return {
    schemaVersion: 1,
    profileKey: 'electron-typescript',
    name: 'Electron TypeScript',
    version: '1.0.0',
    validationCommands: [
      {
        key: 'typecheck',
        name: 'Typecheck',
        command: 'npm',
        args: ['run', 'typecheck'],
        blocking: true,
        timeoutMs: 60000
      },
      {
        key: 'test',
        name: 'Tests',
        command: 'npx',
        args: ['vitest', 'run'],
        blocking: true,
        timeoutMs: 120000
      }
    ],
    artifactPaths: {
      promptsDirectory: 'workflow/prompts',
      reportsDirectory: 'workflow/reports'
    },
    manualValidationChecklist: ['Relire le diff', 'Vérifier git status'],
    ...overrides
  }
}

const SHA256_FINGERPRINT_PATTERN = /^sha256:[0-9a-f]{64}$/

describe('computeWorkflowProfileFingerprint', () => {
  it('produit la même empreinte pour deux objets JS distincts mais équivalents', () => {
    const configA = buildConfig()
    const configB = buildConfig()

    expect(configA).not.toBe(configB)
    expect(computeWorkflowProfileFingerprint(configA)).toBe(computeWorkflowProfileFingerprint(configB))
  })

  it("ignore l'ordre de déclaration des clés d'un objet imbriqué", () => {
    const configA = buildConfig()
    const configB = buildConfig({
      artifactPaths: {
        reportsDirectory: 'workflow/reports',
        promptsDirectory: 'workflow/prompts'
      }
    })

    expect(computeWorkflowProfileFingerprint(configA)).toBe(computeWorkflowProfileFingerprint(configB))
  })

  it('est stable sur des appels répétés pour le même objet', () => {
    const config = buildConfig()

    const first = computeWorkflowProfileFingerprint(config)
    const second = computeWorkflowProfileFingerprint(config)
    const third = computeWorkflowProfileFingerprint(config)

    expect(first).toBe(second)
    expect(second).toBe(third)
  })

  it('change quand un champ scalaire change (version)', () => {
    const configA = buildConfig()
    const configB = buildConfig({ version: '1.0.1' })

    expect(computeWorkflowProfileFingerprint(configA)).not.toBe(computeWorkflowProfileFingerprint(configB))
  })

  it('change quand un champ scalaire imbriqué change (blocking d’une commande)', () => {
    const configA = buildConfig()
    const configB = buildConfig({
      validationCommands: [
        { ...configA.validationCommands[0], blocking: false },
        configA.validationCommands[1]
      ]
    })

    expect(computeWorkflowProfileFingerprint(configA)).not.toBe(computeWorkflowProfileFingerprint(configB))
  })

  it("change quand l'ordre de validationCommands change", () => {
    const configA = buildConfig()
    const configB = buildConfig({
      validationCommands: [...configA.validationCommands].reverse()
    })

    expect(computeWorkflowProfileFingerprint(configA)).not.toBe(computeWorkflowProfileFingerprint(configB))
  })

  it("change quand l'ordre de manualValidationChecklist change", () => {
    const configA = buildConfig()
    const configB = buildConfig({
      manualValidationChecklist: [...configA.manualValidationChecklist].reverse()
    })

    expect(computeWorkflowProfileFingerprint(configA)).not.toBe(computeWorkflowProfileFingerprint(configB))
  })

  it('retourne le format attendu : préfixe sha256: suivi de 64 caractères hexadécimaux minuscules', () => {
    const fingerprint = computeWorkflowProfileFingerprint(buildConfig())

    expect(fingerprint).toMatch(SHA256_FINGERPRINT_PATTERN)
  })

  it("ne mute pas l'objet config reçu en paramètre", () => {
    const config = buildConfig()
    const snapshot = JSON.parse(JSON.stringify(config))

    computeWorkflowProfileFingerprint(config)

    expect(config).toEqual(snapshot)
  })
})
