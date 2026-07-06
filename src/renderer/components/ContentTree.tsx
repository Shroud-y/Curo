import { useState } from 'react'
import type { ComponentSel, UnitView } from '../lib/unitModel'
import styles from './ContentTree.module.css'

interface Props {
  units: UnitView[]
  selectedUnitId: string | null
  /** null = the unit's In-game composite is selected (parent node). */
  selectedComponent: ComponentSel | null
  onSelectUnit: (v: UnitView) => void
  onSelectComponent: (v: UnitView, c: ComponentSel) => void
}

export function ContentTree({
  units,
  selectedUnitId,
  selectedComponent,
  onSelectUnit,
  onSelectComponent
}: Props): JSX.Element {
  return (
    <div>
      {units.map((v) => (
        <UnitNode
          key={v.unit.file + v.unit.name}
          view={v}
          selected={selectedUnitId === v.unit.id}
          selectedComponent={selectedUnitId === v.unit.id ? selectedComponent : null}
          onSelectUnit={onSelectUnit}
          onSelectComponent={onSelectComponent}
        />
      ))}
    </div>
  )
}

function UnitNode({
  view,
  selected,
  selectedComponent,
  onSelectUnit,
  onSelectComponent
}: {
  view: UnitView
  selected: boolean
  selectedComponent: ComponentSel | null
  onSelectUnit: (v: UnitView) => void
  onSelectComponent: (v: UnitView, c: ComponentSel) => void
}): JSX.Element {
  const [open, setOpen] = useState(false)

  // Component children: base, weapons (declared order), cell (if present).
  const children: ComponentSel[] = [
    { kind: 'base', file: view.base, label: 'base' },
    ...view.weapons.map((w) => ({ kind: 'weapon' as const, file: w.file, label: w.label })),
    ...(view.cell ? [{ kind: 'cell' as const, file: view.cell, label: 'cell' }] : [])
  ]

  const unitActive = selected && selectedComponent === null

  return (
    <div>
      <div className={styles.row}>
        <span className={styles.chevron} onClick={() => setOpen((o) => !o)}>
          {open ? '▾' : '▸'}
        </span>
        <span
          className={`${styles.label} ${unitActive ? styles.active : ''}`}
          onClick={() => onSelectUnit(view)}
        >
          🛠 {view.unit.id}
          {!view.unit.hasCell && <span className={styles.tag}>noCell</span>}
        </span>
      </div>
      {open &&
        children.map((c, i) => {
          const active =
            selected &&
            selectedComponent?.kind === c.kind &&
            selectedComponent?.label === c.label
          return (
            <div
              key={`${c.kind}:${c.label}:${i}`}
              className={`${styles.child} ${active ? styles.active : ''} ${c.file ? '' : styles.missing}`}
              onClick={() => onSelectComponent(view, c)}
              title={c.file ?? 'unresolved'}
            >
              {c.kind === 'base' ? '▢' : c.kind === 'cell' ? '◈' : '⚔'} {c.label}
              {!c.file && <span className={styles.tag}>?</span>}
            </div>
          )
        })}
    </div>
  )
}
