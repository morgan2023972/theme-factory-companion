import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '../../shared/contracts/ipcChannels'
import type { Phase } from '../../shared/schemas/phase'
import type { PhasesRepository } from '../database/repositories/phasesRepository'
import { registerPhasesHandlers } from './registerPhasesHandlers'
import type { IpcHandleListener, IpcMainLike } from './registerProjectsHandlers'

const VALID_ID = '123e4567-e89b-12d3-a456-426614174000'
const OTHER_VALID_ID = '00000000-0000-4000-8000-000000000002'
const VALID_PROJECT_ID = '11111111-1111-4111-8111-111111111111'
const VALID_TIMESTAMP = '2026-07-16T10:00:00.000Z'

const samplePhase: Phase = {
  id: VALID_ID,
  projectId: VALID_PROJECT_ID,
  name: 'Phase de test',
  description: null,
  status: 'pending',
  position: 0,
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

function createFakeRepository(): PhasesRepository {
  return {
    listByProjectId: vi.fn(() => [samplePhase]),
    getById: vi.fn(() => samplePhase),
    create: vi.fn(() => samplePhase),
    update: vi.fn(() => samplePhase),
    remove: vi.fn(() => true)
  }
}

let fakeIpcMain: ReturnType<typeof createFakeIpcMain>
let repository: PhasesRepository

beforeEach(() => {
  fakeIpcMain = createFakeIpcMain()
  repository = createFakeRepository()
  registerPhasesHandlers({ ipcMain: fakeIpcMain.ipcMain, phasesRepository: repository })
})

function invoke(channel: string, ...args: readonly unknown[]): unknown {
  const listener = fakeIpcMain.handlers.get(channel)
  if (!listener) {
    throw new Error(`Aucun handler enregistré pour le canal ${channel}`)
  }
  return listener({}, ...args)
}

describe('registerPhasesHandlers — enregistrement', () => {
  it('enregistre les cinq canaux attendus', () => {
    expect([...fakeIpcMain.handlers.keys()].sort()).toEqual(Object.values(IPC_CHANNELS.phases).sort())
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
      expect(Object.values(IPC_CHANNELS.phases)).toContain(channel)
    }
  })
})

describe('registerPhasesHandlers — phases:listByProjectId', () => {
  it('accepte un projectId valide et appelle le repository avec cet identifiant', () => {
    const result = invoke(IPC_CHANNELS.phases.listByProjectId, VALID_PROJECT_ID)

    expect(repository.listByProjectId).toHaveBeenCalledWith(VALID_PROJECT_ID)
    expect(result).toEqual([samplePhase])
  })

  it('refuse un projectId invalide sans appeler le repository', () => {
    expect(() => invoke(IPC_CHANNELS.phases.listByProjectId, 'not-a-uuid')).toThrow()
    expect(repository.listByProjectId).not.toHaveBeenCalled()
  })
})

describe('registerPhasesHandlers — phases:getById', () => {
  it('accepte un UUID valide et appelle le repository avec cet identifiant', () => {
    const result = invoke(IPC_CHANNELS.phases.getById, VALID_ID)

    expect(repository.getById).toHaveBeenCalledWith(VALID_ID)
    expect(result).toEqual(samplePhase)
  })

  it('retourne null si le repository retourne null', () => {
    ;(repository.getById as ReturnType<typeof vi.fn>).mockReturnValueOnce(null)

    const result = invoke(IPC_CHANNELS.phases.getById, OTHER_VALID_ID)

    expect(result).toBeNull()
  })

  it('refuse un UUID invalide sans appeler le repository', () => {
    expect(() => invoke(IPC_CHANNELS.phases.getById, 'not-a-uuid')).toThrow()
    expect(repository.getById).not.toHaveBeenCalled()
  })
})

