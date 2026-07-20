import { z } from 'zod'
import { nonEmptyTrimmedText, nonNegativeInt } from './common'

/**
 * Statuts d'une exécution de commande. `pending`/`running` couvrent le
 * cycle de vie avant complétion (code de sortie encore inconnu). `timed_out`
 * et `cancelled` sont deux formes distinctes d'interruption (timeout
 * expiré vs annulation utilisateur) mais restent, l'une comme l'autre,
 * strictement distinctes d'un `completed`/`failed` classique (voir
 * `ORCHESTRATOR_V1_SAFETY_RULES.md`, section 12 : "l'état de l'exécution est
 * marqué explicitement comme interrompu, distinct d'un succès ou d'un échec
 * classique").
 */
export const COMMAND_EXECUTION_STATUSES = ['pending', 'running', 'completed', 'failed', 'timed_out', 'cancelled'] as const

export const commandExecutionStatusSchema = z.enum(COMMAND_EXECUTION_STATUSES)

export type CommandExecutionStatus = z.infer<typeof commandExecutionStatusSchema>

/**
 * Une exécution de commande (Git, Claude Code ou validation). `executable`
 * et `args` sont strictement séparés (jamais une chaîne concaténée, voir
 * section 7 des règles de sécurité) : `args` peut être un tableau vide mais
 * jamais une chaîne. `cwd` est toujours explicite (aucune exécution sans
 * répertoire de travail déclaré).
 * `stdout`/`stderr` sont conservés comme texte brut (jamais interprétés,
 * voir section 24) ; `stdoutTruncated`/`stderrTruncated` signalent
 * explicitement toute troncature (jamais silencieuse).
 * `startedAt`, `completedAt`, `durationMs` et `exitCode` sont tous nullable,
 * mais leur nullité est liée au statut par une validation de cohérence (voir
 * `superRefine` ci-dessous) :
 * - `pending` exige les quatre à `null` (l'exécution n'a même pas démarré) ;
 * - `running` exige `startedAt` renseigné, les trois autres à `null` ;
 * - `completed` exige `startedAt`/`completedAt`/`durationMs` renseignés et
 *   `exitCode` égal à `0` ;
 * - `failed`, `timed_out` et `cancelled` exigent `startedAt`/`completedAt`/
 *   `durationMs` renseignés, mais ne contraignent volontairement pas
 *   `exitCode` (une erreur de lancement ou une interruption peut ne
 *   produire aucun code de sortie).
 */
export const commandExecutionSchema = z
  .object({
    id: z.uuid(),
    workflowRunId: z.uuid(),
    workflowStepId: z.uuid().nullable(),
    executable: nonEmptyTrimmedText("L'exécutable de la commande est obligatoire."),
    args: z.array(z.string()),
    cwd: nonEmptyTrimmedText('Le répertoire de travail (cwd) est obligatoire.'),
    status: commandExecutionStatusSchema,
    exitCode: z.number().int().nullable(),
    stdout: z.string(),
    stderr: z.string(),
    stdoutTruncated: z.boolean(),
    stderrTruncated: z.boolean(),
    startedAt: z.iso.datetime().nullable(),
    completedAt: z.iso.datetime().nullable(),
    durationMs: nonNegativeInt('La durée doit être un entier positif ou nul.').nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime()
  })
  .strict()
  .superRefine((data, ctx) => {
    const requireNull = (value: unknown, field: 'startedAt' | 'completedAt' | 'durationMs' | 'exitCode'): void => {
      if (value !== null) {
        ctx.addIssue({ code: 'custom', path: [field], message: `Le statut "${data.status}" exige ${field} à null.` })
      }
    }
    const requireNonNull = (value: unknown, field: 'startedAt' | 'completedAt' | 'durationMs' | 'exitCode'): void => {
      if (value === null) {
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: `Le statut "${data.status}" exige ${field} renseigné.`
        })
      }
    }

    switch (data.status) {
      case 'pending':
        requireNull(data.startedAt, 'startedAt')
        requireNull(data.completedAt, 'completedAt')
        requireNull(data.durationMs, 'durationMs')
        requireNull(data.exitCode, 'exitCode')
        break
      case 'running':
        requireNonNull(data.startedAt, 'startedAt')
        requireNull(data.completedAt, 'completedAt')
        requireNull(data.durationMs, 'durationMs')
        requireNull(data.exitCode, 'exitCode')
        break
      case 'completed':
        requireNonNull(data.startedAt, 'startedAt')
        requireNonNull(data.completedAt, 'completedAt')
        requireNonNull(data.durationMs, 'durationMs')
        if (data.exitCode !== 0) {
          ctx.addIssue({ code: 'custom', path: ['exitCode'], message: 'Le statut "completed" exige exitCode égal à 0.' })
        }
        break
      case 'failed':
      case 'timed_out':
      case 'cancelled':
        requireNonNull(data.startedAt, 'startedAt')
        requireNonNull(data.completedAt, 'completedAt')
        requireNonNull(data.durationMs, 'durationMs')
        break
    }
  })

export type CommandExecution = z.infer<typeof commandExecutionSchema>
