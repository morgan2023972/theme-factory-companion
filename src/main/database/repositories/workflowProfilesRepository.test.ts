import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../migrations/runMigrations'
import { createWorkflowProfilesRepository, type WorkflowProfilesRepository } from './workflowProfilesRepository'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/
const NONEXISTENT_ID = '00000000-0000-4000-8000-000000000099'

let db: Database.Database
let repository: WorkflowProfilesRepository

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  repository = createWorkflowProfilesRepository(db)
})

afterEach(() => {
  db.close()
})

describe('workflowProfilesRepository.create', () => {
  it('crée un profil sans commande de validation', () => {
    const profile = repository.create({ name: 'Electron/TypeScript', version: '1', validationCommands: [] })

    expect(profile.id).toMatch(UUID_PATTERN)
    expect(profile.name).toBe('Electron/TypeScript')
    expect(profile.version).toBe('1')
    expect(profile.validationCommands).toEqual([])
    expect(profile.createdAt).toMatch(ISO_DATETIME_PATTERN)
    expect(profile.updatedAt).toMatch(ISO_DATETIME_PATTERN)
  })

  it('conserve fidèlement l\'ordre des commandes de validation fournies', () => {
    const profile = repository.create({
      name: 'Electron/TypeScript',
      version: '1',
      validationCommands: [
        { name: 'typecheck', command: 'npm', args: ['run', 'typecheck'], blocking: true },
        { name: 'test', command: 'npm', args: ['run', 'test'], blocking: true },
        { name: 'lint', command: 'npm', args: ['run', 'lint'], blocking: false }
      ]
    })

    expect(profile.validationCommands.map((command) => command.name)).toEqual(['typecheck', 'test', 'lint'])
    expect(profile.validationCommands[2]).toEqual({
      name: 'lint',
      command: 'npm',
      args: ['run', 'lint'],
      blocking: false
    })
  })

  it('rejette un profil sans nom', () => {
    expect(() => repository.create({ name: '', version: '1', validationCommands: [] } as never)).toThrow()
  })
})

describe('workflowProfilesRepository.getById', () => {
  it('retourne null si le profil est absent', () => {
    expect(repository.getById(NONEXISTENT_ID)).toBeNull()
  })

  it('retourne le profil avec ses commandes de validation triées par position', () => {
    const created = repository.create({
      name: 'Profil',
      version: '1',
      validationCommands: [
        { name: 'a', command: 'npm', args: [], blocking: true },
        { name: 'b', command: 'npm', args: [], blocking: true }
      ]
    })

    const found = repository.getById(created.id)
    expect(found).toEqual(created)
  })
})

describe('workflowProfilesRepository.list', () => {
  it('retourne un tableau vide en l\'absence de profil', () => {
    expect(repository.list()).toEqual([])
  })

  it('retourne tous les profils, du plus récent au plus ancien', () => {
    const timestamps = ['2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z']
    let callIndex = 0
    const clockedRepository = createWorkflowProfilesRepository(db, { now: () => timestamps[callIndex++] })

    const first = clockedRepository.create({ name: 'Premier', version: '1', validationCommands: [] })
    const second = clockedRepository.create({ name: 'Second', version: '1', validationCommands: [] })

    const ids = clockedRepository.list().map((profile) => profile.id)
    expect(ids).toEqual([second.id, first.id])
  })
})
