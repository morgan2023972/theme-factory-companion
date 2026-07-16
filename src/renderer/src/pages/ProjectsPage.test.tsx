// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ThemeFactoryApi } from '../../../shared/contracts/themeFactoryApi'
import type { Project } from '../../../shared/schemas/project'
import { ProjectsPage } from './ProjectsPage'

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: overrides.id ?? '123e4567-e89b-12d3-a456-426614174000',
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

type ProjectsApiMock = {
  list: ReturnType<typeof vi.fn>
  getById: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
}

let projectsApi: ProjectsApiMock

function installThemeFactoryApi(): void {
  projectsApi = {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn()
  }

  const api: ThemeFactoryApi = {
    app: {
      getInfo: () => ({ name: 'Theme Factory Companion', phase: 'Phase 3', environment: 'development' })
    },
    projects: projectsApi as unknown as ThemeFactoryApi['projects']
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

describe('ProjectsPage — chargement', () => {
  it('affiche un état de chargement puis la liste des projets', async () => {
    const project = makeProject()
    let resolveList: (value: Project[]) => void = () => undefined
    projectsApi.list.mockReturnValue(
      new Promise<Project[]>((resolve) => {
        resolveList = resolve
      })
    )

    render(<ProjectsPage />)

    expect(screen.getByRole('status')).toHaveTextContent('Chargement')

    await act(async () => {
      resolveList([project])
    })

    expect(await screen.findByText('Projet de test')).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('affiche un état vide quand aucun projet n\'existe', async () => {
    projectsApi.list.mockResolvedValue([])

    render(<ProjectsPage />)

    expect(await screen.findByText('Aucun projet enregistré pour le moment.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Nouveau projet' })).toBeTruthy()
  })

  it('affiche une erreur lisible si le chargement échoue, avec un bouton pour réessayer', async () => {
    projectsApi.list.mockRejectedValueOnce(new Error('Panne réseau simulée'))

    render(<ProjectsPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Panne réseau simulée')

    projectsApi.list.mockResolvedValueOnce([makeProject()])
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByText('Projet de test')).toBeTruthy()
  })
})

describe('ProjectsPage — création', () => {
  it('ouvre le formulaire, crée un projet et l\'ajoute à la liste', async () => {
    projectsApi.list.mockResolvedValue([])
    const created = makeProject({ name: 'Nouveau projet créé' })
    projectsApi.create.mockResolvedValue(created)

    const user = userEvent.setup()
    render(<ProjectsPage />)

    await screen.findByText('Aucun projet enregistré pour le moment.')

    await user.click(screen.getByRole('button', { name: 'Nouveau projet' }))
    await user.type(screen.getByLabelText('Nom'), 'Nouveau projet créé')
    await user.click(screen.getByRole('button', { name: 'Créer le projet' }))

    expect(await screen.findByText('Nouveau projet créé')).toBeTruthy()
    expect(projectsApi.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Nouveau projet créé' }))
    expect(screen.queryByRole('heading', { name: 'Nouveau projet' })).toBeNull()
  })

  it('permet d\'annuler le formulaire de création sans appeler create', async () => {
    projectsApi.list.mockResolvedValue([])

    const user = userEvent.setup()
    render(<ProjectsPage />)

    await screen.findByText('Aucun projet enregistré pour le moment.')

    await user.click(screen.getByRole('button', { name: 'Nouveau projet' }))
    await user.type(screen.getByLabelText('Nom'), 'Projet abandonné')
    await user.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(screen.queryByLabelText('Nom')).toBeNull()
    expect(projectsApi.create).not.toHaveBeenCalled()
  })

  it('affiche une erreur si la création échoue, conserve les valeurs saisies et réactive la soumission', async () => {
    projectsApi.list.mockResolvedValue([])
    projectsApi.create.mockRejectedValueOnce(new Error('Création impossible'))

    const user = userEvent.setup()
    render(<ProjectsPage />)

    await screen.findByText('Aucun projet enregistré pour le moment.')

    await user.click(screen.getByRole('button', { name: 'Nouveau projet' }))
    await user.type(screen.getByLabelText('Nom'), 'Projet en échec')
    await user.click(screen.getByRole('button', { name: 'Créer le projet' }))

    expect(await screen.findByText('Création impossible')).toBeTruthy()
    expect(projectsApi.create).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Nom')).toHaveValue('Projet en échec')
    expect(screen.getByRole('button', { name: 'Créer le projet' })).not.toBeDisabled()
    expect(screen.queryByText('Aucun projet enregistré pour le moment.')).toBeTruthy()
  })
})

describe('ProjectsPage — modification', () => {
  it('pré-remplit le formulaire et met à jour le projet affiché', async () => {
    const project = makeProject({ name: 'Projet initial' })
    projectsApi.list.mockResolvedValue([project])
    const updated = { ...project, name: 'Projet renommé' }
    projectsApi.update.mockResolvedValue(updated)

    const user = userEvent.setup()
    render(<ProjectsPage />)

    await screen.findByText('Projet initial')
    await user.click(screen.getByRole('button', { name: 'Modifier' }))

    const nameField = screen.getByLabelText('Nom') as HTMLInputElement
    expect(nameField.value).toBe('Projet initial')

    await user.clear(nameField)
    await user.type(nameField, 'Projet renommé')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Projet renommé')).toBeTruthy()
    expect(projectsApi.update).toHaveBeenCalledWith(project.id, expect.objectContaining({ name: 'Projet renommé' }))
  })

  it("affiche une erreur et garde le formulaire ouvert si le projet n'existe plus (update renvoie null)", async () => {
    const project = makeProject({ name: 'Projet fantôme' })
    projectsApi.list.mockResolvedValue([project])
    projectsApi.update.mockResolvedValue(null)

    const user = userEvent.setup()
    render(<ProjectsPage />)

    await screen.findByText('Projet fantôme')
    await user.click(screen.getByRole('button', { name: 'Modifier' }))

    const nameField = screen.getByLabelText('Nom') as HTMLInputElement
    await user.clear(nameField)
    await user.type(nameField, 'Nom modifié localement')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText("Ce projet n'existe plus : il a peut-être été supprimé entre-temps.")).toBeTruthy()
    expect(screen.getByLabelText('Nom')).toHaveValue('Nom modifié localement')
    expect(screen.getByRole('button', { name: 'Enregistrer' })).not.toBeDisabled()
    expect(screen.getByText('Projet fantôme')).toBeTruthy()
  })

  it("ne soumet jamais les valeurs d'un projet A avec l'identifiant d'un projet B après un changement de cible", async () => {
    // Régression du constat n°1 de la review phase 3.4 : ProjectForm ne doit
    // jamais rester monté avec les valeurs de A pendant qu'on cible B.
    const first = makeProject({ id: '00000000-0000-4000-8000-000000000001', name: 'Projet A' })
    const second = makeProject({ id: '00000000-0000-4000-8000-000000000002', name: 'Projet B' })
    projectsApi.list.mockResolvedValue([first, second])
    projectsApi.update.mockResolvedValue({ ...second, name: 'Projet B modifié' })

    const user = userEvent.setup()
    render(<ProjectsPage />)

    await screen.findByText('Projet A')
    const firstCard = screen.getByText('Projet A').closest('article') as HTMLElement
    const secondCard = screen.getByText('Projet B').closest('article') as HTMLElement

    // 1. Ouverture de l'édition du projet A.
    await user.click(within(firstCard).getByRole('button', { name: 'Modifier' }))
    const nameField = screen.getByLabelText('Nom') as HTMLInputElement
    expect(nameField.value).toBe('Projet A')

    // 2. Modification locale d'un champ sans soumettre.
    await user.clear(nameField)
    await user.type(nameField, 'Projet A modifié sans validation')

    // 3. Tentative de clic sur Modifier pour le projet B : doit être sans
    // effet (bouton désactivé tant qu'un formulaire est ouvert), et non
    // silencieusement acceptée en laissant les valeurs de A affichées sous
    // l'identifiant de B.
    const editButtonForB = within(secondCard).getByRole('button', { name: 'Modifier' })
    expect(editButtonForB).toBeDisabled()
    await user.click(editButtonForB)
    expect(screen.getByLabelText('Nom')).toHaveValue('Projet A modifié sans validation')

    // On ferme proprement puis on ouvre l'édition de B : les valeurs
    // affichées doivent être celles de B, jamais celles de A.
    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    await user.click(within(secondCard).getByRole('button', { name: 'Modifier' }))

    const nameFieldForB = screen.getByLabelText('Nom') as HTMLInputElement
    expect(nameFieldForB.value).toBe('Projet B')

    // 4-5-6. Soumission : update doit être appelé avec l'identifiant ET les
    // données de B, jamais celles de A.
    await user.clear(nameFieldForB)
    await user.type(nameFieldForB, 'Projet B modifié')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Projet B modifié')).toBeTruthy()
    expect(projectsApi.update).toHaveBeenCalledTimes(1)
    expect(projectsApi.update).toHaveBeenCalledWith(second.id, expect.objectContaining({ name: 'Projet B modifié' }))
  })
})

describe('ProjectsPage — suppression', () => {
  it('demande une confirmation et annule la suppression si elle est refusée', async () => {
    const project = makeProject()
    projectsApi.list.mockResolvedValue([project])
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    const user = userEvent.setup()
    render(<ProjectsPage />)

    await screen.findByText('Projet de test')
    await user.click(screen.getByRole('button', { name: 'Supprimer' }))

    expect(window.confirm).toHaveBeenCalled()
    expect(projectsApi.remove).not.toHaveBeenCalled()
    expect(screen.getByText('Projet de test')).toBeTruthy()
  })

  it('supprime le projet après confirmation', async () => {
    const project = makeProject()
    projectsApi.list.mockResolvedValue([project])
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    projectsApi.remove.mockResolvedValue(true)

    const user = userEvent.setup()
    render(<ProjectsPage />)

    await screen.findByText('Projet de test')
    await user.click(screen.getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(projectsApi.remove).toHaveBeenCalledWith(project.id))
    expect(await screen.findByText('Aucun projet enregistré pour le moment.')).toBeTruthy()
  })

  it('affiche une erreur si la suppression échoue', async () => {
    const project = makeProject()
    projectsApi.list.mockResolvedValue([project])
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    projectsApi.remove.mockRejectedValue(new Error('Suppression impossible'))

    const user = userEvent.setup()
    render(<ProjectsPage />)

    await screen.findByText('Projet de test')
    await user.click(screen.getByRole('button', { name: 'Supprimer' }))

    expect(await screen.findByText('Suppression impossible')).toBeTruthy()
    expect(screen.getByText('Projet de test')).toBeTruthy()
  })

  it("désactive le bouton Supprimer des autres cartes pendant qu'une suppression est en cours (aucun clic mort)", async () => {
    const first = makeProject({ id: '00000000-0000-4000-8000-000000000001', name: 'Projet A' })
    const second = makeProject({ id: '00000000-0000-4000-8000-000000000002', name: 'Projet B' })
    projectsApi.list.mockResolvedValue([first, second])
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    let resolveRemove: (value: boolean) => void = () => undefined
    projectsApi.remove.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveRemove = resolve
      })
    )

    const user = userEvent.setup()
    render(<ProjectsPage />)

    await screen.findByText('Projet A')
    const firstCard = screen.getByText('Projet A').closest('article') as HTMLElement
    const secondCard = screen.getByText('Projet B').closest('article') as HTMLElement

    await user.click(within(firstCard).getByRole('button', { name: 'Supprimer' }))

    const deleteButtonForB = within(secondCard).getByRole('button', { name: 'Supprimer' })
    expect(deleteButtonForB).toBeDisabled()
    await user.click(deleteButtonForB)
    expect(projectsApi.remove).toHaveBeenCalledTimes(1)
    expect(projectsApi.remove).not.toHaveBeenCalledWith(second.id)

    await act(async () => {
      resolveRemove(true)
    })

    expect(await screen.findByText('Projet B')).toBeTruthy()
    expect(within(screen.getByText('Projet B').closest('article') as HTMLElement).getByRole('button', {
      name: 'Supprimer'
    })).not.toBeDisabled()
  })
})

