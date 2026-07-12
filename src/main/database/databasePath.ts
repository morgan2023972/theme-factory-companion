import { join } from 'node:path'

export const DATABASE_FILE_NAME = 'theme-factory-companion.sqlite'

export function resolveDatabasePath(userDataDir: string): string {
  return join(userDataDir, DATABASE_FILE_NAME)
}
