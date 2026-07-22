import { z } from 'zod'
import { nonEmptyTrimmedText } from './common'

/**
 * Une commande de validation définie par le profil (ex. typecheck, test,
 * build) : nom logique, exécutable et arguments strictement séparés (voir
 * `ORCHESTRATOR_V1_SAFETY_RULES.md`, section 7 : "la commande et ses
 * arguments sont fournis sous forme de tableau séparé, jamais sous forme de
 * chaîne concaténée"). Le profil ne définit ici que des commandes de
 * validation applicatives : il ne peut jamais définir ou modifier les
 * commandes internes de l'orchestrateur (Git, lancement de Claude Code),
 * qui proviennent exclusivement d'une liste blanche interne fermée (section
 * 6) — c'est pourquoi ce schéma ne contient aucun champ permettant de
 * désigner une commande Git ou Claude Code.
 */
export const validationCommandSchema = z
  .object({
    name: nonEmptyTrimmedText('Le nom de la commande de validation est obligatoire.'),
    command: nonEmptyTrimmedText("L'exécutable de la commande de validation est obligatoire."),
    args: z.array(z.string()),
    /**
     * `blocking` est obligatoire et sans valeur par défaut : ce schéma est
     * le schéma de lecture de l'entité (aucun schéma de création séparé
     * n'existe à ce stade, voir `RAPPORT_ORCH_1.1.md`), et une valeur par
     * défaut à cet endroit masquerait silencieusement une commande de
     * validation persistée de façon incomplète ou corrompue au lieu de la
     * rejeter. La règle "un code de sortie non nul est considéré comme un
     * échec par défaut, sauf exception explicitement documentée dans le
     * profil" (section 7 des règles de sécurité) reste respectée : c'est
     * l'appelant qui doit explicitement documenter `blocking: false` pour
     * une commande non bloquante, jamais une valeur implicite du schéma.
     */
    blocking: z.boolean()
  })
  .strict()

export type ValidationCommand = z.infer<typeof validationCommandSchema>

/**
 * Profil de workflow versionné (voir `ORCHESTRATOR_V1_SAFETY_RULES.md`,
 * section 6). `version` est l'identifiant de version déclaré par le profil
 * lui-même (par exemple un numéro incrémental ou un tag) ; il est distinct
 * de l'empreinte technique (`profileFingerprint`, voir `workflowRun.ts`)
 * capturée à l'exécution pour détecter toute modification pendant qu'un
 * workflow est actif — ce sont deux notions volontairement séparées.
 */
export const workflowProfileSchema = z
  .object({
    id: z.uuid(),
    name: nonEmptyTrimmedText('Le nom du profil est obligatoire.'),
    version: nonEmptyTrimmedText('La version du profil est obligatoire.'),
    validationCommands: z.array(validationCommandSchema),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime()
  })
  .strict()

export type WorkflowProfile = z.infer<typeof workflowProfileSchema>

/**
 * Données acceptées pour la création d'un profil de workflow (ORCH-2.2).
 * `id`, `createdAt` et `updatedAt` sont générés par le repository.
 * `validationCommands` reprend `validationCommandSchema` tel quel : l'ordre
 * du tableau fourni définit l'ordre persisté (`position` SQL, un ordinal
 * qui n'existe pas côté `ValidationCommand`).
 */
export const createWorkflowProfileSchema = z
  .object({
    name: nonEmptyTrimmedText('Le nom du profil est obligatoire.'),
    version: nonEmptyTrimmedText('La version du profil est obligatoire.'),
    validationCommands: z.array(validationCommandSchema)
  })
  .strict()

export type CreateWorkflowProfileInput = z.infer<typeof createWorkflowProfileSchema>
