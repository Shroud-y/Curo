import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import type { SpriteImage, SpriteNode } from '@shared/types'

const api = {
  /** Open native folder picker; resolves to the chosen path or null if cancelled. */
  pickModFolder: (): Promise<string | null> => ipcRenderer.invoke(IpcChannel.PickModFolder),
  /** Read the `sprites/` subfolder of a mod root into a tree, or null if absent. */
  readSpriteTree: (modRoot: string): Promise<SpriteNode | null> =>
    ipcRenderer.invoke(IpcChannel.ReadSpriteTree, modRoot),
  /** Read a single sprite as a data URL plus its pixel dimensions. */
  readSprite: (spritePath: string): Promise<SpriteImage> =>
    ipcRenderer.invoke(IpcChannel.ReadSprite, spritePath)
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
