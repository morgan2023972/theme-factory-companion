import { APP_NAME } from '../../shared/appInfo'

const FUTURE_MODULES = ['Projets', 'Phases', 'Tâches', 'Problèmes', 'Décisions'] as const

function App(): React.JSX.Element {
  return (
    <main className="app">
      <h1>{APP_NAME}</h1>
      <p className="status">Le socle Electron est opérationnel.</p>
      <p className="phase">Phase 1 en cours — ce socle ne contient aucune fonctionnalité métier.</p>

      <section>
        <h2>Modules à venir</h2>
        <ul>
          {FUTURE_MODULES.map((module) => (
            <li key={module}>{module}</li>
          ))}
        </ul>
      </section>
    </main>
  )
}

export default App
