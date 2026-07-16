import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../database/migrations/runMigrations'
import { createProjectsRepository } from '../database/repositories/projectsRepository'
import { IPC_CHANNELS } from '../../shared/contracts/ipcChannels'
import { registerProjectsHandlers, type IpcHandleListener, type IpcMainLike } from './registerProjectsHandlers'

/**
 * Test d'intégration ciblé : handler IPC → repository réel → SQLite en
 * mémoire. Ne démarre aucune fenêtre Electron ni processus réel : seul
 * `ipcMain.handle` est remplacé par un registre minimal local.
 */
describe('registerProjectsHandlers — intégration avec un repository SQLite réel', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
  })

  afterEach(() => {
    db.close()
  })

  it('couvre le parcours create → list → getById → update → remove', async () => {
    const handlers = new Map<string, IpcHandleListener>()
    const ipcMain: IpcMainLike = {
      handle: (channel, listener) => {
        handlers.set(channel, listener)
      }
    }

    const projectsRepository = createProjectsRepository(db)
    registerProjectsHandlers({ ipcMain, projectsRepository })

    const invoke = (channel: string, ...args: readonly unknown[]): unknown =>
      handlers.get(channel)?.({}, ...args)

    const created = invoke(IPC_CHANNELS.projects.create, { name: 'Projet intégration' }) as {
      id: string
      name: string
      status: string
    }
    expect(created).toMatchObject({ name: 'Projet intégration', status: 'planning' })

    const listed = invoke(IPC_CHANNELS.projects.list) as unknown[]
    expect(listed).toHaveLength(1)

    const found = invoke(IPC_CHANNELS.projects.getById, created.id)
    expect(found).toEqual(created)

    const updated = invoke(IPC_CHANNELS.projects.update, {
      id: created.id,
      input: { status: 'active' }
    }) as { status: string }
    expect(updated.status).toBe('active')

    const removed = invoke(IPC_CHANNELS.projects.remove, created.id)
    expect(removed).toBe(true)

    const afterRemoval = invoke(IPC_CHANNELS.projects.getById, created.id)
    expect(afterRemoval).toBeNull()
  })
})
