import type { ReactNode } from 'react'

interface PlaceholderPageProps {
  description: string
  plannedNote: string
  children?: ReactNode
}

export function PlaceholderPage({
  description,
  plannedNote,
  children
}: PlaceholderPageProps): React.JSX.Element {
  return (
    <div className="placeholder-page">
      <p className="placeholder-page__description">{description}</p>
      <p className="placeholder-page__planned-note">{plannedNote}</p>
      {children}
    </div>
  )
}
