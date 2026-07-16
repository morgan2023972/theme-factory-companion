import { app, BrowserWindow, ipcMain } from 'electron'
import { createMainWindow } from './windows/createMainWindow'
import { closeDatabase, openDatabase } from './database/database'
import { resolveDatabasePath } from './database/databasePath'
import { createProjectsRepository } from './database/repositories/projectsRepository'
import { createPhasesRepository } from './database/repositories/phasesRepository'
import { registerProjectsHandlers } from './ipc/registerProjectsHandlers'
import { registerPhasesHandlers } from './ipc/registerPhasesHandlers'

app.whenReady().then(() => {
  let database: ReturnType<typeof openDatabase>
  try {
    database = openDatabase(resolveDatabasePath(app.getPath('userData')))
  } catch (error) {
    console.error("Échec de l'initialisation de la base SQLite :", error)
    app.quit()
    return
  }

  const projectsRepository = createProjectsRepository(database)
  const phasesRepository = createPhasesRepository(database)
  registerProjectsHandlers({ ipcMain, projectsRepository })
  registerPhasesHandlers({ ipcMain, phasesRepository })

  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  closeDatabase()
})
