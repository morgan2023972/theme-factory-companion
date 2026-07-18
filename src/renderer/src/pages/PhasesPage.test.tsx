// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ThemeFactoryApi } from '../../../shared/contracts/themeFactoryApi'
import type { Phase } from '../../../shared/schemas/phase'
import type { Project } from '../../../shared/schemas/project'
import { PhasesPage } from './PhasesPage'

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: overrides.id ?? '00000000-0000-4000-8000-000000000001',
    name: overrides.name ?? 'Projet de test',
    description: overrides.description ?? null,
    objective: overrides.objective ?? null,
    status: overrides.status ?? 'planning',
    repositoryPath: overrides.repositoryPath ?? null,
    targetTechnology: overrides.targetTechnology ?? null,
    notes: overrides.notes ?? null,
    createdAt: overrides.createdAt ?? '2026-07-16T10:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-07-16T10:00:00.000Z'
  }
}

function makePhase(overrides: Partial<Phase> = {}): Phase {
  return {
    id: overrides.id ?? '123e4567-e89b-12d3-a456-426614174000',
    projectId: overrides.projectId ?? '00000000-0000-4000-8000-000000000001',
    name: overrides.name ?? 'Phase de test',
    description: overrides.description ?? null,
    status: overrides.status ?? 'pending',
    position: overrides.position ?? 0,
    createdAt: overrides.createdAt ?? '2026-07-16T10:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-07-16T10:00:00.000Z'
  }
}

type PhasesApiMock = {
  listByProjectId: ReturnType<typeof vi.fn>
  getById: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
}

let phasesApi: PhasesApiMock

function installThemeFactoryApi(): void {
  phasesApi = {
    listByProjectId: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn()
  }

  const api: ThemeFactoryApi = {
    app: {
      getInfo: () => ({ name: 'Theme Factory Companion', phase: 'Phase 3', environment: 'development' })
    },
    projects: {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn()
    },
    phases: phasesApi as unknown as ThemeFactoryApi['phases']
  }

  Object.defineProperty(window, 'themeFactoryApi', {
    value: api,
    configurable: true,
    writable: true
  })
}

