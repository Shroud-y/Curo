/**
 * Team-cell tinting. Pure with respect to the app — takes a decoded sprite and a
 * color, returns a NEW offscreen canvas with the tint applied. The multiply
 * happens entirely on the offscreen buffer, so it can never bleed onto the base
 * layer drawn underneath the cell on the main canvas.
 */

/** Parse a #rrggbb hex color into 0–255 RGB (defaults to white on bad input). */
function parseHex(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return { r: 255, g: 255, b: 255 }
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff }
}

/**
 * Tint a cell sprite by `color` using a per-pixel RGB multiply that PRESERVES the
 * original alpha. Only opaque cell pixels are colored; transparent pixels stay
 * transparent, so nothing under the cell is affected.
 */
export function tintCell(
  img: CanvasImageSource,
  width: number,
  height: number,
  color: string
): HTMLCanvasElement {
  const off = document.createElement('canvas')
  off.width = width
  off.height = height
  const ctx = off.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, 0, 0, width, height)

  const { r, g, b } = parseHex(color)
  const data = ctx.getImageData(0, 0, width, height)
  const px = data.data
  for (let i = 0; i < px.length; i += 4) {
    // Skip fully transparent pixels; multiply RGB, keep alpha (px[i+3]) intact.
    if (px[i + 3] === 0) continue
    px[i] = (px[i] * r) / 255
    px[i + 1] = (px[i + 1] * g) / 255
    px[i + 2] = (px[i + 2] * b) / 255
  }
  ctx.putImageData(data, 0, 0)
  return off
}
