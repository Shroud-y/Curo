import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import type {
  Settings,
  SpriteImage,
  SpriteNode,
  SpritesChangedEvent,
  SpriteTreeResult
} from '@shared/types'
import type { ParseResult } from '@shared/content'

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
  /** Pick the vanilla Mindustry sprites folder; returns updated settings. */
  chooseVanilla: (): Promise<Settings> => ipcRenderer.invoke(IpcChannel.SettingsChooseVanilla),
  /** Recursively read the configured vanilla sprites folder; null if unset. */
  readVanillaSprites: (): Promise<SpriteNode[] | null> =>
    ipcRenderer.invoke(IpcChannel.ReadVanillaSprites),
  /** Launch the configured editor with the sprite. Rejects 'NO_EDITOR' if unset. */
  openInEditor: (spritePath: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannel.OpenInEditor, spritePath),
  /** Overwrite the sprite at `targetPath` with a picked PNG. False if cancelled. */
  replaceSprite: (targetPath: string): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannel.ReplaceSprite, targetPath),

  /** Subscribe to watcher events (.png add/change/unlink). Returns unsubscribe. */
  onSpritesChanged: (cb: (e: SpritesChangedEvent) => void): (() => void) =>
    subscribe(IpcChannel.SpritesChanged, cb),

  /** Parse mod content. `dir` overrides auto-detect of src/**\/content/*.java. */
  parseContent: (modRoot: string, dir?: string): Promise<ParseResult> =>
    ipcRenderer.invoke(IpcChannel.ParseContent, modRoot, dir),
  /** Pick a content folder directly; null if cancelled. */
  chooseContentFolder: (): Promise<string | null> =>
    ipcRenderer.invoke(IpcChannel.ChooseContentFolder)
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
