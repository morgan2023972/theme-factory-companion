import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../migrations/runMigrations'
import { createProjectsRepository, type ProjectsRepository } from './projectsRepository'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/

let db: Database.Database
let repository: ProjectsRepository

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  repository = createProjectsRepository(db)
})

afterEach(() => {
  db.close()
})

describe('projectsRepository.list', () => {
  it('retourne un tableau vide sur une base vide', () => {
    expect(repository.list()).toEqual([])
  })

  it('retourne plusieurs projets', () => {
    repository.create({ name: 'Projet A' })
    repository.create({ name: 'Projet B' })

    expect(repository.list()).toHaveLength(2)
  })

  it('retourne les projets dans un ordre déterministe (created_at DESC)', () => {
    const timestamps = ['2026-01-01T00:00:00.000Z', '2026-01-01T00:00:01.000Z']
    let callIndex = 0
    const clockedRepository = createProjectsRepository(db, {
      now: () => timestamps[callIndex++]
    })

    const first = clockedRepository.create({ name: 'Premier' })
    const second = clockedRepository.create({ name: 'Deuxième' })

    const ids = clockedRepository.list().map((project) => project.id)
    expect(ids[0]).toBe(second.id)
    expect(ids[1]).toBe(first.id)
  })

  it('utilise id DESC comme critère de tri secondaire quand created_at est identique', () => {
    const sameTimestamp = '2026-01-01T00:00:00.000Z'
    const lowerId = '00000000-0000-4000-8000-000000000001'
    const higherId = '00000000-0000-4000-8000-000000000002'

    const insertRow = db.prepare(
      `INSERT INTO projects (id, name, status, created_at, updated_at)
       VALUES (@id, @name, @status, @created_at, @updated_at)`
    )
    insertRow.run({
      id: lowerId,
      name: 'Projet id bas',
      status: 'planning',
      created_at: sameTimestamp,
      updated_at: sameTimestamp
    })
    insertRow.run({
      id: higherId,
      name: 'Projet id haut',
      status: 'planning',
      created_at: sameTimestamp,
      updated_at: sameTimestamp
    })

    const ids = repository.list().map((project) => project.id)
    expect(ids[0]).toBe(higherId)
    expect(ids[1]).toBe(lowerId)
  })

  it('transforme les colonnes SQL en camelCase', () => {
    repository.create({ name: 'Projet', repositoryPath: '/repo', targetTechnology: 'React' })

    const [project] = repository.list()
    expect(project).toMatchObject({ repositoryPath: '/repo', targetTechnology: 'React' })
  })

  it('conserve les champs nullable à null', () => {
    repository.create({ name: 'Projet minimal' })

    const [project] = repository.list()
    expect(project.description).toBeNull()
    expect(project.objective).toBeNull()
    expect(project.repositoryPath).toBeNull()
    expect(project.targetTechnology).toBeNull()
    expect(project.notes).toBeNull()
  })
})

describe('projectsRepository.getById', () => {
  it('retourne le projet existant', () => {
    const created = repository.create({ name: 'Projet' })

    expect(repository.getById(created.id)).toEqual(created)
  })

  it('retourne null pour un identifiant absent', () => {
    expect(repository.getById('identifiant-inexistant')).toBeNull()
  })

  it('le projet retourné respecte le contrat partagé Project', () => {
    const created = repository.create({ name: 'Projet' })
    const found = repository.getById(created.id)

    expect(found).toMatchObject({
      id: expect.stringMatching(UUID_PATTERN),
      name: 'Projet',
      status: 'planning',
      createdAt: expect.stringMatching(ISO_DATETIME_PATTERN),
      updatedAt: expect.stringMatching(ISO_DATETIME_PATTERN)
    })
  })
})

