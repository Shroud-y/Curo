import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Settings, SpriteImage, SpriteNode } from '@shared/types'
import type { DefEntity, ParseResult, UnitEntity } from '@shared/content'
import { SpriteTree } from './components/SpriteTree'
import { PreviewPane } from './components/PreviewPane'
import { InfoPane } from './components/InfoPane'
import { EmptyState } from './components/EmptyState'
import { SettingsPanel } from './components/SettingsPanel'
import { DebugPanel } from './components/DebugPanel'
import { ContentTree } from './components/ContentTree'
import { CompositeView } from './components/CompositeView'
import { BlockTree } from './components/BlockTree'
import { BlockCompositeView } from './components/BlockCompositeView'
import { CompareView } from './components/CompareView'
import { RefPicker, type RefEntry } from './components/RefPicker'
import { flattenLeaves } from './lib/resolveSprites'
import { buildUnitViews, type ComponentSel, type UnitView } from './lib/unitModel'
import { buildBlockViews, type BlockComponentSel, type BlockView } from './lib/blockModel'
import { MAX_REFS, type RefItem } from './lib/compare'
import styles from './App.module.css'

const NO_SPRITES_MSG = 'No sprites folder found — is this a Mindustry mod root?'

/** Middle-ellipsis a path, keeping the drive/root and the final folder visible. */
function shortenPath(p: string, max = 40): string {
  if (p.length <= max) return p
  const sep = p.includes('\\') ? '\\' : '/'
  const parts = p.split(/[\\/]/)
  const head = parts[0] + sep // e.g. "E:\"
  const tail = parts[parts.length - 1] || parts[parts.length - 2]
  return `${head}...${sep}${tail}`
}

