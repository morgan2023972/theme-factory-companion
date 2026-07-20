import { describe, expect, it } from 'vitest'
import { validationCommandSchema, type WorkflowProfile, workflowProfileSchema } from './workflowProfile'

const VALID_ID = '123e4567-e89b-12d3-a456-426614174000'
const VALID_TIMESTAMP = '2026-07-20T10:00:00.000Z'

const validValidationCommand = {
  name: 'typecheck',
  command: 'npm',
  args: ['run', 'typecheck'],
  blocking: true
}

const validProfile: WorkflowProfile = {
  id: VALID_ID,
  name: 'Electron/TypeScript',
  version: '1.0.0',
  validationCommands: [validValidationCommand],
  createdAt: VALID_TIMESTAMP,
  updatedAt: VALID_TIMESTAMP
}

describe('validationCommandSchema', () => {
  it('accepte une commande de validation valide', () => {
    expect(validationCommandSchema.safeParse(validValidationCommand).success).toBe(true)
  })

  it('refuse un nom vide', () => {
    expect(validationCommandSchema.safeParse({ ...validValidationCommand, name: '' }).success).toBe(false)
  })

  it('refuse un exécutable vide', () => {
    expect(validationCommandSchema.safeParse({ ...validValidationCommand, command: '' }).success).toBe(false)
  })

  it('conserve exécutable et arguments séparément (jamais une chaîne concaténée)', () => {
    const result = validationCommandSchema.safeParse(validValidationCommand)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.command).toBe('npm')
      expect(result.data.args).toEqual(['run', 'typecheck'])
    }
  })

  it('accepte un tableau args vide', () => {
    expect(validationCommandSchema.safeParse({ ...validValidationCommand, args: [] }).success).toBe(true)
  })

  it('refuse args non-tableau', () => {
    expect(
      validationCommandSchema.safeParse({ ...validValidationCommand, args: 'run typecheck' }).success
    ).toBe(false)
  })

  it('refuse l\'absence du champ blocking (aucune valeur par défaut)', () => {
    const { blocking: _blocking, ...rest } = validValidationCommand
    expect(validationCommandSchema.safeParse(rest).success).toBe(false)
  })

  it('refuse blocking non booléen', () => {
    expect(validationCommandSchema.safeParse({ ...validValidationCommand, blocking: 'true' }).success).toBe(false)
  })

  it('accepte blocking: false explicite', () => {
    const result = validationCommandSchema.safeParse({ ...validValidationCommand, blocking: false })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.blocking).toBe(false)
    }
  })

  it('refuse un champ inconnu', () => {
    expect(validationCommandSchema.safeParse({ ...validValidationCommand, unknownField: 'x' }).success).toBe(false)
  })
})

describe('workflowProfileSchema', () => {
  it('accepte un profil complet valide', () => {
    expect(workflowProfileSchema.safeParse(validProfile).success).toBe(true)
  })

  it("refuse un id qui n'est pas un UUID", () => {
    expect(workflowProfileSchema.safeParse({ ...validProfile, id: 'not-a-uuid' }).success).toBe(false)
  })

  it('refuse un nom vide', () => {
    expect(workflowProfileSchema.safeParse({ ...validProfile, name: '' }).success).toBe(false)
  })

  it('refuse une version vide', () => {
    expect(workflowProfileSchema.safeParse({ ...validProfile, version: '' }).success).toBe(false)
  })

  it('accepte un tableau validationCommands vide', () => {
    expect(workflowProfileSchema.safeParse({ ...validProfile, validationCommands: [] }).success).toBe(true)
  })

  it('refuse une commande de validation invalide dans le tableau', () => {
    expect(
      workflowProfileSchema.safeParse({
        ...validProfile,
        validationCommands: [{ ...validValidationCommand, command: '' }]
      }).success
    ).toBe(false)
  })

  it('refuse un createdAt invalide', () => {
    expect(workflowProfileSchema.safeParse({ ...validProfile, createdAt: 'not-a-date' }).success).toBe(false)
  })

  it('refuse un updatedAt invalide', () => {
    expect(workflowProfileSchema.safeParse({ ...validProfile, updatedAt: 'not-a-date' }).success).toBe(false)
  })

  it('refuse un champ obligatoire absent (name)', () => {
    const { name: _name, ...rest } = validProfile
    expect(workflowProfileSchema.safeParse(rest).success).toBe(false)
  })

  it('refuse un champ inconnu', () => {
    expect(workflowProfileSchema.safeParse({ ...validProfile, unknownField: 'x' }).success).toBe(false)
  })

  it("ne permet pas de définir une commande Git ou Claude Code interne (aucun champ ne l'autorise)", () => {
    const keys = Object.keys(workflowProfileSchema.shape)
    expect(keys).not.toContain('gitCommands')
    expect(keys).not.toContain('claudeCodeCommand')
    expect(keys).toEqual(['id', 'name', 'version', 'validationCommands', 'createdAt', 'updatedAt'])
  })
})