describe('projectsRepository.create', () => {
  it('crée un projet avec les données minimales', () => {
    const project = repository.create({ name: 'Projet minimal' })

    expect(project.name).toBe('Projet minimal')
  })

  it('génère un UUID valide', () => {
    const project = repository.create({ name: 'Projet' })

    expect(project.id).toMatch(UUID_PATTERN)
  })

  it('génère des timestamps ISO valides', () => {
    const project = repository.create({ name: 'Projet' })

    expect(project.createdAt).toMatch(ISO_DATETIME_PATTERN)
    expect(project.updatedAt).toMatch(ISO_DATETIME_PATTERN)
  })

  it('utilise le même timestamp pour createdAt et updatedAt à la création', () => {
    const project = repository.create({ name: 'Projet' })

    expect(project.createdAt).toBe(project.updatedAt)
  })

  it("applique le statut par défaut 'planning'", () => {
    const project = repository.create({ name: 'Projet' })

    expect(project.status).toBe('planning')
  })

  it('crée un projet avec tous les champs renseignés', () => {
    const project = repository.create({
      name: 'Projet complet',
      description: 'Description',
      objective: 'Objectif',
      status: 'active',
      repositoryPath: '/repo',
      targetTechnology: 'React',
      notes: 'Notes'
    })

    expect(project).toMatchObject({
      name: 'Projet complet',
      description: 'Description',
      objective: 'Objectif',
      status: 'active',
      repositoryPath: '/repo',
      targetTechnology: 'React',
      notes: 'Notes'
    })
  })

  it('normalise les champs texte (trim) via la validation Zod', () => {
    const project = repository.create({ name: '  Projet avec espaces  ' })

    expect(project.name).toBe('Projet avec espaces')
  })

  it('enregistre null pour les champs optionnels absents', () => {
    const project = repository.create({ name: 'Projet' })

    expect(project.description).toBeNull()
    expect(project.objective).toBeNull()
    expect(project.repositoryPath).toBeNull()
    expect(project.targetTechnology).toBeNull()
    expect(project.notes).toBeNull()
  })

  it('respecte un statut explicite fourni', () => {
    const project = repository.create({ name: 'Projet', status: 'archived' })

    expect(project.status).toBe('archived')
  })

  it('deux créations produisent deux identifiants différents', () => {
    const first = repository.create({ name: 'Projet 1' })
    const second = repository.create({ name: 'Projet 2' })

    expect(first.id).not.toBe(second.id)
  })

  it('refuse des données invalides (nom vide)', () => {
    expect(() => repository.create({ name: '' })).toThrow()
  })

  it('refuse des données invalides (statut inconnu)', () => {
    expect(() => repository.create({ name: 'Projet', status: 'unknown' } as never)).toThrow()
  })

  it("ne crée aucun enregistrement lorsque la validation échoue", () => {
    expect(() => repository.create({ name: '' })).toThrow()
    expect(repository.list()).toHaveLength(0)
  })
})

