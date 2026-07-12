interface PageHeaderProps {
  title: string
}

export function PageHeader({ title }: PageHeaderProps): React.JSX.Element {
  return (
    <header className="page-header">
      <h1>{title}</h1>
    </header>
  )
}
