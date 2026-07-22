import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDatabase, getDatabase, isDatabaseOpen, openDatabase } from './database'
import { checkDatabaseHealth, EXPECTED_BUSINESS_TABLES } from './databaseHealth'
import { runMigrations } from './migrations/runMigrations'

afterEach(() => {
  closeDatabase()
})

describe('database', () => {
  it('ouvre une connexion en mémoire et réussit le health check (SELECT 1)', () => {
    const db = openDatabase(':memory:')
    const row = db.prepare('SELECT 1 AS value').get() as { value: number }

    expect(row.value).toBe(1)
  })

  it('active les clés étrangères (PRAGMA foreign_keys)', () => {
    const db = openDatabase(':memory:')

    expect(db.pragma('foreign_keys', { simple: true })).toBe(1)
  })

  it("n'ouvre pas de connexion supplémentaire lors d'un second appel", () => {
    const first = openDatabase(':memory:')
    const second = openDatabase(':memory:')

    expect(second).toBe(first)
  })

  it('signale que la connexion est ouverte', () => {
    openDatabase(':memory:')

    expect(isDatabaseOpen()).toBe(true)
  })

  it("ne lève pas d'erreur si aucune connexion n'est ouverte lors de la fermeture", () => {
    expect(() => closeDatabase()).not.toThrow()
    expect(isDatabaseOpen()).toBe(false)
  })

  it("se ferme sans erreur et remet l'état à zéro", () => {
    openDatabase(':memory:')

    expect(() => closeDatabase()).not.toThrow()
    expect(isDatabaseOpen()).toBe(false)
  })

  it('permet de rouvrir une connexion après fermeture', () => {
    openDatabase(':memory:')
    closeDatabase()

    const db = openDatabase(':memory:')
    const row = db.prepare('SELECT 1 AS value').get() as { value: number }

    expect(row.value).toBe(1)
  })

  it("getDatabase lève une erreur explicite si aucune connexion n'est ouverte", () => {
    expect(() => getDatabase()).toThrow()
  })

  it("un second openDatabase() avec un chemin différent renvoie la connexion déjà ouverte, sans en ouvrir une nouvelle", () => {
    const first = openDatabase(':memory:')

    const otherDir = mkdtempSync(join(tmpdir(), 'tfc-db-second-open-'))
    const otherPath = join(otherDir, 'other.sqlite')

    try {
      const second = openDatabase(otherPath)

      expect(second).toBe(first)
      expect(existsSync(otherPath)).toBe(false)
    } finally {
      rmSync(otherDir, { recursive: true, force: true })
    }
  })
})

