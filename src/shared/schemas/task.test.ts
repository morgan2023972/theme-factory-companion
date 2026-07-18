import { describe, expect, it } from 'vitest'
import {
  createTaskSchema,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type Task,
  taskPrioritySchema,
  taskSchema,
  taskStatusSchema,
  updateTaskSchema
} from './task'

const VALID_ID = '123e4567-e89b-12d3-a456-426614174000'
const VALID_PROJECT_ID = '00000000-0000-4000-8000-000000000001'
const VALID_PHASE_ID = '00000000-0000-4000-8000-000000000002'
const VALID_TIMESTAMP = '2026-07-16T10:00:00.000Z'

const validTask: Task = {
  id: VALID_ID,
  projectId: VALID_PROJECT_ID,
  phaseId: VALID_PHASE_ID,
  title: 'Tâche de test',
  description: null,
  status: 'backlog',
  priority: 'medium',
  claudePrompt: null,
  affectedFiles: null,
  acceptanceCriteria: null,
  validationCommands: null,
  validationResults: null,
  notes: null,
  gitCommit: null,
  position: 0,
  createdAt: VALID_TIMESTAMP,
  updatedAt: VALID_TIMESTAMP
}

describe('TASK_STATUSES / taskStatusSchema', () => {
  it.each(TASK_STATUSES)('accepte le statut autorisé "%s"', (status) => {
    expect(taskStatusSchema.safeParse(status).success).toBe(true)
  })

  it('refuse un statut inconnu', () => {
    expect(taskStatusSchema.safeParse('unknown').success).toBe(false)
  })
})

describe('TASK_PRIORITIES / taskPrioritySchema', () => {
  it.each(TASK_PRIORITIES)('accepte la priorité autorisée "%s"', (priority) => {
    expect(taskPrioritySchema.safeParse(priority).success).toBe(true)
  })

  it('refuse une priorité inconnue', () => {
    expect(taskPrioritySchema.safeParse('urgent').success).toBe(false)
  })
})

describe('taskSchema', () => {
  it('accepte une tâche complète valide', () => {
    expect(taskSchema.safeParse(validTask).success).toBe(true)
  })

  it("refuse un id de tâche qui n'est pas un UUID", () => {
    expect(taskSchema.safeParse({ ...validTask, id: 'not-a-uuid' }).success).toBe(false)
  })

  it("refuse un id de projet qui n'est pas un UUID", () => {
    expect(taskSchema.safeParse({ ...validTask, projectId: 'not-a-uuid' }).success).toBe(false)
  })

  it('accepte une phase absente (phaseId à null)', () => {
    expect(taskSchema.safeParse({ ...validTask, phaseId: null }).success).toBe(true)
  })

  it("refuse un id de phase qui n'est pas un UUID (et n'est pas null)", () => {
    expect(taskSchema.safeParse({ ...validTask, phaseId: 'not-a-uuid' }).success).toBe(false)
  })

  it('refuse un titre vide', () => {
    expect(taskSchema.safeParse({ ...validTask, title: '' }).success).toBe(false)
  })

  it("refuse un titre composé uniquement d'espaces", () => {
    expect(taskSchema.safeParse({ ...validTask, title: '   ' }).success).toBe(false)
  })

  it('accepte le champ nullable description à null', () => {
    expect(taskSchema.safeParse({ ...validTask, description: null }).success).toBe(true)
  })

  it('accepte le champ nullable description renseigné', () => {
    expect(taskSchema.safeParse({ ...validTask, description: 'Une description' }).success).toBe(true)
  })

  it('refuse un statut invalide', () => {
    expect(taskSchema.safeParse({ ...validTask, status: 'unknown' }).success).toBe(false)
  })

  it('refuse une priorité invalide', () => {
    expect(taskSchema.safeParse({ ...validTask, priority: 'urgent' }).success).toBe(false)
  })

  it.each([
    'claudePrompt',
    'affectedFiles',
    'acceptanceCriteria',
    'validationCommands',
    'validationResults',
    'notes',
    'gitCommit'
  ] as const)('accepte le champ nullable %s à null et renseigné', (field) => {
    expect(taskSchema.safeParse({ ...validTask, [field]: null }).success).toBe(true)
    expect(taskSchema.safeParse({ ...validTask, [field]: 'valeur' }).success).toBe(true)
  })

  it('accepte une position valide (0)', () => {
    expect(taskSchema.safeParse({ ...validTask, position: 0 }).success).toBe(true)
  })

  it('refuse une position négative', () => {
    expect(taskSchema.safeParse({ ...validTask, position: -1 }).success).toBe(false)
  })

  it('refuse une position non entière', () => {
    expect(taskSchema.safeParse({ ...validTask, position: 1.5 }).success).toBe(false)
  })

  it('refuse un createdAt invalide', () => {
    expect(taskSchema.safeParse({ ...validTask, createdAt: 'not-a-date' }).success).toBe(false)
  })

  it('refuse un updatedAt invalide', () => {
    expect(taskSchema.safeParse({ ...validTask, updatedAt: 'not-a-date' }).success).toBe(false)
  })

  it('refuse un champ obligatoire absent (title)', () => {
    const { title: _title, ...rest } = validTask
    expect(taskSchema.safeParse(rest).success).toBe(false)
  })

  it('refuse un champ inconnu', () => {
    expect(taskSchema.safeParse({ ...validTask, unknownField: 'x' }).success).toBe(false)
  })
})

