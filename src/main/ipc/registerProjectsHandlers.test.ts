import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '../../shared/contracts/ipcChannels'
import type { Project } from '../../shared/schemas/project'
import type { ProjectsRepository } from '../database/repositories/projectsRepository'
import { registerProjectsHandlers, type IpcHandleListener, type IpcMainLike } from './registerProjectsHandlers'

const VALID_ID = '123e4567-e89b-12d3-a456-426614174000'
const OTHER_VALID_ID = '00000000-0000-4000-8000-000000000002'
const VALID_TIMESTAMP = '2026-07-16T10:00:00.000Z'

const sampleProject: Project = {
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

function createFakeIpcMain(): { ipcMain: IpcMainLike; handlers: Map<string, IpcHandleListener>; handleCalls: string[] } {
  const handlers = new Map<string, IpcHandleListener>()
  const handleCalls: string[] = []

  const ipcMain: IpcMainLike = {
    handle: (channel, listener) => {
      handleCalls.push(channel)
      handlers.set(channel, listener)
    }
  }

  return { ipcMain, handlers, handleCalls }
}

function createFakeRepository(): ProjectsRepository {
  return {
    list: vi.fn(() => [sampleProject]),
    getById: vi.fn(() => sampleProject),
    create: vi.fn(() => sampleProject),
    update: vi.fn(() => sampleProject),
    remove: vi.fn(() => true)
  }
}

let fakeIpcMain: ReturnType<typeof createFakeIpcMain>
let repository: ProjectsRepository

beforeEach(() => {
  fakeIpcMain = createFakeIpcMain()
  repository = createFakeRepository()
  registerProjectsHandlers({ ipcMain: fakeIpcMain.ipcMain, projectsRepository: repository })
})

function invoke(channel: string, ...args: readonly unknown[]): unknown {
  const listener = fakeIpcMain.handlers.get(channel)
  if (!listener) {
    throw new Error(`Aucun handler enregistré pour le canal ${channel}`)
  }
  return listener({}, ...args)
}

describe('registerProjectsHandlers — enregistrement', () => {
  it('enregistre les cinq canaux attendus', () => {
    expect([...fakeIpcMain.handlers.keys()].sort()).toEqual(
      Object.values(IPC_CHANNELS.projects).sort()
    )
  })

  it('enregistre chaque canal une seule fois', () => {
    const counts = new Map<string, number>()
    for (const channel of fakeIpcMain.handleCalls) {
      counts.set(channel, (counts.get(channel) ?? 0) + 1)
    }
    for (const count of counts.values()) {
      expect(count).toBe(1)
    }
  })

  it("n'enregistre aucun canal inattendu", () => {
    expect(fakeIpcMain.handleCalls).toHaveLength(5)
    for (const channel of fakeIpcMain.handleCalls) {
      expect(Object.values(IPC_CHANNELS.projects)).toContain(channel)
    }
  })
})

describe('registerProjectsHandlers — projects:list', () => {
  it('appelle repository.list() une fois et retourne sa valeur', () => {
    const result = invoke(IPC_CHANNELS.projects.list)

    expect(repository.list).toHaveBeenCalledTimes(1)
    expect(result).toEqual([sampleProject])
  })
})

describe('registerProjectsHandlers — projects:getById', () => {
  it('accepte un UUID valide et appelle le repository avec cet identifiant', () => {
    const result = invoke(IPC_CHANNELS.projects.getById, VALID_ID)

    expect(repository.getById).toHaveBeenCalledWith(VALID_ID)
    expect(result).toEqual(sampleProject)
  })

  it('retourne null si le repository retourne null', () => {
    ;(repository.getById as ReturnType<typeof vi.fn>).mockReturnValueOnce(null)

    const result = invoke(IPC_CHANNELS.projects.getById, OTHER_VALID_ID)

    expect(result).toBeNull()
  })

  it('refuse un UUID invalide sans appeler le repository', () => {
    expect(() => invoke(IPC_CHANNELS.projects.getById, 'not-a-uuid')).toThrow()
    expect(repository.getById).not.toHaveBeenCalled()
  })
})

describe('registerProjectsHandlers — projects:create', () => {
  it('accepte un payload minimal { name } et retourne le projet créé', () => {
    const result = invoke(IPC_CHANNELS.projects.create, { name: 'Nouveau projet' })

    expect(repository.create).toHaveBeenCalledTimes(1)
    expect(result).toEqual(sampleProject)
  })

  it("applique le statut par défaut 'planning' avant l'appel au repository", () => {
    invoke(IPC_CHANNELS.projects.create, { name: 'Nouveau projet' })

    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'planning' }))
  })

  it('normalise les chaînes (trim) avant transmission au repository', () => {
    invoke(IPC_CHANNELS.projects.create, { name: '  Projet avec espaces  ' })

    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Projet avec espaces' }))
  })

  it('refuse un nom vide sans appeler le repository', () => {
    expect(() => invoke(IPC_CHANNELS.projects.create, { name: '' })).toThrow()
    expect(repository.create).not.toHaveBeenCalled()
  })

  it('refuse un statut invalide sans appeler le repository', () => {
    expect(() => invoke(IPC_CHANNELS.projects.create, { name: 'Projet', status: 'unknown' })).toThrow()
    expect(repository.create).not.toHaveBeenCalled()
  })

  it('refuse les champs inconnus sans appeler le repository', () => {
    expect(() =>
      invoke(IPC_CHANNELS.projects.create, { name: 'Projet', id: VALID_ID })
    ).toThrow()
    expect(repository.create).not.toHaveBeenCalled()
  })
})

