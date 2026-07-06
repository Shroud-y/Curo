import type { Dims } from './composite'
import type { BlockView } from './blockModel'

/** One draw instruction for a block, in canvas pixel space, bottom→top. */
export interface BlockPlacement {
  layer: 'foundation' | 'base' | 'part'
  file: string
  cx: number
  cy: number
  width: number
  height: number
  /** a missing-sprite placeholder marker (no image drawn). */
  marker?: boolean
  label: string
}

const MARKER = 14

export interface BlockLayout {
  canvasWidth: number
  canvasHeight: number
  center: { x: number; y: number }
  placements: BlockPlacement[]
  /** named region-part labels whose sprite is missing/unresolved. */
  notShown: string[]
  /** true when the block has no resolvable main sprite (pure code-drawn). */
  noBase: boolean
}

const dimOf = (dims: Dims, file: string | null): { width: number; height: number } | null =>
  file ? (dims.get(file) ?? null) : null

/**
 * Pure layout of a block composite. All sprites are centered on the same point
 * (blocks have no per-part offset), so the canvas is just the largest present
 * sprite. Layer order bottom→top: foundation → main → parts (declared order).
 */
export function layoutBlock(view: BlockView, dims: Dims, showMissing: boolean): BlockLayout {
  const items: Array<{ layer: BlockPlacement['layer']; file: string; w: number; h: number; marker?: boolean; label: string }> = []
  const notShown: string[] = []

  const foundationDim = dimOf(dims, view.foundation)
  if (view.foundation && foundationDim) {
    items.push({ layer: 'foundation', file: view.foundation, w: foundationDim.width, h: foundationDim.height, label: view.foundationLabel })
  }

  const mainDim = dimOf(dims, view.main)
  if (view.main && mainDim) {
    items.push({ layer: 'base', file: view.main, w: mainDim.width, h: mainDim.height, label: 'base' })
  }

  let missing = 0
  for (const p of view.parts) {
    const d = dimOf(dims, p.file)
    if (!p.file || !d) {
      notShown.push(p.label)
      missing++
      continue
    }
    items.push({ layer: 'part', file: p.file, w: d.width, h: d.height, label: p.label })
  }

  let maxW = 16
  let maxH = 16
  for (const it of items) {
    maxW = Math.max(maxW, it.w)
    maxH = Math.max(maxH, it.h)
  }
  const pad = 8
  const canvasWidth = Math.ceil(maxW + 2 * pad)
  const canvasHeight = Math.ceil(maxH + 2 * pad)
  const center = { x: canvasWidth / 2, y: canvasHeight / 2 }

  const placements: BlockPlacement[] = items.map((it) => ({
    layer: it.layer,
    file: it.file,
    cx: center.x,
    cy: center.y,
    width: it.w,
    height: it.h,
    label: it.label
  }))

  // Missing parts have no per-part offset (blocks are centered) → mark the
  // center, one marker per missing part, slightly fanned so they don't fully
  // overlap.
  if (showMissing && missing > 0) {
    for (let i = 0; i < missing; i++) {
      const dx = (i - (missing - 1) / 2) * (MARKER + 2)
      placements.push({ layer: 'part', file: '', cx: center.x + dx, cy: center.y, width: MARKER, height: MARKER, marker: true, label: 'missing' })
    }
  }

  return { canvasWidth, canvasHeight, center, placements, notShown, noBase: view.main === null }
}
