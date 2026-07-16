import type { CreateProjectInput, Project, UpdateProjectInput } from '../schemas/project'

export type ThemeFactoryEnvironment = 'development' | 'production'

export interface ThemeFactoryAppInfo {
  readonly name: string
  readonly phase: string
  readonly environment: ThemeFactoryEnvironment
}

export interface ThemeFactoryProjectsApi {
  readonly list: () => Promise<Project[]>
  readonly getById: (id: string) => Promise<Project | null>
  readonly create: (input: CreateProjectInput) => Promise<Project>
  readonly update: (id: string, input: UpdateProjectInput) => Promise<Project | null>
  readonly remove: (id: string) => Promise<boolean>
}

export interface ThemeFactoryApi {
  readonly app: {
    readonly getInfo: () => ThemeFactoryAppInfo
  }
  readonly projects: ThemeFactoryProjectsApi
}
