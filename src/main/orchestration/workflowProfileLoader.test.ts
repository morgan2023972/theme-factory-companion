import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import { WorkflowProfileLoadError, loadWorkflowProfile } from './workflowProfileLoader'

const MINIMAL_PROFILE = {
  schemaVersion: 1,
  profileKey: 'electron-typescript',
  name: 'Electron / TypeScript',
  version: '1.0.0',
  validationCommands: [
    { key: 'typecheck', name: 'Typecheck', command: 'npm', args: ['run', 'typecheck'], blocking: true, timeoutMs: 60000 }
  ],
  artifactPaths: { promptsDirectory: 'workflow/prompts', reportsDirectory: 'workflow/reports' },
  manualValidationChecklist: ["L'application démarre sans erreur."]
}

const COMPLETE_PROFILE = {
  schemaVersion: 1,
  profileKey: 'electron-typescript',
  name: 'Electron / TypeScript',
  version: '1.0.0',
  validationCommands: [
    { key: 'typecheck', name: 'Typecheck', command: 'npm', args: ['run', 'typecheck'], blocking: true, timeoutMs: 60000 },
    { key: 'test', name: 'Test', command: 'npm', args: ['run', 'test'], blocking: true, timeoutMs: 120000 },
    { key: 'build', name: 'Build', command: 'npm', args: [], blocking: false, timeoutMs: 180000 }
  ],
  artifactPaths: { promptsDirectory: 'workflow/prompts', reportsDirectory: 'workflow/reports' },
  manualValidationChecklist: [
    "L'application démarre sans erreur.",
    'Aucune erreur dans la console.',
    'Le comportement demandé fonctionne.'
  ]
}

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'tfc-workflow-profile-loader-'))
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

function writeProfileFile(fileName: string, content: string): string {
  const filePath = join(tempDir, fileName)
  writeFileSync(filePath, content, 'utf8')
  return filePath
}

describe('loadWorkflowProfile — cas valides', () => {
  it('charge un profil minimal valide', () => {
    const filePath = writeProfileFile('minimal.json', JSON.stringify(MINIMAL_PROFILE))

    const profile = loadWorkflowProfile(filePath)

    expect(profile.profileKey).toBe('electron-typescript')
    expect(profile.validationCommands).toHaveLength(1)
  })

  it('charge un profil complet valide', () => {
    const filePath = writeProfileFile('complete.json', JSON.stringify(COMPLETE_PROFILE))

    const profile = loadWorkflowProfile(filePath)

    expect(profile.validationCommands).toHaveLength(3)
    expect(profile.manualValidationChecklist).toHaveLength(3)
  })

  it('préserve l\'ordre des validationCommands', () => {
    const filePath = writeProfileFile('order.json', JSON.stringify(COMPLETE_PROFILE))

    const profile = loadWorkflowProfile(filePath)

    expect(profile.validationCommands.map((command) => command.key)).toEqual(['typecheck', 'test', 'build'])
  })

  it('préserve les args et la checklist', () => {
    const filePath = writeProfileFile('args-checklist.json', JSON.stringify(COMPLETE_PROFILE))

    const profile = loadWorkflowProfile(filePath)

    expect(profile.validationCommands[0].args).toEqual(['run', 'typecheck'])
    expect(profile.validationCommands[2].args).toEqual([])
    expect(profile.manualValidationChecklist).toEqual([
      "L'application démarre sans erreur.",
      'Aucune erreur dans la console.',
      'Le comportement demandé fonctionne.'
    ])
  })

  it('accepte un fichier UTF-8 avec des espaces et retours à la ligne autour du JSON', () => {
    const filePath = writeProfileFile('padded.json', `\n\n  ${JSON.stringify(MINIMAL_PROFILE)}  \n\t\n`)

    const profile = loadWorkflowProfile(filePath)

    expect(profile.profileKey).toBe('electron-typescript')
  })
})

describe('loadWorkflowProfile — entrée filePath', () => {
  it('refuse une chaîne vide', () => {
    expect(() => loadWorkflowProfile('')).toThrow(WorkflowProfileLoadError)
    try {
      loadWorkflowProfile('')
    } catch (error) {
      expect((error as WorkflowProfileLoadError).code).toBe('FILE_NOT_FOUND')
    }
  })

  it('refuse une chaîne contenant uniquement des espaces', () => {
    expect(() => loadWorkflowProfile('   ')).toThrow(WorkflowProfileLoadError)
    try {
      loadWorkflowProfile('   ')
    } catch (error) {
      expect((error as WorkflowProfileLoadError).code).toBe('FILE_NOT_FOUND')
    }
  })

  it('ne modifie pas silencieusement le chemin fourni (conservé tel quel dans l\'erreur)', () => {
    const paddedPath = '   '
    try {
      loadWorkflowProfile(paddedPath)
      expect.fail('devrait avoir levé une erreur')
    } catch (error) {
      expect((error as WorkflowProfileLoadError).filePath).toBe(paddedPath)
    }
  })
})

