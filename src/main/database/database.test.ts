import { afterEach, describe, expect, it } from 'vitest'
import { closeDatabase, getDatabase, isDatabaseOpen, openDatabase } from './database'

afterEach(() => {
  closeDatabase()
})

describe('database', () => {
  it('ouvre une connexion en mémoire et réussit le health check (SELECT 1)', () => {
    const db = openDatabase(':memory:')
    const row = db.prepare('SELECT 1 AS value').get() as { value: number }

    expect(row.value).toBe(1)
  })

  it('active les clés étrangères (PRAGMA foreign_keys)', () => {
    const db = openDatabase(':memory:')

    expect(db.pragma('foreign_keys', { simple: true })).toBe(1)
  })

  it("n'ouvre pas de connexion supplémentaire lors d'un second appel", () => {
    const first = openDatabase(':memory:')
    const second = openDatabase(':memory:')

    expect(second).toBe(first)
  })

  it('signale que la connexion est ouverte', () => {
    openDatabase(':memory:')

    expect(isDatabaseOpen()).toBe(true)
  })

  it("ne lève pas d'erreur si aucune connexion n'est ouverte lors de la fermeture", () => {
    expect(() => closeDatabase()).not.toThrow()
    expect(isDatabaseOpen()).toBe(false)
  })

  it("se ferme sans erreur et remet l'état à zéro", () => {
    openDatabase(':memory:')

    expect(() => closeDatabase()).not.toThrow()
    expect(isDatabaseOpen()).toBe(false)
  })

  it('permet de rouvrir une connexion après fermeture', () => {
    openDatabase(':memory:')
    closeDatabase()

    const db = openDatabase(':memory:')
    const row = db.prepare('SELECT 1 AS value').get() as { value: number }

    expect(row.value).toBe(1)
  })

  it("getDatabase lève une erreur explicite si aucune connexion n'est ouverte", () => {
    expect(() => getDatabase()).toThrow()
  })
})
