import { useMemo, useState } from 'react'
import type { SpriteNode } from '@shared/types'
import type { DefEntity, DefKind, ParseResult, RegionPartRef, UnitEntity } from '@shared/content'
import { flattenLeaves, resolveUnit, type UnitResolution } from '../lib/resolveSprites'
import styles from './DebugPanel.module.css'

interface Props {
  result: ParseResult
  groups: SpriteNode[]
  onClose: () => void
}

const partLabel = (p: RegionPartRef): string => p.suffix ?? '(custom)'

/** Throwaway debug UI to verify content parsing + sprite resolution. */
export function DebugPanel({ result, groups, onClose }: Props): JSX.Element {
  const leaves = useMemo(() => flattenLeaves(groups), [groups])

  const units = result.entities.filter((e): e is UnitEntity => e.kind === 'unit')
  const defsOf = (k: DefKind): DefEntity[] =>
    result.entities.filter((e): e is DefEntity => e.kind === k)
  const blocks = defsOf('block')
  const items = defsOf('item')
  const liquids = defsOf('liquid')
  const other = defsOf('other')

  const resolved = useMemo(
    () => units.map((u) => ({ unit: u, res: resolveUnit(leaves, u, result.modPrefix) })),
    [units, leaves, result.modPrefix]
  )

  const weaponsWithRegion = resolved.reduce(
    (n, r) => n + r.res.weapons.filter((w) => !w.noRegion).length,
    0
  )
  const resolvedCount = resolved.reduce(
    (n, r) => n + r.res.weapons.filter((w) => !w.noRegion && w.file).length,
    0
  )
  const unresolved = weaponsWithRegion - resolvedCount

  const [copied, setCopied] = useState(false)
  const copy = (): void => {
    void navigator.clipboard
      .writeText(buildDump(result, resolved, blocks, items, liquids, other, resolvedCount, weaponsWithRegion))
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      })
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Parsed content (debug)</h2>
          <div className={styles.headActions}>
            <button className={styles.copyBtn} onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button className={styles.close} onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        <p className={styles.counts}>
          prefix <code>{result.modPrefix || '(none)'}</code> · {units.length} units ·{' '}
          {blocks.length} blocks · {items.length} items · {liquids.length} liquids ·{' '}
          {other.length} other · regions{' '}
          <span className={unresolved ? styles.bad : styles.ok}>
            {resolvedCount}/{weaponsWithRegion} resolved
          </span>{' '}
          · {result.files.length} files
        </p>

        <div className={styles.scroll}>
          <Section title={`Units (${units.length})`}>
            {resolved.map((r) => (
              <UnitRow key={r.unit.file + r.unit.name} unit={r.unit} res={r.res} />
            ))}
          </Section>

          <DefSection title="Blocks" defs={blocks} />
          <DefSection title="Items" defs={items} />
          <DefSection title="Liquids" defs={liquids} />
          <DefSection title="Other" defs={other} />
        </div>
      </div>
    </div>
  )
}

function UnitRow({ unit, res }: { unit: UnitEntity; res: UnitResolution }): JSX.Element {
  return (
    <div className={styles.entity}>
      <div className={styles.entityHead}>
        <b>{unit.id}</b>
        <span className={styles.dim}>({unit.name})</span>
        {!unit.hasCell && <span className={styles.tag}>noCell</span>}
      </div>
      <div className={styles.scan}>
        scan: {res.scanDir} · {res.pngCount} png{res.usedFallback && ' ⚠ fallback (folder not found)'}
      </div>
      {res.weapons.length === 0 && <div className={styles.dim}>no weapons</div>}
      {res.weapons.map((w, i) => (
        <div key={i} className={styles.weapon}>
          <code>&quot;{w.region}&quot;</code>
          {' → '}
          {w.noRegion ? (
            <span className={styles.dim}>(no region)</span>
          ) : w.file ? (
            <span className={styles.file}>{w.file}</span>
          ) : (
            <span className={styles.bad}>UNRESOLVED</span>
          )}
        </div>
      ))}
    </div>
  )
}

function DefSection({ title, defs }: { title: string; defs: DefEntity[] }): JSX.Element | null {
  if (defs.length === 0) return null
  return (
    <Section title={`${title} (${defs.length})`}>
      {defs.map((d) => (
        <div key={d.file + d.name} className={styles.entity}>
          <div className={styles.entityHead}>
            <b>{d.id}</b>
            <span className={styles.dim}>{d.className}</span>
          </div>
          <div className={styles.dim}>
            parts: {d.regionParts.length ? d.regionParts.map(partLabel).join(', ') : '—'}
          </div>
        </div>
      ))}
    </Section>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  const [open, setOpen] = useState(true)
  return (
    <div className={styles.section}>
      <button className={styles.sectionHead} onClick={() => setOpen((o) => !o)}>
        {open ? '▾' : '▸'} {title}
      </button>
      {open && <div className={styles.sectionBody}>{children}</div>}
    </div>
  )
}

/** Plain-text dump for the clipboard. */
function buildDump(
  result: ParseResult,
  resolved: Array<{ unit: UnitEntity; res: UnitResolution }>,
  blocks: DefEntity[],
  items: DefEntity[],
  liquids: DefEntity[],
  other: DefEntity[],
  resolvedCount: number,
  weaponsWithRegion: number
): string {
  const lines: string[] = []
  lines.push(
    `prefix ${result.modPrefix || '(none)'} · ${resolved.length} units · ` +
      `${blocks.length} blocks · ${items.length} items · ${liquids.length} liquids · ` +
      `${other.length} other · ${resolvedCount}/${weaponsWithRegion} regions resolved · ` +
      `${result.files.length} files`
  )
  lines.push('', '# Units')
  for (const { unit, res } of resolved) {
    lines.push(`${unit.id} (${unit.name})${unit.hasCell ? '' : ' [noCell]'}`)
    lines.push(`  scan: ${res.scanDir} · ${res.pngCount} png${res.usedFallback ? ' [fallback]' : ''}`)
    for (const w of res.weapons) {
      const target = w.noRegion ? '(no region)' : (w.file ?? 'UNRESOLVED')
      lines.push(`  "${w.region}" -> ${target}`)
    }
  }
  const dumpDefs = (title: string, defs: DefEntity[]): void => {
    if (!defs.length) return
    lines.push('', `# ${title}`)
    for (const d of defs) {
      const parts = d.regionParts.length ? d.regionParts.map(partLabel).join(', ') : '—'
      lines.push(`${d.id} (${d.className}) parts: ${parts}`)
    }
  }
  dumpDefs('Blocks', blocks)
  dumpDefs('Items', items)
  dumpDefs('Liquids', liquids)
  dumpDefs('Other', other)
  return lines.join('\n')
}
