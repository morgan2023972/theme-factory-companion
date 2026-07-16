import type { Project } from '../../../../shared/schemas/project'
import { PROJECT_STATUS_LABELS } from './projectStatusLabels'

interface ProjectCardProps {
  project: Project
  isActive: boolean
  isDeleting: boolean
  /** Désactive « Modifier » : un formulaire (création ou édition) est déjà ouvert ailleurs. */
  disableModify: boolean
  /** Désactive « Supprimer » : un formulaire est ouvert, ou une suppression est déjà en cours. */
  disableDelete: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
}

export function ProjectCard({
  project,
  isActive,
  isDeleting,
  disableModify,
  disableDelete,
  onSelect,
  onEdit,
  onDelete
}: ProjectCardProps): React.JSX.Element {
  return (
    <article
      className={isActive ? 'project-card project-card--active' : 'project-card'}
      aria-current={isActive ? 'true' : undefined}
    >
      <h3 className="project-card__name">{project.name}</h3>
      <p className="project-card__status">Statut : {PROJECT_STATUS_LABELS[project.status]}</p>

      {project.description ? <p className="project-card__description">{project.description}</p> : null}
      {project.objective ? <p className="project-card__meta">Objectif : {project.objective}</p> : null}
      {project.targetTechnology ? (
        <p className="project-card__meta">Technologie cible : {project.targetTechnology}</p>
      ) : null}
      {project.repositoryPath ? <p className="project-card__meta">Dépôt : {project.repositoryPath}</p> : null}
      {project.notes ? <p className="project-card__meta">Notes : {project.notes}</p> : null}

      <p className="project-card__dates">
        Créé le {new Date(project.createdAt).toLocaleString()} · Modifié le{' '}
        {new Date(project.updatedAt).toLocaleString()}
      </p>

      <div className="project-card__actions">
        <button type="button" aria-pressed={isActive} onClick={onSelect} disabled={isDeleting}>
          {isActive ? 'Actif' : 'Sélectionner'}
        </button>
        <button type="button" onClick={onEdit} disabled={isDeleting || disableModify}>
          Modifier
        </button>
        <button type="button" onClick={onDelete} disabled={isDeleting || disableDelete}>
          {isDeleting ? 'Suppression…' : 'Supprimer'}
        </button>
      </div>
    </article>
  )
}
