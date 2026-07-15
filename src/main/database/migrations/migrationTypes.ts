import type Database from 'better-sqlite3'

export type Migration = {
  readonly version: number
  readonly name: string
  readonly up: (database: Database.Database) => void
}

export type AppliedMigration = {
  readonly version: number
  readonly name: string
  readonly appliedAt: string
}

export type RunMigrationsResult = {
  readonly applied: readonly AppliedMigration[]
}
