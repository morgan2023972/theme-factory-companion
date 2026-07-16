import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '../shared/contracts/ipcChannels'

const exposeInMainWorld = vi.fn()
const invoke = vi.fn()

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld },
  ipcRenderer: { invoke }
}))

const VALID_ID = '123e4567-e89b-12d3-a456-426614174000'

async function loadPreload(): Promise<void> {
  vi.resetModules()
  exposeInMainWorld.mockClear()
  invoke.mockClear()
  await import('./index')
}

describe('preload — themeFactoryApi', () => {
  beforeEach(async () => {
    await loadPreload()
  })

  it('expose l\'API sous le nom exact "themeFactoryApi"', () => {
    expect(exposeInMainWorld).toHaveBeenCalledTimes(1)
    expect(exposeInMainWorld.mock.calls[0]?.[0]).toBe('themeFactoryApi')
  })

  it('conserve l\'API app.getInfo existante', () => {
    const api = exposeInMainWorld.mock.calls[0]?.[1]
    expect(typeof api.app.getInfo).toBe('function')
    expect(api.app.getInfo()).toMatchObject({ name: expect.any(String), phase: expect.any(String) })
  })

  it("n'expose aucun objet ipcRenderer brut ni de méthode générique invoke/send/on", () => {
    const api = exposeInMainWorld.mock.calls[0]?.[1]
    expect(api.ipcRenderer).toBeUndefined()
    expect(api.invoke).toBeUndefined()
    expect(api.send).toBeUndefined()
    expect(api.on).toBeUndefined()
    expect(api.projects.invoke).toBeUndefined()
    expect(api.projects.send).toBeUndefined()
    expect(api.projects.on).toBeUndefined()
  })

  it('projects.list() invoque uniquement le canal projects:list, sans argument', async () => {
    const api = exposeInMainWorld.mock.calls[0]?.[1]
    invoke.mockResolvedValueOnce([])

    await api.projects.list()

    expect(invoke).toHaveBeenCalledTimes(1)
    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.projects.list)
  })

  it('projects.getById(id) transmet correctement le canal et l\'identifiant', async () => {
    const api = exposeInMainWorld.mock.calls[0]?.[1]
    invoke.mockResolvedValueOnce(null)

    await api.projects.getById(VALID_ID)

    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.projects.getById, VALID_ID)
  })

  it('projects.create(input) transmet correctement le canal et le payload', async () => {
    const api = exposeInMainWorld.mock.calls[0]?.[1]
    const input = { name: 'Nouveau projet' }
    invoke.mockResolvedValueOnce({})

    await api.projects.create(input)

    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.projects.create, input)
  })

  it('projects.update(id, input) transmet la structure { id, input } attendue', async () => {
    const api = exposeInMainWorld.mock.calls[0]?.[1]
    const input = { name: 'Nouveau nom' }
    invoke.mockResolvedValueOnce({})

    await api.projects.update(VALID_ID, input)

    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.projects.update, { id: VALID_ID, input })
  })

  it('projects.remove(id) transmet correctement le canal et l\'identifiant', async () => {
    const api = exposeInMainWorld.mock.calls[0]?.[1]
    invoke.mockResolvedValueOnce(true)

    await api.projects.remove(VALID_ID)

    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.projects.remove, VALID_ID)
  })

  it('aucun canal arbitraire ne peut être fourni par le renderer (surface figée par canal)', () => {
    const api = exposeInMainWorld.mock.calls[0]?.[1]
    expect(Object.keys(api.projects).sort()).toEqual(['create', 'getById', 'list', 'remove', 'update'])
  })
})
