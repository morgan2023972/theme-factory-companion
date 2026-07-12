import { describe, expect, it } from 'vitest'
import { APP_NAME } from './appInfo'

describe('appInfo', () => {
  it("expose le nom de l'application", () => {
    expect(APP_NAME).toBe('Theme Factory Companion')
  })
})
