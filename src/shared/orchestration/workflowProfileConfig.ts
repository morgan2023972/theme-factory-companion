import { z } from 'zod'
import { nonEmptyTrimmedText } from './common'

/**
 * Contrat Zod du **fichier de configuration** d'un profil de workflow
 * (ORCH-3.1.1), distinct du modèle persistant `WorkflowProfile`
 * (`workflowProfile.ts`) et de son schéma de création
 * `createWorkflowProfileSchema`. Ce fichier ne définit ni chargeur, ni
 * calcul d'empreinte, ni logique de dépôt : il fixe uniquement la forme et
 * les règles syntaxiques du contenu JSON attendu (voir
 * `docs/orchestration/ORCHESTRATOR_V1_ROADMAP.md`, ORCH-3.1.1). La lecture
 * du fichier (ORCH-3.1.2), le calcul du fingerprint (ORCH-3.1.3) et la
 * résolution/canonicalisation réelle des chemins par rapport au dépôt
 * (ORCH-3.2.1) sont explicitement hors périmètre.
 *
 * Aucun schéma ci-dessous n'utilise `.default()`, de coercition ou
 * `.catch()` : une configuration incomplète ou mal formée doit toujours
 * être rejetée plutôt que silencieusement complétée.
 */

const KEBAB_CASE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * SemVer strict "MAJOR.MINOR.PATCH" (segments numériques sans zéro non
 * significatif). Aucun préfixe `v`, aucune pré-version, aucun métadonnée de
 * build : hors périmètre de cette V1.
 */
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

/**
 * Un `command` représente un exécutable unique, jamais une ligne shell :
 * tout espace/tabulation/retour à la ligne (couvert par `\s`) ou opérateur
 * shell évident (`&`, `|`, `;`, `<`, `>` — couvrant `&&`/`||` par la
 * présence d'un seul de ces caractères) est refusé. Ce n'est pas un
 * parseur shell général, seulement une liste blanche de caractères
 * dangereux évidents.
 */
const SHELL_METACHARACTER_PATTERN = /[\s&|;<>]/

function kebabCaseTextSchema(emptyMessage: string, formatMessage: string): z.ZodString {
  return nonEmptyTrimmedText(emptyMessage).refine((value) => KEBAB_CASE_PATTERN.test(value), {
    message: formatMessage
  })
}

const profileKeySchema = kebabCaseTextSchema(
  'profileKey est obligatoire.',
  'profileKey doit être au format kebab-case (ex. "electron-typescript").'
)

const versionSchema = nonEmptyTrimmedText('version est obligatoire.').refine(
  (value) => SEMVER_PATTERN.test(value),
  {
    message:
      'version doit être un numéro SemVer strict "MAJOR.MINOR.PATCH" (ex. "1.0.0"), sans préfixe "v" ni pré-version ni métadonnée de build.'
  }
)

const commandKeySchema = kebabCaseTextSchema(
  'key est obligatoire.',
  'key doit être au format kebab-case (ex. "typecheck").'
)

const commandExecutableSchema = nonEmptyTrimmedText("command est obligatoire.").refine(
  (value) => !SHELL_METACHARACTER_PATTERN.test(value),
  {
    message:
      'command doit être un exécutable unique, sans espace/tabulation/retour à la ligne ni opérateur shell (&&, ||, ;, |, >, <).'
  }
)

const commandArgsSchema = z.array(nonEmptyTrimmedText('Chaque argument doit être non vide après trim.'))

/**
 * Chemin relatif syntaxiquement valide pour `artifactPaths` : uniquement
 * `/` comme séparateur, jamais de backslash, ni absolu (Unix, lettre de
 * lecteur Windows, UNC), ni segment vide/`.`/`..`. Validation purement
 * syntaxique : la canonicalisation réelle et la vérification
 * d'appartenance au dépôt appartiennent à ORCH-3.2.1.
 */
function isSyntacticallyValidRelativeConfigPath(value: string): boolean {
  if (value.includes('\\')) {
    return false
  }
  if (value.startsWith('/') || value.endsWith('/')) {
    return false
  }
  if (/^[a-zA-Z]:/.test(value)) {
    return false
  }

  const segments = value.split('/')
  return segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
}

