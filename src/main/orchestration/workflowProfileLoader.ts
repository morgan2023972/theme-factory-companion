import { readFileSync } from 'node:fs'
import { workflowProfileConfigSchema, type WorkflowProfileConfig } from '../../shared/orchestration'

/**
 * Chargeur synchrone d'un fichier de profil de workflow (ORCH-3.1.2).
 * Lit un fichier JSON UTF-8 et retourne un `WorkflowProfileConfig`
 * entièrement validé par `workflowProfileConfigSchema` (ORCH-3.1.1), ou
 * lève une `WorkflowProfileLoadError` explicite. Aucune canonicalisation
 * ni restriction de `filePath` au dépôt (ORCH-3.2.1), aucun calcul
 * d'empreinte (ORCH-3.1.3), aucune dépendance à Electron, SQLite ou au
 * renderer.
 */

export type WorkflowProfileLoadErrorCode =
  | 'FILE_NOT_FOUND'
  | 'FILE_NOT_READABLE'
  | 'EMPTY_FILE'
  | 'INVALID_JSON'
  | 'INVALID_PROFILE'

export class WorkflowProfileLoadError extends Error {
  readonly code: WorkflowProfileLoadErrorCode
  readonly filePath: string

  constructor(
    code: WorkflowProfileLoadErrorCode,
    filePath: string,
    message: string,
    options?: { cause?: unknown }
  ) {
    super(message, options)
    this.name = 'WorkflowProfileLoadError'
    this.code = code
    this.filePath = filePath
    Object.setPrototypeOf(this, WorkflowProfileLoadError.prototype)
  }
}

function isErrnoException(value: unknown): value is NodeJS.ErrnoException {
  return value instanceof Error && 'code' in value
}

/**
 * Lit et valide le fichier de profil désigné par `filePath`. `filePath`
 * n'est ni résolu, ni canonicalisé, ni modifié : il est transmis tel quel
 * à `readFileSync` (uniquement vérifié comme non vide après trim au
 * préalable, sans jamais normaliser la valeur réellement utilisée).
 */
export function loadWorkflowProfile(filePath: string): WorkflowProfileConfig {
  if (filePath.trim().length === 0) {
    throw new WorkflowProfileLoadError(
      'FILE_NOT_FOUND',
      filePath,
      'Le chemin du fichier de profil est vide ou ne contient que des espaces.'
    )
  }

  let rawContent: string
  try {
    rawContent = readFileSync(filePath, 'utf8')
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      throw new WorkflowProfileLoadError(
        'FILE_NOT_FOUND',
        filePath,
        `Le fichier de profil est introuvable : "${filePath}".`,
        { cause: error }
      )
    }
    throw new WorkflowProfileLoadError(
      'FILE_NOT_READABLE',
      filePath,
      `Le fichier de profil ne peut pas être lu : "${filePath}".`,
      { cause: error }
    )
  }

  if (rawContent.trim().length === 0) {
    throw new WorkflowProfileLoadError('EMPTY_FILE', filePath, `Le fichier de profil est vide : "${filePath}".`)
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(rawContent)
  } catch (error) {
    throw new WorkflowProfileLoadError(
      'INVALID_JSON',
      filePath,
      `Le fichier de profil ne contient pas un JSON valide : "${filePath}".`,
      { cause: error }
    )
  }

  const result = workflowProfileConfigSchema.safeParse(parsedJson)
  if (!result.success) {
    throw new WorkflowProfileLoadError(
      'INVALID_PROFILE',
      filePath,
      `Le fichier de profil ne respecte pas le contrat attendu : "${filePath}".`,
      { cause: result.error }
    )
  }

  return result.data
}
