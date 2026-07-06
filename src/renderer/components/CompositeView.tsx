import { useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentSel, UnitView } from '../lib/unitModel'
import { TEAMS } from '../lib/unitModel'
import { layoutComposite, type Dims, type LayerFlags } from '../lib/composite'
import { tintCell } from '../lib/cellTint'
import { PixelViewport } from './PixelViewport'
import styles from './CompositeView.module.css'

interface Props {
  view: UnitView
  /** Isolated component from the tree; when set, Component mode is selected. */
  component: ComponentSel | null
  /** Bumps on any watched-sprite change → forces a reload (busts stale images). */
  reloadVersion: number
}

interface Loaded {
  img: HTMLImageElement
  width: number
  height: number
}

/**
 * Load a set of sprite paths (dataURL + dims) into decoded images. Reloads whenever
 * the file set OR `version` changes — a Replace/live-reload bumps `version`, so an
 * edited file at the same path is refetched instead of served stale.
 */
function useSprites(files: string[], version: number): { imgs: Map<string, Loaded> } {
  const [imgs, setImgs] = useState<Map<string, Loaded>>(new Map())
  const key = files.slice().sort().join('|')

  useEffect(() => {
    let cancelled = false
    void Promise.all(
      files
        .filter(Boolean)
        .map(async (file): Promise<[string, Loaded]> => {
          const s = await window.api.readSprite(file)
          const img = new Image()
          await new Promise<void>((res) => {
            img.onload = () => res()
            img.onerror = () => res()
            img.src = s.dataUrl
          })
          return [file, { img, width: s.width, height: s.height }]
        })
    ).then((entries) => {
      if (!cancelled) setImgs(new Map(entries))
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version])

  return { imgs }
}

export function CompositeView({ view, component, reloadVersion }: Props): JSX.Element {
  const [mode, setMode] = useState<'ingame' | 'component'>('ingame')
  const [scale, setScale] = useState(4)
  const [teamKey, setTeamKey] = useState<string>('Sharded')
  const [customTeam, setCustomTeam] = useState('#7fd3ff')
  const [flags, setFlags] = useState<LayerFlags>({ cell: true, weapons: true, outline: false })
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const team = teamKey === 'Custom' ? customTeam : TEAMS[teamKey]
  const hasCellUi = view.unit.hasCell && view.cell !== null

  // Selecting a component from the tree switches to Component mode; selecting the
  // unit node (component === null) returns to In-game.
  useEffect(() => {
    setMode(component ? 'component' : 'ingame')
  }, [component, view.unit.id])

  // All sprites this unit might draw — loaded up front so mode switches are instant.
  const files = useMemo(() => {
    const set = new Set<string>()
    if (view.base) set.add(view.base)
    if (view.cell) set.add(view.cell)
    view.weapons.forEach((w) => w.file && set.add(w.file))
    return [...set]
  }, [view])
  const { imgs } = useSprites(files, reloadVersion)

  const dims: Dims = useMemo(() => {
    const m: Dims = new Map()
    imgs.forEach((v, k) => m.set(k, { width: v.width, height: v.height }))
    return m
  }, [imgs])

  const layout = useMemo(
    () =>
      layoutComposite({
        base: view.base,
        cell: view.cell,
        hasCell: view.unit.hasCell,
        weapons: view.weapons,
        dims,
        scale,
        team,
        flags
      }),
    [view, dims, scale, team, flags]
  )

  // Component-mode intrinsic size = the isolated sprite's own dims.
  const compFile = component?.file ?? view.base
  const compDim = compFile ? dims.get(compFile) : undefined
  const canvasW = mode === 'component' ? (compDim?.width ?? 1) : layout.canvasWidth
  const canvasH = mode === 'component' ? (compDim?.height ?? 1) : layout.canvasHeight

  // Warn once per layout about weapons positioned beyond the base bounds.
  useEffect(() => {
    if (mode === 'ingame' && layout.outOfBounds.length) {
      console.warn(
        `[composite] ${view.unit.id}: weapon pos beyond base bounds → ${layout.outOfBounds.join(', ')} (scale=${scale})`
      )
    }
  }, [layout.outOfBounds, mode, view.unit.id, scale])

  // Draw.
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
      const loaded = imgs.get(p.file)
      if (!loaded) continue
      ctx.save()
      ctx.translate(p.cx, p.cy)
      if (p.flipX) ctx.scale(-1, 1)
      if (p.tint) {
        ctx.drawImage(tintCell(loaded.img, p.width, p.height, p.tint), -p.width / 2, -p.height / 2)
      } else {
        ctx.drawImage(loaded.img, -p.width / 2, -p.height / 2, p.width, p.height)
      }
      ctx.restore()
    }
  }, [mode, layout, imgs, compFile, canvasW, canvasH])

  const toolbar = (
    <>
      <div className={styles.segmented}>
        <button
          className={mode === 'ingame' ? styles.segActive : styles.seg}
          onClick={() => setMode('ingame')}
        >
          In-game
        </button>
        <button
          className={mode === 'component' ? styles.segActive : styles.seg}
          onClick={() => setMode('component')}
        >
          Component
        </button>
      </div>

      {mode === 'ingame' && (
        <>
          <label className={styles.slider}>
            scale
            <input
              type="range"
              min={0.5}
              max={12}
              step={0.5}
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
            />
            <span className={styles.sliderVal}>{scale}px</span>
          </label>

          <label className={styles.check}>
            <input
              type="checkbox"
              checked={flags.weapons}
              onChange={(e) => setFlags((f) => ({ ...f, weapons: e.target.checked }))}
            />
            weapons
          </label>
          {hasCellUi && (
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={flags.cell}
                onChange={(e) => setFlags((f) => ({ ...f, cell: e.target.checked }))}
              />
              cell
            </label>
          )}
          <label className={`${styles.check} ${styles.disabled}`} title="Outline generation not implemented yet">
            <input type="checkbox" checked={false} disabled />
            outline
          </label>

          {hasCellUi && (
            <div className={styles.team}>
              <select value={teamKey} onChange={(e) => setTeamKey(e.target.value)}>
                {Object.keys(TEAMS).map((t) => (
                  <option key={t}>{t}</option>
                ))}
                <option>Custom</option>
              </select>
              {teamKey === 'Custom' && (
                <input
                  type="color"
                  value={customTeam}
                  onChange={(e) => setCustomTeam(e.target.value)}
                />
              )}
              <span className={styles.swatch} style={{ background: team }} />
            </div>
          )}
        </>
      )}
    </>
  )

  const fitKey = `${view.unit.id}:${mode}:${mode === 'component' ? component?.label ?? 'base' : 'ingame'}`

  return (
    <div className={styles.wrap}>
      <PixelViewport width={canvasW} height={canvasH} fitKey={fitKey} toolbar={toolbar}>
        <canvas ref={canvasRef} className={styles.canvas} width={canvasW} height={canvasH} />
      </PixelViewport>

      {mode === 'ingame' && (layout.notShown.length > 0 || layout.outOfBounds.length > 0) && (
        <div className={styles.note}>
          {layout.notShown.length > 0 && (
            <div>
              <b>not shown</b> (missing sprite): {layout.notShown.join(', ')}
            </div>
          )}
          {layout.outOfBounds.length > 0 && (
            <div className={styles.warn}>
              <b>out of bounds</b> (pos beyond base — check scale): {layout.outOfBounds.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
