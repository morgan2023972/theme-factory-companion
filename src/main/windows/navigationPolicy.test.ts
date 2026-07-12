import { describe, expect, it } from 'vitest'
import { isTrustedNavigationUrl } from './navigationPolicy'

const TRUSTED_DEV_URL = 'http://localhost:5173/'
const TRUSTED_FILE_URL = 'file:///C:/theme-factory-companion/out/renderer/index.html'

describe('isTrustedNavigationUrl', () => {
  it("autorise l'URL de confiance exacte", () => {
    expect(isTrustedNavigationUrl(TRUSTED_DEV_URL, TRUSTED_DEV_URL)).toBe(true)
  })

  it('refuse une URL externe http(s)', () => {
    expect(isTrustedNavigationUrl(TRUSTED_DEV_URL, 'https://example.com')).toBe(false)
  })

  it('refuse un autre fichier local file://', () => {
    expect(
      isTrustedNavigationUrl(TRUSTED_FILE_URL, 'file:///C:/Windows/System32/notepad.exe')
    ).toBe(false)
  })

  it('refuse une URL malformée', () => {
    expect(isTrustedNavigationUrl(TRUSTED_FILE_URL, 'not-a-valid-url')).toBe(false)
  })
})
