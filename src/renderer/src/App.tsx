const FUTURE_MODULES = ['Projets', 'Phases', 'Tâches', 'Problèmes', 'Décisions'] as const

function App(): React.JSX.Element {
  const appInfo = window.themeFactoryApi.app.getInfo()

  return (
    <main className="app">
      <h1>{appInfo.name}</h1>
      <p className="status">Le pont preload sécurisé est opérationnel.</p>
      <p className="phase">
        {appInfo.phase} — environnement : {appInfo.environment}
      </p>

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
