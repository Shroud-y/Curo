import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import styles from './PixelViewport.module.css'

interface Props {
  /** Intrinsic (unscaled) content size in px — drives fit + transform. */
  width: number
  height: number
  /** Changes when the content identity changes → triggers a re-fit. */
  fitKey: string | null
  /** Extra controls rendered in the toolbar, right of Fit / zoom%. */
  toolbar?: React.ReactNode
  /** App-level controls pinned to the far LEFT of the toolbar (category tabs). */
  leading?: React.ReactNode
  /** The pixel content: an <img> or <canvas> sized to width/height at 0,0. */
  children: React.ReactNode
}

interface View {
  scale: number
  x: number
  y: number
}

const MIN_SCALE = 0.05
const MAX_SCALE = 16
const FIT_PADDING = 24

const clampScale = (s: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))

/**
 * Shared pan/zoom/fit surface for pixel content. No scrollbars: content sits on
 * a GPU-composited stage moved by a single translate()+scale() transform.
 * `mode:'fit'` recomputes on resize; any gesture switches to 'free'.
 */
export function PixelViewport({ width, height, fitKey, toolbar, leading, children }: Props): JSX.Element {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [pane, setPane] = useState({ w: 0, h: 0 })
  const [mode, setMode] = useState<'fit' | 'free'>('fit')
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 })
  const [zoomInput, setZoomInput] = useState('100')
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width: w, height: h } = entry.contentRect
      setPane({ w, h })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    setMode('fit')
  }, [fitKey])

  useLayoutEffect(() => {
    if (mode !== 'fit' || width === 0 || height === 0 || pane.w === 0 || pane.h === 0) return
    const scale = clampScale(
      Math.min((pane.w - 2 * FIT_PADDING) / width, (pane.h - 2 * FIT_PADDING) / height)
    )
    setView({ scale, x: (pane.w - width * scale) / 2, y: (pane.h - height * scale) / 2 })
  }, [mode, width, height, pane])

  useEffect(() => {
    if (!editing) setZoomInput(String(Math.round(view.scale * 100)))
  }, [view.scale, editing])

  const zoomAround = useCallback((nextScale: number, cx: number, cy: number) => {
    setView((v) => {
      const scale = clampScale(nextScale)
      return {
        scale,
        x: cx - ((cx - v.x) / v.scale) * scale,
        y: cy - ((cy - v.y) / v.scale) * scale
      }
    })
  }, [])

  const rafRef = useRef<number | null>(null)
  const pendingRef = useRef<{ scale: number; cx: number; cy: number } | null>(null)
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const base = pendingRef.current?.scale ?? view.scale
      pendingRef.current = { scale: base * Math.exp(-e.deltaY * 0.0015), cx, cy }
      setMode('free')
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null
          const p = pendingRef.current
          pendingRef.current = null
          if (p) zoomAround(p.scale, p.cx, p.cy)
        })
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [view.scale, zoomAround])

  const drag = useRef<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const hasContent = width > 0 && height > 0
  const onPointerDown = (e: React.PointerEvent): void => {
    if (!hasContent) return
    drag.current = { x: e.clientX, y: e.clientY }
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent): void => {
    if (!drag.current) return
    const dx = e.clientX - drag.current.x
    const dy = e.clientY - drag.current.y
    drag.current = { x: e.clientX, y: e.clientY }
    setMode('free')
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
  }
  const endDrag = (e: React.PointerEvent): void => {
    drag.current = null
    setDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const commitZoomInput = (): void => {
    setEditing(false)
    const pct = parseFloat(zoomInput)
    if (!Number.isFinite(pct)) return
    setMode('free')
    zoomAround(pct / 100, pane.w / 2, pane.h / 2)
  }

  return (
    <div className={styles.pane}>
      <div className={styles.toolbar}>
        {leading && <div className={styles.leading}>{leading}</div>}
        <div className={styles.controls}>
          <button className={styles.fitBtn} onClick={() => setMode('fit')}>
            Fit
          </button>
          <div className={styles.zoomField}>
            <input
              className={styles.zoomInput}
              value={zoomInput}
              onFocus={() => setEditing(true)}
              onChange={(e) => setZoomInput(e.target.value.replace(/[^0-9.]/g, ''))}
              onBlur={commitZoomInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
              inputMode="numeric"
              aria-label="Zoom percentage"
            />
            <span className={styles.percent}>%</span>
          </div>
          {toolbar && <div className={styles.toolbarExtra}>{toolbar}</div>}
        </div>
      </div>

      <div
        ref={viewportRef}
        className={`${styles.viewport} ${dragging ? styles.grabbing : hasContent ? styles.grab : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {hasContent ? (
          <div
            className={styles.stage}
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
          >
            {children}
          </div>
        ) : (
          <span className={styles.placeholder}>Nothing to show</span>
        )}
      </div>
    </div>
  )
}
