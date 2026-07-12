export function DashboardStatus(): React.JSX.Element {
  const appInfo = window.themeFactoryApi.app.getInfo()

  return (
    <dl className="dashboard-status">
      <div className="dashboard-status__row">
        <dt>Application</dt>
        <dd>{appInfo.name}</dd>
      </div>
      <div className="dashboard-status__row">
        <dt>Phase</dt>
        <dd>{appInfo.phase}</dd>
      </div>
      <div className="dashboard-status__row">
        <dt>Environnement</dt>
        <dd>{appInfo.environment}</dd>
      </div>
      <div className="dashboard-status__row">
        <dt>Pont preload sécurisé</dt>
        <dd>Opérationnel</dd>
      </div>
    </dl>
  )
}
