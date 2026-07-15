import Database from 'better-sqlite3'
import { runMigrations } from './migrations/runMigrations'
import { checkDatabaseHealth } from './databaseHealth'

export type DatabaseConnection = Database.Database

let connection: DatabaseConnection | null = null

function configureConnection(db: DatabaseConnection): void {
  db.pragma('foreign_keys = ON')
  db.pragma('journal_mode = WAL')
}

function runHealthCheck(db: DatabaseConnection): void {
  const row = db.prepare('SELECT 1 AS value').get() as { value: number } | undefined

  if (row?.value !== 1) {
    throw new Error('Le contrôle SQLite SELECT 1 a échoué.')
  }
}

export function openDatabase(path: string): DatabaseConnection {
  if (connection) {
    return connection
  }

  const db = new Database(path)

  try {
    configureConnection(db)
    runHealthCheck(db)
    runMigrations(db)
    checkDatabaseHealth(db)
  } catch (error) {
    db.close()
    throw error
  }

  connection = db
  return connection
}

export function getDatabase(): DatabaseConnection {
  if (!connection) {
    throw new Error("La base de données n'est pas ouverte.")
  }

  return connection
}

export function isDatabaseOpen(): boolean {
  return connection !== null
}

export function closeDatabase(): void {
  if (!connection) {
    return
  }

  connection.close()
  connection = null
}
