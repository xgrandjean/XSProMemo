import { app } from 'electron'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { dataRoot, writeJsonAtomic } from './paths'

/**
 * Which folder this machine uses as the library — separate from the library's own
 * config.json, since a machine must know where to look before that folder is even
 * reachable (a network share, say). Lives under Electron's own per-machine userData:
 * unlike the library itself, nothing here is ever opened by Word, so AppData is fine.
 */
export interface AppSettings {
  libraryPath: string | null
}

const defaultSettings: AppSettings = { libraryPath: null }

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

export async function readSettings(): Promise<AppSettings> {
  try {
    const stored = JSON.parse(await fs.readFile(settingsPath(), 'utf-8'))
    return { libraryPath: stored.libraryPath ?? defaultSettings.libraryPath }
  } catch {
    return { ...defaultSettings }
  }
}

export async function writeSettings(settings: AppSettings): Promise<void> {
  await writeJsonAtomic(settingsPath(), settings)
}

/** The folder the application actually uses — the chosen one, or the local default. */
export async function resolveLibraryPath(): Promise<string> {
  const { libraryPath } = await readSettings()
  return libraryPath ?? dataRoot()
}
