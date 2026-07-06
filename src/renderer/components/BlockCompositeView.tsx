import { useEffect, useMemo, useRef, useState } from 'react'
import type { BlockComponentSel, BlockView } from '../lib/blockModel'
import { layoutBlock } from '../lib/blockComposite'
import type { Dims } from '../lib/composite'
import { drawGhostFoundation, drawMissingMarker } from '../lib/marker'
import { PixelViewport } from './PixelViewport'
import { useSprites } from './useSprites'
import styles from './CompositeView.module.css'

interface Props {
  view: BlockView
  component: BlockComponentSel | null
  reloadVersion: number
  /** App-level category tabs, pinned left of the toolbar. */
  leading?: React.ReactNode
}

export function BlockCompositeView({ view, component, reloadVersion, leading }: Props): JSX.Element {
  const [mode, setMode] = useState<'ingame' | 'component'>('ingame')
  const [showMissing, setShowMissing] = useState(true)
  const [showGhost, setShowGhost] = useState(true)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    setMode(component ? 'component' : 'ingame')
  }, [component, view.block.id])

  const files = useMemo(() => {
    const set = new Set<string>()
    if (view.foundation) set.add(view.foundation)
    if (view.main) set.add(view.main)
    view.parts.forEach((p) => p.file && set.add(p.file))
    return [...set]
  }, [view])
  const { imgs } = useSprites(files, reloadVersion)

  const dims: Dims = useMemo(() => {
    const m: Dims = new Map()
    imgs.forEach((v, k) => m.set(k, { width: v.width, height: v.height }))
    return m
  }, [imgs])

  const layout = useMemo(
    () => layoutBlock(view, dims, showMissing, showGhost),
    [view, dims, showMissing, showGhost]
  )

  const compFile = component?.file ?? view.main
  const compDim = compFile ? dims.get(compFile) : undefined
  const canvasW = mode === 'component' ? (compDim?.width ?? 1) : layout.canvasWidth
  const canvasH = mode === 'component' ? (compDim?.height ?? 1) : layout.canvasHeight

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (mode === 'component') {
      const loaded = compFile ? imgs.get(compFile) : undefined
      if (loaded) ctx.drawImage(loaded.img, 0, 0, loaded.width, loaded.height)
      return
    }
    for (const p of layout.placements) {
      if (p.ghost) {
        drawGhostFoundation(ctx, p.cx, p.cy, p.width)
        continue
      }
      if (p.marker) {
        drawMissingMarker(ctx, p.cx, p.cy, p.width)
        continue
      }
      const loaded = imgs.get(p.file)
      if (!loaded) continue
      ctx.drawImage(loaded.img, p.cx - p.width / 2, p.cy - p.height / 2, p.width, p.height)
    }
  }, [mode, layout, imgs, compFile, canvasW, canvasH])

  const toolbar = (
    <>
      <div className={styles.segmented}>
        <button className={mode === 'ingame' ? styles.segActive : styles.seg} onClick={() => setMode('ingame')}>
          In-game
        </button>
        <button className={mode === 'component' ? styles.segActive : styles.seg} onClick={() => setMode('component')}>
          Component
        </button>
      </div>
      {mode === 'ingame' && (
        <>
          <label className={styles.check} title="Show a marker where a region sprite is missing">
            <input type="checkbox" checked={showMissing} onChange={(e) => setShowMissing(e.target.checked)} />
            missing
          </label>
          {view.isTurret && (
            <label className={styles.check} title="Draw a ghost footprint when no real turret base plate is found">
              <input type="checkbox" checked={showGhost} onChange={(e) => setShowGhost(e.target.checked)} />
              ghost base
            </label>
          )}
        </>
      )}
    </>
  )

  const fitKey = `${view.block.id}:${mode}:${mode === 'component' ? component?.label ?? 'base' : 'ingame'}`
  const noBase = mode === 'ingame' && layout.noBase
  const showNote = mode === 'ingame' && (layout.notShown.length > 0 || view.codeDrawn.length > 0)

  return (
    <div className={styles.wrap}>
      <PixelViewport width={canvasW} height={canvasH} fitKey={fitKey} toolbar={toolbar} leading={leading}>
        <canvas ref={canvasRef} className={styles.canvas} width={canvasW} height={canvasH} />
      </PixelViewport>

      {noBase && (
        <div className={styles.placeholderBox}>
          <b>{view.block.id}</b>
          <span>no base sprite — pure code-drawn ({view.block.className})</span>
        </div>
      )}

      {showNote && (
        <div className={styles.note}>
          {layout.notShown.length > 0 && (
            <div>
              <b>not shown</b> (missing sprite): {layout.notShown.join(', ')}
            </div>
          )}
          {view.codeDrawn.length > 0 && (
            <div className={styles.warn}>
              <b>code-drawn (no sprite)</b>: {view.codeDrawn.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
