import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { SpriteImage } from '@shared/types'
import styles from './PreviewPane.module.css'

interface Props {
  image: SpriteImage | null
  /** Changes when a *new* sprite is selected — triggers a re-fit. Same value on
   *  a live-reload of the same file, so zoom/pan is preserved across edits. */
  fitKey: string | null
}

/** Viewport transform: image-px→screen scale, plus stage translation in px. */
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
 * Preview with continuous, cursor-centered wheel zoom and click-drag panning.
 * No scrollbars: the sprite lives on a GPU-composited stage positioned with a
 * single `translate() scale()` transform (transform-origin 0 0). `mode: 'fit'`
 * recomputes scale+center on every resize; any user gesture switches to 'free'
 * and pins the view until Fit is pressed again.
 */
export function PreviewPane({ image, fitKey }: Props): JSX.Element {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [pane, setPane] = useState({ w: 0, h: 0 })
  const [mode, setMode] = useState<'fit' | 'free'>('fit')
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 })
  const [zoomInput, setZoomInput] = useState('100')
  const [editing, setEditing] = useState(false)

  // Track the pane's content-box size for fit math.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setPane({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // A newly selected sprite always starts in fit mode.
  useEffect(() => {
    setMode('fit')
  }, [fitKey])

  // In fit mode, (re)compute scale + centered offset whenever the pane or image
  // changes. useLayoutEffect so the first paint is already fitted (no flash).
  useLayoutEffect(() => {
    if (mode !== 'fit' || !image || pane.w === 0 || pane.h === 0) return
    const scale = clampScale(
      Math.min((pane.w - 2 * FIT_PADDING) / image.width, (pane.h - 2 * FIT_PADDING) / image.height)
    )
    setView({
      scale,
      x: (pane.w - image.width * scale) / 2,
      y: (pane.h - image.height * scale) / 2
    })
  }, [mode, image, pane])

  // Keep the % field in sync with the live scale (unless the user is typing).
  useEffect(() => {
    if (!editing) setZoomInput(String(Math.round(view.scale * 100)))
  }, [view.scale, editing])

  /** Zoom to `nextScale` keeping the image point under (cx,cy) fixed. */
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

  // Non-passive wheel listener so we can preventDefault (block page zoom) and
  // zoom toward the cursor. rAF-coalesced so a fast wheel can't outrun paint.
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

  // Click-drag panning (1:1 with the cursor).
  const drag = useRef<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const onPointerDown = (e: React.PointerEvent): void => {
    if (!image) return
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
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
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
      </div>

      <div
        ref={viewportRef}
        className={`${styles.viewport} ${dragging ? styles.grabbing : image ? styles.grab : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {image ? (
          <div
            className={styles.stage}
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
          >
            <img
              className={styles.sprite}
              src={image.dataUrl}
              width={image.width}
              height={image.height}
              alt=""
              draggable={false}
            />
          </div>
        ) : (
          <span className={styles.placeholder}>Select a sprite</span>
        )}
      </div>
    </div>
  )
}
