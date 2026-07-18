// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ThemeFactoryApi } from '../../shared/contracts/themeFactoryApi'
import type { Phase } from '../../shared/schemas/phase'
import type { Project } from '../../shared/schemas/project'
import App from './App'

/**
 * Test d'intégration du câblage réel `App.tsx` → `ProjectsPage` → projet actif
 * → `PhasesPage` (aucun harnais reconstruit à la main : c'est précisément ce
 * fil qui doit être vérifié, voir REVIEW_CORRECTIONS_PHASE_3.7.md et la
 * section 3 de PHASE_3.8_PROMPT.md).
 */

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

type ProjectsApiMock = {
  list: ReturnType<typeof vi.fn>
  getById: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
}

type PhasesApiMock = {
  listByProjectId: ReturnType<typeof vi.fn>
  getById: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
}

let projectsApi: ProjectsApiMock
let phasesApi: PhasesApiMock

function installThemeFactoryApi(): void {
  projectsApi = {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn()
  }
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
    projects: projectsApi as unknown as ThemeFactoryApi['projects'],
    phases: phasesApi as unknown as ThemeFactoryApi['phases']
  }

  Object.defineProperty(window, 'themeFactoryApi', {
    value: api,
    configurable: true,
    writable: true
  })
}

async function goToProjects(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Projets' }))
}

async function goToPhases(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Phases et tâches' }))
}

beforeEach(() => {
  installThemeFactoryApi()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('App — câblage réel du projet actif entre ProjectsPage et PhasesPage', () => {
  it('sélectionne le projet A, navigue vers Phases, puis change pour B et charge les bonnes phases sans fuite', async () => {
    const projectA = makeProject({ id: '00000000-0000-4000-8000-0000000000a1', name: 'Projet A' })
    const projectB = makeProject({ id: '00000000-0000-4000-8000-0000000000b1', name: 'Projet B' })
    const phaseA = makePhase({
      id: '11111111-0000-4000-8000-000000000001',
      projectId: projectA.id,
      name: 'Phase du projet A'
    })
    const phaseB = makePhase({
      id: '11111111-0000-4000-8000-000000000002',
      projectId: projectB.id,
      name: 'Phase du projet B'
    })

    projectsApi.list.mockResolvedValue([projectA, projectB])
    phasesApi.listByProjectId.mockImplementation((projectId: string) =>
      Promise.resolve(projectId === projectA.id ? [phaseA] : [phaseB])
    )

    const user = userEvent.setup()
    render(<App />)

    // 1-3. Ouvrir Projets, charger une liste de deux projets.
    await goToProjects(user)
    await screen.findByText('Projet A')
    await screen.findByText('Projet B')

    // 4. Sélectionner le projet A.
    const cardA = screen.getByText('Projet A').closest('article') as HTMLElement
    await user.click(within(cardA).getByRole('button', { name: 'Sélectionner' }))
    expect(within(cardA).getByRole('button', { name: 'Actif' })).toBeTruthy()

    // 5-6-7. Naviguer vers Phases : listByProjectId appelé avec A, phases de A affichées.
    await goToPhases(user)
    expect(await screen.findByText('Projet actif : Projet A')).toBeTruthy()
    expect(phasesApi.listByProjectId).toHaveBeenCalledWith(projectA.id)
    expect(await screen.findByText(/Phase du projet A/)).toBeTruthy()

    // 8-9. Revenir vers Projets, sélectionner B.
    await goToProjects(user)
    const cardB = screen.getByText('Projet B').closest('article') as HTMLElement
    await user.click(within(cardB).getByRole('button', { name: 'Sélectionner' }))
    expect(within(cardB).getByRole('button', { name: 'Actif' })).toBeTruthy()

    // 10-11-12-13. Revenir vers Phases : API appelée avec B, phases de A disparues, phases de B affichées.
    await goToPhases(user)
    expect(await screen.findByText('Projet actif : Projet B')).toBeTruthy()
    expect(phasesApi.listByProjectId).toHaveBeenCalledWith(projectB.id)
    expect(await screen.findByText(/Phase du projet B/)).toBeTruthy()
    expect(screen.queryByText(/Phase du projet A/)).toBeNull()
  })

  it('remet le projet actif à null lors de sa suppression et revient à l\'état « aucun projet actif » sur Phases', async () => {
    const projectA = makeProject({ id: '00000000-0000-4000-8000-0000000000a2', name: 'Projet A' })
    projectsApi.list.mockResolvedValue([projectA])
    phasesApi.listByProjectId.mockResolvedValue([makePhase({ projectId: projectA.id, name: 'Phase de A' })])
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    projectsApi.remove.mockResolvedValue(true)

    const user = userEvent.setup()
    render(<App />)

    // 1. Sélectionner le projet A.
    await goToProjects(user)
    await screen.findByText('Projet A')
    const cardA = screen.getByText('Projet A').closest('article') as HTMLElement
    await user.click(within(cardA).getByRole('button', { name: 'Sélectionner' }))

    // 2. Ouvrir ses phases.
    await goToPhases(user)
    expect(await screen.findByText(/Phase de A/)).toBeTruthy()

    // 3-4. Revenir sur Projets, supprimer A.
    await goToProjects(user)
    await user.click(screen.getByRole('button', { name: 'Supprimer' }))
    await act(async () => {
      await Promise.resolve()
    })

    // 5-6-7-8. Le projet actif est remis à null : revenir sur Phases affiche
    // l'état « aucun projet actif », sans nouvel appel listByProjectId pour A.
    phasesApi.listByProjectId.mockClear()
    await goToPhases(user)
    expect(
      await screen.findByText("Sélectionnez d'abord un projet actif pour gérer ses phases.")
    ).toBeTruthy()
    expect(phasesApi.listByProjectId).not.toHaveBeenCalled()
  })
})
