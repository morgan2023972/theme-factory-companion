import { z } from 'zod'
import {
  createProjectSchema,
  projectSchema,
  updateProjectSchema,
  type Project
} from '../../shared/schemas/project'
import { IPC_CHANNELS } from '../../shared/contracts/ipcChannels'
import type { ProjectsRepository } from '../database/repositories/projectsRepository'

/**
 * Signature minimale requise d'un handler `ipcMain.handle`. Volontairement
 * découplée du type `Electron.IpcMain` complet : seule `handle` est
 * nécessaire ici, ce qui permet d'injecter un faux `ipcMain` dans les tests
 * unitaires sans démarrer Electron.
 */
export type IpcHandleListener = (event: unknown, ...args: readonly unknown[]) => unknown

export type IpcMainLike = {
  readonly handle: (channel: string, listener: IpcHandleListener) => void
}

export type RegisterProjectsHandlersDependencies = {
  readonly ipcMain: IpcMainLike
  readonly projectsRepository: ProjectsRepository
}

/** Réutilise le schéma UUID déjà défini pour `Project.id`, sans le dupliquer. */
const projectIdSchema = projectSchema.shape.id

const updateProjectPayloadSchema = z
  .object({
    id: projectIdSchema,
    input: updateProjectSchema
  })
  .strict()

/**
 * Enregistre les handlers IPC autorisés du module `projects`.
 * Ne dépend que des dépendances injectées : n'ouvre aucune connexion
 * SQLite, ne crée aucun repository.
 */
export function registerProjectsHandlers({ ipcMain, projectsRepository }: RegisterProjectsHandlersDependencies): void {
  ipcMain.handle(IPC_CHANNELS.projects.list, (): Project[] => projectsRepository.list())

  ipcMain.handle(IPC_CHANNELS.projects.getById, (_event, rawId): Project | null => {
    const id = projectIdSchema.parse(rawId)
    return projectsRepository.getById(id)
  })

  ipcMain.handle(IPC_CHANNELS.projects.create, (_event, rawInput): Project => {
    const input = createProjectSchema.parse(rawInput)
    return projectsRepository.create(input)
  })

  ipcMain.handle(IPC_CHANNELS.projects.update, (_event, rawPayload): Project | null => {
    const payload = updateProjectPayloadSchema.parse(rawPayload)
    return projectsRepository.update(payload.id, payload.input)
  })

  ipcMain.handle(IPC_CHANNELS.projects.remove, (_event, rawId): boolean => {
    const id = projectIdSchema.parse(rawId)
    return projectsRepository.remove(id)
  })
}
