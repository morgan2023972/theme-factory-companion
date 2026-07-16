import type { ProjectStatus } from '../../../../shared/schemas/project'

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Planification',
  active: 'Actif',
  paused: 'En pause',
  completed: 'Terminé',
  archived: 'Archivé'
}
