import { useState } from 'react'
import { AppSidebar } from './components/AppSidebar'
import { PageHeader } from './components/PageHeader'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { DashboardStatus } from './pages/DashboardStatus'
import { ProjectsPage } from './pages/ProjectsPage'
import { PhasesPage } from './pages/PhasesPage'
import { DEFAULT_NAVIGATION_ID, NAVIGATION_DESTINATIONS } from './navigation'
import type { NavigationId } from './navigation'
import type { Project } from '../../shared/schemas/project'

function App(): React.JSX.Element {
  const [activeId, setActiveId] = useState<NavigationId>(DEFAULT_NAVIGATION_ID)
  // Source de vérité unique du projet actif, partagée entre la page Projets
  // et la page Phases (voir la section 7 de PHASE_3.7_PROMPT.md : le
  // mécanisme précédent était un state local à ProjectsPage, invisible des
  // autres pages ; il est levé ici, adaptation minimale nécessaire).
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const activeDestination = NAVIGATION_DESTINATIONS.find((destination) => destination.id === activeId)

  if (!activeDestination) {
    throw new Error(`Destination de navigation inconnue : ${activeId}`)
  }

  return (
    <div className="app-shell">
      <AppSidebar destinations={NAVIGATION_DESTINATIONS} activeId={activeId} onSelect={setActiveId} />
      <div className="app-shell__content">
        <PageHeader title={activeDestination.label} />
        <main className="app-shell__main">
          {activeDestination.id === 'projects' ? (
            <ProjectsPage activeProject={activeProject} onActiveProjectChange={setActiveProject} />
          ) : activeDestination.id === 'phasesAndTasks' ? (
            <PhasesPage activeProject={activeProject} />
          ) : (
            <PlaceholderPage description={activeDestination.description} plannedNote={activeDestination.plannedNote}>
              {activeDestination.id === 'dashboard' ? <DashboardStatus /> : null}
            </PlaceholderPage>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
