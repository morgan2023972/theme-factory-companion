import { describe, expect, it } from 'vitest'
import {
  createPhaseSchema,
  PHASE_STATUSES,
  type Phase,
  phaseSchema,
  phaseStatusSchema,
  updatePhaseSchema
} from './phase'

const VALID_ID = '123e4567-e89b-12d3-a456-426614174000'
const VALID_PROJECT_ID = '00000000-0000-4000-8000-000000000001'
const VALID_TIMESTAMP = '2026-07-16T10:00:00.000Z'

const validPhase: Phase = {
  id: VALID_ID,
  projectId: VALID_PROJECT_ID,
  name: 'Phase de test',
  description: null,
  status: 'pending',
  position: 0,
  createdAt: VALID_TIMESTAMP,
  updatedAt: VALID_TIMESTAMP
}

describe('PHASE_STATUSES / phaseStatusSchema', () => {
  it.each(PHASE_STATUSES)('accepte le statut autorisé "%s"', (status) => {
    expect(phaseStatusSchema.safeParse(status).success).toBe(true)
  })

  it('refuse un statut inconnu', () => {
    expect(phaseStatusSchema.safeParse('unknown').success).toBe(false)
  })
})

describe('phaseSchema', () => {
  it('accepte une phase complète valide', () => {
    expect(phaseSchema.safeParse(validPhase).success).toBe(true)
  })

  it('refuse un id de phase qui n\'est pas un UUID', () => {
    expect(phaseSchema.safeParse({ ...validPhase, id: 'not-a-uuid' }).success).toBe(false)
  })

  it('refuse un id de projet qui n\'est pas un UUID', () => {
    expect(phaseSchema.safeParse({ ...validPhase, projectId: 'not-a-uuid' }).success).toBe(false)
  })

  it('refuse un nom vide', () => {
    expect(phaseSchema.safeParse({ ...validPhase, name: '' }).success).toBe(false)
  })

  it('refuse un nom composé uniquement d\'espaces', () => {
    expect(phaseSchema.safeParse({ ...validPhase, name: '   ' }).success).toBe(false)
  })

  it('accepte le champ nullable description à null', () => {
    expect(phaseSchema.safeParse({ ...validPhase, description: null }).success).toBe(true)
  })

  it('accepte le champ nullable description renseigné', () => {
    expect(phaseSchema.safeParse({ ...validPhase, description: 'Une description' }).success).toBe(true)
  })

  it('refuse un statut invalide', () => {
    expect(phaseSchema.safeParse({ ...validPhase, status: 'unknown' }).success).toBe(false)
  })

  it('accepte une position valide (0)', () => {
    expect(phaseSchema.safeParse({ ...validPhase, position: 0 }).success).toBe(true)
  })

  it('refuse une position négative', () => {
    expect(phaseSchema.safeParse({ ...validPhase, position: -1 }).success).toBe(false)
  })

  it('refuse une position non entière', () => {
    expect(phaseSchema.safeParse({ ...validPhase, position: 1.5 }).success).toBe(false)
  })

  it('refuse un createdAt invalide', () => {
    expect(phaseSchema.safeParse({ ...validPhase, createdAt: 'not-a-date' }).success).toBe(false)
  })

  it('refuse un updatedAt invalide', () => {
    expect(phaseSchema.safeParse({ ...validPhase, updatedAt: 'not-a-date' }).success).toBe(false)
  })

  it('refuse un champ obligatoire absent (name)', () => {
    const { name: _name, ...rest } = validPhase
    expect(phaseSchema.safeParse(rest).success).toBe(false)
  })
})