beforeEach(() => {
  installThemeFactoryApi()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('PhasesPage — aucun projet actif', () => {
  it("affiche un message invitant à sélectionner un projet et n'appelle pas listByProjectId", () => {
    render(<PhasesPage activeProject={null} />)

    expect(
      screen.getByText("Sélectionnez d'abord un projet actif pour gérer ses phases.")
    ).toBeTruthy()
    expect(phasesApi.listByProjectId).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Nouvelle phase' })).toBeNull()
  })
})

describe('PhasesPage — chargement', () => {
  it('affiche un état de chargement puis la liste des phases, dans l\'ordre retourné par l\'API', async () => {
    const project = makeProject()
    const first = makePhase({ id: 'aaaaaaaa-0000-4000-8000-000000000001', name: 'Conception', position: 0 })
    const second = makePhase({ id: 'aaaaaaaa-0000-4000-8000-000000000002', name: 'Développement', position: 1 })
    let resolveList: (value: Phase[]) => void = () => undefined
    phasesApi.listByProjectId.mockReturnValue(
      new Promise<Phase[]>((resolve) => {
        resolveList = resolve
      })
    )

    render(<PhasesPage activeProject={project} />)

    expect(screen.getByRole('status')).toHaveTextContent('Chargement')
    expect(phasesApi.listByProjectId).toHaveBeenCalledWith(project.id)

    await act(async () => {
      resolveList([first, second])
    })

    expect(await screen.findByText(/Conception/)).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()

    const names = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
    expect(names[0]).toContain('Conception')
    expect(names[1]).toContain('Développement')
  })

  it('affiche un état vide quand le projet actif ne contient aucune phase', async () => {
    phasesApi.listByProjectId.mockResolvedValue([])

    render(<PhasesPage activeProject={makeProject()} />)

    expect(await screen.findByText('Aucune phase enregistrée pour ce projet.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Nouvelle phase' })).toBeTruthy()
  })

  it('affiche une erreur lisible si le chargement échoue, avec un bouton pour réessayer', async () => {
    phasesApi.listByProjectId.mockRejectedValueOnce(new Error('Panne réseau simulée'))

    render(<PhasesPage activeProject={makeProject()} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Panne réseau simulée')

    phasesApi.listByProjectId.mockResolvedValueOnce([makePhase()])
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByText(/Phase de test/)).toBeTruthy()
  })
})

describe('PhasesPage — création', () => {
  it('ouvre le formulaire, crée une phase rattachée au projet actif et l\'affiche', async () => {
    const project = makeProject()
    phasesApi.listByProjectId.mockResolvedValue([])
    const created = makePhase({ name: 'Nouvelle phase créée' })
    phasesApi.create.mockResolvedValue(created)

    const user = userEvent.setup()
    render(<PhasesPage activeProject={project} />)

    await screen.findByText('Aucune phase enregistrée pour ce projet.')

    await user.click(screen.getByRole('button', { name: 'Nouvelle phase' }))
    await user.type(screen.getByLabelText('Nom'), 'Nouvelle phase créée')
    await user.click(screen.getByRole('button', { name: 'Créer la phase' }))

    expect(await screen.findByText(/Nouvelle phase créée/)).toBeTruthy()
    expect(phasesApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: project.id, name: 'Nouvelle phase créée' })
    )
  })

  it('laisse la position vide par défaut : aucune clé position transmise (attribution automatique)', async () => {
    const project = makeProject()
    phasesApi.listByProjectId.mockResolvedValue([])
    phasesApi.create.mockResolvedValue(makePhase())

    const user = userEvent.setup()
    render(<PhasesPage activeProject={project} />)

    await screen.findByText('Aucune phase enregistrée pour ce projet.')
    await user.click(screen.getByRole('button', { name: 'Nouvelle phase' }))
    await user.type(screen.getByLabelText('Nom'), 'Phase sans position')
    await user.click(screen.getByRole('button', { name: 'Créer la phase' }))

    await waitFor(() => expect(phasesApi.create).toHaveBeenCalled())
    const payload = phasesApi.create.mock.calls[0]?.[0]
    expect(payload).not.toHaveProperty('position')
  })

  it('empêche la double soumission pendant la création', async () => {
    const project = makeProject()
    phasesApi.listByProjectId.mockResolvedValue([])
    let resolveCreate: (value: Phase) => void = () => undefined
    phasesApi.create.mockReturnValue(
      new Promise<Phase>((resolve) => {
        resolveCreate = resolve
      })
    )

    const user = userEvent.setup()
    render(<PhasesPage activeProject={project} />)

    await screen.findByText('Aucune phase enregistrée pour ce projet.')
    await user.click(screen.getByRole('button', { name: 'Nouvelle phase' }))
    await user.type(screen.getByLabelText('Nom'), 'Phase en cours de création')

    const submitButton = screen.getByRole('button', { name: 'Créer la phase' })
    await user.click(submitButton)
    expect(screen.getByRole('button', { name: /Enregistrement/ })).toBeDisabled()

    await act(async () => {
      resolveCreate(makePhase({ name: 'Phase en cours de création' }))
    })

    expect(phasesApi.create).toHaveBeenCalledTimes(1)
  })

  it('affiche une erreur si la création échoue et conserve le formulaire ouvert avec les valeurs saisies', async () => {
    const project = makeProject()
    phasesApi.listByProjectId.mockResolvedValue([])
    phasesApi.create.mockRejectedValueOnce(new Error('Création impossible'))

    const user = userEvent.setup()
    render(<PhasesPage activeProject={project} />)

    await screen.findByText('Aucune phase enregistrée pour ce projet.')
    await user.click(screen.getByRole('button', { name: 'Nouvelle phase' }))
    await user.type(screen.getByLabelText('Nom'), 'Phase en échec')
    await user.click(screen.getByRole('button', { name: 'Créer la phase' }))

    expect(await screen.findByText('Création impossible')).toBeTruthy()
    expect(screen.getByLabelText('Nom')).toHaveValue('Phase en échec')
    expect(screen.getByRole('button', { name: 'Créer la phase' })).not.toBeDisabled()
  })
})