describe('loadWorkflowProfile — erreurs de lecture', () => {
  it('lève FILE_NOT_FOUND pour un fichier absent', () => {
    const filePath = join(tempDir, 'absent.json')

    expect(() => loadWorkflowProfile(filePath)).toThrow(WorkflowProfileLoadError)
    try {
      loadWorkflowProfile(filePath)
    } catch (error) {
      const loadError = error as WorkflowProfileLoadError
      expect(loadError.code).toBe('FILE_NOT_FOUND')
      expect(loadError.filePath).toBe(filePath)
      expect(loadError.cause).toBeDefined()
    }
  })

  it('lève FILE_NOT_READABLE pour un chemin pointant vers un répertoire', () => {
    const directoryPath = join(tempDir, 'a-directory')
    mkdirSync(directoryPath)

    expect(() => loadWorkflowProfile(directoryPath)).toThrow(WorkflowProfileLoadError)
    try {
      loadWorkflowProfile(directoryPath)
    } catch (error) {
      const loadError = error as WorkflowProfileLoadError
      expect(loadError.code).toBe('FILE_NOT_READABLE')
      expect(loadError.filePath).toBe(directoryPath)
      expect(loadError.cause).toBeDefined()
    }
  })
})

describe('loadWorkflowProfile — erreurs de contenu', () => {
  it('lève EMPTY_FILE pour un fichier vide', () => {
    const filePath = writeProfileFile('empty.json', '')

    expect(() => loadWorkflowProfile(filePath)).toThrow(WorkflowProfileLoadError)
    try {
      loadWorkflowProfile(filePath)
    } catch (error) {
      expect((error as WorkflowProfileLoadError).code).toBe('EMPTY_FILE')
    }
  })

  it('lève EMPTY_FILE pour un fichier composé uniquement d\'espaces', () => {
    const filePath = writeProfileFile('blank.json', '   \n\t\n  ')

    try {
      loadWorkflowProfile(filePath)
      expect.fail('devrait avoir levé une erreur')
    } catch (error) {
      expect((error as WorkflowProfileLoadError).code).toBe('EMPTY_FILE')
    }
  })

  it('lève INVALID_JSON avec une SyntaxError conservée en cause', () => {
    const filePath = writeProfileFile('invalid.json', '{ this is not valid json')

    try {
      loadWorkflowProfile(filePath)
      expect.fail('devrait avoir levé une erreur')
    } catch (error) {
      const loadError = error as WorkflowProfileLoadError
      expect(loadError.code).toBe('INVALID_JSON')
      expect(loadError.cause).toBeInstanceOf(SyntaxError)
    }
  })

  it('lève INVALID_PROFILE pour un JSON valide mais un objet incomplet, avec une ZodError conservée en cause', () => {
    const filePath = writeProfileFile('missing-field.json', JSON.stringify({ schemaVersion: 1 }))

    try {
      loadWorkflowProfile(filePath)
      expect.fail('devrait avoir levé une erreur')
    } catch (error) {
      const loadError = error as WorkflowProfileLoadError
      expect(loadError.code).toBe('INVALID_PROFILE')
      expect(loadError.cause).toBeInstanceOf(ZodError)
    }
  })

  it('lève INVALID_PROFILE pour une propriété inconnue à la racine', () => {
    const filePath = writeProfileFile('unknown-root-prop.json', JSON.stringify({ ...MINIMAL_PROFILE, extra: true }))

    try {
      loadWorkflowProfile(filePath)
      expect.fail('devrait avoir levé une erreur')
    } catch (error) {
      expect((error as WorkflowProfileLoadError).code).toBe('INVALID_PROFILE')
    }
  })

  it('lève INVALID_PROFILE pour une commande de validation invalide', () => {
    const invalidProfile = {
      ...MINIMAL_PROFILE,
      validationCommands: [{ ...MINIMAL_PROFILE.validationCommands[0], command: 'npm run typecheck' }]
    }
    const filePath = writeProfileFile('invalid-command.json', JSON.stringify(invalidProfile))

    try {
      loadWorkflowProfile(filePath)
      expect.fail('devrait avoir levé une erreur')
    } catch (error) {
      expect((error as WorkflowProfileLoadError).code).toBe('INVALID_PROFILE')
    }
  })
})

describe('loadWorkflowProfile — forme de l\'erreur', () => {
  it('lève une WorkflowProfileLoadError avec name, code et message explicites', () => {
    const filePath = join(tempDir, 'absent-for-shape-check.json')

    try {
      loadWorkflowProfile(filePath)
      expect.fail('devrait avoir levé une erreur')
    } catch (error) {
      expect(error).toBeInstanceOf(WorkflowProfileLoadError)
      expect(error).toBeInstanceOf(Error)
      const loadError = error as WorkflowProfileLoadError
      expect(loadError.name).toBe('WorkflowProfileLoadError')
      expect(loadError.code).toBe('FILE_NOT_FOUND')
      expect(loadError.message.length).toBeGreaterThan(0)
      expect(loadError.message).toContain(filePath)
    }
  })
})
