import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './windows/createMainWindow'
import { closeDatabase, openDatabase } from './database/database'
import { resolveDatabasePath } from './database/databasePath'

app.whenReady().then(() => {
  try {
    openDatabase(resolveDatabasePath(app.getPath('userData')))
  } catch (error) {
    console.error("Échec de l'initialisation de la base SQLite :", error)
    app.quit()
    return
  }

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
