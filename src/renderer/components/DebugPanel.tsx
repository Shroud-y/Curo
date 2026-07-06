import { useMemo, useState } from 'react'
import type { SpriteNode } from '@shared/types'
import type { DefEntity, DefKind, ParseResult, RegionPartRef, UnitEntity } from '@shared/content'
import { flattenLeaves, resolveCell, resolveUnit, type UnitResolution } from '../lib/resolveSprites'
import { buildBlockViews, type BlockView } from '../lib/blockModel'
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

  // Units with a real -cell sprite (tint-capable) vs baked-in cell.
  const tintCapable = units.filter((u) => u.hasCell && resolveCell(leaves, u.id) !== null)

  // Block foundation resolution + code-drawn blocks.
  const blockViews = useMemo(() => buildBlockViews(blocks, leaves), [blocks, leaves])
  const turrets = blockViews.filter((b) => b.isTurret)
  const noBase = blockViews.filter((b) => b.main === null)
  // Confirm the turretBase folder is actually indexed.
  const turretBaseCount = leaves.filter((l) => l.path.toLowerCase().includes('/turretbase/')).length
  // Full-tree index sanity: total png + the top-level sprite dirs discovered.
  const topDirs = [
    ...new Set(
      leaves
        .map((l) => /\/sprites\/([^/]+)\//.exec(l.path)?.[1])
        .filter((d): d is string => Boolean(d))
    )
  ].sort()

  const [copied, setCopied] = useState(false)
  const copy = (): void => {
    void navigator.clipboard
      .writeText(
        buildDump(result, resolved, blocks, items, liquids, other, resolvedCount, weaponsWithRegion, turrets, turretBaseCount)
      )
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

        <p className={styles.counts}>
          <b>tint-capable</b> ({tintCapable.length}/{units.length} have a -cell sprite):{' '}
          {tintCapable.length ? tintCapable.map((u) => u.id).join(', ') : '(none — all baked-in)'}
        </p>

        <p className={styles.counts}>
          <b>sprite index</b>: {leaves.length} png · top-level dirs:{' '}
          {topDirs.length ? topDirs.join(', ') : '(none)'}
        </p>

        <p className={styles.counts}>
          <b>turretBase index</b>: {turretBaseCount} png{' '}
          <span className={turretBaseCount ? styles.ok : styles.bad}>
            {turretBaseCount ? '(scanned)' : '(NOT FOUND — nested block subfolder not indexed)'}
          </span>{' '}
          · <b>no base sprite</b> ({noBase.length}):{' '}
          {noBase.length ? noBase.map((b) => `${b.block.id} (${b.block.className})`).join(', ') : '(none)'}
        </p>

        <div className={styles.scroll}>
          <Section title={`Turret foundations (${turrets.length})`}>
            {turrets.map((b) => (
              <div key={b.block.file + b.block.name} className={styles.entity}>
                <b>{b.block.id}</b> <span className={styles.dim}>size={b.size}</span>
                {' foundation → '}
                {b.foundation ? (
                  <span className={styles.file}>turretBase/{b.foundationLabel}.png</span>
                ) : (
                  <span className={styles.bad}>
                    NONE (looked for {b.block.id}-base.png / block-{b.size}.png)
                  </span>
                )}
              </div>
            ))}
          </Section>

          <Section title={`Units (${units.length})`}>
            {resolved.map((r) => (
              <UnitRow key={r.unit.file + r.unit.name} unit={r.unit} res={r.res} />
            ))}
          </Section>

          <DefSection title="Blocks" defs={blocks} showSize />
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

function DefSection({
  title,
  defs,
  showSize = false
}: {
  title: string
  defs: DefEntity[]
  showSize?: boolean
}): JSX.Element | null {
  if (defs.length === 0) return null
  return (
    <Section title={`${title} (${defs.length})`}>
      {defs.map((d) => (
        <div key={d.file + d.name} className={styles.entity}>
          <div className={styles.entityHead}>
            <b>{d.id}</b>
            <span className={styles.dim}>({d.className})</span>
            {showSize && <span className={styles.dim}>size={d.size}</span>}
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
  weaponsWithRegion: number,
  turrets: BlockView[],
  turretBaseCount: number
): string {
  const lines: string[] = []
  lines.push(
    `prefix ${result.modPrefix || '(none)'} · ${resolved.length} units · ` +
      `${blocks.length} blocks · ${items.length} items · ${liquids.length} liquids · ` +
      `${other.length} other · ${resolvedCount}/${weaponsWithRegion} regions resolved · ` +
      `${result.files.length} files`
  )

  lines.push('', `# Turret foundations (turretBase index: ${turretBaseCount} png)`)
  for (const b of turrets) {
    const found = b.foundation
      ? `turretBase/${b.foundationLabel}.png`
      : `NONE (looked for ${b.block.id}-base.png / block-${b.size}.png)`
    lines.push(`${b.block.id} size=${b.size} foundation -> ${found}`)
  }

  lines.push('', '# Units')
  for (const { unit, res } of resolved) {
    lines.push(`${unit.id} (${unit.name})${unit.hasCell ? '' : ' [noCell]'}`)
    lines.push(`  scan: ${res.scanDir} · ${res.pngCount} png${res.usedFallback ? ' [fallback]' : ''}`)
    for (const w of res.weapons) {
      const target = w.noRegion ? '(no region)' : (w.file ?? 'UNRESOLVED')
      lines.push(`  "${w.region}" -> ${target}`)
    }
  }
  const dumpDefs = (title: string, defs: DefEntity[], withSize = false): void => {
    if (!defs.length) return
    lines.push('', `# ${title}`)
    for (const d of defs) {
      const parts = d.regionParts.length ? d.regionParts.map(partLabel).join(', ') : '—'
      const size = withSize ? ` size=${d.size}` : ''
      lines.push(`${d.id} (${d.className})${size} parts: ${parts}`)
    }
  }
  dumpDefs('Blocks', blocks, true)
  dumpDefs('Items', items)
  dumpDefs('Liquids', liquids)
  dumpDefs('Other', other)
  return lines.join('\n')
}
