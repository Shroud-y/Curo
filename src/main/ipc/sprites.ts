import { BrowserWindow, dialog, ipcMain, type WebContents } from 'electron'
import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import { extname, join } from 'path'
import chokidar, { type FSWatcher } from 'chokidar'
import { IpcChannel } from '@shared/ipc-channels'
import type {
  Settings,
  SpriteImage,
  SpriteNode,
  SpritesChangedEvent,
  SpriteTreeResult
} from '@shared/types'
import { readSettings, writeSettings } from '../config'

/**
 * Recursively read a directory into a SpriteNode tree.
 * - Only `.png` files count as sprites; other files are ignored. PNGs directly
 *   in `dir` become top-level leaves alongside subfolders.
 * - Hidden entries (dotfiles) are skipped.
 * - Folders are kept even if empty of sprites, so structure stays visible.
 * Folders sort before sprites, each alphabetically (case-insensitive).
 */
async function readDir(dir: string): Promise<SpriteNode[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const nodes: SpriteNode[] = []

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)

    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: full,
        type: 'folder',
        children: await readDir(full)
      })
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === '.png') {
      nodes.push({ name: entry.name, path: full, type: 'sprite' })
    }
  }

  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
  return nodes
}

/** True if `p` exists and is a directory. */
async function isDir(p: string): Promise<boolean> {
  try {
    return (await fs.stat(p)).isDirectory()
  } catch {
    return false
  }
}

/**
 * Resolve a sprite directory within a mod root by trying candidates in order.
 * Standard Java/Gradle mods nest under `assets/`; JSON/HJSON mods put it at
 * the root. Returns the first existing directory, or null.
 */
async function resolveDir(modRoot: string, candidates: string[]): Promise<string | null> {
  for (const rel of candidates) {
    const full = join(modRoot, ...rel.split('/'))
    if (await isDir(full)) return full
  }
  return null
}

/**
 * Decode width/height from a PNG's IHDR chunk. A valid PNG is an 8-byte
 * signature followed immediately by the IHDR chunk, whose width and height
 * are big-endian uint32s at byte offsets 16 and 20.
 */
function readPngDimensions(buf: Buffer): { width: number; height: number } {
  const PNG_SIG = '\x89PNG\r\n\x1a\n'
  if (buf.length < 24 || buf.toString('latin1', 0, 8) !== PNG_SIG) {
    throw new Error('Not a valid PNG file')
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

// --- Live-reload watcher (single instance, rebound when the root changes) ---
let watcher: FSWatcher | null = null
let watchedRoot: string | null = null

/**
 * (Re)watch the sprite dirs of `modRoot`. No-op if already watching the same
 * root. Emits SpritesChanged to the renderer on any add/change/unlink of a
 * .png. awaitWriteFinish debounces atomic saves (editor writes temp+rename)
 * so we never read a half-written file.
 */
async function setupWatcher(
  sender: WebContents,
  modRoot: string,
  dirs: string[]
): Promise<void> {
  if (watchedRoot === modRoot && watcher) return
  if (watcher) {
    await watcher.close()
    watcher = null
  }
  watchedRoot = modRoot

  watcher = chokidar.watch(dirs, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 }
  })

  const emit = (event: SpritesChangedEvent['event']) => (path: string) => {
    if (extname(path).toLowerCase() !== '.png') return
    if (sender.isDestroyed()) return
    sender.send(IpcChannel.SpritesChanged, { event, path } satisfies SpritesChangedEvent)
  }

  watcher.on('add', emit('add')).on('change', emit('change')).on('unlink', emit('unlink'))
}

export function registerSpriteIpc(): void {
  // Open a native folder picker; return the chosen mod-root path or null.
  ipcMain.handle(IpcChannel.PickModFolder, async (event): Promise<string | null> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = win
      ? await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // Resolve the sprite dirs under a mod root and read them into groups.
  // Returns null if no sprites folder exists (caller re-prompts).
  ipcMain.handle(
    IpcChannel.ReadSpriteTree,
    async (event, modRoot: string): Promise<SpriteTreeResult | null> => {
      const spritesDir = await resolveDir(modRoot, ['assets/sprites', 'sprites'])
      if (!spritesDir) return null

      const groups: SpriteNode[] = [
        { name: 'sprites', path: spritesDir, type: 'folder', children: await readDir(spritesDir) }
      ]
      const watchDirs = [spritesDir]

      const overrideDir = await resolveDir(modRoot, [
        'assets/sprites-override',
        'sprites-override'
      ])
      if (overrideDir) {
        groups.push({
          name: 'sprites-override',
          path: overrideDir,
          type: 'folder',
          children: await readDir(overrideDir)
        })
        watchDirs.push(overrideDir)
      }

      await writeSettings({ lastModRoot: modRoot })
      await setupWatcher(event.sender, modRoot, watchDirs)
      return { groups }
    }
  )

  // The last successfully-opened mod root, or null on first run.
  ipcMain.handle(IpcChannel.GetLastRoot, async (): Promise<string | null> => {
    return (await readSettings()).lastModRoot ?? null
  })

  // Read a single sprite: bytes as a data URL plus pixel dimensions.
  ipcMain.handle(
    IpcChannel.ReadSprite,
    async (_event, spritePath: string): Promise<SpriteImage> => {
      const buf = await fs.readFile(spritePath)
      const { width, height } = readPngDimensions(buf)
      return {
        dataUrl: `data:image/png;base64,${buf.toString('base64')}`,
        width,
        height
      }
    }
  )

  // --- Settings ---
  ipcMain.handle(IpcChannel.SettingsGet, async (): Promise<Settings> => readSettings())

  // Pick an editor executable; persists and returns the updated settings.
  ipcMain.handle(IpcChannel.SettingsChooseEditor, async (event): Promise<Settings> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const opts: Electron.OpenDialogOptions = {
      properties: ['openFile'],
      filters:
        process.platform === 'win32'
          ? [{ name: 'Executable', extensions: ['exe'] }]
          : undefined
    }
    const result = win
      ? await dialog.showOpenDialog(win, opts)
      : await dialog.showOpenDialog(opts)
    if (result.canceled || result.filePaths.length === 0) return readSettings()
    return writeSettings({ editorPath: result.filePaths[0] })
  })

  // Launch the configured editor with the sprite path. Detached + unref so it
  // outlives Curo. Throws (rejects) if no editor is configured.
  ipcMain.handle(
    IpcChannel.OpenInEditor,
    async (_event, spritePath: string): Promise<void> => {
      const { editorPath } = await readSettings()
      if (!editorPath) throw new Error('NO_EDITOR')
      const child = spawn(editorPath, [spritePath], { detached: true, stdio: 'ignore' })
      child.unref()
    }
  )

  // Overwrite a sprite with a user-picked PNG, keeping the same path/filename.
  // Returns true if replaced, false if the picker was cancelled. The renderer
  // confirms with the user before invoking.
  ipcMain.handle(
    IpcChannel.ReplaceSprite,
    async (event, targetPath: string): Promise<boolean> => {
      const win = BrowserWindow.fromWebContents(event.sender)
      const opts: Electron.OpenDialogOptions = {
        properties: ['openFile'],
        filters: [{ name: 'PNG', extensions: ['png'] }]
      }
      const result = win
        ? await dialog.showOpenDialog(win, opts)
        : await dialog.showOpenDialog(opts)
      if (result.canceled || result.filePaths.length === 0) return false
      await fs.copyFile(result.filePaths[0], targetPath)
      return true
    }
  )
}
