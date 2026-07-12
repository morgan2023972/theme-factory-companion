import { describe, expect, it } from 'vitest'
import { DEFAULT_NAVIGATION_ID, NAVIGATION_DESTINATIONS } from './navigation'

describe('navigation', () => {
  it('expose exactement les huit destinations attendues', () => {
    expect(NAVIGATION_DESTINATIONS).toHaveLength(8)
  })

  it('a des identifiants uniques', () => {
    const ids = NAVIGATION_DESTINATIONS.map((destination) => destination.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('possède une destination par défaut qui existe bien parmi les destinations', () => {
    expect(NAVIGATION_DESTINATIONS.some((destination) => destination.id === DEFAULT_NAVIGATION_ID)).toBe(
      true
    )
  })

  it("n'a pas de libellés dupliqués", () => {
    const labels = NAVIGATION_DESTINATIONS.map((destination) => destination.label)
    expect(new Set(labels).size).toBe(labels.length)
  })
})
