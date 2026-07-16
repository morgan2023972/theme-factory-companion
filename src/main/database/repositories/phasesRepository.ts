import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  createPhaseSchema,
  phaseSchema,
  updatePhaseSchema,
  type CreatePhaseInput,
  type Phase,
  type PhaseStatus,
  type UpdatePhaseInput
} from '../../../shared/schemas/phase'

/**
 * Forme d'une ligne SQLite de la table `phases` (colonnes en snake_case).
 * Reste interne au repository : le contrat exposé est le type partagé `Phase`.
 */
type PhaseRow = {
  id: string
  project_id: string
  name: string
  description: string | null
  status: PhaseStatus
  position: number
  created_at: string
  updated_at: string
}

/**
 * Correspondance fermée entre les clés modifiables du contrat partagé et les
 * colonnes SQL autorisées. Seule cette table peut alimenter le SQL généré
 * dynamiquement par `update` : aucun nom de colonne fourni par l'appelant
 * n'est jamais utilisé directement. `projectId` est volontairement absent :
 * cette phase n'autorise pas le déplacement d'une phase vers un autre projet.
 */
const UPDATABLE_COLUMNS_BY_FIELD: Record<keyof UpdatePhaseInput, string> = {
  name: 'name',
  description: 'description',
  status: 'status',
  position: 'position'
}

function mapRowToPhase(row: PhaseRow): Phase {
  return phaseSchema.parse({
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    status: row.status,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  })
}

export type PhasesRepository = {
  readonly listByProjectId: (projectId: string) => Phase[]
  readonly getById: (id: string) => Phase | null
  readonly create: (input: CreatePhaseInput) => Phase
  readonly update: (id: string, input: UpdatePhaseInput) => Phase | null
  readonly remove: (id: string) => boolean
}

export type PhasesRepositoryOptions = {
  /**
   * Fonction d'horloge injectable, utilisée pour générer `createdAt` et
   * `updatedAt`. Par défaut `() => new Date().toISOString()`. Permet aux
   * tests d'obtenir des timestamps déterministes et distincts (même
   * convention que `projectsRepository`).
   */
  readonly now?: () => string
}

/**
 * Crée le repository SQLite du module `phases`.
 * Reçoit une connexion `better-sqlite3` déjà ouverte : n'en ouvre ni n'en
 * ferme jamais elle-même.
 */
