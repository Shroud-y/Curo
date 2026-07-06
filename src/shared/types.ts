/** A node in the sprite tree: either a folder (with children) or a .png sprite. */
export interface SpriteNode {
  /** Base name, e.g. "turrets" or "duo.png". */
  name: string
  /** Absolute path on disk. */
  path: string
  type: 'folder' | 'sprite'
  /** Present only for folders. */
  children?: SpriteNode[]
}

/** A loaded sprite: its bytes as a data URL plus decoded pixel dimensions. */
export interface SpriteImage {
  dataUrl: string
  width: number
  height: number
}

/**
 * Result of resolving a mod root's sprite directories. `groups` holds the
 * top-level groups found ("sprites", and optionally "sprites-override"); it is
 * null when the root contains no recognizable sprites folder at all.
 */
export interface SpriteTreeResult {
  groups: SpriteNode[]
}

/** App settings exposed to the renderer. */
export interface Settings {
  lastModRoot?: string
  editorPath?: string
  vanillaSpritesPath?: string
}

/** Payload pushed to the renderer when a watched .png is added/changed/removed. */
export interface SpritesChangedEvent {
  event: 'add' | 'change' | 'unlink'
  path: string
}
