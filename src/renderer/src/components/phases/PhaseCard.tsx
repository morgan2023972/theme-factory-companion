import type { Phase } from '../../../../shared/schemas/phase'
import { PHASE_STATUS_LABELS } from './phaseStatusLabels'

interface PhaseCardProps {
  phase: Phase
  /** Rang d'affichage (1, 2, 3…) déduit de l'ordre déjà renvoyé par l'API, pas de `phase.position` directement. */
  displayPosition: number
  isDeleting: boolean
  /** Désactive « Modifier » : un formulaire (création ou édition) est déjà ouvert ailleurs. */
  disableModify: boolean
  /** Désactive « Supprimer » : un formulaire est ouvert, ou une suppression est déjà en cours. */
  disableDelete: boolean
  onEdit: () => void
  onDelete: () => void
}

export function PhaseCard({
  phase,
  displayPosition,
  isDeleting,
  disableModify,
  disableDelete,
  onEdit,
  onDelete
}: PhaseCardProps): React.JSX.Element {
  return (
    <article className="phase-card">
      <h3 className="phase-card__name">
        Phase {displayPosition} — {phase.name}
      </h3>
      <p className="phase-card__status">Statut : {PHASE_STATUS_LABELS[phase.status]}</p>

      {phase.description ? <p className="phase-card__description">{phase.description}</p> : null}

      <div className="phase-card__actions">
        <button
          type="button"
          aria-label={`Modifier la phase ${phase.name}`}
          onClick={onEdit}
          disabled={isDeleting || disableModify}
        >
          Modifier
        </button>
        <button
          type="button"
          aria-label={`Supprimer la phase ${phase.name}`}
          onClick={onDelete}
          disabled={isDeleting || disableDelete}
        >
          {isDeleting ? 'Suppression…' : 'Supprimer'}
        </button>
      </div>
    </article>
  )
}
