import { useId, useState } from 'react'
import { PROJECT_STATUSES, type Project, type ProjectStatus } from '../../../../shared/schemas/project'
import { PROJECT_STATUS_LABELS } from './projectStatusLabels'

export interface ProjectFormValues {
  name: string
  description: string | null
  objective: string | null
  status: ProjectStatus
  repositoryPath: string | null
  targetTechnology: string | null
  notes: string | null
}

interface ProjectFormProps {
  mode: 'create' | 'edit'
  initialProject?: Project
  isSubmitting: boolean
  errorMessage: string | null
  onCancel: () => void
  onSubmit: (values: ProjectFormValues) => void
}

function toFieldValue(value: string | null | undefined): string {
  return value ?? ''
}

function toOptionalText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * Formulaire partagé création/modification. Reste local à ses propres
 * champs : les valeurs saisies ne sont donc jamais perdues si `onSubmit`
 * échoue (le parent n'affiche qu'un message d'erreur, il ne démonte pas ce
 * composant).
 */
export function ProjectForm({
  mode,
  initialProject,
  isSubmitting,
  errorMessage,
  onCancel,
  onSubmit
}: ProjectFormProps): React.JSX.Element {
  const formId = useId()
  const [name, setName] = useState(initialProject?.name ?? '')
  const [description, setDescription] = useState(toFieldValue(initialProject?.description))
  const [objective, setObjective] = useState(toFieldValue(initialProject?.objective))
  const [status, setStatus] = useState<ProjectStatus>(initialProject?.status ?? 'planning')
  const [repositoryPath, setRepositoryPath] = useState(toFieldValue(initialProject?.repositoryPath))
  const [targetTechnology, setTargetTechnology] = useState(toFieldValue(initialProject?.targetTechnology))
  const [notes, setNotes] = useState(toFieldValue(initialProject?.notes))
  const [nameError, setNameError] = useState<string | null>(null)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    if (name.trim() === '') {
      setNameError('Le nom du projet est obligatoire.')
      return
    }

    setNameError(null)

    onSubmit({
      name: name.trim(),
      description: toOptionalText(description),
      objective: toOptionalText(objective),
      status,
      repositoryPath: toOptionalText(repositoryPath),
      targetTechnology: toOptionalText(targetTechnology),
      notes: toOptionalText(notes)
    })
  }

  const titleId = `${formId}-title`

  return (
    <form
      className="project-form"
      onSubmit={handleSubmit}
      aria-labelledby={titleId}
    >
      <h2 id={titleId} className="project-form__title">
        {mode === 'create' ? 'Créer un projet' : 'Modifier le projet'}
      </h2>

      <div className="project-form__field">
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
          <p role="alert" id={`${formId}-name-error`} className="project-form__field-error">
            {nameError}
          </p>
        ) : null}
      </div>

      <div className="project-form__field">
        <label htmlFor={`${formId}-description`}>Description</label>
        <textarea
          id={`${formId}-description`}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <div className="project-form__field">
        <label htmlFor={`${formId}-objective`}>Objectif</label>
        <textarea
          id={`${formId}-objective`}
          value={objective}
          onChange={(event) => setObjective(event.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <div className="project-form__field">
        <label htmlFor={`${formId}-status`}>Statut</label>
        <select
          id={`${formId}-status`}
          value={status}
          onChange={(event) => setStatus(event.target.value as ProjectStatus)}
          disabled={isSubmitting}
        >
          {PROJECT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {PROJECT_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="project-form__field">
        <label htmlFor={`${formId}-repositoryPath`}>Chemin du dépôt</label>
        <input
          id={`${formId}-repositoryPath`}
          type="text"
          value={repositoryPath}
          onChange={(event) => setRepositoryPath(event.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <div className="project-form__field">
        <label htmlFor={`${formId}-targetTechnology`}>Technologie cible</label>
        <input
          id={`${formId}-targetTechnology`}
          type="text"
          value={targetTechnology}
          onChange={(event) => setTargetTechnology(event.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <div className="project-form__field">
        <label htmlFor={`${formId}-notes`}>Notes</label>
        <textarea
          id={`${formId}-notes`}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          disabled={isSubmitting}
        />
      </div>

      {errorMessage ? (
        <p role="alert" className="project-form__error">
          {errorMessage}
        </p>
      ) : null}

      <div className="project-form__actions">
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Enregistrement…' : mode === 'create' ? 'Créer le projet' : 'Enregistrer'}
        </button>
        <button type="button" onClick={onCancel} disabled={isSubmitting}>
          Annuler
        </button>
      </div>
    </form>
  )
}