describe('PhasesPage — modification', () => {
  it('ouvre un formulaire prérempli, appelle update avec le bon identifiant et met à jour l\'affichage', async () => {
    const project = makeProject()
    const phase = makePhase({ name: 'Phase initiale' })
    phasesApi.listByProjectId.mockResolvedValue([phase])
    const updated = { ...phase, name: 'Phase renommée' }
    phasesApi.update.mockResolvedValue(updated)

    const user = userEvent.setup()
    render(<PhasesPage activeProject={project} />)

    await screen.findByText(/Phase initiale/)
    await user.click(screen.getByRole('button', { name: `Modifier la phase ${phase.name}` }))

    const nameField = screen.getByLabelText('Nom') as HTMLInputElement
    expect(nameField.value).toBe('Phase initiale')

    await user.clear(nameField)
    await user.type(nameField, 'Phase renommée')
    await user.click(screen.getByRole('button', { name: /Enregistrer/ }))

    expect(await screen.findByText(/Phase renommée/)).toBeTruthy()
    expect(phasesApi.update).toHaveBeenCalledWith(phase.id, expect.objectContaining({ name: 'Phase renommée' }))
    expect(phasesApi.update.mock.calls[0]?.[1]).not.toHaveProperty('projectId')
  })

  it("affiche une erreur et garde le formulaire ouvert si la phase n'existe plus (update renvoie null)", async () => {
    const project = makeProject()
    const phase = makePhase({ name: 'Phase fantôme' })
    phasesApi.listByProjectId.mockResolvedValue([phase])
    phasesApi.update.mockResolvedValue(null)

    const user = userEvent.setup()
    render(<PhasesPage activeProject={project} />)

    await screen.findByText(/Phase fantôme/)
    await user.click(screen.getByRole('button', { name: `Modifier la phase ${phase.name}` }))

    const nameField = screen.getByLabelText('Nom') as HTMLInputElement
    await user.clear(nameField)
    await user.type(nameField, 'Nom modifié localement')
    await user.click(screen.getByRole('button', { name: /Enregistrer/ }))

    expect(
      await screen.findByText("Cette phase n'existe plus : elle a peut-être été supprimée entre-temps.")
    ).toBeTruthy()
    expect(screen.getByLabelText('Nom')).toHaveValue('Nom modifié localement')
  })

  it('permet d\'annuler la modification sans appeler update', async () => {
    const project = makeProject()
    const phase = makePhase({ name: 'Phase à ne pas modifier' })
    phasesApi.listByProjectId.mockResolvedValue([phase])

    const user = userEvent.setup()
    render(<PhasesPage activeProject={project} />)

    await screen.findByText(/Phase à ne pas modifier/)
    await user.click(screen.getByRole('button', { name: `Modifier la phase ${phase.name}` }))
    await user.type(screen.getByLabelText('Nom'), ' modifié')
    await user.click(screen.getByRole('button', { name: /Annuler/ }))

    expect(screen.queryByLabelText('Nom')).toBeNull()
    expect(phasesApi.update).not.toHaveBeenCalled()
  })
})

describe('PhasesPage — suppression', () => {
  it('demande une confirmation et annule la suppression si elle est refusée', async () => {
    const project = makeProject()
    const phase = makePhase()
    phasesApi.listByProjectId.mockResolvedValue([phase])
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    const user = userEvent.setup()
    render(<PhasesPage activeProject={project} />)

    await screen.findByText(/Phase de test/)
    await user.click(screen.getByRole('button', { name: `Supprimer la phase ${phase.name}` }))

    expect(window.confirm).toHaveBeenCalled()
    expect(phasesApi.remove).not.toHaveBeenCalled()
    expect(screen.getByText(/Phase de test/)).toBeTruthy()
  })

  it('supprime la phase après confirmation et met à jour la liste', async () => {
    const project = makeProject()
    const phase = makePhase()
    phasesApi.listByProjectId.mockResolvedValue([phase])
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    phasesApi.remove.mockResolvedValue(true)

    const user = userEvent.setup()
    render(<PhasesPage activeProject={project} />)

    await screen.findByText(/Phase de test/)
    await user.click(screen.getByRole('button', { name: `Supprimer la phase ${phase.name}` }))

    await waitFor(() => expect(phasesApi.remove).toHaveBeenCalledWith(phase.id))
    expect(await screen.findByText('Aucune phase enregistrée pour ce projet.')).toBeTruthy()
  })

  it('affiche une erreur si la suppression retourne false', async () => {
    const project = makeProject()
    const phase = makePhase()
    phasesApi.listByProjectId.mockResolvedValue([phase])
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    phasesApi.remove.mockResolvedValue(false)

    const user = userEvent.setup()
    render(<PhasesPage activeProject={project} />)

    await screen.findByText(/Phase de test/)
    await user.click(screen.getByRole('button', { name: `Supprimer la phase ${phase.name}` }))

    expect(await screen.findByText("La suppression a échoué : cette phase n'existe peut-être plus.")).toBeTruthy()
    expect(screen.getByText(/Phase de test/)).toBeTruthy()
  })

  it('affiche une erreur si la suppression échoue (exception)', async () => {
    const project = makeProject()
    const phase = makePhase()
    phasesApi.listByProjectId.mockResolvedValue([phase])
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    phasesApi.remove.mockRejectedValue(new Error('Suppression impossible'))

    const user = userEvent.setup()
    render(<PhasesPage activeProject={project} />)

    await screen.findByText(/Phase de test/)
    await user.click(screen.getByRole('button', { name: `Supprimer la phase ${phase.name}` }))

    expect(await screen.findByText('Suppression impossible')).toBeTruthy()
    expect(screen.getByText(/Phase de test/)).toBeTruthy()
  })
})

