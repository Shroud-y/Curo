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
