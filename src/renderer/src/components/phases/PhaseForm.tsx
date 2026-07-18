import { useId, useState } from 'react'
import { PHASE_STATUSES, type Phase, type PhaseStatus } from '../../../../shared/schemas/phase'
import { PHASE_STATUS_LABELS } from './phaseStatusLabels'

export interface PhaseFormValues {
  name: string
  description: string | null
  status: PhaseStatus
  /**
   * `null` signifie « champ laissé vide » : le parent omet alors la clé
   * `position` de l'appel API, ce qui laisse le repository calculer la
   * position suivante (création) ou conserver la position actuelle
   * (modification), sans jamais envoyer de valeur artificielle.
   */
  position: number | null
}

interface PhaseFormProps {
  mode: 'create' | 'edit'
  initialPhase?: Phase
  isSubmitting: boolean
  errorMessage: string | null
  onCancel: () => void
  onSubmit: (values: PhaseFormValues) => void
}

function toFieldValue(value: string | null | undefined): string {
  return value ?? ''
}

function toOptionalText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * Formulaire partagé création/modification, même convention que
 * `ProjectForm` : reste local à ses propres champs, les valeurs saisies ne
 * sont donc jamais perdues si `onSubmit` échoue.
 */
export function PhaseForm({
  mode,
  initialPhase,
  isSubmitting,
  errorMessage,
  onCancel,
  onSubmit
}: PhaseFormProps): React.JSX.Element {
  const formId = useId()
  const [name, setName] = useState(initialPhase?.name ?? '')
  const [description, setDescription] = useState(toFieldValue(initialPhase?.description))
  const [status, setStatus] = useState<PhaseStatus>(initialPhase?.status ?? 'pending')
  const [position, setPosition] = useState(initialPhase ? String(initialPhase.position) : '')
  const [nameError, setNameError] = useState<string | null>(null)
  const [positionError, setPositionError] = useState<string | null>(null)

  const editingName = mode === 'edit' ? initialPhase?.name : undefined

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    const trimmedName = name.trim()
    if (trimmedName === '') {
      setNameError('Le nom de la phase est obligatoire.')
      return
    }
    setNameError(null)

    const trimmedPosition = position.trim()
    let parsedPosition: number | null = null
    if (trimmedPosition !== '') {
      const value = Number(trimmedPosition)
      if (!Number.isInteger(value) || value < 0) {
        setPositionError('La position doit être un entier positif ou nul.')
        return
      }
      parsedPosition = value
    }
    setPositionError(null)

    onSubmit({
      name: trimmedName,
      description: toOptionalText(description),
      status,
      position: parsedPosition
    })
  }

  const titleId = `${formId}-title`

  return (
    <form className="phase-form" onSubmit={handleSubmit} aria-labelledby={titleId}>
      <h2 id={titleId} className="phase-form__title">
        {mode === 'create' ? 'Créer une phase' : 'Modifier la phase'}
      </h2>

      <div className="phase-form__field">
        <label htmlFor={`${formId}-name`}>Nom</label>
        <input
          id={`${formId}-name`}
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={isSubmitting}
          required
          aria-invalid={nameError ? 'true' : undefined}
          aria-describedby={nameError ? `${formId}-name-error` : undefined}
        />
        {nameError ? (
          <p role="alert" id={`${formId}-name-error`} className="phase-form__field-error">
            {nameError}
          </p>
        ) : null}
      </div>

      <div className="phase-form__field">
        <label htmlFor={`${formId}-description`}>Description</label>
        <textarea
          id={`${formId}-description`}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <div className="phase-form__field">
        <label htmlFor={`${formId}-status`}>Statut</label>
        <select
          id={`${formId}-status`}
          value={status}
          onChange={(event) => setStatus(event.target.value as PhaseStatus)}
          disabled={isSubmitting}
        >
          {PHASE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {PHASE_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="phase-form__field">
        <label htmlFor={`${formId}-position`}>
          Position{mode === 'create' ? ' (laisser vide pour une attribution automatique)' : ''}
        </label>
        <input
          id={`${formId}-position`}
          type="number"
          min={0}
          step={1}
          value={position}
          onChange={(event) => setPosition(event.target.value)}
          disabled={isSubmitting}
          aria-invalid={positionError ? 'true' : undefined}
          aria-describedby={positionError ? `${formId}-position-error` : undefined}
        />
        {positionError ? (
          <p role="alert" id={`${formId}-position-error`} className="phase-form__field-error">
            {positionError}
          </p>
        ) : null}
      </div>

      {errorMessage ? (
        <p role="alert" className="phase-form__error">
          {errorMessage}
        </p>
      ) : null}

      <div className="phase-form__actions">
        <button
          type="submit"
          disabled={isSubmitting}
          aria-label={editingName ? `Enregistrer les modifications de la phase ${editingName}` : undefined}
        >
          {isSubmitting ? 'Enregistrement…' : mode === 'create' ? 'Créer la phase' : 'Enregistrer'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          aria-label={editingName ? `Annuler la modification de la phase ${editingName}` : undefined}
        >
          Annuler
        </button>
      </div>
    </form>
  )
}