describe('PhasesPage — changement de projet actif', () => {
  it('recharge les phases avec le nouvel identifiant et n\'affiche plus celles de l\'ancien projet', async () => {
    const firstProject = makeProject({ id: '00000000-0000-4000-8000-000000000001', name: 'Projet A' })
    const secondProject = makeProject({ id: '00000000-0000-4000-8000-000000000002', name: 'Projet B' })
    const phaseOfFirst = makePhase({ projectId: firstProject.id, name: 'Phase du projet A' })
    const phaseOfSecond = makePhase({
      id: '123e4567-e89b-12d3-a456-426614174099',
      projectId: secondProject.id,
      name: 'Phase du projet B'
    })

    phasesApi.listByProjectId.mockImplementation((projectId: string) =>
      Promise.resolve(projectId === firstProject.id ? [phaseOfFirst] : [phaseOfSecond])
    )

    const { rerender } = render(<PhasesPage activeProject={firstProject} />)

    expect(await screen.findByText(/Phase du projet A/)).toBeTruthy()

    rerender(<PhasesPage activeProject={secondProject} />)

    expect(await screen.findByText(/Phase du projet B/)).toBeTruthy()
    expect(screen.queryByText(/Phase du projet A/)).toBeNull()
    expect(phasesApi.listByProjectId).toHaveBeenCalledWith(secondProject.id)
  })

  it("revient à l'état « aucun projet actif » quand le projet actif est désélectionné", async () => {
    const project = makeProject()
    phasesApi.listByProjectId.mockResolvedValue([makePhase()])

    const { rerender } = render(<PhasesPage activeProject={project} />)
    expect(await screen.findByText(/Phase de test/)).toBeTruthy()

    rerender(<PhasesPage activeProject={null} />)

    expect(
      await screen.findByText("Sélectionnez d'abord un projet actif pour gérer ses phases.")
    ).toBeTruthy()
    expect(screen.queryByText(/Phase de test/)).toBeNull()
  })
})

