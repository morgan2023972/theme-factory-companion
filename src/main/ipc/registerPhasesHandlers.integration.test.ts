import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../database/migrations/runMigrations'
import { createProjectsRepository } from '../database/repositories/projectsRepository'
import { createPhasesRepository } from '../database/repositories/phasesRepository'
import { IPC_CHANNELS } from '../../shared/contracts/ipcChannels'
import { registerPhasesHandlers } from './registerPhasesHandlers'
import type { IpcHandleListener, IpcMainLike } from './registerProjectsHandlers'

/**
 * Test d'intégration ciblé : handler IPC → repository réel → SQLite en
 * mémoire. Ne démarre aucune fenêtre Electron ni processus réel : seul
 * `ipcMain.handle` est remplacé par un registre minimal local.
 */
describe('registerPhasesHandlers — intégration avec un repository SQLite réel', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
  })

  afterEach(() => {
    db.close()
  })

  it('couvre le parcours create → listByProjectId → update → remove → listByProjectId', () => {
    const handlers = new Map<string, IpcHandleListener>()
    const ipcMain: IpcMainLike = {
      handle: (channel, listener) => {
        handlers.set(channel, listener)
      }
    }

    const projectsRepository = createProjectsRepository(db)
    const phasesRepository = createPhasesRepository(db)
    registerPhasesHandlers({ ipcMain, phasesRepository })

    const invoke = (channel: string, ...args: readonly unknown[]): unknown =>
      handlers.get(channel)?.({}, ...args)

    const project = projectsRepository.create({ name: 'Projet intégration' })

    const created = invoke(IPC_CHANNELS.phases.create, { projectId: project.id, name: 'Phase intégration' }) as {
      id: string
      name: string
      status: string
      position: number
    }
    expect(created).toMatchObject({ name: 'Phase intégration', status: 'pending', position: 0 })

    const secondCreated = invoke(IPC_CHANNELS.phases.create, {
      projectId: project.id,
      name: 'Deuxième phase'
    }) as { id: string; position: number }
    expect(secondCreated.position).toBe(1)

    const listed = invoke(IPC_CHANNELS.phases.listByProjectId, project.id) as Array<{ id: string; position: number }>
    expect(listed).toHaveLength(2)
    expect(listed.map((phase) => phase.id)).toEqual([created.id, secondCreated.id])

    const updated = invoke(IPC_CHANNELS.phases.update, {
      id: created.id,
      input: { status: 'in_progress' }
    }) as { status: string }
    expect(updated.status).toBe('in_progress')

    const persisted = phasesRepository.getById(created.id)
    expect(persisted?.status).toBe('in_progress')

    const removed = invoke(IPC_CHANNELS.phases.remove, created.id)
    expect(removed).toBe(true)

    const afterRemoval = invoke(IPC_CHANNELS.phases.listByProjectId, project.id) as Array<{ id: string }>
    expect(afterRemoval).toHaveLength(1)
    expect(afterRemoval.map((phase) => phase.id)).toEqual([secondCreated.id])
  })
})
