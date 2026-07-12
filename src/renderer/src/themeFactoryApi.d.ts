import type { ThemeFactoryApi } from '../../shared/contracts/themeFactoryApi'

declare global {
  interface Window {
    readonly themeFactoryApi: ThemeFactoryApi
  }
}

export {}