describe('PhasesPage — concurrence lors d\'un changement de projet actif', () => {
  it("ignore une réponse listByProjectId obsolète : la phase de l'ancien projet actif n'apparaît jamais après une résolution tardive", async () => {
    const projectA = makeProject({ id: '00000000-0000-4000-8000-00000000000a', name: 'Projet A' })
    const projectB = makeProject({ id: '00000000-0000-4000-8000-00000000000b', name: 'Projet B' })
    const phaseA = makePhase({
      id: '11111111-0000-4000-8000-000000000001',
      projectId: projectA.id,
      name: 'Phase A tardive'
    })
    const phaseB = makePhase({
      id: '11111111-0000-4000-8000-000000000002',
      projectId: projectB.id,
      name: 'Phase B'
    })

    let resolveA: (value: Phase[]) => void = () => undefined
    let resolveB: (value: Phase[]) => void = () => undefined
    phasesApi.listByProjectId.mockImplementation((projectId: string) => {
      if (projectId === projectA.id) {
        return new Promise<Phase[]>((resolve) => {
          resolveA = resolve
        })
      }
      return new Promise<Phase[]>((resolve) => {
        resolveB = resolve
      })
    })

    const { rerender } = render(<PhasesPage activeProject={projectA} />)
    rerender(<PhasesPage activeProject={projectB} />)

    // B se résout en premier (l'ordre "réel" de résolution est inversé par
    // rapport à l'ordre des appels).
    await act(async () => {
      resolveB([phaseB])
    })
    expect(await screen.findByText(/Phase B/)).toBeTruthy()

    // La réponse tardive de A arrive ensuite : elle doit être ignorée.
    await act(async () => {
      resolveA([phaseA])
    })

    expect(screen.queryByText(/Phase A tardive/)).toBeNull()
    expect(screen.getByText(/Phase B/)).toBeTruthy()
    expect(screen.getByText('Projet actif : Projet B')).toBeTruthy()
  })

  it("ignore une erreur de chargement obsolète : les phases du nouveau projet restent affichées", async () => {
    const projectA = makeProject({ id: '00000000-0000-4000-8000-00000000000a', name: 'Projet A' })
    const projectB = makeProject({ id: '00000000-0000-4000-8000-00000000000b', name: 'Projet B' })
    const phaseB = makePhase({
      id: '11111111-0000-4000-8000-000000000003',
      projectId: projectB.id,
      name: 'Phase B stable'
    })

    let rejectA: (error: Error) => void = () => undefined
    phasesApi.listByProjectId.mockImplementation((projectId: string) => {
      if (projectId === projectA.id) {
        return new Promise<Phase[]>((_resolve, reject) => {
          rejectA = reject
        })
      }
      return Promise.resolve([phaseB])
    })

    const { rerender } = render(<PhasesPage activeProject={projectA} />)
    rerender(<PhasesPage activeProject={projectB} />)

    expect(await screen.findByText(/Phase B stable/)).toBeTruthy()

    await act(async () => {
      rejectA(new Error('Échec tardif du chargement de A'))
    })

    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText(/Phase B stable/)).toBeTruthy()
  })

  it("une création en vol pour A ne bloque pas le bouton Nouvelle phase de B et n'y ajoute jamais la phase de A", async () => {
    const projectA = makeProject({ id: '00000000-0000-4000-8000-00000000000a', name: 'Projet A' })
    const projectB = makeProject({ id: '00000000-0000-4000-8000-00000000000b', name: 'Projet B' })
    phasesApi.listByProjectId.mockResolvedValue([])

    let resolveCreate: (value: Phase) => void = () => undefined
    phasesApi.create.mockReturnValue(
      new Promise<Phase>((resolve) => {
        resolveCreate = resolve
      })
    )

    const user = userEvent.setup()
    const { rerender } = render(<PhasesPage activeProject={projectA} />)
    await screen.findByText('Aucune phase enregistrée pour ce projet.')

    await user.click(screen.getByRole('button', { name: 'Nouvelle phase' }))
    await user.type(screen.getByLabelText('Nom'), 'Phase de A en cours')
    await user.click(screen.getByRole('button', { name: 'Créer la phase' }))
    expect(screen.getByRole('button', { name: /Enregistrement/ })).toBeDisabled()

    rerender(<PhasesPage activeProject={projectB} />)
    await screen.findByText('Aucune phase enregistrée pour ce projet.')

    expect(screen.getByRole('button', { name: 'Nouvelle phase' })).not.toBeDisabled()
    expect(screen.queryByLabelText('Nom')).toBeNull()

    await act(async () => {
      resolveCreate(makePhase({ projectId: projectA.id, name: 'Phase de A en cours' }))
    })

    expect(screen.queryByText(/Phase de A en cours/)).toBeNull()
    expect(screen.getByText('Aucune phase enregistrée pour ce projet.')).toBeTruthy()
  })

  it("une erreur tardive d'une création lancée pour A ne s'affiche pas dans le contexte de B, qui reste utilisable", async () => {
    const projectA = makeProject({ id: '00000000-0000-4000-8000-00000000000a', name: 'Projet A' })
    const projectB = makeProject({ id: '00000000-0000-4000-8000-00000000000b', name: 'Projet B' })
    phasesApi.listByProjectId.mockResolvedValue([])

    let rejectCreate: (error: Error) => void = () => undefined
    phasesApi.create.mockReturnValue(
      new Promise<Phase>((_resolve, reject) => {
        rejectCreate = reject
      })
    )

    const user = userEvent.setup()
    const { rerender } = render(<PhasesPage activeProject={projectA} />)
    await screen.findByText('Aucune phase enregistrée pour ce projet.')

    await user.click(screen.getByRole('button', { name: 'Nouvelle phase' }))
    await user.type(screen.getByLabelText('Nom'), 'Phase vouée à échouer')
    await user.click(screen.getByRole('button', { name: 'Créer la phase' }))

    rerender(<PhasesPage activeProject={projectB} />)
    await screen.findByText('Aucune phase enregistrée pour ce projet.')

    await act(async () => {
      rejectCreate(new Error('Échec tardif du projet A'))
    })

    expect(screen.queryByText('Échec tardif du projet A')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('button', { name: 'Nouvelle phase' })).not.toBeDisabled()
  })

  it("une suppression en vol pour A ne réactive pas prématurément le bouton Supprimer d'une suppression en cours pour B", async () => {
    const projectA = makeProject({ id: '00000000-0000-4000-8000-00000000000a', name: 'Projet A' })
    const projectB = makeProject({ id: '00000000-0000-4000-8000-00000000000b', name: 'Projet B' })
    const phaseA = makePhase({
      id: '11111111-0000-4000-8000-000000000004',
      projectId: projectA.id,
      name: 'Phase A'
    })
    const phaseB = makePhase({
      id: '11111111-0000-4000-8000-000000000005',
      projectId: projectB.id,
      name: 'Phase B'
    })

    phasesApi.listByProjectId.mockImplementation((projectId: string) =>
      Promise.resolve(projectId === projectA.id ? [phaseA] : [phaseB])
    )
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    let resolveRemoveA: (value: boolean) => void = () => undefined
    let resolveRemoveB: (value: boolean) => void = () => undefined
    phasesApi.remove.mockImplementation((id: string) => {
      if (id === phaseA.id) {
        return new Promise<boolean>((resolve) => {
          resolveRemoveA = resolve
        })
      }
      return new Promise<boolean>((resolve) => {
        resolveRemoveB = resolve
      })
    })

    const user = userEvent.setup()
    const { rerender } = render(<PhasesPage activeProject={projectA} />)
    await screen.findByText(/Phase A/)
    await user.click(screen.getByRole('button', { name: `Supprimer la phase ${phaseA.name}` }))

    rerender(<PhasesPage activeProject={projectB} />)
    await screen.findByText(/Phase B/)

    await user.click(screen.getByRole('button', { name: `Supprimer la phase ${phaseB.name}` }))
    expect(screen.getByRole('button', { name: `Supprimer la phase ${phaseB.name}` })).toBeDisabled()

    // La suppression tardive de A ne doit pas réactiver le bouton de B.
    await act(async () => {
      resolveRemoveA(true)
    })
    expect(screen.getByRole('button', { name: `Supprimer la phase ${phaseB.name}` })).toBeDisabled()

    await act(async () => {
      resolveRemoveB(true)
    })
    expect(screen.queryByText(/Phase B/)).toBeNull()
  })
})

