import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from './runMigrations'
import type { Migration } from './migrationTypes'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
})

afterEach(() => {
  db.close()
})

function getMigrationRows(): Array<{ version: number; name: string; applied_at: string }> {
  return db
    .prepare('SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC')
    .all() as Array<{ version: number; name: string; applied_at: string }>
}

const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

describe('runMigrations', () => {
  it('crée automatiquement la table schema_migrations', () => {
    runMigrations(db, [])

    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
      .get()

    expect(table).toBeDefined()
  })

  it('crée schema_migrations avec les colonnes attendues', () => {
    runMigrations(db, [])

    const columns = db.prepare('PRAGMA table_info(schema_migrations)').all() as Array<{ name: string }>
    const columnNames = columns.map((column) => column.name)

    expect(columnNames).toEqual(['version', 'name', 'applied_at'])
  })

  it('exécute une migration non encore appliquée', () => {
    const migration: Migration = {
      version: 1,
      name: 'create test_items',
      up: (database) => {
        database.exec('CREATE TABLE test_items (id INTEGER PRIMARY KEY)')
      }
    }

    runMigrations(db, [migration])

    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'test_items'")
      .get()
    expect(table).toBeDefined()
  })

  it('enregistre version, name et applied_at après application', () => {
    const migration: Migration = {
      version: 1,
      name: 'create test_items',
      up: (database) => {
        database.exec('CREATE TABLE test_items (id INTEGER PRIMARY KEY)')
      }
    }

    runMigrations(db, [migration])

    const rows = getMigrationRows()
    expect(rows).toHaveLength(1)
    expect(rows[0].version).toBe(1)
    expect(rows[0].name).toBe('create test_items')
    expect(typeof rows[0].applied_at).toBe('string')
  })

  it('enregistre applied_at au format ISO 8601 valide', () => {
    const migration: Migration = {
      version: 1,
      name: 'create test_items',
      up: (database) => {
        database.exec('CREATE TABLE test_items (id INTEGER PRIMARY KEY)')
      }
    }

    runMigrations(db, [migration])

    const rows = getMigrationRows()
    expect(rows[0].applied_at).toMatch(ISO_8601_REGEX)
    expect(() => new Date(rows[0].applied_at).toISOString()).not.toThrow()
  })

  it("ne rejoue pas une migration déjà appliquée lors d'une deuxième exécution", () => {
    let runCount = 0
    const migration: Migration = {
      version: 1,
      name: 'create test_items',
      up: (database) => {
        runCount += 1
        database.exec('CREATE TABLE test_items (id INTEGER PRIMARY KEY)')
      }
    }

    runMigrations(db, [migration])
    const secondResult = runMigrations(db, [migration])

    expect(runCount).toBe(1)
    expect(secondResult.applied).toHaveLength(0)
    expect(getMigrationRows()).toHaveLength(1)
  })

  it('exécute plusieurs migrations dans l\'ordre croissant des versions', () => {
    const executionOrder: number[] = []
    const migrationList: Migration[] = [
      {
        version: 3,
        name: 'third',
        up: () => {
          executionOrder.push(3)
        }
      },
      {
        version: 1,
        name: 'first',
        up: () => {
          executionOrder.push(1)
        }
      },
      {
        version: 2,
        name: 'second',
        up: () => {
          executionOrder.push(2)
        }
      }
    ]

    runMigrations(db, migrationList)

    expect(executionOrder).toEqual([1, 2, 3])
    expect(getMigrationRows().map((row) => row.version)).toEqual([1, 2, 3])
  })

  it('refuse les versions dupliquées', () => {
    const migrationList: Migration[] = [
      { version: 1, name: 'first', up: () => {} },
      { version: 1, name: 'duplicate', up: () => {} }
    ]

    expect(() => runMigrations(db, migrationList)).toThrow(/dupliquée/)
    expect(getMigrationRows()).toHaveLength(0)
  })

  it('refuse la version zéro', () => {
    const migrationList: Migration[] = [{ version: 0, name: 'zero', up: () => {} }]

    expect(() => runMigrations(db, migrationList)).toThrow()
  })

  it('refuse une version négative', () => {
    const migrationList: Migration[] = [{ version: -1, name: 'negative', up: () => {} }]

    expect(() => runMigrations(db, migrationList)).toThrow()
  })

  it('refuse une version non entière', () => {
    const migrationList: Migration[] = [{ version: 1.5, name: 'non-integer', up: () => {} }]

    expect(() => runMigrations(db, migrationList)).toThrow()
  })

  it('refuse un nom vide', () => {
    const migrationList: Migration[] = [{ version: 1, name: '   ', up: () => {} }]

    expect(() => runMigrations(db, migrationList)).toThrow(/nom/i)
  })

  it("effectue un rollback complet d'une migration qui échoue", () => {
    const migrationList: Migration[] = [
      {
        version: 1,
        name: 'failing migration',
        up: (database) => {
          database.exec('CREATE TABLE test_items (id INTEGER PRIMARY KEY)')
          throw new Error('échec volontaire')
        }
      }
    ]

    expect(() => runMigrations(db, migrationList)).toThrow(/échec volontaire/)

    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'test_items'")
      .get()
    expect(table).toBeUndefined()
  })

  it("n'enregistre pas une migration en échec", () => {
    const migrationList: Migration[] = [
      {
        version: 1,
        name: 'failing migration',
        up: () => {
          throw new Error('échec volontaire')
        }
      }
    ]

    expect(() => runMigrations(db, migrationList)).toThrow()
    expect(getMigrationRows()).toHaveLength(0)
  })

  it("n'exécute pas les migrations suivantes après un échec", () => {
    let secondMigrationExecuted = false
    const migrationList: Migration[] = [
      {
        version: 1,
        name: 'failing migration',
        up: () => {
          throw new Error('échec volontaire')
        }
      },
      {
        version: 2,
        name: 'second migration',
        up: () => {
          secondMigrationExecuted = true
        }
      }
    ]

    expect(() => runMigrations(db, migrationList)).toThrow()
    expect(secondMigrationExecuted).toBe(false)
    expect(getMigrationRows()).toHaveLength(0)
  })

  it('retourne la liste des migrations nouvellement appliquées', () => {
    const migrationList: Migration[] = [
      { version: 1, name: 'first', up: (database) => database.exec('CREATE TABLE test_items (id INTEGER PRIMARY KEY)') },
      { version: 2, name: 'second', up: (database) => database.exec('CREATE TABLE sample_records (id INTEGER PRIMARY KEY)') }
    ]

    const result = runMigrations(db, migrationList)

    expect(result.applied).toHaveLength(2)
    expect(result.applied[0]).toMatchObject({ version: 1, name: 'first' })
    expect(result.applied[1]).toMatchObject({ version: 2, name: 'second' })

    const secondResult = runMigrations(db, migrationList)
    expect(secondResult.applied).toHaveLength(0)
  })

  it('accepte une liste vide sans erreur', () => {
    const result = runMigrations(db, [])

    expect(result.applied).toEqual([])
    expect(getMigrationRows()).toHaveLength(0)
  })

  it('deux appels successifs avec une liste vide restent sans effet', () => {
    runMigrations(db, [])
    const secondResult = runMigrations(db, [])

    expect(secondResult.applied).toEqual([])
    expect(getMigrationRows()).toHaveLength(0)
  })

  it('est idempotent : une deuxième exécution ne rejoue aucune migration et ne crée aucun doublon', () => {
    let counter = 0
    const migrationList: Migration[] = [
      {
        version: 1,
        name: 'create test_items',
        up: (database) => {
          counter += 1
          database.exec('CREATE TABLE test_items (id INTEGER PRIMARY KEY, value INTEGER)')
          database.exec(`INSERT INTO test_items (value) VALUES (${counter})`)
        }
      },
      {
        version: 2,
        name: 'create sample_records',
        up: (database) => {
          database.exec('CREATE TABLE sample_records (id INTEGER PRIMARY KEY)')
        }
      }
    ]

    const firstRun = runMigrations(db, migrationList)
    const secondRun = runMigrations(db, migrationList)

    expect(firstRun.applied).toHaveLength(2)
    expect(secondRun.applied).toHaveLength(0)

    const rows = getMigrationRows()
    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.version)).toEqual([1, 2])

    const items = db.prepare('SELECT value FROM test_items').all() as Array<{ value: number }>
    expect(items).toHaveLength(1)
    expect(counter).toBe(1)
  })
})