describe('registerProjectsHandlers — projects:update', () => {
  it('valide id et payload puis appelle repository.update(id, input)', () => {
    const result = invoke(IPC_CHANNELS.projects.update, { id: VALID_ID, input: { name: 'Nouveau nom' } })

    expect(repository.update).toHaveBeenCalledWith(VALID_ID, { name: 'Nouveau nom' })
    expect(result).toEqual(sampleProject)
  })

  it('accepte null pour effacer un champ nullable', () => {
    invoke(IPC_CHANNELS.projects.update, { id: VALID_ID, input: { description: null } })

    expect(repository.update).toHaveBeenCalledWith(VALID_ID, { description: null })
  })

  it('refuse un objet input vide sans appeler le repository', () => {
    expect(() => invoke(IPC_CHANNELS.projects.update, { id: VALID_ID, input: {} })).toThrow()
    expect(repository.update).not.toHaveBeenCalled()
  })

  it('refuse un nom vide sans appeler le repository', () => {
    expect(() => invoke(IPC_CHANNELS.projects.update, { id: VALID_ID, input: { name: '' } })).toThrow()
    expect(repository.update).not.toHaveBeenCalled()
  })

  it('refuse un UUID invalide sans appeler le repository', () => {
    expect(() =>
      invoke(IPC_CHANNELS.projects.update, { id: 'not-a-uuid', input: { name: 'Nouveau nom' } })
    ).toThrow()
    expect(repository.update).not.toHaveBeenCalled()
  })

  it('refuse les champs techniques ou inconnus sans appeler le repository', () => {
    expect(() =>
      invoke(IPC_CHANNELS.projects.update, { id: VALID_ID, input: { name: 'Nouveau nom', createdAt: VALID_TIMESTAMP } })
    ).toThrow()
    expect(repository.update).not.toHaveBeenCalled()
  })

  it('retourne null si le repository retourne null', () => {
    ;(repository.update as ReturnType<typeof vi.fn>).mockReturnValueOnce(null)

    const result = invoke(IPC_CHANNELS.projects.update, { id: VALID_ID, input: { name: 'Nouveau nom' } })

    expect(result).toBeNull()
  })
})

describe('registerProjectsHandlers — projects:remove', () => {
  it('valide l\'identifiant et retourne true lorsque le repository retourne true', () => {
    const result = invoke(IPC_CHANNELS.projects.remove, VALID_ID)

    expect(repository.remove).toHaveBeenCalledWith(VALID_ID)
    expect(result).toBe(true)
  })

  it('retourne false lorsque le repository retourne false', () => {
    ;(repository.remove as ReturnType<typeof vi.fn>).mockReturnValueOnce(false)

    const result = invoke(IPC_CHANNELS.projects.remove, VALID_ID)

    expect(result).toBe(false)
  })

  it('refuse un UUID invalide sans appeler le repository', () => {
    expect(() => invoke(IPC_CHANNELS.projects.remove, 'not-a-uuid')).toThrow()
    expect(repository.remove).not.toHaveBeenCalled()
  })
})
