import { useCallback, useEffect, useRef, useState } from 'react'
import type { Project } from '../../../shared/schemas/project'
import type { Phase } from '../../../shared/schemas/phase'
import { PhaseCard } from '../components/phases/PhaseCard'
import { PhaseForm, type PhaseFormValues } from '../components/phases/PhaseForm'
import { getErrorMessage } from '../utils/getErrorMessage'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'loaded' }

type FormState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; phase: Phase }

interface PhasesPageProps {
  /** Projet actif partagé avec la page Projets (voir App.tsx) : aucune seconde source de vérité ici. */
  activeProject: Project | null
}

function sortByPosition(phases: Phase[]): Phase[] {
  return [...phases].sort((a, b) => a.position - b.position)
}

export function PhasesPage({ activeProject }: PhasesPageProps): React.JSX.Element {
  const [phases, setPhases] = useState<Phase[]>([])
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' })
  const [formState, setFormState] = useState<FormState>({ mode: 'closed' })
  const [isSubmittingForm, setIsSubmittingForm] = useState(false)
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null)
  const [deletingPhaseId, setDeletingPhaseId] = useState<string | null>(null)
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null)

  const isMountedRef = useRef(false)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const activeProjectId = activeProject?.id ?? null

  // Lu après chaque opération asynchrone (chargement ou mutation) pour
  // détecter un changement de projet actif survenu pendant l'attente : une
  // réponse ou une erreur qui ne correspond plus au projet actif courant est
  // ignorée silencieusement, plutôt que d'écraser l'état du nouveau projet.
  const activeProjectIdRef = useRef(activeProjectId)
  activeProjectIdRef.current = activeProjectId

  const loadPhases = useCallback(async (projectId: string) => {
    setLoadState({ status: 'loading' })
    try {
      const result = await window.themeFactoryApi.phases.listByProjectId(projectId)
      if (!isMountedRef.current || activeProjectIdRef.current !== projectId) {
        return
      }
      setPhases(result)
      setLoadState({ status: 'loaded' })
    } catch (error) {
      if (!isMountedRef.current || activeProjectIdRef.current !== projectId) {
        return
      }
      setLoadState({ status: 'error', message: getErrorMessage(error) })
    }
  }, [])

  // Changer de projet actif (y compris vers « aucun ») réinitialise
  // immédiatement la liste, tout formulaire ouvert et tout état de mutation en
  // cours : aucune donnée ni aucun état de l'ancien projet ne doit rester actif
  // pendant, ou après, le chargement du nouveau (voir aussi le `finally`
  // contextualisé de `handleSubmitForm`/`handleDelete` plus bas).
  useEffect(() => {
    setFormState({ mode: 'closed' })
    setFormErrorMessage(null)
    setDeleteErrorMessage(null)
    setDeletingPhaseId(null)
    setIsSubmittingForm(false)
    setPhases([])
    if (activeProjectId) {
      void loadPhases(activeProjectId)
    }
  }, [activeProjectId, loadPhases])

  if (!activeProject) {
    return (
      <div className="phases-page">
        <p className="phases-page__no-active-project">
          Sélectionnez d'abord un projet actif pour gérer ses phases.
        </p>
      </div>
    )
  }

  // Liaison stable vers le projet actif non nul : une fonction déclarée
  // (contrairement à une expression de fonction) n'hérite pas du
  // rétrécissement de type de l'`if` précédent dans les fermetures qu'elle
  // définit plus bas (ex. `run` dans `handleSubmitForm`).
  const project = activeProject

  function handleOpenCreateForm(): void {
    setFormErrorMessage(null)
    setFormState({ mode: 'create' })
  }

  function handleOpenEditForm(phase: Phase): void {
    setFormErrorMessage(null)
    setFormState({ mode: 'edit', phase })
  }

  function handleCancelForm(): void {
    setFormErrorMessage(null)
    setFormState({ mode: 'closed' })
  }

  function handleSubmitForm(values: PhaseFormValues): void {
    if (isSubmittingForm) {
      return
    }

    const currentFormState = formState
    if (currentFormState.mode === 'closed') {
      return
    }

    // Capturé au lancement de la mutation : une réponse ou erreur résolue
    // après un changement de projet actif (ce même identifiant ne
    // correspondant alors plus à `activeProjectIdRef.current`) est ignorée
    // silencieusement, pour ne jamais modifier l'état visuel du nouveau
    // projet avec le résultat d'une mutation lancée pour l'ancien.
    const mutationProjectId = project.id

    setIsSubmittingForm(true)
    setFormErrorMessage(null)

    function isStillRelevant(): boolean {
      return isMountedRef.current && activeProjectIdRef.current === mutationProjectId
    }

    const run = async (): Promise<void> => {
      try {
        if (currentFormState.mode === 'create') {
          const created = await window.themeFactoryApi.phases.create({
            projectId: project.id,
            name: values.name,
            description: values.description,
            status: values.status,
            ...(values.position !== null ? { position: values.position } : {})
          })
          if (!isStillRelevant()) {
            return
          }
          setPhases((current) => sortByPosition([...current, created]))
          setFormState({ mode: 'closed' })
        } else {
          const updated = await window.themeFactoryApi.phases.update(currentFormState.phase.id, {
            name: values.name,
            description: values.description,
            status: values.status,
            ...(values.position !== null ? { position: values.position } : {})
          })
          if (!isStillRelevant()) {
            return
          }
          if (updated) {
            setPhases((current) => sortByPosition(current.map((phase) => (phase.id === updated.id ? updated : phase))))
            setFormState({ mode: 'closed' })
          } else {
            setFormErrorMessage("Cette phase n'existe plus : elle a peut-être été supprimée entre-temps.")
          }
        }
      } catch (error) {
        if (!isStillRelevant()) {
          return
        }
        setFormErrorMessage(getErrorMessage(error))
      } finally {
        // Contextualisé comme le reste : un `finally` tardif appartenant à
        // l'ancien projet ne doit pas réactiver la soumission du nouveau
        // contexte (déjà remise à `false` par l'effet de changement de
        // projet, voir plus haut).
        if (isStillRelevant()) {
          setIsSubmittingForm(false)
        }
      }
    }

    void run()
  }

  function handleDelete(phase: Phase): void {
    if (deletingPhaseId !== null) {
      return
    }

    const confirmed = window.confirm(
      `Supprimer définitivement la phase « ${phase.name} » ? Cette action est irréversible.`
    )
    if (!confirmed) {
      return
    }

    // Même principe que `handleSubmitForm` : une suppression résolue après un
    // changement de projet actif ne doit jamais modifier l'état du nouveau
    // contexte.
    const mutationProjectId = project.id

    setDeleteErrorMessage(null)
    setDeletingPhaseId(phase.id)

    function isStillRelevant(): boolean {
      return isMountedRef.current && activeProjectIdRef.current === mutationProjectId
    }

    const run = async (): Promise<void> => {
      try {
        const removed = await window.themeFactoryApi.phases.remove(phase.id)
        if (!isStillRelevant()) {
          return
        }
        if (removed) {
          setPhases((current) => current.filter((item) => item.id !== phase.id))
        } else {
          setDeleteErrorMessage("La suppression a échoué : cette phase n'existe peut-être plus.")
        }
      } catch (error) {
        if (!isStillRelevant()) {
          return
        }
        setDeleteErrorMessage(getErrorMessage(error))
      } finally {
        if (isStillRelevant()) {
          setDeletingPhaseId(null)
        }
      }
    }

    void run()
  }

  return (
    <div className="phases-page">
      <p className="phases-page__active-project">Projet actif : {project.name}</p>

      <div className="phases-page__toolbar">
        <button
          type="button"
          className="phases-page__create-button"
          onClick={handleOpenCreateForm}
          disabled={formState.mode !== 'closed' || isSubmittingForm}
        >
          Nouvelle phase
        </button>
      </div>

      {deleteErrorMessage ? (
        <p role="alert" className="phases-page__error">
          {deleteErrorMessage}
        </p>
      ) : null}

      {formState.mode !== 'closed' ? (
        <PhaseForm
          key={formState.mode === 'edit' ? `edit-${formState.phase.id}` : 'create'}
          mode={formState.mode}
          initialPhase={formState.mode === 'edit' ? formState.phase : undefined}
          isSubmitting={isSubmittingForm}
          errorMessage={formErrorMessage}
          onCancel={handleCancelForm}
          onSubmit={handleSubmitForm}
        />
      ) : null}

      {loadState.status === 'loading' ? <p role="status">Chargement des phases…</p> : null}

      {loadState.status === 'error' ? (
        <div role="alert" className="phases-page__error">
          <p>{loadState.message}</p>
          <button type="button" onClick={() => void loadPhases(project.id)}>
            Réessayer
          </button>
        </div>
      ) : null}

      {loadState.status === 'loaded' && phases.length === 0 ? (
        <p className="phases-page__empty">Aucune phase enregistrée pour ce projet.</p>
      ) : null}

      {loadState.status === 'loaded' && phases.length > 0 ? (
        <ul className="phases-page__list">
          {phases.map((phase, index) => (
            <li key={phase.id}>
              <PhaseCard
                phase={phase}
                displayPosition={index + 1}
                isDeleting={deletingPhaseId === phase.id}
                disableModify={formState.mode !== 'closed'}
                disableDelete={formState.mode !== 'closed' || deletingPhaseId !== null}
                onEdit={() => handleOpenEditForm(phase)}
                onDelete={() => handleDelete(phase)}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
