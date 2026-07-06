import { useCallback, useEffect, useState } from 'react'
import type { Settings, SpriteImage, SpriteNode } from '@shared/types'
import { SpriteTree } from './components/SpriteTree'
import { PreviewPane } from './components/PreviewPane'
import { InfoPane } from './components/InfoPane'
import { EmptyState } from './components/EmptyState'
import { SettingsPanel } from './components/SettingsPanel'
import styles from './App.module.css'

const NO_SPRITES_MSG = 'No sprites folder found — is this a Mindustry mod root?'

export default function App(): JSX.Element {
  const [modRoot, setModRoot] = useState<string | null>(null)
  const [groups, setGroups] = useState<SpriteNode[]>([])
  const [pickError, setPickError] = useState<string | null>(null)
  const [selected, setSelected] = useState<SpriteNode | null>(null)
  const [image, setImage] = useState<SpriteImage | null>(null)
  const [settings, setSettings] = useState<Settings>({})
  const [showSettings, setShowSettings] = useState(false)
  const [reloadNonce, setReloadNonce] = useState(0)

  // Load a mod root's sprite groups. On success commits the root + groups;
  // on failure surfaces an error and leaves the current root untouched.
  const loadRoot = useCallback(async (path: string) => {
    const result = await window.api.readSpriteTree(path)
    if (!result) {
      setPickError(NO_SPRITES_MSG)
      return
    }
    setModRoot(path)
    setGroups(result.groups)
    setPickError(null)
  }, [])

  const pickFolder = useCallback(async () => {
    const path = await window.api.pickModFolder()
    if (path) await loadRoot(path)
  }, [loadRoot])

  // Auto-load the last-opened root + settings on launch.
  useEffect(() => {
    void window.api.getSettings().then(setSettings)
    void window.api.getLastRoot().then((last) => {
      if (last) void loadRoot(last)
    })
  }, [loadRoot])

  // Load the selected sprite's bytes + dimensions. reloadNonce forces a re-read
  // when the watcher reports the open file changed on disk.
  useEffect(() => {
    if (selected?.type !== 'sprite') {
      setImage(null)
      return
    }
    let cancelled = false
    void window.api
      .readSprite(selected.path)
      .then((img) => {
        if (!cancelled) setImage(img)
      })
      .catch(() => {
        if (!cancelled) setImage(null)
      })
    return () => {
      cancelled = true
    }
  }, [selected, reloadNonce])

  // Live-reload: refresh the tree on any watched .png change, and refresh the
  // open preview when its file is the one that changed.
  useEffect(() => {
    if (!modRoot) return
    return window.api.onSpritesChanged((e) => {
      void window.api.readSpriteTree(modRoot).then((r) => {
        if (r) setGroups(r.groups)
      })
      if (selected?.path === e.path) {
        if (e.event === 'unlink') setSelected(null)
        else setReloadNonce((n) => n + 1)
      }
    })
  }, [modRoot, selected])

  const openInEditor = useCallback(async () => {
    if (selected?.type !== 'sprite') return
    try {
      await window.api.openInEditor(selected.path)
    } catch (err) {
      if (String(err).includes('NO_EDITOR')) {
        setShowSettings(true)
      } else {
        window.alert(`Could not open editor:\n${String(err)}`)
      }
    }
  }, [selected])

  const replaceSprite = useCallback(async () => {
    if (selected?.type !== 'sprite') return
    const ok = window.confirm(
      `Overwrite "${selected.name}" with another PNG?\nThis cannot be undone.`
    )
    if (!ok) return
    await window.api.replaceSprite(selected.path)
    // The watcher fires a 'change' event → tree + preview refresh automatically.
  }, [selected])

  const chooseEditor = useCallback(async () => {
    setSettings(await window.api.chooseEditor())
  }, [])

  if (!modRoot) {
    return <EmptyState onPick={pickFolder} error={pickError} />
  }

  return (
    <div className={styles.app}>
      <aside className={styles.left}>
        <div className={styles.leftHeader}>
          <span className={styles.rootLabel} title={modRoot}>
            {modRoot}
          </span>
          <button className={styles.headerBtn} onClick={() => setShowSettings(true)}>
            ⚙
          </button>
          <button className={styles.headerBtn} onClick={pickFolder}>
            Change
          </button>
        </div>
        {pickError && <p className={styles.pickError}>{pickError}</p>}
        <div className={styles.treeScroll}>
          {groups.map((group) => (
            <SpriteTree
              key={group.path}
              node={group}
              selectedPath={selected?.path ?? null}
              onSelect={setSelected}
            />
          ))}
        </div>
      </aside>

      <main className={styles.center}>
        <PreviewPane image={image} fitKey={selected?.type === 'sprite' ? selected.path : null} />
      </main>

      <aside className={styles.right}>
        <InfoPane
          sprite={selected?.type === 'sprite' ? selected : null}
          image={image}
          onOpenEditor={openInEditor}
          onReplace={replaceSprite}
        />
      </aside>

      {showSettings && (
        <SettingsPanel
          editorPath={settings.editorPath}
          onChooseEditor={chooseEditor}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
