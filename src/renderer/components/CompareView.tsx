import { useEffect, useMemo, useRef, useState } from 'react'
import type { RefItem } from '../lib/compare'
import {
  computeReadout,
  layoutOverlay,
  layoutSideBySide,
  TILE,
  type CompareItem
} from '../lib/compare'
import { tintCell } from '../lib/cellTint'
import { PixelViewport } from './PixelViewport'
import { useSprites } from './useSprites'
import styles from './CompareView.module.css'

interface Props {
  /** The active sprite being compared against. */
  currentPath: string | null
  currentName: string
  refs: RefItem[]
  reloadVersion: number
  /** Mode segmented control (In-game/Component/Compare) from App. */
  modeTabs: React.ReactNode
  /** Category tabs (Sprites/Units/Blocks) from App. */
  leading?: React.ReactNode
}

const baseName = (p: string): string => p.split(/[\\/]/).pop()?.replace(/\.png$/i, '') ?? p

/** Draw a faint 32px tile grid as a size ruler. */
function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = 0; x <= w; x += TILE) {
    ctx.moveTo(x + 0.5, 0)
    ctx.lineTo(x + 0.5, h)
  }
  for (let y = 0; y <= h; y += TILE) {
    ctx.moveTo(0, y + 0.5)
    ctx.lineTo(w, y + 0.5)
  }
  ctx.stroke()
  ctx.restore()
}

export function CompareView({
  currentPath,
  currentName,
  refs,
  reloadVersion,
  modeTabs,
  leading
}: Props): JSX.Element {
  const [layout, setLayout] = useState<'side' | 'overlay'>('side')
  const [currentAbove, setCurrentAbove] = useState(true)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const files = useMemo(() => {
    const set = new Set<string>()
    if (currentPath) set.add(currentPath)
    refs.forEach((r) => set.add(r.path))
    return [...set]
  }, [currentPath, refs])
  const { imgs } = useSprites(files, reloadVersion)

  // Build compare items (current first, then refs) for whatever has loaded.
  const items: CompareItem[] = useMemo(() => {
    const out: CompareItem[] = []
    if (currentPath) {
      const c = imgs.get(currentPath)
      if (c) out.push({ name: currentName, path: currentPath, width: c.width, height: c.height, isCurrent: true })
    }
    for (const r of refs) {
      const im = imgs.get(r.path)
      if (im) out.push({ name: r.name, path: r.path, width: im.width, height: im.height, isCurrent: false })
    }
    return out
  }, [imgs, currentPath, currentName, refs])

  const current = items.find((i) => i.isCurrent) ?? null
  const readout = useMemo(
    () => (current ? computeReadout(current, items.filter((i) => !i.isCurrent)) : []),
    [current, items]
  )

  const side = useMemo(() => layoutSideBySide(items), [items])
  const over = useMemo(() => layoutOverlay(items, currentAbove), [items, currentAbove])
  const canvasW = layout === 'side' ? side.canvasW : over.canvasW
  const canvasH = layout === 'side' ? side.canvasH : over.canvasH

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    drawGrid(ctx, canvas.width, canvas.height)

    if (layout === 'side') {
      for (const b of side.boxes) {
        const im = imgs.get(b.path)
        if (im) ctx.drawImage(im.img, b.x, b.y, b.w, b.h)
        if (b.isCurrent) {
          ctx.save()
          ctx.strokeStyle = '#4c8bf5'
          ctx.lineWidth = 2
          ctx.strokeRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2)
          ctx.restore()
        }
        // Labels under the baseline.
        ctx.save()
        ctx.fillStyle = b.isCurrent ? '#4c8bf5' : 'rgba(230,232,238,0.85)'
        ctx.font = '9px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        const cx = b.x + b.w / 2
        ctx.fillText(`${b.name}${b.isCurrent ? ' (this)' : ''}`, cx, side.baselineY + 4)
        ctx.fillText(`${b.w}×${b.h}`, cx, side.baselineY + 16)
        ctx.restore()
      }
    } else {
      for (const b of over.boxes) {
        const im = imgs.get(b.path)
        if (!im) continue
        ctx.save()
        ctx.globalAlpha = b.opacity
        const draw = b.tint ? tintCell(im.img, b.w, b.h, b.tint) : im.img
        ctx.drawImage(draw, b.cx - b.w / 2, b.cy - b.h / 2, b.w, b.h)
        ctx.restore()
      }
    }
  }, [layout, side, over, imgs])

  const toolbar = (
    <>
      {modeTabs}
      <div className={styles.segmented}>
        <button className={layout === 'side' ? styles.segActive : styles.seg} onClick={() => setLayout('side')}>
          Side-by-side
        </button>
        <button className={layout === 'overlay' ? styles.segActive : styles.seg} onClick={() => setLayout('overlay')}>
          Overlay
        </button>
      </div>
      {layout === 'overlay' && (
        <label className={styles.check} title="Draw the current sprite above or below the references">
          <input type="checkbox" checked={currentAbove} onChange={(e) => setCurrentAbove(e.target.checked)} />
          current on top
        </label>
      )}
    </>
  )

  const fitKey = `compare:${layout}:${currentPath}:${refs.map((r) => r.path).join(',')}`

  return (
    <div className={styles.wrap}>
      <PixelViewport
        width={items.length ? canvasW : 0}
        height={items.length ? canvasH : 0}
        fitKey={fitKey}
        toolbar={toolbar}
        leading={leading}
      >
        <canvas ref={canvasRef} className={styles.canvas} width={canvasW} height={canvasH} />
      </PixelViewport>

      <div className={styles.readout}>
        {!currentPath ? (
          <span className={styles.dim}>No current sprite selected</span>
        ) : refs.length === 0 ? (
          <span className={styles.dim}>Pick references on the right to compare against {baseName(currentPath)}</span>
        ) : (
          readout.map((r) => (
            <div key={r.name} className={styles.readRow}>
              <b>{r.text}</b> · {r.tiles}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
