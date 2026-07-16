import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  createProjectSchema,
  projectSchema,
  updateProjectSchema,
  type CreateProjectInput,
  type Project,
  type ProjectStatus,
  type UpdateProjectInput
} from '../../../shared/schemas/project'

/**
 * Forme d'une ligne SQLite de la table `projects` (colonnes en snake_case).
 * Reste interne au repository : le contrat exposé est le type partagé `Project`.
 */
type ProjectRow = {
  id: string
  name: string
  description: string | null
  objective: string | null
  status: ProjectStatus
  repository_path: string | null
  target_technology: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

/**
 * Correspondance fermée entre les clés modifiables du contrat partagé et les
 * colonnes SQL autorisées. Seule cette table peut alimenter le SQL généré
 * dynamiquement par `update` : aucun nom de colonne fourni par l'appelant
 * n'est jamais utilisé directement.
 */
const UPDATABLE_COLUMNS_BY_FIELD: Record<keyof UpdateProjectInput, string> = {
  name: 'name',
  description: 'description',
  objective: 'objective',
  status: 'status',
  repositoryPath: 'repository_path',
  targetTechnology: 'target_technology',
  notes: 'notes'
}

function mapRowToProject(row: ProjectRow): Project {
  return projectSchema.parse({
    id: row.id,
    name: row.name,
    description: row.description,
    objective: row.objective,
    status: row.status,
    repositoryPath: row.repository_path,
    targetTechnology: row.target_technology,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  })
}

export type ProjectsRepository = {
  readonly list: () => Project[]
  readonly getById: (id: string) => Project | null
  readonly create: (input: CreateProjectInput) => Project
  readonly update: (id: string, input: UpdateProjectInput) => Project | null
  readonly remove: (id: string) => boolean
}

export type ProjectsRepositoryOptions = {
  /**
   * Fonction d'horloge injectable, utilisée pour générer `createdAt` et
   * `updatedAt`. Par défaut `() => new Date().toISOString()`. Permet aux
   * tests d'obtenir des timestamps déterministes et distincts sans ajouter
   * de mécanisme générique de gestion du temps hors périmètre.
   */
  readonly now?: () => string
}

/**
 * Crée le repository SQLite du module `projects`.
 * Reçoit une connexion `better-sqlite3` déjà ouverte : n'en ouvre ni n'en
 * ferme jamais elle-même.
 */
export function createProjectsRepository(
  database: Database.Database,
  options: ProjectsRepositoryOptions = {}
): ProjectsRepository {
  const now = options.now ?? (() => new Date().toISOString())

  const listStatement = database.prepare(
    `SELECT id, name, description, objective, status, repository_path, target_technology, notes, created_at, updated_at
     FROM projects
     ORDER BY created_at DESC, id DESC`
  )

  const getByIdStatement = database.prepare(
    `SELECT id, name, description, objective, status, repository_path, target_technology, notes, created_at, updated_at
     FROM projects
     WHERE id = @id`
  )

  const insertStatement = database.prepare(
    `INSERT INTO projects (id, name, description, objective, status, repository_path, target_technology, notes, created_at, updated_at)
     VALUES (@id, @name, @description, @objective, @status, @repository_path, @target_technology, @notes, @created_at, @updated_at)`
  )

  const deleteStatement = database.prepare('DELETE FROM projects WHERE id = @id')

  function findRowById(id: string): ProjectRow | undefined {
    return getByIdStatement.get({ id }) as ProjectRow | undefined
  }

  function list(): Project[] {
    const rows = listStatement.all() as ProjectRow[]
    return rows.map(mapRowToProject)
  }

  function getById(id: string): Project | null {
    const row = findRowById(id)
    return row ? mapRowToProject(row) : null
  }

  function create(input: CreateProjectInput): Project {
    const data = createProjectSchema.parse(input)
    const id = randomUUID()
    const timestamp = now()

    insertStatement.run({
      id,
      name: data.name,
      description: data.description ?? null,
      objective: data.objective ?? null,
      status: data.status,
      repository_path: data.repositoryPath ?? null,
      target_technology: data.targetTechnology ?? null,
      notes: data.notes ?? null,
      created_at: timestamp,
      updated_at: timestamp
    })

    return mapRowToProject(findRowById(id) as ProjectRow)
  }

  /**
   * Construction dynamique de l'UPDATE : le schéma de mise à jour n'a qu'un
   * nombre limité de champs connus. On ne prépare qu'une requête par
   * ensemble de champs fournis (au lieu d'une requête statique à COALESCE,
   * qui ne permettrait pas de distinguer un champ absent d'un champ fourni
   * à `null`). Les noms de colonnes proviennent exclusivement de
   * `UPDATABLE_COLUMNS_BY_FIELD`, jamais de l'entrée utilisateur.
   * `data[field] === undefined` est explicitement exclu de la boucle : une
   * clé fournie à `undefined` (ex. `{ description: undefined }` obtenu par
   * étalement d'un objet partiellement rempli) ne doit jamais être
   * confondue avec un `null` explicite, qui seul doit effacer un champ
   * nullable.
   */
  function update(id: string, input: UpdateProjectInput): Project | null {
    const data = updateProjectSchema.parse(input)

    const existing = findRowById(id)
    if (!existing) {
      return null
    }

    const updatedAt = now()
    const assignments: string[] = []
    const params: Record<string, unknown> = { id, updated_at: updatedAt }

    for (const [field, column] of Object.entries(UPDATABLE_COLUMNS_BY_FIELD) as Array<
      [keyof UpdateProjectInput, string]
    >) {
      if (!(field in data) || data[field] === undefined) {
        continue
      }

      assignments.push(`${column} = @${column}`)
      params[column] = data[field] ?? null
    }

    assignments.push('updated_at = @updated_at')

    const updateStatement = database.prepare(`UPDATE projects SET ${assignments.join(', ')} WHERE id = @id`)
    updateStatement.run(params)

    return mapRowToProject(findRowById(id) as ProjectRow)
  }

  function remove(id: string): boolean {
    const result = deleteStatement.run({ id })
    return result.changes > 0
  }

  return { list, getById, create, update, remove }
}
