import type { WeaponView } from './unitModel'

/** Layer toggles for In-game mode. */
export interface LayerFlags {
  cell: boolean
  weapons: boolean
  outline: boolean
  /** Draw a marker where a weapon's sprite is missing (default on). */
  showMissing: boolean
  /** Overlay the unit's hitbox (hitSize square + physics circle). */
  hitbox: boolean
}

/** Marker box size in canvas px for missing-sprite placeholders. */
const MARKER = 14

/** Sprite dimensions, keyed by file path. Weapons/base/cell must be measured
 *  (loaded) before layout so the canvas can be sized and centered. */
export type Dims = Map<string, { width: number; height: number }>

export interface CompositeInput {
  base: string | null
  cell: string | null
  hasCell: boolean
  /** UnitType.hitSize in world units (same unit as weapon .pos). */
  hitSize: number
  weapons: WeaponView[]
  dims: Dims
  /** px per world-unit (dev slider). */
  scale: number
  /** multiply-tint hex for the cell. */
  team: string
  flags: LayerFlags
}

/** One draw instruction, in canvas pixel space, ordered bottom→top. */
export interface Placement {
  layer: 'weapon-under' | 'base' | 'cell' | 'weapon-top'
  file: string
  /** center of the sprite in canvas coords. */
  cx: number
  cy: number
  width: number
  height: number
  flipX: boolean
  /** present only for the cell layer → multiply tint. */
  tint?: string
  /** a missing-sprite placeholder marker (no image drawn). */
  marker?: boolean
  label: string
}

export interface CompositeLayout {
  canvasWidth: number
  canvasHeight: number
  center: { x: number; y: number }
  placements: Placement[]
  /**
   * Hitbox overlay in canvas coords, present when flags.hitbox is on.
   * Mindustry's hitbox is an axis-aligned square of side hitSize centered on
   * the unit (Hitboxc.hitbox → rect.setCentered(x, y, hitSize)); physics
   * overlap uses the inscribed circle of radius hitSize/2. `size` is the
   * square's side in canvas px (hitSize * scale).
   */
  hitbox: { cx: number; cy: number; size: number; hitSize: number } | null
  /** weapon labels skipped because their sprite is missing/unresolved. */
  notShown: string[]
  /** weapon labels whose position lands beyond the base sprite bounds. */
  outOfBounds: string[]
}

/** An item positioned in centered coords (origin = unit center). */
interface Item {
  layer: Placement['layer']
  file: string
  ox: number
  oy: number
  width: number
  height: number
  flipX: boolean
  tint?: string
  marker?: boolean
  label: string
}

const dimOf = (dims: Dims, file: string | null): { width: number; height: number } | null =>
  file ? (dims.get(file) ?? null) : null

/**
 * Pure layout of a unit composite. Works in centered coordinates first (origin
 * at the unit center, +x right, +y forward), converting `.pos` with the
 * Y-inversion (`pixelY = cy - pos.y*scale`), then sizes a symmetric canvas so
 * the base stays centered and shifts every item by the center.
 *
 * Layer order (bottom→top): weapons(top=false), base, cell, weapons(top=true).
 * mirror=true emits two copies: right normal at +x, left flipped at -x.
 */
export function layoutComposite(input: CompositeInput): CompositeLayout {
  const { base, cell, hasCell, hitSize, weapons, dims, scale, team, flags } = input
  const items: Item[] = []
  const notShown: string[] = []
  const outOfBounds: string[] = []

  const baseDim = dimOf(dims, base)
  // Missing-weapon marker positions (in centered coords), appended on top later.
  const markers: Array<{ ox: number; oy: number; label: string }> = []

  // Weapon copies. `top` splits layer; missing sprites get a placeholder marker
  // at the same computed position (mirror-aware) instead of being silently dropped.
  const addWeapon = (w: WeaponView): void => {
    const d = dimOf(dims, w.file)
    // Coordinate math unchanged: +x right, +y forward (oy = -py inverts image Y).
    const px = w.pos.x * scale
    const py = w.pos.y * scale
    if (baseDim && (Math.abs(px) > baseDim.width / 2 || Math.abs(py) > baseDim.height / 2)) {
      outOfBounds.push(w.label)
    }
    if (!w.file || !d) {
      notShown.push(w.label)
      if (w.mirror) {
        markers.push({ ox: px, oy: -py, label: w.label }, { ox: -px, oy: -py, label: w.label })
      } else {
        markers.push({ ox: px, oy: -py, label: w.label })
      }
      return
    }
    const layer: Placement['layer'] = w.top ? 'weapon-top' : 'weapon-under'
    const push = (ox: number, flipX: boolean): void => {
      items.push({ layer, file: w.file!, ox, oy: -py, width: d.width, height: d.height, flipX, label: w.label })
    }
    if (w.mirror) {
      push(px, false) // right copy
      push(-px, true) // left copy, flipped
    } else {
      push(px, false)
    }
  }

  if (flags.weapons) weapons.filter((w) => !w.top).forEach(addWeapon)
  if (base && baseDim) {
    items.push({ layer: 'base', file: base, ox: 0, oy: 0, width: baseDim.width, height: baseDim.height, flipX: false, label: 'base' })
  }
  const cellDim = dimOf(dims, cell)
  if (flags.cell && hasCell && cell && cellDim) {
    items.push({ layer: 'cell', file: cell, ox: 0, oy: 0, width: cellDim.width, height: cellDim.height, flipX: false, tint: team, label: 'cell' })
  }
  if (flags.weapons) weapons.filter((w) => w.top).forEach(addWeapon)

  // Missing markers on top of everything (only when enabled).
  if (flags.showMissing) {
    for (const m of markers) {
      items.push({ layer: 'weapon-top', file: '', ox: m.ox, oy: m.oy, width: MARKER, height: MARKER, flipX: false, marker: true, label: m.label })
    }
  }

  // Symmetric bounds so the center stays the canvas center.
  let halfW = baseDim ? baseDim.width / 2 : 16
  let halfH = baseDim ? baseDim.height / 2 : 16
  for (const it of items) {
    halfW = Math.max(halfW, Math.abs(it.ox) + it.width / 2)
    halfH = Math.max(halfH, Math.abs(it.oy) + it.height / 2)
  }
  // Grow the canvas so a hitbox larger than the sprite isn't clipped
  // (+14px below the square for its "hitSize N" label).
  const hitboxPx = hitSize * scale
  if (flags.hitbox) {
    halfW = Math.max(halfW, hitboxPx / 2)
    halfH = Math.max(halfH, hitboxPx / 2 + 14)
  }
  const pad = 8
  const canvasWidth = Math.ceil(2 * (halfW + pad))
  const canvasHeight = Math.ceil(2 * (halfH + pad))
  const center = { x: canvasWidth / 2, y: canvasHeight / 2 }

  // Order preserved as pushed (already bottom→top by construction).
  const placements: Placement[] = items.map((it) => ({
    layer: it.layer,
    file: it.file,
    cx: center.x + it.ox,
    cy: center.y + it.oy,
    width: it.width,
    height: it.height,
    flipX: it.flipX,
    tint: it.tint,
    marker: it.marker,
    label: it.label
  }))

  const hitbox = flags.hitbox
    ? { cx: center.x, cy: center.y, size: hitboxPx, hitSize }
    : null

  return { canvasWidth, canvasHeight, center, placements, hitbox, notShown, outOfBounds }
}
