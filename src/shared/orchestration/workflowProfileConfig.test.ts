import { describe, expect, it } from 'vitest'
import {
  workflowArtifactPathsConfigSchema,
  workflowProfileCommandConfigSchema,
  workflowProfileConfigSchema
} from './workflowProfileConfig'

function validCommand(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    key: 'typecheck',
    name: 'Typecheck',
    command: 'npm',
    args: ['run', 'typecheck'],
    blocking: true,
    timeoutMs: 60000,
    ...overrides
  }
}

function validProfile(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    schemaVersion: 1,
    profileKey: 'electron-typescript',
    name: 'Electron / TypeScript',
    version: '1.0.0',
    validationCommands: [validCommand()],
    artifactPaths: {
      promptsDirectory: 'workflow/prompts',
      reportsDirectory: 'workflow/reports'
    },
    manualValidationChecklist: ["L'application démarre sans erreur."],
    ...overrides
  }
}

describe('workflowProfileConfigSchema — cas valides', () => {
  it('accepte un profil minimal complet', () => {
    const result = workflowProfileConfigSchema.safeParse(validProfile())
    expect(result.success).toBe(true)
  })

  it('accepte plusieurs commandes et conserve leur ordre', () => {
    const profile = validProfile({
      validationCommands: [
        validCommand({ key: 'typecheck', name: 'Typecheck' }),
        validCommand({ key: 'test', name: 'Test' }),
        validCommand({ key: 'build', name: 'Build' })
      ]
    })

    const result = workflowProfileConfigSchema.parse(profile)
    expect(result.validationCommands.map((command) => command.key)).toEqual(['typecheck', 'test', 'build'])
  })

  it('accepte une commande avec args vide', () => {
    const profile = validProfile({ validationCommands: [validCommand({ args: [] })] })

    const result = workflowProfileConfigSchema.safeParse(profile)
    expect(result.success).toBe(true)
  })

  it('accepte un timeoutMs exactement à 1000', () => {
    const profile = validProfile({ validationCommands: [validCommand({ timeoutMs: 1000 })] })

    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(true)
  })

  it('accepte un timeoutMs exactement à 1800000', () => {
    const profile = validProfile({ validationCommands: [validCommand({ timeoutMs: 1800000 })] })

    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(true)
  })

  it('accepte les chemins workflow/prompts et workflow/reports', () => {
    const profile = validProfile({
      artifactPaths: { promptsDirectory: 'workflow/prompts', reportsDirectory: 'workflow/reports' }
    })

    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(true)
  })

  it('accepte une checklist de plusieurs éléments', () => {
    const profile = validProfile({
      manualValidationChecklist: [
        "L'application démarre sans erreur.",
        'Aucune erreur dans la console.',
        'Le comportement demandé fonctionne.'
      ]
    })

    const result = workflowProfileConfigSchema.parse(profile)
    expect(result.manualValidationChecklist).toHaveLength(3)
  })
})

