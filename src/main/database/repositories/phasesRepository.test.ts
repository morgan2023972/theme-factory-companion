import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../migrations/runMigrations'
import { createProjectsRepository, type ProjectsRepository } from './projectsRepository'
import { createPhasesRepository, type PhasesRepository } from './phasesRepository'
import type { Project } from '../../../shared/schemas/project'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/
const NONEXISTENT_PROJECT_ID = '00000000-0000-4000-8000-000000000099'

let db: Database.Database
let projectsRepository: ProjectsRepository
let phasesRepository: PhasesRepository

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  projectsRepository = createProjectsRepository(db)
  phasesRepository = createPhasesRepository(db)
})

afterEach(() => {
  db.close()
})

function createTestProject(name = 'Projet de test'): Project {
  return projectsRepository.create({ name })
}

describe('phasesRepository — clés étrangères', () => {
  it('les clés étrangères sont actives sur la connexion de test', () => {
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1)
  })
})

describe('phasesRepository.listByProjectId', () => {
  it("retourne un tableau vide si le projet n'a aucune phase", () => {
    const project = createTestProject()

    expect(phasesRepository.listByProjectId(project.id)).toEqual([])
  })

  it('retourne uniquement les phases du projet demandé (isolation entre projets)', () => {
    const projectA = createTestProject('Projet A')
    const projectB = createTestProject('Projet B')

    const a1 = phasesRepository.create({ projectId: projectA.id, name: 'Phase A1' })
    const a2 = phasesRepository.create({ projectId: projectA.id, name: 'Phase A2' })
    phasesRepository.create({ projectId: projectB.id, name: 'Phase B1' })

    const phasesA = phasesRepository.listByProjectId(projectA.id)
    expect(phasesA.map((phase) => phase.id).sort()).toEqual([a1.id, a2.id].sort())
    expect(phasesA.every((phase) => phase.projectId === projectA.id)).toBe(true)
  })

  it('trie les phases par position croissante', () => {
    const project = createTestProject()

    const third = phasesRepository.create({ projectId: project.id, name: 'Troisième', position: 2 })
    const first = phasesRepository.create({ projectId: project.id, name: 'Première', position: 0 })
    const second = phasesRepository.create({ projectId: project.id, name: 'Deuxième', position: 1 })

    const ids = phasesRepository.listByProjectId(project.id).map((phase) => phase.id)
    expect(ids).toEqual([first.id, second.id, third.id])
  })

  it('ne consulte pas les phases des autres projets pour établir le tri ou le contenu', () => {
    const projectA = createTestProject('Projet A')
    const projectB = createTestProject('Projet B')

    phasesRepository.create({ projectId: projectB.id, name: 'Phase B', position: 0 })
    const onlyPhase = phasesRepository.create({ projectId: projectA.id, name: 'Phase A', position: 5 })

    expect(phasesRepository.listByProjectId(projectA.id)).toEqual([onlyPhase])
  })
})

describe('phasesRepository.getById', () => {
  it('retourne la phase existante', () => {
    const project = createTestProject()
    const created = phasesRepository.create({ projectId: project.id, name: 'Phase' })

    expect(phasesRepository.getById(created.id)).toEqual(created)
  })

  it('retourne null pour un identifiant absent', () => {
    expect(phasesRepository.getById('00000000-0000-4000-8000-000000000001')).toBeNull()
  })
})