describe('createTaskSchema', () => {
  it('accepte une création minimale valide (projectId, title, status, priority)', () => {
    const result = createTaskSchema.safeParse({
      projectId: VALID_PROJECT_ID,
      title: 'Nouvelle tâche',
      status: 'backlog',
      priority: 'low'
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('backlog')
      expect(result.data.phaseId).toBeUndefined()
      expect(result.data.position).toBeUndefined()
    }
  })

  it('refuse une création sans status (aucune valeur par défaut)', () => {
    expect(
      createTaskSchema.safeParse({ projectId: VALID_PROJECT_ID, title: 'Tâche', priority: 'medium' }).success
    ).toBe(false)
  })

  it('refuse une création sans priority (aucune valeur par défaut)', () => {
    expect(
      createTaskSchema.safeParse({ projectId: VALID_PROJECT_ID, title: 'Tâche', status: 'backlog' }).success
    ).toBe(false)
  })

  it('accepte une création avec status: "backlog" fourni explicitement', () => {
    expect(
      createTaskSchema.safeParse({
        projectId: VALID_PROJECT_ID,
        title: 'Nouvelle tâche',
        status: 'backlog',
        priority: 'low'
      }).success
    ).toBe(true)
  })

  it('accepte une création complète valide', () => {
    const result = createTaskSchema.safeParse({
      projectId: VALID_PROJECT_ID,
      phaseId: VALID_PHASE_ID,
      title: 'Nouvelle tâche',
      description: 'Description',
      status: 'ready',
      priority: 'high',
      claudePrompt: 'Prompt Claude Code',
      affectedFiles: '["src/a.ts"]',
      acceptanceCriteria: 'Critère 1',
      validationCommands: 'npm test',
      validationResults: 'OK',
      notes: 'Note libre',
      gitCommit: 'abc1234',
      position: 3
    })
    expect(result.success).toBe(true)
  })

  it('accepte phaseId explicitement à null (tâche sans phase)', () => {
    expect(
      createTaskSchema.safeParse({
        projectId: VALID_PROJECT_ID,
        phaseId: null,
        title: 'Tâche sans phase',
        status: 'backlog',
        priority: 'medium'
      }).success
    ).toBe(true)
  })

  it('normalise les espaces autour du titre', () => {
    const result = createTaskSchema.safeParse({
      projectId: VALID_PROJECT_ID,
      title: '  Tâche avec espaces  ',
      status: 'backlog',
      priority: 'medium'
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.title).toBe('Tâche avec espaces')
    }
  })

  it('refuse un titre vide', () => {
    expect(
      createTaskSchema.safeParse({
        projectId: VALID_PROJECT_ID,
        title: '',
        status: 'backlog',
        priority: 'medium'
      }).success
    ).toBe(false)
  })

  it("refuse un titre composé uniquement d'espaces", () => {
    expect(
      createTaskSchema.safeParse({
        projectId: VALID_PROJECT_ID,
        title: '   ',
        status: 'backlog',
        priority: 'medium'
      }).success
    ).toBe(false)
  })

  it('refuse un statut invalide', () => {
    expect(
      createTaskSchema.safeParse({
        projectId: VALID_PROJECT_ID,
        title: 'Tâche',
        priority: 'medium',
        status: 'unknown'
      }).success
    ).toBe(false)
  })

  it('refuse une priorité invalide', () => {
    expect(
      createTaskSchema.safeParse({
        projectId: VALID_PROJECT_ID,
        title: 'Tâche',
        status: 'backlog',
        priority: 'urgent'
      }).success
    ).toBe(false)
  })

  it('refuse un id de projet invalide', () => {
    expect(
      createTaskSchema.safeParse({
        projectId: 'not-a-uuid',
        title: 'Tâche',
        status: 'backlog',
        priority: 'medium'
      }).success
    ).toBe(false)
  })

  it('refuse un id de phase invalide (et non null)', () => {
    expect(
      createTaskSchema.safeParse({
        projectId: VALID_PROJECT_ID,
        phaseId: 'not-a-uuid',
        title: 'Tâche',
        status: 'backlog',
        priority: 'medium'
      }).success
    ).toBe(false)
  })

  it('refuse une position décimale', () => {
    expect(
      createTaskSchema.safeParse({
        projectId: VALID_PROJECT_ID,
        title: 'Tâche',
        status: 'backlog',
        priority: 'medium',
        position: 1.5
      }).success
    ).toBe(false)
  })

  it('refuse une position négative', () => {
    expect(
      createTaskSchema.safeParse({
        projectId: VALID_PROJECT_ID,
        title: 'Tâche',
        status: 'backlog',
        priority: 'medium',
        position: -1
      }).success
    ).toBe(false)
  })

  it('accepte null explicite sur description', () => {
    expect(
      createTaskSchema.safeParse({
        projectId: VALID_PROJECT_ID,
        title: 'Tâche',
        status: 'backlog',
        priority: 'medium',
        description: null
      }).success
    ).toBe(true)
  })

  it('refuse les champs techniques non autorisés (id, createdAt, updatedAt)', () => {
    expect(
      createTaskSchema.safeParse({
        projectId: VALID_PROJECT_ID,
        title: 'Tâche',
        status: 'backlog',
        priority: 'medium',
        id: VALID_ID,
        createdAt: VALID_TIMESTAMP,
        updatedAt: VALID_TIMESTAMP
      }).success
    ).toBe(false)
  })

  it('refuse un champ inconnu', () => {
    expect(
      createTaskSchema.safeParse({
        projectId: VALID_PROJECT_ID,
        title: 'Tâche',
        status: 'backlog',
        priority: 'medium',
        unknownField: 'x'
      }).success
    ).toBe(false)
  })
})

describe('updateTaskSchema', () => {
  it('accepte une mise à jour partielle valide (un seul champ)', () => {
    expect(updateTaskSchema.safeParse({ title: 'Nouveau titre' }).success).toBe(true)
  })

  it('accepte plusieurs champs valides', () => {
    expect(updateTaskSchema.safeParse({ title: 'Nouveau titre', status: 'in_progress' }).success).toBe(true)
  })

  it('accepte de remettre la description à null', () => {
    expect(updateTaskSchema.safeParse({ description: null }).success).toBe(true)
  })

  it('accepte de détacher la tâche de sa phase (phaseId à null)', () => {
    expect(updateTaskSchema.safeParse({ phaseId: null }).success).toBe(true)
  })

  it('accepte de rattacher la tâche à une autre phase', () => {
    expect(updateTaskSchema.safeParse({ phaseId: VALID_PHASE_ID }).success).toBe(true)
  })

  it('accepte une modification de priorité seule', () => {
    expect(updateTaskSchema.safeParse({ priority: 'critical' }).success).toBe(true)
  })

  it('accepte une modification de position seule', () => {
    expect(updateTaskSchema.safeParse({ position: 2 }).success).toBe(true)
  })

  it('refuse un objet vide', () => {
    expect(updateTaskSchema.safeParse({}).success).toBe(false)
  })

  it('refuse un titre vide', () => {
    expect(updateTaskSchema.safeParse({ title: '' }).success).toBe(false)
  })

  it('refuse un statut invalide', () => {
    expect(updateTaskSchema.safeParse({ status: 'unknown' }).success).toBe(false)
  })

  it('refuse une priorité invalide', () => {
    expect(updateTaskSchema.safeParse({ priority: 'urgent' }).success).toBe(false)
  })

  it('refuse un id de phase invalide (et non null)', () => {
    expect(updateTaskSchema.safeParse({ phaseId: 'not-a-uuid' }).success).toBe(false)
  })

  it('refuse une position négative', () => {
    expect(updateTaskSchema.safeParse({ position: -1 }).success).toBe(false)
  })

  it('refuse les champs techniques (id, createdAt, updatedAt)', () => {
    expect(updateTaskSchema.safeParse({ id: VALID_ID }).success).toBe(false)
    expect(updateTaskSchema.safeParse({ createdAt: VALID_TIMESTAMP }).success).toBe(false)
    expect(updateTaskSchema.safeParse({ updatedAt: VALID_TIMESTAMP }).success).toBe(false)
  })

  it('refuse le déplacement vers un autre projet (projectId non modifiable)', () => {
    expect(updateTaskSchema.safeParse({ projectId: VALID_PROJECT_ID }).success).toBe(false)
  })

  it("refuse un objet ne contenant qu'une clé explicitement à undefined (équivalent à une mise à jour vide)", () => {
    expect(updateTaskSchema.safeParse({ description: undefined }).success).toBe(false)
  })

  it('refuse un objet ne contenant que des clés à undefined, même multiples', () => {
    expect(updateTaskSchema.safeParse({ title: undefined, description: undefined }).success).toBe(false)
  })

  it('accepte toujours { description: null } (null reste une valeur réellement définie)', () => {
    expect(updateTaskSchema.safeParse({ description: null }).success).toBe(true)
  })

  it('accepte un objet mêlant une clé undefined et une clé réellement définie', () => {
    const result = updateTaskSchema.safeParse({ title: 'Nouveau titre', description: undefined })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.title).toBe('Nouveau titre')
      expect(result.data.description).toBeUndefined()
    }
  })
})
