import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { BrowserWindow } from 'electron'
import { APP_NAME } from '../../shared/appInfo'
import type { ThemeFactoryEnvironment } from '../../shared/contracts/themeFactoryApi'
import { isTrustedNavigationUrl } from './navigationPolicy'

const DEV_SERVER_URL = process.env['ELECTRON_RENDERER_URL']
const ENVIRONMENT: ThemeFactoryEnvironment = DEV_SERVER_URL ? 'development' : 'production'

function resolveTrustedRendererUrl(): string {
  if (DEV_SERVER_URL) {
    return DEV_SERVER_URL
  }

  return pathToFileURL(join(__dirname, '../renderer/index.html')).href
}

export function createMainWindow(): BrowserWindow {
  const trustedRendererUrl = resolveTrustedRendererUrl()

  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 720,
    title: APP_NAME,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      additionalArguments: [`--tfc-environment=${ENVIRONMENT}`]
    }
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Seule la navigation vers l'URL exacte du renderer charge (serveur Vite
    // en dev, index.html construit en prod) est autorisee ; le rechargement
    // de cette meme page reste donc possible, toute autre destination est
    // refusee.
    if (!isTrustedNavigationUrl(trustedRendererUrl, url)) {
      event.preventDefault()
    }
  })

  if (DEV_SERVER_URL) {
    mainWindow.loadURL(DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}
