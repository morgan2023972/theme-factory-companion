import { describe, expect, it } from 'vitest'
import { APP_NAME, APP_PHASE, createAppInfo } from './appInfo'

describe('appInfo', () => {
  it("expose le nom de l'application", () => {
    expect(APP_NAME).toBe('Theme Factory Companion')
  })
})

describe('createAppInfo', () => {
  it('retourne les informations attendues en développement', () => {
    expect(createAppInfo('development')).toEqual({
      name: APP_NAME,
      phase: APP_PHASE,
      environment: 'development'
    })
  })

  it('retourne les informations attendues en production', () => {
    expect(createAppInfo('production')).toEqual({
      name: APP_NAME,
      phase: APP_PHASE,
      environment: 'production'
    })
  })
})
