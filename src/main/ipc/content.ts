import { BrowserWindow, dialog, ipcMain } from 'electron'
import { promises as fs } from 'fs'
import { extname, join } from 'path'
import { IpcChannel } from '@shared/ipc-channels'
import type { ContentEntity, ParseResult } from '@shared/content'
import { parseContentFile } from '../content/parser'

/**
 * Find `.java` files under any `content/` directory below `root`, i.e. the
 * auto-detect for `src/**\/content/*.java`. Depth-bounded and dot-dir-skipping
 * so it never wanders into node_modules/.git or loops forever.
 */
async function findContentFiles(root: string, depth = 0): Promise<string[]> {
  if (depth > 8) return []
  let entries
  try {
    entries = await fs.readdir(root, { withFileTypes: true })
  } catch {
    return []
  }

  const out: string[] = []
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue
    const full = join(root, e.name)
    if (e.isDirectory()) {
      if (e.name === 'content') {
        out.push(...(await javaFilesIn(full)))
      } else {
        out.push(...(await findContentFiles(full, depth + 1)))
      }
    }
  }
  return out
}

/** Direct-child `.java` files of a directory. */
async function javaFilesIn(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    return entries
      .filter((e) => e.isFile() && extname(e.name).toLowerCase() === '.java')
      .map((e) => join(dir, e.name))
  } catch {
    return []
  }
}

/**
 * Derive the mod's sprite prefix from mod.hjson / mod.json — the `name` field
 * plus a dash (e.g. name "jababarium" -> "jababarium-"). Returns "" if not
 * found, so regions with no prefix still match directly.
 */
async function readModPrefix(modRoot: string): Promise<string> {
  for (const f of ['mod.hjson', 'mod.json']) {
    try {
      const text = await fs.readFile(join(modRoot, f), 'utf8')
      const m = /"?\bname\b"?\s*:\s*"([A-Za-z0-9_-]+)"/.exec(text)
      if (m) return `${m[1]}-`
    } catch {
      // try next candidate
    }
  }
  return ''
}

async function parseFiles(files: string[], modPrefix: string): Promise<ParseResult> {
  const entities: ContentEntity[] = []
  const parsed: string[] = []
  for (const file of files) {
    try {
      const text = await fs.readFile(file, 'utf8')
      entities.push(...parseContentFile(text, file))
      parsed.push(file)
    } catch {
      // Unreadable file — skip silently, never crash the parse.
    }
  }
  return { entities, files: parsed, modPrefix }
}

export function registerContentIpc(): void {
  // Parse content. With an explicit `dir`, parse its direct .java files; else
  // auto-detect src/**/content/*.java under the mod root.
  ipcMain.handle(
    IpcChannel.ParseContent,
    async (_event, modRoot: string, dir?: string): Promise<ParseResult> => {
      const files = dir ? await javaFilesIn(dir) : await findContentFiles(modRoot)
      return parseFiles(files, await readModPrefix(modRoot))
    }
  )

  // Let the user pick a content folder directly.
  ipcMain.handle(IpcChannel.ChooseContentFolder, async (event): Promise<string | null> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = win
      ? await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })
}