describe('phasesRepository.create', () => {
  it('crée une phase avec les champs minimaux', () => {
    const project = createTestProject()
    const phase = phasesRepository.create({ projectId: project.id, name: 'Phase minimale' })

    expect(phase.id).toMatch(UUID_PATTERN)
    expect(phase.projectId).toBe(project.id)
    expect(phase.name).toBe('Phase minimale')
    expect(phase.status).toBe('pending')
    expect(phase.description).toBeNull()
    expect(phase.position).toBe(0)
    expect(phase.createdAt).toMatch(ISO_DATETIME_PATTERN)
    expect(phase.updatedAt).toMatch(ISO_DATETIME_PATTERN)
    expect(phase.createdAt).toBe(phase.updatedAt)
  })

  it('crée une phase avec tous les champs renseignés', () => {
    const project = createTestProject()
    const phase = phasesRepository.create({
      projectId: project.id,
      name: 'Phase complète',
      description: 'Description détaillée',
      status: 'in_progress',
      position: 4
    })

    expect(phase).toMatchObject({
      projectId: project.id,
      name: 'Phase complète',
      description: 'Description détaillée',
      status: 'in_progress',
      position: 4
    })
  })

  it('normalise les champs texte (trim) via la validation Zod', () => {
    const project = createTestProject()
    const phase = phasesRepository.create({ projectId: project.id, name: '  Phase avec espaces  ' })

    expect(phase.name).toBe('Phase avec espaces')
  })

  it("échoue si le projet parent n'existe pas, sans insérer de phase orpheline", () => {
    expect(() => phasesRepository.create({ projectId: NONEXISTENT_PROJECT_ID, name: 'Phase orpheline' })).toThrow()

    const count = (db.prepare('SELECT COUNT(*) AS count FROM phases').get() as { count: number }).count
    expect(count).toBe(0)
  })

  it('refuse des données invalides (nom vide) sans créer de phase', () => {
    const project = createTestProject()

    expect(() => phasesRepository.create({ projectId: project.id, name: '' })).toThrow()
    expect(phasesRepository.listByProjectId(project.id)).toHaveLength(0)
  })

  describe('position automatique', () => {
    it('attribue la position 0 à la première phase du projet', () => {
      const project = createTestProject()
      const phase = phasesRepository.create({ projectId: project.id, name: 'Phase' })

      expect(phase.position).toBe(0)
    })

    it('ajoute une phase à la fin des phases existantes du même projet', () => {
      const project = createTestProject()
      phasesRepository.create({ projectId: project.id, name: 'Phase 1' })
      phasesRepository.create({ projectId: project.id, name: 'Phase 2' })
      const third = phasesRepository.create({ projectId: project.id, name: 'Phase 3' })

      expect(third.position).toBe(2)
    })

    it('calcule la position suivante indépendamment des autres projets', () => {
      const projectA = createTestProject('Projet A')
      const projectB = createTestProject('Projet B')

      phasesRepository.create({ projectId: projectA.id, name: 'A1' })
      phasesRepository.create({ projectId: projectA.id, name: 'A2' })
      const b1 = phasesRepository.create({ projectId: projectB.id, name: 'B1' })

      expect(b1.position).toBe(0)
    })

    it('respecte une position explicite fournie', () => {
      const project = createTestProject()
      const phase = phasesRepository.create({ projectId: project.id, name: 'Phase', position: 7 })

      expect(phase.position).toBe(7)
    })

    it('reprend le calcul automatique après une position explicite élevée', () => {
      const project = createTestProject()
      phasesRepository.create({ projectId: project.id, name: 'Phase haute', position: 10 })
      const next = phasesRepository.create({ projectId: project.id, name: 'Phase suivante' })

      expect(next.position).toBe(11)
    })

    it('refuse une création avec une position explicite déjà occupée dans le même projet', () => {
      const project = createTestProject()
      phasesRepository.create({ projectId: project.id, name: 'Première', position: 0 })

      expect(() =>
        phasesRepository.create({ projectId: project.id, name: 'Collision', position: 0 })
      ).toThrow()

      expect(phasesRepository.listByProjectId(project.id)).toHaveLength(1)
    })

    it('respecte une position explicite à 0 même si le projet a déjà des phases positionnées plus loin', () => {
      const project = createTestProject()
      phasesRepository.create({ projectId: project.id, name: 'Phase existante', position: 5 })
      const phase = phasesRepository.create({ projectId: project.id, name: 'Nouvelle phase à 0', position: 0 })

      expect(phase.position).toBe(0)
    })
  })
})

