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
