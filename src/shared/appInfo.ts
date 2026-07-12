import type { ThemeFactoryAppInfo, ThemeFactoryEnvironment } from './contracts/themeFactoryApi'

export const APP_NAME = 'Theme Factory Companion' as const
export const APP_PHASE = 'Phase 1' as const

export function createAppInfo(environment: ThemeFactoryEnvironment): ThemeFactoryAppInfo {
  return {
    name: APP_NAME,
    phase: APP_PHASE,
    environment
  }
}
