import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { checkDatabaseHealth, EXPECTED_BUSINESS_TABLES } from './databaseHealth'
import { closeDatabase, isDatabaseOpen, openDatabase } from './database'
import { runMigrations } from './migrations/runMigrations'
import type { Migration } from './migrations/migrationTypes'

function createDbWithForeignKeysOn(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  return db
}

function createBusinessTables(db: Database.Database): void {
  for (const table of EXPECTED_BUSINESS_TABLES) {
    db.exec(`CREATE TABLE ${table} (id TEXT PRIMARY KEY)`)
  }
}

function createSchemaMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `)
}

function insertAppliedMigration(db: Database.Database, version: number, name: string): void {
  db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
    version,
    name,
    new Date().toISOString()
  )
}

describe('checkDatabaseHealth — cas de succès (base réelle migrée)', () => {
  it('réussit après application de toutes les migrations de production', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db)

    const report = checkDatabaseHealth(db)

    expect(report.ok).toBe(true)
    db.close()
  })

  it('retourne la version SQLite', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db)

    const report = checkDatabaseHealth(db)

    expect(typeof report.sqliteVersion).toBe('string')
    expect(report.sqliteVersion).toMatch(/^\d+\.\d+\.\d+$/)
    db.close()
  })

  it('confirme que foreign_keys est activé', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db)

    const report = checkDatabaseHealth(db)

    expect(report.foreignKeysEnabled).toBe(true)
    db.close()
  })

  it('confirme la présence des huit tables métier', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db)

    const report = checkDatabaseHealth(db)

    expect(report.tables).toEqual(EXPECTED_BUSINESS_TABLES)
    expect(report.tables).toHaveLength(8)
    db.close()
  })

  it('confirme la version de migration attendue', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db)

    const report = checkDatabaseHealth(db)

    expect(report.currentMigrationVersion).toBe(report.expectedMigrationVersion)
    expect(report.currentMigrationVersion).toBe(2)
    expect(report.appliedMigrationCount).toBe(2)
    db.close()
  })
})

describe('checkDatabaseHealth — cas d\'échec (base mémoire contrôlée)', () => {
  it('échoue si foreign_keys est désactivé', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = OFF')
    createSchemaMigrationsTable(db)
    createBusinessTables(db)
    insertAppliedMigration(db, 1, 'test migration')

    const knownMigrations: Migration[] = [{ version: 1, name: 'test migration', up: () => {} }]

    expect(() => checkDatabaseHealth(db, knownMigrations)).toThrow(/foreign_keys/)
    db.close()
  })

  it('échoue si schema_migrations est absente', () => {
    const db = createDbWithForeignKeysOn()
    createBusinessTables(db)
    // schema_migrations volontairement absente.

    const knownMigrations: Migration[] = [{ version: 1, name: 'test migration', up: () => {} }]

    expect(() => checkDatabaseHealth(db, knownMigrations)).toThrow(/schema_migrations/)
    db.close()
  })

  it('échoue si une table métier attendue manque', () => {
    const db = createDbWithForeignKeysOn()
    createSchemaMigrationsTable(db)

    // Crée toutes les tables métier sauf 'activity_log'.
    for (const table of EXPECTED_BUSINESS_TABLES) {
      if (table === 'activity_log') continue
      db.exec(`CREATE TABLE ${table} (id TEXT PRIMARY KEY)`)
    }
    insertAppliedMigration(db, 1, 'test migration')

    const knownMigrations: Migration[] = [{ version: 1, name: 'test migration', up: () => {} }]

    expect(() => checkDatabaseHealth(db, knownMigrations)).toThrow(/activity_log/)
    db.close()
  })

  it("échoue si aucune migration connue n'est appliquée", () => {
    const db = createDbWithForeignKeysOn()
    createSchemaMigrationsTable(db)
    createBusinessTables(db)
    // Aucune ligne insérée dans schema_migrations.

    const knownMigrations: Migration[] = [{ version: 1, name: 'test migration', up: () => {} }]

    expect(() => checkDatabaseHealth(db, knownMigrations)).toThrow(/non appliquée/)
    db.close()
  })

  it("échoue si la dernière migration connue n'est pas appliquée", () => {
    const db = createDbWithForeignKeysOn()
    createSchemaMigrationsTable(db)
    createBusinessTables(db)
    insertAppliedMigration(db, 1, 'première migration')
    // La version 2, connue de l'application, n'a jamais été appliquée.

    const knownMigrations: Migration[] = [
      { version: 1, name: 'première migration', up: () => {} },
      { version: 2, name: 'deuxième migration', up: () => {} }
    ]

    expect(() => checkDatabaseHealth(db, knownMigrations)).toThrow(/2/)
    db.close()
  })

  it('échoue si la base contient une version de migration inconnue supérieure à la dernière version connue', () => {
    const db = createDbWithForeignKeysOn()
    createSchemaMigrationsTable(db)
    createBusinessTables(db)
    insertAppliedMigration(db, 1, 'première migration')
    insertAppliedMigration(db, 2, 'migration future inconnue')

    const knownMigrations: Migration[] = [{ version: 1, name: 'première migration', up: () => {} }]

    expect(() => checkDatabaseHealth(db, knownMigrations)).toThrow(/incompatible/)
    db.close()
  })
})

describe('checkDatabaseHealth — intégration avec openDatabase', () => {
  afterEach(() => {
    closeDatabase()
  })

  it('valide une base neuve migrée puis contrôlée via openDatabase', () => {
    expect(() => openDatabase(':memory:')).not.toThrow()
    expect(isDatabaseOpen()).toBe(true)
  })

  it("n'insère aucune donnée d'exemple", () => {
    const db = openDatabase(':memory:')

    for (const table of EXPECTED_BUSINESS_TABLES) {
      const count = (db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count
      expect(count).toBe(0)
    }
  })

  it("ferme la connexion sous-jacente si l'initialisation échoue après ouverture", () => {
    const dir = mkdtempSync(join(tmpdir(), 'tfc-db-health-'))
    const dbPath = join(dir, 'broken.sqlite')

    try {
      // Pré-crée un fichier SQLite avec une table 'projects' incompatible :
      // la migration de production échouera sur CREATE TABLE projects, sans
      // qu'aucune migration ni fichier de production ne soit modifié.
      const conflicting = new Database(dbPath)
      conflicting.exec('CREATE TABLE projects (id TEXT PRIMARY KEY)')
      conflicting.close()

      expect(() => openDatabase(dbPath)).toThrow()
      expect(isDatabaseOpen()).toBe(false)

      // Si la connexion défaillante avait été laissée ouverte, ce fichier
      // resterait verrouillé et cette réouverture échouerait.
      expect(() => new Database(dbPath).close()).not.toThrow()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
