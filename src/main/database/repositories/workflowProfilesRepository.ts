import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  createWorkflowProfileSchema,
  workflowProfileSchema,
  type CreateWorkflowProfileInput,
  type ValidationCommand,
  type WorkflowProfile
} from '../../../shared/orchestration'

/**
 * Forme d'une ligne SQLite de la table `workflow_profiles` (colonnes en
 * snake_case). Reste interne au repository : le contrat exposé est le type
 * partagé `WorkflowProfile`.
 */
type WorkflowProfileRow = {
  id: string
  name: string
  version: string
  created_at: string
  updated_at: string
}

/**
 * Forme d'une ligne SQLite de la table `workflow_profile_validation_commands`.
 * `args` est stocké en TEXT JSON (convention posée en ORCH-2.1).
 */
type ValidationCommandRow = {
  id: string
  workflow_profile_id: string
  name: string
  command: string
  args: string
  blocking: 0 | 1
  position: number
  created_at: string
  updated_at: string
}

function mapRowToValidationCommand(row: ValidationCommandRow): ValidationCommand {
  return {
    name: row.name,
    command: row.command,
    args: JSON.parse(row.args) as string[],
    blocking: row.blocking === 1
  }
}

function mapRowsToProfile(profileRow: WorkflowProfileRow, commandRows: ValidationCommandRow[]): WorkflowProfile {
  return workflowProfileSchema.parse({
    id: profileRow.id,
    name: profileRow.name,
    version: profileRow.version,
    validationCommands: commandRows.map(mapRowToValidationCommand),
    createdAt: profileRow.created_at,
    updatedAt: profileRow.updated_at
  })
}

export type WorkflowProfilesRepository = {
  readonly list: () => WorkflowProfile[]
  readonly getById: (id: string) => WorkflowProfile | null
  readonly create: (input: CreateWorkflowProfileInput) => WorkflowProfile
}

export type WorkflowProfilesRepositoryOptions = {
  /**
   * Fonction d'horloge injectable, utilisée pour générer `createdAt` et
   * `updatedAt`. Par défaut `() => new Date().toISOString()`.
   */
  readonly now?: () => string
}

/**
 * Crée le repository SQLite du module `workflow_profiles` (ORCH-2.2).
 * Reçoit une connexion `better-sqlite3` déjà ouverte : n'en ouvre ni n'en
 * ferme jamais elle-même. Aucune fonction `update`/`remove` : la gestion des
 * profils (versionnement, modification) est hors périmètre de cette phase,
 * reportée à ORCH-3.1.
 */
export function createWorkflowProfilesRepository(
  database: Database.Database,
  options: WorkflowProfilesRepositoryOptions = {}
): WorkflowProfilesRepository {
  const now = options.now ?? (() => new Date().toISOString())

  const listStatement = database.prepare(
    `SELECT id, name, version, created_at, updated_at
     FROM workflow_profiles
     ORDER BY created_at DESC, id DESC`
  )

  const getByIdStatement = database.prepare(
    `SELECT id, name, version, created_at, updated_at
     FROM workflow_profiles
     WHERE id = @id`
  )

  const listValidationCommandsStatement = database.prepare(
    `SELECT id, workflow_profile_id, name, command, args, blocking, position, created_at, updated_at
     FROM workflow_profile_validation_commands
     WHERE workflow_profile_id = @workflowProfileId
     ORDER BY position ASC`
  )

  const insertProfileStatement = database.prepare(
    `INSERT INTO workflow_profiles (id, name, version, created_at, updated_at)
     VALUES (@id, @name, @version, @created_at, @updated_at)`
  )

  const insertValidationCommandStatement = database.prepare(
    `INSERT INTO workflow_profile_validation_commands
       (id, workflow_profile_id, name, command, args, blocking, position, created_at, updated_at)
     VALUES (@id, @workflow_profile_id, @name, @command, @args, @blocking, @position, @created_at, @updated_at)`
  )

  function findProfileRowById(id: string): WorkflowProfileRow | undefined {
    return getByIdStatement.get({ id }) as WorkflowProfileRow | undefined
  }

  function findValidationCommandRows(workflowProfileId: string): ValidationCommandRow[] {
    return listValidationCommandsStatement.all({ workflowProfileId }) as ValidationCommandRow[]
  }

  function list(): WorkflowProfile[] {
    const rows = listStatement.all() as WorkflowProfileRow[]
    return rows.map((row) => mapRowsToProfile(row, findValidationCommandRows(row.id)))
  }

  function getById(id: string): WorkflowProfile | null {
    const row = findProfileRowById(id)
    return row ? mapRowsToProfile(row, findValidationCommandRows(id)) : null
  }

  /**
   * Insère le profil puis chaque commande de validation dans une
   * transaction : l'ordre du tableau fourni définit `position` (ordinal SQL
   * qui n'existe pas côté `ValidationCommand` Zod).
   */
  const runCreate = database.transaction((input: CreateWorkflowProfileInput): WorkflowProfile => {
    const data = createWorkflowProfileSchema.parse(input)
    const id = randomUUID()
    const timestamp = now()

    insertProfileStatement.run({
      id,
      name: data.name,
      version: data.version,
      created_at: timestamp,
      updated_at: timestamp
    })

    data.validationCommands.forEach((command, position) => {
      insertValidationCommandStatement.run({
        id: randomUUID(),
        workflow_profile_id: id,
        name: command.name,
        command: command.command,
        args: JSON.stringify(command.args),
        blocking: command.blocking ? 1 : 0,
        position,
        created_at: timestamp,
        updated_at: timestamp
      })
    })

    return mapRowsToProfile(findProfileRowById(id) as WorkflowProfileRow, findValidationCommandRows(id))
  })

  function create(input: CreateWorkflowProfileInput): WorkflowProfile {
    return runCreate(input)
  }

  return { list, getById, create }
}
