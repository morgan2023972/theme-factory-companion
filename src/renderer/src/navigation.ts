export type NavigationId =
  | 'dashboard'
  | 'projects'
  | 'phasesAndTasks'
  | 'questions'
  | 'issues'
  | 'decisions'
  | 'activityLog'
  | 'settings'

export interface NavigationDestination {
  readonly id: NavigationId
  readonly label: string
  readonly description: string
  readonly plannedNote: string
}

export const NAVIGATION_DESTINATIONS: readonly NavigationDestination[] = [
  {
    id: 'dashboard',
    label: 'Tableau de bord',
    description: "Vue d'ensemble de l'état des projets et de l'activité récente.",
    plannedNote: 'Le tableau de bord agrégé complet sera développé en Phase 6 de la feuille de route.'
  },
  {
    id: 'projects',
    label: 'Projets',
    description: 'Suivi des projets de création de thèmes Shopify.',
    plannedNote: 'Ce module sera développé en Phase 3 de la feuille de route.'
  },
  {
    id: 'phasesAndTasks',
    label: 'Phases et tâches',
    description: 'Découpage des projets en phases et gestion des tâches associées.',
    plannedNote: 'Ce module sera développé en Phases 3 et 4 de la feuille de route.'
  },
  {
    id: 'questions',
    label: 'Questions',
    description: "Suivi des questions ouvertes sur un projet.",
    plannedNote: 'Ce module sera développé en Phase 5 de la feuille de route.'
  },
  {
    id: 'issues',
    label: 'Problèmes',
    description: 'Suivi des problèmes rencontrés au fil du projet.',
    plannedNote: 'Ce module sera développé en Phase 5 de la feuille de route.'
  },
  {
    id: 'decisions',
    label: 'Décisions',
    description: 'Registre des décisions prises sur un projet.',
    plannedNote: 'Ce module sera développé en Phase 5 de la feuille de route.'
  },
  {
    id: 'activityLog',
    label: "Journal d'activité",
    description: 'Historique chronologique des événements du projet.',
    plannedNote: 'Ce module sera développé en Phase 6 de la feuille de route.'
  },
  {
    id: 'settings',
    label: 'Paramètres',
    description: "Réglages de l'application.",
    plannedNote: "Aucune phase dédiée n'est encore définie dans la feuille de route pour ce module."
  }
] as const

export const DEFAULT_NAVIGATION_ID: NavigationId = 'dashboard'