describe('phasesRepository.update', () => {
  it('met à jour un seul champ', () => {
    const project = createTestProject()
    const created = phasesRepository.create({ projectId: project.id, name: 'Phase' })

    const updated = phasesRepository.update(created.id, { name: 'Nouveau nom' })

    expect(updated?.name).toBe('Nouveau nom')
  })

  it('préserve les champs absents de la mise à jour', () => {
    const project = createTestProject()
    const created = phasesRepository.create({ projectId: project.id, name: 'Phase', description: 'Description initiale' })

    const updated = phasesRepository.update(created.id, { name: 'Nouveau nom' })

    expect(updated?.description).toBe('Description initiale')
  })

  it('laisse createdAt inchangé et modifie updatedAt', () => {
    let currentInstant = new Date('2026-01-01T00:00:00.000Z')
    const clockedRepository = createPhasesRepository(db, {
      now: () => {
        const iso = currentInstant.toISOString()
        currentInstant = new Date(currentInstant.getTime() + 1000)
        return iso
      }
    })
    const project = createTestProject()
    const created = clockedRepository.create({ projectId: project.id, name: 'Phase' })

    const updated = clockedRepository.update(created.id, { name: 'Nouveau nom' })

    expect(updated?.createdAt).toBe(created.createdAt)
    expect(updated?.updatedAt).not.toBe(created.updatedAt)
  })

  it('efface une description en la mettant explicitement à null', () => {
    const project = createTestProject()
    const created = phasesRepository.create({ projectId: project.id, name: 'Phase', description: 'À effacer' })

    const updated = phasesRepository.update(created.id, { description: null })

    expect(updated?.description).toBeNull()
  })

  it('modifie la position et met à jour l\'ordre retourné par listByProjectId', () => {
    const project = createTestProject()
    const first = phasesRepository.create({ projectId: project.id, name: 'Première', position: 0 })
    const second = phasesRepository.create({ projectId: project.id, name: 'Deuxième', position: 1 })

    phasesRepository.update(first.id, { position: 5 })

    const ids = phasesRepository.listByProjectId(project.id).map((phase) => phase.id)
    expect(ids).toEqual([second.id, first.id])
  })

  it('refuse de déplacer la position vers une position déjà occupée dans le même projet (UNIQUE(project_id, position))', () => {
    const project = createTestProject()
    const first = phasesRepository.create({ projectId: project.id, name: 'Première', position: 0 })
    phasesRepository.create({ projectId: project.id, name: 'Deuxième', position: 1 })

    expect(() => phasesRepository.update(first.id, { position: 1 })).toThrow()
  })

  it('retourne null pour une phase inexistante', () => {
    expect(phasesRepository.update('00000000-0000-4000-8000-000000000001', { name: 'X' })).toBeNull()
  })

  it('refuse un objet vide', () => {
    const project = createTestProject()
    const created = phasesRepository.create({ projectId: project.id, name: 'Phase' })

    expect(() => phasesRepository.update(created.id, {})).toThrow()
  })

  it("n'enregistre aucune modification lorsque la validation échoue", () => {
    const project = createTestProject()
    const created = phasesRepository.create({ projectId: project.id, name: 'Phase' })

    expect(() => phasesRepository.update(created.id, { name: '' })).toThrow()

    expect(phasesRepository.getById(created.id)?.name).toBe('Phase')
  })

  it("ignore une clé explicitement undefined mélangée à une vraie modification, sans effacer la valeur existante", () => {
    const project = createTestProject()
    const created = phasesRepository.create({ projectId: project.id, name: 'Phase', description: 'Description initiale' })

    // Le cast `as never` simule uniquement une entrée JavaScript runtime
    // construite par étalement d'un objet partiel (ex. `{ ...changes }` où
    // `description` n'a pas été touché) : TypeScript interdirait normalement
    // de fournir `description: undefined` ici puisque la clé serait absente
    // dans un objet correctement typé.
    const updated = phasesRepository.update(created.id, {
      name: 'Nouveau nom',
      description: undefined
    } as never)

    expect(updated?.name).toBe('Nouveau nom')
    expect(updated?.description).toBe('Description initiale')
    expect(phasesRepository.getById(created.id)?.description).toBe('Description initiale')
  })

  it("refuse un objet ne contenant que des clés à undefined avant toute requête SQL", () => {
    const project = createTestProject()
    const created = phasesRepository.create({ projectId: project.id, name: 'Phase', description: 'Description initiale' })

    expect(() => phasesRepository.update(created.id, { name: undefined, description: undefined } as never)).toThrow()

    const unchanged = phasesRepository.getById(created.id)
    expect(unchanged?.name).toBe('Phase')
    expect(unchanged?.description).toBe('Description initiale')
    expect(unchanged?.updatedAt).toBe(created.updatedAt)
  })

  it('ne modifie aucun champ si la collision de position fait échouer la mise à jour', () => {
    const project = createTestProject()
    const first = phasesRepository.create({ projectId: project.id, name: 'Première', position: 0 })
    phasesRepository.create({ projectId: project.id, name: 'Deuxième', position: 1 })

    expect(() => phasesRepository.update(first.id, { name: 'Renommée', position: 1 })).toThrow()

    const stillFirst = phasesRepository.getById(first.id)
    expect(stillFirst?.name).toBe('Première')
    expect(stillFirst?.position).toBe(0)
  })
})

