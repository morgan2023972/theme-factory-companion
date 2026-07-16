import { contextBridge, ipcRenderer } from 'electron'
import { createAppInfo } from '../shared/appInfo'
import { IPC_CHANNELS } from '../shared/contracts/ipcChannels'
import type { ThemeFactoryApi, ThemeFactoryEnvironment } from '../shared/contracts/themeFactoryApi'
import type { CreateProjectInput, Project, UpdateProjectInput } from '../shared/schemas/project'

const ENVIRONMENT_ARG_PREFIX = '--tfc-environment='

function readEnvironmentFromArgv(): ThemeFactoryEnvironment {
  const arg = process.argv.find((value) => value.startsWith(ENVIRONMENT_ARG_PREFIX))
  const value = arg?.slice(ENVIRONMENT_ARG_PREFIX.length)

  return value === 'development' ? 'development' : 'production'
}

const themeFactoryApi: ThemeFactoryApi = {
  app: {
    getInfo: () => createAppInfo(readEnvironmentFromArgv())
  },
  projects: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.projects.list) as Promise<Project[]>,
    getById: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.projects.getById, id) as Promise<Project | null>,
    create: (input: CreateProjectInput) => ipcRenderer.invoke(IPC_CHANNELS.projects.create, input) as Promise<Project>,
    update: (id: string, input: UpdateProjectInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.projects.update, { id, input }) as Promise<Project | null>,
    remove: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.projects.remove, id) as Promise<boolean>
  }
}

contextBridge.exposeInMainWorld('themeFactoryApi', themeFactoryApi)