describe('registerPhasesHandlers — phases:create', () => {
  it('accepte un payload minimal { projectId, name } et retourne la phase créée', () => {
    const result = invoke(IPC_CHANNELS.phases.create, { projectId: VALID_PROJECT_ID, name: 'Nouvelle phase' })

    expect(repository.create).toHaveBeenCalledTimes(1)
    expect(result).toEqual(samplePhase)
  })

  it("applique le statut par défaut 'pending' avant l'appel au repository", () => {
    invoke(IPC_CHANNELS.phases.create, { projectId: VALID_PROJECT_ID, name: 'Nouvelle phase' })

    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }))
  })

  it('normalise les chaînes (trim) avant transmission au repository', () => {
    invoke(IPC_CHANNELS.phases.create, { projectId: VALID_PROJECT_ID, name: '  Phase avec espaces  ' })

    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Phase avec espaces' }))
  })

  it('refuse un nom vide sans appeler le repository', () => {
    expect(() => invoke(IPC_CHANNELS.phases.create, { projectId: VALID_PROJECT_ID, name: '' })).toThrow()
    expect(repository.create).not.toHaveBeenCalled()
  })

  it('refuse un projectId invalide sans appeler le repository', () => {
    expect(() => invoke(IPC_CHANNELS.phases.create, { projectId: 'not-a-uuid', name: 'Phase' })).toThrow()
    expect(repository.create).not.toHaveBeenCalled()
  })

  it('refuse un statut invalide sans appeler le repository', () => {
    expect(() =>
      invoke(IPC_CHANNELS.phases.create, { projectId: VALID_PROJECT_ID, name: 'Phase', status: 'unknown' })
    ).toThrow()
    expect(repository.create).not.toHaveBeenCalled()
  })

  it('refuse les champs inconnus sans appeler le repository', () => {
    expect(() =>
      invoke(IPC_CHANNELS.phases.create, { projectId: VALID_PROJECT_ID, name: 'Phase', id: VALID_ID })
    ).toThrow()
    expect(repository.create).not.toHaveBeenCalled()
  })
})

describe('registerPhasesHandlers — phases:update', () => {
  it('valide id et payload puis appelle repository.update(id, input)', () => {
    const result = invoke(IPC_CHANNELS.phases.update, { id: VALID_ID, input: { name: 'Nouveau nom' } })

    expect(repository.update).toHaveBeenCalledWith(VALID_ID, { name: 'Nouveau nom' })
    expect(result).toEqual(samplePhase)
  })

  it('accepte null pour effacer un champ nullable', () => {
    invoke(IPC_CHANNELS.phases.update, { id: VALID_ID, input: { description: null } })

    expect(repository.update).toHaveBeenCalledWith(VALID_ID, { description: null })
  })

  it('conserve les mises à jour partielles sans les transformer en remplacement complet', () => {
    invoke(IPC_CHANNELS.phases.update, { id: VALID_ID, input: { position: 3 } })

    expect(repository.update).toHaveBeenCalledWith(VALID_ID, { position: 3 })
  })

  it('refuse un objet input vide sans appeler le repository', () => {
    expect(() => invoke(IPC_CHANNELS.phases.update, { id: VALID_ID, input: {} })).toThrow()
    expect(repository.update).not.toHaveBeenCalled()
  })

  it('refuse un nom vide sans appeler le repository', () => {
    expect(() => invoke(IPC_CHANNELS.phases.update, { id: VALID_ID, input: { name: '' } })).toThrow()
    expect(repository.update).not.toHaveBeenCalled()
  })

  it('refuse un UUID invalide sans appeler le repository', () => {
    expect(() =>
      invoke(IPC_CHANNELS.phases.update, { id: 'not-a-uuid', input: { name: 'Nouveau nom' } })
    ).toThrow()
    expect(repository.update).not.toHaveBeenCalled()
  })

  it('refuse les champs techniques ou inconnus sans appeler le repository', () => {
    expect(() =>
      invoke(IPC_CHANNELS.phases.update, {
        id: VALID_ID,
        input: { name: 'Nouveau nom', projectId: VALID_PROJECT_ID }
      })
    ).toThrow()
    expect(repository.update).not.toHaveBeenCalled()
  })

  it('retourne null si le repository retourne null', () => {
    ;(repository.update as ReturnType<typeof vi.fn>).mockReturnValueOnce(null)

    const result = invoke(IPC_CHANNELS.phases.update, { id: VALID_ID, input: { name: 'Nouveau nom' } })

    expect(result).toBeNull()
  })
})

describe('registerPhasesHandlers — phases:remove', () => {
  it("valide l'identifiant et retourne true lorsque le repository retourne true", () => {
    const result = invoke(IPC_CHANNELS.phases.remove, VALID_ID)

    expect(repository.remove).toHaveBeenCalledWith(VALID_ID)
    expect(result).toBe(true)
  })

  it('retourne false lorsque le repository retourne false', () => {
    ;(repository.remove as ReturnType<typeof vi.fn>).mockReturnValueOnce(false)

    const result = invoke(IPC_CHANNELS.phases.remove, VALID_ID)

    expect(result).toBe(false)
  })

  it('refuse un UUID invalide sans appeler le repository', () => {
    expect(() => invoke(IPC_CHANNELS.phases.remove, 'not-a-uuid')).toThrow()
    expect(repository.remove).not.toHaveBeenCalled()
  })
})
