/**
 * Draw a "sprite missing here" marker: a small semi-transparent accent box with
 * a crosshair, centered on (cx, cy). Modest fixed size so it flags the spot
 * without dominating the composite.
 */
export function drawMissingMarker(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size = 14
): void {
  const h = size / 2
  ctx.save()
  ctx.globalAlpha = 0.7
  ctx.strokeStyle = '#4c8bf5'
  ctx.fillStyle = 'rgba(76, 139, 245, 0.15)'
  ctx.lineWidth = 1
  ctx.fillRect(cx - h, cy - h, size, size)
  ctx.strokeRect(cx - h + 0.5, cy - h + 0.5, size - 1, size - 1)
  ctx.beginPath()
  ctx.moveTo(cx - h, cy)
  ctx.lineTo(cx + h, cy)
  ctx.moveTo(cx, cy - h)
  ctx.lineTo(cx, cy + h)
  ctx.stroke()
  ctx.restore()
}

/** Fixed marker size in canvas px. */
export const MARKER_SIZE = 14

/**
 * Draw a ghost turret foundation: a semi-transparent orange square with a solid
 * outline, corner ticks, and a "ghost base" label — clearly a placeholder for a
 * missing real plate. `side` = the turret footprint (size * 32) px, centered.
 */
export function drawGhostFoundation(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  side: number
): void {
  const h = side / 2
  const x = cx - h
  const y = cy - h
  ctx.save()
  ctx.fillStyle = 'rgba(255, 150, 40, 0.15)'
  ctx.strokeStyle = '#ff9628'
  ctx.lineWidth = 2
  ctx.fillRect(x, y, side, side)
  ctx.strokeRect(x + 1, y + 1, side - 2, side - 2)

  // Corner ticks so it reads as a footprint, not a sprite.
  const t = Math.max(6, Math.min(18, side / 6))
  ctx.beginPath()
  ctx.moveTo(x, y + t); ctx.lineTo(x, y); ctx.lineTo(x + t, y)
  ctx.moveTo(x + side - t, y); ctx.lineTo(x + side, y); ctx.lineTo(x + side, y + t)
  ctx.moveTo(x + side, y + side - t); ctx.lineTo(x + side, y + side); ctx.lineTo(x + side - t, y + side)
  ctx.moveTo(x + t, y + side); ctx.lineTo(x, y + side); ctx.lineTo(x, y + side - t)
  ctx.stroke()

  ctx.fillStyle = '#ff9628'
  ctx.font = `${Math.max(8, Math.min(13, side / 12))}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('ghost base', cx, cy)
  ctx.restore()
}

/** Turret footprint px per size unit. */
export const TILE_PX = 32
