import type { UnitEntity } from '@shared/content'
import type { Leaf } from './resolveSprites'
import { resolveBase, resolveCell, resolveUnit } from './resolveSprites'

/** A weapon prepared for compositing: resolved sprite + placement flags. */
export interface WeaponView {
  /** Display label, e.g. "cannon" (region minus prefix) or the raw region. */
  label: string
  region: string
  file: string | null
  pos: { x: number; y: number }
  mirror: boolean
  rotate: boolean
  top: boolean
}

/** A unit prepared for the composite renderer + content tree. */
export interface UnitView {
  unit: UnitEntity
  base: string | null
  cell: string | null
  weapons: WeaponView[]
}

/** A single isolated component picked from the content tree (Component mode). */
export interface ComponentSel {
  kind: 'base' | 'cell' | 'weapon'
  file: string | null
  label: string
}

/** Team presets. Values are multiply-tint colors for the cell sprite. */
export const TEAMS: Record<string, string> = {
  Sharded: '#ffd37f',
  Crux: '#f25555',
  Malis: '#a154d6'
}

/** Build render-ready views for every unit, resolving base/cell/weapon sprites. */
export function buildUnitViews(units: UnitEntity[], leaves: Leaf[], modPrefix: string): UnitView[] {
  return units.map((unit) => {
    const res = resolveUnit(leaves, unit, modPrefix)
    const weapons: WeaponView[] = unit.weapons.map((w, i) => {
      const stripped =
        modPrefix && w.region.startsWith(modPrefix) ? w.region.slice(modPrefix.length) : w.region
      return {
        label: stripped || `weapon ${i + 1}`,
        region: w.region,
        file: res.weapons[i]?.file ?? null,
        pos: w.pos,
        mirror: w.mirror,
        rotate: w.rotate,
        top: w.top
      }
    })
    return {
      unit,
      base: resolveBase(leaves, unit.id),
      cell: resolveCell(leaves, unit.id),
      weapons
    }
  })
}
