import { z } from 'zod'

/**
 * Helpers internes partagés entre les schémas d'orchestration. Non exportés
 * via `index.ts` : usage strictement interne à ce dossier, à l'image des
 * helpers privés déjà dupliqués dans `src/shared/schemas/*.ts`.
 */

export const nonEmptyTrimmedText = (message: string): z.ZodString =>
  z.string().refine((value) => value.trim().length > 0, { message })

/**
 * Entier non négatif, utilisé pour les positions/séquences (ordre d'étape)
 * et les durées (millisecondes), conformément à l'exigence ORCH-1.1
 * ("entiers non négatifs pour séquences et durées").
 */
export const nonNegativeInt = (message: string): z.ZodNumber => z.number().int().min(0, message)

/**
 * Détecte tout préfixe de type chemin absolu : un unique séparateur de tête
 * (`/` ou `\`, ce qui couvre à la fois l'absolu Unix, l'absolu Windows
 * relatif au lecteur courant et l'UNC — un chemin UNC commençant toujours
 * par un premier `\`), une lettre de lecteur Windows (`C:\`, `C:/`), ou un
 * répertoire personnel (`~`). Décision de modélisation reportée à ORCH-1.2 :
 * `~` n'est mentionné dans aucun document ORCH-0.x, mais reste refusé par
 * prudence (voir `RAPPORT_ORCH_1.1.md`).
 */
const hasAbsoluteLikePrefix = (value: string): boolean => /^([\\/]|[a-zA-Z]:[\\/]|~)/.test(value)

const hasParentTraversalSegment = (value: string): boolean =>
  value.split(/[\\/]+/).some((segment) => segment === '..')

/**
 * Chemin d'artefact relatif au dépôt déclaré du projet (voir
 * `ORCHESTRATOR_V1_SAFETY_RULES.md`, section 4 : tout chemin hors dépôt ou
 * contenant une tentative de remontée est rejeté). Refuse tout chemin
 * absolu — y compris un backslash Windows unique sans lettre de lecteur
 * (ex. `\Windows\system.ini`), les lettres de lecteur, l'UNC et `~` — ainsi
 * que toute traversée `..`, quelle que soit sa position dans le chemin.
 */
export const relativeArtifactPathSchema = z
  .string()
  .trim()
  .min(1, "Le chemin de l'artefact est obligatoire.")
  .refine((value) => !hasAbsoluteLikePrefix(value), {
    message: "Le chemin de l'artefact doit être relatif au dépôt (chemin absolu refusé)."
  })
  .refine((value) => !hasParentTraversalSegment(value), {
    message: "Le chemin de l'artefact ne doit pas contenir de remontée '..'."
  })
