import type { PhaseStatus } from '../../../../shared/schemas/phase'

export const PHASE_STATUS_LABELS: Record<PhaseStatus, string> = {
  pending: 'À faire',
  in_progress: 'En cours',
  completed: 'Terminée'
}
