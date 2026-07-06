import { BrowserWindow, dialog, ipcMain } from 'electron'
import { promises as fs } from 'fs'
import { extname, join } from 'path'
import { IpcChannel } from '@shared/ipc-channels'
import type { SpriteImage, SpriteNode } from '@shared/types'

/**
 * Recursively read a directory into a SpriteNode tree.
 * - Only `.png` files count as sprites; other files are ignored.
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

  // Read the `sprites/` subfolder of the mod root into a nested tree.
  ipcMain.handle(
    IpcChannel.ReadSpriteTree,
    async (_event, modRoot: string): Promise<SpriteNode | null> => {
      const spritesDir = join(modRoot, 'sprites')
      try {
        const stat = await fs.stat(spritesDir)
        if (!stat.isDirectory()) return null
      } catch {
        return null
      }
      return {
        name: 'sprites',
        path: spritesDir,
        type: 'folder',
        children: await readDir(spritesDir)
      }
    }
  )

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
}