describe('workflowProfileConfigSchema — cas invalides', () => {
  it('refuse une propriété inconnue à la racine', () => {
    const profile = { ...validProfile(), extra: 'not allowed' }
    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(false)
  })

  it('refuse une propriété inconnue dans une commande', () => {
    const profile = validProfile({ validationCommands: [{ ...validCommand(), extra: 'not allowed' }] })
    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(false)
  })

  it('refuse un schemaVersion différent de 1', () => {
    const profile = validProfile({ schemaVersion: 2 })
    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(false)
  })

  it('refuse un profileKey vide', () => {
    const profile = validProfile({ profileKey: '' })
    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(false)
  })

  it('refuse un profileKey non kebab-case', () => {
    const profile = validProfile({ profileKey: 'Electron_TypeScript' })
    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(false)
  })

  it('refuse une version vide', () => {
    const profile = validProfile({ version: '' })
    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(false)
  })

  it('refuse une version non SemVer V1', () => {
    const profile = validProfile({ version: '1.0' })
    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(false)
  })

  it('refuse un préfixe v dans la version', () => {
    const profile = validProfile({ version: 'v1.0.0' })
    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(false)
  })

  it('refuse une pré-version', () => {
    const profile = validProfile({ version: '1.0.0-beta.1' })
    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(false)
  })

  it('refuse validationCommands vide', () => {
    const profile = validProfile({ validationCommands: [] })
    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(false)
  })

  it('refuse des clés de commandes dupliquées', () => {
    const profile = validProfile({
      validationCommands: [validCommand({ key: 'typecheck' }), validCommand({ key: 'typecheck', name: 'Autre' })]
    })
    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(false)
  })

  it('refuse une key invalide', () => {
    const profile = validProfile({ validationCommands: [validCommand({ key: 'Type_Check' })] })
    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(false)
  })

  it('refuse un name de commande vide', () => {
    const profile = validProfile({ validationCommands: [validCommand({ name: '' })] })
    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(false)
  })

  it('refuse un command vide', () => {
    const profile = validProfile({ validationCommands: [validCommand({ command: '' })] })
    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(false)
  })

  it('refuse un command contenant des espaces', () => {
    const profile = validProfile({ validationCommands: [validCommand({ command: 'npm run typecheck' })] })
    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(false)
  })

  it('refuse un command contenant un opérateur shell', () => {
    const profile = validProfile({ validationCommands: [validCommand({ command: 'npm&&rm' })] })
    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(false)
  })

  it('refuse un argument vide', () => {
    const profile = validProfile({ validationCommands: [validCommand({ args: ['run', ''] })] })
    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(false)
  })

  it('refuse blocking absent', () => {
    const command = validCommand() as Record<string, unknown>
    delete command.blocking
    const profile = validProfile({ validationCommands: [command] })
    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(false)
  })

  it('refuse timeoutMs absent', () => {
    const command = validCommand() as Record<string, unknown>
    delete command.timeoutMs
    const profile = validProfile({ validationCommands: [command] })
    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(false)
  })

  it('refuse un timeoutMs non entier', () => {
    const profile = validProfile({ validationCommands: [validCommand({ timeoutMs: 1500.5 })] })
    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(false)
  })

  it('refuse un timeoutMs inférieur à 1000', () => {
    const profile = validProfile({ validationCommands: [validCommand({ timeoutMs: 999 })] })
    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(false)
  })

  it('refuse un timeoutMs supérieur à 1800000', () => {
    const profile = validProfile({ validationCommands: [validCommand({ timeoutMs: 1800001 })] })
    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(false)
  })

  it('refuse un chemin absolu Unix', () => {
    const profile = validProfile({ artifactPaths: { promptsDirectory: '/workflow/prompts', reportsDirectory: 'workflow/reports' } })
    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(false)
  })

  it('refuse un chemin absolu Windows (lettre de lecteur)', () => {
    const profile = validProfile({
      artifactPaths: { promptsDirectory: 'C:/workflow/prompts', reportsDirectory: 'workflow/reports' }
    })
    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(false)
  })

  it('refuse un chemin UNC', () => {
    const profile = validProfile({
      artifactPaths: { promptsDirectory: '\\\\server\\share\\prompts', reportsDirectory: 'workflow/reports' }
    })
    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(false)
  })

  it('refuse un chemin contenant ..', () => {
    const profile = validProfile({
      artifactPaths: { promptsDirectory: 'workflow/../prompts', reportsDirectory: 'workflow/reports' }
    })
    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(false)
  })

  it('refuse un chemin contenant . comme segment', () => {
    const profile = validProfile({
      artifactPaths: { promptsDirectory: 'workflow/./prompts', reportsDirectory: 'workflow/reports' }
    })
    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(false)
  })

  it('refuse un chemin contenant un backslash', () => {
    const profile = validProfile({
      artifactPaths: { promptsDirectory: 'workflow\\prompts', reportsDirectory: 'workflow/reports' }
    })
    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(false)
  })

  it('refuse un chemin commençant par /', () => {
    const profile = validProfile({
      artifactPaths: { promptsDirectory: '/workflow/prompts', reportsDirectory: 'workflow/reports' }
    })
    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(false)
  })

  it('refuse un chemin finissant par /', () => {
    const profile = validProfile({
      artifactPaths: { promptsDirectory: 'workflow/prompts/', reportsDirectory: 'workflow/reports' }
    })
    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(false)
  })

  it('refuse une checklist vide', () => {
    const profile = validProfile({ manualValidationChecklist: [] })
    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(false)
  })

  it('refuse un élément de checklist vide', () => {
    const profile = validProfile({ manualValidationChecklist: ['Élément valide', '   '] })
    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(false)
  })

  it('refuse un doublon de checklist après trim', () => {
    const profile = validProfile({
      manualValidationChecklist: ['Élément', '  Élément  ']
    })
    expect(workflowProfileConfigSchema.safeParse(profile).success).toBe(false)
  })
})

describe('workflowProfileCommandConfigSchema — schéma isolé', () => {
  it('accepte une commande valide isolément', () => {
    expect(workflowProfileCommandConfigSchema.safeParse(validCommand()).success).toBe(true)
  })

  it('rejette un champ position, absent du contrat de configuration', () => {
    const command = { ...validCommand(), position: 0 }
    expect(workflowProfileCommandConfigSchema.safeParse(command).success).toBe(false)
  })
})

describe('workflowArtifactPathsConfigSchema — schéma isolé', () => {
  it('accepte des chemins valides isolément', () => {
    const result = workflowArtifactPathsConfigSchema.safeParse({
      promptsDirectory: 'workflow/prompts',
      reportsDirectory: 'workflow/reports'
    })
    expect(result.success).toBe(true)
  })

  it('rejette une propriété inconnue', () => {
    const result = workflowArtifactPathsConfigSchema.safeParse({
      promptsDirectory: 'workflow/prompts',
      reportsDirectory: 'workflow/reports',
      extra: 'not allowed'
    })
    expect(result.success).toBe(false)
  })
})
