import { useCallback, useEffect, useRef, useState } from 'react'
import type { Project } from '../../../shared/schemas/project'
import { ProjectCard } from '../components/projects/ProjectCard'
import { ProjectForm, type ProjectFormValues } from '../components/projects/ProjectForm'
import { getErrorMessage } from '../utils/getErrorMessage'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'loaded' }

type FormState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; project: Project }

export function ProjectsPage(): React.JSX.Element {
  const [projects, setProjects] = useState<Project[]>([])
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' })
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [formState, setFormState] = useState<FormState>({ mode: 'closed' })
  const [isSubmittingForm, setIsSubmittingForm] = useState(false)
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null)
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null)
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null)

  const isMountedRef = useRef(false)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const loadProjects = useCallback(async () => {
    setLoadState({ status: 'loading' })
    try {
      const result = await window.themeFactoryApi.projects.list()
      if (!isMountedRef.current) {
        return
      }
      setProjects(result)
      setLoadState({ status: 'loaded' })
      setActiveProjectId((current) =>
        current && result.some((project) => project.id === current) ? current : null
      )
    } catch (error) {
      if (!isMountedRef.current) {
        return
      }
      setLoadState({ status: 'error', message: getErrorMessage(error) })
    }
  }, [])

  useEffect(() => {
    void loadProjects()
  }, [loadProjects])

  function handleOpenCreateForm(): void {
    setFormErrorMessage(null)
    setFormState({ mode: 'create' })
  }

  function handleOpenEditForm(project: Project): void {
    setFormErrorMessage(null)
    setFormState({ mode: 'edit', project })
  }

  function handleCancelForm(): void {
    setFormErrorMessage(null)
    setFormState({ mode: 'closed' })
  }

  function handleSubmitForm(values: ProjectFormValues): void {
    if (isSubmittingForm) {
      return
    }

    const currentFormState = formState
    if (currentFormState.mode === 'closed') {
      return
    }

    setIsSubmittingForm(true)
    setFormErrorMessage(null)

    const run = async (): Promise<void> => {
      try {
        if (currentFormState.mode === 'create') {
          const created = await window.themeFactoryApi.projects.create(values)
          if (!isMountedRef.current) {
            return
          }
          setProjects((current) => [created, ...current])
          setFormState({ mode: 'closed' })
        } else {
          const updated = await window.themeFactoryApi.projects.update(currentFormState.project.id, values)
          if (!isMountedRef.current) {
            return
          }
          if (updated) {
            setProjects((current) => current.map((project) => (project.id === updated.id ? updated : project)))
            setFormState({ mode: 'closed' })
          } else {
            setFormErrorMessage("Ce projet n'existe plus : il a peut-être été supprimé entre-temps.")
          }
        }
      } catch (error) {
        if (!isMountedRef.current) {
          return
        }
        setFormErrorMessage(getErrorMessage(error))
      } finally {
        if (isMountedRef.current) {
          setIsSubmittingForm(false)
        }
      }
    }

    void run()
  }

  function handleDelete(project: Project): void {
    if (deletingProjectId !== null) {
      return
    }

    const confirmed = window.confirm(
      `Supprimer définitivement le projet « ${project.name} » ? Cette action est irréversible.`
    )
    if (!confirmed) {
      return
    }

    setDeleteErrorMessage(null)
    setDeletingProjectId(project.id)

    const run = async (): Promise<void> => {
      try {
        await window.themeFactoryApi.projects.remove(project.id)
        if (!isMountedRef.current) {
          return
        }
        setProjects((current) => current.filter((item) => item.id !== project.id))
        setActiveProjectId((current) => (current === project.id ? null : current))
      } catch (error) {
        if (!isMountedRef.current) {
          return
        }
        setDeleteErrorMessage(getErrorMessage(error))
      } finally {
        if (isMountedRef.current) {
          setDeletingProjectId(null)
        }
      }
    }

    void run()
  }

  return (
    <div className="projects-page">
      <div className="projects-page__toolbar">
        <button
          type="button"
          className="projects-page__create-button"
          onClick={handleOpenCreateForm}
          disabled={formState.mode !== 'closed' || isSubmittingForm}
        >
          Nouveau projet
        </button>
      </div>

      {deleteErrorMessage ? (
        <p role="alert" className="projects-page__error">
          {deleteErrorMessage}
        </p>
      ) : null}

      {formState.mode !== 'closed' ? (
        <ProjectForm
          key={formState.mode === 'edit' ? `edit-${formState.project.id}` : 'create'}
          mode={formState.mode}
          initialProject={formState.mode === 'edit' ? formState.project : undefined}
          isSubmitting={isSubmittingForm}
          errorMessage={formErrorMessage}
          onCancel={handleCancelForm}
          onSubmit={handleSubmitForm}
        />
      ) : null}

      {loadState.status === 'loading' ? <p role="status">Chargement des projets…</p> : null}

      {loadState.status === 'error' ? (
        <div role="alert" className="projects-page__error">
          <p>{loadState.message}</p>
          <button type="button" onClick={() => void loadProjects()}>
            Réessayer
          </button>
        </div>
      ) : null}

      {loadState.status === 'loaded' && projects.length === 0 ? (
        <p className="projects-page__empty">Aucun projet enregistré pour le moment.</p>
      ) : null}

      {loadState.status === 'loaded' && projects.length > 0 ? (
        <ul className="projects-page__list">
          {projects.map((project) => (
            <li key={project.id}>
              <ProjectCard
                project={project}
                isActive={project.id === activeProjectId}
                isDeleting={deletingProjectId === project.id}
                disableModify={formState.mode !== 'closed'}
                disableDelete={formState.mode !== 'closed' || deletingProjectId !== null}
                onSelect={() => setActiveProjectId(project.id)}
                onEdit={() => handleOpenEditForm(project)}
                onDelete={() => handleDelete(project)}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
