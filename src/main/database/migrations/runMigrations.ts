import type Database from 'better-sqlite3'
import type { AppliedMigration, Migration, RunMigrationsResult } from './migrationTypes'
import { migrations as productionMigrations } from './migrations'

function ensureMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `)
}

function validateMigrations(migrationList: readonly Migration[]): void {
  const seenVersions = new Set<number>()

  for (const migration of migrationList) {
    if (!Number.isInteger(migration.version)) {
      throw new Error(`Version de migration invalide (doit être un entier) : ${String(migration.version)}`)
    }

    if (migration.version <= 0) {
      throw new Error(`Version de migration invalide (doit être strictement positive) : ${migration.version}`)
    }

    if (seenVersions.has(migration.version)) {
      throw new Error(`Version de migration dupliquée : ${migration.version}`)
    }
    seenVersions.add(migration.version)

    if (typeof migration.name !== 'string' || migration.name.trim().length === 0) {
      throw new Error(`Nom de migration invalide pour la version ${migration.version} : le nom ne peut pas être vide.`)
    }

    if (typeof migration.up !== 'function') {
      throw new Error(`Migration invalide pour la version ${migration.version} : "up" doit être une fonction.`)
    }
  }
}

function sortByVersion(migrationList: readonly Migration[]): Migration[] {
  return [...migrationList].sort((a, b) => a.version - b.version)
}

function getAppliedVersions(db: Database.Database): Set<number> {
  const rows = db.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: number }>
  return new Set(rows.map((row) => row.version))
}

export function runMigrations(
  db: Database.Database,
  migrationList: readonly Migration[] = productionMigrations
): RunMigrationsResult {
  ensureMigrationsTable(db)
  validateMigrations(migrationList)

  const sortedMigrations = sortByVersion(migrationList)
  const appliedVersions = getAppliedVersions(db)
  const insertMigration = db.prepare(
    'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
  )

  const appliedNow: AppliedMigration[] = []

  for (const migration of sortedMigrations) {
    if (appliedVersions.has(migration.version)) {
      continue
    }

    const applyMigration = db.transaction(() => {
      migration.up(db)
      const appliedAt = new Date().toISOString()
      insertMigration.run(migration.version, migration.name, appliedAt)
      return appliedAt
    })

    try {
      const appliedAt = applyMigration()
      appliedNow.push({ version: migration.version, name: migration.name, appliedAt })
    } catch (error) {
      const cause = error instanceof Error ? error : new Error(String(error))
      throw new Error(
        `Échec de la migration ${migration.version} ("${migration.name}") : ${cause.message}`,
        { cause }
      )
    }
  }

  return { applied: appliedNow }
}