const relativeConfigPathSchema = nonEmptyTrimmedText('Le chemin est obligatoire.').refine(
  isSyntacticallyValidRelativeConfigPath,
  {
    message:
      'Le chemin doit être relatif, utiliser "/" comme séparateur, ne pas commencer ni finir par "/", ne contenir aucun segment vide, "." ou "..", aucune lettre de lecteur Windows (ex. "C:") ni aucun backslash.'
  }
)

/**
 * Une commande de validation déclarée dans le fichier de configuration.
 * Contient exactement ces six champs : aucun champ `position` (l'ordre
 * persisté du repository, ORCH-2.2, est un ordinal SQL qui n'existe pas
 * côté configuration — l'ordre du tableau `validationCommands` fait foi
 * ici, voir plus bas).
 */
export const workflowProfileCommandConfigSchema = z
  .object({
    key: commandKeySchema,
    name: nonEmptyTrimmedText('Le nom de la commande est obligatoire.'),
    command: commandExecutableSchema,
    args: commandArgsSchema,
    blocking: z.boolean(),
    timeoutMs: z
      .number()
      .int('timeoutMs doit être un entier.')
      .min(1000, 'timeoutMs doit être supérieur ou égal à 1000.')
      .max(1800000, 'timeoutMs doit être inférieur ou égal à 1800000.')
  })
  .strict()

export type WorkflowProfileCommandConfig = z.infer<typeof workflowProfileCommandConfigSchema>

/**
 * Liste des commandes de validation : au moins une, clés uniques,
 * ordre du tableau conservé tel quel (aucun tri, aucun champ `position`).
 */
const workflowProfileCommandConfigListSchema = z
  .array(workflowProfileCommandConfigSchema)
  .min(1, 'validationCommands doit contenir au moins une commande.')
  .superRefine((commands, ctx) => {
    const seenKeys = new Set<string>()
    commands.forEach((command, index) => {
      if (seenKeys.has(command.key)) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'key'],
          message: `key de commande de validation en double : "${command.key}".`
        })
      }
      seenKeys.add(command.key)
    })
  })

/**
 * Emplacements, relatifs au dépôt du projet, des artefacts produits par le
 * workflow. Contient exactement ces deux champs.
 */
export const workflowArtifactPathsConfigSchema = z
  .object({
    promptsDirectory: relativeConfigPathSchema,
    reportsDirectory: relativeConfigPathSchema
  })
  .strict()

export type WorkflowArtifactPathsConfig = z.infer<typeof workflowArtifactPathsConfigSchema>

/**
 * Checklist de validation manuelle : au moins un élément, chaque élément
 * non vide après trim, aucun doublon après trim, ordre du tableau
 * conservé tel quel.
 */
const manualValidationChecklistSchema = z
  .array(nonEmptyTrimmedText('Chaque élément de la checklist doit être non vide après trim.'))
  .min(1, 'manualValidationChecklist doit contenir au moins un élément.')
  .superRefine((items, ctx) => {
    const seenItems = new Set<string>()
    items.forEach((item, index) => {
      const trimmed = item.trim()
      if (seenItems.has(trimmed)) {
        ctx.addIssue({
          code: 'custom',
          path: [index],
          message: `Élément de checklist en double après trim : "${trimmed}".`
        })
      }
      seenItems.add(trimmed)
    })
  })

/**
 * Contrat racine du fichier de configuration d'un profil de workflow
 * (ex. `workflow/config/project.workflow.json`, ORCH-3.1.4). Distinct du
 * modèle persistant `WorkflowProfile` : ce schéma n'est jamais utilisé
 * comme entrée directe du repository (`createWorkflowProfileSchema`
 * reste le seul contrat de persistance).
 */
export const workflowProfileConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    profileKey: profileKeySchema,
    name: nonEmptyTrimmedText('Le nom du profil est obligatoire.'),
    version: versionSchema,
    validationCommands: workflowProfileCommandConfigListSchema,
    artifactPaths: workflowArtifactPathsConfigSchema,
    manualValidationChecklist: manualValidationChecklistSchema
  })
  .strict()

export type WorkflowProfileConfig = z.infer<typeof workflowProfileConfigSchema>
