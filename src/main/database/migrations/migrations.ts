import type { Migration } from './migrationTypes'
import { createInitialMvpSchemaMigration } from './0001_createInitialMvpSchema'

/**
 * Liste des migrations applicatives, dans l'ordre de leur ajout.
 * Une migration déjà validée et commitée est immuable : toute évolution
 * du schéma doit passer par une nouvelle migration.
 */
export const migrations: readonly Migration[] = [createInitialMvpSchemaMigration]
