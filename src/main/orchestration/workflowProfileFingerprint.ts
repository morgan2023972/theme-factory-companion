import { createHash } from 'node:crypto'
import type { WorkflowProfileConfig } from '../../shared/orchestration'

/**
 * Calcul d'une empreinte stable d'un `WorkflowProfileConfig` déjà validé
 * (ORCH-3.1.3). Fonction pure : aucune lecture de fichier, aucun accès
 * SQLite, aucune dépendance à Electron ou au renderer. Distincte de
 * `WorkflowProfile.version` (version métier déclarée par le profil) et de
 * `WorkflowRun.profileFingerprint` (champ de stockage défini en ORCH-1.1).
 */

/**
 * Construit une valeur canonique équivalente à `value` : les clés de chaque
 * objet sont triées par ordre alphabétique (récursivement), tandis que
 * l'ordre de chaque tableau est conservé tel quel — l'ordre des tableaux du
 * profil (`validationCommands`, `manualValidationChecklist`) est
 * sémantiquement significatif et ne doit jamais être réordonné.
 */
function toCanonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(toCanonicalValue)
  }

  if (value !== null && typeof value === 'object') {
    const sortedEntries = Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => [key, toCanonicalValue((value as Record<string, unknown>)[key])] as const)
    return Object.fromEntries(sortedEntries)
  }

  return value
}

/**
 * Retourne une empreinte SHA-256 stable de `config`, au format
 * `sha256:<hex>` (hex en minuscules). Deux `WorkflowProfileConfig`
 * équivalents (mêmes valeurs, ordre de clés JS différent) produisent
 * toujours la même empreinte ; tout changement de valeur ou tout
 * réordonnancement d'un tableau produit une empreinte différente.
 */
export function computeWorkflowProfileFingerprint(config: WorkflowProfileConfig): string {
  const canonicalJson = JSON.stringify(toCanonicalValue(config))
  const hash = createHash('sha256').update(canonicalJson, 'utf8').digest('hex')
  return `sha256:${hash}`
}