export default function App(): JSX.Element {
  const [modRoot, setModRoot] = useState<string | null>(null)
  const [groups, setGroups] = useState<SpriteNode[]>([])
  const [pickError, setPickError] = useState<string | null>(null)
  // Single source of truth for the active sprite — set by whichever tree
  // (Sprites or Units) was clicked last. `activeUnresolved` marks a selection
  // that has no backing file (e.g. an unresolved weapon region).
  const [activePath, setActivePath] = useState<string | null>(null)
  const [activeUnresolved, setActiveUnresolved] = useState(false)
  const [image, setImage] = useState<SpriteImage | null>(null)
  const [settings, setSettings] = useState<Settings>({})
  const [showSettings, setShowSettings] = useState(false)
  const [reloadNonce, setReloadNonce] = useState(0)
  // Bumps on every watched-sprite change; passed to the composite so it busts
  // stale images after a Replace/edit.
  const [spritesVersion, setSpritesVersion] = useState(0)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [showDebug, setShowDebug] = useState(false)
  const [leftTab, setLeftTab] = useState<'sprites' | 'units' | 'blocks'>('sprites')
  const [unitSel, setUnitSel] = useState<{ unitId: string; component: ComponentSel | null } | null>(
    null
  )
  const [blockSel, setBlockSel] = useState<{
    blockId: string
    component: BlockComponentSel | null
  } | null>(null)

  // View mode: composite ingame/component (units/blocks) + a global Compare flag.
  const [compMode, setCompMode] = useState<'ingame' | 'component'>('ingame')
  const [compare, setCompare] = useState(false)
  const [refs, setRefs] = useState<RefItem[]>([])
  const [vanillaGroups, setVanillaGroups] = useState<SpriteNode[] | null>(null)

  const selectSprite = useCallback((path: string | null) => {
    setActivePath(path)
    setActiveUnresolved(path === null)
  }, [])

  const loadVanilla = useCallback(async () => {
    setVanillaGroups(await window.api.readVanillaSprites())
  }, [])

  // Reference lists (flat name+path) for the compare picker.
  const mineRefs = useMemo<RefEntry[]>(
    () => flattenLeaves(groups).map((l) => ({ name: l.stem, path: l.path })),
    [groups]
  )
  const vanillaRefs = useMemo<RefEntry[] | null>(
    () => (vanillaGroups ? flattenLeaves(vanillaGroups).map((l) => ({ name: l.stem, path: l.path })) : null),
    [vanillaGroups]
  )

  const toggleRef = useCallback((item: RefItem) => {
    setRefs((prev) => (prev.length >= MAX_REFS ? prev : [...prev, item]))
  }, [])
  const removeRef = useCallback((path: string) => {
    setRefs((prev) => prev.filter((r) => r.path !== path))
  }, [])
  const chooseVanilla = useCallback(async () => {
    setSettings(await window.api.chooseVanilla())
    await loadVanilla()
  }, [loadVanilla])

  // Render-ready views, rebuilt when the parse result or sprite tree changes.
  const unitViews = useMemo<UnitView[]>(() => {
    if (!parseResult) return []
    const leaves = flattenLeaves(groups)
    const units = parseResult.entities.filter((e): e is UnitEntity => e.kind === 'unit')
    return buildUnitViews(units, leaves, parseResult.modPrefix)
  }, [parseResult, groups])

  const blockViews = useMemo<BlockView[]>(() => {
    if (!parseResult) return []
    const leaves = flattenLeaves(groups)
    const blocks = parseResult.entities.filter((e): e is DefEntity => e.kind === 'block')
    return buildBlockViews(blocks, leaves)
  }, [parseResult, groups])

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

  // Auto-load the last-opened root + settings + vanilla index on launch.
  useEffect(() => {
    void window.api.getSettings().then(setSettings)
    void window.api.getLastRoot().then((last) => {
      if (last) void loadRoot(last)
    })
    void loadVanilla()
  }, [loadRoot, loadVanilla])

  // Load the active sprite's bytes + dimensions. reloadNonce forces a re-read
  // when the watcher reports the active file changed on disk.
  useEffect(() => {
    if (!activePath) {
      setImage(null)
      return
    }
    let cancelled = false
    void window.api
      .readSprite(activePath)
      .then((img) => {
        if (!cancelled) setImage(img)
      })
      .catch(() => {
        if (!cancelled) setImage(null)
      })
    return () => {
      cancelled = true
    }
  }, [activePath, reloadNonce])

  // Live-reload: refresh the tree on any watched .png change (bumping the
  // composite's reload version), and refresh the active preview when its file
  // is the one that changed.
  useEffect(() => {
    if (!modRoot) return
    return window.api.onSpritesChanged((e) => {
      void window.api.readSpriteTree(modRoot).then((r) => {
        if (r) setGroups(r.groups)
      })
      setSpritesVersion((n) => n + 1)
      if (activePath === e.path) {
        if (e.event === 'unlink') selectSprite(null)
        else setReloadNonce((n) => n + 1)
      }
    })
  }, [modRoot, activePath, selectSprite])

  const openInEditor = useCallback(async () => {
    if (!activePath) return
    try {
      await window.api.openInEditor(activePath)
    } catch (err) {
      if (String(err).includes('NO_EDITOR')) {
        setShowSettings(true)
      } else {
        window.alert(`Could not open editor:\n${String(err)}`)
      }
    }
  }, [activePath])

  const replaceSprite = useCallback(async () => {
    if (!activePath) return
    const name = activePath.split(/[\\/]/).pop() ?? activePath
    const ok = window.confirm(`Overwrite "${name}" with another PNG?\nThis cannot be undone.`)
    if (!ok) return
    await window.api.replaceSprite(activePath)
    // The watcher fires a 'change' event → tree, preview, and composite refresh.
  }, [activePath])

  const chooseEditor = useCallback(async () => {
    setSettings(await window.api.chooseEditor())
  }, [])

  const parseContent = useCallback(async () => {
    if (!modRoot) return
    setParseResult(await window.api.parseContent(modRoot))
    setLeftTab('units')
  }, [modRoot])

  const activeUnit = useMemo(
    () => unitViews.find((v) => v.unit.id === unitSel?.unitId) ?? null,
    [unitViews, unitSel]
  )
  const activeBlock = useMemo(
    () => blockViews.find((v) => v.block.id === blockSel?.blockId) ?? null,
    [blockViews, blockSel]
  )

  if (!modRoot) {
    return <EmptyState onPick={pickFolder} error={pickError} />
  }

  // App-level category nav, rendered at the left of the preview toolbar.
  const categoryTabs = (
    <div className={styles.catTabs}>
      <button
        className={leftTab === 'sprites' ? styles.catTabActive : styles.catTab}
        onClick={() => setLeftTab('sprites')}
      >
        Sprites
      </button>
      <button
        className={leftTab === 'units' ? styles.catTabActive : styles.catTab}
        onClick={() => setLeftTab('units')}
        disabled={!parseResult}
        title={parseResult ? '' : 'Parse content first'}
      >
        Units{parseResult ? ` (${unitViews.length})` : ''}
      </button>
      <button
        className={leftTab === 'blocks' ? styles.catTabActive : styles.catTab}
        onClick={() => setLeftTab('blocks')}
        disabled={!parseResult}
        title={parseResult ? '' : 'Parse content first'}
      >
        Blocks{parseResult ? ` (${blockViews.length})` : ''}
      </button>
    </div>
  )

  // View-mode segmented: composites get In-game/Component/Compare, the raw
  // Sprites tab gets View/Compare. Compare is a global flag across tabs.
  const isSprites = leftTab === 'sprites'
  const modeActive = compare ? 'compare' : isSprites ? 'view' : compMode
  const modeBtn = (key: string, label: string, onClick: () => void): JSX.Element => (
    <button
      className={modeActive === key ? styles.catTabActive : styles.catTab}
      onClick={onClick}
    >
      {label}
    </button>
  )
  const modeTabs = (
    <div className={styles.catTabs}>
      {isSprites ? (
        modeBtn('view', 'View', () => setCompare(false))
      ) : (
        <>
          {modeBtn('ingame', 'In-game', () => {
            setCompare(false)
            setCompMode('ingame')
          })}
          {modeBtn('component', 'Component', () => {
            setCompare(false)
            setCompMode('component')
          })}
        </>
      )}
      {modeBtn('compare', 'Compare', () => setCompare(true))}
    </div>
  )

  const activeName = activePath ? (activePath.split(/[\\/]/).pop() ?? '').replace(/\.png$/i, '') : ''

  return (
    <div className={styles.app}>
      <aside className={styles.left}>
        <div className={styles.leftHeader}>
          <button className={styles.headerBtn} onClick={parseContent}>
            Parse content
          </button>
          {parseResult && (
            <button className={styles.headerBtn} onClick={() => setShowDebug(true)}>
              Debug
            </button>
          )}
          <button className={styles.headerBtn} onClick={() => setShowSettings(true)}>
            ⚙
          </button>
          <button className={styles.headerBtn} onClick={pickFolder}>
            Change
          </button>
        </div>

        {pickError && <p className={styles.pickError}>{pickError}</p>}
        <div className={styles.treeScroll}>
          {leftTab === 'sprites' &&
            groups.map((group) => (
              <SpriteTree
                key={group.path}
                node={group}
                selectedPath={activePath}
                onSelect={(node) => selectSprite(node.path)}
              />
            ))}
          {leftTab === 'units' && (
            <ContentTree
              units={unitViews}
              selectedUnitId={unitSel?.unitId ?? null}
              selectedComponent={unitSel?.component ?? null}
              onSelectUnit={(v) => {
                setUnitSel({ unitId: v.unit.id, component: null })
                setCompMode('ingame')
                selectSprite(v.base)
              }}
              onSelectComponent={(v, c) => {
                setUnitSel({ unitId: v.unit.id, component: c })
                setCompMode('component')
                selectSprite(c.file)
              }}
            />
          )}
          {leftTab === 'blocks' && (
            <BlockTree
              blocks={blockViews}
              selectedBlockId={blockSel?.blockId ?? null}
              selectedComponent={blockSel?.component ?? null}
              onSelectBlock={(v) => {
                setBlockSel({ blockId: v.block.id, component: null })
                setCompMode('ingame')
                selectSprite(v.main)
              }}
              onSelectComponent={(v, c) => {
                setBlockSel({ blockId: v.block.id, component: c })
                setCompMode('component')
                selectSprite(c.file)
              }}
            />
          )}
        </div>
      </aside>

      <main className={styles.center}>
        {compare ? (
          <CompareView
            currentPath={activePath}
            currentName={activeName}
            refs={refs}
            reloadVersion={spritesVersion}
            modeTabs={modeTabs}
            leading={categoryTabs}
          />
        ) : leftTab === 'units' && activeUnit ? (
          <CompositeView
            view={activeUnit}
            component={unitSel?.component ?? null}
            mode={compMode}
            reloadVersion={spritesVersion}
            modeTabs={modeTabs}
            leading={categoryTabs}
          />
        ) : leftTab === 'blocks' && activeBlock ? (
          <BlockCompositeView
            view={activeBlock}
            component={blockSel?.component ?? null}
            mode={compMode}
            reloadVersion={spritesVersion}
            modeTabs={modeTabs}
            leading={categoryTabs}
          />
        ) : (
          <PreviewPane image={image} fitKey={activePath} leading={categoryTabs} modeTabs={modeTabs} />
        )}
      </main>

      <aside className={styles.right}>
        <div className={styles.statusPath} title={modRoot}>
          {shortenPath(modRoot)}
        </div>
        {compare ? (
          <div className={styles.compareRight}>
            <InfoPane
              path={activePath}
              unresolved={activeUnresolved}
              image={image}
              onOpenEditor={openInEditor}
              onReplace={replaceSprite}
            />
            <div className={styles.refWrap}>
              <RefPicker
                currentPath={activePath}
                mine={mineRefs}
                vanilla={vanillaRefs}
                refs={refs}
                onToggle={toggleRef}
                onRemove={removeRef}
                onChooseVanilla={chooseVanilla}
              />
            </div>
          </div>
        ) : (
          <InfoPane
            path={activePath}
            unresolved={activeUnresolved}
            image={image}
            onOpenEditor={openInEditor}
            onReplace={replaceSprite}
          />
        )}
      </aside>

      {showSettings && (
        <SettingsPanel
          editorPath={settings.editorPath}
          vanillaPath={settings.vanillaSpritesPath}
          onChooseEditor={chooseEditor}
          onChooseVanilla={chooseVanilla}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showDebug && parseResult && (
        <DebugPanel result={parseResult} groups={groups} onClose={() => setShowDebug(false)} />
      )}
    </div>
  )
}
