export type ThemeFactoryEnvironment = 'development' | 'production'

export interface ThemeFactoryAppInfo {
  readonly name: string
  readonly phase: string
  readonly environment: ThemeFactoryEnvironment
}

export interface ThemeFactoryApi {
  readonly app: {
    readonly getInfo: () => ThemeFactoryAppInfo
  }
}
