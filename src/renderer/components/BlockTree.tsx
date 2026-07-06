import { useState } from 'react'
import type { BlockComponentSel, BlockView } from '../lib/blockModel'
import styles from './ContentTree.module.css'

interface Props {
  blocks: BlockView[]
  selectedBlockId: string | null
  selectedComponent: BlockComponentSel | null
  onSelectBlock: (v: BlockView) => void
  onSelectComponent: (v: BlockView, c: BlockComponentSel) => void
}

export function BlockTree({
  blocks,
  selectedBlockId,
  selectedComponent,
  onSelectBlock,
  onSelectComponent
}: Props): JSX.Element {
  // Sort by type: turrets first, then grouped by className, then by id.
  const sorted = [...blocks].sort((a, b) => {
    if (a.isTurret !== b.isTurret) return a.isTurret ? -1 : 1
    if (a.block.className !== b.block.className)
      return a.block.className.localeCompare(b.block.className)
    return a.block.id.localeCompare(b.block.id)
  })

  return (
    <div>
      {sorted.map((v) => (
        <BlockNode
          key={v.block.file + v.block.name}
          view={v}
          selected={selectedBlockId === v.block.id}
          selectedComponent={selectedBlockId === v.block.id ? selectedComponent : null}
          onSelectBlock={onSelectBlock}
          onSelectComponent={onSelectComponent}
        />
      ))}
    </div>
  )
}

function BlockNode({
  view,
  selected,
  selectedComponent,
  onSelectBlock,
  onSelectComponent
}: {
  view: BlockView
  selected: boolean
  selectedComponent: BlockComponentSel | null
  onSelectBlock: (v: BlockView) => void
  onSelectComponent: (v: BlockView, c: BlockComponentSel) => void
}): JSX.Element {
  const [open, setOpen] = useState(false)

  const children: BlockComponentSel[] = [
    ...(view.isTurret
      ? [{ kind: 'foundation' as const, file: view.foundation, label: view.foundationLabel || 'foundation' }]
      : []),
    { kind: 'base', file: view.main, label: 'base' },
    ...view.parts.map((p) => ({ kind: 'part' as const, file: p.file, label: p.label }))
  ]

  const blockActive = selected && selectedComponent === null

  return (
    <div>
      <div className={styles.row}>
        <span className={styles.chevron} onClick={() => setOpen((o) => !o)}>
          {open ? '▾' : '▸'}
        </span>
        <span
          className={`${styles.label} ${blockActive ? styles.active : ''}`}
          onClick={() => onSelectBlock(view)}
        >
          {view.isTurret ? '🎯' : '⬛'} {view.block.id}
          <span className={styles.tag}>{view.isTurret ? `t·${view.size}` : view.block.className}</span>
        </span>
      </div>
      {open &&
        children.map((c, i) => {
          const active =
            selected && selectedComponent?.kind === c.kind && selectedComponent?.label === c.label
          return (
            <div
              key={`${c.kind}:${c.label}:${i}`}
              className={`${styles.child} ${active ? styles.active : ''} ${c.file ? '' : styles.missing}`}
              onClick={() => onSelectComponent(view, c)}
              title={c.file ?? 'unresolved'}
            >
              {c.kind === 'foundation' ? '▤' : c.kind === 'base' ? '▢' : '✦'} {c.label}
              {!c.file && <span className={styles.tag}>?</span>}
            </div>
          )
        })}
    </div>
  )
}
