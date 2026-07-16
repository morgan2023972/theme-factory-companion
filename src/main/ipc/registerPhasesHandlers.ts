import { z } from 'zod'
import {
  createPhaseSchema,
  phaseSchema,
  updatePhaseSchema,
  type Phase
} from '../../shared/schemas/phase'
import { IPC_CHANNELS } from '../../shared/contracts/ipcChannels'
import type { PhasesRepository } from '../database/repositories/phasesRepository'
import type { IpcMainLike } from './registerProjectsHandlers'

export type RegisterPhasesHandlersDependencies = {
  readonly ipcMain: IpcMainLike
  readonly phasesRepository: PhasesRepository
}

/** Réutilise le schéma UUID déjà défini pour `Phase.id`, sans le dupliquer. */
const phaseIdSchema = phaseSchema.shape.id

/**
 * `projectId` n'a pas d'équivalent réutilisable en dehors de `phaseSchema`
 * (le schéma des projets valide un `Project` complet, pas un identifiant
 * isolé) : validation locale minimale, cohérente avec la Phase 3.3.
 */
const projectIdSchema = z.uuid()

const updatePhasePayloadSchema = z
  .object({
    id: phaseIdSchema,
    input: updatePhaseSchema
  })
  .strict()

/**
 * Enregistre les handlers IPC autorisés du module `phases`.
 * Ne dépend que des dépendances injectées : n'ouvre aucune connexion
 * SQLite, ne crée aucun repository.
 */
export function registerPhasesHandlers({ ipcMain, phasesRepository }: RegisterPhasesHandlersDependencies): void {
  ipcMain.handle(IPC_CHANNELS.phases.listByProjectId, (_event, rawProjectId): Phase[] => {
    const projectId = projectIdSchema.parse(rawProjectId)
    return phasesRepository.listByProjectId(projectId)
  })

  ipcMain.handle(IPC_CHANNELS.phases.getById, (_event, rawId): Phase | null => {
    const id = phaseIdSchema.parse(rawId)
    return phasesRepository.getById(id)
  })

  ipcMain.handle(IPC_CHANNELS.phases.create, (_event, rawInput): Phase => {
    const input = createPhaseSchema.parse(rawInput)
    return phasesRepository.create(input)
  })

  ipcMain.handle(IPC_CHANNELS.phases.update, (_event, rawPayload): Phase | null => {
    const payload = updatePhasePayloadSchema.parse(rawPayload)
    return phasesRepository.update(payload.id, payload.input)
  })

  ipcMain.handle(IPC_CHANNELS.phases.remove, (_event, rawId): boolean => {
    const id = phaseIdSchema.parse(rawId)
    return phasesRepository.remove(id)
  })
}
