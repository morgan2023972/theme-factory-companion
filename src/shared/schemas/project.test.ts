import { describe, expect, it } from 'vitest'
import {
  createProjectSchema,
  PROJECT_STATUSES,
  Project,
  projectSchema,
  projectStatusSchema,
  updateProjectSchema
} from './project'

const VALID_ID = '123e4567-e89b-12d3-a456-426614174000'
const VALID_TIMESTAMP = '2026-07-16T10:00:00.000Z'

const validProject: Project = {
  id: VALID_ID,
  name: 'Projet de test',
  description: null,
  objective: null,
  status: 'planning',
  repositoryPath: null,
  targetTechnology: null,
  notes: null,
  createdAt: VALID_TIMESTAMP,
  updatedAt: VALID_TIMESTAMP
}

describe('PROJECT_STATUSES / projectStatusSchema', () => {
  it.each(PROJECT_STATUSES)('accepte le statut autorisé "%s"', (status) => {
    expect(projectStatusSchema.safeParse(status).success).toBe(true)
  })

  it('refuse un statut inconnu', () => {
    expect(projectStatusSchema.safeParse('unknown').success).toBe(false)
  })
})

describe('projectSchema', () => {
  it('accepte un projet complet valide', () => {
    expect(projectSchema.safeParse(validProject).success).toBe(true)
  })

  it('accepte les champs nullable renseignés', () => {
    const result = projectSchema.safeParse({
      ...validProject,
      description: 'Description',
      objective: 'Objectif',
      repositoryPath: '/repo',
      targetTechnology: 'React',
      notes: 'Notes'
    })
    expect(result.success).toBe(true)
  })

  it('refuse un id qui n\'est pas un UUID', () => {
    expect(projectSchema.safeParse({ ...validProject, id: 'not-a-uuid' }).success).toBe(false)
  })

  it('refuse un createdAt invalide', () => {
    expect(projectSchema.safeParse({ ...validProject, createdAt: 'not-a-date' }).success).toBe(false)
  })

  it('refuse un updatedAt invalide', () => {
    expect(projectSchema.safeParse({ ...validProject, updatedAt: 'not-a-date' }).success).toBe(false)
  })

  it('refuse un statut invalide', () => {
    expect(projectSchema.safeParse({ ...validProject, status: 'unknown' }).success).toBe(false)
  })

  it('refuse null sur un champ non nullable (name)', () => {
    expect(projectSchema.safeParse({ ...validProject, name: null }).success).toBe(false)
  })

  it('refuse un champ obligatoire absent (name)', () => {
    const { name: _name, ...rest } = validProject
    expect(projectSchema.safeParse(rest).success).toBe(false)
  })

  it('refuse un nom vide ou composé uniquement d\'espaces', () => {
    expect(projectSchema.safeParse({ ...validProject, name: '   ' }).success).toBe(false)
  })
})

describe('createProjectSchema', () => {
  it('accepte les données minimales valides', () => {
    const result = createProjectSchema.safeParse({ name: 'Nouveau projet' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('planning')
    }
  })

  it('accepte des données complètes valides', () => {
    const result = createProjectSchema.safeParse({
      name: 'Nouveau projet',
      description: 'Description',
      objective: 'Objectif',
      status: 'active',
      repositoryPath: '/repo',
      targetTechnology: 'React',
      notes: 'Notes'
    })
    expect(result.success).toBe(true)
  })

  it('normalise les espaces autour du nom', () => {
    const result = createProjectSchema.safeParse({ name: '  Projet avec espaces  ' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Projet avec espaces')
    }
  })

  it('refuse un nom vide', () => {
    expect(createProjectSchema.safeParse({ name: '' }).success).toBe(false)
  })

  it('refuse un nom composé uniquement d\'espaces', () => {
    expect(createProjectSchema.safeParse({ name: '   ' }).success).toBe(false)
  })

  it('refuse un statut invalide', () => {
    expect(createProjectSchema.safeParse({ name: 'Projet', status: 'unknown' }).success).toBe(false)
  })

  it('accepte null explicite sur un champ nullable', () => {
    expect(createProjectSchema.safeParse({ name: 'Projet', description: null }).success).toBe(true)
  })

  it('refuse les champs techniques non autorisés (id, createdAt, updatedAt)', () => {
    expect(
      createProjectSchema.safeParse({
        name: 'Projet',
        id: VALID_ID,
        createdAt: VALID_TIMESTAMP,
        updatedAt: VALID_TIMESTAMP
      }).success
    ).toBe(false)
  })

  it('refuse un champ inconnu', () => {
    expect(createProjectSchema.safeParse({ name: 'Projet', unknownField: 'x' }).success).toBe(false)
  })
})

describe('updateProjectSchema', () => {
  it('accepte une mise à jour partielle valide', () => {
    expect(updateProjectSchema.safeParse({ name: 'Nouveau nom' }).success).toBe(true)
  })

  it('accepte plusieurs champs valides', () => {
    expect(updateProjectSchema.safeParse({ name: 'Nouveau nom', status: 'active' }).success).toBe(true)
  })

  it('refuse un objet vide', () => {
    expect(updateProjectSchema.safeParse({}).success).toBe(false)
  })

  it('refuse un nom vide', () => {
    expect(updateProjectSchema.safeParse({ name: '' }).success).toBe(false)
  })

  it('refuse un statut invalide', () => {
    expect(updateProjectSchema.safeParse({ status: 'unknown' }).success).toBe(false)
  })

  it('refuse les champs techniques (id, createdAt, updatedAt)', () => {
    expect(updateProjectSchema.safeParse({ id: VALID_ID }).success).toBe(false)
    expect(updateProjectSchema.safeParse({ createdAt: VALID_TIMESTAMP }).success).toBe(false)
    expect(updateProjectSchema.safeParse({ updatedAt: VALID_TIMESTAMP }).success).toBe(false)
  })

  it('accepte de remettre un champ nullable à null', () => {
    expect(updateProjectSchema.safeParse({ description: null }).success).toBe(true)
  })

  it('refuse un objet ne contenant qu\'une clé explicitement à undefined (équivalent à une mise à jour vide)', () => {
    expect(updateProjectSchema.safeParse({ description: undefined }).success).toBe(false)
  })

  it('refuse un objet ne contenant que des clés à undefined, même multiples', () => {
    expect(updateProjectSchema.safeParse({ name: undefined, description: undefined }).success).toBe(false)
  })

  it('accepte toujours { description: null } (null reste une valeur réellement définie)', () => {
    expect(updateProjectSchema.safeParse({ description: null }).success).toBe(true)
  })

  it('accepte un objet mêlant une clé undefined et une clé réellement définie', () => {
    const result = updateProjectSchema.safeParse({ name: 'Nouveau nom', description: undefined })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Nouveau nom')
      expect(result.data.description).toBeUndefined()
    }
  })
})