describe('PhasesPage — accessibilité des lignes multiples', () => {
  it('identifie chaque bouton Modifier/Supprimer avec le nom de sa phase quand plusieurs lignes existent', async () => {
    const project = makeProject()
    const first = makePhase({ id: 'aaaaaaaa-0000-4000-8000-000000000001', name: 'Phase Un', position: 0 })
    const second = makePhase({ id: 'aaaaaaaa-0000-4000-8000-000000000002', name: 'Phase Deux', position: 1 })
    phasesApi.listByProjectId.mockResolvedValue([first, second])

    render(<PhasesPage activeProject={project} />)

    await screen.findByText(/Phase Un/)

    const firstCard = screen.getByText(/Phase Un/).closest('article') as HTMLElement
    const secondCard = screen.getByText(/Phase Deux/).closest('article') as HTMLElement

    expect(within(firstCard).getByRole('button', { name: 'Modifier la phase Phase Un' })).toBeTruthy()
    expect(within(secondCard).getByRole('button', { name: 'Modifier la phase Phase Deux' })).toBeTruthy()
    expect(within(firstCard).getByRole('button', { name: 'Supprimer la phase Phase Un' })).toBeTruthy()
    expect(within(secondCard).getByRole('button', { name: 'Supprimer la phase Phase Deux' })).toBeTruthy()
  })
})