describe('phasesRepository.remove', () => {
  it('retourne true pour une phase existante supprimée', () => {
    const project = createTestProject()
    const created = phasesRepository.create({ projectId: project.id, name: 'Phase' })

    expect(phasesRepository.remove(created.id)).toBe(true)
  })

  it("la phase n'est plus accessible après suppression", () => {
    const project = createTestProject()
    const created = phasesRepository.create({ projectId: project.id, name: 'Phase' })
    phasesRepository.remove(created.id)

    expect(phasesRepository.getById(created.id)).toBeNull()
  })

  it('retourne false pour un identifiant absent', () => {
    expect(phasesRepository.remove('00000000-0000-4000-8000-000000000001')).toBe(false)
  })

  it('retourne false lors d\'une seconde suppression de la même phase', () => {
    const project = createTestProject()
    const created = phasesRepository.create({ projectId: project.id, name: 'Phase' })

    expect(phasesRepository.remove(created.id)).toBe(true)
    expect(phasesRepository.remove(created.id)).toBe(false)
  })
})

describe('phasesRepository — relations', () => {
  it('supprime en cascade les phases lors de la suppression du projet parent', () => {
    const project = createTestProject()
    const phase1 = phasesRepository.create({ projectId: project.id, name: 'Phase 1' })
    const phase2 = phasesRepository.create({ projectId: project.id, name: 'Phase 2' })

    projectsRepository.remove(project.id)

    expect(phasesRepository.getById(phase1.id)).toBeNull()
    expect(phasesRepository.getById(phase2.id)).toBeNull()
    expect(phasesRepository.listByProjectId(project.id)).toEqual([])
  })

  it("met phase_id à NULL sur les tâches liées lors de la suppression d'une phase (ON DELETE SET NULL)", () => {
    const project = createTestProject()
    const phase = phasesRepository.create({ projectId: project.id, name: 'Phase' })

    const timestamp = new Date().toISOString()
    db.prepare(
      `INSERT INTO tasks (id, project_id, phase_id, title, status, priority, position, created_at, updated_at)
       VALUES (@id, @project_id, @phase_id, @title, @status, @priority, @position, @created_at, @updated_at)`
    ).run({
      id: 'task-1',
      project_id: project.id,
      phase_id: phase.id,
      title: 'Tâche liée à la phase',
      status: 'backlog',
      priority: 'medium',
      position: 0,
      created_at: timestamp,
      updated_at: timestamp
    })

    phasesRepository.remove(phase.id)

    const task = db.prepare('SELECT phase_id FROM tasks WHERE id = ?').get('task-1') as
      | { phase_id: string | null }
      | undefined
    expect(task).toBeDefined()
    expect(task?.phase_id).toBeNull()
  })
})