describe('projectsRepository.update', () => {
  it('met à jour un seul champ', () => {
    const created = repository.create({ name: 'Projet' })

    const updated = repository.update(created.id, { name: 'Nouveau nom' })

    expect(updated?.name).toBe('Nouveau nom')
  })

  it('met à jour plusieurs champs', () => {
    const created = repository.create({ name: 'Projet' })

    const updated = repository.update(created.id, { name: 'Nouveau nom', status: 'active' })

    expect(updated).toMatchObject({ name: 'Nouveau nom', status: 'active' })
  })

  it('préserve les champs absents de la mise à jour', () => {
    const created = repository.create({ name: 'Projet', objective: 'Objectif initial' })

    const updated = repository.update(created.id, { name: 'Nouveau nom' })

    expect(updated?.objective).toBe('Objectif initial')
  })

  it('permet de remettre un champ nullable à null', () => {
    const created = repository.create({ name: 'Projet', objective: 'Objectif initial' })

    const updated = repository.update(created.id, { objective: null })

    expect(updated?.objective).toBeNull()
  })

  it('normalise les chaînes fournies (trim)', () => {
    const created = repository.create({ name: 'Projet' })

    const updated = repository.update(created.id, { name: '  Nom modifié  ' })

    expect(updated?.name).toBe('Nom modifié')
  })

  it('laisse createdAt inchangé', () => {
    const created = repository.create({ name: 'Projet' })

    const updated = repository.update(created.id, { name: 'Nouveau nom' })

    expect(updated?.createdAt).toBe(created.createdAt)
  })

  it('modifie updatedAt', () => {
    let currentInstant = new Date('2026-01-01T00:00:00.000Z')
    const clockedRepository = createProjectsRepository(db, {
      now: () => {
        const iso = currentInstant.toISOString()
        currentInstant = new Date(currentInstant.getTime() + 1000)
        return iso
      }
    })

    const created = clockedRepository.create({ name: 'Projet' })
    const updated = clockedRepository.update(created.id, { name: 'Nouveau nom' })

    expect(updated?.updatedAt).not.toBe(created.updatedAt)
  })

  it("laisse l'identifiant inchangé", () => {
    const created = repository.create({ name: 'Projet' })

    const updated = repository.update(created.id, { name: 'Nouveau nom' })

    expect(updated?.id).toBe(created.id)
  })

  it('modifie correctement le statut', () => {
    const created = repository.create({ name: 'Projet' })

    const updated = repository.update(created.id, { status: 'completed' })

    expect(updated?.status).toBe('completed')
  })

  it('retourne null pour un projet inexistant', () => {
    expect(repository.update('identifiant-inexistant', { name: 'X' })).toBeNull()
  })

  it('refuse un objet vide', () => {
    const created = repository.create({ name: 'Projet' })

    expect(() => repository.update(created.id, {})).toThrow()
  })

  it('refuse une entrée invalide (nom vide)', () => {
    const created = repository.create({ name: 'Projet' })

    expect(() => repository.update(created.id, { name: '' })).toThrow()
  })

  it("n'enregistre aucune modification lorsque la validation échoue", () => {
    const created = repository.create({ name: 'Projet' })

    expect(() => repository.update(created.id, { name: '' })).toThrow()

    expect(repository.getById(created.id)?.name).toBe('Projet')
  })

  it("ignore une clé explicitement undefined mélangée à une vraie modification, sans effacer la valeur existante", () => {
    const created = repository.create({ name: 'Projet', objective: 'Objectif initial' })

    // Le cast `as never` simule uniquement une entrée JavaScript runtime
    // construite par étalement d'un objet partiel (ex. `{ ...changes }` où
    // `objective` n'a pas été touché) : TypeScript interdirait normalement
    // de fournir `objective: undefined` ici puisque la clé serait absente
    // dans un objet correctement typé.
    const updated = repository.update(created.id, {
      name: 'Nouveau nom',
      objective: undefined
    } as never)

    expect(updated?.name).toBe('Nouveau nom')
    expect(updated?.objective).toBe('Objectif initial')
    expect(repository.getById(created.id)?.objective).toBe('Objectif initial')
  })

  it('refuse un objet ne contenant que des clés à undefined avant toute requête SQL', () => {
    const created = repository.create({ name: 'Projet', objective: 'Objectif initial' })

    expect(() => repository.update(created.id, { name: undefined, objective: undefined } as never)).toThrow()

    const unchanged = repository.getById(created.id)
    expect(unchanged?.name).toBe('Projet')
    expect(unchanged?.objective).toBe('Objectif initial')
    expect(unchanged?.updatedAt).toBe(created.updatedAt)
  })
})

describe('projectsRepository.remove', () => {
  it('retourne true pour un projet existant supprimé', () => {
    const created = repository.create({ name: 'Projet' })

    expect(repository.remove(created.id)).toBe(true)
  })

  it("le projet n'est plus accessible après suppression", () => {
    const created = repository.create({ name: 'Projet' })
    repository.remove(created.id)

    expect(repository.getById(created.id)).toBeNull()
  })

  it('retourne false pour un identifiant absent', () => {
    expect(repository.remove('identifiant-inexistant')).toBe(false)
  })

  it('ne supprime pas les autres projets', () => {
    const first = repository.create({ name: 'Projet 1' })
    const second = repository.create({ name: 'Projet 2' })

    repository.remove(first.id)

    expect(repository.getById(second.id)).not.toBeNull()
    expect(repository.list()).toHaveLength(1)
  })
})

describe('projectsRepository — persistance sur fichier SQLite réel', () => {
  let tempDir: string
  let dbPath: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'tfc-projects-repo-'))
    dbPath = join(tempDir, 'lifecycle.sqlite')
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('conserve un projet inséré après fermeture puis réouverture de la connexion', () => {
    const firstConnection = new Database(dbPath)
    firstConnection.pragma('foreign_keys = ON')
    runMigrations(firstConnection)

    const firstRepository = createProjectsRepository(firstConnection)
    const created = firstRepository.create({ name: 'Projet persistant' })
    firstConnection.close()

    const secondConnection = new Database(dbPath)
    secondConnection.pragma('foreign_keys = ON')
    const secondRepository = createProjectsRepository(secondConnection)

    expect(secondRepository.getById(created.id)).toEqual(created)

    secondConnection.close()
  })
})
