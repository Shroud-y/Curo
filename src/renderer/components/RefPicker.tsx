import { useMemo, useState } from 'react'
import { MAX_REFS, type RefItem } from '../lib/compare'
import styles from './RefPicker.module.css'

export interface RefEntry {
  name: string
  path: string
}

interface Props {
  currentPath: string | null
  mine: RefEntry[]
  /** null = vanilla folder not configured yet. */
  vanilla: RefEntry[] | null
  refs: RefItem[]
  onToggle: (item: RefItem) => void
  onRemove: (path: string) => void
  onChooseVanilla: () => void
}

export function RefPicker({
  currentPath,
  mine,
  vanilla,
  refs,
  onToggle,
  onRemove,
  onChooseVanilla
}: Props): JSX.Element {
  const [tab, setTab] = useState<'mine' | 'vanilla'>('mine')
  const [q, setQ] = useState('')

  const selected = useMemo(() => new Set(refs.map((r) => r.path)), [refs])
  const atCap = refs.length >= MAX_REFS

  const list = tab === 'mine' ? mine : (vanilla ?? [])
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const base = needle ? list.filter((e) => e.name.toLowerCase().includes(needle)) : list
    return base.slice(0, 400)
  }, [list, q])

  return (
    <div className={styles.pane}>
      <div className={styles.chips}>
        {refs.length === 0 && <span className={styles.dim}>No references selected</span>}
        {refs.map((r) => (
          <span key={r.path} className={styles.chip}>
            {r.name}
            <button className={styles.chipX} onClick={() => onRemove(r.path)}>
              ×
            </button>
          </span>
        ))}
      </div>
      <div className={styles.cap}>
        {refs.length}/{MAX_REFS} references
      </div>

      <div className={styles.tabs}>
        <button className={tab === 'mine' ? styles.tabActive : styles.tab} onClick={() => setTab('mine')}>
          Mine
        </button>
        <button className={tab === 'vanilla' ? styles.tabActive : styles.tab} onClick={() => setTab('vanilla')}>
          Vanilla
        </button>
      </div>

      {tab === 'vanilla' && vanilla === null ? (
        <div className={styles.empty}>
          <p className={styles.dim}>Vanilla sprites folder not set.</p>
          <button className={styles.setBtn} onClick={onChooseVanilla}>
            Set vanilla sprites folder
          </button>
        </div>
      ) : (
        <>
          <input
            className={styles.search}
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className={styles.list}>
            {filtered.map((e) => {
              const isSel = selected.has(e.path)
              const isCurrent = e.path === currentPath
              const disabled = !isSel && (atCap || isCurrent)
              return (
                <div
                  key={e.path}
                  className={`${styles.row} ${isSel ? styles.rowSel : ''} ${disabled ? styles.rowDisabled : ''}`}
                  onClick={() => {
                    if (isSel) onRemove(e.path)
                    else if (!disabled) onToggle({ source: tab, name: e.name, path: e.path })
                  }}
                  title={isCurrent ? 'this is the current sprite' : e.path}
                >
                  <span className={styles.check}>{isSel ? '☑' : '☐'}</span>
                  <span className={styles.name}>{e.name}</span>
                  {isCurrent && <span className={styles.dim}>current</span>}
                </div>
              )
            })}
            {filtered.length === 0 && <div className={styles.dim}>No matches</div>}
          </div>
        </>
      )}
    </div>
  )
}