describe('createPhaseSchema', () => {
  it('accepte les données minimales valides', () => {
    const result = createPhaseSchema.safeParse({ projectId: VALID_PROJECT_ID, name: 'Nouvelle phase' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('pending')
      expect(result.data.position).toBeUndefined()
    }
  })

  it('accepte des données complètes valides', () => {
    const result = createPhaseSchema.safeParse({
      projectId: VALID_PROJECT_ID,
      name: 'Nouvelle phase',
      description: 'Description',
      status: 'in_progress',
      position: 3
    })
    expect(result.success).toBe(true)
  })

  it('normalise les espaces autour du nom', () => {
    const result = createPhaseSchema.safeParse({ projectId: VALID_PROJECT_ID, name: '  Phase avec espaces  ' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Phase avec espaces')
    }
  })

  it('refuse un id de projet invalide', () => {
    expect(createPhaseSchema.safeParse({ projectId: 'not-a-uuid', name: 'Phase' }).success).toBe(false)
  })

  it('refuse un nom vide', () => {
    expect(createPhaseSchema.safeParse({ projectId: VALID_PROJECT_ID, name: '' }).success).toBe(false)
  })

  it('refuse un statut invalide', () => {
    expect(
      createPhaseSchema.safeParse({ projectId: VALID_PROJECT_ID, name: 'Phase', status: 'unknown' }).success
    ).toBe(false)
  })

  it('refuse une position négative', () => {
    expect(
      createPhaseSchema.safeParse({ projectId: VALID_PROJECT_ID, name: 'Phase', position: -1 }).success
    ).toBe(false)
  })

  it('accepte null explicite sur description', () => {
    expect(
      createPhaseSchema.safeParse({ projectId: VALID_PROJECT_ID, name: 'Phase', description: null }).success
    ).toBe(true)
  })

  it('refuse les champs techniques non autorisés (id, createdAt, updatedAt)', () => {
    expect(
      createPhaseSchema.safeParse({
        projectId: VALID_PROJECT_ID,
        name: 'Phase',
        id: VALID_ID,
        createdAt: VALID_TIMESTAMP,
        updatedAt: VALID_TIMESTAMP
      }).success
    ).toBe(false)
  })

  it('refuse un champ inconnu', () => {
    expect(
      createPhaseSchema.safeParse({ projectId: VALID_PROJECT_ID, name: 'Phase', unknownField: 'x' }).success
    ).toBe(false)
  })
})

describe('updatePhaseSchema', () => {
  it('accepte une mise à jour partielle valide', () => {
    expect(updatePhaseSchema.safeParse({ name: 'Nouveau nom' }).success).toBe(true)
  })

  it('accepte plusieurs champs valides', () => {
    expect(updatePhaseSchema.safeParse({ name: 'Nouveau nom', status: 'completed' }).success).toBe(true)
  })

  it('accepte de remettre la description à null', () => {
    expect(updatePhaseSchema.safeParse({ description: null }).success).toBe(true)
  })

  it('accepte une modification de position seule', () => {
    expect(updatePhaseSchema.safeParse({ position: 2 }).success).toBe(true)
  })

  it('refuse un objet vide', () => {
    expect(updatePhaseSchema.safeParse({}).success).toBe(false)
  })

  it('refuse un nom vide', () => {
    expect(updatePhaseSchema.safeParse({ name: '' }).success).toBe(false)
  })

  it('refuse un statut invalide', () => {
    expect(updatePhaseSchema.safeParse({ status: 'unknown' }).success).toBe(false)
  })

  it('refuse une position négative', () => {
    expect(updatePhaseSchema.safeParse({ position: -1 }).success).toBe(false)
  })

  it('refuse les champs techniques (id, createdAt, updatedAt)', () => {
    expect(updatePhaseSchema.safeParse({ id: VALID_ID }).success).toBe(false)
    expect(updatePhaseSchema.safeParse({ createdAt: VALID_TIMESTAMP }).success).toBe(false)
    expect(updatePhaseSchema.safeParse({ updatedAt: VALID_TIMESTAMP }).success).toBe(false)
  })

  it('refuse le déplacement vers un autre projet (projectId non modifiable)', () => {
    expect(updatePhaseSchema.safeParse({ projectId: VALID_PROJECT_ID }).success).toBe(false)
  })

  it('refuse un objet ne contenant qu\'une clé explicitement à undefined (équivalent à une mise à jour vide)', () => {
    expect(updatePhaseSchema.safeParse({ description: undefined }).success).toBe(false)
  })

  it('refuse un objet ne contenant que des clés à undefined, même multiples', () => {
    expect(updatePhaseSchema.safeParse({ name: undefined, description: undefined }).success).toBe(false)
  })

  it('accepte toujours { description: null } (null reste une valeur réellement définie)', () => {
    expect(updatePhaseSchema.safeParse({ description: null }).success).toBe(true)
  })

  it('accepte un objet mêlant une clé undefined et une clé réellement définie', () => {
    const result = updatePhaseSchema.safeParse({ name: 'Nouveau nom', description: undefined })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Nouveau nom')
      // La clé reste présente (comportement Zod), mais sa valeur `undefined`
      // doit être ignorée par le repository (voir phasesRepository.update).
      expect(result.data.description).toBeUndefined()
    }
  })
})
