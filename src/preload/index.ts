import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import type { Settings, SpriteImage, SpritesChangedEvent, SpriteTreeResult } from '@shared/types'

function subscribe<T>(channel: IpcChannel, cb: (payload: T) => void): () => void {
  const listener = (_e: IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api = {
  /** Open native folder picker; resolves to the chosen path or null if cancelled. */
  pickModFolder: (): Promise<string | null> => ipcRenderer.invoke(IpcChannel.PickModFolder),
  /** Resolve + read a mod root's sprite dirs into groups; null if none found. */
  readSpriteTree: (modRoot: string): Promise<SpriteTreeResult | null> =>
    ipcRenderer.invoke(IpcChannel.ReadSpriteTree, modRoot),
  /** Last successfully-opened mod root, or null on first run. */
  getLastRoot: (): Promise<string | null> => ipcRenderer.invoke(IpcChannel.GetLastRoot),
  /** Read a single sprite as a data URL plus its pixel dimensions. */
  readSprite: (spritePath: string): Promise<SpriteImage> =>
    ipcRenderer.invoke(IpcChannel.ReadSprite, spritePath),

  /** Current settings (editor path, last root). */
  getSettings: (): Promise<Settings> => ipcRenderer.invoke(IpcChannel.SettingsGet),
  /** Pick an editor executable; returns updated settings. */
  chooseEditor: (): Promise<Settings> => ipcRenderer.invoke(IpcChannel.SettingsChooseEditor),
  /** Launch the configured editor with the sprite. Rejects 'NO_EDITOR' if unset. */
  openInEditor: (spritePath: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannel.OpenInEditor, spritePath),
  /** Overwrite the sprite at `targetPath` with a picked PNG. False if cancelled. */
  replaceSprite: (targetPath: string): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannel.ReplaceSprite, targetPath),

  /** Subscribe to watcher events (.png add/change/unlink). Returns unsubscribe. */
  onSpritesChanged: (cb: (e: SpritesChangedEvent) => void): (() => void) =>
    subscribe(IpcChannel.SpritesChanged, cb)
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
