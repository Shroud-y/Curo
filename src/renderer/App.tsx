import { useCallback, useEffect, useState } from 'react'
import type { SpriteImage, SpriteNode } from '@shared/types'
import { SpriteTree } from './components/SpriteTree'
import { PreviewPane } from './components/PreviewPane'
import { InfoPane } from './components/InfoPane'
import { EmptyState } from './components/EmptyState'
import styles from './App.module.css'

export default function App(): JSX.Element {
  const [modRoot, setModRoot] = useState<string | null>(null)
  const [tree, setTree] = useState<SpriteNode | null>(null)
  const [treeError, setTreeError] = useState<string | null>(null)
  const [selected, setSelected] = useState<SpriteNode | null>(null)
  const [image, setImage] = useState<SpriteImage | null>(null)
  const [zoom, setZoom] = useState(100)

  const pickFolder = useCallback(async () => {
    const path = await window.api.pickModFolder()
    if (!path) return
    setModRoot(path)
    setSelected(null)
    setImage(null)
    const t = await window.api.readSpriteTree(path)
    if (!t) {
      setTree(null)
      setTreeError('No "sprites/" folder found in this mod root.')
    } else {
      setTree(t)
      setTreeError(null)
    }
  }, [])

  // Load the selected sprite's bytes + dimensions whenever the selection changes.
  useEffect(() => {
    if (selected?.type !== 'sprite') {
      setImage(null)
      return
    }
    let cancelled = false
    void window.api.readSprite(selected.path).then((img) => {
      if (!cancelled) setImage(img)
    })
    return () => {
      cancelled = true
    }
  }, [selected])

  if (!modRoot) {
    return <EmptyState onPick={pickFolder} />
  }

  return (
    <div className={styles.app}>
      <aside className={styles.left}>
        <div className={styles.leftHeader}>
          <span className={styles.rootLabel} title={modRoot}>
            {modRoot}
          </span>
          <button className={styles.changeBtn} onClick={pickFolder}>
            Change
          </button>
        </div>
        <div className={styles.treeScroll}>
          {treeError ? (
            <p className={styles.treeError}>{treeError}</p>
          ) : (
            tree && (
              <SpriteTree
                node={tree}
                selectedPath={selected?.path ?? null}
                onSelect={setSelected}
              />
            )
          )}
        </div>
      </aside>

      <main className={styles.center}>
        <PreviewPane image={image} zoom={zoom} onZoomChange={setZoom} />
      </main>

      <aside className={styles.right}>
        <InfoPane sprite={selected?.type === 'sprite' ? selected : null} image={image} />
      </aside>
    </div>
  )
}
