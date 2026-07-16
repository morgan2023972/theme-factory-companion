/**
 * Registre unique des canaux IPC autorisés. Toute nouvelle opération
 * exposée au renderer doit y ajouter un canal explicite plutôt que de
 * dupliquer une chaîne littérale dans les handlers, le preload ou leurs
 * tests.
 */
export const IPC_CHANNELS = {
  projects: {
    list: 'projects:list',
    getById: 'projects:getById',
    create: 'projects:create',
    update: 'projects:update',
    remove: 'projects:remove'
  }
} as const
