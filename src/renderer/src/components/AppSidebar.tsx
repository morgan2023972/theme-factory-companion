import { APP_NAME } from '../../../shared/appInfo'
import type { NavigationDestination, NavigationId } from '../navigation'

interface AppSidebarProps {
  destinations: readonly NavigationDestination[]
  activeId: NavigationId
  onSelect: (id: NavigationId) => void
}

export function AppSidebar({ destinations, activeId, onSelect }: AppSidebarProps): React.JSX.Element {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">{APP_NAME}</div>
      <nav className="sidebar__nav" aria-label="Navigation principale">
        <ul className="sidebar__list">
          {destinations.map((destination) => {
            const isActive = destination.id === activeId

            return (
              <li key={destination.id}>
                <button
                  type="button"
                  className={isActive ? 'sidebar__link sidebar__link--active' : 'sidebar__link'}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => onSelect(destination.id)}
                >
                  {destination.label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
