import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DATABASE_FILE_NAME, resolveDatabasePath } from './databasePath'

describe('resolveDatabasePath', () => {
  it('construit un chemin déterministe à partir du dossier userData', () => {
    const userDataDir = join('C:', 'Users', 'test', 'AppData', 'Roaming', 'theme-factory-companion')

    expect(resolveDatabasePath(userDataDir)).toBe(join(userDataDir, DATABASE_FILE_NAME))
  })

  it('utilise le nom de fichier theme-factory-companion.sqlite', () => {
    expect(DATABASE_FILE_NAME).toBe('theme-factory-companion.sqlite')
  })

  it('est déterministe : deux appels identiques donnent le même résultat', () => {
    const userDataDir = join('tmp', 'userData')

    expect(resolveDatabasePath(userDataDir)).toBe(resolveDatabasePath(userDataDir))
  })
})
