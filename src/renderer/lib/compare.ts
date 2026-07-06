/**
 * Pure geometry + readout for Compare mode. All math is in image pixels at
 * scale 1 (1 image px = 1 canvas px) so relative sizes are truthful; the
 * PixelViewport zoom then scales the whole canvas uniformly.
 */

export interface CompareItem {
  name: string
  path: string
  width: number
  height: number
  isCurrent: boolean
}

/** A selectable comparison reference from the mod ("mine") or vanilla index. */
export interface RefItem {
  source: 'mine' | 'vanilla'
  name: string
  path: string
}

/** Max references kept selectable so the comparison stays readable. */
export const MAX_REFS = 6

/** Distinct ghost tints for overlay references (current stays untinted). */
export const REF_TINTS = ['#4c8bf5', '#f25555', '#4dff77', '#ffd37f', '#a95eff', '#31d0d0']

/** Mindustry tile size in px. */
export const TILE = 32

// --- Side-by-side ---

export interface SideBox {
  path: string
  name: string
  x: number
  y: number
  w: number
  h: number
  isCurrent: boolean
}

export interface SideLayout {
  kind: 'side'
  canvasW: number
  canvasH: number
  baselineY: number
  boxes: SideBox[]
}

/** Lay items left→right at natural size, bottom-aligned on a common baseline. */
export function layoutSideBySide(items: CompareItem[], gap = 16, pad = 24): SideLayout {
  const maxH = items.reduce((m, it) => Math.max(m, it.height), 1)
  const labelH = 30
  const baselineY = pad + maxH
  let x = pad
  const boxes: SideBox[] = items.map((it) => {
    const box: SideBox = {
      path: it.path,
      name: it.name,
      x,
      y: baselineY - it.height,
      w: it.width,
      h: it.height,
      isCurrent: it.isCurrent
    }
    x += it.width + gap
    return box
  })
  const canvasW = Math.max(pad * 2, x - gap + pad)
  const canvasH = pad + maxH + labelH
  return { kind: 'side', canvasW, canvasH, baselineY, boxes }
}

// --- Overlay ---

export interface OverlayBox {
  path: string
  name: string
  cx: number
  cy: number
  w: number
  h: number
  isCurrent: boolean
  tint?: string
  opacity: number
}

export interface OverlayLayout {
  kind: 'overlay'
  canvasW: number
  canvasH: number
  boxes: OverlayBox[]
}

/**
 * Superimpose all items on a common center. References are ghosted (45%) and
 * tinted distinctly; the current sprite is full-opacity, drawn above or below.
 */
export function layoutOverlay(items: CompareItem[], currentAbove: boolean, pad = 24): OverlayLayout {
  const maxW = items.reduce((m, it) => Math.max(m, it.width), 1)
  const maxH = items.reduce((m, it) => Math.max(m, it.height), 1)
  const canvasW = maxW + pad * 2
  const canvasH = maxH + pad * 2
  const center = { x: canvasW / 2, y: canvasH / 2 }

  let tintIdx = 0
  const refs = items.filter((it) => !it.isCurrent)
  const current = items.filter((it) => it.isCurrent)

  const toBox = (it: CompareItem): OverlayBox => ({
    path: it.path,
    name: it.name,
    cx: center.x,
    cy: center.y,
    w: it.width,
    h: it.height,
    isCurrent: it.isCurrent,
    tint: it.isCurrent ? undefined : REF_TINTS[tintIdx++ % REF_TINTS.length],
    opacity: it.isCurrent ? 1 : 0.45
  })

  const refBoxes = refs.map(toBox)
  const curBoxes = current.map(toBox)
  // Draw order: bottom first.
  const boxes = currentAbove ? [...refBoxes, ...curBoxes] : [...curBoxes, ...refBoxes]
  return { kind: 'overlay', canvasW, canvasH, boxes }
}

// --- Size readout ---

export interface Readout {
  name: string
  w: number
  h: number
  /** width delta vs current (ref - current). */
  dw: number
  text: string
  /** tile interpretation, e.g. "2×2 tiles" or "1.5×1.5 tiles (not a clean 32 multiple)". */
  tiles: string
}

function tileNote(w: number, h: number): string {
  const tw = w / TILE
  const th = h / TILE
  const clean = w % TILE === 0 && h % TILE === 0
  const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(2))
  return clean
    ? `${fmt(tw)}×${fmt(th)} tiles`
    : `${fmt(tw)}×${fmt(th)} tiles (not a clean 32px multiple)`
}

/** Per-reference size comparison vs the current sprite. */
export function computeReadout(current: CompareItem, refs: CompareItem[]): Readout[] {
  return refs.map((r) => {
    const dw = r.width - current.width
    const dir = dw === 0 ? 'same width as' : `${Math.abs(dw)}px ${dw < 0 ? 'smaller' : 'larger'} than`
    return {
      name: r.name,
      w: r.width,
      h: r.height,
      dw,
      text: `${r.name} ${r.width}×${r.height} — ${dir} current ${current.width}×${current.height}`,
      tiles: tileNote(r.width, r.height)
    }
  })
}
