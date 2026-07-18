import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../migrations/runMigrations'
import { createProjectsRepository, type ProjectsRepository } from './projectsRepository'
import { createPhasesRepository, type PhasesRepository } from './phasesRepository'

/**
 * Test d'intégration ciblé (Phase 3.8, section 4 de PHASE_3.8_PROMPT.md) :
 * démontre la vraie contrainte SQL `ON DELETE CASCADE` définie par la
 * migration 0001 (`phases.project_id REFERENCES projects(id) ON DELETE
 * CASCADE`) avec les deux vrais repositories, sans mock. Ni
 * `projectsRepository.test.ts` ni `phasesRepository.test.ts` n'exerçaient
 * jusqu'ici la suppression d'un projet ayant des phases : chacun ne teste
 * que son propre périmètre isolément.
 */
describe('projectsRepository + phasesRepository — cascade de suppression réelle (ON DELETE CASCADE)', () => {
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

  it('supprime toutes les phases du projet supprimé et laisse intacts un autre projet et ses phases', () => {
    const projectA = projectsRepository.create({ name: 'Projet A' })
    const projectB = projectsRepository.create({ name: 'Projet B' })

    const phaseA1 = phasesRepository.create({ projectId: projectA.id, name: 'Phase A1' })
    const phaseA2 = phasesRepository.create({ projectId: projectA.id, name: 'Phase A2' })
    const phaseA3 = phasesRepository.create({ projectId: projectA.id, name: 'Phase A3' })
    const phaseB1 = phasesRepository.create({ projectId: projectB.id, name: 'Phase B1' })

    // Listes initiales, avant toute suppression.
    expect(phasesRepository.listByProjectId(projectA.id).map((phase) => phase.id).sort()).toEqual(
      [phaseA1.id, phaseA2.id, phaseA3.id].sort()
    )
    expect(phasesRepository.listByProjectId(projectB.id)).toEqual([phaseB1])

    // Suppression du projet A via le vrai repository projets.
    const removed = projectsRepository.remove(projectA.id)
    expect(removed).toBe(true)

    // Le projet A n'existe plus.
    expect(projectsRepository.getById(projectA.id)).toBeNull()

    // Toutes les phases de A ont disparu (cascade SQL réelle, pas simulée).
    expect(phasesRepository.listByProjectId(projectA.id)).toEqual([])
    expect(phasesRepository.getById(phaseA1.id)).toBeNull()
    expect(phasesRepository.getById(phaseA2.id)).toBeNull()
    expect(phasesRepository.getById(phaseA3.id)).toBeNull()
    const remainingPhasesCount = (
      db.prepare('SELECT COUNT(*) AS count FROM phases WHERE project_id = ?').get(projectA.id) as {
        count: number
      }
    ).count
    expect(remainingPhasesCount).toBe(0)

    // Le projet B et sa phase restent intacts.
    expect(projectsRepository.getById(projectB.id)).not.toBeNull()
    expect(phasesRepository.listByProjectId(projectB.id)).toEqual([phaseB1])
    expect(phasesRepository.getById(phaseB1.id)).toEqual(phaseB1)
  })
})

/**
 * Persistance combinée projet + phases après fermeture puis réouverture
 * d'un fichier SQLite réel. `projectsRepository.test.ts` démontre déjà cette
 * persistance pour un projet seul, et `database.test.ts` démontre déjà la
 * non-reprise des migrations sur un fichier déjà initialisé : ce test évite
 * de dupliquer ces deux points et couvre uniquement la portion non encore
 * démontrée, propre à la Phase 3.8 — les phases d'un projet, y compris leur
 * ordre par position, survivent elles aussi à un cycle fermeture/réouverture.
 */
describe('projectsRepository + phasesRepository — persistance combinée sur fichier SQLite réel', () => {
  let tempDir: string
  let dbPath: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'tfc-cascade-persist-'))
    dbPath = join(tempDir, 'lifecycle.sqlite')
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('conserve un projet et ses phases, dans leur ordre, après fermeture puis réouverture du fichier', () => {
    const firstConnection = new Database(dbPath)
    firstConnection.pragma('foreign_keys = ON')
    runMigrations(firstConnection)

    const firstProjects = createProjectsRepository(firstConnection)
    const firstPhases = createPhasesRepository(firstConnection)

    const project = firstProjects.create({ name: 'Projet persistant' })
    const first = firstPhases.create({ projectId: project.id, name: 'Première phase' })
    const second = firstPhases.create({ projectId: project.id, name: 'Deuxième phase' })

    firstConnection.close()

    const secondConnection = new Database(dbPath)
    secondConnection.pragma('foreign_keys = ON')
    const secondProjects = createProjectsRepository(secondConnection)
    const secondPhases = createPhasesRepository(secondConnection)

    expect(secondProjects.getById(project.id)).toEqual(project)
    const persistedPhases = secondPhases.listByProjectId(project.id)
    expect(persistedPhases).toEqual([first, second])

    secondConnection.close()
  })
})
