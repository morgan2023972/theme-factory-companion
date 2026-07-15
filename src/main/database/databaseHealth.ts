import type Database from 'better-sqlite3'
import type { Migration } from './migrations/migrationTypes'
import { migrations as productionMigrations } from './migrations/migrations'

/**
 * Tables métier attendues après application de toutes les migrations connues.
 * Emplacement unique et typé pour cette liste (Phase 2.4).
 */
export const EXPECTED_BUSINESS_TABLES = [
  'projects',
  'phases',
  'tasks',
  'task_checklist_items',
  'questions',
  'issues',
  'decisions',
  'activity_log'
] as const

export type ExpectedBusinessTable = (typeof EXPECTED_BUSINESS_TABLES)[number]

export type DatabaseHealthReport = {
  readonly ok: true
  readonly sqliteVersion: string
  readonly foreignKeysEnabled: boolean
  readonly currentMigrationVersion: number
  readonly expectedMigrationVersion: number
  readonly appliedMigrationCount: number
  readonly tables: readonly ExpectedBusinessTable[]
}

function getSqliteVersion(db: Database.Database): string {
  const row = db.prepare('SELECT sqlite_version() AS version').get() as { version: string }
  return row.version
}

function isForeignKeysEnabled(db: Database.Database): boolean {
  return db.pragma('foreign_keys', { simple: true }) === 1
}

function tableExists(db: Database.Database, tableName: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName)
  return row !== undefined
}

function getAppliedMigrationVersions(db: Database.Database): number[] {
  const rows = db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all() as Array<{
    version: number
  }>
  return rows.map((row) => row.version)
}

/**
 * Vérifie l'état réel de la base après l'exécution des migrations.
 * Ne rejoue aucune migration : constate uniquement l'état obtenu.
 */
export function checkDatabaseHealth(
  db: Database.Database,
  knownMigrations: readonly Migration[] = productionMigrations
): DatabaseHealthReport {
  const sqliteVersion = getSqliteVersion(db)

  const foreignKeysEnabled = isForeignKeysEnabled(db)
  if (!foreignKeysEnabled) {
    throw new Error('Contrôle de santé SQLite échoué : PRAGMA foreign_keys est désactivé.')
  }

  if (!tableExists(db, 'schema_migrations')) {
    throw new Error("Contrôle de santé SQLite échoué : la table technique 'schema_migrations' est absente.")
  }

  const missingTables = EXPECTED_BUSINESS_TABLES.filter((table) => !tableExists(db, table))
  if (missingTables.length > 0) {
    throw new Error(
      `Contrôle de santé SQLite échoué : table(s) métier manquante(s) : ${missingTables.join(', ')}.`
    )
  }

  const expectedMigrationVersion = knownMigrations.reduce((max, migration) => Math.max(max, migration.version), 0)
  const appliedVersions = getAppliedMigrationVersions(db)
  const appliedVersionSet = new Set(appliedVersions)

  const missingMigrations = knownMigrations
    .map((migration) => migration.version)
    .filter((version) => !appliedVersionSet.has(version))
    .sort((a, b) => a - b)

  if (missingMigrations.length > 0) {
    throw new Error(
      `Contrôle de santé SQLite échoué : migration(s) connue(s) non appliquée(s) : ${missingMigrations.join(', ')}.`
    )
  }

  const currentMigrationVersion = appliedVersions.length > 0 ? Math.max(...appliedVersions) : 0

  if (currentMigrationVersion > expectedMigrationVersion) {
    throw new Error(
      `Contrôle de santé SQLite échoué : version de migration incompatible (base en version ${currentMigrationVersion}, application connaît jusqu'à la version ${expectedMigrationVersion}).`
    )
  }

  return {
    ok: true,
    sqliteVersion,
    foreignKeysEnabled,
    currentMigrationVersion,
    expectedMigrationVersion,
    appliedMigrationCount: appliedVersions.length,
    tables: EXPECTED_BUSINESS_TABLES
  }
}
