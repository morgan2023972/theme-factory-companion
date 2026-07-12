import { contextBridge } from 'electron'
import { createAppInfo } from '../shared/appInfo'
import type { ThemeFactoryApi, ThemeFactoryEnvironment } from '../shared/contracts/themeFactoryApi'

const ENVIRONMENT_ARG_PREFIX = '--tfc-environment='

function readEnvironmentFromArgv(): ThemeFactoryEnvironment {
  const arg = process.argv.find((value) => value.startsWith(ENVIRONMENT_ARG_PREFIX))
  const value = arg?.slice(ENVIRONMENT_ARG_PREFIX.length)

  return value === 'development' ? 'development' : 'production'
}

const themeFactoryApi: ThemeFactoryApi = {
  app: {
    getInfo: () => createAppInfo(readEnvironmentFromArgv())
  }
}

contextBridge.exposeInMainWorld('themeFactoryApi', themeFactoryApi)