describe('ProjectsPage — sélection du projet actif', () => {
  it('sélectionne un seul projet actif à la fois', async () => {
    const first = makeProject({ id: '00000000-0000-4000-8000-000000000001', name: 'Premier projet' })
    const second = makeProject({ id: '00000000-0000-4000-8000-000000000002', name: 'Deuxième projet' })
    projectsApi.list.mockResolvedValue([first, second])

    const user = userEvent.setup()
    render(<ProjectsPage />)

    await screen.findByText('Premier projet')

    const firstCard = screen.getByText('Premier projet').closest('article') as HTMLElement
    const secondCard = screen.getByText('Deuxième projet').closest('article') as HTMLElement

    await user.click(within(firstCard).getByRole('button', { name: 'Sélectionner' }))
    expect(within(firstCard).getByRole('button', { name: 'Actif' })).toBeTruthy()
    expect(firstCard.getAttribute('aria-current')).toBe('true')

    await user.click(within(secondCard).getByRole('button', { name: 'Sélectionner' }))
    expect(within(secondCard).getByRole('button', { name: 'Actif' })).toBeTruthy()
    expect(within(firstCard).getByRole('button', { name: 'Sélectionner' })).toBeTruthy()
    expect(secondCard.getAttribute('aria-current')).toBe('true')
    expect(firstCard.getAttribute('aria-current')).toBeNull()
  })

  it('réinitialise la sélection active si le projet actif est supprimé, sans laisser un autre projet actif par erreur', async () => {
    const first = makeProject({ id: '00000000-0000-4000-8000-000000000001', name: 'Premier projet' })
    const second = makeProject({ id: '00000000-0000-4000-8000-000000000002', name: 'Deuxième projet' })
    projectsApi.list.mockResolvedValue([first, second])
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    projectsApi.remove.mockResolvedValue(true)

    const user = userEvent.setup()
    render(<ProjectsPage />)

    await screen.findByText('Premier projet')
    const firstCard = screen.getByText('Premier projet').closest('article') as HTMLElement
    const secondCard = screen.getByText('Deuxième projet').closest('article') as HTMLElement

    await user.click(within(firstCard).getByRole('button', { name: 'Sélectionner' }))
    expect(within(firstCard).getByRole('button', { name: 'Actif' })).toBeTruthy()

    await user.click(within(firstCard).getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(screen.queryByText('Premier projet')).toBeNull())
    expect(screen.getByText('Deuxième projet')).toBeTruthy()
    expect(within(secondCard).queryByRole('button', { name: 'Actif' })).toBeNull()
    expect(within(secondCard).getByRole('button', { name: 'Sélectionner' })).toBeTruthy()
  })
})
