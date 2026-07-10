/**
 * Draw a unit hitbox overlay, matching what Mindustry actually uses:
 * - the axis-aligned square hitbox of side `hitSize` centered on the unit
 *   (Hitboxc.hitbox → rect.setCentered(x, y, hitSize)) — never rotated,
 *   independent of the sprite bounds;
 * - the inscribed circle of radius hitSize/2 that physics/`Units` overlap
 *   checks use.
 * `size` is the square's side in canvas px; `hitSize` is the raw world-unit
 * value shown in the label.
 */
export function drawHitbox(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  hitSize: number
): void {
  const h = size / 2
  ctx.save()

  // Square hitbox (Rect).
  ctx.strokeStyle = '#4dff77'
  ctx.fillStyle = 'rgba(77, 255, 119, 0.08)'
  ctx.lineWidth = 1
  ctx.fillRect(cx - h, cy - h, size, size)
  ctx.strokeRect(cx - h + 0.5, cy - h + 0.5, size - 1, size - 1)

  // Physics circle (radius hitSize/2), fainter so the square reads as primary.
  ctx.globalAlpha = 0.5
  ctx.beginPath()
  ctx.arc(cx, cy, h, 0, Math.PI * 2)
  ctx.stroke()
  ctx.globalAlpha = 1

  // Center cross tick.
  const t = Math.min(4, h / 2)
  ctx.beginPath()
  ctx.moveTo(cx - t, cy)
  ctx.lineTo(cx + t, cy)
  ctx.moveTo(cx, cy - t)
  ctx.lineTo(cx, cy + t)
  ctx.stroke()

  // Label under the square.
  const fmt = Number.isInteger(hitSize) ? String(hitSize) : hitSize.toFixed(1)
  ctx.fillStyle = '#4dff77'
  ctx.font = '9px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(`hitSize ${fmt}`, cx, cy + h + 3)

  ctx.restore()
}
