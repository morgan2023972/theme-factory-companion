import { useState } from 'react'
import { AppSidebar } from './components/AppSidebar'
import { PageHeader } from './components/PageHeader'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { DashboardStatus } from './pages/DashboardStatus'
import { DEFAULT_NAVIGATION_ID, NAVIGATION_DESTINATIONS } from './navigation'
import type { NavigationId } from './navigation'

function App(): React.JSX.Element {
  const [activeId, setActiveId] = useState<NavigationId>(DEFAULT_NAVIGATION_ID)
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
          <PlaceholderPage description={activeDestination.description} plannedNote={activeDestination.plannedNote}>
            {activeDestination.id === 'dashboard' ? <DashboardStatus /> : null}
          </PlaceholderPage>
        </main>
      </div>
    </div>
  )
}

export default App