describe('database — persistance et idempotence sur base fichier réelle (Phase 2.5)', () => {
  let tempDir: string
  let dbPath: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'tfc-db-lifecycle-'))
    dbPath = join(tempDir, 'lifecycle.sqlite')
  })

  afterEach(() => {
    closeDatabase()
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('conserve le schéma et les données à travers une fermeture puis une réouverture, sans rejouer la migration', () => {
    const first = openDatabase(dbPath)

    const timestamp = new Date().toISOString()
    first
      .prepare(
        `INSERT INTO projects (id, name, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run('project-1', 'Projet de test', 'planning', timestamp, timestamp)

    closeDatabase()
    expect(isDatabaseOpen()).toBe(false)

    const second = openDatabase(dbPath)

    const project = second.prepare('SELECT id, name FROM projects WHERE id = ?').get('project-1') as
      | { id: string; name: string }
      | undefined
    expect(project).toEqual({ id: 'project-1', name: 'Projet de test' })

    const migrationRows = second.prepare('SELECT version FROM schema_migrations').all() as Array<{
      version: number
    }>
    expect(migrationRows).toEqual([{ version: 1 }, { version: 2 }])

    expect(checkDatabaseHealth(second).ok).toBe(true)
  })

  it('conserve les données d\'orchestration et leurs relations à travers une fermeture puis une réouverture (reprise après redémarrage, ORCH-2.1)', () => {
    // openDatabase() active PRAGMA foreign_keys et rejoue runMigrations() (de
    // façon idempotente) à chaque appel : la réouverture ci-dessous suffit à
    // la fois à activer les clés étrangères et à réexécuter les migrations
    // de production, sans code supplémentaire.
    const first = openDatabase(dbPath)
    const timestamp = new Date().toISOString()

    first
      .prepare(`INSERT INTO projects (id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
      .run('project-1', 'Projet de test', 'planning', timestamp, timestamp)
    first
      .prepare(
        `INSERT INTO phases (id, project_id, name, position, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run('phase-1', 'project-1', 'Phase de test', 0, 'pending', timestamp, timestamp)
    first
      .prepare(`INSERT INTO workflow_profiles (id, name, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
      .run('profile-1', 'Profil de test', '1', timestamp, timestamp)
    first
      .prepare(
        `INSERT INTO workflow_runs
           (id, project_id, phase_id, profile_id, profile_fingerprint, status, current_step_id, started_at, completed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run('run-1', 'project-1', 'phase-1', 'profile-1', 'fingerprint-1', 'draft', null, timestamp, null, timestamp, timestamp)
    first
      .prepare(
        `INSERT INTO workflow_steps (id, workflow_run_id, type, status, position, started_at, completed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run('step-1', 'run-1', 'project_and_phase_selection', 'pending', 0, null, null, timestamp, timestamp)
    first
      .prepare(
        `INSERT INTO workflow_artifacts (id, workflow_run_id, workflow_step_id, type, relative_path, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run('artifact-1', 'run-1', 'step-1', 'phase_prompt', 'workflow/prompts/PHASE_1.1_PROMPT.md', timestamp)

    closeDatabase()
    expect(isDatabaseOpen()).toBe(false)

    let second: Database.Database | undefined
    try {
      second = openDatabase(dbPath)

      const run = second.prepare('SELECT * FROM workflow_runs WHERE id = ?').get('run-1') as
        | Record<string, unknown>
        | undefined
      expect(run).toMatchObject({
        id: 'run-1',
        project_id: 'project-1',
        phase_id: 'phase-1',
        profile_id: 'profile-1',
        status: 'draft'
      })

      const step = second.prepare('SELECT * FROM workflow_steps WHERE id = ?').get('step-1') as
        | Record<string, unknown>
        | undefined
      expect(step).toMatchObject({ id: 'step-1', workflow_run_id: 'run-1', type: 'project_and_phase_selection' })

      const artifact = second.prepare('SELECT * FROM workflow_artifacts WHERE id = ?').get('artifact-1') as
        | Record<string, unknown>
        | undefined
      expect(artifact).toMatchObject({
        id: 'artifact-1',
        workflow_run_id: 'run-1',
        workflow_step_id: 'step-1',
        type: 'phase_prompt'
      })

      const migrationRows = second.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all() as Array<{
        version: number
      }>
      expect(migrationRows).toEqual([{ version: 1 }, { version: 2 }])

      for (const table of ['projects', 'phases', 'workflow_profiles', 'workflow_runs', 'workflow_steps', 'workflow_artifacts']) {
        const count = (second.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count
        expect(count).toBe(1)
      }

      expect(checkDatabaseHealth(second).ok).toBe(true)
    } finally {
      closeDatabase()
    }
  })

  it("reste idempotent sur plusieurs cycles d'ouverture/fermeture successifs : pas de duplication, pas de perte de données", () => {
    openDatabase(dbPath)
    closeDatabase()

    openDatabase(dbPath)
    closeDatabase()

    const third = openDatabase(dbPath)

    const migrationRows = third.prepare('SELECT version, name FROM schema_migrations').all()
    expect(migrationRows).toHaveLength(2)

    for (const table of EXPECTED_BUSINESS_TABLES) {
      const count = (third.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count
      expect(count).toBe(0)
    }

    expect(checkDatabaseHealth(third).ok).toBe(true)
  })

  it('réactive PRAGMA foreign_keys à chaque nouvelle connexion (après fermeture puis réouverture)', () => {
    const first = openDatabase(dbPath)
    expect(first.pragma('foreign_keys', { simple: true })).toBe(1)

    closeDatabase()

    const second = openDatabase(dbPath)
    expect(second.pragma('foreign_keys', { simple: true })).toBe(1)
  })

  it('utilise réellement le mode journal WAL pour une base fichier', () => {
    const db = openDatabase(dbPath)

    expect(db.pragma('journal_mode', { simple: true })).toBe('wal')
  })

  it("le mode journal réel d'une base :memory: reste 'memory', même si WAL est demandé (comportement SQLite normal)", () => {
    const db = openDatabase(':memory:')

    expect(db.pragma('journal_mode', { simple: true })).toBe('memory')
  })

  it('lève une erreur si le répertoire du chemin SQLite est inexistant, sans laisser de connexion ouverte', () => {
    const unusablePath = join(tempDir, 'dossier-inexistant', 'base.sqlite')

    expect(() => openDatabase(unusablePath)).toThrow()
    expect(isDatabaseOpen()).toBe(false)
  })

  it('ferme automatiquement la connexion si le health check échoue après des migrations par ailleurs réussies', () => {
    // Prépare un fichier régulièrement migré, puis simule une migration future
    // déjà appliquée par une version plus récente de l'application (inconnue
    // de la liste de production actuelle, dont la dernière version connue est
    // 2 depuis ORCH-2.1). Isole ainsi un échec du health check, distinct de
    // l'échec de migration déjà couvert dans databaseHealth.test.ts.
    const bootstrap = new Database(dbPath)
    bootstrap.pragma('foreign_keys = ON')
    runMigrations(bootstrap)
    bootstrap
      .prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
      .run(3, 'migration future inconnue', new Date().toISOString())
    bootstrap.close()

    expect(() => openDatabase(dbPath)).toThrow(/incompatible/)
    expect(isDatabaseOpen()).toBe(false)

    // La connexion défaillante ne doit pas rester verrouillée.
    expect(() => new Database(dbPath).close()).not.toThrow()
  })
})
