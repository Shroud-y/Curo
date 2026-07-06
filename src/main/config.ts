import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'

/** Persisted app settings, stored as JSON under Electron's userData dir. */
export interface Settings {
  lastModRoot?: string
  /** Absolute path to an external image editor executable (e.g. Aseprite). */
  editorPath?: string
  /** Absolute path to an unpacked vanilla Mindustry sprites folder (compare refs). */
  vanillaSpritesPath?: string
}

function configPath(): string {
  return join(app.getPath('userData'), 'curo-config.json')
}

export async function readSettings(): Promise<Settings> {
  try {
    return JSON.parse(await fs.readFile(configPath(), 'utf8')) as Settings
  } catch {
    return {}
  }
}

export async function writeSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await readSettings()), ...patch }
  await fs.writeFile(configPath(), JSON.stringify(next, null, 2), 'utf8')
  return next
}