export function createPhasesRepository(
  database: Database.Database,
  options: PhasesRepositoryOptions = {}
): PhasesRepository {
  const now = options.now ?? (() => new Date().toISOString())

  const listByProjectStatement = database.prepare(
    `SELECT id, project_id, name, description, status, position, created_at, updated_at
     FROM phases
     WHERE project_id = @projectId
     ORDER BY position ASC, created_at ASC, id ASC`
  )

  const getByIdStatement = database.prepare(
    `SELECT id, project_id, name, description, status, position, created_at, updated_at
     FROM phases
     WHERE id = @id`
  )

  /**
   * `UNIQUE (project_id, position)` garantit qu'aucune paire (position ASC,
   * created_at ASC) ne peut réellement être à égalité pour un même projet ;
   * `created_at ASC, id ASC` restent ajoutés par défensivité et lisibilité,
   * sans quoi le tri ne reposerait que sur une seule colonne.
   */
  const nextPositionStatement = database.prepare(
    `SELECT COALESCE(MAX(position), -1) + 1 AS nextPosition
     FROM phases
     WHERE project_id = @projectId`
  )

  const insertStatement = database.prepare(
    `INSERT INTO phases (id, project_id, name, description, status, position, created_at, updated_at)
     VALUES (@id, @project_id, @name, @description, @status, @position, @created_at, @updated_at)`
  )

  const deleteStatement = database.prepare('DELETE FROM phases WHERE id = @id')

  function findRowById(id: string): PhaseRow | undefined {
    return getByIdStatement.get({ id }) as PhaseRow | undefined
  }

  function listByProjectId(projectId: string): Phase[] {
    const rows = listByProjectStatement.all({ projectId }) as PhaseRow[]
    return rows.map(mapRowToPhase)
  }

  function getById(id: string): Phase | null {
    const row = findRowById(id)
    return row ? mapRowToPhase(row) : null
  }

  /**
   * Le calcul de la position suivante et l'insertion sont regroupés dans une
   * transaction courte : elle garantit l'atomicité de l'opération composée
   * « calcul de la prochaine position + insertion ». Si `insertStatement.run`
   * échoue après un calcul de position par ailleurs correct (par exemple une
   * violation de contrainte), la transaction évite qu'une écriture
   * partielle ne persiste. Elle ne protège en revanche pas contre un
   * entrelacement de plusieurs appels concurrents : `better-sqlite3` est
   * strictement synchrone et Node.js exécute ce code sur un seul thread, si
   * bien qu'un appel à `create()` s'exécute intégralement avant qu'un autre
   * (même déclenché par un futur handler IPC distinct) puisse commencer —
   * ce scénario de concurrence n'existe donc pas dans cette architecture.
   * Aucun mécanisme de réordonnancement complet n'est ajouté ici : seule la
   * position par défaut d'une nouvelle phase est calculée.
   */
  const runCreate = database.transaction((input: CreatePhaseInput): Phase => {
    const data = createPhaseSchema.parse(input)
    const id = randomUUID()
    const timestamp = now()

    const position =
      data.position ??
      (nextPositionStatement.get({ projectId: data.projectId }) as { nextPosition: number }).nextPosition

    insertStatement.run({
      id,
      project_id: data.projectId,
      name: data.name,
      description: data.description ?? null,
      status: data.status,
      position,
      created_at: timestamp,
      updated_at: timestamp
    })

    return mapRowToPhase(findRowById(id) as PhaseRow)
  })

  function create(input: CreatePhaseInput): Phase {
    return runCreate(input)
  }

  /**
   * Construction dynamique de l'UPDATE, identique à la stratégie retenue
   * dans `projectsRepository` : une requête préparée par ensemble de champs
   * fournis, à partir exclusivement de `UPDATABLE_COLUMNS_BY_FIELD`. Si la
   * position fournie entre en collision avec `UNIQUE (project_id,
   * position)` d'une autre phase du même projet, SQLite lève une erreur qui
   * remonte telle quelle (aucun réordonnancement automatique des autres
   * phases n'est implémenté dans cette phase).
   * `data[field] === undefined` est explicitement exclu de la boucle : une
   * clé fournie à `undefined` (ex. `{ description: undefined }` obtenu par
   * étalement d'un objet partiellement rempli) ne doit jamais être
   * confondue avec un `null` explicite, qui seul doit effacer un champ
   * nullable.
   */
  function update(id: string, input: UpdatePhaseInput): Phase | null {
    const data = updatePhaseSchema.parse(input)

    const existing = findRowById(id)
    if (!existing) {
      return null
    }

    const updatedAt = now()
    const assignments: string[] = []
    const params: Record<string, unknown> = { id, updated_at: updatedAt }

    for (const [field, column] of Object.entries(UPDATABLE_COLUMNS_BY_FIELD) as Array<
      [keyof UpdatePhaseInput, string]
    >) {
      if (!(field in data) || data[field] === undefined) {
        continue
      }

      assignments.push(`${column} = @${column}`)
      params[column] = data[field] ?? null
    }

    assignments.push('updated_at = @updated_at')

    const updateStatement = database.prepare(`UPDATE phases SET ${assignments.join(', ')} WHERE id = @id`)
    updateStatement.run(params)

    return mapRowToPhase(findRowById(id) as PhaseRow)
  }

  function remove(id: string): boolean {
    const result = deleteStatement.run({ id })
    return result.changes > 0
  }

  return { listByProjectId, getById, create, update, remove }
}
